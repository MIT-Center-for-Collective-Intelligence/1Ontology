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
  Refresh as RefreshIcon,
  Save as SaveIcon,
  TouchApp as SelectionIcon,
  Help as HelpIcon,
  CropFree as ContainerIcon,
} from "@mui/icons-material";
import { IAlgorithm } from "@components/types/INode";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { generateCleanPerformanceModel } from "@components/lib/utils/performanceModelGenerator";
import { ContainerAwareAlgorithmBuilder } from "./ContainerAwareAlgorithmBuilder";

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
 * Props for interactive performance model
 */
interface InteractivePerformanceModelProps {
  text: string;
  currentNodes?: any[];
  isDarkMode: boolean;
}

/**
 * InteractivePerformanceModel - Renders performance model with hover tooltips for task identifiers
 */
const InteractivePerformanceModel: React.FC<InteractivePerformanceModelProps> = ({ 
  text, 
  currentNodes = [], 
  isDarkMode 
}) => {
  const theme = useTheme();

  // Create a mapping from task IDs to node information
  const createNodeMapping = () => {
    const mapping = new Map();
    
    currentNodes.forEach(node => {
      // Handle different ID formats: activityId, node.id, or data.activityId
      const activityId = node.data?.activityId || node.id;
      const nodeId = node.data?.node_id;
      const label = node.data?.label || 'Unknown Task';
      
      if (activityId) {
        mapping.set(activityId, { label, nodeId, fullId: node.id });
      }
      
      // Also map by node.id for direct matches
      if (node.id && node.id !== activityId) {
        mapping.set(node.id, { label, nodeId, fullId: node.id });
      }
    });
    
    return mapping;
  };

  const nodeMapping = createNodeMapping();

  // Parse the performance model and create interactive elements
  const parsePerformanceModel = (modelText: string) => {
    // Pattern to match task identifiers: t_{...} or t_...
    const taskPattern = /t_\{([^}]+)\}|t_([a-zA-Z0-9\-_]+)/g;
    
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = taskPattern.exec(modelText)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: modelText.substring(lastIndex, match.index)
        });
      }

      // Extract the task ID (from either capture group)
      const taskId = match[1] || match[2];
      const nodeInfo = nodeMapping.get(taskId);
      
      parts.push({
        type: 'task',
        content: match[0], // Full matched text (e.g., t_{S1})
        taskId: taskId,
        nodeInfo: nodeInfo
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < modelText.length) {
      parts.push({
        type: 'text',
        content: modelText.substring(lastIndex)
      });
    }

    return parts;
  };

  const parts = parsePerformanceModel(text);

  return (
    <Box
      sx={{
        fontFamily: 'KaTeX_Main, "Times New Roman", serif',
        fontSize: '0.9rem',
        color: isDarkMode ? '#e0e0e0' : '#333',
        lineHeight: 1.4,
        userSelect: 'text',
        fontStyle: 'italic',
        '& .katex': {
          fontSize: '0.9rem',
          color: isDarkMode ? '#e0e0e0' : '#333',
        },
      }}
    >
      {parts.map((part, index) => {
        if (part.type === 'text') {
          return (
            <span key={index} style={{ 
              whiteSpace: 'pre-wrap',
              fontStyle: 'italic'
            }}>
              {part.content}
            </span>
          );
        } else if (part.type === 'task') {
          const tooltipTitle = part.nodeInfo 
            ? `${part.nodeInfo.label}${part.nodeInfo.nodeId ? ` (${part.nodeInfo.nodeId})` : ''}`
            : `Task: ${part.taskId}`;

          return (
            <Tooltip
              key={index}
              title={tooltipTitle}
              placement="top"
              arrow
              sx={{
                '& .MuiTooltip-tooltip': {
                  bgcolor: isDarkMode ? '#424242' : '#616161',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontFamily: 'Roboto, sans-serif',
                },
                '& .MuiTooltip-arrow': {
                  color: isDarkMode ? '#424242' : '#616161',
                },
              }}
            >
              <span
                style={{
                  color: isDarkMode ? '#e0e0e0' : '#333',
                  cursor: 'default',
                  transition: 'text-decoration 0.2s ease',
                  fontStyle: 'italic',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                {part.content}
              </span>
            </Tooltip>
          );
        }
        return null;
      })}
    </Box>
  );
};

/**
 * Props for zoom/fit control panel
 */
interface ControlPanelProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  enableEdit?: boolean;
  onSave?: () => void;
  isSaving?: boolean;
  isPointerToolActive?: boolean;
  onPointerToolToggle?: () => void;
}

