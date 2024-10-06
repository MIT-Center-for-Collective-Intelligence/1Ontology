/* # AppHeader.tsx

## Overview
This file contains the implementation of the application header component (`AppHeader`) in TypeScript, which serves as the top navigation bar for the project. It includes features such as theming, user authentication, and a profile menu.

## Dependencies
- `@mui/icons-material`: Material-UI icons for DarkMode, LightMode, and Logout.
- `@mui/material`: Material-UI components for UI elements.
- `@mui/system`: Material-UI system for styling.
- `firebase/auth`: Firebase authentication module.
- `next/image`: Next.js Image component for optimized image loading.
- `next/router`: Next.js router for navigation.
- `react`: React library for building user interfaces.

## Constants
- `HEADER_HEIGHT`: Constant defining the height of the header.
- `HEADER_HEIGHT_MOBILE`: Constant defining the height of the header on mobile devices.
- `orangeDark` and `orange900`: Constants defining color values.

## Types
- `AppHeaderProps`: Props interface for the `AppHeader` component.

## Components
### AppHeader Component
- The `AppHeader` component is a functional component that serves as the application header.
- It includes theming functionality, user authentication, and a profile menu.
- The header is styled using Material-UI components and includes a dynamic logo based on the theme.

### Usage
```tsx
import AppHeader from 'path/to/AppHeader';
*/

import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import LogoutIcon from "@mui/icons-material/Logout";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import NotificationsIcon from "@mui/icons-material/Notifications";
import SearchIcon from "@mui/icons-material/Search";
import ViewSidebarIcon from "@mui/icons-material/ViewSidebar";
import DownloadIcon from "@mui/icons-material/Download";

import {
  Avatar,
  Badge,
  Button,
  CircularProgress,
  LinearProgress,
  Link,
  Typography,
  useTheme,
} from "@mui/material";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import { Stack } from "@mui/system";
import { getAuth } from "firebase/auth";
import Image from "next/image";
import { useRouter } from "next/router";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import mitLogo from "../../../public/CCI-logo.gif";
import mitLogoDark from "../../../public/MIT-Logo-Dark.png";
import { capitalizeString, timeAgo } from "../../lib/utils/string.utils";
import useThemeChange from " @components/lib/hooks/useThemeChange";
import { DESIGN_SYSTEM_COLORS } from " @components/lib/theme/colors";
import ROUTES from " @components/lib/utils/routes";
import { useAuth } from "../context/AuthContext";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { NODES, USERS } from " @components/lib/firestoreClient/collections";
import {
  getDownloadURL,
  getStorage,
  ref as refStorage,
  uploadBytesResumable,
} from "firebase/storage";
import { isValidHttpUrl } from " @components/lib/utils/utils";
import { NO_IMAGE_USER } from " @components/lib/CONSTANTS";
import { INode } from " @components/types/INode";
import { INotification } from " @components/types/IChat";
import OptimizedAvatar from "../Chat/OptimizedAvatar";
export const HEADER_HEIGHT = 80;
export const HEADER_HEIGHT_MOBILE = 72;

export const orangeDark = "#FF6D00";
export const orange900 = "#E56200";

