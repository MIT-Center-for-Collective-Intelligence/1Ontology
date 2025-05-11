import React from "react";
import { Panel } from "@xyflow/react";
import {
  Box,
  Typography,
  Tooltip,
  IconButton,
  useTheme,
  alpha,
} from "@mui/material";
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  FitScreen as FitScreenIcon,
  ArrowDownward as ArrowIcon,
  CallSplit as ParallelIcon,
  Help as ConditionIcon,
  Loop as LoopIcon,
  Task as TaskIcon,
} from "@mui/icons-material";
import { IAlgorithm } from "@components/types/INode";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

/**
 * Base panel styling applied to all panels
 */
interface BasePanelStyles {
  background: string;
  borderRadius: string;
  padding: string;
  border: string;
  boxShadow: string;
  zIndex: number;
}

/**
 * Creates base panel styles based on theme mode
 */
const createBasePanelStyles = (isDarkMode: boolean): BasePanelStyles => ({
  background: isDarkMode
    ? "rgba(30, 30, 30, 0.8)"
    : "rgba(255, 255, 255, 0.85)",
  borderRadius: "8px",
  padding: "8px 12px",
  border: `1px solid ${isDarkMode ? "#333" : "#ddd"}`,
  boxShadow: isDarkMode
    ? "0 2px 5px rgba(0, 0, 0, 0.3)"
    : "0 2px 5px rgba(0, 0, 0, 0.1)",
  zIndex: 5,
});

const MathRenderer = ({ text }: any) => {
  return (
    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
      {text}
    </ReactMarkdown>
  );
};

/**
 * Props for zoom/fit control panel
 */
interface ControlPanelProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
}

/**
 * ControlPanel - Provides zoom and fit controls for the flowchart
 */
export const ControlPanel: React.FC<ControlPanelProps> = ({
  onZoomIn,
  onZoomOut,
  onFitView,
}) => {
  const theme = useTheme();

  const controlButtonStyle = {
    bgcolor:
      theme.palette.mode === "dark"
        ? alpha(theme.palette.common.white, 0.1)
        : alpha(theme.palette.common.black, 0.05),
    "&:hover": {
      bgcolor:
        theme.palette.mode === "dark"
          ? alpha(theme.palette.common.white, 0.2)
          : alpha(theme.palette.common.black, 0.1),
    },
  };

  return (
    <Panel position="top-right" style={{ display: "flex", gap: "8px" }}>
      <Tooltip title="Zoom In">
        <IconButton onClick={onZoomIn} size="small" sx={controlButtonStyle}>
          <ZoomInIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Zoom Out">
        <IconButton onClick={onZoomOut} size="small" sx={controlButtonStyle}>
          <ZoomOutIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Fit View">
        <IconButton onClick={onFitView} size="small" sx={controlButtonStyle}>
          <FitScreenIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Panel>
  );
};

/**
 * Props for the legend panel
 */
interface LegendPanelProps {
  isDarkMode: boolean;
}

/**
 * LegendPanel - Displays a legend explaining node types
 */
export const LegendPanel: React.FC<LegendPanelProps> = ({ isDarkMode }) => {
  const theme = useTheme();
  const basePanelStyles = createBasePanelStyles(isDarkMode);

  // Node type information with icons and colors
  const legendItems = [
    {
      icon: <ArrowIcon fontSize="small" />,
      label: "Sequential",
      color: isDarkMode ? "#90caf9" : "#1976d2",
    },
    {
      icon: <ParallelIcon fontSize="small" />,
      label: "Parallel",
      color: isDarkMode ? "#ce93d8" : "#9c27b0",
    },
    {
      icon: <ConditionIcon fontSize="small" />,
      label: "Condition",
      color: isDarkMode ? "#ffb74d" : "#f57c00",
    },
    {
      icon: <LoopIcon fontSize="small" />,
      label: "Loop",
      color: isDarkMode ? "#81c784" : "#43a047",
    },
    {
      icon: <TaskIcon fontSize="small" />,
      label: "Task",
      color: isDarkMode ? "#b0bec5" : "#607d8b",
    },
  ];

  return (
    <Panel position="top-left" style={basePanelStyles}>
      <Typography
        variant="caption"
        sx={{ fontWeight: 600, mb: 0.5, display: "block" }}
      >
        Legend
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        {legendItems.map((item, index) => (
          <Box
            key={index}
            sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
          >
            {React.cloneElement(item.icon, { sx: { color: item.color } })}
            <Typography variant="caption">{item.label}</Typography>
          </Box>
        ))}
      </Box>
    </Panel>
  );
};

/**
 * Props for the performance model panel
 */
interface PerformanceModelPanelProps {
  algorithm: IAlgorithm;
  isDarkMode: boolean;
}

/**
 * PerformanceModelPanel - Displays the performance model
 */
export const PerformanceModelPanel: React.FC<PerformanceModelPanelProps> = ({
  algorithm,
  isDarkMode,
}) => {
  const theme = useTheme();
  const basePanelStyles = createBasePanelStyles(isDarkMode);
  const mathFormula = `$${algorithm.performance_model}$`;

  return (
    <Panel
      position="bottom-left"
      style={{
        background: isDarkMode
          ? "rgba(30, 30, 30, 0.8)"
          : "rgba(255, 255, 255, 0.85)",
        borderRadius: "8px",
        padding: "8px 12px",
        border: `1px solid ${isDarkMode ? "#333" : "#ddd"}`,
        maxWidth: "400px",
        marginBottom: "16px",
        marginLeft: "16px",
        boxShadow: isDarkMode
          ? "0 2px 5px rgba(0, 0, 0, 0.3)"
          : "0 2px 5px rgba(0, 0, 0, 0.1)",
        zIndex: 5,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 600,
            color: theme.palette.text.primary,
          }}
        >
          Performance Model
        </Typography>
      </Box>

      <Box
        sx={{
          backgroundColor: isDarkMode
            ? "rgba(0, 0, 0, 0.3)"
            : "rgba(0, 0, 0, 0.04)",
          borderRadius: "4px",
          padding: "8px 12px",
          overflowX: "auto",
          "&::-webkit-scrollbar": {
            height: "6px",
          },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: isDarkMode
              ? "rgba(255, 255, 255, 0.3)"
              : "rgba(0, 0, 0, 0.2)",
            borderRadius: "3px",
          },
          "& .katex": {
            fontSize: "1rem",
            color: isDarkMode ? "#e0e0e0" : "#333",
          },
        }}
      >
        <MathRenderer text={mathFormula} />
      </Box>
    </Panel>
  );
};
