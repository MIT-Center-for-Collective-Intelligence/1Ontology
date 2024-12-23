/* ## Overview

The `Node` component is a complex React component that interacts with a Firestore database to manage a hierarchical structure of nodes. It allows users to view and edit nodes, add and remove specializations, clone nodes, and handle inheritance of properties between nodes. The component also supports drag-and-drop functionality for reordering nodes within the hierarchy.

## Features

- **Viewing and Editing Nodes**: Display node information such as title and description, and allow users to edit these fields if they have the appropriate permissions.
- **specializations Management**: Add new specializations to nodes, select existing ones, and clone specializations for reuse.
- **Inheritance Handling**: Manage inherited properties from parent nodes to ensure consistency across the hierarchy.
- **Drag-and-Drop Sorting**: Reorder nodes within a category using a drag-and-drop interface.
- **Collection Management**: Add, edit, and delete categories within a node.
- **Locking Mechanism**: Implement a locking system to prevent concurrent editing conflicts.
- **Deletion of Nodes**: Safely remove nodes from the hierarchy with confirmation prompts.
- **Logging**: Record user actions for auditing and tracking changes.

## Props

- `currentVisibleNode`: The node currently being viewed or edited.
- `setCurrentVisibleNode`: Function to update the currently visible node.
- `saveChildNode`: Function to save a child node.
- `setSnackbarMessage`: Function to display a message to the user.
- `updateUserDoc`: Function to update the user document with the current node path.
- `mainSpecializations`: Object containing main specializations for the node.
- `nodes`: Array of all nodes.
- `addNewNode`: Function to add a new node to the database.
- `ontologyPath`: Array representing the current path in the node hierarchy.
- `editNode`: ID of the node being edited.
- `setEditOntology`: Function to set the ID of the node being edited.
- `lockedNodeFields`: Object containing information about which fields are locked for editing.
- `recordLogs`: Function to record user actions.
- `updateInheritance`: Function to update inheritance information for a node.

## Internal State

- `open`: Boolean state to control the visibility of the dialog for selecting specializations.
- `openAddCategory`: Boolean state to control the visibility of the dialog for adding a new category.
- `newCategory`: State to hold the name of the new category being added.
- `type`: State to hold the type of node or category being managed.
- `selectedCategory`: State to hold the currently selected category.
- `checkedSpecializations`: State to hold the IDs of selected specializations.
- `editCategory`: State to hold the category being edited.

## Functions

- `capitalizeFirstLetter`: Capitalizes the first letter of a word.
- `checkSpecialization`: Toggles the selection of a specialization.
- `cloneNode`: Clones a node and its properties.
- `getInheritance`: Retrieves inheritance information for specified fields.
- `addNewSpecialisation`: Adds a new specialization to a node.
- `showList`: Displays a list of specializations or categories for selection.
- `handleCloning`: Handles the cloning of a node.
- `handleSave`: Saves changes made to specializations or categories.
- `addCatgory`: Adds a new category to a node.
- `getCurrentSpecializations`: Retrieves the current specializations for a node.
- `handleNewSpecialization`: Handles the creation of a new specialization.
- `handleEditCategory`: Handles the editing of a category.
- `deleteCategory`: Deletes a category from a node.
- `addLock`: Adds or removes a lock on a node field.
- `handleSorting`: Handles the sorting of nodes within categories.
- `removeSubOntology`: Removes a child node from a node.
- `deleteNode`: Handles the deletion of a child node.
- `TreeViewSimplifiedForSelecting`: Renders a simplified tree view for selecting specializations.

## Usage

The `Node` component is intended to be used within an application that requires a hierarchical structure of nodes, such as an ontology management system. It should be connected to a Firestore database and requires a set of functions and state management to interact with the database and handle user actions.

## Notes

- The component relies on several external hooks and components, such as `useConfirmDialog` and `ChildNode`, which are not included in the provided code snippet.
- The `LOCKS` and `NODES` constants are assumed to be Firestore collection names.
- The `DESIGN_SYSTEM_COLORS` constant is used for styling purposes and should be defined elsewhere in the application.
- The component is designed to work with a specific data structure and may require adaptation for different use cases.

This documentation provides a high-level overview of the `Node` component and its capabilities. For detailed implementation and integration, refer to the source code and the specific application context in which the component is used.*/
import { Popover, Stack, useMediaQuery } from "@mui/material";
import { Box } from "@mui/system";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Text from "./Text";
import useConfirmDialog from " @components/lib/hooks/useConfirmDialog";
import {
  ICollection,
  ILinkNode,
  INode,
  INodeTypes,
  MainSpecializations,
} from " @components/types/INode";
import { NODES } from " @components/lib/firestoreClient/collections";
import NodeBody from "../NodBody/NodeBody";

import {
  generateUniqueTitle,
  getPropertyValue,
  getTitle,
} from " @components/lib/utils/string.utils";
import {
  checkIfCanDeleteANode,
  createNewNode,
  generateInheritance,
  recordLogs,
  updateLinksForInheritance,
  removeIsPartOf,
  saveNewChangeLog,
  unlinkPropertyOf,
  updateInheritance,
  updatePartsAndPartsOf,
  updatePropertyOf,
  updateSpecializations,
  updateLinksForInheritanceSpecializations,
  updateLinks,
  clearNotifications,
} from " @components/lib/utils/helpers";

