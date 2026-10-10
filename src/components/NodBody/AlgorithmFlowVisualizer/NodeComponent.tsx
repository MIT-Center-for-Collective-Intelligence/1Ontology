import React from "react";
import { Handle, NodeProps, NodeTypes, Position } from "@xyflow/react";
import { Box, Tooltip, Typography, alpha, useTheme } from "@mui/material";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import AltRouteIcon from "@mui/icons-material/AltRoute";
import LoopIcon from "@mui/icons-material/Loop";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import AddIcon from "@mui/icons-material/Add";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import {
  FlowNode,
  FlowNodeData,
  Kind,
  TAB_DX,
  kindColor,
} from "./FlowGenerator";
import { useFlowEdit } from "./editContext";

type Props = NodeProps<FlowNode>;

/** Icon per activity kind, shared by node tiles, the legend and the panel. */
export const KindIcon: React.FC<{ kind: Kind; size?: number }> = ({
  kind,
  size = 18,
}) => {
  const sx = { fontSize: size };
  switch (kind) {
    case "sequential":
      return <FormatListNumberedIcon sx={sx} />;
    case "parallel":
      return <CallSplitIcon sx={sx} />;
    case "condition":
      return <AltRouteIcon sx={sx} />;
    case "loop":
      return <LoopIcon sx={sx} />;
    default:
      return <TaskAltIcon sx={sx} />;
  }
};

export const KIND_LABEL: Record<Kind, string> = {
  task: "Task",
  sequential: "Sequence",
  parallel: "Parallel",
  condition: "Condition",
  loop: "Loop",
};

/**
 * Edges are drawn from precomputed points, but React Flow still needs one
 * target and one source handle per node to render an edge at all.
 */
const Ports: React.FC = () => {
  const hidden = {
    opacity: 0,
    width: 1,
    height: 1,
    border: 0,
    minWidth: 0,
    minHeight: 0,
    pointerEvents: "none" as const,
  };
  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        style={hidden}
        isConnectable={false}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={hidden}
        isConnectable={false}
      />
    </>
  );
};

export const useSurface = () => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  return {
    dark,
    card: {
      bgcolor: dark ? "#23272e" : "#ffffff",
      border: `1px solid ${dark ? "#343a44" : "#e3e7ec"}`,
      boxShadow: dark
        ? "0 1px 2px rgba(0,0,0,0.5), 0 6px 16px rgba(0,0,0,0.35)"
        : "0 1px 2px rgba(16,24,40,0.06), 0 6px 16px rgba(16,24,40,0.06)",
    },
    title: dark ? "#e8eaed" : "#1f2937",
    muted: dark ? "#9aa3ad" : "#6b7280",
  };
};

const ellipsis = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap" as const,
};

/** "Needs setup" marker for steps missing a name or an expression (edit mode). */
const SetupChip: React.FC = () => {
  const s = useSurface();
  const color = s.dark ? "#f6a5a5" : "#b42318";
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.4,
        px: 0.7,
        height: 16,
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 600,
        color,
        bgcolor: alpha(color, s.dark ? 0.16 : 0.1),
      }}
    >
      <ErrorOutlineIcon sx={{ fontSize: 11 }} />
      Needs setup
    </Box>
  );
};

/** Colored icon tile shared by cards, frame chips and the panel header. */
export const KindTile: React.FC<{ kind: Kind; size?: number }> = ({
  kind,
  size = 34,
}) => {
  const s = useSurface();
  return (
    <Box
      sx={{
        width: size,
        height: size,
        flex: "0 0 auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: `${Math.round(size * 0.27)}px`,
        bgcolor: kindColor(kind, s.dark),
        color: "#fff",
      }}
    >
      <KindIcon kind={kind} size={Math.round(size * 0.53)} />
    </Box>
  );
};

const IdChip: React.FC<{ id?: string }> = ({ id }) => {
  const s = useSurface();
  if (!id) return null;
  return (
    <Typography
      sx={{
        flex: "0 0 auto",
        fontSize: 10,
        fontFamily: "monospace",
        lineHeight: "16px",
        px: 0.6,
        borderRadius: "5px",
        color: s.muted,
        bgcolor: s.dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
        maxWidth: 72,
        ...ellipsis,
      }}
    >
      {id}
    </Typography>
  );
};

