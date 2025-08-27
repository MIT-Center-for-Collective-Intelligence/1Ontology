import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import {
  Box,
  Button,
  IconButton,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  Typography,
  Zoom,
  Fade,
} from '@mui/material';
import {
  InfoOutlined,
  ZoomIn,
  ZoomOut,
  CenterFocusStrong,
  Close as CloseIcon,
  ChevronRight,
} from '@mui/icons-material';

// Type definitions
export interface TreeNode {
  id: string;
  name: string;
  children: TreeNode[];
  appCount: number;
}

interface TreeVisualizationProps {
  data: TreeNode;
  isDark: boolean;
  viewType: 'tree' | 'sunburst';
  onViewTypeChange: (type: 'tree' | 'sunburst') => void;
  focusNodeId?: string; // Optional prop to specify which node to focus on
}

const TreeVisualization: React.FC<TreeVisualizationProps> = ({
  data,
  isDark,
  viewType,
  onViewTypeChange,
  focusNodeId,
}) => {
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  // Color calculation logic based on frequency
  const getNodeColor = (appCount: number, maxCount: number, isDark: boolean): string => {
    if (appCount === 0) {
      return isDark ? '#444' : '#e0e0e0';
    }
    
    // Calculate intensity based on app count (0 to 1)
    const intensity = Math.sqrt(appCount / maxCount); // Using square root for better distribution
    
    // Color scale from light to bright red
    const baseColors = {
      light: {
        low: '#ffebee',     // Very light pink
        medium: '#ef5350',  // Medium red
        high: '#c62828'     // Dark red
      },
      dark: {
        low: '#4a2c2a',     // Dark red-brown
        medium: '#f44336',  // Bright red
        high: '#ff1744'     // Very bright red
      }
    };
    
    const colors = isDark ? baseColors.dark : baseColors.light;
    
    if (intensity < 0.3) {
      return colors.low;
    } else if (intensity < 0.7) {
      return colors.medium;
    } else {
      return colors.high;
    }
  };

  // Find maximum app count in the tree for color scaling
  const findMaxAppCount = (node: TreeNode): number => {
    let max = node.appCount || 0;
    if (node.children) {
      node.children.forEach(child => {
        max = Math.max(max, findMaxAppCount(child));
      });
    }
    return max;
  };

  // Tooltip functions
  const showTooltip = (event: any, d: d3.HierarchyPointNode<TreeNode>) => {
    const tooltip = d3.select("body").append("div")
      .attr("class", "tree-tooltip")
      .style("position", "absolute")
      .style("background", "rgba(0,0,0,0.9)")
      .style("color", "white")
      .style("padding", "10px")
      .style("border-radius", "5px")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("z-index", "1000");

    tooltip.html(`
      <strong>${d.data.name}</strong><br/>
      AI Applications: ${d.data.appCount?.toLocaleString() || 0}
    `)
    .style("left", (event.pageX + 10) + "px")
    .style("top", (event.pageY - 10) + "px");
  };

  const hideTooltip = () => {
    d3.selectAll(".tree-tooltip").remove();
  };

  // Sunburst-specific data preparation
  const prepareSunburstData = (data: TreeNode): TreeNode & { value: number } => {
    // D3 hierarchy expects a 'value' property for sizing
    const addValues = (node: TreeNode): TreeNode & { value: number } => {
      return {
        id: node.id,
        name: node.name,
        appCount: node.appCount,
        value: node.appCount || 0,
        children: node.children ? node.children.map(addValues) : []
      };
    };
    return addValues(data);
  };

  // Beautiful sunburst-specific tooltip functions
  const showSunburstTooltip = (event: any, d: d3.HierarchyRectangularNode<TreeNode & { value: number }>) => {
    const tooltip = d3.select("body").append("div")
      .attr("class", "sunburst-tooltip")
      .style("position", "absolute")
      .style("background", `linear-gradient(135deg, ${isDark ? 'rgba(20,20,20,0.95)' : 'rgba(255,255,255,0.95)'}, ${isDark ? 'rgba(40,20,20,0.95)' : 'rgba(254,245,245,0.95)'})`)
      .style("color", isDark ? "#ffffff" : "#1a1a1a")
      .style("padding", "16px 20px")
      .style("border-radius", "12px")
      .style("font-size", "14px")
      .style("font-family", '"Inter", "Roboto", "Helvetica", "Arial", sans-serif')
      .style("pointer-events", "none")
      .style("z-index", "1000")
      .style("box-shadow", isDark ? 
        "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)" : 
        "0 8px 32px rgba(0,0,0,0.15), 0 0 0 1px rgba(239,68,68,0.2)")
      .style("backdrop-filter", "blur(10px)")
      .style("border", isDark ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(239,68,68,0.2)")
      .style("opacity", 0);

    const percentage = (((d.value || 0) / (d.parent?.value || 1)) * 100).toFixed(1);
    const totalPercentage = (((d.value || 0) / (d.ancestors().slice(-1)[0].value || 1)) * 100).toFixed(1);

    tooltip.html(`
      <div style="font-weight: 700; margin-bottom: 8px; font-size: 16px; color: ${isDark ? '#ff6b6b' : '#c53030'};">${d.data.name}</div>
      <div style="margin-bottom: 4px;">Applications: <span style="color: ${isDark ? '#ff8a80' : '#e53e3e'}; font-weight: 600;">${(d.value || 0).toLocaleString()}</span></div>
      <div style="margin-bottom: 4px; opacity: 0.8;">Depth: Level ${d.depth}</div>
      <div style="margin-bottom: 4px; opacity: 0.8;">Share of parent: <span style="font-weight: 600;">${percentage}%</span></div>
      <div style="margin-bottom: 4px; opacity: 0.8;">Share of total: <span style="font-weight: 600;">${totalPercentage}%</span></div>
    `)
    .style("left", (event.pageX + 15) + "px")
    .style("top", (event.pageY - 15) + "px");

    // Animate tooltip appearance
    tooltip.transition()
      .duration(200)
      .style("opacity", 1);
  };

  const hideSunburstTooltip = () => {
    d3.selectAll(".sunburst-tooltip")
      .transition()
      .duration(150)
      .style("opacity", 0)
      .remove();
  };

  // Interactive Sunburst Diagram Renderer
  const renderSunburst = (data: TreeNode) => {
    if (!svgRef.current || !data) return;

    // Clear previous render and any previous styling
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    
    // Remove any view-specific classes
    svg.classed("tree-view", false);

    // Get container dimensions
    const container = containerRef.current as HTMLElement | null;
    const containerRect = container?.getBoundingClientRect();
    const width = containerRect?.width || 800;
    const height = containerRect?.height || 800;
    const radius = Math.min(width, height) / 2 - 40; // Leave margin for labels

    // Create the main SVG with sunburst-specific background
    const svg_container = svg
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("background", `radial-gradient(circle, ${isDark ? '#1a1a1a' : '#fafafa'} 0%, ${isDark ? '#0d1117' : '#f6f8fa'} 100%)`)
      .classed("sunburst-view", true); // Add class to identify sunburst styling

    // Create main group with proper centering
    const g = svg_container
      .append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    // Add zoom behavior
    svg_container.call(d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on("zoom", (event) => {
        g.attr("transform", `translate(${width / 2},${height / 2}) ${event.transform}`);
      }) as any);

    // Create partition layout
    const partition = d3.partition<TreeNode & { value: number }>()
      .size([2 * Math.PI, radius]);

    // Create hierarchy and calculate positions
    const root = d3.hierarchy<TreeNode & { value: number }>(prepareSunburstData(data))
      .sum(d => d.value)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    partition(root);

    // Find max value for color scaling
    const maxValue = d3.max(root.descendants(), d => d.value) || 1;

    // Improved color scale function with better contrast
    const getArcColor = (value: number, depth: number): string => {
      if (value === 0) return isDark ? '#2a2a2a' : '#f5f5f5';
      
      const intensity = Math.sqrt(value / maxValue);
      
      // Better color variants with improved contrast
      const colorVariants = {
        light: [
          '#fef2f2', '#fecaca', '#fca5a5', '#f87171', '#ef4444', 
          '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d', '#450a0a'
        ],
        dark: [
          '#451a1a', '#7c2d2d', '#991b1b', '#b91c1c', '#dc2626',
          '#ef4444', '#f87171', '#fca5a5', '#fecaca', '#fef2f2'
        ]
      };
      
      const colors = isDark ? colorVariants.dark : colorVariants.light;
      
      // Better color selection algorithm
      const baseIndex = Math.min(depth * 2, colors.length - 3);
      const intensityOffset = Math.floor(intensity * 2);
      const colorIndex = Math.min(baseIndex + intensityOffset, colors.length - 1);
      
      return colors[colorIndex];
    };

    // Create beautiful arc generator with rounded corners
    const arc = d3.arc<d3.HierarchyRectangularNode<TreeNode & { value: number }>>()
      .startAngle(d => d.x0!)
      .endAngle(d => d.x1!)
      .innerRadius(d => d.y0!)
      .outerRadius(d => d.y1!)
      .cornerRadius(2)
      .padAngle(0.005);

    // Add gradient definitions
    const defs = svg_container.append("defs");

    // Add filter for beautiful shadows
    const filter = defs.append("filter")
      .attr("id", "shadow")
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%");
    
    filter.append("feGaussianBlur")
      .attr("in", "SourceGraphic")
      .attr("stdDeviation", 3);
    
    filter.append("feOffset")
      .attr("dx", 2)
      .attr("dy", 2)
      .attr("result", "offset");
    
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "offset");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Create beautiful paths with enhanced styling and visible borders
    const segmentData = root.descendants().filter(d => d.depth > 0); // Skip root
    
    const path = g.selectAll("path")
      .data(segmentData, (d: any) => d.data.id)
      .enter().append("path")
      .attr("d", d => arc(d as d3.HierarchyRectangularNode<TreeNode & { value: number }>))
      .style("fill", d => getArcColor(d.value || 0, d.depth))
      .style("stroke", d => {
        // Dynamic border color based on fill and theme
        const fillColor = getArcColor(d.value || 0, d.depth);
        const color = d3.color(fillColor);
        
        if (!color) return isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)";
        
        const luminance = color.displayable() ? 
          0.299 * color.rgb().r + 0.587 * color.rgb().g + 0.114 * color.rgb().b : 128;
        
        // Use darker borders for light segments, lighter borders for dark segments
        if (luminance > 200) {
          return "rgba(0,0,0,0.4)"; // Dark border for very light segments
        } else if (luminance > 150) {
          return "rgba(0,0,0,0.25)"; // Medium dark border for light segments
        } else if (luminance > 80) {
          return isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.3)"; // Adaptive border
        } else {
          return "rgba(255,255,255,0.3)"; // Light border for dark segments
        }
      })
      .style("stroke-width", "1px")
      .style("cursor", "default")
      .style("filter", "drop-shadow(0 1px 3px rgba(0,0,0,0.1))")
      .style("transition", "all 0.25s ease-out")
      .style("opacity", 0.95)
      .on("mouseover", function(event, d) {
        // Enhanced hover effect with better performance and enhanced borders
        const currentPath = d3.select(this);
        
        // Calculate enhanced border color for hover
        const fillColor = getArcColor(d.value || 0, d.depth);
        const color = d3.color(fillColor);
        let hoverBorderColor;
        
        if (color) {
          const luminance = color.displayable() ? 
            0.299 * color.rgb().r + 0.587 * color.rgb().g + 0.114 * color.rgb().b : 128;
          
          if (luminance > 150) {
            hoverBorderColor = "rgba(0,0,0,0.6)"; // Strong dark border for light segments
          } else {
            hoverBorderColor = "rgba(255,255,255,0.6)"; // Strong light border for dark segments
          }
        } else {
          hoverBorderColor = isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)";
        }
        
        currentPath
          .style("stroke", hoverBorderColor)
          .style("stroke-width", "2px")
          .style("filter", "drop-shadow(0 2px 8px rgba(0,0,0,0.2)) brightness(1.1)")
          .style("opacity", 1);
        
        // Show tooltip
        showSunburstTooltip(event, d as d3.HierarchyRectangularNode<TreeNode & { value: number }>);
        
        // Highlight path to root with improved performance
        highlightPath(d as d3.HierarchyRectangularNode<TreeNode & { value: number }>);
      })
      .on("mouseout", function(event, d) {
        // Reset to original border styling
        const fillColor = getArcColor(d.value || 0, d.depth);
        const color = d3.color(fillColor);
        let originalBorderColor;
        
        if (color) {
          const luminance = color.displayable() ? 
            0.299 * color.rgb().r + 0.587 * color.rgb().g + 0.114 * color.rgb().b : 128;
          
          if (luminance > 200) {
            originalBorderColor = "rgba(0,0,0,0.4)";
          } else if (luminance > 150) {
            originalBorderColor = "rgba(0,0,0,0.25)";
          } else if (luminance > 80) {
            originalBorderColor = isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.3)";
          } else {
            originalBorderColor = "rgba(255,255,255,0.3)";
          }
        } else {
          originalBorderColor = isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)";
        }
        
        d3.select(this)
          .style("stroke", originalBorderColor)
          .style("stroke-width", "1px")
          .style("filter", "drop-shadow(0 1px 3px rgba(0,0,0,0.1))")
          .style("opacity", 0.95);
        
        hideSunburstTooltip();
        clearHighlight();
      })


    // Segment labels removed for cleaner sunburst appearance

    // Beautiful center circle with enhanced styling
    const centerRadius = Math.max(40, radius * 0.18);
    
    // Clean, sophisticated center gradient
    const centerGradient = defs.append("radialGradient")
      .attr("id", "centerGradient")
      .attr("cx", "40%")
      .attr("cy", "30%")
      .attr("r", "100%");
    
    if (isDark) {
      centerGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#4a5568");
      centerGradient.append("stop")
        .attr("offset", "50%")
        .attr("stop-color", "#2d3748");
      centerGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#1a202c");
    } else {
      centerGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#ffffff");
      centerGradient.append("stop")
        .attr("offset", "50%")
        .attr("stop-color", "#f8fafc");
      centerGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#e2e8f0");
    }

    // Single subtle outer ring
    g.append("circle")
      .attr("r", centerRadius + 3)
      .style("fill", "none")
      .style("stroke", isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)")
      .style("stroke-width", "1px")
      .style("opacity", 0.6);

    // Main center circle with clean styling
    const centerCircle = g.append("circle")
      .attr("r", centerRadius)
      .style("fill", "url(#centerGradient)")
      .style("stroke", isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)")
      .style("stroke-width", "1.5px")
      .style("cursor", "default")
      .style("filter", "drop-shadow(0 2px 8px rgba(0,0,0,0.1))")
      .style("transition", "all 0.2s ease")
      
    // Subtle hover effects
    centerCircle
      .on("mouseover", function() {
        d3.select(this)
          .style("filter", "drop-shadow(0 4px 12px rgba(0,0,0,0.15))")
          .style("stroke", isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)")
          .style("stroke-width", "2px")
          .style("transform", "scale(1.02)");
      })
      .on("mouseout", function() {
        d3.select(this)
          .style("filter", "drop-shadow(0 2px 8px rgba(0,0,0,0.1))")
          .style("stroke", isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)")
          .style("stroke-width", "1.5px")
          .style("transform", "scale(1)");
      });

    // Clean, sophisticated center text
    const titleFontSize = Math.min(16, centerRadius / 2.8);
    const subtitleFontSize = Math.min(12, centerRadius / 4);
    
    // Main title with clean styling
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-0.2em")
      .style("fill", isDark ? "#e2e8f0" : "#2d3748")
      .style("font-size", titleFontSize + "px")
      .style("font-weight", "600")
      .style("font-family", "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif")
      .style("letter-spacing", "0.1px")
      .style("text-rendering", "optimizeLegibility")
      .text(root.data.name.length > 15 ? root.data.name.substring(0, 12) + "..." : root.data.name);

    // Subtitle with subtle styling
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "1.2em")
      .style("fill", isDark ? "#a0aec0" : "#718096")
      .style("font-size", subtitleFontSize + "px")
      .style("font-weight", "500")
      .style("font-family", "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif")
      .style("letter-spacing", "0.05px")
      .style("text-rendering", "optimizeLegibility")
      .style("opacity", 0.9)
      .text(`${(root.value || 0).toLocaleString()} apps`);



    // Highlight path to root with better performance and maintained borders
    const highlightPath = (d: d3.HierarchyRectangularNode<TreeNode & { value: number }>) => {
      const ancestors = d.ancestors();
      path.style("opacity", (node: any) => ancestors.includes(node) ? 1 : 0.35)
          .style("stroke-opacity", (node: any) => ancestors.includes(node) ? 1 : 0.5);
    };

    const clearHighlight = () => {
      path.style("opacity", 0.95)
          .style("stroke-opacity", 1);
    };
  };

  // Updated D3.js tree rendering with color-coded nodes
  const renderTree = (data: TreeNode) => {
    if (!svgRef.current || !data) return;

    // Clear previous render and any previous styling
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    
    // Remove any view-specific classes and reset background
    svg.classed("sunburst-view", false)
       .style("background", "transparent"); // Clear any background gradients

    const width = 1800;
    const height = 1200;
    const margin = { top: 40, right: 200, bottom: 40, left: 200 };

    // Find max count for color scaling
    const maxCount = findMaxAppCount(data);

    // Create tree layout with increased spacing
    const treemap = d3.tree<TreeNode>()
      .size([height - margin.top - margin.bottom, width - margin.left - margin.right])
      .nodeSize([80, 300]); // [height, width] - increases spacing between nodes
    
    // Create hierarchy
    const root = d3.hierarchy<TreeNode>(data);
    const treeData = treemap(root);

    // Create SVG with neutral background and zoom behavior
    const svg_container = svg
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("background", "transparent") // Ensure transparent background for tree view
      .classed("tree-view", true); // Add class to identify tree styling

    const svg_g = svg_container
      .call(d3.zoom<SVGSVGElement, unknown>().on("zoom", function(event) {
        svg_g.attr("transform", event.transform);
      }) as any)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Add links with curved paths
    const link = svg_g.selectAll(".link")
      .data(treeData.descendants().slice(1))
      .enter().append("path")
      .attr("class", "link")
      .attr("d", d => {
        return `M${d.y},${d.x}C${(d.y + d.parent!.y) / 2},${d.x} ${(d.y + d.parent!.y) / 2},${d.parent!.x} ${d.parent!.y},${d.parent!.x}`;
      })
      .style("fill", "none")
      .style("stroke", isDark ? "#666" : "#999")
      .style("stroke-width", "2px")
      .style("stroke-opacity", 0.6);

    // Add nodes
    const node = svg_g.selectAll(".node")
      .data(treeData.descendants())
      .enter().append("g")
      .attr("class", "node")
      .attr("transform", d => `translate(${d.y},${d.x})`)
      .style("cursor", "pointer")
      .on("click", (event, d) => handleNodeClick(event, d as d3.HierarchyPointNode<TreeNode>));

    // Add circles with frequency-based colors
    node.append("circle")
      .attr("r", d => Math.max(8, Math.min(25, Math.sqrt(d.data.appCount || 0) * 0.8)))
      .style("fill", d => getNodeColor(d.data.appCount || 0, maxCount, isDark))
      .style("stroke", d => d.data.appCount > 0 ? "#333" : "#999")
      .style("stroke-width", "2px")
      .on("mouseover", function(event, d) {
        d3.select(this)
          .style("stroke-width", "4px")
          .style("filter", "drop-shadow(0 0 8px rgba(255, 0, 0, 0.6))");
        
        // Show tooltip
        showTooltip(event, d as d3.HierarchyPointNode<TreeNode>);
      })
      .on("mouseout", function(event, d) {
        d3.select(this)
          .style("stroke-width", "2px")
          .style("filter", "none");
        
        hideTooltip();
      });

    // Add labels with improved positioning for better readability
    node.append("text")
      .attr("dy", ".35em")
      .attr("x", d => d.children ? -50 : 50)
      .style("text-anchor", d => d.children ? "end" : "start")
      .style("fill", isDark ? "#fff" : "#333")
      .style("font-size", "12px")
      .style("font-weight", "600")
      .text(d => d.data.name)
      .each(function(d) {
        // Wrap long text with more space
        const text = d3.select(this);
        const words = d.data.name.split(/\s+/).reverse();
        let word: string | undefined;
        let line: string[] = [];
        let lineNumber = 0;
        const lineHeight = 1.2;
        const y = text.attr("y");
        const dy = parseFloat(text.attr("dy"));
        let tspan = text.text(null).append("tspan")
          .attr("x", d.children ? -50 : 50)
          .attr("y", y).attr("dy", dy + "em");
        
        while (word = words.pop()) {
          line.push(word);
          tspan.text(line.join(" "));
          if ((tspan.node()?.getComputedTextLength() || 0) > 180) {
            line.pop();
            tspan.text(line.join(" "));
            line = [word];
            tspan = text.append("tspan")
              .attr("x", d.children ? -50 : 50)
              .attr("y", y)
              .attr("dy", ++lineNumber * lineHeight + dy + "em")
              .text(word);
          }
        }
      });

    // Add app count badges with better positioning
    node.filter(d => d.data.appCount > 0)
      .append("rect")
      .attr("x", 30)
      .attr("y", -25)
      .attr("width", d => Math.max(35, d.data.appCount.toString().length * 9))
      .attr("height", 18)
      .attr("rx", 9)
      .style("fill", "#ff9800")
      .style("stroke", "#fff")
      .style("stroke-width", "1.5px");

    node.filter(d => d.data.appCount > 0)
      .append("text")
      .attr("x", d => 30 + Math.max(35, d.data.appCount.toString().length * 9) / 2)
      .attr("y", -16)
      .attr("dy", ".35em")
      .style("text-anchor", "middle")
      .style("fill", "white")
      .style("font-size", "11px")
      .style("font-weight", "bold")
      .text(d => d.data.appCount.toLocaleString());

    // Auto-focus functionality disabled for now (keeping prop for future use)
    // if (focusNodeId && viewType === 'tree') {
    //   // Focus node logic would go here
    // }
  };

  const handleNodeClick = (event: any, d: d3.HierarchyPointNode<TreeNode>) => {
    setSelectedNode(d.data);
    setDialogOpen(true);
  };

  // Helper function to reset SVG styling
  const resetSVGStyling = () => {
    if (!svgRef.current) return;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    
    // Clear all view-specific classes and styles
    svg.classed("sunburst-view", false)
       .classed("tree-view", false)
       .style("background", null)
       .attr("viewBox", null);
  };

  // Initialize tree data with resize handling
  useEffect(() => {
    const renderVisualization = () => {
      // Always reset styling before rendering
      resetSVGStyling();
      
      if (viewType === 'tree') {
        renderTree(data);
      } else {
        renderSunburst(data);
      }
    };

    renderVisualization();

    // Add resize listener for responsive updates
    const handleResize = () => {
      setTimeout(renderVisualization, 100); // Debounce resize
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [data, isDark, viewType, focusNodeId]);

  return (
    <Box>
      {/* Controls */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button
            variant={viewType === 'tree' ? 'contained' : 'outlined'}
            onClick={() => onViewTypeChange('tree')}
            size="small"
          >
            Tree View
          </Button>
          <Button
            variant={viewType === 'sunburst' ? 'contained' : 'outlined'}
            onClick={() => onViewTypeChange('sunburst')}
            size="small"
          >
            Sunburst View
          </Button>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton 
            size="small" 
            onClick={() => setZoomLevel(prev => Math.min(prev + 0.2, 3))}
            sx={{ bgcolor: 'action.hover' }}
          >
            <ZoomIn />
          </IconButton>
          <IconButton 
            size="small" 
            onClick={() => setZoomLevel(prev => Math.max(prev - 0.2, 0.5))}
            sx={{ bgcolor: 'action.hover' }}
          >
            <ZoomOut />
          </IconButton>
          <IconButton 
            size="small" 
            onClick={() => setZoomLevel(1)}
            sx={{ bgcolor: 'action.hover' }}
          >
            <CenterFocusStrong />
          </IconButton>
        </Box>
      </Box>

      {/* Visualization */}
      <Paper 
        elevation={6}
        sx={{ 
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 3,
          height: viewType === 'sunburst' ? 800 : 600,
          background: isDark 
            ? 'linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 100%)'
            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          border: isDark 
            ? '1px solid rgba(255,255,255,0.1)' 
            : '1px solid rgba(0,0,0,0.05)',
          boxShadow: isDark
            ? '0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)'
            : '0 8px 32px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.02)'
        }}
        ref={containerRef}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          style={{ 
            cursor: 'grab',
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'center center',
            display: 'block'
          }}
        />
      </Paper>

      {/* Node Details Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Zoom}
        TransitionProps={{ timeout: 300 }}
        PaperProps={{
          sx: {
            borderRadius: 2,
            maxHeight: '80vh',
            boxShadow: isDark
              ? '0 12px 40px rgba(0,0,0,0.35)'
              : '0 12px 30px rgba(0,0,0,0.10)',
            bgcolor: isDark ? 'rgba(20,20,22,0.85)' : 'rgba(255,255,255,0.9)',
            border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
            backdropFilter: 'blur(10px) saturate(120%)',
          }
        }}
      >
        <DialogTitle sx={{ 
          bgcolor: 'transparent',
          color: isDark ? '#cbd5e0' : '#334155',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          pb: 1.5,
          pt: 2,
          px: 3,
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box sx={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isDark
                ? 'linear-gradient(135deg, rgba(239,68,68,0.25), rgba(255,255,255,0.06))'
                : 'linear-gradient(135deg, rgba(252,165,165,0.6), rgba(148,163,184,0.35))',
              border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.06)',
            }}>
              <InfoOutlined sx={{ fontSize: 16, color: isDark ? '#fca5a5' : '#b91c1c' }} />
            </Box>
            <Typography variant="h6" sx={{ 
              fontWeight: 500,
              fontSize: '0.95rem',
              color: isDark ? '#e2e8f0' : '#1f2937',
              letterSpacing: 0.1,
              opacity: 0.9
            }}>
              Node Information
            </Typography>
          </Box>
          <IconButton
            onClick={() => setDialogOpen(false)}
            sx={{
              color: isDark ? '#a0aec0' : '#64748b',
              '&:hover': {
                bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                color: isDark ? '#e2e8f0' : '#334155',
              },
              transition: 'all 0.2s ease'
            }}
          >
            <CloseIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </DialogTitle>
        <Box sx={{
          height: 2,
          mx: 3,
          borderRadius: 1,
          background: isDark
            ? 'linear-gradient(90deg, rgba(239,68,68,0.35), rgba(255,255,255,0.06), rgba(239,68,68,0.35))'
            : 'linear-gradient(90deg, rgba(248,113,113,0.6), rgba(100,116,139,0.2), rgba(248,113,113,0.6))',
          opacity: 0.6,
        }} />
        
        <DialogContent sx={{ p: 3, pt: 2 }}>
          {selectedNode && (
            <Box>
              {/* Node Name */}
              <Fade in timeout={350}>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    mb: 2.5, 
                    fontWeight: 500,
                    color: isDark ? '#e5e7eb' : '#0f172a',
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                    fontSize: '1.02rem',
                    lineHeight: 1.45,
                  }}
                >
                  {selectedNode.name}
                </Typography>
              </Fade>
            
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.25 }}>
                {/* AI Applications Count */}
                <Fade in timeout={400}>
                  <Box>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: 400, 
                        color: isDark ? '#a0aec0' : '#64748b',
                        mb: 1.25,
                        fontSize: '0.78rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        opacity: 0.7
                      }}
                    >
                      AI Applications
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                      <Typography 
                        variant="h4" 
                        sx={{ 
                          color: isDark ? '#e2e8f0' : '#0f172a',
                          fontWeight: 500,
                          fontSize: '1.35rem',
                          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                        }}
                      >
                        {selectedNode.appCount.toLocaleString()}
                      </Typography>
                      <Typography 
                        variant="caption"
                        sx={{
                          color: isDark ? 'rgba(252,165,165,0.9)' : '#b91c1c',
                          fontWeight: 600,
                          letterSpacing: '0.02em'
                        }}
                      >
                        apps
                      </Typography>
                    </Box>
                  </Box>
                </Fade>
                      
                {/* Child Categories */}
                {selectedNode.children && selectedNode.children.length > 0 && (
                  <Fade in timeout={450}>
                    <Box>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          fontWeight: 500, 
                          color: isDark ? '#a0aec0' : '#64748b',
                          mb: 1.5,
                          fontSize: '0.84rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}
                      >
                        Child Categories ({selectedNode.children.length})
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {selectedNode.children.map((child, index) => (
                          <Box key={index} onClick={() => setSelectedNode(child)} sx={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            p: 1.5,
                            px: 2,
                            bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                            borderRadius: 1.25,
                            border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.05)',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                              transform: 'translateX(2px)'
                            },
                            cursor: 'pointer'
                          }}>
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                fontWeight: 500,
                                color: isDark ? '#e5e7eb' : '#1f2937',
                                fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
                              }}
                            >
                              {child.name}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                              <Typography
                                variant="caption"
                                sx={{
                                  px: 1.25,
                                  py: 0.25,
                                  borderRadius: 1,
                                  bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
                                  color: isDark ? '#ffffff' : '#0f172a',
                                  fontWeight: 600,
                                  fontSize: '0.72rem',
                                  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
                                }}
                              >
                                {child.appCount.toLocaleString()}
                              </Typography>
                              <ChevronRight sx={{ fontSize: 16, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(15,23,42,0.35)' }} />
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </Fade>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default TreeVisualization;
