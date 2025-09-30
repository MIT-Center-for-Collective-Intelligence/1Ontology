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
  const [sunburstZoomLevel, setSunburstZoomLevel] = useState(1);
  const [treeZoomLevel, setTreeZoomLevel] = useState(1);
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const sunburstZoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const treeZoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  // Store complete zoom transforms (scale + translation) for each view
  const sunburstTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const treeTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);

  // Color calculation logic matching treemap implementation exactly
  const getNodeColor = (appCount: number, maxCount: number, isDark: boolean): string => {
    // 0-1 apps handling - pure white (same as treemap)
    if (appCount <= 1) {
      return "rgb(255, 255, 255)";
    }

    // For apps > 1, use logarithmic scaling starting from 2 (same as treemap)
    const minColorCount = 2; // Start coloring from 2 apps
    const logMax = Math.log(maxCount);
    const logCurrent = Math.log(appCount);
    const logMin = Math.log(minColorCount);

    // Normalize to 0-1 range using log scale
    const intensity = Math.max(0, (logCurrent - logMin) / (logMax - logMin));

    // Apply square root curve for smoother progression (same as treemap)
    const enhancedIntensity = Math.sqrt(intensity);

    // Normal: White to red (high app count = red, low app count = white)
    const r = 255; // Keep red channel at max
    const g = Math.floor(255 * (1 - enhancedIntensity * 0.85)); // Reduce green gradually
    const b = Math.floor(255 * (1 - enhancedIntensity * 0.85)); // Reduce blue gradually
    return `rgb(${r}, ${g}, ${b})`;
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
        // Use equal sizing (1 for leaf nodes) for structural hierarchy - this determines arc size
        value: node.children && node.children.length > 0 ? 0 : 1,
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

    const appCount = d.data.appCount || 0;

    tooltip.html(`
      <div style="font-weight: 700; margin-bottom: 8px; font-size: 16px; color: ${isDark ? '#ff6b6b' : '#c53030'};">${d.data.name}</div>
      <div>AI Applications: <span style="color: ${isDark ? '#ff8a80' : '#e53e3e'}; font-weight: 600;">${appCount.toLocaleString()}</span></div>
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

    // Get container dimensions - use fixed size for sunburst regardless of container height
    const container = containerRef.current as HTMLElement | null;
    const containerRect = container?.getBoundingClientRect();
    const containerWidth = containerRect?.width || 1200;
    const containerHeight = containerRect?.height || 600;
    const width = Math.min(containerWidth - 40, 1200); // Leave margin
    // Use fixed height for sunburst sizing calculation to maintain consistent size
    const designHeight = 1200; // Fixed reference height for sunburst sizing
    const height = Math.min(designHeight - 40, 1200); // Use design height instead of container height
    const size = Math.min(width, height);
    const radius = (size / 4) * 0.9; // 10% smaller than previous size

    // Create the main SVG with proper sizing
    const svg_container = svg
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", `${-size / 2} ${-size / 2} ${size} ${size}`)
      .style("background", `radial-gradient(circle, ${isDark ? '#1a1a1a' : '#fafafa'} 0%, ${isDark ? '#0d1117' : '#f6f8fa'} 100%)`)
      .style("font", "10px sans-serif")
      .classed("sunburst-view", true);

    // Create main group (already centered by viewBox)
    const g = svg_container.append("g");

    // Add zoom behavior (simplified with viewBox centering)
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        // Save complete transform and update zoom level state
        sunburstTransformRef.current = event.transform;
        setSunburstZoomLevel(event.transform.k);
      });

    svg_container.call(zoomBehavior as any);
    sunburstZoomRef.current = zoomBehavior;

    // Restore previous zoom transform if it exists
    if (sunburstTransformRef.current && sunburstTransformRef.current.k !== 1) {
      svg_container.call(zoomBehavior.transform as any, sunburstTransformRef.current);
    }

    // Create hierarchy first (Observable pattern)
    const hierarchy = d3.hierarchy<TreeNode & { value: number }>(prepareSunburstData(data))
      .sum(d => d.value)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    // Create partition layout with almost no gap from center
    const root = d3.partition<TreeNode & { value: number }>()
      .size([2 * Math.PI, hierarchy.height + 0.05]) // Minimal gap of +0.05
      (hierarchy);

    // Set current state for each node (Observable pattern)
    root.each(d => (d as any).current = d);

    // Find max AI app count for color scaling (not the structural 'value')
    const maxAppCount = d3.max(root.descendants(), d => d.data.appCount) || 1;

    // Color scale matching the treemap implementation - white to red gradient
    const getArcColor = (appCount: number, depth: number): string => {
      // 0-1 apps handling - pure white
      if (appCount <= 1) {
        return "rgb(255, 255, 255)";
      }

      // For apps > 1, use logarithmic scaling starting from 2 (same as treemap)
      const minColorCount = 2; // Start coloring from 2 apps
      const logMax = Math.log(maxAppCount);
      const logCurrent = Math.log(appCount);
      const logMin = Math.log(minColorCount);

      // Normalize to 0-1 range using log scale
      const intensity = Math.max(0, (logCurrent - logMin) / (logMax - logMin));

      // Apply square root curve for smoother progression (same as treemap)
      const enhancedIntensity = Math.sqrt(intensity);

      // Normal: White to red (high app count = red, low app count = white)
      const r = 255; // Keep red channel at max
      const g = Math.floor(255 * (1 - enhancedIntensity * 0.85)); // Reduce green gradually
      const b = Math.floor(255 * (1 - enhancedIntensity * 0.85)); // Reduce blue gradually
      return `rgb(${r}, ${g}, ${b})`;
    };

    // Create arc generator using Observable pattern
    const arc = d3.arc<any>()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(radius * 1.5)
      .innerRadius(d => d.y0 * radius)
      .outerRadius(d => Math.max(d.y0 * radius, d.y1 * radius - 1));

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

    // Create paths using Observable pattern
    const path = g.selectAll("path")
      .data(root.descendants().slice(1)) // Skip root (Observable pattern)
      .join("path")
      .attr("fill", d => getArcColor(d.data.appCount || 0, d.depth))
      .attr("d", d => arc((d as any).current))
      .style("stroke", "rgba(255,255,255,0.3)")
      .style("stroke-width", "1px")
      .style("cursor", "default")
      .style("filter", "drop-shadow(0 1px 3px rgba(0,0,0,0.1))")
      .style("transition", "all 0.25s ease-out")
      .style("opacity", 0.95)
      .on("mouseover", function(event, d) {
        // Enhanced hover effect with better performance and enhanced borders
        const currentPath = d3.select(this);
        
        // Constant hover border color
        const hoverBorderColor = "rgba(255,255,255,0.8)";
        
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
        // Reset to constant original border styling
        d3.select(this)
          .style("stroke", "rgba(255,255,255,0.3)")
          .style("stroke-width", "1px")
          .style("filter", "drop-shadow(0 1px 3px rgba(0,0,0,0.1))")
          .style("opacity", 0.95);

        hideSunburstTooltip();
        clearHighlight();
      })


    // Show text on virtually all nodes - no restrictions
    const labelVisible = (d: any) => {
      // Show text on all nodes regardless of size or depth
      const visible = true;
      console.log(`Label visibility for "${d.data.name}": depth=${d.depth}, always visible=${visible}`);
      return visible;
    };

    const labelTransform = (d: any) => {
      const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
      const y = (d.y0 + d.y1) / 2 * radius;
      return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
    };

    // Function to split text with dashes for line breaks
    const splitTextWithDash = (text: string, maxLength: number, forceBreak = false) => {
      console.log(`Splitting text: "${text}" with maxLength: ${maxLength}, forceBreak: ${forceBreak}`); // Debug log

      const words = text.split(' ');

      // Force line break if text has more than 3 words
      const hasMoreThanThreeWords = words.length > 3;

      // Don't line break if total text length is less than 15 characters AND has 3 or fewer words AND not forced
      if (text.length < 15 && !hasMoreThanThreeWords && !forceBreak) return [text];

      // Allow much longer lines to utilize available segment width
      // When forceBreak is true, use a smaller max length to ensure breaking happens
      const spaceCount = (text.match(/ /g) || []).length;
      const effectiveMaxLength = forceBreak
        ? (spaceCount < 2
            ? Math.max(4, Math.min(maxLength, 13))  // <2 spaces: max 13 chars per line
            : Math.max(4, Math.min(maxLength, 20))) // ≥2 spaces: max 20 chars per line
        : Math.max(4, Math.min(maxLength, 25)); // Normal: max 25 chars per line

      // If forceBreak is true, skip the early return check to ensure breaking happens
      if (!forceBreak && text.length <= effectiveMaxLength && !hasMoreThanThreeWords) return [text];

      const lines: string[] = [];
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;

        if (testLine.length <= effectiveMaxLength) {
          currentLine = testLine;
        } else {
          if (currentLine) {
            lines.push(currentLine); // No dash - breaking at word boundary
            currentLine = word;
          } else {
            // Word is longer than maxLength, split it mid-word
            if (word.length > effectiveMaxLength) {
              lines.push(word.substring(0, effectiveMaxLength - 1) + '-'); // Add dash when splitting word
              currentLine = word.substring(effectiveMaxLength - 1);
            } else {
              currentLine = word;
            }
          }
        }
      }

      if (currentLine) {
        lines.push(currentLine);
      }

      console.log(`Result lines:`, lines); // Debug log
      return lines.slice(0, 5); // Limit to 5 lines max
    };

    const label = g.append("g")
      .attr("pointer-events", "none")
      .attr("text-anchor", "middle")
      .style("user-select", "none")
      .selectAll("g")
      .data(root.descendants().slice(1))
      .join("g")
      .attr("transform", d => labelTransform((d as any).current))
      .attr("opacity", d => +labelVisible((d as any).current))
      .each(function(d: any) {
        const textGroup = d3.select(this);

        // Calculate available space
        const arcLength = (d.x1 - d.x0) * ((d.y0 + d.y1) / 2 * radius);
        const radialSpace = (d.y1 - d.y0) * radius;

        console.log(`Segment "${d.data.name}": arcLength=${arcLength.toFixed(2)}, radialSpace=${radialSpace.toFixed(2)}`); // Debug log

        // Calculate depth-based font size - larger in center, smaller toward outer rings
        const baseFontSize = Math.max(26, radialSpace / 4); // Start with 26px base size (increased by 12px)
        const depthScaleFactor = Math.pow(0.85, d.depth); // Reduce by 15% for each depth level
        const depthAdjustedFontSize = baseFontSize * depthScaleFactor;
        const fontSize = Math.max(2, Math.min(26, depthAdjustedFontSize)); // Minimum 2px, maximum 26px (increased by 12px)
        const charWidth = fontSize * 0.35; // Increased character width for better line breaking (was 0.25)
        let maxCharsPerLine = Math.floor((arcLength * 1.1) / charWidth); // Reduced available width for better line breaking (was 1.4)

        // Special handling for first level (depth 1) - force smaller text width for better line breaks
        if (d.depth === 1) {
          maxCharsPerLine = Math.min(maxCharsPerLine, 12); // Limit first level to ~12 characters per line
          console.log(`First level node "${d.data.name}" - forcing maxCharsPerLine to ${maxCharsPerLine}`);
        }

        console.log(`fontSize=${fontSize}, charWidth=${charWidth}, maxCharsPerLine=${maxCharsPerLine}`); // Debug log

        // Log all nodes to see which ones are being processed
        if (d.data.name.toLowerCase().includes("transfer") || d.data.name.toLowerCase().includes("exchange")) {
          console.log(`🔍 FOUND "${d.data.name}" at depth ${d.depth} - checking if text will be rendered...`);
          console.log(`  maxCharsPerLine=${maxCharsPerLine}, radialSpace=${radialSpace}, fontSize=${fontSize}`);
        }

        // Almost no restrictions - show text on virtually every node
        if (maxCharsPerLine < 0.5 || radialSpace < 1 || fontSize < 1) {
          console.log(`Skipping text for "${d.data.name}" - truly too small (maxChars=${maxCharsPerLine}, radialSpace=${radialSpace}, fontSize=${fontSize})`);
          if (d.data.name.toLowerCase().includes("transfer") || d.data.name.toLowerCase().includes("exchange")) {
            console.log(`⚠️ SKIPPING "${d.data.name}" - too small to render text`);
          }
          return;
        }

        // More aggressive text fitting - utilize all available space
        let lines;
        const words = d.data.name.split(' ');
        const hasMoreThanThreeWords = words.length > 3;

        // Special condition for 2nd and 3rd level: force line break if >1 space AND >15 characters
        const isSecondOrThirdLevel = d.depth === 2 || d.depth === 3;
        const spaceCount = (d.data.name.match(/ /g) || []).length;
        const hasMoreThanOneSpace = spaceCount >= 1;
        const hasMoreThanFifteenChars = d.data.name.length > 15;
        const shouldForceBreakLevel23 = isSecondOrThirdLevel && hasMoreThanOneSpace && hasMoreThanFifteenChars;

        // Debug logging for ALL level 2 and 3 nodes
        if (isSecondOrThirdLevel) {
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`DEBUG LEVEL ${d.depth} NODE: "${d.data.name}"`);
          console.log(`  chars=${d.data.name.length}`);
          console.log(`  spaces=${spaceCount}`);
          console.log(`  words=${words.length}`);
          console.log(`  hasMoreThanOneSpace=${hasMoreThanOneSpace} (needs: spaceCount > 1, actual: ${spaceCount})`);
          console.log(`  hasMoreThanFifteenChars=${hasMoreThanFifteenChars} (needs: length > 15, actual: ${d.data.name.length})`);
          console.log(`  shouldForceBreak=${shouldForceBreakLevel23}`);
          console.log(`  maxCharsPerLine=${maxCharsPerLine}`);
          console.log(`  textFitsInOneLine=${d.data.name.length <= maxCharsPerLine}`);
          console.log(`  hasMoreThanThreeWords=${hasMoreThanThreeWords}`);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        }

        // Priority 1: Force break for level 2/3 with >1 space and >15 chars (ignore if text fits)
        if (shouldForceBreakLevel23) {
          console.log(`✓ PRIORITY 1: Force breaking "${d.data.name}" (level ${d.depth})`);
          lines = splitTextWithDash(d.data.name, maxCharsPerLine, true); // forceBreak = true
        } else if (d.data.name.length <= maxCharsPerLine && !hasMoreThanThreeWords) {
          // Priority 2: If the whole text fits AND has 3 or fewer words, don't break it at all
          console.log(`✓ PRIORITY 2: Keeping single line "${d.data.name}" (fits: ${d.data.name.length <= maxCharsPerLine}, words: ${words.length}, maxChars: ${maxCharsPerLine})`);
          lines = [d.data.name];
        } else {
          // Priority 3: Always try to break text to use all available space (either too long OR >3 words)
          console.log(`✓ PRIORITY 3: Standard breaking "${d.data.name}" (too long or >3 words, maxChars: ${maxCharsPerLine})`);
          lines = splitTextWithDash(d.data.name, maxCharsPerLine);

          // If we get no lines or very few characters, try more aggressive approaches
          if (lines.length === 0 || lines.join('').length < 3) {
            const firstWord = d.data.name.split(' ')[0];
            if (firstWord.length <= maxCharsPerLine && maxCharsPerLine >= 2) {
              // Show at least the first word
              lines = [firstWord];
            } else if (maxCharsPerLine >= 3) {
              // Show truncated with ellipsis
              lines = [d.data.name.substring(0, maxCharsPerLine - 1) + "…"];
            } else if (maxCharsPerLine >= 2) {
              // Show just first few characters
              lines = [d.data.name.substring(0, maxCharsPerLine)];
            }
          }
        }

        // Apply ellipsis logic for nodes with >2 lines and few children (except leaf nodes)
        const isLeafNode = !d.children || d.children.length === 0;
        const hasFewChildren = d.children && d.children.length < 10; // Consider <10 children as "few"

        // Calculate if this node gets a small segment (for leaf nodes)
        let hasSmallSegment = false;
        if (isLeafNode && d.parent) {
          const parentChildren = d.parent.children || [];
          const totalSiblings = parentChildren.length;

          // Case 1: Parent has many children (>10), so this leaf gets a small segment
          const tooManySiblings = totalSiblings > 10;

          // Case 2: Parent has only one child (this leaf), and parent gets truncated
          // In this case, parent and child share the same segment size, so if parent is truncated, child should be too
          const isOnlyChild = totalSiblings === 1;
          const parentWillBeTruncated = isOnlyChild && d.parent &&
                                       (!d.parent.children || d.parent.children.length < 10) &&
                                       lines.length > 2; // Parent would meet truncation criteria

          // Case 3: This leaf node is the only leaf among its siblings (other siblings are non-leaf)
          const leafSiblings = parentChildren.filter((sibling: { children: string | any[]; }) => !sibling.children || sibling.children.length === 0);
          const isOnlyLeafAmongSiblings = leafSiblings.length === 1 && totalSiblings > 1;

          hasSmallSegment = tooManySiblings || (isOnlyChild && parentWillBeTruncated) || isOnlyLeafAmongSiblings;

          const reason = tooManySiblings ? `${totalSiblings} siblings` :
                        (isOnlyChild && parentWillBeTruncated) ? 'only child of truncated parent' :
                        isOnlyLeafAmongSiblings ? 'only leaf among siblings' : 'none';
          console.log(`Leaf node "${d.data.name}" small segment: ${hasSmallSegment} (${reason})`);
        }

        // Apply ellipsis to non-leaf nodes with few children OR leaf nodes with small segments OR all leaf nodes with >15 characters OR nodes with only one child and >15 characters
        // BUT never apply ellipsis to first level nodes (depth 1) - they should only get line breaks
        const isFirstLevel = d.depth === 1;
        const leafNodeWithLongText = isLeafNode && d.data.name.length > 15 && !isFirstLevel;
        const singleChildNodeWithLongText = !isLeafNode && d.children && d.children.length === 1 && d.data.name.length > 15 && !isFirstLevel;
        const shouldApplyEllipsis = (!isLeafNode && hasFewChildren && lines.length > 2 && !isFirstLevel) ||
                                   (isLeafNode && hasSmallSegment && lines.length > 2 && !isFirstLevel) ||
                                   leafNodeWithLongText ||
                                   singleChildNodeWithLongText;

        if (shouldApplyEllipsis) {
          // For qualifying nodes with >2 lines, use ellipsis
          const firstLine = lines[0];
          const availableChars = maxCharsPerLine - 1; // Reserve space for ellipsis
          if (firstLine.length <= availableChars) {
            lines = [firstLine + "…"];
          } else {
            lines = [firstLine.substring(0, availableChars) + "…"];
          }
          const nodeType = isLeafNode ? "leaf" : "non-leaf";
          let reason: string;
          if (leafNodeWithLongText) {
            reason = `${d.data.name.length} characters (>15)`;
          } else if (singleChildNodeWithLongText) {
            reason = `single child + ${d.data.name.length} characters (>15)`;
          } else if (isLeafNode) {
            reason = `${d.parent?.children?.length || 0} siblings`;
          } else {
            reason = `${d.children?.length || 0} children`;
          }
          console.log(`Applied ellipsis to ${nodeType} "${d.data.name}" (${reason}): "${lines[0]}"`);
        }

        const lineHeight = fontSize * 1.1; // Tighter line spacing
        const totalHeight = lines.length * lineHeight;
        const startY = -(totalHeight / 2) + (lineHeight / 2);

        console.log(`"${d.data.name}" split into ${lines.length} lines:`, lines); // Debug log

        // If no lines were generated, force at least the first few characters
        if (lines.length === 0 && d.data.name.length > 0) {
          lines.push(d.data.name.substring(0, Math.min(8, d.data.name.length)));
          console.log(`Forced fallback text for "${d.data.name}": "${lines[0]}"`);
        }

        lines.forEach((line: string, i: number) => {
          textGroup.append("text")
            .attr("dy", startY + (i * lineHeight))
            .attr("x", 0)
            .style("font-size", fontSize + "px")
            .style("font-weight", d.depth === 1 ? "600" : "500")
            .style("fill", () => {
              // Calculate text color based on background
              const fillColor = getArcColor(d.data.appCount || 0, d.depth);
              const color = d3.color(fillColor);

              if (!color) return isDark ? "#ffffff" : "#000000";

              const luminance = color.displayable() ?
                0.299 * color.rgb().r + 0.587 * color.rgb().g + 0.114 * color.rgb().b : 128;

              // Use white text on dark backgrounds, dark text on light backgrounds
              if (luminance < 140) {
                return "#ffffff";
              } else {
                return "#000000";
              }
            })
            .style("text-shadow", "none")
            .text(line);
        });
      });

    // Beautiful center circle with enhanced styling - 50% of radius
    const centerRadius = Math.max(60, radius * 0.5);
    
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

    // Main center circle with clean gradient styling
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
    const titleFontSize = Math.min(32, centerRadius / 2.5); // Increased by 12px (was 20px)
    const subtitleFontSize = Math.min(28, centerRadius / 3.5); // Increased by 12px (was 16px)
    
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
      .text(`${(root.data.appCount || 0).toLocaleString()} AI apps`);



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

    const width = 12000; // Doubled again from 6000 to accommodate extreme horizontal spacing
    const height = 4000; // Keep height the same since we're mainly increasing horizontal gaps
    const margin = { top: 200, right: 800, bottom: 200, left: 800 }; // Much larger margins

    // Find max count for color scaling
    const maxCount = findMaxAppCount(data);

    // Create tree layout with increased vertical spacing
    const treemap = d3.tree<TreeNode>()
      .size([height - margin.top - margin.bottom, width - margin.left - margin.right])
      .nodeSize([400, 2500]); // [vertical, horizontal] - increased vertical spacing from 300 to 400
    
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

    // Create zoom behavior for tree view with limited zoom out
    const treeZoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10]) // Limited zoom out to 0.1 (10x minimum zoom)
      .on("zoom", function(event) {
        // Apply zoom transform - the margin offset is already applied to svg_g
        svg_g.attr("transform", event.transform);
        // Save complete transform and update zoom level state
        treeTransformRef.current = event.transform;
        setTreeZoomLevel(event.transform.k);

        // Update text size to scale inversely with zoom for constant readability
        const baseFontSize = 18;
        const baseBadgeFontSize = 16; // Increased to match the new badge font size
        const scaledFontSize = baseFontSize / event.transform.k;
        const scaledBadgeFontSize = baseBadgeFontSize / event.transform.k;

        // Update node label text to maintain constant apparent size
        svg_g.selectAll(".tree-node-text")
          .style("font-size", scaledFontSize + "px");

        // Update badge text to maintain constant apparent size
        svg_g.selectAll(".tree-badge-text")
          .style("font-size", scaledBadgeFontSize + "px");

        // Update edge stroke width to scale inversely with zoom for constant visibility
        const baseStrokeWidth = 2;
        const scaledStrokeWidth = baseStrokeWidth / event.transform.k;
        svg_g.selectAll(".link")
          .style("stroke-width", scaledStrokeWidth + "px");

        // Scale node circles inversely with zoom for constant visibility
        svg_g.selectAll(".tree-node-circle")
          .attr("r", function() {
            const baseRadius = parseFloat(d3.select(this).attr("data-base-radius") || "10");
            return baseRadius / event.transform.k;
          })
          .style("stroke-width", (2 / event.transform.k) + "px");

        // Hide badges (rectangles and text) when zoomed out below 0.3
        const showBadges = event.transform.k >= 0.3;
        svg_g.selectAll(".tree-badge-rect")
          .style("opacity", showBadges ? 1 : 0);
        svg_g.selectAll(".tree-badge-text")
          .style("opacity", showBadges ? 1 : 0);
      });

    const svg_g = svg_container
      .call(treeZoomBehavior as any)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Store the zoom behavior reference for tree view
    treeZoomRef.current = treeZoomBehavior;

    // Restore previous zoom transform if it exists - do this BEFORE adding nodes/text
    const shouldRestoreTransform = treeTransformRef.current && treeTransformRef.current.k !== 1;
    if (shouldRestoreTransform) {
      svg_container.call(treeZoomBehavior.transform as any, treeTransformRef.current);
    }

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

    // Add circles with frequency-based colors - allow smaller circles
    node.append("circle")
      .attr("r", d => Math.max(4, Math.min(25, Math.sqrt(d.data.appCount || 0) * 0.8)))
      .attr("data-base-radius", d => Math.max(4, Math.min(25, Math.sqrt(d.data.appCount || 0) * 0.8)))
      .style("fill", d => getNodeColor(d.data.appCount || 0, maxCount, isDark))
      .style("stroke", d => d.data.appCount > 0 ? "#333" : "#999")
      .style("stroke-width", "2px")
      .classed("tree-node-circle", true)
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
      .style("font-size", "18px")
      .style("font-weight", "600")
      .style("font-family", '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif')
      .classed("tree-node-text", true)
      .text(d => d.data.name)
      .each(function(d) {
        // Wrap long text to fit within node spacing to prevent overlap
        const text = d3.select(this);
        const words = d.data.name.split(/\s+/).reverse();
        let word: string | undefined;
        let line: string[] = [];
        let lineNumber = 0;
        const lineHeight = 1.3; // Increased line height for larger text

        // Check if text has more than 3 spaces (4+ words) AND more than 18 characters
        const spaceCount = (d.data.name.match(/ /g) || []).length;
        const charCount = d.data.name.length;
        const forceLineBreak = spaceCount > 3 && charCount > 18;

        // Reduced maxWidth to account for zoom-independent text scaling and prevent overlap
        // If forcing line break, use smaller maxWidth to wrap more aggressively
        const maxWidth = forceLineBreak ? 250 : 400;

        const y = text.attr("y");
        const dy = parseFloat(text.attr("dy"));
        let tspan = text.text(null).append("tspan")
          .attr("x", d.children ? -50 : 50)
          .attr("y", y).attr("dy", dy + "em");

        while (word = words.pop()) {
          line.push(word);
          tspan.text(line.join(" "));
          if ((tspan.node()?.getComputedTextLength() || 0) > maxWidth) {
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

    // Add app count badges with dynamic positioning based on zoom level
    // Calculate badge distance based on inverse of zoom (closer when zoomed in, farther when zoomed out)
    const baseBadgeDistance = 50; // Base distance when at 1x zoom
    const maxBadgeDistance = 130; // Maximum distance when zoomed out
    const badgeDistance = Math.min(maxBadgeDistance, baseBadgeDistance + (baseBadgeDistance / (treeZoomLevel || 1)));

    node.filter(d => d.data.appCount > 0)
      .append("rect")
      .attr("x", d => -Math.max(60, d.data.appCount.toString().length * 14) / 2) // Center horizontally
      .attr("y", badgeDistance) // Dynamic position based on zoom level
      .attr("width", d => Math.max(60, d.data.appCount.toString().length * 14))
      .attr("height", 28) // Slightly taller for larger text
      .attr("rx", 14)
      .style("fill", "#ff9800")
      .style("stroke", "#fff")
      .style("stroke-width", "1.5px")
      .classed("tree-badge-rect", true);

    node.filter(d => d.data.appCount > 0)
      .append("text")
      .attr("x", 0) // Center horizontally at node position
      .attr("y", badgeDistance + 14) // Position in center of badge (distance + 28/2)
      .attr("dy", ".35em")
      .style("text-anchor", "middle")
      .style("fill", "white")
      .style("font-size", "16px") // Increased from 14px to match larger text theme
      .style("font-weight", "bold")
      .style("font-family", '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif')
      .classed("tree-badge-text", true)
      .text(d => d.data.appCount.toLocaleString());

    // Auto-focus functionality disabled for now (keeping prop for future use)
    // if (focusNodeId && viewType === 'tree') {
    //   // Focus node logic would go here
    // }

    // Apply the scaling manually if we restored a transform (since .call doesn't trigger the zoom event)
    if (shouldRestoreTransform) {
      const transform = treeTransformRef.current;
      const baseFontSize = 18;
      const baseBadgeFontSize = 16;
      const scaledFontSize = baseFontSize / transform.k;
      const scaledBadgeFontSize = baseBadgeFontSize / transform.k;
      const baseStrokeWidth = 2;
      const scaledStrokeWidth = baseStrokeWidth / transform.k;

      svg_g.selectAll(".tree-node-text").style("font-size", scaledFontSize + "px");
      svg_g.selectAll(".tree-badge-text").style("font-size", scaledBadgeFontSize + "px");
      svg_g.selectAll(".link").style("stroke-width", scaledStrokeWidth + "px");
      svg_g.selectAll(".tree-node-circle")
        .attr("r", function() {
          const baseRadius = parseFloat(d3.select(this).attr("data-base-radius") || "10");
          return baseRadius / transform.k;
        })
        .style("stroke-width", (2 / transform.k) + "px");

      const showBadges = transform.k >= 0.3;
      svg_g.selectAll(".tree-badge-rect").style("opacity", showBadges ? 1 : 0);
      svg_g.selectAll(".tree-badge-text").style("opacity", showBadges ? 1 : 0);
    }
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

      // Don't reset zoom levels - preserve them when switching views

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
  }, [data, isDark, viewType, focusNodeId]); // viewType causes re-render on switch

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
            DAG View
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
            onClick={() => {
              const currentZoomRef = viewType === 'sunburst' ? sunburstZoomRef : treeZoomRef;
              const currentZoomLevel = viewType === 'sunburst' ? sunburstZoomLevel : treeZoomLevel;
              if (currentZoomRef.current && svgRef.current) {
                const svg = d3.select(svgRef.current);
                const container = containerRef.current as HTMLElement | null;
                if (!container) return;

                const maxZoom = viewType === 'sunburst' ? 3 : 10;
                // Use smaller increment for tree view for smoother zooming
                const increment = viewType === 'tree' ? 0.05 : 0.2;
                const newScale = Math.min(currentZoomLevel + increment, maxZoom);

                // Calculate viewport center point for zooming
                const containerRect = container.getBoundingClientRect();
                const centerX = containerRect.width / 2;
                const centerY = containerRect.height / 2;

                const transition = svg.transition().duration(300);
                // Zoom towards the center of the viewport
                currentZoomRef.current.scaleTo(transition as any, newScale, [centerX, centerY]);
              }
            }}
            sx={{ bgcolor: 'action.hover' }}
          >
            <ZoomIn />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => {
              const currentZoomRef = viewType === 'sunburst' ? sunburstZoomRef : treeZoomRef;
              const currentZoomLevel = viewType === 'sunburst' ? sunburstZoomLevel : treeZoomLevel;
              if (currentZoomRef.current && svgRef.current) {
                const svg = d3.select(svgRef.current);
                const container = containerRef.current as HTMLElement | null;
                if (!container) return;

                const minZoom = viewType === 'sunburst' ? 0.5 : 0.1; // Limited tree view zoom out
                // Use smaller increment for tree view for smoother zooming
                const increment = viewType === 'tree' ? 0.05 : 0.2;
                const newScale = Math.max(currentZoomLevel - increment, minZoom);

                // Calculate viewport center point for zooming
                const containerRect = container.getBoundingClientRect();
                const centerX = containerRect.width / 2;
                const centerY = containerRect.height / 2;

                const transition = svg.transition().duration(300);
                // Zoom towards the center of the viewport
                currentZoomRef.current.scaleTo(transition as any, newScale, [centerX, centerY]);
              }
            }}
            sx={{ bgcolor: 'action.hover' }}
          >
            <ZoomOut />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => {
              const currentZoomRef = viewType === 'sunburst' ? sunburstZoomRef : treeZoomRef;
              if (currentZoomRef.current && svgRef.current) {
                const svg = d3.select(svgRef.current);
                const transition = svg.transition().duration(500);

                if (viewType === 'tree') {
                  // For tree view, zoom to minimum scale and center the content
                  const targetScale = 0.1;
                  const container = containerRef.current as HTMLElement | null;
                  const containerWidth = container?.clientWidth || 600;
                  const containerHeight = container?.clientHeight || 600;

                  // Calculate the center of the tree (approximate center based on tree dimensions)
                  const treeCenterX = 6000; // Approximate horizontal center of the tree layout
                  const treeCenterY = 2000; // Approximate vertical center of the tree layout

                  // Calculate translate to center the tree in the viewport
                  const translateX = containerWidth / 2 - treeCenterX * targetScale;
                  const translateY = containerHeight / 2 - treeCenterY * targetScale;

                  currentZoomRef.current.transform(
                    transition as any,
                    d3.zoomIdentity.translate(translateX, translateY).scale(targetScale)
                  );
                } else {
                  // For sunburst, reset to identity
                  currentZoomRef.current.transform(transition as any, d3.zoomIdentity);
                }
              }
            }}
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
          height: 600, // Same height for both views
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
