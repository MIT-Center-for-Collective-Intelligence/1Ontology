import { Box, CircularProgress, Typography, Button } from "@mui/material";
import React, { useEffect, useState } from "react";
import {
  collection,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  startAfter,
  getDocs,
} from "firebase/firestore";
import { NodeChange } from "@components/types/INode";
import { NODES_LOGS } from "@components/lib/firestoreClient/collections";
import { RiveComponentMemoized } from "../Common/RiveComponentExtended";
import ActivityDetails from "./ActivityDetails";

const NodeActivity = ({
  selectedDiffNode,
  displayDiff,
  activeUsers,
  changeType,
  selectedUser,
  skillsFuture,
  skillsFutureApp,
  nodes,
}: {
  selectedDiffNode: any;
  displayDiff: any;
  activeUsers: any;
  changeType: "add-node" | null;
  selectedUser: string;
  skillsFuture: boolean;
  skillsFutureApp: string;
  nodes: { [nodeId: string]: any };
}) => {
  const db = getFirestore();
  const [logs, setLogs] = useState<(NodeChange & { id: string })[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);

  useEffect(() => {
    setLogs([]);
    setLastDoc(null);
    setHasMore(true);
    setLoading(true);

    let nodesQuery = null;

    if (changeType === "add-node") {
      if (selectedUser === "All") {
        nodesQuery = query(
          collection(db, NODES_LOGS),
          where("changeType", "==", "add node"),
          where("skillsFuture", "==", !!skillsFuture),
          orderBy("modifiedAt", "desc"),
          limit(100),
        );
      } else {
        nodesQuery = query(
          collection(db, NODES_LOGS),
          where("changeType", "==", "add node"),
          where("modifiedBy", "==", selectedUser),
          where("skillsFuture", "==", !!skillsFuture),
          orderBy("modifiedAt", "desc"),
          limit(100),
        );
      }
    } else {
      if (selectedUser === "All") {
        nodesQuery = query(
          collection(db, NODES_LOGS),
          where("changeType", "!=", "add node"),
          where("skillsFuture", "==", !!skillsFuture),
          where("appName", "==", skillsFutureApp),
          orderBy("modifiedAt", "desc"),
          limit(100),
        );
      } else {
        nodesQuery = query(
          collection(db, NODES_LOGS),
          where("changeType", "!=", "add node"),
          where("skillsFuture", "==", !!skillsFuture),
          where("modifiedBy", "==", selectedUser),
          where("appName", "==", skillsFutureApp),
          orderBy("modifiedAt", "desc"),
          limit(100),
        );
      }
    }

    const unsubscribeNodes = onSnapshot(nodesQuery, (snapshot) => {
      const docChanges = snapshot.docChanges();
      
      setLogs(prevLogs => {
        let updatedLogs = [...prevLogs];
        const newAdditions: (NodeChange & { id: string })[] = [];
        
        docChanges.forEach((change) => {
          const changeData = change.doc.data();
          
          if (
            ((skillsFuture &&
              changeData.skillsFuture &&
              changeData.appName === skillsFutureApp) ||
              (!skillsFuture && !changeData.skillsFuture)) &&
            !changeData.deleted
          ) {
            const logWithId = { ...changeData, id: change.doc.id } as NodeChange & { id: string };
            
            if (change.type === 'added') {
              const exists = updatedLogs.some(log => log.id === change.doc.id);
              if (!exists) {
                newAdditions.push(logWithId);
              }
            } else if (change.type === 'modified') {
              const index = updatedLogs.findIndex(log => log.id === change.doc.id);
              if (index !== -1) {
                updatedLogs[index] = logWithId;
              }
            } else if (change.type === 'removed') {
              updatedLogs = updatedLogs.filter(log => log.id !== change.doc.id);
            }
          } else {
            if (change.type === 'modified') {
              updatedLogs = updatedLogs.filter(log => log.id !== change.doc.id);
            }
          }
        });
        
        // Add all new additions to the top
        if (newAdditions.length > 0) {
          updatedLogs = [...newAdditions, ...updatedLogs];
        }
        
        return updatedLogs;
      });
      
      if (!snapshot.empty) {
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        const validDocsCount = snapshot.docs.filter(doc => {
          const data = doc.data();
          return ((skillsFuture && data.skillsFuture && data.appName === skillsFutureApp) ||
                  (!skillsFuture && !data.skillsFuture)) && !data.deleted;
        }).length;
        setHasMore(validDocsCount === 100);
      } else {
        setHasMore(false);
      }
      
      setLoading(false);
    });

    return () => unsubscribeNodes();
  }, [db, changeType, selectedUser, skillsFuture, skillsFutureApp]);

  const loadMore = async () => {
    if (!lastDoc || loadingMore || !hasMore) return;

    setLoadingMore(true);

    try {
      let moreQuery = null;

      if (changeType === "add-node") {
        if (selectedUser === "All") {
          moreQuery = query(
            collection(db, NODES_LOGS),
            where("changeType", "==", "add node"),
            where("skillsFuture", "==", !!skillsFuture),
            orderBy("modifiedAt", "desc"),
            startAfter(lastDoc),
            limit(50),
          );
        } else {
          moreQuery = query(
            collection(db, NODES_LOGS),
            where("changeType", "==", "add node"),
            where("modifiedBy", "==", selectedUser),
            where("skillsFuture", "==", !!skillsFuture),
            orderBy("modifiedAt", "desc"),
            startAfter(lastDoc),
            limit(50),
          );
        }
      } else {
        if (selectedUser === "All") {
          moreQuery = query(
            collection(db, NODES_LOGS),
            where("changeType", "!=", "add node"),
            where("skillsFuture", "==", !!skillsFuture),
            where("appName", "==", skillsFutureApp),
            orderBy("modifiedAt", "desc"),
            startAfter(lastDoc),
            limit(50),
          );
        } else {
          moreQuery = query(
            collection(db, NODES_LOGS),
            where("changeType", "!=", "add node"),
            where("skillsFuture", "==", !!skillsFuture),
            where("modifiedBy", "==", selectedUser),
            where("appName", "==", skillsFutureApp),
            orderBy("modifiedAt", "desc"),
            startAfter(lastDoc),
            limit(50),
          );
        }
      }

      const snapshot = await getDocs(moreQuery);
      const moreLogs: (NodeChange & { id: string })[] = [];

      snapshot.forEach((doc) => {
        const changeData = doc.data();
        if (
          ((skillsFuture &&
            changeData.skillsFuture &&
            changeData.appName === skillsFutureApp) ||
            (!skillsFuture && !changeData.skillsFuture)) &&
          !changeData.deleted
        ) {
          moreLogs.push({ ...changeData, id: doc.id } as NodeChange & { id: string });
        }
      });

      setLogs(prevLogs => [...prevLogs, ...moreLogs]);

      if (!snapshot.empty) {
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      }

      setHasMore(moreLogs.length === 50);

    } catch (error) {
      console.error("Error loading more logs:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          flexDirection: "column",
        }}
      >
        <CircularProgress />
        <Typography sx={{ mt: "5px" }}> Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: "90vh",
        overflow: "auto",
        "&::-webkit-scrollbar": {
          display: "none",
        },
      }}
    >
      {logs.length <= 0 && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            marginTop: "20%",
          }}
        >
          <Box
            sx={{
              height: "100%",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Box>
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
                  animations={"Timeline 1"}
                  artboard="New Artboard"
                  autoplay={true}
                  style={{
                    width: "100%",
                    height: "100%",
                  }}
                />
              </Box>
            </Box>
          </Box>
        </Box>
      )}

      <>
        {logs.length > 0 &&
          logs.map((log) => (
            <ActivityDetails
              key={log.id}
              activity={log}
              displayDiff={displayDiff}
              modifiedByDetails={activeUsers[log.modifiedBy]}
              selectedDiffNode={selectedDiffNode}
              nodes={nodes}
            />
          ))}
        
        {logs.length > 0 && hasMore && (
          <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
            <Button
              variant="outlined"
              onClick={loadMore}
              disabled={loadingMore}
              sx={{ minWidth: 120, borderRadius: "35px" }}
            >
              {loadingMore ? (
                <>
                  <CircularProgress size={16} sx={{ mr: 1 }} />
                  Loading...
                </>
              ) : (
                "Show More"
              )}
            </Button>
          </Box>
        )}
      </>
    </Box>
  );
};

export default NodeActivity;
