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
  DialogActions,
  Typography,
  Chip,
  Zoom,
} from '@mui/material';
import {
  InfoOutlined,
  ZoomIn,
  ZoomOut,
  CenterFocusStrong,
} from '@mui/icons-material';

// Type definitions
export interface TreeNode {
  name: string;
  children: TreeNode[];
  appCount: number;
}

interface TreeVisualizationProps {
  data: TreeNode;
  isDark: boolean;
  viewType: 'tree' | 'sunburst';
  onViewTypeChange: (type: 'tree' | 'sunburst') => void;
}

const TreeVisualization: React.FC<TreeVisualizationProps> = ({
  data,
  isDark,
  viewType,
  onViewTypeChange,
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
      AI Applications: ${d.data.appCount?.toLocaleString() || 0}<br/>
      Level: ${d.depth}
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
        ...node,
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
    const path = g.selectAll("path")
      .data(root.descendants().filter(d => d.depth > 0)) // Skip root
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


    // Add labels for segments with improved positioning and visibility
    const label = g.selectAll("text")
      .data(root.descendants().filter(d => {
        const rectNode = d as d3.HierarchyRectangularNode<TreeNode & { value: number }>;
        // More lenient filtering - show labels for larger segments
        const angleSpan = rectNode.x1! - rectNode.x0!;
        const radialSpan = rectNode.y1! - rectNode.y0!;
        return d.depth > 0 && angleSpan > 0.05 && radialSpan > 12 && d.data.name.length > 0;
      }))
      .enter().append("text")
      .attr("transform", d => {
        const rectNode = d as d3.HierarchyRectangularNode<TreeNode & { value: number }>;
        // Calculate center angle in radians
        const centerAngle = (rectNode.x0! + rectNode.x1!) / 2;
        // Convert to degrees
        const angleDegrees = centerAngle * 180 / Math.PI;
        // Calculate middle radius
        const midRadius = (rectNode.y0! + rectNode.y1!) / 2;
        
        // Improved text rotation logic
        let textRotation = angleDegrees - 90;
        
        // Keep text readable by flipping when it would be upside down
        if (angleDegrees > 90 && angleDegrees < 270) {
          textRotation += 180;
        }
        
        return `rotate(${textRotation}) translate(${midRadius},0)`;
      })
      .attr("dy", "0.35em")
      .style("text-anchor", "middle")
      .style("fill", d => {
        // Improved contrast calculation
        const baseColor = getArcColor(d.value || 0, d.depth);
        const color = d3.color(baseColor);
        if (!color) return isDark ? "#ffffff" : "#000000";
        
        const luminance = color.displayable() ? 
          0.299 * color.rgb().r + 0.587 * color.rgb().g + 0.114 * color.rgb().b : 128;
        
        // More conservative contrast thresholds
        return luminance > 140 ? "#000000" : "#ffffff";
      })
      .style("font-size", d => {
        const rectNode = d as d3.HierarchyRectangularNode<TreeNode & { value: number }>;
        // Better font size calculation based on available space
        const angleSpan = rectNode.x1! - rectNode.x0!;
        const radialSpan = rectNode.y1! - rectNode.y0!;
        const avgRadius = (rectNode.y0! + rectNode.y1!) / 2;
        
        // Calculate available arc length at middle radius
        const arcLength = angleSpan * avgRadius;
        
        // Dynamic font size based on available space
        let fontSize = Math.min(14, Math.max(8, arcLength / 6));
        
        // Adjust for radial space
        fontSize = Math.min(fontSize, radialSpan / 2);
        
        return Math.floor(fontSize) + "px";
      })
      .style("font-weight", "600")
      .style("font-family", "'Inter', 'Arial', sans-serif")
      .style("pointer-events", "none")
      .style("text-shadow", d => {
        const baseColor = getArcColor(d.value || 0, d.depth);
        const color = d3.color(baseColor);
        const luminance = color?.displayable() ? 
          0.299 * color.rgb().r + 0.587 * color.rgb().g + 0.114 * color.rgb().b : 128;
        
        return luminance > 140 ? 
          "1px 1px 3px rgba(255,255,255,0.9)" : 
          "1px 1px 3px rgba(0,0,0,0.9)";
      })
      .style("letter-spacing", "0.2px")
      .text(d => {
        const rectNode = d as d3.HierarchyRectangularNode<TreeNode & { value: number }>;
        const angleSpan = rectNode.x1! - rectNode.x0!;
        const avgRadius = (rectNode.y0! + rectNode.y1!) / 2;
        const arcLength = angleSpan * avgRadius;
        
        // More intelligent text truncation
        const name = d.data.name;
        
        if (arcLength > 120) {
          return name.length > 20 ? name.substring(0, 18) + "..." : name;
        } else if (arcLength > 80) {
          return name.length > 15 ? name.substring(0, 13) + "..." : name;
        } else if (arcLength > 50) {
          return name.length > 10 ? name.substring(0, 8) + "..." : name;
        } else if (arcLength > 30) {
          return name.length > 6 ? name.substring(0, 5) + "..." : name;
        }
        
        return "";
      });

    // Beautiful center circle with improved styling
    const centerRadius = Math.max(30, radius * 0.15);
    
    // Add center gradient with better colors
    const centerGradient = defs.append("radialGradient")
      .attr("id", "centerGradient")
      .attr("cx", "50%")
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
        .attr("stop-color", "#f7fafc");
      centerGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#edf2f7");
    }

    // Outer decorative ring
    g.append("circle")
      .attr("r", centerRadius + 4)
      .style("fill", "none")
      .style("stroke", isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)")
      .style("stroke-width", "1.5px")
      .style("stroke-dasharray", "3,2");

    // Main center circle with better interactivity and visible border
    g.append("circle")
      .attr("r", centerRadius)
      .style("fill", "url(#centerGradient)")
      .style("stroke", isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)")
      .style("stroke-width", "2px")
      .style("cursor", "default")
      .style("filter", "drop-shadow(0 2px 8px rgba(0,0,0,0.15))")
      .style("transition", "all 0.3s ease")
      .on("mouseover", function() {
        d3.select(this)
          .style("filter", "drop-shadow(0 4px 12px rgba(0,0,0,0.25)) brightness(1.05)")
          .style("stroke", isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.7)")
          .style("stroke-width", "3px")
          .style("transform", "scale(1.02)");
      })
      .on("mouseout", function() {
        d3.select(this)
          .style("filter", "drop-shadow(0 2px 8px rgba(0,0,0,0.15))")
          .style("stroke", isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)")
          .style("stroke-width", "2px")
          .style("transform", "scale(1)");
      });

    // Enhanced center text with better typography
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-0.2em")
      .style("fill", isDark ? "#ffffff" : "#1a202c")
      .style("font-size", Math.min(16, centerRadius / 3) + "px")
      .style("font-weight", "700")
      .style("font-family", "'Inter', 'Arial', sans-serif")
      .style("text-shadow", isDark ? "0 1px 3px rgba(0,0,0,0.5)" : "0 1px 3px rgba(255,255,255,0.8)")
      .style("letter-spacing", "0.5px")
      .text(root.data.name.length > 15 ? root.data.name.substring(0, 12) + "..." : root.data.name);

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "1.3em")
      .style("fill", isDark ? "#a0aec0" : "#4a5568")
      .style("font-size", Math.min(12, centerRadius / 4) + "px")
      .style("font-weight", "500")
      .style("font-family", "'Inter', 'Arial', sans-serif")
      .style("text-shadow", isDark ? "0 1px 2px rgba(0,0,0,0.3)" : "0 1px 2px rgba(255,255,255,0.5)")
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

    const width = 1400;
    const height = 900;
    const margin = { top: 20, right: 120, bottom: 30, left: 120 };

    // Find max count for color scaling
    const maxCount = findMaxAppCount(data);

    // Create tree layout
    const treemap = d3.tree<TreeNode>().size([height - margin.top - margin.bottom, width - margin.left - margin.right]);
    
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

    // Add labels with better positioning
    node.append("text")
      .attr("dy", ".35em")
      .attr("x", d => d.children ? -35 : 35)
      .style("text-anchor", d => d.children ? "end" : "start")
      .style("fill", isDark ? "#fff" : "#333")
      .style("font-size", "11px")
      .style("font-weight", "600")
      .text(d => d.data.name)
      .each(function(d) {
        // Wrap long text
        const text = d3.select(this);
        const words = d.data.name.split(/\s+/).reverse();
        let word: string | undefined;
        let line: string[] = [];
        let lineNumber = 0;
        const lineHeight = 1.1;
        const y = text.attr("y");
        const dy = parseFloat(text.attr("dy"));
        let tspan = text.text(null).append("tspan")
          .attr("x", d.children ? -35 : 35)
          .attr("y", y).attr("dy", dy + "em");
        
        while (word = words.pop()) {
          line.push(word);
          tspan.text(line.join(" "));
          if ((tspan.node()?.getComputedTextLength() || 0) > 120) {
            line.pop();
            tspan.text(line.join(" "));
            line = [word];
            tspan = text.append("tspan")
              .attr("x", d.children ? -35 : 35)
              .attr("y", y)
              .attr("dy", ++lineNumber * lineHeight + dy + "em")
              .text(word);
          }
        }
      });

    // Add app count badges
    node.filter(d => d.data.appCount > 0)
      .append("rect")
      .attr("x", 20)
      .attr("y", -20)
      .attr("width", d => Math.max(30, d.data.appCount.toString().length * 8))
      .attr("height", 16)
      .attr("rx", 8)
      .style("fill", "#ff9800")
      .style("stroke", "#fff")
      .style("stroke-width", "1px");

    node.filter(d => d.data.appCount > 0)
      .append("text")
      .attr("x", d => 20 + Math.max(30, d.data.appCount.toString().length * 8) / 2)
      .attr("y", -12)
      .attr("dy", ".35em")
      .style("text-anchor", "middle")
      .style("fill", "white")
      .style("font-size", "10px")
      .style("font-weight", "bold")
      .text(d => d.data.appCount.toLocaleString());
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
  }, [data, isDark, viewType]);

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
            borderRadius: 3,
            maxHeight: '80vh'
          }
        }}
      >
        <DialogTitle sx={{ 
          bgcolor: 'primary.main', 
          color: 'white', 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2
        }}>
          <InfoOutlined />
          Node Information
        </DialogTitle>
        
        <DialogContent sx={{ p: 3 }}>
          {selectedNode && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                {selectedNode.name}
              </Typography>
            
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                    AI Applications Count:
                  </Typography>
                  <Typography variant="h4" sx={{ color: 'secondary.main', fontWeight: 'bold' }}>
                    {selectedNode.appCount.toLocaleString()}
                  </Typography>
                </Box>
                      
                {selectedNode.children && selectedNode.children.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                      Child Categories ({selectedNode.children.length}):
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {selectedNode.children.map((child, index) => (
                        <Box key={index} sx={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          p: 1,
                          bgcolor: 'action.hover',
                          borderRadius: 1
                        }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {child.name}
                          </Typography>
                          <Chip 
                            label={child.appCount.toLocaleString()} 
                            size="small" 
                            color="primary" 
                            variant="outlined" 
                          />
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 3 }}>
          <Button 
            onClick={() => setDialogOpen(false)} 
            variant="contained" 
            color="primary"
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TreeVisualization;
