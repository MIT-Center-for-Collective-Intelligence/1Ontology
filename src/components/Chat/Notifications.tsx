import { Paper, Typography, Tabs, Tab } from "@mui/material";
import { Box, keyframes } from "@mui/system";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useEffect, useState } from "react";
import OptimizedAvatar from "./OptimizedAvatar";
import { DESIGN_SYSTEM_COLORS } from "@components/lib/theme/colors";
import { INotification } from "@components/types/IChat";
import MarkdownRender from "../Markdown/MarkdownRender";
import { chatChange } from "@components/client/firestore/messages.firestore";
import { getNotificationsSnapshot } from "@components/client/firestore/notifications.firestore";
import { synchronizeStuff } from "@components/lib/utils/helpers";
import { getFirestore } from "firebase/firestore";
import { SCROLL_BAR_STYLE } from "@components/lib/CONSTANTS";

dayjs.extend(relativeTime);

const floatCard = keyframes`
  0%, 100% {
    transform: translateY(0px) scale(1);
  }
  50% {
    transform: translateY(-10px) scale(1.02);
  }
`;

const pulseDot = keyframes`
  0% {
    transform: scale(0.7);
    opacity: 0.95;
  }
  100% {
    transform: scale(1.35);
    opacity: 0;
  }
`;

const sweepGlow = keyframes`
  0% {
    transform: translateX(-120%);
    opacity: 0;
  }
  20% {
    opacity: 0.5;
  }
  100% {
    transform: translateX(130%);
    opacity: 0;
  }
`;

type CommentsProps = {
  user: any;
  notifications: INotification[];
  openNotification: (
    notificationId: string,
    messageId: string,
    type: string,
    nodeId?: string,
  ) => void;
};

const notificationTypes: { [key: string]: string } = {
  node: "Node",
  bug_report: "Bug Report",
  feature_request: "Feature Request",
  help: "Help",
};

