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
  deleteField,
  arrayUnion,
  getDocs,
  where,
  query,
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
import { DISPLAY } from "../CONSTANTS";

export const getDoerCreate = (uname: string) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `${uname}-${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
};

export const recordLogs = async (logs: { [key: string]: any }) => {
  try {
    const db = getFirestore();
    const auth = getAuth();
    const logRef = doc(collection(db, LOGS));

    const uname = auth.currentUser?.displayName;
    if (uname === "ouhrac") return;
    const doerCreate = getDoerCreate(uname || "");
    await setDoc(logRef, {
      type: "info",
      ...logs,
      createdAt: new Date(),
      doer: uname,
      operatingSystem: getOperatingSystem(),
      browser: getBrowser(),
      doerCreate,
    });
  } catch (error: any) {
    console.error(error);
    recordLogs({
      type: "error",
      error: JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack,
      }),
      at: "recordLogs",
    });
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
  uname: string,
  batch: any
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

    if (batch._committed) {
      batch = writeBatch(db);
    }
    batch.update(nodeDoc.ref, nodeData);
    if (batch._mutations.length > 400) {
      await batch.commit();
      batch = writeBatch(db);
    }
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
  return batch;
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
  try {
    let batch: any = writeBatch(db);
    // Helper to handle both generalizations and isPartOfs
    const processRemoval = async (
      references: any[],
      removeFromProperty: string,
      batch: WriteBatch
    ) => {
      let newBatch = batch;
      for (let { id: linkId } of references) {
        newBatch = await fetchAndUpdateNode(
          db,
          linkId,
          nodeData.id,
          removeFromProperty,
          uname,
          newBatch
        );
      }
      return newBatch;
    };

    // Process generalizations
    const generalizations = (nodeData?.generalizations || []).flatMap(
      (n) => n.nodes
    );
    batch = await processRemoval(generalizations, "specializations", batch);

    // Process isPartOfs
    if (Array.isArray(nodeData?.properties?.isPartOf)) {
      const isPartOfs = (nodeData?.properties?.isPartOf || []).flatMap(
        (n) => n.nodes
      );
      batch = await processRemoval(isPartOfs, "parts", batch);
    }

    // Process any additional properties in propertyOf
    if (nodeData.propertyOf) {
      for (let propertyName in nodeData.propertyOf) {
        const propertyOfElements = nodeData.propertyOf[propertyName].flatMap(
          (n) => n.nodes
        );
        batch = await processRemoval(propertyOfElements, propertyName, batch);
      }
    }
    batch.commit();
  } catch (error: any) {
    console.error(error);
    recordLogs({
      type: "error",
      error: JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack,
      }),
      at: "removeIsPartOf",
    });
  }
};

interface UpdateInheritanceParams {
  nodeId: string;
  updatedProperties: string[];
  deletedProperties?: string[];
  db: any;
}
// Function to handle inheritance
export const updateInheritance = async ({
  nodeId,
  updatedProperties,
  deletedProperties = [],
  db,
}: UpdateInheritanceParams): Promise<void> => {
  try {
    let batch: any = writeBatch(db);

    const nodeRef = doc(collection(db, NODES), nodeId);
    let ObjectUpdates = {};
    for (let property of updatedProperties) {
      ObjectUpdates = {
        ...ObjectUpdates,
        [`inheritance.${property}.ref`]: null,
      };
    }
    for (let property of deletedProperties) {
      ObjectUpdates = {
        ...ObjectUpdates,
        [`inheritance.${property}`]: deleteField(),
        [`properties.${property}`]: deleteField(),
      };
    }
    updateDoc(nodeRef, ObjectUpdates);
    const nodeDoc = await getDoc(nodeRef);
    const nodeData = nodeDoc.data();
    // Recursively update specializations
    if (nodeData) {
      batch = await recursivelyUpdateSpecializations({
        nodeId: nodeId,
        updatedProperties,
        deletedProperties,
        addedProperties: [],
        batch,
        inheritanceType: nodeData.inheritance,
        generalizationId: nodeId,
        db,
      });
    }

    // Commit all updates as a batch

    if (!batch._committed) {
      await batch.commit();
    }
  } catch (error: any) {
    recordLogs({
      type: "error",
      error: JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack,
        params: {
          nodeId,
          updatedProperties,
          deletedProperties,
        },
      }),
      at: "updateInheritance",
    });
  }
};

// Helper function to recursively update specializations
const recursivelyUpdateSpecializations = async ({
  nodeId,
  updatedProperties,
  deletedProperties,
  addedProperties,
  batch,
  inheritanceType,
  generalizationId,
  db,
  nestedCall = false,
}: {
  nodeId: string;
  updatedProperties: string[];
  deletedProperties: string[];
  addedProperties: {
    propertyName: string;
    propertyType: string;
    propertyValue: any;
  }[];
  batch: WriteBatch;
  inheritanceType: IInheritance;
  generalizationId: string | null;
  db: any;
  nestedCall?: boolean;
}): Promise<any> => {
  // Fetch node data from Firestore

  const nodeRef = doc(collection(db, NODES), nodeId);
  const nodeSnapshot = await getDoc(nodeRef);
  const nodeData = nodeSnapshot.data() as INode;
  const inheritance: IInheritance = nodeData.inheritance;
  if (nestedCall) {
    if (!nodeData) return;

    // Get the inheritance type for the updated property
    updatedProperties = updatedProperties.filter((p, index) => {
      if (inheritanceType[p].inheritanceType === "neverInherit") {
        return false;
      }

      const canInherit =
        (inheritanceType[p].inheritanceType ===
          "inheritUnlessAlreadyOverRidden" &&
          inheritance[p].ref !== null) ||
        inheritanceType[p].inheritanceType === "alwaysInherit";

      return canInherit;
    });

    deletedProperties = deletedProperties.filter((p, index) => {
      if (inheritanceType[p].inheritanceType === "neverInherit") {
        return false;
      }

      const canInherit =
        (inheritanceType[p].inheritanceType ===
          "inheritUnlessAlreadyOverRidden" &&
          !!inheritance[p]?.ref) ||
        inheritanceType[p].inheritanceType === "alwaysInherit";

      return canInherit;
    });

    batch = await updateProperty(
      batch,
      nodeRef,
      updatedProperties,
      deletedProperties,
      addedProperties,
      generalizationId,
      db
    );
  }

  let specializations = nodeData.specializations.flatMap((n) => n.nodes);

  for (const specialization of specializations) {
    batch = await recursivelyUpdateSpecializations({
      nodeId: specialization.id,
      updatedProperties,
      deletedProperties,
      addedProperties,
      batch,
      nestedCall: true,
      inheritanceType: inheritance,
      generalizationId,
      db,
    });
  }
  return batch;
};

// Function to update a property in Firestore using a batch commit
const updateProperty = async (
  batch: any,
  nodeRef: DocumentReference,
  updatedProperties: string[],
  deletedProperties: string[],
  addedProperties: {
    propertyName: string;
    propertyType: string;
    propertyValue: any;
  }[],
  inheritanceRef: string | null,
  db: any
) => {
  let ObjectUpdates = {};
  for (let property of updatedProperties) {
    ObjectUpdates = {
      ...ObjectUpdates,
      [`inheritance.${property}.ref`]: inheritanceRef,
    };
  }
  for (let property of deletedProperties) {
    ObjectUpdates = {
      ...ObjectUpdates,
      [`inheritance.${property}`]: deleteField(),
      [`properties.${property}`]: deleteField(),
      [`textValue.${property}`]: deleteField(),
      [`propertyType.${property}`]: deleteField(),
    };
  }
  for (let property of addedProperties) {
    ObjectUpdates = {
      ...ObjectUpdates,
      [`inheritance.${property.propertyName}`]: {
        inheritanceType: "inheritUnlessAlreadyOverRidden",
        ref: inheritanceRef,
      },
      [`properties.${property.propertyName}`]: property.propertyValue,
    };
    if (property.propertyType) {
      ObjectUpdates = {
        ...ObjectUpdates,
        [`propertyType.${property.propertyName}`]: property.propertyType,
      };
    }
  }
  if (batch._committed) {
    batch = writeBatch(db);
  }
  batch.update(nodeRef, ObjectUpdates);
  if (batch._mutations.length > 400) {
    await batch.commit();
    batch = writeBatch(db);
  }
  return batch;
};

export const saveNewChangeLog = (db: any, data: NodeChange) => {
  if (!data.modifiedBy || data.modifiedBy === "ouhrac") return;
  const changeUseRef = doc(collection(db, NODES_LOGS));
  setDoc(changeUseRef, data);
  const userRef = doc(collection(db, USERS), data.modifiedBy);
  updateDoc(userRef, {
    reputations: increment(1),
    lasChangeMadeAt: new Date(),
  });
  if (data.modifiedBy) {
    const nodeRef = doc(collection(db, NODES), data.nodeId);
    let updatesObject = {
      contributors: arrayUnion(data.modifiedBy),
    };
    if (data.modifiedProperty) {
      updatesObject = {
        ...updatesObject,
        [`contributorsByProperty.${data.modifiedProperty}`]: arrayUnion(
          data.modifiedBy
        ),
      };
    }
    updateDoc(nodeRef, updatesObject);
  }
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

  const displayText =
    modifiedProperty && DISPLAY[modifiedProperty]
      ? DISPLAY[modifiedProperty]
      : capitalizeFirstLetter(modifiedProperty || "");

  switch (changeType) {
    case "change text":
      return `Updated "${displayText}" in:`;
    case "add collection":
      return `Added a new collection in:`;
    case "delete collection":
      return `Deleted a collection in:`;
    case "edit collection":
      return `Renamed a collection in:`;
    case "sort elements":
      return `Sorted elements under "${displayText}" in:`;
    case "remove element":
      return `Removed an element under "${displayText}" in:`;
    case "modify elements":
      return `Added new elements "${displayText}" Under:`;
    case "add property":
      return `Added "${changeDetails?.addedProperty}" in:`;
    case "remove property":
      return `Removed "${displayText}" in:`;
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
  generalizationId: string,
  uname: string
): INode => {
  const newNode = {
    ...parentNodeData,
    createdBy: uname,
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
    numberOfGeneralizations: (parentNodeData.numberOfGeneralizations || 0) + 1,
    properties: {
      ...parentNodeData.properties,
      isPartOf: [{ collectionName: "main", nodes: [] }],
    },
    propertyType: { ...parentNodeData.propertyType },
    nodeType: parentNodeData.nodeType,
  };
  delete newNode.textValue.specializations;
  delete newNode.textValue.generalizations;
  return newNode;
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
              updatedProperties: [property],
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

export const getNewAddedProperties = (
  addedLinks: { id: string }[],
  specializationData: INode,
  nodes: { [nodeId: string]: INode }
): {
  [inheritedFromId: string]: {
    propertyName: string;
    propertyType: string;
    propertyValue: any;
  }[];
} => {
  try {
    if (!specializationData || addedLinks.length === 0) {
      return {};
    }

    const addedProperties: {
      [inheritedFromId: string]: {
        propertyName: string;
        propertyType: string;
        propertyValue: any;
      }[];
    } = {};

    for (const link of addedLinks) {
      const generalizationId = link.id;
      const generalizationData = nodes[generalizationId];

      if (generalizationData) {
        for (const property in generalizationData.properties) {
          if (!specializationData.properties.hasOwnProperty(property)) {
            const referenceTo =
              nodes[link.id].inheritance[property]?.ref || link.id;
            if (!addedProperties[referenceTo]) {
              addedProperties[referenceTo] = [];
            }
            addedProperties[referenceTo].push({
              propertyName: property,
              propertyType: generalizationData.propertyType[property],
              propertyValue: generalizationData.properties[property],
            });
          }
        }
      }
    }

    return addedProperties;
  } catch (error: any) {
    console.error(error);
    recordLogs({
      type: "error",
      error: JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack,
      }),
      at: "addNewPropertiesForInheritance",
    });
    return {};
  }
};

export const updateLinksForInheritance = async (
  db: Firestore,
  specializationId: string,
  addedLinks: { id: string }[],
  removedLinks: { id: string }[],
  specializationData: INode,
  newLinks: { id: string }[],
  nodes: { [nodeId: string]: INode }
) => {
  try {
    const deletedProperties = [];
    const updatedProperties: {
      [ref: string]: string[];
    } = {};

    const addedProperties: {
      [ref: string]: {
        propertyName: string;
        propertyType: string;
        propertyValue: any;
      }[];
    } = getNewAddedProperties(addedLinks, specializationData, nodes);

    for (let property in specializationData.inheritance) {
      const propertyRef = specializationData.inheritance[property]?.ref;
      if (!!propertyRef) {
        let canDelete = true;
        let ignore = false;
        let inheritFromId = null;
        let hasProperty = [];
        for (let link of newLinks) {
          const generalizationData = nodes[link.id];
          if (
            propertyRef === link.id ||
            propertyRef === generalizationData.inheritance[property]?.ref
          ) {
            ignore = true;
            break;
          }
          if (generalizationData.properties.hasOwnProperty(property)) {
            hasProperty.push(link.id);
          }
        }
        if (ignore) {
          continue;
        }
        if (hasProperty.length > 0) {
          canDelete = false;
          inheritFromId = hasProperty[0];
        }

        if (canDelete) {
          deletedProperties.push(property);
        } else if (inheritFromId) {
          const referenceTo =
            nodes[inheritFromId].inheritance[property]?.ref || inheritFromId;
          if (!updatedProperties[referenceTo]) {
            updatedProperties[referenceTo] = [];
          }
          updatedProperties[referenceTo].push(property);
        }
      }
    }

    let batch = writeBatch(db);

    for (let inheritedFromId in addedProperties) {
      batch = await recursivelyUpdateSpecializations({
        nodeId: specializationId,
        updatedProperties: [],
        deletedProperties,
        addedProperties: addedProperties[inheritedFromId],
        nestedCall: true,
        batch,
        inheritanceType: specializationData.inheritance,
        generalizationId: inheritedFromId,
        db,
      });
    }
    await recursivelyUpdateSpecializations({
      nodeId: specializationId,
      updatedProperties: [],
      deletedProperties,
      addedProperties: [],
      nestedCall: true,
      batch,
      inheritanceType: specializationData.inheritance,
      generalizationId: null,
      db,
    });
    for (let inheritedFromId in updatedProperties) {
      const inheritsFromData = nodes[inheritedFromId];
      batch = await recursivelyUpdateSpecializations({
        nodeId: specializationId,
        updatedProperties: updatedProperties[inheritedFromId],
        deletedProperties: [],
        addedProperties: [],
        nestedCall: true,
        batch,
        inheritanceType: inheritsFromData.inheritance,
        generalizationId: inheritedFromId,
        db,
      });
    }
    await batch.commit();
  } catch (error: any) {
    console.error(error);
    recordLogs({
      type: "error",
      error: JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack,
      }),
      at: "updateLinksForInheritance",
    });
  }
};

export const updateLinksForInheritanceSpecializations = async (
  db: Firestore,
  generalizationId: string,
  addedLinks: { id: string }[],
  removedLinks: { id: string }[],
  generalizationData: INode,
  oldLinks: { id: string }[],
  nodes: { [nodeId: string]: INode }
) => {
  try {
    const batch = writeBatch(db);
    for (let addedLink of addedLinks) {
      const addedProperties: {
        propertyName: string;
        propertyType: string;
        propertyValue: any;
      }[] = [];
      const specializationData = nodes[addedLink.id];
      for (let property in generalizationData.properties) {
        // if the specialization doesn't have the property you need to add it
        if (!specializationData.properties.hasOwnProperty(property)) {
          addedProperties.push({
            propertyName: property,
            propertyType: generalizationData.propertyType[property],
            propertyValue: generalizationData.properties[property],
          });
        }
      }

      await recursivelyUpdateSpecializations({
        nodeId: addedLink.id,
        updatedProperties: [],
        deletedProperties: [],
        addedProperties,
        nestedCall: true,
        batch,
        inheritanceType: specializationData.inheritance,
        generalizationId: generalizationId,
        db,
      });
    }

    for (let removedLink of removedLinks) {
      const deletedProperties = [];
      const specializationData = nodes[removedLink.id];
      for (let property in generalizationData.properties) {
        // if the specialization doesn't have the property you need to remove it
        const referenceProperty = specializationData.inheritance[property]?.ref;
        if (!!referenceProperty && referenceProperty === generalizationId) {
          deletedProperties.push(property);
        }
      }
      await recursivelyUpdateSpecializations({
        nodeId: removedLink.id,
        updatedProperties: [],
        deletedProperties,
        addedProperties: [],
        nestedCall: true,
        batch,
        inheritanceType: specializationData.inheritance,
        generalizationId: generalizationId,
        db,
      });
    }
    await batch.commit();
  } catch (error: any) {
    console.error(error);
    recordLogs({
      type: "error",
      error: JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack,
      }),
      at: "updateInheritanceWhenUnlinkAGeneralization",
    });
  }
};

/* when the user unlinks a generalization call this function */
export const updateInheritanceWhenUnlinkAGeneralization = async (
  db: any,
  unlinkedGeneralizationId: string,
  specializationData: INode,
  nodes: { [nodeId: string]: INode }
) => {
  try {
    if (specializationData) {
      const addedProperties: {
        propertyName: string;
        propertyType: string;
        propertyValue: any;
      }[] = [];
      const updatedProperties: {
        [ref: string]: string[];
      } = {};
      const deletedProperties = [];
      const remainingGeneralizations =
        specializationData.generalizations.flatMap((n: ICollection) => n.nodes);
      if (remainingGeneralizations.length <= 0) {
        return;
      }
      const nextGeneralization = remainingGeneralizations[0];
      const nextGeneralizationData = nodes[nextGeneralization.id];
      const unlinkedGeneralization = nodes[unlinkedGeneralizationId];

      if (nextGeneralizationData) {
        for (let property in specializationData.inheritance) {
          if (
            specializationData.inheritance[property] &&
            specializationData.inheritance[property].ref !== null &&
            (specializationData.inheritance[property].ref ===
              unlinkedGeneralizationId ||
              nodes[unlinkedGeneralizationId].inheritance[property]?.ref ===
                specializationData.inheritance[property].ref)
          ) {
            if (!nextGeneralizationData.properties.hasOwnProperty(property)) {
              let canDelete = true;
              let inheritFrom = null;
              for (let generalization of remainingGeneralizations) {
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
        for (let property in nextGeneralizationData.properties) {
          if (!specializationData.properties.hasOwnProperty(property)) {
            addedProperties.push({
              propertyName: property,
              propertyType: nextGeneralizationData.propertyType[property],
              propertyValue: nextGeneralizationData.properties[property],
            });
          }
        }
      }

      /* update the inheritance */
      let batch = writeBatch(db);
      batch = await recursivelyUpdateSpecializations({
        nodeId: specializationData.id,
        updatedProperties: [],
        deletedProperties,
        addedProperties,
        nestedCall: true,
        batch,
        inheritanceType: unlinkedGeneralization.inheritance,
        generalizationId: nextGeneralization.id,
        db,
      });

      for (let inheritFrom in updatedProperties) {
        const inheritsFromData = nodes[inheritFrom];
        await recursivelyUpdateSpecializations({
          nodeId: specializationData.id,
          updatedProperties: updatedProperties[inheritFrom],
          deletedProperties: [],
          addedProperties: [],
          nestedCall: true,
          batch,
          inheritanceType: inheritsFromData.inheritance,
          generalizationId: inheritFrom,
          db,
        });
      }
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
      at: "updateInheritanceWhenUnlinkAGeneralization",
    });
  }
};
/*  updateLinks takes links and push the new link to its specializations or generalizations */
export const updateLinks = (
  links: { id: string }[],
  newLink: { id: string },
  linkType: "specializations" | "generalizations",
  nodes: { [nodeId: string]: INode },
  db: any
) => {
  const filteredChildren = links.filter((child) => {
    const childData = nodes[child.id];
    const allLinks = [
      ...(childData?.specializations || []),
      ...(childData?.generalizations || []),
    ];

    return !allLinks.some((collection) => {
      return collection.nodes.some((node) => node.id === newLink.id);
    });
  });

  for (let child of filteredChildren) {
    const childData = nodes[child.id];
    if (!childData) continue;
    const childLinks = childData[linkType];

    const mainCollection = childLinks.find(
      (collection) => collection.collectionName === "main"
    );

    if (mainCollection) {
      mainCollection.nodes.push(newLink);
      const childRef = doc(collection(db, NODES), child.id);
      updateDoc(childRef, {
        [linkType]: childLinks,
      });
    } else {
      const newCollection = {
        collectionName: "main",
        nodes: [newLink],
      };
      childLinks.push(newCollection);
      const childRef = doc(collection(db, NODES), child.id);
      updateDoc(childRef, {
        [linkType]: childLinks,
      });
    }
  }
};
// export const updateInheritanceWhenUnlinkSpecialization = async (
//   db: any,
//   removedLinkId: string,
//   generalizationData: INode,
//   nodes: { [nodeId: string]: INode }
// ) => {
//   try {
//     const deletedProperties = [];
//     const specializationData = nodes[removedLinkId];
//     const generalizationId = generalizationData.id;
//     const remainingGeneralizations =
//       specializationData.generalizations[0].nodes.filter(
//         (g) => g.id !== generalizationId
//       );
//     const nextGeneralization = nodes[remainingGeneralizations[0].id];
//     const updatedProperties: {
//       [ref: string]: string[];
//     } = {};
//     for (let property in specializationData.inheritance) {
//       if (
//         specializationData.inheritance[property] &&
//         specializationData.inheritance[property].ref !== null &&
//         (specializationData.inheritance[property].ref === generalizationId ||
//           nodes[generalizationId].inheritance[property]?.ref ===
//             specializationData.inheritance[property].ref)
//       ) {
//         if (!nextGeneralization.properties.hasOwnProperty(property)) {
//           let canDelete = true;
//           let inheritFrom = null;
//           for (let generalization of remainingGeneralizations) {
//             const generalizationData = nodes[generalization.id];
//             if (generalizationData.properties.hasOwnProperty(property)) {
//               canDelete = false;
//               inheritFrom = generalization.id;
//               break;
//             }
//           }
//           if (canDelete) {
//             deletedProperties.push(property);
//           } else if (inheritFrom) {
//             if (!updatedProperties[inheritFrom]) {
//               updatedProperties[inheritFrom] = [];
//             }
//             updatedProperties[inheritFrom].push(property);
//           }
//         } else {
//           if (!updatedProperties[nextGeneralization.id]) {
//             updatedProperties[nextGeneralization.id] = [];
//           }
//           updatedProperties[nextGeneralization.id].push(property);
//         }
//       }
//     }
//     const batch = writeBatch(db);
//     await recursivelyUpdateSpecializations({
//       nodeId: removedLinkId,
//       updatedProperties: [],
//       deletedProperties,
//       addedProperties: [],
//       nestedCall: true,
//       batch,
//       inheritanceType: generalizationData.inheritance,
//       generalizationId: generalizationId,
//       db,
//     });
//     for (let inheritedFromId in updatedProperties) {
//       const inheritsFromData = nodes[inheritedFromId];
//       await recursivelyUpdateSpecializations({
//         nodeId: removedLinkId,
//         updatedProperties: updatedProperties[inheritedFromId],
//         deletedProperties: [],
//         addedProperties: [],
//         nestedCall: true,
//         batch,
//         inheritanceType: inheritsFromData.inheritance,
//         generalizationId: inheritedFromId,
//         db,
//       });
//     }
//     await batch.commit();
//   } catch (error) {
//     console.error(error);
//   }
// };

export const clearNotifications = async (nodeId: string) => {
  const db = getFirestore();
  if (!nodeId) return;
  const batch = writeBatch(db);
  const notificationDocs = await getDocs(
    query(collection(db, "notifications"), where("nodeId", "==", nodeId))
  );
  for (let notDoc of notificationDocs.docs) {
    batch.update(notDoc.ref, { seen: true });
  }
};
