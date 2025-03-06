/**
 * Node Relationship Service
 * 
 * This service manages the relationships between nodes in the system, specifically
 * the specialization and generalization hierarchies. It ensures the integrity of
 * these relationships, including bidirectional references and proper collection
 * organization.
 * 
 * Key responsibilities:
 * - Managing specialization/generalization relationships between nodes
 * - Creating, updating, and deleting collections within relationships
 * - Moving nodes between collections
 * - Ensuring bidirectional integrity (when A specializes B, B generalizes A)
 * - Preventing circular references in node hierarchies
 * - Validating relationship operations for data consistency
 * 
 * These relationship operations are crucial for maintaining the taxonomic 
 * structure of the knowledge graph and ensuring proper inheritance flows.
 */

import { db } from " @components/lib/firestoreServer/admin";
import { ApiKeyValidationError } from " @components/types/api";
import { INode, ICollection, IInheritance } from " @components/types/INode";
import { NODES } from " @components/lib/firestoreClient/collections";
import { ChangelogService } from "./changelog";
import { NodeInheritanceService } from "./nodeInheritanceService";
import { deleteField } from "firebase/firestore";
import { FieldValue } from "firebase-admin/firestore";

export class NodeRelationshipService {
  // SECTION 1: SPECIALIZATION MANAGEMENT
  // ====================================
  // Methods for adding, removing, and organizing specializations
  // (child nodes in the hierarchy)
  // - addSpecializations - Adds child nodes to a parent node
  // - removeSpecializations - Removes child nodes from a parent
  // - updateSpecializationCollection - Renames a specialization collection
  // - moveSpecializations - Moves nodes between specialization collections

  /**
    * Adds specializations to a node
    * 
    * This method establishes specialization relationships between nodes while
    * maintaining data consistency and inheritance rules.
    * 
    * @param nodeId - ID of the parent node
    * @param nodes - Array of node IDs to add as specializations
    * @param uname - Username performing the operation
    * @param reasoning - Reason for the change
    * @param collectionName - Optional collection name (defaults to 'main')
    * @returns Promise<INode> - Updated node with new specializations
    * @throws Error for validation failures or database errors
    */
  static async addSpecializations(
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
        throw new ApiKeyValidationError('No specialization nodes provided. Please specify at least one node to add.');
      }
      if (!uname?.trim()) {
        throw new ApiKeyValidationError('Username is required for tracking changes.');
      }

      const nodeRef = db.collection(NODES).doc(nodeId);

      return await db.runTransaction(async (transaction) => {
        // Step 1: Collect all references that need to be read
        const specializationRefs = nodes.map(node =>
          db.collection(NODES).doc(node.id)
        );
        const allRefs = [nodeRef, ...specializationRefs];

        // Step 2: Execute all reads first (Firestore requirement)
        const docs = await Promise.all(
          allRefs.map(ref => transaction.get(ref))
        );

        // Step 3: Process the read results
        const [nodeDoc, ...specializationDocs] = docs;

        if (!nodeDoc.exists) {
          throw new Error(`Parent node ${nodeId} not found`);
        }

        const currentNode = nodeDoc.data() as INode;
        if (currentNode.deleted) {
          throw new Error(`Cannot update deleted node ${nodeId}`);
        }

        const originalSpecializations = JSON.parse(JSON.stringify(currentNode.specializations || []));

        // Verify all specialization nodes exist and aren't deleted
        const nodesMap = new Map<string, INode>();
        specializationDocs.forEach((doc, index) => {
          const nodeId = nodes[index].id;
          if (!doc.exists) {
            throw new ApiKeyValidationError(
              `Specialization node ${nodeId} not found. Please verify the node exists.`
            );
          }
          const nodeData = doc.data() as INode;
          if (nodeData.deleted) {
            throw new ApiKeyValidationError(
              `Specialization node ${nodeId} is deleted and cannot be added as a specialization.`
            );
          }
          nodesMap.set(doc.id, nodeData);
        });

        // Step 4: Prepare updates
        const specializations = Array.isArray(currentNode.specializations)
          ? [...currentNode.specializations]
          : [{ collectionName: 'main', nodes: [] }];

        let collection = specializations.find(c => c.collectionName === collectionName);

        if (!collection) {
          collection = { collectionName, nodes: [] };
          specializations.push(collection);
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

        // Update parent node
        const updatedNode: INode = {
          ...currentNode,
          specializations,
          contributors: Array.from(new Set([...(currentNode.contributors || []), uname]))
        };

        const updatedContributorsByProperty = { ...currentNode.contributorsByProperty };
        const relationPropertyKey = 'specializations';

        const propertyContributors = new Set([
          ...(currentNode.contributorsByProperty?.[relationPropertyKey] || []),
          uname
        ]);
        updatedContributorsByProperty[relationPropertyKey] = Array.from(propertyContributors);

        updates.set(nodeRef.path, {
          specializations,
          contributors: updatedNode.contributors,
          contributorsByProperty: updatedContributorsByProperty
        });

        updatedNode.contributorsByProperty = updatedContributorsByProperty;

        // Update specialization nodes with bidirectional relationships
        for (const newNode of newNodes) {
          const specDoc = specializationDocs[nodes.findIndex(n => n.id === newNode.id)];
          const specData = specDoc.data() as INode;

          const generalizations = Array.isArray(specData.generalizations)
            ? [...specData.generalizations]
            : [{ collectionName: 'main', nodes: [] }];

          let mainCollection = generalizations.find(c => c.collectionName === 'main');

          if (!mainCollection) {
            mainCollection = { collectionName: 'main', nodes: [] };
            generalizations.push(mainCollection);
          }

          if (!mainCollection.nodes.some(n => n.id === nodeId)) {
            mainCollection.nodes.push({ id: nodeId });
            updates.set(specDoc.ref.path, { generalizations });
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
          'specializations',
          originalSpecializations,
          [...updatedNode.specializations],
        );

        return updatedNode;
      });
    } catch (error) {
      console.error('Error adding specializations:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to add specializations: ${errorMessage}`);
    }
  }

  /**
   * Removes specializations from a node
   * 
   * This method removes specialization relationships while maintaining
   * data consistency and updating inheritance relationships.
   * 
   * @param nodeId - ID of the parent node
   * @param nodes - Array of node IDs to remove from specializations
   * @param uname - Username performing the operation
   * @param reasoning - Reason for the change
   * @returns Promise<INode> - Updated node without removed specializations
   * @throws Error for validation failures or database errors
   */
  static async removeSpecializations(
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
        throw new Error('No specialization nodes provided');
      }
      if (!uname?.trim()) {
        throw new Error('Username is required');
      }

      const nodeRef = db.collection(NODES).doc(nodeId);

      return await db.runTransaction(async (transaction) => {
        // Step 1: Collect all references
        const specializationRefs = nodes.map(node =>
          db.collection(NODES).doc(node.id)
        );
        const allRefs = [nodeRef, ...specializationRefs];

        // Step 2: Execute all reads first
        const docs = await Promise.all(
          allRefs.map(ref => transaction.get(ref))
        );

        // Step 3: Process read results
        const [nodeDoc, ...specializationDocs] = docs;

        if (!nodeDoc.exists) {
          throw new Error(`Node ${nodeId} not found`);
        }

        const currentNode = nodeDoc.data() as INode;
        if (currentNode.deleted) {
          throw new Error(`Cannot update deleted node ${nodeId}`);
        }

        const originalSpecializations = JSON.parse(JSON.stringify(currentNode.specializations || []));

        // Step 4: Prepare updates
        const updates = new Map<string, any>();

        // Update parent node
        const specializations = (currentNode.specializations || []).map(collection => ({
          ...collection,
          nodes: collection.nodes.filter(n => !nodes.some(node => node.id === n.id))
        }));

        // Keep 'main' collection even if empty
        const cleanedSpecializations = specializations.filter(collection =>
          collection.nodes.length > 0 || collection.collectionName === 'main'
        );

        // Add contributorsByProperty tracking
        const updatedContributorsByProperty = { ...currentNode.contributorsByProperty };
        const relationPropertyKey = 'specializations';

        const propertyContributors = new Set([
          ...(currentNode.contributorsByProperty?.[relationPropertyKey] || []),
          uname
        ]);
        updatedContributorsByProperty[relationPropertyKey] = Array.from(propertyContributors);

        const updatedNode: INode = {
          ...currentNode,
          specializations: cleanedSpecializations,
          contributors: Array.from(new Set([...(currentNode.contributors || []), uname])),
          contributorsByProperty: updatedContributorsByProperty
        };

        updates.set(nodeRef.path, {
          specializations: cleanedSpecializations,
          contributors: updatedNode.contributors,
          contributorsByProperty: updatedContributorsByProperty
        });

        // Update removed nodes and handle inheritance
        for (const doc of specializationDocs) {
          if (!doc.exists) continue;

          const specData = doc.data() as INode;
          const generalizations = (specData.generalizations || []).map(collection => ({
            ...collection,
            nodes: collection.nodes.filter(n => n.id !== nodeId)
          }));

          const cleanedGeneralizations = generalizations.filter(collection =>
            collection.nodes.length > 0 || collection.collectionName === 'main'
          );

          updates.set(doc.ref.path, { generalizations: cleanedGeneralizations });

          // Handle inheritance updates
          // await this.handleInheritanceUpdates({
          //   nodeId,
          //   specializationId: doc.id,
          //   currentNode,
          //   specializationNode: specData
          // });
        }

        // Step 5: Execute all writes
        for (const [path, updateData] of updates) {
          transaction.update(db.doc(path), updateData);
        }

        // In removeSpecializations method, update the changelog creation:

        // Step 6: Create changelog
        await ChangelogService.log(
          nodeId,
          uname,
          'remove element',
          updatedNode,
          reasoning,
          'specializations',
          originalSpecializations,
          [...updatedNode.specializations],
        );

        return updatedNode;
      });
    } catch (error) {
      console.error('Error removing specializations:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to remove specializations: ${errorMessage}`);
    }
  }

