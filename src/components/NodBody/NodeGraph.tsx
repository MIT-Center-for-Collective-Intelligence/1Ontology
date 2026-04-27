import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Box,
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
// `dagre` ships no types, but is available transitively via `dagre-d3`.
// A local minimal declaration keeps us honest without pulling another dep.
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

import { ICollection, INode } from "@components/types/INode";

type Props = {
  currentVisibleNode: INode;
  relatedNodes: { [id: string]: INode };
  navigateToNode: (nodeId: string) => void;
  /** Height of the graph canvas. Pass a number (px) or any CSS length. Defaults to 540px. */
  height?: number | string;
  /** When true, strips the outer Paper chrome so the graph fills its container edge-to-edge. */
  borderless?: boolean;
  /**
   * When true, plain wheel/two-finger-swipe no longer zooms — the page
   * scrolls behind the canvas instead. Zoom still works via Cmd/Ctrl+scroll
   * and trackpad pinch. Recommended on embedded pages; off by default.
   */
  requireModifierToZoom?: boolean;
  /**
   * Set of node ids whose outward neighbours are visible. Lifted to the
   * parent so the exploration state survives view toggles (compass ↔ graph)
   * that would otherwise unmount this component.
   */
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
};

const DEFAULT_HEIGHT = 540;

// Shared "glass" surface used by the widgets — matches NodeCompass for visual parity.
const WIDGET_BG_DARK = "rgba(13,17,23,0.82)";
const WIDGET_BG_LIGHT = "rgba(255,255,255,0.92)";
const WIDGET_SHADOW_DARK =
  "0 6px 20px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)";
const WIDGET_SHADOW_LIGHT =
  "0 6px 20px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.05)";
const WIDGET_HOVER_DARK = "rgba(255,255,255,0.06)";
const WIDGET_HOVER_LIGHT = "rgba(0,0,0,0.04)";

// Fan-out cap per node, per direction — bushy nodes (e.g. "Act") would
// otherwise drop hundreds of siblings at once. No depth cap: the graph grows
// only through user-driven expansion (click a node to expand / collapse).
const MAX_PER_DIRECTION = 12;

// Node sizes for dagre + React Flow render.
const NODE_W = 200;
const NODE_H = 46;
const CENTER_W = 230;
const CENTER_H = 66;

type GraphRole = "center" | "gen" | "spec";

const flattenIds = (cols: ICollection[] | undefined): string[] => {
  if (!Array.isArray(cols)) return [];
  const ids: string[] = [];
  for (const c of cols) {
    for (const n of c?.nodes ?? []) {
      if (n?.id) ids.push(n.id);
    }
  }
  return ids;
};

// ──────────────────────────────────────────────────────────────
// Custom node
// ──────────────────────────────────────────────────────────────

type GraphNodeData = {
  title: string;
  role: GraphRole;
  depth: number;
  color: string;
  partsCount: number;
  isPartOfCount: number;
  canExpand: boolean;
  isExpanded: boolean;
};

