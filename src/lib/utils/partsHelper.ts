import { INode } from "@components/types/INode";
import {
  getFirestore,
  getDoc,
  updateDoc,
  doc,
  collection,
} from "firebase/firestore";
import { NODES } from "../firestoreClient/collections";
import { saveNewChangeLog } from "./helpers";
// import { refreshInheritanceTree } from "./inheritanceTreeBuilder";
import { getTitle } from "./string.utils";

/**
 * Refresh inheritanceParts based on current generalizations
 * Keeps only inherited parts that are still available from remaining generalizations
 */
export const refreshPartsInheritance = (
  node: INode,
  nodes: { [nodeId: string]: INode },
): {
  [partId: string]: {
    inheritedFromTitle: string;
    inheritedFromId: string;
    directSource: string;
  };
} => {
  const currentInheritanceParts = node.inheritanceParts || {};

  const allGeneralizations = node.generalizations.flatMap(
    (collection) => collection.nodes,
  );

  // If no generalizations left, remove all inheritanceParts
  if (allGeneralizations.length === 0) {
    return {};
  }

  // Collect all available parts from remaining generalizations
  const availablePartIds = new Set<string>();

  for (const generalization of allGeneralizations) {
    const parentNode = nodes[generalization.id];
    if (!parentNode) continue;

    // Get direct parts from parent
    const parentDirectParts =
      parentNode.properties.parts?.flatMap((collection) =>
        collection.nodes.map((n) => n.id),
      ) || [];

    // Get inherited parts from parent
    const parentInheritancePartIds = Object.keys(
      parentNode.inheritanceParts || {},
    );

    // Add all available parts to the set
    parentDirectParts.forEach((partId) => availablePartIds.add(partId));
    parentInheritancePartIds.forEach((partId) => availablePartIds.add(partId));
  }

  // Keep only inheritanceParts that are still available from remaining generalizations
  const updatedInheritanceParts: {
    [partId: string]: {
      inheritedFromTitle: string;
      inheritedFromId: string;
      directSource: string;
    };
  } = {};

  for (const [partId, partInfo] of Object.entries(currentInheritanceParts)) {
    if (partInfo && availablePartIds.has(partId)) {
      updatedInheritanceParts[partId] = {
        inheritedFromTitle: partInfo.inheritedFromTitle,
        inheritedFromId: partInfo.inheritedFromId,
        directSource: (partInfo as any).directSource || "unknown",
      };
    }
    // If partId is not in availablePartIds, it is not added to updatedInheritanceParts
  }

  return updatedInheritanceParts;
};

/**
 * Propagate parts changes to all specializations recursively
 * When a node's parts/inheritanceParts change, update all its specializations
 */
