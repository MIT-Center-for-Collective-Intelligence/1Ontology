import { Node as ReactFlowNode, Edge, MarkerType } from "@xyflow/react";
import { IActivity, IAlgorithm } from " @components/types/INode";
import { NodeData } from "./NodeComponent";

/**
 * Result of the flow generation process containing positioned nodes and edges
 */
export interface FlowGenerationResult {
  nodes: ReactFlowNode<any>[];
  edges: Edge[];
}

/**
 * Dimensions for a node in the flowchart
 */
interface NodeDimensions {
  width: number;
  height: number;
}

/**
 * Activity subtree dimensions used for layout calculations
 */
interface SubtreeDimensions {
  width: number;
  height: number;
}

/**
 * Position tracking for the last node in a subtree
 */
interface NodePosition {
  lastX: number;
  lastY: number;
  lastId: string;
}

/**
 * Edge styles configuration
 */
interface EdgeStyle {
  stroke: string;
  strokeWidth: number;
}

/**
 * Node type constants
 */
const NODE_TYPES = {
  SEQUENTIAL: "sequential",
  PARALLEL: "parallel",
  CONDITION: "condition",
  LOOP: "loop",
  TASK: "task",
  JOIN: "join",
  MERGE: "merge",
} as const;

/**
 * FlowGenerator - Transforms algorithm data into a visual flowchart representation
 *
 * Handles the complex layout calculation to generate visually appealing flowcharts
 * from nested activity structures. The layout algorithm works in multiple passes:
 * 1. Calculate dimensions of all subtrees
 * 2. Assign positions to nodes based on these dimensions
 * 3. Optimize edge routing for better visualization
 * 4. Center the entire layout
 */
export class FlowGenerator {
  private nodes: ReactFlowNode<any>[] = [];
  private edges: Edge[] = [];
  private nodeId = 1;
  private joinId = 1000;
  private isDarkMode: boolean;

  /** Default node dimensions by type */
  private readonly nodeDimensions: Record<string, NodeDimensions> = {
    [NODE_TYPES.SEQUENTIAL]: { width: 180, height: 60 },
    [NODE_TYPES.PARALLEL]: { width: 180, height: 60 },
    [NODE_TYPES.CONDITION]: { width: 160, height: 160 },
    [NODE_TYPES.LOOP]: { width: 180, height: 80 },
    [NODE_TYPES.TASK]: { width: 160, height: 40 },
    [NODE_TYPES.JOIN]: { width: 60, height: 30 },
    [NODE_TYPES.MERGE]: { width: 60, height: 30 },
  };

  /** Layout spacing configuration */
  private readonly spacing = {
    horizontal: 60,
    vertical: 120,
    branch: 220,
    parallelBranch: 240,
    edgeBuffer: 40,
  };

  constructor(isDarkMode: boolean) {
    this.isDarkMode = isDarkMode;
  }

  /**
   * Generates a flow representation of an algorithm
   * @param algorithm The algorithm to visualize
   * @returns Positioned nodes and edges ready for rendering
   */
  public generateFlow(algorithm: IAlgorithm): FlowGenerationResult {
    this.reset();

    const rootId = algorithm.id || `algorithm-${this.nodeId++}`;

    // Three-pass layout algorithm
    const dimensions = this.calculateDimensions(algorithm);
    this.assignPositions(
      algorithm,
      rootId,
      0,
      -dimensions.height / 2,
      null,
      true,
    );
    this.optimizeEdgeRouting();
    this.centerLayout();

    return {
      nodes: this.nodes,
      edges: this.edges,
    };
  }

  /**
   * Resets the internal state for a new flow generation
   */
  private reset(): void {
    this.nodes = [];
    this.edges = [];
    this.nodeId = 1;
    this.joinId = 1000;
  }

  /**
   * Generates a unique node ID with a prefix
   */
  private getNodeId(prefix: string): string {
    return `${prefix}-${this.nodeId++}`;
  }

  /**
   * Generates a unique join/merge node ID
   */
  private getJoinId(): string {
    return `join-${this.joinId++}`;
  }

