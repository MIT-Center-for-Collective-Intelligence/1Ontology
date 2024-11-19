import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import HistoryIcon from "@mui/icons-material/History";
import CircularProgress from "@mui/material/CircularProgress";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import {
  Button,
  IconButton,
  LinearProgress,
  Menu,
  MenuItem,
  SvgIcon,
  TextField, // Changed from IconButton to Button
  Typography,
  useTheme,
} from "@mui/material";

import mitLogoLight from "../../../public/MIT-Logo-Small-Light.png";
import mitLogoDark from "../../../public/MIT-Logo-small-Dark.png";
import mitLogoLightLong from "../../../public/CCI-logo.gif";
import mitLogoDarkLong from "../../../public/MIT-Logo-Dark.png";
import LogoutIcon from "@mui/icons-material/Logout";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import NotificationsIcon from "@mui/icons-material/Notifications";
import OptimizedAvatar from "../Chat/OptimizedAvatar";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import useThemeChange from " @components/lib/hooks/useThemeChange";
import { DESIGN_SYSTEM_COLORS } from " @components/lib/theme/colors";
import ClearIcon from "@mui/icons-material/Clear";
import { Notifications } from " @components/components/Chat/Notifications";
import { chatChange } from " @components/client/firestore/messages.firestore";
import { INotification } from " @components/types/IChat";
import {
  createNewNode,
  generateInheritance,
  synchronizeStuff,
} from " @components/lib/utils/helpers";
import { getNotificationsSnapshot } from " @components/client/firestore/notifications.firestore";
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  query,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import SearchSideBar from "../SearchSideBar/SearchSideBar";
import ActiveUsers from "../ActiveUsers/ActiveUsers";
import UserActivity from "../ActiveUsers/UserActivity";
import ChatSideBar from "../ChatSideBar/ChatSideBar";
import Inheritance from "../Inheritance/Inheritance";
import { SidebarButton } from "../SideBarButton/SidebarButton";
import { Box, SxProps, Theme } from "@mui/material";
import { capitalizeString } from " @components/lib/utils/string.utils";
import { getAuth } from "firebase/auth";
import { useAuth } from "../context/AuthContext";
import { isValidHttpUrl } from " @components/lib/utils/utils";
import {
  getStorage,
  uploadBytesResumable,
  getDownloadURL,
  ref as refStorage,
} from "firebase/storage";
import { NODES, USERS } from " @components/lib/firestoreClient/collections";
import { useRouter } from "next/router";
import ROUTES from " @components/lib/utils/routes";

import NodeActivity from "../ActiveUsers/NodeActivity";
import { User } from " @components/types/IAuth";
import { INode, NodeChange } from " @components/types/INode";
import Improvements from "../Improvements/Improvements";
import { CHAT_DISCUSSION_TABS, development } from " @components/lib/CONSTANTS";

import {
  compareImprovement,
  compareProposals,
  filterProposals,
} from " @components/lib/utils/copilotHelpers";
import useSelectDropdown from " @components/lib/hooks/useSelectDropdown";
import {
  Improvement,
  newNodeProposal,
  sendLLMRequest,
} from " @components/lib/utils/copilotPrompts";
import OntologyHistory from "../ActiveUsers/OntologyHistory";

type MainSidebarProps = {
  toolbarRef: any;
  user: User | null;
  openSearchedNode: Function;
  searchWithFuse: Function;
  nodes: { [nodeId: string]: any };
  selectedDiffNode: any;
  setSelectedDiffNode: any;
  currentVisibleNode: any;
  setCurrentVisibleNode: any;
  confirmIt: Function;
  activeSidebar: any;
  setActiveSidebar: any;
  handleExpandSidebar: any;
  navigateToNode: any;
  treeVisualization: any;
  expandedNodes: any;
  setExpandedNodes: any;
  onOpenNodesTree: any;
  setDisplayGuidelines: Function;
  currentImprovement: any;
  setCurrentImprovement: any;
  lastSearches: string[];
  updateLastSearches: Function;
};

