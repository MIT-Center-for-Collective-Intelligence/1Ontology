import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import * as dagreD3 from "dagre-d3";
import {
  changeAlphaColor,
  getColor,
  LINKS_TYPES,
} from "@components/lib/utils/ConsultantUtils";
import { Theme, useTheme } from "@mui/material";
import { CloseFullscreen } from "@mui/icons-material";

interface GraphNode {
  id: string;
  label: string;
  groups: { id: string }[];
  nodeType: string;
  isLeverage?: boolean;
}

interface GraphLink {
  source: string;
  target: string;
  polarity: string;
  certainty: string;
}

interface GraphRendererProps {
  nodes: Record<string, GraphNode>;
  links: GraphLink[];
  nodeTypes: any;
  selectedGroups: any;
  selectedDiagram: any;
  selectedLoop: any;
  selectedLink: any;
  newNode: any;
  setNewNode: any;
  setSelectedLink: any;
  setTabIndex: any;
  setOpenSideBar: any;
}

const GraphRenderer: React.FC<GraphRendererProps> = ({
  nodes,
  links,
  nodeTypes,
  selectedGroups,
  selectedDiagram,
  selectedLoop,
  selectedLink,
  newNode,
  setNewNode,
  setSelectedLink,
  setTabIndex,
  setOpenSideBar,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const theme = useTheme();

  const buildGraph = () => {
    const g = new dagreD3.graphlib.Graph({ compound: true })
      .setGraph({ rankdir: "LR", isMultigraph: true })
      .setDefaultEdgeLabel(() => ({}));

    Object.values(nodes).forEach((nodeData) => {
      const isBlurred =
        selectedGroups[selectedDiagram.id] &&
        !(selectedGroups[selectedDiagram.id] || new Set()).has(
          nodeData.groups[0].id,
        );

      let nodeColor = getColor(
        nodeData.nodeType,
        nodeTypes,
        isBlurred ? 0.1 : 1,
      );
      const borderColor = changeAlphaColor("#ffa500", isBlurred ? 0.1 : 1);
      const textColor = changeAlphaColor(
        theme.palette.mode === "light" && isBlurred ? "#000000" : "#fff",
        isBlurred ? 0.1 : 1,
      );
      g.setNode(nodeData.id, {
        label: nodeData.label,
        style: nodeData.isLeverage
          ? `fill: ${nodeColor}; stroke: ${borderColor}; stroke-width: 7px;`
          : `fill: ${nodeColor};`,
        labelStyle: `fill: ${textColor};`,
      });
    });

    links.forEach(({ source, target, polarity, certainty }) => {
      if (source && target) {
        const isBlurred =
          selectedGroups[selectedDiagram.id] &&
          (!selectedGroups[selectedDiagram.id].has(
            nodes[source]?.groups[0]?.id,
          ) ||
            !selectedGroups[selectedDiagram.id].has(
              nodes[target]?.groups[0]?.id,
            ));
        const color =
          LINKS_TYPES[`${certainty.trim()} ${polarity.trim()}`]?.color || "";

        const adjustedColor = changeAlphaColor(color, isBlurred ? 0.1 : 1);

        let _arrowheadStyle = `fill: ${adjustedColor};`;
        let _style = `stroke: ${adjustedColor}; stroke-width: 4px;`;
        const elementsSet = new Set(selectedLoop?.loopNodes || []);
        let label = "";
        let labelStyle = "";
        if (
          (selectedLink?.v === source && selectedLink?.w === target) ||
          (elementsSet.has(source) && elementsSet.has(target))
        ) {
          const color = theme.palette.mode === "dark" ? "white" : "#212121";
          _style = `stroke: ${color}; stroke-width: 3px; filter: drop-shadow(3px 3px 5px ${color}); opacity: 1;`;
          _arrowheadStyle = `fill: ${color}; opacity: 1;`;
          label =
            polarity === "positive" ? "+" : polarity === "negative" ? "-" : "";
          labelStyle = `font-size: 18px; fill: ${
            polarity === "positive"
              ? "green"
              : polarity === "negative"
                ? "red"
                : ""
          }; font-weight: bold;`;
        }
        g.setEdge(source, target, {
          curve: d3.curveBasis,
          style: `${_style} fill: none;`,
          arrowheadStyle: `${_arrowheadStyle}`,
          label,
          labelStyle,
        });
      }
    });

    g.nodes().forEach((v) => {
      const node = g.node(v);
      if (node) {
        node.rx = node.ry = 5;
      }
    });

    return g;
  };

  const modifyLink = async (data: { v: string; w: string }) => {
    const nodeId = data.v;
    const childId = data.w;
    const link = links.find(
      (link) => link.source === nodeId && link.target === childId,
    );

    setSelectedLink({ ...link, ...data });
    setTabIndex(3);
    setOpenSideBar(true);
    setNewNode(null);
  };
  const addPencilButton = (
    edgeElement: any,
    edgeData: any,
    pencilButtonsGroup: any,
  ) => {
    let edgeLabel = edgeElement.select("path");
    let edgePath = edgeLabel.node();
    let pathLength = edgePath.getTotalLength();
    let positionRatio = 0.7;
    let point = edgePath.getPointAtLength(pathLength * positionRatio);

    let circleBg = pencilButtonsGroup
      .append("circle")
      .attr("cx", point.x)
      .attr("cy", point.y)
      .attr("r", 12)
      .attr("fill", "rgba(0, 0, 0, 0.1)")
      .style("opacity", 0)
      .style("transition", "opacity 0.2s ease-in-out");

    let button = pencilButtonsGroup
      .append("foreignObject")
      .attr("width", 20)
      .attr("height", 20)
      .attr("x", point.x - 10)
      .attr("y", point.y - 10)
      .attr("class", "pencil-button")
      .style("z-index", "19999")
      .style("cursor", "pointer");

    let buttonBody = button
      .append("xhtml:body")
      .style("margin", "0px")
      .style("padding", "0px");

    buttonBody
      .append("xhtml:button")
      .style("cursor", "pointer")
      .style("background", "transparent")
      .style("color", "black")
      .style("border", "none")
      .style("font-weight", "bold")
      .style("width", "100%")
      .style("height", "100%")
      .text("✏️")
      .on("click", function (e: any) {
        e.stopPropagation();
        modifyLink(edgeData);
      })
      .on("mouseenter", function () {
        circleBg.style("opacity", 1);
      })
      .on("mouseleave", function () {
        circleBg.style("opacity", 0);
      });

    pencilButtonsGroup
      .append("text")
      .attr("class", "custom-text-color")
      .attr("x", point.x)
      .attr("y", point.y + 14)
      .attr("font-family", "Arial, sans-serif")
      .attr("font-size", "15px")
      .style("cursor", "pointer");
  };

  const modifyNode = async (nodeId: string) => {
    const children = [];
    for (let link of links) {
      if (link.source === nodeId) {
        children.push(link.target);
      }
    }
    setNewNode({ ...nodes[nodeId], children, previous: true });
    setTabIndex(3);
    setOpenSideBar(true);
    setSelectedLink(null);
  };
  const addChild = (child: any) => {
    setNewNode((prev: any) => {
      const _prev = { ...prev };
      if (!_prev.children.includes(child)) {
        _prev.children.push(child);
      }
      return _prev;
    });
  };

  const removeChild = (child: any) => {
    setNewNode((prev: any) => {
      const _prev = { ...prev };
      if (_prev.children.includes(child)) {
        _prev.children.splice(_prev.children.indexOf(child), 1);
      }
      return _prev;
    });
  };
  const renderGraph = (
    svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>,
    g: dagreD3.graphlib.Graph,
  ) => {
    const render: any = new dagreD3.render();
    const svgGroup: d3.Selection<SVGGElement, any, any, any> =
      svg.append<SVGGElement>("g");

    render(svgGroup, g);
    var edges = svg.selectAll("g.edgePath");

    edges.each(function (edgeData) {
      var edgeElement = d3.select(this);
      // const nodeData = nodes[edgeData.v];
      addPencilButton(edgeElement, edgeData, svgGroup);
    });

    const gNodes = svg.selectAll("g.node");

    gNodes.on("click", function (d) {
      d.stopPropagation();
      modifyNode(d.target.__data__);
    });

    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background-color", "rgba(0,0,0,0.7)")
      .style("color", "white")
      .style("padding", "5px")
      .style("border-radius", "4px")
      .style("font-size", "12px");

    svgGroup.selectAll<SVGGElement, any>("g.node").each(function (v) {
      let nodeElement = d3.select(this);
      let nodeLabel = nodeElement.select<SVGRectElement>("rect");
      let nodeBBox = nodeLabel.node()?.getBBox();

      if (!nodeBBox) return;

      nodeElement
        .style("cursor", "pointer")
        .on("mouseover", function () {
          nodeLabel.style("fill-opacity", 0.8);
        })
        .on("mouseout", function () {
          nodeLabel.style("fill-opacity", 1);
        });

      let button = nodeElement
        .append("foreignObject")
        .attr("width", 20)
        .attr("height", 20)
        .attr("x", nodeBBox.x + nodeBBox.width / 2 - 10)
        .attr("y", nodeBBox.y - 10)
        .attr("class", "hide-button")
        .style("cursor", "pointer");

      let buttonBody = button
        .append("xhtml:body")
        .style("margin", "0px")
        .style("padding", "0px");

      if (newNode) {
        const isChild = newNode.children.includes(v);
        buttonBody.style("position", "relative");

        buttonBody
          .append("xhtml:button")
          .style("position", "absolute")
          .style("top", "0px")
          .style("left", "50%")
          .style("transform", "translateX(-50%)")
          .style("background", "white")
          .style("border", "1px solid black")
          .style("border-radius", "50%")
          .style("width", "20px")
          .style("height", "20px")
          .style("font-size", "16px")
          .style("line-height", "20px")
          .style("padding", "0")
          .style("margin", "0")
          .style("display", "flex")
          .style("justify-content", "center")
          .style("align-items", "center")
          .style("cursor", "pointer")
          .text(isChild ? "-" : "+")
          .on("click", function (e) {
            e.stopPropagation();
            if (isChild) {
              e.stopPropagation();
              removeChild(v);
            } else {
              e.stopPropagation();
              addChild(v);
            }
            tooltip.style("visibility", "hidden");
          })
          .on("mouseover", function (event) {
            d3.select(this).style("background", isChild ? "#FFCC80" : "orange");
            tooltip
              .style("visibility", "visible")
              .text(isChild ? "Remove as child" : "Add as child")
              .style("left", event.pageX + 10 + "px")
              .style("top", event.pageY + 10 + "px");
          })
          .on("mouseout", function () {
            d3.select(this).style("background", "white");
            tooltip.style("visibility", "hidden");
          });
      }
    });
  };

  const setupZoom = (
    svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>,
    g: dagreD3.graphlib.Graph | any,
  ) => {
    const zoom: any = d3.zoom<SVGSVGElement, unknown>().on("zoom", (event) => {
      svg.select("g").attr("transform", event.transform);
    });

    svg.call(zoom);

    const svgWidth = (window.innerWidth * 70) / 100;
    const svgHeight = 600;
    const graphWidth = g.graph().width + 50;
    const graphHeight = g.graph().height + 50;

    const zoomScale = Math.min(svgWidth / graphWidth, svgHeight / graphHeight);
    const translateX = (svgWidth - graphWidth * zoomScale) / 2;
    const translateY = (svgHeight - graphHeight * zoomScale) / 2;

    svg.call(
      zoom.transform,
      d3.zoomIdentity.translate(translateX, translateY).scale(zoomScale),
    );
  };

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select<SVGSVGElement, unknown>(svgRef.current!);

    svg.selectAll("*").remove();

    const g = buildGraph();

    renderGraph(
      svg as unknown as d3.Selection<
        SVGSVGElement | null,
        unknown,
        null,
        undefined
      >,
      g,
    );
    setupZoom(
      svg as unknown as d3.Selection<
        SVGSVGElement | null,
        unknown,
        null,
        undefined
      >,
      g,
    );

    return () => {
      svg.selectAll("*").remove();
    };
  }, [nodes, links, newNode]);

  return <svg ref={svgRef} width="100%" height="600px"></svg>;
};

export default GraphRenderer;
