import React from 'react';
import { NodeProps, Position, Handle, useStore } from '@xyflow/react';
import { Box, Typography, useTheme, Tooltip } from '@mui/material';
import {
  ArrowDownward as ArrowIcon,
  CallSplit as ParallelIcon,
  Help as ConditionIcon,
  Loop as LoopIcon,
  Task as TaskIcon,
} from '@mui/icons-material';

/**
 * Node types constants
 */
export const NODE_TYPES = {
  SEQUENTIAL: 'sequential',
  PARALLEL: 'parallel',
  CONDITION: 'condition',
  LOOP: 'loop',
  TASK: 'task'
} as const;

type NodeType = typeof NODE_TYPES[keyof typeof NODE_TYPES];

/**
 * Data structure for node content used in NodeProps
 */
export interface NodeData {
  id: string;
  position: { x: number; y: number };
  data: any; // Required by React Flow
  label: string;
  type: NodeType;
  details?: string;
  variables?: string[];
  condition?: string;
  activityId?: string;
  hasSubActivities?: boolean;
  isConditionTrue?: boolean | null;
}

/**
 * Node props with proper generic typing
 */
type FlowNodeProps = NodeProps<NodeData>;

/**
 * Hook to check if a node has connections on specific handles
 */
const useHasConnections = (nodeId: string, handleId: string | null, handleType: 'source' | 'target'): boolean => {
  return useStore(store => {
    const { edges } = store;
    return edges.some(edge =>
      handleType === 'source'
        ? (edge.source === nodeId && (handleId ? edge.sourceHandle === handleId : true))
        : (edge.target === nodeId && (handleId ? edge.targetHandle === handleId : true))
    );
  });
};

/**
 * Handle styling based on node type and theme
 */
interface HandleStyleProps {
  position: Position;
  type: 'source' | 'target';
  color: string;
  isDarkMode: boolean;
  size?: number;
}

/**
 * Creates consistent handle styles for nodes
 */
const getHandleStyle = ({ position, type, color, isDarkMode, size = 8 }: HandleStyleProps) => ({
  background: color,
  width: size,
  height: size,
  [position === Position.Top || position === Position.Bottom 
    ? (position === Position.Top ? 'top' : 'bottom') 
    : (position === Position.Left ? 'left' : 'right')]: -size/2,
  borderRadius: '50%',
  border: `2px solid ${isDarkMode ? '#1a1a1a' : '#fff'}`
});

/**
 * Creates ID badge for activity nodes
 */
const ActivityIdBadge: React.FC<{
  activityId?: string;
  color: string;
  bgColor: string;
  top?: number;
  right?: number;
  isDarkMode: boolean;
}> = ({ activityId, color, bgColor, top = -10, right = 2, isDarkMode }) => {
  if (!activityId) return null;
  
  return (
    <Typography
      sx={{
        fontSize: '9px',
        position: 'absolute',
        top,
        right,
        bgcolor: isDarkMode ? bgColor : bgColor,
        color,
        px: 0.5,
        borderRadius: 1,
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
      }}
    >
      {activityId}
    </Typography>
  );
};

/**
 * Base styles for all node types that can be extended
 */
