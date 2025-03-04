/**
 * Node Inheritance Service
 * 
 * This service manages inheritance relationships between nodes in the system.
 * It handles the creation, modification, and propagation of inheritance rules
 * and inherited properties across the node hierarchy.
 * 
 * Key responsibilities:
 * - Generation of inheritance structures for new nodes
 * - Management of inheritance rules for properties
 * - Property inheritance based on defined rules
 * - Propagation of property changes to inheriting nodes
 * - Regeneration of inheritance when relationships change
 * 
 * Inheritance types supported:
 * - neverInherit: Property is never inherited
 * - alwaysInherit: Property is always inherited, overriding child value
 * - inheritUnlessAlreadyOverRidden: Inherit only if not already defined in child
 * - inheritAfterReview: Property requires manual review before inheritance
 *
 * This service is used by NodeService and other services when handling
 * operations that involve inheritance relationships.
 */

import { db } from " @components/lib/firestoreServer/admin";
import { ApiKeyValidationError } from " @components/types/api";
import { INode, IInheritance, InheritanceType } from " @components/types/INode";
import { NODES } from " @components/lib/firestoreClient/collections";
import { deleteField } from "firebase/firestore";
import { ChangelogService } from "./changelog";

export class NodeInheritanceService {
  // Section: Inheritance Generation
  // - generateInheritance
  // - inheritProperties
  // - getParentNodeData

  /**
   * Generates inheritance structure based on parent node
   * 
   * Creates a new inheritance structure for a node based on its parent's inheritance.
   * This sets up which properties will be inherited and how inheritance behavior works
   * for each property.
   * 
   * @param parentInheritance - Inheritance structure from parent
   * @param nodeId - ID of the node being created
   * @returns IInheritance - New inheritance structure
   * @private
   */
  static generateInheritance(
    parentInheritance: IInheritance,
    nodeId: string
  ): IInheritance {
    // Create a deep copy to avoid modifying the original
    const newInheritance = JSON.parse(JSON.stringify(parentInheritance || {}));

    // For each property in inheritance, set reference to this node if not already set
    // Note: isPartOf is a special case that is never inherited
    for (const property in newInheritance) {
      if (!newInheritance[property].ref && property !== 'isPartOf') {
        newInheritance[property].ref = nodeId;
      }
    }

    return newInheritance;
  }

  /**
   * Inherits properties from parent node based on inheritance rules
   * 
   * This method applies inheritance rules to determine which properties should be inherited
   * from the parent node. It handles different inheritance types:
   * - neverInherit: Property is never inherited
   * - alwaysInherit: Property is always inherited, overriding child value
   * - inheritUnlessAlreadyOverRidden: Inherit only if not already defined in child
   * - inheritAfterReview: Property requires manual review before inheritance
   * 
   * @param parentNode - Parent node to inherit from
   * @param childProperties - Existing child properties (if any)
   * @param inheritance - Inheritance rules
   * @returns INode['properties'] - Combined properties with inheritance applied
   * @private
   */
  static inheritProperties(
    parentNode: INode,
    childProperties: INode['properties'],
    inheritance: IInheritance
  ): INode['properties'] {
    // Initialize with empty parts and isPartOf collections
    const inheritedProperties: INode['properties'] = {
      parts: [{ collectionName: 'main', nodes: [] }],
      isPartOf: [{ collectionName: 'main', nodes: [] }]
    };

    // Iterate through parent properties
    for (const [key, value] of Object.entries(parentNode.properties)) {
      const inheritanceRule = inheritance[key]?.inheritanceType;
      const isPropertyDefined = childProperties && key in childProperties;

      // Determine if the property should be a collection
      const isCollection = typeof value === 'object' && Array.isArray(value) &&
        value.length > 0 && value[0]?.collectionName === 'main';

      // Handle neverInherit case first
      if (inheritanceRule === 'neverInherit') {
        inheritedProperties[key] = isCollection ?
          [{ collectionName: 'main', nodes: [] }] :
          (childProperties?.[key] || null);
        continue;
      }

      // Handle different inheritance types
      switch (inheritanceRule) {
        case 'alwaysInherit':
          // Always inherit from parent, overriding any child values
          inheritedProperties[key] = isCollection ?
            value :
            (Array.isArray(value) ? [...value] : value);
          break;

        case 'inheritUnlessAlreadyOverRidden':
          // Inherit from parent only if not already defined in child
          if (isPropertyDefined) {
            inheritedProperties[key] = isCollection ?
              (Array.isArray(childProperties[key]) && childProperties[key][0]?.collectionName ?
                childProperties[key] :
                [{ collectionName: 'main', nodes: [] }]) :
              childProperties[key];
          } else {
            inheritedProperties[key] = isCollection ?
              value :
              (Array.isArray(value) ? [...value] : value);
          }
          break;

        case 'inheritAfterReview':
          // Don't inherit automatically, requires manual review
          inheritedProperties[key] = isCollection ?
            [{ collectionName: 'main', nodes: [] }] :
            (isPropertyDefined ? childProperties[key] : null);
          break;

        default:
          // Default case - use child value if defined, otherwise inherit from parent
          if (isPropertyDefined) {
            inheritedProperties[key] = isCollection ?
              (Array.isArray(childProperties[key]) && childProperties[key][0]?.collectionName ?
                childProperties[key] :
                [{ collectionName: 'main', nodes: [] }]) :
              childProperties[key];
          } else {
            inheritedProperties[key] = isCollection ?
              value :
              (Array.isArray(value) ? [...value] : value);
          }
      }
    }

    // Add any new properties from child that don't exist in parent
    if (childProperties) {
      for (const [key, value] of Object.entries(childProperties)) {
        if (!(key in inheritedProperties)) {
          inheritedProperties[key] = value;
        }
      }
    }

    // Ensure parts and isPartOf arrays are always present
    inheritedProperties.parts = inheritedProperties.parts || [];
    inheritedProperties.isPartOf = inheritedProperties.isPartOf || [];

    return inheritedProperties;
  }

