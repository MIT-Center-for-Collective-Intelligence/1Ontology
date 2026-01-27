import { MESSAGES, USERS } from "@components/lib/firestoreClient/collections";
import CloseIcon from "@mui/icons-material/Close";
import { TabPanel, a11yProps } from "@components/lib/utils/TabPanel";

import {
  Box,
  Tabs,
  Tab,
  Modal,
  Paper,
  IconButton,
} from "@mui/material";
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
        console.log(
          `[CHAT SIDEBAR] Fetching ${childIds.size} child nodes for search results`
        );
        await Promise.all(Array.from(childIds).map((id) => fetchNode(id)));
        console.log(
          `[CHAT SIDEBAR] Successfully fetched ${childIds.size} child nodes`
        );
      }
    },
    [fetchNode, nodes]
  );

  // Handle Chroma search with child node fetching
  const handleChromaSearch = useCallback(async () => {
    console.log(
      "[CHAT SIDEBAR] handleChromaSearch called with searchValue:",
      searchValue
    );

    if (!searchValue || searchValue.trim().length < 3) {
      console.log("[CHAT SIDEBAR] Search value too short or empty, returning");
      return;
    }

    const fuseSearch = searchWithFuse(searchValue);
    console.log(
      "[CHAT SIDEBAR] Starting Chroma search with fuse fallback:",
      fuseSearch.length,
      "results"
    );

    try {
      setLoadingChromaSearch(true);
      setUseChromaResults(true);
      console.log("[CHAT SIDEBAR] Set loading state and useChromaResults flag");

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

      console.log(
        `[CHAT SIDEBAR] Chroma search complete with ${results.length} results`
      );
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
        (node: INode) => node.id !== currentVisibleNode.id
      );
      results.push(...filteredResults);
    }

    return results;
  }, [currentVisibleNode, searchValue, searchResults, useChromaResults, chromaSearchResults]);

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
    [selectedChatTab, currentVisibleNode?.id, user],
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
    <Box>
      {chatTabs.length > 1 && (
        <Tabs
          id="chat-tabs"
          value={selectedChatTab}
          onChange={handleChatTabsChange}
          aria-label="chat tabs"
          sx={{
            background: (theme) =>
              theme.palette.mode === "dark" ? "#242425" : "#d0d5dd",
            borderRadius: "10px",
            boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.1)",
            width: "100%",
            ".MuiTab-root": {
              transition: "0.3s ease-in-out",
            },
            ".MuiTab-root.Mui-selected": {
              color: "#ff6d00",
              fontWeight: "bold",
              backgroundColor: (theme) =>
                theme.palette.mode === "dark" ? "#080707" : "#e0e0e0",
              borderRadius: "10px 10px 0 0",
            },
            ".MuiTabs-indicator": {
              backgroundColor: "#ff6d00",
              height: "3px",
              borderRadius: "50%",
              transition: "transform 0.3s ease-in-out",
            },
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {chatTabs.map((tab, idx) => (
            <Tab
              key={tab.id}
              label={tab.title}
              {...a11yProps(idx)}
              sx={{
                borderRadius: "10px",
                /*                 margin: "0 10px", */
                padding: "10px 20px",
                minWidth: "auto",
                transition: "all 0.3s ease-in-out",
                "&:hover": {
                  backgroundColor: "#ff6d00",
                  color: "white",
                  transform: "scale(1.05)",
                },
              }}
            />
          ))}
        </Tabs>
      )}
      <Box>
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
            />
          </TabPanel>
        ))}
      </Box>
      <Modal
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "transparent",
          // backgroundColor: "rgba(0, 0, 0, 0.5)",
        }}
        open={openModel}
        onClose={handleClose}
      >
        <Box
          sx={{
            maxHeight: "80vh",
            minWidth: "900px",
            overflowY: "auto",
            borderRadius: 2,
            boxShadow: 24,
            ...SCROLL_BAR_STYLE,
            "&::-webkit-scrollbar": {
              display: "none",
            },
          }}
        >
          <Paper sx={{ position: "sticky", top: "0", px: "15px", zIndex: 1 }}>
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
              >
                <CloseIcon />
              </IconButton>
            </Box>
          </Paper>
          <Paper>
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
