import { TreemapNode } from './treemapLogic';

export interface TextRenderingOptions {
  padding: number;
  lineHeight: number;
  minNodeWidth: number;
  minNodeHeight: number;
}

// Helper function to break text into lines that fit the width
export const breakTextIntoLines = (
  text: string,
  maxWidth: number,
  ctx: CanvasRenderingContext2D
): string[] => {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = ctx.measureText(testLine).width;

    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        // Word is too long, just add it anyway
        lines.push(word);
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
};

// Create text content for a node
export const createNodeTextContent = (node: TreemapNode): {
  baseName: string;
  appCountText: string;
  combinedText: string;
} => {
  const baseName = node.name;
  const appCountText = `${node.appCount} apps`;
  const combinedText = `${baseName} - ${appCountText}`;

  return { baseName, appCountText, combinedText };
};

// Calculate the best text to display for a node given space constraints
export const calculateOptimalTextLines = (
  node: TreemapNode,
  ctx: CanvasRenderingContext2D,
  options: TextRenderingOptions
): string[] => {
  const { baseName, combinedText } = createNodeTextContent(node);

  // Calculate available space for text
  const availableWidth = node.width - 2 * options.padding;
  const availableHeight = node.height - 2 * options.padding;

  // Try different text options and break into lines
  let textLines: string[] = [];

  // First try combined text
  const combinedMetrics = ctx.measureText(combinedText);
  if (combinedMetrics.width <= availableWidth) {
    textLines = [combinedText];
  } else {
    // Try breaking combined text into lines
    const brokenCombined = breakTextIntoLines(combinedText, availableWidth, ctx);
    if (brokenCombined.length * options.lineHeight <= availableHeight) {
      textLines = brokenCombined;
    } else {
      // Try just the name, broken into lines if needed
      const brokenName = breakTextIntoLines(baseName, availableWidth, ctx);
      if (brokenName.length * options.lineHeight <= availableHeight) {
        textLines = brokenName;
      }
    }
  }

  return textLines;
};

// Determine if white text should be used based on background intensity
export const shouldUseWhiteText = (appCount: number, maxCount: number): boolean => {
  const textIntensity = appCount / maxCount;
  return textIntensity > 0.4; // Use white text on darker red backgrounds
};

// Setup canvas context for rendering
export const setupCanvasContext = (
  canvas: HTMLCanvasElement,
  isDark: boolean
): CanvasRenderingContext2D | null => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Set canvas size
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  // Clear canvas
  ctx.fillStyle = isDark ? "#121212" : "#fafafa";
  ctx.fillRect(0, 0, rect.width, rect.height);

  return ctx;
};

// Apply zoom and pan transformations to canvas context
export const applyCanvasTransform = (
  ctx: CanvasRenderingContext2D,
  panX: number,
  panY: number,
  zoom: number
): void => {
  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);
};

// Draw a single treemap node
export const drawTreemapNode = (
  ctx: CanvasRenderingContext2D,
  node: TreemapNode,
  isHovered: boolean,
  zoom: number,
  maxCount: number,
  options: TextRenderingOptions
): void => {
  const appCount = node.appCount || 1; // Fallback to 1 if undefined

  // Draw background
  ctx.fillStyle = node.color;
  ctx.fillRect(node.x, node.y, node.width, node.height);

  // Draw border - yellow on hover, gray otherwise
  ctx.strokeStyle = isHovered ? "#FFD700" : "#ccc";
  ctx.lineWidth = isHovered ? 3 / zoom : 1 / zoom;
  ctx.strokeRect(node.x, node.y, node.width, node.height);

  // Skip text rendering if node is too small
  if (node.width <= options.minNodeWidth || node.height <= options.minNodeHeight) {
    return;
  }

  // Draw text - improved for D3 treemap with parent node handling
  const baseFontSize = node.fontSize;
  const scaledFontSize = Math.max(8, baseFontSize / zoom);

  ctx.font = `${scaledFontSize}px Inter, sans-serif`;

  // Determine text color based on background intensity
  const useWhiteText = shouldUseWhiteText(appCount, maxCount);
  ctx.fillStyle = useWhiteText ? "#ffffff" : "#000000";
  ctx.textAlign = "left";
  ctx.textBaseline = "top"; // This means Y position is the TOP of the text

  // Calculate optimal text lines
  const textLines = calculateOptimalTextLines(node, ctx, {
    ...options,
    lineHeight: scaledFontSize + 2
  });

  // Render multi-line text if we have lines to show
  if (textLines.length > 0) {
    ctx.save();

    // Clip to node boundaries
    ctx.beginPath();
    ctx.rect(node.x, node.y, node.width, node.height);
    ctx.clip();

    // Add text shadow for better readability
    if (useWhiteText) {
      ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
    }

    // Render each line - with textBaseline="top", Y is the top of the text
    textLines.forEach((line, index) => {
      const lineY = node.y + 2 + (index * (scaledFontSize + 2));

      // Only render if the line fits within the node height (text top + font size + bottom padding)
      if (lineY + scaledFontSize <= node.y + node.height - 6) {
        ctx.fillText(line, node.x + 2, lineY);
      }
    });

    ctx.restore();
  }
};

// Main rendering function for the entire treemap
export const renderTreemap = (
  canvas: HTMLCanvasElement,
  nodes: TreemapNode[],
  hoveredNodeId: string | null,
  zoom: number,
  panX: number,
  panY: number,
  isDark: boolean,
  maxCount: number
): void => {
  const ctx = setupCanvasContext(canvas, isDark);
  if (!ctx) return;

  // Apply zoom and pan transformations
  applyCanvasTransform(ctx, panX, panY, zoom);

  const renderingOptions: TextRenderingOptions = {
    padding: Math.max(2, 5 / zoom),
    lineHeight: 0, // Will be calculated per node
    minNodeWidth: 20,
    minNodeHeight: 16
  };

  // Draw all visible nodes
  nodes.forEach(node => {
    const isHovered = hoveredNodeId === node.id;
    drawTreemapNode(ctx, node, isHovered, zoom, maxCount, renderingOptions);
  });

  ctx.restore();
};