const ToolbarSidebar = ({
  toolbarRef,
  user,
  openSearchedNode,
  searchWithFuse,
  nodes,
  selectedDiffNode,
  setSelectedDiffNode,
  currentVisibleNode,
  setCurrentVisibleNode,
  confirmIt,
  activeSidebar,
  setActiveSidebar,
  handleExpandSidebar,
  navigateToNode,
  treeVisualization,
  expandedNodes,
  setExpandedNodes,
  onOpenNodesTree,
  setDisplayGuidelines,
  currentImprovement,
  setCurrentImprovement,
  lastSearches,
  updateLastSearches,
}: MainSidebarProps) => {
  const theme = useTheme();
  const db = getFirestore();

  const [{ isAuthenticated }] = useAuth();
  const router = useRouter();
  const [handleThemeSwitch] = useThemeChange();
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const [openLogsFor, setOpenLogsFor] = useState<{
    uname: string;
    imageUrl: string;
    fullname: string;
    fName: string;
  } | null>(null);
  const [hovered, setHovered] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(null);
  const [percentageUploaded, setPercentageUploaded] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [profileImage, setProfileImage] = useState("");
  const isProfileMenuOpen = Boolean(profileMenuOpen);
  const [activeUsers, setActiveUsers] = useState<any>({});
  const [previousNodeId, setPreviousNodeId] = useState("");
  const [selectedChatTab, setSelectedChatTab] = useState<number>(0);
  const [isLoadingCopilot, setIsLoadingCopilot] = useState(false);
  const [nodesByTitle, setNodesByTitle] = useState<{
    [nodeTitle: string]: INode;
  }>({});
  const [improvements, setImprovements] = useState<any>([]);
  const [copilotMessage, setCopilotMessage] = useState("");
  const { selectIt, dropdownDialog } = useSelectDropdown();

  const signOut = async () => {
    router.push(ROUTES.signIn);
    getAuth().signOut();
  };

  const handleProfileMenuOpen = (event: any) => {
    setProfileMenuOpen(event.currentTarget);
  };
  const [selectedUser, setSelectedUser] = useState("All");

  const inputEl = useRef<HTMLInputElement>(null);

  const handleProfileMenuClose = () => {
    setProfileMenuOpen(null);
  };
  const [currentIndex, setCurrentIndex] = useState(0);

  const updateUserImage = async (imageUrl: string) => {
    const userDoc = doc(collection(db, USERS), user?.uname);
    await updateDoc(userDoc, { imageUrl });
  };
  const onNavigateToNode = useCallback(
    (nodeTitle: string) => {
      if (!nodeTitle) {
        return;
      }
      const nodeId = nodesByTitle[nodeTitle]?.id;

      if (nodeId) {
        navigateToNode(nodeId);
      }
    },
    [nodesByTitle]
  );

  const handleImageChange = useCallback(
    async (event: any) => {
      try {
        event.preventDefault();
        const storage = getStorage();
        const auth = getAuth();
        const userId = user?.userId;
        const userAuthObj = auth.currentUser;
        if (!userAuthObj) return;

        const image = event.target.files[0];
        if (!image || !image?.type) {
          confirmIt(
            "Oops! Something went wrong with the image upload. Please try uploading a different image.",
            "Ok",
            ""
          );
        } else if (
          image.type !== "image/jpg" &&
          image.type !== "image/jpeg" &&
          image.type !== "image/png"
        ) {
          confirmIt(
            "We only accept JPG, JPEG, or PNG images. Please upload another image.",
            "Ok",
            ""
          );
        } else if (image.size > 1024 * 1024) {
          confirmIt(
            "We only accept file sizes less than 1MB for profile images. Please upload another image.",
            "Ok",
            ""
          );
        } else {
          setIsUploading(true);

          let bucket = development
            ? process.env.NEXT_PUBLIC_DEV_STORAGE_BUCKET
            : process.env.NEXT_PUBLIC_STORAGE_BUCKET;

          if (bucket && isValidHttpUrl(bucket)) {
            const { hostname } = new URL(bucket);
            bucket = hostname;
          }
          const rootURL = "https://storage.googleapis.com/" + bucket + "/";
          const picturesFolder = rootURL + "profilePicture/";
          const imageNameSplit = image.name.split(".");
          const imageExtension = imageNameSplit[imageNameSplit.length - 1];
          let imageFileName =
            userId + "/" + new Date().toUTCString() + "." + imageExtension;
          const storageRef = refStorage(
            storage,
            picturesFolder + imageFileName
          );
          const task = uploadBytesResumable(storageRef, image);
          task.on(
            "state_changed",
            function progress(snapshot) {
              setPercentageUploaded(
                Math.ceil(
                  (100 * snapshot.bytesTransferred) / snapshot.totalBytes
                )
              );
            },
            function error(err) {
              setIsUploading(false);
              confirmIt(
                "There is an error with uploading your picture. Please try again! If the problem persists, try another picture.",
                "Ok",
                ""
              );
            },
            async function complete() {
              let imageGeneratedUrl = await getDownloadURL(storageRef);
              // imageGeneratedUrl = addSuffixToUrlGMT(
              //   imageGeneratedUrl,
              //   "_430x1300"
              // );
              setProfileImage(imageGeneratedUrl);
              await updateUserImage(imageGeneratedUrl);
              setIsUploading(false);
              setProfileMenuOpen(null);
              setPercentageUploaded(100);
            }
          );
        }
      } catch (err) {
        console.error("Image Upload Error: ", err);
        setIsUploading(false);
      }
    },
    [user]
  );

  const handleEditImage = useCallback(() => {
    if (!inputEl.current) return;
    if (false) return;
    inputEl.current.click();
  }, [inputEl]);

  const renderProfileMenu = (
    <Menu
      id="ProfileMenu"
      anchorEl={profileMenuOpen}
      open={isProfileMenuOpen}
      onClose={handleProfileMenuClose}
    >
      {" "}
      {isAuthenticated && user && (
        <Typography sx={{ p: "6px 16px" }}>
          {capitalizeString(`${user?.fName ?? ""} ${user?.lName ?? ""}`)}
        </Typography>
      )}
      {isAuthenticated && user && (
        <MenuItem sx={{ flexGrow: 3 }} onClick={handleEditImage}>
          {isUploading ? (
            <Box sx={{ mr: "15px" }}>
              <LinearProgress sx={{ width: "18px" }} />
            </Box>
          ) : (
            <CameraAltIcon sx={{ mr: "5px" }} />
          )}

          <span id="picture"> Change Photo</span>
          <input
            type="file"
            ref={inputEl}
            onChange={handleImageChange}
            accept="image/png, image/jpg, image/jpeg"
            hidden
          />
        </MenuItem>
      )}
      {isAuthenticated && user && (
        <MenuItem sx={{ flexGrow: 3 }} onClick={signOut}>
          <LogoutIcon sx={{ mr: "5px" }} /> <span id="LogoutText">Logout</span>
        </MenuItem>
      )}
    </Menu>
  );

  useEffect(() => {
    if (!user) return;
    setNotifications([]);
    const onSynchronize = (changes: chatChange[]) => {
      setNotifications((prev) =>
        changes.reduce(synchronizeStuff, [...prev]).sort((a: any, b: any) => {
          return (
            new Date(b.createdAt.toDate()).getTime() -
            new Date(a.createdAt.toDate()).getTime()
          );
        })
      );
    };
    const killSnapshot = getNotificationsSnapshot(
      db,
      { uname: user.uname, lastVisible: null },
      onSynchronize
    );
    return () => killSnapshot();
  }, [db, user]);

  const openNotification = useCallback(
    (
      notificationId: string,
      messageId: string,
      type: string,
      nodeId?: string
    ) => {
      const notificationRef = doc(db, "notifications", notificationId);
      updateDoc(notificationRef, {
        seen: true,
      });
      if (type === "node") {
        setActiveSidebar("chat");
        navigateToNode(nodeId);
      } else {
        setActiveSidebar("chat-discussion");
        const index = CHAT_DISCUSSION_TABS.findIndex((c) => c.id === type);
        if (index !== -1) {
          setSelectedChatTab(index);
        }
      }
      setTimeout(
        () => {
          const element = document.getElementById(`message-${messageId}`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            element.style.borderRadius = "8px";
            element.style.padding = "8px";
            element.style.marginTop = "8px";
            element.style.backgroundColor = `#deab8b99`;
            element.style.transition = "background-color 0.5s ease";
            setTimeout(() => {
              element.style.border = "none";
              element.style.backgroundColor = ``;
            }, 3000);
          }
        },
        type === "node" ? 2000 : 1000
      );
    },
    [db, user]
  );

  useEffect(() => {
    const usersQuery = query(collection(db, "users"));
    const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
      setActiveUsers((prevUsersNodesViews: any) => {
        const updatedUsersData = { ...prevUsersNodesViews };

        snapshot.docChanges().forEach((change) => {
          const doc = change.doc;
          const userId = doc.id;
          const data = doc.data();
          const currentNode = data.currentNode;

          if (
            (change.type === "added" || change.type === "modified") &&
            currentNode
          ) {
            updatedUsersData[userId] = {
              node: {
                title: nodes[currentNode]?.title || "",
                id: currentNode,
              },
              imageUrl: data.imageUrl,
              fName: data.fName,
              lName: data.lName,
              lastInteracted: data.lastInteracted,
              lasChangeMadeAt: data.lasChangeMadeAt,
              uname: userId,
              reputations: data?.reputations || 0,
            };
          } else if (change.type === "removed") {
            delete updatedUsersData[userId];
          }
        });

        return updatedUsersData;
      });
    });

    return () => unsubscribe();
  }, [nodes]);

  const displayUserLogs = useCallback(
    (user: {
      uname: string;
      imageUrl: string;
      fullname: string;
      fName: string;
    }) => {
      if (openLogsFor?.uname !== user.uname) {
        setOpenLogsFor(user);
      } else {
        setOpenLogsFor(null);
      }
      setSelectedDiffNode(null);
      setActiveSidebar("userActivity");
    },
    [openLogsFor]
  );

  const displayDiff = (data: NodeChange) => {
    if (currentVisibleNode?.id !== data.nodeId) {
      setCurrentVisibleNode(
        nodes[data.nodeId] ? nodes[data.nodeId] : data.fullNode
      );
    }

    setTimeout(() => {
      setSelectedDiffNode(data);
    }, 500);

    if (!previousNodeId) {
      setPreviousNodeId(currentVisibleNode.id);
    }
  };

  useEffect(() => {
    if (user?.uname === "ouhrac" || user?.uname === "1man") {
      const nodesByT: { [nodeTitle: string]: INode } = {};
      for (let nodeId in nodes) {
        const nodeTitle = nodes[nodeId].title;
        nodesByT[nodeTitle] = nodes[nodeId];
      }
      setNodesByTitle(nodesByT);
    }
  }, [nodes, user]);

  const getNewNodes = (
    newNodes: {
      title: string;
      description: string;
      first_generalization: string;
      reasoning: string;
    }[]
  ): any => {
    try {
      if (!user?.uname) return;
      const _NODES = [];

      for (let node of newNodes) {
        if (!!nodesByTitle[node.title]) {
          continue;
        }
        const generalization = nodesByTitle[node?.first_generalization];
        if (!generalization) continue;

        const newId = doc(collection(db, NODES)).id;
        const inheritance = generateInheritance(
          generalization.inheritance,
          generalization.id
        );

        const newNode = createNewNode(
          generalization,
          newId,
          node.title,
          inheritance,
          generalization.id,
          user?.uname
        );
        if (!!node?.description) {
          inheritance.description.ref = null;
          newNode.properties.description = node.description;
        }
        _NODES.push({
          node: newNode,
          newNode: true,
          reasoning: node.reasoning,
          generalizationId: generalization.id,
          first_generalization: node?.first_generalization,
        });
      }

      return _NODES;
    } catch (error) {
      console.error(error);
    }
  };
  const compareThisImprovement = (improvement: any) => {
    if (improvement?.diffChange) {
      displayDiff(improvement.diffChange);
    } else {
      setSelectedDiffNode(null);
    }

    if (!improvement) {
      setCurrentImprovement(null);
      setImprovements([]);
      return;
    }
    const nodeId = nodesByTitle[improvement.title]?.id;
    if (!nodes[nodeId]) {
      return;
    }
    if (nodes[nodeId]) {
      setCurrentVisibleNode(nodes[nodeId]);
    }
    const result = compareImprovement(improvement, nodesByTitle);

    setCurrentImprovement(result);
  };

  const handleImproveClick = async () => {
    const options = (await selectIt()) as {
      model: string;
      userMessage: string;
      deepNumber: number;
    };
    if (!options) return;
    const { model, userMessage, deepNumber } = options;
    setIsLoadingCopilot(true);
    setCurrentIndex(0);
    try {
      const response = (await sendLLMRequest(
        userMessage,
        model,
        deepNumber,
        currentVisibleNode.id
      )) as {
        improvements: Improvement[];
        new_nodes: newNodeProposal[];
        message: string;
      };
      if (!response) {
        throw new Error("Missing response in handleImproveClick!");
      }

      if (response.improvements.length <= 0 && response.new_nodes.length <= 0) {
        confirmIt(
          <Box>
            {`I've analyzed your sub-ontology graph and found no areas for improvement or new nodes to add.`}{" "}
            <strong style={{ color: "orange" }}>
              {currentVisibleNode.title}
            </strong>
            .
          </Box>,
          "Ok"
        );
        return;
      }

      setCopilotMessage(response.message);
      const improvements: Improvement[] = await filterProposals(
        response?.improvements || [],
        nodesByTitle
      );

      const improvementsDivided = [];

      for (let improvement of improvements) {
        if (improvement.changes.length >= 2) {
          for (let change of improvement.changes) {
            const _improvement = {
              ...improvement,
              changes: [{ ...change }],
            };
            improvementsDivided.push(_improvement);
          }
        } else {
          improvementsDivided.push(improvement);
        }
      }
      const newNodes: {
        title: string;
        description: string;
        first_generalization: string;
        reasoning: string;
        newNode: boolean;
      }[] = getNewNodes(response?.new_nodes || []);
      if (improvements.length > 0 || newNodes.length > 0) {
        setImprovements([...newNodes, ...improvementsDivided]);
      }
    } catch (error) {
      confirmIt(
        "Sorry! There was an error generating proposals, please try again!",
        "Ok"
      );
      console.error("Error fetching improvements:", error);
    } finally {
      setIsLoadingCopilot(false);
    }
  };

  const renderContent = (activeSidebar: string) => {
    switch (activeSidebar) {
      case "notifications":
        return (
          <Notifications
            user={user}
            notifications={notifications}
            openNotification={openNotification}
          />
        );
      case "search":
        return (
          <SearchSideBar
            openSearchedNode={openSearchedNode}
            searchWithFuse={searchWithFuse}
            lastSearches={lastSearches}
            updateLastSearches={updateLastSearches}
          />
        );
      case "userActivity":
        return (
          <UserActivity
            openLogsFor={openLogsFor}
            displayDiff={displayDiff}
            selectedDiffNode={selectedDiffNode}
          />
        );
      case "chat":
        return (
          <ChatSideBar
            currentVisibleNode={currentVisibleNode}
            user={user}
            confirmIt={confirmIt}
            searchWithFuse={searchWithFuse}
            treeVisualization={treeVisualization}
            expandedNodes={expandedNodes}
            setExpandedNodes={setExpandedNodes}
            onOpenNodesTree={onOpenNodesTree}
            navigateToNode={navigateToNode}
            chatTabs={[{ id: "node", title: "This node" }]}
            selectedChatTab={selectedChatTab}
            setSelectedChatTab={setSelectedChatTab}
            nodes={nodes}
          />
        );
      case "chat-discussion":
        return (
          <ChatSideBar
            currentVisibleNode={currentVisibleNode}
            user={user}
            confirmIt={confirmIt}
            searchWithFuse={searchWithFuse}
            treeVisualization={treeVisualization}
            expandedNodes={expandedNodes}
            setExpandedNodes={setExpandedNodes}
            onOpenNodesTree={onOpenNodesTree}
            navigateToNode={navigateToNode}
            chatTabs={CHAT_DISCUSSION_TABS}
            selectedChatTab={selectedChatTab}
            setSelectedChatTab={setSelectedChatTab}
            nodes={nodes}
          />
        );
      case "inheritanceSettings":
        return <Inheritance selectedNode={currentVisibleNode} nodes={nodes} />;
      case "nodeHistory":
        return (
          <NodeActivity
            currentVisibleNode={currentVisibleNode}
            selectedDiffNode={selectedDiffNode}
            displayDiff={displayDiff}
            activeUsers={activeUsers}
          />
        );
      case "improvements":
        return (
          <Improvements
            currentImprovement={currentImprovement}
            setCurrentImprovement={setCurrentImprovement}
            currentVisibleNode={currentVisibleNode}
            nodes={nodes}
            setCurrentVisibleNode={setCurrentVisibleNode}
            onNavigateToNode={onNavigateToNode}
            isLoadingCopilot={isLoadingCopilot}
            improvements={improvements}
            setImprovements={setImprovements}
            handleImproveClick={handleImproveClick}
            copilotMessage={copilotMessage}
            compareThisImprovement={compareThisImprovement}
            confirmIt={confirmIt}
            currentIndex={currentIndex}
            setCurrentIndex={setCurrentIndex}
            displayDiff={displayDiff}
          />
        );
      case "history":
        return (
          <OntologyHistory
            currentVisibleNode={currentVisibleNode}
            selectedDiffNode={selectedDiffNode}
            displayDiff={displayDiff}
            activeUsers={activeUsers}
            selectedUser={selectedUser}
          />
        );
      default:
        return null;
    }
  };

  const getLog = useMemo(() => {
    if (hovered) {
      return theme.palette.mode === "dark"
        ? mitLogoDarkLong.src
        : mitLogoLightLong.src;
    } else {
      return theme.palette.mode === "dark" ? mitLogoDark.src : mitLogoLight.src;
    }
  }, [hovered, theme.palette.mode]);

  type CustomBadgeProps = { value: number; sx?: SxProps<Theme> };

  const CustomBadge = ({ value, sx }: CustomBadgeProps) => {
    if (value === 0) return null;

    return (
      <Box
        sx={{
          minWidth: "24px",
          height: "24px",
          p: "6px 4px",
          borderRadius: "28px",
          background: "#E34848",
          color: "white",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          ...sx,
        }}
      >
        {value > 99 ? "99+" : value}
      </Box>
    );
  };

  type CustomSmallBadgeProps = { value: number };

  const CustomSmallBadge = ({ value }: CustomSmallBadgeProps) => {
    if (!value) return null;
    return (
      <Box
        sx={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: "#E34848",
        }}
      />
    );
  };

  const getHeaderTitle = (activeSidebar: string) => {
    switch (activeSidebar) {
      case "chat-discussion":
        return "Chatroom";
      case "chat":
        return "Node Comments";
      case "notifications":
        return "Notifications";
      case "nodeHistory":
        return "Node's History";
      case "inheritanceSettings":
        return "Node's Inheritance Settings";
      case "improvements":
        return "Copilot Improvements:";
      case "history":
        return "Edit History:";
      default:
        return "";
    }
  };

  return (
    <Box
      ref={toolbarRef}
      sx={{
        width: !!activeSidebar ? "450px" : hovered ? "190px" : "70px",
        // transition: "width 0.1s ease",
        height: "100vh",
        background:
          theme.palette.mode === "dark"
            ? "rgba(0,0,0,.72)"
            : DESIGN_SYSTEM_COLORS.gray200,
        backdropFilter: "saturate(180%) blur(10px)",
        display: "flex",
        flexDirection: "column",
        padding: activeSidebar !== "improvements" ? "9px" : "",
      }}
      onMouseEnter={() => {
        if (!activeSidebar) {
          setHovered(true);
        } else {
          setHovered(false);
        }
      }}
      onMouseLeave={() => setHovered(false)}
    >
      {!!activeSidebar ? (
        <Box>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              mb: 2,
            }}
          >
            {openLogsFor && activeSidebar === "userActivity" && (
              <Box sx={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <Box sx={{ position: "relative", display: "inline-block" }}>
                  <OptimizedAvatar
                    alt={openLogsFor.fullname}
                    imageUrl={openLogsFor.imageUrl || ""}
                    size={40}
                    sx={{
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                      objectFit: "cover",
                      transition: "transform 0.3s ease",
                    }}
                  />
                </Box>
                <Box>
                  <Typography>
                    {openLogsFor.fName}
                    {"'s Edit History"}
                  </Typography>
                </Box>
              </Box>
            )}

            {getHeaderTitle(activeSidebar) && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  pt: "5px",
                  pl: "5px",
                }}
              >
                <Typography sx={{ fontSize: "29px", fontWeight: "bold" }}>
                  {getHeaderTitle(activeSidebar)}
                </Typography>

                {activeSidebar === "history" && (
                  <TextField
                    value={selectedUser}
                    onChange={(e: any) => {
                      setSelectedUser(e.target.value);
                    }}
                    select
                    label="Select User"
                    sx={{ ml: "15px", minWidth: "100px" }}
                    InputProps={{
                      sx: {
                        height: "40px",
                        borderRadius: "18px",
                      },
                    }}
                    InputLabelProps={{
                      style: { color: "grey" },
                    }}
                  >
                    <MenuItem
                      value=""
                      disabled
                      sx={{
                        backgroundColor: (theme) =>
                          theme.palette.mode === "dark" ? "" : "white",
                      }}
                    >
                      Select User
                    </MenuItem>
                    {[
                      "All",
                      ...Object.keys(activeUsers).filter(
                        (u) => activeUsers[u]?.reputations > 0
                      ),
                    ].map((uname) => (
                      <MenuItem key={uname} value={uname}>
                        {uname === "All"
                          ? "All"
                          : `${activeUsers[uname].fName} ${activeUsers[uname].lName}`}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              </Box>
            )}
            {user && (
              <IconButton
                onClick={() => {
                  if (previousNodeId) {
                    // Checks if the node is deleted (null or undefined)
                    if (nodes[currentVisibleNode?.id] == null) {
                      navigateToNode(previousNodeId);
                    } else {
                      navigateToNode(currentVisibleNode?.id);
                    }
                    setPreviousNodeId("");
                  }
                  setActiveSidebar(null);
                  setOpenLogsFor(null);
                  setCurrentImprovement(null);
                }}
                sx={{
                  ml: "auto",
                  zIndex: 100,
                  mt: "5px",
                  mr: "5px",
                  backgroundColor: "gray",
                  width: "26px",
                  height: "26px",
                }}
              >
                <ClearIcon />
              </IconButton>
            )}
          </Box>
          {renderContent(activeSidebar)}
        </Box>
      ) : (
        <>
          <Box sx={{ mb: 2, mr: "10px" }}>
            <img src={getLog} alt="mit logo" width={"auto"} height={"40px"} />
          </Box>

          {/* Button for Avatar and Full Name */}
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Button
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                padding: 0,
                textTransform: "none",
                minWidth: 0,
              }}
              onClick={handleProfileMenuOpen}
            >
              {user && (
                <OptimizedAvatar
                  alt={`${user?.fName} ${user?.lName}`}
                  imageUrl={activeUsers[user?.uname]?.imageUrl || ""}
                  size={45}
                  sx={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    objectFit: "cover",
                    transition: "transform 0.3s ease",
                  }}
                />
              )}
            </Button>

            <Typography
              sx={{
                ml: 2,
                transition: "opacity 0.3s ease",
                opacity: hovered ? 1 : 0,
                minWidth: "120px",
              }}
            >
              {`${user?.fName} ${user?.lName}`}
            </Typography>
          </Box>

          <Box sx={{ mt: "13px" }}>
            {/* Icon buttons */}
            <SidebarButton
              id="toolbar-notifications-button"
              icon={<NotificationsIcon />}
              onClick={() => {
                handleExpandSidebar("notifications");
              }}
              text="Notifications"
              toolbarIsOpen={hovered}
              rightOption={<CustomBadge value={notifications.length} />}
              rightFloatingOption={
                <CustomSmallBadge value={notifications.length} />
              }
            />
            <SidebarButton
              id="toolbar-help-button"
              icon={<ChatSvg />}
              onClick={() => {
                handleExpandSidebar("chat-discussion");
              }}
              text="Chatroom"
              toolbarIsOpen={hovered}
            />
            {!!user?.manageLock && (
              <SidebarButton
                id="toolbar-help-button"
                icon={<HistoryIcon />}
                onClick={() => {
                  handleExpandSidebar("history");
                }}
                text="Edit History"
                toolbarIsOpen={hovered}
              />
            )}
            {!!user?.admin && (
              <SidebarButton
                id="toolbar-theme-button"
                icon={
                  isLoadingCopilot ? (
                    <CircularProgress size={27} />
                  ) : (
                    <AutoAwesomeIcon
                      sx={{
                        color:
                          improvements.filter((i: any) => !i.implemented)
                            .length > 0
                            ? "#00d000"
                            : "",
                      }}
                    />
                  )
                }
                onClick={async () => {
                  if (
                    improvements.filter((i: any) => !i.implemented).length > 0
                  ) {
                    handleExpandSidebar("improvements");
                    if (improvements[0]?.newNode) {
                      setCurrentImprovement(improvements[0]);
                    } else {
                      compareThisImprovement(improvements[0]);
                    }
                  } else {
                    handleImproveClick();
                  }
                }}
                text={"Copilot"}
                toolbarIsOpen={hovered}
              />
            )}

            <SidebarButton
              id="toolbar-theme-button"
              icon={<AutoStoriesIcon />}
              onClick={() => {
                setDisplayGuidelines((prev: boolean) => !prev);
              }}
              text={"Guidelines"}
              toolbarIsOpen={hovered}
            />

            <SidebarButton
              id="toolbar-theme-button"
              icon={
                theme.palette.mode === "dark" ? (
                  <LightModeIcon />
                ) : (
                  <DarkModeIcon />
                )
              }
              onClick={handleThemeSwitch}
              text={theme.palette.mode === "dark" ? "Light Mode" : "Dark Mode"}
              toolbarIsOpen={hovered}
            />
          </Box>

          <ActiveUsers
            nodes={nodes}
            navigateToNode={navigateToNode}
            displayUserLogs={displayUserLogs}
            handleExpand={handleExpandSidebar}
            fullVersion={hovered}
            activeUsers={activeUsers}
          />
        </>
      )}
      {isAuthenticated && user && renderProfileMenu}
      {dropdownDialog}
    </Box>
  );
};

