import {
  Box,
  Button,
  IconButton,
  Link,
  Theme,
  Tooltip,
  Typography,
} from "@mui/material";
import React from "react";
import LockIcon from "@mui/icons-material/Lock";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

const ManageNodeButtons = ({
  locked,
  root,
  manageLock,
  deleteNode,
  getTitleNode,
  handleLockNode,
  navigateToNode,
}: {
  locked: boolean;
  root: string;
  manageLock: boolean;
  deleteNode: any;
  getTitleNode: (nodeId: string) => string;
  handleLockNode: any;
  navigateToNode: any;
}) => {
  return (
    <Box sx={{ ml: "auto" }}>
      <Box
        sx={{
          display: "flex",
          mb: "5px",
          ml: "auto",
          alignItems: "center",
        }}
      >
        <Box
          sx={{
            display: "flex",
            px: "19px",
            mb: "15px",
            alignItems: "center",
            alignContent: "center",
          }}
        >
          {root && (
            <Box
              sx={{
                display: "flex",
                mt: "5px",
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
                : locked
                ? "This node is locked for everyone else"
                : "Lock this node"
            }
          >
            {manageLock ? (
              <IconButton
                onClick={handleLockNode}
                sx={{
                  borderRadius: "25px",
                  mx: "7px",
                  mb: "13px",
                }}
              >
                {locked ? (
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
                  mb: "13px",
                }}
              />
            ) : (
              <></>
            )}
          </Tooltip>
        )}

        {!locked && (
          <Button
            onClick={deleteNode}
            variant="contained"
            sx={{ borderRadius: "25px", mb: "7px" }}
          >
            {" "}
            Delete Node
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default ManageNodeButtons;