  /**
   * Gets appropriate color for a node type based on theme
   */
  private getNodeColor(type: string): string {
    switch (type) {
      case NODE_TYPES.SEQUENTIAL:
        return this.isDarkMode ? "#90caf9" : "#1976d2";
      case NODE_TYPES.PARALLEL:
        return this.isDarkMode ? "#ce93d8" : "#9c27b0";
      case NODE_TYPES.CONDITION:
        return this.isDarkMode ? "#ffb74d" : "#f57c00";
      case NODE_TYPES.LOOP:
        return this.isDarkMode ? "#81c784" : "#43a047";
      case NODE_TYPES.TASK:
      default:
        return this.isDarkMode ? "#b0bec5" : "#607d8b";
    }
  }

  /**
   * Gets the width of a node based on its type
   */
  private getNodeWidth(type: string): number {
    return (
      this.nodeDimensions[type]?.width ||
      this.nodeDimensions[NODE_TYPES.TASK].width
    );
  }

  /**
   * Gets the height of a node based on its type
   */
  private getNodeHeight(type: string): number {
    return (
      this.nodeDimensions[type]?.height ||
      this.nodeDimensions[NODE_TYPES.TASK].height
    );
  }

  /**
   * Calculates dimensions of a subtree rooted at the given activity
   * @returns Object containing width and height of the subtree
   */
  private calculateDimensions(activity: any): SubtreeDimensions {
    const nodeWidth = this.getNodeWidth(activity.type);
    const nodeHeight = this.getNodeHeight(activity.type);

    // Base case: no sub-activities
    if (!activity.sub_activities || activity.sub_activities.length === 0) {
      return { width: nodeWidth, height: nodeHeight };
    }

    // Calculate dimensions based on activity type
    switch (activity.type) {
      case NODE_TYPES.SEQUENTIAL:
        return this.calculateSequentialDimensions(
          activity,
          nodeWidth,
          nodeHeight,
        );

      case NODE_TYPES.PARALLEL:
        return this.calculateParallelDimensions(
          activity,
          nodeWidth,
          nodeHeight,
        );

      case NODE_TYPES.CONDITION:
        return this.calculateConditionDimensions(
          activity,
          nodeWidth,
          nodeHeight,
        );

      case NODE_TYPES.LOOP:
        return this.calculateLoopDimensions(activity, nodeWidth, nodeHeight);

      default:
        return { width: nodeWidth, height: nodeHeight };
    }
  }

  /**
   * Calculates dimensions for sequential activities
   */
  private calculateSequentialDimensions(
    activity: IActivity,
    nodeWidth: number,
    nodeHeight: number,
  ): SubtreeDimensions {
    let width = 0;
    let height = nodeHeight;

    for (const subActivity of activity.sub_activities!) {
      const subDimensions = this.calculateDimensions(subActivity);
      width = Math.max(width, subDimensions.width);
      height += this.spacing.vertical + subDimensions.height;
    }

    // Add padding for readability
    width = Math.max(nodeWidth, width + 20);

    return { width, height };
  }

  /**
   * Calculates dimensions for parallel activities
   */
  private calculateParallelDimensions(
    activity: IActivity,
    nodeWidth: number,
    nodeHeight: number,
  ): SubtreeDimensions {
    let width = 0;
    let height = 0;

    // Calculate total width and max height of branches
    for (const subActivity of activity.sub_activities!) {
      const subDimensions = this.calculateDimensions(subActivity);
      width += subDimensions.width;
      height = Math.max(height, subDimensions.height);

      // Add spacing between branches except for the last one
      if (
        subActivity !==
        activity.sub_activities![activity.sub_activities!.length - 1]
      ) {
        width += this.spacing.parallelBranch;
      }
    }

    // Account for join node
    height += this.spacing.vertical + this.getNodeHeight(NODE_TYPES.JOIN);

    // Extra padding for branches
    if (activity.sub_activities!.length > 2) {
      width += this.spacing.parallelBranch * 0.5;
    }

    return {
      width: Math.max(nodeWidth, width),
      height: nodeHeight + this.spacing.vertical + height,
    };
  }

