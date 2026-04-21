import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Box,
  Dialog,
  DialogContent,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
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

import { ICollection, INode } from "@components/types/INode";
import {
  COMPASS,
  CompassAxis,
  computeCompassLayout,
} from "@components/lib/utils/compassLayout";

type Props = {
  currentVisibleNode: INode;
  relatedNodes: { [id: string]: INode };
  navigateToNode: (nodeId: string) => void;
  /** Height of the compass canvas. Pass a number (px) or any CSS length/calc string. Defaults to 540px. */
  height?: number | string;
  /** When true, strips the outer Paper chrome (rounded corners, shadow, header bar) so the compass fills its container edge-to-edge. */
  borderless?: boolean;
  /**
   * When true, plain wheel/two-finger-swipe no longer zooms — the page
   * scrolls behind the canvas instead. Zoom still works via Cmd/Ctrl+scroll
   * and trackpad pinch. Recommended on embedded pages; off by default.
   */
  requireModifierToZoom?: boolean;
};

const DEFAULT_HEIGHT = 540;
const LABEL_W = 260;
const LABEL_H = 40;

// Shared "glass" surface used by the bottom-right Controls, the top-left
// Back button, and the bottom-center info pill — for visual consistency.
const WIDGET_BG_DARK = "rgba(13,17,23,0.82)";
const WIDGET_BG_LIGHT = "rgba(255,255,255,0.92)";
const WIDGET_SHADOW_DARK =
  "0 6px 20px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)";
const WIDGET_SHADOW_LIGHT =
  "0 6px 20px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.05)";
const WIDGET_HOVER_DARK = "rgba(255,255,255,0.06)";
const WIDGET_HOVER_LIGHT = "rgba(0,0,0,0.04)";

const AXIS_META: Record<
  CompassAxis,
  { prefix: string; label: string; suffix: string }
> = {
  left: { prefix: "◀", label: "Generalizations", suffix: "" },
  right: { prefix: "", label: "Specializations", suffix: "▶" },
  top: { prefix: "▲", label: "Is Part Of", suffix: "" },
  bottom: { prefix: "▼", label: "Parts", suffix: "" },
};

const formatAxisPrimary = (axis: CompassAxis, count: number): string => {
  const m = AXIS_META[axis];
  return [m.prefix, m.label, `(${count})`, m.suffix]
    .filter(Boolean)
    .join(" ");
};

const targetSide: Record<CompassAxis, Position> = {
  left: Position.Right,
  right: Position.Left,
  top: Position.Bottom,
  bottom: Position.Top,
};

const flattenIds = (cols: ICollection[] | undefined | null): string[] => {
  if (!Array.isArray(cols)) return [];
  return cols
    .flatMap((c) => c?.nodes || [])
    .map((n) => n?.id)
    .filter((id): id is string => !!id);
};

// ──────────────────────────────────────────────────────────
// Custom node types
// ──────────────────────────────────────────────────────────

type CenterData = { title: string };

