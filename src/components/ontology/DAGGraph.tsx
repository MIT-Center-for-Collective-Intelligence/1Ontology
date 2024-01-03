import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import dagreD3 from "dagre-d3";

const DAGGraph = ({ data }) => {
  const svgRef = useRef(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  // Define handleNodeClick outside of useEffect
  const handleNodeClick = (nodeData) => {
    console.log({ nodeData, expandedNodes });
    const nodeId = nodeData;

    if (expandedNodes.has(nodeId)) {
      expandedNodes.delete(nodeId);
    } else {
      expandedNodes.add(nodeId);
    }
    setExpandedNodes(new Set(expandedNodes)); // Update state to trigger useEffect
  };

  // Define processNode outside of useEffect
  const processNode = (node, path, g) => {
    const nodeId = path.join("-");
    if (!g.hasNode(nodeId)) {
      g.setNode(nodeId, {
        label: node.title,
        class: node.isCategory ? "category" : "specialization",
      });
    }

    if (expandedNodes.has(nodeId)) {
      Object.entries(node.specializations || {}).forEach(
        ([category, child]) => {
          const childPath = path.concat(category);
          const childId = childPath.join("-");
          if (!g.hasNode(childId)) {
            processNode(child, childPath, g);
            g.setEdge(nodeId, childId);
          }
        }
      );
    } else {
      // Remove child nodes and edges
      Object.keys(node.specializations || {}).forEach((category) => {
        const childId = path.concat(category).join("-");
        if (g.hasNode(childId)) {
          g.removeNode(childId);
        }
      });
    }
  };

  useEffect(() => {
    if (!data) return;

    const g = new dagreD3.graphlib.Graph().setGraph({ rankdir: "LR" });
    g.setDefaultEdgeLabel(() => ({}));

    // Custom node rendering
    const render = new dagreD3.render();
    render.shapes().rect = (parent, bbox, node) => {
      // Custom shape
      const w = 150;
      const h = 50;
      parent
        .insert("rect", ":first-child")
        .attr("rx", 5)
        .attr("ry", 5)
        .attr("width", w)
        .attr("height", h)
        .attr("style", "fill: #fff; stroke: #333");
      node.width = w;
      node.height = h;
      node.intersect = function (point) {
        return dagreD3.intersect.rect(node, point);
      };
      return parent;
    };

    const svg = d3.select(svgRef.current);
    const inner = svg.select("g").empty() ? svg.append("g") : svg.select("g");

    Object.values(data).forEach((rootNode) =>
      processNode(rootNode, [rootNode.id], g)
    );
    render(inner, g);

    // Apply arrow markers to edges
    inner.selectAll("g.edgePath path").attr("marker-end", "url(#arrow)");

    const zoom = d3
      .zoom()
      .on("zoom", (event) => inner.attr("transform", event.transform));
    svg.call(zoom);

    svg.selectAll("g.node").on("click", function () {
      const nodeData = d3.select(this).datum();
      handleNodeClick(nodeData);
    });
  }, [data, expandedNodes]);

  return (
    <>
      <style>
        {`
          .edgePath path {
            stroke: green;
            fill: none;
          }
        `}
      </style>
      <svg
        ref={svgRef}
        width="100%"
        height="1000"
        style={{ border: "1px solid black" }}
      />
    </>
  );
};

export default DAGGraph;
