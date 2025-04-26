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
} from "firebase/firestore";
import { NodeChange } from "@components/types/INode";
import { NODES_LOGS } from "@components/lib/firestoreClient/collections";
import { getChangeDescription } from "@components/lib/utils/helpers";
import { RiveComponentMemoized } from "../Common/RiveComponentExtended";
import { SCROLL_BAR_STYLE } from "@components/lib/CONSTANTS";
import ActivityDetails from "./ActivityDetails";

const ITEMS_PER_PAGE = 15;

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
  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => {
    if (!openLogsFor?.uname) return;

    setLogs([]);
    setCurrentPage(1);

    const nodesQuery = query(
      collection(db, NODES_LOGS),
      where("modifiedBy", "==", openLogsFor.uname),
      orderBy("modifiedAt", "desc"),
      limit(100)
    );
    const unsubscribeNodes = onSnapshot(nodesQuery, (snapshot) => {
      const docChanges = snapshot.docChanges();

      setLogs((prev: (NodeChange & { id: string })[]) => {
        for (let change of docChanges) {
          const changeData: any = change.doc.data();
          const id = change.doc.id;
          prev.push({ ...changeData, id });
        }

        return prev.sort((a: any, b: any) => {
          return (
            new Date(b.modifiedAt.toDate()).getTime() -
            new Date(a.modifiedAt.toDate()).getTime()
          );
        });
      });
      setLoading(false);
    });

    return () => unsubscribeNodes();
  }, [db, openLogsFor?.uname]);

  const indexOfLastLog = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstLog = indexOfLastLog - ITEMS_PER_PAGE;
  const currentLogs = logs.slice(indexOfFirstLog, indexOfLastLog);

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setCurrentPage(value);
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
          {currentLogs.map((log) => (
            <ActivityDetails
              key={log.id}
              activity={log}
              displayDiff={displayDiff}
              isSelected={selectedDiffNode?.id === log.id}
            />
          ))}

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              mt: 8,
              mb: 2,
            }}
          >
            <Pagination
              count={Math.ceil(logs.length / ITEMS_PER_PAGE)}
              page={currentPage}
              onChange={handlePageChange}
              color="primary"
              showFirstButton
              showLastButton
            />
          </Box>
        </>
      )}
    </Box>
  );
};

export default UserActivity;
