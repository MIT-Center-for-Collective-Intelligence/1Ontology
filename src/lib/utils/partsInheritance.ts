import { ICollection, INode } from "@components/types/INode";
import {
  getDoc,
  doc,
  collection,
  updateDoc,
  writeBatch,
  Firestore,
} from "firebase/firestore";
import { NODES } from "../firestoreClient/collections";
import { saveNewChangeLog, recordLogs } from "./helpers";

/**
 * Calculate which parts should be inherited from generalizations or inheritance ref
 */
export const calculateInheritanceParts = (
  node: INode,
  nodes: { [nodeId: string]: INode }
): { [nodeId: string]: { inheritedFromTitle: string; inheritedFromId: string } | null } => {
  const inheritanceParts: { [nodeId: string]: { inheritedFromTitle: string; inheritedFromId: string } | null } = {};
  
  // Check if there's a specific inheritance reference for parts
  const partsInheritanceRef = node.inheritance?.parts?.ref;
  
  if (partsInheritanceRef) {
    // If there's a specific inheritance reference, inherit from that node
    const inheritanceNode = nodes[partsInheritanceRef];
    if (inheritanceNode) {
      // Get all parts from the inheritance node (both direct and inherited)
      const inheritanceDirectParts = inheritanceNode.properties.parts.flatMap(collection => 
        collection.nodes.map(n => n.id)
      );
      const inheritanceInheritedParts = Object.keys(inheritanceNode.inheritanceParts || {});
      const allInheritanceParts = [...inheritanceDirectParts, ...inheritanceInheritedParts];
      
      // Get current node's directly owned parts
      const currentPartIds = new Set(
        node.properties.parts.flatMap(collection => collection.nodes.map(n => n.id))
      );
      
      // Add parts that aren't directly owned by current node
      for (const partId of allInheritanceParts) {
        if (!currentPartIds.has(partId)) {
          // Find the ultimate source of this part
          let sourceNode = inheritanceNode;
          let sourceId = inheritanceNode.id;
          
          // If inheritance node inherited this part, trace back to original source
          if (inheritanceNode.inheritanceParts && inheritanceNode.inheritanceParts[partId]) {
            sourceId = inheritanceNode.inheritanceParts[partId]!.inheritedFromId;
            sourceNode = nodes[sourceId];
          }
          
          inheritanceParts[partId] = {
            inheritedFromTitle: sourceNode?.title || "Unknown",
            inheritedFromId: sourceId
          };
        }
      }
    }
  } else {
    // If no specific inheritance reference, inherit from generalizations
    const generalizations = node.generalizations.flatMap(collection => collection.nodes);
    
    // Get current node's directly owned parts
    const currentPartIds = new Set(
      node.properties.parts.flatMap(collection => collection.nodes.map(n => n.id))
    );
    
    // Check each generalization for parts to inherit
    for (const generalization of generalizations) {
      const parentNode = nodes[generalization.id];
      if (!parentNode) continue;
      
      // Get all parts from parent (both direct and inherited)
      const parentDirectParts = parentNode.properties.parts.flatMap(collection => 
        collection.nodes.map(n => n.id)
      );
      const parentInheritedParts = Object.keys(parentNode.inheritanceParts || {});
      const allParentParts = [...parentDirectParts, ...parentInheritedParts];
      
      // Add parts that aren't directly owned by current node
      for (const partId of allParentParts) {
        if (!currentPartIds.has(partId) && !inheritanceParts[partId]) {
          // Find the ultimate source of this part
          let sourceNode = parentNode;
          let sourceId = parentNode.id;
          
          // If parent inherited this part, trace back to original source
          if (parentNode.inheritanceParts && parentNode.inheritanceParts[partId]) {
            sourceId = parentNode.inheritanceParts[partId]!.inheritedFromId;
            sourceNode = nodes[sourceId];
          }
          
          inheritanceParts[partId] = {
            inheritedFromTitle: sourceNode?.title || "Unknown",
            inheritedFromId: sourceId
          };
        }
      }
    }
  }
  
  return inheritanceParts;
};

/**
 * Update a node's parts inheritance
 */