const GraphNode: React.FC<NodeProps> = ({ data }) => {
  const d = data as unknown as GraphNodeData;
  const isCenter = d.role === "center";
  const dim = d.depth >= 2;
  const isClickable = !isCenter && (d.canExpand || d.isExpanded);
  const showBadge = isClickable;
  // Expansion direction hint: "gen" grows leftward, "spec" rightward — place
  // the badge on the outward side so the affordance feels directional.
  const badgeSide = d.role === "gen" ? "left" : "right";
  return (
    <Box
      sx={{
        position: "relative",
        width: isCenter ? CENTER_W : NODE_W,
        height: isCenter ? CENTER_H : NODE_H,
        borderRadius: isCenter ? "16px" : "10px",
        background: (t) =>
          isCenter
            ? t.palette.mode === "dark"
              ? `${t.palette.primary.main}1f`
              : `${t.palette.primary.main}12`
            : t.palette.mode === "dark"
              ? "rgba(22,27,34,0.92)"
              : "rgba(255,255,255,0.98)",
        border: `${isCenter ? 2 : 1.5}px solid ${d.color}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "6px 10px",
        cursor: isClickable ? "pointer" : "default",
        opacity: dim ? 0.78 : 1,
        userSelect: "none",
        transition: "background-color 0.15s ease, transform 0.1s ease",
        "&:hover": isClickable
          ? {
              background: (t) =>
                t.palette.mode === "dark" ? `${d.color}22` : `${d.color}14`,
              transform: "translateY(-1px)",
            }
          : {},
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
          fontSize: isCenter ? "13px" : "11px",
          fontWeight: isCenter ? 700 : 500,
          color: (t) => t.palette.text.primary,
          width: "100%",
        }}
      >
        {d.title}
      </Box>
      {!isCenter && (d.partsCount > 0 || d.isPartOfCount > 0) && (
        <Box
          sx={{
            display: "flex",
            gap: 0.75,
            mt: 0.3,
            fontSize: "9px",
            fontWeight: 600,
          }}
        >
          {d.partsCount > 0 && (
            <Box
              component="span"
              sx={{ color: (t) => t.palette.success.main, opacity: 0.9 }}
            >
              ▼ {d.partsCount}
            </Box>
          )}
          {d.isPartOfCount > 0 && (
            <Box
              component="span"
              sx={{ color: (t) => t.palette.warning.main, opacity: 0.9 }}
            >
              ▲ {d.isPartOfCount}
            </Box>
          )}
        </Box>
      )}
      {showBadge && (
        <Box
          sx={{
            position: "absolute",
            top: -7,
            [badgeSide]: -7,
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

// ──────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────

const NodeGraph: React.FC<Props> = ({
  currentVisibleNode,
  relatedNodes,
  navigateToNode,
  height = DEFAULT_HEIGHT,
  borderless = false,
  requireModifierToZoom = false,
  expanded,
  onToggleExpand,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const axisColors = useMemo(
    () => ({
      gen: isDark ? "#bc8cff" : "#8250df",
      center: theme.palette.primary.main,
      spec: theme.palette.primary.main,
    }),
    [theme.palette.primary.main, isDark],
  );

  const { nodes, edges } = useMemo(() => {
    type Built = {
      id: string;
      title: string;
      role: GraphRole;
      depth: number;
      color: string;
      partsCount: number;
      isPartOfCount: number;
      canExpand: boolean;
      isExpanded: boolean;
    };
    const builtNodes: Built[] = [];
    const builtEdges: { source: string; target: string; color: string }[] = [];
    const seen = new Set<string>();

    const nodeOf = (id: string): INode | undefined =>
      relatedNodes[id] ??
      (id === currentVisibleNode.id ? currentVisibleNode : undefined);

    const add = (id: string, role: GraphRole, depth: number, color: string) => {
      if (seen.has(id)) return;
      const n = nodeOf(id);
      if (!n) return;
      seen.add(id);
      // canExpand points outward: gen-role grows further left (more gens),
      // spec-role grows further right (more specs). The center never shows
      // a badge — it's implicitly expanded in both directions.
      const outwardLen =
        role === "gen"
          ? flattenIds(n.generalizations).length
          : role === "spec"
            ? flattenIds(n.specializations).length
            : 0;
      builtNodes.push({
        id,
        title: n.title ?? id,
        role,
        depth,
        color,
        partsCount: flattenIds(
          n.properties?.parts as ICollection[] | undefined,
        ).length,
        isPartOfCount: flattenIds(
          n.properties?.isPartOf as ICollection[] | undefined,
        ).length,
        canExpand: role !== "center" && outwardLen > 0,
        isExpanded: expanded.has(id),
      });
    };

    add(currentVisibleNode.id, "center", 0, axisColors.center);

    // BFS through generalizations — ancestors (to the left in LR). Recurses
    // only through the center and nodes the user has explicitly expanded.
    let genFrontier: Array<{ id: string; depth: number }> = [
      { id: currentVisibleNode.id, depth: 0 },
    ];
    while (genFrontier.length) {
      const next: typeof genFrontier = [];
      for (const { id: parentId, depth: pd } of genFrontier) {
        const p = nodeOf(parentId);
        if (!p) continue;
        const gens = flattenIds(p.generalizations).slice(0, MAX_PER_DIRECTION);
        for (const gid of gens) {
          if (seen.has(gid)) continue;
          add(gid, "gen", pd + 1, axisColors.gen);
          builtEdges.push({
            source: gid,
            target: parentId,
            color: axisColors.gen,
          });
          if (expanded.has(gid)) next.push({ id: gid, depth: pd + 1 });
        }
      }
      genFrontier = next;
    }

    // BFS through specializations — descendants (to the right in LR).
    let specFrontier: Array<{ id: string; depth: number }> = [
      { id: currentVisibleNode.id, depth: 0 },
    ];
    while (specFrontier.length) {
      const next: typeof specFrontier = [];
      for (const { id: parentId, depth: pd } of specFrontier) {
        const p = nodeOf(parentId);
        if (!p) continue;
        const specs = flattenIds(p.specializations).slice(0, MAX_PER_DIRECTION);
        for (const sid of specs) {
          if (seen.has(sid)) continue;
          add(sid, "spec", pd + 1, axisColors.spec);
          builtEdges.push({
            source: parentId,
            target: sid,
            color: axisColors.spec,
          });
          if (expanded.has(sid)) next.push({ id: sid, depth: pd + 1 });
        }
      }
      specFrontier = next;
    }

    // Dagre layout, left-to-right with generalizations on the left.
    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: "LR",
      ranksep: 90,
      nodesep: 24,
      edgesep: 8,
      marginx: 40,
      marginy: 40,
    });
    g.setDefaultEdgeLabel(() => ({}));
    for (const n of builtNodes) {
      const isCenter = n.role === "center";
      g.setNode(n.id, {
        width: isCenter ? CENTER_W : NODE_W,
        height: isCenter ? CENTER_H : NODE_H,
      });
    }
    for (const e of builtEdges) g.setEdge(e.source, e.target);
    dagre.layout(g);

    const rfNodes: Node[] = builtNodes.map((n) => {
      const p = g.node(n.id);
      const isCenter = n.role === "center";
      const w = isCenter ? CENTER_W : NODE_W;
      const h = isCenter ? CENTER_H : NODE_H;
      return {
        id: n.id,
        type: "graph",
        position: { x: p.x - w / 2, y: p.y - h / 2 },
        data: {
          title: n.title,
          role: n.role,
          depth: n.depth,
          color: n.color,
          partsCount: n.partsCount,
          isPartOfCount: n.isPartOfCount,
          canExpand: n.canExpand,
          isExpanded: n.isExpanded,
        } as unknown as Record<string, unknown>,
        draggable: false,
        selectable: false,
      };
    });

    const rfEdges: Edge[] = builtEdges.map((e, idx) => ({
      id: `e${idx}-${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      type: "default",
      animated: false,
      style: { stroke: e.color, strokeWidth: 1.6, strokeOpacity: 0.7 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: e.color,
        width: 16,
        height: 16,
      },
    }));

    return { nodes: rfNodes, edges: rfEdges };
  }, [currentVisibleNode, relatedNodes, axisColors, expanded]);

  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

  // Re-fit on focus change.
  useEffect(() => {
    if (!rfInstance) return;
    const t = setTimeout(() => {
      rfInstance.fitView({ padding: 0.12, duration: 320 });
    }, 60);
    return () => clearTimeout(t);
  }, [rfInstance, currentVisibleNode.id, nodes.length]);

  // Click = toggle expansion, but only on nodes that actually have something
  // to expand or collapse. Otherwise we'd be mutating the `expanded` set on
  // leaf nodes with no outward neighbours, which silently adds them, flips
  // `isExpanded`, and makes the "−" badge appear for no functional reason.
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (!node.id || node.id === currentVisibleNode.id) return;
      const d = node.data as unknown as GraphNodeData;
      if (d.canExpand || d.isExpanded) {
        onToggleExpand(node.id);
      }
    },
    [onToggleExpand, currentVisibleNode.id],
  );

  // Empty-state guard — if the current node has no gen and no spec, the
  // graph would just be the solitary center node; skip it entirely.
  const hasContext =
    flattenIds(currentVisibleNode.generalizations).length > 0 ||
    flattenIds(currentVisibleNode.specializations).length > 0;
  if (!hasContext) return null;

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

        {/* Info pill — bottom-left, glass surface */}
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
            Click + to expand · click − to collapse ·{" "}
            {requireModifierToZoom ? "⌘-scroll or pinch to zoom" : "scroll to zoom"}{" "}
            · ▼ parts · ▲ is part of
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default React.memo(NodeGraph);
