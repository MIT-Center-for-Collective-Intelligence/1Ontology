import { MESSAGES, USERS } from "@components/lib/firestoreClient/collections";
import CloseIcon from "@mui/icons-material/Close";
import { a11yProps } from "@components/lib/utils/TabPanel";

import { Box, Tabs, Tab, Modal, Paper, IconButton } from "@mui/material";
import {
  query,
  collection,
  getDocs,
  getFirestore,
  addDoc,
} from "firebase/firestore";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Chat from "../Chat/Chat";
import { SCROLL_BAR_STYLE, development } from "@components/lib/CONSTANTS";
import { Post } from "@components/lib/utils/Post";
import ExpandSearchResult from "../OntologyComponents/ExpandSearchResult";
import { SearchBox } from "../SearchBox/SearchBox";
import { INode } from "@components/types/INode";

const ChatSideBar = ({
  currentVisibleNode,
  user,
  confirmIt,
  searchWithFuse,
  navigateToNode,
  chatTabs,
  selectedChatTab,
  setSelectedChatTab,
  nodes,
  fetchNode,
  appName,
}: {
  currentVisibleNode: any;
  user: any;
  confirmIt: any;
  searchWithFuse: any;
  navigateToNode: any;
  chatTabs: { title: string; id: string; placeholder: string }[];
  selectedChatTab: number;
  setSelectedChatTab: Function;
  nodes: { [nodeId: string]: INode };
  fetchNode: (nodeId: string) => Promise<INode | null>;
  appName: string;
}) => {
  const db = getFirestore();
  const [users, setUsers] = useState<
    {
      id: string;
      display: string;
      uname: string;
      fullName: string;
      imageUrl: string;
    }[]
  >([]);
  const [openModel, setOpenModel] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [chromaSearchResults, setChromaSearchResults] = useState<any[]>([]);
  const [loadingChromaSearch, setLoadingChromaSearch] = useState(false);
  const [useChromaResults, setUseChromaResults] = useState(false);
  const previousSearchValue = useRef(searchValue);
  const scrollingRef = useRef<any>();

  const handleChatTabsChange = (event: any, newValue: number) => {
    setSelectedChatTab(newValue);
    // recordLogs({
    //   action: "chat tab change",
    //   viewType: newValue === 0 ? "Tree View" : "Dag View",
    // });
  };

  // Reset to fuse search when user types
  // This will be removed after fuse search is removed entirely
  useEffect(() => {
    if (searchValue !== previousSearchValue.current && useChromaResults) {
      setUseChromaResults(false);
      setChromaSearchResults([]);
    }
    previousSearchValue.current = searchValue;
  }, [searchValue, useChromaResults]);

  // Fetch all child nodes from search results
  const fetchChildNodesForSearchResults = useCallback(
    async (searchResults: any[]) => {
      if (!fetchNode || searchResults.length === 0) return;

      const childIds = new Set<string>();

      searchResults.forEach((result) => {
        // Get specializations
        result.specializations?.forEach((collection: any) => {
          collection.nodes?.forEach((node: any) => {
            if (!nodes[node.id]) {
              childIds.add(node.id);
            }
          });
        });

        // Get generalizations
        result.generalizations?.forEach((collection: any) => {
          collection.nodes?.forEach((node: any) => {
            if (!nodes[node.id]) {
              childIds.add(node.id);
            }
          });
        });

        // Get parts if applicable
        if (result.properties?.parts) {
          result.properties.parts.forEach((collection: any) => {
            collection.nodes?.forEach((node: any) => {
              if (!nodes[node.id]) {
                childIds.add(node.id);
              }
            });
          });
        }
      });

      // Fetch all missing child nodes in parallel
      if (childIds.size > 0) {
        await Promise.all(Array.from(childIds).map((id) => fetchNode(id)));
      }
    },
    [fetchNode, nodes],
  );

  // Handle Chroma search with child node fetching
  const handleChromaSearch = useCallback(async () => {
    if (!searchValue || searchValue.trim().length < 3) {
      return;
    }

    const fuseSearch = searchWithFuse(searchValue);

    try {
      setLoadingChromaSearch(true);
      setUseChromaResults(true);

      const response: any = await Post("/searchChroma", {
        query: searchValue,
        appName: appName || null,
      });

      const results: any = [...(response.results || [])];

      // Fallback to fuse if no chroma results
      if (results.length <= 0 && fuseSearch.length > 0) {
        results.push(...fuseSearch);
      }
      const exactResult = fuseSearch[0];
      if (
        exactResult &&
        exactResult.title.trim() === searchValue.toLowerCase().trim() &&
        !results.some((r: any) => r.id === exactResult.id)
      ) {
        results.unshift({ id: exactResult.id, title: exactResult.title });
      }

      setChromaSearchResults(development ? fuseSearch : results);

      // Fetch child nodes for all search results
      await fetchChildNodesForSearchResults(development ? fuseSearch : results);
    } catch (error) {
      console.error("[CHAT SIDEBAR] Error in chroma search:", error);
      setChromaSearchResults(fuseSearch);
    } finally {
      setLoadingChromaSearch(false);
    }
  }, [searchValue, appName, searchWithFuse, fetchChildNodesForSearchResults]);

  const searchResults = useMemo(() => {
    /*  recordLogs({
      action: "Searched",
      query: searchValue,
    }); */
    return searchWithFuse(searchValue);
  }, [searchValue, searchWithFuse]);

  // Always show currentVisibleNode at the top, with search results below if present
  const displayResults = useMemo(() => {
    if (!currentVisibleNode) return [];

    const results: INode[] = [];
    results.push(currentVisibleNode);

    // Determine which search results to use
    const resultsToUse = useChromaResults ? chromaSearchResults : searchResults;

    // Add search results if searchValue exists
    if (searchValue && resultsToUse.length > 0) {
      // Filter out currentVisibleNode from search results to avoid duplicates
      const filteredResults = resultsToUse.filter(
        (node: INode) => node.id !== currentVisibleNode.id,
      );
      results.push(...filteredResults);
    }

    return results;
  }, [
    currentVisibleNode,
    searchValue,
    searchResults,
    useChromaResults,
    chromaSearchResults,
  ]);

  useEffect(() => {
    (async () => {
      if (!db) return;
      const usersQuery = query(collection(db, USERS));
      const usersDocs = await getDocs(usersQuery);
      const _users: any = [];
      usersDocs.docs.forEach((userDoc: any, index: number) => {
        _users.push({
          id: userDoc.data().uname,
          display: `${userDoc.data().fName} ${userDoc.data().lName}`,
          uname: userDoc.data().uname,
          fullName: `${userDoc.data().fName} ${userDoc.data().lName}`,
          imageUrl: userDoc.data().imageUrl,
        });
      });
      setUsers(_users);
    })();
  }, [db]);

  const handleClose = useCallback(() => {
    setOpenModel(false);
  }, [setOpenModel]);

  const scrollToBottom = () => {
    if (scrollingRef.current) {
      scrollingRef.current.scrollIntoView({ behaviour: "smooth" });
    }
  };
  const sendNode = useCallback(
    async (nodeId: string, title: string) => {
      if (!user || !currentVisibleNode?.id) return;
      const messageData = {
        nodeId: currentVisibleNode?.id,
        text: title,
        sender: user.uname,
        senderDetail: {
          uname: user.uname,
          fullname: user.fName + " " + user.lName,
          imageUrl: user.imageUrl,
          uid: user.userId,
        },
        imageUrls: [],
        reactions: [],
        edited: false,
        deleted: false,
        totalReplies: 0,
        type: chatTabs[selectedChatTab].id,
        messageType: "node",
        sharedNodeId: nodeId,
        createdAt: new Date(),
      };
      await addDoc(collection(db, MESSAGES), messageData);
      scrollToBottom();
    },
    [chatTabs, currentVisibleNode?.id, db, selectedChatTab, user],
  );

  // useEffect(() => {
  //   if (!user) return;
  //   setBugReportMessages([]);
  //   setFeatureRequestMessages([]);
  //   setHelpMessages([]);
  //   const onSynchronize = (changes: chatChange[]) => {
  //     setBugReportMessages((prev) =>
  //       changes.reduce(synchronizeStuff, [...prev])
  //     );
  //   };
  //   const killSnapshot = getMessagesSnapshot(
  //     db,
  //     { type: "bug_report", lastVisible: null },
  //     onSynchronize
  //   );

  //   const onFeatureRequestSynchronize = (changes: chatChange[]) => {
  //     setFeatureRequestMessages((prev) =>
  //       changes.reduce(synchronizeStuff, [...prev])
  //     );
  //   };
  //   const killFeatureRequestSnapshot = getMessagesSnapshot(
  //     db,
  //     { type: "feature_request", lastVisible: null },
  //     onFeatureRequestSynchronize
  //   );

  //   const onHelSynchronize = (changes: chatChange[]) => {
  //     setHelpMessages((prev) => changes.reduce(synchronizeStuff, [...prev]));
  //   };
  //   const killHelpSnapshot = getMessagesSnapshot(
  //     db,
  //     { type: "help", lastVisible: null },
  //     onHelSynchronize
  //   );

  //   return () => {
  //     killSnapshot();
  //     killFeatureRequestSnapshot();
  //     killHelpSnapshot();
  //   };
  // }, [db, user]);
  const activeChatTab = chatTabs[selectedChatTab] ?? chatTabs[0];

  return (
    <Box
      sx={(theme) => ({
        position: "relative",
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        p: { xs: 1, sm: 1.25 },
        overflow: "hidden",
      })}
    >
      {chatTabs.length > 1 && (
        <Tabs
          id="chat-tabs"
          variant="scrollable"
          scrollButtons={false}
          value={selectedChatTab}
          onChange={handleChatTabsChange}
          aria-label="chat tabs"
          slotProps={{
            indicator: {
              sx: { display: "none" },
            },
          }}
          sx={{
            width: "100%",
            minHeight: 0,
            flexShrink: 0,
            borderRadius: 9999,
            px: 0.75,
            py: 0.5,
            mb: 1.25,
            background: (theme) =>
              theme.palette.mode === "dark"
                ? "linear-gradient(160deg, rgba(38, 39, 44, 0.98), rgba(22, 23, 27, 0.96))"
                : "linear-gradient(160deg, rgba(252, 253, 255, 0.98), rgba(238, 242, 250, 0.96))",
            border: (theme) =>
              theme.palette.mode === "dark"
                ? "1px solid rgba(255, 255, 255, 0.09)"
                : "1px solid rgba(18, 30, 60, 0.09)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.12), 0 2px 8px rgba(0, 0, 0, 0.06)",
            ".MuiTabs-scroller": {
              mx: 0,
              scrollBehavior: "smooth",
              scrollbarWidth: "thin",
              "&::-webkit-scrollbar": {
                height: "4px",
              },
              "&::-webkit-scrollbar-track": {
                background: "transparent",
              },
              "&::-webkit-scrollbar-thumb": {
                borderRadius: 999,
                backgroundColor: "rgba(127, 128, 140, 0.35)",
              },
            },
            ".MuiTabs-flexContainer": {
              gap: { xs: 0.375, sm: 0.5 },
              justifyContent: "flex-start",
              alignItems: "stretch",
              minHeight: 44,
            },
            ".MuiTab-root": {
              flex: "0 0 auto",
              maxWidth: "none",
              minHeight: 44,
              borderRadius: 9999,
              fontWeight: 700,
              fontSize: "0.875rem",
              letterSpacing: "0.01em",
              textTransform: "none",
              whiteSpace: "nowrap",
              justifyContent: "center",
              alignItems: "center",
              boxSizing: "border-box",
              opacity: 1,
              color: (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(255, 255, 255, 0.82)"
                  : "rgba(30, 32, 40, 0.78)",
              backgroundColor: "transparent",
              transition:
                "color 0.18s ease, background-color 0.18s ease, opacity 0.18s ease",
              "&:not(.Mui-selected):hover": {
                backgroundColor: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(255, 255, 255, 0.06)"
                    : "rgba(0, 0, 0, 0.04)",
                color: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(255, 255, 255, 0.96)"
                    : "rgba(20, 22, 30, 0.92)",
              },
            },
            ".MuiTab-root.Mui-selected": {
              color: "inherit",
              backgroundColor: "transparent",
              border: "none",
              boxShadow: "none",
            },
          }}
        >
          {chatTabs.map((tab, idx) => {
            const isSelected = selectedChatTab === idx;
            return (
              <Tab
                key={tab.id}
                {...a11yProps(idx)}
                label={
                  isSelected ? (
                    <Box
                      component="span"
                      sx={(theme) => ({
                        display: "inline-flex",
                        alignItems: "center",
                        maxWidth: "max-content",
                        px: { xs: 2, sm: 2.5 },
                        py: 0.625,
                        borderRadius: 9999,
                        boxSizing: "border-box",
                        lineHeight: 1.25,
                        color:
                          theme.palette.mode === "dark"
                            ? "rgb(255, 186, 132)"
                            : "rgb(145, 58, 14)",
                        background:
                          theme.palette.mode === "dark"
                            ? "linear-gradient(165deg, rgba(72, 48, 36, 0.98) 0%, rgba(52, 34, 26, 0.92) 100%)"
                            : "linear-gradient(165deg, rgba(255, 222, 186, 0.85) 0%, rgba(255, 188, 128, 0.65) 100%)",
                        border:
                          theme.palette.mode === "dark"
                            ? "1px solid rgba(255, 168, 108, 0.45)"
                            : "1px solid rgba(180, 72, 20, 0.35)",
                        boxShadow:
                          theme.palette.mode === "dark"
                            ? "inset 0 1px 0 rgba(255, 200, 150, 0.12), 0 1px 0 rgba(0,0,0,0.35), 0 2px 10px rgba(255, 120, 50, 0.12)"
                            : "inset 0 1px 0 rgba(255,255,255,0.65), 0 1px 2px rgba(120, 50, 10, 0.08)",
                        transition:
                          "background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease",
                      })}
                    >
                      {tab.title}
                    </Box>
                  ) : (
                    tab.title
                  )
                }
                sx={{
                  maxWidth: "none",
                  "&&": {
                    minWidth: "unset",
                    py: 0.625,
                    px: { xs: 1, sm: 1.25 },
                  },
                }}
              />
            );
          })}
        </Tabs>
      )}
      <Box
        sx={(theme) => ({
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          boxShadow:
            theme.palette.mode === "dark"
              ? "inset 0 1px 0 rgba(255,255,255,0.03), 0 10px 24px rgba(0,0,0,0.25)"
              : "inset 0 1px 0 rgba(255,255,255,0.82), 0 8px 22px rgba(17,30,59,0.08)",
          overflow: "hidden",
        })}
      >
        {activeChatTab ? (
          <Box
            role="tabpanel"
            id={`simple-tabpanel-${selectedChatTab}`}
            aria-labelledby={`simple-tab-${selectedChatTab}`}
            sx={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Chat
              key={activeChatTab.id}
              user={user}
              chatType={activeChatTab.id}
              nodeId={activeChatTab.id === "node" ? currentVisibleNode?.id : ""}
              users={users}
              confirmIt={confirmIt}
              setOpenSelectModel={setOpenModel}
              navigateToNode={navigateToNode}
              relatedNodes={nodes}
              fetchNode={fetchNode}
              scrollingRef={scrollingRef}
              placeholder={activeChatTab.placeholder}
              appName={appName}
            />
          </Box>
        ) : null}
      </Box>
      <Modal
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 50% 20%, rgba(35, 35, 40, 0.35), rgba(0, 0, 0, 0.45))",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
        }}
        open={openModel}
        onClose={handleClose}
      >
        <Box
          sx={{
            maxHeight: "80vh",
            minWidth: "900px",
            overflowY: "auto",
            borderRadius: 3,
            border: (theme) =>
              theme.palette.mode === "dark"
                ? "1px solid rgba(255, 255, 255, 0.12)"
                : "1px solid rgba(18, 30, 60, 0.12)",
            bgcolor: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(22, 23, 27, 0.9)"
                : "rgba(255, 255, 255, 0.95)",
            boxShadow: "0 28px 70px rgba(0, 0, 0, 0.38)",
            ...SCROLL_BAR_STYLE,
            "&::-webkit-scrollbar": {
              display: "none",
            },
          }}
        >
          <Paper
            sx={(theme) => ({
              position: "sticky",
              top: "0",
              px: "15px",
              py: 0.5,
              zIndex: 1,
              borderBottom:
                theme.palette.mode === "dark"
                  ? "1px solid rgba(255, 255, 255, 0.08)"
                  : "1px solid rgba(18, 30, 60, 0.08)",
              bgcolor:
                theme.palette.mode === "dark"
                  ? "rgba(27, 28, 32, 0.92)"
                  : "rgba(252, 253, 255, 0.92)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            })}
          >
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <SearchBox
                setSearch={setSearchValue}
                search={searchValue}
                label={"Search ..."}
                onSearch={handleChromaSearch}
                loading={loadingChromaSearch}
              />
              <IconButton
                onClick={() => {
                  setOpenModel(false);
                }}
                sx={(theme) => ({
                  ml: 0.5,
                  color:
                    theme.palette.mode === "dark"
                      ? "rgba(255,255,255,0.78)"
                      : "rgba(20,24,31,0.7)",
                  border:
                    theme.palette.mode === "dark"
                      ? "1px solid rgba(255,255,255,0.12)"
                      : "1px solid rgba(18,30,60,0.14)",
                  bgcolor:
                    theme.palette.mode === "dark"
                      ? "rgba(255,255,255,0.03)"
                      : "rgba(255,255,255,0.9)",
                  "&:hover": {
                    bgcolor:
                      theme.palette.mode === "dark"
                        ? "rgba(255,255,255,0.09)"
                        : "rgba(244,247,255,0.95)",
                  },
                })}
              >
                <CloseIcon />
              </IconButton>
            </Box>
          </Paper>
          <Paper
            sx={{
              background: "transparent",
            }}
          >
            <ExpandSearchResult
              searchResultsForSelection={displayResults}
              markItemAsChecked={(nodeId: string) => {
                const node = displayResults.find((n) => n.id === nodeId);
                if (node) {
                  sendNode(node.id, node.title);
                }
              }}
              handleCloning={null}
              checkedItems={new Set()}
              user={user}
              nodes={nodes}
              cloning={false}
              isSaving={false}
              disabledAddButton={false}
              getNumOfGeneralizations={() => false}
              selectedProperty=""
              addACloneNodeQueue={() => {}}
              currentVisibleNode={currentVisibleNode}
            />
          </Paper>
        </Box>
      </Modal>
    </Box>
  );
};

export default ChatSideBar;
