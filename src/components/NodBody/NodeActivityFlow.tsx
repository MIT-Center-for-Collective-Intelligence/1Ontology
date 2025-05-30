import React, { useEffect, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import {
  Paper,
  Box,
  Typography,
  Tabs,
  Tab,
  Divider,
  CircularProgress,
  useTheme,
  IconButton,
  Tooltip,
} from "@mui/material";
import { INode, IAlgorithm } from "@components/types/INode";
import AlgorithmFlowVisualizer from "./AlgorithmFlowVisualizer";
import {
  collection,
  getFirestore,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import { Post } from "@components/lib/utils/Post";
import { ALGORITHMS } from "@components/lib/firestoreClient/collections";
import { development } from "@components/lib/CONSTANTS";

const sampleAlgorithmsData = {
  algorithms: [
    {
      name: "Sequential Comprehensive Clean",
      type: "sequential",
      sub_activities: [
        {
          name: "Gather and Prepare Supplies",
          id: "S1",
          type: "task",
        },
        {
          name: "Set Up Safety Measures",
          id: "S2",
          type: "task",
        },
        {
          name: "Check Cabin Soil Level",
          id: "S3",
          type: "condition",
          variables: ["SoilLevel"],
          condition: { "SoilLevel <= 3": true },
          sub_activities: [
            {
              name: "Basic Vacuum",
              id: "S4",
              type: "task",
            },
            {
              name: "Deep Vacuum",
              id: "S5",
              type: "task",
            },
          ],
        },
        {
          name: "Clean Overhead and Lavatories in Parallel",
          id: "S6",
          type: "parallel",
          sub_activities: [
            {
              name: "Disinfect Lavatories",
              id: "S7",
              type: "task",
            },
            {
              name: "Clean Overhead Bins",
              id: "S8",
              type: "task",
            },
          ],
        },
        {
          name: "Row-by-Row Cleaning Loop",
          id: "S9",
          type: "loop",
          variables: ["RemainingRows"],
          loop_condition: { "RemainingRows > 0": true },
          sub_activities: [
            {
              name: "Wipe & Disinfect Surfaces",
              id: "S10",
              type: "task",
            },
          ],
        },
        {
          name: "Final Inspection",
          id: "S11",
          type: "task",
        },
      ],
      performance_model:
        "T = t_{S1} + t_{S2} + (SoilLevel <= 3 ? t_{S4} : t_{S5}) + max(t_{S7}, t_{S8}) + (RemainingRows * t_{S10}) + t_{S11}",
      advantages:
        "All key steps are clearly laid out in a simple sequence, reducing confusion. The parallel cleaning of lavatories and overhead bins helps save some time while the rest of the process is straightforward.",
      disadvantages:
        "Overall completion can still be slowed by the mostly sequential flow, especially if SoilLevel is high and deep vacuuming is needed across many rows. Coordination is simpler but does not fully exploit the possibility of more parallel tasks.",
    },
    {
      name: "Parallel Team Clean",
      type: "parallel",
      sub_activities: [
        {
          name: "Prepare Equipment in Parallel",
          id: "S1",
          type: "parallel",
          sub_activities: [
            {
              name: "Gather Supplies",
              id: "S2",
              type: "task",
            },
            {
              name: "Set Up Safety Cones",
              id: "S3",
              type: "task",
            },
          ],
        },
        {
          name: "Lavatory Cleaning Condition",
          id: "S4",
          type: "condition",
          variables: ["NeedLavatories"],
          condition: { "NeedLavatories == true": true },
          sub_activities: [
            {
              name: "Include Lavatory Cleaning",
              id: "S5",
              type: "task",
            },
            {
              name: "Skip Lavatory Cleaning",
              id: "S6",
              type: "task",
            },
          ],
        },
        {
          name: "Simultaneous Cabin Areas Clean",
          id: "S7",
          type: "parallel",
          sub_activities: [
            {
              name: "Clean Overhead Bins",
              id: "S8",
              type: "task",
            },
            {
              name: "Seat Row Cleaning Loop",
              id: "S9",
              type: "loop",
              variables: ["UncleanRows"],
              loop_condition: { "UncleanRows > 0": true },
              sub_activities: [
                {
                  name: "Vacuum Row",
                  id: "S10",
                  type: "task",
                },
              ],
            },
            {
              name: "Clean Galley and Service Areas",
              id: "S11",
              type: "task",
            },
          ],
        },
        {
          name: "Quality Inspection",
          id: "S12",
          type: "task",
        },
      ],
      performance_model:
        "T = max( max(t_{S2}, t_{S3}), (NeedLavatories == true ? t_{S5} : t_{S6}), max(t_{S8}, (UncleanRows * t_{S10}), t_{S11}), t_{S12} )",
      advantages:
        "Maximizes concurrent cleaning by dividing tasks among multiple teams. Critical areas can be tackled simultaneously, significantly reducing overall cleaning time under sufficient staffing.",
      disadvantages:
        "Requires well-coordinated teams to avoid interfering with each other, potentially leading to complex scheduling. If staff or resources are limited, full parallelization might not be feasible, reducing its efficiency gains.",
    },
    {
      name: "Zonal Priority Clean",
      type: "sequential",
      sub_activities: [
        {
          name: "Evaluate Priority Zones",
          id: "S1",
          type: "condition",
          variables: ["HighPriorityZones"],
          condition: { "HighPriorityZones > 0": true },
          sub_activities: [
            {
              name: "Clean Each High Priority Zone",
              id: "S2",
              type: "loop",
              variables: ["HighPriorityZones"],
              loop_condition: { "HighPriorityZones > 0": true },
              sub_activities: [
                {
                  name: "Deep Clean Priority Zone",
                  id: "S3",
                  type: "task",
                },
              ],
            },
          ],
        },
        {
          name: "Standard Zones in Parallel",
          id: "S4",
          type: "parallel",
          sub_activities: [
            {
              name: "Seat Rows Clean Loop",
              id: "S5",
              type: "loop",
              variables: ["SeatRows"],
              loop_condition: { "SeatRows > 0": true },
              sub_activities: [
                {
                  name: "Vacuum & Wipe Row",
                  id: "S6",
                  type: "task",
                },
              ],
            },
            {
              name: "Overhead Bin Cleaning",
              id: "S7",
              type: "task",
            },
            {
              name: "Clean Galley Area",
              id: "S8",
              type: "task",
            },
          ],
        },
        {
          name: "Final Disinfection Pass",
          id: "S9",
          type: "task",
        },
      ],
      performance_model:
        "T = (HighPriorityZones > 0 ? (HighPriorityZones * t_{S3}) : 0) + max((SeatRows * t_{S6}), t_{S7}, t_{S8}) + t_{S9}",
      advantages:
        "Ensures that the most critical or dirtiest areas receive immediate attention and a thorough cleaning. Parallelizing the regular zones can reduce total time once the priority zones are addressed.",
      disadvantages:
        "If the majority of zones are deemed high priority, the initial sequential segment can become a bottleneck. This method also relies heavily on accurate priority assessment; misclassification can lead to inefficiencies.",
    },
    {
      name: "Iterative Inspection-Based Clean",
      type: "sequential",
      sub_activities: [
        {
          name: "Initial Cabin Inspection",
          id: "S1",
          type: "task",
        },
        {
          name: "Core Cleaning in Parallel",
          id: "S2",
          type: "parallel",
          sub_activities: [
            {
              name: "Vacuum Floors",
              id: "S3",
              type: "task",
            },
            {
              name: "Wipe and Disinfect Surfaces",
              id: "S4",
              type: "task",
            },
            {
              name: "Check Lavatory Status",
              id: "S5",
              type: "condition",
              variables: ["LavStatus"],
              condition: { "LavStatus == 'dirty'": true },
              sub_activities: [
                {
                  name: "Disinfect Lavatories",
                  id: "S6",
                  type: "task",
                },
                {
                  name: "Skip Lavatory Disinfection",
                  id: "S7",
                  type: "task",
                },
              ],
            },
          ],
        },
        {
          name: "Post-Inspection Loop",
          id: "S8",
          type: "loop",
          variables: ["CleanupIssues"],
          loop_condition: { "CleanupIssues > 0": true },
          sub_activities: [
            {
              name: "Address Cleanup Issue",
              id: "S9",
              type: "task",
            },
            {
              name: "Verify Issue Resolved",
              id: "S10",
              type: "condition",
              variables: ["IssueResolved"],
              condition: { "IssueResolved == true": true },
              sub_activities: [
                {
                  name: "Mark Issue As Completed",
                  id: "S11",
                  type: "task",
                },
                {
                  name: "Repeat Additional Cleaning",
                  id: "S12",
                  type: "task",
                },
              ],
            },
          ],
        },
        {
          name: "Final Approval",
          id: "S13",
          type: "task",
        },
      ],
      performance_model:
        "T = t_{S1} + max(t_{S3}, t_{S4}, (LavStatus == 'dirty' ? t_{S6} : t_{S7})) + (CleanupIssues * (t_{S9} + (IssueResolved == true ? t_{S11} : t_{S12}))) + t_{S13}",
      advantages:
        "Identifies problems early and iteratively fixes them, ensuring a high cleanliness standard. The parallel core cleaning tasks can speed up major efforts while dedicated loops allow re-checking until all issues are resolved.",
      disadvantages:
        "Potentially more time-consuming if repeated inspections uncover many problems. Requires disciplined tracking of issues and resolutions, increasing coordination complexity among cleaning crews.",
    },
  ],
};

/**
 * Props for the NodeActivityFlow component
 */
interface NodeActivityFlowProps {
  node: INode;
  confirmIt: any;
  nodes: { [id: string]: INode };
  onNodeAdd?: (parentId: string, newNodeData: Partial<INode>) => void;
}

/**
 * NodeActivityFlow - Displays algorithm flow visualizations for a node
 *
 * This component shows algorithm flowcharts related to a specific node
 * and allows switching between different algorithms using tabs.
 */
const NodeActivityFlow: React.FC<NodeActivityFlowProps> = ({
  node,
  confirmIt,
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === "dark";
  const db = getFirestore();
  const [activeTab, setActiveTab] = useState<number>(0);
  const [algorithms, setAlgorithms] = useState<IAlgorithm[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [openAiRequestLoading, setOpenAiRequestLoading] = useState(false);

  useEffect(() => {
    const algorithmsCollection = query(
      collection(db, ALGORITHMS),
      where("__name__", "==", node.id),
    );
    setAlgorithms([]);
    const fetchAlgorithms = async () => {
      if (development) {
        setAlgorithms(sampleAlgorithmsData.algorithms as any);
        return;
      }
      setLoading(true);
      const unsubscribe = onSnapshot(algorithmsCollection, (snapshot) => {
        const fetchedAlgorithms: any = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setAlgorithms(fetchedAlgorithms[0]?.algorithms || []);
      });
      setLoading(false);

      return () => unsubscribe();
    };

    fetchAlgorithms();
  }, [node.id, db]);

  const generateFlowCharts = async () => {
    try {
      setOpenAiRequestLoading(true);
      await Post("/flowchart", { nodeId: node.id });
    } catch (error) {
      /*       confirmIt(
        "The was an error generating Activity Flows, please try again!",
      ); */
      console.error(error);
    } finally {
      setOpenAiRequestLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Paper
      elevation={9}
      sx={{
        borderRadius: "30px",
        borderBottomRightRadius: "18px",
        borderBottomLeftRadius: "18px",
        minWidth: "500px",
        width: "100%",
        minHeight: "500px",
        overflow: "auto",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        bgcolor: (theme) =>
          theme.palette.mode === "dark" ? "#1a1a1a" : "#ffffff",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: (theme) =>
            theme.palette.mode === "dark" ? "#242425" : "#d0d5dd",
          p: 3,
        }}
      >
        <Typography
          sx={{
            fontSize: "20px",
            fontWeight: 500,
            fontFamily: "Roboto, sans-serif",
            color: (theme) =>
              theme.palette.mode === "dark" ? "#ffffff" : "#000000",
          }}
        >
          Activity Flow
        </Typography>
        {!development && (
          <Tooltip
            title={`Generate ${algorithms.length > 0 ? "New" : ""} Activity Flows`}
          >
            {openAiRequestLoading ? (
              <CircularProgress />
            ) : (
              <IconButton onClick={generateFlowCharts}>
                <AutoFixHighIcon />
              </IconButton>
            )}
          </Tooltip>
        )}
      </Box>

      <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {algorithms.length > 0 ? (
          <>
            {/* Algorithm tabs */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                px: 2,
                py: 1,
              }}
            >
              <Tabs
                value={activeTab}
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  ".MuiTabs-indicator": {
                    backgroundColor: isDarkMode ? "#90CAF9" : "#1976D2",
                  },
                  flex: 1,
                }}
              >
                {algorithms.map((algorithm, index) => (
                  <Tab
                    key={index}
                    label={algorithm.name}
                    sx={{
                      color: isDarkMode
                        ? activeTab === index
                          ? "#90CAF9"
                          : "#ffffff"
                        : activeTab === index
                          ? "#1976D2"
                          : "#000000",
                      "&.Mui-selected": {
                        color: isDarkMode ? "#90CAF9" : "#1976D2",
                        fontWeight: 500,
                      },
                    }}
                  />
                ))}
              </Tabs>
            </Box>

            {/* Algorithm flowchart */}
            <Box sx={{ flex: 1, overflow: "hidden" }}>
              {loading ? (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100%",
                  }}
                >
                  <CircularProgress />
                </Box>
              ) : (
                <ReactFlowProvider>
                  <AlgorithmFlowVisualizer
                    algorithm={algorithms[activeTab]}
                    isDarkMode={isDarkMode}
                  />
                </ReactFlowProvider>
              )}
            </Box>

            <Divider />
            <Box>
              {algorithms[activeTab]?.advantages && (
                <Typography sx={{ p: 2 }}>
                  <strong style={{ color: "orange" }}>Advantages:</strong>{" "}
                  {algorithms[activeTab]?.advantages}
                </Typography>
              )}
              {algorithms[activeTab]?.disadvantages && (
                <Typography sx={{ p: 2 }}>
                  <strong style={{ color: "orange" }}>Disadvantages:</strong>{" "}
                  {algorithms[activeTab]?.disadvantages}
                </Typography>
              )}
            </Box>
          </>
        ) : (
          <NoAlgorithmsMessage loading={loading} />
        )}
      </Box>
    </Paper>
  );
};

const NoAlgorithmsMessage: React.FC<{ loading: boolean }> = ({ loading }) => {
  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        flexGrow: 1,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Typography variant="body1" color="text.secondary">
        No algorithms available for this node.
      </Typography>
    </Box>
  );
};

export default NodeActivityFlow;
