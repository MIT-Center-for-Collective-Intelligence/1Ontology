import { Node, NodeChange, applyNodeChanges, Edge } from '@xyflow/react';

/**
 * ContainerManager - Ultra-rigid container-node relationship management
 * 
 * This class implements a snap-to-container system where:
 * - Nodes snap permanently when dropped into containers
 * - Nodes cannot be moved out once inside (locked)
 * - Container expansion captures overlapping nodes
 * - All relationships are permanent and rigid
 * - Children follow containers perfectly during movement
 */
export class ContainerManager {
  private isProcessing = false;
  private snapThreshold = 20; // pixels for snap detection
  private lockedNodes = new Set<string>(); // Track permanently locked nodes
  private onEdgesUpdate?: (edges: Edge[]) => void; // Callback for edge updates

  /**
   * Set callback for edge updates
   */
  public setEdgesUpdateCallback(callback: (edges: Edge[]) => void): void {
    this.onEdgesUpdate = callback;
  }

  /**
   * Main entry point - processes React Flow node changes with container logic
   */
  public onNodesChange(changes: NodeChange[], nodes: Node[]): Node[] {
    // Prevent recursive calls during processing
    if (this.isProcessing) {
      return applyNodeChanges(changes, nodes);
    }

    this.isProcessing = true;
    
    try {
      // First apply React Flow's standard changes
      let updatedNodes = applyNodeChanges(changes, nodes);
      
      // Then apply ultra-rigid container rules
      updatedNodes = this.enforceRigidContainerRelationships(updatedNodes, changes);
      
      return updatedNodes;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Enforces ultra-rigid container-child relationships after any node changes
   * Uses deepest/smallest container priority for nested scenarios
   */
  private enforceRigidContainerRelationships(nodes: Node[], changes: NodeChange[]): Node[] {
    const containers = nodes.filter(node => this.isContainer(node));
    let updatedNodes = [...nodes];
    let edgesChanged = false;
    
    // Process container movements first
    for (const container of containers) {
      const containerPositionChange = changes.find(change => 
        'id' in change && change.id === container.id && change.type === 'position'
      );
      
      if (containerPositionChange) {
        console.log(`🚀 Container ${container.id} moved - forcing children to follow`);
        updatedNodes = this.forceChildrenToFollowContainer(container, updatedNodes);
      }
    }
    
    // Process ALL free nodes (including containers) with smart targeting
    const freeNodes = updatedNodes.filter(node => 
      !node.parentId && !this.lockedNodes.has(node.id)
    );
    
    for (const node of freeNodes) {
      // For container nodes, exclude self and circular references
      let candidateContainers = containers;
      if (this.isContainer(node)) {
        candidateContainers = containers.filter(c => 
          c.id !== node.id && !this.wouldCreateCircularReference(node.id, c.id, updatedNodes)
        );
      }
      
      const targetContainer = this.findBestContainerForNode(node, candidateContainers, updatedNodes);
      if (targetContainer) {
        const nodeType = this.isContainer(node) ? 'Container' : 'Node';
        console.log(`🎯 Smart targeting: ${nodeType} ${node.id} -> Container ${targetContainer.id}`);
        const nodeIndex = updatedNodes.findIndex(n => n.id === node.id);
        if (nodeIndex >= 0) {
          updatedNodes[nodeIndex] = this.snapNodeToContainer(node, targetContainer);
          this.lockedNodes.add(node.id);
          edgesChanged = true;
        }
      }
    }
    
    // Process locked node constraints
    for (const container of containers) {
      const lockedChildren = updatedNodes.filter(n => n.parentId === container.id && this.lockedNodes.has(n.id));
      for (let i = 0; i < updatedNodes.length; i++) {
        const node = updatedNodes[i];
        if (lockedChildren.includes(node)) {
          updatedNodes[i] = this.reinforceNodeLocking(node, container);
        }
      }
    }
    
    // Update container edges if needed
    if (edgesChanged && this.onEdgesUpdate) {
      this.updateContainerEdges(updatedNodes);
    }
    
    return updatedNodes;
  }

  /**
   * Legacy method - kept for dimension changes but main logic moved to smart targeting
   */
  private processRigidContainer(container: Node, nodes: Node[], changes: NodeChange[]): { nodes: Node[]; edgesChanged: boolean } {
    let updatedNodes = [...nodes];
    let edgesChanged = false;
    
    // Check for container expansion (dimension changes)
    const containerDimensionChange = changes.find(change => 
      'id' in change && change.id === container.id && change.type === 'dimensions'
    );

    // Only handle container expansion capture here - main snapping moved to smart targeting
    if (containerDimensionChange) {
      const containerBounds = this.getAbsoluteBounds(container, updatedNodes);
      
      for (let i = 0; i < updatedNodes.length; i++) {
        const node = updatedNodes[i];
        
        // Skip self and already parented nodes
        if (node.id === container.id || node.parentId || this.lockedNodes.has(node.id)) {
          continue;
        }

        const nodeCenter = this.getNodeCenter(node);
        const isInside = this.isPointInBounds(nodeCenter, containerBounds);

        if (isInside) {
          console.log(`📏 Container ${container.id} expanded over node ${node.id} - capturing it`);
          updatedNodes[i] = this.snapNodeToContainer(node, container);
          this.lockedNodes.add(node.id);
          edgesChanged = true;
        }
      }
    }

    return { nodes: updatedNodes, edgesChanged };
  }

  /**
   * Updates container edges - only creates edges from containers to direct task children
   * Does NOT create edges to nested containers or their contents
   */
  private updateContainerEdges(nodes: Node[]): void {
    if (!this.onEdgesUpdate) return;

    const parallelContainers = nodes.filter(node => node.type === 'parallel-container');
    const allEdges: Edge[] = [];

    for (const container of parallelContainers) {
      // Only get direct children that are NOT containers
      const directTaskChildren = nodes.filter(node => 
        node.parentId === container.id && !this.isContainer(node)
      );
      
      if (directTaskChildren.length > 0) {
        // Create edges from parallel container to direct task children only
        const containerEdges = directTaskChildren.map((child, index) => ({
          id: `container-${container.id}-to-${child.id}`,
          source: container.id,
          target: child.id,
          sourceHandle: 'source-top', // Container's top source handle for distribution
          targetHandle: null,  // Child's target handle (top) - null uses default  
          type: 'default',
          style: {
            stroke: '#9c27b0', // Purple for parallel containers
            strokeWidth: 2,
          },
          data: {
            containerEdge: true,
            containerType: 'parallel',
          },
        }));

        allEdges.push(...containerEdges);
      }
    }

    // Sequential containers don't get automatic edges - they rely on normal flow connections
    console.log(`📊 Created ${allEdges.length} container edges (parallel containers to direct tasks only)`);
    this.onEdgesUpdate(allEdges);
  }

  /**
   * Forces all locked children to follow their container during movement
   */
  private forceChildrenToFollowContainer(container: Node, nodes: Node[]): Node[] {
    const lockedChildren = nodes.filter(n => n.parentId === container.id && this.lockedNodes.has(n.id));
    
    if (lockedChildren.length === 0) return nodes;
    
    console.log(`🔄 Forcing ${lockedChildren.length} locked children to follow container`);
    
    return nodes.map(node => {
      if (node.parentId === container.id && this.lockedNodes.has(node.id)) {
        return {
          ...node,
          // Reinforce the parent-child relationship
          parentId: container.id,
          extent: 'parent' as const,
          draggable: true, // Allow movement within container
          // Force React Flow to recalculate by updating data
          data: {
            ...node.data,
            _containerMoved: true,
            _moveTime: Date.now(),
            _forceSync: Math.random(), // Force React to re-render
          },
          // Ensure locked styling is maintained
          style: {
            ...node.style,
            borderLeft: '3px solid #4caf50', // Subtle left accent
          }
        };
      }
      return node;
    });
  }

  /**
   * Snaps a node to container with ultra-rigid locking (supports containers and tasks)
   */
  private snapNodeToContainer(node: Node, container: Node): Node {
    const containerBounds = this.getNodeBounds(container);
    const nodeBounds = this.getNodeBounds(node);
    const isNestedContainer = this.isContainer(node);
    
    // Calculate optimal snap position with padding
    const padding = isNestedContainer ? 20 : 15; // More padding for nested containers
    const headerHeight = 35;
    
    let snapX = Math.max(padding, node.position.x - containerBounds.x);
    let snapY = Math.max(padding + headerHeight, node.position.y - containerBounds.y);
    
    // Ensure node fits within container
    const maxX = containerBounds.width - nodeBounds.width - padding;
    const maxY = containerBounds.height - nodeBounds.height - padding;
    snapX = Math.min(snapX, Math.max(padding, maxX));
    snapY = Math.min(snapY, Math.max(padding + headerHeight, maxY));
    
    // Special handling for nested containers
    const lockType = isNestedContainer ? 'nested-container' : 'snap';
    const borderColor = isNestedContainer ? '#2196f3' : '#4caf50'; // Blue for nested containers
    
    return {
      ...node,
      parentId: container.id,
      extent: 'parent' as const, // This constrains movement to within parent bounds
      position: { x: snapX, y: snapY },
      draggable: true, // Allow movement within container
      data: {
        ...node.data,
        _snappedToContainer: container.id,
        _snapTime: Date.now(),
        _originalDraggable: node.draggable ?? true,
        _isLocked: true,
        _lockType: lockType,
        _isNestedContainer: isNestedContainer,
      },
      style: {
        ...node.style,
        // Visual feedback for locked nodes
        borderLeft: `3px solid ${borderColor}`,
        // Add subtle background for nested containers
        ...(isNestedContainer && {
          backgroundColor: 'rgba(33, 150, 243, 0.05)',
          borderRadius: '8px',
        }),
      }
    };
  }

  /**
   * Reinforces node locking - prevents any escape attempts
   */
  private reinforceNodeLocking(node: Node, container: Node): Node {
    const containerBounds = this.getNodeBounds(container);
    const nodeBounds = this.getNodeBounds(node);
    const padding = 15;
    
    // Force node to stay within strict container bounds
    let constrainedX = node.position.x;
    let constrainedY = node.position.y;
    
    // Apply ultra-strict constraints
    constrainedX = Math.max(padding, constrainedX);
    constrainedY = Math.max(padding + 35, constrainedY);
    constrainedX = Math.min(constrainedX, containerBounds.width - nodeBounds.width - padding);
    constrainedY = Math.min(constrainedY, containerBounds.height - nodeBounds.height - padding);
    
    return {
      ...node,
      position: { x: constrainedX, y: constrainedY },
      parentId: container.id, // Reinforce parent relationship
      extent: 'parent' as const, // React Flow handles boundary constraints
      draggable: true, // Allow movement within container
      data: {
        ...node.data,
        _lockReinforced: true,
        _reinforceTime: Date.now(),
        _isLocked: true,
      },
      style: {
        ...node.style,
        borderLeft: '3px solid #4caf50', // Subtle left accent
      }
    };
  }

  /**
   * Handle container deletion - unlock and release child nodes (including nested containers)
   */
  public handleContainerDeletion(deletedContainerId: string, nodes: Node[]): Node[] {
    // Trigger edge cleanup for all container types
    const deletedContainer = nodes.find(n => n.id === deletedContainerId);
    if (this.isContainer(deletedContainer) && this.onEdgesUpdate) {
      // Remove all edges associated with this container
      this.onEdgesUpdate([]);
      console.log(`🗑️ Cleaned up edges for deleted container ${deletedContainerId}`);
    }
    
    return nodes.map(node => {
      if (node.parentId === deletedContainerId) {
        // Convert child back to absolute positioning and unlock
        const container = nodes.find(n => n.id === deletedContainerId);
        if (container) {
          const containerBounds = this.getNodeBounds(container);
          const { parentId, extent, ...nodeWithoutParent } = node;
          const isNestedContainer = this.isContainer(node);
          
          // Remove from locked nodes set
          this.lockedNodes.delete(node.id);
          
          console.log(`🆓 Releasing ${isNestedContainer ? 'nested container' : 'node'} ${node.id} from deleted container ${deletedContainerId}`);
          
          return {
            ...nodeWithoutParent,
            position: {
              x: containerBounds.x + node.position.x,
              y: containerBounds.y + node.position.y,
            },
            draggable: node.data?._originalDraggable ?? true, // Restore draggability
            data: {
              ...node.data,
              _orphanedFrom: deletedContainerId,
              _orphanedAt: Date.now(),
              _isLocked: false,
              _snappedToContainer: undefined,
              _isNestedContainer: undefined,
            },
            style: {
              // Remove locked styling
              borderLeft: undefined,
              backgroundColor: undefined,
              borderRadius: undefined,
            }
          };
        }
      }
      return node;
    });
  }

  /**
   * Utility: Check if node is a container type
   */
  private isContainer(node: Node): boolean {
    return node.type === 'sequential-container' || node.type === 'parallel-container' || node.type === 'loop-container';
  }

  /**
   * Utility: Get comprehensive node bounds for collision detection
   */
  private getNodeBounds(node: Node) {
    // Get actual measured dimensions if available, otherwise use defaults
    const width = node.measured?.width || 
      node.style?.width || 
      (this.isContainer(node) ? 300 : 160);
    const height = node.measured?.height || 
      node.style?.height || 
      (this.isContainer(node) ? 200 : 60);
    
    return {
      x: node.position.x,
      y: node.position.y,
      width: typeof width === 'string' ? parseInt(width) : width,
      height: typeof height === 'string' ? parseInt(height) : height,
    };
  }

  /**
   * Utility: Get center point of a node for collision detection
   */
  private getNodeCenter(node: Node) {
    const bounds = this.getNodeBounds(node);
    return {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    };
  }

  /**
   * Utility: Check if point is within bounds (with optional threshold)
   */
  private isPointInBounds(
    point: { x: number; y: number }, 
    bounds: { x: number; y: number; width: number; height: number },
    threshold: number = 0
  ) {
    return point.x >= bounds.x - threshold &&
           point.x <= bounds.x + bounds.width + threshold &&
           point.y >= bounds.y - threshold &&
           point.y <= bounds.y + bounds.height + threshold;
  }

  /**
   * Validate container-child relationships for debugging
   */
  public validateRelationships(nodes: Node[]): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const containers = new Set(nodes.filter(this.isContainer).map(n => n.id));
    
    for (const node of nodes) {
      if (node.parentId) {
        // Check if parent exists
        if (!containers.has(node.parentId)) {
          errors.push(`Node ${node.id} has non-existent parent ${node.parentId}`);
        }
        
        // Check if extent is properly set
        if (node.extent !== 'parent') {
          warnings.push(`Node ${node.id} has parentId but extent is not 'parent'`);
        }

        // Check if locked nodes have proper parent relationship
        if (this.lockedNodes.has(node.id) && !node.parentId) {
          warnings.push(`Locked node ${node.id} should have a parentId`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Debug method to log current relationships and constrained nodes
   */
  public debugRelationships(nodes: Node[]): void {
    console.group('📌 Container Snap System Debug');
    
    const containers = nodes.filter(this.isContainer);
    const orphans = nodes.filter(n => !this.isContainer(n) && !n.parentId);
    const constrainedNodes = nodes.filter(n => this.lockedNodes.has(n.id));
    
    console.log(`📊 Summary:`, {
      containers: containers.length,
      orphans: orphans.length,
      constrainedNodes: constrainedNodes.length,
      totalConstrained: this.lockedNodes.size
    });
    
    containers.forEach(container => {
      const children = nodes.filter(n => n.parentId === container.id);
      const constrainedChildren = children.filter(c => this.lockedNodes.has(c.id));
      console.log(`🏠 Container ${container.id} (${container.type}):`, {
        children: children.length,
        constrainedChildren: constrainedChildren.length,
        childIds: children.map(c => `${c.id}${this.lockedNodes.has(c.id) ? ' 📌' : ''}`),
        bounds: this.getNodeBounds(container)
      });
    });

    if (constrainedNodes.length > 0) {
      console.log(`📌 Constrained nodes (can move within containers):`, constrainedNodes.map(n => ({ 
        id: n.id, 
        container: n.parentId,
        position: n.position,
        draggable: n.draggable,
      })));
    }

    if (orphans.length > 0) {
      console.log(`🚫 Orphan nodes:`, orphans.map(n => ({ id: n.id, type: n.type, position: n.position })));
    }

    const validation = this.validateRelationships(nodes);
    if (!validation.isValid) {
      console.error('❌ Validation errors:', validation.errors);
    }
    if (validation.warnings.length > 0) {
      console.warn('⚠️ Validation warnings:', validation.warnings);
    }
    
    console.groupEnd();
  }

  /**
   * Get locked nodes for debugging
   */
  public getLockedNodes(): Set<string> {
    return new Set(this.lockedNodes);
  }

  /**
   * Clear all locked nodes (for reset)
   */
  public clearAllLocks(): void {
    this.lockedNodes.clear();
    console.log('🆓 All node locks cleared');
  }

  /**
   * Check if a node is locked
   */
  public isNodeLocked(nodeId: string): boolean {
    return this.lockedNodes.has(nodeId);
  }

  /**
   * Check if creating a parent-child relationship would create a circular reference
   */
  private wouldCreateCircularReference(childId: string, parentId: string, nodes: Node[]): boolean {
    // If child would become parent of its own ancestor, that's circular
    return this.isAncestor(childId, parentId, nodes);
  }

  /**
   * Check if ancestorId is an ancestor of descendantId
   */
  private isAncestor(ancestorId: string, descendantId: string, nodes: Node[]): boolean {
    const descendant = nodes.find(n => n.id === descendantId);
    if (!descendant || !descendant.parentId) {
      return false;
    }
    
    if (descendant.parentId === ancestorId) {
      return true;
    }
    
    // Recursively check up the parent chain
    return this.isAncestor(ancestorId, descendant.parentId, nodes);
  }

  /**
   * Finds the best container for a node using smart targeting:
   * 1. Smallest area (most precise fit) - prioritize smaller containers
   * 2. Deepest nested container (most specific)  
   * 3. Closest center distance (nearest match)
   */
  private findBestContainerForNode(node: Node, containers: Node[], allNodes: Node[]): Node | null {
    const nodeCenter = this.getNodeCenter(node);
    const candidateContainers: Array<{
      container: Node;
      bounds: ReturnType<typeof this.getNodeBounds>;
      area: number;
      depth: number;
      distance: number;
    }> = [];

    console.log(`🔍 Finding best container for ${node.id} at center (${nodeCenter.x}, ${nodeCenter.y})`);

    // Find all containers that contain the node
    for (const container of containers) {
      const containerBounds = this.getAbsoluteBounds(container, allNodes);
      const isInside = this.isPointInBounds(nodeCenter, containerBounds);
      
      console.log(`   Container ${container.id}: bounds (${containerBounds.x}, ${containerBounds.y}, ${containerBounds.width}x${containerBounds.height}) - inside: ${isInside}`);
      
      if (isInside) {
        const area = containerBounds.width * containerBounds.height;
        const depth = this.getContainerDepth(container, allNodes);
        const containerCenter = {
          x: containerBounds.x + containerBounds.width / 2,
          y: containerBounds.y + containerBounds.height / 2
        };
        const distance = Math.sqrt(
          Math.pow(nodeCenter.x - containerCenter.x, 2) + 
          Math.pow(nodeCenter.y - containerCenter.y, 2)
        );
        
        candidateContainers.push({
          container,
          bounds: containerBounds,
          area,
          depth,
          distance
        });
        
        console.log(`     ✅ Candidate: area=${area}, depth=${depth}, distance=${distance.toFixed(1)}`);
      }
    }

    if (candidateContainers.length === 0) {
      console.log(`❌ No candidate containers found for ${node.id}`);
      return null;
    }

    // Sort by priority: SMALLEST area first (most precise), then deepest, then closest
    candidateContainers.sort((a, b) => {
      if (a.area !== b.area) return a.area - b.area;     // 🎯 SMALLER FIRST!
      if (a.depth !== b.depth) return b.depth - a.depth; // Then deeper first
      return a.distance - b.distance;                     // Then closer first
    });

    const best = candidateContainers[0];
    console.log(`🎯 Best container for ${node.id}: ${best.container.id} (area: ${best.area}, depth: ${best.depth}, distance: ${best.distance.toFixed(1)})`);
    console.log(`🏆 Winner: ${best.container.id} beats ${candidateContainers.length - 1} other candidates`);
    
    return best.container;
  }

  /**
   * Get the absolute bounds of a container, accounting for nested positioning
   */
  private getAbsoluteBounds(node: Node, allNodes: Node[]): ReturnType<typeof this.getNodeBounds> {
    const baseBounds = this.getNodeBounds(node);
    
    // If node has a parent, add parent's absolute position
    if (node.parentId) {
      const parent = allNodes.find(n => n.id === node.parentId);
      if (parent) {
        const parentAbsoluteBounds = this.getAbsoluteBounds(parent, allNodes);
        return {
          x: parentAbsoluteBounds.x + baseBounds.x,
          y: parentAbsoluteBounds.y + baseBounds.y,
          width: baseBounds.width,
          height: baseBounds.height
        };
      }
    }
    
    return baseBounds;
  }

  /**
   * Get the nesting depth of a container (how many levels deep it is)
   */
  private getContainerDepth(container: Node, allNodes: Node[]): number {
    let depth = 0;
    let current = container;
    
    while (current.parentId) {
      const parent = allNodes.find(n => n.id === current.parentId);
      if (!parent || !this.isContainer(parent)) break;
      depth++;
      current = parent;
    }
    
    return depth;
  }

  /**
   * Unlocks a specific node (for manual override if needed)
   */
  public unlockNode(nodeId: string, nodes: Node[]): Node[] {
    this.lockedNodes.delete(nodeId);
    console.log(`🔓 Manually unlocked node: ${nodeId}`);
    
    return nodes.map(node => {
      if (node.id === nodeId) {
        const { parentId, extent, ...nodeWithoutParent } = node;
        const container = nodes.find(n => n.id === parentId);
        const containerBounds = container ? this.getNodeBounds(container) : null;
        
        return {
          ...nodeWithoutParent,
          position: containerBounds ? {
            x: containerBounds.x + node.position.x,
            y: containerBounds.y + node.position.y,
          } : node.position,
          draggable: node.data?._originalDraggable ?? true,
          data: {
            ...node.data,
            _isLocked: false,
            _unlockedManually: true,
            _unlockTime: Date.now(),
          },
          style: {
            // Remove locked styling
            borderLeft: undefined,
          }
        };
      }
      return node;
    });
  }
}