export const propagatePartsChangeToSpecializations = async (
  nodeId: string,
  nodes: { [nodeId: string]: INode },
  user: any,
  updateLocalNodeCallback?: (
    nodeId: string,
    updatedNodeData: Partial<INode>,
  ) => void,
): Promise<boolean> => {
  try {
    const db = getFirestore();

    const nodeDoc = await getDoc(doc(collection(db, NODES), nodeId));
    if (!nodeDoc.exists()) return false;

    const nodeData = nodeDoc.data() as INode;

    const allSpecializations =
      nodeData.specializations?.flatMap((collection) => collection.nodes) || [];

    if (allSpecializations.length === 0) {
      return true; // No specializations to update
    }

    // Update each specialization
    for (const spec of allSpecializations) {
      try {
        const specNodeDoc = await getDoc(doc(collection(db, NODES), spec.id));
        if (!specNodeDoc.exists()) continue;

        const specNodeData = specNodeDoc.data() as INode;

        const updatedNodes = {
          ...nodes,
          [nodeId]: nodeData,
          [spec.id]: specNodeData,
        };

        const newInheritanceParts = refreshPartsInheritance(
          specNodeData,
          updatedNodes,
        );

        const updates: any = {
          inheritanceParts: newInheritanceParts,
        };

        await updateDoc(specNodeDoc.ref, updates);

        // Update local state if callback provided
        if (updateLocalNodeCallback) {
          updateLocalNodeCallback(spec.id, {
            inheritanceParts: newInheritanceParts,
          });
        }

        // Update local nodes data
        updatedNodes[spec.id] = {
          ...specNodeData,
          inheritanceParts: newInheritanceParts,
        };

        // Refresh inheritance tree for each affected part
        // const affectedPartIds = Object.keys(newInheritanceParts);
        // for (const partId of affectedPartIds) {
        //   console.log(`Refreshing inheritance tree for part ${partId} due to specialization ${spec.id} inheritance update`);

        // Fetch the part node's data
        // const partNodeDoc = await getDoc(doc(collection(db, NODES), partId));
        // if (partNodeDoc.exists()) {
        //   const partNodeData = partNodeDoc.data() as INode;
        //   await refreshInheritanceTree(db, partId, "isPartOf", {
        //     ...nodes,
        //     [partId]: partNodeData
        //   });
        // }
        // }

        if (user) {
          await saveNewChangeLog(db, {
            nodeId: spec.id,
            modifiedBy: user.uname,
            modifiedProperty: "inheritanceParts",
            previousValue: specNodeData.inheritanceParts || {},
            newValue: newInheritanceParts,
            modifiedAt: new Date(),
            changeType: "modify elements",
            fullNode: specNodeData,
            changeDetails: {
              reason: `Parts inheritance updated due to changes in parent node ${nodeId}`,
            },
            skillsFuture: false,
          });
        }

        // Recursively propagate to all specializations
        await propagatePartsChangeToSpecializations(
          spec.id,
          updatedNodes,
          user,
          updateLocalNodeCallback,
        );
      } catch (error) {
        console.error(`Error updating specialization ${spec.id}:`, error);
      }
    }

    return true;
  } catch (error) {
    console.error("Error propagating parts change to specializations:", error);
    return false;
  }
};

/**
 * Save part as inherited part to inheritanceParts
 * Used when selecting parts from generalization dropdown in SelectModel
 */
export const saveAsInheritancePart = async (
  nodeId: string,
  partId: string,
  inheritedFromId: string,
  inheritedFromTitle: string,
  user: any,
  action: "add" | "remove" = "add",
): Promise<boolean> => {
  try {
    const db = getFirestore();
    const nodeDoc = await getDoc(doc(collection(db, NODES), nodeId));
    if (!nodeDoc.exists()) return false;

    const nodeData = nodeDoc.data() as INode;
    const currentInheritanceParts = nodeData.inheritanceParts || {};

    let newInheritanceParts;
    let changeType: "add element" | "remove element";
    let previousValue;
    let newValue;

    if (action === "add") {
      newInheritanceParts = {
        ...currentInheritanceParts,
        [partId]: {
          inheritedFromTitle,
          inheritedFromId,
        },
      };
      changeType = "add element";
      previousValue = currentInheritanceParts;
      newValue = newInheritanceParts;
    } else {
      newInheritanceParts = { ...currentInheritanceParts };
      delete newInheritanceParts[partId];
      changeType = "remove element";
      previousValue = currentInheritanceParts;
      newValue = newInheritanceParts;
    }

    const updates: any = {
      inheritanceParts: newInheritanceParts,
    };

    await updateDoc(nodeDoc.ref, updates);

    // Update local nodes data
    const updatedNodeData = {
      ...nodeData,
      inheritanceParts: newInheritanceParts,
    };

    // // Refresh inheritance tree for the affected part
    // console.log(`Refreshing inheritance tree for part ${partId} due to ${action} inheritance part in node ${nodeId}`);

    // // Fetch the part node's data
    // const partNodeDoc = await getDoc(doc(collection(db, NODES), partId));
    // if (partNodeDoc.exists()) {
    //   const partNodeData = partNodeDoc.data() as INode;
    //   await refreshInheritanceTree(db, partId, "isPartOf", {
    //     [nodeId]: updatedNodeData,
    //     [partId]: partNodeData
    //   });
    // }

    if (user) {
      await saveNewChangeLog(db, {
        nodeId: nodeId,
        modifiedBy: user.uname,
        modifiedProperty: "inheritanceParts",
        previousValue,
        newValue,
        modifiedAt: new Date(),
        changeType,
        fullNode: updatedNodeData,
        changeDetails: {
          partId,
          action,
          inheritedFromTitle,
          inheritedFromId,
        },
        skillsFuture: false,
      });
    }

    return true;
  } catch (error) {
    console.error("Error saving inheritance part:", error);
    return false;
  }
};

