// Helper function to filter tree based on target node occurrences
// If target node has more than 10 siblings, show only window around target with ellipses

import { TreeData } from "@components/types/INode";

// Also filters ancestors in paths to target node
export const filterTreeForTargetNode = (tree: TreeData[], targetNodeId: string): TreeData[] => {
  const SIBLING_THRESHOLD = 10; // Number of siblings
  const WINDOW_SIZE = 5; // Show 5 nodes on each side of target

  // First, find all paths to the target node
  const pathsToTarget: string[][] = [];

  const findPaths = (node: TreeData, currentPath: string[]): void => {
    const newPath = [...currentPath, node.nodeId];

    if (node.nodeId === targetNodeId) {
      pathsToTarget.push(newPath);
      return;
    }

    if (node.children) {
      for (const child of node.children) {
        findPaths(child, newPath);
      }
    }
  };

  // Find all paths from roots
  for (const rootNode of tree) {
    findPaths(rootNode, []);
  }

  // Create a set of all node IDs that are in any path to target
  const nodesInPathToTarget = new Set<string>();
  for (const path of pathsToTarget) {
    for (const nodeId of path) {
      nodesInPathToTarget.add(nodeId);
    }
  }

  const filterChildren = (children: TreeData[], parentPath: string): TreeData[] => {
    // Find ALL children that are in the path to target
    const childrenInPathIndices: number[] = [];
    children.forEach((child, index) => {
      if (nodesInPathToTarget.has(child.nodeId)) {
        childrenInPathIndices.push(index);
      }
    });

    if (childrenInPathIndices.length === 0) {
      // No child in this group is in path to target, no filtering needed
      // Just recurse into children
      return children.map(child => ({
        ...child,
        children: child.children ? filterChildren(child.children, child.id) : child.children
      }));
    }

    // Adjust threshold based on number of occurrences at this level
    const occurrenceCount = childrenInPathIndices.length;
    let adjustedThreshold = SIBLING_THRESHOLD;

    if (occurrenceCount > SIBLING_THRESHOLD) {
      // If too many occurrences -> increase threshold to show them all
      adjustedThreshold = SIBLING_THRESHOLD + occurrenceCount;
    }

    // Check if filtering is needed
    if (children.length <= adjustedThreshold) {
      // Not enough siblings to filter -> just recurse
      return children.map(child => ({
        ...child,
        children: child.children ? filterChildren(child.children, child.id) : child.children
      }));
    }

    // Group indices into clusters (target positions that are close to each other)
    const CLUSTER_DISTANCE = WINDOW_SIZE * 2; // If within 10 positions, group together
    const clusters: number[][] = [];

    const sortedIndices = [...childrenInPathIndices].sort((a, b) => a - b);
    let currentCluster: number[] = [sortedIndices[0]];

    for (let i = 1; i < sortedIndices.length; i++) {
      const prevIndex = sortedIndices[i - 1];
      const currIndex = sortedIndices[i];

      if (currIndex - prevIndex <= CLUSTER_DISTANCE) {
        // Close enough - add to current cluster
        currentCluster.push(currIndex);
      } else {
        // Too far - start new cluster
        clusters.push(currentCluster);
        currentCluster = [currIndex];
      }
    }
    clusters.push(currentCluster); // Add last cluster


    // Create windows for each cluster
    const windows: { start: number; end: number }[] = [];
    for (const cluster of clusters) {
      const clusterMin = Math.min(...cluster);
      const clusterMax = Math.max(...cluster);

      const windowStart = Math.max(0, clusterMin - WINDOW_SIZE);
      const windowEnd = Math.min(children.length - 1, clusterMax + WINDOW_SIZE);

      windows.push({ start: windowStart, end: windowEnd });
    }

    // Check if windows would show too much
    // If they are more than 80% of total, just show them all to avoid confusion
    const totalNodesToShow = windows.reduce((sum, w) => sum + (w.end - w.start + 1), 0);
    if (totalNodesToShow > children.length * 0.8) {
      return children.map(child => ({
        ...child,
        children: child.children ? filterChildren(child.children, child.id) : child.children
      }));
    }

    // Build filtered children with windows and ellipses
    const filteredChildren: TreeData[] = [];
    let lastEndIndex = -1;

    for (let windowIdx = 0; windowIdx < windows.length; windowIdx++) {
      const window = windows[windowIdx];

      // Add ellipsis before this window if there's a gap
      if (window.start > lastEndIndex + 1) {
        const gapSize = window.start - lastEndIndex - 1;
        filteredChildren.push({
          id: `${parentPath}-ellipsis-${windowIdx}`,
          nodeId: `${parentPath}-ellipsis-${windowIdx}`,
          name: `... ${gapSize} more`,
          nodeType: "load-more",
          isLoadMore: true,
          category: false,
          hiddenNodesCount: gapSize,
          allChildren: children,
          visibleStart: lastEndIndex + 1,
          visibleEnd: window.start - 1
        } as any);
      }

      // Add children in this window
      for (let i = window.start; i <= window.end; i++) {
        const child = children[i];
        filteredChildren.push({
          ...child,
          children: child.children ? filterChildren(child.children, child.id) : child.children
        });
      }

      lastEndIndex = window.end;
    }

    // Add final ellipsis if needed
    if (lastEndIndex < children.length - 1) {
      const remainingCount = children.length - lastEndIndex - 1;
      filteredChildren.push({
        id: `${parentPath}-ellipsis-bottom`,
        nodeId: `${parentPath}-ellipsis-bottom`,
        name: `... ${remainingCount} more`,
        nodeType: "load-more",
        isLoadMore: true,
        category: false,
        hiddenNodesCount: remainingCount,
        allChildren: children,
        visibleStart: lastEndIndex + 1,
        visibleEnd: children.length - 1
      } as any);
    }
    return filteredChildren;
  };

  // Apply filtering recursively starting from root
  return tree.map(rootNode => ({
    ...rootNode,
    children: rootNode.children ? filterChildren(rootNode.children, rootNode.id) : rootNode.children
  }));
};

