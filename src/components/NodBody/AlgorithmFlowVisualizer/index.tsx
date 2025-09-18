import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  BackgroundVariant,
  OnConnect,
  OnNodesDelete,
  OnEdgesDelete,
  Edge,
  Connection,
  ConnectionLineType,
  addEdge,
  SelectionMode,
  OnSelectionChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// Add custom styles for better selection visibility
const selectionStyles = `
  .react-flow__node.selected {
    box-shadow: 0 0 0 3px #0066cc !important;
    border-color: #0066cc !important;
  }
  
  .react-flow__selection {
    background: rgba(0, 102, 204, 0.1) !important;
    border: 1px dashed #0066cc !important;
  }
`;
import { Box, Paper, CircularProgress, useTheme } from "@mui/material";
import { IAlgorithm } from "@components/types/INode";

// Import custom components
import {
  TaskNode,
  SequentialNode,
  ParallelNode,
  ConditionNode,
  LoopNode,
  NodeData,
  NODE_TYPES,
} from "./NodeComponent";

import {
  ControlPanel,
  LegendPanel,
  PerformanceModelPanel,
} from "./FlowUIComponents";

import { ResizableContainer, containerNodeTypes } from "./ResizableContainer";

import { FlowGenerator } from "./FlowGenerator";
import TaskSelectionPanel from "./TaskSelectionPanel";
import LoopCreationPanel from "./LoopCreationPanel";
import ConditionCreationPanel from "./ConditionCreationPanel";
import DeletableEdge from "./DeletableEdge";
import { 
  serializeGraphToAlgorithm, 
  createAlgorithmUpdateFromGraph,
  validateSerializedAlgorithm 
} from "@components/lib/utils/algorithmSerializer";
import { ContainerAwareAlgorithmBuilder } from "./ContainerAwareAlgorithmBuilder";
import { ContainerManager } from "./ContainerManager";

/**
 * Custom node types mapping for React Flow
 */
const nodeTypes: NodeTypes = {
  [NODE_TYPES.TASK]: TaskNode as React.ComponentType<NodeProps>,
  [NODE_TYPES.SEQUENTIAL]: SequentialNode as React.ComponentType<NodeProps>,
  [NODE_TYPES.PARALLEL]: ParallelNode as React.ComponentType<NodeProps>,
  [NODE_TYPES.CONDITION]: ConditionNode as React.ComponentType<NodeProps>,
  [NODE_TYPES.LOOP]: LoopNode as React.ComponentType<NodeProps>,
  ...containerNodeTypes,
};

/**
 * Custom edge types mapping for React Flow
 */
const edgeTypes = {
  deletable: DeletableEdge,
};

/**
 * Props for the AlgorithmFlowVisualizer component
 */