  /**
   * Updates a specialization collection name
   * 
   * This method renames a specialization collection while maintaining
   * data consistency and collection integrity.
   * 
   * @param nodeId - ID of the node to update
   * @param oldCollectionName - Current name of the collection
   * @param newCollectionName - New name for the collection
   * @param uname - Username performing the operation
   * @param reasoning - Reason for the change
   * @returns Promise<INode> - Updated node with renamed collection
   * @throws Error for validation failures or database errors
   */
  static async updateSpecializationCollection(
    nodeId: string,
    oldCollectionName: string,
    newCollectionName: string,
    uname: string,
    reasoning: string
  ): Promise<INode> {
    try {
      // Input validation
      if (!nodeId?.trim()) {
        throw new Error('Invalid node ID');
      }
      if (!oldCollectionName?.trim() || !newCollectionName?.trim()) {
        throw new Error('Collection names cannot be empty');
      }
      if (oldCollectionName === 'main') {
        throw new Error('Cannot rename the main collection');
      }
      if (oldCollectionName === newCollectionName) {
        throw new Error('New collection name must be different from the old name');
      }

      const nodeRef = db.collection(NODES).doc(nodeId);

      return await db.runTransaction(async (transaction) => {
        // Step 1: Read the node
        const nodeDoc = await transaction.get(nodeRef);
        if (!nodeDoc.exists) {
          throw new Error(`Node ${nodeId} not found`);
        }

        const currentNode = nodeDoc.data() as INode;
        if (currentNode.deleted) {
          throw new Error(`Cannot update deleted node ${nodeId}`);
        }

        // Step 2: Find the collection to rename
        if (!Array.isArray(currentNode.specializations)) {
          currentNode.specializations = [{ collectionName: 'main', nodes: [] }];
        }

        const specializations = [...currentNode.specializations];
        const collectionIndex = specializations.findIndex(
          c => c.collectionName === oldCollectionName
        );

        if (collectionIndex === -1) {
          throw new Error(`Collection '${oldCollectionName}' not found`);
        }

        // Check if new name already exists
        if (specializations.some(c => c.collectionName === newCollectionName)) {
          throw new Error(`Collection '${newCollectionName}' already exists`);
        }

        const originalSpecializations = JSON.parse(JSON.stringify(currentNode.specializations || []));

        // Step 3: Update collection name
        specializations[collectionIndex] = {
          ...specializations[collectionIndex],
          collectionName: newCollectionName
        };

        // Step 4: Track contributorsByProperty
        const updatedContributorsByProperty = { ...currentNode.contributorsByProperty };
        const relationPropertyKey = 'specializations';

        const propertyContributors = new Set([
          ...(currentNode.contributorsByProperty?.[relationPropertyKey] || []),
          uname
        ]);
        updatedContributorsByProperty[relationPropertyKey] = Array.from(propertyContributors);

        // Step 5: Prepare update
        const updatedNode: INode = {
          ...currentNode,
          specializations,
          contributors: Array.from(new Set([...(currentNode.contributors || []), uname])),
          contributorsByProperty: updatedContributorsByProperty
        };

        // Step 6: Execute write
        transaction.update(nodeRef, {
          specializations,
          contributors: updatedNode.contributors,
          contributorsByProperty: updatedContributorsByProperty
        });

        // Step 6: Create changelog
        await ChangelogService.log(
          nodeId,
          uname,
          'edit collection',
          updatedNode,
          reasoning,
          'specializations',
          originalSpecializations,
          [...updatedNode.specializations],
        );

        return updatedNode;
      });
    } catch (error) {
      console.error('Error updating specialization collection:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to update specialization collection: ${errorMessage}`);
    }
  }

  /**
   * Moves nodes between collections within a node's specializations
   * Preserves empty collections after move operations
   * 
   * @param nodeId - ID of the parent node
   * @param nodes - Array of nodes to move
   * @param sourceCollection - Name of the source collection
   * @param targetCollection - Name of the target collection
   * @param uname - Username performing the operation
   * @param reasoning - Reason for the change
   * @returns Promise<INode> - Updated node with moved specializations
   * @throws Error for validation failures or database errors
   */
  static async moveSpecializations(
    nodeId: string,
    nodes: { id: string }[],
    sourceCollection: string,
    targetCollection: string,
    uname: string,
    reasoning: string
  ): Promise<INode> {
    try {
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

        // Step 2: Find and validate collections
        let specializations = [...(currentNode.specializations || [])];
        const sourceIndex = specializations.findIndex(c => c.collectionName === sourceCollection);
        const targetIndex = specializations.findIndex(c => c.collectionName === targetCollection);

        if (sourceIndex === -1) {
          throw new Error(`Source collection "${sourceCollection}" not found`);
        }
        if (targetIndex === -1) {
          throw new Error(`Target collection "${targetCollection}" not found`);
        }

        // Step 3: Find nodes in source collection
        const sourceNodes = specializations[sourceIndex].nodes;
        const nodesToMove = nodes.map(node => {
          const existingNode = sourceNodes.find(n => n.id === node.id);
          if (!existingNode) {
            throw new Error(`Node ${node.id} not found in source collection`);
          }
          return existingNode;
        });

        const originalSpecializations = JSON.parse(JSON.stringify(currentNode.specializations || []));


        // Step 4: Remove nodes from source collection
        specializations[sourceIndex] = {
          ...specializations[sourceIndex],
          nodes: sourceNodes.filter(node => !nodes.some(n => n.id === node.id))
        };

        // Step 5: Add nodes to target collection
        const targetNodes = new Set(specializations[targetIndex].nodes.map(n => n.id));
        nodesToMove.forEach(node => {
          if (!targetNodes.has(node.id)) {
            specializations[targetIndex].nodes.push(node);
          }
        });

        // Collections persist even when they have no nodes

        // Add contributorsByProperty tracking
        const updatedContributorsByProperty = { ...currentNode.contributorsByProperty };
        const relationPropertyKey = 'specializations';

        const propertyContributors = new Set([
          ...(currentNode.contributorsByProperty?.[relationPropertyKey] || []),
          uname
        ]);
        updatedContributorsByProperty[relationPropertyKey] = Array.from(propertyContributors);

        // Step 6: Prepare the update
        const updatedNode: INode = {
          ...currentNode,
          specializations,
          contributors: Array.from(new Set([...(currentNode.contributors || []), uname])),
          contributorsByProperty: updatedContributorsByProperty
        };

        // Step 7: Execute the update
        const updates = {
          specializations,
          contributors: updatedNode.contributors,
          contributorsByProperty: updatedContributorsByProperty,
          updatedAt: new Date().toISOString(),
          updatedBy: uname
        };

        transaction.update(nodeRef, updates);

        // Step 8: Create changelog entry
        await ChangelogService.log(
          nodeId,
          uname,
          'sort elements',
          updatedNode,
          reasoning,
          'specializations',
          originalSpecializations,
          [...updatedNode.specializations],
        );

        return updatedNode;
      });
    } catch (error) {
      console.error('Error moving specializations:', error);
      throw error;
    }
  }

  /**
 * Reorders specializations within a collection
 * 
 * This method changes the order of nodes within a specified collection
 * of specializations without changing collection membership.
 * 
 * @param nodeId - ID of the node to update
 * @param nodes - Array of nodes to reorder
 * @param newIndices - Array of new indices for each node (same length as nodes)
 * @param collectionName - Name of the collection to reorder (defaults to 'main')
 * @param uname - Username performing the operation
 * @param reasoning - Reason for the change
 * @returns Promise<INode> - Updated node with reordered specializations
 * @throws Error for validation failures or database errors
 */
  static async reorderSpecializations(
    nodeId: string,
    nodes: { id: string }[],
    newIndices: number[],
    collectionName: string = 'main',
    uname: string,
    reasoning: string
  ): Promise<INode> {
    try {
      // Input validation
      if (!nodeId?.trim()) {
        throw new Error('Invalid node ID');
      }
      if (!Array.isArray(nodes) || nodes.length === 0) {
        throw new Error('No nodes provided for reordering');
      }
      if (!Array.isArray(newIndices) || newIndices.length !== nodes.length) {
        throw new Error('New indices array must match nodes array length');
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

        // Ensure the specializations property exists with the specified collection
        if (!Array.isArray(currentNode.specializations)) {
          currentNode.specializations = [{ collectionName: 'main', nodes: [] }];
        }

        // Find the collection to reorder
        const collectionIndex = currentNode.specializations.findIndex(c => c.collectionName === collectionName);
        if (collectionIndex === -1) {
          throw new Error(`Collection '${collectionName}' not found in node's specializations`);
        }

        const collection = currentNode.specializations[collectionIndex];

        // Verify all nodes exist in the collection
        const existingNodeMap = new Map(collection.nodes.map((node, index) => [node.id, index]));
        for (const node of nodes) {
          if (!existingNodeMap.has(node.id)) {
            throw new Error(`Node ${node.id} not found in collection ${collectionName}`);
          }
        }

        const originalSpecializations = JSON.parse(JSON.stringify(currentNode.specializations || []));

        // Create a new array with all the current nodes
        const updatedNodes = [...collection.nodes];

        // Prepare changeDetails for the changelog
        const changeDetails: any = {
          draggableNodeId: '',
          source: { droppableId: '' + collectionIndex, index: 0 },
          destination: { droppableId: '' + collectionIndex, index: 0 }
        };

        // Process each node to be moved
        for (let i = 0; i < nodes.length; i++) {
          const nodeId = nodes[i].id;
          const currentIndex = existingNodeMap.get(nodeId);
          const newIndex = Math.min(newIndices[i], updatedNodes.length - 1);

          if (currentIndex !== undefined && currentIndex !== newIndex) {
            // Store change details for the first moved node (for changelog)
            if (changeDetails.draggableNodeId === '') {
              changeDetails.draggableNodeId = nodeId;
              changeDetails.source.index = currentIndex;
              changeDetails.destination.index = newIndex;
            }

            // Remove the node from its current position
            const [node] = updatedNodes.splice(currentIndex, 1);

            // Insert the node at its new position
            updatedNodes.splice(newIndex, 0, node);

            // Update indices for remaining operations
            existingNodeMap.clear();
            updatedNodes.forEach((n, idx) => existingNodeMap.set(n.id, idx));
          }
        }

        // Update the collection with the reordered nodes
        const updatedSpecializations = currentNode.specializations.map((c, idx) => {
          if (idx === collectionIndex) {
            return { ...c, nodes: updatedNodes };
          }
          return c;
        });

        // Track contributorsByProperty
        const updatedContributorsByProperty = { ...currentNode.contributorsByProperty };
        const relationPropertyKey = 'specializations';

        const propertyContributors = new Set([
          ...(currentNode.contributorsByProperty?.[relationPropertyKey] || []),
          uname
        ]);
        updatedContributorsByProperty[relationPropertyKey] = Array.from(propertyContributors);

        // Update the node
        const updatedNode: INode = {
          ...currentNode,
          specializations: updatedSpecializations,
          contributors: Array.from(new Set([...(currentNode.contributors || []), uname])),
          contributorsByProperty: updatedContributorsByProperty
        };

        // Execute the update
        const updates = {
          specializations: updatedSpecializations,
          contributors: updatedNode.contributors,
          contributorsByProperty: updatedContributorsByProperty
        };

        transaction.update(nodeRef, updates);

        // Create changelog entry with proper change details
        await ChangelogService.log(
          nodeId,
          uname,
          'sort elements',
          updatedNode,
          reasoning,
          'specializations',
          originalSpecializations,
          [...updatedNode.specializations],
          changeDetails
        );

        return updatedNode;
      });
    } catch (error) {
      console.error('Error reordering specializations:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to reorder specializations: ${errorMessage}`);
    }
  }


  // SECTION 2: GENERALIZATION MANAGEMENT
  // ====================================
  // Methods for adding, removing, and organizing generalizations 
  // (parent nodes in the hierarchy)
  // - addGeneralizations - Adds parent nodes to a child node
  // - removeGeneralizations - Removes parent nodes from a child
  // - wouldCreateCircularReference - Checks if adding a generalization would create a circular reference
  // - updateInheritanceAfterRemovingGeneralization - Updates inheritance when removing a parent

  /**
   * Adds generalizations to a node
   * 
   * This method establishes generalization relationships between nodes while
   * maintaining data consistency and inheritance rules.
   * 
   * @param nodeId - ID of the child node
   * @param nodes - Array of node IDs to add as generalizations
   * @param uname - Username performing the operation
   * @param reasoning - Reason for the change
   * @param collectionName - Optional collection name (defaults to 'main')
   * @returns Promise<INode> - Updated node with new generalizations
   * @throws Error for validation failures or database errors
   */
  static async addGeneralizations(
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
        throw new ApiKeyValidationError('No generalization nodes provided. Please specify at least one node to add.');
      }
      if (!uname?.trim()) {
        throw new ApiKeyValidationError('Username is required for tracking changes.');
      }

      const nodeRef = db.collection(NODES).doc(nodeId);

      return await db.runTransaction(async (transaction) => {
        // Step 1: Collect all references that need to be read
        const generalizationRefs = nodes.map(node =>
          db.collection(NODES).doc(node.id)
        );
        const allRefs = [nodeRef, ...generalizationRefs];

        // Step 2: Execute all reads first (Firestore requirement)
        const docs = await Promise.all(
          allRefs.map(ref => transaction.get(ref))
        );

        // Step 3: Process the read results
        const [nodeDoc, ...generalizationDocs] = docs;

        if (!nodeDoc.exists) {
          throw new Error(`Child node ${nodeId} not found`);
        }

        const currentNode = nodeDoc.data() as INode;
        if (currentNode.deleted) {
          throw new Error(`Cannot update deleted node ${nodeId}`);
        }

        const originalGeneralizations = JSON.parse(JSON.stringify(currentNode.generalizations || []));

        // Verify all generalization nodes exist and aren't deleted
        const nodesMap = new Map<string, INode>();
        generalizationDocs.forEach((doc, index) => {
          const nodeId = nodes[index].id;
          if (!doc.exists) {
            throw new ApiKeyValidationError(
              `Generalization node ${nodeId} not found. Please verify the node exists.`
            );
          }
          const nodeData = doc.data() as INode;
          if (nodeData.deleted) {
            throw new ApiKeyValidationError(
              `Generalization node ${nodeId} is deleted and cannot be added as a generalization.`
            );
          }
          nodesMap.set(doc.id, nodeData);
        });

        // Check for circular relationships
        for (const node of nodes) {
          if (this.wouldCreateCircularReference(nodeId, node.id, nodesMap)) {
            throw new ApiKeyValidationError(
              `Adding node ${node.id} as a generalization would create a circular reference.`
            );
          }
        }

        // Step 4: Prepare updates
        const generalizations = Array.isArray(currentNode.generalizations)
          ? [...currentNode.generalizations]
          : [{ collectionName: 'main', nodes: [] }];

        let collection = generalizations.find(c => c.collectionName === collectionName);

        if (!collection) {
          collection = { collectionName, nodes: [] };
          generalizations.push(collection);
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

        // Update child node
        const updatedNode: INode = {
          ...currentNode,
          generalizations,
          contributors: Array.from(new Set([...(currentNode.contributors || []), uname]))
        };

        // Track contributors by property for generalizations
        const updatedContributorsByProperty = { ...currentNode.contributorsByProperty };
        const relationPropertyKey = 'generalizations';

        const propertyContributors = new Set([
          ...(currentNode.contributorsByProperty?.[relationPropertyKey] || []),
          uname
        ]);
        updatedContributorsByProperty[relationPropertyKey] = Array.from(propertyContributors);

        // Flag for inheritance updates
        updates.set(nodeRef.path, {
          generalizations,
          contributors: updatedNode.contributors,
          contributorsByProperty: updatedContributorsByProperty,
          pendingInheritanceUpdate: true
        });

        updatedNode.contributorsByProperty = updatedContributorsByProperty;

        // Update generalization nodes with bidirectional relationships
        for (const newNode of newNodes) {
          const genDoc = generalizationDocs[nodes.findIndex(n => n.id === newNode.id)];
          const genData = genDoc.data() as INode;

          const specializations = Array.isArray(genData.specializations)
            ? [...genData.specializations]
            : [{ collectionName: 'main', nodes: [] }];

          let mainCollection = specializations.find(c => c.collectionName === 'main');

          if (!mainCollection) {
            mainCollection = { collectionName: 'main', nodes: [] };
            specializations.push(mainCollection);
          }

          if (!mainCollection.nodes.some(n => n.id === nodeId)) {
            mainCollection.nodes.push({ id: nodeId });
            updates.set(genDoc.ref.path, { specializations });
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
          'generalizations',
          originalGeneralizations,
          [...updatedNode.generalizations],
        );

        return updatedNode;
      }).then(async (result) => {
        // Handle inheritance updates after transaction completes
        try {
          // For each added generalization, update inheritance
          for (const node of nodes) {
            try {
              await this.updateInheritanceAfterAddingGeneralization(nodeId, node.id);
            } catch (inheritanceError) {
              console.error('Error updating inheritance after adding generalization:', inheritanceError);
            }
          }
        } finally {
          // Clear the pending flag after finished
          await db.collection(NODES).doc(nodeId).update({
            pendingInheritanceUpdate: FieldValue.delete()
          });
        }

        return result;
      });
    } catch (error) {
      console.error('Error adding generalizations:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to add generalizations: ${errorMessage}`);
    }
  }

  /**
   * Removes generalizations from a node
   * 
   * This method removes generalization relationships while maintaining
   * data consistency and updating inheritance relationships.
   * 
   * @param nodeId - ID of the child node
   * @param nodes - Array of node IDs to remove from generalizations
   * @param uname - Username performing the operation
   * @param reasoning - Reason for the change
   * @returns Promise<INode> - Updated node without removed generalizations
   * @throws Error for validation failures or database errors
   */
  static async removeGeneralizations(
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
        throw new Error('No generalization nodes provided');
      }
      if (!uname?.trim()) {
        throw new Error('Username is required');
      }

      const nodeRef = db.collection(NODES).doc(nodeId);

      return await db.runTransaction(async (transaction) => {
        // Step 1: Collect all references
        const generalizationRefs = nodes.map(node =>
          db.collection(NODES).doc(node.id)
        );
        const allRefs = [nodeRef, ...generalizationRefs];

        // Step 2: Execute all reads first
        const docs = await Promise.all(
          allRefs.map(ref => transaction.get(ref))
        );

        // Step 3: Process read results
        const [nodeDoc, ...generalizationDocs] = docs;

        if (!nodeDoc.exists) {
          throw new Error(`Node ${nodeId} not found`);
        }

        const currentNode = nodeDoc.data() as INode;
        if (currentNode.deleted) {
          throw new Error(`Cannot update deleted node ${nodeId}`);
        }

        // validate that every node must have at least one generalization
        this.validateGeneralizationRemoval(currentNode, nodes);

        const originalGeneralizations = JSON.parse(JSON.stringify(currentNode.generalizations || []));

        // Step 4: Prepare updates
        const updates = new Map<string, any>();

        // Update child node
        const generalizations = (currentNode.generalizations || []).map(collection => ({
          ...collection,
          nodes: collection.nodes.filter(n => !nodes.some(node => node.id === n.id))
        }));

        // Keep 'main' collection even if empty
        const cleanedGeneralizations = generalizations.filter(collection =>
          collection.nodes.length > 0 || collection.collectionName === 'main'
        );

        // Manually update contributors array - avoid using Set operations directly
        const updatedContributors = [...(currentNode.contributors || [])];
        if (!updatedContributors.includes(uname)) {
          updatedContributors.push(uname);
        }

        const updatedNode: INode = {
          ...currentNode,
          generalizations: cleanedGeneralizations,
          contributors: updatedContributors
        };

        const updatedContributorsByProperty = { ...currentNode.contributorsByProperty };

        const propertyContributors = new Set([
          ...(currentNode.contributorsByProperty?.['generalizations'] || []),
          uname
        ]);
        updatedContributorsByProperty['generalizations'] = Array.from(propertyContributors);

        // Flag node for inheritance update
        updates.set(nodeRef.path, {
          generalizations: cleanedGeneralizations,
          contributors: updatedContributors,
          contributorsByProperty: updatedContributorsByProperty,
          pendingInheritanceUpdate: true // Flag for post-transaction processing
        });

        updatedNode.contributorsByProperty = updatedContributorsByProperty;

        // Update removed nodes and handle bidirectional relationships
        for (const doc of generalizationDocs) {
          if (!doc.exists) continue;

          const genData = doc.data() as INode;

          // Remove the specialization from generalizations
          const specializations = (genData.specializations || []).map(collection => ({
            ...collection,
            nodes: collection.nodes.filter(n => n.id !== nodeId)
          }));

          const cleanedSpecializations = specializations.filter(collection =>
            collection.nodes.length > 0 || collection.collectionName === 'main'
          );

          updates.set(doc.ref.path, { specializations: cleanedSpecializations });
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
          'generalizations',
          originalGeneralizations,
          [...updatedNode.generalizations],
        );

        return updatedNode;
      }).then(async (result) => {
        // Process inheritance updates after transaction completes
        try {
          // For each removed generalization, update inheritance
          // using the new client-compatible approach
          for (const node of nodes) {
            try {
              await this.updateInheritanceAfterRemovingGeneralization(nodeId, node.id);
            } catch (inheritanceError) {
              console.error('Error updating inheritance:', inheritanceError);
            }
          }
        } finally {
          // Clear the pending flag when done
          await db.collection(NODES).doc(nodeId).update({
            pendingInheritanceUpdate: FieldValue.delete()
          });
        }

        return result;
      });
    } catch (error) {
      console.error('Error removing generalizations:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to remove generalizations: ${errorMessage}`);
    }
  }

  /**
 * Validates that a node will still have at least one generalization after removal
 * This ensures that no node can exist without a generalization
 * 
 * @param currentNode - The current node data
 * @param nodesToRemove - Array of node IDs to be removed
 * @throws ApiKeyValidationError if removal would leave the node without generalizations
 */
  private static validateGeneralizationRemoval(
    currentNode: INode,
    nodesToRemove: { id: string }[]
  ): void {
    // Get all current generalizations
    const allGeneralizations = currentNode.generalizations?.flatMap(c => c.nodes) || [];

    // Count how many generalizations would remain after removal
    const remainingCount = allGeneralizations.filter(
      gen => !nodesToRemove.some(node => node.id === gen.id)
    ).length;

    // If no generalizations would remain, throw an error
    if (remainingCount === 0) {
      throw new ApiKeyValidationError(
        'Cannot remove all generalizations from a node. Every node must have at least one generalization. ' +
        'Please add a new generalization before removing the existing one.'
      );
    }
  }

  /**
 * Reorders generalizations within a collection
 * 
 * This method changes the order of nodes within a specified collection
 * of generalizations without changing collection membership.
 * 
 * @param nodeId - ID of the node to update
 * @param nodes - Array of nodes to reorder
 * @param newIndices - Array of new indices for each node (same length as nodes)
 * @param collectionName - Name of the collection to reorder (defaults to 'main')
 * @param uname - Username performing the operation
 * @param reasoning - Reason for the change
 * @returns Promise<INode> - Updated node with reordered generalizations
 * @throws Error for validation failures or database errors
 */
  static async reorderGeneralizations(
    nodeId: string,
    nodes: { id: string }[],
    newIndices: number[],
    collectionName: string = 'main',
    uname: string,
    reasoning: string
  ): Promise<INode> {
    try {
      // Input validation
      if (!nodeId?.trim()) {
        throw new Error('Invalid node ID');
      }
      if (!Array.isArray(nodes) || nodes.length === 0) {
        throw new Error('No nodes provided for reordering');
      }
      if (!Array.isArray(newIndices) || newIndices.length !== nodes.length) {
        throw new Error('New indices array must match nodes array length');
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

        // Ensure the generalizations property exists with the specified collection
        if (!Array.isArray(currentNode.generalizations)) {
          currentNode.generalizations = [{ collectionName: 'main', nodes: [] }];
        }

        // Find the collection to reorder
        const collectionIndex = currentNode.generalizations.findIndex(c => c.collectionName === collectionName);
        if (collectionIndex === -1) {
          throw new Error(`Collection '${collectionName}' not found in node's generalizations`);
        }

        const collection = currentNode.generalizations[collectionIndex];

        // Verify all nodes exist in the collection
        const existingNodeMap = new Map(collection.nodes.map((node, index) => [node.id, index]));
        for (const node of nodes) {
          if (!existingNodeMap.has(node.id)) {
            throw new Error(`Node ${node.id} not found in collection ${collectionName}`);
          }
        }

        const originalGeneralizations = JSON.parse(JSON.stringify(currentNode.generalizations || []));

        // Create a new array with all the current nodes
        const updatedNodes = [...collection.nodes];

        // Prepare changeDetails for the changelog
        const changeDetails: any = {
          draggableNodeId: '',
          source: { droppableId: '' + collectionIndex, index: 0 },
          destination: { droppableId: '' + collectionIndex, index: 0 }
        };

        // Process each node to be moved
        for (let i = 0; i < nodes.length; i++) {
          const nodeId = nodes[i].id;
          const currentIndex = existingNodeMap.get(nodeId);
          const newIndex = Math.min(newIndices[i], updatedNodes.length - 1);

          if (currentIndex !== undefined && currentIndex !== newIndex) {
            // Store change details for the first moved node (for changelog)
            if (changeDetails.draggableNodeId === '') {
              changeDetails.draggableNodeId = nodeId;
              changeDetails.source.index = currentIndex;
              changeDetails.destination.index = newIndex;
            }

            // Remove the node from its current position
            const [node] = updatedNodes.splice(currentIndex, 1);

            // Insert the node at its new position
            updatedNodes.splice(newIndex, 0, node);

            // Update indices for remaining operations
            existingNodeMap.clear();
            updatedNodes.forEach((n, idx) => existingNodeMap.set(n.id, idx));
          }
        }

        // Update the collection with the reordered nodes
        const updatedGeneralizations = currentNode.generalizations.map((c, idx) => {
          if (idx === collectionIndex) {
            return { ...c, nodes: updatedNodes };
          }
          return c;
        });

        // Track contributorsByProperty
        const updatedContributorsByProperty = { ...currentNode.contributorsByProperty };
        const relationPropertyKey = 'generalizations';

        const propertyContributors = new Set([
          ...(currentNode.contributorsByProperty?.[relationPropertyKey] || []),
          uname
        ]);
        updatedContributorsByProperty[relationPropertyKey] = Array.from(propertyContributors);

        // Update the node
        const updatedNode: INode = {
          ...currentNode,
          generalizations: updatedGeneralizations,
          contributors: Array.from(new Set([...(currentNode.contributors || []), uname])),
          contributorsByProperty: updatedContributorsByProperty
        };

        // Execute the update
        const updates = {
          generalizations: updatedGeneralizations,
          contributors: updatedNode.contributors,
          contributorsByProperty: updatedContributorsByProperty
        };

        transaction.update(nodeRef, updates);

        // Create changelog entry with proper change details
        await ChangelogService.log(
          nodeId,
          uname,
          'sort elements',
          updatedNode,
          reasoning,
          'generalizations',
          originalGeneralizations,
          [...updatedNode.generalizations],
          changeDetails
        );

        return updatedNode;
      });
    } catch (error) {
      console.error('Error reordering generalizations:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to reorder generalizations: ${errorMessage}`);
    }
  }

  /**
   * Checks if adding a generalization would create a circular reference
   * 
   * @param childId - ID of the child node
   * @param parentId - ID of the potential parent node
   * @param nodesMap - Map of node IDs to node data for efficiency
   * @returns boolean - true if a circular reference would be created
   * @private
   */
  private static wouldCreateCircularReference(
    childId: string,
    parentId: string,
    nodesMap: Map<string, INode>
  ): boolean {
    // If child and parent are the same, it's a circular reference
    if (childId === parentId) {
      return true;
    }

    // Get the parent node's generalizations
    const parentNode = nodesMap.get(parentId);
    if (!parentNode || !parentNode.generalizations) {
      return false;
    }

    // Check each of the parent's generalizations
    for (const collection of parentNode.generalizations) {
      for (const node of collection.nodes) {
        // If any of the parent's generalizations is the child, it's a circular reference
        if (node.id === childId) {
          return true;
        }

        // Recursively check the parent's generalizations
        if (nodesMap.has(node.id) && this.wouldCreateCircularReference(childId, node.id, nodesMap)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Updates inheritance after adding a generalization
   * 
   * This helper method is called after the transaction completes to update inheritance
   * based on newly added generalizations.
   * 
   * @param nodeId - ID of the child node (specialization)
   * @param addedGeneralizationId - ID of the added generalization
   * @returns Promise<void>
   * @private
   */
  private static async updateInheritanceAfterAddingGeneralization(
    nodeId: string,
    addedGeneralizationId: string
  ): Promise<void> {
    try {
      // Get current node state after transaction
      const nodeRef = db.collection(NODES).doc(nodeId);
      const nodeDoc = await nodeRef.get();

      if (!nodeDoc.exists) {
        throw new Error(`Node ${nodeId} not found`);
      }

      const specializationData = nodeDoc.data() as INode;

      // Skip processing for deleted nodes
      if (specializationData.deleted) {
        return;
      }

      // Get the added generalization
      const genRef = db.collection(NODES).doc(addedGeneralizationId);
      const genDoc = await genRef.get();

      if (!genDoc.exists) {
        throw new Error(`Generalization ${addedGeneralizationId} not found`);
      }

      const generalizationData = genDoc.data() as INode;

      // Skip if generalization is deleted
      if (generalizationData.deleted) {
        return;
      }

      // Get all generalizations
      const generalizations = specializationData.generalizations
        ?.flatMap(collection => collection.nodes) || [];

      // Load all relevant nodes
      const generalizationIds = generalizations.map(gen => gen.id);
      const generalizationDocs = await Promise.all(
        generalizationIds.map(id => db.collection(NODES).doc(id).get())
      );

      const nodesMap: { [nodeId: string]: INode } = {
        [addedGeneralizationId]: generalizationData
      };

      generalizationDocs.forEach(doc => {
        if (doc.exists) {
          nodesMap[doc.id] = doc.data() as INode;
        }
      });

      // Collect properties from the added generalization that should be inherited
      const addedProperties: {
        propertyName: string;
        propertyType: string;
        propertyValue: any;
      }[] = [];

      for (const property in generalizationData.properties) {
        // Skip if the specialization already has this property
        if (property in specializationData.properties) {
          continue;
        }

        // Check if property is already inherited from another generalization
        let alreadyInherited = false;
        for (const genId of generalizationIds) {
          if (genId === addedGeneralizationId) continue;
          const genNode = nodesMap[genId];
          if (genNode && genNode.properties.hasOwnProperty(property)) {
            alreadyInherited = true;
            break;
          }
        }

        // Add the property if it's not already inherited
        if (!alreadyInherited) {
          addedProperties.push({
            propertyName: property,
            propertyType: generalizationData.propertyType?.[property] || '',
            propertyValue: generalizationData.properties[property]
          });
        }
      }

      if (addedProperties.length > 0) {
        let batch = db.batch();

        // Apply the inheritance updates
        const result = await this.updateNodeInheritanceBatch(
          nodeId,
          [],
          [],
          addedProperties,
          true, // nested
          batch,
          generalizationData.inheritance,
          addedGeneralizationId,
          nodesMap
        );

        try {
          await result.batch.commit();
        } catch (commitError) {
          const error = commitError as Error;
          if (error.message &&
            (error.message.includes('no operations') ||
              error.message.includes('empty batch') ||
              error.message.includes('no-ops-in-batch'))) {
            console.log('Batch was empty, skipping commit');
          } else {
            throw error;
          }
        }
      }

      // Update specializations recursively
      const specializations = specializationData.specializations || [];
      const childSpecializations = specializations.flatMap(collection => collection.nodes) || [];

      for (const childSpecialization of childSpecializations) {
        await this.updateInheritanceAfterAddingGeneralization(
          childSpecialization.id,
          addedGeneralizationId
        );
      }
    } catch (error) {
      console.error('Error updating inheritance after adding generalization:', error);
      throw error;
    }
  }

  /**
   * Updates inheritance after removing a generalization
   * 
   * This helper method is called after the transaction completes to update inheritance
   * based on remaining generalizations after a generalization is removed.
   * 
   * @param nodeId - ID of the child node (specialization)
   * @param removedGeneralizationId - ID of the removed generalization
   * @returns Promise<void>
   * @private
   */
  private static async updateInheritanceAfterRemovingGeneralization(
    nodeId: string,
    removedGeneralizationId: string
  ): Promise<void> {
    try {
      // Get current node state after transaction
      const nodeRef = db.collection(NODES).doc(nodeId);
      const nodeDoc = await nodeRef.get();

      if (!nodeDoc.exists) {
        throw new Error(`Node ${nodeId} not found`);
      }

      const specializationData = nodeDoc.data() as INode;

      if (specializationData.deleted) {
        return;
      }

      const remainingGeneralizations = specializationData.generalizations
        ?.flatMap(collection => collection.nodes) || [];

      if (remainingGeneralizations.length === 0) {
        return;
      }

      // Load all nodes needed for processing
      const nodeIds = [
        removedGeneralizationId,
        ...remainingGeneralizations.map(node => node.id)
      ];

      const nodeDocs = await Promise.all(
        nodeIds.map(id => db.collection(NODES).doc(id).get())
      );

      const nodesMap: { [nodeId: string]: INode } = {};
      nodeDocs.forEach(doc => {
        if (doc.exists) {
          nodesMap[doc.id] = doc.data() as INode;
        }
      });

      const addedProperties: {
        propertyName: string;
        propertyType: string;
        propertyValue: any;
      }[] = [];

      const updatedProperties: {
        [ref: string]: string[];
      } = {};

      const deletedProperties: string[] = [];

      const nextGeneralization = remainingGeneralizations[0];
      const nextGeneralizationData = nodesMap[nextGeneralization.id];
      const removedGeneralization = nodesMap[removedGeneralizationId];

      if (!nextGeneralizationData || !removedGeneralization) {
        console.error('Missing required nodes for inheritance update');
        return;
      }

      // Process each property in the current inheritance structure
      for (const property in specializationData.inheritance) {
        // Skip properties with no inheritance reference or invalid data
        if (
          !specializationData.inheritance[property] ||
          specializationData.inheritance[property].ref === null
        ) {
          continue;
        }

        // Check if property was inherited from the removed generalization 
        // or through its chain
        const currentInheritanceRef = specializationData.inheritance[property].ref;

        const isAffectedProperty =
          currentInheritanceRef === removedGeneralizationId ||
          (removedGeneralization.inheritance[property]?.ref === currentInheritanceRef);

        if (isAffectedProperty) {
          // Check if the next generalization has this property
          if (!nextGeneralizationData.properties.hasOwnProperty(property)) {
            let canDelete = true;
            let inheritFrom = null;

            // Look through all remaining generalizations for this property
            for (const generalization of remainingGeneralizations) {
              const generalizationData = nodesMap[generalization.id];
              if (generalizationData?.properties.hasOwnProperty(property)) {
                canDelete = false;
                inheritFrom = generalization.id;
                break;
              }
            }

            // Either mark for deletion or update from another generalization
            if (canDelete) {
              deletedProperties.push(property);
            } else if (inheritFrom) {
              if (!updatedProperties[inheritFrom]) {
                updatedProperties[inheritFrom] = [];
              }
              updatedProperties[inheritFrom].push(property);
            }
          } else {
            // Next generalization has the property, update from it
            if (!updatedProperties[nextGeneralization.id]) {
              updatedProperties[nextGeneralization.id] = [];
            }
            updatedProperties[nextGeneralization.id].push(property);
          }
        }
      }

      // Add properties from next generalization that don't exist in specialization
      for (const property in nextGeneralizationData.properties) {
        if (!specializationData.properties.hasOwnProperty(property)) {
          addedProperties.push({
            propertyName: property,
            propertyType: nextGeneralizationData.propertyType?.[property] || '',
            propertyValue: nextGeneralizationData.properties[property]
          });
        }
      }

      let batch = db.batch();

      let needsNewBatch = false;

      const batchResult = await this.updateNodeInheritanceBatch(
        nodeId,
        [],
        deletedProperties,
        addedProperties,
        true, // nested call
        batch,
        removedGeneralization.inheritance,
        nextGeneralization.id,
        nodesMap
      );

      batch = batchResult.batch;
      needsNewBatch = needsNewBatch || batchResult.isCommitted;

      // Apply property updates from each source
      for (const [inheritFrom, properties] of Object.entries(updatedProperties)) {
        const inheritanceSource = nodesMap[inheritFrom];
        if (inheritanceSource) {
          const updateResult = await this.updateNodeInheritanceBatch(
            nodeId,
            properties,
            [],
            [],
            true, // nested call
            needsNewBatch ? db.batch() : batch,
            inheritanceSource.inheritance,
            inheritFrom,
            nodesMap
          );

          batch = updateResult.batch;
          needsNewBatch = needsNewBatch || updateResult.isCommitted;
        }
      }

      // Commit updates if there are any pending mutations
      try {
        // Only commit if batch has operations to perform
        await batch.commit();
      } catch (commitError) {
        const error = commitError as Error;
        // Check if the error message contains information about empty batch
        if (error.message &&
          (error.message.includes('no operations') ||
            error.message.includes('empty batch') ||
            error.message.includes('no-ops-in-batch'))) {
          // ignore
          console.log('Batch was empty, skipping commit');
        } else {
          throw error;
        }
      }

      // Update specializations recursively
      const specializations = specializationData.specializations || [];
      const childSpecializations = specializations.flatMap(collection => collection.nodes) || [];

      for (const childSpecialization of childSpecializations) {
        await this.updateInheritanceAfterRemovingGeneralization(
          childSpecialization.id,
          removedGeneralizationId
        );
      }
    } catch (error) {
      console.error('Error updating inheritance after removing generalization:', error);
      throw error;
    }
  }

  // Static counter to track batch sizes since _mutations cannot be accessed directly
  private static batchSizeCounter: number = 0;

  /**
   * Helper method for updating node inheritance in batches
   * 
   * @param nodeId - ID of the node to update
   * @param updatedProperties - Properties to update inheritance references for
   * @param deletedProperties - Properties to remove
   * @param addedProperties - New properties to add from a generalization
   * @param nestedCall - Whether this is a recursive call
   * @param batch - Current Firestore batch
   * @param inheritanceType - Inheritance type definitions
   * @param generalizationId - ID of the generalization to inherit from
   * @param nodesMap - Map of node IDs to node data
   * @returns Promise<{batch: FirebaseFirestore.WriteBatch, isCommitted: boolean}> - Updated batch and commit status
   * @private
   */
  private static async updateNodeInheritanceBatch(
    nodeId: string,
    updatedProperties: string[],
    deletedProperties: string[],
    addedProperties: {
      propertyName: string;
      propertyType: string;
      propertyValue: any;
    }[],
    nestedCall: boolean = false,
    batch: FirebaseFirestore.WriteBatch,
    inheritanceType: IInheritance,
    generalizationId: string | null,
    nodesMap: { [nodeId: string]: INode }
  ): Promise<{ batch: FirebaseFirestore.WriteBatch, isCommitted: boolean }> {
    try {
      // Get current node data
      const nodeRef = db.collection(NODES).doc(nodeId);
      let nodeSnapshot;

      // Always get data directly for nested calls
      nodeSnapshot = await nodeRef.get();

      if (!nodeSnapshot.exists) {
        return { batch, isCommitted: false };
      }

      const nodeData = nodeSnapshot.data() as INode;
      const inheritance: IInheritance = nodeData.inheritance || {};

      // Apply inheritance type filtering for nested calls
      if (nestedCall) {
        // Filter updated properties based on inheritance rules
        updatedProperties = updatedProperties.filter(property => {
          // Skip properties with neverInherit rule
          if (inheritanceType[property]?.inheritanceType === 'neverInherit') {
            return false;
          }

          // Include only properties that can be inherited based on rules
          const canInherit =
            (inheritanceType[property]?.inheritanceType === 'inheritUnlessAlreadyOverRidden' &&
              inheritance[property]?.ref !== null) ||
            inheritanceType[property]?.inheritanceType === 'alwaysInherit';

          return canInherit;
        });

        // Filter deleted properties based on inheritance rules
        deletedProperties = deletedProperties.filter(property => {
          // Skip properties with neverInherit rule
          if (inheritanceType[property]?.inheritanceType === 'neverInherit') {
            return false;
          }

          // Include only properties that can be inherited based on rules
          const canInherit =
            (inheritanceType[property]?.inheritanceType === 'inheritUnlessAlreadyOverRidden' &&
              !!inheritance[property]?.ref) ||
            inheritanceType[property]?.inheritanceType === 'alwaysInherit';

          return canInherit;
        });
      }

      const updateObject: { [key: string]: any } = {};

      for (const property of updatedProperties) {
        updateObject[`inheritance.${property}.ref`] = generalizationId;

        // Update property value if there is ganeralization data
        if (generalizationId && nodesMap[generalizationId]?.properties[property] !== undefined) {
          updateObject[`properties.${property}`] = nodesMap[generalizationId].properties[property];
        }
      }

      // Handle deleted properties
      for (const property of deletedProperties) {
        updateObject[`inheritance.${property}`] = FieldValue.delete();
        updateObject[`properties.${property}`] = FieldValue.delete();
        updateObject[`textValue.${property}`] = FieldValue.delete();
        updateObject[`propertyType.${property}`] = FieldValue.delete();
      }

      // Handle added properties
      for (const property of addedProperties) {
        updateObject[`inheritance.${property.propertyName}`] = {
          inheritanceType: 'inheritUnlessAlreadyOverRidden',
          ref: generalizationId
        };
        updateObject[`properties.${property.propertyName}`] = property.propertyValue;

        if (property.propertyType) {
          updateObject[`propertyType.${property.propertyName}`] = property.propertyType;
        }
      }

      // Only update if there are changes to apply
      let isCommitted = false;
      if (Object.keys(updateObject).length > 0) {
        // Add the update to batch
        batch.update(nodeRef, updateObject);

        if (!this.batchSizeCounter) {
          this.batchSizeCounter = 0;
        }

        this.batchSizeCounter++;

        if (this.batchSizeCounter >= 400) {
          await batch.commit();
          batch = db.batch();
          this.batchSizeCounter = 0;
          isCommitted = true;
        }
      }

      // Find and process specializations for recursive updates
      if (!nestedCall) {
        const specializations = nodeData.specializations?.flatMap(c => c.nodes) || [];

        for (const specialization of specializations) {
          const result = await this.updateNodeInheritanceBatch(
            specialization.id,
            updatedProperties,
            deletedProperties,
            addedProperties,
            true, // nested call
            isCommitted ? db.batch() : batch,
            inheritance,
            generalizationId,
            nodesMap
          );

          batch = result.batch;
          isCommitted = isCommitted || result.isCommitted;
        }
      }

      return { batch, isCommitted };
    } catch (error) {
      console.error('Error updating node inheritance batch:', error);
      // Create a new batch if needed
      return { batch, isCommitted: false };
    }
  }

  // SECTION 3: COLLECTION MANAGEMENT
  // ===============================
  // Methods for managing collections within relationships
  // - createCollection - Creates a new collection for a specific relation type
  // - createMultipleCollections - Creates multiple collections at once
  // - deleteCollection - Deletes a collection for a specific relation type
  // - findCollectionIndex - Helper method to find a collection's index
  // - validateNodesInCollection - Helper method to validate node existence in a collection

  /**
    * Creates a new collection for a specific relation type (specializations or generalizations)
    * 
    * @param nodeId - ID of the node to update
    * @param relationType - Type of relation ('specializations' or 'generalizations')
    * @param collectionName - Name of the new collection
    * @param uname - Username performing the operation
    * @param reasoning - Reason for the change
    * @returns Promise<INode> - Updated node with the new collection
    * @throws ApiKeyValidationError for validation failures or conflicts
    */
  static async createCollection(
    nodeId: string,
    relationType: 'specializations' | 'generalizations',
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
        // Ensure the node has the relation type array
        if (!Array.isArray(currentNode[relationType])) {
          currentNode[relationType] = [{ collectionName: 'main', nodes: [] }];
        }
        // Check if collection already exists
        const collections = [...currentNode[relationType]];
        if (collections.some(c => c.collectionName === collectionName)) {
          throw new ApiKeyValidationError(`Collection "${collectionName}" already exists in ${relationType}.`);
        }
        // Add the new collection
        collections.push({
          collectionName,
          nodes: []
        });
        // Update the node
        const updatedNode: INode = {
          ...currentNode,
          [relationType]: collections,
          contributors: Array.from(new Set([...(currentNode.contributors || []), uname]))
        };
        transaction.update(nodeRef, {
          [relationType]: collections,
          contributors: updatedNode.contributors
        });

        // Create changelog using ChangelogService
        // await ChangelogService.log({
        //   nodeId,
        //   uname,
        //   nodeData: updatedNode,
        //   reasoning,
        //   actionType: 'add collection',
        //   metadata: {
        //     relationType,
        //     collectionName
        //   }
        // });

        return updatedNode;
      });
    } catch (error) {
      console.error(`Error creating ${relationType} collection:`, error);
      if (error instanceof ApiKeyValidationError) {
        throw error;
      }
      throw new ApiKeyValidationError(
        `Failed to create collection: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Creates multiple collections at once for a specific relation type
   * 
   * @param nodeId - ID of the node to update
   * @param relationType - Type of relation ('specializations' or 'generalizations')
   * @param collectionNames - Array of collection names to create
   * @param uname - Username performing the operation
   * @param reasoning - Reason for the change
   * @returns Promise<INode> - Updated node with the new collections
   * @throws ApiKeyValidationError for validation failures or conflicts
   */
  static async createMultipleCollections(
    nodeId: string,
    relationType: 'specializations' | 'generalizations',
    collectionNames: string[],
    uname: string,
    reasoning: string
  ): Promise<INode> {
    try {
      // Input validation
      if (!nodeId?.trim()) {
        throw new ApiKeyValidationError('Invalid node ID. Please provide a valid node identifier.');
      }
      if (!Array.isArray(collectionNames) || collectionNames.length === 0) {
        throw new ApiKeyValidationError('At least one collection name is required.');
      }

      // Validate collection names
      for (const name of collectionNames) {
        if (!name?.trim()) {
          throw new ApiKeyValidationError('Collection names cannot be empty.');
        }
        if (name.toLowerCase() === 'main') {
          throw new ApiKeyValidationError('Cannot create a collection named "main" as it is reserved.');
        }
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
        // Ensure the node has the relation type array
        if (!Array.isArray(currentNode[relationType])) {
          currentNode[relationType] = [{ collectionName: 'main', nodes: [] }];
        }
        // Check for existing collections and prepare new ones
        const collections = [...currentNode[relationType]];
        const existingNames = collections.map(c => c.collectionName);
        const duplicates = collectionNames.filter(name => existingNames.includes(name));

        if (duplicates.length > 0) {
          throw new ApiKeyValidationError(
            `The following collections already exist: ${duplicates.join(', ')}`
          );
        }
        // Add the new collections
        for (const name of collectionNames) {
          collections.push({
            collectionName: name,
            nodes: []
          });
        }
        // Update the node
        const updatedNode: INode = {
          ...currentNode,
          [relationType]: collections,
          contributors: Array.from(new Set([...(currentNode.contributors || []), uname]))
        };
        transaction.update(nodeRef, {
          [relationType]: collections,
          contributors: updatedNode.contributors
        });

        // Create changelog using ChangelogService
        // await ChangelogService.log({
        //   nodeId,
        //   uname,
        //   nodeData: updatedNode,
        //   reasoning,
        //   actionType: 'add collection',
        //   metadata: {
        //     relationType,
        //     collectionNames
        //   }
        // });

        return updatedNode;
      });
    } catch (error) {
      console.error(`Error creating multiple ${relationType} collections:`, error);
      if (error instanceof ApiKeyValidationError) {
        throw error;
      }
      throw new ApiKeyValidationError(
        `Failed to create collections: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Deletes a collection for a specific relation type
   * 
   * @param nodeId - ID of the node to update
   * @param relationType - Type of relation ('specializations' or 'generalizations')
   * @param collectionName - Name of the collection to delete
   * @param uname - Username performing the operation
   * @param reasoning - Reason for the change
   * @returns Promise<INode> - Updated node without the deleted collection
   * @throws ApiKeyValidationError for validation failures or if collection not found
   */
  static async deleteCollection(
    nodeId: string,
    relationType: 'specializations' | 'generalizations',
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
        // Ensure the node has the relation type array
        if (!Array.isArray(currentNode[relationType])) {
          throw new ApiKeyValidationError(`Node does not have any ${relationType} collections.`);
        }
        // Find the collection to delete
        const collections = [...currentNode[relationType]];
        const collectionIndex = collections.findIndex(c => c.collectionName === collectionName);

        if (collectionIndex === -1) {
          throw new ApiKeyValidationError(`Collection "${collectionName}" not found in ${relationType}.`);
        }
        // Check if the collection has nodes
        const nodesInCollection = collections[collectionIndex].nodes;
        if (nodesInCollection && nodesInCollection.length > 0) {
          throw new ApiKeyValidationError(
            `Cannot delete collection "${collectionName}" because it contains ${nodesInCollection.length} nodes. ` +
            `Please move or remove these nodes before deleting the collection.`
          );
        }
        // Remove the collection
        collections.splice(collectionIndex, 1);
        // Update the node
        const updatedNode: INode = {
          ...currentNode,
          [relationType]: collections,
          contributors: Array.from(new Set([...(currentNode.contributors || []), uname]))
        };
        transaction.update(nodeRef, {
          [relationType]: collections,
          contributors: updatedNode.contributors
        });

        // Create changelog using ChangelogService
        // await ChangelogService.log({
        //   nodeId,
        //   userId: uname,
        //   nodeData: updatedNode,
        //   reasoning,
        //   actionType: 'delete collection',
        //   metadata: {
        //     relationType,
        //     collectionName
        //   }
        // });

        return updatedNode;
      });
    } catch (error) {
      console.error(`Error deleting ${relationType} collection:`, error);
      if (error instanceof ApiKeyValidationError) {
        throw error;
      }
      throw new ApiKeyValidationError(
        `Failed to delete collection: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Helper method to verify if a collection exists and get its index
   * @private
   */
  private static findCollectionIndex(
    specializations: ICollection[],
    collectionName: string
  ): number {
    const index = specializations.findIndex(c => c.collectionName === collectionName);
    if (index === -1) {
      throw new Error(`Collection "${collectionName}" not found`);
    }
    return index;
  }

  /**
   * Helper method to validate node existence in a collection
   * @private
   */
  private static validateNodesInCollection(
    nodes: { id: string }[],
    collection: ICollection
  ): void {
    const collectionNodeIds = new Set(collection.nodes.map(n => n.id));
    const nonExistingNodes = nodes.filter(node => !collectionNodeIds.has(node.id));

    if (nonExistingNodes.length > 0) {
      throw new Error(
        `The following nodes are not in the collection: ${nonExistingNodes.map(n => n.id).join(', ')}`
      );
    }
  }


  // SECTION 4: PARENT-CHILD RELATIONSHIP HELPERS
  // ==========================================
  // Helper methods for maintaining bidirectional relationships
  // - updateParentSpecializations - Updates parent node when adding a child

  /**
   * Updates the specializations of a parent node
   * 
   * This method adds a child node to the specializations collection of a parent node.
   * It's typically called when creating a new node or changing a node's parent.
   * 
   * @param parentId - The ID of the parent node
   * @param childId - The ID of the child node
   * @param transaction - The current Firestore transaction
   * @returns Promise<void>
   * @private
   */
  static async updateParentSpecializations(
    parentId: string,
    childId: string,
    transaction: FirebaseFirestore.Transaction
  ): Promise<void> {
    const parentRef = db.collection(NODES).doc(parentId);
    const parentDoc = await transaction.get(parentRef);

    if (!parentDoc.exists) return;

    const parentData = parentDoc.data() as INode;
    const specializations = parentData.specializations || [];

    // Find or create main collection
    let mainCollection = specializations.find(s => s.collectionName === 'main');
    if (!mainCollection) {
      mainCollection = { collectionName: 'main', nodes: [] };
      specializations.push(mainCollection);
    }

    // Add child if not already present
    if (!mainCollection.nodes.some(n => n.id === childId)) {
      mainCollection.nodes.push({ id: childId });
      transaction.update(parentRef, { specializations });
    }
  }
}