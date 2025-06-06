import { Box, CircularProgress, Typography } from "@mui/material";
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
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
}: {
  selectedDiffNode: any;
  displayDiff: any;
  activeUsers: any;
  changeType: "add-node" | null;
  selectedUser: string;
  skillsFuture: boolean;
  skillsFutureApp: string;
}) => {
  const db = getFirestore();
  const [logs, setLogs] = useState<(NodeChange & { id: string })[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLogs([]);

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
          orderBy("modifiedAt", "desc"),
          limit(100),
        );
      } else {
        nodesQuery = query(
          collection(db, NODES_LOGS),
          where("changeType", "!=", "add node"),
          where("skillsFuture", "==", !!skillsFuture),
          where("modifiedBy", "==", selectedUser),
          orderBy("modifiedAt", "desc"),
          limit(100),
        );
      }
    }

    const unsubscribeNodes = onSnapshot(nodesQuery, (snapshot) => {
      const docChanges = snapshot.docChanges();
      setLogs((prev: any) => {
        const updatedLogs = [...prev];
        for (let change of docChanges) {
          const changeData = change.doc.data();
          if (
            ((skillsFuture &&
              changeData.skillsFuture &&
              changeData.appName === skillsFutureApp) ||
              (!skillsFuture && !changeData.skillsFuture)) &&
            !changeData.deleted
          ) {
            const id = change.doc.id;
            /*        if (id === "YLDwaHRDmfaLLsqUSdsO") { */
            updatedLogs.push({ ...changeData, id });
            /*             } */
          }
        }
        return updatedLogs; // Return the new array to trigger a re-render
      });
      setLoading(false);
    });

    return () => unsubscribeNodes();
  }, [db, changeType, selectedUser]);

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
            />
          ))}
      </>
    </Box>
  );
};

export default NodeActivity;
