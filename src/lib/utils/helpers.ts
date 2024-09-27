import { INode } from " @components/types/INode";
import { getDoc, doc, collection, updateDoc } from "firebase/firestore";
import { NODES } from "../firestoreClient/collections";

export const unlinkPropertyOf = async (
  db: any,
  property: "parts" | "isPartOf" | string,
  removeNodeId: string,
  removeFromId: string
) => {
  if (!removeFromId) return;

  const unlinkFromDoc = await getDoc(doc(collection(db, NODES), removeFromId));
  let removeFrom: "parts" | "isPartOf" | string =
    property === "parts" ? "isPartOf" : property;

  if (unlinkFromDoc.exists()) {
    const unlinkFromData = unlinkFromDoc.data() as INode;

    if (removeFrom === "parts" || removeFrom === "isPartOf") {
      for (let cat in unlinkFromData.properties[removeFrom]) {
        unlinkFromData.properties[removeFrom][cat] = unlinkFromData.properties[
          removeFrom
        ][cat].filter((c: { id: string }) => c.id !== removeNodeId);
      }
      await updateDoc(unlinkFromDoc.ref, {
        [`properties.${removeFrom}`]: unlinkFromData.properties[removeFrom],
      });
    } else {
      if (unlinkFromData.propertyOf && unlinkFromData.propertyOf[removeFrom]) {
        for (let cat in unlinkFromData.propertyOf[removeFrom]) {
          unlinkFromData.propertyOf[removeFrom][cat] =
            unlinkFromData.propertyOf[removeFrom][cat].filter(
              (c: { id: string }) => c.id !== removeNodeId
            );
        }

        await updateDoc(unlinkFromDoc.ref, {
          [`propertyOf.${removeFrom}`]: unlinkFromData.propertyOf[removeFrom],
        });
      }
    }
  }
};

// Function to fetch, update, and remove the link reference
export const fetchAndUpdateNode = async (
  db: any,
  linkId: string,
  nodeId: string,
  removeFromProperty: string
) => {
  const nodeDoc = await getDoc(doc(collection(db, NODES), linkId));

  if (nodeDoc.exists()) {
    let nodeData = nodeDoc.data() as INode;
    nodeData = removeNodeFromLinks(nodeData, nodeId, removeFromProperty);
    await updateDoc(nodeDoc.ref, nodeData);
  }
};

export const removeNodeFromLinks = (
  LinkNodeData: INode,
  elementId: string,
  removeFromProperty: string
) => {
  let elements =
    LinkNodeData[removeFromProperty as "specializations" | "generalizations"] ||
    LinkNodeData.properties[removeFromProperty];

  // Iterate over the categories within each type of child-node.
  // If the child-node with the specified ID is found, remove it from the array.
  for (let category in elements) {
    const elementIdx = (elements[category] || []).findIndex(
      (link: { id: string }) => link.id === elementId
    );
    if (elementIdx !== -1) {
      elements[category].splice(elementIdx, 1);
    }
  }

  return LinkNodeData;
};

// Main function to remove the isPartOf and generalizations references
export const removeIsPartOf = async (db: any, nodeData: INode) => {
  // Helper to handle both generalizations and isPartOfs
  const processRemoval = async (
    references: any[],
    removeFromProperty: string
  ) => {
    for (let { id: linkId } of references) {
      await fetchAndUpdateNode(db, linkId, nodeData.id, removeFromProperty);
    }
  };

  // Process generalizations
  const generalizations = Object.values(nodeData?.generalizations || {}).flat();
  await processRemoval(generalizations, "specializations");

  // Process isPartOfs
  const isPartOfs = Object.values(nodeData?.properties?.isPartOf || {}).flat();
  await processRemoval(isPartOfs, "parts");

  // Process any additional properties in propertyOf
  if (nodeData.propertyOf) {
    for (let propertyName in nodeData.propertyOf) {
      const propertyOfElements = Object.values(
        nodeData.propertyOf[propertyName] || {}
      ).flat();
      await processRemoval(propertyOfElements, propertyName);
    }
  }
};
