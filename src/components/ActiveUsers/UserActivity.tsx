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
import { INode } from " @components/types/INode";
import { NODES_LOGS } from " @components/lib/firestoreClient/collections";
import OptimizedAvatar from "../Chat/OptimizedAvatar";
import moment from "moment";
import { getChangeDescription } from " @components/lib/utils/helpers";
import { RiveComponentMemoized } from "../Common/RiveComponentExtended";
import { SCROLL_BAR_STYLE } from " @components/lib/CONSTANTS";

export type NodeChange = {
  nodeId: string;
  modifiedBy: string;
  modifiedProperty: string | null;
  previousValue: any;
  newValue: any;
  modifiedAt: Date;
  changeType:
    | "change text" //handled
    | "sort elements" //handled
    | "remove element" //handled
    | "modify elements" //handled
    | "add property" // missing
    | "remove property" // missing
    | "delete node" // handled
    | "add node" // handled
    | "add collection" // handled
    | "delete collection" // handled
    | "edit collection"; // handled
  fullNode: INode;
};

const UserActivity = ({
  openLogsFor,
  displayDiff,
}: {
  openLogsFor: any;
  displayDiff: any;
}) => {
  const db = getFirestore();
  const [logs, setLogs] = useState<any>({});
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!openLogsFor?.uname) return;
    setLogs({});

    const nodesQuery = query(
      collection(db, NODES_LOGS),
      where("modifiedBy", "==", openLogsFor.uname),
      orderBy("modifiedAt", "desc")
    );

    const unsubscribeNodes = onSnapshot(nodesQuery, (snapshot) => {
      const docChanges = snapshot.docChanges();
      setLogs((prev: any) => {
        for (let change of docChanges) {
          const changeData: any = change.doc.data();
          const nodeId = change.doc.id;

          if (change.type === "removed" && prev[nodeId]) {
            delete prev[nodeId];
          } else {
            prev[nodeId] = { ...changeData };
          }
        }
        return prev;
      });
      setLoading(false);
    });

    return () => unsubscribeNodes();
  }, [db, openLogsFor?.uname]);

  const getModifiedAt = (modifiedAt: any) => {
    modifiedAt = moment(modifiedAt.toDate());
    const today = moment();
    return modifiedAt.isSame(today, "day")
      ? `Today at ${modifiedAt.format("hh:mm A")}`
      : modifiedAt.format("hh:mm A DD/MM/YYYY");
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
      {Object.keys(logs).length > 0 &&
        Object.keys(logs).map((id) => (
          <Box key={id} sx={{ display: "flex", flexDirection: "column" }}>
            <Typography
              sx={{
                fontSize: "13px",
                fontWeight: "bold",
                ml: "auto",
                mr: "15px",
              }}
            >
              {" "}
              {getModifiedAt(logs[id].modifiedAt)}
            </Typography>
            <Paper
              elevation={3}
              sx={{ padding: 1, marginBottom: 1, m: "15px", mt: "0px" }}
            >
              <Box sx={{ py: 4, pl: 2 }}>
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: "bold" }}>
                    {logs[id].fullNode.title}
                  </Typography>

                  <Typography
                    variant="body2"
                    sx={{ fontSize: "14px", mt: "15px" }}
                  >
                    {getChangeDescription(
                      logs[id],
                      openLogsFor?.fullname || ""
                    )}
                  </Typography>
                </Box>
              </Box>
              <Button
                onClick={() => {
                  displayDiff(logs[id]);
                }}
                variant="outlined"
                sx={{ borderRadius: "25px" }}
              >
                View
              </Button>
            </Paper>
          </Box>
        ))}
    </Box>
  );
};

export default UserActivity;
