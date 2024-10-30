import {
  Box,
  IconButton,
  Link,
  Theme,
  Tooltip,
  Typography,
} from "@mui/material";
import React from "react";
import LockIcon from "@mui/icons-material/Lock";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import ChatIcon from "@mui/icons-material/Chat";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import DeleteIcon from "@mui/icons-material/Delete";
import HistoryIcon from "@mui/icons-material/History";

const ManageNodeButtons = ({
  locked,
  lockedInductor,
  root,
  manageLock,
  deleteNode,
  getTitleNode,
  handleLockNode,
  navigateToNode,
  displaySidebar,
  activeSidebar,
  unclassified,
}: {
  locked: boolean;
  lockedInductor: boolean;
  root: string;
  manageLock: boolean;
  deleteNode: Function;
  getTitleNode: (nodeId: string) => string;
  handleLockNode: Function;
  navigateToNode: Function;
  displaySidebar: Function;
  activeSidebar: string;
  unclassified: boolean;
}) => {
  const displayNodeChat = () => displaySidebar("chat");
  const displayNodeHistory = () => displaySidebar("nodeHistory");
  const displayInheritanceSettings = () =>
    displaySidebar("inheritanceSettings");

  return (
    <Box sx={{ ml: "auto" }}>
      <Box
        sx={{
          display: "flex",
          ml: "auto",
          alignItems: "center",
          gap: "5px",
        }}
      >
        <Box
          sx={{
            display: "flex",
            px: "19px",
            alignItems: "center",
            alignContent: "center",
          }}
        >
          {root && (
            <Box
              sx={{
                display: "flex",
                gap: "15px",
              }}
            >
              <Typography
                sx={{
                  fontSize: "19px",
                  fontWeight: "bold",
                  color: (theme: Theme) =>
                    theme.palette.mode === "dark"
                      ? theme.palette.common.gray50
                      : theme.palette.common.notebookMainBlack,
                }}
              >
                Root:
              </Typography>
              <Link
                underline="hover"
                onClick={() => navigateToNode(root)}
                sx={{
                  cursor: "pointer",
                  textDecoration: "underline",
                  color: "orange",
                }}
              >
                {getTitleNode(root)}
              </Link>
            </Box>
          )}
        </Box>
        {(locked || manageLock) && (
          <Tooltip
            title={
              !manageLock
                ? "This node is locked"
                : lockedInductor
                ? "This node is locked for everyone else"
                : "Lock this node"
            }
          >
            {manageLock ? (
              <IconButton
                onClick={() => handleLockNode()}
                sx={{
                  borderRadius: "18px",
                  mx: "7px",
                }}
              >
                {lockedInductor ? (
                  <LockIcon
                    sx={{
                      color: "orange",
                    }}
                  />
                ) : (
                  <LockOutlinedIcon
                    sx={{
                      color: "orange",
                    }}
                  />
                )}
              </IconButton>
            ) : locked ? (
              <LockIcon
                sx={{
                  color: "orange",
                }}
              />
            ) : (
              <></>
            )}
          </Tooltip>
        )}
        {!locked && (
          <Tooltip title="Manage Inheritance">
            <IconButton onClick={displayInheritanceSettings}>
              <AccountTreeIcon
                color={
                  activeSidebar === "inheritanceSettings"
                    ? "primary"
                    : "inherit"
                }
              />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Open Node Comments">
          <IconButton onClick={displayNodeChat}>
            <ChatIcon
              color={activeSidebar === "chat" ? "primary" : "inherit"}
            />
          </IconButton>
        </Tooltip>
        <Tooltip title="View Node's History">
          <IconButton onClick={displayNodeHistory}>
            <HistoryIcon
              color={activeSidebar === "nodeHistory" ? "primary" : "inherit"}
            />
          </IconButton>
        </Tooltip>

        {!locked && !unclassified && (
          <Tooltip title="Delete Node">
            <IconButton onClick={() => deleteNode()}>
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
};

export default ManageNodeButtons;
