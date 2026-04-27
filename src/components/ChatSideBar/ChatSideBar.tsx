import { MESSAGES, USERS } from "@components/lib/firestoreClient/collections";
import CloseIcon from "@mui/icons-material/Close";
import { TabPanel, a11yProps } from "@components/lib/utils/TabPanel";

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
  skillsFuture = false,
  skillsFutureApp = "",
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
  skillsFuture?: boolean;
  skillsFutureApp?: string;
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
        skillsFuture,
        appName: skillsFuture ? skillsFutureApp : null,
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
  }, [
    searchValue,
    skillsFuture,
    skillsFutureApp,
    searchWithFuse,
    fetchChildNodesForSearchResults,
  ]);

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
      usersDocs.docs.forEach((userDoc: any) => {
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
  return (
    <Box
      sx={(theme) => ({
        position: "relative",
        borderRadius: 3,
        p: { xs: 1, sm: 1.25 },
        background:
          theme.palette.mode === "dark"
            ? "linear-gradient(180deg, rgba(28, 29, 33, 0.92) 0%, rgba(18, 19, 22, 0.92) 100%)"
            : "linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(246, 248, 252, 0.96) 100%)",
        border:
          theme.palette.mode === "dark"
            ? "1px solid rgba(255, 255, 255, 0.08)"
            : "1px solid rgba(18, 30, 60, 0.08)",
        boxShadow:
          theme.palette.mode === "dark"
            ? "0 12px 36px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.03)"
            : "0 12px 28px rgba(17, 30, 59, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9)",
        overflow: "hidden",
      })}
    >
      {chatTabs.length > 1 && (
        <Tabs
          id="chat-tabs"
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
            borderRadius: 9999,
            px: 0,
            py: 0.625,
            mb: 1.25,
            background: (theme) =>
              theme.palette.mode === "dark"
                ? "linear-gradient(145deg, rgba(35, 36, 40, 0.95), rgba(24, 25, 28, 0.95))"
                : "linear-gradient(145deg, rgba(248, 250, 255, 0.95), rgba(236, 241, 250, 0.95))",
            border: (theme) =>
              theme.palette.mode === "dark"
                ? "1px solid rgba(255, 255, 255, 0.1)"
                : "1px solid rgba(18, 30, 60, 0.1)",
            boxShadow:
              "0 1px 0 rgba(255, 255, 255, 0.08) inset, 0 8px 20px rgba(0, 0, 0, 0.14)",
            ".MuiTabs-scroller": {
              mx: 0,
            },
            ".MuiTabs-flexContainer": {
              width: "100%",
              gap: 0,
            },
            ".MuiTab-root": {
              flex: 1,
              flexShrink: 1,
              flexBasis: 0,
              maxWidth: "none",
              minHeight: 48,
              minWidth: 0,
              borderRadius: 9999,
              fontWeight: 700,
              fontSize: "0.9rem",
              letterSpacing: "0.01em",
              textTransform: "none",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              justifyContent: "center",
              alignItems: "center",
              boxSizing: "border-box",
              color: (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(255, 255, 255, 0.95)"
                  : "rgba(30, 30, 35, 0.9)",
              backgroundColor: "transparent",
              transition:
                "color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease",
              "&:not(.Mui-selected):hover": {
                backgroundColor: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(255, 255, 255, 0.07)"
                    : "rgba(0, 0, 0, 0.045)",
                transform: "translateY(-1px)",
              },
            },
            // Selected chrome is on the label chip (see Tab label) so padding is inside the pill, not the full flex segment.
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
                        display: "inline-block",
                        maxWidth: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        px: 2.75,
                        py: 0.75,
                        borderRadius: 9999,
                        boxSizing: "border-box",
                        verticalAlign: "middle",
                        color:
                          theme.palette.mode === "dark" ? "#ffb370" : "#b44f10",
                        bgcolor:
                          theme.palette.mode === "dark"
                            ? "linear-gradient(145deg, rgba(78, 49, 33, 0.96), rgba(58, 36, 24, 0.96))"
                            : "linear-gradient(145deg, rgba(255, 208, 158, 0.65), rgba(255, 179, 107, 0.52))",
                        border:
                          theme.palette.mode === "dark"
                            ? "1px solid rgba(255, 173, 111, 0.34)"
                            : "1px solid rgba(180, 79, 16, 0.28)",
                        boxShadow:
                          theme.palette.mode === "dark"
                            ? "0 4px 16px rgba(255, 132, 64, 0.22)"
                            : "0 4px 14px rgba(180, 79, 16, 0.18)",
                        transition:
                          "background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease",
                        "&:hover": {
                          bgcolor:
                            theme.palette.mode === "dark"
                              ? "linear-gradient(145deg, rgba(88, 57, 38, 0.98), rgba(64, 41, 28, 0.98))"
                              : "linear-gradient(145deg, rgba(255, 208, 158, 0.78), rgba(255, 179, 107, 0.63))",
                          transform: "translateY(-1px)",
                        },
                      })}
                    >
                      {tab.title}
                    </Box>
                  ) : (
                    tab.title
                  )
                }
                sx={{
                  minWidth: 0,
                  maxWidth: "none",
                  "&&": {
                    py: 0.75,
                    px: 0.5,
                  },
                }}
              />
            );
          })}
        </Tabs>
      )}
      <Box
        sx={(theme) => ({
          borderRadius: 2.5,
          border:
            theme.palette.mode === "dark"
              ? "1px solid rgba(255, 255, 255, 0.08)"
              : "1px solid rgba(18, 30, 60, 0.08)",
          background:
            theme.palette.mode === "dark"
              ? "rgba(16, 17, 20, 0.72)"
              : "rgba(255, 255, 255, 0.72)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          boxShadow:
            theme.palette.mode === "dark"
              ? "inset 0 1px 0 rgba(255,255,255,0.03), 0 10px 24px rgba(0,0,0,0.25)"
              : "inset 0 1px 0 rgba(255,255,255,0.82), 0 8px 22px rgba(17,30,59,0.08)",
          overflow: "hidden",
        })}
      >
        {chatTabs.map((tab, idx: number) => (
          <TabPanel key={tab.id} value={selectedChatTab} index={idx}>
            <Chat
              user={user}
              chatType={tab.id}
              nodeId={tab.id === "node" ? currentVisibleNode?.id : ""}
              users={users}
              confirmIt={confirmIt}
              setOpenSelectModel={setOpenModel}
              navigateToNode={navigateToNode}
              relatedNodes={nodes}
              fetchNode={fetchNode}
              scrollingRef={scrollingRef}
              placeholder={tab.placeholder}
              appName={appName}
            />
          </TabPanel>
        ))}
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