const cardSx = (
  s: ReturnType<typeof useSurface>,
  color: string,
  selected?: boolean,
) => ({
  ...s.card,
  // Kind color on the card itself: tinted surface, colored border, solid tile.
  bgcolor: s.dark ? alpha(color, 0.16) : alpha(color, 0.08),
  border: `1px solid ${alpha(color, s.dark ? 0.6 : 0.45)}`,
  ...(selected && {
    boxShadow: `0 0 0 2.5px ${color}, ${s.card.boxShadow}`,
  }),
  width: "100%",
  height: "100%",
  position: "relative" as const,
  borderRadius: "12px",
});

/** Title + subtitle column used by cards and frame chips. */
const Caption: React.FC<{
  title?: string;
  subtitle?: React.ReactNode;
  subtitleTip?: string;
  needsSetup?: boolean;
  titleColor?: string;
}> = ({ title, subtitle, subtitleTip, needsSetup, titleColor }) => {
  const s = useSurface();
  return (
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Tooltip title={title ?? ""} placement="top" arrow>
        <Typography
          sx={{
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.25,
            color: titleColor ?? s.title,
            ...ellipsis,
          }}
        >
          {title || "Untitled"}
        </Typography>
      </Tooltip>
      {needsSetup ? (
        <Box sx={{ mt: 0.3 }}>
          <SetupChip />
        </Box>
      ) : (
        <Tooltip title={subtitleTip ?? ""} placement="bottom" arrow>
          <Typography
            component="div"
            sx={{
              fontSize: 11,
              lineHeight: 1.3,
              mt: 0.25,
              color: s.muted,
              ...ellipsis,
            }}
          >
            {subtitle}
          </Typography>
        </Tooltip>
      )}
    </Box>
  );
};

const Code: React.FC<{ children: string }> = ({ children }) => (
  <Box component="span" sx={{ fontFamily: "monospace", fontSize: 10.5 }}>
    {children}
  </Box>
);

export const TaskNode: React.FC<Props> = ({ data, selected }) => {
  const s = useSurface();
  const color = kindColor(data.kind, s.dark);
  return (
    <Box
      sx={{
        ...cardSx(s, color, selected),
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        px: 1.25,
      }}
    >
      <Ports />
      <KindTile kind={data.kind} />
      <Caption
        title={data.label}
        subtitle={KIND_LABEL[data.kind]}
        needsSetup={data.needsSetup}
      />
      <IdChip id={data.activityId} />
    </Box>
  );
};

/** Condition card: header row plus "If" / "Else" tabs the branches leave from. */
export const DecisionNode: React.FC<Props> = ({ data, selected }) => {
  const s = useSurface();
  const color = kindColor("condition", s.dark);
  const tab = (label: string, side: "left" | "right") => (
    <Box
      sx={{
        position: "absolute",
        bottom: 6,
        left: `calc(50% ${side === "left" ? "-" : "+"} ${TAB_DX}px)`,
        transform: "translateX(-50%)",
        width: 100,
        height: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "7px",
        fontSize: 11.5,
        fontWeight: 600,
        color,
        bgcolor: s.dark ? "rgba(0,0,0,0.3)" : "#fff",
        border: `1px solid ${alpha(color, 0.45)}`,
      }}
    >
      {label}
    </Box>
  );
  return (
    <Box sx={cardSx(s, color, selected)}>
      <Ports />
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          px: 1.25,
          height: 58,
        }}
      >
        <KindTile kind="condition" />
        <Caption
          title={data.label}
          subtitle={
            data.condition ? <Code>{data.condition}</Code> : "Condition"
          }
          subtitleTip={data.condition}
          needsSetup={data.needsSetup}
        />
        <IdChip id={data.activityId} />
      </Box>
      {tab("If", "left")}
      {tab("Else", "right")}
    </Box>
  );
};