interface AlgorithmFlowVisualizerProps {
  algorithm: IAlgorithm;
  isDarkMode: boolean;
  navigateToNode?: (nodeId: string) => void;
  enableEdit?: boolean;
  currentNode?: any;
  nodes?: { [id: string]: any };
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
  navigateToNode,
  enableEdit = false,
  currentNode,
  nodes = {},
}) => {
  const theme = useTheme();
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Editing state
  const [showTaskSelection, setShowTaskSelection] = useState(false);
  const [showLoopCreation, setShowLoopCreation] = useState(false);
  const [showConditionCreation, setShowConditionCreation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [connectionPreview, setConnectionPreview] = useState<{
    sourceNode?: any;
    targetNode?: any;
    sourceHandle?: string;
    targetHandle?: string;
  } | null>(null);

  // Selection state for multi-select functionality
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);
  const [selectedEdges, setSelectedEdges] = useState<Edge[]>([]);

  // Pointer tool state for toggling between select and pan modes
  const [isPointerToolActive, setIsPointerToolActive] = useState(false);

  // Generate nodes and edges for the flowchart
  const { initialNodes, initialEdges } = useMemo(() => {
    const flowGenerator = new FlowGenerator(isDarkMode);
    const result = flowGenerator.generateFlow(algorithm);

    return {
      initialNodes: result.nodes,
      initialEdges: result.edges,
    };
  }, [algorithm, isDarkMode]);

  // Set up React Flow state with rigid container management
  const containerManager = useMemo(() => new ContainerManager(), []);
  const [flowNodes, setFlowNodes, onNodesChangeRaw] = useNodesState<any>(initialNodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(initialEdges);
  
  // Enhanced onNodesChange with container management
  const onNodesChange = useCallback((changes: any[]) => {
    setFlowNodes((currentNodes) => {
      const updatedNodes = containerManager.onNodesChange(changes, currentNodes);
      
      // Debug container relationships in development
      if (process.env.NODE_ENV === 'development') {
        const validation = containerManager.validateRelationships(updatedNodes);
        if (!validation.isValid || validation.warnings.length > 0) {
          containerManager.debugRelationships(updatedNodes);
        }
      }
      
      return updatedNodes;
    });
  }, [containerManager]);

  // Set up edge update callback for container manager
  useEffect(() => {
    containerManager.setEdgesUpdateCallback((containerEdges) => {
      setFlowEdges((currentEdges) => {
        // Remove existing container edges
        const nonContainerEdges = currentEdges.filter(edge => !edge.data?.containerEdge);
        
        // Add new container edges
        return [...nonContainerEdges, ...containerEdges];
      });
    });
  }, [containerManager, setFlowEdges]);

  /**
   * Smart node placement - finds an unobstructed position near viewport center
   * Uses ReactFlow's built-in coordinate conversion methods
   */
  const findSmartPosition = useCallback((nodeWidth = 160, nodeHeight = 60) => {
    if (!reactFlowInstance) {
      console.log('⚠️ ReactFlow instance not ready, using fallback position');
      return { x: 50, y: 50 };
    }

    try {
      // Get the center of the current viewport in screen coordinates
      const reactFlowBounds = document.querySelector('.react-flow')?.getBoundingClientRect();
      if (!reactFlowBounds) {
        console.log('⚠️ Could not get ReactFlow bounds, using fallback');
        return { x: 100, y: 100 };
      }

      // Screen center coordinates
      const screenCenterX = reactFlowBounds.width / 2;
      const screenCenterY = reactFlowBounds.height / 2;

      // Convert to flow coordinates using ReactFlow's utility
      const flowPosition = reactFlowInstance.screenToFlowPosition({
        x: screenCenterX,
        y: screenCenterY,
      });

      console.log(`🎯 Viewport center in flow coordinates: (${flowPosition.x.toFixed(0)}, ${flowPosition.y.toFixed(0)})`);

      // Simple collision detection
      const isPositionFree = (x: number, y: number) => {
        const margin = 30; // Space around nodes
        return !flowNodes.some(node => {
          const nodeLeft = node.position.x;
          const nodeRight = nodeLeft + (node.measured?.width || node.style?.width || 160);
          const nodeTop = node.position.y;
          const nodeBottom = nodeTop + (node.measured?.height || node.style?.height || 60);

          const newLeft = x;
          const newRight = x + nodeWidth;
          const newTop = y;
          const newBottom = y + nodeHeight;

          // Check if rectangles overlap with margin
          return !(newRight + margin < nodeLeft || 
                   newLeft > nodeRight + margin ||
                   newBottom + margin < nodeTop || 
                   newTop > nodeBottom + margin);
        });
      };

      // Try the center position first
      const centerX = flowPosition.x - nodeWidth / 2;
      const centerY = flowPosition.y - nodeHeight / 2;
      
      if (isPositionFree(centerX, centerY)) {
        console.log('✅ Center position is free');
        return { x: centerX, y: centerY };
      }

      // Try positions in a grid around the center
      const step = 60;
      for (let offsetX = -step * 2; offsetX <= step * 2; offsetX += step) {
        for (let offsetY = -step * 2; offsetY <= step * 2; offsetY += step) {
          const testX = centerX + offsetX;
          const testY = centerY + offsetY;
          
          if (isPositionFree(testX, testY)) {
            console.log(`✅ Found free position at offset (${offsetX}, ${offsetY})`);
            return { x: testX, y: testY };
          }
        }
      }

      // Fallback: random offset from center
      const randomX = centerX + (Math.random() - 0.5) * 200;
      const randomY = centerY + (Math.random() - 0.5) * 200;
      console.log('🎲 Using random offset position');
      return { x: randomX, y: randomY };

    } catch (error) {
      console.error('❌ Error in smart positioning:', error);
      return { x: 150, y: 150 };
    }
  }, [reactFlowInstance, flowNodes]);

  // Note: Initial container edges are now handled by FlowGenerator
  // Runtime container edge updates are handled by ContainerManager via onNodesChange

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
    setFlowNodes(initialNodes);
    setFlowEdges(initialEdges); // This includes container edges from FlowGenerator
    setLoading(false);

    // If instance exists, fit view after updating
    if (reactFlowInstance) {
      setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.2 });
      }, 100);
    }
  }, [initialNodes, initialEdges, setFlowNodes, setFlowEdges, reactFlowInstance]);

  /**
   * Connection and deletion handlers - defined early to avoid hoisting issues
   */
  const handleEdgeDelete = useCallback(
    (edgeId: string) => {
      if (!enableEdit) return;
      
      setFlowEdges((edges) => edges.filter((edge) => edge.id !== edgeId));
    },
    [enableEdit, setFlowEdges]
  );

  const handleNodeDelete = useCallback(
    (nodeId: string) => {
      if (!enableEdit) return;
      
      setFlowNodes((nodes) => {
        // Check if we're deleting a container - handle child cleanup
        const nodeToDelete = nodes.find(n => n.id === nodeId);
        const isContainer = nodeToDelete?.type === 'sequential-container' || nodeToDelete?.type === 'parallel-container';
        
        let updatedNodes = nodes.filter((node) => node.id !== nodeId);
        
        if (isContainer) {
          // Handle container deletion with proper child cleanup
          updatedNodes = containerManager.handleContainerDeletion(nodeId, updatedNodes);
        }
        
        return updatedNodes;
      });
    },
    [enableEdit, setFlowNodes, containerManager]
  );

  const handleNodeUpdate = useCallback(
    (nodeId: string, updates: any) => {
      if (!enableEdit) return;
      
      setFlowNodes((nodes) => 
        nodes.map((node) => 
          node.id === nodeId 
            ? { 
                ...node, 
                data: { 
                  ...node.data, 
                  ...updates 
                } 
              }
            : node
        )
      );
    },
    [enableEdit, setFlowNodes]
  );

  // Enhance edges with delete functionality when edit mode changes
  useEffect(() => {
    if (enableEdit) {
      setFlowEdges((edges) =>
        edges.map((edge) => ({
          ...edge,
          type: 'deletable',
          data: {
            ...edge.data,
            enableEdit: true,
            onEdgeDelete: handleEdgeDelete,
            originalType: edge.data?.originalType || edge.type || 'smoothstep', // Store original type, default to smoothstep
          },
        }))
      );
    } else {
      setFlowEdges((edges) =>
        edges.map((edge) => ({
          ...edge,
          type: (edge.data?.originalType || 'smoothstep') as string, // Restore original type, fallback to smoothstep (never undefined)
          data: {
            ...edge.data,
            enableEdit: false,
            onEdgeDelete: undefined,
            originalType: undefined, // Clear stored type
          },
        }))
      );
    }
  }, [enableEdit, handleEdgeDelete, setFlowEdges]);

  // Enhance nodes with editing functionality when edit mode changes
  useEffect(() => {
    setFlowNodes((nodes) =>
      nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          enableEdit,
          onNodeDelete: enableEdit ? handleNodeDelete : undefined,
          onNodeUpdate: enableEdit ? handleNodeUpdate : undefined,
          navigateToNode,
        },
      }))
    );
  }, [enableEdit, handleNodeDelete, handleNodeUpdate, navigateToNode, setFlowNodes]);

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
   * Toggle pointer tool for switching between select and pan modes
   */
  const handlePointerToolToggle = useCallback(() => {
    setIsPointerToolActive(prev => {
      const newValue = !prev;
      // Clear selections when switching modes
      if (!newValue) {
        setSelectedNodes([]);
        setSelectedEdges([]);
      }
      return newValue;
    });
  }, []);

  /**
   * Node creation handlers - defined early to avoid circular dependencies
   */

  const handleCreateSequentialContainer = useCallback(() => {
    if (!enableEdit) return;

    const nodeId = `sequential-container-${Date.now()}`;
    const containerWidth = 300;
    const containerHeight = 200;
    const position = findSmartPosition(containerWidth, containerHeight);
    
    console.log(`📦 Creating sequential container at smart position: (${position.x}, ${position.y})`);

    const newNode = {
      id: nodeId,
      type: 'sequential-container',
      position,
      style: {
        width: containerWidth,
        height: containerHeight,
      },
      data: {
        id: nodeId,
        label: 'Sequential Container',
        type: 'sequential-container',
        enableEdit,
        onNodeDelete: handleNodeDelete,
        onNodeUpdate: handleNodeUpdate,
        navigateToNode,
      },
    };

    setFlowNodes((nodes) => [...nodes, newNode]);
  }, [enableEdit, setFlowNodes, handleNodeDelete, handleNodeUpdate, navigateToNode, findSmartPosition]);

  const handleCreateParallelContainer = useCallback(() => {
    if (!enableEdit) return;

    const nodeId = `parallel-container-${Date.now()}`;
    const containerWidth = 400;
    const containerHeight = 200;
    const position = findSmartPosition(containerWidth, containerHeight);
    
    console.log(`📦 Creating parallel container at smart position: (${position.x}, ${position.y})`);

    const newNode = {
      id: nodeId,
      type: 'parallel-container',
      position,
      style: {
        width: containerWidth,
        height: containerHeight,
      },
      data: {
        id: nodeId,
        label: 'Parallel Container',
        type: 'parallel-container',
        enableEdit,
        onNodeDelete: handleNodeDelete,
        onNodeUpdate: handleNodeUpdate,
        navigateToNode,
      },
    };

    setFlowNodes((nodes) => [...nodes, newNode]);
  }, [enableEdit, setFlowNodes, handleNodeDelete, handleNodeUpdate, navigateToNode, findSmartPosition]);

  /**
   * Main editing handlers
   */
  const handleNodeTypeClick = useCallback((nodeType: string) => {
    if (!enableEdit) return;

    switch (nodeType) {
      case 'sequential-container':
        handleCreateSequentialContainer();
        break;
      case 'parallel-container':
        handleCreateParallelContainer();
        break;
      case 'condition':
        setShowConditionCreation(true);
        break;
      case 'loop':
        setShowLoopCreation(true);
        break;
      default:
        break;
    }
  }, [enableEdit, handleCreateSequentialContainer, handleCreateParallelContainer]);

  const handleTaskNodeClick = useCallback(() => {
    if (!enableEdit) return;
    setShowTaskSelection(true);
  }, [enableEdit]);

  const handleTaskSelect = useCallback((taskNode: any) => {
    if (!enableEdit || !taskNode) return;
    
    const nodeId = `task-${Date.now()}`;
    const taskWidth = 160;
    const taskHeight = 60;
    const position = findSmartPosition(taskWidth, taskHeight);
    
    console.log(`🎯 Creating task node at smart position: (${position.x}, ${position.y})`);

    // Create a new task node in the flow
    const newNode = {
      id: nodeId,
      type: 'task',
      position,
      data: {
        id: nodeId,
        label: taskNode.title,
        node_id: taskNode.id,
        activityId: `task-${taskNode.id}`,
        type: 'task',
        enableEdit,
        onNodeDelete: handleNodeDelete,
        onNodeUpdate: handleNodeUpdate,
        navigateToNode,
      },
    };

    setFlowNodes((nodes) => [...nodes, newNode]);
    setShowTaskSelection(false);
  }, [enableEdit, setFlowNodes, handleNodeDelete, handleNodeUpdate, navigateToNode, findSmartPosition]);

  // Add keyboard handlers for editing
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!enableEdit) return;

      if (event.key === 'Escape') {
        setShowTaskSelection(false);
        setShowLoopCreation(false);
        setShowConditionCreation(false);
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        // Delete selected nodes and edges
        if (selectedNodes.length > 0) {
          console.log(`🗑️ Deleting ${selectedNodes.length} selected nodes`);
          selectedNodes.forEach((node) => handleNodeDelete(node.id));
          setSelectedNodes([]); // Clear selection after deletion
        }

        if (selectedEdges.length > 0) {
          console.log(`🗑️ Deleting ${selectedEdges.length} selected edges`);
          selectedEdges.forEach((edge) => handleEdgeDelete(edge.id));
          setSelectedEdges([]); // Clear selection after deletion
        }
      }
    };

    if (enableEdit) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [enableEdit, selectedNodes, selectedEdges, handleNodeDelete, handleEdgeDelete]);

  const handleCreateLoop = useCallback((loopActivity: any) => {
    if (!enableEdit) return;

    const nodeId = `loop-${Date.now()}`;
    const loopWidth = 300;
    const loopHeight = 250;
    const position = findSmartPosition(loopWidth, loopHeight);
    
    console.log(`🔁 Creating loop container at smart position: (${position.x}, ${position.y})`);

    // Create a new loop container in the flow
    const newNode = {
      id: nodeId,
      type: 'loop-container',
      position,
      style: {
        width: loopWidth,
        height: loopHeight,
      },
      data: {
        id: nodeId,
        label: loopActivity.name,
        activityId: loopActivity.id,
        variables: loopActivity.variables,
        condition: Object.keys(loopActivity.loop_condition || {})[0] || 'N > 0',
        type: 'loop-container',
        hasSubActivities: false, // Start empty like other containers
        enableEdit,
        onNodeDelete: handleNodeDelete,
        onNodeUpdate: handleNodeUpdate,
        navigateToNode,
      },
    };

    setFlowNodes((nodes) => [...nodes, newNode]);
    setShowLoopCreation(false);
  }, [enableEdit, setFlowNodes, handleNodeDelete, handleNodeUpdate, navigateToNode, findSmartPosition]);

  const handleCreateCondition = useCallback((conditionActivity: any) => {
    if (!enableEdit) return;

    const nodeId = `condition-${Date.now()}`;
    const conditionWidth = 180;
    const conditionHeight = 100;
    const position = findSmartPosition(conditionWidth, conditionHeight);
    
    console.log(`❓ Creating condition node at smart position: (${position.x}, ${position.y})`);

    // Create a new condition node in the flow
    const newNode = {
      id: nodeId,
      type: 'condition',
      position,
      data: {
        id: nodeId,
        label: conditionActivity.name,
        activityId: conditionActivity.id,
        variables: conditionActivity.variables,
        condition: Object.keys(conditionActivity.condition || {})[0] || 'true',
        type: 'condition',
        enableEdit,
        onNodeDelete: handleNodeDelete,
        onNodeUpdate: handleNodeUpdate,
        navigateToNode,
      },
    };

    setFlowNodes((nodes) => [...nodes, newNode]);
    setShowConditionCreation(false);
  }, [enableEdit, setFlowNodes, handleNodeDelete, handleNodeUpdate, navigateToNode, findSmartPosition]);


  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      console.log('Saving algorithm changes...');
      
      // Serialize current graph state to algorithm format
      const serializedAlgorithm = serializeGraphToAlgorithm(flowNodes, flowEdges, algorithm);
      
      // Validate the serialized algorithm
      if (!validateSerializedAlgorithm(serializedAlgorithm)) {
        console.error('Algorithm validation failed');
        throw new Error('Algorithm validation failed');
      }
      
      console.log('Algorithm serialization successful:', {
        originalActivities: algorithm.sub_activities?.length || 0,
        serializedActivities: serializedAlgorithm.sub_activities.length,
        nodeCount: flowNodes.length,
        edgeCount: flowEdges.length
      });
      
      // TODO: Call API to save the algorithm
      // await saveAlgorithm(serializedAlgorithm);
      
    } catch (error) {
      console.error('Failed to save algorithm:', error);
      // TODO: Show error notification to user
    } finally {
      setIsSaving(false);
    }
  }, [flowNodes, flowEdges, algorithm]);

  // State to track performance model updates locally
  const [localPerformanceModel, setLocalPerformanceModel] = useState<string | null>(null);
  
  // Use local performance model if available, otherwise use algorithm's model
  const currentPerformanceModel = localPerformanceModel || algorithm.performance_model;

  const handlePerformanceModelUpdate = useCallback(async (newModel: string) => {
    try {
      console.log('🔄 Performance model update triggered!');
      console.log('📊 New model received:', newModel.substring(0, 100) + '...');
      console.log('📈 Current graph state:', {
        nodes: flowNodes.length,
        edges: flowEdges.length,
        algorithmName: algorithm.name
      });
      
      console.log('✅ Performance model update successful:', {
        modelLength: newModel.length,
        algorithmName: algorithm.name,
        hasPerformanceModel: !!newModel
      });
      
      console.log('🎯 Updated performance model preview:', 
        newModel.substring(0, 150) + '...'
      );
      
      // Update local state to display the new performance model
      setLocalPerformanceModel(newModel);
      
      // TODO: Call API to save the updated algorithm with new performance model
      // await saveAlgorithmWithPerformanceModel({...algorithm, performance_model: newModel});
      
    } catch (error) {
      console.error('❌ Failed to update performance model:', error);
      console.error('Error details:', error);
      // TODO: Show error notification to user
    }
  }, [algorithm]);

  // Debug function for testing container relationships
  const debugContainerRelationships = useCallback(() => {
    console.log('🔍 Manual Container Debug Triggered');
    containerManager.debugRelationships(flowNodes);
    
    const validation = containerManager.validateRelationships(flowNodes);
    if (validation.isValid) {
      console.log('✅ All container relationships are valid');
    } else {
      console.error('❌ Container validation failed:', validation.errors);
    }
    if (validation.warnings.length > 0) {
      console.warn('⚠️ Container warnings:', validation.warnings);
    }
  }, [containerManager, flowNodes]);

  // Manual unlock function for testing
  const manualUnlock = useCallback((nodeId: string) => {
    console.log(`🔓 Manually unlocking node: ${nodeId}`);
    setFlowNodes(currentNodes => containerManager.unlockNode(nodeId, currentNodes));
  }, [containerManager]);
  
  // Clear all locks function
  const clearAllLocks = useCallback(() => {
    console.log('🏦 Clearing all node locks');
    containerManager.clearAllLocks();
    setFlowNodes(currentNodes => 
      currentNodes.map(node => ({
        ...node,
        draggable: true,
        data: { ...node.data, _isLocked: false },
        style: { ...node.style, border: undefined, background: undefined }
      }))
    );
  }, [containerManager]);

  // Add debug functions to window for easy access during development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      (window as any).debugContainers = debugContainerRelationships;
      (window as any).unlockNode = manualUnlock;
      (window as any).clearAllLocks = clearAllLocks;
      (window as any).getLockedNodes = () => containerManager.getLockedNodes();
      console.log('💡 Debug functions available:');
      console.log('  - window.debugContainers() - Show container relationships');
      console.log('  - window.unlockNode("nodeId") - Unlock a specific node');
      console.log('  - window.clearAllLocks() - Unlock all nodes');
      console.log('  - window.getLockedNodes() - Show locked node IDs');
    }
  }, [debugContainerRelationships, manualUnlock, clearAllLocks, containerManager]);

  // Helper function to get edge color (shared between onConnect and connection preview)
  const getEdgeColorForConnection = useCallback((
    sourceNode: any, 
    targetNode: any, 
    sourceHandle?: string
  ) => {
    // Special case: Condition node edges (green for true, red for false)
    if (sourceNode?.type === 'condition') {
      if (sourceHandle === 'true') {
        return isDarkMode ? '#81c784' : '#4caf50'; // Green for true path
      } else if (sourceHandle === 'false') {
        return isDarkMode ? '#ef5350' : '#f44336'; // Red for false path
      }
    }
    
    // Special case: Loop node incoming edges should be green
    if (targetNode?.type === 'loop') {
      return isDarkMode ? '#81c784' : '#4caf50'; // Green for loop input
    }
    
    // Default to source node color, then target node color
    const nodeType = sourceNode?.type || targetNode?.type;
    switch (nodeType) {
      case 'sequential':
      case 'sequential-container':
        return isDarkMode ? '#90caf9' : '#1976d2';
      case 'parallel':
      case 'parallel-container':
        return isDarkMode ? '#ce93d8' : '#9c27b0';
      case 'condition':
        return isDarkMode ? '#ffb74d' : '#f57c00';
      case 'loop':
        return isDarkMode ? '#81c784' : '#43a047';
      case 'task':
        return isDarkMode ? '#b0bec5' : '#607d8b';
      default:
        return isDarkMode ? '#90caf9' : '#1976d2';
    }
  }, [isDarkMode]);

  // Compute dynamic connection line color based on preview state
  const connectionLineColor = useMemo(() => {
    if (!connectionPreview?.sourceNode) {
      return isDarkMode ? '#90caf9' : '#1976d2'; // Default blue
    }

    return getEdgeColorForConnection(
      connectionPreview.sourceNode,
      null, // No target node during preview
      connectionPreview.sourceHandle
    );
  }, [connectionPreview, isDarkMode, getEdgeColorForConnection]);

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!enableEdit) return;

      // Find source and target nodes to determine edge color
      const sourceNode = flowNodes.find(node => node.id === connection.source);
      const targetNode = flowNodes.find(node => node.id === connection.target);
      
      // Get edge color using the helper function
      const edgeColor = getEdgeColorForConnection(
        sourceNode, 
        targetNode, 
        connection.sourceHandle || undefined
      );

      // Create a new edge with delete functionality and proper coloring
      const newEdge: Edge = {
        ...connection,
        id: `edge-${Date.now()}`,
        type: 'deletable', // In edit mode, all edges are deletable
        data: {
          enableEdit,
          onEdgeDelete: handleEdgeDelete,
          originalType: 'smoothstep', // New edges will become smoothstep when exiting edit mode
        },
        style: {
          stroke: edgeColor,
          strokeWidth: 2,
        },
      };

      setFlowEdges((edges) => addEdge(newEdge, edges));
    },
    [enableEdit, setFlowEdges, handleEdgeDelete, flowNodes, getEdgeColorForConnection]
  );

  const onNodesDelete: OnNodesDelete = useCallback(
    (nodesToDelete) => {
      if (!enableEdit) return;
      
      console.log('Deleting nodes:', nodesToDelete.map(n => n.id));
      
      // Check if any deleted nodes were children of parallel containers
      const hasParallelContainerChildren = nodesToDelete.some(node => 
        flowNodes.find(n => n.id === node.parentId)?.type === 'parallel-container'
      );
      
      // Check if any deleted nodes were parallel containers themselves
      const hasParallelContainers = nodesToDelete.some(node => node.type === 'parallel-container');
      
      if (hasParallelContainerChildren || hasParallelContainers) {
        // Trigger edge updates after node deletion
        setTimeout(() => {
          containerManager.setEdgesUpdateCallback((containerEdges) => {
            setFlowEdges((currentEdges) => {
              const nonContainerEdges = currentEdges.filter(edge => !edge.data?.containerEdge);
              return [...nonContainerEdges, ...containerEdges];
            });
          });
          
          // Update edges for remaining nodes
          const remainingNodes = flowNodes.filter(node => 
            !nodesToDelete.find(deleted => deleted.id === node.id)
          );
          containerManager.onNodesChange([], remainingNodes);
        }, 100);
      }
    },
    [enableEdit, flowNodes, containerManager, setFlowEdges]
  );

  const onEdgesDelete: OnEdgesDelete = useCallback(
    (edgesToDelete) => {
      if (!enableEdit) return;
      
      console.log('Deleting edges:', edgesToDelete.map(e => e.id));
      // Edges are automatically removed by React Flow
    },
    [enableEdit]
  );

  // Connection start handler for preview
  const onConnectStart = useCallback((_event: any, { nodeId, handleId }: any) => {
    if (!enableEdit) return;
    
    const sourceNode = flowNodes.find(node => node.id === nodeId);
    setConnectionPreview({
      sourceNode,
      sourceHandle: handleId,
    });
  }, [enableEdit, flowNodes]);

  // Connection end handler to clear preview
  const onConnectEnd = useCallback(() => {
    if (!enableEdit) return;
    
    setConnectionPreview(null);
  }, [enableEdit]);

  // Selection change handler for multi-select
  const onSelectionChange: OnSelectionChange = useCallback(({ nodes, edges }) => {
    console.log(`🎯 Selection changed: ${nodes.length} nodes, ${edges.length} edges`);
    console.log('Selected node IDs:', nodes.map(n => n.id));
    console.log('Selected edge IDs:', edges.map(e => e.id));
    
    setSelectedNodes(nodes);
    setSelectedEdges(edges);
  }, []);

  // Add debugging for selection drag
  const onSelectionStart = useCallback(() => {
    console.log('🎯 Selection drag started');
  }, []);

  const onSelectionEnd = useCallback(() => {
    console.log('🎯 Selection drag ended');
  }, []);

  /**
   * Get node color for minimap based on node type
   */
  const getNodeColor = useCallback(
    (node: Node) => {
      const nodeType = node.type as string;
      switch (nodeType) {
        case NODE_TYPES.SEQUENTIAL:
          return isDarkMode
            ? "rgba(25, 118, 210, 0.6)"
            : "rgba(25, 118, 210, 0.4)";
        case NODE_TYPES.PARALLEL:
          return isDarkMode
            ? "rgba(156, 39, 176, 0.6)"
            : "rgba(156, 39, 176, 0.4)";
        case NODE_TYPES.CONDITION:
          return isDarkMode
            ? "rgba(245, 124, 0, 0.6)"
            : "rgba(245, 124, 0, 0.4)";
        case NODE_TYPES.LOOP:
          return isDarkMode
            ? "rgba(67, 160, 71, 0.6)"
            : "rgba(67, 160, 71, 0.4)";
        case NODE_TYPES.TASK:
          return isDarkMode
            ? "rgba(96, 125, 139, 0.6)"
            : "rgba(96, 125, 139, 0.4)";
        default:
          return isDarkMode ? "#555" : "#eee";
      }
    },
    [isDarkMode],
  );

  // Add custom styles for selection
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = selectionStyles;
    document.head.appendChild(styleElement);
    
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  // Render the flow chart
  return (
    <Paper
      elevation={1}
      sx={{
        height: "650px",
        borderRadius: 1,
        position: "relative",
        bgcolor: (theme) =>
          theme.palette.mode === "dark" ? "#1a1a1a" : "#f8f9fa",
        cursor: (!enableEdit || !isPointerToolActive) ? "grab" : "default",
        "& .react-flow__pane": {
          cursor: (!enableEdit || !isPointerToolActive) ? "grab !important" : "default",
        },
        "& .react-flow__pane:active": {
          cursor: (!enableEdit || !isPointerToolActive) ? "grabbing !important" : "default",
        },
      }}
    >
      {loading ? (
        <LoadingIndicator />
      ) : (
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          onSelectionChange={onSelectionChange}
          onSelectionStart={onSelectionStart}
          onSelectionEnd={onSelectionEnd}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onInit={onInit}
          nodesDraggable={enableEdit}
          nodesConnectable={enableEdit}
          elementsSelectable={enableEdit && isPointerToolActive}
          selectNodesOnDrag={false}
          multiSelectionKeyCode={isPointerToolActive ? ['Meta', 'Control'] : null}
          selectionKeyCode={null}
          selectionMode={SelectionMode.Partial}
          selectionOnDrag={enableEdit && isPointerToolActive}
          panOnDrag={isPointerToolActive ? false : true}
          connectionLineType={ConnectionLineType.SmoothStep}
          connectionLineStyle={{
            stroke: connectionLineColor,
            strokeWidth: 2,
            strokeDasharray: '5,5', // Dashed line during connection
          }}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={4}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          attributionPosition="bottom-left"
          proOptions={{ hideAttribution: true }}
          colorMode={theme.palette.mode === "dark" ? "dark" : "light"}
          zoomOnScroll={false}
          panOnScroll={false}
          preventScrolling={false}
          deleteKeyCode={['Delete', 'Backspace']}
        >
          {/* Panels and Controls */}
          <ControlPanel
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onFitView={handleFitView}
            enableEdit={enableEdit}
            onSave={handleSave}
            isSaving={isSaving}
            isPointerToolActive={isPointerToolActive}
            onPointerToolToggle={handlePointerToolToggle}
          />
          <LegendPanel 
            isDarkMode={isDarkMode}
            enableEdit={enableEdit}
            onNodeTypeClick={handleNodeTypeClick}
            onTaskNodeClick={handleTaskNodeClick}
          />
          <PerformanceModelPanel
            algorithm={{...algorithm, performance_model: currentPerformanceModel}}
            isDarkMode={isDarkMode}
            enableEdit={enableEdit}
            onPerformanceModelUpdate={handlePerformanceModelUpdate}
            currentNodes={flowNodes}
            currentEdges={flowEdges}
          />

          {/* Multi-select indicator */}
          {enableEdit && isPointerToolActive && selectedNodes.length > 0 && (
            <Box
              sx={{
                position: 'absolute',
                top: 80, // Moved down below the camera controls
                right: 16,
                backgroundColor: isDarkMode ? 'rgba(25, 118, 210, 0.9)' : 'rgba(25, 118, 210, 0.8)',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 'bold',
                zIndex: 1000,
                pointerEvents: 'none',
              }}
            >
              {selectedNodes.length} {selectedNodes.length === 1 ? 'node' : 'nodes'} selected
            </Box>
          )}

          {/* Editing Panels */}
          {enableEdit && (
            <>
              <TaskSelectionPanel
                isDarkMode={isDarkMode}
                currentNode={currentNode}
                nodes={nodes}
                onTaskSelect={handleTaskSelect}
                visible={showTaskSelection}
              />
              <LoopCreationPanel
                isDarkMode={isDarkMode}
                visible={showLoopCreation}
                onCreateLoop={handleCreateLoop}
                onClose={() => setShowLoopCreation(false)}
              />
              <ConditionCreationPanel
                isDarkMode={isDarkMode}
                visible={showConditionCreation}
                onCreateCondition={handleCreateCondition}
                onClose={() => setShowConditionCreation(false)}
              />
            </>
          )}

          {/* Background */}
          <Background
            color={isDarkMode ? "#333" : "#ccc"}
            gap={16}
            size={1}
            variant={BackgroundVariant.Dots}
          />

          {/* Hide default controls since we're using custom ones */}
          <Controls position="bottom-right" style={{ display: "none" }} />

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
  <Box
    sx={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100%",
    }}
  >
    <CircularProgress />
  </Box>
);

export default AlgorithmFlowVisualizer;
