import React, {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "@mui/material";
import CopyTitleButton from "./CopyTitleButton";
import { wrapLabel } from "@components/lib/utils/wrapLabel";
import styles from "./ClustersGraph.module.css";

export type ClustersGraphRow = {
  id: string;
  nodeId: string;
  name: string;
  category: boolean;
  oNetTask?: boolean;
  children: ClustersGraphRow[];
};

type ClustersGraphProps = {
  tree: ClustersGraphRow[];
  expanded: Set<string>;
  hiddenCounts: Record<string, number>;
  selectedId: string | null;
  pulse: { nodeId: string; key: number } | null;
  maxLabelChars: number;
  oNetTaskFill: string;
  onNodeClick: (key: string, isCategory: boolean) => void;
  onToggle: (key: string) => void;
  onShowHidden: (key: string) => void;
};

type ClusterNodeData = {
  key: string;
  title: string;
  lines: string[];
  width: number;
  height: number;
  fill: string;
  isCategory: boolean;
  isSelected: boolean;
  badgeCount: number;
  badgeKind: "expand" | "hidden";
  pulseKey: number | null;
};

type ClusterNode = Node<ClusterNodeData, "cluster">;

const SELECTED_FILL = "#87D37C";
export const CATEGORY_FILL = "#ffbe48";
export const DEFAULT_FILL = "#ffffff";
const EDGE_COLOR = "#ff9a3c";
const HOVER_COLOR = "#22c55e";
const HOVERED_EDGE = {
  zIndex: 1,
  style: { stroke: HOVER_COLOR, strokeWidth: 2.5 },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: HOVER_COLOR,
    width: 10,
    height: 10,
  },
};
const FIT_VIEW_OPTIONS = { padding: 0.2, maxZoom: 1 };
const PRO_OPTIONS = { hideAttribution: true };
const FLOW_STYLE = { background: "transparent" };
const FONT = '500 14px Roboto, "Helvetica Neue", Arial, sans-serif';
const LINE_HEIGHT = 18;
const PADDING_X = 14;
const PADDING_Y = 10;

const COLUMN_GAP = 96;
const ROW_GAP = 14;

let measureContext: CanvasRenderingContext2D | null = null;
const textWidth = (text: string) => {
  if (!measureContext) {
    measureContext = document.createElement("canvas").getContext("2d");
    if (measureContext) measureContext.font = FONT;
  }
  return measureContext ? measureContext.measureText(text).width : text.length * 8;
};

const labelSizes = new Map<
  string,
  { lines: string[]; width: number; height: number }
>();
const labelSize = (name: string, maxLabelChars: number) => {
  const cacheKey = `${maxLabelChars}\u0000${name}`;
  let size = labelSizes.get(cacheKey);
  if (!size) {
    const lines = wrapLabel(name, maxLabelChars).split("\n");
    size = {
      lines,
      width: Math.ceil(Math.max(40, ...lines.map(textWidth)) + PADDING_X * 2 + 6),
      height: lines.length * LINE_HEIGHT + PADDING_Y * 2 + 2,
    };
    labelSizes.set(cacheKey, size);
  }
  return size;
};

const keyOf = (row: ClustersGraphRow) =>
  row.category ? row.id : row.nodeId || row.id;