/**
 * ControlPanel - Provides zoom and fit controls for the flowchart
 */
export const ControlPanel: React.FC<ControlPanelProps> = ({
  onZoomIn,
  onZoomOut,
  onFitView,
  enableEdit = false,
  onSave,
  isSaving = false,
  isPointerToolActive = false,
  onPointerToolToggle,
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

  const disabledButtonStyle = {
    ...controlButtonStyle,
    color: theme.palette.mode === "dark" 
      ? alpha(theme.palette.common.white, 0.3) 
      : alpha(theme.palette.common.black, 0.3),
    cursor: "not-allowed",
    "&:hover": {
      bgcolor: controlButtonStyle.bgcolor,
    },
  };


  const activePointerButtonStyle = {
    bgcolor: theme.palette.mode === "dark"
      ? alpha(theme.palette.common.white, 0.9)
      : alpha(theme.palette.common.black, 0.8),
    color: theme.palette.mode === "dark"
      ? theme.palette.common.black
      : theme.palette.common.white,
    "&:hover": {
      bgcolor: theme.palette.mode === "dark"
        ? alpha(theme.palette.common.white, 0.8)
        : alpha(theme.palette.common.black, 0.7),
    },
  };

  const inactivePointerButtonStyle = {
    bgcolor: theme.palette.mode === "dark"
      ? alpha(theme.palette.common.white, 0.1)
      : alpha(theme.palette.common.black, 0.05),
    color: theme.palette.mode === "dark"
      ? alpha(theme.palette.common.white, 0.5)
      : alpha(theme.palette.common.black, 0.5),
    "&:hover": {
      bgcolor: theme.palette.mode === "dark"
        ? alpha(theme.palette.common.white, 0.15)
        : alpha(theme.palette.common.black, 0.1),
    },
  };

  return (
    <Panel position="top-right" style={{ display: "flex", gap: "8px" }}>
      {enableEdit && (
        <>
          {/* Pointer Tool Toggle - Only in edit mode */}
          <Tooltip title={isPointerToolActive ? "Selection Mode (click to switch to pan)" : "Pan Mode (click to enable selection)"}>
            <IconButton
              onClick={onPointerToolToggle}
              size="small"
              sx={isPointerToolActive ? activePointerButtonStyle : inactivePointerButtonStyle}
            >
              <SelectionIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Save Algorithm Changes">
            <span>
              <IconButton 
                onClick={onSave} 
                size="small" 
                sx={onSave ? controlButtonStyle : disabledButtonStyle}
                disabled={!onSave || isSaving}
              >
                <SaveIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          {/* Help Icon with Controls Guide */}
          <Tooltip
            title={
              <Box sx={{ p: 1, maxWidth: 350 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'inherit' }}>
                  Flow Editor Controls
                </Typography>

                <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: 'inherit' }}>
                  <strong>Canvas Navigation:</strong>
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', mb: 1, pl: 1, color: 'inherit' }}>
                  • Drag to move canvas around<br/>
                  • Mouse wheel to zoom in/out
                </Typography>

                <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: 'inherit' }}>
                  <strong>Selection Mode (bright cursor icon):</strong>
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', mb: 1, pl: 1, color: 'inherit' }}>
                  • Drag to select multiple nodes<br/>
                  • Cmd/Ctrl + click for multi-select<br/>
                  • Delete/Backspace to remove selected items
                </Typography>

                <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: 'inherit' }}>
                  <strong>Pan Mode (dim cursor icon):</strong>
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', mb: 1, pl: 1, color: 'inherit' }}>
                  • Drag nodes to move them<br/>
                  • Drag empty space to move canvas<br/>
                  • Drop nodes into containers to group them
                </Typography>

                <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: 'inherit' }}>
                  <strong>Adding Nodes:</strong>
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', mb: 1, pl: 1, color: 'inherit' }}>
                  • Use the legend panel (top-left) to add nodes<br/>
                  • Click on any node type to create it<br/>
                  • Nodes appear at the center of your view
                </Typography>

                <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: 'inherit' }}>
                  <strong>Connections:</strong>
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', color: 'inherit', pl: 1 }}>
                  • Drag from node handles to connect them<br/>
                  • Click the X on edges to delete connections
                </Typography>
              </Box>
            }
            placement="bottom-end"
            arrow
            sx={{
              '& .MuiTooltip-tooltip': {
                bgcolor: theme.palette.mode === 'dark' ? '#2a2a2a' : '#f5f5f5',
                color: theme.palette.text.primary,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: '8px',
                fontSize: '12px',
                maxWidth: 'none',
              },
              '& .MuiTooltip-arrow': {
                color: theme.palette.mode === 'dark' ? '#2a2a2a' : '#f5f5f5',
              },
            }}
          >
            <IconButton size="small" sx={controlButtonStyle}>
              <HelpIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      )}
      <Box sx={{ width: 1, height: 24, bgcolor: theme.palette.divider, mx: 0.5 }} />
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
  enableEdit?: boolean;
  onNodeTypeClick?: (nodeType: string) => void;
  onTaskNodeClick?: () => void;
}

