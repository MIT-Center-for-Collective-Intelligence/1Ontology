import { shortenNumber, timeAgo } from " @components/lib/utils/string.utils";
import {
  Badge,
  Box,
  Button,
  Link,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import React, { useEffect, useState } from "react";
import OptimizedAvatar from "../Chat/OptimizedAvatar";
import DoneIcon from "@mui/icons-material/Done";
import {
  query,
  collection,
  onSnapshot,
  getFirestore,
  Timestamp,
} from "firebase/firestore";
import { SCROLL_BAR_STYLE } from " @components/lib/CONSTANTS";

const ActiveUsers = ({
  nodes,
  displayUserLogs,
  navigateToNode,
  handleExpand,
  fullVersion,
}: {
  nodes: any;
  displayUserLogs: any;
  navigateToNode: any;
  handleExpand: any;
  fullVersion: any;
}) => {
  const [usersNodesViews, setUsersNodesViews] = useState<any>({});
  const db = getFirestore();
  const theme = useTheme();

  const viewProfileLogs = (e: any) => {
    const userName = e.currentTarget.id;
    displayUserLogs({
      uname: userName,
      imageUrl: usersNodesViews[userName].imageUrl,
      fullname: `${usersNodesViews[userName].fName} ${usersNodesViews[userName].lName}`,
      fName: usersNodesViews[userName].fName,
    });
    handleExpand("userActivity");
  };

  const isOnline = (timestamp: Timestamp) => {
    if (!timestamp) return false;
    const now = new Date();
    const timeDifference = now.getTime() - timestamp.toMillis();
    const minutes = Math.floor(timeDifference / 1000 / 60);
    return minutes < 10;
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
              online: isOnline(data.lastInteracted),
              uname: userId,
              reputations: data?.reputations || 0,
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
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        overflow: "auto",
        height: "70vh",
        mt: "15px",
        overflowX: "hidden",
        ...SCROLL_BAR_STYLE, 
        "&::-webkit-scrollbar": {
          display: "none", 
        },
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      {Object.values(usersNodesViews)
        .sort((a: any, b: any) => b.reputations - a.reputations)
        .map((u: any) => (
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
            <Button
              sx={{
                display: "flex",
                justifyContent: fullVersion ? "flex-start" : "center",
                gap: "10px",
                minWidth: "0px",
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