export const Notifications = ({
  notifications,
  openNotification,
  user,
}: CommentsProps) => {
  const db = getFirestore();
  const [activeTab, setActiveTab] = useState<number>(0);
  const [readNotifications, setReadNotifications] = useState<any>([]);

  // const unreadNotifications = notifications.filter(
  //   (notification) => !notification.seen
  // );

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const displayNotifications =
    activeTab === 0 ? notifications : readNotifications;

  useEffect(() => {
    if (!user) return;
    const onSynchronize = (changes: chatChange[]) => {
      setReadNotifications((prev: any) =>
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
      { uname: user.uname, lastVisible: null, seen: true },
      onSynchronize,
    );
    return () => killSnapshot();
  }, [db, user]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        p: 2,
        ...SCROLL_BAR_STYLE,
      }}
    >
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        aria-label="notification tabs"
        variant="fullWidth"
        sx={{
          minHeight: 52,
          borderRadius: "999px",
          p: "6px",
          background: (theme) =>
            theme.palette.mode === "dark"
              ? "linear-gradient(180deg, rgba(30,30,30,0.95) 0%, rgba(16,16,16,0.98) 100%)"
              : "linear-gradient(180deg, #f4f4f4 0%, #ededed 100%)",
          border: (theme) =>
            theme.palette.mode === "dark"
              ? "1px solid rgba(255,255,255,0.09)"
              : "1px solid rgba(0,0,0,0.08)",
          boxShadow: (theme) =>
            theme.palette.mode === "dark"
              ? "inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 22px rgba(0,0,0,0.32)"
              : "inset 0 1px 0 rgba(255,255,255,0.9), 0 8px 20px rgba(0,0,0,0.08)",
          "& .MuiTabs-indicator": {
            display: "none",
          },
        }}
      >
        <Tab
          label={`Unread (${notifications.length})`}
          disableRipple
          sx={{
            minHeight: 40,
            borderRadius: "999px",
            fontSize: "0.95rem",
            fontWeight: 700,
            textTransform: "none",
            color: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(255,255,255,0.8)"
                : "rgba(0,0,0,0.7)",
            transition: "all 180ms ease",
            "&.Mui-selected": {
              color: (theme) =>
                theme.palette.mode === "dark" ? "#ffffff" : "#111111",
              background: (theme) =>
                theme.palette.mode === "dark"
                  ? "linear-gradient(180deg, rgba(38,38,38,1) 0%, rgba(20,20,20,1) 100%)"
                  : "linear-gradient(180deg, #ffffff 0%, #f6f6f6 100%)",
              border: "1px solid rgba(255, 145, 77, 0.55)",
              boxShadow:
                "0 0 0 1px rgba(255, 145, 77, 0.22), 0 0 22px rgba(255, 145, 77, 0.28), inset 0 1px 0 rgba(255,255,255,0.18)",
            },
            "&:not(.Mui-selected):hover": {
              color: (theme) =>
                theme.palette.mode === "dark" ? "#f3f3f3" : "#222222",
              background: (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(255,255,255,0.05)"
                  : "rgba(0,0,0,0.04)",
            },
          }}
        />
        <Tab
          label={`Read`}
          disableRipple
          sx={{
            minHeight: 40,
            borderRadius: "999px",
            fontSize: "0.95rem",
            fontWeight: 700,
            textTransform: "none",
            color: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(255,255,255,0.8)"
                : "rgba(0,0,0,0.7)",
            transition: "all 180ms ease",
            "&.Mui-selected": {
              color: (theme) =>
                theme.palette.mode === "dark" ? "#ffffff" : "#111111",
              background: (theme) =>
                theme.palette.mode === "dark"
                  ? "linear-gradient(180deg, rgba(38,38,38,1) 0%, rgba(20,20,20,1) 100%)"
                  : "linear-gradient(180deg, #ffffff 0%, #f6f6f6 100%)",
              border: "1px solid rgba(255, 145, 77, 0.55)",
              boxShadow:
                "0 0 0 1px rgba(255, 145, 77, 0.22), 0 0 22px rgba(255, 145, 77, 0.28), inset 0 1px 0 rgba(255,255,255,0.18)",
            },
            "&:not(.Mui-selected):hover": {
              color: (theme) =>
                theme.palette.mode === "dark" ? "#f3f3f3" : "#222222",
              background: (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(255,255,255,0.05)"
                  : "rgba(0,0,0,0.04)",
            },
          }}
        />
      </Tabs>
      <Box
        sx={{
          overflow: "auto",
          flex: 1,
          mt: 2,
          "&::-webkit-scrollbar": {
            display: "none",
          },
        }}
      >
        {!displayNotifications.length && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "70%",
              px: 2,
            }}
          >
            <Box
              sx={{
                position: "relative",
                width: { xs: 250, sm: 300 },
                height: { xs: 180, sm: 220 },
                borderRadius: "20px",
                border: "1px solid rgba(255, 145, 77, 0.45)",
                background: (theme) =>
                  theme.palette.mode === "dark"
                    ? "radial-gradient(circle at top, rgba(255,145,77,0.2), rgba(22,22,22,0.88) 55%)"
                    : "radial-gradient(circle at top, rgba(255,145,77,0.18), rgba(255,255,255,0.98) 58%)",
                overflow: "hidden",
                boxShadow:
                  "0 0 0 1px rgba(255,145,77,0.12), 0 10px 30px rgba(255,145,77,0.18)",
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(120deg, transparent 20%, rgba(255,255,255,0.16) 40%, transparent 62%)",
                  animation: `${sweepGlow} 3.2s ease-in-out infinite`,
                }}
              />
              {[0, 1].map((idx) => (
                <Box
                  key={idx}
                  sx={{
                    position: "absolute",
                    left: { xs: 28, sm: 36 },
                    right: { xs: 28, sm: 36 },
                    top: idx === 0 ? { xs: 44, sm: 52 } : { xs: 98, sm: 118 },
                    height: { xs: 42, sm: 48 },
                    borderRadius: "12px",
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: (theme) =>
                      theme.palette.mode === "dark"
                        ? "linear-gradient(180deg, rgba(60,60,60,0.95), rgba(34,34,34,0.95))"
                        : "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(249,249,249,0.98))",
                    boxShadow: "0 8px 16px rgba(0,0,0,0.16)",
                    animation: `${floatCard} 2.6s ease-in-out ${idx * 0.45}s infinite`,
                    display: "flex",
                    alignItems: "center",
                    px: 1.5,
                    gap: 1,
                  }}
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      bgcolor: "#ff914d",
                    }}
                  />
                  <Box
                    sx={{
                      height: 7,
                      borderRadius: "999px",
                      flex: 1,
                      background: (theme) =>
                        theme.palette.mode === "dark"
                          ? "rgba(255,255,255,0.22)"
                          : "rgba(0,0,0,0.16)",
                    }}
                  />
                  <Box
                    sx={{
                      position: "relative",
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      bgcolor: "#ff914d",
                    }}
                  >
                    <Box
                      sx={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: "50%",
                        border: "1px solid rgba(255,145,77,0.9)",
                        animation: `${pulseDot} 1.8s ease-out infinite`,
                      }}
                    />
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        )}
        {displayNotifications.map(
          (notification: INotification, idx: number) => (
            <Paper
              key={notification.id || idx}
              className="direct-channel"
              onClick={() =>
                openNotification(
                  notification.id,
                  notification.entityId,
                  notification.type,
                  notification.nodeId,
                )
              }
              elevation={3}
              sx={{
                position: "relative",
                display: "flex",
                alignItems: "flex-start",
                gap: 1.5,
                p: { xs: "12px", sm: "14px" },
                borderRadius: "14px",
                border: "1px solid",
                borderColor: (theme) =>
                  theme.palette.mode === "light"
                    ? "rgba(0,0,0,0.08)"
                    : "rgba(255,255,255,0.08)",
                boxShadow: (theme) =>
                  theme.palette.mode === "light"
                    ? "0 8px 24px rgba(0, 0, 0, 0.08)"
                    : "0 8px 20px rgba(0,0,0,0.28)",
                background: (theme) =>
                  theme.palette.mode === "dark"
                    ? "linear-gradient(180deg, rgba(43,43,43,0.95) 0%, rgba(30,30,30,0.96) 100%)"
                    : "linear-gradient(180deg, #ffffff 0%, #fbfbfb 100%)",
                mb: "8px",
                cursor: "pointer",
                overflow: "hidden",
                transition:
                  "transform 160ms ease, box-shadow 180ms ease, border-color 180ms ease",
                "&::before": {
                  content: '""',
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: "4px",
                  borderRadius: "6px",
                  bgcolor: DESIGN_SYSTEM_COLORS.orange400,
                  opacity: notification.seen ? 0.45 : 1,
                },
                "&:hover": {
                  transform: "translateY(-1px)",
                  borderColor: "rgba(255,145,77,0.5)",
                  boxShadow:
                    "0 0 0 1px rgba(255,145,77,0.18), 0 12px 26px rgba(255,145,77,0.2)",
                },
                "&:active": {
                  transform: "translateY(0px)",
                },
                "&:focus-visible": {
                  outline: "2px solid rgba(255,145,77,0.7)",
                  outlineOffset: "2px",
                },
                "& .notification-body p": {
                  m: 0,
                },
                "& .notification-body": {
                  mt: 0.75,
                  color: (theme) =>
                    theme.palette.mode === "dark"
                      ? "rgba(255,255,255,0.72)"
                      : "rgba(0,0,0,0.7)",
                },
                "& .notification-body *": {
                  fontSize: "0.86rem",
                  lineHeight: 1.45,
                },
                "& .notification-body > *": {
                  display: "-webkit-box",
                  WebkitLineClamp: "2",
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                },
                "&:hover .notification-open-text": {
                  opacity: 1,
                  transform: "translateX(0px)",
                },
              }}
            >
              <Box
                sx={{
                  mt: "2px",
                  width: "42px",
                  height: "42px",
                  flexShrink: 0,
                  borderRadius: "50%",
                  border: (theme) =>
                    theme.palette.mode === "dark"
                      ? "1px solid rgba(255,255,255,0.16)"
                      : "1px solid rgba(0,0,0,0.09)",
                  p: "2px",
                }}
              >
                <OptimizedAvatar
                  alt={notification.senderDetail?.fullname || ""}
                  imageUrl={notification.senderDetail?.imageUrl}
                  size={38}
                  sx={{ border: "none" }}
                />
              </Box>
              <Box sx={{ width: "100%", minWidth: 0 }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 1,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: "0.93rem",
                      fontWeight: 700,
                      lineHeight: 1.35,
                      color: (theme) =>
                        theme.palette.mode === "dark"
                          ? "rgba(255,255,255,0.94)"
                          : "rgba(20,20,20,0.95)",
                      display: "-webkit-box",
                      WebkitLineClamp: "2",
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {notification.title}
                  </Typography>
                  <Typography
                    sx={{
                      flexShrink: 0,
                      fontSize: "11px",
                      fontWeight: 700,
                      letterSpacing: "0.02em",
                      lineHeight: "18px",
                      px: 1,
                      borderRadius: "999px",
                      bgcolor: (theme) =>
                        theme.palette.mode === "dark"
                          ? "rgba(255,145,77,0.18)"
                          : "rgba(255,145,77,0.15)",
                      color: DESIGN_SYSTEM_COLORS.orange500,
                    }}
                  >
                    {dayjs(notification.createdAt?.toDate())
                      .fromNow()
                      .includes("NaN")
                      ? "just now"
                      : dayjs(notification.createdAt?.toDate()).fromNow()}
                  </Typography>
                </Box>
                <Box className="notification-body">
                  <MarkdownRender text={notification.body} />
                </Box>
                <Box
                  sx={{
                    mt: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      px: 1,
                      py: 0.4,
                      borderRadius: "999px",
                      bgcolor: (theme) =>
                        theme.palette.mode === "dark"
                          ? "rgba(255,255,255,0.09)"
                          : "rgba(0,0,0,0.06)",
                      color: (theme) =>
                        theme.palette.mode === "dark"
                          ? "rgba(255,255,255,0.72)"
                          : "rgba(0,0,0,0.66)",
                    }}
                  >
                    {notificationTypes[notification.type]}
                  </Typography>
                  <Typography
                    className="notification-open-text"
                    sx={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: DESIGN_SYSTEM_COLORS.orange400,
                      opacity: 0.72,
                      transform: "translateX(-4px)",
                      transition: "all 180ms ease",
                    }}
                  >
                    Open
                  </Typography>
                </Box>
              </Box>
            </Paper>
          ),
        )}
        <Box sx={{ mb: "300px" }} />
      </Box>
    </Box>
  );
};
