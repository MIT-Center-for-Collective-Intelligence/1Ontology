import { shortenNumber, timeAgo } from " @components/lib/utils/string.utils";
import { Box, Button, Link, Tooltip, Typography, useTheme } from "@mui/material";
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
    <Box sx={{ display: "flex", flexDirection: "column" }}>
      {Object.values(usersNodesViews).sort((a: any,b: any) => b.reputations - a.reputations).map((u: any) => (
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
          >
            <Box sx={{ position: "relative" }}>
              <OptimizedAvatar
                alt={`${u.fName} ${u.lName}`}
                imageUrl={u.imageUrl || ""}
                size={30}
                sx={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  objectFit: "cover",
                  borderColor: "green",
                }}
              />

              {u.online && (
                <Box
                  sx={{
                    position: "relative",
                    whiteSpace: "nowrap",
                    margin: "-10px 0px -4px 0px",
                    height: "10px",
                    width: "10px",
                    borderRadius: "50%",
                    backgroundColor: "#12b76a",
                    overflow: "hidden",
                  }}
                />
              )}
            </Box>

            {fullVersion && (
              <Box
                sx={{
                  position: "relative",
                  display: "flex",
                  mt: "3px",
                  flexDirection: "column",
                }}
                onClick={viewProfileLogs}
                id={u.uname}
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
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      display: "inline-block",
                      fontSize: "14px",
                      width: "47px",
                      paddingLeft: "4px",
                      color: theme.palette.mode === 'light' ? 'black' : 'white',
                    }}
                  >
                    {shortenNumber(u.reputations, 2, false)}
                  </span>
                </Box>
              </Box>
            )}
          </Button>
        </Tooltip>
      ))}
    </Box>
  );
};

export default ActiveUsers;