  /**
   * Calculates dimensions for condition activities
   */
  private calculateConditionDimensions(
    activity: IActivity,
    nodeWidth: number,
    nodeHeight: number,
  ): SubtreeDimensions {
    const trueActivity = activity.sub_activities![0];
    const falseActivity = activity.sub_activities![1];

    let trueWidth = 0,
      trueHeight = 0;
    let falseWidth = 0,
      falseHeight = 0;

    if (trueActivity) {
      const trueDimensions = this.calculateDimensions(trueActivity);
      trueWidth = trueDimensions.width;
      trueHeight = trueDimensions.height;
    }

    if (falseActivity) {
      const falseDimensions = this.calculateDimensions(falseActivity);
      falseWidth = falseDimensions.width;
      falseHeight = falseDimensions.height;
    }

    // Calculate total width with spacing
    const totalWidth =
      trueWidth + falseWidth + this.spacing.branch + this.spacing.edgeBuffer;

    // Account for merge node
    const maxBranchHeight = Math.max(trueHeight, falseHeight);
    const totalHeight =
      nodeHeight +
      this.spacing.vertical +
      maxBranchHeight +
      this.spacing.vertical +
      this.getNodeHeight(NODE_TYPES.MERGE);

    return {
      width: Math.max(nodeWidth, totalWidth),
      height: totalHeight,
    };
  }

  /**
   * Calculates dimensions for loop activities
   */
  private calculateLoopDimensions(
    activity: IActivity,
    nodeWidth: number,
    nodeHeight: number,
  ): SubtreeDimensions {
    let width = 0;
    let height = nodeHeight;

    for (const subActivity of activity.sub_activities!) {
      const subDimensions = this.calculateDimensions(subActivity);
      width = Math.max(width, subDimensions.width);
      height += this.spacing.vertical + subDimensions.height;
    }

    // Add extra width for the feedback loop
    width = Math.max(width, nodeWidth + 80);

    return { width, height };
  }

  /**
   * Centers the entire layout for better visualization
   */
  private centerLayout(): void {
    if (this.nodes.length === 0) return;

    // Calculate bounding box
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;

    this.nodes.forEach((node) => {
      const nodeWidth = this.getNodeWidth(node.type as string);
      const nodeHeight = this.getNodeHeight(node.type as string);

      minX = Math.min(minX, node.position.x);
      maxX = Math.max(maxX, node.position.x + nodeWidth);
      minY = Math.min(minY, node.position.y);
      maxY = Math.max(maxY, node.position.y + nodeHeight);
    });

    // Calculate center offset
    const centerX = (minX + maxX) / 2;
    const desiredCenterX = 400; // Centered position X
    const offsetX = desiredCenterX - centerX;

    // Apply offset to all nodes
    this.nodes.forEach((node) => {
      node.position.x += offsetX;

      // Update data.position to match node position
      if (node.data) {
        node.data.position = { ...node.position };
      }
    });
  }

  /**
   * Optimizes edge routing for better visualization
   */
  private optimizeEdgeRouting(): void {
    // Create node position map for lookup
    const nodePositionMap = new Map<
      string,
      {
        x: number;
        y: number;
        width: number;
        height: number;
        type: string;
      }
    >();

    this.nodes.forEach((node) => {
      nodePositionMap.set(node.id, {
        x: node.position.x,
        y: node.position.y,
        width: this.getNodeWidth(node.type as string),
        height: this.getNodeHeight(node.type as string),
        type: node.type as string,
      });
    });

    // Identify condition path edges
    const conditionTrueEdges = new Set<string>();
    const conditionFalseEdges = new Set<string>();

    this.edges.forEach((edge) => {
      if (edge.sourceHandle === "true") {
        conditionTrueEdges.add(edge.id);
      } else if (edge.sourceHandle === "false") {
        conditionFalseEdges.add(edge.id);
      }
    });

    // Apply optimized edge routing
    this.edges = this.edges.map((edge) => {
      const sourceNode = nodePositionMap.get(edge.source);
      const targetNode = nodePositionMap.get(edge.target);

      if (!sourceNode || !targetNode) {
        return edge;
      }

      const newEdge = { ...edge };

      // Apply edge styling based on type
      if (conditionTrueEdges.has(edge.id) || conditionFalseEdges.has(edge.id)) {
        // Condition branch edges
        newEdge.type = "smoothstep";
      } else if (
        sourceNode.type !== NODE_TYPES.CONDITION &&
        targetNode.type === "default" &&
        targetNode.width === this.getNodeWidth(NODE_TYPES.MERGE)
      ) {
        // Branch-to-merge edges
        newEdge.type = "smoothstep";
      } else if (
        sourceNode.type === NODE_TYPES.LOOP &&
        edge.sourceHandle === "loop"
      ) {
        // Loop feedback edges
        newEdge.type = "bezier";
        newEdge.style = {
          ...newEdge.style,
        };
      } else if (
        sourceNode.type === NODE_TYPES.PARALLEL ||
        targetNode.type === NODE_TYPES.JOIN
      ) {
        // Parallel branch edges
        newEdge.type = "smoothstep";
      } else {
        // Default edges
        newEdge.type = "default";
      }

      return newEdge;
    });
  }

