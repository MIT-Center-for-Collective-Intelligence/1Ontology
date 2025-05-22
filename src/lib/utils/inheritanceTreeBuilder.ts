import { INode } from "@components/types/INode";
import { getDoc, doc, collection, query, where, getDocs, writeBatch, updateDoc } from "firebase/firestore";
import { NODES } from "../firestoreClient/collections";
import { recordLogs } from "./helpers";

// Main function that builds the inheritance treee
export const buildInheritanceTree = (
  nodes: { [nodeId: string]: INode },
  currentNodeId: string,
  propertyName: string
): { [parentId: string]: string[] } => {
  const inheritanceMap: { [parentId: string]: string[] } = {};

  if (!nodes[currentNodeId]) {
    return inheritanceMap;
  }

  let directParentIds: string[] = [];

  // Focusing the implementation to affect "isPartOf" properties only
  if (propertyName === "isPartOf") {
    Object.entries(nodes).forEach(([nodeId, node]) => {
      if (node.deleted || nodeId === currentNodeId) return;

      const hasPart = (node.properties?.parts || []).some(collection =>
        collection.nodes.some(linkNode => linkNode.id === currentNodeId)
      );

      if (hasPart) {
        directParentIds.push(nodeId);
      }
    });
  }
  // else {
  //   const propertyValue = propertyName === "specializations" || propertyName === "generalizations"
  //     ? nodes[currentNodeId]?.[propertyName] || []
  //     : nodes[currentNodeId]?.properties?.[propertyName] || [];

  //   directParentIds = propertyValue.flatMap((collection: { nodes: any[]; }) =>
  //     collection.nodes.map((node: { id: any; }) => node.id)
  //   );
  // }

  directParentIds.forEach(parentId => {
    inheritanceMap[parentId] = [];
  });

  // Creates a map of which nodes are specializations of which other nodes
  const specializationMap = buildSpecializationMap(nodes);

  const processedNodes = new Set<string>();
  for (const parentId of directParentIds) {
    buildHierarchyForNode(parentId, specializationMap, inheritanceMap, processedNodes, propertyName, nodes);
  }

  Object.keys(inheritanceMap).forEach(nodeId => {
    if (inheritanceMap[nodeId].length === 0) {
      delete inheritanceMap[nodeId];
    }
  });

  return inheritanceMap;
};

// Builds a map of nodeId -> array of direct specializations
function buildSpecializationMap(nodes: { [nodeId: string]: INode }): { [nodeId: string]: string[] } {
  const specializationMap: { [nodeId: string]: string[] } = {};

  Object.entries(nodes).forEach(([nodeId, node]) => {
    if (node.deleted) return;

    if (!specializationMap[nodeId]) {
      specializationMap[nodeId] = [];
    }

    const generalizations = node.generalizations
      ? node.generalizations.flatMap(collection =>
        collection.nodes.map(n => n.id)
      )
      : [];

    generalizations.forEach(genId => {
      if (!specializationMap[genId]) {
        specializationMap[genId] = [];
      }

      if (!specializationMap[genId].includes(nodeId)) {
        specializationMap[genId].push(nodeId);
      }
    });
  });

  return specializationMap;
}

// Finds and adds all specializations that inherit the "isPartOf" relationship from a parent node
function buildHierarchyForNode(
  nodeId: string,
  specializationMap: { [nodeId: string]: string[] },
  inheritanceMap: { [nodeId: string]: string[] },
  processedNodes: Set<string>,
  propertyName: string,
  nodes: { [nodeId: string]: INode }
): void {
  if (processedNodes.has(nodeId)) return;
  processedNodes.add(nodeId);

  const specializations = specializationMap[nodeId] || [];

  for (const specId of specializations) {
    // Verify if this specialization should be included
    if (!shouldIncludeInInheritanceTree(specId, nodeId, propertyName, nodes)) {
      continue;
    }

    if (!inheritanceMap[nodeId].includes(specId)) {
      inheritanceMap[nodeId].push(specId);
    }

    if (!inheritanceMap[specId]) {
      inheritanceMap[specId] = [];
    }

    buildHierarchyForNode(specId, specializationMap, inheritanceMap, processedNodes, propertyName, nodes);
  }
}

