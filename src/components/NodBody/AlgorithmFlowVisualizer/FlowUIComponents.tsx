import React, { useEffect, useState } from "react";
import { MiniMap, Panel } from "@xyflow/react";
import {
  Autocomplete,
  Box,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import FitScreenIcon from "@mui/icons-material/FitScreen";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { IActivity, IAlgorithm } from "@components/types/INode";
import { FlowNode, Kind, conditionText, kindColor } from "./FlowGenerator";
import { KIND_LABEL, KindIcon, KindTile, useSurface } from "./NodeComponent";
import { StepPatch } from "./flowEdits";

export const PANEL_WIDTH = 320;

/** Frosted card used by every overlay panel on the canvas. */
const glass = (dark: boolean): React.CSSProperties => ({
  background: dark ? "rgba(30, 34, 40, 0.82)" : "rgba(255, 255, 255, 0.85)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  border: `1px solid ${dark ? "#343a44" : "#e3e7ec"}`,
  borderRadius: 10,
  boxShadow: dark
    ? "0 1px 2px rgba(0,0,0,0.5), 0 6px 16px rgba(0,0,0,0.35)"
    : "0 1px 2px rgba(16,24,40,0.06), 0 6px 16px rgba(16,24,40,0.06)",
});

const PanelTitle: React.FC<{ children: string }> = ({ children }) => (
  <Typography
    sx={{
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: "text.secondary",
    }}
  >
    {children}
  </Typography>
);

interface ControlPanelProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  /** Extra right margin while the properties panel is open. */
  offsetRight?: number;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  onZoomIn,
  onZoomOut,
  onFitView,
  offsetRight = 0,
}) => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const buttonSx = {
    bgcolor: dark ? "rgba(30,30,30,0.85)" : "rgba(255,255,255,0.9)",
    border: `1px solid ${dark ? "#3a3a3a" : "#ddd"}`,
    "&:hover": { bgcolor: dark ? "#333" : "#f0f0f0" },
  };
  return (
    <Panel
      position="top-right"
      style={{
        display: "flex",
        gap: 6,
        margin: 10,
        marginRight: 10 + offsetRight,
      }}
    >
      <Tooltip title="Zoom in">
        <IconButton size="small" onClick={onZoomIn} sx={buttonSx}>
          <ZoomInIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Zoom out">
        <IconButton size="small" onClick={onZoomOut} sx={buttonSx}>
          <ZoomOutIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Fit to view">
        <IconButton size="small" onClick={onFitView} sx={buttonSx}>
          <FitScreenIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Panel>
  );
};

const LEGEND: Kind[] = ["task", "sequential", "parallel", "condition", "loop"];

/** Legend card in the canvas' top-left corner. */
export const LegendPanel: React.FC = () => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  return (
    <Panel
      position="top-left"
      style={{ ...glass(dark), margin: 12, padding: "12px 16px 14px" }}
    >
      <PanelTitle>Legend</PanelTitle>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 1 }}>
        {LEGEND.map((kind) => (
          <Box
            key={kind}
            sx={{ display: "flex", alignItems: "center", gap: 1.25 }}
          >
            <Box
              sx={{
                width: 26,
                height: 26,
                borderRadius: "7px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: alpha(kindColor(kind, dark), dark ? 0.2 : 0.12),
                color: kindColor(kind, dark),
              }}
            >
              <KindIcon kind={kind} size={16} />
            </Box>
            <Typography
              sx={{ fontSize: 13, fontWeight: 500 }}
              color="text.primary"
            >
              {KIND_LABEL[kind]}
            </Typography>
          </Box>
        ))}
      </Box>
    </Panel>
  );
};

