import { IInheritance, INode } from " @components/types/INode";
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
  Firestore,
  getFirestore,
} from "firebase/firestore";
import { LOGS, NODES, NODES_LOGS, USERS } from "../firestoreClient/collections";
import { NodeChange } from " @components/types/INode";
import moment from "moment";
import { capitalizeFirstLetter } from "./string.utils";
import { User } from " @components/types/IAuth";
import {
  getBrowser,
  getOperatingSystem,
} from "../firestoreClient/errors.firestore";
import { getAuth } from "firebase/auth";

export const recordLogs = async (logs: { [key: string]: any }) => {
  try {
    const db = getFirestore();
    const auth = getAuth();
    const logRef = doc(collection(db, LOGS));
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");

    const uname = auth.currentUser?.displayName;
    const doerCreate = `${uname}-${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
    await setDoc(logRef, {
      type: "info",
      ...logs,
      createdAt: new Date(),
      doer: uname,
      operatingSystem: getOperatingSystem(),
      browser: getBrowser(),
      doerCreate,
    });
  } catch (error) {
    console.error(error);
  }
};

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

    if (
      (removeFrom === "parts" || removeFrom === "isPartOf") &&
      Array.isArray(unlinkFromData.properties[removeFrom])
    ) {
      for (let collection of unlinkFromData.properties[removeFrom]) {
        collection.nodes = collection.nodes.filter(
          (n: { id: string }) => n.id !== removeNodeId
        );
      }
      await updateDoc(unlinkFromDoc.ref, {
        [`properties.${removeFrom}`]: unlinkFromData.properties[removeFrom],
      });
    } else {
      if (
        unlinkFromData.propertyOf &&
        unlinkFromData.propertyOf[removeFrom] &&
        Array.isArray(unlinkFromData.properties[removeFrom])
      ) {
        for (let collection of unlinkFromData.propertyOf[removeFrom]) {
          collection.nodes = collection.nodes.filter(
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
  let propertyValue =
    LinkNodeData[removeFromProperty as "specializations" | "generalizations"] ||
    LinkNodeData.properties[removeFromProperty];

  // Iterate over the categories within each type of child-node.
  // If the child-node with the specified ID is found, remove it from the array.
  for (let collection of propertyValue) {
    const elementIdx = collection.nodes.findIndex(
      (link: { id: string }) => link.id === elementId
    );
    if (elementIdx !== -1) {
      collection.nodes.splice(elementIdx, 1);
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
  } catch (error: any) {
    recordLogs({
      type: "error",
      error: JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack,
      }),
      at: "updateInheritance",
    });
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
  let specializations = getFlatLinks(nodeData.specializations);

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

export const checkIfCanDeleteANode = (
  nodes: { [nodeId: string]: INode },
  specializations: any /* { id: string }[] */
) => {
  for (let specialization of specializations) {
    const generalizationsOfSpecialization =
      nodes[specialization.id].generalizations;
    let linksLength = 0;
    inner: for (let collection of generalizationsOfSpecialization) {
      if (collection.nodes.length > 1) {
        break inner;
      }
      linksLength += collection.nodes.length;
    }
    if (linksLength <= 1) {
      return false;
    }
  }
  return true;
};

export const getFlatLinks = (
  collections: { collectionName: string; nodes: { id: string }[] }[]
) => {
  const nodes = [];
  for (let collection of collections) {
    nodes.push(...collection.nodes);
  }
  return nodes;
};

export const generateInheritance = (
  inheritance: IInheritance,
  currentNodeId: string
) => {
  const newInheritance = JSON.parse(JSON.stringify({ ...inheritance }));
  for (let property in newInheritance) {
    if (!newInheritance[property].ref) {
      newInheritance[property].ref = currentNodeId;
    }
  }
  return newInheritance;
};

// Helper function to create a new node structure
export const createNewNode = (
  parentNodeData: INode,
  newNodeRefId: string,
  newTitle: string,
  inheritance: IInheritance,
  generalizationId: string
): INode => {
  return {
    ...parentNodeData,
    id: newNodeRefId,
    title: newTitle,
    inheritance,
    specializations: [],
    generalizations: [
      {
        collectionName: "main",
        nodes: [
          {
            id: generalizationId,
          },
        ],
      },
    ],
    propertyOf: {},
    locked: false,
    root: parentNodeData.root || "",
    numberOfGeneralizations: parentNodeData.numberOfGeneralizations + 1,
    properties: { ...parentNodeData.properties },
    propertyType: { ...parentNodeData.propertyType },
    nodeType: parentNodeData.nodeType,
  };
};

export const updateSpecializations = (
  parentNode: INode,
  newNodeRefId: string,
  collectionName: string = "main"
) => {
  const parentSpecialization = parentNode.specializations.find(
    (spec) => spec.collectionName === collectionName
  );
  if (!parentSpecialization) {
    // Create the collection if it doesn't exist
    parentNode.specializations.push({
      collectionName,
      nodes: [{ id: newNodeRefId }],
    });
  } else {
    // Add the new node to the collection if it exists
    parentSpecialization.nodes.push({
      id: newNodeRefId,
    });
  }
};
