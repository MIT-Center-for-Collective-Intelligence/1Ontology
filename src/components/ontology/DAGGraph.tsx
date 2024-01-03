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
};

const DAGGraph = ({
  treeVisualisation,
  expandedOntologies,
  setExpandedOntologies,
  setDagreZoomState,
  dagreZoomState,
}: IDAGGraphProps) => {
  const svgRef = useRef(null);

  const handleNodeClick = (ontologyId: string) => {
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
        label: ontology.title,
        style:
          "fill: white; stroke: black; stroke-width: 2px; cursor: pointer;",
        labelStyle: "fill: black;",
      });
    }
    if (expandedOntologies.has(nodeId)) {
      const subOntologies: any = Object.values(ontology.specializations || {});
      for (let subOntology of subOntologies) {
        onDrawOntology(subOntology, graph);
        graph.setEdge(nodeId, subOntology.id, {
          curve: d3.curveBasis,
          style: "stroke: #00ff00; stroke-opacity: 1; fill: none;",
          arrowheadStyle: "fill: #00ff00",
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
    const svgHeight = 600;
    const graphWidth = graph.graph().width + 50;
    const graphHeight = graph.graph().height + 50;

    const zoomScale = Math.min(svgWidth / graphWidth, svgHeight / graphHeight);
    const translateX = (svgWidth - graphWidth * zoomScale) / 6;
    const translateY = svgHeight - graphHeight * zoomScale;
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