/** Collapsible formula card in the canvas' bottom-left corner. */
export const PerformanceModelPanel: React.FC<{ algorithm: IAlgorithm }> = ({
  algorithm,
}) => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const [open, setOpen] = useState(true);
  if (!algorithm.performance_model) return null;
  return (
    <Panel
      position="bottom-left"
      style={{
        ...glass(dark),
        margin: 10,
        padding: open ? "6px 10px 10px 12px" : "4px 6px 4px 12px",
        // Leaves room for the minimap on the same edge.
        maxWidth: "min(460px, calc(100% - 230px))",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <PanelTitle>Performance model</PanelTitle>
        <IconButton
          size="small"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Collapse" : "Expand"}
          sx={{ p: 0.25 }}
        >
          {open ? (
            <ExpandMoreIcon fontSize="small" />
          ) : (
            <ExpandLessIcon fontSize="small" />
          )}
        </IconButton>
      </Box>
      {open && (
        <Box
          sx={{
            mt: 0.6,
            borderRadius: "8px",
            px: 1.25,
            py: 0.75,
            bgcolor: dark ? "rgba(255,255,255,0.05)" : "rgba(16,24,40,0.04)",
            overflowX: "auto",
            "& p": { m: 0 },
            "& .katex": { fontSize: "0.95rem" },
          }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {`$${algorithm.performance_model}$`}
          </ReactMarkdown>
        </Box>
      )}
    </Panel>
  );
};

/** Minimap in the bottom-right corner, colored by activity kind. */
export const FlowMiniMap: React.FC = () => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const nodeColor = (node: FlowNode) => {
    const kind = node.data?.kind ?? "task";
    if (node.type === "frame") return alpha(kindColor(kind, dark), 0.18);
    if (node.type === "terminal") return dark ? "#5c6673" : "#b8c0c9";
    if (node.type === "merge" || node.type === "add") return "transparent";
    return alpha(kindColor(kind, dark), 0.75);
  };
  // No backdrop blur here: the minimap is an SVG and must clip to its corners.
  return (
    <MiniMap<FlowNode>
      position="bottom-right"
      pannable
      zoomable
      nodeColor={nodeColor}
      nodeStrokeWidth={0}
      nodeBorderRadius={6}
      bgColor={dark ? "#1e2228" : "#ffffff"}
      maskColor={dark ? "rgba(21, 24, 28, 0.65)" : "rgba(226, 231, 237, 0.7)"}
      style={{
        margin: 12,
        width: 180,
        height: 120,
        overflow: "hidden",
        borderRadius: 10,
        border: `1px solid ${dark ? "#343a44" : "#e3e7ec"}`,
        boxShadow: glass(dark).boxShadow,
      }}
    />
  );
};

const ADD_KINDS: Kind[] = [
  "task",
  "condition",
  "loop",
  "parallel",
  "sequential",
];

/** Kind picker opened by any "+" on the chart. */
export const KindMenu: React.FC<{
  anchor: HTMLElement | null;
  onPick: (kind: Kind) => void;
  onClose: () => void;
}> = ({ anchor, onPick, onClose }) => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  return (
    <Menu
      anchorEl={anchor}
      open={!!anchor}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      transformOrigin={{ vertical: "top", horizontal: "center" }}
    >
      {ADD_KINDS.map((kind) => (
        <MenuItem key={kind} onClick={() => onPick(kind)} dense>
          <ListItemIcon sx={{ color: kindColor(kind, dark) }}>
            <KindIcon kind={kind} size={18} />
          </ListItemIcon>
          <ListItemText>{KIND_LABEL[kind]}</ListItemText>
        </MenuItem>
      ))}
    </Menu>
  );
};

export type PartOption = { id: string; title: string };

interface StepPanelProps {
  step: IActivity;
  kind: Kind;
  parts: PartOption[];
  onPatch: (patch: StepPatch) => void;
  onDelete: () => void;
  onClose: () => void;
}

const Field: React.FC<{
  label: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, hint, children }) => (
  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6 }}>
    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{label}</Typography>
    {children}
    {hint && (
      <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
        {hint}
      </Typography>
    )}
  </Box>
);