export const updatePartsInheritance = async (
  nodeId: string,
  nodes: { [nodeId: string]: INode },
  db: Firestore,
  user?: any
): Promise<void> => {
  try {
    const nodeDoc = await getDoc(doc(collection(db, NODES), nodeId));
    if (!nodeDoc.exists()) return;
    
    const nodeData = nodeDoc.data() as INode;
    const newInheritanceParts = calculateInheritanceParts(nodeData, nodes);
    
    // Update the node
    await updateDoc(nodeDoc.ref, {
      inheritanceParts: newInheritanceParts
    });
    
    // Log the change if user is provided
    if (user) {
      await saveNewChangeLog(db, {
        nodeId: nodeId,
        modifiedBy: user.uname,
        modifiedProperty: 'inheritanceParts',
        previousValue: nodeData.inheritanceParts || {},
        newValue: newInheritanceParts,
        modifiedAt: new Date(),
        changeType: 'modify elements',
        fullNode: { ...nodeData, inheritanceParts: newInheritanceParts },
        skillsFuture: false
      });
    }
    
  } catch (error: any) {
    recordLogs({
      type: "error",
      error: JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack,
      }),
      at: "updatePartsInheritance",
      nodeId
    });
  }
};

/**
 * Propagate parts inheritance changes to all specializations
 */
export const propagatePartsInheritanceToSpecializations = async (
  nodeId: string,
  nodes: { [nodeId: string]: INode },
  db: Firestore,
  user?: any
): Promise<void> => {
  try {
    const nodeData = nodes[nodeId];
    if (!nodeData) return;
    
    const batch = writeBatch(db);
    const toUpdate: string[] = [];
    
    // Recursively collect all specializations
    const collectSpecializations = (currentNodeId: string) => {
      const currentNode = nodes[currentNodeId];
      if (!currentNode) return;
      
      const specializations = currentNode.specializations.flatMap(collection => collection.nodes);
      for (const specialization of specializations) {
        if (!toUpdate.includes(specialization.id)) {
          toUpdate.push(specialization.id);
          collectSpecializations(specialization.id);
        }
      }
    };
    
    collectSpecializations(nodeId);
    
    // Update each specialization
    let batchCount = 0;
    for (const specId of toUpdate) {
      const specData = nodes[specId];
      if (!specData) continue;
      
      const newInheritanceParts = calculateInheritanceParts(specData, nodes);
      
      batch.update(doc(collection(db, NODES), specId), {
        inheritanceParts: newInheritanceParts
      });
      
      batchCount++;
      if (batchCount >= 400) {
        await batch.commit();
        batchCount = 0;
      }
    }
    
    if (batchCount > 0) {
      await batch.commit();
    }
    
  } catch (error: any) {
    recordLogs({
      type: "error",
      error: JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack,
      }),
      at: "propagatePartsInheritanceToSpecializations",
      nodeId
    });
  }
};

/**
 * Handle generalization changes and update parts inheritance
 */
export const handleGeneralizationChange = async (
  nodeId: string,
  addedGeneralizations: { id: string }[],
  removedGeneralizations: { id: string }[],
  nodes: { [nodeId: string]: INode },
  db: Firestore,
  user?: any
): Promise<void> => {
  try {
    // Update the node's parts inheritance
    await updatePartsInheritance(nodeId, nodes, db, user);
    
    // Propagate changes to specializations
    await propagatePartsInheritanceToSpecializations(nodeId, nodes, db, user);
    
  } catch (error: any) {
    recordLogs({
      type: "error",
      error: JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack,
      }),
      at: "handleGeneralizationChange",
      nodeId
    });
  }
};

/**
 * Handle parts changes and update inheritance for specializations
 */
export const handlePartsChange = async (
  nodeId: string,
  nodes: { [nodeId: string]: INode },
  db: Firestore,
  user?: any
): Promise<void> => {
  try {
    // Propagate changes to specializations
    await propagatePartsInheritanceToSpecializations(nodeId, nodes, db, user);
    
  } catch (error: any) {
    recordLogs({
      type: "error",
      error: JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack,
      }),
      at: "handlePartsChange",
      nodeId
    });
  }
};

/**
 * Remove parts inheritance system for a node (when migrating from old system)
 */
export const removePartsFromGeneralInheritance = async (
  nodeId: string,
  db: Firestore,
  user?: any
): Promise<void> => {
  try {
    const nodeDoc = await getDoc(doc(collection(db, NODES), nodeId));
    if (!nodeDoc.exists()) return;
    
    const nodeData = nodeDoc.data() as INode;
    
    // Remove parts from general inheritance
    const updatedInheritance = { ...nodeData.inheritance };
    if (updatedInheritance.parts) {
      updatedInheritance.parts.ref = null;
    }
    
    await updateDoc(nodeDoc.ref, {
      'inheritance.parts.ref': null
    });
    
  } catch (error: any) {
    recordLogs({
      type: "error",
      error: JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack,
      }),
      at: "removePartsFromGeneralInheritance",
      nodeId
    });
  }
};

/**
 * Handle when parts inheritance reference changes
 */
