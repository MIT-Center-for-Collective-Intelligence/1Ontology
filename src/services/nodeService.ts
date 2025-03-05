/**
 * Core Node Service
 * 
 * This service provides the main entry point for node-related operations in the system.
 * It focuses on core CRUD operations and coordinates between specialized services
 * for more complex operations like inheritance, relationships, and part management.
 * 
 * Key responsibilities:
 * - Creation, retrieval, updating, and deletion of nodes (CRUD)
 * - Node listing with filtering and pagination
 * - Property management and tracking
 * - Coordination between specialized services
 * - Change tracking for all node operations
 * 
 * This service delegates specialized functionality to:
 * - NodeInheritanceService: For inheritance-related operations
 * - NodeRelationshipService: For managing specialization/generalization relationships
 * - NodePartsService: For managing part-whole relationships
 * - ChangelogService: For tracking all changes to nodes
 */

import { NODES } from " @components/lib/firestoreClient/collections";
import { db } from " @components/lib/firestoreServer/admin";
import { ApiKeyValidationError } from " @components/types/api";
import { INode, ICollection, IInheritance, NodeChange, InheritanceType } from " @components/types/INode";
import { arrayUnion, deleteField } from "firebase/firestore";
import { ChangelogService } from "./changelog";
import { NodeInheritanceService } from './nodeInheritanceService';
import { NodeRelationshipService } from "./nodeRelationshipService";
import { NodePartsService } from "./nodePartsService";

/**
 * Interface for node creation request
 */
export interface CreateNodeRequest {
  node: {
    title: string;
    properties: INode['properties'];
    inheritance: INode['inheritance'];
    specializations: INode['specializations'];
    generalizations: INode['generalizations'];
    root: string;
    propertyType: INode['propertyType'];
    nodeType: INode['nodeType'];
    textValue: INode['textValue'];
  };
  reasoning: string;
}

/**
 * Interface for node creation response
 */
export interface CreateNodeResponse {
  nodeId: string;
  node: INode;
}

/**
 * Result interface for updateNodeProperties method
 */
interface UpdateNodePropertiesResult {
  node: INode;
  updatedProperties: string[];
}

/**
 * Parameters for listing nodes with filtering options
 */
interface ListNodesParams {
  nodeType?: INode['nodeType'];
  root?: string;
  limit?: number;
  offset?: number;
  deleted?: boolean;
}

export class NodeService {
  //===========================================================================
  // SECTION 1: NODE BASIC OPERATIONS (CRUD)
  //===========================================================================
  // This section contains the core Create, Read, Update, Delete operations
  // for nodes. These methods form the foundation of node management and are
  // used by other services and API endpoints.

  /**
   * Retrieves a node by its ID
   * 
   * @param nodeId - The ID of the node to retrieve
   * @returns Promise<INode> - The retrieved node
   * @throws Error if node is not found
   */
  static async getNode(nodeId: string): Promise<INode> {
    try {
      const nodeRef = db.collection(NODES).doc(nodeId);
      const nodeDoc = await nodeRef.get();

      if (!nodeDoc.exists) {
        throw new Error('Node not found');
      }

      return nodeDoc.data() as INode;
    } catch (error) {
      console.error('Error retrieving node:', error);
      throw error;
    }
  }

