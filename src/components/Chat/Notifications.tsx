import { Paper, Typography, Tabs, Tab } from "@mui/material";
import { Box } from "@mui/system";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useEffect, useState } from "react";
import OptimizedAvatar from "./OptimizedAvatar";
import { DESIGN_SYSTEM_COLORS } from " @components/lib/theme/colors";
import { INotification } from " @components/types/IChat";
import { RiveComponentMemoized } from "../Common/RiveComponentExtended";
import MarkdownRender from "../Markdown/MarkdownRender";
import { chatChange } from " @components/client/firestore/messages.firestore";
import { getNotificationsSnapshot } from " @components/client/firestore/notifications.firestore";
import { synchronizeStuff } from " @components/lib/utils/helpers";
import { getFirestore } from "firebase/firestore";

dayjs.extend(relativeTime);

type CommentsProps = {
  user: any;
  notifications: INotification[];
  openNotification: (
    notificationId: string,
    messageId: string,
    type: string,
    nodeId?: string
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
        })
      );
    };
    const killSnapshot = getNotificationsSnapshot(
      db,
      { uname: user.uname, lastVisible: null, seen: true },
      onSynchronize
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
      }}
    >
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        aria-label="notification tabs"
      >
        <Tab label={`Unread (${notifications.length})`} sx={{ width: "50%" }} />
        <Tab label={`Read`} sx={{ width: "50%" }} />
      </Tabs>
      <Box
        sx={{
          overflow: "auto",
          flex: 1,
          mt: 2,
        }}
      >
        {!displayNotifications.length && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              marginTop: "20%",
            }}
          >
            <Box sx={{ height: "100%", display: "grid", placeItems: "center" }}>
              <Box
                sx={{
                  width: { xs: "250px", sm: "300px" },
                  height: { xs: "250px", sm: "200px" },
                  "& .rive-canvas": {
                    height: "100%",
                  },
                }}
              >
                <RiveComponentMemoized
                  src="/rive/notification.riv"
                  animations="Timeline 1"
                  artboard="New Artboard"
                  autoplay
                  style={{
                    width: "100%",
                    height: "100%",
                  }}
                />
              </Box>
            </Box>
          </Box>
        )}
        {displayNotifications.map(
          (notification: INotification, idx: number) => (
            <Paper
              key={idx}
              className="direct-channel"
              onClick={() =>
                openNotification(
                  notification.id,
                  notification.entityId,
                  notification.type,
                  notification.nodeId
                )
              }
              elevation={3}
              sx={{
                position: "relative",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                borderRadius: "8px",
                boxShadow: (theme) =>
                  theme.palette.mode === "light"
                    ? "0px 1px 2px rgba(0, 0, 0, 0.06), 0px 1px 3px rgba(0, 0, 0, 0.1)"
                    : "none",
                background: (theme) =>
                  theme.palette.mode === "dark"
                    ? theme.palette.common.notebookG700
                    : theme.palette.common.gray100,
                marginBottom: "5px",
                cursor: "pointer",
                ":hover": {
                  background: (theme) =>
                    theme.palette.mode === "dark"
                      ? theme.palette.common.notebookG600
                      : theme.palette.common.gray200,
                },
              }}
            >
              <Box
                sx={{
                  width: "40px",
                  height: "40px",
                  cursor: "pointer",
                  borderRadius: "50%",
                  mr: "15px",
                  mb: "auto",
                }}
              >
                <OptimizedAvatar
                  alt={notification.senderDetail?.fullname || ""}
                  imageUrl={notification.senderDetail?.imageUrl}
                  size={40}
                  sx={{ border: "none" }}
                />
              </Box>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: "15px",
                  width: "100%",
                }}
              >
                <Box sx={{ width: "100%" }}>
                  <Typography
                    sx={{
                      fontSize: "14px",
                      fontWeight: "600",
                      lineHeight: "24px",
                    }}
                  >
                    {notification.title}
                  </Typography>
                  <MarkdownRender text={notification.body} />
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: "13px",
                        lineHeight: "24px",
                        cursor: "pointer",
                        color: (theme) =>
                          theme.palette.mode === "dark"
                            ? DESIGN_SYSTEM_COLORS.gray400
                            : DESIGN_SYSTEM_COLORS.orange500,
                      }}
                    >
                      {dayjs(notification.createdAt?.toDate())
                        .fromNow()
                        .includes("NaN")
                        ? "a few minutes ago"
                        : dayjs(notification.createdAt?.toDate()).fromNow()}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: "13px",
                        fontWeight: "500",
                        color: DESIGN_SYSTEM_COLORS.orange400,
                      }}
                    >
                      {notificationTypes[notification.type]}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Paper>
          )
        )}
        <Box sx={{ mb: "300px" }} />
      </Box>
    </Box>
  );
};
