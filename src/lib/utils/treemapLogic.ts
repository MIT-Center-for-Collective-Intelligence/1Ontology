import { hierarchy, treemap, treemapBinary } from "d3-hierarchy";

export interface TreeNode {
  id: string;
  name: string;
  appCount: number;
  children?: TreeNode[];
  parent?: TreeNode;
  level?: number;
}

export interface TreemapNode extends TreeNode {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  fontSize: number;
  value?: number;
  depth?: number;
}

export interface ViewState {
  zoom: number;
  panX: number;
  panY: number;
}

export interface TreemapBounds {
  width: number;
  height: number;
}

export interface TooltipData {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  appCount: number;
}

// Process tree data to add levels and parent references
export const processTreeData = (node: TreeNode, parent?: TreeNode, level = 0): TreeNode => {
  const processed = {
    ...node,
    parent,
    level,
    children: node.children?.map(child => processTreeData(child, node, level + 1))
  };
  return processed;
};

// Color scale from white (0-1 apps) to pleasant red (max apps) - identical in both modes
export const getColor = (appCount: number, maxCount: number): string => {
  // 0-1 apps should always be white regardless of theme
  if (appCount <= 1) {
    return "rgb(255, 255, 255)"; // Pure white in both modes
  }

  // For apps > 1, use logarithmic scaling starting from 2
  const minColorCount = 2; // Start coloring from 2 apps
  const logMax = Math.log(maxCount);
  const logCurrent = Math.log(appCount);
  const logMin = Math.log(minColorCount);

  // Normalize to 0-1 range using log scale
  const intensity = Math.max(0, (logCurrent - logMin) / (logMax - logMin));

  // Apply square root curve for smoother progression
  const enhancedIntensity = Math.sqrt(intensity);

  // Same white to red progression in both light and dark modes
  const r = 255; // Keep red channel at max
  const g = Math.floor(255 * (1 - enhancedIntensity * 0.85)); // Reduce green gradually
  const b = Math.floor(255 * (1 - enhancedIntensity * 0.85)); // Reduce blue gradually
  return `rgb(${r}, ${g}, ${b})`;
};

// Calculate font size based on depth (independent of zoom)
export const getFontSize = (depth: number): number => {
  const baseSizes = [28, 20, 16, 12, 10, 8]; // Reduced font sizes for each depth level
  const baseSize = baseSizes[Math.min(depth, baseSizes.length - 1)] || 8;
  return baseSize;
};

// Count total leaf descendants with moderate scaling
export const countDescendants = (node: TreeNode, totalTreeLeaves?: number): number => {
  if (!node.children || node.children.length === 0) {
    // Leaf nodes: multiply base value by total leaf count in tree
    return totalTreeLeaves || 1;
  }

  // For parent nodes, count all leaf descendants
  const totalLeaves = node.children.reduce((sum, child) => sum + countDescendants(child), 0);
  if (node.name === 'Send information') {
    console.log(`Node ${node.name} has totalLeaves of ${totalLeaves}`);
  }
  return totalLeaves;
  // Apply moderate scaling to prevent huge differences, then multiply by total tree leaves
  // const scaledValue = Math.sqrt(totalLeaves) + 1;
  // return scaledValue * (totalTreeLeaves || 1);
};

// Helper function to count total leaves in entire tree
export const countTotalLeaves = (node: TreeNode): number => {
  if (!node.children || node.children.length === 0) {
    return 1;
  }
  return node.children.reduce((sum, child) => sum + countTotalLeaves(child), 0);
};

// Find maximum app count for color scaling
export const findMaxAppCount = (node: TreeNode): number => {
  let max = node.appCount;
  if (node.children) {
    for (const child of node.children) {
      max = Math.max(max, findMaxAppCount(child));
    }
  }
  return max;
};

