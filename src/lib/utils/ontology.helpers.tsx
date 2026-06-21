import { Box, Skeleton } from "@mui/material";
import {
  collection,
  documentId,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";

import { NODES } from "@components/lib/firestoreClient/collections";
import { recordLogs } from "@components/lib/utils/helpers";
import { INode } from "@components/types/INode";

export const AddContext = (nodes: any, nodesObject: any): INode[] => {
  for (let node of nodes) {
    if (node.nodeType === "context" && Array.isArray(node.properties.context)) {
      const contextId = node.properties.context[0].nodes[0]?.id;
      if (nodesObject[contextId]) {
        node.context = {
          id: contextId,
          title: nodesObject[contextId].title,
        };
      }
    }
  }
  return nodes;
};

// Helper function to extract all related node IDs from a given node
export const extractRelatedNodeIds = (node: INode): string[] => {
  const ids = new Set<string>();

  // Add the node itself
  ids.add(node.id);

  // Add generalizations
  node.generalizations?.forEach((collection) => {
    collection.nodes?.forEach((n) => ids.add(n.id));
  });

  // Add specializations
  node.specializations?.forEach((collection) => {
    // For unclassified nodes, avoid loading snapshots for specializations
    if (!node.unclassified) {
      collection.nodes?.forEach((n) => ids.add(n.id));
    }
  });

  // Add all properties that reference other nodes
  Object.values(node.properties || {}).forEach((propValue) => {
    if (Array.isArray(propValue)) {
      propValue.forEach((collection) => {
        collection.nodes?.forEach((n: any) => ids.add(n.id));
      });
    }
  });

  // Add inheritance references
  Object.values(node.inheritance || {}).forEach((inh: any) => {
    if (inh?.ref) ids.add(inh.ref);
  });

  return Array.from(ids);
};

// Helper function to split array into chunks (Firestore 'in' query has 30 item limit)
export const chunkArray = <T,>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

// Helper function to fetch a single node from Firestore
// When appName is provided, validates if the node belongs to that app after fetching
export const fetchSingleNode = async (
  db: any,
  nodeId: string,
  appName?: string,
): Promise<INode | null> => {
  try {
    const nodeSnap = await getDocs(
      query(
        collection(db, NODES),
        where(documentId(), "==", nodeId),
        where("deleted", "==", false),
        limit(1),
      ),
    );

    if (nodeSnap.docs.length > 0) {
      const docSnap = nodeSnap.docs[0];
      const node = { id: docSnap.id, ...docSnap.data() } as INode;

      if (appName && node.appName !== appName) {
        return null;
      }

      return node;
    }

    return null;
  } catch (error: any) {
    console.error("Error fetching single node:", error);
    recordLogs({
      type: "error",
      error: JSON.stringify({
        name: error.name,
        message: error.message,
      }),
    });
    return null;
  }
};

// Helper function to fetch the root node for an app
export const fetchRootNode = async (
  db: any,
  appName: string,
): Promise<INode | null> => {
  try {
    const rootSnap = await getDocs(
      query(
        collection(db, NODES),
        where("root", "==", true),
        where("appName", "==", appName),
        where("deleted", "==", false),
        limit(1),
      ),
    );
    if (rootSnap.docs.length > 0) {
      const rootDoc = rootSnap.docs[0];
      return { id: rootDoc.id, ...rootDoc.data() } as INode;
    }
    return null;
  } catch (error: any) {
    console.error("Error fetching root node:", error);
    return null;
  }
};

export const TreeOutlineSkeleton = () => {
  const indentPx = 18;
  const rowH = 30;

  const lineColor = (theme: any) =>
    theme.palette.mode === "dark"
      ? "rgba(255,255,255,0.10)"
      : "rgba(0,0,0,0.10)";

  // Hand-tuned outline that reads like a real expanded tree.
  // `lines` indicates which ancestor columns should keep a vertical line.
  const rows: Array<{
    depth: number;
    lines: boolean[];
    width: string;
    hasToggle?: boolean;
  }> = [
    { depth: 0, lines: [], width: "62%", hasToggle: true },
    { depth: 1, lines: [true], width: "54%", hasToggle: true },
    { depth: 2, lines: [true, true], width: "68%", hasToggle: true },
    { depth: 3, lines: [true, true, true], width: "56%", hasToggle: true },
    { depth: 4, lines: [true, true, true, true], width: "48%" },
    { depth: 4, lines: [true, true, true, true], width: "70%" },
    { depth: 3, lines: [true, true, true], width: "52%" },
    { depth: 2, lines: [true, true], width: "64%", hasToggle: true },
    { depth: 3, lines: [true, true, true], width: "46%" },
    { depth: 3, lines: [true, true, true], width: "58%" },
    { depth: 1, lines: [true], width: "60%", hasToggle: true },
    { depth: 2, lines: [true, true], width: "50%" },
    { depth: 2, lines: [true, true], width: "72%" },
    { depth: 0, lines: [], width: "55%", hasToggle: true },
    // Extra rows to better fill the panel while loading
    { depth: 1, lines: [true], width: "63%" },
    { depth: 2, lines: [true, true], width: "47%", hasToggle: true },
    { depth: 3, lines: [true, true, true], width: "69%" },
    { depth: 4, lines: [true, true, true, true], width: "52%" },
    { depth: 3, lines: [true, true, true], width: "60%" },
    { depth: 2, lines: [true, true], width: "57%" },
    { depth: 1, lines: [true], width: "49%", hasToggle: true },
    { depth: 2, lines: [true, true], width: "66%" },
    { depth: 0, lines: [], width: "58%" },
  ];

  return (
    <Box sx={{ px: 1, pt: 1, minHeight: "70vh" }}>
      {rows.map((r, i) => (
        <Box
          key={i}
          sx={{
            display: "flex",
            alignItems: "center",
            height: `${rowH}px`,
          }}
        >
          {/* Connector columns */}
          <Box
            sx={{
              display: "flex",
              alignItems: "stretch",
              width: `${r.depth * indentPx}px`,
              height: "100%",
              flex: "0 0 auto",
            }}
          >
            {new Array(r.depth).fill(0).map((_, colIdx) => {
              const showVertical = r.lines[colIdx];
              const isLastCol = colIdx === r.depth - 1;
              return (
                <Box
                  key={colIdx}
                  sx={{
                    position: "relative",
                    width: `${indentPx}px`,
                    height: "100%",
                    flex: "0 0 auto",
                    "&::before": showVertical
                      ? {
                          content: '""',
                          position: "absolute",
                          left: "50%",
                          top: 0,
                          bottom: 0,
                          width: "1px",
                          transform: "translateX(-0.5px)",
                          backgroundColor: lineColor,
                        }
                      : undefined,
                    "&::after": isLastCol
                      ? {
                          content: '""',
                          position: "absolute",
                          left: "50%",
                          top: "50%",
                          width: "10px",
                          height: "1px",
                          transform: "translateY(-0.5px)",
                          backgroundColor: lineColor,
                        }
                      : undefined,
                  }}
                />
              );
            })}
          </Box>

          {/* Toggle placeholder (like expand/collapse chevron) */}
          <Box sx={{ width: 18, mr: 0.75, flex: "0 0 auto" }}>
            {r.hasToggle ? (
              <Skeleton
                variant="rounded"
                width={14}
                height={14}
                animation="wave"
                sx={{
                  borderRadius: "4px",
                  bgcolor: (theme) =>
                    theme.palette.mode === "dark"
                      ? "rgba(255,255,255,0.06)"
                      : "rgba(0,0,0,0.06)",
                }}
              />
            ) : (
              <Box sx={{ width: 14, height: 14 }} />
            )}
          </Box>

          {/* Node bullet */}
          <Skeleton
            variant="circular"
            width={12}
            height={12}
            animation="wave"
            sx={{
              mr: 1,
              bgcolor: (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(0,0,0,0.08)",
            }}
          />

          {/* Label */}
          <Skeleton
            variant="rounded"
            height={16}
            width={r.width}
            animation="wave"
            sx={{
              borderRadius: "10px",
              bgcolor: (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(0,0,0,0.08)",
            }}
          />
        </Box>
      ))}
    </Box>
  );
};