/**
 * Break inheritance and copy all inherited parts to inheritanceParts (excluding the removed part)
 * Used when a part is removed from a node with intact inheritance
 */
export const breakInheritanceAndCopyParts = async (
  nodeId: string,
  partIdToRemove: string,
  nodes: { [nodeId: string]: INode },
  user: any,
): Promise<boolean> => {
  try {
    const db = getFirestore();
    const nodeDoc = await getDoc(doc(collection(db, NODES), nodeId));
    if (!nodeDoc.exists()) return false;

    const nodeData = nodeDoc.data() as INode;
    const inheritanceRef = nodeData.inheritance?.parts?.ref;

    if (!inheritanceRef || !nodes[inheritanceRef]) {
      return false; // No inheritance to break
    }

    const referencedNode = nodes[inheritanceRef];

    // Initialize inheritanceParts if it doesn't exist
    if (!nodeData.inheritanceParts) {
      nodeData.inheritanceParts = {};
    }

    // Copy generalization's direct parts to node's inheritanceParts (excluding the part being removed)
    const generalizationParts = referencedNode.properties.parts || [];
    generalizationParts.forEach((collection: any) => {
      collection.nodes.forEach((partNode: any) => {
        if (partNode.id !== partIdToRemove) {
          nodeData.inheritanceParts[partNode.id] = {
            inheritedFromTitle: referencedNode.title,
            inheritedFromId: inheritanceRef,
          };
        }
      });
    });

    // Copy generalization's inheritanceParts to node's inheritanceParts (excluding the part being removed)
    const generalizationInheritanceParts =
      referencedNode.inheritanceParts || {};
    Object.entries(generalizationInheritanceParts).forEach(
      ([partId, partInfo]) => {
        if (partInfo && partId !== partIdToRemove) {
          nodeData.inheritanceParts[partId] = partInfo;
        }
      },
    );

    // Keep the node's existing direct parts in the parts property
    // The parts property is not affected and only inheritanceParts gets populated

    await updateDoc(nodeDoc.ref, {
      inheritanceParts: nodeData.inheritanceParts,
      "inheritance.parts.ref": null,
    });

    if (user) {
      await saveNewChangeLog(db, {
        nodeId: nodeId,
        modifiedBy: user.uname,
        modifiedProperty: "inheritanceParts",
        previousValue: {},
        newValue: nodeData.inheritanceParts,
        modifiedAt: new Date(),
        changeType: "modify elements",
        fullNode: nodeData,
        changeDetails: {
          reason:
            "Broke inheritance and copied inherited parts to inheritanceParts",
        },
        skillsFuture: false,
      });
    }

    return true;
  } catch (error) {
    console.error("Error breaking inheritance and copying parts:", error);
    return false;
  }
};

/**
 * Get all parts from a generalization (both direct and inherited)
 */
export const getGeneralizationParts = (
  generalizationId: string,
  nodes: { [nodeId: string]: INode },
): { id: string; title: string; isInherited: boolean }[] => {
  const generalizationNode = nodes[generalizationId];
  if (!generalizationNode) return [];

  const parts: { id: string; title: string; isInherited: boolean }[] = [];

  let genParts = generalizationNode.properties?.parts;
  const partRefId = generalizationNode.inheritance["parts"].ref;
  if (partRefId) {
    genParts = nodes[partRefId].properties["parts"];
  }
  // Add direct parts
  if (genParts) {
    genParts.forEach((collection: any) => {
      collection.nodes.forEach((part: any) => {
        if (nodes[part.id]) {
          parts.push({
            id: part.id,
            title: getTitle(nodes, part.id),
            isInherited: false,
          });
        }
      });
    });
  }

  // Add inherited parts
  if (generalizationNode.inheritanceParts) {
    Object.keys(generalizationNode.inheritanceParts).forEach(
      (partId: string) => {
        const partInfo = generalizationNode.inheritanceParts[partId];
        if (partInfo && nodes[partId]) {
          parts.push({
            id: partId,
            title: getTitle(nodes, partId),
            isInherited: true,
          });
        }
      },
    );
  }

  return parts;
};

/**
 * Get all generalizations for a node
 */