import StructuredProperty from "../StructuredProperty/StructuredProperty";
import { NodeChange } from " @components/types/INode";
import { User } from " @components/types/IAuth";
import { NodeImageManager } from "../NodBody/NodeImageManager";
import { getStorage } from "firebase/storage";

type INodeProps = {
  currentVisibleNode: INode;
  setCurrentVisibleNode: (node: INode) => void;
  setSnackbarMessage: (message: string) => void;
  user: User;
  mainSpecializations: MainSpecializations;
  nodes: { [id: string]: INode };
  navigateToNode: (nodeId: string) => void;
  eachOntologyPath: { [key: string]: any };
  searchWithFuse: (query: string, nodeType?: INodeTypes) => INode[];
  locked: boolean;
  selectedDiffNode: NodeChange | null;
  displaySidebar: Function;
  activeSidebar: any;
  currentImprovement: any;
  setNodes: any;
  checkedItems: any;
  setCheckedItems: any;
  checkedItemsCopy: any;
  setCheckedItemsCopy: any;
  searchValue: any;
  setSearchValue: any;
  clonedNodesQueue: any;
  setClonedNodesQueue: any;
  newOnes: any;
  setNewOnes: any;
  selectedProperty: any;
  setSelectedProperty: any;
  removedElements: any;
  setRemovedElements: any;
  addedElements: any;
  setAddedElements: any;
  handleCloseAddLinksModel: any;
};

