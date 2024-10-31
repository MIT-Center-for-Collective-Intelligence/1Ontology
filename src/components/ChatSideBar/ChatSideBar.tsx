import { MESSAGES, USERS } from " @components/lib/firestoreClient/collections";
import CloseIcon from "@mui/icons-material/Close";
import { TabPanel, a11yProps } from " @components/lib/utils/TabPanel";

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
} from "@mui/material";
import {
  query,
  collection,
  getDocs,
  getFirestore,
  addDoc,
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Chat from "../Chat/Chat";
import { SCROLL_BAR_STYLE } from " @components/lib/CONSTANTS";
import { DESIGN_SYSTEM_COLORS } from " @components/lib/theme/colors";
import TreeViewSimplified from "../OntologyComponents/TreeViewSimplified";
import { SearchBox } from "../SearchBox/SearchBox";

const ChatSideBar = ({
  currentVisibleNode,
  user,
  confirmIt,
  searchWithFuse,
  treeVisualization,
  expandedNodes,
  setExpandedNodes,
  onOpenNodesTree,
  navigateToNode,
  chatTabs,
  selectedChatTab,
  setSelectedChatTab,
}: {
  currentVisibleNode: any;
  user: any;
  confirmIt: any;
  searchWithFuse: any;
  treeVisualization: any;
  expandedNodes: any;
  setExpandedNodes: any;
  onOpenNodesTree: any;
  navigateToNode: any;
  chatTabs: { title: string; id: string }[];
  selectedChatTab: number;
  setSelectedChatTab: Function;
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

  const handleChatTabsChange = (event: any, newValue: number) => {
    setSelectedChatTab(newValue);
    // recordLogs({
    //   action: "chat tab change",
    //   viewType: newValue === 0 ? "Tree View" : "Dag View",
    // });
  };

  const searchResults = useMemo(() => {
    /*  recordLogs({
      action: "Searched",
      query: searchValue,
    }); */
    return searchWithFuse(searchValue);
  }, [searchValue]);

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

  const sendNode = useCallback(
    async (nodeId: string, title: string) => {
      if (!user || !currentVisibleNode?.id) return;
      const messageData = {
        nodeId: currentVisibleNode.id,
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
      return;
      await addDoc(collection(db, MESSAGES), messageData);
    },
    [selectedChatTab, currentVisibleNode?.id, user]
  );
  useEffect(() => {
    setSelectedChatTab(0);
  }, [chatTabs]);
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
          aria-label="basic tabs example"
          variant="scrollable"
          sx={{
            background: (theme) =>
              theme.palette.mode === "dark" ? "#000000" : "#c3c3c3",
            ".MuiTab-root.Mui-selected": {
              color: "#ff6d00",
            },
            width: "190%",
          }}
        >
          {chatTabs.map((tab, idx) => (
            <Tab key={tab.id} label={tab.title} {...a11yProps(idx)} />
          ))}
        </Tabs>
      )}
      <Box>
        {chatTabs.map((tab, idx: number) => (
          <TabPanel key={tab.id} value={selectedChatTab} index={idx}>
            <Chat
              user={user}
              type={tab.id}
              nodeId={tab.id === "node" ? currentVisibleNode?.id : ""}
              users={users}
              confirmIt={confirmIt}
              setOpenSelectModel={() => {
                setOpenModel(true);
              }}
              navigateToNode={navigateToNode}
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
          }}
        >
          <Paper sx={{ position: "sticky", top: "0", px: "15px", zIndex: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <SearchBox setSearchValue={setSearchValue} label={"Search ..."} />
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
            {searchValue ? (
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
              />
            )}
          </Paper>
        </Box>
      </Modal>
    </Box>
  );
};

export default ChatSideBar;
