import React, { useState, useCallback } from 'react';
import { NodeProps, Position, Handle, useStore } from '@xyflow/react';
import { Box, Typography, useTheme, Tooltip, TextField, IconButton } from '@mui/material';
import {
  ArrowDownward as ArrowIcon,
  CallSplit as ParallelIcon,
  Help as ConditionIcon,
  Loop as LoopIcon,
  Task as TaskIcon,
  Close as CloseIcon,
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
  node_id?: string;
  navigateToNode?: (nodeId: string) => void;
  enableEdit?: boolean;
  onNodeDelete?: (nodeId: string) => void;
  onNodeUpdate?: (nodeId: string, updates: Partial<NodeData>) => void;
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
 * Editable text field component for node editing
 */
const EditableTextField: React.FC<{
  value: string;
  onSave: (value: string) => void;
  placeholder?: string;
  fontSize?: string;
  fontWeight?: string | number;
  color?: string;
  maxWidth?: string;
  multiline?: boolean;
  disabled?: boolean;
  accentColor?: string;
}> = ({ 
  value, 
  onSave, 
  placeholder, 
  fontSize = '13px', 
  fontWeight = 600, 
  color, 
  maxWidth = '130px',
  multiline = false,
  disabled = false,
  accentColor
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = useCallback(() => {
    if (editValue.trim() !== value && editValue.trim() !== '') {
      onSave(editValue.trim());
    }
    setIsEditing(false);
  }, [editValue, value, onSave]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
  }, [handleSave, value, multiline]);

  if (disabled || !isEditing) {
    return (
      <Tooltip title={disabled ? value : "Click to edit"} placement="top" arrow>
        <Typography
          onClick={() => !disabled && setIsEditing(true)}
          sx={{
            fontSize,
            fontWeight,
            color: value ? color : 'rgba(255, 255, 255, 0.7)', // Use more visible color for placeholder
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: multiline ? 'normal' : 'nowrap',
            maxWidth,
            cursor: disabled ? 'default' : 'pointer',
            fontStyle: value ? 'normal' : 'italic', // Make placeholder italic
            '&:hover': disabled ? {} : {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '2px',
            },
            display: multiline ? '-webkit-box' : 'block',
            ...(multiline && {
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            })
          }}
          noWrap={!multiline}
        >
          {value || placeholder}
        </Typography>
      </Tooltip>
    );
  }

  return (
    <TextField
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onBlur={handleSave}
      onKeyDown={handleKeyPress}
      autoFocus
      size="small"
      multiline={multiline}
      rows={multiline ? 1 : 1}
      minRows={multiline ? 1 : 1}
      maxRows={multiline ? 2 : 1}
      variant="standard"
      sx={{
        '& .MuiInputBase-input': {
          fontSize,
          fontWeight,
          color,
          padding: multiline ? '2px 3px' : '1px 3px',
          lineHeight: multiline ? '1.1' : '1',
          border: `1px solid ${accentColor || 'rgba(255, 255, 255, 0.3)'}`,
          borderRadius: '2px',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          resize: 'none',
          '&:focus': {
            border: `1px solid ${accentColor || 'rgba(255, 255, 255, 0.6)'}`,
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
          }
        },
        '& .MuiInputBase-inputMultiline': {
          padding: '2px 3px !important',
          lineHeight: '1.1 !important',
          minHeight: 'unset !important',
          overflow: 'hidden',
        },
        '& .MuiInput-underline:before': {
          display: 'none',
        },
        '& .MuiInput-underline:hover:before': {
          display: 'none',
        },
        '& .MuiInput-underline:after': {
          display: 'none',
        },
        '& .MuiInputBase-root': {
          minHeight: 'unset',
          position: 'relative',
        },
        maxWidth,
        minHeight: 'unset',
        width: '100%',
      }}
    />
  );
};

/**
 * Delete button component for nodes in edit mode
 */
const DeleteButton: React.FC<{
  nodeId: string;
  onDelete: (nodeId: string) => void;
  isDarkMode: boolean;
  size?: 'small' | 'medium';
}> = ({ nodeId, onDelete, isDarkMode, size = 'small' }) => {
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(nodeId);
  }, [nodeId, onDelete]);

  return (
    <IconButton
      onClick={handleDelete}
      size={size}
      sx={{
        position: 'absolute',
        top: -8,
        right: -8,
        bgcolor: '#f44336',
        color: 'white',
        width: 20,
        height: 20,
        '&:hover': {
          bgcolor: '#d32f2f',
          transform: 'scale(1.1)',
        },
        transition: 'all 0.2s ease',
        zIndex: 10,
      }}
    >
      <CloseIcon sx={{ fontSize: 14 }} />
    </IconButton>
  );
};

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

  const handleNodeClick = (event: React.MouseEvent) => {
    // In edit mode, allow React Flow to handle clicks for selection
    if (data.enableEdit) {
      console.log('TaskNode clicked in edit mode - allowing selection');
      return; // Let React Flow handle the click for selection
    }
    
    // In view mode, handle navigation
    event.stopPropagation(); // Prevent React Flow from handling the click
    console.log('TaskNode clicked:', { node_id: data.node_id, hasNavigate: !!data.navigateToNode });
    if (data.node_id && data.navigateToNode) {
      data.navigateToNode(data.node_id);
    }
  };

  return (
    <Box
      onClick={handleNodeClick}
      sx={{
        ...styles,
        width: 160,
        height: 'auto',
        gap: 1,
        cursor: (data.node_id && data.navigateToNode && !data.enableEdit) ? 'pointer' : 'default',
        '&:hover': (data.node_id && data.navigateToNode && !data.enableEdit) ? {
          transform: 'scale(1.02)',
          transition: 'transform 0.2s ease-in-out',
        } : {},
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
      
      {!data.enableEdit && (
        <ActivityIdBadge 
          activityId={data.activityId}
          color={styles.textColor}
          bgColor={styles.badgeColor}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Delete button for edit mode */}
      {data.enableEdit && data.onNodeDelete && (
        <DeleteButton
          nodeId={data.id}
          onDelete={data.onNodeDelete}
          isDarkMode={isDarkMode}
        />
      )}

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

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ArrowIcon fontSize="small" sx={{ color: styles.textColor }} />
        {data.enableEdit && data.onNodeUpdate ? (
          <EditableTextField
            value={data.label}
            onSave={(newLabel) => data.onNodeUpdate?.(data.id, { label: newLabel })}
            fontSize="13px"
            fontWeight={600}
            color={styles.textColor}
            maxWidth="130px"
            accentColor={styles.textColor}
          />
        ) : (
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
        )}
      </Box>

      {/* Hide ID badge during edit mode */}
      {!data.enableEdit && (
        <ActivityIdBadge 
          activityId={data.activityId}
          color={styles.textColor}
          bgColor={styles.badgeColor}
          top={-12}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Delete button for edit mode */}
      {data.enableEdit && data.onNodeDelete && (
        <DeleteButton
          nodeId={data.id}
          onDelete={data.onNodeDelete}
          isDarkMode={isDarkMode}
        />
      )}

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

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ParallelIcon fontSize="small" sx={{ color: styles.textColor }} />
        {data.enableEdit && data.onNodeUpdate ? (
          <EditableTextField
            value={data.label}
            onSave={(newLabel) => data.onNodeUpdate?.(data.id, { label: newLabel })}
            fontSize="13px"
            fontWeight={600}
            color={styles.textColor}
            maxWidth="130px"
            accentColor={styles.textColor}
          />
        ) : (
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
        )}
      </Box>

      {/* Hide ID badge during edit mode */}
      {!data.enableEdit && (
        <ActivityIdBadge 
          activityId={data.activityId}
          color={styles.textColor}
          bgColor={styles.badgeColor}
          top={-12}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Delete button for edit mode */}
      {data.enableEdit && data.onNodeDelete && (
        <DeleteButton
          nodeId={data.id}
          onDelete={data.onNodeDelete}
          isDarkMode={isDarkMode}
        />
      )}

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
        style={{
          background: styles.textColor,
          width: 8,
          height: 8,
          borderRadius: '50%',
          border: `2px solid ${isDarkMode ? '#1a1a1a' : '#fff'}`,
          // Position at the actual diamond top vertex (top-left corner of rotated square)
          top: -4,
          left: -4,
          transform: 'none',
        }}
      />

      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transform: 'rotate(-45deg)',
        width: '80%',
        height: '80%',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {data.enableEdit && data.onNodeUpdate ? (
          <EditableTextField
            value={data.label}
            onSave={(newLabel) => data.onNodeUpdate?.(data.id, { label: newLabel })}
            fontSize="13px"
            fontWeight={600}
            color={styles.textColor}
            maxWidth="90%"
            multiline={false}
            accentColor={styles.textColor}
          />
        ) : (
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
        )}

        {data.condition && (
          data.enableEdit && data.onNodeUpdate ? (
            <EditableTextField
              value={data.condition}
              onSave={(newCondition) => data.onNodeUpdate?.(data.id, { condition: newCondition })}
              fontSize="11px"
              fontWeight={400}
              color={isDarkMode ? '#ffcc80' : '#e65100'}
              maxWidth="90%"
              multiline={true}
              placeholder="Condition"
              accentColor={isDarkMode ? '#ffcc80' : '#e65100'}
            />
          ) : (
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
          )
        )}
      </Box>

      {/* Hide ID badge during edit mode */}
      {!data.enableEdit && data.activityId && (
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

      {/* Delete button for edit mode */}
      {data.enableEdit && data.onNodeDelete && (
        <Box sx={{ 
          position: 'absolute', 
          top: -8, 
          left: '50%', 
          transform: 'translateX(-50%) rotate(-45deg)', 
          zIndex: 15 
        }}>
          <DeleteButton
            nodeId={data.id}
            onDelete={data.onNodeDelete}
            isDarkMode={isDarkMode}
          />
        </Box>
      )}

      {/* Bottom handle for false path - positioned at bottom vertex */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        isConnectable={isConnectable}
        style={{
          background: '#f44336',
          width: 8,
          height: 8,
          borderRadius: '50%',
          border: `2px solid ${isDarkMode ? '#1a1a1a' : '#fff'}`,
          // Position at the bottom vertex (bottom-left corner of rotated square)
          bottom: -4,
          left: -4,
          transform: 'none',
        }}
      />

      {/* Right handle for true path - positioned at right vertex */}
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        isConnectable={isConnectable}
        style={{
          background: '#4caf50',
          width: 8,
          height: 8,
          borderRadius: '50%',
          border: `2px solid ${isDarkMode ? '#1a1a1a' : '#fff'}`,
          // Position at the right vertex (top-right corner of rotated square)
          top: -4,
          right: -4,
          transform: 'none',
        }}
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
  

  return (
    <Box
      sx={{
        ...styles,
        padding: '12px 16px',
        borderRadius: '8px',
        width: 200,
        height: 'auto',
        flexDirection: 'column',
        alignItems: 'flex-start',
        boxShadow: '0 3px 5px rgba(0,0,0,0.12)',
        '&:hover': {
          boxShadow: '0 5px 10px rgba(0,0,0,0.15)',
        }
      }}
    >
      {/* Target handle - always visible for connections */}
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

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
        <LoopIcon fontSize="small" sx={{ color: styles.textColor }} />
        {data.enableEdit && data.onNodeUpdate ? (
          <EditableTextField
            value={data.label}
            onSave={(newLabel) => data.onNodeUpdate?.(data.id, { label: newLabel })}
            placeholder="Loop name"
            fontSize="13px"
            fontWeight={600}
            color={styles.textColor}
            maxWidth="150px"
            accentColor={styles.textColor}
          />
        ) : (
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
                maxWidth: '150px'
              }}
              noWrap
            >
              {data.label}
            </Typography>
          </Tooltip>
        )}
      </Box>

      {data.condition && (
        <Box sx={{ mt: 1, width: '100%', maxWidth: '168px' }}>
          {data.enableEdit && data.onNodeUpdate ? (
            <EditableTextField
              value={data.condition}
              onSave={(newCondition) => data.onNodeUpdate?.(data.id, { condition: newCondition })}
              fontSize="11px"
              fontWeight={400}
              color={isDarkMode ? '#a5d6a7' : '#2e7d32'}
              maxWidth="168px"
              placeholder="Loop condition"
              accentColor={isDarkMode ? '#a5d6a7' : '#2e7d32'}
            />
          ) : (
            <Tooltip title={`while (${data.condition})`} placement="top" arrow>
              <Typography sx={{
                fontSize: '11px',
                fontFamily: 'monospace',
                color: isDarkMode ? '#a5d6a7' : '#2e7d32',
                bgcolor: isDarkMode ? 'rgba(129, 199, 132, 0.1)' : 'rgba(129, 199, 132, 0.1)',
                p: '3px 6px',
                borderRadius: 0.5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '168px',
                textAlign: 'center',
                display: 'block',
              }}>
                while ({data.condition})
              </Typography>
            </Tooltip>
          )}
        </Box>
      )}

      {/* Hide ID badge during edit mode */}
      {!data.enableEdit && (
        <ActivityIdBadge 
          activityId={data.activityId}
          color={styles.textColor}
          bgColor={styles.badgeColor}
          top={-12}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Delete button for edit mode */}
      {data.enableEdit && data.onNodeDelete && (
        <DeleteButton
          nodeId={data.id}
          onDelete={data.onNodeDelete}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Loop body feedback handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="body"
        isConnectable={isConnectable}
        style={getHandleStyle({
          position: Position.Left,
          type: 'target',
          color: styles.textColor,
          isDarkMode,
          size: 10
        })}
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

      {/* Loop feedback handle - always visible for connections */}
      <Handle
        type="target"
        position={Position.Right}
        id="loop"
        isConnectable={isConnectable}
        style={getHandleStyle({
          position: Position.Right,
          type: 'target',
          color: styles.textColor,
          isDarkMode,
          size: 10
        })}
      />
    </Box>
  );
};