const CenterNode: React.FC<NodeProps> = ({ data }) => {
  const d = data as unknown as CenterData;
  return (
    <Box
      sx={{
        width: COMPASS.CW,
        height: COMPASS.CH,
        borderRadius: "16px",
        background: (t) =>
          t.palette.mode === "dark"
            ? `${t.palette.primary.main}1a`
            : `${t.palette.primary.main}10`,
        border: (t) => `2px solid ${t.palette.primary.main}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "10px 18px",
        userSelect: "none",
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
          lineHeight: 1.25,
          fontSize: "14px",
          fontWeight: 700,
          color: (t) => t.palette.text.primary,
        }}
      >
        {d.title}
      </Box>
      {(["Top", "Right", "Bottom", "Left"] as const).map((side) => (
        <Handle
          key={side}
          type="source"
          position={Position[side]}
          id={side.toLowerCase()}
          isConnectable={false}
          style={{
            opacity: 0,
            background: "transparent",
            border: "none",
            width: 1,
            height: 1,
            pointerEvents: "none",
          }}
        />
      ))}
    </Box>
  );
};

type SatelliteData = {
  title: string;
  color: string;
  axis: CompassAxis;
  nodeId: string;
};

const SatelliteNode: React.FC<NodeProps> = ({ data }) => {
  const d = data as unknown as SatelliteData;
  return (
    <Box
      sx={{
        width: COMPASS.N1W,
        height: COMPASS.N1H,
        borderRadius: "10px",
        background: (t) =>
          t.palette.mode === "dark"
            ? "rgba(22,27,34,0.92)"
            : "rgba(255,255,255,0.98)",
        border: `1.5px solid ${d.color}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "6px 10px",
        cursor: "pointer",
        userSelect: "none",
        transition: "background-color 0.15s ease",
        "&:hover": {
          background: (t) =>
            t.palette.mode === "dark" ? `${d.color}22` : `${d.color}14`,
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
          fontSize: "11px",
          fontWeight: 500,
          color: (t) => t.palette.text.primary,
        }}
      >
        {d.title}
      </Box>
      <Handle
        type="target"
        position={targetSide[d.axis]}
        isConnectable={false}
        style={{
          opacity: 0,
          background: "transparent",
          border: "none",
          width: 1,
          height: 1,
          pointerEvents: "none",
        }}
      />
    </Box>
  );
};

type LabelData = {
  primary: string;
  secondary?: string;
  color: string;
  anchor: "start" | "middle" | "end";
  axis: CompassAxis;
  clickable: boolean;
};

const LabelNode: React.FC<NodeProps> = ({ data }) => {
  const d = data as unknown as LabelData;
  const alignItems =
    d.anchor === "end"
      ? "flex-end"
      : d.anchor === "start"
        ? "flex-start"
        : "center";
  return (
    <Box
      sx={{
        width: LABEL_W,
        height: LABEL_H,
        display: "flex",
        flexDirection: "column",
        alignItems,
        justifyContent: "center",
        color: d.color,
        textTransform: "uppercase",
        opacity: d.clickable ? 0.95 : 0.7,
        cursor: d.clickable ? "pointer" : "default",
        userSelect: "none",
        whiteSpace: "nowrap",
        transition: "opacity 0.18s ease",
        "&:hover": d.clickable ? { opacity: 1 } : {},
      }}
    >
      <Box
        component="span"
        sx={{
          fontSize: "12px",
          fontWeight: 700,
          letterSpacing: "1.2px",
          lineHeight: 1.1,
        }}
      >
        {d.primary}
      </Box>
      {d.secondary && (
        <Box
          component="span"
          sx={{
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "1px",
            opacity: 0.8,
            mt: 0.4,
            lineHeight: 1,
          }}
        >
          {d.secondary}
        </Box>
      )}
    </Box>
  );
};

const nodeTypes: NodeTypes = {
  center: CenterNode,
  satellite: SatelliteNode,
  label: LabelNode,
};

// ──────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────

const NodeCompass: React.FC<Props> = ({
  currentVisibleNode,
  relatedNodes,
  navigateToNode,
  height = DEFAULT_HEIGHT,
  borderless = false,
  requireModifierToZoom = false,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const axisColors: Record<CompassAxis, string> = useMemo(
    () => ({
      left: isDark ? "#bc8cff" : "#8250df",
      right: theme.palette.primary.main,
      top: theme.palette.warning.main,
      bottom: theme.palette.success.main,
    }),
    [
      theme.palette.primary.main,
      theme.palette.warning.main,
      theme.palette.success.main,
      isDark,
    ],
  );

  // Inheritance-resolved parts
  const inheritanceRef = currentVisibleNode.inheritance?.parts?.ref ?? null;
  const inheritedFromNode = inheritanceRef ? relatedNodes[inheritanceRef] : null;
  const resolvedParts = useMemo<ICollection[] | null>(() => {
    if (inheritanceRef) {
      const inh = inheritedFromNode?.properties?.parts;
      return Array.isArray(inh) ? (inh as ICollection[]) : null;
    }
    const direct = currentVisibleNode.properties?.parts;
    return Array.isArray(direct) ? (direct as ICollection[]) : null;
  }, [
    inheritanceRef,
    inheritedFromNode,
    currentVisibleNode.properties?.parts,
  ]);

  const ids = useMemo(
    () => ({
      left: flattenIds(currentVisibleNode.generalizations),
      right: flattenIds(currentVisibleNode.specializations),
      top: flattenIds(
        currentVisibleNode.properties?.isPartOf as ICollection[] | undefined,
      ),
      bottom: flattenIds(resolvedParts),
    }),
    [currentVisibleNode, resolvedParts],
  );

  const layout = useMemo(
    () =>
      computeCompassLayout({
        centerId: currentVisibleNode.id,
        leftIds: ids.left,
        rightIds: ids.right,
        topIds: ids.top,
        bottomIds: ids.bottom,
      }),
    [currentVisibleNode.id, ids],
  );

  // Title map sourced directly from the focused node's own link arrays.
  // ILinkNode carries an optional `title` field — when present, we use it
  // instantly (no cache round-trip, no "…" flash).
  const linkTitles = useMemo<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    const collect = (cols?: ICollection[] | null) => {
      if (!Array.isArray(cols)) return;
      for (const c of cols) {
        for (const n of c?.nodes || []) {
          if (n?.id && n?.title) m[n.id] = n.title;
        }
      }
    };
    collect(currentVisibleNode.generalizations);
    collect(currentVisibleNode.specializations);
    collect(
      currentVisibleNode.properties?.isPartOf as ICollection[] | undefined,
    );
    collect(resolvedParts);
    return m;
  }, [currentVisibleNode, resolvedParts]);

  const lPad = layout.effectiveL1X + COMPASS.N1W / 2 + COMPASS.LABEL_PAD;
  const tPad = layout.effectiveL1Y + COMPASS.N1H / 2 + COMPASS.LABEL_PAD;

  const { nodes, edges } = useMemo(() => {
    const ns: Node[] = [];
    const es: Edge[] = [];

    ns.push({
      id: "__center__",
      type: "center",
      position: {
        x: layout.center.x - layout.center.w / 2,
        y: layout.center.y - layout.center.h / 2,
      },
      data: { title: currentVisibleNode.title } as unknown as Record<
        string,
        unknown
      >,
      draggable: false,
      selectable: false,
    });

    layout.satellites.forEach((s) => {
      const id = `sat-${s.axis}-${s.id}`;
      ns.push({
        id,
        type: "satellite",
        position: { x: s.x - s.w / 2, y: s.y - s.h / 2 },
        data: {
          title:
            linkTitles[s.id] || relatedNodes[s.id]?.title || "…",
          color: axisColors[s.axis],
          axis: s.axis,
          nodeId: s.id,
        } as unknown as Record<string, unknown>,
        draggable: false,
        selectable: false,
      });
      es.push({
        id: `e-${id}`,
        source: "__center__",
        sourceHandle: s.axis,
        target: id,
        type: "default",
        animated: false,
        style: {
          stroke: axisColors[s.axis],
          strokeWidth: 1.8,
          strokeOpacity: 0.7,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: axisColors[s.axis],
          width: 18,
          height: 18,
        },
      });
    });

    const labelDefs: Array<{
      axis: CompassAxis;
      x: number;
      y: number;
      anchor: "start" | "middle" | "end";
    }> = [
      { axis: "left", x: -lPad, y: 0, anchor: "end" },
      { axis: "right", x: lPad, y: 0, anchor: "start" },
      { axis: "top", x: 0, y: -tPad, anchor: "middle" },
      { axis: "bottom", x: 0, y: tPad, anchor: "middle" },
    ];

    labelDefs.forEach((lbl) => {
      const total = ids[lbl.axis].length;
      if (total === 0) return;
      const ov = layout.overflow.find((o) => o.axis === lbl.axis);
      const primary = formatAxisPrimary(lbl.axis, total);
      const secondary = ov ? `(+${ov.total - ov.shown} more)` : undefined;

      // React Flow positions nodes by their top-left corner; compensate so
      // the visual anchor lands at (lbl.x, lbl.y).
      const px =
        lbl.anchor === "end"
          ? lbl.x - LABEL_W
          : lbl.anchor === "middle"
            ? lbl.x - LABEL_W / 2
            : lbl.x;

      ns.push({
        id: `lbl-${lbl.axis}`,
        type: "label",
        position: { x: px, y: lbl.y - LABEL_H / 2 },
        data: {
          primary,
          secondary,
          color: axisColors[lbl.axis],
          anchor: lbl.anchor,
          axis: lbl.axis,
          clickable: !!ov,
        } as unknown as Record<string, unknown>,
        draggable: false,
        selectable: false,
      });
    });

    return { nodes: ns, edges: es };
  }, [
    layout,
    axisColors,
    currentVisibleNode.title,
    linkTitles,
    relatedNodes,
    ids,
    lPad,
    tPad,
  ]);

  // DEBUG: stable fingerprint of the rendered node set — changes iff the
  // set of satellite ids (or their positions) actually changes.
  const nodesSignature = useMemo(() => {
    return nodes
      .filter((n) => n.type === "satellite")
      .map((n) => `${n.id}@${Math.round(n.position.x)},${Math.round(n.position.y)}`)
      .join("|");
  }, [nodes]);

  // DEBUG: render counter so we can correlate with fitView runs
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;

  // DEBUG: fires every render — captures the state right when canvas goes blank
  useEffect(() => {
    const g = currentVisibleNode.generalizations;
    const s = currentVisibleNode.specializations;
    const ip = currentVisibleNode.properties?.isPartOf as
      | ICollection[]
      | undefined;
    const p = currentVisibleNode.properties?.parts as
      | ICollection[]
      | undefined;
    const count = (cols?: ICollection[] | null) =>
      Array.isArray(cols)
        ? cols.reduce((a, c) => a + (c?.nodes?.length ?? 0), 0)
        : null;
    // eslint-disable-next-line no-console
    console.log("[NodeCompass]", {
      render: renderCountRef.current,
      nodeId: currentVisibleNode.id,
      title: currentVisibleNode.title,
      currentVisibleNodeRef: currentVisibleNode, // object identity — check (===) across logs
      rawCollectionLen: {
        generalizations: Array.isArray(g) ? g.length : null,
        specializations: Array.isArray(s) ? s.length : null,
        isPartOf: Array.isArray(ip) ? ip.length : null,
        parts: Array.isArray(p) ? p.length : null,
      },
      rawNodeCount: {
        generalizations: count(g),
        specializations: count(s),
        isPartOf: count(ip),
        parts: count(p),
      },
      inheritanceRef,
      inheritedFromLoaded: !!inheritedFromNode,
      resolvedPartsLen: resolvedParts?.length ?? null,
      idsLen: {
        left: ids.left.length,
        right: ids.right.length,
        top: ids.top.length,
        bottom: ids.bottom.length,
      },
      satellites: layout.satellites.length,
      rfNodes: nodes.length,
      rfEdges: edges.length,
      nodesSignature, // stable fingerprint — if this changes between renders, identities drifted
      firstSat: layout.satellites[0]
        ? {
            x: layout.satellites[0].x,
            y: layout.satellites[0].y,
            id: layout.satellites[0].id,
          }
        : null,
      relatedNodesKeys: Object.keys(relatedNodes).length,
    });
  });

  const [overflowAxis, setOverflowAxis] = useState<CompassAxis | null>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

  // Local navigation history for the back button (does not interfere with
  // the platform's URL hash navigation).
  const historyRef = useRef<string[]>([]);
  const skipNextPushRef = useRef(false);
  const lastIdRef = useRef<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    const newId = currentVisibleNode.id;
    const lastId = lastIdRef.current;
    if (lastId && lastId !== newId) {
      if (skipNextPushRef.current) {
        skipNextPushRef.current = false;
      } else {
        historyRef.current.push(lastId);
        if (historyRef.current.length > 50) historyRef.current.shift();
      }
    }
    lastIdRef.current = newId;
    setCanGoBack(historyRef.current.length > 0);
  }, [currentVisibleNode.id]);

  const handleBack = useCallback(() => {
    const prev = historyRef.current.pop();
    if (prev) {
      skipNextPushRef.current = true;
      navigateToNode(prev);
      setCanGoBack(historyRef.current.length > 0);
    }
  }, [navigateToNode]);

  // Re-fit when the focused node changes
  useEffect(() => {
    if (!rfInstance) return;
    const t = setTimeout(() => {
      // Compare what ReactFlow's internal store holds vs what we passed as
      // props. If internalCount < rfNodes, RF hasn't committed the new set;
      // if the ids differ from nodesSignature, they've drifted apart.
      const internalNodes = rfInstance.getNodes();
      const internalSig = internalNodes
        .filter((n) => n.type === "satellite")
        .map(
          (n) =>
            `${n.id}@${Math.round(n.position.x)},${Math.round(n.position.y)}`,
        )
        .join("|");
      // Ground-truth DOM state + viewport
      const container = document.getElementById("property-compass");
      const domNodeCount =
        container?.querySelectorAll(".react-flow__node").length ?? null;
      const rfViewportEl = document.querySelector(
        "#property-compass .react-flow__viewport",
      ) as HTMLElement | null;
      const rfRendererEl = document.querySelector(
        "#property-compass .react-flow__renderer",
      ) as HTMLElement | null;
      // eslint-disable-next-line no-console
      console.log("[NodeCompass] fitView firing", {
        nodeId: currentVisibleNode.id,
        propNodes: nodes.length,
        internalCount: internalNodes.length,
        propSig: nodesSignature,
        internalSig,
        sigMatches: internalSig === nodesSignature,
        firstInternal: internalNodes[0]
          ? {
              id: internalNodes[0].id,
              x: internalNodes[0].position.x,
              y: internalNodes[0].position.y,
            }
          : null,
        viewportBefore: rfInstance.getViewport(),
        domNodeCount,
        viewportTransform: rfViewportEl?.style.transform ?? null,
        rendererSize: rfRendererEl
          ? { w: rfRendererEl.clientWidth, h: rfRendererEl.clientHeight }
          : null,
      });
      rfInstance.fitView({ padding: 0.18, duration: 320 });
      // Log state again once the fitView animation has settled.
      setTimeout(() => {
        const after = rfInstance.getViewport();
        const domAfter =
          document
            .getElementById("property-compass")
            ?.querySelectorAll(".react-flow__node").length ?? null;
        const renderer = document.querySelector(
          "#property-compass .react-flow__renderer",
        ) as HTMLElement | null;
        // eslint-disable-next-line no-console
        console.log("[NodeCompass] fitView settled", {
          nodeId: currentVisibleNode.id,
          viewportAfter: after,
          domNodeCount: domAfter,
          rendererSize: renderer
            ? { w: renderer.clientWidth, h: renderer.clientHeight }
            : null,
        });
      }, 400);
    }, 60);
    return () => clearTimeout(t);
  }, [rfInstance, currentVisibleNode.id, nodes.length, nodesSignature]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === "satellite") {
        const sid = (node.data as unknown as SatelliteData)?.nodeId;
        if (sid) navigateToNode(sid);
      } else if (node.type === "label") {
        const d = node.data as unknown as LabelData;
        if (d.clickable) setOverflowAxis(d.axis);
      }
    },
    [navigateToNode],
  );

  const titleOf = useCallback(
    (id: string): string =>
      linkTitles[id] || relatedNodes[id]?.title || "…",
    [linkTitles, relatedNodes],
  );

  if (
    ids.left.length === 0 &&
    ids.right.length === 0 &&
    ids.top.length === 0 &&
    ids.bottom.length === 0
  ) {
    return null;
  }

  return (
    <Paper
      id="property-compass"
      elevation={borderless ? 0 : 9}
      sx={{
        borderRadius: borderless ? 0 : "30px",
        borderBottomRightRadius: borderless ? 0 : "18px",
        borderBottomLeftRadius: borderless ? 0 : "18px",
        width: "100%",
        height: borderless ? "100%" : "auto",
        overflow: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        background: borderless ? "transparent" : undefined,
        // React Flow controls — glass surface, no hard border
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
      {!borderless && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            background: (t) =>
              t.palette.mode === "dark" ? "#242425" : "#d0d5dd",
            p: 3,
            gap: "10px",
          }}
        >
          <Typography
            sx={{
              fontSize: "20px",
              fontWeight: 500,
              fontFamily: "Roboto, sans-serif",
              padding: "4px",
            }}
          >
            Compass Explorer
          </Typography>
        </Box>
      )}
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
            fitViewOptions={{ padding: 0.18 }}
            minZoom={0.25}
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

        {/* Back button — top-left, glass surface */}
        <Tooltip
          title={canGoBack ? "" : "Nothing to go back to"}
          placement="right"
        >
          <span
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              zIndex: 10,
              display: "inline-flex",
            }}
          >
            <IconButton
              size="small"
              onClick={handleBack}
              disabled={!canGoBack}
              sx={{
                height: 32,
                px: 1.25,
                gap: 0.5,
                borderRadius: "10px",
                color: "text.primary",
                background: (t) =>
                  t.palette.mode === "dark"
                    ? WIDGET_BG_DARK
                    : WIDGET_BG_LIGHT,
                backdropFilter: "blur(8px)",
                boxShadow: (t) =>
                  t.palette.mode === "dark"
                    ? WIDGET_SHADOW_DARK
                    : WIDGET_SHADOW_LIGHT,
                transition: "background 0.15s ease, opacity 0.15s ease",
                "& svg": {
                  fontSize: 18,
                  transition: "transform 0.15s ease",
                },
                "&:hover": {
                  background: (t) =>
                    t.palette.mode === "dark"
                      ? "rgba(13,17,23,0.95)"
                      : "rgba(255,255,255,1)",
                  "& svg": { transform: "translateX(-2px)" },
                },
                "&.Mui-disabled": {
                  opacity: 0.45,
                  color: "text.disabled",
                  background: (t) =>
                    t.palette.mode === "dark"
                      ? WIDGET_BG_DARK
                      : WIDGET_BG_LIGHT,
                  boxShadow: (t) =>
                    t.palette.mode === "dark"
                      ? WIDGET_SHADOW_DARK
                      : WIDGET_SHADOW_LIGHT,
                },
              }}
            >
              <ArrowBackRoundedIcon />
              <Typography
                component="span"
                sx={{
                  fontSize: "12px",
                  fontWeight: 500,
                  letterSpacing: 0.2,
                  lineHeight: 1,
                }}
              >
                Back
              </Typography>
            </IconButton>
          </span>
        </Tooltip>

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
          Click a node to navigate · Drag to pan ·{" "}
          {requireModifierToZoom ? "⌘-scroll or pinch to zoom" : "Scroll to zoom"}
        </Box>
      </Box>

      <Dialog
        open={overflowAxis !== null}
        onClose={() => setOverflowAxis(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "20px",
            overflow: "hidden",
            backgroundImage: "none",
            background: (t) =>
              t.palette.mode === "dark" ? "#0a0b0d" : "#ffffff",
            border: (t) =>
              `1px solid ${
                t.palette.mode === "dark"
                  ? alpha("#ffffff", 0.06)
                  : t.palette.divider
              }`,
            boxShadow: (t) =>
              t.palette.mode === "dark"
                ? "0 24px 60px rgba(0,0,0,0.6)"
                : "0 24px 60px rgba(0,0,0,0.12)",
          },
        }}
      >
        {overflowAxis &&
          (() => {
            const color = axisColors[overflowAxis];
            const cleanLabel = AXIS_META[overflowAxis].label;
            const allIds = ids[overflowAxis];

            return (
              <>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 1,
                    px: 2.5,
                    py: 2,
                    borderBottom: (t) =>
                      `1px solid ${
                        t.palette.mode === "dark"
                          ? alpha("#ffffff", 0.08)
                          : alpha("#000000", 0.08)
                      }`,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: "1rem",
                      fontWeight: 600,
                      letterSpacing: 0.2,
                    }}
                  >
                    {cleanLabel}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "0.82rem",
                      fontWeight: 500,
                      color: "text.secondary",
                      fontVariantNumeric: "tabular-nums",
                      flex: 1,
                    }}
                  >
                    ({allIds.length} {allIds.length === 1 ? "node" : "nodes"})
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => setOverflowAxis(null)}
                    sx={{
                      alignSelf: "center",
                      color: "text.secondary",
                      "&:hover": { color: "text.primary" },
                    }}
                  >
                    <CloseRoundedIcon fontSize="small" />
                  </IconButton>
                </Box>

                <DialogContent
                  sx={{
                    p: 1.5,
                    "&::-webkit-scrollbar": { width: 8 },
                    "&::-webkit-scrollbar-track": { background: "transparent" },
                    "&::-webkit-scrollbar-thumb": {
                      background: (t) =>
                        t.palette.mode === "dark"
                          ? alpha("#ffffff", 0.12)
                          : alpha("#000000", 0.18),
                      borderRadius: 4,
                      transition: "background 0.15s ease",
                    },
                    "&::-webkit-scrollbar-thumb:hover": {
                      background: (t) =>
                        t.palette.mode === "dark"
                          ? alpha("#ffffff", 0.22)
                          : alpha("#000000", 0.32),
                    },
                    scrollbarWidth: "thin",
                    scrollbarColor: (t) =>
                      t.palette.mode === "dark"
                        ? `${alpha("#ffffff", 0.12)} transparent`
                        : `${alpha("#000000", 0.18)} transparent`,
                  }}
                >
                  <Stack spacing={0.5}>
                    {allIds.map((id, idx) => (
                      <Box
                        key={id}
                        onClick={() => {
                          setOverflowAxis(null);
                          navigateToNode(id);
                        }}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1.5,
                          px: 1.5,
                          py: 1.1,
                          borderRadius: "12px",
                          cursor: "pointer",
                          transition: "background-color 0.15s ease",
                          "&:hover": {
                            background: alpha(color, 0.1),
                            "& .compass-overflow-chevron": {
                              opacity: 1,
                              transform: "translateX(0)",
                            },
                          },
                        }}
                      >
                        <Box
                          sx={{
                            minWidth: 28,
                            height: 22,
                            px: 0.75,
                            borderRadius: "7px",
                            background: alpha(color, 0.13),
                            color: color,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            fontVariantNumeric: "tabular-nums",
                            flexShrink: 0,
                          }}
                        >
                          {idx + 1}
                        </Box>
                        <Typography
                          sx={{
                            flex: 1,
                            fontSize: "0.9rem",
                            fontWeight: 500,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            color: "text.primary",
                          }}
                        >
                          {titleOf(id)}
                        </Typography>
                        <ChevronRightRoundedIcon
                          className="compass-overflow-chevron"
                          sx={{
                            fontSize: 20,
                            color: color,
                            opacity: 0,
                            transform: "translateX(-6px)",
                            transition:
                              "opacity 0.18s ease, transform 0.18s ease",
                            flexShrink: 0,
                          }}
                        />
                      </Box>
                    ))}
                  </Stack>
                </DialogContent>
              </>
            );
          })()}
      </Dialog>
    </Paper>
  );
};

export default React.memo(NodeCompass);
