import React, { useState, useCallback, useRef, useEffect } from 'react';
import { NodeProps, NodeResizer, Handle, Position, useReactFlow } from '@xyflow/react';
import { Box, Typography, IconButton, TextField } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import LinearScaleIcon from '@mui/icons-material/LinearScale';
import LoopIcon from '@mui/icons-material/Loop';
import { useTheme } from '@mui/material/styles';

export interface ContainerNodeData {
  label: string;
  type: 'sequential-container' | 'parallel-container' | 'loop-container';
  enableEdit?: boolean;
  onNodeDelete?: (nodeId: string) => void;
  onNodeUpdate?: (nodeId: string, updates: any) => void;
  color?: string;
  condition?: string; // For loop containers
  // Size restrictions removed - containers can be resized freely
}

/**
 * ResizableContainer - A flexible container node that can be resized and styled
 * Supports automatic child detection when nodes are dragged over it
 */
export const ResizableContainer: React.FC<NodeProps<ContainerNodeData>> = ({
  id,
  data,
  selected,
  dragging,
}) => {
  const theme = useTheme();
  const { getNodes, setNodes } = useReactFlow();
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [tempLabel, setTempLabel] = useState(data.label);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [dragOverCount, setDragOverCount] = useState(0);
  
  const isDarkMode = theme.palette.mode === 'dark';
  const isSequential = data.type === 'sequential-container';
  const isParallel = data.type === 'parallel-container';
  const isLoop = data.type === 'loop-container';
  
  // Default colors based on type
  const defaultColor = isSequential
    ? (isDarkMode ? '#90caf9' : '#1976d2')
    : isParallel
    ? (isDarkMode ? '#ce93d8' : '#9c27b0')
    : (isDarkMode ? '#81c784' : '#43a047'); // Green for loop containers
  
  const containerColor = data.color || defaultColor;

  // Handle label editing
  const handleLabelEdit = useCallback(() => {
    if (data.enableEdit) {
      setIsEditingLabel(true);
      setTempLabel(data.label);
    }
  }, [data.enableEdit, data.label]);

  const handleLabelSave = useCallback(() => {
    setIsEditingLabel(false);
    if (data.onNodeUpdate && tempLabel !== data.label) {
      data.onNodeUpdate(id, { label: tempLabel });
    }
  }, [data, id, tempLabel]);

  const handleLabelCancel = useCallback(() => {
    setIsEditingLabel(false);
    setTempLabel(data.label);
  }, [data.label]);

  const handleDelete = useCallback(() => {
    if (data.onNodeDelete) {
      // Get child nodes before deletion for user confirmation
      const nodes = getNodes();
      const childNodes = nodes.filter(n => n.parentId === id);
      
      if (childNodes.length > 0) {
        const childNames = childNodes.map(n => n.data?.label || n.id).join(', ');
        if (window.confirm(`This container has ${childNodes.length} locked nodes (${childNames}). Delete container and unlock all nodes?`)) {
          data.onNodeDelete(id);
        }
      } else {
        data.onNodeDelete(id);
      }
    }
  }, [data, id, getNodes]);

  // Visual feedback for drag operations
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !data.enableEdit) return;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      setDragOverCount(prev => prev + 1);
      setIsDropTarget(true);
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      // Visual indication that drop is allowed
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      setDragOverCount(prev => {
        const newCount = prev - 1;
        if (newCount <= 0) {
          setIsDropTarget(false);
          return 0;
        }
        return newCount;
      });
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDropTarget(false);
      setDragOverCount(0);
      // Drop handling is managed by ContainerManager
    };

    container.addEventListener('dragenter', handleDragEnter);
    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('dragleave', handleDragLeave);
    container.addEventListener('drop', handleDrop);

    return () => {
      container.removeEventListener('dragenter', handleDragEnter);
      container.removeEventListener('dragover', handleDragOver);
      container.removeEventListener('dragleave', handleDragLeave);
      container.removeEventListener('drop', handleDrop);
    };
  }, [data.enableEdit]);

  return (
    <Box
      ref={containerRef}
      sx={{
        width: '100%',
        height: '100%',
        // More node-like background with subtle gradient
        background: isDropTarget 
          ? (isDarkMode ? 'linear-gradient(135deg, rgba(76, 175, 80, 0.15), rgba(76, 175, 80, 0.08))' 
                        : 'linear-gradient(135deg, rgba(76, 175, 80, 0.08), rgba(76, 175, 80, 0.04))')
          : (isDarkMode ? `linear-gradient(135deg, ${containerColor}08, ${containerColor}04)` 
                        : `linear-gradient(135deg, ${containerColor}06, ${containerColor}02)`),
        // Refined border styling
        border: isDropTarget 
          ? `2px solid ${isDarkMode ? '#81c784' : '#4caf50'}` 
          : selected 
            ? `2px solid ${containerColor}` 
            : `1px solid ${containerColor}40`,
        borderRadius: '12px', // Slightly more rounded for modern look
        padding: 1.5,
        position: 'relative',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', // Smoother transition
        // Subtle shadow that matches node styling
        boxShadow: isDropTarget 
          ? `0 8px 32px ${isDarkMode ? 'rgba(129, 199, 132, 0.3)' : 'rgba(76, 175, 80, 0.25)'}` 
          : selected
            ? `0 6px 24px ${containerColor}20`
            : `0 2px 8px ${isDarkMode ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.1)'}`,
        // Hover effects that match nodes
        '&:hover': {
          background: isDropTarget 
            ? (isDarkMode ? 'linear-gradient(135deg, rgba(76, 175, 80, 0.2), rgba(76, 175, 80, 0.12))' 
                          : 'linear-gradient(135deg, rgba(76, 175, 80, 0.12), rgba(76, 175, 80, 0.06))')
            : (isDarkMode ? `linear-gradient(135deg, ${containerColor}12, ${containerColor}08)` 
                          : `linear-gradient(135deg, ${containerColor}10, ${containerColor}05)`),
          boxShadow: selected
            ? `0 8px 32px ${containerColor}25`
            : `0 4px 16px ${isDarkMode ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.15)'}`,
        },
      }}
    >
      {/* Node Resizer - only visible when editing is enabled */}
      {data.enableEdit && (
        <NodeResizer
          color={containerColor}
          // No size restrictions - containers can be resized freely
          handleStyle={{
            width: '10px',
            height: '10px',
            borderRadius: '2px',
          }}
          lineStyle={{
            borderColor: containerColor,
            borderWidth: 1,
          }}
        />
      )}

      {/* Container Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 1.5,
          pb: 1,
          borderBottom: `1px solid ${containerColor}20`,
          background: `linear-gradient(90deg, ${containerColor}08, transparent)`,
          borderRadius: '6px',
          mx: -0.5,
          px: 1,
          py: 0.5,
        }}
      >
        {isEditingLabel ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              value={tempLabel}
              onChange={(e) => setTempLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLabelSave();
                if (e.key === 'Escape') handleLabelCancel();
              }}
              size="small"
              autoFocus
              variant="standard"
              sx={{
                '& .MuiInput-root': {
                  fontSize: '14px',
                  color: containerColor,
                },
              }}
            />
            <IconButton size="small" onClick={handleLabelSave}>
              <CheckIcon fontSize="small" />
            </IconButton>
          </Box>
        ) : (
          <Typography
            variant="body2"
            sx={{
              color: containerColor,
              fontWeight: 600,
              fontSize: '13px',
              textTransform: 'none', // More natural, less aggressive
              letterSpacing: '0.2px', // Subtle spacing
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              cursor: data.enableEdit ? 'pointer' : 'default',
              opacity: 0.9,
              '&:hover': data.enableEdit ? {
                opacity: 1,
                transform: 'scale(1.02)',
                transition: 'all 0.2s ease',
              } : {},
            }}
            onClick={handleLabelEdit}
          >
            {isSequential ? (
              <LinearScaleIcon sx={{ fontSize: 16, opacity: 0.8, mr: 0.5 }} />
            ) : isParallel ? (
              <CallSplitIcon sx={{ fontSize: 16, opacity: 0.8, mr: 0.5 }} />
            ) : (
              <LoopIcon sx={{ fontSize: 16, opacity: 0.8, mr: 0.5 }} />
            )}
            {data.label}
            {data.enableEdit && (
              <EditIcon sx={{ fontSize: 14, opacity: 0.6 }} />
            )}
          </Typography>
        )}

        {/* Delete button */}
        {data.enableEdit && !isEditingLabel && (
          <IconButton
            size="small"
            onClick={handleDelete}
            sx={{
              opacity: 0.6,
              color: '#f44336',
              '&:hover': {
                opacity: 1,
                backgroundColor: 'rgba(244, 67, 54, 0.1)'
              },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* Loop condition display - below header */}
      {isLoop && data.condition && (
        <Box
          sx={{
            mb: 2,
            mx: 1,
            position: 'relative',
          }}
        >
          <Box
            sx={{
              background: `linear-gradient(90deg, ${containerColor}15, ${containerColor}08, ${containerColor}15)`,
              borderRadius: '8px',
              border: `1px solid ${containerColor}30`,
              px: 2,
              py: 1,
              position: 'relative',
              '&::before': {
                content: '""',
                position: 'absolute',
                left: '12px',
                top: '-1px',
                width: '20px',
                height: '2px',
                background: containerColor,
                opacity: 0.4,
              }
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: containerColor,
                fontSize: '12px',
                fontWeight: 500,
                opacity: 0.9,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.5,
                fontFamily: 'monospace',
                letterSpacing: '0.3px',
              }}
            >
              <LoopIcon sx={{ fontSize: 14, opacity: 0.7 }} />
              while ({data.condition})
            </Typography>
          </Box>
        </Box>
      )}

      {/* Connection handles for containers */}
      <Handle
        type="target"
        position={Position.Top}
        id="target-top"
        style={{
          background: containerColor,
          width: 8,
          height: 8,
        }}
      />

      {/* Visual indicator for distribution point */}
      <Box
        sx={{
          position: 'absolute',
          top: isLoop && data.condition ? '81px' : '35px', // Loop with condition: 81px, others: 35px (moved down from 20px)
          left: '50%',
          transform: 'translateX(-50%)',
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          backgroundColor: 'transparent',
          border: `1px dashed ${containerColor}`,
          opacity: 0.5,
          zIndex: 10,
          pointerEvents: 'none',
        }}
      />

      {/* Distribution source handle centered inside the dotted border */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="source-top"
        style={{
          background: containerColor,
          width: 12,
          height: 12,
          top: isLoop && data.condition ? '84px' : '38px', // Loop with condition: 84px, others: 38px (moved down from 23px)
          left: '50%',
          transform: 'translateX(-50%)',
          border: `2px solid ${isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'}`,
          borderRadius: '50%',
          zIndex: 15,
          boxShadow: `0 2px 4px rgba(0,0,0,0.2)`,
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="source-bottom"
        style={{
          background: containerColor,
          width: 8,
          height: 8,
        }}
      />

      {/* Visual hint for container state */}
      {data.enableEdit && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: isDropTarget ? 0.9 : 0.4,
            pointerEvents: 'none',
            textAlign: 'center',
            transition: 'all 0.3s ease',
            padding: 1,
            borderRadius: '6px',
            background: isDropTarget 
              ? (isDarkMode ? 'rgba(76, 175, 80, 0.1)' : 'rgba(76, 175, 80, 0.05)')
              : 'transparent',
          }}
        >
          <Typography 
            variant="caption" 
            sx={{ 
              color: isDropTarget ? '#4caf50' : `${containerColor}cc`,
              fontWeight: isDropTarget ? 600 : 500,
              fontSize: isDropTarget ? '13px' : '11px',
              lineHeight: 1.3,
              textShadow: isDarkMode ? '0 1px 3px rgba(0,0,0,0.5)' : '0 1px 2px rgba(255,255,255,0.8)',
            }}
          >
            {isDropTarget 
              ? `🔒 Drop to add node` 
              : (isSequential ? 'Drop nodes here' 
                 : isParallel ? 'Drop nodes here'
                 : 'Drop nodes here')
            }
          </Typography>
        </Box>
      )}
    </Box>
  );
};

// Export node types for registration
export const containerNodeTypes = {
  'sequential-container': ResizableContainer,
  'parallel-container': ResizableContainer,
  'loop-container': ResizableContainer,
};