  /**
   * Assigns positions to nodes based on calculated dimensions
   * @returns Position of the last node in the subtree
   */
  private assignPositions(
    activity: any,
    parentId: string,
    x: number,
    y: number,
    isConditionPath: boolean | null = null,
    isRoot: boolean = false,
  ): NodePosition {
    const currentId = activity.id ? activity.id : this.getNodeId(activity.type);
    const nodeWidth = this.getNodeWidth(activity.type);
    const nodeHeight = this.getNodeHeight(activity.type);

    // Center node at the given position
    const nodeX = x - nodeWidth / 2;

    // Add the current node
    this.addNode(activity, currentId, nodeX, y, isConditionPath, isRoot);

    // Connect from parent to this node (if not root)
    if (!isRoot) {
      this.addEdge(parentId, currentId, isConditionPath, activity.type);
    }

    let lastNodeId = currentId;
    let lastX = x;
    let lastY = y + nodeHeight;

    // Process sub-activities based on activity type
    if (activity.sub_activities && activity.sub_activities.length > 0) {
      switch (activity.type) {
        case NODE_TYPES.SEQUENTIAL:
          return this.layoutSequentialActivity(activity, currentId, x, lastY);

        case NODE_TYPES.PARALLEL:
          return this.layoutParallelActivity(activity, currentId, x, lastY);

        case NODE_TYPES.CONDITION:
          return this.layoutConditionActivity(activity, currentId, x, lastY);

        case NODE_TYPES.LOOP:
          return this.layoutLoopActivity(activity, currentId, x, lastY);
      }
    }

    return { lastX, lastY, lastId: lastNodeId };
  }

  /**
   * Creates a node and adds it to the nodes array
   */
  private addNode(
    activity: IActivity,
    id: string,
    x: number,
    y: number,
    isConditionPath: boolean | null = null,
    isRoot: boolean = false,
  ): void {
    this.nodes.push({
      id,
      type: activity.type,
      position: { x, y },
      data: {
        id,
        position: { x, y },
        data: null,
        label: activity.name,
        type: activity.type,
        activityId: isRoot ? activity.id || "root" : activity.id,
        hasSubActivities:
          activity.sub_activities && activity.sub_activities.length > 0,
        isConditionTrue: isConditionPath,
        variables: activity.variables,
        condition: activity.condition
          ? Object.keys(activity.condition)[0]
          : activity.loop_condition
            ? Object.keys(activity.loop_condition)[0]
            : undefined,
      },
    });
  }