  /**
 * Gets parent node data for inheritance generation
 * 
 * Retrieves the parent node based on the first generalization in the array.
 * This is used when creating or updating nodes to establish inheritance.
 * 
 * @param generalizations - Array of generalizations to identify parent node
 * @returns Promise<INode> - Parent node data
 * @throws ApiKeyValidationError if parent not found or no generalizations
 * @private
 */
  static async getParentNodeData(
    generalizations: INode['generalizations']
  ): Promise<INode> {
    if (!generalizations?.[0]?.nodes?.[0]?.id) {
      throw new ApiKeyValidationError('At least one generalization is required');
    }

    const parentId = generalizations[0].nodes[0].id;
    const parentDoc = await db.collection(NODES).doc(parentId).get();

    if (!parentDoc.exists) {
      throw new ApiKeyValidationError(`Parent node ${parentId} not found`);
    }

    return parentDoc.data() as INode;
  }


  // Section: Inheritance Management
  // - updateInheritance
  // - updatePropertyInheritance
  // - regenerateInheritance

  /**
 * Updates inheritance rules for multiple properties
 * 
 * This method updates the inheritance rules for multiple properties of a node,
 * handling the propagation of changes to child nodes based on the inheritance types.
 * 
 * @param nodeId - ID of the node to update
 * @param properties - Object mapping property names to inheritance rules
 * @param uname - Username performing the operation
 * @param reasoning - Reason for the update
 * @returns Promise<INode> - The updated node
 * @throws Error for validation failures or database errors
 */
  static async updateInheritance(
    nodeId: string,
    properties: { [propertyName: string]: { inheritanceType: InheritanceType['inheritanceType'] } },
    uname: string,
    reasoning: string
  ): Promise<INode> {
    try {
      // Input validation
      if (!nodeId?.trim()) {
        throw new ApiKeyValidationError('Invalid node ID. Please provide a valid node identifier.');
      }
      if (!properties || typeof properties !== 'object' || Object.keys(properties).length === 0) {
        throw new ApiKeyValidationError('At least one property inheritance rule must be specified.');
      }
      if (!uname?.trim()) {
        throw new ApiKeyValidationError('Username is required for tracking changes.');
      }

      const nodeRef = db.collection(NODES).doc(nodeId);

      return await db.runTransaction(async (transaction) => {
        // Get current node state
        const nodeDoc = await transaction.get(nodeRef);
        if (!nodeDoc.exists) {
          throw new Error(`Node ${nodeId} not found`);
        }

        const currentNode = nodeDoc.data() as INode;
        if (currentNode.deleted) {
          throw new Error('Cannot update inheritance of deleted node');
        }

        // Verify that all properties exist in the node
        for (const propertyName of Object.keys(properties)) {
          if (!(propertyName in currentNode.properties)) {
            throw new Error(`Property "${propertyName}" not found in node`);
          }
        }

        // Keep a copy of the original inheritance for the changelog
        const originalInheritance = JSON.parse(JSON.stringify(currentNode.inheritance || {}));

        // Prepare the updates
        const updatedInheritance = { ...currentNode.inheritance };
        const updatedProperties: string[] = [];
        const changedInheritanceTypes: { [propertyName: string]: string } = {};

        for (const [propertyName, rule] of Object.entries(properties)) {
          // Skip if no change in inheritance type
          if (updatedInheritance[propertyName]?.inheritanceType === rule.inheritanceType) {
            continue;
          }

          // Initialize inheritance object if it doesn't exist
          if (!updatedInheritance[propertyName]) {
            updatedInheritance[propertyName] = {
              ref: null,
              inheritanceType: rule.inheritanceType
            };
          } else {
            // Update the inheritance type
            updatedInheritance[propertyName].inheritanceType = rule.inheritanceType;
          }

          updatedProperties.push(propertyName);
          changedInheritanceTypes[propertyName] = rule.inheritanceType;
        }

        // If no changes, return current state
        if (updatedProperties.length === 0) {
          return currentNode;
        }

        // Prepare the node update
        const updatedNode: INode = {
          ...currentNode,
          inheritance: updatedInheritance,
          contributors: Array.from(new Set([...(currentNode.contributors || []), uname]))
        };

        // Execute the update
        transaction.update(nodeRef, {
          inheritance: updatedInheritance,
          contributors: updatedNode.contributors
        });

        // Create changelog entry
        await ChangelogService.log(
          nodeId,
          uname,
          'modify elements',
          updatedNode,
          reasoning,
          'inheritance',
          originalInheritance,
          updatedInheritance,
          {
            changedProperties: updatedProperties,
            changedInheritanceTypes
          }
        );

        // Now we need to handle the specializations that might inherit from this node
        // Let's find all specializations that need to be updated
        const specializations = await this.findNodeSpecializations(nodeId, transaction);

        // Update each specialization if needed
        for (const spec of specializations) {
          await this.updateSpecializationInheritance(
            spec.id,
            updatedProperties,
            nodeId,
            transaction
          );
        }

        return updatedNode;
      });
    } catch (error) {
      console.error('Error updating inheritance:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to update inheritance: ${errorMessage}`);
    }
  }

  /**
   * Updates inheritance rule for a single property
   * 
   * This method updates the inheritance rule for a specific property,
   * handling the propagation of changes to child nodes.
   * 
   * @param nodeId - ID of the node to update
   * @param propertyName - Name of the property to update
   * @param inheritanceType - New inheritance type
   * @param uname - Username performing the operation
   * @param reasoning - Reason for the update
   * @returns Promise<INode> - The updated node
   * @throws Error for validation failures or database errors
   */
  static async updatePropertyInheritance(
    nodeId: string,
    propertyName: string,
    inheritanceType: InheritanceType['inheritanceType'],
    uname: string,
    reasoning: string
  ): Promise<INode> {
    try {
      // Input validation
      if (!nodeId?.trim()) {
        throw new ApiKeyValidationError('Invalid node ID. Please provide a valid node identifier.');
      }
      if (!propertyName?.trim()) {
        throw new ApiKeyValidationError('Property name is required.');
      }
      if (!inheritanceType) {
        throw new ApiKeyValidationError('Inheritance type is required.');
      }
      if (!uname?.trim()) {
        throw new ApiKeyValidationError('Username is required for tracking changes.');
      }

      // Call the more general updateInheritance method with a single property
      return this.updateInheritance(
        nodeId,
        { [propertyName]: { inheritanceType } },
        uname,
        reasoning
      );
    } catch (error) {
      console.error('Error updating property inheritance:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to update property inheritance: ${errorMessage}`);
    }
  }

  /**
   * Regenerates the inheritance structure for a node
   * 
   * This method is useful when a node's relationships change significantly
   * and the inheritance structure needs to be refreshed. It follows the same
   * logic as when a node is created, generating a proper inheritance structure
   * based on parent nodes.
   * 
   * @param nodeId - ID of the node to update
   * @param uname - Username performing the operation
   * @param reasoning - Reason for the regeneration
   * @returns Promise<INode> - The updated node with regenerated inheritance
   * @throws Error for validation failures or database errors
   */
  static async regenerateInheritance(
    nodeId: string,
    uname: string,
    reasoning: string
  ): Promise<INode> {
    try {
      // Input validation
      if (!nodeId?.trim()) {
        throw new ApiKeyValidationError('Invalid node ID. Please provide a valid node identifier.');
      }
      if (!uname?.trim()) {
        throw new ApiKeyValidationError('Username is required for tracking changes.');
      }

      const nodeRef = db.collection(NODES).doc(nodeId);

      return await db.runTransaction(async (transaction) => {
        // Get current node
        const nodeDoc = await transaction.get(nodeRef);
        if (!nodeDoc.exists) {
          throw new Error(`Node ${nodeId} not found`);
        }

        const currentNode = nodeDoc.data() as INode;
        if (currentNode.deleted) {
          throw new Error('Cannot regenerate inheritance for deleted node');
        }

        // Check if node has generalizations
        if (!currentNode.generalizations?.[0]?.nodes?.length) {
          throw new Error('Node must have at least one generalization to regenerate inheritance');
        }

        // Keep a copy of the original inheritance for the changelog
        const originalInheritance = JSON.parse(JSON.stringify(currentNode.inheritance || {}));

        // Get parent node data for inheritance generation
        const parentData = await this.getParentNodeData(currentNode.generalizations);

        // Generate new inheritance structure
        const newInheritance = this.generateInheritance(parentData.inheritance, nodeId);

        // Generate inherited properties
        const newProperties = this.inheritProperties(
          parentData,
          currentNode.properties,
          newInheritance
        );

        // Find affected properties (properties that changed)
        const affectedProperties = Object.keys(newProperties).filter(
          prop => JSON.stringify(currentNode.properties[prop]) !== JSON.stringify(newProperties[prop])
        );

        // Prepare the node update
        const updatedNode: INode = {
          ...currentNode,
          inheritance: newInheritance,
          properties: newProperties,
          contributors: Array.from(new Set([...(currentNode.contributors || []), uname]))
        };

        // Execute the update
        transaction.update(nodeRef, {
          inheritance: newInheritance,
          properties: newProperties,
          contributors: updatedNode.contributors
        });

        // Create changelog
        await ChangelogService.log(
          nodeId,
          uname,
          'modify elements',
          updatedNode,
          reasoning,
          'inheritance',
          originalInheritance,
          newInheritance,
          {
            action: 'regenerateInheritance',
            affectedProperties
          }
        );

        // Now we need to handle the specializations that might inherit from this node
        // Let's find all specializations that need to be updated
        const specializations = await this.findNodeSpecializations(nodeId, transaction);

        // Update each specialization if needed
        for (const spec of specializations) {
          await this.updateSpecializationInheritance(
            spec.id,
            affectedProperties,
            nodeId,
            transaction
          );
        }

        return updatedNode;
      });
    } catch (error) {
      console.error('Error regenerating inheritance:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to regenerate inheritance: ${errorMessage}`);
    }
  }

  // Section: Inheritance Helpers
  // - findNodeSpecializations
  // - updateSpecializationInheritance
  // - isPropertyInheritedThrough
  // - getPropertyInheritanceSource
  // - updateInheritanceWhenUnlinkAGeneralization
  // - updateSpecializationsInheritance
  // - handleInheritanceUpdates

  /**
   * Helper method to find all direct specializations of a node
   * 
   * @param nodeId - ID of the node to find specializations for
   * @param transaction - Current Firestore transaction
   * @returns Promise<Array<{id: string}>> - Array of specialization nodes
   * @private
  */
  static async findNodeSpecializations(
    nodeId: string,
    transaction: FirebaseFirestore.Transaction
  ): Promise<Array<{ id: string }>> {
    try {
      // Get the node to get its specializations
      const nodeRef = db.collection(NODES).doc(nodeId);
      const nodeDoc = await transaction.get(nodeRef);

      if (!nodeDoc.exists) {
        return [];
      }

      const node = nodeDoc.data() as INode;

      // Flatten all specializations from all collections
      return node.specializations?.flatMap(collection => collection.nodes) || [];
    } catch (error) {
      console.error('Error finding node specializations:', error);
      return [];
    }
  }

  /**
   * Helper method to update inheritance for a specialization node
   * 
   * @param specId - ID of the specialization node to update
   * @param properties - List of properties to check for inheritance updates
   * @param parentId - ID of the parent node (generalization)
   * @param transaction - Current Firestore transaction
   * @returns Promise<void>
   * @private
  */
  static async updateSpecializationInheritance(
    specId: string,
    properties: string[],
    parentId: string,
    transaction: FirebaseFirestore.Transaction
  ): Promise<void> {
    try {
      // Get the specialization node
      const specRef = db.collection(NODES).doc(specId);
      const specDoc = await transaction.get(specRef);

      if (!specDoc.exists) {
        return;
      }

      const spec = specDoc.data() as INode;

      // Get the parent node to get its new property values
      const parentRef = db.collection(NODES).doc(parentId);
      const parentDoc = await transaction.get(parentRef);

      if (!parentDoc.exists) {
        return;
      }

      const parent = parentDoc.data() as INode;

      // Check each property to see if it should be updated
      const updates: { [key: string]: any } = {};
      let hasUpdates = false;

      for (const prop of properties) {
        // Check if this property is inherited from the parent
        if (spec.inheritance?.[prop]?.ref === parentId) {
          const inheritanceType = spec.inheritance[prop].inheritanceType;

          // Apply the inheritance rule
          switch (inheritanceType) {
            case 'alwaysInherit':
              // Always inherit the property value
              updates[`properties.${prop}`] = parent.properties[prop];
              hasUpdates = true;
              break;

            case 'inheritUnlessAlreadyOverRidden':
              // Only inherit if the property doesn't already exist in the specialization
              if (!(prop in spec.properties)) {
                updates[`properties.${prop}`] = parent.properties[prop];
                hasUpdates = true;
              }
              break;

            case 'inheritAfterReview':
              // Do nothing - requires manual review
              break;

            case 'neverInherit':
              // Do nothing - never inherit
              break;
          }
        }
      }

      // Apply updates if there are any
      if (hasUpdates) {
        transaction.update(specRef, updates);

        // Recursively update this node's specializations
        const childSpecs = await this.findNodeSpecializations(specId, transaction);

        for (const childSpec of childSpecs) {
          await this.updateSpecializationInheritance(
            childSpec.id,
            properties,
            specId,
            transaction
          );
        }
      }
    } catch (error) {
      console.error('Error updating specialization inheritance:', error);
    }
  }

  /**
   * Checks if a property is inherited through a specific generalization
   * 
   * This helper method determines if a property is indirectly inherited
   * through a given generalization node.
   * 
   * @param property - Name of the property to check
   * @param directRefId - Direct reference ID in inheritance
   * @param generalizationId - ID of the generalization to check
   * @param nodesMap - Map of node IDs to node data
   * @returns boolean - true if property is inherited through the generalization
   * @private 
  */
  static isPropertyInheritedThrough(
    property: string,
    directRefId: string,
    generalizationId: string,
    nodesMap: { [nodeId: string]: INode }
  ): boolean {
    const refNode = nodesMap[directRefId];
    if (!refNode) return false;

    // Check if the reference node inherits from the generalization
    const inheritance = refNode.inheritance?.[property];
    if (!inheritance) return false;

    // Direct inheritance
    if (inheritance.ref === generalizationId) return true;

    // Recursive check for indirect inheritance
    if (inheritance.ref && nodesMap[inheritance.ref]) {
      return this.isPropertyInheritedThrough(property, inheritance.ref, generalizationId, nodesMap);
    }

    return false;
  }

  /**
   * Gets the ultimate source of a property's inheritance
   * 
   * This helper method determines the original source node for a property,
   * following the inheritance chain to its root.
   * 
   * @param property - Name of the property to check
   * @param nodeId - ID of the node to start from
   * @param nodesMap - Map of node IDs to node data
   * @returns string - ID of the ultimate source node
   * @private
  */
  static getPropertyInheritanceSource(
    property: string,
    nodeId: string,
    nodesMap: { [nodeId: string]: INode }
  ): string {
    const node = nodesMap[nodeId];
    if (!node) return nodeId;

    const inheritance = node.inheritance?.[property];
    if (!inheritance || !inheritance.ref) return nodeId;

    // Follow the inheritance chain
    return this.getPropertyInheritanceSource(property, inheritance.ref, nodesMap);
  }

  /**
    * Updates inheritance when unlinking a generalization node
    * @param db - Firestore database instance
    * @param unlinkedGeneralizationId - ID of the generalization being unlinked
    * @param specializationData - Data of the specialization node
    * @param nodes - Map of relevant nodes
    * @returns Promise<void>
    * @private
  */
  static async updateInheritanceWhenUnlinkAGeneralization(
    db: any,
    unlinkedGeneralizationId: string,
    specializationData: INode,
    nodes: { [nodeId: string]: INode }
  ): Promise<void> {
    try {
      if (!specializationData) return;

      const batch = db.batch();

      // Get remaining generalizations after unlinking
      const remainingGeneralizations = specializationData.generalizations
        .flatMap(collection => collection.nodes)
        .filter(node => node.id !== unlinkedGeneralizationId);

      if (remainingGeneralizations.length === 0) {
        // No generalizations left, no inheritance updates needed
        return;
      }

      // Get the next generalization to inherit from
      const nextGeneralization = remainingGeneralizations[0];
      const nextGeneralizationData = nodes[nextGeneralization.id];
      const unlinkedGeneralization = nodes[unlinkedGeneralizationId];

      if (!nextGeneralizationData) return;

      const deletedProperties: string[] = [];
      const updatedProperties: { [ref: string]: string[] } = {};

      // Check each property in the specialization's inheritance
      for (const property in specializationData.inheritance) {
        const currentInheritance = specializationData.inheritance[property];

        if (currentInheritance && currentInheritance.ref !== null &&
          (currentInheritance.ref === unlinkedGeneralizationId ||
            unlinkedGeneralization.inheritance[property]?.ref === currentInheritance.ref)) {

          // Check if property exists in next generalization
          if (!nextGeneralizationData.properties.hasOwnProperty(property)) {
            let canDelete = true;
            let inheritFrom: string | null = null;

            // Check other remaining generalizations for the property
            for (const generalization of remainingGeneralizations) {
              const generalizationData = nodes[generalization.id];
              if (generalizationData.properties.hasOwnProperty(property)) {
                canDelete = false;
                inheritFrom = generalization.id;
                break;
              }
            }

            if (canDelete) {
              deletedProperties.push(property);
            } else if (inheritFrom) {
              if (!updatedProperties[inheritFrom]) {
                updatedProperties[inheritFrom] = [];
              }
              updatedProperties[inheritFrom].push(property);
            }
          } else {
            if (!updatedProperties[nextGeneralization.id]) {
              updatedProperties[nextGeneralization.id] = [];
            }
            updatedProperties[nextGeneralization.id].push(property);
          }
        }
      }

      // Apply inheritance updates
      if (deletedProperties.length > 0) {
        const updates: { [key: string]: any } = {};
        deletedProperties.forEach(property => {
          updates[`inheritance.${property}`] = db.FieldValue.delete();
          updates[`properties.${property}`] = db.FieldValue.delete();
        });
        batch.update(db.collection(NODES).doc(specializationData.id), updates);
      }

      // Update properties with new inheritance references
      for (const [inheritFromId, properties] of Object.entries(updatedProperties)) {
        const updates: { [key: string]: any } = {};
        properties.forEach(property => {
          updates[`inheritance.${property}.ref`] = inheritFromId;
        });
        batch.update(db.collection(NODES).doc(specializationData.id), updates);
      }

      await batch.commit();
    } catch (error) {
      console.error('Error updating inheritance when unlinking generalization:', error);
      throw error;
    }
  }

  /**
   * Updates inheritance for all specializations after removing a generalization
   * 
   * This helper method recursively updates inheritance for all specializations
   * of a node after a generalization is removed.
   * 
   * @param nodeId - ID of the parent node
   * @param deletedProperties - List of properties that were deleted
   * @param updatedProperties - Map of properties that were updated
   * @param nodesMap - Map of node IDs to node data
   * @returns Promise<void>
   * @private
  */
  static async updateSpecializationsInheritance(
    nodeId: string,
    deletedProperties: string[],
    updatedProperties: { [ref: string]: string[] },
    nodesMap: { [nodeId: string]: INode }
  ): Promise<void> {
    try {
      // Get the current node
      const nodeRef = db.collection(NODES).doc(nodeId);
      const nodeDoc = await nodeRef.get();

      if (!nodeDoc.exists) return;

      const nodeData = nodeDoc.data() as INode;

      // Get all specializations
      const specializationRefs = nodeData.specializations
        ?.flatMap(c => c.nodes)
        .map(n => db.collection(NODES).doc(n.id)) || [];

      if (specializationRefs.length === 0) return;

      // Load all specialization nodes
      const specDocs = await Promise.all(specializationRefs.map(ref => ref.get()));
      const specNodes = specDocs
        .filter(doc => doc.exists)
        .map(doc => {
          const data = doc.data() as INode;
          return { id: doc.id, data };
        });

      // Update each specialization
      let batch = db.batch();
      let batchCount = 0;

      for (const { id: specId, data: specData } of specNodes) {
        const specRef = db.collection(NODES).doc(specId);
        const updates: { [key: string]: any } = {};
        let hasUpdates = false;

        // Handle deleted properties
        for (const property of deletedProperties) {
          // Only delete if inherited from this node
          if (specData.inheritance?.[property]?.ref === nodeId) {
            updates[`inheritance.${property}`] = deleteField();
            updates[`properties.${property}`] = deleteField();
            updates[`textValue.${property}`] = deleteField();
            updates[`propertyType.${property}`] = deleteField();
            hasUpdates = true;
          }
        }

        // Handle updated properties
        for (const [sourceId, properties] of Object.entries(updatedProperties)) {
          for (const property of properties) {
            // Only update if inherited from this node
            if (specData.inheritance?.[property]?.ref === nodeId) {
              updates[`inheritance.${property}.ref`] = sourceId;

              // Update property value to match the source
              const sourceNode = nodesMap[sourceId];
              if (sourceNode) {
                updates[`properties.${property}`] = sourceNode.properties[property];
              }
              hasUpdates = true;
            }
          }
        }

        // Apply updates if there are any
        if (hasUpdates) {
          batch.update(specRef, updates);
          batchCount++;

          // Commit batch if it gets too large
          if (batchCount >= 400) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
          }
        }

        // Recursively update this specialization's specializations
        await this.updateSpecializationsInheritance(specId, deletedProperties, updatedProperties, nodesMap);
      }

      // Commit any remaining batch operations
      if (batchCount > 0) {
        await batch.commit();
      }
    } catch (error) {
      console.error('Error updating specializations inheritance:', error);
      throw error;
    }
  }

  /**
    * Handles updates to inheriting nodes when properties change
    * 
    * When a node's properties change, this method propagates those changes to
    * child nodes (specializations) that inherit the modified properties.
    * 
    * @param transaction - Current Firestore transaction
    * @param nodeId - ID of the node being updated
    * @param currentNode - Current node data
    * @param updatedProperties - Names of properties that changed
    * @param newProperties - New property values
    * @returns Promise<void>
    * @private
  */
  static async handleInheritanceUpdates(
    transaction: FirebaseFirestore.Transaction,
    nodeId: string,
    currentNode: INode,
    updatedProperties: string[],
    newProperties: { [key: string]: any }
  ): Promise<void> {
    // Get all specializations that inherit from this node
    const specializations = currentNode.specializations
      .flatMap(collection => collection.nodes)
      .map(node => node.id);

    if (specializations.length === 0) return;

    // Fetch all specialization nodes
    const specializationRefs = specializations.map(id =>
      db.collection(NODES).doc(id)
    );

    // Step 1: Perform ALL reads first (transactions should do reads before writes)
    const specializationDocs = await Promise.all(
      specializationRefs.map(ref => transaction.get(ref))
    );

    // Step 2: Prepare all updates (without performing writes yet)
    const updateOperations: Array<{
      ref: FirebaseFirestore.DocumentReference,
      data: { [key: string]: any }
    }> = [];

    // Analyze each specialization and prepare updates
    for (const doc of specializationDocs) {
      if (!doc.exists) continue;

      const specializationNode = doc.data() as INode;
      const propertiesToUpdate: { [key: string]: any } = {};

      for (const property of updatedProperties) {
        const inheritance = specializationNode.inheritance[property];

        // Only update if property is inherited from this node
        if (inheritance?.ref === nodeId) {
          propertiesToUpdate[`properties.${property}`] = newProperties[property];
        }
      }

      if (Object.keys(propertiesToUpdate).length > 0) {
        updateOperations.push({
          ref: doc.ref,
          data: propertiesToUpdate
        });
      }
    }

    // Step 3: Now perform all writes
    for (const operation of updateOperations) {
      transaction.update(operation.ref, operation.data);
    }
  }
}