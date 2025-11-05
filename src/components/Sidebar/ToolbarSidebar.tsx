import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import CloseIcon from "@mui/icons-material/Close";
import HistoryIcon from "@mui/icons-material/History";
import CircularProgress from "@mui/material/CircularProgress";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import EditIcon from "@mui/icons-material/Edit";
import DownloadIcon from "@mui/icons-material/Download";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";

import {
  Avatar,
  Button,
  Divider,
  IconButton,
  LinearProgress,
  Menu,
  MenuItem,
  SvgIcon,
  TextField,
  Tooltip,
  Typography,
  useTheme,
  useMediaQuery,
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
import useThemeChange from "@components/lib/hooks/useThemeChange";
import { DESIGN_SYSTEM_COLORS } from "@components/lib/theme/colors";
import ClearIcon from "@mui/icons-material/Clear";
import { Notifications } from "@components/components/Chat/Notifications";
import { chatChange } from "@components/client/firestore/messages.firestore";
import { INotification } from "@components/types/IChat";
import {
  createNewNode,
  diffCollections,
  diffSortedCollections,
  generateInheritance,
  synchronizeStuff,
} from "@components/lib/utils/helpers";
import { getNotificationsSnapshot } from "@components/client/firestore/notifications.firestore";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import SearchSideBar from "../SearchSideBar/SearchSideBar";
import ActiveUsers from "../ActiveUsers/ActiveUsers";
import UserActivity from "../ActiveUsers/UserActivity";
import ChatSideBar from "../ChatSideBar/ChatSideBar";
import Inheritance from "../Inheritance/Inheritance";
import { SidebarButton } from "../SideBarButton/SidebarButton";
import { Box, SxProps, Theme } from "@mui/material";
import { capitalizeString } from "@components/lib/utils/string.utils";
import { getAuth } from "firebase/auth";
import { useAuth } from "../context/AuthContext";
import { isValidHttpUrl } from "@components/lib/utils/utils";
import {
  getStorage,
  uploadBytesResumable,
  getDownloadURL,
  ref as refStorage,
} from "firebase/storage";
import { NODES, USERS } from "@components/lib/firestoreClient/collections";
import { useRouter } from "next/router";
import ROUTES from "@components/lib/utils/routes";

import NodeActivity from "../ActiveUsers/NodeActivity";
import { User } from "@components/types/IAuth";
import { INode, NodeChange } from "@components/types/INode";
import Improvements from "../Improvements/Improvements";
import { CHAT_DISCUSSION_TABS, development } from "@components/lib/CONSTANTS";

import {
  compareImprovement,
  filterProposals,
} from "@components/lib/utils/copilotHelpers";
import useSelectDropdown from "@components/lib/hooks/useSelectDropdown";
import {
  copilotDeleteNode,
  copilotNewNode,
  Improvement,
  sendLLMRequest,
} from "@components/lib/utils/copilotPrompts";
import OntologyHistory from "../ActiveUsers/OntologyHistory";
import { handleDownload } from "@components/lib/utils/random";

type CustomSmallBadgeProps = { value: number };

type MainSidebarProps = {
  toolbarRef: any;
  user: User | null;
  openSearchedNode: Function;
  searchWithFuse: Function;
  relatedNodes: { [nodeId: string]: any };
  fetchNode: (nodeId: string) => Promise<INode | null>;
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
  displayGuidelines: boolean;
  currentImprovement: any;
  setCurrentImprovement: any;
  lastSearches: string[];
  updateLastSearches: Function;
  selectedChatTab: any;
  setSelectedChatTab: any;
  signOut: any;
  skillsFuture: boolean;
  skillsFutureApp: string;
};

const ToolbarSidebar = ({
  toolbarRef,
  user,
  openSearchedNode,
  searchWithFuse,
  relatedNodes,
  fetchNode,
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
  displayGuidelines,
  currentImprovement,
  setCurrentImprovement,
  lastSearches,
  updateLastSearches,
  selectedChatTab,
  setSelectedChatTab,
  signOut,
  skillsFuture,
  skillsFutureApp,
}: MainSidebarProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery("(max-width:599px)");
  const db = getFirestore();
  const [{ isAuthenticated }] = useAuth();
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

  const [isLoadingCopilot, setIsLoadingCopilot] = useState(false);
  const [nodesByTitle, setNodesByTitle] = useState<{
    [nodeTitle: string]: INode;
  }>({});
  const [improvements, setImprovements] = useState<any>([]);
  const [copilotMessage, setCopilotMessage] = useState("");
  const { selectIt, dropdownDialog } = useSelectDropdown();
  const [oNetProgress, setONetProgress] = useState({ added: 0, remaining: 0 });

  const handleProfileMenuOpen = (event: any) => {
    if (user?.uname === "1man" || user?.uname === "ouhrac") {
      loadProgress();
    }
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

  const loadProgress = async () => {
    try {
      const oNetProgressRef = doc(collection(db, "onetTasks"), "progress");
      const oNetProgressDoc = await getDoc(oNetProgressRef);
      if (oNetProgressDoc.exists()) {
        const oNetProgressData = oNetProgressDoc.data();
        setONetProgress({
          added: oNetProgressData.added,
          remaining: oNetProgressData.remaining,
        });
      }
      const addedQuery = query(
        collection(db, "onetTasks"),
        where("added", "==", true),
      );
      const addedOnetDocsSnapshot = await getDocs(addedQuery);

      const nonAddedQuery = query(
        collection(db, "onetTasks"),
        where("added", "==", false),
      );
      const remainingOnetDocsSnapshot = await getDocs(nonAddedQuery);
      setONetProgress({
        added: addedOnetDocsSnapshot.docs.length,
        remaining: remainingOnetDocsSnapshot.docs.length,
      });
      setDoc(oNetProgressRef, {
        added: addedOnetDocsSnapshot.docs.length,
        remaining: remainingOnetDocsSnapshot.docs.length,
        updatedAt: new Date(),
        updatedBy: user?.uname ?? "",
      });
    } catch (error) {
      console.error(error);
    }
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
    [nodesByTitle],
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
            "",
          );
        } else if (
          image.type !== "image/jpg" &&
          image.type !== "image/jpeg" &&
          image.type !== "image/png"
        ) {
          confirmIt(
            "We only accept JPG, JPEG, or PNG images. Please upload another image.",
            "Ok",
            "",
          );
        } else if (image.size > 1024 * 1024) {
          confirmIt(
            "We only accept file sizes less than 1MB for profile images. Please upload another image.",
            "Ok",
            "",
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
            picturesFolder + imageFileName,
          );
          const task = uploadBytesResumable(storageRef, image);
          task.on(
            "state_changed",
            function progress(snapshot) {
              setPercentageUploaded(
                Math.ceil(
                  (100 * snapshot.bytesTransferred) / snapshot.totalBytes,
                ),
              );
            },
            function error(err) {
              setIsUploading(false);
              confirmIt(
                "There is an error with uploading your picture. Please try again! If the problem persists, try another picture.",
                "Ok",
                "",
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
            },
          );
        }
      } catch (err) {
        console.error("Image Upload Error: ", err);
        setIsUploading(false);
      }
    },
    [user],
  );

  const handleEditImage = useCallback(() => {
    if (!inputEl.current) return;
    inputEl.current.click();
  }, [inputEl]);

  const renderProfileMenu = (
    <Menu
      id="ProfileMenu"
      anchorEl={profileMenuOpen}
      open={isProfileMenuOpen}
      onClose={handleProfileMenuClose}
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "right",
      }}
      transformOrigin={{
        vertical: "top",
        horizontal: "right",
      }}
      PaperProps={{
        sx: {
          width: "280px",
          padding: "8px 0",
          borderRadius: "13px",
          backgroundColor: (theme) =>
            theme.palette.mode === "light" ? "#dfdfdf" : "",
          border: "1px solid gray",
        },
      }}
    >
      {" "}
      <IconButton
        onClick={handleProfileMenuClose}
        sx={{
          position: "absolute",
          right: 8,
          top: 0.5,
          color: "text.secondary",
          zIndex: 1,
          "&:hover": {
            backgroundColor: (theme) =>
              theme.palette.mode === "dark" ? "gray" : "#f4f4f4",
          },
          border: "1px solid gray",
          borderRadius: "25px",

          p: 0.5,
        }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>{" "}
      {isAuthenticated && user && (
        <Box sx={{ pl: 3, textAlign: "center" }}>
          <Typography sx={{ color: "gray" }}>{user?.email}</Typography>
        </Box>
      )}{" "}
      {isAuthenticated && user && (
        <Box
          sx={{
            padding: "12px 16px",
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            cursor: "pointer",
            textAlign: "center",
            mt: "15px",
          }}
        >
          <Tooltip
            title={
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
                  Update Your Profile Picture
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ fontStyle: "italic", color: "white" }}
                >
                  Supported formats: JPG, PNG or JPEG Maximum size 1MB
                </Typography>
              </Box>
            }
            placement="left"
          >
            <Box
              sx={{
                position: "relative",
                width: 80,
                height: 80,
                borderRadius: "50%",
                ":hover": {
                  boxShadow: !isUploading
                    ? "0 0 10px 5px rgba(55, 185, 43, 0.5)"
                    : "none",
                },
                transition: "box-shadow 0.3s ease",
              }}
              onClick={handleEditImage}
            >
              {isUploading && (
                <Box
                  sx={{
                    position: "absolute",
                    top: -2,
                    left: -2,
                    right: -2,
                    bottom: -2,
                    borderRadius: "50%",
                    background: `conic-gradient(orange ${percentageUploaded * 3.6}deg, transparent 0deg)`,
                    zIndex: 1,
                  }}
                />
              )}

              <OptimizedAvatar
                alt={`${user.fName} ${user.lName}`}
                imageUrl={activeUsers[user?.uname]?.imageUrl || ""}
                size={80}
                sx={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  objectFit: "cover",
                  position: "relative",
                  zIndex: 2,
                }}
              />

              <Box
                sx={{
                  position: "absolute",
                  bottom: 0,
                  right: 0,
                  bgcolor: isUploading ? "orange" : "gray",
                  color: theme.palette.primary.contrastText,
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: `1px solid white`,
                  cursor: "pointer",
                  "&:hover": {
                    bgcolor: isUploading
                      ? "darkorange"
                      : theme.palette.primary.dark,
                  },
                  zIndex: 3,
                }}
              >
                {isUploading ? (
                  <Typography
                    variant="caption"
                    sx={{ fontSize: "8px", fontWeight: "bold" }}
                  >
                    {percentageUploaded}%
                  </Typography>
                ) : (
                  <CameraAltIcon sx={{ fontSize: "19px", color: "white" }} />
                )}
              </Box>
            </Box>
          </Tooltip>
          <input
            type="file"
            ref={inputEl}
            onChange={handleImageChange}
            accept="image/png, image/jpg, image/jpeg"
            hidden
          />
        </Box>
      )}
      {isAuthenticated && user && (
        <Box sx={{ pl: 3, textAlign: "center", mt: "20px" }}>
          <Typography variant="h5" sx={{ fontWeight: 500 }}>
            Hi, {user?.fName}!
          </Typography>
          {(user.uname === "1man" || user.uname === "ouhrac") && (
            <Box
              sx={{
                border: "1px solid gray",
                borderRadius: "20px",
                mr: "16px",
                mt: "8px",
                backgroundColor: (theme) =>
                  theme.palette.mode === "light" ? "#fffdfd" : "#252525",
                py: "8px",
              }}
            >
              <Typography
                variant="subtitle1"
                sx={{ mt: 1, color: "text.secondary", fontWeight: "bold" }}
              >
                O*NET Progress
              </Typography>
              <Typography variant="body1" sx={{ mt: 0.5 }}>
                <Box
                  component="span"
                  sx={{ fontWeight: 500, color: "success.main" }}
                >
                  {oNetProgress.added}
                </Box>{" "}
                added /{" "}
                <Box
                  component="span"
                  sx={{ fontWeight: 500, color: "warning.main" }}
                >
                  {oNetProgress.remaining}
                </Box>{" "}
                remaining
              </Typography>
            </Box>
          )}
        </Box>
      )}
      {isAuthenticated && user && (
        <Button
          onClick={signOut}
          sx={{
            py: "6px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            "&:hover": {
              backgroundColor:
                theme.palette.mode === "dark"
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(0, 0, 0, 0.04)",
            },
            borderRadius: "25px",
            border: "1px solid gray",

            cursor: "pointer",
            width: "80%",
            mt: "25px",
            alignSelf: "center",
            ml: "10%",
          }}
        >
          <LogoutIcon fontSize="medium" sx={{ color: "gray" }} />
          <Typography variant="body1" sx={{ fontWeight: "bold" }}>
            Sign out
          </Typography>
        </Button>
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
        }),
      );
    };
    const killSnapshot = getNotificationsSnapshot(
      db,
      { uname: user.uname, lastVisible: null },
      onSynchronize,
    );
    return () => killSnapshot();
  }, [db, user]);

  const openNotification = useCallback(
    (
      notificationId: string,
      messageId: string,
      type: string,
      nodeId?: string,
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
      setTimeout(() => {
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
      }, 500);
    },
    [db, user],
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

          if (change.type === "added" || change.type === "modified") {
            updatedUsersData[userId] = {
              node: {
                title: relatedNodes[currentNode]?.title || "",
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
  }, [relatedNodes]);

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
    [openLogsFor],
  );

  const displayDiff = (data: NodeChange) => {
    if (data === null) {
      setCurrentImprovement(null);
      setSelectedDiffNode(null);
      if (!relatedNodes[currentVisibleNode?.id]) {
        navigateToNode(previousNodeId);
      } else {
        navigateToNode(currentVisibleNode?.id);
      }
      setPreviousNodeId("");
      return;
    }

    if (currentVisibleNode?.id !== data.nodeId) {
      setCurrentVisibleNode(
        relatedNodes[data.nodeId] ? relatedNodes[data.nodeId] : data.fullNode,
      );
    }
    const modified_property_type = data.modifiedProperty
      ? data.fullNode?.propertyType[data.modifiedProperty]
      : "";

    if (
      (modified_property_type ||
        data.modifiedProperty === "isPartOf" ||
        data.modifiedProperty === "parts" ||
        data.modifiedProperty === "specializations" ||
        data.modifiedProperty === "generalizations") &&
      modified_property_type !== "string" &&
      modified_property_type !== "string-array" &&
      modified_property_type !== "string-select" &&
      modified_property_type !== "numeric"
    ) {
      const diff =
        data.changeType === "sort collections"
          ? diffSortedCollections(data.previousValue, data.newValue)
          : diffCollections(data.previousValue, data.newValue);

      data.detailsOfChange = { comparison: diff };
    }
    setTimeout(() => {
      setSelectedDiffNode(data);
    }, 500);

    if (!previousNodeId) {
      setPreviousNodeId(currentVisibleNode?.id);
    }

    setTimeout(() => {
      const modifiedProperty = data.modifiedProperty;
      const changedProperty = data.changeDetails?.addedProperty;
      const targetProperty = modifiedProperty || changedProperty;

      if (targetProperty) {
        let firstChangedNodeId = null;

        if (data.detailsOfChange?.comparison) {
          for (const collection of data.detailsOfChange.comparison) {
            const changedNode = collection.nodes.find(
              (node: any) =>
                node.change === "added" ||
                node.change === "removed" ||
                node.change === "modified" ||
                node.changeType === "sort",
            );
            if (changedNode) {
              firstChangedNodeId = changedNode.id;
              break;
            }
          }
        }

        // Scroll to the specific changed element
        if (firstChangedNodeId) {
          const changedElement = document.getElementById(
            `${firstChangedNodeId}-${targetProperty}`,
          );
          if (changedElement) {
            changedElement.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
            return;
          }
        }

        // Fallback: scroll to property container
        const propertyElement = document.getElementById(
          `property-${targetProperty}`,
        );
        if (propertyElement) {
          propertyElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }
    }, 1000);
  };

  useEffect(() => {
    if (!!user?.admin) {
      const nodesByT: { [nodeTitle: string]: INode } = {};
      for (let nodeId in relatedNodes) {
        const nodeTitle = relatedNodes[nodeId].title;
        nodesByT[nodeTitle] = relatedNodes[nodeId];
      }
      setNodesByTitle(nodesByT);
    }
  }, [relatedNodes, user]);
  const getNewNodes = (newNodes: copilotNewNode[]): any => {
    try {
      if (!user?.uname) return;
      const _NODES = [];

      for (let node of newNodes) {
        const addedNonExistentElements: {
          [property: string]: { id: string; title: string }[];
        } = {};
        if (!!nodesByTitle[node.title]) {
          continue;
        }
        const first_generalization = node.generalizations[0];
        const generalization = nodesByTitle[first_generalization];
        if (!generalization) continue;

        const newId = doc(collection(db, NODES)).id;
        const inheritance = generateInheritance(
          generalization.inheritance,
          generalization.id,
        );

        const newNode = createNewNode(
          generalization,
          newId,
          node.title,
          inheritance,
          generalization.id,
          user?.uname,
          skillsFuture,
        );

        for (let p in node) {
          if (
            !inheritance[p] &&
            p !== "generalizations" &&
            p !== "specializations" &&
            p !== "title"
          ) {
            inheritance[p] = {
              ref: null,
              inheritanceType: "inheritUnlessAlreadyOverRidden",
            };
          }
          const property:
            | "title"
            | "description"
            | "generalizations"
            | "parts"
            | "isPartOf"
            | "nodeType"
            | "actor"
            | "objectsActedOn"
            | "evaluationDimension"
            | "postConditions"
            | "preConditions"
            | "abilities"
            | "typeOfActor"
            | "listOfIndividualsInGroup"
            | "numberOfIndividualsInGroup"
            | "lifeSpan"
            | "modifiability"
            | "perceivableProperties"
            | "criteriaForAcceptability"
            | "directionOfDesirability"
            | "evaluationType"
            | "measurementUnits"
            | "units"
            | "capabilitiesRequired"
            | "rewardFunction"
            | "reward"
            | "reasoning" = p as any;
          if (
            property === "title" ||
            property === "generalizations" ||
            property === "reasoning"
          ) {
            continue;
          }

          const propertyValue: any = node[property];
          if (newNode.properties.hasOwnProperty(property)) {
            if (inheritance[property]) {
              inheritance[property].ref = null;
            }
            if (
              Array.isArray(newNode.properties[property]) &&
              Array.isArray(propertyValue)
            ) {
              const value = [];
              for (let nodeT of propertyValue) {
                const optional = nodeT
                  .trim()
                  .toLowerCase()
                  .endsWith("(optional)");
                const nodeTitle = nodeT.replace(/\(optional\)/i, "").trim();
                if (nodesByTitle[nodeT]?.id) {
                  value.push({ id: nodesByTitle[nodeT].id, optional });
                } else {
                  const newId = doc(collection(db, "nodes")).id;
                  value.push({
                    id: newId,
                    title: nodeTitle,
                    change: "added",
                    optional,
                  });
                  if (!addedNonExistentElements[property]) {
                    addedNonExistentElements[property] = [];
                  }
                  addedNonExistentElements[property].push({
                    title: nodeTitle,
                    id: newId,
                  });
                }
              }
              newNode.properties[property] = [
                {
                  collectionName: "main",
                  nodes: value,
                },
              ];
            } else if (
              typeof newNode.properties[property] === "string" &&
              typeof propertyValue === "string"
            ) {
              newNode.properties[property] = propertyValue;
            }
          }
        }
        if (!!node?.description) {
          if (!inheritance["description"]) {
            inheritance["description"] = {
              ref: null,
              inheritanceType: "inheritUnlessAlreadyOverRidden",
            };
          }
          inheritance.description.ref = null;
          newNode.properties.description = node.description;
        }
        _NODES.push({
          node: newNode,
          newNode: true,
          reasoning: node.reasoning,
          addedNonExistentElements,
          generalizationId: generalization.id,
          first_generalization: first_generalization,
        });
      }

      return _NODES;
    } catch (error) {
      console.error(error);
    }
  };
  const getDeletedNode = (
    deletedNodes: {
      title: string;
      reasoning: string;
    }[],
  ): {
    title: string;
    nodeId: string;
    deleteNode: boolean;
    reasoning: string;
  }[] => {
    const result = [];
    for (let { title, reasoning } of deletedNodes) {
      if (!!nodesByTitle[title]) {
        result.push({
          title,
          nodeId: nodesByTitle[title].id,
          deleteNode: true,
          reasoning: reasoning,
        });
      }
    }
    return result;
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
    if (!relatedNodes[nodeId]) {
      return;
    }
    if (relatedNodes[nodeId]) {
      setCurrentVisibleNode(relatedNodes[nodeId]);
    }
    const result = compareImprovement(improvement, nodesByTitle, relatedNodes);

    setCurrentImprovement(result);
    setTimeout(() => {
      if (improvement.change.modified_property) {
        const element = document.getElementById(
          `property-${improvement.change.modified_property}`,
        );
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }, 900);
  };

  const handleImproveClick = async () => {
    if (!currentVisibleNode) return;

    const options = (await selectIt(
      currentVisibleNode.title,
      currentVisibleNode.nodeType,
      relatedNodes,
      currentVisibleNode?.id,
    )) as {
      model: string;
      userMessage: string;
      deepNumber: number;
      generateNewNodes: boolean;
      generateImprovement: boolean;
      selectedProperties: Set<string>;
      proposeDeleteNode: boolean;
      inputProperties: Set<string>;
    };

    if (!options) return;
    const {
      model,
      userMessage,
      deepNumber,
      generateNewNodes,
      selectedProperties,
      proposeDeleteNode,
      inputProperties,
    } = options;
    setIsLoadingCopilot(true);
    setCurrentIndex(0);
    try {
      const response: any = (await sendLLMRequest(
        userMessage,
        model,
        deepNumber,
        currentVisibleNode?.id,
        generateNewNodes,
        selectedProperties,
        proposeDeleteNode,
        inputProperties,
        currentVisibleNode?.appName ?? "",
      )) as {
        improvements: Improvement[];
        new_nodes: copilotNewNode[];
        deleted_nodes: copilotDeleteNode[];
        message: string;
        inputProperties: Set<string>;
      };

      if (!response) {
        throw new Error("Missing response in handleImproveClick!");
      }

      if (
        (response?.improvements || []).length <= 0 &&
        (response?.new_nodes || []).length <= 0 &&
        (response?.deleted_nodes || []).length <= 0
      ) {
        confirmIt(
          <Box>
            {`I've analyzed your sub-ontology graph and found no areas for improvement or new nodes to add.`}{" "}
            <strong style={{ color: "orange" }}>
              {currentVisibleNode.title}
            </strong>
            .
          </Box>,
          "Ok",
        );
        return;
      }

      setCopilotMessage(response.message);
      const newImprovements: Improvement[] = [];

      for (let improvement of response?.improvements) {
        const change = improvement.change;
        if (change.modified_property) {
          if (change.modified_property === "parts") {
            const optionalParts = [];
            for (
              let partIdx = 0;
              partIdx < change.new_value.final_array.length;
              partIdx++
            ) {
              const partTitle = change.new_value.final_array[partIdx];
              const optional = partTitle
                .trim()
                .toLowerCase()
                .endsWith("(optional)");
              if (optional) {
                change.new_value.final_array[partIdx] = partTitle
                  .replace(/\(optional\)/i, "")
                  .trim();
                optionalParts.push(change.new_value.final_array[partIdx]);
              }
            }

            change.optionalParts = optionalParts;
          }
          newImprovements.push({
            title: improvement.title,
            change,
          });
        } else if (change.hasOwnProperty("specializations")) {
          let reasoning = "";

          for (let _change of change["specializations"]) {
            reasoning = reasoning + "\n\n" + _change.reasoning;
          }
          newImprovements.push({
            title: improvement.title,

            change: {
              reasoning,
              modified_property: "specializations",
              new_value: change["specializations"],
            },
            changes: [
              {
                reasoning,
                modified_property: "specializations",
                new_value: change["specializations"],
              },
            ],
          });
        }
      }

      const improvements: Improvement[] =
        filterProposals(newImprovements || [], nodesByTitle, relatedNodes) || [];

      const newNodes: {
        title: string;
        description: string;
        first_generalization: string;
        reasoning: string;
        newNode: boolean;
      }[] = getNewNodes(response?.new_nodes || []);

      const deletedNodes: {
        title: string;
        nodeId: string;
        reasoning: string;
        deleteNode: boolean;
      }[] = getDeletedNode(response?.deleted_nodes || []);
      if (
        improvements.length > 0 ||
        newNodes.length > 0 ||
        deletedNodes.length > 0
      ) {
        setImprovements([...newNodes, ...deletedNodes, ...improvements]);
      }
    } catch (error) {
      confirmIt(
        "Sorry! There was an error generating proposals, please try again!",
        "Ok",
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
            skillsFuture={skillsFuture}
            skillsFutureApp={skillsFutureApp}
          />
        );
      case "userActivity":
        return (
          <UserActivity
            openLogsFor={openLogsFor}
            displayDiff={displayDiff}
            selectedDiffNode={selectedDiffNode}
            nodes={relatedNodes}
            appName={skillsFutureApp}
          />
        );
      case "chat":
        return (
          <ChatSideBar
            currentVisibleNode={currentVisibleNode}
            user={user}
            confirmIt={confirmIt}
            searchWithFuse={searchWithFuse}
            navigateToNode={navigateToNode}
            chatTabs={[
              {
                id: "node",
                title: "This node",
                placeholder: "Share your thoughts...",
              },
            ]}
            selectedChatTab={selectedChatTab}
            setSelectedChatTab={setSelectedChatTab}
            nodes={relatedNodes}
            fetchNode={fetchNode}
          />
        );
      case "chat-discussion":
        return (
          <ChatSideBar
            currentVisibleNode={currentVisibleNode}
            user={user}
            confirmIt={confirmIt}
            searchWithFuse={searchWithFuse}
            navigateToNode={navigateToNode}
            chatTabs={CHAT_DISCUSSION_TABS}
            selectedChatTab={selectedChatTab}
            setSelectedChatTab={setSelectedChatTab}
            nodes={relatedNodes}
            fetchNode={fetchNode}
          />
        );
      case "inheritanceSettings":
        return <Inheritance selectedNode={currentVisibleNode} nodes={relatedNodes} fetchNode={fetchNode} />;
      case "nodeHistory":
        return (
          <NodeActivity
            currentVisibleNode={currentVisibleNode}
            selectedDiffNode={selectedDiffNode}
            displayDiff={displayDiff}
            activeUsers={activeUsers}
            nodes={relatedNodes}
          />
        );
      case "improvements":
        return (
          <Improvements
            currentImprovement={currentImprovement}
            setCurrentImprovement={setCurrentImprovement}
            currentVisibleNode={currentVisibleNode}
            relatedNodes={relatedNodes}
            fetchNode={fetchNode}
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
            skillsFutureApp={skillsFutureApp}
            skillsFuture={skillsFuture}
            nodesByTitle={nodesByTitle}
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
            skillsFuture={skillsFuture}
            skillsFutureApp={skillsFutureApp}
            nodes={relatedNodes}
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

  const getHeaderTitle = useMemo(() => {
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
        return "AI Assistant Improvements";
      case "history":
        return "Edit History";
      default:
        return "";
    }
  }, [activeSidebar]);
  return (
    <Box
      ref={toolbarRef}
      sx={{
        width: !!activeSidebar 
          ? isMobile 
            ? "100%" 
            : "450px" 
          : hovered 
            ? "190px" 
            : "70px",
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
        borderTopLeftRadius: "25px",
        borderBottomLeftRadius: "25px",
        p: activeSidebar ? 0 : 2,
      }}
      onMouseEnter={() => {
        /*  if (!activeSidebar) {
          setHovered(true);
        } else {
          setHovered(false);
        } */
      }}
      // onMouseLeave={() => setHovered(false)}
    >
      {!!activeSidebar ? (
        <Box>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              textAlign: "center",
              mb: 2,
              px: "11px",
            }}
          >
            {openLogsFor && activeSidebar === "userActivity" && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: "15px",
                  mt: "14px",
                }}
              >
                <Box>
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

                <Typography sx={{ fontWeight: "bold", fontSize: "20px" }}>
                  {openLogsFor.fName}
                  {"'s Edit History"}
                </Typography>
              </Box>
            )}

            {getHeaderTitle && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  pt: "5px",
                  pl: "5px",
                }}
              >
                <Typography sx={{ fontSize: "29px", color: "gray", pt: "7px" }}>
                  {getHeaderTitle}
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
                        (u) => activeUsers[u]?.reputations > 0,
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
              <Tooltip title={`Close ${getHeaderTitle || "Sidebar"}`}>
                <IconButton
                  onClick={() => {
                    setActiveSidebar(null);
                    setOpenLogsFor(null);
                    setCurrentImprovement(null);
                    setSelectedDiffNode(null);
                    if (previousNodeId) {
                      // Checks if the node is deleted (null or undefined)
                      if (relatedNodes[currentVisibleNode?.id] == null) {
                        navigateToNode(previousNodeId);
                      } else {
                        navigateToNode(currentVisibleNode?.id);
                      }
                      setPreviousNodeId("");
                    }
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
              </Tooltip>
            )}
          </Box>
          {renderContent(activeSidebar)}
        </Box>
      ) : (
        <>
          <Box sx={{ mb: 2, mr: "15px" }}>
            <img src={getLog} alt="mit logo" width={"auto"} height={"40px"} />
          </Box>

          {/* Button for Avatar and Full Name */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
            }}
          >
            <Box
              onClick={handleProfileMenuOpen}
              sx={{
                border: "2px solid #1ff81f",
                borderRadius: "50%",
                ml: "3px",
              }}
            >
              {user && (
                <OptimizedAvatar
                  alt={`${user?.fName} ${user?.lName}`}
                  imageUrl={activeUsers[user?.uname]?.imageUrl || ""}
                  size={43}
                  sx={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    objectFit: "cover",
                    transition: "transform 0.3s ease",
                    ":hover": {
                      boxShadow: !isUploading
                        ? "0 0 10px 5px rgba(55, 185, 43, 0.5)"
                        : "none",
                    },
                  }}
                />
              )}
            </Box>
            <Typography
              sx={{
                ml: 2,
                transition: "opacity 0.3s ease",
                opacity: hovered ? 1 : 0,
                minWidth: "120px",
                fontWeight: "bold",
                color: "#f4e2e2",
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

            <SidebarButton
              id="toolbar-help-button"
              icon={<HistoryIcon />}
              onClick={() => {
                handleExpandSidebar("history");
              }}
              text="Edit History"
              toolbarIsOpen={hovered}
            />

            {!!user?.admin &&
              (window.location.origin.startsWith("http://localhost") ||
                window.location.origin ===
                  "https://ontology-app-163479774214.us-central1.run.app") && (
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
                      if (
                        improvements[0]?.newNode ||
                        improvements[0]?.deleteNode
                      ) {
                        setCurrentImprovement(improvements[0]);
                      } else {
                        compareThisImprovement(improvements[0]);
                      }
                    } else {
                      handleImproveClick();
                    }
                  }}
                  text={"AI Assistant"}
                  toolbarIsOpen={hovered}
                />
              )}

            <SidebarButton
              id="toolbar-theme-button"
              icon={
                <AutoStoriesIcon
                  sx={{ color: displayGuidelines ? "white" : "" }}
                />
              }
              onClick={() => {
                setDisplayGuidelines((prev: boolean) => !prev);
              }}
              text={"Guidelines"}
              toolbarIsOpen={hovered}
              variant={displayGuidelines ? "fill" : undefined}
            />
            <SidebarButton
              id="toolbar-theme-button"
              icon={<DownloadIcon />}
              onClick={() => {
                try {
                  handleDownload({ nodes: relatedNodes });
                } catch (error) {
                  confirmIt("There was an error downloading the JSON!");
                }
              }}
              text={"Download JSON"}
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
              text={
                theme.palette.mode === "dark"
                  ? "Turn on light"
                  : "Turn off light"
              }
              toolbarIsOpen={hovered}
            />
          </Box>

          <ActiveUsers
            nodes={relatedNodes}
            navigateToNode={navigateToNode}
            displayUserLogs={displayUserLogs}
            handleExpand={handleExpandSidebar}
            fullVersion={hovered}
            activeUsers={activeUsers}
            currentUser={user}
          />
        </>
      )}
      {!activeSidebar && (
        <Box
          sx={{
            pt: "14px",
            display: "flex",
            justifyContent: "flex-start",
            mt: "auto",
          }}
        >
          {!isMobile && (
            <Tooltip title={hovered ? "Collapse" : "Expand"} placement="left">
              {hovered ? (
                <ChevronRightIcon
                  onClick={() => {
                    setHovered((prev) => !prev);
                  }}
                  sx={{
                    borderRadius: "50%",
                    mt: "auto",
                    p: "3px",
                    cursor: "pointer",
                    fontSize: "30px",
                    ":hover": {
                      backgroundColor: "orange",
                    },
                  }}
                />
              ) : (
                <ChevronLeftIcon
                  onClick={() => {
                    setHovered((prev) => !prev);
                  }}
                  sx={{
                    borderRadius: "50%",
                    mt: "auto",
                    p: "3px",
                    cursor: "pointer",
                    fontSize: "30px",
                    ":hover": {
                      backgroundColor: "orange",
                    },
                  }}
                />
              )}
            </Tooltip>
          )}
        </Box>
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
