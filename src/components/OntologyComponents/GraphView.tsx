/*
# DAGGraph Component

The `DAGGraph` component is a React component that is responsible for rendering a directed acyclic graph (DAG) visualization of an ontology tree. It uses the `dagre-d3` library to lay out the graph and `d3` for rendering and handling user interactions such as zooming and clicking on nodes.

## Props

The component accepts the following props:

- `treeVisualisation`: An object representing the visual structure of the ontology tree.
- `setExpandedOntologies`: A function to update the state of expanded ontologies.
- `expandedOntologies`: A `Set` containing the IDs of ontologies that are currently expanded.
- `setDagreZoomState`: A function to update the zoom state of the DAG.
- `dagreZoomState`: The current zoom state of the DAG.
- `onOpenOntologyTree`: A function that is called when a node is clicked, with the node ID and path as arguments.

## Usage

To use the `DAGGraph` component, you need to import it and pass the required props as shown below:

```jsx
import DAGGraph from '@components/ontology/DAGGraph';

// ...

<DAGGraph
  treeVisualisation={treeVisualisationData}
  expandedOntologies={expandedOntologiesSet}
  setExpandedOntologies={updateExpandedOntologies}
  setDagreZoomState={updateDagreZoomState}
  dagreZoomState={currentDagreZoomState}
  onOpenOntologyTree={handleOpenOntologyTree}
/>
```

## Functionality

The `DAGGraph` component performs the following functions:

- It creates a new `dagreD3.graphlib.Graph` instance to represent the ontology graph.
- It uses the `onDrawOntology` function to recursively add nodes and edges to the graph based on the `treeVisualisation` prop.
- It sets up a `d3.zoom` behavior to allow users to zoom in and out of the graph.
- It handles node clicks by calling the `onOpenOntologyTree` prop and updating the `expandedOntologies` state.
- It automatically scales and centers the graph based on the size of the container and the dimensions of the graph.

## Effects

The component uses a `useEffect` hook to:

- Render the graph whenever the `treeVisualisation` or `expandedOntologies` props change.
- Clean up by removing all elements from the `#graphGroup` when the component is unmounted.

## Styling

The nodes and edges of the graph are styled using inline styles within the `onDrawOntology` function. You can customize the appearance by modifying the `style` and `labelStyle` properties of the nodes and the `style` and `arrowheadStyle` properties of the edges.

## SVG Container

The SVG container for the graph is created with a `ref` to the DOM element and is given a fixed height. You can adjust the size by changing the `width` and `height` attributes of the `svg` element.

```jsx
<svg id="graphGroup" ref={svgRef} width="100%" height="1000" />
```

## Conclusion

The `DAGGraph` component is a powerful tool for visualizing hierarchical data structures such as ontologies. By leveraging the capabilities of `dagre-d3` and `d3`, it provides an interactive and scalable graph representation that can be easily integrated into React applications. 
 */

import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import dagreD3 from "dagre-d3";
import { TreeData } from "@components/types/INode";

type IDagGraphProps = {
  treeData: TreeData[];
  setExpandedNodes: (state: Set<string>) => void;
  expandedNodes: Set<string>;
  onOpenNodeDagre: (ontologyId: string) => void;
  currentVisibleNode: any;
};