/** Properties panel docked on the canvas' right edge for the selected step. */
export const StepPanel: React.FC<StepPanelProps> = ({
  step,
  kind,
  parts,
  onPatch,
  onDelete,
  onClose,
}) => {
  const s = useSurface();
  const expression =
    kind === "loop"
      ? conditionText(step.loop_condition ?? step.condition)
      : conditionText(step.condition);
  const [name, setName] = useState(step.name ?? "");
  const [expr, setExpr] = useState(expression ?? "");
  // Re-seed the fields when another step is selected or the step is updated elsewhere.
  useEffect(() => {
    setName(step.name ?? "");
    setExpr(expression ?? "");
  }, [step, expression]);

  const commitName = () => {
    if (name.trim() !== (step.name ?? "").trim()) onPatch({ name });
  };
  const commitExpr = () => {
    if (expr.trim() !== (expression ?? "").trim()) onPatch({ condition: expr });
  };
  const onEnter = (commit: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      commit();
      (e.target as HTMLElement).blur();
    }
  };
  const part = parts.find((p) => p.id === step.partId) ?? null;

  return (
    <Box
      className="nopan nowheel"
      sx={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        width: PANEL_WIDTH,
        zIndex: 6,
        display: "flex",
        flexDirection: "column",
        bgcolor: s.dark ? "#1b1f25" : "#ffffff",
        borderLeft: `1px solid ${s.dark ? "#343a44" : "#e3e7ec"}`,
        boxShadow: s.dark
          ? "-8px 0 24px rgba(0,0,0,0.35)"
          : "-8px 0 24px rgba(16,24,40,0.08)",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 2,
          py: 1.5,
          borderBottom: `1px solid ${s.dark ? "#2a2f36" : "#eceff3"}`,
        }}
      >
        <KindTile kind={kind} size={28} />
        <Typography sx={{ fontSize: 15, fontWeight: 700, flex: 1 }}>
          {KIND_LABEL[kind]}
        </Typography>
        <Tooltip title="Delete step">
          <IconButton size="small" color="error" onClick={onDelete}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          px: 2,
          py: 2,
          display: "flex",
          flexDirection: "column",
          gap: 2.5,
        }}
      >
        {kind === "task" && parts.length > 0 && (
          <Field label="Part" hint="Picking a part names the step after it.">
            <Autocomplete
              size="small"
              options={parts}
              value={part}
              getOptionLabel={(o) => o.title}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              onChange={(_, value) =>
                onPatch(
                  value
                    ? { partId: value.id, name: value.title }
                    : { partId: null },
                )
              }
              renderInput={(params) => (
                <TextField {...params} placeholder="Choose a part" />
              )}
            />
          </Field>
        )}
        <Field label="Name">
          <TextField
            size="small"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={onEnter(commitName)}
            placeholder={`${KIND_LABEL[kind]} name`}
          />
        </Field>
        {(kind === "condition" || kind === "loop") && (
          <Field
            label={kind === "loop" ? "Loop while" : "Condition"}
            hint={
              kind === "loop"
                ? "The steps inside repeat while this expression is true."
                : "Takes the If branch when this expression is true, else the Else branch."
            }
          >
            <TextField
              size="small"
              value={expr}
              onChange={(e) => setExpr(e.target.value)}
              onBlur={commitExpr}
              onKeyDown={onEnter(commitExpr)}
              placeholder={
                kind === "loop" ? "RemainingRows > 0" : "SoilLevel <= 3"
              }
              inputProps={{ style: { fontFamily: "monospace", fontSize: 13 } }}
              error={!expr.trim()}
            />
          </Field>
        )}
        {kind === "parallel" && (
          <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
            Branches under this fork run at the same time. Use the “+” row on
            the chart to add a branch.
          </Typography>
        )}
        {kind === "sequential" && (
          <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
            Steps inside run one after another. Use the “+” inside the frame to
            add a step.
          </Typography>
        )}
        <Field label="Step id" hint="Referenced by the performance model.">
          <Typography sx={{ fontFamily: "monospace", fontSize: 13 }}>
            {step.id}
          </Typography>
        </Field>
      </Box>
    </Box>
  );
};
