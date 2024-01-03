import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import dagreD3 from "dagre-d3";

const DAGGraph = ({ ontologies }: any) => {
  const svgRef = useRef(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [zoomState, setZoomState] = useState<any>(null);

  const handleNodeClick = (ontologyId: any) => {
    if (expandedNodes.has(ontologyId)) {
      expandedNodes.delete(ontologyId);
    } else {
      expandedNodes.add(ontologyId);
    }
    setExpandedNodes(new Set(expandedNodes));
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
    if (expandedNodes.has(nodeId)) {
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
    if (!Object.keys(ontologies).length) return;
    const render: any = new dagreD3.render();

    const svg = d3.select("svg");
    const svgGroup: any = svg.append("g");

    for (let ontology of Object.values(ontologies)) {
      onDrawOntology(ontology, graph);
    }

    render(svgGroup, graph);

    const zoom: any = d3.zoom().on("zoom", function (d) {
      svgGroup.attr("transform", d3.zoomTransform(this));
      setZoomState(d3.zoomTransform(this));
    });
    svg.selectAll("g.node").on("click", function () {
      const nodeData = d3.select(this).datum();
      handleNodeClick(nodeData);
    });
    svg.call(zoom);
    if (zoomState) {
      svgGroup.attr("transform", zoomState);
    }
    const svgWidth = (window.innerWidth * 70) / 100;
    const svgHeight = 600;
    const graphWidth = graph.graph().width + 50;
    const graphHeight = graph.graph().height + 50;

    const zoomScale = Math.min(svgWidth / graphWidth, svgHeight / graphHeight);
    const translateX = (svgWidth - graphWidth * zoomScale) / 6;
    const translateY = (svgHeight - graphHeight * zoomScale) / 2;
    if (!zoomState) {
      svg.call(
        zoom.transform,
        d3.zoomIdentity.translate(translateX, translateY).scale(zoomScale)
      );
    }
    return () => {
      d3.select("#graphGroup").selectAll("*").remove();
    };
  }, [ontologies, expandedNodes]);

  return (
    <>
      {" "}
      <svg id="graphGroup" ref={svgRef} width="100%" height="1000" />
    </>
  );
};

export default DAGGraph;