// Main function that updates inheritance tree for a specific property across multiple nodes
// Implementation is focused around updating the inheritance tree of "isPartOf" property
export const updateInheritanceTree = async (
  db: any,
  affectedNodeIds: string[],
  propertyName: string,
  nodesMap: { [nodeId: string]: INode }
) => {
  console.log("updateInheritanceTree called");
  try {
    if (!affectedNodeIds.length) {
      console.log(`No nodes to update inheritance tree for ${propertyName}`);
      return { success: true, updated: 0 };
    }

    const uniqueNodeIds = [...new Set(affectedNodeIds)];
    console.log(`Updating ${propertyName} inheritance tree for ${uniqueNodeIds.length} nodes: ${uniqueNodeIds.join(', ')}`);

    const nodes = { ...nodesMap };

    // Get fresh data for affected nodes
    for (const nodeId of uniqueNodeIds) {
      const nodeDoc = await getDoc(doc(collection(db, NODES), nodeId));
      if (nodeDoc.exists()) {
        nodes[nodeId] = nodeDoc.data() as INode;
        nodesMap[nodeId] = nodes[nodeId];
      } else {
        console.warn(`Node ${nodeId} not found, skipping tree update`);
      }
    }

    // Find additional affected nodes based on inheritance
    const additionalNodeIds = new Set<string>();

    for (const nodeId of uniqueNodeIds) {
      const inheritingNodesQuery = query(
        collection(db, NODES),
        where(`inheritance.${propertyName}.ref`, "==", nodeId)
      );

      const inheritingDocs = await getDocs(inheritingNodesQuery);

      inheritingDocs.forEach(doc => {
        additionalNodeIds.add(doc.id);
        if (!nodes[doc.id]) {
          nodes[doc.id] = doc.data() as INode;
          nodesMap[doc.id] = nodes[doc.id];
        }
      });
    }

    const allNodesToUpdate = new Set([...uniqueNodeIds, ...additionalNodeIds]);
    console.log(`Total nodes to process: ${allNodesToUpdate.size} (including inheritance)`);

    const batch = writeBatch(db);
    const successfulUpdates = [];
    let updateCount = 0;

    for (const nodeId of allNodesToUpdate) {
      if (!nodes[nodeId]) continue;

      const newTree = buildInheritanceTree(nodes, nodeId, propertyName);

      const propertyPath = propertyName === "isPartOf"
        ? "properties.isPartOfTree"
        : `properties.${propertyName}Tree`;

      const currentTree = propertyName === "isPartOf"
        ? nodes[nodeId]?.properties?.isPartOfTree
        : nodes[nodeId]?.properties?.[`${propertyName}Tree`];

      if (hasTreeChanged(currentTree as { [parentId: string]: string[] }, newTree)) {
        const nodeRef = doc(collection(db, NODES), nodeId);
        batch.update(nodeRef, {
          [propertyPath]: newTree
        });

        if (nodes[nodeId]) {
          if (!nodes[nodeId].properties) {
            nodes[nodeId].properties = {
              parts: [],
              isPartOf: [],
              isPartOfTree: {}
            };
          }

          if (propertyName === "isPartOf") {
            nodes[nodeId].properties.isPartOfTree = newTree;
          } else {
            nodes[nodeId].properties[`${propertyName}Tree`] = newTree;
          }

          nodesMap[nodeId] = nodes[nodeId];
        }

        successfulUpdates.push(nodeId);
        updateCount++;
      }
    }

    if (updateCount > 0) {
      await batch.commit();
      console.log(`Successfully updated ${propertyName} inheritance trees for ${updateCount} nodes`);
    } else {
      console.log(`No changes needed for ${propertyName} inheritance trees`);
    }

    return {
      success: true,
      updated: updateCount,
      nodeIds: successfulUpdates
    };
  } catch (error: any) {
    console.error(`Error updating ${propertyName} inheritance trees:`, error);
    recordLogs({
      type: "error",
      error: JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack,
      }),
      at: "updateInheritanceTree",
    });
    return { success: false, error: error.message };
  }
};

