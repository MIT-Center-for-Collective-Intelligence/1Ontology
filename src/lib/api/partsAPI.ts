import { INode } from "@components/types/INode";
import { getFirestore, getDoc, updateDoc, doc, collection } from "firebase/firestore";
import { NODES } from "../firestoreClient/collections";
import { 
  updatePartsInheritance, 
  handleGeneralizationChange, 
  handlePartsChange,
  removePartsFromGeneralInheritance,
  handlePartsInheritanceChange,
  handleAddPartsWithInheritanceRef,
  calculateInheritanceParts
} from "../utils/partsInheritance";
import { saveNewChangeLog, unlinkPropertyOf } from "../utils/helpers";

/**
 * API function to refresh parts inheritance for a node
 */
export const refreshNodePartsInheritance = async (
  nodeId: string,
  nodes: { [nodeId: string]: INode },
  user: any
): Promise<boolean> => {
  try {
    const db = getFirestore();
    await updatePartsInheritance(nodeId, nodes, db, user);
    return true;
  } catch (error) {
    console.error("Error refreshing parts inheritance:", error);
    return false;
  }
};

/**
 * API function to handle when generalizations change
 */
export const updateGeneralizationsAndPartsInheritance = async (
  nodeId: string,
  addedGeneralizations: { id: string }[],
  removedGeneralizations: { id: string }[],
  nodes: { [nodeId: string]: INode },
  user: any
): Promise<boolean> => {
  try {
    const db = getFirestore();
    await handleGeneralizationChange(
      nodeId,
      addedGeneralizations,
      removedGeneralizations,
      nodes,
      db,
      user
    );
    return true;
  } catch (error) {
    console.error("Error updating generalizations and parts inheritance:", error);
    return false;
  }
};

/**
 * API function to handle when parts change
 */
export const updatePartsAndInheritance = async (
  nodeId: string,
  nodes: { [nodeId: string]: INode },
  user: any
): Promise<boolean> => {
  try {
    const db = getFirestore();
    await handlePartsChange(nodeId, nodes, db, user);
    return true;
  } catch (error) {
    console.error("Error updating parts inheritance:", error);
    return false;
  }
};

/**
 * API function to migrate a node from old parts inheritance to new system
 */
export const migrateToNewPartsInheritance = async (
  nodeId: string,
  nodes: { [nodeId: string]: INode },
  user: any
): Promise<boolean> => {
  try {
    const db = getFirestore();
    
    // Remove from old system
    await removePartsFromGeneralInheritance(nodeId, db, user);
    
    // Set up new system
    await updatePartsInheritance(nodeId, nodes, db, user);
    
    return true;
  } catch (error) {
    console.error("Error migrating to new parts inheritance:", error);
    return false;
  }
};

/**
 * API function to bulk update parts inheritance for multiple nodes
 */
export const bulkUpdatePartsInheritance = async (
  nodeIds: string[],
  nodes: { [nodeId: string]: INode },
  user: any
): Promise<{ success: string[]; failed: string[] }> => {
  const results: { success: string[]; failed: string[] } = { success: [], failed: [] };
  const db = getFirestore();
  
  for (const nodeId of nodeIds) {
    try {
      await updatePartsInheritance(nodeId, nodes, db, user);
      results.success.push(nodeId);
    } catch (error) {
      console.error(`Error updating parts inheritance for ${nodeId}:`, error);
      results.failed.push(nodeId);
    }
  }
  
  return results;
};

/**
 * API function to handle parts inheritance reference changes
 */
export const changePartsInheritanceReference = async (
  nodeId: string,
  newInheritanceRef: string | null,
  nodes: { [nodeId: string]: INode },
  user: any
): Promise<boolean> => {
  try {
    const db = getFirestore();
    await handlePartsInheritanceChange(nodeId, newInheritanceRef, nodes, db, user);
    return true;
  } catch (error) {
    console.error("Error changing parts inheritance reference:", error);
    return false;
  }
};

/**
 * API function to handle when parts are added while inheritance ref exists
 */
export const handlePartsAddedWithInheritance = async (
  nodeId: string,
  nodes: { [nodeId: string]: INode },
  user: any
): Promise<boolean> => {
  try {
    const db = getFirestore();
    await handleAddPartsWithInheritanceRef(nodeId, nodes, db, user);
    return true;
  } catch (error) {
    console.error("Error handling parts added with inheritance:", error);
    return false;
  }
};

/**
 * API function to handle adding new parts correctly when inheritance exists
 * This function separates inherited parts from newly added parts
 */