export const MemoizedToolbarSidebar = React.memo(ToolbarSidebar);

function ChatSvg() {
  return (
    <SvgIcon viewBox="0 0 58 58">
      <g>
        <path
          style={{ fill: "#ff8a33" }}
          d="M29,1.5c16.016,0,29,11.641,29,26c0,5.292-1.768,10.211-4.796,14.318 C53.602,46.563,54.746,53.246,58,56.5c0,0-9.943-1.395-16.677-5.462c-0.007,0.003-0.015,0.006-0.022,0.009 c-2.764-1.801-5.532-3.656-6.105-4.126c-0.3-0.421-0.879-0.548-1.33-0.277c-0.296,0.178-0.483,0.503-0.489,0.848 c-0.01,0.622,0.005,0.784,5.585,4.421C35.854,52.933,32.502,53.5,29,53.5c-16.016,0-29-11.641-29-26C0,13.141,12.984,1.5,29,1.5z"
        />
        <circle style={{ fill: "#FFFFFF" }} cx="15" cy="27.5" r="3" />
        <circle style={{ fill: "#FFFFFF" }} cx="29" cy="27.5" r="3" />
        <circle style={{ fill: "#FFFFFF" }} cx="43" cy="27.5" r="3" />
      </g>
    </SvgIcon>
  );
}