// Tree layout in one pass: each node sits in its depth's column, leaves are
// stacked top to bottom and parents are centered on their children. A node
// reached from several parents is placed under the first; the other parents
// still get an edge to it.
const layoutGraph = ({
  tree,
  expanded,
  hiddenCounts,
  selectedId,
  pulse,
  maxLabelChars,
  oNetTaskFill,
}: Omit<
  ClustersGraphProps,
  "onNodeClick" | "onToggle" | "onShowHidden"
>) => {
  const rows = new Map<string, ClustersGraphRow>();
  const depthOf = new Map<string, number>();
  const placedUnder = new Map<string, string[]>();
  const roots: string[] = [];
  const walked = new Set<string>();
  const edgePairs = new Map<string, [string, string]>();

  const visit = (row: ClustersGraphRow, parentKey: string | null, depth: number) => {
    const key = keyOf(row);
    const known = rows.get(key);
    if (!known || row.children.length > known.children.length) {
      rows.set(key, row);
    }
    if (!depthOf.has(key)) {
      depthOf.set(key, depth);
      placedUnder.set(key, []);
      if (parentKey === null) roots.push(key);
      else placedUnder.get(parentKey)!.push(key);
    }
    if (!expanded.has(key) || walked.has(key)) return;
    walked.add(key);
    for (const child of row.children) {
      visit(child, key, depth + 1);
      const childKey = keyOf(child);
      edgePairs.set(`${key}->${childKey}`, [key, childKey]);
    }
  };
  tree.forEach((row) => visit(row, null, 0));

  const data = new Map<string, ClusterNodeData>();
  const columnWidth: number[] = [];
  for (const [key, row] of rows) {
    const { lines, width, height } = labelSize(row.name || "", maxLabelChars);
    const depth = depthOf.get(key)!;
    columnWidth[depth] = Math.max(columnWidth[depth] ?? 0, width);
    const isExpanded = expanded.has(key);
    const isSelected = key === selectedId;
    data.set(key, {
      key,
      title: row.name || "",
      lines,
      width,
      height,
      fill: isSelected
        ? SELECTED_FILL
        : row.category
          ? CATEGORY_FILL
          : row.oNetTask
            ? oNetTaskFill
            : DEFAULT_FILL,
      isCategory: row.category,
      isSelected,
      badgeCount: isExpanded ? (hiddenCounts[key] ?? 0) : row.children.length,
      badgeKind: isExpanded ? "hidden" : "expand",
      pulseKey: pulse && pulse.nodeId === key ? pulse.key : null,
    });
  }

  const columnX: number[] = [];
  for (let depth = 0, x = 0; depth < columnWidth.length; depth++) {
    columnX[depth] = x;
    x += (columnWidth[depth] ?? 0) + COLUMN_GAP;
  }

  const centerY = new Map<string, number>();
  let cursor = 0;
  const place = (key: string) => {
    const { height } = data.get(key)!;
    const kids = placedUnder.get(key) ?? [];
    const start = cursor;
    kids.forEach(place);
    if (kids.length === 0 || cursor - start < height + ROW_GAP) {
      if (kids.length === 0) {
        cursor += height + ROW_GAP;
      } else {
        cursor = start + height + ROW_GAP;
      }
      centerY.set(key, start + (cursor - start - ROW_GAP) / 2);
      return;
    }
    const first = centerY.get(kids[0])!;
    const last = centerY.get(kids[kids.length - 1])!;
    centerY.set(key, (first + last) / 2);
  };
  roots.forEach(place);

  const centers = new Map<string, { x: number; y: number }>();
  const nodes: ClusterNode[] = [];
  for (const [key, nodeData] of data) {
    const left = columnX[depthOf.get(key)!];
    const top = centerY.get(key)! - nodeData.height / 2;
    centers.set(key, { x: left + nodeData.width / 2, y: centerY.get(key)! });
    nodes.push({
      id: key,
      type: "cluster",
      position: { x: left, y: top },
      width: nodeData.width,
      height: nodeData.height,
      zIndex: 2,
      data: nodeData,
      draggable: false,
      selectable: false,
      connectable: false,
    });
  }
  const edges: Edge[] = [...edgePairs.values()].map(([source, target]) => ({
    id: `${source}->${target}`,
    source,
    target,
    type: "default",
    style: { stroke: EDGE_COLOR, strokeWidth: 1.5 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: EDGE_COLOR,
      width: 14,
      height: 14,
    },
  }));
  return { nodes, edges, centers };
};

const ActionsContext = createContext<{
  onToggle: (key: string) => void;
  onShowHidden: (key: string) => void;
}>({ onToggle: () => {}, onShowHidden: () => {} });

