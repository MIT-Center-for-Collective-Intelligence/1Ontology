import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Background,
  BackgroundVariant,
  EdgeTypes,
  OnNodeDrag,
  OnSelectionChangeFunc,
  ReactFlow,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Box, Paper, useTheme } from "@mui/material";
import { IActivity, IAlgorithm } from "@components/types/INode";
import {
  FlowGenerator,
  FlowNode,
  Insert,
  Kind,
  Placement,
} from "./FlowGenerator";
import { nodeTypes } from "./NodeComponent";
import OrthoEdge from "./OrthoEdge";
import {
  ControlPanel,
  FlowMiniMap,
  KindMenu,
  LegendPanel,
  PANEL_WIDTH,
  PartOption,
  PerformanceModelPanel,
  StepPanel,
} from "./FlowUIComponents";
import {
  Container,
  StepPatch,
  defaultStep,
  insertStep,
  moveStep,
  nextStepId,
  removeStep,
  updateStep,
} from "./flowEdits";
import { FlowEditContext, FlowEditContextValue } from "./editContext";

const edgeTypes: EdgeTypes = { ortho: OrthoEdge };

const FIT = { padding: 0.08, maxZoom: 1, duration: 200 };
// Tall enough for the legend, formula and minimap overlays to fit.
const MIN_CANVAS = 440;
const MIN_CANVAS_EDITING = 520;
const MAX_CANVAS = 760;
const CANVAS_PAD = 48;

/** Elements the user can select and drag; frames and bars also receive drops. */
const STEP_TYPES = new Set(["task", "decision"]);
const SELECTABLE_TYPES = new Set(["task", "decision", "frame"]);
const DROP_TYPES = new Set(["task", "decision", "frame", "bar"]);

interface AlgorithmFlowVisualizerProps {
  algorithm: IAlgorithm;
  isDarkMode: boolean;
  editing?: boolean;
  parts?: PartOption[];
  onChange?: (next: IAlgorithm) => void;
}

/**
 * Flowchart of one algorithm. Must be rendered inside a ReactFlowProvider
 * (NodeActivityFlow supplies it). In edit mode the layout stays computed:
 * "+" buttons insert steps, the panel edits the selected one, and dragging a
 * step onto another moves it in the tree before the chart re-lays out.
 */
