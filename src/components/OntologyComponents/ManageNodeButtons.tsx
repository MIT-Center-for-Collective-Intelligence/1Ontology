import {
  Box,
  Button,
  IconButton,
  Link,
  Switch,
  Theme,
  ToggleButton,
  Tooltip,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import EditOffIcon from "@mui/icons-material/EditOff";
import React from "react";
import LockIcon from "@mui/icons-material/Lock";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import ChatIcon from "@mui/icons-material/Chat";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import DeleteIcon from "@mui/icons-material/Delete";
import HistoryIcon from "@mui/icons-material/History";
import { getTooltipHelper } from "@components/lib/utils/string.utils";
import { collection, doc, getFirestore, updateDoc } from "firebase/firestore";
import { db } from "@components/lib/firestoreServer/admin-exp";

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
  enableEdit,
  setEnableEdit,
  user,
  handleCloseAddLinksModel,
  aiPeer,
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
  enableEdit: any;
  setEnableEdit: any;
  user: any;
  handleCloseAddLinksModel: any;
  aiPeer: { on: boolean; waiting: boolean };
}) => {
  const db = getFirestore();
  const displayNodeChat = () => displaySidebar("chat");
  const displayNodeHistory = () => displaySidebar("nodeHistory");
  const displayInheritanceSettings = () =>
    displaySidebar("inheritanceSettings");

  const nextCall = () => {
    const userRef = doc(collection(db, "aiPeerLogs"), "1man");
    updateDoc(userRef, { waitingAIPeer: false });
  };
  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
        }}
      >
        {/* <Box
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
              <Tooltip title={getTooltipHelper("root")}>
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
              </Tooltip>
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
        </Box> */}{" "}
        {aiPeer.on && (
          <>
            <Tooltip
              title="The previous proposals has been implemented. Would you like to
              continue?"
            >
              <Button
                variant="outlined"
                disabled={!aiPeer.waiting}
                sx={{ borderRadius: "25px" }}
                onClick={nextCall}
              >
                Continue AI-Peer
              </Button>
            </Tooltip>
          </>
        )}
        {user?.claims.editAccess && (
          <ToggleButton
            value="edit"
            selected={enableEdit}
            onChange={() => {
              setEnableEdit((prev: boolean) => !prev);
              handleCloseAddLinksModel();
            }}
            aria-label="Toggle edit mode"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              borderRadius: "25px",
              px: 2.5,
              py: 0.2,
              fontWeight: 500,
              fontSize: "0.95rem",
              textTransform: "none",
              border: "1.5px solid orange",
              transition: "all 0.2s ease-in-out",
              bgcolor: (theme) =>
                theme.palette.mode === "dark" ? "#2b2b2b" : "#f5f5f5",
              color: (theme) =>
                theme.palette.mode === "dark" ? "#f5f5f5" : "#222",
              "&:hover": {
                bgcolor: (theme) =>
                  theme.palette.mode === "dark" ? "#3a3a3a" : "#f0e6e6",
              },
              "&.Mui-selected": {
                bgcolor: "orange",
                color: "#fff",
                "&:hover": {
                  bgcolor: "#d17b00",
                },
              },
            }}
          >
            {enableEdit ? (
              <EditIcon fontSize="small" />
            ) : (
              <EditOffIcon fontSize="small" />
            )}
            Edit Node {enableEdit ? "On" : "Off"}
          </ToggleButton>
        )}
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
