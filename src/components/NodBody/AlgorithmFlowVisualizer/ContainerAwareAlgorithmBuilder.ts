import { IAlgorithm, IActivity } from "@components/types/INode";

/**
 * ContainerAwareAlgorithmBuilder - Builds algorithm structures from React Flow nodes
 * 
 * This utility leverages React Flow's parent-child relationships (parentId) to build
 * accurate algorithm structures from the current flowchart state, specifically designed
 * to work with our container-based approach.
 */
export class ContainerAwareAlgorithmBuilder {
  private nodes: any[];
  private edges: any[];

  constructor(nodes: any[], edges: any[]) {
    this.nodes = nodes;
    this.edges = edges;
  }

  /**
   * Builds a complete algorithm structure from the current flowchart
   */
  public buildAlgorithm(baseAlgorithm: IAlgorithm): IAlgorithm {
    console.log('🏗️ Building algorithm from current flowchart state');
    console.log('📊 Input:', {
      nodes: this.nodes.length,
      edges: this.edges.length,
      baseAlgorithm: baseAlgorithm.name
    });

    // Get root-level nodes (nodes without parents and not targets of conditions/loops)
    const rootNodes = this.getRootLevelNodes();
    console.log('🌳 Found root-level nodes:', rootNodes.length);

    // Build the sub-activities from root nodes
    const subActivities = this.buildActivitiesFromNodes(rootNodes);

    const result: IAlgorithm = {
      ...baseAlgorithm,
      sub_activities: subActivities
    };

    console.log('✅ Algorithm built successfully:', {
      subActivities: result.sub_activities.length,
      rootType: result.type
    });

    return result;
  }

  /**
   * Gets truly root-level nodes that aren't controlled by conditions/loops
   */
  private getRootLevelNodes(): any[] {
    // Get nodes without parents
    const noParentNodes = this.nodes.filter(node => !node.parentId);
    
    // Find nodes that are targets of condition or loop edges
    const controlledNodes = new Set<string>();
    
    this.edges.forEach(edge => {
      const sourceNode = this.nodes.find(n => n.id === edge.source);
      if (sourceNode && (sourceNode.type === 'condition' || sourceNode.type === 'loop')) {
        controlledNodes.add(edge.target);
      }
    });
    
    // Filter out controlled nodes from root-level processing
    const rootNodes = noParentNodes.filter(node => !controlledNodes.has(node.id));
    
    console.log(`🎯 Filtered nodes: ${noParentNodes.length} no-parent → ${rootNodes.length} truly root`);
    console.log(`🎮 Controlled nodes (excluded from root):`, Array.from(controlledNodes));
    
    return rootNodes;
  }

  /**
   * Builds activities from a list of nodes, respecting container hierarchies
   */
  private buildActivitiesFromNodes(nodeList: any[]): IActivity[] {
    const activities: IActivity[] = [];

    // Sort nodes to ensure consistent ordering (by position or creation time)
    const sortedNodes = [...nodeList].sort((a, b) => {
      // Sort by Y position first, then X position
      if (Math.abs(a.position.y - b.position.y) > 10) {
        return a.position.y - b.position.y;
      }
      return a.position.x - b.position.x;
    });

    for (const node of sortedNodes) {
      const activity = this.buildActivityFromNode(node);
      if (activity) {
        activities.push(activity);
      }
    }

    return activities;
  }

  /**
   * Builds a single activity from a node, handling different node types
   */
  private buildActivityFromNode(node: any): IActivity | null {
    console.log(`🔨 Building activity from node: ${node.id} (${node.type})`);

    switch (node.type) {
      case 'task':
        return this.buildTaskActivity(node);
      
      case 'condition':
        return this.buildConditionActivity(node);
      
      case 'loop':
        return this.buildLoopActivity(node);
      
      case 'sequential-container':
        return this.buildSequentialActivity(node);
      
      case 'parallel-container':
        return this.buildParallelActivity(node);
      
      default:
        console.warn(`⚠️ Unknown node type: ${node.type}`);
        return null;
    }
  }

  /**
   * Builds a task activity
   */
  private buildTaskActivity(node: any): IActivity {
    return {
      id: node.data.activityId || node.id,
      name: node.data.label || 'Task',
      type: 'task',
      node_id: node.data.node_id
    };
  }

  /**
   * Builds a condition activity with true/false branches
   */
  private buildConditionActivity(node: any): IActivity {
    console.log(`🔀 Building condition activity: ${node.id}`);
    
    // Find edges from this condition node
    const trueEdges = this.edges.filter(edge => 
      edge.source === node.id && edge.sourceHandle === 'true'
    );
    const falseEdges = this.edges.filter(edge => 
      edge.source === node.id && edge.sourceHandle === 'false'
    );

    // Get target nodes for true/false branches
    const trueBranchNodes = trueEdges
      .map(edge => this.nodes.find(n => n.id === edge.target))
      .filter(Boolean);
    
    const falseBranchNodes = falseEdges
      .map(edge => this.nodes.find(n => n.id === edge.target))
      .filter(Boolean);

    console.log(`  True branch: ${trueBranchNodes.length} nodes`);
    console.log(`  False branch: ${falseBranchNodes.length} nodes`);

    const subActivities: IActivity[] = [
      ...this.buildActivitiesFromNodes(trueBranchNodes),
      ...this.buildActivitiesFromNodes(falseBranchNodes)
    ];

    const conditionExpression = node.data.condition || 
      `${node.data.variables?.[0] || 'condition'} == true`;

    return {
      id: node.data.activityId || node.id,
      name: node.data.label || 'Condition',
      type: 'condition',
      condition: { [conditionExpression]: true },
      variables: node.data.variables || [],
      sub_activities: subActivities
    };
  }

