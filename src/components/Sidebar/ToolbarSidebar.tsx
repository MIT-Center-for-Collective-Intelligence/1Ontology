import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Button,
  IconButton, // Changed from IconButton to Button
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import mitLogoLight from "../../../public/MIT-Logo-Small-Light.png";
import mitLogoDark from "../../../public/MIT-Logo-small-Dark.png";
import mitLogoLightLong from "../../../public/CCI-logo.gif";
import mitLogoDarkLong from "../../../public/MIT-Logo-Dark.png";

import SearchIcon from "@mui/icons-material/Search";
import NotificationsIcon from "@mui/icons-material/Notifications";
import DownloadIcon from "@mui/icons-material/Download";
import OptimizedAvatar from "../Chat/OptimizedAvatar";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import useThemeChange from " @components/lib/hooks/useThemeChange";
import { DESIGN_SYSTEM_COLORS } from " @components/lib/theme/colors";
import ClearIcon from "@mui/icons-material/Clear";
import { Notification } from " @components/components/Chat/Notification";
import { chatChange } from " @components/client/firestore/messages.firestore";
import { INotification } from " @components/types/IChat";
import { synchronizeStuff } from " @components/lib/utils/helpers";
import { getNotificationsSnapshot } from " @components/client/firestore/notifications.firestore";
import { doc, getFirestore, updateDoc } from "firebase/firestore";
import SearchSideBar from "../SearchSideBar/SearchSideBar";
import ActiveUsers from "../ActiveUsers/ActiveUsers";
import UserActivity from "../ActiveUsers/UserActivity";
import ChatSideBar from "../ChatSideBar/ChatSideBar";
import Inheritance from "../Inheritance/Inheritance";
import { SidebarButton } from "../SideBarButton/SidebarButton";
import { Box, SxProps, Theme } from "@mui/material";

type MainSidebarProps = {
  toolbarRef: any;
  user: any;
  openSearchedNode: any;
  searchWithFuse: any;
  nodes: any;
  selectedDiffNode: any;
  setSelectedDiffNode: any;
  currentVisibleNode: any;
  setCurrentVisibleNode: any;
  confirmIt: any;
  recordLogs: any;
  activeSidebar: any;
  setActiveSidebar: any;
  handleExpandSidebar: any;
  navigateToNode: any;
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
  recordLogs,
  activeSidebar,
  setActiveSidebar,
  handleExpandSidebar,
  navigateToNode,
}: MainSidebarProps) => {
  const theme = useTheme();
  const db = getFirestore();

  const [handleThemeSwitch] = useThemeChange();
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const [openLogsFor, setOpenLogsFor] = useState<{
    uname: string;
    imageUrl: string;
    fullname: string;
  } | null>(null);
  const [hovered, setHovered] = useState(false); // Hover state for sidebar

  useEffect(() => {
    if (!user) return;
    setNotifications([]);
    const onSynchronize = (changes: chatChange[]) => {
      setNotifications((prev) => changes.reduce(synchronizeStuff, [...prev]));
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
      setTimeout(
        () => {
          const element = document.getElementById(`message-${messageId}`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            element.style.border = `solid 1px ${DESIGN_SYSTEM_COLORS.orange400}`;
            setTimeout(() => {
              element.style.border = "none";
            }, 1000);
          }
        },
        type === "node" ? 2000 : 1000
      );
    },
    [db, user]
  );

  const displayUserLogs = useCallback(
    (user: { uname: string; imageUrl: string; fullname: string }) => {
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

  const renderContent = () => {
    switch (activeSidebar) {
      case "notifications":
        return (
          <Notification
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
          />
        );
      case "userActivity":
        return (
          <UserActivity
            openLogsFor={openLogsFor}
            setSelectedDiffNode={setSelectedDiffNode}
            currentVisibleNode={currentVisibleNode}
            setCurrentVisibleNode={setCurrentVisibleNode}
            nodes={nodes}
          />
        );
      case "chat":
        return (
          <ChatSideBar
            currentVisibleNode={currentVisibleNode}
            user={user}
            confirmIt={confirmIt}
            recordLogs={recordLogs}
            searchWithFuse={searchWithFuse}
          />
        );
      case "inheritanceSettings":
        return <Inheritance selectedNode={currentVisibleNode} nodes={nodes} />;
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

  return (
    <Box
      ref={toolbarRef}
      sx={{
        width: hovered ? "190px" : !!activeSidebar ? "450px" : "70px",
        transition: "width 0.3s ease",
        height: "100vh",
        background:
          theme.palette.mode === "dark"
            ? "rgba(0,0,0,.72)"
            : DESIGN_SYSTEM_COLORS.gray200,
        backdropFilter: "saturate(180%) blur(10px)",
        display: "flex",
        flexDirection: "column",
        padding: "10px",
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
              justifyContent: "flex-end", // Aligns the icon to the right
              mb: 2,
            }}
          >
            <IconButton
              onClick={() => {
                setActiveSidebar(null);
                setSelectedDiffNode(null);
              }}
            >
              <ClearIcon />
            </IconButton>
          </Box>
          {renderContent()}
        </Box>
      ) : (
        <>
          <Box sx={{ mb: 2, mr: "10px" }}>
            <Avatar
              src={getLog}
              alt="logo"
              sx={{
                cursor: "pointer",
                width: hovered ? "140px" : "50px",
                height: "auto",
                borderRadius: 0,
              }}
            />
          </Box>

          {/* Button for Avatar and Full Name */}
          <Box sx={{ display: "flex", alignItems: "center", ml: "9px" }}>
            <Button
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                padding: 0,
                textTransform: "none",
                minWidth: 0, // removes default button padding
              }}
            >
              {user && (
                <OptimizedAvatar
                  alt={`${user?.fName} ${user?.lName}`}
                  imageUrl={user?.imageUrl || ""}
                  size={40}
                  sx={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    objectFit: "cover",
                    borderColor: "green",
                  }}
                />
              )}

              {/* Show Full Name when hovered */}
            </Button>
            {hovered && user && (
              <Typography sx={{ ml: 2 }}>
                {`${user?.fName} ${user?.lName}`}
              </Typography>
            )}
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
              rightOption={<CustomBadge value={0} />}
              rightFloatingOption={<CustomSmallBadge value={0} />}
            />
            <SidebarButton
              id="toolbar-search-button"
              icon={<SearchIcon />}
              onClick={() => {
                handleExpandSidebar("search");
              }}
              text="Search"
              toolbarIsOpen={hovered}
            />
            <SidebarButton
              id="toolbar-download-button"
              icon={<DownloadIcon />}
              onClick={() => {}}
              text="Download"
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
          <Box sx={{ mt: "14px", ml: "14px" }}>
            <ActiveUsers
              nodes={nodes}
              navigateToNode={navigateToNode}
              displayUserLogs={displayUserLogs}
              handleExpand={handleExpandSidebar}
              fullVersion={hovered}
            />
          </Box>
        </>
      )}
    </Box>
  );
};

export const MemoizedToolbarSidebar = React.memo(ToolbarSidebar);