// D3 Treemap layout with reserved space for parent labels
export const layoutTreemap = (
  rootNode: TreeNode,
  width: number,
  height: number,
  maxCount: number
): TreemapNode[] => {
  // Calculate total leaves in the entire tree
  const totalTreeLeaves = countTotalLeaves(rootNode);

  // Create D3 hierarchy
  const root = hierarchy(rootNode)
    .sum(d => countDescendants(d, totalTreeLeaves)) // Use descendant count multiplied by total tree leaves
    .sort((a, b) => (b.value || 0) - (a.value || 0));

  // Create treemap layout optimized for tight packing
  const treemapLayout = treemap<TreeNode>()
    .size([width, height])
    .paddingInner(2) // Reduced padding between siblings
    .paddingOuter(2) // Reduced padding around the outside
    .paddingTop((d: any) => {
      // Reserve more space for parent node titles and gap
      if (d.children && d.children.length > 0) {
        const titleHeight = Math.max(30, 40 - d.depth * 5);
        return titleHeight;
      }
      return 0;
    })
    .tile(treemapBinary) // Use binary tiling for maximum space efficiency
    .round(true);

  // Apply layout
  treemapLayout(root);

  // Debug: check the hierarchy structure
  console.log('D3 Root:', root);
  console.log('Root children count:', root.children?.length || 0);

  // Debug Express Live children specifically
  root.each((node) => {
    if (node.data.name === "Express Live" && node.children) {
      console.log("=== EXPRESS LIVE CHILDREN D3 VALUES ===");
      node.children.forEach((child: any) => {
        const area = (child.x1 - child.x0) * (child.y1 - child.y0);
        console.log(`${child.data.name}: D3 value=${child.value}, area=${area.toFixed(2)}, size=${(child.x1 - child.x0).toFixed(1)}x${(child.y1 - child.y0).toFixed(1)}`);
      });
    }
  });

  // Convert D3 nodes to our TreemapNode format
  const result: TreemapNode[] = [];

  function traverse(node: any): void {
    const hasChildren = node.children && node.children.length > 0;

    const treemapNode: TreemapNode = {
      ...node.data,
      x: node.x0,
      y: node.y0,
      width: node.x1 - node.x0,
      height: node.y1 - node.y0,
      color: getColor(node.data.appCount, maxCount),
      fontSize: getFontSize(node.depth),
      value: node.value,
      depth: node.depth,
      level: node.depth,
      children: hasChildren ? node.data.children : undefined
    };

    result.push(treemapNode);

    // Traverse children
    if (node.children) {
      node.children.forEach((child: any) => traverse(child));
    }
  }

  traverse(root);
  return result;
};

// Filter out tiny rectangles that appear as lines
export const filterVisibleNodes = (nodes: TreemapNode[], minSize: number = 3): TreemapNode[] => {
  return nodes.filter(node => {
    return node.width >= minSize && node.height >= minSize;
  });
};

// Constrain zoom and pan within bounds
export const constrainView = (
  newZoom: number,
  newPanX: number,
  newPanY: number,
  containerWidth: number,
  containerHeight: number,
  treemapBounds: TreemapBounds
): ViewState => {
  // Safeguard against invalid dimensions
  if (containerWidth <= 0 || containerHeight <= 0 || !treemapBounds.width || !treemapBounds.height) {
    return { zoom: 1, panX: 0, panY: 0 };
  }

  // Minimum zoom: treemap should not be smaller than container
  const minZoom = Math.max(
    containerWidth / treemapBounds.width,
    containerHeight / treemapBounds.height,
    0.3 // Absolute minimum
  );

  // Maximum zoom: prevent extreme zooming that causes overflow
  // Cap at 24x (2400%)
  const maxZoom = 24;

  // Constrain zoom with better bounds
  const constrainedZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));

  // Calculate treemap dimensions at this zoom
  const scaledWidth = treemapBounds.width * constrainedZoom;
  const scaledHeight = treemapBounds.height * constrainedZoom;

  // Safeguard against infinite or NaN values, and also against extremely large values
  if (!isFinite(scaledWidth) || !isFinite(scaledHeight) ||
      scaledWidth <= 0 || scaledHeight <= 0 ||
      scaledWidth > 50000 || scaledHeight > 50000) {
    return { zoom: 1, panX: 0, panY: 0 };
  }

  // Center the treemap if it's smaller than container
  let constrainedPanX = newPanX;
  let constrainedPanY = newPanY;

  if (scaledWidth <= containerWidth) {
    constrainedPanX = (containerWidth - scaledWidth) / 2;
  } else {
    // Constrain panning to keep treemap within bounds
    const maxPanX = 0;
    const minPanX = containerWidth - scaledWidth;
    // Add extra safeguards for extreme values
    const safePanX = isFinite(newPanX) ? newPanX : 0;
    constrainedPanX = Math.max(minPanX, Math.min(maxPanX, safePanX));

    // Additional bounds check for extreme values
    if (Math.abs(constrainedPanX) > scaledWidth * 2) {
      constrainedPanX = minPanX;
    }
  }

  if (scaledHeight <= containerHeight) {
    constrainedPanY = (containerHeight - scaledHeight) / 2;
  } else {
    // Constrain panning to keep treemap within bounds
    const maxPanY = 0;
    const minPanY = containerHeight - scaledHeight;
    // Add extra safeguards for extreme values
    const safePanY = isFinite(newPanY) ? newPanY : 0;
    constrainedPanY = Math.max(minPanY, Math.min(maxPanY, safePanY));

    // Additional bounds check for extreme values
    if (Math.abs(constrainedPanY) > scaledHeight * 2) {
      constrainedPanY = minPanY;
    }
  }

  // Final safeguard against NaN or infinite values
  const finalZoom = isFinite(constrainedZoom) ? constrainedZoom : 1;
  const finalPanX = isFinite(constrainedPanX) ? constrainedPanX : 0;
  const finalPanY = isFinite(constrainedPanY) ? constrainedPanY : 0;

  return {
    zoom: finalZoom,
    panX: finalPanX,
    panY: finalPanY
  };
};