  /**
   * Builds a loop activity
   */
  private buildLoopActivity(node: any): IActivity {
    console.log(`🔄 Building loop activity: ${node.id}`);
    
    // Find edges from this loop node (usually to body activities)
    const bodyEdges = this.edges.filter(edge => 
      edge.source === node.id && edge.sourceHandle !== 'loop'
    );

    // Get target nodes for loop body
    const bodyNodes = bodyEdges
      .map(edge => this.nodes.find(n => n.id === edge.target))
      .filter(Boolean);

    console.log(`  Loop body: ${bodyNodes.length} nodes`);

    const subActivities = this.buildActivitiesFromNodes(bodyNodes);
    const loopCondition = node.data.condition || 
      `${node.data.variables?.[0] || 'N'} > 0`;

    return {
      id: node.data.activityId || node.id,
      name: node.data.label || 'Loop',
      type: 'loop',
      loop_condition: { [loopCondition]: true },
      variables: node.data.variables || [],
      sub_activities: subActivities
    };
  }

  /**
   * Builds a sequential activity from a container
   */
  private buildSequentialActivity(node: any): IActivity {
    console.log(`📋 Building sequential activity from container: ${node.id}`);
    
    // Get child nodes using parentId relationship
    const childNodes = this.nodes.filter(childNode => childNode.parentId === node.id);
    console.log(`  Children in container: ${childNodes.length}`);

    // Sort children by position (top to bottom for sequential)
    const sortedChildren = [...childNodes].sort((a, b) => a.position.y - b.position.y);

    const subActivities = this.buildActivitiesFromNodes(sortedChildren);

    return {
      id: node.data.activityId || node.id,
      name: node.data.label || 'Sequential Process',
      type: 'sequential',
      sub_activities: subActivities
    };
  }

  /**
   * Builds a parallel activity from a container
   */
  private buildParallelActivity(node: any): IActivity {
    console.log(`⚡ Building parallel activity from container: ${node.id}`);
    
    // Get child nodes using parentId relationship
    const childNodes = this.nodes.filter(childNode => childNode.parentId === node.id);
    console.log(`  Children in container: ${childNodes.length}`);

    // Sort children by position (left to right for parallel)
    const sortedChildren = [...childNodes].sort((a, b) => a.position.x - b.position.x);

    const subActivities = this.buildActivitiesFromNodes(sortedChildren);

    return {
      id: node.data.activityId || node.id,
      name: node.data.label || 'Parallel Process',
      type: 'parallel',
      sub_activities: subActivities
    };
  }

  /**
   * Debug helper - prints the node hierarchy
   */
  public debugNodeHierarchy(): void {
    console.log('🌳 Node Hierarchy Debug:');
    
    const rootNodes = this.nodes.filter(node => !node.parentId);
    console.log(`Root nodes (${rootNodes.length}):`, rootNodes.map(n => `${n.id} (${n.type})`));

    const containers = this.nodes.filter(node => 
      node.type === 'sequential-container' || node.type === 'parallel-container'
    );

    containers.forEach(container => {
      const children = this.nodes.filter(node => node.parentId === container.id);
      console.log(`Container ${container.id} (${container.type}): ${children.length} children`);
      children.forEach(child => {
        console.log(`  - ${child.id} (${child.type}) at (${child.position.x}, ${child.position.y})`);
      });
    });

    // Check for orphaned nodes
    const orphanedNodes = this.nodes.filter(node => 
      node.parentId && !this.nodes.find(parent => parent.id === node.parentId)
    );
    if (orphanedNodes.length > 0) {
      console.warn('⚠️ Orphaned nodes (parent not found):', orphanedNodes.map(n => n.id));
    }
  }

  /**
   * Validates the current node structure
   */
  public validateStructure(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for orphaned nodes
    const orphanedNodes = this.nodes.filter(node => 
      node.parentId && !this.nodes.find(parent => parent.id === node.parentId)
    );
    if (orphanedNodes.length > 0) {
      errors.push(`Found ${orphanedNodes.length} orphaned nodes with missing parents`);
    }

    // Check for circular parent relationships
    for (const node of this.nodes) {
      if (node.parentId && this.hasCircularParent(node.id, node.parentId, new Set())) {
        errors.push(`Circular parent relationship detected for node ${node.id}`);
      }
    }

    // Check for containers with no children
    const emptyContainers = this.nodes.filter(node => 
      (node.type === 'sequential-container' || node.type === 'parallel-container') &&
      !this.nodes.some(child => child.parentId === node.id)
    );
    if (emptyContainers.length > 0) {
      console.info(`ℹ️ Found ${emptyContainers.length} empty containers (this is okay)`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Helper to detect circular parent relationships
   */
  private hasCircularParent(nodeId: string, parentId: string, visited: Set<string>): boolean {
    if (visited.has(parentId)) {
      return true;
    }
    
    visited.add(parentId);
    const parentNode = this.nodes.find(n => n.id === parentId);
    
    if (parentNode?.parentId) {
      return this.hasCircularParent(nodeId, parentNode.parentId, visited);
    }
    
    return false;
  }
}