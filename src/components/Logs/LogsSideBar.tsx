import { Avatar, Box, Button, Paper, Typography } from "@mui/material";
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

export type NodeChange = {
  nodeId: string;
  modifiedBy: string;
  modifiedProperty: string;
  previousValue: any;
  newValue: any;
  modifiedAt: Date;
  changeType:
    | "change text"
    | "add collection"
    | "delete collection"
    | "change collection name"
    | "sort elements"
    | "remove element"
    | "modify elements"
    | "add property"
    | "remove property"
    | "delete node";
  fullNode: INode;
};

const LogsSideBar = ({
  openLogsFor,
  displayDiff,
}: {
  openLogsFor: {
    uname: string;
    imageUrl: string;
    fullname: string;
  } | null;
  displayDiff: any;
}) => {
  const db = getFirestore();
  const [logs, setLogs] = useState<any>({});

  useEffect(() => {
    if (!openLogsFor?.uname) return;
    setLogs({});

    const nodesQuery = query(
      collection(
        doc(collection(db, NODES_LOGS), openLogsFor?.uname),
        "changes"
      ),
      orderBy("modifiedAt", "desc")
    );

    const unsubscribeNodes = onSnapshot(nodesQuery, (snapshot) => {
      const docChanges = snapshot.docChanges();
      console.log("docChanges", docChanges);
      setLogs((prev: any) => {
        for (let change of docChanges) {
          const changeData: any = change.doc.data();
          const nodeId = change.doc.id;
          console.log("changeData", changeData);
          if (change.type === "removed" && prev[nodeId]) {
            delete prev[nodeId];
          } else {
            prev[nodeId] = { ...changeData };
          }
        }
        return prev;
      });
    });

    return () => unsubscribeNodes();
  }, [db, openLogsFor?.uname]);

  console.log("logs", logs);
  const getModifiedAt = (modifiedAt: any) => {
    modifiedAt = moment(modifiedAt.toDate());
    const today = moment();
    return modifiedAt.isSame(today, "day")
      ? `Today at ${modifiedAt.format("hh:mm A")}`
      : modifiedAt.format("hh:mm A DD/MM/YYYY");
  };

  return (
    <Box>
      {logs &&
        Object.keys(logs).map((id) => (
          <Paper
            elevation={1}
            sx={{ padding: 1, marginBottom: 1, m: "15px" }}
            key={id}
          >
            {openLogsFor && (
              <Box sx={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <Box sx={{ position: "relative", display: "inline-block" }}>
                  <OptimizedAvatar
                    alt={openLogsFor.fullname}
                    imageUrl={openLogsFor.imageUrl || ""}
                    size={40}
                    sx={{
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                      objectFit: "cover",
                      borderColor: "green",
                    }}
                  />
                </Box>
                <Box>
                  <Typography>{openLogsFor.fullname}</Typography>
                  <Typography sx={{ fontSize: "13px", fontWeight: "bold" }}>
                    {" "}
                    {getModifiedAt(logs[id].modifiedAt)}
                  </Typography>
                </Box>
              </Box>
            )}
            <Box sx={{ py: 4, pl: 2 }}>
              <Box>
                <Typography variant="body1" sx={{ fontWeight: "bold" }}>
                  {logs[id].fullNode.title}
                </Typography>

                <Typography variant="body2" sx={{ fontSize: "0.75rem" }}>
                  {`Modified Property: ${logs[id].modifiedProperty} | Previous: ${logs[id].previousValue} | New: ${logs[id].newValue}`}
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
              Compare
            </Button>
          </Paper>
        ))}
    </Box>
  );
};

export default LogsSideBar;
