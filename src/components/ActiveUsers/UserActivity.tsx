import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Paper,
  Typography,
} from "@mui/material";
import React, { useEffect, useState } from "react";
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { NodeChange } from " @components/types/INode";
import { NODES_LOGS } from " @components/lib/firestoreClient/collections";
import { getChangeDescription } from " @components/lib/utils/helpers";
import { RiveComponentMemoized } from "../Common/RiveComponentExtended";
import { SCROLL_BAR_STYLE } from " @components/lib/CONSTANTS";
import ActivityDetails from "./ActivityDetails";

const UserActivity = ({
  openLogsFor,
  displayDiff,
  selectedDiffNode,
}: {
  openLogsFor: any;
  displayDiff: Function;
  selectedDiffNode: any;
}) => {
  const db = getFirestore();
  const [logs, setLogs] = useState<(NodeChange & { id: string })[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!openLogsFor?.uname) return;
    setLogs([]);

    const nodesQuery = query(
      collection(db, NODES_LOGS),
      where("modifiedBy", "==", openLogsFor.uname),
      orderBy("modifiedAt", "desc")
    );

    const unsubscribeNodes = onSnapshot(nodesQuery, (snapshot) => {
      const docChanges = snapshot.docChanges();
      setLogs((prev: (NodeChange & { id: string })[]) => {
        for (let change of docChanges) {
          const changeData = change.doc.data() as NodeChange;
          const id = change.doc.id;
          prev.push({ ...changeData, id });
        }
        return prev;
      });
      setLoading(false);
    });

    return () => unsubscribeNodes();
  }, [db, openLogsFor?.uname]);

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
      {logs.length > 0 &&
        logs
          .sort((a: any, b: any) => {
            return (
              new Date(b.modifiedAt.toDate()).getTime() -
              new Date(a.modifiedAt.toDate()).getTime()
            );
          })
          .map((log) => (
            <ActivityDetails
              key={log.id}
              activity={log}
              displayDiff={displayDiff}
              isSelected={selectedDiffNode?.id === log.id}
            />
          ))}
    </Box>
  );
};

export default UserActivity;
