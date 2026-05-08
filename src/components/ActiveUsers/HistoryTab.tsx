import {
  Box,
  CircularProgress,
  Skeleton,
  Typography,
  Button,
  Slide,
} from "@mui/material";
import React, { useEffect, useMemo, useState } from "react";
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
import { groupActivityLogs } from "@components/lib/utils/groupActivityLogs";
import { RiveComponentMemoized } from "../Common/RiveComponentExtended";
import ActivityDetails from "./ActivityDetails";

const NodeActivity = ({
  selectedDiffNode,
  displayDiff,
  activeUsers,
  changeType,
  selectedUser,
  appName,
  nodes,
}: {
  selectedDiffNode: any;
  displayDiff: any;
  activeUsers: any;
  changeType: "add-node" | null;
  selectedUser: string;
  appName: string;
  nodes: { [nodeId: string]: any };
}) => {
  const db = getFirestore();
  const [logs, setLogs] = useState<(NodeChange & { id: string })[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);

  const LoadingState = () => (
    <Box
      sx={{
        height: "90vh",
        px: 2,
        pt: 3,
        pb: 2,
        display: "flex",
        flexDirection: "column",
        gap: 2.25,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 1,
          pb: 0.5,
        }}
      >
        <CircularProgress
          size={26}
          thickness={4.4}
          sx={{
            color: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(255, 175, 110, 0.95)"
                : "rgba(180, 83, 9, 0.85)",
            filter: (theme) =>
              theme.palette.mode === "dark"
                ? "drop-shadow(0 0 16px rgba(255, 140, 75, 0.35))"
                : "drop-shadow(0 0 12px rgba(230, 120, 50, 0.22))",
          }}
        />
        <Typography
          sx={{
            fontWeight: 700,
            letterSpacing: "0.01em",
            color: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(255, 255, 255, 0.82)"
                : "rgba(15, 23, 42, 0.72)",
          }}
        >
          Loading history
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(255, 255, 255, 0.55)"
                : "rgba(15, 23, 42, 0.55)",
          }}
        >
          Fetching the latest changes…
        </Typography>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
        {Array.from({ length: 6 }).map((_, idx) => (
          <Box
            key={idx}
            sx={{
              borderRadius: 2.5,
              p: 1.5,
              background: (theme) =>
                theme.palette.mode === "dark"
                  ? "linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 55%, rgba(255,255,255,0.06) 100%)"
                  : "linear-gradient(145deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.46) 60%, rgba(255,255,255,0.62) 100%)",
              border: (theme) =>
                theme.palette.mode === "dark"
                  ? "1px solid rgba(255, 255, 255, 0.10)"
                  : "1px solid rgba(15, 23, 42, 0.06)",
              boxShadow: (theme) =>
                theme.palette.mode === "dark"
                  ? "0 18px 42px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255,255,255,0.06)"
                  : "0 14px 34px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255,255,255,0.75)",
              overflow: "hidden",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              <Skeleton
                variant="circular"
                width={34}
                height={34}
                sx={{
                  bgcolor: (theme) =>
                    theme.palette.mode === "dark"
                      ? "rgba(255,255,255,0.12)"
                      : "rgba(15,23,42,0.08)",
                }}
              />
              <Box sx={{ flex: 1 }}>
                <Skeleton
                  variant="text"
                  height={20}
                  width={`${72 - idx * 5}%`}
                  sx={{
                    bgcolor: (theme) =>
                      theme.palette.mode === "dark"
                        ? "rgba(255,255,255,0.12)"
                        : "rgba(15,23,42,0.08)",
                  }}
                />
                <Skeleton
                  variant="text"
                  height={18}
                  width={`${56 - idx * 4}%`}
                  sx={{
                    bgcolor: (theme) =>
                      theme.palette.mode === "dark"
                        ? "rgba(255,255,255,0.10)"
                        : "rgba(15,23,42,0.07)",
                  }}
                />
              </Box>
              <Skeleton
                variant="rounded"
                width={54}
                height={22}
                sx={{
                  borderRadius: 999,
                  bgcolor: (theme) =>
                    theme.palette.mode === "dark"
                      ? "rgba(255, 175, 110, 0.14)"
                      : "rgba(230, 120, 50, 0.12)",
                }}
              />
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );

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
          where("appName", "==", appName),
          orderBy("modifiedAt", "desc"),
          limit(100),
        );
      } else {
        nodesQuery = query(
          collection(db, NODES_LOGS),
          where("changeType", "==", "add node"),
          where("modifiedBy", "==", selectedUser),
          where("appName", "==", appName),
          orderBy("modifiedAt", "desc"),
          limit(100),
        );
      }
    } else {
      if (selectedUser === "All") {
        nodesQuery = query(
          collection(db, NODES_LOGS),
          where("changeType", "!=", "add node"),
          where("appName", "==", appName),
          orderBy("modifiedAt", "desc"),
          limit(100),
        );
      } else {
        nodesQuery = query(
          collection(db, NODES_LOGS),
          where("changeType", "!=", "add node"),
          where("modifiedBy", "==", selectedUser),
          where("appName", "==", appName),
          orderBy("modifiedAt", "desc"),
          limit(100),
        );
      }
    }

    const unsubscribeNodes = onSnapshot(nodesQuery, (snapshot) => {
      const docChanges = snapshot.docChanges();

      setLogs((prevLogs) => {
        let updatedLogs = [...prevLogs];
        const newAdditions: (NodeChange & { id: string })[] = [];

        docChanges.forEach((change) => {
          const changeData = change.doc.data();

          if (changeData.appName === appName && !changeData.deleted) {
            const logWithId = {
              ...changeData,
              id: change.doc.id,
            } as NodeChange & { id: string };

            if (change.type === "added") {
              const exists = updatedLogs.some(
                (log) => log.id === change.doc.id,
              );
              if (!exists) {
                newAdditions.push(logWithId);
              }
            } else if (change.type === "modified") {
              const index = updatedLogs.findIndex(
                (log) => log.id === change.doc.id,
              );
              if (index !== -1) {
                updatedLogs[index] = logWithId;
              }
            } else if (change.type === "removed") {
              updatedLogs = updatedLogs.filter(
                (log) => log.id !== change.doc.id,
              );
            }
          } else {
            if (change.type === "modified") {
              updatedLogs = updatedLogs.filter(
                (log) => log.id !== change.doc.id,
              );
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
        const validDocsCount = snapshot.docs.filter((doc) => {
          const data = doc.data();
          return data.appName === appName && !data.deleted;
        }).length;
        setHasMore(validDocsCount === 100);
      } else {
        setHasMore(false);
      }

      setLoading(false);
    });

    return () => unsubscribeNodes();
  }, [db, changeType, selectedUser, appName]);

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
            where("appName", "==", appName),
            orderBy("modifiedAt", "desc"),
            startAfter(lastDoc),
            limit(50),
          );
        } else {
          moreQuery = query(
            collection(db, NODES_LOGS),
            where("changeType", "==", "add node"),
            where("modifiedBy", "==", selectedUser),
            where("appName", "==", appName),
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
            where("appName", "==", appName),
            orderBy("modifiedAt", "desc"),
            startAfter(lastDoc),
            limit(50),
          );
        } else {
          moreQuery = query(
            collection(db, NODES_LOGS),
            where("changeType", "!=", "add node"),
            where("modifiedBy", "==", selectedUser),
            where("appName", "==", appName),
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
        if (changeData.appName === appName && !changeData.deleted) {
          moreLogs.push({ ...changeData, id: doc.id } as NodeChange & {
            id: string;
          });
        }
      });

      setLogs((prevLogs) => [...prevLogs, ...moreLogs]);

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

  // Pull child logs out of the top-level feed and hand them to their parent
  const grouped = useMemo(() => groupActivityLogs(logs), [logs]);

  if (loading) {
    return <LoadingState />;
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
            mt: { xs: "22%", sm: "20%" },
            px: 2,
            color: "text.primary",
            "@keyframes historyEmptyFloat": {
              "0%, 100%": { transform: "translateY(0px)" },
              "50%": { transform: "translateY(-10px)" },
            },
            "@keyframes historyEmptyPulse": {
              "0%, 100%": { opacity: 0.6, transform: "scale(0.98)" },
              "50%": { opacity: 1, transform: "scale(1)" },
            },
            "@keyframes historyEmptyDot": {
              "0%, 80%, 100%": { transform: "translateY(0)", opacity: 0.55 },
              "40%": { transform: "translateY(-6px)", opacity: 1 },
            },
          }}
        >
          <Box
            sx={(theme) => ({
              width: "100%",
              maxWidth: 360,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              borderRadius: 3,
              p: 2.25,
              background:
                theme.palette.mode === "dark"
                  ? "linear-gradient(160deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))"
                  : "linear-gradient(160deg, rgba(255,255,255,0.78), rgba(255,255,255,0.46))",
              border:
                theme.palette.mode === "dark"
                  ? "1px solid rgba(255,255,255,0.10)"
                  : "1px solid rgba(15,23,42,0.08)",
              boxShadow:
                theme.palette.mode === "dark"
                  ? "0 22px 55px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)"
                  : "0 18px 45px rgba(15,23,42,0.10), inset 0 1px 0 rgba(255,255,255,0.9)",
            })}
          >
            <Box
              aria-hidden
              sx={(theme) => ({
                width: "100%",
                maxWidth: 320,
                minHeight: 160,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                animation: "historyEmptyFloat 3.1s ease-in-out infinite",
                "&::before": {
                  content: '""',
                  position: "absolute",
                  inset: -10,
                  borderRadius: 999,
                  background:
                    theme.palette.mode === "dark"
                      ? "radial-gradient(circle at 40% 30%, rgba(255,175,110,0.18), transparent 55%), radial-gradient(circle at 70% 60%, rgba(120,180,255,0.14), transparent 60%)"
                      : "radial-gradient(circle at 40% 30%, rgba(230,120,50,0.14), transparent 55%), radial-gradient(circle at 70% 60%, rgba(60,120,255,0.10), transparent 60%)",
                  filter: "blur(10px)",
                  opacity: 0.95,
                },
              })}
            >
              <Box
                sx={(theme) => ({
                  width: "100%",
                  maxWidth: 300,
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                })}
              >
                {[
                  { align: "flex-start" as const, w: "70%", h: 34, d: "0s" },
                  { align: "flex-end" as const, w: "56%", h: 28, d: "0.12s" },
                  { align: "flex-start" as const, w: "62%", h: 32, d: "0.24s" },
                ].map((b, i) => (
                  <Box
                    key={i}
                    sx={(theme) => ({
                      alignSelf: b.align,
                      width: b.w,
                      height: b.h,
                      borderRadius: 2.25,
                      bgcolor:
                        i === 1
                          ? theme.palette.mode === "dark"
                            ? "rgba(10, 132, 255, 0.18)"
                            : "rgba(0, 122, 255, 0.14)"
                          : theme.palette.mode === "dark"
                            ? "rgba(255,255,255,0.08)"
                            : "rgba(255,255,255,0.7)",
                      border:
                        theme.palette.mode === "dark"
                          ? "1px solid rgba(255,255,255,0.12)"
                          : "1px solid rgba(15,23,42,0.08)",
                      boxShadow:
                        theme.palette.mode === "dark"
                          ? "inset 0 1px 0 rgba(255,255,255,0.06), 0 10px 28px rgba(0,0,0,0.24)"
                          : "inset 0 1px 0 rgba(255,255,255,0.75), 0 10px 28px rgba(15,23,42,0.08)",
                      animation: "historyEmptyPulse 2.8s ease-in-out infinite",
                      animationDelay: b.d,
                    })}
                  />
                ))}
              </Box>
            </Box>

            <Box sx={{ textAlign: "center" }}>
              <Typography sx={{ fontWeight: 800, letterSpacing: "0.01em" }}>
                No history yet
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  mt: 0.5,
                  color: (t) =>
                    t.palette.mode === "dark"
                      ? "rgba(255,255,255,0.58)"
                      : "rgba(15,23,42,0.6)",
                }}
              >
                When changes happen, they’ll show up here.
              </Typography>
            </Box>

            <Box
              aria-hidden
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                mt: 0.25,
              }}
            >
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  bgcolor: (t) =>
                    t.palette.mode === "dark"
                      ? "rgba(255, 175, 110, 0.9)"
                      : "rgba(180, 83, 9, 0.78)",
                  animation: "historyEmptyDot 1.2s ease-in-out infinite",
                }}
              />
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  bgcolor: (t) =>
                    t.palette.mode === "dark"
                      ? "rgba(255, 175, 110, 0.9)"
                      : "rgba(180, 83, 9, 0.78)",
                  animation: "historyEmptyDot 1.2s ease-in-out infinite",
                  animationDelay: "0.12s",
                }}
              />
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  bgcolor: (t) =>
                    t.palette.mode === "dark"
                      ? "rgba(255, 175, 110, 0.9)"
                      : "rgba(180, 83, 9, 0.78)",
                  animation: "historyEmptyDot 1.2s ease-in-out infinite",
                  animationDelay: "0.24s",
                }}
              />
            </Box>
          </Box>
        </Box>
      )}

      <>
        {logs.length > 0 &&
          grouped.items.map((log) => (
            <Slide key={log.id} direction="down" in={true} timeout={900}>
              <Box>
                <ActivityDetails
                  key={log.id}
                  activity={log}
                  displayDiff={displayDiff}
                  modifiedByDetails={activeUsers[log.modifiedBy]}
                  selectedDiffNode={selectedDiffNode}
                  nodes={nodes}
                  childActivities={grouped.childrenByParent.get(log.id)}
                />
              </Box>
            </Slide>
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