const ClusterNodeView = memo(({ data }: NodeProps<ClusterNode>) => {
  const { onToggle, onShowHidden } = useContext(ActionsContext);
  const badgeTitle =
    data.badgeKind === "hidden"
      ? `${data.badgeCount} more specialization${data.badgeCount > 1 ? "s are" : " is"} hidden. Click to show ${data.badgeCount > 1 ? "them" : "it"}.`
      : `This ${data.isCategory ? "collection" : "node"} has ${data.badgeCount === 1 ? "a" : data.badgeCount} specialization${data.badgeCount > 1 ? "s" : ""} under it. Click to expand.`;
  return (
    <div
      className={`${styles.node} ${data.isSelected ? styles.selected : ""}`}
      style={{ width: data.width, height: data.height, background: data.fill }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className={styles.handle}
        isConnectable={false}
      />
      <span className={styles.label}>{data.lines.join("\n")}</span>
      <CopyTitleButton
        text={data.title}
        className={`nodrag nopan ${styles.copy}`}
        sx={{
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
          "&:hover": { bgcolor: "background.paper" },
        }}
      />
      {data.badgeCount > 0 && (
        <button
          type="button"
          className={`nodrag nopan ${styles.badge}`}
          title={badgeTitle}
          aria-label={badgeTitle}
          onClick={(event) => {
            event.stopPropagation();
            if (data.badgeKind === "hidden") onShowHidden(data.key);
            else onToggle(data.key);
          }}
        >
          {data.badgeCount}▸
        </button>
      )}
      {data.pulseKey !== null && (
        <span key={data.pulseKey} className={styles.pulse} />
      )}
      <Handle
        type="source"
        position={Position.Right}
        className={styles.handle}
        isConnectable={false}
      />
    </div>
  );
});
ClusterNodeView.displayName = "ClusterNodeView";

const nodeTypes = { cluster: ClusterNodeView };

const ClustersGraphCanvas = (props: ClustersGraphProps) => {
  const {
    tree,
    expanded,
    hiddenCounts,
    selectedId,
    pulse,
    maxLabelChars,
    oNetTaskFill,
    onNodeClick,
    onToggle,
    onShowHidden,
  } = props;
  const theme = useTheme();
  const { setCenter, getZoom, getViewport, setViewport } = useReactFlow();
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  const { nodes, edges, centers } = useMemo(
    () =>
      layoutGraph({
        tree,
        expanded,
        hiddenCounts,
        selectedId,
        pulse,
        maxLabelChars,
        oNetTaskFill,
      }),
    [tree, expanded, hiddenCounts, selectedId, pulse, maxLabelChars, oNetTaskFill],
  );

  const hoveredEdge = useMemo(
    () => (hoveredEdgeId ? edges.find((edge) => edge.id === hoveredEdgeId) : undefined),
    [edges, hoveredEdgeId],
  );
  const shownEdges = useMemo(
    () =>
      hoveredEdge
        ? edges.map((edge) => (edge === hoveredEdge ? { ...edge, ...HOVERED_EDGE } : edge))
        : edges,
    [edges, hoveredEdge],
  );
  const shownNodes = useMemo(
    () =>
      hoveredEdge
        ? nodes.map((node) =>
            node.id === hoveredEdge.source || node.id === hoveredEdge.target
              ? { ...node, className: styles.edgeEnd }
              : node,
          )
        : nodes,
    [nodes, hoveredEdge],
  );

  const onEdgeMouseEnter = useCallback(
    (_: React.MouseEvent, edge: Edge) => setHoveredEdgeId(edge.id),
    [],
  );
  const onEdgeMouseLeave = useCallback(() => setHoveredEdgeId(null), []);

  const panFromEdge = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      if (!(event.target as Element).closest?.(".react-flow__edge")) return;
      event.preventDefault();
      const start = getViewport();
      const { clientX, clientY } = event;
      const move = (e: PointerEvent) =>
        setViewport({
          x: start.x + e.clientX - clientX,
          y: start.y + e.clientY - clientY,
          zoom: start.zoom,
        });
      const stop = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", stop);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop);
      window.addEventListener("pointercancel", stop);
    },
    [getViewport, setViewport],
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) =>
      onNodeClick(node.id, (node.data as ClusterNodeData).isCategory),
    [onNodeClick],
  );

  const centerOn = useCallback(
    (key: string) => {
      const center = centers.get(key);
      if (!center) return false;
      setCenter(center.x, center.y, {
        zoom: Math.max(getZoom(), 0.9),
        duration: 500,
      });
      return true;
    },
    [centers, getZoom, setCenter],
  );

  const pendingCenter = useRef<string | null>(null);
  const lastSelected = useRef<string | null>(null);
  useEffect(() => {
    if (selectedId && selectedId !== lastSelected.current) {
      pendingCenter.current = selectedId;
    }
    lastSelected.current = selectedId;
    if (pendingCenter.current && centerOn(pendingCenter.current)) {
      pendingCenter.current = null;
    }
  }, [selectedId, centerOn]);

  const lastPulse = useRef<number | null>(null);
  useEffect(() => {
    if (!pulse || pulse.key === lastPulse.current) return;
    lastPulse.current = pulse.key;
    centerOn(pulse.nodeId);
  }, [pulse, centerOn]);

  const actions = useMemo(
    () => ({ onToggle, onShowHidden }),
    [onToggle, onShowHidden],
  );

  return (
    <ActionsContext.Provider value={actions}>
      <ReactFlow
        className={styles.flow}
        nodes={shownNodes}
        edges={shownEdges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onEdgeMouseEnter={onEdgeMouseEnter}
        onEdgeMouseLeave={onEdgeMouseLeave}
        onPointerDown={panFromEdge}
        colorMode={theme.palette.mode === "dark" ? "dark" : "light"}
        style={FLOW_STYLE}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        minZoom={0.05}
        maxZoom={2}
        onlyRenderVisibleElements
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnDoubleClick={false}
        proOptions={PRO_OPTIONS}
      >
        <Controls showInteractive={false} position="top-right" />
      </ReactFlow>
    </ActionsContext.Provider>
  );
};

const ClustersGraph = (props: ClustersGraphProps) => (
  <ReactFlowProvider>
    <ClustersGraphCanvas {...props} />
  </ReactFlowProvider>
);

export default memo(ClustersGraph);