const getBaseNodeStyles = (type: NodeType, isDarkMode: boolean, isHoverable = true) => {
  const colors = {
    [NODE_TYPES.SEQUENTIAL]: {
      border: isDarkMode ? 'rgba(25, 118, 210, 0.5)' : 'rgba(25, 118, 210, 0.3)',
      bg: isDarkMode ? 'rgba(25, 118, 210, 0.15)' : 'rgba(25, 118, 210, 0.05)',
      text: isDarkMode ? '#90caf9' : '#1976d2',
      badge: isDarkMode ? '#1a237e' : '#e3f2fd',
    },
    [NODE_TYPES.PARALLEL]: {
      border: isDarkMode ? 'rgba(156, 39, 176, 0.5)' : 'rgba(156, 39, 176, 0.3)',
      bg: isDarkMode ? 'rgba(156, 39, 176, 0.15)' : 'rgba(156, 39, 176, 0.05)',
      text: isDarkMode ? '#ce93d8' : '#9c27b0',
      badge: isDarkMode ? '#4a148c' : '#f3e5f5',
    },
    [NODE_TYPES.CONDITION]: {
      border: isDarkMode ? 'rgba(245, 124, 0, 0.5)' : 'rgba(245, 124, 0, 0.3)',
      bg: isDarkMode ? 'rgba(245, 124, 0, 0.15)' : 'rgba(245, 124, 0, 0.05)',
      text: isDarkMode ? '#ffb74d' : '#f57c00',
      badge: isDarkMode ? '#e65100' : '#fff3e0',
    },
    [NODE_TYPES.LOOP]: {
      border: isDarkMode ? 'rgba(67, 160, 71, 0.5)' : 'rgba(67, 160, 71, 0.3)',
      bg: isDarkMode ? 'rgba(67, 160, 71, 0.15)' : 'rgba(67, 160, 71, 0.05)',
      text: isDarkMode ? '#81c784' : '#43a047',
      badge: isDarkMode ? '#1b5e20' : '#e8f5e9',
    },
    [NODE_TYPES.TASK]: {
      border: isDarkMode ? 'rgba(96, 125, 139, 0.5)' : 'rgba(96, 125, 139, 0.3)',
      bg: isDarkMode ? 'rgba(96, 125, 139, 0.15)' : 'rgba(96, 125, 139, 0.05)',
      text: isDarkMode ? '#b0bec5' : '#607d8b',
      badge: isDarkMode ? '#263238' : '#eceff1',
    },
  };

  const color = colors[type];

  return {
    padding: '8px 12px',
    borderRadius: '5px',
    border: '1px solid',
    borderColor: color.border,
    backgroundColor: color.bg,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    transition: 'all 0.2s ease',
    ...(isHoverable && {
      cursor: 'pointer',
      '&:hover': {
        boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
      }
    }),
    textColor: color.text,
    badgeColor: color.badge,
  };
};

/**
 * Get the appropriate icon for a node type
 */
const getNodeIcon = (type: NodeType) => {
  switch (type) {
    case NODE_TYPES.SEQUENTIAL:
      return <ArrowIcon fontSize="small" />;
    case NODE_TYPES.PARALLEL:
      return <ParallelIcon fontSize="small" />;
    case NODE_TYPES.CONDITION:
      return <ConditionIcon fontSize="small" />;
    case NODE_TYPES.LOOP:
      return <LoopIcon fontSize="small" />;
    case NODE_TYPES.TASK:
    default:
      return <TaskIcon fontSize="small" />;
  }
};

/**
 * TaskNode - Simple task activity node
 */
