import React, { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Box, 
  Typography, 
  useTheme,
  Divider,
  Pagination,
  CircularProgress,
  Link
} from "@mui/material";
import { TreeView, TreeItem, treeItemClasses } from "@mui/lab";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { INode } from "@components/types/INode";

type InheritanceTreeProps = {
  nodes: { [id: string]: INode };
  currentNodeId: string;
  navigateToNode: (nodeId: string) => void;
  propertyType?: string;
};

const ITEMS_PER_PAGE = 30;
const INITIAL_RENDER_DEPTH = 2;
const LAZY_LOAD_THRESHOLD = 50;
const INITIAL_DISPLAY_COUNT = 100;
const LOAD_MORE_INCREMENT = 100;

const InheritanceTree: React.FC<InheritanceTreeProps> = ({
  nodes,
  currentNodeId,
  navigateToNode,
  propertyType = "isPartOf"
}) => {
  const theme = useTheme();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadedNodeIds, setLoadedNodeIds] = useState<Set<string>>(new Set());
  const [nodeDisplayCounts, setNodeDisplayCounts] = useState<{[nodeId: string]: number}>({});
  
  const currentNode = nodes[currentNodeId];
  const treeData = currentNode?.properties?.isPartOfTree || {};
  
  const directContainers = useMemo(() => {
    const isPartOfNodes: string[] = [];
    
    if (currentNode?.properties?.isPartOf) {
      currentNode.properties.isPartOf.forEach(collection => {
        collection.nodes.forEach(node => {
          isPartOfNodes.push(node.id);
        });
      });
    }
    
    return isPartOfNodes;
  }, [currentNode]);
  
  // Calculate total children count recursively
  const getTotalChildrenCount = useCallback((nodeId: string, visited = new Set<string>()): number => {
    if (visited.has(nodeId)) return 0;
    visited.add(nodeId);
    
    const directChildren = treeData[nodeId] || [];
    let totalCount = directChildren.length;
    
    directChildren.forEach(childId => {
      totalCount += getTotalChildrenCount(childId, visited);
    });
    
    return totalCount;
  }, [treeData]);
  
  const totalPages = Math.ceil(directContainers.length / ITEMS_PER_PAGE);
  
  const displayedDirectContainers = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return directContainers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [directContainers, currentPage]);
  
  useEffect(() => {
    setExpanded(Array.from(expandedNodes));
  }, [expandedNodes]);
  
  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setCurrentPage(value);
    setExpandedNodes(new Set());
  };
  
  const handleLoadMore = (e: React.MouseEvent, nodeId: string, totalCount: number) => {
    e.stopPropagation();
    e.preventDefault();
    
    const currentCount = nodeDisplayCounts[nodeId] || INITIAL_DISPLAY_COUNT;
    const newCount = Math.min(currentCount + LOAD_MORE_INCREMENT, totalCount);
    setNodeDisplayCounts(prev => ({
      ...prev,
      [nodeId]: newCount
    }));
  };
  
  const getDescriptionText = () => {
    switch (propertyType) {
      case "isPartOf":
        return "This tree shows which nodes contain this node as a part, and which nodes inherit those relationships.";
      default:
        return "This tree shows inheritance relationships for this property";
    }
  };
  
  const handleNodeToggle = useCallback((event: React.SyntheticEvent, nodeIds: string[]) => {
    setExpanded(nodeIds);
    const newExpandedNodes = new Set(nodeIds);
    
    nodeIds.forEach(nodeId => {
      if (!loadedNodeIds.has(nodeId) && expandedNodes.has(nodeId) === false) {
        setLoadedNodeIds(prev => new Set([...prev, nodeId]));
      }
    });
    
    setExpandedNodes(newExpandedNodes);
  }, [expandedNodes, loadedNodeIds]);
  
  if (!directContainers || directContainers.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        {/* <Typography variant="body1" sx={{ fontStyle: "italic", color: theme.palette.text.secondary }}>
          {propertyType === "isPartOf" 
            ? "This node is not part of any other nodes" 
            : "No inheritance relationships found"}
        </Typography> */}
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="body1" sx={{ mb: 2, color: theme.palette.text.secondary }}>
        {getDescriptionText()}
      </Typography>
      
      <Divider sx={{ mb: 2 }} />
      
      {directContainers.length > ITEMS_PER_PAGE && (
        <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
          <Typography variant="body2" sx={{ mr: 2 }}>
            Showing {displayedDirectContainers.length} of {directContainers.length} items
          </Typography>
          <Pagination 
            count={totalPages} 
            page={currentPage} 
            onChange={handlePageChange} 
            size="small"
            color="primary"
          />
        </Box>
      )}
      
      <TreeView
        defaultCollapseIcon={<ExpandMoreIcon />}
        defaultExpandIcon={<ChevronRightIcon />}
        expanded={expanded}
        onNodeToggle={handleNodeToggle}
        sx={{ flexGrow: 1, ml: "4px" }}
      >
        {displayedDirectContainers.map((containerNodeId: string) => {
          const containerNode = nodes[containerNodeId];
          if (!containerNode) return null;
          
          const hasChildren = treeData[containerNodeId]?.length > 0;
          
          return hasChildren ? (
            <TreeItemWithInheritance
              key={containerNodeId}
              nodeId={containerNodeId}
              node={containerNode}
              nodes={nodes}
              navigateToNode={navigateToNode}
              inheritanceMap={treeData}
              currentNodeId={currentNodeId}
              level={1}
              loadedNodeIds={loadedNodeIds}
              setLoadedNodeIds={setLoadedNodeIds}
              expandedNodes={expandedNodes}
              nodeDisplayCounts={nodeDisplayCounts}
              onLoadMore={handleLoadMore}
              getTotalChildrenCount={getTotalChildrenCount}
            />
          ) : (
            <Box 
              key={containerNodeId}
              sx={{ 
                display: "flex", 
                alignItems: "center", 
                ml: "24px",
                my: 0.5
              }}
            >
              <NodeLabel
                node={containerNode}
                nodeId={containerNodeId}
                navigateToNode={navigateToNode}
                fontWeight={500}
                currentNodeId={currentNodeId}
                level={1}
                childCount={0}
              />
            </Box>
          );
        })}
      </TreeView>
      
      {directContainers.length > ITEMS_PER_PAGE && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
          <Pagination 
            count={totalPages} 
            page={currentPage} 
            onChange={handlePageChange} 
            size="small"
            color="primary"
          />
        </Box>
      )}
    </Box>
  );
};