type AppHeaderProps = {
  setRightPanelVisible: any;
  rightPanelVisible: boolean;
  loading: boolean;
  confirmIt: any;
  sidebarView: number;
  setSidebarView: any;
  handleNotificationPopup: (event: React.MouseEvent<HTMLElement>) => void;
  notifications: INotification[];
  handleChat: () => void;
  handleSearch: () => void;
  nodes: { [nodeId: string]: INode };
  navigateToNode: any;
  displayInheritanceSettings: any;
  displayUserLogs: any;
  locked: boolean;
};
const AppHeader = forwardRef(
  (
    {
      setRightPanelVisible,
      rightPanelVisible,
      loading,
      confirmIt,
      sidebarView,
      setSidebarView,
      handleNotificationPopup,
      notifications,
      handleChat,
      handleSearch,
      displayInheritanceSettings,
      displayUserLogs,
      nodes,
      navigateToNode,
      locked,
    }: AppHeaderProps,
    ref
  ) => {
    const [{ isAuthenticated, user }] = useAuth();
    const [handleThemeSwitch] = useThemeChange();
    const theme = useTheme();
    const router = useRouter();
    const [profileMenuOpen, setProfileMenuOpen] = useState(null);
    const [percentageUploaded, setPercentageUploaded] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [profileImage, setProfileImage] = useState("");
    const isProfileMenuOpen = Boolean(profileMenuOpen);
    const db = getFirestore();

    const [usersNodesViews, setUsersNodesViews] = useState<any>({});

    const signOut = async () => {
      router.push(ROUTES.signIn);
      getAuth().signOut();
    };

    const handleProfileMenuOpen = (event: any) => {
      setProfileMenuOpen(event.currentTarget);
    };
    const inputEl = useRef<HTMLInputElement>(null);

    const handleProfileMenuClose = () => {
      setProfileMenuOpen(null);
    };

    const updateUserImage = async (imageUrl: string) => {
      const userDoc = doc(collection(db, USERS), user?.uname);
      await updateDoc(userDoc, { imageUrl });
    };

    useEffect(() => {
      const usersQuery = query(collection(db, "users"));
      const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
        setUsersNodesViews((prevUsersNodesViews: any) => {
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
                uname: userId,
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

            let bucket = "ontology-41607.appspot.com";
            if (isValidHttpUrl(bucket)) {
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
                <LinearProgress sx={{ width: "25px" }} />
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
            <LogoutIcon sx={{ mr: "5px" }} />{" "}
            <span id="LogoutText">Logout</span>
          </MenuItem>
        )}
      </Menu>
    );
    const toggleRightPanel = () => {
      setRightPanelVisible(!rightPanelVisible);
    };

    useEffect(() => {
      if (!user?.uname) return;
      const userRef = doc(collection(db, USERS), user.uname);
      updateDoc(userRef, {
        rightPanel: !rightPanelVisible,
      });
    }, [user, rightPanelVisible]);

    const getStructureForJSON = (data: INode) => {
      const getTitles = (property: any) => {
        return Object.values(property)
          .flat()
          .map((prop: any) => prop.title);
      };

      const { properties } = data;
      for (let property in properties) {
        if (typeof properties[property] !== "string") {
          properties[property] = getTitles(properties[property]);
        }
      }
      return {
        title: data.title,
        generalizations: getTitles(data.generalizations),
        specializations: getTitles(data.specializations),
        parts: [],
        isPartOf: [],
        // ...properties,
      };
    };

    const handleDownload = useCallback(async () => {
      // try {
      const nodesCollection = query(
        collection(db, NODES),
        where("deleted", "==", false),
        where("root", "==", "hn9pGQNxmQe9Xod5MuKK")
      );
      const querySnapshot = await getDocs(nodesCollection);
      let i = 0;
      // for (let nodeDoc of querySnapshot.docs) {
      //   const nodeData = { ...nodeDoc.data(), id: nodeDoc.id } as INode;
      //   if (nodeData.specializations) {
      //     for (let category of Object.keys(nodeData.specializations)) {
      //       for (let specialization of nodeData.specializations[category]) {
      //         const specNodeRef = doc(collection(db, NODES), specialization.id);
      //         const specNodeDoc = await getDoc(specNodeRef);
      //         if (!specNodeDoc.exists()) {
      //           console.log("Specialization not found: ", specialization?.id);
      //         } else {
      //           const specNodeData = specNodeDoc.data() as INode;
      //           /*       if (specNodeData.title !== specialization.title) {
      //             console.log(
      //               "Specialization title mismatch: ",
      //               specNodeData.title,
      //               specialization.title
      //             );
      //           } */
      //           if (specNodeData.generalizations) {
      //             let generalizationound = false;
      //             for (let categ of Object.keys(nodeData.generalizations)) {
      //               if (
      //                 specNodeData.generalizations[categ]?.findIndex(
      //                   (generali) => generali.id === nodeData.id
      //                 ) !== -1
      //               ) {
      //                 generalizationound = true;
      //               }
      //             }
      //             if (!generalizationound) {
      //               console.log("Generalization not found: ", {
      //                 specialization: specNodeData.title,
      //                 node: nodeData.title,
      //               });
      //             }
      //           } else {
      //             console.log("Specialization has no generalizations: ", {
      //               specialization: specNodeData.title,
      //               node: nodeData.title,
      //             });
      //           }
      //         }
      //       }
      //     }
      //   }
      //   if (nodeData.generalizations) {
      //     for (let category of Object.keys(nodeData.generalizations)) {
      //       for (let generalization of nodeData.generalizations[category]) {
      //         const genNodeRef = doc(collection(db, NODES), generalization.id);
      //         const genNodeDoc = await getDoc(genNodeRef);
      //         if (!genNodeDoc.exists()) {
      //           console.log("Generalization not found: ", generalization.id);
      //         } else {
      //           const genNodeData = genNodeDoc.data() as INode;
      //           /*         if (genNodeData.title !== generalization.title) {
      //             console.log(
      //               "Generalization title mismatch: ",
      //               genNodeData.title,
      //               generalization.title
      //             );
      //           } */
      //           if (genNodeData.specializations) {
      //             let specializationFound = false;
      //             for (let categ of Object.keys(nodeData.specializations)) {
      //               if (
      //                 genNodeData.specializations[categ]?.findIndex(
      //                   (speciali) => speciali.id === nodeData.id
      //                 ) !== -1
      //               ) {
      //                 specializationFound = true;
      //               }
      //             }
      //             if (!specializationFound) {
      //               console.log("Specialization not found: ", {
      //                 generalization: genNodeData.title,
      //                 node: nodeData.title,
      //               });
      //             }
      //           } else {
      //             console.log("Generalization has no specializations: ", {
      //               generalization: genNodeData.title,
      //               node: nodeData.title,
      //             });
      //           }
      //         }
      //       }
      //     }
      //   }
      //   if (nodeData.properties.parts) {
      //     for (let category of Object.keys(nodeData.properties.parts)) {
      //       for (let part of nodeData.properties.parts[category]) {
      //         const partNodeRef = doc(collection(db, NODES), part.id);
      //         const partNodeDoc = await getDoc(partNodeRef);
      //         if (!partNodeDoc.exists()) {
      //           console.log("Part not found: ", part.title);
      //         } else {
      //           const partNodeData = partNodeDoc.data() as INode;
      //           /*                 if (partNodeData.title !== part.title) {
      //             console.log(
      //               "Part title mismatch: ",
      //               partNodeData.title,
      //               part.title
      //             );
      //           } */
      //           if (partNodeData.properties.isPartOf) {
      //             let isPartOfFound = false;
      //             for (let categ of Object.keys(nodeData.properties.isPartOf)) {
      //               if (
      //                 partNodeData.properties.isPartOf[categ].findIndex(
      //                   (partOf: { id: string }) => partOf.id === nodeData.id
      //                 ) !== -1
      //               ) {
      //                 isPartOfFound = true;
      //               }
      //             }
      //             if (!isPartOfFound) {
      //               console.log("IsPartOf not found: ", {
      //                 part: partNodeData.title,
      //                 node: nodeData.title,
      //               });
      //             }
      //           } else {
      //             console.log("Part has no isPartOf: ", {
      //               part: partNodeData.title,
      //               node: nodeData.title,
      //             });
      //           }
      //         }
      //       }
      //     }
      //   }
      //   if (nodeData.properties.isPartOf) {
      //     for (let category of Object.keys(nodeData.properties.isPartOf)) {
      //       for (let isPartOf of nodeData.properties.isPartOf[category]) {
      //         const isPartOfNodeRef = doc(collection(db, NODES), isPartOf.id);
      //         const isPartOfNodeDoc = await getDoc(isPartOfNodeRef);
      //         if (!isPartOfNodeDoc.exists()) {
      //           console.log("IsPartOf not found: ", isPartOf.title);
      //         } else {
      //           const isPartOfNodeData = isPartOfNodeDoc.data() as INode;
      //           /*                 if (isPartOfNodeData.title !== isPartOf.title) {
      //             console.log(
      //               "IsPartOf title mismatch: ",
      //               isPartOfNodeData.title,
      //               isPartOf.title
      //             );
      //           } */
      //           if (isPartOfNodeData.properties.parts) {
      //             let partFound = false;
      //             for (let categ of Object.keys(nodeData.properties.parts)) {
      //               if (
      //                 isPartOfNodeData.properties.parts[categ].findIndex(
      //                   (part: { id: string }) => part.id === nodeData.id
      //                 ) !== -1
      //               ) {
      //                 partFound = true;
      //               }
      //             }
      //             if (!partFound) {
      //               console.log("Part not found: ", {
      //                 isPartOf: isPartOfNodeData.title,
      //                 node: nodeData.title,
      //               });
      //             }
      //           } else {
      //             console.log("IsPartOf has no parts: ", {
      //               isPartOf: isPartOfNodeData.title,
      //               node: nodeData.title,
      //             });
      //           }
      //         }
      //       }
      //     }
      //   }
      //   console.log("Node: ", i++);
      // }

      const data = querySnapshot.docs.map((doc) =>
        getStructureForJSON({
          ...doc.data(),
        } as INode)
      );

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "nodes-data.json";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // } catch (error) {
      //   console.error("Error downloading JSON: ", error);
      // }
    }, [db, user]);

    const viewProfileLogs = (e: any) => {
      const userName = e.currentTarget.id;
      displayUserLogs({
        uname: userName,
        imageUrl: usersNodesViews[userName].imageUrl,
        fullname: `${usersNodesViews[userName].fName} ${usersNodesViews[userName].lName}`,
      });
    };
    return (
      <>
        <Box
          ref={ref}
          sx={{
            background: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(0,0,0,.72)"
                : DESIGN_SYSTEM_COLORS.gray200,
            backdropFilter: "saturate(180%) blur(10px)",
            position: "sticky",
            top: "0",
            // zIndex: "22",
          }}
        >
          <Stack
            direction={"row"}
            justifyContent="space-between"
            alignItems="center"
            spacing={{ xs: "2px", sm: "8px", md: "16px" }}
            sx={{
              px: { xs: "16px", sm: "32px" },
              maxWidth: "100%",
              margin: "auto",
              height: {
                xs: `${HEADER_HEIGHT_MOBILE}px`,
                md: `${HEADER_HEIGHT}px`,
              },
            }}
          >
            <Stack direction={"row"} alignItems="center" spacing={"16px"}>
              <Avatar
                src={
                  theme.palette.mode === "dark" ? mitLogoDark.src : mitLogo.src
                }
                alt="logo"
                sx={{
                  cursor: "pointer",
                  width: "240px",
                  height: "auto",
                  borderRadius: 0,
                }}
              />
            </Stack>
            <Box sx={{ display: "flex", gap: "5px" }}>
              {Object.values(usersNodesViews).map((u: any) => (
                <Tooltip
                  key={`${u.fName} ${u.lName}`}
                  title={
                    <Box
                      sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        maxWidth: "300px",
                        whiteSpace: "normal",
                        p: 1,
                      }}
                    >
                      <strong
                        style={{ marginRight: "4px" }}
                      >{`${u.fName} ${u.lName}`}</strong>
                      {u.node.id && <div> {"last interacted with"}</div>}

                      {u.node.id && (
                        <Link
                          underline="hover"
                          onClick={() => navigateToNode(u.node.id)}
                          sx={{
                            cursor: "pointer",
                            mx: "5px",
                          }}
                        >
                          {" "}
                          {u.node.title}
                        </Link>
                      )}
                      {u.node.id && u.lastInteracted && (
                        <div>{timeAgo(u.lastInteracted)}</div>
                      )}
                    </Box>
                  }
                >
                  <Box
                    sx={{ position: "relative", display: "inline-block" }}
                    onClick={viewProfileLogs}
                    id={u.uname}
                  >
                    <OptimizedAvatar
                      alt={`${u.fName} ${u.lName}`}
                      imageUrl={u.imageUrl || ""}
                      size={40}
                      sx={{
                        width: "100%",
                        height: "100%",
                        borderRadius: "50%",
                        objectFit: "cover",
                        borderColor: "green",
                      }}
                    />
                  </Box>
                </Tooltip>
              ))}
            </Box>

            {!loading && (
              <Stack
                direction={"row"}
                justifyContent="flex-end"
                alignItems="center"
                spacing={"8px"}
              >
                <Tooltip title="Open Search Tab">
                  <IconButton onClick={handleSearch}>
                    <SearchIcon
                      color={
                        rightPanelVisible && sidebarView === 0
                          ? "primary"
                          : "inherit"
                      }
                    />
                  </IconButton>
                </Tooltip>

                <Tooltip title="Download JSON">
                  <IconButton onClick={() => handleDownload()}>
                    <DownloadIcon />
                  </IconButton>
                </Tooltip>

                <IconButton onClick={handleNotificationPopup}>
                  <>
                    {notifications.length > 0 && (
                      <Badge
                        sx={{ position: "absolute", right: 10, top: 10 }}
                        color="error"
                        badgeContent={notifications.length}
                      />
                    )}
                    <NotificationsIcon />
                  </>
                </IconButton>

                {/* <Tooltip
                  title={
                    rightPanelVisible ? "Hide Right Panel" : "Show Right Panel"
                  }
                >
                  <IconButton onClick={toggleRightPanel}>
                    <ViewSidebarIcon
                      color={rightPanelVisible ? "primary" : "inherit"}
                    />
                  </IconButton>
                </Tooltip> */}

                <Tooltip title="Change theme">
                  <IconButton onClick={handleThemeSwitch} size="small">
                    {theme.palette.mode === "dark" ? (
                      <LightModeIcon />
                    ) : (
                      <DarkModeIcon />
                    )}
                  </IconButton>
                </Tooltip>

                {isAuthenticated && user && (
                  <Tooltip
                    title={capitalizeString(
                      `${user.fName ?? ""} ${user.lName ?? ""}`
                    )}
                  >
                    <IconButton onClick={handleProfileMenuOpen}>
                      <Avatar
                        src={profileImage || user.imageUrl || NO_IMAGE_USER}
                      />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            )}
          </Stack>
          {isAuthenticated && user && renderProfileMenu}
        </Box>
      </>
    );
  }
);

AppHeader.displayName = "AppHeader";

const AppHeaderMemoized = React.memo(AppHeader);

export default AppHeaderMemoized;