export const TaskNode: React.FC<FlowNodeProps> = ({ data, isConnectable }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const styles = getBaseNodeStyles(NODE_TYPES.TASK, isDarkMode);

  return (
    <Box
      sx={{
        ...styles,
        width: 160,
        height: 'auto',
        gap: 1,
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        style={getHandleStyle({
          position: Position.Top,
          type: 'target',
          color: styles.textColor,
          isDarkMode
        })}
      />

      <TaskIcon fontSize="small" sx={{ color: styles.textColor }} />
      
      <Tooltip title={data.label} placement="top" arrow>
        <Typography sx={{
          fontSize: '12px',
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '100px',
        }}>
          {data.label}
        </Typography>
      </Tooltip>
      
      <ActivityIdBadge 
        activityId={data.activityId}
        color={styles.textColor}
        bgColor={styles.badgeColor}
        isDarkMode={isDarkMode}
      />

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        style={getHandleStyle({
          position: Position.Bottom,
          type: 'source',
          color: styles.textColor,
          isDarkMode
        })}
      />
    </Box>
  );
};

/**
 * SequentialNode - Sequential activity node
 */
export const SequentialNode: React.FC<FlowNodeProps> = ({ data, isConnectable }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const styles = getBaseNodeStyles(NODE_TYPES.SEQUENTIAL, isDarkMode);
  const hasTargetConnection = useHasConnections(data.id, null, 'target');

  return (
    <Box
      sx={{
        ...styles,
        padding: '10px 16px',
        borderRadius: '8px',
        width: 180,
        height: 'auto',
        boxShadow: '0 3px 5px rgba(0,0,0,0.12)',
        '&:hover': {
          boxShadow: '0 5px 10px rgba(0,0,0,0.15)',
        }
      }}
    >
      {hasTargetConnection && (
        <Handle
          type="target"
          position={Position.Top}
          isConnectable={isConnectable}
          style={getHandleStyle({
            position: Position.Top,
            type: 'target',
            color: styles.textColor,
            isDarkMode,
            size: 10
          })}
        />
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ArrowIcon fontSize="small" sx={{ color: styles.textColor }} />
        <Tooltip title={data.label} placement="top" arrow>
          <Typography 
            sx={{
              fontSize: '13px',
              fontWeight: 600,
              color: styles.textColor,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              maxWidth: '130px'
            }}
            noWrap
          >
            {data.label}
          </Typography>
        </Tooltip>
      </Box>

      <ActivityIdBadge 
        activityId={data.activityId}
        color={styles.textColor}
        bgColor={styles.badgeColor}
        top={-12}
        isDarkMode={isDarkMode}
      />

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        style={getHandleStyle({
          position: Position.Bottom,
          type: 'source',
          color: styles.textColor,
          isDarkMode,
          size: 10
        })}
      />
    </Box>
  );
};

/**
 * ParallelNode - Parallel activity node
 */
export const ParallelNode: React.FC<FlowNodeProps> = ({ data, isConnectable }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const styles = getBaseNodeStyles(NODE_TYPES.PARALLEL, isDarkMode);
  const hasTargetConnection = useHasConnections(data.id, null, 'target');

  return (
    <Box
      sx={{
        ...styles,
        padding: '10px 16px',
        borderRadius: '8px',
        width: 180,
        height: 'auto',
        boxShadow: '0 3px 5px rgba(0,0,0,0.12)',
        '&:hover': {
          boxShadow: '0 5px 10px rgba(0,0,0,0.15)',
        }
      }}
    >
      {hasTargetConnection && (
        <Handle
          type="target"
          position={Position.Top}
          isConnectable={isConnectable}
          style={getHandleStyle({
            position: Position.Top,
            type: 'target',
            color: styles.textColor,
            isDarkMode,
            size: 10
          })}
        />
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ParallelIcon fontSize="small" sx={{ color: styles.textColor }} />
        <Tooltip title={data.label} placement="top" arrow>
          <Typography 
            sx={{
              fontSize: '13px',
              fontWeight: 600,
              color: styles.textColor,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              maxWidth: '130px'
            }}
            noWrap
          >
            {data.label}
          </Typography>
        </Tooltip>
      </Box>

      <ActivityIdBadge 
        activityId={data.activityId}
        color={styles.textColor}
        bgColor={styles.badgeColor}
        top={-12}
        isDarkMode={isDarkMode}
      />

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        style={getHandleStyle({
          position: Position.Bottom,
          type: 'source',
          color: styles.textColor,
          isDarkMode,
          size: 10
        })}
      />
    </Box>
  );
};

/**
 * ConditionNode - Conditional activity (diamond shape)
 */
export const ConditionNode: React.FC<FlowNodeProps> = ({ data, isConnectable }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const styles = getBaseNodeStyles(NODE_TYPES.CONDITION, isDarkMode);

  return (
    <Box
      sx={{
        width: 160,
        height: 160,
        padding: '0px',
        borderRadius: '4px',
        border: '1px solid',
        borderColor: styles.borderColor,
        backgroundColor: styles.backgroundColor,
        position: 'relative',
        transform: 'rotate(45deg)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        boxShadow: '0 3px 6px rgba(0,0,0,0.15)',
        transition: 'all 0.2s ease',
        '&:hover': {
          boxShadow: '0 6px 12px rgba(0,0,0,0.2)',
        }
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="target"
        isConnectable={isConnectable}
        style={getHandleStyle({
          position: Position.Top,
          type: 'target',
          color: styles.textColor,
          isDarkMode,
          size: 10
        })}
      />

      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transform: 'rotate(-45deg)',
        width: '80%',
        height: '80%',
        overflow: 'hidden'
      }}>
        <Typography 
          sx={{
            fontSize: '13px',
            fontWeight: 600,
            color: styles.textColor,
            textAlign: 'center',
            mb: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            maxWidth: '90%'
          }}
        >
          {data.label}
        </Typography>

        {data.condition && (
          <Tooltip title={data.condition} placement="top" arrow>
            <Typography sx={{
              fontSize: '11px',
              fontFamily: 'monospace',
              color: isDarkMode ? '#ffcc80' : '#e65100',
              bgcolor: isDarkMode ? 'rgba(255, 183, 77, 0.1)' : 'rgba(255, 183, 77, 0.1)',
              p: 0.5,
              borderRadius: 0.5,
              maxWidth: '90%',
              textAlign: 'center',
              wordBreak: 'break-word',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical'
            }}>
              {data.condition}
            </Typography>
          </Tooltip>
        )}
      </Box>

      {data.activityId && (
        <Typography
          sx={{
            fontSize: '10px',
            position: 'absolute',
            top: -16,
            right: 0,
            bgcolor: styles.badgeColor,
            color: styles.textColor,
            px: 0.5,
            borderRadius: 1,
            transform: 'rotate(-45deg)',
            zIndex: 10,
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
          }}
        >
          {data.activityId}
        </Typography>
      )}

      {/* Bottom handle for false path */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        isConnectable={isConnectable}
        style={getHandleStyle({
          position: Position.Bottom,
          type: 'source',
          color: '#f44336',
          isDarkMode,
          size: 10
        })}
      />

      {/* Right handle for true path */}
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        isConnectable={isConnectable}
        style={getHandleStyle({
          position: Position.Right,
          type: 'source',
          color: '#4caf50',
          isDarkMode,
          size: 10
        })}
      />
    </Box>
  );
};

/**
 * LoopNode - Loop activity node
 */
export const LoopNode: React.FC<FlowNodeProps> = ({ data, isConnectable }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const styles = getBaseNodeStyles(NODE_TYPES.LOOP, isDarkMode);
  
  // Check if the loop feedback handle has connections
  const hasLoopConnection = useHasConnections(data.id, 'loop', 'source');
  const hasTargetConnection = useHasConnections(data.id, 'target', 'target');

  return (
    <Box
      sx={{
        ...styles,
        padding: '12px 16px',
        borderRadius: '8px',
        width: 180,
        height: 'auto',
        boxShadow: '0 3px 5px rgba(0,0,0,0.12)',
        '&:hover': {
          boxShadow: '0 5px 10px rgba(0,0,0,0.15)',
        }
      }}
    >
      {hasTargetConnection && (
        <Handle
          type="target"
          position={Position.Top}
          id="target"
          isConnectable={isConnectable}
          style={getHandleStyle({
            position: Position.Top,
            type: 'target',
            color: styles.textColor,
            isDarkMode,
            size: 10
          })}
        />
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LoopIcon fontSize="small" sx={{ color: styles.textColor }} />
        <Tooltip title={data.label} placement="top" arrow>
          <Typography 
            sx={{
              fontSize: '13px',
              fontWeight: 600,
              color: styles.textColor,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              maxWidth: '130px'
            }}
            noWrap
          >
            {data.label}
          </Typography>
        </Tooltip>
      </Box>

      {data.condition && (
        <Tooltip title={data.condition} placement="top" arrow>
          <Typography sx={{
            fontSize: '11px',
            fontFamily: 'monospace',
            color: isDarkMode ? '#a5d6a7' : '#2e7d32',
            bgcolor: isDarkMode ? 'rgba(129, 199, 132, 0.1)' : 'rgba(129, 199, 132, 0.1)',
            p: 0.5,
            borderRadius: 0.5,
            mt: 0.5,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            while ({data.condition})
          </Typography>
        </Tooltip>
      )}

      <ActivityIdBadge 
        activityId={data.activityId}
        color={styles.textColor}
        bgColor={styles.badgeColor}
        top={-12}
        isDarkMode={isDarkMode}
      />

      {/* Forward flow handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        style={getHandleStyle({
          position: Position.Bottom,
          type: 'source',
          color: styles.textColor,
          isDarkMode,
          size: 10
        })}
      />

      {/* Loop feedback handle - only if it has connections */}
      {hasLoopConnection && (
        <Handle
          type="source"
          position={Position.Right}
          id="loop"
          isConnectable={isConnectable}
          style={getHandleStyle({
            position: Position.Right,
            type: 'source',
            color: styles.textColor,
            isDarkMode,
            size: 10
          })}
        />
      )}
    </Box>
  );
};