/**
 * LegendPanel - Displays a legend explaining node types or editing controls
 */
export const LegendPanel: React.FC<LegendPanelProps> = ({ 
  isDarkMode, 
  enableEdit = false, 
  onNodeTypeClick,
  onTaskNodeClick
}) => {
  const theme = useTheme();
  const basePanelStyles = createBasePanelStyles(isDarkMode);

  // Node type information with icons and colors
  const legendItems = [
    {
      icon: <ArrowIcon fontSize="small" sx={{ border: '1px dashed', borderRadius: '2px', p: 0.2 }} />,
      label: "Sequential Container",
      type: "sequential-container",
      color: isDarkMode ? "#90caf9" : "#1976d2",
    },
    {
      icon: <ParallelIcon fontSize="small" sx={{ border: '1px dashed', borderRadius: '2px', p: 0.2 }} />,
      label: "Parallel Container",
      type: "parallel-container",
      color: isDarkMode ? "#ce93d8" : "#9c27b0",
    },
    {
      icon: <LoopIcon fontSize="small" sx={{ border: '1px dashed', borderRadius: '2px', p: 0.2 }} />,
      label: "Loop Container",
      type: "loop-container",
      color: isDarkMode ? "#81c784" : "#43a047",
    },
    {
      icon: <ConditionIcon fontSize="small" />,
      label: "Condition",
      type: "condition",
      color: isDarkMode ? "#ffb74d" : "#f57c00",
    },
    {
      icon: <TaskIcon fontSize="small" />,
      label: "Task",
      type: "task",
      color: isDarkMode ? "#b0bec5" : "#607d8b",
    },
  ];

  return (
    <Panel position="top-left" style={basePanelStyles}>
      <Typography
        variant="caption"
        sx={{ fontWeight: 600, mb: 0.5, display: "block" }}
      >
        {enableEdit ? "Add Nodes" : "Legend"}
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        {legendItems.map((item, index) => (
          <Box
            key={index}
            onClick={() => {
              if (!enableEdit) return;
              if (item.type === "task" && onTaskNodeClick) {
                onTaskNodeClick();
              } else {
                onNodeTypeClick?.(item.type);
              }
            }}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              cursor: enableEdit ? "pointer" : "default",
              padding: enableEdit ? "4px 6px" : "0",
              borderRadius: enableEdit ? "4px" : "0",
              backgroundColor: "transparent",
              transition: "all 0.2s ease",
              "&:hover": enableEdit
                ? {
                    backgroundColor: isDarkMode
                      ? "rgba(255, 255, 255, 0.1)"
                      : "rgba(0, 0, 0, 0.05)",
                    transform: "translateX(2px)",
                  }
                : {},
            }}
          >
            {React.cloneElement(item.icon, { sx: { color: item.color } })}
            <Typography variant="caption">{item.label}</Typography>
            {enableEdit && (
              <Typography
                variant="caption"
                sx={{ ml: "auto", fontSize: "12px", opacity: 0.7 }}
              >
                +
              </Typography>
            )}
          </Box>
        ))}
      </Box>
      {enableEdit && (
        <Typography
          variant="caption"
          sx={{ 
            mt: 1, 
            fontSize: "12px", 
            opacity: 0.6, 
            textAlign: "center",
            display: "block" 
          }}
        >
          Click to add nodes
        </Typography>
      )}
    </Panel>
  );
};

