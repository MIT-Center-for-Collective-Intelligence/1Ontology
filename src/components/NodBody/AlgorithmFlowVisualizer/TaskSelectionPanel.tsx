import React, { useMemo } from 'react';
import { Panel } from '@xyflow/react';
import {
  Box,
  Typography,
  Chip,
} from '@mui/material';
import { Task as TaskIcon } from '@mui/icons-material';
import { INode } from '@components/types/INode';

interface TaskSelectionPanelProps {
  isDarkMode: boolean;
  currentNode: INode;
  nodes: { [id: string]: INode };
  onTaskSelect: (taskNode: INode) => void;
  visible: boolean;
}

/**
 * Creates base panel styles based on theme mode (same as LegendPanel)
 */
const createBasePanelStyles = (isDarkMode: boolean) => ({
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

const TaskSelectionPanel: React.FC<TaskSelectionPanelProps> = ({
  isDarkMode,
  currentNode,
  nodes,
  onTaskSelect,
  visible,
}) => {
  const basePanelStyles = createBasePanelStyles(isDarkMode);

  // Get all parts from the current node (same logic as modal)
  const availableTasks = useMemo(() => {
    if (!currentNode.properties.parts || !Array.isArray(currentNode.properties.parts)) {
      return [];
    }

    // Flatten all parts from all collections
    const allParts = currentNode.properties.parts.flatMap(collection => 
      collection.nodes.map(node => ({
        id: node.id,
        collectionName: collection.collectionName
      }))
    );

    // Get the actual node data for each part
    return allParts
      .map(part => ({
        ...part,
        node: nodes[part.id]
      }))
      .filter(part => part.node) // Only include parts that exist in nodes
      .sort((a, b) => a.node.title.localeCompare(b.node.title)); // Sort alphabetically
  }, [currentNode.properties.parts, nodes]);

  if (!visible) {
    return null;
  }

  return (
    <Panel 
      position="top-left" 
      style={{
        ...basePanelStyles,
        width: '280px',
        maxHeight: '320px',
        marginLeft: '180px', // Position to the right of legend panel
        overflow: 'hidden',
      }}
    >
      <Box 
        sx={{ 
          display: "flex", 
          flexDirection: "column", 
          gap: 0.5,
          maxHeight: '300px',
          overflowY: 'auto',
          pr: 0.5,
          scrollbarWidth: 'thin',
          scrollbarColor: `${isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.35)'} transparent`,
          '&::-webkit-scrollbar': {
            width: '6px',
            height: '6px'
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.35)',
            borderRadius: '3px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.45)',
          },
        }}
      >
        {availableTasks.length === 0 ? (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center',
            minHeight: '120px',
            textAlign: 'center',
            py: 2
          }}>
            <TaskIcon 
              sx={{ 
                fontSize: 32, 
                color: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
                mb: 1 
              }} 
            />
            <Typography 
              variant="caption" 
              sx={{ 
                color: isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
                fontSize: '11px',
                lineHeight: 1.3
              }}
            >
              No parts available.<br />
              Add parts to create tasks.
            </Typography>
          </Box>
        ) : (
          availableTasks.map(({ node, collectionName }) => (
            <Box
              key={node.id}
              onClick={() => onTaskSelect(node)}
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 0.3,
                cursor: "pointer",
                padding: "6px 8px",
                borderRadius: "4px",
                backgroundColor: "transparent",
                transition: "all 0.2s ease",
                border: `1px solid transparent`,
                "&:hover": {
                  backgroundColor: isDarkMode
                    ? "rgba(255, 255, 255, 0.1)"
                    : "rgba(0, 0, 0, 0.05)",
                  transform: "translateX(2px)",
                  border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                },
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, width: "100%" }}>
                <TaskIcon 
                  fontSize="small" 
                  sx={{ 
                    color: isDarkMode ? '#b0bec5' : '#607d8b',
                    flexShrink: 0
                  }} 
                />
                <Typography 
                  variant="caption" 
                  sx={{
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    fontSize: '12px'
                  }}
                >
                  {node.title}
                </Typography>
                {collectionName !== 'main' && (
                  <Chip 
                    label={collectionName} 
                    size="small" 
                    variant="outlined"
                    sx={{ 
                      fontSize: '9px', 
                      height: '16px',
                      '& .MuiChip-label': {
                        px: 0.5
                      }
                    }}
                  />
                )}
              </Box>
              
              {/* Description preview - only if available */}
              {node.properties.description && 
               typeof node.properties.description === 'string' && 
               node.properties.description.trim() && (
                <Typography 
                  variant="caption" 
                  sx={{
                    fontSize: '10px',
                    paddingLeft: '10.5px',
                    color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    lineHeight: 1.2,
                    ml: 2.5 // Align with title
                  }}
                >
                  {node.properties.description.substring(0, 80)}
                  {node.properties.description.length > 80 && '...'}
                </Typography>
              )}
            </Box>
          ))
        )}
      </Box>
    </Panel>
  );
};

export default TaskSelectionPanel;