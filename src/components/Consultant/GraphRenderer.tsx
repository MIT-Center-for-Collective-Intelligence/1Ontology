import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import * as dagreD3 from "dagre-d3";
import {
  changeAlphaColor,
  getColor,
  LINKS_TYPES,
} from "@components/lib/utils/ConsultantUtils";
import { useTheme } from "@mui/material";

const wrapLabel = (text: string, maxChars = 18): string => {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  words.forEach((word) => {
    if ((current + " " + word).trim().length > maxChars) {
      lines.push(current.trim());
      current = word;
    } else {
      current += " " + word;
    }
  });
  if (current) lines.push(current.trim());
  return lines.join("\n");
};

interface GraphNode {
  id: string;
  label: string;
  groups: { id: string }[];
  nodeType: string;
  isLeverage?: boolean;
  supermindCategory?: string;
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
  diagramId: string;
  graphOrientation: "LR" | "TB";
  appType?: string;
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
  diagramId,
  graphOrientation,
  appType,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const theme = useTheme();

  const buildGraph = () => {
    const g = new dagreD3.graphlib.Graph({ compound: true })
      .setGraph({ rankdir: graphOrientation, isMultigraph: true })
      .setDefaultEdgeLabel(() => ({}));

    Object.values(nodes).forEach((nodeData) => {
      const isBlurred =
        selectedGroups[diagramId] &&
        !(selectedGroups[diagramId] || new Set()).has(nodeData.groups[0].id);

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
        label: wrapLabel(nodeData.label) ?? "",
        style: nodeData.isLeverage
          ? `fill: ${nodeColor}; stroke: ${borderColor}; stroke-width: 7px;`
          : `fill: ${nodeColor};`,
        labelStyle: `fill: ${textColor};`,
        supermindCategory: nodeData.supermindCategory,
      });
    });

    links.forEach(({ source, target, polarity, certainty }) => {
      if (source && target) {
        const isBlurred =
          selectedGroups[diagramId] &&
          (!selectedGroups[diagramId].has(nodes[source]?.groups[0]?.id) ||
            !selectedGroups[diagramId].has(nodes[target]?.groups[0]?.id));
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
          label: label ?? "",
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

  const renderGraph = (
    svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>,
    g: dagreD3.graphlib.Graph,
  ) => {
    const render: any = new dagreD3.render();
    const svgGroup: d3.Selection<SVGGElement, any, any, any> =
      svg.append<SVGGElement>("g");

    render(svgGroup, g);
    const gNodes = svg.selectAll("g.node");

    gNodes.on("click", function (d) {
      d.stopPropagation();
      const nodeId = d.target.__data__;
      const children = links
        .filter((link) => link.source === nodeId)
        .map((link) => link.target);
      setNewNode({ ...nodes[nodeId], children, previous: true });
      setTabIndex((appType || "") === "idea" ? 2 : 3);
      setOpenSideBar(true);
      setSelectedLink(null);
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

    const svgElement = svg.node();
    if (!svgElement) return;

    const svgRect = svgElement.getBoundingClientRect();
    const svgWidth = svgRect.width;
    const svgHeight = svgRect.height;

    const graphWidth = g.graph().width || 0;
    const graphHeight = g.graph().height || 0;

    const zoomScale = Math.min(
      svgWidth / (graphWidth + 40),
      svgHeight / (graphHeight + 40),
    );
    const translateX = (svgWidth - graphWidth * zoomScale) / 2;
    const translateY = (svgHeight - graphHeight * zoomScale) / 2;

    svg.call(
      zoom.transform,
      d3.zoomIdentity.translate(translateX, translateY).scale(zoomScale),
    );
  };

  useEffect(() => {
    if (!svgRef.current) return;

    const svg: any = d3.select<SVGSVGElement, unknown>(svgRef.current);

    svg.selectAll("*").remove();

    const g = buildGraph();
    renderGraph(svg, g);
    setupZoom(svg, g);

    return () => {
      svg.selectAll("*").remove();
    };
  }, [nodes, links, newNode, selectedGroups, selectedLoop, graphOrientation]);

  return <svg ref={svgRef} width="100%" height="100%"></svg>;
};

export default GraphRenderer;