type TreeItemWithInheritanceProps = {
  nodeId: string;
  node: INode;
  nodes: { [id: string]: INode };
  navigateToNode: (nodeId: string) => void;
  inheritanceMap: { [parentId: string]: string[] };
  currentNodeId: string;
  level: number;
  loadedNodeIds: Set<string>;
  setLoadedNodeIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  expandedNodes: Set<string>;
  nodeDisplayCounts: {[nodeId: string]: number};
  onLoadMore: (e: React.MouseEvent, nodeId: string, totalCount: number) => void;
  getTotalChildrenCount: (nodeId: string) => number;
};

const TreeItemWithInheritance: React.FC<TreeItemWithInheritanceProps> = ({
  nodeId,
  node,
  nodes,
  navigateToNode,
  inheritanceMap,
  currentNodeId,
  level,
  loadedNodeIds,
  setLoadedNodeIds,
  expandedNodes,
  nodeDisplayCounts,
  onLoadMore,
  getTotalChildrenCount
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  
  const inheritors = inheritanceMap[nodeId] || [];
  const hasChildren = inheritors.length > 0;
  const hasLargeChildSet = inheritors.length > LAZY_LOAD_THRESHOLD;
  const fontWeight = 500 - ((level - 1) * 50);
  
  const shouldRenderChildren = expandedNodes.has(nodeId) || level < INITIAL_RENDER_DEPTH;
  const shouldLoadChildren = loadedNodeIds.has(nodeId) || level < INITIAL_RENDER_DEPTH;
  
  useEffect(() => {
    if (expandedNodes.has(nodeId) && !loadedNodeIds.has(nodeId) && hasLargeChildSet) {
      setLoading(true);
      const timer = setTimeout(() => {
        setLoadedNodeIds(prev => new Set([...prev, nodeId]));
        setLoading(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [expandedNodes, nodeId, loadedNodeIds, hasLargeChildSet, setLoadedNodeIds]);
  
  const visibleInheritors = useMemo(() => {
    if (!shouldLoadChildren) return [];
    
    if (hasLargeChildSet) {
      const displayCount = nodeDisplayCounts[nodeId] || INITIAL_DISPLAY_COUNT;
      return inheritors.slice(0, displayCount);
    }
    
    return inheritors;
  }, [inheritors, shouldLoadChildren, hasLargeChildSet, nodeDisplayCounts, nodeId]);
  
  if (!hasChildren) {
    return (
      <Box 
        sx={{ 
          display: "flex", 
          alignItems: "center", 
          ml: 3,
          my: 0.5
        }}
      >
        <NodeLabel
          node={node}
          nodeId={nodeId}
          navigateToNode={navigateToNode}
          fontWeight={fontWeight}
          currentNodeId={currentNodeId}
          level={level}
          childCount={0}
        />
      </Box>
    );
  }
  
  const totalChildrenCount = getTotalChildrenCount(nodeId);
  
  return (
    <TreeItem
      nodeId={nodeId}
      label={
        <NodeLabel
          node={node}
          nodeId={nodeId}
          navigateToNode={navigateToNode}
          fontWeight={fontWeight > 0 ? fontWeight : 300}
          currentNodeId={currentNodeId}
          level={level}
          childCount={totalChildrenCount}
        />
      }
      sx={{
        "& .MuiTreeItem-content.Mui-selected": {
          backgroundColor: "transparent !important",
        },
        "& .MuiTreeItem-content:hover": {
          backgroundColor: "transparent !important",
        },
        "& .MuiTreeItem-content.Mui-focused": {
          backgroundColor: "transparent !important",
        },
        [`& .${treeItemClasses.group}`]: {
          marginLeft: "6px",
          paddingLeft: "6px",
          position: "relative",
          "&::before": {
            content: '""',
            position: "absolute",
            top: "-8px",
            bottom: 0,
            left: 0,
            borderLeft: (theme) => `2px solid #797575`,
          },
        },
        "& .MuiTreeItem-content": {
          p: 0,
        },
      }}
    >
      {loading && (
        <Box sx={{ display: "flex", alignItems: "center", ml: 4, mt: 1 }}>
          <CircularProgress size={16} sx={{ mr: 1 }} />
          <Typography variant="body2">Loading {inheritors.length} items...</Typography>
        </Box>
      )}
      
      {shouldRenderChildren && shouldLoadChildren && !loading && 
        visibleInheritors.map(inheritorId => {
          const inheritorNode = nodes[inheritorId];
          if (!inheritorNode) return null;
          
          const childHasChildren = inheritanceMap[inheritorId]?.length > 0;
          
          if (childHasChildren) {
            return (
              <TreeItemWithInheritance
                key={inheritorId}
                nodeId={inheritorId}
                node={inheritorNode}
                nodes={nodes}
                navigateToNode={navigateToNode}
                inheritanceMap={inheritanceMap}
                currentNodeId={currentNodeId}
                level={level + 1}
                loadedNodeIds={loadedNodeIds}
                setLoadedNodeIds={setLoadedNodeIds}
                expandedNodes={expandedNodes}
                nodeDisplayCounts={nodeDisplayCounts}
                onLoadMore={onLoadMore}
                getTotalChildrenCount={getTotalChildrenCount}
              />
            );
          } else {
            return (
              <Box 
                key={inheritorId} 
                sx={{ 
                  display: "flex", 
                  alignItems: "center", 
                  ml: 3,
                  my: 0.5
                }}
              >
                <NodeLabel
                  node={inheritorNode}
                  nodeId={inheritorId}
                  navigateToNode={navigateToNode}
                  fontWeight={(fontWeight - 50) > 0 ? (fontWeight - 50) : 300}
                  currentNodeId={currentNodeId}
                  level={level + 1}
                  childCount={0}
                />
              </Box>
            );
          }
        })
      }
      
      {shouldRenderChildren && shouldLoadChildren && !loading && hasLargeChildSet && visibleInheritors.length < inheritors.length && (
        <Box sx={{ ml: 4, mt: 0.5, mb: 0.5, display: "flex", alignItems: "center" }}>
          <Typography variant="body2" sx={{ fontStyle: "italic", fontSize: "0.75rem", color: "text.secondary", mr: 1 }}>
            [{visibleInheritors.length} of {inheritors.length}]
          </Typography>
          <Link
            component="button"
            variant="body2"
            onClick={(e) => onLoadMore(e, nodeId, inheritors.length)}
            sx={{ 
              textDecoration: "underline", 
              cursor: "pointer",
              fontSize: "0.75rem",
              fontWeight: 500,
              color: theme.palette.primary.main,
              "&:hover": {
                color: theme.palette.primary.dark
              }
            }}
          >
            Show more
          </Link>
        </Box>
      )}
    </TreeItem>
  );
};

type NodeLabelProps = {
  node: INode;
  nodeId: string;
  navigateToNode: (nodeId: string) => void;
  fontWeight: number;
  currentNodeId: string;
  level: number;
  childCount: number;
};

const NodeLabel: React.FC<NodeLabelProps> = ({ 
  node, 
  nodeId, 
  navigateToNode,
  fontWeight,
  currentNodeId,
  level,
  childCount
}) => {
  const theme = useTheme();
  const leftPadding = (level - 1) * 2;
  
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        py: "8px",
        pr: "8px",
        paddingLeft: `${4 + leftPadding}px`,
        borderRadius: "10px",
        backgroundColor: 
          nodeId === currentNodeId 
            ? (theme.palette.mode === "dark" ? "#125f07" : "#1fb509") 
            : "transparent",
        transition: "background-color 0.2s ease-in-out",
      }}
      onClick={(e) => {
        e.stopPropagation();
        navigateToNode(nodeId);
      }}
    >
      <Typography
        sx={{
          fontWeight: fontWeight,
          flex: 1,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          cursor: "pointer",
          color: nodeId === currentNodeId ? "white" : "inherit",
          "&:hover": {
            textDecoration: nodeId === currentNodeId ? "none" : "underline"
          }
        }}
      >
        {node.title}
        {childCount > 0 && (
          <Typography 
            component="span" 
            sx={{ 
              ml: 1, 
              fontSize: "0.75rem", 
              opacity: 0.7,
              color: nodeId === currentNodeId ? "white" : "inherit" 
            }}
          >
            ({childCount})
          </Typography>
        )}
      </Typography>
    </Box>
  );
};

export default InheritanceTree;