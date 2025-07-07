import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Paper,
  Typography,
  Pagination,
} from "@mui/material";
import React, { useEffect, useState } from "react";
import {
  collection,
  doc,
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
import { getChangeDescription } from "@components/lib/utils/helpers";
import { RiveComponentMemoized } from "../Common/RiveComponentExtended";
import { SCROLL_BAR_STYLE } from "@components/lib/CONSTANTS";
import ActivityDetails from "./ActivityDetails";

const UserActivity = ({
  openLogsFor,
  displayDiff,
  selectedDiffNode,
  nodes,
}: {
  openLogsFor: any;
  displayDiff: Function;
  selectedDiffNode: any;
  nodes: any;
}) => {
  const db = getFirestore();
  const [logs, setLogs] = useState<(NodeChange & { id: string })[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);

  useEffect(() => {
    if (!openLogsFor?.uname) return;

    setLogs([]);
    setLastDoc(null);
    setHasMore(true);
    setLoading(true);

    const nodesQuery = query(
      collection(db, NODES_LOGS),
      where("modifiedBy", "==", openLogsFor.uname),
      orderBy("modifiedAt", "desc"),
      limit(100),
    );

    const unsubscribeNodes = onSnapshot(nodesQuery, (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      })) as (NodeChange & { id: string })[];

      setLogs(docs);
      
      if (!snapshot.empty) {
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(snapshot.docs.length === 100);
      }
      
      setLoading(false);
    });

    return () => unsubscribeNodes();
  }, [db, openLogsFor?.uname]);

  const loadMore = async () => {
    if (!lastDoc || loadingMore || !hasMore) return;

    setLoadingMore(true);

    try {
      const moreQuery = query(
        collection(db, NODES_LOGS),
        where("modifiedBy", "==", openLogsFor.uname),
        orderBy("modifiedAt", "desc"),
        startAfter(lastDoc),
        limit(50),
      );

      const snapshot = await getDocs(moreQuery);
      const moreLogs: (NodeChange & { id: string })[] = [];

      snapshot.forEach((doc) => {
        const changeData = doc.data();
        moreLogs.push({ ...changeData, id: doc.id } as NodeChange & { id: string });
      });

      setLogs(prevLogs => [...prevLogs, ...moreLogs]);

      if (!snapshot.empty) {
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      }

      setHasMore(snapshot.docs.length === 50);

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
        {/* <br /> */}
        <Typography sx={{ mt: "5px" }}> Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: "90vh", overflow: "auto", ...SCROLL_BAR_STYLE }}>
      {Object.keys(logs).length <= 0 && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            marginTop: "20%",
          }}
        >
          <Box sx={{ height: "100%", display: "grid", placeItems: "center" }}>
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

      {logs.length > 0 && (
        <>
          {logs.map((log) => (
            <ActivityDetails
              key={log.id}
              activity={log}
              displayDiff={displayDiff}
              selectedDiffNode={selectedDiffNode}
              nodes={nodes}
            />
          ))}

          {hasMore && (
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
      )}
    </Box>
  );
};

export default UserActivity;