const AlgorithmFlowVisualizer: React.FC<AlgorithmFlowVisualizerProps> = ({
  algorithm,
  isDarkMode,
  editing = false,
  parts = [],
  onChange,
}) => {
  const theme = useTheme();
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  const { nodes, edges, width, height } = useMemo(
    () => new FlowGenerator(isDarkMode, editing).generateFlow(algorithm),
    [algorithm, isDarkMode, editing],
  );

  // Selection is tracked by step id so it survives re-layouts and new inserts.
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [pendingSelect, setPendingSelect] = useState<string | null>(null);
  const [insertAt, setInsertAt] = useState<{
    insert: Insert;
    anchor: HTMLElement;
  } | null>(null);
  useEffect(() => {
    if (!editing) {
      setSelectedStepId(null);
      setInsertAt(null);
    }
  }, [editing]);
  useEffect(() => {
    if (pendingSelect === null) return;
    if (nodes.some((n) => n.data.activityId === pendingSelect)) {
      setSelectedStepId(pendingSelect);
      setPendingSelect(null);
    }
  }, [nodes, pendingSelect]);

  const laidOut = useMemo(
    () =>
      nodes.map((n) => {
        const type = n.type ?? "";
        const selectable = editing && SELECTABLE_TYPES.has(type);
        return {
          ...n,
          draggable: editing && (STEP_TYPES.has(type) || type === "frame"),
          selectable,
          selected:
            selectable &&
            !!selectedStepId &&
            n.data.activityId === selectedStepId,
        };
      }),
    [nodes, editing, selectedStepId],
  );
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<FlowNode>(laidOut);
  useEffect(() => setRfNodes(laidOut), [laidOut, setRfNodes]);

  const selectedNode = useMemo(
    () =>
      selectedStepId
        ? (nodes.find(
            (n) =>
              SELECTABLE_TYPES.has(n.type ?? "") &&
              n.data.activityId === selectedStepId,
          ) ?? null)
        : null,
    [nodes, selectedStepId],
  );
  const selectedStep = (selectedNode?.data.activity as IActivity) ?? null;
  const panelOpen = editing && !!selectedStep;

  const onSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: picked }) => {
      const first = picked[0] as FlowNode | undefined;
      setSelectedStepId(first?.data.activityId ?? null);
    },
    [],
  );

  const wrapRef = useRef<HTMLDivElement>(null);
  const [wrapWidth, setWrapWidth] = useState(0);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWrapWidth(entry.contentRect.width),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Canvas follows the chart at the zoom fit-to-width will pick, so wide
  // flows don't leave a tall empty canvas and short flows don't float.
  const usableWidth = Math.max(0, wrapWidth - (panelOpen ? PANEL_WIDTH : 0));
  const fitZoom = usableWidth
    ? Math.min(1, (usableWidth * (1 - 2 * FIT.padding)) / width)
    : 1;
  const canvasHeight = Math.min(
    MAX_CANVAS,
    Math.max(
      editing ? MIN_CANVAS_EDITING : MIN_CANVAS,
      height * fitZoom + CANVAS_PAD,
    ),
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => fitView(FIT));
    return () => cancelAnimationFrame(frame);
  }, [nodes, canvasHeight, fitView]);

  const handleFit = useCallback(() => fitView(FIT), [fitView]);

  const commit = useCallback(
    (next: IAlgorithm | null) => {
      if (next && onChange) onChange(next);
      else setRfNodes(laidOut);
    },
    [onChange, laidOut, setRfNodes],
  );

  /** Drop target = smallest laid-out element under the dragged card's center. */
  const onNodeDragStop: OnNodeDrag<FlowNode> = useCallback(
    (_event, dragged) => {
      const step = dragged.data.activity as IActivity | undefined;
      if (!step) return commit(null);
      const cx = dragged.position.x + (dragged.width ?? 0) / 2;
      const cy = dragged.position.y + (dragged.height ?? 0) / 2;
      let best: FlowNode | null = null;
      for (const n of nodes) {
        if (n.id === dragged.id || !n.data.activity) continue;
        if (!DROP_TYPES.has(n.type ?? "")) continue;
        const w = n.width ?? 0;
        const h = n.height ?? 0;
        const inside =
          cx >= n.position.x &&
          cx <= n.position.x + w &&
          cy >= n.position.y &&
          cy <= n.position.y + h;
        if (!inside) continue;
        if (!best || w * h < (best.width ?? 0) * (best.height ?? 0)) best = n;
      }
      if (!best) return commit(null);
      const target = best.data.activity as Container;
      let placement: Placement = "inside";
      if (STEP_TYPES.has(best.type ?? "")) {
        placement =
          cy < best.position.y + (best.height ?? 0) / 2 ? "before" : "after";
      }
      commit(moveStep(algorithm, step, target, placement));
    },
    [nodes, algorithm, commit],
  );

  const handlePickKind = useCallback(
    (kind: Kind) => {
      if (!insertAt) return;
      const id = nextStepId(algorithm);
      const { target, placement } = insertAt.insert;
      setInsertAt(null);
      setPendingSelect(id);
      commit(insertStep(algorithm, target, placement, defaultStep(kind, id)));
    },
    [insertAt, algorithm, commit],
  );

  const handlePatch = useCallback(
    (patch: StepPatch) => {
      if (selectedStep) commit(updateStep(algorithm, selectedStep, patch));
    },
    [selectedStep, algorithm, commit],
  );

  const handleDelete = useCallback(() => {
    if (!selectedStep) return;
    setSelectedStepId(null);
    commit(removeStep(algorithm, selectedStep));
  }, [selectedStep, algorithm, commit]);

  const editContext = useMemo<FlowEditContextValue>(
    () => ({
      editing,
      onInsert: (insert, anchor) => setInsertAt({ insert, anchor }),
    }),
    [editing],
  );

  return (
    <FlowEditContext.Provider value={editContext}>
      <Paper
        ref={wrapRef}
        elevation={0}
        sx={{
          position: "relative",
          height: canvasHeight,
          mx: 2,
          borderRadius: 2,
          overflow: "hidden",
          border: `1px solid ${theme.palette.mode === "dark" ? "#2a2f36" : "#e3e7ec"}`,
          bgcolor: theme.palette.mode === "dark" ? "#15181c" : "#f4f6f8",
          "& .react-flow__node.draggable": { cursor: "grab" },
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            right: panelOpen ? PANEL_WIDTH : 0,
          }}
        >
          <ReactFlow
            nodes={rfNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onNodeDragStop={onNodeDragStop}
            onSelectionChange={onSelectionChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={FIT}
            minZoom={0.35}
            maxZoom={2}
            nodesDraggable={editing}
            nodesConnectable={false}
            elementsSelectable={editing}
            selectNodesOnDrag={false}
            deleteKeyCode={null}
            zoomOnScroll={false}
            panOnScroll={false}
            preventScrolling={false}
            zoomOnDoubleClick={false}
            proOptions={{ hideAttribution: true }}
            colorMode={theme.palette.mode === "dark" ? "dark" : "light"}
          >
            <ControlPanel
              onZoomIn={() => zoomIn({ duration: 150 })}
              onZoomOut={() => zoomOut({ duration: 150 })}
              onFitView={handleFit}
            />
            <LegendPanel />
            <PerformanceModelPanel algorithm={algorithm} />
            {!panelOpen && <FlowMiniMap />}
            <Background
              variant={BackgroundVariant.Dots}
              gap={18}
              size={1}
              color={isDarkMode ? "#262b31" : "#d3d8de"}
            />
          </ReactFlow>
        </Box>
        {panelOpen && selectedStep && selectedNode && (
          <StepPanel
            step={selectedStep}
            kind={selectedNode.data.kind}
            parts={parts}
            onPatch={handlePatch}
            onDelete={handleDelete}
            onClose={() => setSelectedStepId(null)}
          />
        )}
      </Paper>
      <KindMenu
        anchor={insertAt?.anchor ?? null}
        onPick={handlePickKind}
        onClose={() => setInsertAt(null)}
      />
    </FlowEditContext.Provider>
  );
};

export default AlgorithmFlowVisualizer;