// Handler function for updating of inheritance tree for all affected nodes after cloning
export const updateInheritanceTreeAfterCloningANode = async (
  newNodeId: string,
  parentNodeId: string,
  nodes: { [id: string]: INode },
  db: any
) => {
  try {
    console.log(`Handling node cloned: ${newNodeId} cloned from ${parentNodeId}`);

    const newNode = nodes[newNodeId];
    const parentNode = nodes[parentNodeId];

    if (!newNode || !parentNode) {
      console.error("Node not found", { newNodeId, parentNodeId });
      return { success: false, error: "Node not found" };
    }

    const partsInheritanceRef = newNode.inheritance?.parts?.ref;

    if (!partsInheritanceRef) {
      console.log("No parts inheritance, no isPartOfTree update needed");
      return { success: true, updated: 0 };
    }

    const inheritedFromNode = nodes[partsInheritanceRef];
    if (!inheritedFromNode || !inheritedFromNode.properties?.parts) {
      console.error("Inheritance source not found or has no parts", { partsInheritanceRef });
      return { success: false, error: "Inheritance source not found" };
    }

    const allParts = inheritedFromNode.properties.parts.flatMap(collection =>
      collection.nodes.map(node => node.id)
    );

    console.log(`Found ${allParts.length} inherited parts to update isPartOfTree for`);

    const batch = writeBatch(db);
    let updatedCount = 0;

    for (const partId of allParts) {
      const partNode = nodes[partId];
      if (!partNode) continue;

      const updatedPartNode = JSON.parse(JSON.stringify(partNode));

      if (!updatedPartNode.properties) {
        updatedPartNode.properties = {};
      }

      if (!updatedPartNode.properties.isPartOfTree) {
        updatedPartNode.properties.isPartOfTree = {};
      }

      // Converting from old structure
      // if (updatedPartNode.properties.isPartOfTree.inheritanceMap) {
      //   updatedPartNode.properties.isPartOfTree = updatedPartNode.properties.isPartOfTree.inheritanceMap;
      // }

      if (!updatedPartNode.properties.isPartOfTree[partsInheritanceRef]) {
        updatedPartNode.properties.isPartOfTree[partsInheritanceRef] = [];
      }

      if (!updatedPartNode.properties.isPartOfTree[partsInheritanceRef].includes(newNodeId)) {
        updatedPartNode.properties.isPartOfTree[partsInheritanceRef].push(newNodeId);

        const partRef = doc(collection(db, NODES), partId);
        batch.update(partRef, {
          "properties.isPartOfTree": updatedPartNode.properties.isPartOfTree
        });

        if (nodes[partId]) {
          nodes[partId].properties.isPartOfTree = updatedPartNode.properties.isPartOfTree;
        }

        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      await batch.commit();
      console.log(`Updated isPartOfTree for ${updatedCount} parts of cloned node ${newNodeId}`);
    } else {
      console.log("No isPartOfTree updates needed");
    }

    return await updateInheritanceTree(db, [...allParts, newNodeId], "isPartOf", nodes);

  } catch (error: any) {
    console.error("Error handling node cloned:", error);
    recordLogs({
      type: "error",
      error: JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack,
      }),
      at: "handleNodeCloned",
    });
    return { success: false, error: error.message };
  }
};

