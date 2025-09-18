import React, { useCallback } from 'react';
import {
  BaseEdge,
  EdgeProps,
  getSmoothStepPath,
  getBezierPath,
  Edge,
} from '@xyflow/react';
import { IconButton, useTheme } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface DeletableEdgeData {
  enableEdit?: boolean;
  onEdgeDelete?: (edgeId: string) => void;
}

type DeletableEdgeProps = EdgeProps<Edge<DeletableEdgeData>>;

const DeletableEdge: React.FC<DeletableEdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd,
  ...props
}) => {
  const theme = useTheme();
  
  // Determine if this is a loop feedback edge based on target handle
  const isLoopFeedback = props.targetHandle === "loop";
  
  // Use appropriate path based on edge type
  const [edgePath, labelX, labelY] = isLoopFeedback 
    ? getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      })
    : getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      });

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (data?.onEdgeDelete) {
      data.onEdgeDelete(id);
    }
  }, [id, data]);

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      {data?.enableEdit && data?.onEdgeDelete && (
        <foreignObject
          width={24}
          height={24}
          x={labelX - 10}
          y={labelY - 10}
          className="edgebutton-foreignobject"
          requiredExtensions="http://www.w3.org/1999/xhtml"
        >
          <IconButton
            onClick={handleDelete}
            size="small"
            sx={{
              bgcolor: '#f44336',
              color: 'white',
              width: 20,
              height: 20,
              minWidth: 20,
              minHeight: 20,
              padding: 0,
              '&:hover': {
                bgcolor: '#d32f2f',
                transform: 'scale(1.1)',
              },
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              border: `1px solid ${theme.palette.mode === 'dark' ? '#333' : '#fff'}`,
            }}
          >
            <CloseIcon sx={{ fontSize: 12 }} />
          </IconButton>
        </foreignObject>
      )}
    </>
  );
};

export default DeletableEdge;