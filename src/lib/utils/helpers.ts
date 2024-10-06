import { INode } from " @components/types/INode";
import {
  getDoc,
  doc,
  collection,
  updateDoc,
  DocumentReference,
  writeBatch,
  WriteBatch,
  setDoc,
  increment,
} from "firebase/firestore";
import { NODES, NODES_LOGS, USERS } from "../firestoreClient/collections";
import { NodeChange } from " @components/types/INode";
import moment from "moment";
import { capitalizeFirstLetter } from "./string.utils";

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
  removeFromProperty: string,
  uname: string
) => {
  const nodeDoc = await getDoc(doc(collection(db, NODES), linkId));

  if (nodeDoc.exists()) {
    let nodeData = nodeDoc.data() as INode;
    const previousValue = JSON.parse(
      JSON.stringify(
        nodeData[removeFromProperty as "specializations" | "generalizations"] ||
          nodeData.properties[removeFromProperty]
      )
    );
    nodeData = removeNodeFromLinks(nodeData, nodeId, removeFromProperty);
    saveNewChangeLog(db, {
      nodeId: linkId,
      modifiedBy: uname,
      modifiedProperty: removeFromProperty,
      previousValue,
      newValue:
        nodeData[removeFromProperty as "specializations" | "generalizations"] ||
        nodeData.properties[removeFromProperty],
      modifiedAt: new Date(),
      changeType: "remove element",
      fullNode: nodeData,
    });
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
export const removeIsPartOf = async (
  db: any,
  nodeData: INode,
  uname: string
) => {
  // Helper to handle both generalizations and isPartOfs
  const processRemoval = async (
    references: any[],
    removeFromProperty: string
  ) => {
    for (let { id: linkId } of references) {
      await fetchAndUpdateNode(
        db,
        linkId,
        nodeData.id,
        removeFromProperty,
        uname
      );
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

interface UpdateInheritanceParams {
  nodeId: string;
  updatedProperty: string;
  db: any;
}
// Function to handle inheritance
export const updateInheritance = async ({
  nodeId,
  updatedProperty,
  db,
}: UpdateInheritanceParams): Promise<void> => {
  try {
    const batch = writeBatch(db);

    const nodeRef = doc(collection(db, NODES), nodeId);
    updateDoc(nodeRef, {
      [`inheritance.${updatedProperty}.ref`]: null,
    });

    // Recursively update specializations
    await recursivelyUpdateSpecializations({
      nodeId: nodeId,
      updatedProperty,
      batch,
      generalizationId: nodeId,
      db,
    });
    // Commit all updates as a batch
    await batch.commit();
  } catch (error) {
    console.error(error);
    /*   recordLogs({
      type: "error",
      error,
      at: "updateInheritance",
    }); */
  }
};

// Helper function to recursively update specializations
const recursivelyUpdateSpecializations = async ({
  nodeId,
  updatedProperty,
  batch,
  nestedCall = false,
  inheritanceType,
  generalizationId,
  db,
}: {
  nodeId: string;
  updatedProperty: string;
  batch: WriteBatch;
  nestedCall?: boolean;
  inheritanceType?:
    | "inheritUnlessAlreadyOverRidden"
    | "inheritAfterReview"
    | "alwaysInherit";
  generalizationId: string;
  db: any;
}): Promise<void> => {
  // Fetch node data from Firestore
  const nodeRef = doc(collection(db, NODES), nodeId);
  const nodeSnapshot = await getDoc(nodeRef);
  const nodeData = nodeSnapshot.data() as INode;

  if (!nodeData || !nodeData.properties.hasOwnProperty(updatedProperty)) return;

  // Get the inheritance type for the updated property
  const inheritance = nodeData.inheritance[updatedProperty];
  const canInherit =
    // (inheritanceType === "inheritUnlessAlreadyOverRidden" && inheritance.ref === generalizationId) ||
    inheritanceType === "alwaysInherit";

  if (nestedCall && canInherit && inheritance.ref !== generalizationId) {
    await updateProperty(batch, nodeRef, updatedProperty, generalizationId, db);
  }

  if (inheritance?.inheritanceType === "neverInherit") {
    return;
  }
  let specializations = Object.values(nodeData.specializations).flat() as {
    id: string;
    title: string;
  }[];

  if (inheritance?.inheritanceType === "inheritAfterReview") {
    /*   specializations = (await selectIt(
      <Box sx={{ mb: "15px" }}>
        <Typography>
          Select which of the following specializations should inherit the
          change that you just made to the property{" "}
          <strong>{updatedProperty}</strong>,
        </Typography>
        <Typography>{"After you're done click continue."}</Typography>
      </Box>,
      specializations,
      "Continue",
      ""
    )) as {
      id: string;
      title: string;
    }[]; */
  }
  if (specializations.length <= 0) {
    return;
  }
  for (const specialization of specializations) {
    await recursivelyUpdateSpecializations({
      nodeId: specialization.id,
      updatedProperty,
      batch,
      nestedCall: true,
      inheritanceType: inheritance.inheritanceType,
      generalizationId,
      db,
    });
  }
};

// Function to update a property in Firestore using a batch commit
const updateProperty = async (
  batch: any,
  nodeRef: DocumentReference,
  updatedProperty: string,
  inheritanceRef: string,
  db: any
) => {
  const updateData = {
    [`inheritance.${updatedProperty}.ref`]: inheritanceRef,
  };
  batch.update(nodeRef, updateData);
  if (batch._mutations.length > 10) {
    await batch.commit();
    batch = writeBatch(db);
  }
};

export const saveNewChangeLog = (db: any, data: NodeChange) => {
  if (!data.modifiedBy) return;
  const changeUseRef = doc(collection(db, NODES_LOGS));
  setDoc(changeUseRef, data);
  const userRef = doc(collection(db, USERS), data.modifiedBy);
  updateDoc(userRef, {
    reputations: increment(1),
    lasChangeMadeAt: new Date(),
  });
};

export const getChangeDescription = (
  log: NodeChange,
  modifiedByFullName: string
): string => {
  const {
    modifiedProperty,
    previousValue,
    newValue,
    changeType,
    modifiedAt,
    fullNode,
    changeDetails,
  } = log;

  switch (changeType) {
    case "change text":
      return `Updated "${modifiedProperty}" in:`;
    case "add collection":
      return `Added a new collection in:`;
    case "delete collection":
      return `Deleted a collection in:`;
    case "edit collection":
      return `Renamed a collection in:`;
    case "sort elements":
      return `Sorted elements under "${modifiedProperty}" in:`;
    case "remove element":
      return `Removed an element under "${modifiedProperty}" in:`;
    case "modify elements":
      return `Modified the elements in:`;
    case "add property":
      return `Added "${changeDetails?.addedProperty}" in:`;
    case "remove property":
      return `Removed "${modifiedProperty}" in:`;
    case "delete node":
      return `Deleted the node:`;
    case "add node":
      return `Added a new node titled:`;
    case "add element":
      return `Added a new ${
        modifiedProperty === "specializations"
          ? "Specialization"
          : modifiedProperty === "generalizations"
          ? "Generalization"
          : capitalizeFirstLetter(modifiedProperty || "")
      } Under:`;
    default:
      return `Made an unknown change to:`;
  }
};

export const synchronizeStuff = (
  prev: (any & { id: string })[],
  change: any
) => {
  const docType = change.type;
  const curData = change.data as any & { id: string };

  const prevIdx = prev.findIndex(
    (m: any & { id: string }) => m.id === curData.id
  );
  if (docType === "added" && prevIdx === -1) {
    prev.push(curData);
  }
  if (docType === "modified" && prevIdx !== -1) {
    prev[prevIdx] = curData;
  }

  if (docType === "removed" && prevIdx !== -1) {
    prev.splice(prevIdx, 1);
  }
  prev.sort(
    (a, b) => a.createdAt.toDate().getTime() - b.createdAt.toDate().getTime()
  );
  return prev;
};

export const getModifiedAt = (modifiedAt: any) => {
  modifiedAt = moment(modifiedAt.toDate());
  const today = moment();
  return modifiedAt.isSame(today, "day")
    ? `Today at ${modifiedAt.format("hh:mm A")}`
    : modifiedAt.format("hh:mm A DD/MM/YYYY");
};

export function randomProminentColor() {
  const prominentColors = [
    "#FF5733", // Red-Orange
    "#FFBD33", // Yellow-Orange
    "#DBFF33", // Yellow-Green
    "#75FF33", // Green
    "#33FF57", // Green-Teal
    "#33DBFF", // Teal
    "#3375FF", // Blue
    "#3357FF", // Blue-Purple
    "#8E33FF", // Purple
    "#FF33BD", // Pink
    "#FF3357", // Red
    "#808080", // Gray
  ];

  const randomIndex = Math.floor(Math.random() * prominentColors.length);

  return prominentColors[randomIndex];
}