// Handler function for updating of inheritance tree for all affected nodes after deleting
export const updateInheritanceTreeAfterDeletingANode = async (
  deletedNode: INode,
  nodes: { [id: string]: INode },
  db: any
) => {
  try {
    console.log(`Handling node deletion: ${deletedNode.id}`);

    const updatedNodeIds = new Set<string>();
    let batch = writeBatch(db);
    let operationCount = 0;
    const maxBatchSize = 500;

    const addToBatch = (nodeRef: any, updateData: any) => {
      batch.update(nodeRef, updateData);
      operationCount++;

      if (operationCount >= maxBatchSize) {
        batches.push(batch);
        batch = writeBatch(db);
        operationCount = 0;
      }
    };

    const batches = [];

    // Clean up isPartOfTree references in parts
    const partIds = deletedNode.properties?.parts?.flatMap(
      collection => collection.nodes.map(node => node.id)
    ) || [];

    for (const partId of partIds) {
      if (!nodes[partId] || !nodes[partId].properties?.isPartOfTree) continue;

      const partNode = nodes[partId];
      let isChanged = false;
      let updatedTree = JSON.parse(JSON.stringify(partNode.properties.isPartOfTree));

      // Converting from old structure
      // if (updatedTree.inheritanceMap) {
      //   // Old structure with inheritanceMap property
      //   updatedTree = updatedTree.inheritanceMap;
      //   isChanged = true;
      // }

      // Remove the deleted node as a parent
      if (updatedTree[deletedNode.id]) {
        delete updatedTree[deletedNode.id];
        isChanged = true;
      }

      // Remove the deleted node as an inheritor
      for (const parentId in updatedTree) {
        if (updatedTree[parentId].includes(deletedNode.id)) {
          updatedTree[parentId] = updatedTree[parentId].filter(
            (id: string) => id !== deletedNode.id
          );

          if (updatedTree[parentId].length === 0) {
            delete updatedTree[parentId];
          }

          isChanged = true;
        }
      }

      if (isChanged) {
        const nodeRef = doc(collection(db, NODES), partId);
        addToBatch(nodeRef, {
          "properties.isPartOfTree": updatedTree
        });

        if (nodes[partId]) {
          nodes[partId].properties.isPartOfTree = updatedTree;
        }

        updatedNodeIds.add(partId);
      }
    }

    // Clean up references in other nodes
    Object.entries(nodes).forEach(([nodeId, node]) => {
      if (nodeId === deletedNode.id || updatedNodeIds.has(nodeId)) return;

      if (!node.properties?.isPartOfTree) return;

      let isChanged = false;

      let updatedTree = JSON.parse(JSON.stringify(node.properties.isPartOfTree));

      // Converting from old structure
      // if (updatedTree.inheritanceMap) {
      //   // Old structure with inheritanceMap property
      //   updatedTree = updatedTree.inheritanceMap;
      //   isChanged = true;
      // }

      // Remove the deleted node as a parent
      if (updatedTree[deletedNode.id]) {
        delete updatedTree[deletedNode.id];
        isChanged = true;
      }

      // Remove the deleted node as an inheritor
      for (const parentId in updatedTree) {
        if (updatedTree[parentId]?.includes(deletedNode.id)) {
          updatedTree[parentId] = updatedTree[parentId].filter(
            (id: string) => id !== deletedNode.id
          );

          if (updatedTree[parentId].length === 0) {
            delete updatedTree[parentId];
          }

          isChanged = true;
        }
      }

      if (isChanged) {
        const nodeRef = doc(collection(db, NODES), nodeId);
        addToBatch(nodeRef, {
          "properties.isPartOfTree": updatedTree
        });

        nodes[nodeId].properties.isPartOfTree = updatedTree;
        updatedNodeIds.add(nodeId);
      }
    });

    if (operationCount > 0) {
      batches.push(batch);
    }

    if (batches.length > 0) {
      await Promise.all(batches.map(batch => batch.commit()));
      console.log(`Cleaned up isPartOfTree references to deleted node ${deletedNode.id} in ${updatedNodeIds.size} nodes`);
    } else {
      console.log(`No isPartOfTree references to deleted node ${deletedNode.id} found`);
    }

    return {
      success: true,
      updated: updatedNodeIds.size,
      nodeIds: Array.from(updatedNodeIds)
    };

  } catch (error: any) {
    console.error("Error handling node deletion:", error);
    recordLogs({
      type: "error",
      error: JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack,
      }),
      at: "handleNodeDeleted",
    });
    return { success: false, error: error.message };
  }
};

