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
- `onOpenOntologyTree`: A function that is called when a node is clicked, with the ontology ID and path as arguments.

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
import { TreeVisual } from " @components/types/IOntology";

type IDAGGraphProps = {
  treeVisualisation: TreeVisual;
  setExpandedOntologies: (state: Set<string>) => void;
  expandedOntologies: Set<string>;
  setDagreZoomState: any;
  dagreZoomState: any;
  onOpenOntologyTree: (ontologyId: string, path: string[]) => void;
};

const DAGGraph = ({
  treeVisualisation,
  expandedOntologies,
  setExpandedOntologies,
  setDagreZoomState,
  dagreZoomState,
  onOpenOntologyTree,
}: IDAGGraphProps) => {
  const svgRef = useRef(null);

  const handleNodeClick = (ontologyId: string) => {
    onOpenOntologyTree(ontologyId, []);
    if (expandedOntologies.has(ontologyId)) {
      expandedOntologies.delete(ontologyId);
    } else {
      expandedOntologies.add(ontologyId);
    }
    setExpandedOntologies(new Set(expandedOntologies));
  };

  const onDrawOntology = (ontology: any, graph: any) => {
    const nodeId = ontology?.id || "";
    if (!graph.hasNode(nodeId)) {
      graph.setNode(nodeId, {
        label: ontology.isCategory ? ontology.title : "ontology.title",
        style: `fill: ${
          ontology.isCategory ? "#40cc28" : "white"
        }; stroke: black; stroke-width: 2px; cursor: pointer;`,
        labelStyle: "fill: black;",
      });
    }
    if (expandedOntologies.has(nodeId)) {
      const subOntologies: any = Object.values(ontology.specializations || {});
      for (let subOntology of subOntologies) {
        onDrawOntology(subOntology, graph);
        graph.setEdge(nodeId, subOntology.id, {
          curve: d3.curveBasis,
          style: "stroke: #ff8a33; stroke-opacity: 1; fill: none;",
          arrowheadStyle: "fill: #ff8a33",
          minlen: 2,
        });
      }
    }
  };

  useEffect(() => {
    const graph: any = new dagreD3.graphlib.Graph().setGraph({
      rankdir: "LR",
    });
    d3.select("#graphGroup").selectAll("*").remove();
    if (!Object.keys(treeVisualisation).length) return;
    const render = new dagreD3.render();

    const svg = d3.select("svg");
    const svgGroup: any = svg.append("g");

    for (let ontology of Object.values(treeVisualisation)) {
      onDrawOntology(ontology, graph);
    }

    render(svgGroup, graph);

    const zoom: any = d3.zoom().on("zoom", function (d) {
      svgGroup.attr("transform", d3.zoomTransform(this));
      setDagreZoomState(d3.zoomTransform(this));
    });
    svg.selectAll("g.node").on("click", function () {
      const ontologyId = d3.select(this).datum() as string;
      handleNodeClick(ontologyId);
    });
    svg.call(zoom);
    if (dagreZoomState) {
      svgGroup.attr("transform", dagreZoomState);
    }
    const svgWidth = (window.innerWidth * 70) / 100;
    const svgHeight = 290;
    const graphWidth = graph.graph().width + 50;
    const graphHeight = graph.graph().height + 50;

    const zoomScale = Math.min(svgWidth / graphWidth, svgHeight / graphHeight);
    const translateX = (svgWidth - graphWidth * zoomScale) / 20;
    const translateY = 150;
    if (!dagreZoomState) {
      svg.call(
        zoom.transform,
        d3.zoomIdentity.translate(translateX, translateY).scale(zoomScale)
      );
    }
    return () => {
      d3.select("#graphGroup").selectAll("*").remove();
    };
  }, [treeVisualisation, expandedOntologies]);

  return (
    <>
      {" "}
      <svg id="graphGroup" ref={svgRef} width="100%" height="1000" />
    </>
  );
};

export default DAGGraph;
