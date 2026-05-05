import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  CircularProgress,
  Paper,
  Typography,
  useTheme,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import {
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// `dagre` ships no types — local declaration in lieu of pulling another dep.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dagre: {
  graphlib: {
    Graph: new () => {
      setGraph: (g: Record<string, unknown>) => void;
      setDefaultEdgeLabel: (fn: () => unknown) => void;
      setNode: (id: string, opts: { width: number; height: number }) => void;
      setEdge: (from: string, to: string) => void;
      node: (id: string) => { x: number; y: number };
    };
  };
  layout: (g: unknown) => void;
} = require("dagre");

import { TreeData } from "@components/types/INode";

type Props = {
  // `null` while the hierarchy is being built; spinner shown.
  hierarchyTree: TreeData[] | null;
  focusedId: string;
  // `treeId` disambiguates duplicate nodeIds across positions in the tree.
  onExpandNode: (treeId: string, nodeId: string) => Promise<void>;
  onCollapseNode: (treeId: string, nodeId: string) => void;
  height?: number | string;
  borderless?: boolean;
  // When true, page scrolls instead of zooming; ⌘/Ctrl-scroll or pinch still zoom.
  requireModifierToZoom?: boolean;
};

const DEFAULT_HEIGHT = 540;

const WIDGET_BG_DARK = "rgba(13,17,23,0.82)";
const WIDGET_BG_LIGHT = "rgba(255,255,255,0.92)";
const WIDGET_SHADOW_DARK =
  "0 6px 20px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)";
const WIDGET_SHADOW_LIGHT =
  "0 6px 20px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.05)";
const WIDGET_HOVER_DARK = "rgba(255,255,255,0.06)";
const WIDGET_HOVER_LIGHT = "rgba(0,0,0,0.04)";

const NODE_W = 200;
const NODE_H = 46;
const FOCUSED_W = 230;
const FOCUSED_H = 66;

type GraphRole = "focused" | "path" | "sibling";

type GraphNodeData = {
  title: string;
  role: GraphRole;
  color: string;
  canExpand: boolean;
  isExpanded: boolean;
  isExpanding: boolean;
  treeId: string;
  nodeId: string;
};