// Calculate zoom to fit treemap in container
export const calculateFitView = (
  containerWidth: number,
  containerHeight: number,
  treemapBounds: TreemapBounds
): ViewState => {
  if (!treemapBounds.width || !treemapBounds.height) {
    return { zoom: 1, panX: 0, panY: 0 };
  }

  // Calculate zoom to fit treemap in container
  const fitZoom = Math.min(
    containerWidth / treemapBounds.width,
    containerHeight / treemapBounds.height,
    1 // Don't zoom in more than 100% initially
  );

  // Center the treemap in the container
  const scaledWidth = treemapBounds.width * fitZoom;
  const scaledHeight = treemapBounds.height * fitZoom;
  const centerX = (containerWidth - scaledWidth) / 2;
  const centerY = (containerHeight - scaledHeight) / 2;

  return constrainView(fitZoom, centerX, centerY, containerWidth, containerHeight, treemapBounds);
};

// Calculate new zoom and pan for center-based zooming
export const calculateCenterZoom = (
  currentZoom: number,
  currentPanX: number,
  currentPanY: number,
  zoomFactor: number,
  centerX: number,
  centerY: number,
  containerWidth: number,
  containerHeight: number,
  treemapBounds: TreemapBounds
): ViewState => {
  const newZoom = currentZoom * zoomFactor;

  // Safeguard against invalid zoom values
  if (!isFinite(newZoom) || newZoom <= 0) {
    return { zoom: currentZoom, panX: currentPanX, panY: currentPanY };
  }

  // Calculate new pan to keep center point stable
  const treemapCenterX = (centerX - currentPanX) / currentZoom;
  const treemapCenterY = (centerY - currentPanY) / currentZoom;
  const newPanX = centerX - treemapCenterX * newZoom;
  const newPanY = centerY - treemapCenterY * newZoom;

  // Safeguard against invalid pan values
  if (!isFinite(newPanX) || !isFinite(newPanY)) {
    return constrainView(newZoom, currentPanX, currentPanY, containerWidth, containerHeight, treemapBounds);
  }

  // Apply constraints to keep within bounds
  return constrainView(newZoom, newPanX, newPanY, containerWidth, containerHeight, treemapBounds);
};

// Find which node is under the mouse coordinates
export const findHoveredNode = (
  mouseX: number,
  mouseY: number,
  panX: number,
  panY: number,
  zoom: number,
  nodes: TreemapNode[]
): TreemapNode | null => {
  // Convert mouse coordinates to treemap coordinates
  const treemapX = (mouseX - panX) / zoom;
  const treemapY = (mouseY - panY) / zoom;

  // Find which node is under the mouse - prioritize the smallest/deepest node
  let hoveredNode = null;
  let smallestArea = Infinity;

  for (const node of nodes) {
    if (treemapX >= node.x && treemapX <= node.x + node.width &&
        treemapY >= node.y && treemapY <= node.y + node.height) {
      const area = node.width * node.height;
      // Choose the node with the smallest area (most specific/deepest)
      if (area < smallestArea) {
        smallestArea = area;
        hoveredNode = node;
      }
    }
  }

  return hoveredNode;
};

// Convert block coordinates to screen coordinates for tooltip positioning
export const calculateTooltipData = (
  hoveredNode: TreemapNode,
  zoom: number,
  panX: number,
  panY: number
): TooltipData => {
  const blockScreenX = hoveredNode.x * zoom + panX;
  const blockScreenY = hoveredNode.y * zoom + panY;
  const blockScreenWidth = hoveredNode.width * zoom;
  const blockScreenHeight = hoveredNode.height * zoom;

  return {
    x: blockScreenX,
    y: blockScreenY,
    width: blockScreenWidth,
    height: blockScreenHeight,
    name: hoveredNode.name,
    appCount: hoveredNode.appCount
  };
};

// Calculate tooltip position to avoid going outside container
export const calculateTooltipPosition = (
  tooltipData: TooltipData,
  containerWidth: number,
  containerHeight: number,
  tooltipWidth: number = 250,
  spacing: number = 10
): { left: number; top: number } => {
  // Try to position to the right first
  let tooltipLeft = tooltipData.x + tooltipData.width + spacing;
  let tooltipTop = tooltipData.y;

  // If tooltip would go outside container on the right, position it to the left
  if (tooltipLeft + tooltipWidth > containerWidth) {
    tooltipLeft = tooltipData.x - tooltipData.width - spacing;
  }

  // If tooltip would go outside container on the left, position it inside the block
  if (tooltipLeft < 0) {
    tooltipLeft = Math.max(10, tooltipData.x + 10);
  }

  // Ensure tooltip doesn't go below container
  if (tooltipTop + 80 > containerHeight) {
    tooltipTop = containerHeight - 90;
  }

  // Ensure tooltip doesn't go above container
  tooltipTop = Math.max(10, tooltipTop);

  return { left: tooltipLeft, top: tooltipTop };
};