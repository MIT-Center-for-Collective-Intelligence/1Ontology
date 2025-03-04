/**
 * Node Parts Service
 * 
 * This service manages the part-whole relationships between nodes in the system.
 * It handles the bidirectional "parts" and "isPartOf" relationships, ensuring
 * data integrity and proper collection organization for these relationships.
 * 
 * Key responsibilities:
 * - Managing part-whole relationships between nodes (parts, isPartOf)
 * - Creating, updating, and deleting collections for parts and isPartOf
 * - Moving and reordering parts within collections
 * - Ensuring bidirectional integrity (when A is part of B, B has A as a part)
 * - Preventing circular references in part hierarchies
 * - Normalizing parts data structures
 * 
 * These part-whole relationships are crucial for modeling compositional 
 * structures in the knowledge graph, allowing nodes to be composed of other
 * nodes while maintaining proper references in both directions.
 */

import { db } from " @components/lib/firestoreServer/admin";
import { ApiKeyValidationError } from " @components/types/api";
import { INode, ICollection } from " @components/types/INode";
import { NODES } from " @components/lib/firestoreClient/collections";
import { ChangelogService } from "./changelog";

export class NodePartsService {

  // SECTION 1: PARTS MANAGEMENT
  // ===========================
  // Methods for adding, removing, and organizing parts
  // (nodes that compose another node)
  // - addParts - Adds component nodes to a container node
  // - removeParts - Removes component nodes from a container
  // - createPartsCollection - Creates a new collection for organizing parts
  // - deletePartsCollection - Deletes a parts collection
  // - reorderParts - Changes the order of parts within a collection
  // - wouldCreateCircularPartReference - Checks if adding a part would create a circular reference

