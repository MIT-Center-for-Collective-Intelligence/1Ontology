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
import React, { useMemo } from "react";
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
  const userList = useMemo(() => {
    return Object.values(activeUsers)
      .sort((a: any, b: any) => {
        if (!a.lasChangeMadeAt) return 1;
        if (!b.lasChangeMadeAt) return -1;
        return (
          new Date(b.lasChangeMadeAt.toDate()).getTime() -
          new Date(a.lasChangeMadeAt.toDate()).getTime()
        );
      })
      .filter((c: any) => c.uname !== "gemini" && c.uname !== "gpt4o")
      .map((u: any) => {
        const isCurrent =
          currentUser?.uname && u.uname && currentUser.uname === u.uname;
        const online = isCurrent || isOnline(u.lastInteracted);
        return {
          ...u,
          online,
        };
      });
  }, [activeUsers]);

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
      {userList.map((u: any) => (
        <Tooltip
          key={`${u.uname}`}
          placement="left"
          slotProps={{
            tooltip: {
              sx: {
                maxWidth: "none",
                bgcolor: "background.paper",
                color: "text.primary",
                boxShadow: (theme) =>
                  theme.palette.mode === "dark"
                    ? "0 8px 32px rgba(0,0,0,0.5)"
                    : "0 8px 32px rgba(0,0,0,0.12)",
                border: (theme) =>
                  `1px solid ${
                    theme.palette.mode === "dark"
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(0,0,0,0.06)"
                  }`,
                borderRadius: "16px",
                p: 0,
              },
            },
          }}
          title={
            <Box
              sx={{
                p: 2,
                minWidth: "240px",
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <OptimizedAvatar
                  alt={`${u.fName} ${u.lName}`}
                  imageUrl={u.imageUrl || ""}
                  size={44}
                  sx={{
                    borderRadius: "12px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  }}
                />
                <Box sx={{ display: "flex", flexDirection: "column" }}>
                  <Typography
                    sx={{
                      fontWeight: 700,
                      fontSize: "16px",
                      lineHeight: 1.2,
                    }}
                  >{`${u.fName} ${u.lName}`}</Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Box
                      sx={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        bgcolor: u.online ? "#4caf50" : "#bdbdbd",
                        boxShadow: u.online
                          ? "0 0 8px rgba(76, 175, 80, 0.5)"
                          : "none",
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{ color: "text.secondary", fontWeight: 500 }}
                    >
                      {u.online ? "Online" : "Away"}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {u.node.id && u.node.title && (
                <Box
                  sx={{
                    p: 2,
                    bgcolor: (theme) =>
                      theme.palette.mode === "dark"
                        ? "rgba(255,255,255,0.03)"
                        : "rgba(0,0,0,0.02)",
                    borderRadius: "12px",
                    display: "flex",
                    gap: 2,
                    alignItems: "center",
                    border: (theme) =>
                      `1px solid ${
                        theme.palette.mode === "dark"
                          ? "rgba(255,255,255,0.05)"
                          : "rgba(0,0,0,0.04)"
                      }`,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      letterSpacing: "0.5px",
                      fontSize: "15px",
                      fontWeight: 700,
                    }}
                  >
                    Last interacted with
                  </Typography>
                  <Link
                    underline="none"
                    onClick={() => navigateToNode(u.node.id)}
                    sx={{
                      cursor: "pointer",
                      color: "primary.main",
                      fontSize: "13px",
                      fontWeight: 600,
                      display: "block",
                      maxWidth: "280px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      "&:hover": {
                        color: "primary.dark",
                      },
                    }}
                  >
                    {u.node.title}
                  </Link>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      fontSize: "11px",
                    }}
                  >
                    {timeAgo(u.lastInteracted)}
                  </Typography>
                </Box>
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
                badgeContent={/* shortenNumber(u.reputations, 2, false) */ null}
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
                  online={u.online}
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