/** Loop body or named sequence: a tinted region with a header chip. Selectable in edit mode. */
export const FrameNode: React.FC<Props> = ({ data, selected }) => {
  const s = useSurface();
  const color = kindColor(data.kind, s.dark);
  const loop = data.kind === "loop";
  const subtitle = loop
    ? data.condition
      ? `while (${data.condition})`
      : "Loop"
    : "Sequence";
  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        position: "relative",
        borderRadius: "16px",
        border: `${selected ? 2 : 1.5}px ${loop ? "dashed" : "solid"} ${alpha(color, selected ? 1 : s.dark ? 0.55 : 0.45)}`,
        bgcolor: alpha(color, s.dark ? 0.07 : 0.045),
      }}
    >
      <Box
        sx={{
          position: "absolute",
          top: 8,
          left: 10,
          display: "flex",
          alignItems: "center",
          gap: 0.8,
          maxWidth: "calc(100% - 20px)",
        }}
      >
        <KindTile kind={data.kind} size={24} />
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 600,
              lineHeight: 1.2,
              color,
              ...ellipsis,
            }}
          >
            {data.label || KIND_LABEL[data.kind]}
          </Typography>
          {data.needsSetup ? (
            <SetupChip />
          ) : (
            <Typography
              sx={{
                fontSize: 10.5,
                lineHeight: 1.2,
                color: s.muted,
                fontFamily: loop && data.condition ? "monospace" : undefined,
                ...ellipsis,
              }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
};

/** Fork/join bar for parallel branches; the fork carries the group name. */
export const BarNode: React.FC<Props> = ({ data }) => {
  const s = useSurface();
  const color = kindColor("parallel", s.dark);
  return (
    <Box sx={{ width: "100%", height: "100%", position: "relative" }}>
      <Ports />
      <Box
        sx={{
          width: "100%",
          height: "100%",
          borderRadius: 999,
          bgcolor: alpha(color, s.dark ? 0.8 : 0.7),
        }}
      />
      {data.label && (
        <Tooltip title={data.label} placement="top" arrow>
          <Box
            sx={{
              position: "absolute",
              bottom: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              mb: "4px",
              display: "flex",
              alignItems: "center",
              gap: 0.6,
              px: 1,
              height: 20,
              borderRadius: 999,
              bgcolor: s.dark ? "#23272e" : "#fff",
              border: `1px solid ${alpha(color, 0.45)}`,
              color,
              maxWidth: "min(100%, 360px)",
              boxShadow: s.card.boxShadow,
            }}
          >
            <KindIcon kind="parallel" size={13} />
            <Typography sx={{ fontSize: 11, fontWeight: 600, ...ellipsis }}>
              {data.label}
            </Typography>
          </Box>
        </Tooltip>
      )}
    </Box>
  );
};

/** Invisible junction where condition branches rejoin. */
export const MergeNode: React.FC<Props> = () => (
  <Box sx={{ width: "100%", height: "100%" }}>
    <Ports />
  </Box>
);

export const TerminalNode: React.FC<Props> = ({ data }) => {
  const s = useSurface();
  const end = data.variant === "end";
  return (
    <Box
      sx={{
        ...s.card,
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 0.6,
        borderRadius: 999,
        color: s.title,
      }}
    >
      <Ports />
      {end ? (
        <StopIcon sx={{ fontSize: 16, color: s.muted }} />
      ) : (
        <PlayArrowIcon sx={{ fontSize: 18, color: s.muted }} />
      )}
      <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.3 }}>
        {data.label}
      </Typography>
    </Box>
  );
};

/** "+" at the end of a chain (edit mode); opens the kind menu. */
export const AddNode: React.FC<Props> = ({ data }) => {
  const s = useSurface();
  const { onInsert } = useFlowEdit();
  return (
    <Box
      component="button"
      type="button"
      className="nopan"
      aria-label="Add step"
      onClick={(e: React.MouseEvent<HTMLElement>) =>
        data.insert && onInsert(data.insert, e.currentTarget)
      }
      sx={{
        width: "100%",
        height: "100%",
        position: "relative",
        p: 0,
        borderRadius: "50%",
        border: `1px solid ${s.dark ? "#4b5563" : "#c8cfd6"}`,
        bgcolor: s.dark ? "#23272e" : "#fff",
        color: s.dark ? "#c9d1d9" : "#4b5563",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        boxShadow: s.card.boxShadow,
        "&:hover": { borderColor: "primary.main", color: "primary.main" },
      }}
    >
      <Ports />
      <AddIcon sx={{ fontSize: 18 }} />
    </Box>
  );
};

/** Shown where a container has no steps (view mode). */
export const PlaceholderNode: React.FC<Props> = ({ data }) => {
  const s = useSurface();
  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "10px",
        border: `1px dashed ${s.dark ? "#4b5563" : "#c8cfd6"}`,
        color: s.muted,
        fontSize: 11.5,
      }}
    >
      <Ports />
      {data.label}
    </Box>
  );
};

export const nodeTypes: NodeTypes = {
  task: TaskNode,
  decision: DecisionNode,
  frame: FrameNode,
  bar: BarNode,
  merge: MergeNode,
  terminal: TerminalNode,
  add: AddNode,
  placeholder: PlaceholderNode,
};