const Node = ({
  currentVisibleNode,
  setCurrentVisibleNode,
  setSnackbarMessage,
  mainSpecializations,
  nodes,
  user,
  navigateToNode,
  searchWithFuse,
  locked,
  selectedDiffNode,
  displaySidebar,
  activeSidebar,
  currentImprovement,
  eachOntologyPath,
  setNodes,
  checkedItems,
  setCheckedItems,
  checkedItemsCopy,
  setCheckedItemsCopy,
  searchValue,
  setSearchValue,
  clonedNodesQueue,
  setClonedNodesQueue,
  newOnes,
  setNewOnes,
  selectedProperty,
  setSelectedProperty,
  removedElements,
  setRemovedElements,
  addedElements,
  setAddedElements,
  handleCloseAddLinksModel,
}: INodeProps) => {
  // const [newTitle, setNewTitle] = useState<string>("");
  // const [description, setDescription] = useState<string>("");
  const isSmallScreen = useMediaQuery("(max-width: 600px)");

  const [cloning, setCloning] = useState<string | null>(null);

  const { confirmIt, ConfirmDialog } = useConfirmDialog();
  const [selectTitle, setSelectTitle] = useState(false);
  const db = getFirestore();
  const storage = getStorage();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [width, setWidth] = useState<number>(0);

  const [editableProperty, setEditableProperty] = useState<ICollection[]>([]);

  /* */
  const [glowIds, setGlowIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const element = document.getElementById("node-section");
    if (element) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
          setWidth(entry.target.clientWidth);
        }
      });

      resizeObserver.observe(element);

      return () => {
        resizeObserver.disconnect();
      };
    }
  }, []);

  const searchResultsForSelection = useMemo(() => {
    const propertyType = currentVisibleNode.propertyType[
      selectedProperty
    ] as INodeTypes;
    if (propertyType) {
      return searchWithFuse(searchValue, propertyType);
    }
    if (
      selectedProperty === "specializations" ||
      selectedProperty === "generalizations" ||
      selectedProperty === "parts" ||
      selectedProperty === "isPartOf"
    ) {
      return searchWithFuse(searchValue, currentVisibleNode.nodeType);
    }
    return [];
  }, [searchValue, selectedProperty]);

  const addACloneNodeQueue = (nodeId: string, title?: string) => {
    const newId = doc(collection(db, NODES)).id;
    const newTitle = title ? title : `New ${nodes[nodeId].title}`;
    setClonedNodesQueue(
      (prev: { [nodeId: string]: { title: string; id: string } }) => {
        prev[newId] = { title: newTitle, id: nodeId };
        return prev;
      },
    );
    setNewOnes((newOnes: any) => {
      let _oldChecked = new Set(newOnes);
      if (_oldChecked.has(newId)) {
        _oldChecked.delete(newId);
      } else {
        _oldChecked.add(newId);
      }
      return _oldChecked;
    });
    return newId;
  };

  const cloneNode = useCallback(
    async (
      nodeId: string,
      searchValue: string | null,
      newId: string | null,
      mProperty: string,
    ): Promise<INode | null> => {
      try {
        setCloning(nodeId);

        // Retrieve the document of the original node from Firestore.
        const parentNodeDoc = await getDoc(doc(collection(db, NODES), nodeId));

        // Extract data from the original node document.
        const parentNodeData = parentNodeDoc.data() as INode;

        // Create a reference for the new node document in Firestore.
        const newNodeRef =
          newId !== null
            ? doc(collection(db, NODES), newId)
            : doc(collection(db, NODES));

        let newTitle =
          searchValue !== null ? searchValue : `New ${parentNodeData.title}`;

        // Generate a unique title based on existing specializations
        const specializationsTitles = parentNodeData.specializations.flatMap(
          (collection) =>
            collection.nodes.map((spec) => nodes[spec.id]?.title || ""),
        );
        newTitle = generateUniqueTitle(newTitle, specializationsTitles);

        // Generate new inheritance structure
        const inheritance = generateInheritance(
          parentNodeData.inheritance,
          nodeId,
        );

        // Create the new node object
        const newNode = createNewNode(
          parentNodeData,
          newNodeRef.id,
          newTitle,
          inheritance,
          nodeId,
          user.uname,
        );

        // Handle specific property updates for `parts` and `isPartOf`
        if (mProperty === "parts") {
          if (
            newNode.properties.isPartOf &&
            Array.isArray(newNode.properties.isPartOf)
          ) {
            const mainIdx = newNode.properties.isPartOf.findIndex(
              (c) => c.collectionName === "main",
            );
            if (mainIdx === -1) {
              newNode.properties.isPartOf.push({
                collectionName: "main",
                nodes: [{ id: currentVisibleNode.id }],
              });
            } else {
              newNode.properties.isPartOf[mainIdx].nodes.push({
                id: currentVisibleNode.id,
              });
            }
          }
        }
        if (mProperty === "isPartOf") {
          if (
            newNode.properties.parts &&
            Array.isArray(newNode.properties.parts)
          ) {
            const mainIdx = newNode.properties.parts.findIndex(
              (c) => c.collectionName === "main",
            );
            if (mainIdx === -1) {
              newNode.properties.parts.push({
                collectionName: "main",
                nodes: [{ id: currentVisibleNode.id }],
              });
            } else {
              newNode.properties.parts[mainIdx].nodes.push({
                id: currentVisibleNode.id,
              });
            }
          }

          // Update inheritance for parts
          newNode.inheritance.parts.ref = null;
        }

        // Handle the addition of specializations or generalizations
        if (
          mProperty === "specializations" ||
          mProperty === "generalizations"
        ) {
          if (mProperty === "specializations") {
            const alreadyExistIndex =
              newNode.generalizations[0].nodes.findIndex(
                (n) => n.id === currentVisibleNode.id,
              );
            if (alreadyExistIndex === -1) {
              newNode.generalizations[0].nodes.push({
                id: currentVisibleNode.id,
              });
            }
          }

          if (mProperty === "generalizations") {
            const alreadyExistIndex =
              newNode.specializations[0].nodes.findIndex(
                (n) => n.id === currentVisibleNode.id,
              );
            if (alreadyExistIndex === -1) {
              newNode.specializations[0].nodes.push({
                id: currentVisibleNode.id,
              });
            }
          }
        } else {
          // Handling property updates
          if (newNode.inheritance[mProperty]?.ref) {
            newNode.properties[mProperty] = JSON.parse(
              JSON.stringify(
                nodes[newNode.inheritance[mProperty].ref].properties[mProperty],
              ),
            );
          }

          if (Array.isArray(newNode.properties[mProperty])) {
            const targetPropertyCollection = newNode.properties[mProperty].find(
              (collection) => collection.collectionName === "main",
            );

            // If the property collection does not exist, create it

            if (!targetPropertyCollection) {
              newNode.properties[mProperty].push({
                collectionName: "main",
                nodes: [],
              });
            }

            // Push the new node ID into the corresponding property collection
            const propertyCollectionToUpdate = newNode.properties[
              mProperty
            ].find((collection) => collection.collectionName === "main");
            propertyCollectionToUpdate?.nodes.push({ id: newNode.id });
            if (!newNode.propertyOf) {
              newNode.propertyOf = {
                [mProperty]: [{ collectionName: "main", nodes: [] }],
              };
            }
            if (!newNode.propertyOf[mProperty]) {
              newNode.propertyOf[mProperty] = [
                { collectionName: "main", nodes: [] },
              ];
            }
            newNode.propertyOf[mProperty][0].nodes.push({
              id: newNode.id,
            });

            if (newNode.inheritance[mProperty]?.ref) {
              const referencedProperty =
                nodes[newNode.inheritance[mProperty].ref].properties[mProperty];
              if (Array.isArray(referencedProperty)) {
                const links = referencedProperty.flatMap((c) => c.nodes);
                if (mProperty === "parts" || mProperty === "isPartOf") {
                  updatePartsAndPartsOf(
                    links,
                    { id: currentVisibleNode.id },
                    mProperty === "parts" ? "isPartOf" : "parts",
                    db,
                    nodes,
                  );
                } else {
                  updatePropertyOf(
                    links,
                    { id: currentVisibleNode.id },
                    mProperty,
                    nodes,
                    db,
                  );
                }
              }
            }

            if (newNode) {
              let updateObject: any = {
                [`properties.${mProperty}`]: newNode.properties[mProperty],
                [`inheritance.${mProperty}.ref`]: null,
              };
              const reference = newNode.inheritance[mProperty]?.ref;
              if (reference) {
                if (
                  nodes[reference].textValue &&
                  nodes[reference].textValue.hasOwnProperty(mProperty)
                ) {
                  updateObject = {
                    ...updateObject,
                    [`textValue.${mProperty}`]:
                      nodes[reference].textValue[mProperty],
                  };
                }
              }
            }
          }

          // Update inheritance (if needed)
          updateInheritance({
            nodeId: currentVisibleNode.id,
            updatedProperties: [mProperty],
            db,
          });
        }
        setNodes((prev: { [id: string]: INode }) => {
          prev[newNode.id] = {
            ...newNode,
            locked: false,
          };
          return prev;
        });

        // Create a new document in Firestore for the cloned node
        await setDoc(newNodeRef, {
          ...newNode,
          locked: false,
          createdAt: new Date(),
        });
        saveNewChangeLog(db, {
          nodeId: newNodeRef.id,
          modifiedBy: user?.uname,
          modifiedProperty: "",
          previousValue: null,
          newValue: null,
          modifiedAt: new Date(),
          changeType: "add node",
          fullNode: newNode,
        });

        setCloning(null);
        // Update the parent node's specializations
        updateSpecializations(parentNodeData, newNodeRef.id);

        // Update the original parent node
        await updateDoc(parentNodeDoc.ref, {
          ...parentNodeData,
          updatedAt: new Date(),
        });

        // Return the newly created node
        return newNode;
      } catch (error: any) {
        confirmIt(
          "There was an error while creating the new node, please try again",
          "OK",
          "",
        );
        console.error(error);
        recordLogs({
          type: "error",
          error: JSON.stringify({
            name: error.name,
            message: error.message,
            stack: error.stack,
          }),
          at: "saveChangeLog",
        });
        return null;
      }
    },
    [db, user.uname, nodes, currentVisibleNode.id],
  );

  // This function handles the cloning of a node.
  const handleCloning = async (
    node: { id: string },
    searchValue = null,
    newId = null,
  ) => {
    // Call the asynchronous function to clone the node with the given ID.
    // Close the modal or perform any necessary cleanup.
    // handleCloseAddLinksModel();
    await cloneNode(node.id, searchValue, newId, selectedProperty);
  };

  const editStructuredProperty = async (property: string) => {
    if (selectedProperty) {
      handleCloseAddLinksModel();
    }

    setSelectedProperty(property);

    let previousCheckedItems: string[] = [];

    // Handle specializations or generalizations
    if (property === "specializations" || property === "generalizations") {
      const _p = JSON.parse(JSON.stringify(currentVisibleNode[property]));
      setEditableProperty(_p);
      previousCheckedItems = _p
        .flatMap((l: ICollection) => l.nodes)
        .map((n: { id: string }) => n.id);
    } else {
      // Handle properties case
      let propertyCollection = currentVisibleNode.properties[property];
      const reference = currentVisibleNode.inheritance[property]?.ref || null;
      if (reference) {
        propertyCollection = nodes[reference].properties[property];
      }
      previousCheckedItems = propertyCollection
        .flatMap((l: ICollection) => l.nodes)
        .map((n: { id: string }) => n.id);

      setEditableProperty(JSON.parse(JSON.stringify(propertyCollection)));
    }
    setCheckedItems(new Set(previousCheckedItems));
    setCheckedItemsCopy(new Set(previousCheckedItems));
  };

  const selectFromTree = () => {
    if (
      ["parts", "isPartOf", "specializations", "generalizations"].includes(
        selectedProperty,
      )
    ) {
      return (
        mainSpecializations[currentVisibleNode.nodeType]?.specializations || {}
      );
    } else {
      const propertyType = currentVisibleNode.propertyType[selectedProperty];

      return mainSpecializations[propertyType]?.specializations || {};
    }
  };

  const handleSaveLinkChanges = useCallback(
    async (
      removedElements: Set<string>,
      addedElements: Set<string>,
      selectedProperty: string,
    ) => {
      try {
        if (
          (removedElements.size === 0 && addedElements.size === 0) ||
          !selectedProperty
        ) {
          return;
        }

        const addedLinks = new Array(...addedElements).map((l) => ({
          id: l,
        }));
        const removedLinks = new Array(...removedElements).map((l) => ({
          id: l,
        }));

        // Close the modal or perform any other necessary actions
        // Get the node document from the database
        const nodeDoc = await getDoc(
          doc(collection(db, NODES), currentVisibleNode.id),
        );
        let previousValue: ICollection[] | null = null;

        // If the node document does not exist, return early
        if (!nodeDoc.exists()) return;

        // Extract existing node data from the document
        const nodeData = nodeDoc.data() as INode;

        // Handle specializations or generalizations
        if (
          selectedProperty === "specializations" ||
          selectedProperty === "generalizations"
        ) {
          previousValue = JSON.parse(
            JSON.stringify(nodeData[selectedProperty]),
          );
        } else {
          if (Array.isArray(nodeData.properties[selectedProperty])) {
            previousValue = JSON.parse(
              JSON.stringify(nodeData.properties[selectedProperty]),
            );
          }
        }
        const newLinks = editableProperty.flatMap((n) => n.nodes);
        // Prevent removing all generalizations
        if (selectedProperty === "generalizations" && newLinks.length === 0) {
          await confirmIt(
            "You cannot remove all the generalizations for this node. Make sure it links to at least one generalization.",
            "Ok",
            "",
          );
          return;
        }

        for (let linkId of removedElements) {
          await unlinkPropertyOf(
            db,
            selectedProperty,
            currentVisibleNode.id,
            linkId,
          );
        }

        // Update links for specializations/generalizations
        if (
          selectedProperty === "specializations" ||
          selectedProperty === "generalizations"
        ) {
          updateLinks(
            newLinks,
            { id: currentVisibleNode.id },
            selectedProperty === "specializations"
              ? "generalizations"
              : "specializations",
            nodes,
            db,
          );
          nodeData[selectedProperty] = editableProperty;
        } else {
          nodeData.properties[selectedProperty] = editableProperty;
        }

        // Update parts/isPartOf links
        if (selectedProperty === "parts" || selectedProperty === "isPartOf") {
          updatePartsAndPartsOf(
            newLinks,
            { id: currentVisibleNode.id },
            selectedProperty === "parts" ? "isPartOf" : "parts",
            db,
            nodes,
          );
        }

        // Reset inheritance if applicable
        if (
          nodeData.inheritance &&
          !["specializations", "generalizations", "parts", "isPartOf"].includes(
            selectedProperty,
          )
        ) {
          if (nodeData.inheritance[selectedProperty]) {
            const reference = nodeData.inheritance[selectedProperty].ref;
            if (
              reference &&
              nodes[reference].textValue &&
              nodes[reference].textValue.hasOwnProperty(selectedProperty)
            ) {
              if (!nodeData.textValue) {
                nodeData.textValue = {
                  [selectedProperty]:
                    nodes[reference].textValue[selectedProperty],
                };
              } else {
                nodeData.textValue[selectedProperty] =
                  nodes[reference].textValue[selectedProperty];
              }
            }
            nodeData.inheritance[selectedProperty].ref = null;
          }
        }

        // Update other properties if applicable

        if (
          !new Set([
            "specializations",
            "generalizations",
            "parts",
            "isPartOf",
          ]).has(selectedProperty)
        ) {
          updatePropertyOf(
            newLinks,
            { id: currentVisibleNode.id },
            selectedProperty,
            nodes,
            db,
          );
        }

        // Update the node document in the database
        await updateDoc(nodeDoc.ref, nodeData);
        //the user modified generalizations
        if (selectedProperty === "generalizations") {
          await updateLinksForInheritance(
            db,
            currentVisibleNode.id,
            addedLinks,
            removedLinks,
            currentVisibleNode,
            newLinks,
            nodes,
          );
        }
        if (selectedProperty === "specializations") {
          await updateLinksForInheritanceSpecializations(
            db,
            currentVisibleNode.id,
            addedLinks,
            removedLinks,
            currentVisibleNode,
            newLinks,
            nodes,
          );
        }
        // Update inheritance for non-specialization/generalization properties
        if (
          !["specializations", "generalizations", "isPartOf"].includes(
            selectedProperty,
          )
        ) {
          updateInheritance({
            nodeId: currentVisibleNode.id,
            updatedProperties: [selectedProperty],
            db,
          });
        }

        saveNewChangeLog(db, {
          nodeId: currentVisibleNode.id,
          modifiedBy: user?.uname,
          modifiedProperty: selectedProperty,
          previousValue,
          newValue: editableProperty,
          modifiedAt: new Date(),
          changeType: "modify elements",
          fullNode: currentVisibleNode,
        });
      } catch (error: any) {
        // Handle any errors that occur during the process
        console.error(error);
        recordLogs({
          type: "error",
          error: JSON.stringify({
            name: error.name,
            message: error.message,
            stack: error.stack,
          }),
          at: "handleSaveLinkChanges",
        });
      }
    },
    [checkedItems, currentVisibleNode.id, currentVisibleNode.title, db, nodes],
  );

  //  function to handle the deletion of a Node
  const deleteNode = useCallback(async () => {
    try {
      // Confirm deletion with the user using a custom confirmation dialog

      if (!user?.uname) return;

      const specializations = currentVisibleNode.specializations.flatMap(
        (n) => n.nodes,
      );

      if (specializations.length > 0) {
        if (checkIfCanDeleteANode(nodes, specializations)) {
          await confirmIt(
            "To delete a node, you need to first delete its specializations or move them under a different generalization.",
            "Ok",
            "",
          );
          return;
        }
      }
      if (
        await confirmIt(
          `Are you sure you want to delete this Node?`,
          "Delete Node",
          "Keep Node",
        )
      ) {
        const currentNode: INode = JSON.parse(
          JSON.stringify(currentVisibleNode),
        );
        // Retrieve the document reference of the node to be deleted
        for (let collection of currentVisibleNode.generalizations) {
          if (collection.nodes.length > 0) {
            setCurrentVisibleNode(nodes[collection.nodes[0].id]);
            break;
          }
        }

        const nodeRef = doc(collection(db, NODES), currentNode.id);
        // call removeIsPartOf function to remove the node link from all the nodes where it's linked
        await removeIsPartOf(db, currentNode as INode, user?.uname);
        // Update the user document by removing the deleted node's ID
        await updateDoc(nodeRef, { deleted: true, deletedAt: new Date() });

        saveNewChangeLog(db, {
          nodeId: currentNode.id,
          modifiedBy: user?.uname,
          modifiedProperty: null,
          previousValue: null,
          newValue: null,
          modifiedAt: new Date(),
          changeType: "delete node",
          fullNode: currentNode,
        });
        // Record a log entry for the deletion action
        clearNotifications(nodeRef.id);
        recordLogs({
          action: "Deleted Node",
          node: currentVisibleNode.id,
        });
      }
    } catch (error: any) {
      // Log any errors that occur during the execution of the function
      console.error(error);
      recordLogs({
        type: "error",
        error: JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
      });
    }
  }, [currentVisibleNode.id, user?.uname, nodes, currentVisibleNode]);

  const handleToggle = useCallback(
    (nodeId: string) => {
      setExpandedNodes((prevExpanded: Set<string>) => {
        const newExpanded = new Set(prevExpanded);
        if (newExpanded.has(nodeId)) {
          newExpanded.delete(nodeId);
        } else {
          newExpanded.add(nodeId);
        }
        return newExpanded;
      });
    },
    [setExpandedNodes],
  );

  const handleLockNode = () => {
    try {
      const nodeRef = doc(collection(db, NODES), currentVisibleNode.id);
      updateDoc(nodeRef, {
        locked: !currentVisibleNode.locked,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const getTitleNode = useCallback(
    (nodeId: string) => {
      return getTitle(nodes, nodeId);
    },
    [nodes],
  );
  const onGetPropertyValue = useCallback(
    (property: string, structured: boolean = false) => {
      const inheritedProperty = getPropertyValue(
        nodes,
        currentVisibleNode.inheritance[property]?.ref,
        property,
        structured,
      );

      if (inheritedProperty !== null) {
        return inheritedProperty;
      } else {
        if (
          structured ||
          Array.isArray(currentVisibleNode.properties[property])
        ) {
          return currentVisibleNode?.textValue
            ? currentVisibleNode?.textValue[property] || ""
            : "";
        }
        return currentVisibleNode.properties[property];
      }
    },
    [currentVisibleNode, nodes],
  );
  const checkDuplicateTitle = (newTitle: string) => {
    try {
      const fuseSearch = searchWithFuse(newTitle.trim());
      return (
        fuseSearch.length > 0 &&
        fuseSearch.some(
          (s) =>
            s.title.toLowerCase().trim() === newTitle.toLowerCase().trim() &&
            currentVisibleNode.id !== s.id,
        )
      );
    } catch (error) {
      console.error(error);
    }
  };
  const getPath = useCallback(
    (nodeId: string, selectedProperty: string): Set<string> => {
      if (selectedProperty === "generalizations") {
        return new Set([nodeId]);
      }
      if (selectedProperty === "specializations") {
        return new Set(eachOntologyPath[nodeId].map((p: any) => p.id));
      }
      return new Set();
    },
    [eachOntologyPath],
  );

  /* "root": "T
  of the direct specializations of 'Act'/'Actor'/'Evaluation Dimension'/'Incentive'/'Reward'.
  The user should not be able to modify the value of this field. Please automatically specify
  it by tracing the generalizations of this descendent activity back to reach one of the direct specializations 
  of 'Act'/'Actor'/'Evaluation Dimension'/'Incentive'/'Reward'. So, obviously the root of the node 'Act'/'Actor'/'Evaluation Dimension'/'Incentive'/'Reward'
  itself and its direct specializations would be empty string because they are already roots."*/
  return (
    <Box
      sx={{
        // padding: "40px 40px 40px 40px",
        // pt: "15px",
        mb: "90px",
      }}
    >
      <Box
        sx={{
          position: "sticky",
          top: 0,
          mb: "15px",
          zIndex: 100,
          // display: "flex",
          gap: "5px",
        }}
      >
        <Text
          currentVisibleNode={currentVisibleNode}
          setCurrentVisibleNode={setCurrentVisibleNode}
          nodes={nodes}
          property={"title"}
          text={currentVisibleNode.title}
          confirmIt={confirmIt}
          setSelectTitle={setSelectTitle}
          selectTitle={selectTitle}
          locked={locked}
          selectedDiffNode={selectedDiffNode}
          getTitleNode={getTitleNode}
          root={currentVisibleNode.root}
          manageLock={!!user?.manageLock}
          deleteNode={deleteNode}
          handleLockNode={handleLockNode}
          navigateToNode={navigateToNode}
          displaySidebar={displaySidebar}
          activeSidebar={activeSidebar}
          currentImprovement={currentImprovement}
          checkDuplicateTitle={checkDuplicateTitle}
        />

        {/* {currentVisibleNode.nodeType === "context" && (
          <StructuredProperty
            selectedDiffNode={selectedDiffNode}
            confirmIt={confirmIt}
            currentVisibleNode={currentVisibleNode}
            showListToSelect={showListToSelect}
            setSelectedProperty={setSelectedProperty}
            navigateToNode={navigateToNode}
            setSnackbarMessage={setSnackbarMessage}
            setCurrentVisibleNode={setCurrentVisibleNode}
            property={"context"}
            nodes={nodes}
            locked={locked}
            onGetPropertyValue={onGetPropertyValue}
            currentImprovement={currentImprovement}
            reviewId={reviewId}
            setReviewId={setReviewId}
          />
        )} */}
      </Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          width: "100%",
        }}
      >
        {/* title of the node */}

        {/* description of the node */}
        <Text
          nodes={nodes}
          text={onGetPropertyValue("description") as string}
          currentVisibleNode={currentVisibleNode}
          property={"description"}
          setCurrentVisibleNode={setCurrentVisibleNode}
          locked={locked}
          selectedDiffNode={selectedDiffNode}
          getTitleNode={getTitleNode}
          confirmIt={confirmIt}
          currentImprovement={currentImprovement}
        />
        {/* actors of the node if it's exist */}
        {currentVisibleNode?.properties.hasOwnProperty("actor") && (
          <StructuredProperty
            selectedDiffNode={selectedDiffNode}
            confirmIt={confirmIt}
            currentVisibleNode={currentVisibleNode}
            editStructuredProperty={editStructuredProperty}
            setSelectedProperty={setSelectedProperty}
            navigateToNode={navigateToNode}
            setSnackbarMessage={setSnackbarMessage}
            setCurrentVisibleNode={setCurrentVisibleNode}
            property={"actor"}
            nodes={nodes}
            locked={locked}
            onGetPropertyValue={onGetPropertyValue}
            currentImprovement={currentImprovement}
            handleCloseAddLinksModel={handleCloseAddLinksModel}
            selectedProperty={selectedProperty}
            setSearchValue={setSearchValue}
            searchValue={searchValue}
            searchResultsForSelection={searchResultsForSelection}
            checkedItems={checkedItems}
            setCheckedItems={setCheckedItems}
            setCheckedItemsCopy={setCheckedItemsCopy}
            checkedItemsCopy={checkedItemsCopy}
            handleCloning={handleCloning}
            user={user}
            selectFromTree={selectFromTree}
            expandedNodes={expandedNodes}
            setExpandedNodes={setExpandedNodes}
            handleToggle={handleToggle}
            getPath={getPath}
            handleSaveLinkChanges={handleSaveLinkChanges}
            checkDuplicateTitle={checkDuplicateTitle}
            cloning={cloning}
            addACloneNodeQueue={addACloneNodeQueue}
            setClonedNodesQueue={setClonedNodesQueue}
            clonedNodesQueue={clonedNodesQueue}
            newOnes={newOnes}
            setNewOnes={setNewOnes}
            editableProperty={editableProperty}
            setEditableProperty={setEditableProperty}
            removedElements={removedElements}
            setRemovedElements={setRemovedElements}
            addedElements={addedElements}
            setAddedElements={setAddedElements}
            glowIds={glowIds}
            setGlowIds={setGlowIds}
          />
        )}
        {/* specializations and generalizations*/}
        <Stack
          direction={width < 1050 ? "column" : "row"}
          sx={{
            gap: 3,
          }}
        >
          {["generalizations", "specializations"].map((property, index) => (
            <StructuredProperty
              key={property + index}
              confirmIt={confirmIt}
              selectedDiffNode={selectedDiffNode}
              currentVisibleNode={currentVisibleNode}
              editStructuredProperty={editStructuredProperty}
              setSelectedProperty={setSelectedProperty}
              navigateToNode={navigateToNode}
              setSnackbarMessage={setSnackbarMessage}
              setCurrentVisibleNode={setCurrentVisibleNode}
              property={property}
              nodes={nodes}
              locked={locked}
              onGetPropertyValue={onGetPropertyValue}
              currentImprovement={currentImprovement}
              handleCloseAddLinksModel={handleCloseAddLinksModel}
              selectedProperty={selectedProperty}
              setSearchValue={setSearchValue}
              searchValue={searchValue}
              searchResultsForSelection={searchResultsForSelection}
              checkedItems={checkedItems}
              setCheckedItems={setCheckedItems}
              setCheckedItemsCopy={setCheckedItemsCopy}
              checkedItemsCopy={checkedItemsCopy}
              handleCloning={handleCloning}
              user={user}
              selectFromTree={selectFromTree}
              expandedNodes={expandedNodes}
              setExpandedNodes={setExpandedNodes}
              handleToggle={handleToggle}
              getPath={getPath}
              handleSaveLinkChanges={handleSaveLinkChanges}
              checkDuplicateTitle={checkDuplicateTitle}
              cloning={cloning}
              addACloneNodeQueue={addACloneNodeQueue}
              setClonedNodesQueue={setClonedNodesQueue}
              clonedNodesQueue={clonedNodesQueue}
              newOnes={newOnes}
              setNewOnes={setNewOnes}
              editableProperty={editableProperty}
              setEditableProperty={setEditableProperty}
              removedElements={removedElements}
              setRemovedElements={setRemovedElements}
              addedElements={addedElements}
              setAddedElements={setAddedElements}
              glowIds={glowIds}
              setGlowIds={setGlowIds}
            />
          ))}
        </Stack>
        {/* isPartOf and isPartOf*/}
        <Stack
          mt={1}
          direction={width < 1050 ? "column" : "row"}
          sx={{
            gap: 3,
          }}
        >
          {["isPartOf", "parts"].map((property, index) => (
            <StructuredProperty
              key={property + index}
              confirmIt={confirmIt}
              selectedDiffNode={selectedDiffNode}
              currentVisibleNode={currentVisibleNode}
              editStructuredProperty={editStructuredProperty}
              setSelectedProperty={setSelectedProperty}
              navigateToNode={navigateToNode}
              setSnackbarMessage={setSnackbarMessage}
              setCurrentVisibleNode={setCurrentVisibleNode}
              property={property}
              nodes={nodes}
              locked={locked}
              onGetPropertyValue={onGetPropertyValue}
              currentImprovement={currentImprovement}
              cloneNode={cloneNode}
              handleCloseAddLinksModel={handleCloseAddLinksModel}
              selectedProperty={selectedProperty}
              setSearchValue={setSearchValue}
              searchValue={searchValue}
              searchResultsForSelection={searchResultsForSelection}
              checkedItems={checkedItems}
              setCheckedItems={setCheckedItems}
              setCheckedItemsCopy={setCheckedItemsCopy}
              checkedItemsCopy={checkedItemsCopy}
              handleCloning={handleCloning}
              user={user}
              selectFromTree={selectFromTree}
              expandedNodes={expandedNodes}
              setExpandedNodes={setExpandedNodes}
              handleToggle={handleToggle}
              getPath={getPath}
              handleSaveLinkChanges={handleSaveLinkChanges}
              checkDuplicateTitle={checkDuplicateTitle}
              cloning={cloning}
              addACloneNodeQueue={addACloneNodeQueue}
              setClonedNodesQueue={setClonedNodesQueue}
              clonedNodesQueue={clonedNodesQueue}
              newOnes={newOnes}
              setNewOnes={setNewOnes}
              editableProperty={editableProperty}
              setEditableProperty={setEditableProperty}
              removedElements={removedElements}
              setRemovedElements={setRemovedElements}
              addedElements={addedElements}
              setAddedElements={setAddedElements}
              glowIds={glowIds}
              setGlowIds={setGlowIds}
            />
          ))}
        </Stack>

        {/* rest of the properties in the NodeBody*/}
        <NodeBody
          currentVisibleNode={currentVisibleNode}
          setCurrentVisibleNode={setCurrentVisibleNode}
          showListToSelect={editStructuredProperty}
          navigateToNode={navigateToNode}
          setSnackbarMessage={setSnackbarMessage}
          setSelectedProperty={setSelectedProperty}
          nodes={nodes}
          locked={locked}
          selectedDiffNode={selectedDiffNode}
          getTitleNode={getTitleNode}
          confirmIt={confirmIt}
          onGetPropertyValue={onGetPropertyValue}
          currentImprovement={currentImprovement}
          handleCloseAddLinksModel={handleCloseAddLinksModel}
          selectedProperty={selectedProperty}
          setSearchValue={setSearchValue}
          searchValue={searchValue}
          searchResultsForSelection={searchResultsForSelection}
          checkedItems={checkedItems}
          setCheckedItems={setCheckedItems}
          setCheckedItemsCopy={setCheckedItemsCopy}
          checkedItemsCopy={checkedItemsCopy}
          handleCloning={handleCloning}
          selectFromTree={selectFromTree}
          expandedNodes={expandedNodes}
          setExpandedNodes={setExpandedNodes}
          handleToggle={handleToggle}
          getPath={getPath}
          handleSaveLinkChanges={handleSaveLinkChanges}
          checkDuplicateTitle={checkDuplicateTitle}
          cloning={cloning}
          addACloneNodeQueue={addACloneNodeQueue}
          setClonedNodesQueue={setClonedNodesQueue}
          clonedNodesQueue={clonedNodesQueue}
          newOnes={newOnes}
          setNewOnes={setNewOnes}
          editableProperty={editableProperty}
          setEditableProperty={setEditableProperty}
          removedElements={removedElements}
          setRemovedElements={setRemovedElements}
          addedElements={addedElements}
          setAddedElements={setAddedElements}
          glowIds={glowIds}
          setGlowIds={setGlowIds}
        />

        {/* <NodeImageManager
          nodeId={currentVisibleNode.id}
          currentVisibleNode={currentVisibleNode}
          user={user}
          firestore={db}
          storage={storage}
          confirmIt={confirmIt}
          saveNewChangeLog={saveNewChangeLog}
          selectedDiffNode={selectedDiffNode}
        /> */}
      </Box>{" "}
      {ConfirmDialog}
    </Box>
  );
};

export default Node;