export const handlePartsInheritanceChange = async (
  nodeId: string,
  newInheritanceRef: string | null,
  nodes: { [nodeId: string]: INode },
  db: Firestore,
  user?: any
): Promise<void> => {
  try {
    const nodeDoc = await getDoc(doc(collection(db, NODES), nodeId));
    if (!nodeDoc.exists()) return;
    
    const nodeData = nodeDoc.data() as INode;
    const currentInheritanceRef = nodeData.inheritance?.parts?.ref;
    
    // If changing from null to a reference
    if (!currentInheritanceRef && newInheritanceRef) {
      // Clear current parts and move them to be calculated from inheritance
      const updates: any = {
        'inheritance.parts.ref': newInheritanceRef,
        'properties.parts': [{ collectionName: 'main', nodes: [] }]
      };
      
      // Calculate new inheritance parts
      const updatedNodeData = { 
        ...nodeData, 
        inheritance: { 
          ...nodeData.inheritance, 
          parts: { ...nodeData.inheritance.parts, ref: newInheritanceRef } 
        },
        properties: {
          ...nodeData.properties,
          parts: [{ collectionName: 'main', nodes: [] }]
        }
      };
      
      const newInheritanceParts = calculateInheritanceParts(updatedNodeData, nodes);
      updates.inheritanceParts = newInheritanceParts;
      
      await updateDoc(nodeDoc.ref, updates);
    }
    // If changing from a reference to null
    else if (currentInheritanceRef && !newInheritanceRef) {
      // Move inherited parts to inheritanceParts and set ref to null
      const currentInheritanceParts = calculateInheritanceParts(nodeData, nodes);
      
      await updateDoc(nodeDoc.ref, {
        'inheritance.parts.ref': null,
        inheritanceParts: currentInheritanceParts
      });
    }
    // If changing from one reference to another
    else if (currentInheritanceRef && newInheritanceRef && currentInheritanceRef !== newInheritanceRef) {
      // Clear current parts and calculate new inheritance
      const updates: any = {
        'inheritance.parts.ref': newInheritanceRef,
        'properties.parts': [{ collectionName: 'main', nodes: [] }]
      };
      
      // Calculate new inheritance parts from new reference
      const updatedNodeData = { 
        ...nodeData, 
        inheritance: { 
          ...nodeData.inheritance, 
          parts: { ...nodeData.inheritance.parts, ref: newInheritanceRef } 
        },
        properties: {
          ...nodeData.properties,
          parts: [{ collectionName: 'main', nodes: [] }]
        }
      };
      
      const newInheritanceParts = calculateInheritanceParts(updatedNodeData, nodes);
      updates.inheritanceParts = newInheritanceParts;
      
      await updateDoc(nodeDoc.ref, updates);
    }
    
    // Log the change if user is provided
    if (user) {
      await saveNewChangeLog(db, {
        nodeId: nodeId,
        modifiedBy: user.uname,
        modifiedProperty: 'inheritance.parts.ref',
        previousValue: currentInheritanceRef,
        newValue: newInheritanceRef,
        modifiedAt: new Date(),
        changeType: 'modify elements',
        fullNode: nodeData,
        skillsFuture: false
      });
    }
    
  } catch (error: any) {
    recordLogs({
      type: "error",
      error: JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack,
      }),
      at: "handlePartsInheritanceChange",
      nodeId
    });
  }
};

/**
 * Handle when new parts are added while inheritance ref exists
 */
export const handleAddPartsWithInheritanceRef = async (
  nodeId: string,
  nodes: { [nodeId: string]: INode },
  db: Firestore,
  user?: any
): Promise<void> => {
  try {
    const nodeDoc = await getDoc(doc(collection(db, NODES), nodeId));
    if (!nodeDoc.exists()) return;
    
    const nodeData = nodeDoc.data() as INode;
    const currentInheritanceRef = nodeData.inheritance?.parts?.ref;
    
    // If there's an inheritance ref, we need to move inherited parts to inheritanceParts
    // and set the ref to null
    if (currentInheritanceRef) {
      const currentInheritanceParts = calculateInheritanceParts(nodeData, nodes);
      
      await updateDoc(nodeDoc.ref, {
        'inheritance.parts.ref': null,
        inheritanceParts: currentInheritanceParts
      });
      
      // Log the change
      if (user) {
        await saveNewChangeLog(db, {
          nodeId: nodeId,
          modifiedBy: user.uname,
          modifiedProperty: 'inheritance.parts.ref',
          previousValue: currentInheritanceRef,
          newValue: null,
          modifiedAt: new Date(),
          changeType: 'modify elements',
          fullNode: nodeData,
          skillsFuture: false
        });
      }
    }
    
  } catch (error: any) {
    recordLogs({
      type: "error",
      error: JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack,
      }),
      at: "handleAddPartsWithInheritanceRef",
      nodeId
    });
  }
}; 