export const handleNewPartsAddition = async (
  nodeId: string,
  newPartsCollection: any[], // The new parts collection being saved
  nodes: { [nodeId: string]: INode },
  user: any
): Promise<boolean> => {
  try {
    const db = getFirestore();
    const nodeDoc = await getDoc(doc(collection(db, NODES), nodeId));
    if (!nodeDoc.exists()) return false;
    
    const nodeData = nodeDoc.data() as INode;
    const hasPartsInheritanceRef = nodeData.inheritance?.parts?.ref;
    
    if (hasPartsInheritanceRef) {
      // Calculate which parts are inherited from the reference
      const inheritedParts = calculateInheritanceParts(nodeData, nodes);
      const inheritedPartIds = new Set(Object.keys(inheritedParts));
      
      // Extract only the newly added parts (not inherited)
      const newPartsOnly = newPartsCollection.map(collection => ({
        ...collection,
        nodes: collection.nodes.filter((node: any) => !inheritedPartIds.has(node.id))
      }));
      
      // Update the node with separated parts
      const updates: any = {
        'properties.parts': newPartsOnly,
        'inheritance.parts.ref': null, // Clear inheritance ref since we now have direct parts
        'inheritanceParts': inheritedParts
      };
      
      await updateDoc(nodeDoc.ref, updates);
      
      // Log the change
      if (user) {
        await saveNewChangeLog(db, {
          nodeId: nodeId,
          modifiedBy: user.uname,
          modifiedProperty: 'parts',
          previousValue: nodeData.properties.parts || [],
          newValue: newPartsOnly,
          modifiedAt: new Date(),
          changeType: 'modify elements',
          fullNode: { ...nodeData, properties: { ...nodeData.properties, parts: newPartsOnly }, inheritanceParts: inheritedParts },
          skillsFuture: false
        });
      }
      
      return true;
    }
    
    // If no inheritance ref, proceed normally
    return true;
    
  } catch (error) {
    console.error("Error handling new parts addition:", error);
    return false;
  }
};

/**
 * API function to handle unlinking parts with proper inheritance management
 */
export const handlePartUnlinking = async (
  nodeId: string,
  partIdToUnlink: string,
  nodes: { [nodeId: string]: INode },
  user: any,
  updateLocalNodeCallback?: (nodeId: string, updatedNodeData: Partial<INode>) => void
): Promise<boolean> => {
  try {
    const db = getFirestore();
    const nodeDoc = await getDoc(doc(collection(db, NODES), nodeId));
    if (!nodeDoc.exists()) return false;
    
    const nodeData = nodeDoc.data() as INode;
    
    // Check if the part exists in the direct parts property
    const currentParts = nodeData.properties.parts || [{ collectionName: 'main', nodes: [] }];
    const partExistsInParts = currentParts.some(collection => 
      collection.nodes.some((node: any) => node.id === partIdToUnlink)
    );
    
    // Check if the part exists in inheritanceParts
    const currentInheritanceParts = nodeData.inheritanceParts || {};
    const partExistsInInheritanceParts = currentInheritanceParts.hasOwnProperty(partIdToUnlink);
    
    const updates: any = {};
    let changeDetails: any = { unlinkedPart: partIdToUnlink };
    
    if (partExistsInParts) {
      // Remove from direct parts
      const updatedParts = currentParts.map(collection => ({
        ...collection,
        nodes: collection.nodes.filter((node: any) => node.id !== partIdToUnlink)
      }));
      
      updates['properties.parts'] = updatedParts;
      changeDetails.removedFrom = 'parts';
      
      await updateDoc(nodeDoc.ref, updates);
      
      // Handle parts/isPartOf relationship unlinking
      await unlinkPropertyOf(db, 'parts', nodeId, partIdToUnlink);
      
      // Update local state if callback provided
      if (updateLocalNodeCallback) {
        updateLocalNodeCallback(nodeId, {
          properties: { ...nodeData.properties, parts: updatedParts }
        });
      }
      
    } else if (partExistsInInheritanceParts) {
      // Remove from inheritanceParts and clear inheritance ref
      const updatedInheritanceParts = { ...currentInheritanceParts };
      delete updatedInheritanceParts[partIdToUnlink];
      
      updates['inheritance.parts.ref'] = null;
      updates['inheritanceParts'] = updatedInheritanceParts;
      changeDetails.removedFrom = 'inheritanceParts';
      
      await updateDoc(nodeDoc.ref, updates);
      
      // Handle parts/isPartOf relationship unlinking
      await unlinkPropertyOf(db, 'parts', nodeId, partIdToUnlink);
      
      // Update local state if callback provided
      if (updateLocalNodeCallback) {
        updateLocalNodeCallback(nodeId, {
          inheritance: { 
            ...nodeData.inheritance, 
            parts: { ...nodeData.inheritance.parts, ref: null } 
          },
          inheritanceParts: updatedInheritanceParts
        });
      }
      
    } else {
      // Part doesn't exist in either location
      console.warn(`Part ${partIdToUnlink} not found in node ${nodeId}`);
      return false;
    }
    
    // Log the change
    if (user) {
      await saveNewChangeLog(db, {
        nodeId: nodeId,
        modifiedBy: user.uname,
        modifiedProperty: 'parts',
        previousValue: partExistsInParts ? currentParts : currentInheritanceParts,
        newValue: partExistsInParts ? updates['properties.parts'] : updates['inheritanceParts'],
        modifiedAt: new Date(),
        changeType: 'remove element',
        fullNode: nodeData,
        changeDetails,
        skillsFuture: false
      });
    }
    
    return true;
  } catch (error) {
    console.error("Error unlinking part:", error);
    return false;
  }
}; 