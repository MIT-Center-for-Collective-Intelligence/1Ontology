import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  NodeTypes,
  NodeProps,
  Node,
  ReactFlowInstance,
  BackgroundVariant
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Box,
  Paper,
  CircularProgress,
  useTheme,
} from '@mui/material';
import { IAlgorithm } from ' @components/types/INode';

// Import custom components
import {
  TaskNode,
  SequentialNode,
  ParallelNode,
  ConditionNode,
  LoopNode,
  NodeData,
  NODE_TYPES
} from './NodeComponent';

import {
  ControlPanel,
  LegendPanel,
  PerformanceModelPanel,
} from './FlowUIComponents';

import { FlowGenerator } from './FlowGenerator';

/**
 * Custom node types mapping for React Flow
 */
const nodeTypes: NodeTypes = {
  [NODE_TYPES.TASK]: TaskNode as React.ComponentType<NodeProps>,
  [NODE_TYPES.SEQUENTIAL]: SequentialNode as React.ComponentType<NodeProps>,
  [NODE_TYPES.PARALLEL]: ParallelNode as React.ComponentType<NodeProps>,
  [NODE_TYPES.CONDITION]: ConditionNode as React.ComponentType<NodeProps>,
  [NODE_TYPES.LOOP]: LoopNode as React.ComponentType<NodeProps>,
};

/**
 * Props for the AlgorithmFlowVisualizer component
 */
interface AlgorithmFlowVisualizerProps {
  algorithm: IAlgorithm;
  isDarkMode: boolean;
}

/**
 * AlgorithmFlowVisualizer - Renders an algorithm as an interactive flowchart
 * 
 * This component takes an algorithm definition and visualizes it as a flowchart
 * using React Flow. It handles the conversion of algorithm data to nodes and edges,
 * manages the flowchart state, and provides controls for zooming and navigation.
 */
const AlgorithmFlowVisualizer: React.FC<AlgorithmFlowVisualizerProps> = ({
  algorithm,
  isDarkMode,
}) => {
  const theme = useTheme();
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Generate nodes and edges for the flowchart
  const { initialNodes, initialEdges } = useMemo(() => {
    const flowGenerator = new FlowGenerator(isDarkMode);
    const result = flowGenerator.generateFlow(algorithm);
    
    return {
      initialNodes: result.nodes,
      initialEdges: result.edges
    };
  }, [algorithm, isDarkMode]);
  
  // Set up React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  /**
   * Handles initialization of React Flow instance
   */
  const onInit = useCallback((instance: ReactFlowInstance) => {
    setReactFlowInstance(instance);
    setLoading(false);
    
    // Fit view after a slight delay to ensure proper rendering
    setTimeout(() => {
      instance.fitView({ padding: 0.2 });
    }, 100);
  }, []);

  // Update nodes and edges when algorithm changes
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    setLoading(false);
    
    // If instance exists, fit view after updating
    if (reactFlowInstance) {
      setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.2 });
      }, 100);
    }
  }, [initialNodes, initialEdges, setNodes, setEdges, reactFlowInstance]);

  /**
   * Zoom and view control handlers
   */
  const handleZoomIn = useCallback(() => {
    reactFlowInstance?.zoomIn();
  }, [reactFlowInstance]);

  const handleZoomOut = useCallback(() => {
    reactFlowInstance?.zoomOut();
  }, [reactFlowInstance]);

  const handleFitView = useCallback(() => {
    reactFlowInstance?.fitView({ padding: 0.2 });
  }, [reactFlowInstance]);

  /**
   * Get node color for minimap based on node type
   */
  const getNodeColor = useCallback((node: Node) => {
    const nodeType = node.type as string;
    switch (nodeType) {
      case NODE_TYPES.SEQUENTIAL:
        return isDarkMode ? 'rgba(25, 118, 210, 0.6)' : 'rgba(25, 118, 210, 0.4)';
      case NODE_TYPES.PARALLEL:
        return isDarkMode ? 'rgba(156, 39, 176, 0.6)' : 'rgba(156, 39, 176, 0.4)';
      case NODE_TYPES.CONDITION:
        return isDarkMode ? 'rgba(245, 124, 0, 0.6)' : 'rgba(245, 124, 0, 0.4)';
      case NODE_TYPES.LOOP:
        return isDarkMode ? 'rgba(67, 160, 71, 0.6)' : 'rgba(67, 160, 71, 0.4)';
      case NODE_TYPES.TASK:
        return isDarkMode ? 'rgba(96, 125, 139, 0.6)' : 'rgba(96, 125, 139, 0.4)';
      default:
        return isDarkMode ? '#555' : '#eee';
    }
  }, [isDarkMode]);

  // Render the flow chart
  return (
    <Paper
      elevation={1}
      sx={{
        height: '650px',
        borderRadius: 1,
        overflow: 'hidden',
        position: 'relative',
        bgcolor: theme => theme.palette.mode === "dark" ? "#1a1a1a" : "#f8f9fa",
      }}
    >
      {loading ? (
        <LoadingIndicator />
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onInit={onInit}
          nodesDraggable={false}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={4}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          attributionPosition="bottom-left"
          proOptions={{ hideAttribution: true }}
          colorMode={theme.palette.mode === "dark" ? "dark" : "light"}
        >
          {/* Panels and Controls */}
          <ControlPanel 
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onFitView={handleFitView}
          />
          <LegendPanel isDarkMode={isDarkMode} />
          <PerformanceModelPanel algorithm={algorithm} isDarkMode={isDarkMode} />
          
          {/* Background */}
          <Background 
            color={isDarkMode ? "#333" : "#ccc"} 
            gap={16}
            size={1}
            variant={BackgroundVariant.Dots}
          />
          
          {/* Hide default controls since we're using custom ones */}
          <Controls 
            position="bottom-right"
            style={{ display: 'none' }}
          />
          
          {/* Minimap */}
          <MiniMap 
            nodeStrokeColor={isDarkMode ? "#555" : "#ccc"}
            nodeColor={getNodeColor}
          />
        </ReactFlow>
      )}
    </Paper>
  );
};

/**
 * Loading indicator component
 */
const LoadingIndicator: React.FC = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
    <CircularProgress />
  </Box>
);

export default AlgorithmFlowVisualizer;