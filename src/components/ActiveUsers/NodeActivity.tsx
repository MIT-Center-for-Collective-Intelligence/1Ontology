import { Box, CircularProgress, Typography, Button } from "@mui/material";
import { keyframes } from "@mui/system";
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
import { SCROLL_BAR_STYLE } from "@components/lib/CONSTANTS";
import ActivityDetails from "./ActivityDetails";

const floatTimelineCard = keyframes`
  0%, 100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-12px) scale(1.02);
  }
`;

const pulseTimelineDot = keyframes`
  0% {
    transform: scale(0.7);
    opacity: 0.75;
  }
  100% {
    transform: scale(2.1);
    opacity: 0;
  }
`;

const sweepTimelineGlow = keyframes`
  0% {
    transform: translateX(-120%);
    opacity: 0;
  }
  25% {
    opacity: 0.7;
  }
  100% {
    transform: translateX(140%);
    opacity: 0;
  }
`;

const orbitHistoryDot = keyframes`
  from {
    transform: rotate(0deg) translateX(68px) rotate(0deg);
  }
  to {
    transform: rotate(360deg) translateX(68px) rotate(-360deg);
  }
`;

const NodeActivity = ({
  currentVisibleNode,
  selectedDiffNode,
  displayDiff,
  activeUsers,
  nodes,
}: {
  selectedDiffNode: any;
  currentVisibleNode: any;
  displayDiff: any;
  activeUsers: any;
  nodes: { [nodeId: string]: any };
}) => {
  const db = getFirestore();
  const [logs, setLogs] = useState<(NodeChange & { id: string })[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);

  useEffect(() => {
    if (!currentVisibleNode?.id) return;

    setLogs([]);
    setLastDoc(null);
    setHasMore(true);
    setLoading(true);

    const nodesQuery = query(
      collection(db, NODES_LOGS),
      where("nodeId", "==", currentVisibleNode?.id),
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
  }, [db, currentVisibleNode?.id]);

  const loadMore = async () => {
    if (!lastDoc || loadingMore || !hasMore) return;

    setLoadingMore(true);

    try {
      const moreQuery = query(
        collection(db, NODES_LOGS),
        where("nodeId", "==", currentVisibleNode?.id),
        orderBy("modifiedAt", "desc"),
        startAfter(lastDoc),
        limit(50),
      );

      const snapshot = await getDocs(moreQuery);
      const moreLogs: (NodeChange & { id: string })[] = [];

      snapshot.forEach((doc) => {
        moreLogs.push({ ...doc.data(), id: doc.id } as NodeChange & {
          id: string;
        });
      });

      setLogs((prevLogs) => [...prevLogs, ...moreLogs]);

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
      {logs.length <= 0 && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "68vh",
            px: 3,
          }}
        >
          <Box
            sx={{
              width: { xs: 270, sm: 340 },
              textAlign: "center",
            }}
          >
            <Box
              sx={{
                position: "relative",
                height: { xs: 230, sm: 260 },
                borderRadius: "28px",
                border: "1px solid rgba(255, 185, 84, 0.38)",
                background: (theme) =>
                  theme.palette.mode === "dark"
                    ? "radial-gradient(circle at 50% 12%, rgba(255,185,84,0.24), rgba(16,16,20,0.92) 62%)"
                    : "radial-gradient(circle at 50% 12%, rgba(255,185,84,0.2), rgba(255,255,255,0.96) 62%)",
                boxShadow:
                  "0 18px 40px rgba(0,0,0,0.2), inset 0 0 0 1px rgba(255,255,255,0.08)",
                overflow: "hidden",
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(120deg, transparent 18%, rgba(255,255,255,0.14) 44%, transparent 68%)",
                  animation: `${sweepTimelineGlow} 3.5s ease-in-out infinite`,
                }}
              />

              <Box
                sx={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: 14,
                  height: 14,
                  mt: "-7px",
                  ml: "-7px",
                  borderRadius: "50%",
                  bgcolor: "#ffb954",
                  boxShadow: "0 0 18px rgba(255,185,84,0.75)",
                  "&::before": {
                    content: '""',
                    position: "absolute",
                    inset: -42,
                    borderRadius: "50%",
                    border: "1px dashed rgba(255,185,84,0.34)",
                  },
                  "&::after": {
                    content: '""',
                    position: "absolute",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    bgcolor: "#ff914d",
                    top: 3,
                    left: 3,
                    animation: `${orbitHistoryDot} 6s linear infinite`,
                  },
                }}
              />

              {[0, 1, 2].map((idx) => (
                <Box
                  key={idx}
                  sx={{
                    position: "absolute",
                    left: idx === 1 ? { xs: 74, sm: 96 } : { xs: 34, sm: 44 },
                    right: idx === 1 ? { xs: 34, sm: 44 } : { xs: 74, sm: 96 },
                    top:
                      idx === 0
                        ? { xs: 44, sm: 52 }
                        : idx === 1
                          ? { xs: 102, sm: 118 }
                          : { xs: 160, sm: 184 },
                    height: { xs: 38, sm: 44 },
                    borderRadius: "14px",
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: (theme) =>
                      theme.palette.mode === "dark"
                        ? "linear-gradient(180deg, rgba(54,54,60,0.96), rgba(30,30,36,0.96))"
                        : "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,247,247,0.98))",
                    boxShadow: "0 10px 24px rgba(0,0,0,0.2)",
                    display: "flex",
                    alignItems: "center",
                    gap: 1.25,
                    px: 1.5,
                    animation: `${floatTimelineCard} 2.8s ease-in-out ${idx * 0.32}s infinite`,
                  }}
                >
                  <Box
                    sx={{
                      position: "relative",
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      bgcolor: "#ffb954",
                    }}
                  >
                    <Box
                      sx={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: "50%",
                        border: "1px solid rgba(255,185,84,0.85)",
                        animation: `${pulseTimelineDot} 1.9s ease-out infinite`,
                      }}
                    />
                  </Box>
                  <Box
                    sx={{
                      height: 7,
                      flex: 1,
                      borderRadius: "999px",
                      background: (theme) =>
                        theme.palette.mode === "dark"
                          ? "rgba(255,255,255,0.22)"
                          : "rgba(0,0,0,0.14)",
                    }}
                  />
                  <Box
                    sx={{
                      width: idx === 1 ? "26%" : "18%",
                      height: 7,
                      borderRadius: "999px",
                      background: "rgba(255,185,84,0.56)",
                    }}
                  />
                </Box>
              ))}
            </Box>

            <Typography
              sx={{
                mt: 3,
                fontWeight: 700,
                fontSize: { xs: "1.1rem", sm: "1.25rem" },
              }}
            >
              No changes yet
            </Typography>
            <Typography
              sx={{
                mt: 1,
                color: "text.secondary",
                fontSize: "0.95rem",
                lineHeight: 1.5,
              }}
            >
              Once this node is edited, its activity timeline will show up here.
            </Typography>
          </Box>
        </Box>
      )}

      {logs.length > 0 && (
        <>
          {logs.map((log: NodeChange & { id: string }) => (
            <ActivityDetails
              key={log.id}
              activity={log}
              displayDiff={displayDiff}
              modifiedByDetails={activeUsers[log.modifiedBy]}
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

export default NodeActivity;