  /**
     * Creates a new node with inherited properties and generated inheritance
     * 
     * This method creates a new node based on the provided request data,
     * handles inheritance from parent nodes, and establishes relationships
     * with other nodes in the system.
     * 
     * @param request - CreateNodeRequest containing node data and reasoning
     * @param uname - Username of the creator
     * @returns Promise<INode> - The created node
     * @throws ApiKeyValidationError for validation failures
     */
  static async createNode(
    request: CreateNodeRequest,
    uname: string
  ): Promise<INode> {
    try {
      const { node, reasoning } = request;
      const nodeRef = db.collection(NODES).doc();
      const id = nodeRef.id;

      // Normalize generalizations to ensure they use the "main" collection
      const normalizedGeneralizations: ICollection[] = [];
      if (node.generalizations && node.generalizations.length > 0) {
        // Get all nodes from all collections
        const allNodes = node.generalizations.flatMap(collection => collection.nodes || []);
        if (allNodes.length > 0) {
          // Create a main collection with all generalization nodes
          normalizedGeneralizations.push({
            collectionName: 'main',
            nodes: allNodes.filter(n => n && n.id)
          });
        }
      }

      // Get parent node data for inheritance
      // Use normalizedGeneralizations to ensure correct format
      const parentData = await NodeInheritanceService.getParentNodeData(normalizedGeneralizations);
      const parentId = normalizedGeneralizations[0]?.nodes[0]?.id;

      const inheritance: IInheritance = {};

      // Create a working copy of properties to modify
      const properties = { ...node.properties };

      // Normalize parts and isPartOf if they exist
      if (properties.parts) {
        properties.parts = NodePartsService.normalizeCollection(properties.parts);
      } else {
        properties.parts = [{ collectionName: 'main', nodes: [] }];
      }

      if (properties.isPartOf) {
        properties.isPartOf = NodePartsService.normalizeCollection(properties.isPartOf);
      } else {
        properties.isPartOf = [{ collectionName: 'main', nodes: [] }];
      }

      // For each property in the parent, set up the inheritance structure correctly
      for (const key in parentData.properties) {
        if (!(key in node.properties)) {
          properties[key] = parentData.properties[key];

          if (key === 'parts' || key === 'isPartOf') {
            properties[key] = NodePartsService.normalizeCollection(properties[key]);
          }

          // Set inheritance to point to parent
          inheritance[key] = {
            ref: parentId,
            inheritanceType: parentData.inheritance[key]?.inheritanceType || "inheritUnlessAlreadyOverRidden"
          };
        } else {
          // Property exists in both - it's being overridden
          // Check if the values are different
          if (JSON.stringify(node.properties[key]) !== JSON.stringify(parentData.properties[key])) {
            // Property is being overridden, set ref to null
            inheritance[key] = {
              ref: null,
              inheritanceType: "inheritUnlessAlreadyOverRidden"
            };
          } else {
            inheritance[key] = {
              ref: parentId,
              inheritanceType: parentData.inheritance[key]?.inheritanceType || "inheritUnlessAlreadyOverRidden"
            };
          }
        }
      }

      // For any properties in the child that aren't in the parent, mark them as new properties
      for (const key in node.properties) {
        if (!(key in parentData.properties)) {
          inheritance[key] = {
            ref: null, // Not inherited from anywhere
            inheritanceType: "inheritUnlessAlreadyOverRidden"
          };
        }
      }

      // Special handling for isPartOf - it's never inherited
      if (inheritance.isPartOf) {
        inheritance.isPartOf = {
          ref: null,
          inheritanceType: "neverInherit"
        };
      }

      // Normalize specializations to ensure they use the "main" collection if not specified
      let normalizedSpecializations: ICollection[] = [];
      if (node.specializations && node.specializations.length > 0) {
        // Check if any collections are defined
        const hasNamedCollections = node.specializations.some(
          collection => collection.collectionName && collection.collectionName.trim() !== ''
        );

        if (hasNamedCollections) {
          // Use the collections as provided
          normalizedSpecializations = node.specializations;
        } else {
          // Create a main collection with all specialization nodes
          const allNodes = node.specializations.flatMap(collection => collection.nodes || []);
          if (allNodes.length > 0) {
            normalizedSpecializations = [
              {
                collectionName: 'main',
                nodes: allNodes.filter(n => n && n.id)
              }
            ];
          }
        }
      }

      const nodeData: INode = {
        ...node,
        id,
        deleted: false,
        createdBy: uname,
        properties: properties,
        inheritance: inheritance,
        specializations: normalizedSpecializations,
        generalizations: normalizedGeneralizations,
        root: node.root || '',
        propertyType: node.propertyType || parentData.propertyType || {},
        nodeType: node.nodeType,
        textValue: node.textValue || {},
        contributors: [uname],
        contributorsByProperty: {},
        propertyOf: {},
        locked: false
      };

      // Execute transaction
      await db.runTransaction(async (transaction) => {
        // Step 1: Collect all nodes that need to be read
        const referencesToRead = new Set<string>();

        // Add nodes from relationships - using normalizedGeneralizations
        if (normalizedGeneralizations.length > 0 && normalizedGeneralizations[0].nodes) {
          normalizedGeneralizations[0].nodes.forEach(parent => {
            if (parent.id) referencesToRead.add(parent.id);
          });
        }

        // Add specialization nodes
        if (normalizedSpecializations.length > 0) {
          normalizedSpecializations.forEach(collection => {
            if (collection.nodes) {
              collection.nodes.forEach(child => {
                if (child.id) referencesToRead.add(child.id);
              });
            }
          });
        }

        // Add part nodes
        if (properties.parts) {
          properties.parts.forEach(collection => {
            if (collection.nodes) {
              collection.nodes.forEach(part => {
                if (part.id) referencesToRead.add(part.id);
              });
            }
          });
        }

        // Add isPartOf nodes
        if (properties.isPartOf) {
          properties.isPartOf.forEach(collection => {
            if (collection.nodes) {
              collection.nodes.forEach(whole => {
                if (whole.id) referencesToRead.add(whole.id);
              });
            }
          });
        }

        // Step 2: Read all referenced nodes
        const nodeRefs = Array.from(referencesToRead).map(refId =>
          db.collection(NODES).doc(refId)
        );
        const nodeDocs = await Promise.all(
          nodeRefs.map(ref => transaction.get(ref))
        );

        // Create a map of node data
        const nodeDataMap = new Map(
          nodeDocs.map(doc => [doc.id, doc.data() as INode])
        );

        // Step 3: Create the new node
        transaction.set(nodeRef, nodeData);

        // Step 4: Update parent nodes (generalizations)
        if (normalizedGeneralizations.length > 0 && normalizedGeneralizations[0].nodes) {
          normalizedGeneralizations[0].nodes.forEach(parent => {
            if (!parent.id) return;

            const parentNodeData = nodeDataMap.get(parent.id);
            if (!parentNodeData) return;

            const updatedSpecializations = [...(parentNodeData.specializations || [])];
            let mainCollection = updatedSpecializations.find(s => s.collectionName === 'main');

            if (!mainCollection) {
              mainCollection = { collectionName: 'main', nodes: [] };
              updatedSpecializations.push(mainCollection);
            }

            if (!mainCollection.nodes.some(n => n.id === id)) {
              mainCollection.nodes.push({ id });
              transaction.update(db.collection(NODES).doc(parent.id), {
                specializations: updatedSpecializations
              });
            }
          });
        }

        // Step 5: Update child nodes (specializations)
        if (normalizedSpecializations.length > 0) {
          for (const collection of normalizedSpecializations) {
            if (!collection.nodes) continue;

            for (const childNode of collection.nodes) {
              if (!childNode.id) continue;

              const childNodeData = nodeDataMap.get(childNode.id);
              if (!childNodeData) continue;

              const updatedGeneralizations = [...(childNodeData.generalizations || [])];
              let mainCollection = updatedGeneralizations.find(g => g.collectionName === 'main');

              if (!mainCollection) {
                mainCollection = { collectionName: 'main', nodes: [] };
                updatedGeneralizations.push(mainCollection);
              }

              if (!mainCollection.nodes.some(n => n.id === id)) {
                mainCollection.nodes.push({ id });
                transaction.update(db.collection(NODES).doc(childNode.id), {
                  generalizations: updatedGeneralizations
                });
              }
            }
          }
        }

        // Step 6: Update part nodes (add this node to their isPartOf)
        if (properties.parts) {
          for (const collection of properties.parts) {
            if (!collection.nodes) continue;

            for (const partNode of collection.nodes) {
              if (!partNode.id) continue;

              const partNodeData = nodeDataMap.get(partNode.id);
              if (!partNodeData) continue;

              // Get existing isPartOf or create if missing
              const partProperties = { ...partNodeData.properties };
              if (!partProperties.isPartOf) {
                partProperties.isPartOf = [{ collectionName: 'main', nodes: [] }];
              }

              // Find or create the main collection
              let mainIsPartOfCollection = partProperties.isPartOf.find(c => c.collectionName === 'main');
              if (!mainIsPartOfCollection) {
                mainIsPartOfCollection = { collectionName: 'main', nodes: [] };
                partProperties.isPartOf.push(mainIsPartOfCollection);
              }

              // Add this node if not already in isPartOf
              if (!mainIsPartOfCollection.nodes.some(n => n.id === id)) {
                const updatedIsPartOf = partProperties.isPartOf.map(c => {
                  if (c.collectionName === 'main') {
                    return {
                      ...c,
                      nodes: [...c.nodes, { id }]
                    };
                  }
                  return c;
                });

                transaction.update(db.collection(NODES).doc(partNode.id), {
                  'properties.isPartOf': updatedIsPartOf
                });
              }
            }
          }
        }

        // Step 7: Update whole nodes (add this node to their parts)
        if (properties.isPartOf) {
          for (const collection of properties.isPartOf) {
            if (!collection.nodes) continue;

            for (const wholeNode of collection.nodes) {
              if (!wholeNode.id) continue;

              const wholeNodeData = nodeDataMap.get(wholeNode.id);
              if (!wholeNodeData) continue;

              // Get existing parts or create if missing
              const wholeProperties = { ...wholeNodeData.properties };
              if (!wholeProperties.parts) {
                wholeProperties.parts = [{ collectionName: 'main', nodes: [] }];
              }

              // Find or create the main collection
              let mainPartsCollection = wholeProperties.parts.find(c => c.collectionName === 'main');
              if (!mainPartsCollection) {
                mainPartsCollection = { collectionName: 'main', nodes: [] };
                wholeProperties.parts.push(mainPartsCollection);
              }

              // Add this node if not already in parts
              if (!mainPartsCollection.nodes.some(n => n.id === id)) {
                const updatedParts = wholeProperties.parts.map(c => {
                  if (c.collectionName === 'main') {
                    return {
                      ...c,
                      nodes: [...c.nodes, { id }]
                    };
                  }
                  return c;
                });

                transaction.update(db.collection(NODES).doc(wholeNode.id), {
                  'properties.parts': updatedParts
                });
              }
            }
          }
        }

        // Step 8: Create changelog
        await ChangelogService.log(id, uname, "add node", nodeData, reasoning);
      });

      return nodeData;
    } catch (error) {
      console.error('Error creating node:', error);
      throw error;
    }
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
          nodes: allNodes.filter(n => n && n.id)
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

  /**
   * Updates an existing node
   * 
   * This method handles comprehensive updates to a node, including
   * relationship changes, property updates, and inheritance adjustments.
   * 
   * @param nodeId - ID of the node to update
   * @param updatedNode - New node data
   * @param uname - Username of the user performing the update
   * @param reasoning - Reason for the update
   * @returns Promise<INode> - The updated node data
   * @throws Error if node not found or is deleted
   */
  static async updateNode(
    nodeId: string,
    updatedNode: Partial<INode>,
    uname: string,
    reasoning: string
  ): Promise<INode> {
    try {
      const nodeRef = db.collection(NODES).doc(nodeId);

      // Check for circular references in the update data
      if (updatedNode.generalizations && updatedNode.specializations) {
        const circularIds = this.detectCircularReferences(
          updatedNode.generalizations,
          updatedNode.specializations
        );

        if (circularIds.length > 0) {
          throw new Error(
            `Circular reference detected: Node(s) ${circularIds.join(', ')} cannot be both a generalization and specialization of the same node`
          );
        }
      } else if (updatedNode.generalizations || updatedNode.specializations) {
        // Need to check against existing data as well if only one is being updated
        const nodeDoc = await nodeRef.get();
        if (nodeDoc.exists) {
          const currentNode = nodeDoc.data() as INode;

          const generalizations = updatedNode.generalizations || currentNode.generalizations;
          const specializations = updatedNode.specializations || currentNode.specializations;

          const circularIds = this.detectCircularReferences(
            generalizations,
            specializations
          );

          if (circularIds.length > 0) {
            throw new Error(
              `Circular reference detected: Node(s) ${circularIds.join(', ')} cannot be both a generalization and specialization of the same node`
            );
          }
        }
      }

      // Validate specialization nodes existence if any are provided
      if (updatedNode.specializations && updatedNode.specializations.length > 0) {
        const specializationNodeIds = updatedNode.specializations
          .flatMap(collection => collection.nodes || [])
          .filter(node => node && node.id)
          .map(node => node.id);

        if (specializationNodeIds.length > 0) {
          const specializationNodesRefs = specializationNodeIds.map(id =>
            db.collection(NODES).doc(id)
          );

          const specializationDocs = await Promise.all(
            specializationNodesRefs.map(ref => ref.get())
          );

          const nonExistentNodes = specializationDocs
            .filter(doc => !doc.exists)
            .map((_, index) => specializationNodeIds[index]);

          if (nonExistentNodes.length > 0) {
            throw new Error(
              `The following specialization nodes do not exist: ${nonExistentNodes.join(', ')}`
            );
          }
        }
      }

      // Validate parts nodes existence if any are provided
      if (updatedNode.properties?.parts && updatedNode.properties.parts.length > 0) {
        const partNodeIds = updatedNode.properties.parts
          .flatMap(collection => collection.nodes || [])
          .filter(node => node && node.id)
          .map(node => node.id);

        if (partNodeIds.length > 0) {
          const partNodesRefs = partNodeIds.map(id =>
            db.collection(NODES).doc(id)
          );

          const partDocs = await Promise.all(
            partNodesRefs.map(ref => ref.get())
          );

          const nonExistentNodes = partDocs
            .filter(doc => !doc.exists)
            .map((_, index) => partNodeIds[index]);

          if (nonExistentNodes.length > 0) {
            throw new Error(
              `The following part nodes do not exist: ${nonExistentNodes.join(', ')}`
            );
          }
        }
      }

      // Validate isPartOf nodes existence if any are provided
      if (updatedNode.properties?.isPartOf && updatedNode.properties.isPartOf.length > 0) {
        const isPartOfNodeIds = updatedNode.properties.isPartOf
          .flatMap(collection => collection.nodes || [])
          .filter(node => node && node.id)
          .map(node => node.id);

        if (isPartOfNodeIds.length > 0) {
          const isPartOfNodesRefs = isPartOfNodeIds.map(id =>
            db.collection(NODES).doc(id)
          );

          const isPartOfDocs = await Promise.all(
            isPartOfNodesRefs.map(ref => ref.get())
          );

          const nonExistentNodes = isPartOfDocs
            .filter(doc => !doc.exists)
            .map((_, index) => isPartOfNodeIds[index]);

          if (nonExistentNodes.length > 0) {
            throw new Error(
              `The following isPartOf nodes do not exist: ${nonExistentNodes.join(', ')}`
            );
          }
        }
      }

      // Normalize specializations to ensure they use the "main" collection if not specified
      if (updatedNode.specializations && updatedNode.specializations.length > 0) {
        updatedNode.specializations = this.normalizeCollection(updatedNode.specializations);
      }

      // Normalize parts if they exist
      if (updatedNode.properties?.parts) {
        updatedNode.properties.parts = this.normalizeCollection(updatedNode.properties.parts);
      }

      // Normalize isPartOf if it exists
      if (updatedNode.properties?.isPartOf) {
        updatedNode.properties.isPartOf = this.normalizeCollection(updatedNode.properties.isPartOf);
      }

      const updatedNodeData = await db.runTransaction(async (transaction) => {
        // Step 1: Get the current node
        const nodeDoc = await transaction.get(nodeRef);
        if (!nodeDoc.exists) {
          throw new Error('Node not found');
        }

        const currentNode = nodeDoc.data() as INode;
        if (currentNode.deleted) {
          throw new Error('Cannot update deleted node');
        }

        // Step 2: Handle inheritance updates if generalizations change
        let newProperties = { ...currentNode.properties };
        let newInheritance = { ...currentNode.inheritance };

        if (updatedNode.generalizations?.[0]?.nodes?.[0]?.id) {
          const newParentId = updatedNode.generalizations[0].nodes[0].id;
          const currentParentId = currentNode.generalizations?.[0]?.nodes?.[0]?.id;

          if (newParentId !== currentParentId) {
            // Get new parent data for inheritance
            const parentData = await NodeInheritanceService.getParentNodeData(updatedNode.generalizations);

            // Create a new inheritance structure from scratch
            newInheritance = {};
            newProperties = { ...(updatedNode.properties || currentNode.properties) };

            // Ensure parts and isPartOf are normalized
            if (!newProperties.parts) {
              newProperties.parts = [{ collectionName: 'main', nodes: [] }];
            } else {
              newProperties.parts = this.normalizeCollection(newProperties.parts);
            }

            if (!newProperties.isPartOf) {
              newProperties.isPartOf = [{ collectionName: 'main', nodes: [] }];
            } else {
              newProperties.isPartOf = this.normalizeCollection(newProperties.isPartOf);
            }

            // For each property in the parent, set up the inheritance structure correctly
            for (const key in parentData.properties) {
              // Check if this property is being explicitly set in the update
              const isExplicitlySet = updatedNode.properties && key in updatedNode.properties;

              // If the property isn't being explicitly set, inherit from parent
              if (!isExplicitlySet) {
                // Inherit the property value
                newProperties[key] = parentData.properties[key];

                // If it's parts or isPartOf, ensure they're normalized
                if (key === 'parts' || key === 'isPartOf') {
                  newProperties[key] = this.normalizeCollection(newProperties[key]);
                }

                // Set inheritance to point to parent
                newInheritance[key] = {
                  ref: newParentId,
                  inheritanceType: parentData.inheritance[key]?.inheritanceType || "inheritUnlessAlreadyOverRidden"
                };
              } else {
                // Property is explicitly set - determine if it's being overridden
                if (JSON.stringify(newProperties[key]) !== JSON.stringify(parentData.properties[key])) {
                  // Property is being overridden, set ref to null
                  newInheritance[key] = {
                    ref: null,
                    inheritanceType: "inheritUnlessAlreadyOverRidden"
                  };
                } else {
                  newInheritance[key] = {
                    ref: newParentId,
                    inheritanceType: parentData.inheritance[key]?.inheritanceType || "inheritUnlessAlreadyOverRidden"
                  };
                }
              }
            }

            // For properties in the current/updated node that aren't in the parent, mark as not inherited
            for (const key in newProperties) {
              if (!(key in parentData.properties)) {
                newInheritance[key] = {
                  ref: null,
                  inheritanceType: "inheritUnlessAlreadyOverRidden"
                };
              }
            }

            // Special handling for isPartOf - it's never inherited
            if (newInheritance.isPartOf) {
              newInheritance.isPartOf = {
                ref: null,
                inheritanceType: "neverInherit"
              };
            }
          } else if (updatedNode.properties) {
            // No generalization change, but properties are being updated
            if (updatedNode.properties.parts) {
              updatedNode.properties.parts = this.normalizeCollection(updatedNode.properties.parts);
            }
            if (updatedNode.properties.isPartOf) {
              updatedNode.properties.isPartOf = this.normalizeCollection(updatedNode.properties.isPartOf);
            }

            for (const key in updatedNode.properties) {
              // If this is a new property not in the current node
              if (!(key in currentNode.properties)) {
                newInheritance[key] = {
                  ref: null,
                  inheritanceType: "inheritUnlessAlreadyOverRidden"
                };
                newProperties[key] = updatedNode.properties[key];
              }
              // If property is being modified and differs from current value
              else if (JSON.stringify(updatedNode.properties[key]) !== JSON.stringify(currentNode.properties[key])) {
                // Check if it was previously inherited from parent
                const currentParentId = currentNode.generalizations?.[0]?.nodes?.[0]?.id;

                if (currentNode.inheritance[key]?.ref === currentParentId) {
                  // If previously inherited, get parent data to compare
                  const parentRef = db.collection(NODES).doc(currentParentId);
                  const parentDoc = await transaction.get(parentRef);

                  if (parentDoc.exists) {
                    const parentData = parentDoc.data() as INode;

                    // If new value differs from parent, mark as overridden
                    if (JSON.stringify(updatedNode.properties[key]) !== JSON.stringify(parentData.properties[key])) {
                      newInheritance[key] = {
                        ref: null, // No longer inherited
                        inheritanceType: "inheritUnlessAlreadyOverRidden"
                      };
                    }
                  }
                }

                newProperties[key] = updatedNode.properties[key];
              }
            }
          }
        } else if (updatedNode.properties) {
          // Only properties are being updated (no parent change)
          newProperties = { ...currentNode.properties };

          // Normalize parts and isPartOf if they're being updated
          if (updatedNode.properties.parts) {
            updatedNode.properties.parts = this.normalizeCollection(updatedNode.properties.parts);
          }
          if (updatedNode.properties.isPartOf) {
            updatedNode.properties.isPartOf = this.normalizeCollection(updatedNode.properties.isPartOf);
          }

          for (const key in updatedNode.properties) {
            // If this is a new property not in the current node
            if (!(key in currentNode.properties)) {
              newInheritance[key] = {
                ref: null,
                inheritanceType: "inheritUnlessAlreadyOverRidden"
              };
            }
            // If property is being modified and was previously inherited
            else if (
              JSON.stringify(updatedNode.properties[key]) !== JSON.stringify(currentNode.properties[key]) &&
              currentNode.inheritance[key]?.ref !== null
            ) {
              // Get the parent node that this property was inherited from
              const parentId = currentNode.inheritance[key]?.ref;

              if (parentId) {
                const parentRef = db.collection(NODES).doc(parentId);
                const parentDoc = await transaction.get(parentRef);

                if (parentDoc.exists) {
                  const parentData = parentDoc.data() as INode;

                  // If new value differs from parent, mark as overridden
                  if (JSON.stringify(updatedNode.properties[key]) !== JSON.stringify(parentData.properties[key])) {
                    newInheritance[key] = {
                      ref: null, // No longer inherited
                      inheritanceType: "inheritUnlessAlreadyOverRidden"
                    };
                  }
                }
              }
            }

            newProperties[key] = updatedNode.properties[key];
          }
        }

        // Step 3: Prepare the update data
        const updateData: Partial<INode> = {
          ...updatedNode,
          properties: newProperties,
          inheritance: newInheritance,
          contributors: Array.from(new Set([...(currentNode.contributors || []), uname])),
        };

        // Step 4: Collect all nodes that need to be read/updated
        const referencesToProcess = new Set<string>();

        // Add nodes from new relationships
        if (updatedNode.generalizations?.[0]?.nodes) {
          updatedNode.generalizations[0].nodes.forEach(parent => {
            if (parent.id) referencesToProcess.add(parent.id);
          });
        }

        if (updatedNode.specializations) {
          updatedNode.specializations.forEach(collection => {
            if (collection.nodes) {
              collection.nodes.forEach(child => {
                if (child.id) referencesToProcess.add(child.id);
              });
            }
          });
        }

        // Add current relationship nodes
        if (currentNode.generalizations?.[0]?.nodes) {
          currentNode.generalizations[0].nodes.forEach(parent => {
            if (parent.id) referencesToProcess.add(parent.id);
          });
        }

        if (currentNode.specializations) {
          currentNode.specializations.forEach(collection => {
            if (collection.nodes) {
              collection.nodes.forEach(child => {
                if (child.id) referencesToProcess.add(child.id);
              });
            }
          });
        }

        // Add parts and isPartOf nodes
        if (newProperties.parts) {
          newProperties.parts.forEach(collection => {
            if (collection.nodes) {
              collection.nodes.forEach(part => {
                if (part.id) referencesToProcess.add(part.id);
              });
            }
          });
        }

        if (newProperties.isPartOf) {
          newProperties.isPartOf.forEach(collection => {
            if (collection.nodes) {
              collection.nodes.forEach(whole => {
                if (whole.id) referencesToProcess.add(whole.id);
              });
            }
          });
        }

        // Add old parts and isPartOf nodes for cleanup
        if (currentNode.properties.parts) {
          currentNode.properties.parts.forEach(collection => {
            if (collection.nodes) {
              collection.nodes.forEach(part => {
                if (part.id) referencesToProcess.add(part.id);
              });
            }
          });
        }

        if (currentNode.properties.isPartOf) {
          currentNode.properties.isPartOf.forEach(collection => {
            if (collection.nodes) {
              collection.nodes.forEach(whole => {
                if (whole.id) referencesToProcess.add(whole.id);
              });
            }
          });
        }

        // Step 5: Read all referenced nodes
        const nodeRefs = Array.from(referencesToProcess).map(refId =>
          db.collection(NODES).doc(refId)
        );
        const nodeDocs = await Promise.all(
          nodeRefs.map(ref => transaction.get(ref))
        );

        // Create a map of node data
        const nodeDataMap = new Map(
          nodeDocs.map(doc => [doc.id, doc.data() as INode])
        );

        // Step 6: Update the node
        transaction.update(nodeRef, updateData);

        // Step 7: Update relationships

        // 7.1: Remove node from old parent's specializations
        if (currentNode.generalizations?.[0]?.nodes) {
          for (const parent of currentNode.generalizations[0].nodes) {
            if (!parent.id) continue;

            // Skip if parent is still in new generalizations
            if (updatedNode.generalizations?.[0]?.nodes?.some(p => p.id === parent.id)) {
              continue;
            }

            const parentData = nodeDataMap.get(parent.id);
            if (!parentData) continue;

            const updatedSpecializations = parentData.specializations.map(collection => {
              if (collection.collectionName === 'main') {
                return {
                  ...collection,
                  nodes: collection.nodes.filter(n => n.id !== nodeId)
                };
              }
              return collection;
            });

            transaction.update(db.collection(NODES).doc(parent.id), {
              specializations: updatedSpecializations
            });
          }
        }

        // 7.2: Add node to new parent's specializations
        if (updatedNode.generalizations?.[0]?.nodes) {
          for (const parent of updatedNode.generalizations[0].nodes) {
            if (!parent.id) continue;

            // Skip if parent was already in old generalizations
            if (currentNode.generalizations?.[0]?.nodes?.some(p => p.id === parent.id)) {
              continue;
            }

            await NodeRelationshipService.updateParentSpecializations(parent.id, nodeId, transaction);
          }
        }

        // 7.3: Remove node from old children's generalizations
        if (currentNode.specializations) {
          for (const collection of currentNode.specializations) {
            if (!collection.nodes) continue;

            for (const child of collection.nodes) {
              if (!child.id) continue;

              // Skip if child is still in new specializations
              let stillInSpecializations = false;
              if (updatedNode.specializations) {
                stillInSpecializations = updatedNode.specializations.some(newCollection =>
                  newCollection.nodes && newCollection.nodes.some(newChild => newChild.id === child.id)
                );
              }

              if (stillInSpecializations) continue;

              const childData = nodeDataMap.get(child.id);
              if (!childData) continue;

              const updatedGeneralizations = childData.generalizations.map(collection => {
                if (collection.collectionName === 'main') {
                  return {
                    ...collection,
                    nodes: collection.nodes.filter(n => n.id !== nodeId)
                  };
                }
                return collection;
              });

              transaction.update(db.collection(NODES).doc(child.id), {
                generalizations: updatedGeneralizations
              });
            }
          }
        }

        // 7.4: Add node to new children's generalizations
        if (updatedNode.specializations) {
          for (const collection of updatedNode.specializations) {
            if (!collection.nodes) continue;

            for (const child of collection.nodes) {
              if (!child.id) continue;

              // Skip if child was already in old specializations
              let alreadyInSpecializations = false;
              if (currentNode.specializations) {
                alreadyInSpecializations = currentNode.specializations.some(oldCollection =>
                  oldCollection.nodes && oldCollection.nodes.some(oldChild => oldChild.id === child.id)
                );
              }

              if (alreadyInSpecializations) continue;

              const childData = nodeDataMap.get(child.id);
              if (!childData) continue;

              const updatedGeneralizations = [...(childData.generalizations || [])];
              let mainCollection = updatedGeneralizations.find(g => g.collectionName === 'main');

              if (!mainCollection) {
                mainCollection = { collectionName: 'main', nodes: [] };
                updatedGeneralizations.push(mainCollection);
              }

              if (!mainCollection.nodes.some(n => n.id === nodeId)) {
                mainCollection.nodes.push({ id: nodeId });
                transaction.update(db.collection(NODES).doc(child.id), {
                  generalizations: updatedGeneralizations
                });
              }
            }
          }
        }

        // 7.5: Update part relationships - remove node from old parts' isPartOf
        if (currentNode.properties.parts) {
          const currentParts = new Set(
            currentNode.properties.parts
              .flatMap(collection => collection.nodes)
              .filter(n => n && n.id)
              .map(n => n.id)
          );

          const newParts = new Set(
            newProperties.parts
              .flatMap(collection => collection.nodes)
              .filter(n => n && n.id)
              .map(n => n.id)
          );

          // Find parts that are no longer in the list
          const removedParts = [...currentParts].filter(id => !newParts.has(id));

          for (const partId of removedParts) {
            const partData = nodeDataMap.get(partId);
            if (!partData) continue;

            if (partData.properties.isPartOf) {
              const updatedIsPartOf = partData.properties.isPartOf.map(collection => {
                if (collection.collectionName === 'main') {
                  return {
                    ...collection,
                    nodes: collection.nodes.filter(n => n.id !== nodeId)
                  };
                }
                return collection;
              });

              transaction.update(db.collection(NODES).doc(partId), {
                'properties.isPartOf': updatedIsPartOf
              });
            }
          }
        }

        // 7.6: Update part relationships - add node to new parts' isPartOf
        if (newProperties.parts) {
          const currentParts = new Set(
            currentNode.properties.parts
              ?.flatMap(collection => collection.nodes)
              .filter(n => n && n.id)
              .map(n => n.id) || []
          );

          const newParts = newProperties.parts
            .flatMap(collection => collection.nodes)
            .filter(n => n && n.id);

          for (const part of newParts) {
            if (!part.id || currentParts.has(part.id)) continue;

            const partData = nodeDataMap.get(part.id);
            if (!partData) continue;

            // Get or create isPartOf array
            const partProperties = { ...partData.properties };
            if (!partProperties.isPartOf) {
              partProperties.isPartOf = [{ collectionName: 'main', nodes: [] }];
            }

            // Find or create main collection
            let mainCollection = partProperties.isPartOf.find(c => c.collectionName === 'main');
            if (!mainCollection) {
              mainCollection = { collectionName: 'main', nodes: [] };
              partProperties.isPartOf.push(mainCollection);
            }

            // Add this node if not already there
            if (!mainCollection.nodes.some(n => n.id === nodeId)) {
              const updatedIsPartOf = partProperties.isPartOf.map(c => {
                if (c.collectionName === 'main') {
                  return {
                    ...c,
                    nodes: [...c.nodes, { id: nodeId }]
                  };
                }
                return c;
              });

              transaction.update(db.collection(NODES).doc(part.id), {
                'properties.isPartOf': updatedIsPartOf
              });
            }
          }
        }

        // 7.7: Update isPartOf relationships - remove node from old wholes' parts
        if (currentNode.properties.isPartOf) {
          const currentWholes = new Set(
            currentNode.properties.isPartOf
              .flatMap(collection => collection.nodes)
              .filter(n => n && n.id)
              .map(n => n.id)
          );

          const newWholes = new Set(
            newProperties.isPartOf
              .flatMap(collection => collection.nodes)
              .filter(n => n && n.id)
              .map(n => n.id)
          );

          // Find wholes that are no longer in the list
          const removedWholes = [...currentWholes].filter(id => !newWholes.has(id));

          for (const wholeId of removedWholes) {
            const wholeData = nodeDataMap.get(wholeId);
            if (!wholeData) continue;

            if (wholeData.properties.parts) {
              const updatedParts = wholeData.properties.parts.map(collection => {
                if (collection.collectionName === 'main') {
                  return {
                    ...collection,
                    nodes: collection.nodes.filter(n => n.id !== nodeId)
                  };
                }
                return collection;
              });

              transaction.update(db.collection(NODES).doc(wholeId), {
                'properties.parts': updatedParts
              });
            }
          }
        }

        // 7.8: Update isPartOf relationships - add node to new wholes' parts
        if (newProperties.isPartOf) {
          const currentWholes = new Set(
            currentNode.properties.isPartOf
              ?.flatMap(collection => collection.nodes)
              .filter(n => n && n.id)
              .map(n => n.id) || []
          );

          const newWholes = newProperties.isPartOf
            .flatMap(collection => collection.nodes)
            .filter(n => n && n.id);

          for (const whole of newWholes) {
            if (!whole.id || currentWholes.has(whole.id)) continue;

            const wholeData = nodeDataMap.get(whole.id);
            if (!wholeData) continue;

            // Get or create parts array
            const wholeProperties = { ...wholeData.properties };
            if (!wholeProperties.parts) {
              wholeProperties.parts = [{ collectionName: 'main', nodes: [] }];
            }

            // Find or create main collection
            let mainCollection = wholeProperties.parts.find(c => c.collectionName === 'main');
            if (!mainCollection) {
              mainCollection = { collectionName: 'main', nodes: [] };
              wholeProperties.parts.push(mainCollection);
            }

            // Add this node if not already there
            if (!mainCollection.nodes.some(n => n.id === nodeId)) {
              const updatedParts = wholeProperties.parts.map(c => {
                if (c.collectionName === 'main') {
                  return {
                    ...c,
                    nodes: [...c.nodes, { id: nodeId }]
                  };
                }
                return c;
              });

              transaction.update(db.collection(NODES).doc(whole.id), {
                'properties.parts': updatedParts
              });
            }
          }
        }

        // Step 8: Create changelog
        await this.createNodeChangeLog(
          nodeId,
          uname,
          { ...currentNode, ...updateData },
          reasoning
        );

        return { ...currentNode, ...updateData };
      });

      return updatedNodeData;
    } catch (error) {
      console.error('Error updating node:', error);
      throw error;
    }
  }

  /**
   * Soft deletes a node by marking it as deleted
   * 
   * @param nodeId - ID of the node to delete
   * @param uname - Username of the user performing the deletion
   * @param reasoning - Reason for deletion
   * @returns Promise<INode> - The deleted node data
   * @throws Error if node not found or already deleted
   */
  static async deleteNode(
    nodeId: string,
    uname: string,
    reasoning: string
  ): Promise<INode> {
    try {
      const nodeRef = db.collection(NODES).doc(nodeId);

      const nodeData = await db.runTransaction(async (transaction) => {
        const nodeDoc = await transaction.get(nodeRef);

        if (!nodeDoc.exists) {
          throw new Error('Node not found');
        }

        const node = nodeDoc.data() as INode;

        if (node.deleted) {
          throw new Error('Node is already deleted');
        }

        // Mark the node as deleted
        const updatedNode: INode = {
          ...node,
          deleted: true
        };

        // Update the node
        transaction.update(nodeRef, { deleted: true });

        // Create changelog
        await this.createNodeChangeLog(nodeId, uname, updatedNode, reasoning);

        return updatedNode;
      });

      return nodeData;
    } catch (error) {
      console.error('Error deleting node:', error);
      throw error;
    }
  }

  /**
   * Lists nodes with optional filtering and pagination
   * 
   * @param params - Parameters for filtering and pagination
   * @returns Promise<INode[]> - Array of nodes matching the criteria
   * @throws Error if query execution fails
   */
  static async listNodes({
    nodeType,
    root,
    limit = 10,
    offset = 0,
    deleted = false
  }: ListNodesParams): Promise<INode[]> {
    try {
      const collection = db.collection(NODES);

      // Start with base query
      let baseQuery = collection.where('deleted', '==', deleted);

      // Add additional filters
      if (nodeType) {
        baseQuery = baseQuery.where('nodeType', '==', nodeType);
      }

      if (root) {
        baseQuery = baseQuery.where('root', '==', root);
      }

      // Add ordering
      const orderedQuery = baseQuery.orderBy('id');

      // Get total count
      const countQuery = baseQuery;

      // Apply pagination
      const paginatedQuery = orderedQuery.offset(offset).limit(limit);

      // Execute queries in parallel
      const [countSnapshot, snapshot] = await Promise.all([
        countQuery.count().get(),
        paginatedQuery.get()
      ]);

      const total = countSnapshot.data().count;

      const nodes: INode[] = [];
      snapshot.forEach((doc) => {
        nodes.push(doc.data() as INode);
      });

      // Add pagination metadata to the last node if there are any nodes
      if (nodes.length > 0) {
        const lastNode = nodes[nodes.length - 1];
        (lastNode as any)._metadata = {
          total,
          offset,
          limit,
          hasMore: offset + nodes.length < total
        };
      }

      return nodes;
    } catch (error) {
      console.error('Error listing nodes:', error);

      // Check if the error is related to missing index
      if (error instanceof Error &&
        error.message.includes('FAILED_PRECONDITION') &&
        error.message.includes('index')) {
        // Extract the index creation URL if available
        const indexMatch = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
        const indexUrl = indexMatch ? indexMatch[0] : null;

        throw new Error(
          `The query requires a Firestore index. ${indexUrl
            ? `Please create it here: ${indexUrl}`
            : 'Please create the necessary composite index in the Firebase Console.'
          }`
        );
      }

      throw error;
    }
  }

  //===========================================================================
  // SECTION 2: NODE PROPERTIES MANAGEMENT
  //===========================================================================
  // This section handles operations related to node properties, including
  // adding, updating, and deleting properties. It also manages property metadata
  // such as property types, inheritance rules, and contributors.

  /**
   * Updates properties of a node and handles inheritance implications
   * 
   * This method handles complex property updates including:
   * - Adding or modifying properties
   * - Deleting properties
   * - Updating property types
   * - Updating inheritance rules
   * - Tracking contributors
   * 
   * @param nodeId - ID of the node to update
   * @param properties - New property values
   * @param uname - Username of the user performing the update
   * @param reasoning - Reason for the update
   * @param inheritanceRules - Optional rules for property inheritance
   * @param deletedProperties - Optional list of properties to delete
   * @param propertyTypeUpdates - Optional updates to property types
   * @returns Promise<UpdateNodePropertiesResult> - Updated node and modified properties
   * @throws Error if node not found or deleted
   */
  static async updateNodeProperties(
    nodeId: string,
    properties: { [key: string]: any },
    uname: string,
    reasoning: string,
    inheritanceRules?: any,
    deletedProperties?: string[],
    propertyTypeUpdates?: { [key: string]: any }
  ): Promise<UpdateNodePropertiesResult> {
    try {
      const nodeRef = db.collection(NODES).doc(nodeId);

      return await db.runTransaction(async (transaction) => {
        // Step 1: Get current node state
        const nodeDoc = await transaction.get(nodeRef);
        if (!nodeDoc.exists) {
          throw new Error('Node not found');
        }

        const currentNode = nodeDoc.data() as INode;
        if (currentNode.deleted) {
          throw new Error('Cannot update properties of deleted node');
        }

        // Step 2: Prepare updates
        const updates: { [key: string]: any } = {};

        const updatedProperties = { ...currentNode.properties };
        const updatedInheritance = { ...currentNode.inheritance };
        const updatedPropertyType = { ...currentNode.propertyType };

        const modifiedPropertyNames: string[] = [];

        // Step 3: Process each property update
        for (const [key, value] of Object.entries(properties)) {
          // Skip if value hasn't changed
          if (JSON.stringify(currentNode.properties[key]) === JSON.stringify(value)) {
            continue;
          }

          updatedProperties[key] = value;
          modifiedPropertyNames.push(key);

          // Update inheritance rules if provided
          if (inheritanceRules && inheritanceRules[key]) {
            updatedInheritance[key] = {
              ...currentNode.inheritance[key],
              inheritanceType: inheritanceRules[key]
            };
          }
        }

        // Add any property type updates
        if (propertyTypeUpdates) {
          for (const [key, value] of Object.entries(propertyTypeUpdates)) {
            const propertyName = key.replace('propertyType.', '');
            updatedPropertyType[propertyName] = value;
          }
        }

        // Step 4: Process property deletions
        if (deletedProperties && deletedProperties.length > 0) {
          for (const propertyName of deletedProperties) {
            // Remove properties
            delete updatedProperties[propertyName];
            delete updatedInheritance[propertyName];
            delete updatedPropertyType[propertyName];

            if (!modifiedPropertyNames.includes(propertyName)) {
              modifiedPropertyNames.push(propertyName);
            }

            // Also remove from textValue if it exists
            if (currentNode.textValue && propertyName in currentNode.textValue) {
              updates['textValue.' + propertyName] = deleteField();
            }
          }
        }

        // If no properties changed, return current state
        if (modifiedPropertyNames.length === 0) {
          return {
            node: currentNode,
            updatedProperties: []
          };
        }

        // Step 5: Update contributors
        const contributors = new Set([...(currentNode.contributors || []), uname]);
        updates.contributors = Array.from(contributors);

        // Update property-specific contributors
        const updatedContributorsByProperty = { ...currentNode.contributorsByProperty };
        for (const property of modifiedPropertyNames) {
          // Skip deleted properties for contributor updates
          if (deletedProperties && deletedProperties.includes(property)) {
            // If the property is being deleted, remove it from contributorsByProperty
            delete updatedContributorsByProperty[property];
            continue;
          }

          const propertyContributors = new Set([
            ...(currentNode.contributorsByProperty?.[property] || []),
            uname
          ]);
          updatedContributorsByProperty[property] = Array.from(propertyContributors);
        }

        // Step 6: Add all updates to the update object
        updates.properties = updatedProperties;
        updates.inheritance = updatedInheritance;
        updates.propertyType = updatedPropertyType;
        updates.contributorsByProperty = updatedContributorsByProperty;

        // Step 7: Execute the update
        transaction.update(nodeRef, updates);

        // Flag for handling deletions after transaction
        let hasDeletions = deletedProperties && deletedProperties.length > 0;
        if (hasDeletions) {
          transaction.update(nodeRef, { _pendingInheritanceUpdate: true });
        }

        // Return updated node data
        const updatedNode: INode = {
          ...currentNode,
          properties: updatedProperties,
          inheritance: updatedInheritance,
          propertyType: updatedPropertyType,
          contributorsByProperty: updatedContributorsByProperty,
          contributors: Array.from(contributors)
        };



        // Step 8: Create changelog entries for updated properties
        const propertiesUpdated = modifiedPropertyNames.filter(p => !deletedProperties?.includes(p));

        for (const property of propertiesUpdated) {
          await ChangelogService.log(
            nodeId,
            uname,
            'modify elements',
            updatedNode,
            reasoning,
            property,
            currentNode.properties[property],
            updatedProperties[property],
            {
              propertyName: property,
              inheritanceRule: inheritanceRules?.[property] || updatedNode.inheritance[property]?.inheritanceType
            }
          );
        }

        // For deleted properties
        if (deletedProperties && deletedProperties.length > 0) {
          for (const property of deletedProperties) {
            await ChangelogService.log(
              nodeId,
              uname,
              'remove property',
              updatedNode,
              reasoning,
              property,
              currentNode.properties[property],
              null,
              {
                removedProperty: property,
                previousInheritanceRule: currentNode.inheritance[property]?.inheritanceType
              }
            );
          }
        }

        return {
          node: updatedNode,
          updatedProperties: modifiedPropertyNames
        };
      }).then(async result => {
        // Process deletedProperties after transaction completes
        if (deletedProperties && deletedProperties.length > 0) {
          // Note: This would typically call an external utility to update inheritance
          // Uncomment and adjust the import path as needed
          // const { updateInheritance } = require('@components/utils/node.utils');
          // await updateInheritance({
          //   nodeId,
          //   updatedProperties: [],
          //   deletedProperties,
          //   db
          // });

          // Remove the temporary flag
          await db.collection(NODES).doc(nodeId).update({
            _pendingInheritanceUpdate: deleteField()
          });
        }

        return result;
      });
    } catch (error) {
      console.error('Error in updateNodeProperties:', error);
      throw error;
    }
  }

  //===========================================================================
  // SECTION 3: CHANGE TRACKING
  //===========================================================================
  // This section contains methods for tracking changes to nodes.
  // These methods create changelog entries to maintain an audit trail
  // of all modifications to the node data.


  /**
   * Creates a changelog entry for node operations
   */
  private static async createNodeChangeLog(
    nodeId: string,
    uname: string,
    node: INode,
    reasoning: string
  ): Promise<string> {
    if (!uname || uname === "ouhrac") return "";

    try {
      // Determine change type and appropriate details based on context
      let changeType: NodeChange['changeType'] = 'modify elements';
      let details: Record<string, any> = {};
      let previousValue: any = null;
      let newValue: any = null;

      // For node creation
      if (!node.specializations || node.specializations.length === 0) {
        changeType = 'add node';
        details = {
          nodeTitle: node.title,
          nodeType: node.nodeType
        };
        previousValue = null;
        newValue = { id: node.id, title: node.title, nodeType: node.nodeType };
      }
      // For deletions
      else if (node.deleted) {
        changeType = 'delete node';
        previousValue = { deleted: false };
        newValue = { deleted: true };
      }

      return ChangelogService.log(
        nodeId,
        uname,
        changeType,
        node,
        reasoning,
        null, // no specific property for whole node operations
        previousValue,
        newValue,
        details
      );
    } catch (error) {
      console.error('Error creating change log:', error);
      // Log the error but don't fail the operation
      return "";
    }
  }

  //===========================================================================
  // SECTION 4: NODE REFERENCES VALIDATION
  //===========================================================================
  // This section contains methods for tracking changes to nodes.
  // These methods create changelog entries to maintain an audit trail
  // of all modifications to the node data.

  /**
  * Detects circular references between generalizations and specializations
  * 
  * @param generalizations - List of generalizations
  * @param specializations - List of specializations
  * @returns string[] - List of node IDs that appear in both collections
  */
  static detectCircularReferences(generalizations: any[], specializations: any[]) {
    if (!generalizations || !specializations) {
      return [];
    }

    // Extract all generalization node IDs
    const generalizationIds = new Set(
      generalizations.flatMap(collection =>
        collection.nodes?.map((node: { id: any; }) => node.id) || []
      )
    );

    // Check if any specialization node is also in generalizations
    const circularNodeIds = specializations
      .flatMap(collection => collection.nodes || [])
      .filter(node => node.id && generalizationIds.has(node.id))
      .map(node => node.id);

    // Return unique circular references
    return [...new Set(circularNodeIds)];
  }

  /**
   * Detects duplicate node IDs within a collection of relationships
   * 
   * @param collections - List of collections to check for duplicates
   * @returns Map<string, string[]> - Map of duplicate node IDs by collection name
   */
  static detectDuplicateNodeIds(collections: ICollection[] | undefined): Map<string, string[]> {
    const duplicatesByCollection = new Map<string, string[]>();

    if (!collections) {
      return duplicatesByCollection;
    }

    collections.forEach(collection => {
      if (!collection.nodes || collection.nodes.length === 0) {
        return;
      }

      const collectionName = collection.collectionName || 'default';
      const nodeIds = collection.nodes.map(node => node.id).filter(id => id);

      // Find duplicates
      const idCount = new Map<string, number>();
      const duplicates: string[] = [];

      nodeIds.forEach(id => {
        idCount.set(id, (idCount.get(id) || 0) + 1);

        if (idCount.get(id) === 2) {
          // Only add to duplicates the first time there is a duplicate
          duplicates.push(id);
        }
      });

      if (duplicates.length > 0) {
        duplicatesByCollection.set(collectionName, duplicates);
      }
    });

    return duplicatesByCollection;
  }

  /**
   * Detects all duplicate node IDs across the node's relationships
   * 
   * @param node - The node object to check
   * @returns object - Object with duplicate details for each relationship type
   */
  static validateNoDuplicateNodeIds(node: any): {
    valid: boolean;
    generalizations: Map<string, string[]>;
    specializations: Map<string, string[]>;
    parts: Map<string, string[]>;
    isPartOf: Map<string, string[]>;
  } {
    const generalizations = this.detectDuplicateNodeIds(node.generalizations);
    const specializations = this.detectDuplicateNodeIds(node.specializations);
    const parts = this.detectDuplicateNodeIds(node.properties?.parts);
    const isPartOf = this.detectDuplicateNodeIds(node.properties?.isPartOf);

    const valid = generalizations.size === 0 &&
      specializations.size === 0 &&
      parts.size === 0 &&
      isPartOf.size === 0;

    return {
      valid,
      generalizations,
      specializations,
      parts,
      isPartOf
    };
  }
}