const GraphView = ({
  treeData,
  expandedNodes,
  setExpandedNodes,
  onOpenNodeDagre,
  currentVisibleNode,
}: IDagGraphProps) => {
  const svgRef = useRef(null);
  const [graph, setGraph] = useState<any>(null);
  const [zoomState, setZoomState] = useState<{
    translateX: number;
    translateY: number;
    scale: number;
  }>({
    translateX: 0,
    translateY: 0,
    scale: 0,
  });

  const hasInitializedRef = useRef(false);
  const lastVisibleNodeIdRef = useRef<string | null>(null);
  const lastTreeDataLengthRef = useRef<number>(0);
  const lastRootNodeIdsRef = useRef<string>("");

  // Detect app switch by checking if root node IDs changed
  const currentRootNodeIds = treeData.map(node => node.category ? node.id : (node.nodeId || node.id)).filter(Boolean).join(",");
  if (currentRootNodeIds !== lastRootNodeIdsRef.current && lastRootNodeIdsRef.current !== "") {
    hasInitializedRef.current = false;
  }
  lastRootNodeIdsRef.current = currentRootNodeIds;

  // Reset initialization when treeData becomes empty
  if (treeData.length === 0 && lastTreeDataLengthRef.current > 0) {
    hasInitializedRef.current = false;
  }
  lastTreeDataLengthRef.current = treeData.length;

  // Helper to check if a nodeId belongs to a category node
  const isCategoryNodeId = (nodeId: string, nodes: TreeData[]): boolean => {
    for (const node of nodes) {
      const currentNodeId = node.category ? node.id : (node.nodeId || node.id);
      if (currentNodeId === nodeId) {
        return node.category === true;
      }
      if (node.children && node.children.length > 0) {
        if (isCategoryNodeId(nodeId, node.children)) {
          return true;
        }
      }
    }
    return false;
  };

  // Auto-expand when currentVisibleNode changes (but don't reset initialization)
  if (currentVisibleNode?.id !== lastVisibleNodeIdRef.current) {
    lastVisibleNodeIdRef.current = currentVisibleNode?.id || null;

    // Auto-expand the newly selected node if it's not a category
    if (currentVisibleNode?.id && !isCategoryNodeId(currentVisibleNode.id, treeData)) {
      if (!expandedNodes.has(currentVisibleNode.id)) {
        const newExpandedNodes = new Set(expandedNodes);
        newExpandedNodes.add(currentVisibleNode.id);
        setExpandedNodes(newExpandedNodes);
      }
    }
  }

  const handleNodeClick = (nodeId: string) => {
    // Category nodes should only expand/collapse
    if (!isCategoryNodeId(nodeId, treeData)) {
      onOpenNodeDagre(nodeId);
    }

    // Toggle expansion state
    if (expandedNodes.has(nodeId)) {
      expandedNodes.delete(nodeId);
    } else {
      expandedNodes.add(nodeId);
    }
    setExpandedNodes(new Set(expandedNodes));
  };

  // This function is responsible for drawing nodes on a graph based on the provided node data.
  // It takes an node object and a graph object as parameters.
  const onDrawNode = (node: TreeData, graph: any) => {
    // For category nodes, use the id with collection name
    // For regular nodes, use nodeId which is documentId
    const nodeId = node.category ? node.id : (node?.nodeId || node?.id || "");

    // Check if the graph already has a node with the current nodeId.
    if (!graph.hasNode(nodeId)) {
      // If the node doesn't exist, add it to the graph with specified properties.
      graph.setNode(nodeId, {
        label: node.name, // Use node name as the label for the node.
        style: `fill: ${
          currentVisibleNode?.id === nodeId
            ? "#87D37C"
            : node.category
              ? "#ffbe48"
              : "white"
        }; stroke: ${
          currentVisibleNode?.id === nodeId ? "white" : "black"
        }; stroke-width: 0.1px; cursor: pointer;`, // Set node style based on node category.
        labelStyle: `fill: ${"black"}; cursor: pointer;`, // Set style for the node label.
        shape: "rect", // Set the shape to rectangle
        rx: 25, // Horizontal radius for rounded corners
        ry: 25, // Vertical radius for rounded corners
        dataAttr: { "data-node-id": nodeId },
      });
    }

    // Check if the current node  is expanded (based on the global set of expandedNodes).
    if (expandedNodes.has(nodeId)) {
      // If expanded, iterate through children and draw edges connecting them to the current node.
      const children = node.children || [];
      for (let childNode of children) {
        // Recursively call the onDrawNode function for each child-node.
        onDrawNode(childNode, graph);

        const childNodeId = childNode.category ? childNode.id : (childNode.nodeId || childNode.id);
        // Add an edge between the current node and the child-node  with specified properties.
        graph.setEdge(nodeId, childNodeId, {
          curve: d3.curveBasis, // Use a B-spline curve for the edge.
          style: "stroke: orange; stroke-opacity: 1; fill: none;", // Set style for the edge.
          arrowheadStyle: "fill: orange", // Set style for the arrowhead.
          minlen: 2, // Set minimum length for the edge.
        });
      }
    }
  };

  // Helper function to find all ancestor node IDs for a target node
  const findAncestorIds = (treeData: TreeData[], targetNodeId: string): string[] => {
    const ancestors: string[] = [];

    const searchTree = (nodes: TreeData[], path: string[]): boolean => {
      for (const node of nodes) {
        const currentNodeId = node.category ? node.id : (node.nodeId || node.id);
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

    searchTree(treeData, []);
    return ancestors;
  };

  const indicateHiddenNodes = (node: TreeData, graph: any) => {
    if (!currentVisibleNode) return;

    const nodeId = node.category ? node.id : (node?.nodeId || node?.id || "");

    const nodeSelection = d3.select(`g[data-node-id="${nodeId}"]`);

    // Check if an indicator already exists
    const existingPolygon = nodeSelection.select("polygon");

    // If indicator exists, exit process
    if (!existingPolygon.empty()) {
      return;
    }

    const bbox = nodeSelection.node()
      ? (nodeSelection.node() as SVGGraphicsElement).getBBox()
      : null;
    const nodeXPosition = bbox ? bbox.width / 2 : 0;

    const hasHiddenSpecializations =
      !expandedNodes.has(nodeId) &&
      node.children &&
      node.children.length > 0;

    if (hasHiddenSpecializations) {
      nodeSelection
        .append("polygon")
        .attr("points", "10,0 0,-5 0,5")
        .attr("fill", "orange")
        .attr("transform", `translate(${nodeXPosition + 10}, 10)`);
    }

    // Recursively check children
    const children = node.children || [];
    for (let childNode of children) {
      indicateHiddenNodes(childNode, graph);
    }
  };

  useEffect(() => {
    const graph: any = new dagreD3.graphlib.Graph().setGraph({
      rankdir: "LR",
    });

    // Clear previous graph content
    d3.select("#graphGroup").selectAll("*").remove();

    // If treeData is empty, stop execution
    if (!treeData || treeData.length === 0) {
      return;
    }

    // Force expand on first mount
    if (!hasInitializedRef.current && treeData.length > 0) {
      const rootNodeIds = treeData.map(node => node.category ? node.id : (node.nodeId || node.id)).filter(Boolean);
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

    const svg = d3.select("svg");
    const svgGroup: any = svg.append("g");

    // Draw the nodes
    for (let node of treeData) {
      onDrawNode(node, graph);
    }

    // Render the graph
    render(svgGroup, graph);

    d3.select("svg")
      .selectAll("g.node")
      .attr("data-node-id", (d) => graph.node(d).dataAttr["data-node-id"]);

    for (let node of treeData) {
      indicateHiddenNodes(node, graph);
    }

    const zoom: any = d3.zoom().on("zoom", function (event) {
      svgGroup.attr("transform", event.transform);
      setZoomState({
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

    const svgWidth = (window.innerWidth * 70) / 100;
    const svgHeight = 290;
    const graphWidth = graph.graph().width + 50;
    const graphHeight = graph.graph().height + 50;

    const zoomScale = Math.min(svgWidth / graphWidth, svgHeight / graphHeight);
    const defaultTranslateX = (svgWidth - graphWidth * zoomScale) / 20;
    const defaultTranslateY = 150;

    if (zoomState.scale !== 0) {
      // Always restore zoom state if it exists to prevent recentering
      svg.call(
        zoom.transform,
        d3.zoomIdentity
          .translate(zoomState.translateX, zoomState.translateY)
          .scale(zoomState.scale),
      );
    } else if (currentVisibleNode && graph.node(currentVisibleNode.id)) {
      // Center on currentVisibleNode on first load
      const nodePosition = graph.node(currentVisibleNode.id);
      const scale = 1;
      const translateX = svgWidth / 2 - nodePosition.x * scale;
      const translateY = svgHeight / 2.5 - nodePosition.y * scale;

      svg.call(
        zoom.transform,
        d3.zoomIdentity.translate(translateX, translateY).scale(scale),
      );

      // Set initial zoom state
      setZoomState({
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
      d3.select("#graphGroup").selectAll("*").remove();
    };
  }, [treeData, expandedNodes]);

  useEffect(() => {
    if (graph && currentVisibleNode) {
      const nodeId = currentVisibleNode?.id;

      if (graph.node(nodeId)) {
        const nodePosition = graph.node(nodeId);
        const svg = d3.select<SVGSVGElement, unknown>(svgRef.current!);
        const svgGroup = svg.select("g");

        const svgWidth = svg.node()?.clientWidth || 0;
        const svgHeight = svg.node()?.clientHeight || 0;

        // Use current zoom state scale if available, otherwise default to 1
        const scale = zoomState.scale !== 0 ? zoomState.scale : 1;
        const translateX = svgWidth / 2 - nodePosition.x * scale;
        const translateY = svgHeight / 2.5 - nodePosition.y * scale;

        const zoomTranslate = d3.zoomIdentity
          .translate(translateX, translateY)
          .scale(scale);

        // Create zoom behavior
        const zoom = d3.zoom().on("zoom", function (event) {
          svgGroup.attr("transform", event.transform);
          setZoomState({
            translateX: event.transform.x,
            translateY: event.transform.y,
            scale: event.transform.k,
          });
        });

        svg
          .transition()
          .duration(800)
          .call(zoom.transform as any, zoomTranslate);

        // Update zoom state immediately after transition
        setTimeout(() => {
          setZoomState({
            translateX: translateX,
            translateY: translateY,
            scale: scale,
          });
        }, 850);
      }
    }
  }, [currentVisibleNode?.id, graph]);

  return (
    <>
      {" "}
      <svg id="graphGroup" ref={svgRef} width="100%" height="1000" />
    </>
  );
};

export default GraphView;
