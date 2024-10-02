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
import { TreeVisual } from " @components/types/INode";

type IDagGraphProps = {
  treeVisualization: TreeVisual;
  setExpandedNodes: (state: Set<string>) => void;
  expandedNodes: Set<string>;
  setDagreZoomState: any;
  dagreZoomState: any;
  onOpenNodeDagre: (ontologyId: string) => void;
  currentVisibleNode: any;
};

const DagGraph = ({
  treeVisualization,
  expandedNodes,
  setExpandedNodes,
  setDagreZoomState,
  dagreZoomState,
  onOpenNodeDagre,
  currentVisibleNode,
}: IDagGraphProps) => {
  const svgRef = useRef(null);
  const [graph, setGraph] = useState<any>(null);

  const handleNodeClick = (nodeId: string) => {
    onOpenNodeDagre(nodeId);
    if (expandedNodes.has(nodeId)) {
      expandedNodes.delete(nodeId);
    } else {
      expandedNodes.add(nodeId);
    }
    setExpandedNodes(new Set(expandedNodes));
  };

  // This function is responsible for drawing nodes on a graph based on the provided node data.
  // It takes an node object and a graph object as parameters.
  const onDrawNode = (node: any, graph: any) => {
    // Extract the nodeId from the node or set it as an empty string if not available.
    const nodeId = node?.id || "";

    // Check if the graph already has a node with the current nodeId.
    if (!graph.hasNode(nodeId)) {
      // If the node doesn't exist, add it to the graph with specified properties.
      graph.setNode(nodeId, {
        label: node.title, // Use node title as the label for the node.
        style: `fill: ${
          currentVisibleNode?.id === nodeId
            ? "#87D37C"
            : node.isCategory
            ? "#ffbe48"
            : "white"
        }; stroke: ${
          currentVisibleNode?.id === nodeId ? "white" : "black"
        }; stroke-width: 0.1px; cursor: pointer;`, // Set node style based on node category.
        labelStyle: `fill: ${"black"}; cursor: pointer;`, // Set style for the node label.
        shape: "rect", // Set the shape to rectangle
        rx: 25, // Horizontal radius for rounded corners
        ry: 25, // Vertical radius for rounded corners
      });
    }

    // Check if the current node  is expanded (based on the global set of expandedNodes).
    if (expandedNodes.has(nodeId)) {
      // If expanded, iterate through children and draw edges connecting them to the current node.
      const children: any = Object.values(node.specializations || {});
      for (let childNode of children) {
        // Recursively call the onDrawNode function for each child-node.
        onDrawNode(childNode, graph);

        // Add an edge between the current node and the child-node  with specified properties.
        graph.setEdge(nodeId, childNode.id, {
          curve: d3.curveBasis, // Use a B-spline curve for the edge.
          style: "stroke: orange; stroke-opacity: 1; fill: none;", // Set style for the edge.
          arrowheadStyle: "fill: orange", // Set style for the arrowhead.
          minlen: 2, // Set minimum length for the edge.
        });
      }
    }
  };

  useEffect(() => {
    const graph: any = new dagreD3.graphlib.Graph().setGraph({
      rankdir: "LR",
    });

    // Clear previous graph content
    d3.select("#graphGroup").selectAll("*").remove();

    // If treeVisualization is empty, stop execution
    if (!Object.keys(treeVisualization).length) return;

    const render = new dagreD3.render();

    const svg = d3.select("svg");
    const svgGroup: any = svg.append("g");

    // Draw the nodes
    for (let node of Object.values(treeVisualization)) {
      onDrawNode(node, graph);
    }

    // Render the graph
    render(svgGroup, graph);

    const zoom: any = d3.zoom().on("zoom", function (event) {
      svgGroup.attr("transform", event.transform);
      setDagreZoomState(event.transform); // Save zoom state
    });

    // Handle node click
    svg.selectAll("g.node").on("click", function () {
      const ontologyId = d3.select(this).datum() as string;
      handleNodeClick(ontologyId);
    });

    svg.call(zoom);

    const svgWidth = (window.innerWidth * 70) / 100;
    const svgHeight = 290;
    const graphWidth = graph.graph().width + 50;
    const graphHeight = graph.graph().height + 50;

    const zoomScale = Math.min(svgWidth / graphWidth, svgHeight / graphHeight);
    const translateX = (svgWidth - graphWidth * zoomScale) / 20;
    const translateY = 150;

    // Restore zoom state if it exists
    if (dagreZoomState) {
      svg.call(zoom.transform, dagreZoomState);
    } else {
      // Apply initial zoom only if there is no existing zoom state
      svg.call(
        zoom.transform,
        d3.zoomIdentity.translate(translateX, translateY).scale(zoomScale)
      );
    }

    setGraph(graph);

    // Cleanup function to remove graph on unmount
    return () => {
      d3.select("#graphGroup").selectAll("*").remove();
    };
  }, [treeVisualization, expandedNodes]);

  useEffect(() => {
    if (graph && currentVisibleNode) {
      const nodeId = currentVisibleNode.id;

      if (graph.node(nodeId)) {
        const nodePosition = graph.node(nodeId);
        const svg = d3.select<SVGSVGElement, unknown>(svgRef.current!);
        const svgGroup = svg.select("g");

        const svgWidth = svg.node()?.clientWidth || 0;
        const svgHeight = svg.node()?.clientHeight || 0;

        const scale = 1;
        const translateX = svgWidth / 2 - nodePosition.x * scale;
        const translateY = svgHeight / 2.5 - nodePosition.y * scale;

        const zoomTranslate = d3.zoomIdentity
          .translate(translateX, translateY)
          .scale(scale);

        svg
          .transition()
          .duration(1000)
          .call(d3.zoom().transform as any, zoomTranslate);

        svgGroup
          .transition()
          .duration(1000)
          .attr(
            "transform",
            `translate(${translateX}, ${translateY}) scale(${scale})`
          );
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

export default DagGraph;
