import React, { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  addEdge,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Connection,
  Panel,
  ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Paper, Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material';
import { INode } from ' @components/types/INode';

interface NodeActivityFlowProps {
  node: INode;
  nodes: { [id: string]: INode };
  onNodeAdd?: (parentId: string, newNodeData: Partial<INode>) => void;
}

const NodeActivityFlow: React.FC<NodeActivityFlowProps> = ({ 
  node: initialNode, 
  nodes: initialNodes,
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [localNodes, setLocalNodes] = useState<{ [id: string]: INode }>(initialNodes);
  const [currentNode, setCurrentNode] = useState<INode>(initialNode);

  const generateId = () => {
    return `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  };

  const generateInitialNodes = (): Node[] => {
    const flowNodes: Node[] = [];
    
    flowNodes.push({
      id: currentNode.id,
      position: { x: 250, y: 50 },
      data: { label: currentNode.title },
      type: 'default',
      style: {
        background: isDarkMode ? '#1E1E1E' : '#ffffff',
        color: isDarkMode ? '#ffffff' : '#000000',
        border: `1px solid ${isDarkMode ? '#4a4a4a' : '#ccc'}`,
        borderRadius: '6px',
        padding: '8px 12px',
        fontSize: '13px',
      },
    });

    const parts = currentNode.properties.parts[0]?.nodes?.filter(part => localNodes[part.id]) || [];
    
    parts.forEach((part, index) => {
      const totalWidth = (parts.length * 220);
      const startX = 250 - (totalWidth / 2) + (index * 220);
      const partNode = localNodes[part.id];
      
      if (partNode) {
        flowNodes.push({
          id: part.id,
          position: {
            x: startX,
            y: 200
          },
          data: { 
            label: partNode.title || part.title
          },
          type: 'default',
          style: {
            background: isDarkMode ? '#1E1E1E' : '#ffffff',
            color: isDarkMode ? '#ffffff' : '#000000',
            border: `1px solid ${isDarkMode ? '#4a4a4a' : '#ccc'}`,
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '13px',
          },
        });
      }
    });

    return flowNodes;
  };

  const generateInitialEdges = (): Edge[] => {
    const partNodes = currentNode.properties.parts[0]?.nodes || [];
    return partNodes
      .filter(part => localNodes[part.id])
      .map((part) => ({
        id: `${currentNode.id}-${part.id}`,
        source: currentNode.id,
        target: part.id,
        type: 'smoothstep',
        animated: false,
        style: {
          stroke: isDarkMode ? '#6ea9ff' : '#2684FF',
          strokeWidth: 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isDarkMode ? '#6ea9ff' : '#2684FF',
        },
      }));
  };

  const [flowNodes, setNodes, onNodesChange] = useNodesState(generateInitialNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState(generateInitialEdges());
  
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowInstance) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNodeId = generateId();
      const newNode: any = {
        id: newNodeId,
        title: `New Part ${newNodeId.slice(-4)}`,
        deleted: false,
        properties: {
          parts: [],
          isPartOf: [{ id: currentNode.id, title: currentNode.title }],
        },
        inheritance: {},
        specializations: [],
        generalizations: [],
        root: currentNode.root,
        propertyType: {},
        nodeType: currentNode.nodeType,
        textValue: {},
        createdBy: currentNode.createdBy,
      };

      // Update local nodes state
      setLocalNodes(prev => ({
        ...prev,
        [newNodeId]: newNode
      }));

      // Update current node with new part in correct path
      setCurrentNode((prev: any) => {
        return ({
          ...prev,
          properties: {
            ...prev.properties,
            parts: [{
              nodes: [
                ...(prev.properties.parts[0]?.nodes || []),
                { id: newNodeId, title: newNode.title }
              ]
            }]
          }
        });
      });

      setNodes((nds) => [
        ...nds,
        {
          id: newNodeId,
          position,
          data: { label: newNode.title },
          type: 'default',
          style: {
            background: isDarkMode ? '#1E1E1E' : '#ffffff',
            color: isDarkMode ? '#ffffff' : '#000000',
            border: `1px solid ${isDarkMode ? '#4a4a4a' : '#ccc'}`,
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '13px',
          },
        },
      ]);

      setEdges((eds) => [
        ...eds,
        {
          id: `${currentNode.id}-${newNodeId}`,
          source: currentNode.id,
          target: newNodeId,
          type: 'smoothstep',
          animated: true,
          style: {
            stroke: isDarkMode ? '#6ea9ff' : '#2684FF',
            strokeWidth: 2,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isDarkMode ? '#6ea9ff' : '#2684FF',
          },
        },
      ]);
    },
    [reactFlowInstance, currentNode, isDarkMode, setNodes, setEdges]
  );

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = useCallback((event: any) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Update visual nodes and edges when local data changes
  useEffect(() => {
    setNodes(generateInitialNodes());
    setEdges(generateInitialEdges());
  }, [isDarkMode, currentNode, localNodes, setNodes, setEdges]);

  // Initialize local state when props change
  useEffect(() => {
    setLocalNodes(initialNodes);
    setCurrentNode(initialNode);
  }, [initialNodes, initialNode]);

  return (
    <Paper
      elevation={9}
      sx={{
        borderRadius: "30px",
        borderBottomRightRadius: "18px",
        borderBottomLeftRadius: "18px",
        minWidth: "500px",
        width: "100%",
        minHeight: "500px",
        overflow: "auto",
        position: "relative",
        display: "flex",
        bgcolor: theme => theme.palette.mode === "dark" ? "#1a1a1a" : "#ffffff",
      }}
    >
      <Box sx={{ flex: 1 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            background: theme => theme.palette.mode === "dark" ? "#242425" : "#d0d5dd",
            p: 3,
          }}
        >
          <Typography
            sx={{
              fontSize: "20px",
              fontWeight: 500,
              fontFamily: "Roboto, sans-serif",
              color: theme => theme.palette.mode === "dark" ? "#ffffff" : "#000000",
            }}
          >
            Activity Flow
          </Typography>
        </Box>
        <Box sx={{ height: "450px", p: "16px", position: "relative" }}>
          <ReactFlow
            nodes={flowNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDragOver={onDragOver}
            onDrop={onDrop}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            minZoom={0.5}
            maxZoom={2}
            className={isDarkMode ? "bg-gray-900" : "bg-gray-50"}
            proOptions={{ hideAttribution: true }}
          >
            <Panel
              position="top-left"
              style={{
                background: isDarkMode ? '#242425' : '#ffffff',
                borderRadius: '12px',
                padding: '12px',
                border: `1px solid ${isDarkMode ? '#4a4a4a' : '#e0e0e0'}`,
                marginTop: '16px',
                marginLeft: '16px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                width: '180px',  // Fixed width to ensure consistent sizing
              }}
            >
              <Typography
                sx={{
                  fontSize: "14px",
                  fontWeight: 500,
                  color: theme => theme.palette.mode === "dark" ? "#ffffff" : "#000000",
                  mb: 1,
                  pl: 1
                }}
              >
                Parts
              </Typography>

              <Box
                draggable
                onDragStart={(event) => onDragStart(event, 'default')}
                sx={{
                  background: isDarkMode ? '#1E1E1E' : '#ffffff',
                  color: isDarkMode ? '#ffffff' : '#000000',
                  border: `1px solid ${isDarkMode ? '#4a4a4a' : '#ccc'}`,
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  cursor: 'grab',
                  transition: 'all 0.2s ease',
                  textAlign: 'center',
                  '&:hover': {
                    boxShadow: '0 2px 4px -1px rgb(0 0 0 / 0.1)',
                    transform: 'translateY(-1px)',
                  },
                  '&:active': {
                    cursor: 'grabbing',
                    transform: 'translateY(0)',
                  },
                }}
              >
                <Typography sx={{ fontSize: '13px' }}>
                  Add Part
                </Typography>
              </Box>
            </Panel>

            <Background
              color={isDarkMode ? "#444444" : "#aaaaaa"}
              gap={16}
              size={1}
            />
          </ReactFlow>
        </Box>
      </Box>
    </Paper>
  );
};


export default NodeActivityFlow;