export const getAllGeneralizations = (
  currentVisibleNode: INode,
  nodes: { [nodeId: string]: INode },
): { id: string; title: string }[] => {
  if (!currentVisibleNode?.generalizations) return [];

  return currentVisibleNode.generalizations
    .flatMap((collection: any) =>
      collection.nodes.map((node: any) => ({
        id: node.id,
        title: getTitle(nodes, node.id),
      })),
    )
    .filter((gen: any) => nodes[gen.id]);
};

// /**
//  * Handle when generalizations change (added or removed)
//  * For adding: Does nothing (parts inheritance should be explicit)
//  * For removing: Recalculates inheritanceParts and propagates to specializations
//  *
//  * REMOVAL REASON:
//  * This function was removed because the new hybrid inheritance requirement specifies that
//  * nodes with broken inheritance (inheritance.parts.ref = null) should have their parts
//  * remain unaffected by generalization changes. The automatic recalculation this function
//  * provided would interfere with the explicit nature of broken inheritance, where users
//  * manually manage their inheritanceParts without automatic updates from generalization changes.
//  *
//  * WHERE TO APPLY IF RE-ENABLED:
//  * This function should ONLY be called for nodes with intact inheritance and should be
//  * conditionally applied in the following locations:
//  *
//  * 1. PRIMARY: helpers.ts - updateInheritanceWhenUnlinkAGeneralization()
//  *    - Add after the parts inheritance check:
//  *    if (property === "parts" && specializationData.inheritance.parts?.ref !== null) {
//  *      await handleGeneralizationChange(specializationData.id, nodes, user, 'remove');
//  *    }
//  *
//  * 2. SECONDARY: LinkNode.tsx - unlinkSpecializationOrGeneralization()
//  *    - When generalizations are unlinked:
//  *    if (property === "generalizations" && nodeData.inheritance.parts?.ref !== null) {
//  *      await handleGeneralizationChange(nodeData.id, nodes, user, 'remove');
//  *    }
//  *
//  * 3. ADDITION: Node.tsx - handleSaveLinkChanges()
//  *    - When generalizations are added via UI:
//  *    if (selectedProperty === "generalizations" && nodeData.inheritance.parts?.ref !== null) {
//  *      await handleGeneralizationChange(nodeId, nodes, user, 'add');
//  *    }
//  *
//  * CRITICAL: Always check inheritance.parts.ref !== null before calling to ensure
//  * the function only affects nodes with intact inheritance, preserving the explicit
//  * nature of broken inheritance where users manually control their inheritanceParts.
//  */
// export const handleGeneralizationChange = async (
//   nodeId: string,
//   nodes: { [nodeId: string]: INode },
//   user: any,
//   action: 'add' | 'remove' = 'remove',
//   updateLocalNodeCallback?: (nodeId: string, updatedNodeData: Partial<INode>) => void
// ): Promise<boolean> => {
// export const handleGeneralizationChange = async (
//   nodeId: string,
//   nodes: { [nodeId: string]: INode },
//   user: any,
//   action: 'add' | 'remove' = 'remove',
//   updateLocalNodeCallback?: (nodeId: string, updatedNodeData: Partial<INode>) => void
// ): Promise<boolean> => {
//   try {
//     // When adding generalizations, do nothing - parts inheritance should be explicit
//     if (action === 'add') {
//       return true;
//     }

//     // Only calculate and update inheritance when removing generalizations
//     if (action === 'remove') {
//       const db = getFirestore();

//       // First update the node itself
//       const updateSuccess = await updateNodePartsInheritance(nodeId, nodes, user);
//       if (!updateSuccess) return false;

//       // Get fresh node data after update
//       const nodeDoc = await getDoc(doc(collection(db, NODES), nodeId));
//       if (!nodeDoc.exists()) return false;

//       const updatedNodeData = nodeDoc.data() as INode;

//       // Update local state if callback provided
//       if (updateLocalNodeCallback) {
//         updateLocalNodeCallback(nodeId, {
//           inheritanceParts: updatedNodeData.inheritanceParts
//         });
//       }

//       // Propagate changes to all specializations
//       await propagatePartsChangeToSpecializations(
//         nodeId,
//         nodes,
//         user,
//         updateLocalNodeCallback
//       );
//     }

//     return true;
//   } catch (error) {
//     console.error("Error handling generalization change:", error);
//     return false;
//   }
// };