/**
 * Props for the performance model panel
 */
interface PerformanceModelPanelProps {
  algorithm: IAlgorithm;
  isDarkMode: boolean;
  enableEdit?: boolean;
  onPerformanceModelUpdate?: (newModel: string) => void;
  currentNodes?: any[];
  currentEdges?: any[];
}

/**
 * PerformanceModelPanel - Displays the performance model
 */
export const PerformanceModelPanel: React.FC<PerformanceModelPanelProps> = ({
  algorithm,
  isDarkMode,
  enableEdit = false,
  onPerformanceModelUpdate,
  currentNodes = [],
  currentEdges = [],
}) => {
  const theme = useTheme();
  const basePanelStyles = createBasePanelStyles(isDarkMode);
  const mathFormula = `$${algorithm.performance_model}$`;

  // Helper function to create algorithm structure from current flowchart state
  const createAlgorithmFromCurrentState = () => {
    console.log('🔄 Creating algorithm from current flowchart state');
    console.log('📊 Current state:', {
      nodes: currentNodes?.length || 0,
      edges: currentEdges?.length || 0,
      algorithmName: algorithm.name
    });

    try {
      // Create the container-aware algorithm builder
      const builder = new ContainerAwareAlgorithmBuilder(currentNodes, currentEdges);
      
      // Debug the current node hierarchy
      builder.debugNodeHierarchy();
      
      // Validate the structure
      const validation = builder.validateStructure();
      if (!validation.isValid) {
        console.warn('⚠️ Structure validation warnings:', validation.errors);
        // Continue anyway - warnings don't prevent generation
      }
      
      // Build the complete algorithm structure
      const updatedAlgorithm = builder.buildAlgorithm(algorithm);
      
      console.log('✅ Algorithm built successfully:', {
        name: updatedAlgorithm.name,
        type: updatedAlgorithm.type,
        subActivitiesCount: updatedAlgorithm.sub_activities?.length || 0
      });
      
      return updatedAlgorithm;
      
    } catch (error) {
      console.error('❌ Error building algorithm from flowchart:', error);
      // Fallback to original algorithm
      console.log('🔄 Falling back to original algorithm structure');
      return algorithm;
    }
  };

  const handleRefreshPerformanceModel = () => {
    console.log('🔄 Performance model refresh requested');
    
    if (!onPerformanceModelUpdate) {
      console.warn('⚠️ No performance model update callback provided');
      return;
    }
    
    try {
      // Build algorithm structure from current flowchart using container relationships
      const updatedAlgorithm = createAlgorithmFromCurrentState();
      
      // Generate the new performance model
      console.log('🏭 Generating performance model from updated structure...');
      const newModel = generateCleanPerformanceModel(updatedAlgorithm);
      
      console.log('✅ Performance model generated successfully');
      console.log('📈 Model preview:', newModel.substring(0, 100) + '...');
      
      // Update the performance model
      onPerformanceModelUpdate(newModel);
      
    } catch (error) {
      console.error('❌ Failed to refresh performance model:', error);
      // TODO: Show user-friendly error notification
    }
  };

  const refreshButtonStyle = {
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
    minWidth: 'auto',
    padding: '4px',
  };

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
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 600,
            color: theme.palette.text.primary,
          }}
        >
          Performance Model
        </Typography>
        {enableEdit && (
          <Tooltip title="Refresh performance model using current algorithm structure">
            <IconButton 
              onClick={handleRefreshPerformanceModel} 
              size="small" 
              sx={refreshButtonStyle}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
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
        }}
      >
        <InteractivePerformanceModel 
          text={algorithm.performance_model}
          currentNodes={currentNodes}
          isDarkMode={isDarkMode}
        />
      </Box>
    </Panel>
  );
};