const GraphNode: React.FC<NodeProps> = ({ data }) => {
  const d = data as unknown as GraphNodeData;
  const isFocused = d.role === "focused";
  return (
    <Box
      sx={{
        position: "relative",
        width: isFocused ? FOCUSED_W : NODE_W,
        height: isFocused ? FOCUSED_H : NODE_H,
        borderRadius: isFocused ? "16px" : "10px",
        background: (t) =>
          isFocused
            ? t.palette.mode === "dark"
              ? `${t.palette.primary.main}1f`
              : `${t.palette.primary.main}12`
            : t.palette.mode === "dark"
              ? "rgba(22,27,34,0.92)"
              : "rgba(255,255,255,0.98)",
        border: `${isFocused ? 2 : 1.5}px solid ${d.color}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "6px 10px",
        cursor: "pointer",
        opacity: d.role === "sibling" ? 0.92 : 1,
        userSelect: "none",
        transition: "background-color 0.15s ease, transform 0.1s ease",
        "&:hover": {
          background: (t) =>
            t.palette.mode === "dark" ? `${d.color}22` : `${d.color}14`,
          transform: "translateY(-1px)",
        },
      }}
      title={d.title}
    >
      <Box
        component="span"
        sx={{
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          textAlign: "center",
          lineHeight: 1.2,
          fontSize: isFocused ? "13px" : "11px",
          fontWeight: isFocused ? 700 : 500,
          color: (t) => t.palette.text.primary,
          width: "100%",
        }}
      >
        {d.title}
      </Box>
      {(d.canExpand || d.isExpanded) && (
        <Box
          sx={{
            position: "absolute",
            top: -7,
            right: -7,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: (t) =>
              t.palette.mode === "dark"
                ? "rgba(22,27,34,0.98)"
                : "rgba(255,255,255,1)",
            border: `1.5px solid ${d.color}`,
            color: d.color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1,
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          {d.isExpanded ? "−" : "+"}
        </Box>
      )}
      {d.isExpanding && (
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            right: -28,
            transform: "translateY(-50%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <CircularProgress size={14} thickness={5} sx={{ color: d.color }} />
        </Box>
      )}
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
    </Box>
  );
};

const nodeTypes: NodeTypes = { graph: GraphNode };

type WalkedNode = {
  treeId: string;
  nodeId: string;
  title: string;
  hasChildren: boolean;
  hasUnresolved: boolean;
  parentTreeId: string | null;
};

// Skip `category: true` rows — they're tree-display artifacts (their
// nodeId is the parent's), not real ontology nodes. Lift their children
// up to the parent so the graph shows only real nodes.
function walkHierarchy(tree: TreeData[]): WalkedNode[] {
  const out: WalkedNode[] = [];
  const visit = (node: TreeData, parentTreeId: string | null) => {
    if (node.category) {
      for (const c of node.children ?? []) visit(c, parentTreeId);
      return;
    }
    out.push({
      treeId: node.id,
      nodeId: node.nodeId,
      title: node.name || node.nodeId,
      hasChildren: !!(node.children && node.children.length > 0),
      hasUnresolved:
        !!node.outlineLoadChildren ||
        (!!node.hasUnresolvedChildren &&
          (!node.children || node.children.length === 0)),
      parentTreeId,
    });
    if (node.children) {
      for (const c of node.children) visit(c, node.id);
    }
  };
  for (const root of tree) visit(root, null);
  return out;
}

function findPathTreeIds(tree: TreeData[], focusedId: string): Set<string> {
  const chain: string[] = [];
  const find = (node: TreeData): boolean => {
    chain.push(node.id);
    if (node.nodeId === focusedId && !node.category) return true;
    for (const c of node.children ?? []) if (find(c)) return true;
    chain.pop();
    return false;
  };
  for (const root of tree) {
    if (find(root)) break;
  }
  return new Set(chain);
}

const NodeGraph: React.FC<Props> = ({
  hierarchyTree,
  focusedId,
  onExpandNode,
  onCollapseNode,
  height = DEFAULT_HEIGHT,
  borderless = false,
  requireModifierToZoom = false,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const colors = useMemo(
    () => ({
      focused: theme.palette.primary.main,
      path: theme.palette.primary.main,
      sibling: isDark ? "#bc8cff" : "#8250df",
    }),
    [theme.palette.primary.main, isDark],
  );

  const [expandingTreeIds, setExpandingTreeIds] = useState<Set<string>>(
    new Set(),
  );
  // Path-interior nodes are NOT added here — their children belong to
  // the canonical hierarchy, not a user expansion. That's what makes
  // collapse safe: clicks on them don't match and become no-ops.
  const [userExpanded, setUserExpanded] = useState<Set<string>>(new Set());
  useEffect(() => {
    setExpandingTreeIds(new Set());
    setUserExpanded(new Set());
  }, [focusedId]);

  const { nodes, edges } = useMemo(() => {
    if (!hierarchyTree || hierarchyTree.length === 0)
      return { nodes: [] as Node[], edges: [] as Edge[] };

    const walked = walkHierarchy(hierarchyTree);
    const pathTreeIds = findPathTreeIds(hierarchyTree, focusedId);

    const roleOf = (n: WalkedNode): GraphRole => {
      if (n.nodeId === focusedId) return "focused";
      if (pathTreeIds.has(n.treeId)) return "path";
      return "sibling";
    };

    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: "LR",
      ranksep: 90,
      nodesep: 16,
      edgesep: 8,
      marginx: 40,
      marginy: 40,
    });
    g.setDefaultEdgeLabel(() => ({}));
    for (const n of walked) {
      const r = roleOf(n);
      const isFocused = r === "focused";
      g.setNode(n.treeId, {
        width: isFocused ? FOCUSED_W : NODE_W,
        height: isFocused ? FOCUSED_H : NODE_H,
      });
    }
    for (const n of walked) {
      if (n.parentTreeId) g.setEdge(n.parentTreeId, n.treeId);
    }
    dagre.layout(g);

    const rfNodes: Node[] = walked.map((n) => {
      const role = roleOf(n);
      const p = g.node(n.treeId);
      const isFocused = role === "focused";
      const w = isFocused ? FOCUSED_W : NODE_W;
      const h = isFocused ? FOCUSED_H : NODE_H;
      return {
        id: n.treeId,
        type: "graph",
        position: { x: p.x - w / 2, y: p.y - h / 2 },
        data: {
          title: n.title,
          role,
          color: colors[role],
          canExpand: n.hasUnresolved,
          isExpanded: userExpanded.has(n.treeId),
          isExpanding: expandingTreeIds.has(n.treeId),
          treeId: n.treeId,
          nodeId: n.nodeId,
        } as unknown as Record<string, unknown>,
        draggable: false,
        selectable: false,
      };
    });

    const rfEdges: Edge[] = [];
    for (const n of walked) {
      if (!n.parentTreeId) continue;
      const onPath =
        pathTreeIds.has(n.parentTreeId) && pathTreeIds.has(n.treeId);
      const color = onPath ? colors.path : colors.sibling;
      rfEdges.push({
        id: `e-${n.parentTreeId}-${n.treeId}`,
        source: n.parentTreeId,
        target: n.treeId,
        type: "default",
        animated: false,
        style: {
          stroke: color,
          strokeWidth: onPath ? 2 : 1.4,
          strokeOpacity: onPath ? 0.85 : 0.55,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color,
          width: 16,
          height: 16,
        },
      });
    }

    return { nodes: rfNodes, edges: rfEdges };
  }, [hierarchyTree, focusedId, colors, expandingTreeIds, userExpanded]);

  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

  // Refit only on focus change so expand/collapse preserves pan/zoom.
  useEffect(() => {
    if (!rfInstance) return;
    const t = setTimeout(() => {
      rfInstance.fitView({ padding: 0.12, duration: 320 });
    }, 60);
    return () => clearTimeout(t);
  }, [rfInstance, focusedId]);

  const onNodeClick = useCallback(
    (_e: React.MouseEvent, node: Node) => {
      const d = node.data as unknown as GraphNodeData;
      if (userExpanded.has(d.treeId)) {
        onCollapseNode(d.treeId, d.nodeId);
        setUserExpanded((prev) => {
          const next = new Set(prev);
          next.delete(d.treeId);
          return next;
        });
        return;
      }
      if (!d.canExpand) return;
      if (expandingTreeIds.has(d.treeId)) return;
      setExpandingTreeIds((prev) => new Set(prev).add(d.treeId));
      Promise.resolve(onExpandNode(d.treeId, d.nodeId))
        .then(() => {
          setUserExpanded((prev) => new Set(prev).add(d.treeId));
        })
        .catch((err) => console.error("graph expand failed:", err))
        .finally(() => {
          setExpandingTreeIds((prev) => {
            const next = new Set(prev);
            next.delete(d.treeId);
            return next;
          });
        });
    },
    [onExpandNode, onCollapseNode, expandingTreeIds, userExpanded],
  );

  if (!hierarchyTree) {
    return (
      <Paper
        elevation={borderless ? 0 : 9}
        sx={{
          borderRadius: borderless ? 0 : "20px",
          width: "100%",
          height: borderless ? "100%" : height,
          background: borderless ? "transparent" : undefined,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress size={28} thickness={4} />
      </Paper>
    );
  }

  return (
    <Paper
      id="node-graph"
      elevation={borderless ? 0 : 9}
      sx={{
        borderRadius: borderless ? 0 : "20px",
        width: "100%",
        height: borderless ? "100%" : "auto",
        overflow: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        background: borderless ? "transparent" : undefined,
        "& .react-flow__controls": {
          background: (t) =>
            t.palette.mode === "dark" ? WIDGET_BG_DARK : WIDGET_BG_LIGHT,
          backdropFilter: "blur(8px)",
          boxShadow: (t) =>
            t.palette.mode === "dark"
              ? WIDGET_SHADOW_DARK
              : WIDGET_SHADOW_LIGHT,
          border: "none",
          borderRadius: "12px",
          overflow: "hidden",
        },
        "& .react-flow__controls-button": {
          background: "transparent",
          border: "none",
          borderBottom: (t) =>
            `1px solid ${
              t.palette.mode === "dark"
                ? "rgba(255,255,255,0.05)"
                : "rgba(0,0,0,0.05)"
            }`,
          "&:last-of-type": { borderBottom: "none" },
          color: (t) => t.palette.text.primary,
          width: 32,
          height: 32,
          transition: "background 0.15s ease",
          "& svg": { fill: "currentColor", width: 14, height: 14 },
          "&:hover": {
            background: (t) =>
              t.palette.mode === "dark"
                ? WIDGET_HOVER_DARK
                : WIDGET_HOVER_LIGHT,
          },
        },
      }}
    >
      <Box
        sx={{
          width: "100%",
          height: borderless ? "100%" : height,
          flex: borderless ? 1 : "none",
          minHeight: 0,
          background: (t) =>
            t.palette.mode === "dark" ? "#0d1117" : "#fafbfc",
          position: "relative",
        }}
      >
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            onInit={setRfInstance}
            fitView
            fitViewOptions={{ padding: 0.12 }}
            minZoom={0.15}
            maxZoom={2}
            panOnDrag
            zoomOnScroll={!requireModifierToZoom}
            preventScrolling={!requireModifierToZoom}
            zoomActivationKeyCode={
              requireModifierToZoom ? ["Meta", "Control"] : undefined
            }
            zoomOnPinch
            zoomOnDoubleClick={false}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            proOptions={{ hideAttribution: true }}
          >
            <Controls showInteractive={false} position="bottom-right" />
          </ReactFlow>
        </ReactFlowProvider>

        <Box
          sx={{
            position: "absolute",
            bottom: 12,
            left: 12,
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            px: 1.75,
            py: 0.6,
            fontSize: "11px",
            fontWeight: 500,
            letterSpacing: 0.2,
            color: "text.secondary",
            background: (t) =>
              t.palette.mode === "dark" ? WIDGET_BG_DARK : WIDGET_BG_LIGHT,
            backdropFilter: "blur(8px)",
            boxShadow: (t) =>
              t.palette.mode === "dark"
                ? WIDGET_SHADOW_DARK
                : WIDGET_SHADOW_LIGHT,
            borderRadius: "999px",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          <InfoOutlinedIcon sx={{ fontSize: 13, opacity: 0.7 }} />
          <Typography
            component="span"
            sx={{
              fontSize: "11px",
              fontWeight: 500,
              letterSpacing: 0.2,
              lineHeight: 1,
            }}
          >
            Click a node to expand or collapse ·{" "}
            {requireModifierToZoom
              ? "⌘-scroll or pinch to zoom"
              : "scroll to zoom"}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default React.memo(NodeGraph);
