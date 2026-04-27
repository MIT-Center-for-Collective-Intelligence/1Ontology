
import React, { useCallback, useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import dagreD3 from "dagre-d3";
import { TreeData } from "@components/types/INode";

type GraphZoomState = {
  translateX: number;
  translateY: number;
  scale: number;
};

type GraphViewProps = {
  treeData: TreeData[];
  setExpandedNodes: (state: Set<string>) => void;
  expandedNodes: Set<string>;
  onOpenNodeDagre: (ontologyId: string, nodeTitle?: string) => void;
  currentVisibleNode: { id?: string } | null;
};

const SVG_HEIGHT = 1000;
const NODE_RADIUS = 25;
const ACTIVE_NODE_FILL = "#87D37C";
const CATEGORY_NODE_FILL = "#ffbe48";
const DEFAULT_NODE_FILL = "white";
const DEFAULT_STROKE = "black";
const ACTIVE_STROKE = "white";
const EDGE_COLOR = "orange";
const INDICATOR_BG = "#1f2937";
const INDICATOR_BORDER = "#e5e7eb";
const INDICATOR_TEXT = "#f9fafb";
const INDICATOR_RADIUS = 9;

const GraphView = ({
  treeData,
  expandedNodes,
  setExpandedNodes,
  onOpenNodeDagre,
  currentVisibleNode,
}: GraphViewProps) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [graph, setGraph] = useState<any>(null);
  const [zoomState, setZoomState] = useState<GraphZoomState>({
    translateX: 0,
    translateY: 0,
    scale: 0,
  });
  const zoomStateRef = useRef(zoomState);

  const hasInitializedRef = useRef(false);
  const lastVisibleNodeIdRef = useRef<string | null>(null);
  const lastTreeDataLengthRef = useRef<number>(0);
  const lastRootNodeIdsRef = useRef<string>("");

  const getNodeId = useCallback(
    (node: TreeData): string => node.category ? node.id : node.nodeId || node.id || "",
    [],
  );

  const updateZoomState = useCallback((nextZoomState: GraphZoomState) => {
    zoomStateRef.current = nextZoomState;
    setZoomState(nextZoomState);
  }, []);

  const getNodeFill = useCallback(
    (node: TreeData, nodeId: string): string => {
      if (currentVisibleNode?.id === nodeId) {
        return ACTIVE_NODE_FILL;
      }
      return node.category ? CATEGORY_NODE_FILL : DEFAULT_NODE_FILL;
    },
    [currentVisibleNode?.id],
  );

  const getNodeStyle = useCallback(
    (node: TreeData, nodeId: string): string => {
      const strokeColor = currentVisibleNode?.id === nodeId ? ACTIVE_STROKE : DEFAULT_STROKE;
      return `fill: ${getNodeFill(node, nodeId)}; stroke: ${strokeColor}; stroke-width: 0.1px; cursor: pointer;`;
    },
    [currentVisibleNode?.id, getNodeFill],
  );

  const toggleExpandedNode = useCallback((nodeId: string) => {
    const newExpandedNodes = new Set(expandedNodes);
    if (newExpandedNodes.has(nodeId)) {
      newExpandedNodes.delete(nodeId);
    } else {
      newExpandedNodes.add(nodeId);
    }
    setExpandedNodes(newExpandedNodes);
  }, [expandedNodes, setExpandedNodes]);

  const centerNodeTransform = useCallback((
    svgWidth: number,
    svgHeight: number,
    nodePosition: { x: number; y: number },
    scale: number,
  ) => {
    const translateX = svgWidth / 2 - nodePosition.x * scale;
    const translateY = svgHeight / 2.5 - nodePosition.y * scale;
    return { translateX, translateY };
  }, []);

  useEffect(() => {
    const currentRootNodeIds = treeData
      .map(getNodeId)
      .filter(Boolean)
      .join(",");

    if (
      currentRootNodeIds !== lastRootNodeIdsRef.current &&
      lastRootNodeIdsRef.current !== ""
    ) {
      hasInitializedRef.current = false;
    }
    lastRootNodeIdsRef.current = currentRootNodeIds;

    if (treeData.length === 0 && lastTreeDataLengthRef.current > 0) {
      hasInitializedRef.current = false;
    }
    lastTreeDataLengthRef.current = treeData.length;
  }, [getNodeId, treeData]);

  // Helper to check if a nodeId belongs to a category node
  const isCategoryNodeId = useCallback(
    function checkCategoryNodeId(nodeId: string, nodes: TreeData[]): boolean {
      for (const node of nodes) {
        const currentNodeId = getNodeId(node);
        if (currentNodeId === nodeId) {
          return node.category === true;
        }
        if (node.children && node.children.length > 0) {
          if (checkCategoryNodeId(nodeId, node.children)) {
            return true;
          }
        }
      }
      return false;
    },
    [getNodeId],
  );

  // Helper to find node by ID in tree
  const findNodeById = useCallback(
    function searchNodeById(nodes: TreeData[], targetId: string): TreeData | null {
      for (const node of nodes) {
        const currentNodeId = getNodeId(node);
        if (currentNodeId === targetId) {
          return node;
        }
        if (node.children && node.children.length > 0) {
          const found = searchNodeById(node.children, targetId);
          if (found) return found;
        }
      }
      return null;
    },
    [getNodeId],
  );

  useEffect(() => {
    const visibleNodeId = currentVisibleNode?.id || null;
    if (visibleNodeId === lastVisibleNodeIdRef.current) {
      return;
    }

    lastVisibleNodeIdRef.current = visibleNodeId;
    if (!visibleNodeId || isCategoryNodeId(visibleNodeId, treeData)) {
      return;
    }

    if (!expandedNodes.has(visibleNodeId)) {
      const newExpandedNodes = new Set(expandedNodes);
      newExpandedNodes.add(visibleNodeId);
      setExpandedNodes(newExpandedNodes);
    }
  }, [currentVisibleNode?.id, expandedNodes, isCategoryNodeId, setExpandedNodes, treeData]);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      // Find the node to get its name
      const clickedNode = findNodeById(treeData, nodeId);
      const nodeName = clickedNode?.name || "";

      // Category nodes should only expand/collapse
      if (!isCategoryNodeId(nodeId, treeData)) {
        onOpenNodeDagre(nodeId, nodeName);
      }

      toggleExpandedNode(nodeId);
    },
    [
      findNodeById,
      isCategoryNodeId,
      onOpenNodeDagre,
      treeData,
      toggleExpandedNode,
    ],
  );

  // This function is responsible for drawing nodes on a graph based on the provided node data.
  // It takes an node object and a graph object as parameters.
  const onDrawNode = useCallback(
    function drawNode(node: TreeData, graphRef: any) {
      // For category nodes, use the id with collection name
      // For regular nodes, use nodeId which is documentId
      const nodeId = getNodeId(node);

      // Check if the graph already has a node with the current nodeId.
      if (!graphRef.hasNode(nodeId)) {
        // If the node doesn't exist, add it to the graph with specified properties.
        graphRef.setNode(nodeId, {
          label: node.name, // Use node name as the label for the node.
          style: getNodeStyle(node, nodeId),
          labelStyle: `fill: ${"black"}; cursor: pointer;`, // Set style for the node label.
          shape: "rect", // Set the shape to rectangle
          rx: NODE_RADIUS, // Horizontal radius for rounded corners
          ry: NODE_RADIUS, // Vertical radius for rounded corners
          dataAttr: { "data-node-id": nodeId },
        });
      }

      // Check if the current node  is expanded (based on the global set of expandedNodes).
      if (expandedNodes.has(nodeId)) {
        // If expanded, iterate through children and draw edges connecting them to the current node.
        const children = node.children || [];
        for (let childNode of children) {
          // Recursively call the onDrawNode function for each child-node.
          drawNode(childNode, graphRef);

          const childNodeId = getNodeId(childNode);
          // Add an edge between the current node and the child-node  with specified properties.
          graphRef.setEdge(nodeId, childNodeId, {
            curve: d3.curveBasis, // Use a B-spline curve for the edge.
            style: `stroke: ${EDGE_COLOR}; stroke-opacity: 1; fill: none;`, // Set style for the edge.
            arrowheadStyle: `fill: ${EDGE_COLOR}`, // Set style for the arrowhead.
            minlen: 2, // Set minimum length for the edge.
          });
        }
      }
    },
    [expandedNodes, getNodeId, getNodeStyle],
  );

  // Helper function to find all ancestor node IDs for a target node
  const findAncestorIds = useCallback(
    (nodesTree: TreeData[], targetNodeId: string): string[] => {
      const ancestors: string[] = [];

      const searchTree = (nodes: TreeData[], path: string[]): boolean => {
        for (const node of nodes) {
          const currentNodeId = getNodeId(node);
          const newPath = [...path, currentNodeId];
          if (!node.category && (node.nodeId === targetNodeId || node.id === targetNodeId)) {
            ancestors.push(...path);
            return true;
          }

          if (node.children && node.children.length > 0) {
            if (searchTree(node.children, newPath)) {
              return true;
            }
          }
        }
        return false;
      };

      searchTree(nodesTree, []);
      return ancestors;
    },
    [getNodeId],
  );

  const indicateHiddenNodes = useCallback(
    function addHiddenNodeIndicators(node: TreeData, svgGroup: any) {
      const nodeId = getNodeId(node);
      const children = node.children || [];
      const childCount = children.length;
      const isExpanded = expandedNodes.has(nodeId);

      if (childCount === 0) {
        return;
      }

      const nodeSelection = svgGroup.select(`g[data-node-id="${nodeId}"]`);

      if (!nodeSelection.empty()) {
        // Clean any previous indicator on redraw
        nodeSelection.selectAll("g.child-indicator").remove();

        if (!isExpanded) {
          const bbox = (nodeSelection.node() as SVGGraphicsElement).getBBox();
          const nodeXPosition = bbox.width / 2;
          const indicatorText = `${childCount}▸`;
          const indicatorTooltip = `Collapsed: this node has ${childCount} child ${childCount === 1 ? "node" : "nodes"}. Click the node to expand.`;

          const indicatorGroup = nodeSelection
            .append("g")
            .attr("class", "child-indicator")
            .attr("transform", `translate(${nodeXPosition + 14}, 0)`)
            .style("pointer-events", "auto");

          const indicatorCircle = indicatorGroup
            .append("circle")
            .attr("r", INDICATOR_RADIUS)
            .attr("fill", INDICATOR_BG)
            .attr("stroke", INDICATOR_BORDER)
            .attr("stroke-width", 1);

          indicatorCircle.append("title").text(indicatorTooltip);

          const indicatorLabel = indicatorGroup
            .append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .attr("fill", INDICATOR_TEXT)
            .attr("font-size", "10px")
            .attr("font-weight", "700")
            .text(indicatorText);

          indicatorLabel.append("title").text(indicatorTooltip);
        }
      }

      if (!isExpanded) {
        return;
      }

      // Recursively check children
      for (let childNode of children) {
        addHiddenNodeIndicators(childNode, svgGroup);
      }
    },
    [expandedNodes, getNodeId],
  );

  useEffect(() => {
    const selectedNodeId = currentVisibleNode?.id;
    const svgElement = svgRef.current;
    if (!svgElement) {
      return;
    }
    const svg = d3.select<SVGSVGElement, unknown>(svgElement);

    const graph: any = new dagreD3.graphlib.Graph().setGraph({
      rankdir: "LR",
    });

    // Clear previous graph content
    svg.selectAll("*").remove();

    // If treeData is empty, stop execution
    if (!treeData || treeData.length === 0) {
      return;
    }

    // Force expand on first mount
    if (!hasInitializedRef.current && treeData.length > 0) {
      const rootNodeIds = treeData.map(getNodeId).filter(Boolean);
      const nodesToExpand = new Set(rootNodeIds);

      if (currentVisibleNode?.id) {
        const ancestors = findAncestorIds(treeData, currentVisibleNode.id);
        ancestors.forEach(ancestorId => nodesToExpand.add(ancestorId));
      }

      setExpandedNodes(nodesToExpand);
      hasInitializedRef.current = true;
      return;
    }

    const render = new dagreD3.render();

    const svgGroup: any = svg.append("g");

    // Draw the nodes
    for (let node of treeData) {
      onDrawNode(node, graph);
    }

    // Render the graph
    render(svgGroup, graph);

    svg
      .selectAll("g.node")
      .attr("data-node-id", (d) => graph.node(d).dataAttr["data-node-id"]);

    for (let node of treeData) {
      indicateHiddenNodes(node, svgGroup);
    }

    const zoom: any = d3.zoom<SVGSVGElement, unknown>().on("zoom", function (event) {
      svgGroup.attr("transform", event.transform);
      updateZoomState({
        translateX: event.transform.x,
        translateY: event.transform.y,
        scale: event.transform.k,
      }); // Save zoom state
    });

    svg.call(zoom);

    // Handle node click
    svg.selectAll("g.node").on("click", function () {
      const ontologyId = d3.select(this).datum() as string;
      handleNodeClick(ontologyId);
    });

    const svgWidth = svg.node()?.clientWidth || (window.innerWidth * 70) / 100;
    const svgHeight = svg.node()?.clientHeight || SVG_HEIGHT;
    const graphWidth = graph.graph().width + 50;
    const graphHeight = graph.graph().height + 50;

    const zoomScale = Math.min(svgWidth / graphWidth, svgHeight / graphHeight);
    const defaultTranslateX = (svgWidth - graphWidth * zoomScale) / 2;
    const defaultTranslateY = (svgHeight - graphHeight * zoomScale) / 2;

    if (zoomStateRef.current.scale !== 0) {
      // Always restore zoom state if it exists to prevent recentering
      svg.call(
        zoom.transform,
        d3.zoomIdentity
          .translate(zoomStateRef.current.translateX, zoomStateRef.current.translateY)
          .scale(zoomStateRef.current.scale),
      );
    } else if (selectedNodeId && graph.node(selectedNodeId)) {
      // Center on currentVisibleNode on first load
      const nodePosition = graph.node(selectedNodeId);
      const scale = 1;
      const { translateX, translateY } = centerNodeTransform(
        svgWidth,
        svgHeight,
        nodePosition,
        scale,
      );

      svg.call(
        zoom.transform,
        d3.zoomIdentity.translate(translateX, translateY).scale(scale),
      );

      // Set initial zoom state
      updateZoomState({
        translateX: translateX,
        translateY: translateY,
        scale: scale,
      });
    } else {
      // Apply initial zoom only if there is no existing zoom state and no currentVisibleNode
      svg.call(
        zoom.transform,
        d3.zoomIdentity.translate(defaultTranslateX, defaultTranslateY).scale(zoomScale),
      );
    }

    setGraph(graph);

    // Cleanup function to remove graph on unmount
    return () => {
      svg.selectAll("*").remove();
    };
  }, [
    currentVisibleNode?.id,
    centerNodeTransform,
    expandedNodes,
    findAncestorIds,
    getNodeId,
    handleNodeClick,
    indicateHiddenNodes,
    onDrawNode,
    setExpandedNodes,
    treeData,
    updateZoomState,
  ]);

  useEffect(() => {
    const nodeId = currentVisibleNode?.id;
    if (graph && nodeId) {

      if (graph.node(nodeId)) {
        const nodePosition = graph.node(nodeId);
        const svg = d3.select<SVGSVGElement, unknown>(svgRef.current!);
        const svgGroup = svg.select("g");

        const svgWidth = svg.node()?.clientWidth || 0;
        const svgHeight = svg.node()?.clientHeight || 0;

        // Use current zoom state scale if available, otherwise default to 1
        const scale = zoomStateRef.current.scale !== 0 ? zoomStateRef.current.scale : 1;
        const { translateX, translateY } = centerNodeTransform(
          svgWidth,
          svgHeight,
          nodePosition,
          scale,
        );

        const zoomTranslate = d3.zoomIdentity
          .translate(translateX, translateY)
          .scale(scale);

        // Create zoom behavior
        const zoom = d3.zoom().on("zoom", function (event) {
          svgGroup.attr("transform", event.transform);
          updateZoomState({
            translateX: event.transform.x,
            translateY: event.transform.y,
            scale: event.transform.k,
          });
        });

        const transition = svg
          .transition()
          .duration(800)
          .call(zoom.transform as any, zoomTranslate);

        transition.on("end", () => {
          updateZoomState({
            translateX: translateX,
            translateY: translateY,
            scale: scale,
          });
        });

        return () => {
          svg.interrupt();
        };
      }
    }
    return;
  }, [centerNodeTransform, currentVisibleNode?.id, graph, updateZoomState]);

  return <svg id="graphGroup" ref={svgRef} width="100%" height={SVG_HEIGHT} />;
};

export default GraphView;