// Helper function to expand ellipsis nodes and show more hidden siblings
// When an ellipsis is clicked, it loads 10 nodes above or below based on position
export const expandEllipsisNode = (tree: TreeData[], ellipsisNodeId: string): TreeData[] => {
  const EXPAND_COUNT = 10; // Number of nodes to show when expanding

  const expandInChildren = (children: TreeData[]): TreeData[] => {
    const ellipsisIndex = children.findIndex(child => child.id === ellipsisNodeId);

    if (ellipsisIndex === -1) {
      // Ellipsis not found at this level, recurse into children
      return children.map(child => ({
        ...child,
        children: child.children ? expandInChildren(child.children) : child.children
      }));
    }

    // Found the ellipsis node
    const ellipsisNode = children[ellipsisIndex] as any;

    if (!ellipsisNode.isLoadMore || !ellipsisNode.allChildren) {
      return children;
    }

    const { allChildren, visibleStart, visibleEnd, hiddenNodesCount } = ellipsisNode;

    // Decide if this is a top, middle, or bottom ellipsis
    const isTopEllipsis = ellipsisIndex === 0;
    const isBottomEllipsis = ellipsisIndex === children.length - 1;

    let nodesToShow: TreeData[];
    let newEllipsisNode: TreeData | null = null;

    if (isTopEllipsis) {
      // Top ellipsis -> show 10 nodes from the end of hidden range (closest to visible content)
      const showCount = Math.min(EXPAND_COUNT, hiddenNodesCount);
      const newVisibleStart = visibleEnd - showCount + 1;

      nodesToShow = allChildren.slice(newVisibleStart, visibleEnd + 1);

      // If there are still hidden nodes, create new ellipsis
      if (newVisibleStart > visibleStart) {
        const remainingHidden = newVisibleStart - visibleStart;
        newEllipsisNode = {
          id: `${ellipsisNode.id}-updated`,
          nodeId: `${ellipsisNode.id}-updated`,
          name: `... ${remainingHidden} more`,
          nodeType: "load-more",
          isLoadMore: true,
          category: false,
          hiddenNodesCount: remainingHidden,
          allChildren: allChildren,
          visibleStart: visibleStart,
          visibleEnd: newVisibleStart - 1
        } as any;
      }

    } else if (isBottomEllipsis) {
      // Bottom ellipsis -> show 10 nodes from the start of hidden range
      const showCount = Math.min(EXPAND_COUNT, hiddenNodesCount);
      const newVisibleEnd = visibleStart + showCount - 1;

      nodesToShow = allChildren.slice(visibleStart, newVisibleEnd + 1);

      // If there are still hidden nodes, create new ellipsis
      if (newVisibleEnd < visibleEnd) {
        const remainingHidden = visibleEnd - newVisibleEnd;
        newEllipsisNode = {
          id: `${ellipsisNode.id}-updated`,
          nodeId: `${ellipsisNode.id}-updated`,
          name: `... ${remainingHidden} more`,
          nodeType: "load-more",
          isLoadMore: true,
          category: false,
          hiddenNodesCount: remainingHidden,
          allChildren: allChildren,
          visibleStart: newVisibleEnd + 1,
          visibleEnd: visibleEnd
        } as any;
      }

    } else {
      // Middle ellipsis (if gap between windows) -> show 10 nodes from both ends
      const showFromTop = Math.min(5, Math.floor(hiddenNodesCount / 2));
      const showFromBottom = Math.min(5, hiddenNodesCount - showFromTop);

      const topNodes = allChildren.slice(visibleStart, visibleStart + showFromTop);
      const bottomNodes = allChildren.slice(visibleEnd - showFromBottom + 1, visibleEnd + 1);

      nodesToShow = [...topNodes, ...bottomNodes];

      // If there's still a gap, create new ellipsis in the middle
      const newGapStart = visibleStart + showFromTop;
      const newGapEnd = visibleEnd - showFromBottom;

      if (newGapEnd >= newGapStart) {
        const remainingHidden = newGapEnd - newGapStart + 1;
        newEllipsisNode = {
          id: `${ellipsisNode.id}-updated`,
          nodeId: `${ellipsisNode.id}-updated`,
          name: `... ${remainingHidden} more`,
          nodeType: "load-more",
          isLoadMore: true,
          category: false,
          hiddenNodesCount: remainingHidden,
          allChildren: allChildren,
          visibleStart: newGapStart,
          visibleEnd: newGapEnd
        } as any;
      }
    }

    // Build new children array
    const newChildren = [...children];

    if (isTopEllipsis) {
      // Remove old ellipsis and add new content at the beginning
      newChildren.splice(ellipsisIndex, 1, ...(newEllipsisNode ? [newEllipsisNode, ...nodesToShow] : nodesToShow));
    } else if (isBottomEllipsis) {
      // Remove old ellipsis and add new content at the end
      newChildren.splice(ellipsisIndex, 1, ...(newEllipsisNode ? [...nodesToShow, newEllipsisNode] : nodesToShow));
    } else {
      // Replace ellipsis with top nodes, new ellipsis if there is any, and bottom nodes
      const replacement = newEllipsisNode
        ? [...nodesToShow.slice(0, 5), newEllipsisNode, ...nodesToShow.slice(5)]
        : nodesToShow;
      newChildren.splice(ellipsisIndex, 1, ...replacement);
    }

    return newChildren;
  };

  // Apply expansion recursively starting from root
  return tree.map(rootNode => ({
    ...rootNode,
    children: rootNode.children ? expandInChildren(rootNode.children) : rootNode.children
  }));
};