  /**
    * Adds parts to a node
    * 
    * This method establishes part-whole relationships between nodes while
    * maintaining data consistency and bidirectional references.
    * 
    * @param nodeId - ID of the container node
    * @param nodes - Array of node IDs to add as parts
    * @param uname - Username performing the operation
    * @param reasoning - Reason for the change
    * @param collectionName - Optional collection name (defaults to 'main')
    * @returns Promise<INode> - Updated node with new parts
    * @throws Error for validation failures or database errors
    */
  static async addParts(
    nodeId: string,
    nodes: { id: string }[],
    uname: string,
    reasoning: string,
    collectionName: string = 'main'
  ): Promise<INode> {
    try {
      // Input validation
      if (!nodeId?.trim()) {
        throw new ApiKeyValidationError('Invalid node ID. Please provide a valid node identifier.');
      }
      if (!Array.isArray(nodes) || nodes.length === 0) {
        throw new ApiKeyValidationError('No part nodes provided. Please specify at least one node to add.');
      }
      if (!uname?.trim()) {
        throw new ApiKeyValidationError('Username is required for tracking changes.');
      }

      const nodeRef = db.collection(NODES).doc(nodeId);

      return await db.runTransaction(async (transaction) => {
        // Step 1: Collect all references that need to be read
        const partRefs = nodes.map(node =>
          db.collection(NODES).doc(node.id)
        );
        const allRefs = [nodeRef, ...partRefs];

        // Step 2: Execute all reads first (Firestore requirement)
        const docs = await Promise.all(
          allRefs.map(ref => transaction.get(ref))
        );

        // Step 3: Process the read results
        const [nodeDoc, ...partDocs] = docs;

        if (!nodeDoc.exists) {
          throw new Error(`Container node ${nodeId} not found`);
        }

        const currentNode = nodeDoc.data() as INode;
        if (currentNode.deleted) {
          throw new Error(`Cannot update deleted node ${nodeId}`);
        }

        // Keep a copy of the original parts for the changelog
        const originalParts = JSON.parse(JSON.stringify(currentNode.properties.parts || []));

        // Verify all part nodes exist and aren't deleted
        const nodesMap = new Map<string, INode>();
        partDocs.forEach((doc, index) => {
          const nodeId = nodes[index].id;
          if (!doc.exists) {
            throw new ApiKeyValidationError(
              `Part node ${nodeId} not found. Please verify the node exists.`
            );
          }
          const nodeData = doc.data() as INode;
          if (nodeData.deleted) {
            throw new ApiKeyValidationError(
              `Part node ${nodeId} is deleted and cannot be added as a part.`
            );
          }
          nodesMap.set(doc.id, nodeData);
        });

        // Check for circular references
        for (const node of nodes) {
          if (this.wouldCreateCircularPartReference(nodeId, node.id, nodesMap)) {
            throw new ApiKeyValidationError(
              `Adding node ${node.id} as a part would create a circular reference.`
            );
          }
        }

        // Step 4: Prepare updates
        const parts = Array.isArray(currentNode.properties.parts)
          ? [...currentNode.properties.parts]
          : [{ collectionName: 'main', nodes: [] }];

        let collection = parts.find(c => c.collectionName === collectionName);

        if (!collection) {
          collection = { collectionName, nodes: [] };
          parts.push(collection);
        }

        // Add new nodes that aren't already in the collection
        const existingIds = new Set(collection.nodes.map(n => n.id));
        const newNodes = nodes.filter(node => !existingIds.has(node.id));

        if (newNodes.length === 0) {
          return currentNode; // No changes needed
        }

        collection.nodes.push(...newNodes);

        // Step 5: Prepare all updates
        const updates = new Map<string, any>();

        // Update container node
        const updatedNode: INode = {
          ...currentNode,
          properties: {
            ...currentNode.properties,
            parts
          },
          contributors: Array.from(new Set([...(currentNode.contributors || []), uname]))
        };

        updates.set(nodeRef.path, {
          'properties.parts': parts,
          contributors: updatedNode.contributors
        });

        // Update part nodes with bidirectional relationships (isPartOf)
        for (const newNode of newNodes) {
          const partDoc = partDocs[nodes.findIndex(n => n.id === newNode.id)];
          const partData = partDoc.data() as INode;

          const isPartOf = Array.isArray(partData.properties.isPartOf)
            ? [...partData.properties.isPartOf]
            : [{ collectionName: 'main', nodes: [] }];

          let mainCollection = isPartOf.find(c => c.collectionName === 'main');

          if (!mainCollection) {
            mainCollection = { collectionName: 'main', nodes: [] };
            isPartOf.push(mainCollection);
          }

          if (!mainCollection.nodes.some(n => n.id === nodeId)) {
            mainCollection.nodes.push({ id: nodeId });
            updates.set(partDoc.ref.path, {
              'properties.isPartOf': isPartOf,
              contributors: Array.from(new Set([...(partData.contributors || []), uname]))
            });
          }
        }

        // Step 6: Execute all writes
        for (const [path, updateData] of updates) {
          transaction.update(db.doc(path), updateData);
        }

        // Step 7: Create changelog
        await ChangelogService.log(
          nodeId,
          uname,
          'add element',
          updatedNode,
          reasoning,
          'parts',
          originalParts,
          [...updatedNode.properties.parts],
        );

        return updatedNode;
      });
    } catch (error) {
      console.error('Error adding parts:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to add parts: ${errorMessage}`);
    }
  }

  /**
   * Removes parts from a node
   * 
   * This method removes part-whole relationships while maintaining
   * data consistency and bidirectional references.
   * 
   * @param nodeId - ID of the container node
   * @param nodes - Array of node IDs to remove from parts
   * @param uname - Username performing the operation
   * @param reasoning - Reason for the change
   * @returns Promise<INode> - Updated node without removed parts
   * @throws Error for validation failures or database errors
   */
  static async removeParts(
    nodeId: string,
    nodes: { id: string }[],
    uname: string,
    reasoning: string
  ): Promise<INode> {
    try {
      // Input validation
      if (!nodeId?.trim()) {
        throw new Error('Invalid node ID');
      }
      if (!Array.isArray(nodes) || nodes.length === 0) {
        throw new Error('No part nodes provided');
      }
      if (!uname?.trim()) {
        throw new Error('Username is required');
      }

      const nodeRef = db.collection(NODES).doc(nodeId);

      return await db.runTransaction(async (transaction) => {
        // Step 1: Collect all references
        const partRefs = nodes.map(node =>
          db.collection(NODES).doc(node.id)
        );
        const allRefs = [nodeRef, ...partRefs];

        // Step 2: Execute all reads first
        const docs = await Promise.all(
          allRefs.map(ref => transaction.get(ref))
        );

        // Step 3: Process read results
        const [nodeDoc, ...partDocs] = docs;

        if (!nodeDoc.exists) {
          throw new Error(`Node ${nodeId} not found`);
        }

        const currentNode = nodeDoc.data() as INode;
        if (currentNode.deleted) {
          throw new Error(`Cannot update deleted node ${nodeId}`);
        }

        // Keep a copy of the original parts for the changelog
        const originalParts = JSON.parse(JSON.stringify(currentNode.properties.parts || []));

        // Step 4: Prepare updates
        const updates = new Map<string, any>();

        // Update container node
        const parts = (currentNode.properties.parts || []).map(collection => ({
          ...collection,
          nodes: collection.nodes.filter(n => !nodes.some(node => node.id === n.id))
        }));

        // Keep 'main' collection even if empty
        const cleanedParts = parts.filter(collection =>
          collection.nodes.length > 0 || collection.collectionName === 'main'
        );

        const updatedNode: INode = {
          ...currentNode,
          properties: {
            ...currentNode.properties,
            parts: cleanedParts
          },
          contributors: Array.from(new Set([...(currentNode.contributors || []), uname]))
        };

        updates.set(nodeRef.path, {
          'properties.parts': cleanedParts,
          contributors: updatedNode.contributors
        });

        // Update part nodes to remove isPartOf references
        for (const doc of partDocs) {
          if (!doc.exists) continue;

          const partData = doc.data() as INode;
          const isPartOf = (partData.properties.isPartOf || []).map(collection => ({
            ...collection,
            nodes: collection.nodes.filter(n => n.id !== nodeId)
          }));

          const cleanedIsPartOf = isPartOf.filter(collection =>
            collection.nodes.length > 0 || collection.collectionName === 'main'
          );

          updates.set(doc.ref.path, {
            'properties.isPartOf': cleanedIsPartOf,
            contributors: Array.from(new Set([...(partData.contributors || []), uname]))
          });
        }

        // Step 5: Execute all writes
        for (const [path, updateData] of updates) {
          transaction.update(db.doc(path), updateData);
        }

        // Step 6: Create changelog
        await ChangelogService.log(
          nodeId,
          uname,
          'remove element',
          updatedNode,
          reasoning,
          'parts',
          originalParts,
          [...updatedNode.properties.parts],
        );

        return updatedNode;
      });
    } catch (error) {
      console.error('Error removing parts:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to remove parts: ${errorMessage}`);
    }
  }

  /**
   * Creates a new collection within a node's parts
   * 
   * This method adds a new named collection to a node's parts.
   * 
   * @param nodeId - ID of the node to update
   * @param collectionName - Name of the new collection
   * @param uname - Username performing the operation
   * @param reasoning - Reason for the change
   * @returns Promise<INode> - Updated node with the new collection
   * @throws Error for validation failures or database errors
   */
  static async createPartsCollection(
    nodeId: string,
    collectionName: string,
    uname: string,
    reasoning: string
  ): Promise<INode> {
    try {
      // Input validation
      if (!nodeId?.trim()) {
        throw new ApiKeyValidationError('Invalid node ID. Please provide a valid node identifier.');
      }
      if (!collectionName?.trim()) {
        throw new ApiKeyValidationError('Collection name is required.');
      }
      if (collectionName.toLowerCase() === 'main') {
        throw new ApiKeyValidationError('Cannot create a collection named "main" as it is reserved.');
      }
      if (!uname?.trim()) {
        throw new ApiKeyValidationError('Username is required for tracking changes.');
      }

      const nodeRef = db.collection(NODES).doc(nodeId);

      return await db.runTransaction(async (transaction) => {
        // Get the current node
        const nodeDoc = await transaction.get(nodeRef);
        if (!nodeDoc.exists) {
          throw new ApiKeyValidationError(`Node ${nodeId} not found.`);
        }

        const currentNode = nodeDoc.data() as INode;
        if (currentNode.deleted) {
          throw new ApiKeyValidationError(`Cannot update deleted node ${nodeId}.`);
        }

        // Ensure the node has parts
        const parts = [...(currentNode.properties.parts || [])];

        // Check if collection already exists
        if (parts.some(c => c.collectionName === collectionName)) {
          throw new ApiKeyValidationError(`Collection "${collectionName}" already exists in parts.`);
        }

        // Save original for changelog
        const originalParts = JSON.parse(JSON.stringify(parts));

        // Add the new collection
        parts.push({
          collectionName,
          nodes: []
        });

        // Update the node
        const updatedNode: INode = {
          ...currentNode,
          properties: {
            ...currentNode.properties,
            parts
          },
          contributors: Array.from(new Set([...(currentNode.contributors || []), uname]))
        };

        transaction.update(nodeRef, {
          'properties.parts': parts,
          contributors: updatedNode.contributors
        });

        // Create changelog
        await ChangelogService.log(
          nodeId,
          uname,
          'add collection',
          updatedNode,
          reasoning,
          'parts',
          originalParts,
          parts
        );

        return updatedNode;
      });
    } catch (error) {
      console.error('Error creating parts collection:', error);
      if (error instanceof ApiKeyValidationError) {
        throw error;
      }
      throw new ApiKeyValidationError(
        `Failed to create collection: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Deletes a collection from a node's parts
   * 
   * This method removes a named collection from a node's parts.
   * The collection must be empty before it can be deleted.
   * 
   * @param nodeId - ID of the node to update
   * @param collectionName - Name of the collection to delete
   * @param uname - Username performing the operation
   * @param reasoning - Reason for the change
   * @returns Promise<INode> - Updated node without the deleted collection
   * @throws Error for validation failures or if collection not found/not empty
   */
  static async deletePartsCollection(
    nodeId: string,
    collectionName: string,
    uname: string,
    reasoning: string
  ): Promise<INode> {
    try {
      // Input validation
      if (!nodeId?.trim()) {
        throw new ApiKeyValidationError('Invalid node ID. Please provide a valid node identifier.');
      }
      if (!collectionName?.trim()) {
        throw new ApiKeyValidationError('Collection name is required.');
      }
      if (collectionName.toLowerCase() === 'main') {
        throw new ApiKeyValidationError('Cannot delete the "main" collection as it is required.');
      }
      if (!uname?.trim()) {
        throw new ApiKeyValidationError('Username is required for tracking changes.');
      }

      const nodeRef = db.collection(NODES).doc(nodeId);

      return await db.runTransaction(async (transaction) => {
        // Get the current node
        const nodeDoc = await transaction.get(nodeRef);
        if (!nodeDoc.exists) {
          throw new ApiKeyValidationError(`Node ${nodeId} not found.`);
        }

        const currentNode = nodeDoc.data() as INode;
        if (currentNode.deleted) {
          throw new ApiKeyValidationError(`Cannot update deleted node ${nodeId}.`);
        }

        // Find the collection to delete
        const parts = [...(currentNode.properties.parts || [])];
        const collectionIndex = parts.findIndex(c => c.collectionName === collectionName);

        if (collectionIndex === -1) {
          throw new ApiKeyValidationError(`Collection "${collectionName}" not found in parts.`);
        }

        // Check if the collection has nodes
        const nodesInCollection = parts[collectionIndex].nodes;
        if (nodesInCollection && nodesInCollection.length > 0) {
          throw new ApiKeyValidationError(
            `Cannot delete collection "${collectionName}" because it contains ${nodesInCollection.length} nodes. ` +
            `Please move or remove these nodes before deleting the collection.`
          );
        }

        // Save original for changelog
        const originalParts = JSON.parse(JSON.stringify(parts));

        // Remove the collection
        parts.splice(collectionIndex, 1);

        // Update the node
        const updatedNode: INode = {
          ...currentNode,
          properties: {
            ...currentNode.properties,
            parts
          },
          contributors: Array.from(new Set([...(currentNode.contributors || []), uname]))
        };

        transaction.update(nodeRef, {
          'properties.parts': parts,
          contributors: updatedNode.contributors
        });

        // Create changelog
        await ChangelogService.log(
          nodeId,
          uname,
          'delete collection',
          updatedNode,
          reasoning,
          'parts',
          originalParts,
          parts
        );

        return updatedNode;
      });
    } catch (error) {
      console.error('Error deleting parts collection:', error);
      if (error instanceof ApiKeyValidationError) {
        throw error;
      }
      throw new ApiKeyValidationError(
        `Failed to delete collection: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
    * Reorders parts within the main collection
    * 
    * This method reorders nodes within the main collection of parts.
    */
  static async reorderParts(
    nodeId: string,
    updatedParts: ICollection[],
    uname: string,
    reasoning: string
  ): Promise<INode> {
    try {
      if (!nodeId?.trim()) {
        throw new Error('Invalid node ID');
      }
      if (!Array.isArray(updatedParts)) {
        throw new Error('Updated parts must be an array');
      }
      if (!uname?.trim()) {
        throw new Error('Username is required');
      }

      const nodeRef = db.collection(NODES).doc(nodeId);

      return await db.runTransaction(async (transaction) => {
        // Step 1: Get current node state
        const nodeDoc = await transaction.get(nodeRef);
        if (!nodeDoc.exists) {
          throw new Error(`Node ${nodeId} not found`);
        }

        const currentNode = nodeDoc.data() as INode;
        if (currentNode.deleted) {
          throw new Error('Cannot modify a deleted node');
        }

        // Save original parts for changelog
        const originalParts = JSON.parse(JSON.stringify(currentNode.properties.parts || []));

        // Step 2: Prepare the update
        const updatedNode: INode = {
          ...currentNode,
          properties: {
            ...currentNode.properties,
            parts: updatedParts
          },
          contributors: Array.from(new Set([...(currentNode.contributors || []), uname]))
        };

        // Step 3: Execute the update
        const updates = {
          'properties.parts': updatedParts,
          contributors: updatedNode.contributors
        };

        transaction.update(nodeRef, updates);

        // Step 4: Create changelog entry
        await ChangelogService.log(
          nodeId,
          uname,
          'sort elements',
          updatedNode,
          reasoning,
          'parts',
          originalParts,
          updatedParts,
        );

        return updatedNode;
      });
    } catch (error) {
      console.error('Error reordering parts:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to reorder parts: ${errorMessage}`);
    }
  }

  private static wouldCreateCircularPartReference(
    containerId: string,
    partId: string,
    nodesMap: Map<string, INode>
  ): boolean {
    // If container and part are the same, it's a circular reference
    if (containerId === partId) {
      return true;
    }

    // Check if the part contains the container (which would create a cycle)
    const partNode = nodesMap.get(partId);
    if (!partNode || !partNode.properties.parts) {
      return false;
    }

    // Helper function to check recursively
    const isPartOfRecursive = (currentId: string, targetId: string, visited = new Set<string>()): boolean => {
      if (currentId === targetId) return true;
      if (visited.has(currentId)) return false;

      visited.add(currentId);

      const currentNode = nodesMap.get(currentId);
      if (!currentNode || !currentNode.properties.parts) return false;

      // Check each part recursively
      for (const collection of currentNode.properties.parts) {
        for (const part of collection.nodes) {
          if (isPartOfRecursive(part.id, targetId, visited)) {
            return true;
          }
        }
      }

      return false;
    };

    // Start recursive check from the part node
    return isPartOfRecursive(partId, containerId);
  }

  // SECTION 2: ISPARTOF MANAGEMENT
  // ==============================
  // Methods for adding, removing, and organizing isPartOf relationships
  // (nodes that a node is a component of)
  // - addIsPartOf - Adds container nodes that this node is a part of
  // - removeIsPartOf - Removes container nodes
  // - createIsPartOfCollection - Creates a new collection for organizing isPartOf relationships
  // - deleteIsPartOfCollection - Deletes an isPartOf collection
  // - reorderIsPartOf - Changes the order of isPartOf relationships

  /**
    * Adds isPartOf relationships to a node
    * 
    * This method establishes part-whole relationships by marking the node
    * as a part of specified container nodes while maintaining data consistency.
    * 
    * @param nodeId - ID of the part node
    * @param containerNodes - Array of node IDs that this node is a part of
    * @param uname - Username performing the operation
    * @param reasoning - Reason for the change
    * @param collectionName - Optional collection name (defaults to 'main')
    * @returns Promise<INode> - Updated node with new isPartOf relationships
    * @throws Error for validation failures or database errors
    */
  static async addIsPartOf(
    nodeId: string,
    containerNodes: { id: string }[],
    uname: string,
    reasoning: string,
    collectionName: string = 'main'
  ): Promise<INode> {
    try {
      // Input validation
      if (!nodeId?.trim()) {
        throw new ApiKeyValidationError('Invalid node ID. Please provide a valid node identifier.');
      }
      if (!Array.isArray(containerNodes) || containerNodes.length === 0) {
        throw new ApiKeyValidationError('No container nodes provided. Please specify at least one node.');
      }
      if (!uname?.trim()) {
        throw new ApiKeyValidationError('Username is required for tracking changes.');
      }

      const nodeRef = db.collection(NODES).doc(nodeId);

      return await db.runTransaction(async (transaction) => {
        // Step 1: Collect all references that need to be read
        const containerRefs = containerNodes.map(node =>
          db.collection(NODES).doc(node.id)
        );
        const allRefs = [nodeRef, ...containerRefs];

        // Step 2: Execute all reads first (Firestore requirement)
        const docs = await Promise.all(
          allRefs.map(ref => transaction.get(ref))
        );

        // Step 3: Process the read results
        const [nodeDoc, ...containerDocs] = docs;

        if (!nodeDoc.exists) {
          throw new Error(`Part node ${nodeId} not found`);
        }

        const currentNode = nodeDoc.data() as INode;
        if (currentNode.deleted) {
          throw new Error(`Cannot update deleted node ${nodeId}`);
        }

        // Keep a copy of the original isPartOf for the changelog
        const originalIsPartOf = JSON.parse(JSON.stringify(currentNode.properties.isPartOf || []));

        // Verify all container nodes exist and aren't deleted
        const nodesMap = new Map<string, INode>();
        containerDocs.forEach((doc, index) => {
          const nodeId = containerNodes[index].id;
          if (!doc.exists) {
            throw new ApiKeyValidationError(
              `Container node ${nodeId} not found. Please verify the node exists.`
            );
          }
          const nodeData = doc.data() as INode;
          if (nodeData.deleted) {
            throw new ApiKeyValidationError(
              `Container node ${nodeId} is deleted and cannot be used as a container.`
            );
          }
          nodesMap.set(doc.id, nodeData);
        });

        // Step 4: Prepare updates
        const isPartOf = Array.isArray(currentNode.properties.isPartOf)
          ? [...currentNode.properties.isPartOf]
          : [{ collectionName: 'main', nodes: [] }];

        let collection = isPartOf.find(c => c.collectionName === collectionName);

        if (!collection) {
          collection = { collectionName, nodes: [] };
          isPartOf.push(collection);
        }

        // Add new nodes that aren't already in the collection
        const existingIds = new Set(collection.nodes.map(n => n.id));
        const newNodes = containerNodes.filter(node => !existingIds.has(node.id));

        if (newNodes.length === 0) {
          return currentNode; // No changes needed
        }

        collection.nodes.push(...newNodes);

        // Step 5: Prepare all updates
        const updates = new Map<string, any>();

        // Update part node
        const updatedNode: INode = {
          ...currentNode,
          properties: {
            ...currentNode.properties,
            isPartOf
          },
          contributors: Array.from(new Set([...(currentNode.contributors || []), uname]))
        };

        updates.set(nodeRef.path, {
          'properties.isPartOf': isPartOf,
          contributors: updatedNode.contributors
        });

        // Update container nodes with bidirectional relationships (parts)
        for (const newNode of newNodes) {
          const containerDoc = containerDocs[containerNodes.findIndex(n => n.id === newNode.id)];
          const containerData = containerDoc.data() as INode;

          const parts = Array.isArray(containerData.properties.parts)
            ? [...containerData.properties.parts]
            : [{ collectionName: 'main', nodes: [] }];

          let mainCollection = parts.find(c => c.collectionName === 'main');

          if (!mainCollection) {
            mainCollection = { collectionName: 'main', nodes: [] };
            parts.push(mainCollection);
          }

          if (!mainCollection.nodes.some(n => n.id === nodeId)) {
            mainCollection.nodes.push({ id: nodeId });
            updates.set(containerDoc.ref.path, {
              'properties.parts': parts,
              contributors: Array.from(new Set([...(containerData.contributors || []), uname]))
            });
          }
        }

        // Step 6: Execute all writes
        for (const [path, updateData] of updates) {
          transaction.update(db.doc(path), updateData);
        }

        // Step 7: Create changelog
        // await ChangelogService.log(
        //   nodeId,
        //   uname,
        //   'add element',
        //   updatedNode,
        //   reasoning,
        //   'isPartOf',
        //   originalIsPartOf,
        //   [...updatedNode.properties.isPartOf],
        // );

        return updatedNode;
      });
    } catch (error) {
      console.error('Error adding isPartOf relationships:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to add isPartOf relationships: ${errorMessage}`);
    }
  }

  /**
   * Removes isPartOf relationships from a node
   * 
   * This method removes part-whole relationships while maintaining
   * data consistency and bidirectional references.
   * 
   * @param nodeId - ID of the part node
   * @param containerNodes - Array of container node IDs to remove from isPartOf
   * @param uname - Username performing the operation
   * @param reasoning - Reason for the change
   * @returns Promise<INode> - Updated node without removed isPartOf relationships
   * @throws Error for validation failures or database errors
   */
  static async removeIsPartOf(
    nodeId: string,
    containerNodes: { id: string }[],
    uname: string,
    reasoning: string
  ): Promise<INode> {
    try {
      // Input validation
      if (!nodeId?.trim()) {
        throw new Error('Invalid node ID');
      }
      if (!Array.isArray(containerNodes) || containerNodes.length === 0) {
        throw new Error('No container nodes provided');
      }
      if (!uname?.trim()) {
        throw new Error('Username is required');
      }

      const nodeRef = db.collection(NODES).doc(nodeId);

      return await db.runTransaction(async (transaction) => {
        // Step 1: Collect all references
        const containerRefs = containerNodes.map(node =>
          db.collection(NODES).doc(node.id)
        );
        const allRefs = [nodeRef, ...containerRefs];

        // Step 2: Execute all reads first
        const docs = await Promise.all(
          allRefs.map(ref => transaction.get(ref))
        );

        // Step 3: Process read results
        const [nodeDoc, ...containerDocs] = docs;

        if (!nodeDoc.exists) {
          throw new Error(`Node ${nodeId} not found`);
        }

        const currentNode = nodeDoc.data() as INode;
        if (currentNode.deleted) {
          throw new Error(`Cannot update deleted node ${nodeId}`);
        }

        // Keep a copy of the original isPartOf for the changelog
        const originalIsPartOf = JSON.parse(JSON.stringify(currentNode.properties.isPartOf || []));

        // Step 4: Prepare updates
        const updates = new Map<string, any>();

        // Update part node
        const isPartOf = (currentNode.properties.isPartOf || []).map(collection => ({
          ...collection,
          nodes: collection.nodes.filter(n => !containerNodes.some(node => node.id === n.id))
        }));

        // Keep 'main' collection even if empty
        const cleanedIsPartOf = isPartOf.filter(collection =>
          collection.nodes.length > 0 || collection.collectionName === 'main'
        );

        const updatedNode: INode = {
          ...currentNode,
          properties: {
            ...currentNode.properties,
            isPartOf: cleanedIsPartOf
          },
          contributors: Array.from(new Set([...(currentNode.contributors || []), uname]))
        };

        updates.set(nodeRef.path, {
          'properties.isPartOf': cleanedIsPartOf,
          contributors: updatedNode.contributors
        });

        // Update container nodes to remove parts references
        for (const doc of containerDocs) {
          if (!doc.exists) continue;

          const containerData = doc.data() as INode;
          const parts = (containerData.properties.parts || []).map(collection => ({
            ...collection,
            nodes: collection.nodes.filter(n => n.id !== nodeId)
          }));

          const cleanedParts = parts.filter(collection =>
            collection.nodes.length > 0 || collection.collectionName === 'main'
          );

          updates.set(doc.ref.path, {
            'properties.parts': cleanedParts,
            contributors: Array.from(new Set([...(containerData.contributors || []), uname]))
          });
        }

        // Step 5: Execute all writes
        for (const [path, updateData] of updates) {
          transaction.update(db.doc(path), updateData);
        }

        // Step 6: Create changelog
        // await ChangelogService.log(
        //   nodeId,
        //   uname,
        //   'remove element',
        //   updatedNode,
        //   reasoning,
        //   'isPartOf',
        //   originalIsPartOf,
        //   [...updatedNode.properties.isPartOf],
        // );

        return updatedNode;
      });
    } catch (error) {
      console.error('Error removing isPartOf relationships:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to remove isPartOf relationships: ${errorMessage}`);
    }
  }

  /**
   * Creates a new collection within a node's isPartOf
   * 
   * This method adds a new named collection to a node's isPartOf property.
   * 
   * @param nodeId - ID of the node to update
   * @param collectionName - Name of the new collection
   * @param uname - Username performing the operation
   * @param reasoning - Reason for the change
   * @returns Promise<INode> - Updated node with the new collection
   * @throws Error for validation failures or database errors
   */
  static async createIsPartOfCollection(
    nodeId: string,
    collectionName: string,
    uname: string,
    reasoning: string
  ): Promise<INode> {
    try {
      // Input validation
      if (!nodeId?.trim()) {
        throw new ApiKeyValidationError('Invalid node ID. Please provide a valid node identifier.');
      }
      if (!collectionName?.trim()) {
        throw new ApiKeyValidationError('Collection name is required.');
      }
      if (collectionName.toLowerCase() === 'main') {
        throw new ApiKeyValidationError('Cannot create a collection named "main" as it is reserved.');
      }
      if (!uname?.trim()) {
        throw new ApiKeyValidationError('Username is required for tracking changes.');
      }

      const nodeRef = db.collection(NODES).doc(nodeId);

      return await db.runTransaction(async (transaction) => {
        // Get the current node
        const nodeDoc = await transaction.get(nodeRef);
        if (!nodeDoc.exists) {
          throw new ApiKeyValidationError(`Node ${nodeId} not found.`);
        }

        const currentNode = nodeDoc.data() as INode;
        if (currentNode.deleted) {
          throw new ApiKeyValidationError(`Cannot update deleted node ${nodeId}.`);
        }

        // Ensure the node has isPartOf
        const isPartOf = [...(currentNode.properties.isPartOf || [])];

        // Check if collection already exists
        if (isPartOf.some(c => c.collectionName === collectionName)) {
          throw new ApiKeyValidationError(`Collection "${collectionName}" already exists in isPartOf.`);
        }

        // Save original for changelog
        const originalIsPartOf = JSON.parse(JSON.stringify(isPartOf));

        // Add the new collection
        isPartOf.push({
          collectionName,
          nodes: []
        });

        // Update the node
        const updatedNode: INode = {
          ...currentNode,
          properties: {
            ...currentNode.properties,
            isPartOf
          },
          contributors: Array.from(new Set([...(currentNode.contributors || []), uname]))
        };

        transaction.update(nodeRef, {
          'properties.isPartOf': isPartOf,
          contributors: updatedNode.contributors
        });

        // Create changelog
        await ChangelogService.log(
          nodeId,
          uname,
          'add collection',
          updatedNode,
          reasoning,
          'isPartOf',
          originalIsPartOf,
          isPartOf
        );

        return updatedNode;
      });
    } catch (error) {
      console.error('Error creating isPartOf collection:', error);
      if (error instanceof ApiKeyValidationError) {
        throw error;
      }
      throw new ApiKeyValidationError(
        `Failed to create collection: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Deletes a collection from a node's isPartOf
   * 
   * This method removes a named collection from a node's isPartOf property.
   * The collection must be empty before it can be deleted.
   * 
   * @param nodeId - ID of the node to update
   * @param collectionName - Name of the collection to delete
   * @param uname - Username performing the operation
   * @param reasoning - Reason for the change
   * @returns Promise<INode> - Updated node without the deleted collection
   * @throws Error for validation failures or if collection not found/not empty
   */
  static async deleteIsPartOfCollection(
    nodeId: string,
    collectionName: string,
    uname: string,
    reasoning: string
  ): Promise<INode> {
    try {
      // Input validation
      if (!nodeId?.trim()) {
        throw new ApiKeyValidationError('Invalid node ID. Please provide a valid node identifier.');
      }
      if (!collectionName?.trim()) {
        throw new ApiKeyValidationError('Collection name is required.');
      }
      if (collectionName.toLowerCase() === 'main') {
        throw new ApiKeyValidationError('Cannot delete the "main" collection as it is required.');
      }
      if (!uname?.trim()) {
        throw new ApiKeyValidationError('Username is required for tracking changes.');
      }

      const nodeRef = db.collection(NODES).doc(nodeId);

      return await db.runTransaction(async (transaction) => {
        // Get the current node
        const nodeDoc = await transaction.get(nodeRef);
        if (!nodeDoc.exists) {
          throw new ApiKeyValidationError(`Node ${nodeId} not found.`);
        }

        const currentNode = nodeDoc.data() as INode;
        if (currentNode.deleted) {
          throw new ApiKeyValidationError(`Cannot update deleted node ${nodeId}.`);
        }

        // Find the collection to delete
        const isPartOf = [...(currentNode.properties.isPartOf || [])];
        const collectionIndex = isPartOf.findIndex(c => c.collectionName === collectionName);

        if (collectionIndex === -1) {
          throw new ApiKeyValidationError(`Collection "${collectionName}" not found in isPartOf.`);
        }

        // Check if the collection has nodes
        const nodesInCollection = isPartOf[collectionIndex].nodes;
        if (nodesInCollection && nodesInCollection.length > 0) {
          throw new ApiKeyValidationError(
            `Cannot delete collection "${collectionName}" because it contains ${nodesInCollection.length} nodes. ` +
            `Please move or remove these nodes before deleting the collection.`
          );
        }

        // Save original for changelog
        const originalIsPartOf = JSON.parse(JSON.stringify(isPartOf));

        // Remove the collection
        isPartOf.splice(collectionIndex, 1);

        // Update the node
        const updatedNode: INode = {
          ...currentNode,
          properties: {
            ...currentNode.properties,
            isPartOf
          },
          contributors: Array.from(new Set([...(currentNode.contributors || []), uname]))
        };

        transaction.update(nodeRef, {
          'properties.isPartOf': isPartOf,
          contributors: updatedNode.contributors
        });

        // Create changelog
        await ChangelogService.log(
          nodeId,
          uname,
          'delete collection',
          updatedNode,
          reasoning,
          'isPartOf',
          originalIsPartOf,
          isPartOf
        );

        return updatedNode;
      });
    } catch (error) {
      console.error('Error deleting isPartOf collection:', error);
      if (error instanceof ApiKeyValidationError) {
        throw error;
      }
      throw new ApiKeyValidationError(
        `Failed to delete collection: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }



  /**
   * Reorders isPartOf relationships within the main collection
   * 
   * This method reorders container nodes within the main collection of isPartOf.
   */
  static async reorderIsPartOf(
    nodeId: string,
    updatedIsPartOf: ICollection[],
    uname: string,
    reasoning: string
  ): Promise<INode> {
    try {
      if (!nodeId?.trim()) {
        throw new Error('Invalid node ID');
      }
      if (!Array.isArray(updatedIsPartOf)) {
        throw new Error('Updated isPartOf must be an array');
      }
      if (!uname?.trim()) {
        throw new Error('Username is required');
      }

      const nodeRef = db.collection(NODES).doc(nodeId);

      return await db.runTransaction(async (transaction) => {
        // Step 1: Get current node state
        const nodeDoc = await transaction.get(nodeRef);
        if (!nodeDoc.exists) {
          throw new Error(`Node ${nodeId} not found`);
        }

        const currentNode = nodeDoc.data() as INode;
        if (currentNode.deleted) {
          throw new Error('Cannot modify a deleted node');
        }

        // Save original isPartOf for changelog
        const originalIsPartOf = JSON.parse(JSON.stringify(currentNode.properties.isPartOf || []));

        // Step 2: Prepare the update
        const updatedNode: INode = {
          ...currentNode,
          properties: {
            ...currentNode.properties,
            isPartOf: updatedIsPartOf
          },
          contributors: Array.from(new Set([...(currentNode.contributors || []), uname]))
        };

        // Step 3: Execute the update
        const updates = {
          'properties.isPartOf': updatedIsPartOf,
          contributors: updatedNode.contributors
        };

        transaction.update(nodeRef, updates);

        // Step 4: Create changelog entry
        await ChangelogService.log(
          nodeId,
          uname,
          'sort elements',
          updatedNode,
          reasoning,
          'isPartOf',
          originalIsPartOf,
          updatedIsPartOf,
        );

        return updatedNode;
      });
    } catch (error) {
      console.error('Error reordering isPartOf relationships:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to reorder isPartOf relationships: ${errorMessage}`);
    }
  }


  // SECTION 3: BIDIRECTIONAL RELATIONSHIP MANAGEMENT
  // ==============================================
  // Methods for maintaining bidirectional part-whole relationships
  // - updatePartsRelationships - Updates bidirectional part relationships
  // - updatePartOfRelationship - Updates isPartOf when a node is added as a part
  // - updatePartsRelationship - Updates parts when a node is added as isPartOf

  /**
   * Updates the relationships between nodes
   * 
   * This method manages the bidirectional part-whole relationships between nodes.
   * It ensures that when a node references another as a part or isPartOf,
   * the corresponding node has the reciprocal relationship.
   * 
   * @param nodeId - The ID of the node to update relationships for
   * @param properties - The properties containing relationship information
   * @returns Promise<void>
   * @private
   */
  static async syncAllPartRelations(
    nodeId: string,
    properties: INode['properties']
  ): Promise<void> {
    const updates: Promise<void>[] = [];

    // Handle parts relationships - ensure each part references this node as its container
    if (properties.parts?.[0]?.nodes?.length) {
      updates.push(
        ...properties.parts[0].nodes.map(({ id: partId }) =>
          this.updatePartOfRelationship(nodeId, partId)
        )
      );
    }

    // Handle isPartOf relationships - ensure each container has this node as a part
    if (properties.isPartOf?.[0]?.nodes?.length) {
      updates.push(
        ...properties.isPartOf[0].nodes.map(({ id: containerId }) =>
          this.addNodeAsPart(nodeId, containerId)
        )
      );
    }

    await Promise.all(updates);
  }

  /**
   * Updates the "isPartOf" relationship for a node
   * 
   * When a node lists another as its part, this ensures the part
   * node correctly references the container in its isPartOf property.
   * 
   * @param nodeId - The ID of the node that contains the part
   * @param partId - The ID of the part node
   * @returns Promise<void>
   * @private
   */
  private static async updatePartOfRelationship(
    nodeId: string,
    partId: string
  ): Promise<void> {
    const partRef = db.collection(NODES).doc(partId);

    try {
      await db.runTransaction(async (transaction) => {
        const partDoc = await transaction.get(partRef);

        if (!partDoc.exists) return;

        const partData = partDoc.data() as INode;

        // Get or initialize the isPartOf collection
        const isPartOfCollections = partData.properties?.isPartOf || [];
        let mainCollection: ICollection;

        if (isPartOfCollections.length === 0) {
          // No collections exist, create the main collection
          mainCollection = { collectionName: 'main', nodes: [] };
          isPartOfCollections.push(mainCollection);
        } else {
          // Find the main collection or use the first one
          mainCollection = isPartOfCollections.find(c => c.collectionName === 'main') ||
            isPartOfCollections[0];
        }

        const isPartOfNodes = mainCollection.nodes || [];

        // Only update if the relationship doesn't already exist
        if (!isPartOfNodes.some(n => n.id === nodeId)) {
          isPartOfNodes.push({ id: nodeId });

          // Ensure collection format is correct
          mainCollection.nodes = isPartOfNodes;

          transaction.update(partRef, {
            'properties.isPartOf': isPartOfCollections
          });
        }
      });
    } catch (error) {
      console.error('Error updating partOf relationship:', error);
      throw new Error('Failed to update node relationship');
    }
  }

  /**
    * Updates the "parts" relationship for a node
    * 
    * When a node lists itself as part of another, this ensures the container
    * node correctly references it in its parts property.
    * 
    * @param nodeId - The ID of the part node
    * @param containerId - The ID of the node that contains the part
    * @returns Promise<void>
    * @private
    */
  private static async addNodeAsPart(
    nodeId: string,
    containerId: string
  ): Promise<void> {
    const containerRef = db.collection(NODES).doc(containerId);

    try {
      await db.runTransaction(async (transaction) => {
        const containerDoc = await transaction.get(containerRef);

        if (!containerDoc.exists) return;

        const containerData = containerDoc.data() as INode;

        // Get or initialize the parts collection
        const partsCollections = containerData.properties?.parts || [];
        let mainCollection: ICollection;

        if (partsCollections.length === 0) {
          // No collections exist, create the main collection
          mainCollection = { collectionName: 'main', nodes: [] };
          partsCollections.push(mainCollection);
        } else {
          // Find the main collection or use the first one
          mainCollection = partsCollections.find(c => c.collectionName === 'main') ||
            partsCollections[0];
        }

        const partsNodes = mainCollection.nodes || [];

        // Only update if the relationship doesn't already exist
        if (!partsNodes.some(n => n.id === nodeId)) {
          partsNodes.push({ id: nodeId });

          // Ensure collection format is correct
          mainCollection.nodes = partsNodes;

          transaction.update(containerRef, {
            'properties.parts': partsCollections
          });
        }
      });
    } catch (error) {
      console.error('Error updating parts relationship:', error);
      throw new Error('Failed to update node relationship');
    }
  }

  // SECTION 4: DATA STRUCTURE NORMALIZATION
  // =====================================
  // Methods for ensuring consistent data structures
  // - normalizePartsAndIsPartOf - Ensures nodes have proper parts and isPartOf structures

  /**
   * Ensures a node has the standard structure for parts and isPartOf
   * This is a utility method to ensure consistent data structure
   */
  static normalizePartsAndIsPartOf(node: INode): INode {
    const updatedNode = { ...node };
    // Ensure properties exists with required fields
    if (!updatedNode.properties) {
      updatedNode.properties = {
        parts: [{ collectionName: 'main', nodes: [] }],
        isPartOf: [{ collectionName: 'main', nodes: [] }]
      };
      return updatedNode; // Return early since we've already initialized everything
    }

    // Normalize parts structure
    if (!updatedNode.properties.parts) {
      updatedNode.properties.parts = [{ collectionName: 'main', nodes: [] }];
    } else if (Array.isArray(updatedNode.properties.parts)) {
      // Check if parts has any entries
      if (updatedNode.properties.parts.length === 0) {
        updatedNode.properties.parts = [{ collectionName: 'main', nodes: [] }];
      } else {
        // Check if parts has any collections defined
        const hasNamedCollections = updatedNode.properties.parts.some(
          collection => collection.collectionName && collection.collectionName.trim() !== ''
        );

        if (!hasNamedCollections) {
          // Consolidate all nodes into a main collection
          const allNodes = updatedNode.properties.parts.flatMap(collection => collection.nodes || []);
          updatedNode.properties.parts = [
            {
              collectionName: 'main',
              nodes: allNodes.filter(n => n && n.id) // Ensure we only include valid nodes
            }
          ];
        } else {
          // Make sure there's a main collection
          const hasMainCollection = updatedNode.properties.parts.some(
            collection => collection.collectionName === 'main'
          );

          if (!hasMainCollection) {
            updatedNode.properties.parts.push({ collectionName: 'main', nodes: [] });
          }

          // Ensure each collection has a nodes array
          updatedNode.properties.parts = updatedNode.properties.parts.map(collection => {
            return {
              ...collection,
              nodes: collection.nodes || []
            };
          });
        }
      }
    } else {
      // If parts is not an array, initialize with empty main collection
      updatedNode.properties.parts = [{ collectionName: 'main', nodes: [] }];
    }

    // Normalize isPartOf structure
    if (!updatedNode.properties.isPartOf) {
      updatedNode.properties.isPartOf = [{ collectionName: 'main', nodes: [] }];
    } else if (Array.isArray(updatedNode.properties.isPartOf)) {
      // Check if isPartOf has any entries
      if (updatedNode.properties.isPartOf.length === 0) {
        updatedNode.properties.isPartOf = [{ collectionName: 'main', nodes: [] }];
      } else {
        // Check if isPartOf has any collections defined
        const hasNamedCollections = updatedNode.properties.isPartOf.some(
          collection => collection.collectionName && collection.collectionName.trim() !== ''
        );

        if (!hasNamedCollections) {
          // Consolidate all nodes into a main collection
          const allNodes = updatedNode.properties.isPartOf.flatMap(collection => collection.nodes || []);
          updatedNode.properties.isPartOf = [
            {
              collectionName: 'main',
              nodes: allNodes.filter(n => n && n.id) // Ensure we only include valid nodes
            }
          ];
        } else {
          // Make sure there's a main collection
          const hasMainCollection = updatedNode.properties.isPartOf.some(
            collection => collection.collectionName === 'main'
          );

          if (!hasMainCollection) {
            updatedNode.properties.isPartOf.push({ collectionName: 'main', nodes: [] });
          }

          // Ensure each collection has a nodes array
          updatedNode.properties.isPartOf = updatedNode.properties.isPartOf.map(collection => {
            return {
              ...collection,
              nodes: collection.nodes || []
            };
          });
        }
      }
    } else {
      // If isPartOf is not an array, initialize with empty main collection
      updatedNode.properties.isPartOf = [{ collectionName: 'main', nodes: [] }];
    }

    return updatedNode;
  }

  /**
   * Normalizes a collection array to ensure it uses the "main" collection properly
   * 
   * @param collections - Collection of items to normalize
   * @returns Normalized array with items properly organized under collections
   */
  static normalizeCollection(collections: ICollection[] | undefined): ICollection[] {
    if (!collections || collections.length === 0) {
      return [{ collectionName: 'main', nodes: [] }];
    }

    // Check if any collections are defined
    const hasNamedCollections = collections.some(
      collection => collection.collectionName && collection.collectionName.trim() !== ''
    );

    if (!hasNamedCollections) {
      // Consolidate all nodes into a main collection
      const allNodes = collections.flatMap(collection => collection.nodes || []);
      return [
        {
          collectionName: 'main',
          nodes: allNodes.filter(n => n && n.id) // Ensure we only include valid nodes
        }
      ];
    } else {
      // Make sure there's a main collection
      const hasMainCollection = collections.some(
        collection => collection.collectionName === 'main'
      );

      let result = [...collections];

      if (!hasMainCollection) {
        result.push({ collectionName: 'main', nodes: [] });
      }

      // Ensure each collection has a nodes array
      result = result.map(collection => {
        return {
          ...collection,
          nodes: collection.nodes || []
        };
      });

      return result;
    }
  }
}