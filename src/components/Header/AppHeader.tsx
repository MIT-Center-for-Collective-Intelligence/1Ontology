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
import {
  Avatar,
  Button,
  CircularProgress,
  LinearProgress,
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
import {
  addSuffixToUrlGMT,
  capitalizeString,
  timeAgo,
} from "../../lib/utils/string.utils";
import useThemeChange from " @components/lib/hooks/useThemeChange";
import { DESIGN_SYSTEM_COLORS } from " @components/lib/theme/colors";
import ROUTES from " @components/lib/utils/routes";
import { useAuth } from "../context/AuthContext";
import {
  Timestamp,
  collection,
  doc,
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
  setSidebarView: any;
};
const AppHeader = forwardRef(
  (
    {
      setRightPanelVisible,
      rightPanelVisible,
      loading,
      confirmIt,
      setSidebarView,
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
      // Calculate the timestamp for 10 minutes ago
      const tenMinutesAgo = Timestamp.fromMillis(
        new Date().getTime() - 10 * 60 * 1000
      );

      // Use a query with a where clause to filter users who interacted within the last 10 minutes
      const usersQuery = query(
        collection(db, "users"),
        where("lastInteracted", ">=", tenMinutesAgo)
      );

      const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
        setUsersNodesViews((prevUsersNodesViews: any) => {
          const updatedUsersData = { ...prevUsersNodesViews };

          snapshot.docChanges().forEach((change) => {
            const doc = change.doc;
            const userId = doc.id;
            const data = doc.data();
            const ontologyPath = data.ontologyPath;

            if (
              (change.type === "added" || change.type === "modified") &&
              ontologyPath
            ) {
              updatedUsersData[userId] = {
                node: ontologyPath.at(-1),
                imageUrl: data.imageUrl,
                fName: data.fName,
                lName: data.lName,
                lastInteracted: timeAgo(data.lastInteracted),
              };
            } else if (change.type === "removed") {
              delete updatedUsersData[userId];
            }
          });

          return updatedUsersData;
        });
      });

      return () => unsubscribe();
    }, []);

    console.log(usersNodesViews, "usersNodesViews");

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
            {capitalizeString(user.fName ?? "")}
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
        ...properties,
      };
    };

    const handleDownload = useCallback(async () => {
      try {
        const nodesCollection = query(
          collection(db, NODES),
          where("deleted", "==", false)
        );
        const querySnapshot = await getDocs(nodesCollection);

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
      } catch (error) {
        console.error("Error downloading JSON: ", error);
      }
    }, [db, user]);

    const displayInheritanceSettings = () => {
      setRightPanelVisible(true);
      setSidebarView(2);
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
            <Box sx={{ display: "flex" }}>
              {Object.values(usersNodesViews).map((c: any) => (
                <Tooltip
                  key={`${c.fName} ${c.lName}`}
                  title={
                    <Box>
                      <strong>{`${c.fName} ${c.lName}`}</strong>{" "}
                      {`viewed ${c.node.title} ${c.lastInteracted}`}
                    </Box>
                  }
                >
                  <Box>
                    <OptimizedAvatar
                      alt={`${c.fName} ${c.lName}`}
                      imageUrl={c.imageUrl || ""}
                      size={30}
                      sx={{ border: "none" }}
                    />
                    <Box
                      sx={{ background: "#12B76A", fontSize: "1px" }}
                      className="UserStatusOnlineIcon"
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
                <Button onClick={displayInheritanceSettings} variant="outlined">
                  Manage inheritance
                </Button>
                <Button onClick={() => handleDownload()} variant="outlined">
                  Download as JSON
                </Button>
                <Button
                  onClick={toggleRightPanel}
                  variant={rightPanelVisible ? "contained" : "outlined"}
                >
                  {rightPanelVisible ? "Hide Right Panel" : "Show Right Panel"}
                </Button>
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
                  <Tooltip title={capitalizeString(user.fName ?? "")}>
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
