import { isOnline, timeAgo } from "@components/lib/utils/string.utils";
import {
  Badge,
  Box,
  Button,
  Link,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import React from "react";
import OptimizedAvatar from "../Chat/OptimizedAvatar";
import { SCROLL_BAR_STYLE } from "@components/lib/CONSTANTS";

const ActiveUsers = ({
  nodes,
  displayUserLogs,
  navigateToNode,
  handleExpand,
  fullVersion,
  activeUsers,
  currentUser,
}: {
  nodes: any;
  displayUserLogs: any;
  navigateToNode: any;
  handleExpand: any;
  fullVersion: any;
  activeUsers: any;
  currentUser: any;
}) => {
  const theme = useTheme();

  const viewProfileLogs = (e: any) => {
    const userName = e.currentTarget.id;
    displayUserLogs({
      uname: userName,
      imageUrl: activeUsers[userName].imageUrl,
      fullname: `${activeUsers[userName].fName} ${activeUsers[userName].lName}`,
      fName: activeUsers[userName].fName,
    });
    handleExpand("userActivity");
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        overflow: "auto",
        mt: "7px",
        overflowX: "hidden",
        ...SCROLL_BAR_STYLE,
        "&::-webkit-scrollbar": {
          display: "none",
        },
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      {Object.values(activeUsers)
        .sort((a: any, b: any) => {
          if (!a.lasChangeMadeAt) return 1;
          if (!b.lasChangeMadeAt) return -1;
          return (
            new Date(b.lasChangeMadeAt.toDate()).getTime() -
            new Date(a.lasChangeMadeAt.toDate()).getTime()
          );
        })
        .map((u: any) => (
          <Tooltip
            key={`${u.fName} ${u.lName}`}
            placement="left"
            title={
              <Box
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  whiteSpace: "normal",
                  p: 1,
                }}
              >
                <strong
                  style={{ marginRight: "4px" }}
                >{`${u.fName} ${u.lName}`}</strong>
                {u.node.id && u.node.title && (
                  <div> {"last interacted with"}</div>
                )}
                {u.node.id && u.node.title && (
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
                {u.node.id && u.lastInteracted && u.node.title && (
                  <div>{timeAgo(u.lastInteracted)}</div>
                )}
              </Box>
            }
          >
            <Button
              sx={{
                display: "flex",
                justifyContent: fullVersion ? "flex-start" : "center",
                gap: "10px",
                minWidth: "0px",
                borderRadius: "16px",
                ":hover": {
                  backgroundColor: (theme) =>
                    theme.palette.mode === "dark" ? "#55402B" : "#FFE2D0",
                },
              }}
              id={u.uname}
              onClick={viewProfileLogs}
            >
              <Box sx={{ position: "relative" }}>
                <Badge
                  color="success"
                  badgeContent={
                    /* shortenNumber(u.reputations, 2, false) */ null
                  }
                  sx={{
                    "& .MuiBadge-badge": {
                      right: -1,
                      top: 25,
                      border: `4px solid ${theme.palette.background.paper}`,
                      padding: "0 4px",
                      display: u.reputations === 0 ? "none" : "",
                    },
                  }}
                >
                  <OptimizedAvatar
                    alt={`${u.fName} ${u.lName}`}
                    imageUrl={u.imageUrl || ""}
                    size={30}
                    sx={{
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                      objectFit: "cover",
                    }}
                    online={
                      (currentUser?.uname &&
                        u.uname &&
                        currentUser.uname === u.uname) ||
                      isOnline(u.lastInteracted)
                    }
                  />
                </Badge>
              </Box>

              {fullVersion && (
                <Box
                  sx={{
                    position: "relative",
                    display: "flex",
                    mb: "3px",
                    flexDirection: "column",
                  }}
                >
                  <Typography
                    sx={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      display: "inline-block",
                      fontSize: "13px",
                    }}
                  >
                    {`${u.fName} ${u.lName}`}
                  </Typography>
                </Box>
              )}
            </Button>
          </Tooltip>
        ))}
    </Box>
  );
};

export default ActiveUsers;