  /**
   * Creates an edge and adds it to the edges array
   */
  private addEdge(
    sourceId: string,
    targetId: string,
    isConditionPath: boolean | null = null,
    activityType: string,
  ): void {
    if (isConditionPath === true) {
      // True condition path
      this.edges.push({
        id: `${sourceId}-${targetId}`,
        source: sourceId,
        target: targetId,
        sourceHandle: "true",
        animated: false,
        type: "smoothstep",
        style: {
          stroke: "#4caf50",
          strokeWidth: 2,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#4caf50" },
        label: "True",
        labelStyle: { fill: "#4caf50", fontWeight: 500, fontSize: 12 },
        labelBgStyle: {
          fill: this.isDarkMode ? "#1e1e1e" : "#ffffff",
          fillOpacity: 0.7,
        },
      });
    } else if (isConditionPath === false) {
      // False condition path
      this.edges.push({
        id: `${sourceId}-${targetId}`,
        source: sourceId,
        target: targetId,
        sourceHandle: "false",
        animated: false,
        type: "smoothstep",
        style: {
          stroke: "#f44336",
          strokeWidth: 2,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#f44336" },
        label: "False",
        labelStyle: { fill: "#f44336", fontWeight: 500, fontSize: 12 },
        labelBgStyle: {
          fill: this.isDarkMode ? "#1e1e1e" : "#ffffff",
          fillOpacity: 0.7,
        },
      });
    } else {
      // Normal connection
      this.edges.push({
        id: `${sourceId}-${targetId}`,
        source: sourceId,
        target: targetId,
        animated: false,
        style: { stroke: this.getNodeColor(activityType), strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: this.getNodeColor(activityType),
        },
      });
    }
  }

  /**
   * Layouts sequential activities in a vertical arrangement
   */
  private layoutSequentialActivity(
    activity: IActivity,
    parentId: string,
    x: number,
    startY: number,
  ): NodePosition {
    let currentY = startY + this.spacing.vertical;
    let lastNodeId = parentId;
    let lastX = x;

    for (const subActivity of activity.sub_activities!) {
      const result = this.assignPositions(subActivity, lastNodeId, x, currentY);
      lastNodeId = result.lastId;
      lastX = result.lastX;
      currentY = result.lastY + this.spacing.vertical;
    }

    return {
      lastX,
      lastY: currentY - this.spacing.vertical,
      lastId: lastNodeId,
    };
  }

  /**
   * Layouts parallel activities with branches side by side
   */
  private layoutParallelActivity(
    activity: IActivity,
    parentId: string,
    x: number,
    startY: number,
  ): NodePosition {
    const subActivities = activity.sub_activities!;
    const branchResults: NodePosition[] = [];

    // Calculate total width and branch dimensions
    let totalWidth = 0;
    const branchDimensions: SubtreeDimensions[] = [];

    for (const subActivity of subActivities) {
      const dimensions = this.calculateDimensions(subActivity);
      branchDimensions.push(dimensions);
      totalWidth += dimensions.width;
    }

    // Add spacing between branches
    totalWidth += (subActivities.length - 1) * this.spacing.parallelBranch;

    // Calculate starting X position
    let branchX = x - totalWidth / 2;
    let maxY = startY;

    // Process each branch
    for (let i = 0; i < subActivities.length; i++) {
      const dimensions = branchDimensions[i];

      // Add spacing for subsequent branches
      if (i > 0) {
        branchX += this.spacing.parallelBranch;
      }

      // Center branch on its allocated space
      branchX += dimensions.width / 2;

      const result = this.assignPositions(
        subActivities[i],
        parentId,
        branchX,
        startY + this.spacing.vertical,
      );

      branchResults.push(result);
      maxY = Math.max(maxY, result.lastY);

      // Move to next branch position
      branchX += dimensions.width / 2;
    }

    // Create a join node to merge parallel branches
    const joinNodeId = this.createJoinNode(
      x,
      maxY + this.spacing.vertical,
      NODE_TYPES.PARALLEL,
    );

    // Connect branch endpoints to join node
    branchResults.forEach((result) => {
      this.addEdge(result.lastId, joinNodeId, null, NODE_TYPES.PARALLEL);
    });

    return {
      lastX: x,
      lastY: maxY + this.spacing.vertical + this.getNodeHeight(NODE_TYPES.JOIN),
      lastId: joinNodeId,
    };
  }

  /**
   * Creates a join or merge node
   */
  private createJoinNode(x: number, y: number, parentType: string): string {
    const joinNodeId = this.getJoinId();
    const isJoin = parentType === NODE_TYPES.PARALLEL;
    const nodeType = isJoin ? NODE_TYPES.JOIN : NODE_TYPES.MERGE;
    const label = isJoin ? "Join" : "Merge";
    const color = this.getNodeColor(parentType);
    const bgColor = this.isDarkMode
      ? `rgba(${isJoin ? "156, 39, 176" : "245, 124, 0"}, 0.15)`
      : `rgba(${isJoin ? "156, 39, 176" : "245, 124, 0"}, 0.05)`;
    const borderColor = this.isDarkMode
      ? `rgba(${isJoin ? "156, 39, 176" : "245, 124, 0"}, 0.5)`
      : `rgba(${isJoin ? "156, 39, 176" : "245, 124, 0"}, 0.3)`;

    this.nodes.push({
      id: joinNodeId,
      type: "default",
      position: { x: x - this.getNodeWidth(nodeType) / 2, y },
      data: {
        id: joinNodeId,
        position: { x: x - this.getNodeWidth(nodeType) / 2, y },
        data: null,
        label,
        type: NODE_TYPES.TASK, // For consistent typing
      },
      style: {
        width: 60,
        height: 30,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: "50%",
        fontSize: "11px",
        color,
      },
    });

    return joinNodeId;
  }

  /**
   * Layouts condition activity with true/false branches
   */
  private layoutConditionActivity(
    activity: IActivity,
    parentId: string,
    x: number,
    startY: number,
  ): NodePosition {
    const trueActivity = activity.sub_activities![0];
    const falseActivity = activity.sub_activities![1];

    const nextY = startY + this.spacing.vertical;

    // Position branches symmetrically from center
    const branchOffset = this.spacing.branch / 2;
    const trueX = x + branchOffset; // True path on right
    const falseX = x - branchOffset; // False path on left

    // Process the "true" branch
    let trueResult: NodePosition = { lastX: x, lastY: nextY, lastId: parentId };
    if (trueActivity) {
      trueResult = this.assignPositions(
        trueActivity,
        parentId,
        trueX,
        nextY,
        true,
      );
    }

    // Process the "false" branch
    let falseResult: NodePosition = {
      lastX: x,
      lastY: nextY,
      lastId: parentId,
    };
    if (falseActivity) {
      falseResult = this.assignPositions(
        falseActivity,
        parentId,
        falseX,
        nextY,
        false,
      );
    }

    // Find furthest Y position
    const maxY = Math.max(trueResult.lastY, falseResult.lastY);

    // Create merge node
    const mergeNodeId = this.createJoinNode(
      x,
      maxY + this.spacing.vertical,
      NODE_TYPES.CONDITION,
    );

    // Connect branches to merge node
    if (trueActivity) {
      this.edges.push({
        id: `${trueResult.lastId}-${mergeNodeId}`,
        source: trueResult.lastId,
        target: mergeNodeId,
        type: "smoothstep",
        style: {
          stroke: "#4caf50",
          strokeWidth: 2,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#4caf50" },
      });
    }

    if (falseActivity) {
      this.edges.push({
        id: `${falseResult.lastId}-${mergeNodeId}`,
        source: falseResult.lastId,
        target: mergeNodeId,
        type: "smoothstep",
        style: {
          stroke: "#f44336",
          strokeWidth: 2,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#f44336" },
      });
    }

    return {
      lastX: x,
      lastY:
        maxY + this.spacing.vertical + this.getNodeHeight(NODE_TYPES.MERGE),
      lastId: mergeNodeId,
    };
  }

  /**
   * Layouts loop activity with feedback connection
   */
  private layoutLoopActivity(
    activity: IActivity,
    parentId: string,
    x: number,
    startY: number,
  ): NodePosition {
    let currentY = startY + this.spacing.vertical;
    let lastSubNodeId = parentId;

    // Process all activities inside the loop
    for (const subActivity of activity.sub_activities!) {
      const result = this.assignPositions(
        subActivity,
        lastSubNodeId,
        x,
        currentY,
      );
      lastSubNodeId = result.lastId;
      currentY = result.lastY + this.spacing.vertical;
    }

    // Create feedback loop edge
    this.edges.push({
      id: `${lastSubNodeId}-${parentId}-loop`,
      source: lastSubNodeId,
      target: parentId,
      sourceHandle: "loop",
      targetHandle: "target",
      type: "bezier",
      animated: false,
      style: {
        stroke: this.getNodeColor(NODE_TYPES.LOOP),
        strokeWidth: 2,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: this.getNodeColor(NODE_TYPES.LOOP),
      },
    });

    return {
      lastX: x,
      lastY: currentY - this.spacing.vertical,
      lastId: lastSubNodeId,
    };
  }
}