// New event handler function for inheritance tree updates after changing inheritance
export const updateInheritanceTreeAfterChangingInheritance = async (
  currentNodeId: string,
  property: string,
  newGeneralizationId: string,
  currentGeneralizationId: string,
  nodes: { [nodeId: string]: INode },
  db: any
) => {
  try {
    if (property !== "parts") {
      return { success: true };
    }

    // Refresh ALL potentially affected nodes AFTER inheritance updates
    const nodesToRefresh = new Set<string>([currentNodeId, newGeneralizationId, currentGeneralizationId]);

    // Add all specializations that might have been updated
    const findAllSpecializationsToRefresh = (nodeId: string) => {
      if (nodes[nodeId]?.specializations) {
        nodes[nodeId].specializations.forEach(collection => {
          collection.nodes.forEach(spec => {
            if (!nodesToRefresh.has(spec.id)) {
              nodesToRefresh.add(spec.id);
              findAllSpecializationsToRefresh(spec.id);
            }
          });
        });
      }
    };

    findAllSpecializationsToRefresh(currentNodeId);

    // Refresh data for all these nodes
    await refreshNodesData(db, Array.from(nodesToRefresh), nodes);

    const validSpecializations = new Set<string>();

    const checkSpecialization = (nodeId: string) => {
      if (nodes[nodeId]?.specializations) {
        nodes[nodeId].specializations.forEach(collection => {
          collection.nodes.forEach(spec => {
            const specialization = nodes[spec.id];
            if (!specialization) return;

            const shouldInclude = shouldIncludeInInheritanceTree(spec.id, nodeId, "isPartOf", nodes);

            if (shouldInclude && !validSpecializations.has(spec.id)) {
              validSpecializations.add(spec.id);
              checkSpecialization(spec.id);
            }
          });
        });
      }
    };

    checkSpecialization(currentNodeId);

    // Identify parts that need their isPartOfTree updated
    const partsToUpdate = new Set<string>();

    // Get old parts
    let oldParts: string[] = [];
    if (currentGeneralizationId && nodes[currentGeneralizationId]?.properties?.parts) {
      oldParts = nodes[currentGeneralizationId].properties.parts.flatMap(collection =>
        collection.nodes.map(part => part.id)
      );
    }

    // Get new parts
    let newParts: string[] = [];
    if (nodes[newGeneralizationId]?.properties?.parts) {
      newParts = nodes[newGeneralizationId].properties.parts.flatMap(collection =>
        collection.nodes.map(part => part.id)
      );
    }

    oldParts.forEach(partId => partsToUpdate.add(partId));
    newParts.forEach(partId => partsToUpdate.add(partId));

    console.log(`Found ${partsToUpdate.size} parts and ${validSpecializations.size + 1} affected nodes for inheritance change`);

    if (partsToUpdate.size > 0) {
      await updateInheritanceTree(db, Array.from(partsToUpdate), "isPartOf", nodes);
    }

    return { success: true, updated: partsToUpdate.size };
  } catch (error: any) {
    console.error("Error updating inheritance tree after changing inheritance:", error);
    recordLogs({
      type: "error",
      error: JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack,
      }),
      at: "updateInheritanceTreeAfterChangingInheritance",
    });
    return { success: false, error: error.message };
  }
};


// HELPERS

// Checks if an inheritance tree has changed compared to a previous version
export const hasTreeChanged = (
  current: { [parentId: string]: string[] } | undefined,
  updated: { [parentId: string]: string[] }
): boolean => {
  if (!current) return true;

  const currentKeys = Object.keys(current || {});
  const updatedKeys = Object.keys(updated || {});

  if (!arraysEqual(currentKeys, updatedKeys)) {
    return true;
  }

  for (const key of updatedKeys) {
    const currentValues = current?.[key] || [];
    const updatedValues = updated?.[key] || [];

    if (!arraysEqual(currentValues, updatedValues)) {
      return true;
    }
  }

  return false;
};

// Compares two arrays for equality, regardless of order
export const arraysEqual = (a: any[], b: any[]): boolean => {
  if (a.length !== b.length) return false;

  const sortedA = [...a].sort();
  const sortedB = [...b].sort();

  for (let i = 0; i < sortedA.length; i++) {
    if (sortedA[i] !== sortedB[i]) return false;
  }

  return true;
};

// Helper function to verify if a specialization should be included in inheritance tree
const shouldIncludeInInheritanceTree = (
  specializationId: string,
  parentNodeId: string,
  propertyName: string,
  nodes: { [nodeId: string]: INode }
): boolean => {
  if (propertyName !== "isPartOf") return true;

  const specialization = nodes[specializationId];
  const parentNode = nodes[parentNodeId];

  if (!specialization || !parentNode) return false;

  // 1: Specialization inherits parts directly from the parent node
  if (specialization.inheritance?.parts?.ref === parentNodeId) {
    return true;
  }

  // 2: Specialization has the same inheritance source as the parent node
  const parentInheritanceRef = parentNode.inheritance?.parts?.ref;
  if (parentInheritanceRef && specialization.inheritance?.parts?.ref === parentInheritanceRef) {
    return true;
  }

  // 3: Parent node doesn't inherit parts, and specialization inherits directly from parent
  if (!parentInheritanceRef && specialization.inheritance?.parts?.ref === parentNodeId) {
    return true;
  }

  // 4: Specialization has no inheritance
  if (!specialization.inheritance?.parts?.ref) {
    return true;
  }

  return false;
};


// Helper function to refresh node data
const refreshNodesData = async (
  db: any,
  nodeIds: string[],
  nodesMap: { [nodeId: string]: INode }
) => {
  for (const nodeId of nodeIds) {
    try {
      const nodeDoc = await getDoc(doc(collection(db, NODES), nodeId));
      if (nodeDoc.exists()) {
        nodesMap[nodeId] = nodeDoc.data() as INode;
      }
    } catch (error) {
      console.error(`Error refreshing data for node ${nodeId}:`, error);
    }
  }
};