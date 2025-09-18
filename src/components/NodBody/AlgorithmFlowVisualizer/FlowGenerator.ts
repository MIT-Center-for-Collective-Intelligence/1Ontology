import { Node as ReactFlowNode, Edge, MarkerType } from "@xyflow/react";
import { IActivity, IAlgorithm } from "@components/types/INode";
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
  // For handling multiple branch endpoints when skipping join/merge nodes
  branchEndpoints?: string[];
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
  SEQUENTIAL_CONTAINER: "sequential-container",
  PARALLEL: "parallel",
  PARALLEL_CONTAINER: "parallel-container",
  CONDITION: "condition",
  LOOP: "loop",
  LOOP_CONTAINER: "loop-container",
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
  private navigateToNode?: (nodeId: string) => void;
  private enableEdit: boolean;
  private onNodeDelete?: (nodeId: string) => void;
  private onNodeUpdate?: (nodeId: string, updates: any) => void;
  private onEdgeDelete?: (edgeId: string) => void;

  /** Default node dimensions by type */
  private readonly nodeDimensions: Record<string, NodeDimensions> = {
    [NODE_TYPES.SEQUENTIAL]: { width: 180, height: 60 },
    [NODE_TYPES.SEQUENTIAL_CONTAINER]: { width: 300, height: 200 },
    [NODE_TYPES.PARALLEL]: { width: 180, height: 60 },
    [NODE_TYPES.PARALLEL_CONTAINER]: { width: 400, height: 200 },
    [NODE_TYPES.CONDITION]: { width: 160, height: 160 },
    [NODE_TYPES.LOOP]: { width: 200, height: 80 },
    [NODE_TYPES.LOOP_CONTAINER]: { width: 300, height: 250 },
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

  constructor(
    isDarkMode: boolean, 
    navigateToNode?: (nodeId: string) => void,
    enableEdit: boolean = false,
    onNodeDelete?: (nodeId: string) => void,
    onNodeUpdate?: (nodeId: string, updates: any) => void,
    onEdgeDelete?: (edgeId: string) => void
  ) {
    this.isDarkMode = isDarkMode;
    this.navigateToNode = navigateToNode;
    this.enableEdit = enableEdit;
    this.onNodeDelete = onNodeDelete;
    this.onNodeUpdate = onNodeUpdate;
    this.onEdgeDelete = onEdgeDelete;
  }

  /**
   * Generates a flow representation of an algorithm
   * @param algorithm The algorithm to visualize
   * @returns Positioned nodes and edges ready for rendering
   */
  public generateFlow(algorithm: IAlgorithm): FlowGenerationResult {
    this.reset();

    const rootId = algorithm.id || `algorithm-${this.nodeId++}`;

    // Handle root Sequential nodes by processing sub-activities directly
    if (algorithm.type === NODE_TYPES.SEQUENTIAL && algorithm.sub_activities && algorithm.sub_activities.length > 0) {
      // Calculate dimensions based on sub-activities instead of the wrapper
      const dimensions = this.calculateDimensions(algorithm);
      
      // Process the algorithm as a wrapper (no visual node created)
      // Ensure the passed object satisfies IActivity's required 'id'
      const sequentialWrapper = { ...(algorithm as unknown as IActivity), id: rootId } as IActivity;
      this.layoutSequentialActivity(sequentialWrapper, `root-${rootId}`, 0, -dimensions.height / 2);
    } else {
      // Normal processing for other root node types
      const dimensions = this.calculateDimensions(algorithm);
      this.assignPositions(
        algorithm,
        rootId,
        0,
        -dimensions.height / 2,
        null,
        true,
      );
    }
    
    this.optimizeEdgeRouting();
    this.addContainerEdges(); // Add container edges for parallel containers
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
      case NODE_TYPES.SEQUENTIAL_CONTAINER:
        return this.isDarkMode ? "#90caf9" : "#1976d2";
      case NODE_TYPES.PARALLEL:
      case NODE_TYPES.PARALLEL_CONTAINER:
        return this.isDarkMode ? "#ce93d8" : "#9c27b0";
      case NODE_TYPES.CONDITION:
        return this.isDarkMode ? "#ffb74d" : "#f57c00";
      case NODE_TYPES.LOOP:
        return this.isDarkMode ? "#81c784" : "#43a047";
      case NODE_TYPES.LOOP_CONTAINER:
        return this.isDarkMode ? "#81c784" : "#43a047";
      case NODE_TYPES.TASK:
      default:
        return this.isDarkMode ? "#b0bec5" : "#607d8b";
    }
  }

  /**
   * Determines if an activity will be rendered as a container
   */
  private isContainerActivity(activity: any): boolean {
    // Activities that create containers
    return (
      (activity.type === NODE_TYPES.SEQUENTIAL && activity.sub_activities && activity.sub_activities.length > 0) ||
      (activity.type === NODE_TYPES.PARALLEL && activity.sub_activities && activity.sub_activities.length > 0) ||
      (activity.type === NODE_TYPES.LOOP && activity.sub_activities && activity.sub_activities.length > 0) ||
      activity.type === NODE_TYPES.SEQUENTIAL_CONTAINER ||
      activity.type === NODE_TYPES.PARALLEL_CONTAINER ||
      activity.type === NODE_TYPES.LOOP_CONTAINER
    );
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
    let height = 0; // Start with 0 since we're not showing the sequential wrapper node

    for (const subActivity of activity.sub_activities!) {
      const subDimensions = this.calculateDimensions(subActivity);
      width = Math.max(width, subDimensions.width);
      height += this.spacing.vertical + subDimensions.height;
    }

    // Remove extra vertical spacing for the first element
    if (activity.sub_activities!.length > 0) {
      height -= this.spacing.vertical;
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

    // Skip join node - no additional height needed

    // Extra padding for branches
    if (activity.sub_activities!.length > 2) {
      width += this.spacing.parallelBranch * 0.5;
    }

    return {
      width: Math.max(nodeWidth, width),
      height: height, // No wrapper node height, no join node height
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

    // Skip merge node - just account for the condition node and the tallest branch
    const maxBranchHeight = Math.max(trueHeight, falseHeight);
    const totalHeight =
      nodeHeight +
      this.spacing.vertical +
      maxBranchHeight;

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
   * Adds container edges for parallel containers to visualize task distribution
   * Only creates edges to direct task children, NOT to nested containers
   */
  private addContainerEdges(): void {
    // Find all parallel containers
    const parallelContainers = this.nodes.filter(node => 
      node.type === 'parallel-container'
    );

    for (const container of parallelContainers) {
      // Find direct child nodes that are NOT containers
      const directTaskChildren = this.nodes.filter(node => 
        node.parentId === container.id && 
        node.type !== 'parallel-container' && 
        node.type !== 'sequential-container'
      );

      if (directTaskChildren.length > 0) {
        // Create edges from container's top source handle to direct task children only
        const containerEdges = directTaskChildren.map(child => ({
          id: `container-${container.id}-to-${child.id}`,
          source: container.id,
          target: child.id,
          sourceHandle: 'source-top', // Container's top source handle for distribution
          targetHandle: null,  // Child's target handle (top) - null uses default
          type: 'default',
          style: {
            stroke: this.getNodeColor('parallel-container'), // Use parallel color
            strokeWidth: 2,
          },
          data: {
            containerEdge: true,
            containerType: 'parallel',
          },
        }));

        this.edges.push(...containerEdges);
        console.log(`📊 FlowGenerator: Created ${containerEdges.length} container edges for ${container.id} (to direct tasks only)`);
      }
    }
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
    additionalParents: string[] = [],
    parentActivityType?: string,
  ): NodePosition {
    // Special handling for parallel activities - go straight to container without creating a parallel node
    if (activity.type === NODE_TYPES.PARALLEL && activity.sub_activities && activity.sub_activities.length > 0) {
      return this.layoutParallelActivityWithContainer(activity, parentId, x, y, isConditionPath, isRoot, additionalParents, parentActivityType);
    }
    
    // Special handling for sequential activities - use container without creating a sequential node
    if (activity.type === NODE_TYPES.SEQUENTIAL && activity.sub_activities && activity.sub_activities.length > 0 && !isRoot) {
      return this.layoutSequentialActivityWithContainer(activity, parentId, x, y, isConditionPath, isRoot, additionalParents, parentActivityType);
    }
    
    // Special handling for loop activities - use container instead of creating a loop node
    if (activity.type === NODE_TYPES.LOOP && activity.sub_activities && activity.sub_activities.length > 0) {
      return this.layoutLoopActivityWithContainer(activity, parentId, x, y, isConditionPath, isRoot, additionalParents, parentActivityType);
    }
    
    const currentId = activity.id ? activity.id : this.getNodeId(activity.type);
    const nodeWidth = this.getNodeWidth(activity.type);
    const nodeHeight = this.getNodeHeight(activity.type);

    // Center node at the given position
    const nodeX = x - nodeWidth / 2;

    // Add the current node
    this.addNode(activity, currentId, nodeX, y, isConditionPath, isRoot);

    // Connect from parent to this node (if not root)
    if (!isRoot) {
      this.addEdge(parentId, currentId, isConditionPath, activity.type, parentActivityType);
      
      // Connect from additional parents (for multi-branch scenarios)
      additionalParents.forEach(additionalParentId => {
        this.addEdge(additionalParentId, currentId, isConditionPath, activity.type, parentActivityType);
      });
    }

    let lastNodeId = currentId;
    let lastX = x;
    let lastY = y + nodeHeight;

    // Handle container types (empty containers that can be filled by users)
    if (activity.type === NODE_TYPES.SEQUENTIAL_CONTAINER || activity.type === NODE_TYPES.PARALLEL_CONTAINER || activity.type === NODE_TYPES.LOOP_CONTAINER) {
      return this.createEmptyContainer(activity, currentId, parentId, x, y, isConditionPath, isRoot, additionalParents, parentActivityType);
    }

    // Process sub-activities based on activity type
    if (activity.sub_activities && activity.sub_activities.length > 0) {
      switch (activity.type) {
        case NODE_TYPES.SEQUENTIAL:
          // This case should not be reached due to early return above for sequential with sub-activities
          return this.layoutSequentialActivityWithContainer(activity, parentId, x, y, isConditionPath, isRoot, additionalParents, parentActivityType);

        case NODE_TYPES.PARALLEL:
          // This case should not be reached due to early return above
          return this.layoutParallelActivityWithContainer(activity, parentId, x, y, isConditionPath, isRoot, additionalParents, parentActivityType);

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
    parentId?: string,
  ): void {
    const nodeData: any = {
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
        node_id: activity.type === 'task' ? activity.id : undefined,
        navigateToNode: this.navigateToNode,
        enableEdit: this.enableEdit,
        onNodeDelete: this.onNodeDelete,
        onNodeUpdate: this.onNodeUpdate,
      },
    };

    // Add parent relationship and extent constraint for child nodes
    if (parentId) {
      nodeData.parentId = parentId;
      nodeData.extent = 'parent';
    }

    this.nodes.push(nodeData);
  }

  /**
   * Creates an edge and adds it to the edges array
   */
  private addEdge(
    sourceId: string,
    targetId: string,
    isConditionPath: boolean | null = null,
    activityType: string,
    parentActivityType?: string,
    sourceHandle?: string,
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
      // Normal connection - use parent activity type for color if specified (for parallel sub-activities)
      const edgeColorType = parentActivityType || activityType;
      this.edges.push({
        id: `${sourceId}-${targetId}`,
        source: sourceId,
        target: targetId,
        sourceHandle: sourceHandle, // Use the specific source handle if provided
        animated: false,
        style: { stroke: this.getNodeColor(edgeColorType), strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: this.getNodeColor(edgeColorType),
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
    additionalParents: string[] = [],
  ): NodePosition {
    let currentY = startY;
    let lastResult: NodePosition | null = null;
    let lastX = x;
    
    // For the first activity, add initial spacing only if we have a real parent (not dummy root)
    let isFirst = true;

    for (let i = 0; i < activity.sub_activities!.length; i++) {
      const subActivity = activity.sub_activities![i];
      const currentParentId = lastResult ? lastResult.lastId : parentId;
      
      if (isFirst && !parentId.startsWith('root-')) {
        currentY += this.spacing.vertical;
      }
      isFirst = false;
      
      // Handle additional parents for the first activity (when skipping sequential wrapper)
      let currentAdditionalParents: string[] = [];
      
      if (i === 0) {
        // First activity gets the additional parents passed from the skipped sequential wrapper
        currentAdditionalParents = additionalParents;
      } else if (lastResult?.branchEndpoints) {
        // Subsequent activities get branch endpoints from previous activity
        currentAdditionalParents = lastResult.branchEndpoints.filter(id => id !== currentParentId);
      }
      
      const result = this.assignPositions(subActivity, currentParentId, x, currentY, null, false, currentAdditionalParents);

      lastResult = result;
      lastX = result.lastX;

      // Use double spacing for containers to create more breathing room
      const spacing = this.isContainerActivity(subActivity) ? this.spacing.vertical * 2 : this.spacing.vertical;
      currentY = result.lastY + spacing;
    }

    return lastResult || {
      lastX,
      lastY: currentY - this.spacing.vertical,
      lastId: parentId,
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
        null,
        false,
        [],
        NODE_TYPES.PARALLEL,
      );

      branchResults.push(result);
      maxY = Math.max(maxY, result.lastY);

      // Move to next branch position
      branchX += dimensions.width / 2;
    }

    // Skip creating join node - return all branch endpoints for connection
    if (branchResults.length > 1) {
      // Find the branch that extends furthest down (highest Y coordinate)
      const furthestResult = branchResults.reduce((furthest, current) => 
        current.lastY > furthest.lastY ? current : furthest
      );

      // Return position with all branch endpoints for multi-connection
      return {
        lastX: x,
        lastY: furthestResult.lastY,
        lastId: furthestResult.lastId, // Primary connection point
        branchEndpoints: branchResults.map(result => result.lastId), // All endpoints for connection
      };
    } else {
      // Single branch case - just return the branch result
      return branchResults[0] || { lastX: x, lastY: startY, lastId: parentId };
    }
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

    // Skip creating merge node - return all branch endpoints for connection
    const furthestResult = trueResult.lastY > falseResult.lastY ? trueResult : falseResult;
    const branchEndpoints = [];
    
    if (trueActivity) branchEndpoints.push(trueResult.lastId);
    if (falseActivity) branchEndpoints.push(falseResult.lastId);

    return {
      lastX: x,
      lastY: maxY,
      lastId: furthestResult.lastId, // Primary connection point
      branchEndpoints: branchEndpoints.length > 1 ? branchEndpoints : undefined, // All endpoints for connection
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

  /**
   * Layouts parallel activities with container grouping
   */
  private layoutParallelActivityWithContainer(
    activity: IActivity,
    parentId: string,
    x: number,
    y: number,
    isConditionPath: boolean | null = null,
    isRoot: boolean = false,
    additionalParents: string[] = [],
    parentActivityType?: string,
  ): NodePosition {
    const containerId = activity.id ? activity.id : this.getNodeId("parallel-container");
    
    // Calculate container dimensions with more generous padding
    const baseDimensions = this.calculateParallelDimensions(
      activity,
      this.getNodeWidth(activity.type),
      this.getNodeHeight(activity.type)
    );
    const containerDimensions = {
      width: baseDimensions.width + this.spacing.horizontal,
      height: baseDimensions.height + this.spacing.vertical
    };
    
    // Create container node at the same position where parallel node would have been
    const containerX = x - containerDimensions.width / 2;
    const containerY = y;
    
    this.addContainerNode(
      activity,
      containerId,
      containerX,
      containerY,
      containerDimensions.width,
      containerDimensions.height,
      isConditionPath,
      isRoot
    );

    // Connect container to parent
    if (!isRoot) {
      this.addEdge(parentId, containerId, isConditionPath, activity.type, parentActivityType);
      additionalParents.forEach(additionalParentId => {
        this.addEdge(additionalParentId, containerId, isConditionPath, activity.type, parentActivityType);
      });
    }

    // Layout parallel branches directly inside the container WITHOUT an intermediate parallel node
    const subActivities = activity.sub_activities!;
    const branchResults: NodePosition[] = [];
    
    // Calculate positioning for parallel nodes with proportional spacing
    const nodeWidth = this.getNodeWidth('task'); // All task nodes have same width
    const containerPadding = 40; // Padding from container edges for breathing room
    
    // Start Y position accounting for distribution handle
    const branchStartY = 100;
    
    // Calculate proportional spacing for perfect distribution
    const availableWidth = containerDimensions.width - (2 * containerPadding); // Width available for nodes and spacing
    const totalNodeWidth = subActivities.length * nodeWidth; // Total width of all nodes
    const availableSpacing = availableWidth - totalNodeWidth; // Remaining space for gaps
    const nodeSpacing = availableSpacing / (subActivities.length + 1); // Equal gaps (including edges)
    
    // Force coordinate system to start from left edge (x=0) instead of center  
    const coordinateOffset = containerDimensions.width * 0.75; // Offset for centered coordinate system
    const startX = containerPadding + nodeSpacing - coordinateOffset; // Start with padding + first gap
    
    console.log(`🏗️ Parallel Container ${containerId}:`);
    console.log(`   Container dimensions: ${containerDimensions.width}x${containerDimensions.height}`);
    console.log(`   Node count: ${subActivities.length}, Node width: ${nodeWidth}, Spacing: ${nodeSpacing}`);
    console.log(`   Available width: ${availableWidth}, Total node width: ${totalNodeWidth}`);
    console.log(`   Proportional spacing: ${nodeSpacing}, Coordinate offset: ${coordinateOffset}, Start X: ${startX}`);
    
    let maxY = branchStartY;
    
    // Position each node with proper relative coordinates
    for (let i = 0; i < subActivities.length; i++) {
      const subActivity = subActivities[i];
      
      // Calculate X position relative to container (top-left corner of the node)
      const relativeX = startX + (i * (nodeWidth + nodeSpacing));
      
      console.log(`📍 Node ${i} (${subActivity.id || subActivity.type}):`);
      console.log(`   Left edge calculation: ${startX} + (${i} * (${nodeWidth} + ${nodeSpacing})) = ${relativeX}`);
      console.log(`   Node spans from ${relativeX} to ${relativeX + nodeWidth}`);
      
      const result = this.assignPositionsInContainer(
        subActivity,
        containerId,
        relativeX, // This is relative to container, not absolute
        branchStartY,
        null,
        false,
        [],
        containerId,
        NODE_TYPES.PARALLEL,
        true // Skip parent edge for parallel branches
      );
      
      branchResults.push(result);
      maxY = Math.max(maxY, result.lastY);
    }

    // Return branch endpoints for connection, similar to original parallel layout
    if (branchResults.length > 1) {
      // Find the branch that extends furthest down (highest Y coordinate)
      const furthestResult = branchResults.reduce((furthest, current) => 
        current.lastY > furthest.lastY ? current : furthest
      );

      // Return position with all branch endpoints for multi-connection
      // Since child positions are relative to container, convert back to global coordinates
      return {
        lastX: x,
        lastY: y + furthestResult.lastY, // Container Y + relative child Y
        lastId: furthestResult.lastId, // Primary connection point
        branchEndpoints: branchResults.map(result => result.lastId), // All endpoints for connection
      };
    } else {
      // Single branch case - convert relative position back to global
      const singleResult = branchResults[0];
      return singleResult ? {
        lastX: x,
        lastY: y + singleResult.lastY, // Container Y + relative child Y
        lastId: singleResult.lastId
      } : { 
        lastX: x, 
        lastY: y + containerDimensions.height, 
        lastId: containerId 
      };
    }
  }

  /**
   * Assigns positions to nodes within containers (for parent-child relationships)
   */
  private assignPositionsInContainer(
    activity: any,
    parentId: string,
    x: number,
    y: number,
    isConditionPath: boolean | null = null,
    isRoot: boolean = false,
    additionalParents: string[] = [],
    containerId: string,
    parentActivityType?: string,
    skipParentEdge: boolean = false,
  ): NodePosition {
    const currentId = activity.id ? activity.id : this.getNodeId(activity.type);
    const nodeWidth = this.getNodeWidth(activity.type);
    const nodeHeight = this.getNodeHeight(activity.type);

    // For nodes within containers, position relative to container
    const nodeX = x - nodeWidth / 2;
    this.addNode(activity, currentId, nodeX, y, isConditionPath, isRoot, containerId);

    // Only create edges if not skipped (for parallel branches, we skip the parent edge)
    if (!isRoot && !skipParentEdge && parentId !== containerId) {
      this.addEdge(parentId, currentId, isConditionPath, activity.type, parentActivityType);
      additionalParents.forEach(additionalParentId => {
        this.addEdge(additionalParentId, currentId, isConditionPath, activity.type, parentActivityType);
      });
    }

    // Process sub-activities
    if (activity.sub_activities && activity.sub_activities.length > 0) {
      switch (activity.type) {
        case NODE_TYPES.SEQUENTIAL:
          // For sequential activities inside containers, handle sub-activities directly
          let currentSubY = y + nodeHeight + this.spacing.vertical;
          let lastSubResult: NodePosition = { lastX: x, lastY: currentSubY, lastId: currentId };
          
          for (let i = 0; i < activity.sub_activities.length; i++) {
            const subActivity = activity.sub_activities[i];
            const subResult = this.assignPositionsInContainer(
              subActivity,
              lastSubResult.lastId,
              x,
              currentSubY,
              null,
              false,
              [],
              containerId,
              NODE_TYPES.SEQUENTIAL,
              false
            );
            lastSubResult = subResult;
            currentSubY = subResult.lastY + this.spacing.vertical;
          }
          
          return lastSubResult;

        case NODE_TYPES.PARALLEL:
          return this.layoutParallelActivityWithContainer(activity, currentId, x, y, isConditionPath, false, additionalParents, parentActivityType);

        case NODE_TYPES.CONDITION:
          return this.layoutConditionActivity(activity, currentId, x, y + nodeHeight);

        case NODE_TYPES.LOOP:
          return this.layoutLoopActivity(activity, currentId, x, y + nodeHeight);
      }
    }

    return { lastX: x, lastY: y + nodeHeight, lastId: currentId };
  }

  /**
   * Creates a container node (group type) for parallel activities
   */
  private addContainerNode(
    activity: IActivity,
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    isConditionPath: boolean | null = null,
    isRoot: boolean = false,
    explicitContainerType?: string,
  ): void {
    const isParallel = activity.type === NODE_TYPES.PARALLEL || explicitContainerType === 'parallel-container';
    const isLoop = activity.type === NODE_TYPES.LOOP || explicitContainerType === 'loop-container';
    const containerType = explicitContainerType || (isLoop ? 'loop-container' : isParallel ? 'parallel-container' : 'sequential-container');
    
    this.nodes.push({
      id,
      type: containerType,
      position: { x, y },
      style: {
        width,
        height,
      },
      data: {
        id,
        position: { x, y },
        data: null,
        label: `${activity.name || activity.type.charAt(0).toUpperCase() + activity.type.slice(1)} Container`,
        type: containerType,
        activityId: isRoot ? activity.id || "root" : activity.id,
        hasSubActivities: true,
        isConditionTrue: isConditionPath,
        variables: activity.variables,
        condition: isLoop ? (activity.loop_condition ? Object.keys(activity.loop_condition)[0] : activity.condition) : undefined, // Add condition for loop containers
        navigateToNode: this.navigateToNode,
        enableEdit: this.enableEdit,
        onNodeDelete: this.onNodeDelete,
        onNodeUpdate: this.onNodeUpdate,
        // No size restrictions - containers can be resized freely
      },
    });
  }

  /**
   * Creates an empty container that users can fill with child nodes
   */
  private createEmptyContainer(
    activity: any,
    currentId: string,
    parentId: string,
    x: number,
    y: number,
    isConditionPath: boolean | null = null,
    isRoot: boolean = false,
    additionalParents: string[] = [],
    parentActivityType?: string,
  ): NodePosition {
    const nodeWidth = this.getNodeWidth(activity.type);
    const nodeHeight = this.getNodeHeight(activity.type);
    
    // Position the container
    const containerX = x - nodeWidth / 2;
    const containerY = y;
    
    const isParallel = activity.type === NODE_TYPES.PARALLEL_CONTAINER;
    
    // Create the empty container with the new ResizableContainer component
    this.nodes.push({
      id: currentId,
      type: activity.type, // Use the actual container type
      position: { x: containerX, y: containerY },
      style: {
        width: nodeWidth,
        height: nodeHeight,
      },
      data: {
        id: currentId,
        position: { x: containerX, y: containerY },
        data: null,
        label: activity.name || `${activity.type.replace('-container', '').charAt(0).toUpperCase() + activity.type.replace('-container', '').slice(1)} Container`,
        type: activity.type,
        activityId: isRoot ? activity.id || "root" : activity.id,
        hasSubActivities: false, // Start empty
        isConditionTrue: isConditionPath,
        variables: activity.variables,
        condition: activity.type === 'loop-container' ? (activity.loop_condition ? Object.keys(activity.loop_condition)[0] : activity.condition) : undefined,
        navigateToNode: this.navigateToNode,
        enableEdit: this.enableEdit,
        onNodeDelete: this.onNodeDelete,
        onNodeUpdate: this.onNodeUpdate,
        // No size restrictions - containers can be resized freely
      },
    });

    // Connect to parent if not root
    if (!isRoot) {
      this.addEdge(parentId, currentId, isConditionPath, activity.type, parentActivityType);
      additionalParents.forEach(additionalParentId => {
        this.addEdge(additionalParentId, currentId, isConditionPath, activity.type, parentActivityType);
      });
    }

    return { 
      lastX: x, 
      lastY: y + nodeHeight, 
      lastId: currentId 
    };
  }

  /**
   * Layouts sequential activities with container grouping
   */
  private layoutSequentialActivityWithContainer(
    activity: IActivity,
    parentId: string,
    x: number,
    y: number,
    isConditionPath: boolean | null = null,
    isRoot: boolean = false,
    additionalParents: string[] = [],
    parentActivityType?: string,
  ): NodePosition {
    const containerId = activity.id ? activity.id : this.getNodeId("sequential-container");
    
    // Calculate container dimensions with padding
    const baseDimensions = this.calculateSequentialDimensions(
      activity,
      this.getNodeWidth(activity.type),
      this.getNodeHeight(activity.type)
    );
    const containerDimensions = {
      width: baseDimensions.width + this.spacing.horizontal,
      height: baseDimensions.height + this.spacing.vertical
    };
    
    // Create container node
    const containerX = x - containerDimensions.width / 2;
    const containerY = y;
    
    this.addContainerNode(
      activity,
      containerId,
      containerX,
      containerY,
      containerDimensions.width,
      containerDimensions.height,
      isConditionPath,
      isRoot
    );

    // Connect container to parent
    if (!isRoot) {
      this.addEdge(parentId, containerId, isConditionPath, activity.type, parentActivityType);
      additionalParents.forEach(additionalParentId => {
        this.addEdge(additionalParentId, containerId, isConditionPath, activity.type, parentActivityType);
      });
    }

    // Layout sequential activities directly inside the container with improved spacing
    const subActivities = activity.sub_activities!;
    const containerPadding = 20;
    let currentY = containerPadding + 80; // Start below container header, accounting for padding
    let lastResult: NodePosition | null = null;
    
    // Calculate optimal vertical spacing
    const availableHeight = containerDimensions.height - (2 * containerPadding) - 30; // Account for header
    const nodeSpacing = Math.max(this.spacing.vertical * 0.7, availableHeight / (subActivities.length * 2));
    
    // Process each sub-activity with improved centering
    for (let i = 0; i < subActivities.length; i++) {
      const subActivity = subActivities[i];
      const currentParentId = lastResult ? lastResult.lastId : containerId;
      
      if (i > 0) {
        currentY += Math.min(nodeSpacing, this.spacing.vertical);
      }
      
      
      // Skip parent edge for the first activity (it's inside the container)
      const skipParentEdge = i === 0;
      
      const result = this.assignPositionsInContainer(
        subActivity,
        currentParentId,
        containerDimensions.width / 2, // Center horizontally in container
        currentY,
        null,
        false,
        [],
        containerId,
        NODE_TYPES.SEQUENTIAL,
        skipParentEdge
      );
      
      lastResult = result;
      currentY = result.lastY + this.spacing.vertical;
    }

    // Return the last activity's position converted to global coordinates
    return lastResult ? {
      lastX: x,
      lastY: y + (lastResult.lastY),
      lastId: lastResult.lastId,
    } : {
      lastX: x,
      lastY: y + containerDimensions.height,
      lastId: containerId,
    };
  }

  /**
   * Layouts loop activities with container grouping
   */
  private layoutLoopActivityWithContainer(
    activity: IActivity,
    parentId: string,
    x: number,
    y: number,
    isConditionPath: boolean | null = null,
    isRoot: boolean = false,
    additionalParents: string[] = [],
    parentActivityType?: string,
  ): NodePosition {
    const containerId = activity.id ? activity.id : this.getNodeId("loop-container");

    // Calculate container dimensions with padding and extra spacing for loop containers
    const baseDimensions = this.calculateSequentialDimensions(
      activity,
      this.getNodeWidth(activity.type),
      this.getNodeHeight(activity.type)
    );
    const extraVerticalSpacing = 80; // Additional space for top and bottom margins
    const containerDimensions = {
      width: baseDimensions.width + this.spacing.horizontal,
      height: baseDimensions.height + this.spacing.vertical + extraVerticalSpacing
    };
    
    // Create container node
    const containerX = x - containerDimensions.width / 2;
    const containerY = y;
    
    this.addContainerNode(
      activity,
      containerId,
      containerX,
      containerY,
      containerDimensions.width,
      containerDimensions.height,
      isConditionPath,
      isRoot,
      "loop-container"
    );

    // Connect container to parent
    if (!isRoot) {
      this.addEdge(parentId, containerId, isConditionPath, activity.type, parentActivityType);
      additionalParents.forEach(additionalParentId => {
        this.addEdge(additionalParentId, containerId, isConditionPath, activity.type, parentActivityType);
      });
    }

    // Layout loop activities directly inside the container with improved spacing
    const subActivities = activity.sub_activities!;
    const containerPadding = 20;
    const topSpacing = 120; // Increased spacing from inner handler to first node
    const bottomSpacing = 60; // Extra spacing after last node to container bottom
    let currentY = containerPadding + topSpacing; // Start with more space below container header
    let lastResult: NodePosition | null = null;

    // Calculate optimal vertical spacing
    const availableHeight = containerDimensions.height - (2 * containerPadding) - topSpacing - bottomSpacing; // Account for header and extra spacing
    const nodeSpacing = Math.max(this.spacing.vertical * 0.7, availableHeight / (subActivities.length * 2));
    
    // Process each sub-activity with improved centering
    for (let i = 0; i < subActivities.length; i++) {
      const subActivity = subActivities[i];
      const subNodeWidth = this.getNodeWidth(subActivity.type);
      const subX = containerDimensions.width / 2; // Center within container

      // For the first sub-activity, connect it to the container's internal handle
      const parentNodeId = i === 0 ? containerId : (lastResult ? lastResult.lastId : containerId);

      const result = this.assignPositionsInContainer(
        subActivity,
        parentNodeId,
        subX,
        currentY,
        isConditionPath,
        false,
        [],
        activity.type
      );

      // Set extent to keep nodes within container
      const subNode = this.nodes.find(n => n.id === result.lastId);
      if (subNode) {
        subNode.parentId = containerId;
        subNode.extent = 'parent';
      }

      // Create explicit connection from container's internal handle to first sub-activity
      if (i === 0) {
        this.addEdge(containerId, result.lastId, null, activity.type, parentActivityType, 'source-top');
      }

      lastResult = result;
      currentY = result.lastY + nodeSpacing;
    }

    // Note: Loop feedback edges are handled by the loop container's internal logic
    // External connections will use the last sub-activity, not the container

    // Return the last sub-activity as the connection point, not the container
    // This ensures the next sequential task connects to the last node inside the loop
    return lastResult ? {
      lastX: x,
      lastY: y + (lastResult.lastY),
      lastId: lastResult.lastId, // Return the last sub-activity's ID, not the container ID
    } : {
      lastX: x,
      lastY: y + containerDimensions.height,
      lastId: containerId,
    };
  }

  /**
   * Creates an empty sequential container that users can populate
   */
  private layoutSequentialContainer(
    activity: IActivity,
    parentId: string,
    x: number,
    y: number,
    isConditionPath: boolean | null = null,
    isRoot: boolean = false,
    additionalParents: string[] = [],
    parentActivityType?: string,
  ): NodePosition {
    const containerId = activity.id ? activity.id : this.getNodeId("sequential-container");
    const containerDimensions = {
      width: this.getNodeWidth(NODE_TYPES.SEQUENTIAL_CONTAINER),
      height: this.getNodeHeight(NODE_TYPES.SEQUENTIAL_CONTAINER)
    };

    // Create container
    const containerX = x - containerDimensions.width / 2;
    const containerY = y;

    this.addContainerNode(
      activity,
      containerId,
      containerX,
      containerY,
      containerDimensions.width,
      containerDimensions.height,
      isConditionPath,
      isRoot
    );

    // Connect container to parent
    if (!isRoot) {
      this.addEdge(parentId, containerId, isConditionPath, activity.type, parentActivityType);
      additionalParents.forEach(additionalParentId => {
        this.addEdge(additionalParentId, containerId, isConditionPath, activity.type, parentActivityType);
      });
    }

    // Process any existing sub-activities
    if (activity.sub_activities && activity.sub_activities.length > 0) {
      let currentY = this.spacing.vertical / 2;
      let lastResult: NodePosition | null = null;

      for (let i = 0; i < activity.sub_activities.length; i++) {
        const subActivity = activity.sub_activities[i];
        const currentParentId = lastResult ? lastResult.lastId : containerId;

        if (i > 0) {
          currentY += this.spacing.vertical;
        }

        const result = this.assignPositionsInContainer(
          subActivity,
          currentParentId,
          containerDimensions.width / 2,
          currentY,
          null,
          false,
          [],
          containerId,
          undefined,
          false
        );

        lastResult = result;
        currentY = result.lastY + this.spacing.vertical;
      }
    }

    return {
      lastX: x,
      lastY: y + containerDimensions.height,
      lastId: containerId,
    };
  }
}
