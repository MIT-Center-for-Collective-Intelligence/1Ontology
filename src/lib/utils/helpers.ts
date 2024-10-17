import { ICollection, IInheritance, INode } from " @components/types/INode";
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
  property:
    | "parts"
    | "isPartOf"
    | "specializations"
    | "generalizations"
    | string,
  removeNodeId: string,
  removeFromId: string
) => {
  if (!removeFromId) return;

  const unlinkFromDoc = await getDoc(doc(collection(db, NODES), removeFromId));
  let removeFrom:
    | "parts"
    | "isPartOf"
    | "specializations"
    | "generalizations"
    | string = property;

  if (property === "parts") {
    removeFrom = "isPartOf";
  }
  if (property === "isPartOf") {
    removeFrom = "parts";
  }
  if (property === "specializations") {
    removeFrom = "generalizations";
  }
  if (property === "generalizations") {
    removeFrom = "specializations";
  }
  // = property === "parts" ? "isPartOf" : property;

  if (unlinkFromDoc.exists()) {
    const unlinkFromData = unlinkFromDoc.data() as INode;
    if (removeFrom === "generalizations" || removeFrom === "specializations") {
      for (let collection of unlinkFromData[removeFrom]) {
        collection.nodes = collection.nodes.filter(
          (n: { id: string }) => n.id !== removeNodeId
        );
      }
      await updateDoc(unlinkFromDoc.ref, {
        [`${removeFrom}`]: unlinkFromData[removeFrom],
      });
    } else {
      if (
        (removeFrom === "parts" || removeFrom === "isPartOf") &&
        Array.isArray(unlinkFromData.properties[removeFrom])
      ) {
        const newValue = unlinkFromData.properties[removeFrom] as ICollection[];
        for (let collection of newValue) {
          collection.nodes = collection.nodes.filter(
            (n: { id: string }) => n.id !== removeNodeId
          );
        }
        await updateDoc(unlinkFromDoc.ref, {
          [`properties.${removeFrom}`]: newValue,
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
    await updateDoc(nodeDoc.ref, nodeData);
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
  const generalizations = (nodeData?.generalizations || []).flatMap(
    (n) => n.nodes
  );
  await processRemoval(generalizations, "specializations");

  // Process isPartOfs
  if (Array.isArray(nodeData?.properties?.isPartOf)) {
    const isPartOfs = (nodeData?.properties?.isPartOf || []).flatMap(
      (n) => n.nodes
    );
    await processRemoval(isPartOfs, "parts");
  }

  // Process any additional properties in propertyOf
  if (nodeData.propertyOf) {
    for (let propertyName in nodeData.propertyOf) {
      const propertyOfElements = nodeData.propertyOf[propertyName].flatMap(
        (n) => n.nodes
      );
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
    (inheritanceType === "inheritUnlessAlreadyOverRidden" &&
      inheritance.ref !== null) ||
    inheritanceType === "alwaysInherit";

  if (nestedCall && canInherit) {
    await updateProperty(batch, nodeRef, updatedProperty, generalizationId, db);
  }

  if (inheritance?.inheritanceType === "neverInherit") {
    return;
  }
  let specializations = nodeData.specializations.flatMap((n) => n.nodes);

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
  const canDelete = specializations.some((specialization: { id: string }) => {
    const generalizationsOfSpecialization = (
      nodes[specialization.id]?.generalizations || []
    ).flatMap((n) => n.nodes);
    return generalizationsOfSpecialization.length === 1;
  });

  return canDelete;
};

export const generateInheritance = (
  inheritance: IInheritance,
  currentNodeId: string
) => {
  const newInheritance = JSON.parse(JSON.stringify({ ...inheritance }));
  for (let property in newInheritance) {
    if (!newInheritance[property].ref && property !== "isPartOf") {
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
    unclassified: false,
    id: newNodeRefId,
    title: newTitle,
    inheritance,
    specializations: [
      {
        collectionName: "main",
        nodes: [],
      },
    ],
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
    properties: {
      ...parentNodeData.properties,
      isPartOf: [{ collectionName: "main", nodes: [] }],
    },
    propertyType: { ...parentNodeData.propertyType },
    nodeType: parentNodeData.nodeType,
  };
};

export const updateSpecializations = (
  parentNode: INode,
  newNodeRefId: string,
  collectionName: string = "main"
) => {
  const collectionIdx = parentNode.specializations.findIndex(
    (spec) => spec.collectionName === collectionName
  );
  if (collectionIdx === -1) {
    // Create the collection if it doesn't exist
    parentNode.specializations.push({
      collectionName,
      nodes: [{ id: newNodeRefId }],
    });
  } else {
    // Add the new node to the collection if it exists
    parentNode.specializations[collectionIdx].nodes.push({
      id: newNodeRefId,
    });
  }
};

export const updatePartsAndPartsOf = async (
  links: { id: string }[],
  newLink: { id: string },
  property: "isPartOf" | "parts",
  db: Firestore,
  nodes: { [nodeId: string]: INode }
) => {
  debugger;
  links.forEach(async (child) => {
    let childData: any = nodes[child.id] as INode;
    if (!childData) {
      const childDoc = await getDoc(doc(collection(db, NODES), child.id));
      childData = childDoc.data();
    }

    if (childData && Array.isArray(childData.properties[property])) {
      const propertyData = childData.properties[property] as ICollection[];
      const existingIds = propertyData.flatMap((collection) =>
        collection.nodes.map((spec) => spec.id)
      );
      if (!existingIds.includes(newLink.id)) {
        const propertyData = childData.properties[property];
        if (Array.isArray(propertyData)) {
          const mainCollection = propertyData.find(
            (collection) => collection.collectionName === "main"
          ) as ICollection;
          // Add the new link to the property data
          const linkIdx = mainCollection.nodes.findIndex(
            (l) => l.id === newLink.id
          );
          if (linkIdx === -1) {
            mainCollection.nodes.push(newLink);
          }

          const childRef = doc(collection(db, NODES), child.id);
          updateDoc(childRef, {
            [`properties.${property}`]: propertyData,
          });

          // Update inheritance if the property is "parts"
          if (property === "parts") {
            updateInheritance({
              nodeId: child.id,
              updatedProperty: property,
              db,
            });
          }
        }
      }
    }
  });
};

export const updatePropertyOf = async (
  links: { id: string }[],
  newLink: { id: string },
  property: string,
  nodes: { [nodeId: string]: INode },
  db: Firestore
) => {
  links.filter((child) => {
    const childData = nodes[child.id];
    if (!childData.propertyOf) {
      childData.propertyOf = {};
    }
    const propertyData = childData.propertyOf[property] || [
      { collectionName: "main", nodes: [] },
    ];
    const mainCollection = propertyData.find(
      (collection) => collection.collectionName === "main"
    );
    const existingIds = mainCollection
      ? mainCollection.nodes.map((node) => node.id)
      : [];

    if (!existingIds.includes(newLink.id)) {
      const childData = nodes[child.id];
      if (!childData.propertyOf) {
        childData.propertyOf = {};
      }

      const propertyData = childData.propertyOf[property] || [
        { collectionName: "main", nodes: [] },
      ];
      const mainCollection = propertyData.find(
        (collection) => collection.collectionName === "main"
      );
      if (mainCollection) {
        mainCollection.nodes.push(newLink);

        const childRef = doc(collection(db, NODES), child.id);
        updateDoc(childRef, {
          [`propertyOf.${property}`]: propertyData,
        });
      }
    }
  });
};
