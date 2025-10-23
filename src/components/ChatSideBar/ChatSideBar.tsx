import { MESSAGES, USERS } from "@components/lib/firestoreClient/collections";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import { TabPanel, a11yProps } from "@components/lib/utils/TabPanel";

import {
  Box,
  Tabs,
  Tab,
  Button,
  ListItem,
  Modal,
  Paper,
  Typography,
  IconButton,
  Skeleton,
  Alert,
  Tooltip,
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
  useRef,
  useState,
} from "react";
import Chat from "../Chat/Chat";
import { SCROLL_BAR_STYLE } from "@components/lib/CONSTANTS";
import { DESIGN_SYSTEM_COLORS } from "@components/lib/theme/colors";
import TreeViewSimplified from "../OntologyComponents/TreeViewSimplified";
import { SearchBox } from "../SearchBox/SearchBox";
import { INode } from "@components/types/INode";
import { Post } from "@components/lib/utils/Post";

const ChatSideBar = ({
  currentVisibleNode,
  user,
  confirmIt,
  treeVisualization,
  expandedNodes,
  setExpandedNodes,
  onOpenNodesTree,
  navigateToNode,
  chatTabs,
  selectedChatTab,
  setSelectedChatTab,
  skillsFuture,
  skillsFutureApp,
}: {
  currentVisibleNode: any;
  user: any;
  confirmIt: any;
  treeVisualization: any;
  expandedNodes: any;
  setExpandedNodes: any;
  onOpenNodesTree: any;
  navigateToNode: any;
  chatTabs: { title: string; id: string; placeholder: string }[];
  selectedChatTab: number;
  setSelectedChatTab: Function;
  skillsFuture: boolean;
  skillsFutureApp: string;
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
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loadingSearchResult, setLoadingSearchResult] = useState(false);
  const [errorSearch, setErrorSearch] = useState(false);
  const scrollingRef = useRef<any>();

  const handleChatTabsChange = (event: any, newValue: number) => {
    setSelectedChatTab(newValue);
    // recordLogs({
    //   action: "chat tab change",
    //   viewType: newValue === 0 ? "Tree View" : "Dag View",
    // });
  };

  const searchQuery = useCallback(async () => {
    try {
      setErrorSearch(false);
      setLoadingSearchResult(true);
      const response: any = await Post("/searchChroma", {
        query: searchValue,
        skillsFuture,
        appName: skillsFuture ? skillsFutureApp : null,
      });

      const results: any = [...(response.results || [])];
      setSearchResults(results);
    } catch (error) {
      console.error(error);
      setErrorSearch(true);
    } finally {
      setLoadingSearchResult(false);
    }
  }, [searchValue, skillsFuture, skillsFutureApp]);

  const onKeyDown = (event: any) => {
    if (event.key === "Enter") {
      searchQuery();
    }
  };
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
                onKeyDown={onKeyDown}
              />
              {searchValue && (
                <Tooltip title={"Search in the Ontology"}>
                  <IconButton
                    sx={{ mr: "5px" }}
                    onClick={searchQuery}
                    color="primary"
                  >
                    <SearchIcon />
                  </IconButton>
                </Tooltip>
              )}
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
            {loadingSearchResult ? (
              <Box sx={{ px: 4, mt: "0px" }}>
                {[...Array(15)].map((_, index) => (
                  <Skeleton
                    key={index}
                    variant="text"
                    height={55}
                    width="100%"
                    sx={{ p: 0 }}
                  />
                ))}
              </Box>
            ) : errorSearch ? (
              <Alert severity="error">
                There was an error searching through the ontology.
              </Alert>
            ) : searchValue ? (
              <Box>
                {" "}
                {searchResults.map((node: any) => (
                  <ListItem
                    key={node.id}
                    onClick={() => {}}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      color: "white",
                      cursor: "pointer",
                      borderRadius: "4px",
                      padding: "8px",
                      transition: "background-color 0.3s",
                      // border: "1px solid #ccc",
                      mt: "5px",
                      "&:hover": {
                        backgroundColor: (theme) =>
                          theme.palette.mode === "dark"
                            ? DESIGN_SYSTEM_COLORS.notebookG450
                            : DESIGN_SYSTEM_COLORS.gray200,
                      },
                    }}
                  >
                    {" "}
                    <Typography>{node.title}</Typography>
                    <Button
                      variant="outlined"
                      onClick={() => sendNode(node.id, node.title)}
                    >
                      Send
                    </Button>
                  </ListItem>
                ))}
              </Box>
            ) : (
              <TreeViewSimplified
                treeVisualization={treeVisualization}
                expandedNodes={expandedNodes}
                setExpandedNodes={setExpandedNodes}
                onOpenNodesTree={onOpenNodesTree}
                sendNode={sendNode}
                currentVisibleNode={currentVisibleNode}
                loadingIds={new Set()}
              />
            )}
          </Paper>
        </Box>
      </Modal>
    </Box>
  );
};

export default ChatSideBar;
