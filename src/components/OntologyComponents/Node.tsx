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
import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  FormControl,
  IconButton,
  InputLabel,
  Link,
  ListItem,
  MenuItem,
  Modal,
  Paper,
  Select,
  Stack,
  TextField,
  Theme,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import Dialog from "@mui/material/Dialog";
import { Box } from "@mui/system";
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Text from "./Text";
import useConfirmDialog from " @components/lib/hooks/useConfirmDialog";
import { DESIGN_SYSTEM_COLORS } from " @components/lib/theme/colors";
import {
  ILockedNode,
  INode,
  MainSpecializations,
} from " @components/types/INode";
import { NODES } from " @components/lib/firestoreClient/collections";
import { DISPLAY, SCROLL_BAR_STYLE } from " @components/lib/CONSTANTS";
import TreeViewSimplified from "./TreeViewSimplified";
import { SearchBox } from "../SearchBox/SearchBox";
import NodeBody from "../NodBody/NodeBody";

import {
  capitalizeFirstLetter,
  generateUniqueTitle,
  getPropertyValue,
  getTitle,
} from " @components/lib/utils/string.utils";
import LockIcon from "@mui/icons-material/Lock";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import {
  removeIsPartOf,
  saveNewChange,
  unlinkPropertyOf,
  updateInheritance,
} from " @components/lib/utils/helpers";

import StructuredProperty from "../StructuredProperty/StructuredProperty";
import { NodeChange } from " @components/types/INode";

type INodeProps = {
  scrolling: any;
  currentVisibleNode: INode;
  setCurrentVisibleNode: (node: INode) => void;
  setSnackbarMessage: (message: string) => void;
  user: any;
  mainSpecializations: MainSpecializations;
  nodes: { [id: string]: INode };
  addNewNode: ({ id, newNode }: { id: string; newNode: any }) => void;
  lockedNodeFields: ILockedNode;
  recordLogs: (logs: any) => void;
  navigateToNode: (nodeId: string) => void;
  eachOntologyPath: { [key: string]: any };
  searchWithFuse: any;
  locked: boolean;
  selectedDiffNode: NodeChange | null;
  displayInheritanceSettings: any;
  displayNodeChat: any;
  displayNodeHistory: any;
  activeSidebar: any;
};

const Node = ({
  scrolling,
  currentVisibleNode,
  setCurrentVisibleNode,
  setSnackbarMessage,
  mainSpecializations,
  nodes,
  addNewNode,
  user,
  recordLogs,
  navigateToNode,
  searchWithFuse,
  locked,
  selectedDiffNode,
  displayInheritanceSettings,
  displayNodeChat,
  displayNodeHistory,
  activeSidebar,
}: INodeProps) => {
  // const [newTitle, setNewTitle] = useState<string>("");
  // const [description, setDescription] = useState<string>("");
  const isSmallScreen = useMediaQuery("(max-width: 600px)");

  const [openSelectModel, setOpenSelectModel] = useState(false);
  const handleClose = () => {
    setCheckedItems(new Set());
    setOpenSelectModel(false);
    setSelectedCategory("");
  };
  const [openAddCategory, setOpenAddCategory] = useState(false);
  const handleCloseAddCollection = () => {
    setSelectedProperty("");
    setNewCollection("");
    setOpenAddCategory(false);
    setEditCategory(null);
  };
  const [newCollection, setNewCollection] = useState("");
  const [selectedProperty, setSelectedProperty] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [editCollection, setEditCategory] = useState<{
    property: string;
    category: string;
  } | null>(null);
  const { confirmIt, ConfirmDialog } = useConfirmDialog();

  const [searchValue, setSearchValue] = useState("");
  const [newFieldType, setNewFieldType] = useState("String");
  const [openAddProprety, setOpenAddProperty] = useState(false);
  const [newFieldTitle, setNewProperty] = useState("");
  const [selectTitle, setSelectTitle] = useState(false);

  const [reviewId, setReviewId] = useState("");
  const db = getFirestore();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [width, setWidth] = useState<number>(0);

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
    const propertyType =
      currentVisibleNode.propertyType[selectedProperty] || "";
    return searchWithFuse(searchValue, propertyType);
  }, [searchValue, selectedProperty]);

  const markItemAsChecked = (checkedId: string) => {
    setCheckedItems((oldChecked: Set<string>) => {
      const _oldChecked = new Set(oldChecked);

      if (_oldChecked.has(checkedId)) {
        _oldChecked.delete(checkedId);
      } else {
        _oldChecked.add(checkedId);
      }
      return _oldChecked;
    });
  };

  const cloneNode = useCallback(
    async (nodeId: string): Promise<INode | null> => {
      try {
        // Retrieve the document of the original node from Firestore.
        const parentNodeDoc = await getDoc(doc(collection(db, NODES), nodeId));

        // Extract data from the original node document.
        const parentNodeData = parentNodeDoc.data() as INode;

        // Create a reference for the new node document in Firestore.
        const newNodeRef = doc(collection(db, NODES));
        let newTitle = `New ${parentNodeData.title}`;
        const specializationsTitles = Object.values(
          parentNodeData.specializations
        )
          .flat()
          .map((spec) => nodes[spec.id].title);
        newTitle = generateUniqueTitle(newTitle, specializationsTitles);

        // Prepare the data for the new node by copying existing data.
        const newNode: any = {
          ...parentNodeDoc.data(),
          id: newNodeRef.id,
          title: newTitle,
          specializations: { main: [] },
          propertyOf: {
            [selectedProperty]: {
              main: [
                {
                  id: currentVisibleNode.id!,
                },
              ],
            },
          },
          generalizations: {
            main: [
              {
                id: nodeId,
              },
            ],
          },
          locked: false,
        };

        if (!parentNodeData?.specializations.hasOwnProperty("main")) {
          parentNodeData.specializations["main"] = [];
        }
        parentNodeData?.specializations["main"].push({
          id: newNodeRef.id,
        });
        // // Create a new document in Firestore for the cloned node with the modified data.
        await setDoc(newNodeRef, {
          ...newNode,
          locked: false,
          createdAt: new Date(),
        });

        // Update the original node document in Firestore with the modified data.
        updateDoc(parentNodeDoc.ref, {
          ...parentNodeData,
          updatedAt: new Date(),
        });

        // Return the ID of the newly created node.
        return newNode;
      } catch (error) {
        // Log any errors that occur during the cloning process.
        confirmIt(
          "There was an error while creating the new node, please try again",
          "OK",
          ""
        );
        console.error(error);
        return null;
      }
    },
    [currentVisibleNode.id, selectedProperty, nodes]
  );

  // Function to add a new specialization to the node
  const addNewSpecialization = useCallback(
    async (category: string = "main", searchValue: string = "") => {
      try {
        if (!category) {
          category = "main";
        }

        // Get a reference to the parent node document
        const nodeParentRef = doc(collection(db, NODES), currentVisibleNode.id);

        // Retrieve the parent node document
        const nodeParentData = nodes[currentVisibleNode.id];

        // Extract data from the parent node document
        const parentNode = {
          ...nodeParentData,
          id: currentVisibleNode.id,
        } as INode;

        // Create a new node document reference
        const newNodeRef = doc(collection(db, NODES));
        const inheritance = JSON.parse(
          JSON.stringify({ ...parentNode.inheritance })
        );
        for (let property in inheritance) {
          if (!inheritance[property].ref) {
            inheritance[property].ref = currentVisibleNode.id;
          }
        }
        // Clone the parent node data
        // Check if the specified type and category exist in the parent node
        let newTitle = searchValue ? searchValue : `New ${parentNode.title}`;
        const specializationsTitles = Object.values(parentNode.specializations)
          .flat()
          .map((spec) => nodes[spec.id].title);
        newTitle = generateUniqueTitle(newTitle, specializationsTitles);
        const newNode = {
          ...nodeParentData,
          // Initialize the specializations sub-node
          specializations: { main: [] },
          inheritance,
          comments: [],
          // Set the parents and title for the new node
          generalizations: {
            main: [
              {
                id: currentVisibleNode.id,
                title: currentVisibleNode.title,
              },
            ],
          },
          propertyOf: {},
          root: parentNode.root || "",
          title: newTitle,
          id: newNodeRef.id,
        };

        if ("locked" in newNode) {
          delete newNode.locked;
        }

        // Generate a unique title based on the existing ones
        newTitle = generateUniqueTitle(newTitle, specializationsTitles);
        if (!parentNode.specializations.hasOwnProperty(category)) {
          // If not, create the specified type and category
          parentNode.specializations = {
            ...parentNode.specializations,
            [category]: [
              {
                id: newNodeRef.id,
              },
            ],
          };
        } else {
          // Add the new node to the specified type and category
          parentNode.specializations[category].push({
            id: newNodeRef.id,
          });
        }

        // Add the new node to the database
        addNewNode({ id: newNodeRef.id, newNode });

        setReviewId(newNodeRef.id);

        // scrollToTop();
        // setSelectTitle(true);
        // Update the parent node document in the database
        setOpenSelectModel(false);
        await updateDoc(nodeParentRef, parentNode);
      } catch (error) {
        // Handle errors by logging to the console
        confirmIt("Sorry there was an Error please try again!", "Ok", "");
        console.error(error);
      }
    },
    [
      addNewNode,
      confirmIt,
      currentVisibleNode.id,
      currentVisibleNode.root,
      currentVisibleNode.title,
      db,
    ]
  );

  const showListToSelect = async (property: string, category: string) => {
    setOpenSelectModel(true);
    setSelectedProperty(property);
    setSelectedCategory(category);
    let previousCheckedItems = [];
    if (property === "specializations" || property === "generalizations") {
      previousCheckedItems = (
        (currentVisibleNode[property] || {})[category] || []
      ).map((link: { id: string }) => link.id);
    } else {
      previousCheckedItems = (
        (currentVisibleNode.properties[property] || {})[category] || []
      ).map((link: { id: string }) => link.id);
    }
    setCheckedItems(new Set(previousCheckedItems));
  };

  const selectFromTree = () => {
    if (
      ["parts", "isPartOf", "specializations", "generalizations"].includes(
        selectedProperty
      )
    ) {
      return (
        mainSpecializations[
          getTitle(nodes, currentVisibleNode.root).toLowerCase()
        ]?.specializations || {}
      );
    } else {
      const propertyType = currentVisibleNode.propertyType[selectedProperty];

      return (
        mainSpecializations[
          propertyType === "evaluationDimension"
            ? "evaluation dimension"
            : propertyType
        ]?.specializations || {}
      );
    }
  };

  // This function handles the cloning of an node.
  const handleCloning = async (node: { id: string }) => {
    // Call the asynchronous function to clone the node with the given ID.
    const newNode = await cloneNode(node.id);
    if (!newNode) return;
    const nodeData = nodes[currentVisibleNode.id];
    const nodeRef = doc(collection(db, NODES), currentVisibleNode.id);

    if (
      selectedProperty === "specializations" ||
      selectedProperty === "generalizations"
    ) {
      nodeData[selectedProperty][selectedCategory || "main"].push({
        id: newNode.id,
      });

      updateDoc(nodeRef, {
        [`${selectedProperty}`]: nodeData[selectedProperty],
      });
    } else {
      if (nodeData.inheritance[selectedProperty].ref) {
        nodeData.properties[selectedProperty] = JSON.parse(
          JSON.stringify(
            nodes[nodeData.inheritance[selectedProperty].ref].properties[
              selectedProperty
            ]
          )
        );
      }
      nodeData.properties[selectedProperty][selectedCategory || "main"].push({
        id: newNode.id,
      });
      updateDoc(nodeRef, {
        [`properties.${selectedProperty}`]:
          nodeData.properties[selectedProperty],
        [`inheritance.${selectedProperty}.ref`]: null,
      });
      updateInheritance({
        nodeId: currentVisibleNode.id,
        updatedProperty: selectedProperty,
        db,
      });
    }

    scrollToTop();
    setSelectTitle(true);
    setCurrentVisibleNode(newNode);

    // Close the modal or perform any necessary cleanup.
    handleClose();
  };

  const updateLinks = (
    children: { id: string }[],
    newLink: { id: string },
    linkType: "specializations" | "generalizations"
  ) => {
    for (let child of children) {
      const childData = nodes[child.id];
      const links = childData[linkType];
      const existingLinks = Object.values(links).flat();
      const index = existingLinks.findIndex((e: any) => e.id === newLink.id);

      if (index === -1) {
        links["main"].push(newLink);
        const childRef = doc(collection(db, NODES), child.id);
        updateDoc(childRef, {
          [linkType]: links,
        });
      }
    }
  };

  const updatePropertyOf = async (
    children: { id: string; title: string }[],
    newLink: { id: string },
    property: string
  ) => {
    for (let child of children) {
      const childData = nodes[child.id];
      if (!childData.propertyOf) {
        childData.propertyOf = {};
      }
      const propertyData: { [key: string]: { id: string }[] } = childData
        .propertyOf[property] || { main: [] };

      const keys = Object.values(propertyData).flat();
      const index = keys.findIndex((e: any) => e.id === newLink.id);
      if (index === -1) {
        propertyData["main"].push(newLink);
        const childRef = doc(collection(db, NODES), child.id);
        await updateDoc(childRef, {
          [`propertyOf.${property}`]: propertyData,
        });
      }
    }
  };

  const updatePartsAndPartsOf = async (
    children: { id: string }[],
    newLink: { id: string },
    property: "isPartOf" | "parts"
  ) => {
    for (let child of children) {
      const childData = nodes[child.id];
      const propertyData = childData.properties[property];

      const keys = Object.values(propertyData).flat();
      const index = keys.findIndex((e: any) => e.id === newLink.id);
      if (index === -1) {
        propertyData["main"].push(newLink);
        const childRef = doc(collection(db, NODES), child.id);
        await updateDoc(childRef, {
          [`properties.${property}`]: propertyData,
        });
        if (property === "parts") {
          updateInheritance({
            nodeId: child.id,
            updatedProperty: property,
            db,
          });
        }
      }
    }
  };

  const handleSaveLinkChanges = useCallback(async () => {
    try {
      // Close the modal or perform any other necessary actions
      handleClose();
      // Get the node document from the database
      const nodeDoc = await getDoc(
        doc(collection(db, NODES), currentVisibleNode.id)
      );
      let previousValue = null;
      let newValue = null;

      // If the node document does not exist, return early
      if (!nodeDoc.exists()) return;

      // Extract existing node data from the document
      const nodeData: any = nodeDoc.data();

      // Initialize a new array for storing updated children
      let oldLinks = [];
      let allLinks: any = [];

      if (
        selectedProperty === "specializations" ||
        selectedProperty === "generalizations"
      ) {
        oldLinks = [...nodeData[selectedProperty][selectedCategory]];
        allLinks = Object.values(nodeData[selectedProperty]).flat();

        previousValue = JSON.parse(JSON.stringify(nodeData[selectedProperty]));
      } else {
        oldLinks = [
          ...((nodeData.properties[selectedProperty] || {})[selectedCategory] ||
            []),
        ];
        allLinks = Object.values(nodeData.properties[selectedProperty]).flat();
        previousValue = JSON.parse(
          JSON.stringify(nodeData.properties[selectedProperty])
        );
      }

      // Iterate through checkedItems to add new children
      checkedItems.forEach((checked) => {
        // Check if the node is not already present in oldChildren
        const indexFound = allLinks.findIndex(
          (link: { id: string }) => link.id === checked
        );

        if (indexFound === -1) {
          // Add the node to oldChildren if not present
          oldLinks.push({
            id: checked,
          });
        }
      });

      // Filter out any children that are not in the checkedItems array
      const removedLinks = oldLinks.filter(
        (link) => !checkedItems.has(link.id)
      );

      oldLinks = oldLinks.filter((link) => checkedItems.has(link.id));

      // Prevent removing all generalizations
      if (selectedProperty === "generalizations" && oldLinks.length === 0) {
        await confirmIt(
          "You cannot remove all the generalizations for this node. Make sure it at least links to one generalization.",
          "Ok",
          ""
        );
        return;
      }
      if (
        selectedProperty !== "specializations" &&
        selectedProperty !== "generalizations"
      ) {
        for (let link of removedLinks) {
          unlinkPropertyOf(
            db,
            selectedProperty,
            currentVisibleNode.id,
            link.id
          );
        }
      }
      // Update the node data with the new children
      if (
        selectedProperty === "specializations" ||
        selectedProperty === "generalizations"
      ) {
        nodeData[selectedProperty][selectedCategory] = oldLinks;
        newValue = JSON.parse(JSON.stringify(nodeData[selectedProperty]));
      } else {
        nodeData.properties[selectedProperty][selectedCategory] = oldLinks;
        newValue = JSON.parse(
          JSON.stringify(nodeData.properties[selectedProperty])
        );
      }

      // Update links for specializations/generalizations
      if (
        selectedProperty === "specializations" ||
        selectedProperty === "generalizations"
      ) {
        updateLinks(
          Object.values(oldLinks).flat(),
          {
            id: currentVisibleNode.id,
          },
          selectedProperty === "specializations"
            ? "generalizations"
            : "specializations"
        );
      }

      // Update parts/isPartOf links
      if (selectedProperty === "parts" || selectedProperty === "isPartOf") {
        updatePartsAndPartsOf(
          Object.values(oldLinks).flat(),
          {
            id: currentVisibleNode.id,
          },
          selectedProperty === "parts" ? "isPartOf" : "parts"
        );
      }

      // Reset inheritance if applicable
      if (
        nodeData.inheritance &&
        selectedProperty !== "specializations" &&
        selectedProperty !== "generalizations" &&
        selectedProperty !== "parts" &&
        selectedProperty !== "isPartOf" &&
        nodeData.inheritance[selectedProperty]
      ) {
        nodeData.inheritance[selectedProperty].ref = null;
        nodeData.inheritance[selectedProperty].title = "";
      }

      // Update other properties if applicable
      if (
        selectedProperty !== "specializations" &&
        selectedProperty !== "generalizations" &&
        selectedProperty !== "parts" &&
        selectedProperty !== "isPartOf"
      ) {
        updatePropertyOf(
          Object.values(oldLinks).flat(),
          {
            id: currentVisibleNode.id,
          },
          selectedProperty
        );
      }

      // Update the node document in the database
      await updateDoc(nodeDoc.ref, nodeData);

      // saveNewChange(db, {
      //   nodeId: currentVisibleNode.id,
      //   modifiedBy: user?.uname,
      //   modifiedProperty: property,
      //   previousValue,
      //   newValue,
      //   modifiedAt: new Date(),
      //   changeType: "change text",
      //   fullNode: currentVisibleNode,
      // });
      // Update inheritance for non-specialization/generalization properties
      if (
        selectedProperty !== "specializations" &&
        selectedProperty !== "generalizations" &&
        selectedProperty !== "isPartOf"
      ) {
        updateInheritance({
          nodeId: currentVisibleNode.id,
          updatedProperty: selectedProperty,
          db,
        });
      }
      saveNewChange(db, {
        nodeId: currentVisibleNode.id,
        modifiedBy: user?.uname,
        modifiedProperty: selectedProperty,
        previousValue,
        newValue,
        modifiedAt: new Date(),
        changeType: "remove element",
        fullNode: currentVisibleNode,
      });
    } catch (error) {
      // Handle any errors that occur during the process
      console.error(error);
      recordLogs({
        type: "error",
        error,
      });
    }
  }, [
    checkedItems,
    currentVisibleNode.id,
    currentVisibleNode.title,
    db,
    nodes,
    selectedCategory,
    selectedProperty,
  ]);

  const addNewCollection = useCallback(async () => {
    try {
      // Check if newCategory is provided
      handleCloseAddCollection();
      if (!newCollection) return;
      let previousValue = null;
      let changeType: "add collection" | "edit collection" = "edit collection";
      // Fetch the node document based on the currentVisibleNode.id
      const nodeDoc = await getDoc(
        doc(collection(db, NODES), currentVisibleNode.id)
      );

      // Check if the node document exists
      if (nodeDoc.exists()) {
        // Retrieve node data from the document
        const nodeData = nodeDoc.data();

        // If editCategory is provided, update existing category
        if (editCollection) {
          previousValue = JSON.parse(
            JSON.stringify(nodeData[editCollection.property])
          );
          changeType = "edit collection";
          // Log the action of editing a category
          recordLogs({
            action: "Edited a category",
            previousValue: editCollection.category,
            newValue: newCollection,
            node: nodeDoc.id,
            property: editCollection.property,
          });
          if (
            editCollection.property === "specializations" ||
            editCollection.property === "specializations"
          ) {
            // Update ontologyData for the edited category
            nodeData[editCollection.property][newCollection] =
              nodeData[editCollection.property][editCollection.category];
            delete nodeData[editCollection.property][editCollection.category];
          } else {
            // Update ontologyData for the edited category
            nodeData.properties[editCollection.property][newCollection] =
              nodeData.properties[editCollection.property][
                editCollection.category
              ];
            delete nodeData.properties[editCollection.property][
              editCollection.category
            ];
          }
        } else {
          // If it's a new category, create it
          changeType = "add collection";

          if (
            !nodeData?.properties[selectedProperty]?.hasOwnProperty(
              newCollection.trim()
            )
          ) {
            if (
              selectedProperty === "specializations" ||
              selectedProperty === "specializations"
            ) {
              previousValue = JSON.parse(
                JSON.stringify(nodeData[selectedProperty])
              );
              nodeData[selectedProperty] = {
                ...(nodeData[selectedProperty] || {}),
                [newCollection]: [],
              };
            } else {
              previousValue = JSON.parse(
                JSON.stringify(nodeData.properties[selectedProperty])
              );
              nodeData.properties[selectedProperty] = {
                ...(nodeData?.properties[selectedProperty] || {}),
                [newCollection]: [],
              };
            }

            // Log the action of creating a new category
            recordLogs({
              action: "add collection",
              category: newCollection,
              node: nodeDoc.id,
              field: selectedProperty,
            });
          } else {
            if (editCollection !== null) {
              confirmIt(
                `This category already exist under the property ${selectedProperty}`,
                "Ok",
                ""
              );
            }

            return;
          }
        }
        if (
          selectedProperty !== "specializations" ||
          selectedProperty !== "specializations"
        ) {
          updateInheritance({
            nodeId: nodeDoc.id,
            updatedProperty: editCollection
              ? editCollection.property
              : selectedProperty,
            db,
          });
        }
        // Update the node document with the modified data
        await updateDoc(nodeDoc.ref, nodeData);

        saveNewChange(db, {
          nodeId: currentVisibleNode.id,
          modifiedBy: user?.uname,
          modifiedProperty: selectedProperty,
          previousValue,
          newValue: nodeData.properties[selectedProperty],
          modifiedAt: new Date(),
          changeType,
          fullNode: currentVisibleNode,
        });
      }
    } catch (error) {
      // Log any errors that occur during the process
      console.error(error);
      recordLogs({
        type: "error",
        error,
      });
    }
  }, [newCollection]);

  const handleNewSpecialization = async (category?: string) => {
    await addNewSpecialization(category || selectedCategory);
    handleClose();
  };

  const handleEditCategory = (property: string, category: string) => {
    setNewCollection(category);
    setOpenAddCategory(true);
    setEditCategory({
      property,
      category,
    });
  };

  const deleteCollection = async (property: string, category: string) => {
    if (
      await confirmIt(
        `Are you sure you want to delete the collection ${category}?`,
        "Delete Collection",
        "Keep Collection"
      )
    ) {
      try {
        const nodeDoc = await getDoc(
          doc(collection(db, NODES), currentVisibleNode.id)
        );
        if (nodeDoc.exists()) {
          let previousValue = null;
          const nodeData = nodeDoc.data();
          if (
            property === "specializations" ||
            property === "specializations"
          ) {
            previousValue = JSON.parse(JSON.stringify(nodeData[property]));
            nodeData[property]["main"] = [
              ...(nodeData[property]["main"] || []),
              ...nodeData[property][category],
            ];
            delete nodeData[property][category];
          } else {
            nodeData.properties[property]["main"] = [
              ...(nodeData.properties[property]["main"] || []),
              ...nodeData.properties[property][category],
            ];
            delete nodeData.properties[property][category];
          }

          await updateDoc(nodeDoc.ref, nodeData);
          recordLogs({
            action: "Deleted a category",
            category,
            node: nodeDoc.id,
          });
          saveNewChange(db, {
            nodeId: currentVisibleNode.id,
            modifiedBy: user?.uname,
            modifiedProperty: property,
            previousValue,
            newValue: nodeData.properties[property],
            modifiedAt: new Date(),
            changeType: "delete collection",
            fullNode: currentVisibleNode,
          });
        }
      } catch (error) {
        recordLogs({
          type: "error",
          error,
        });
      }
    }
  };

  // Function to handle sorting of draggable items
  const handleSorting = useCallback(
    async (result: any, property: string) => {
      try {
        // Destructure properties from the result object
        const { source, destination, draggableId, type } = result;
        let previousValue = null;
        // If there is no destination, no sorting needed
        if (!destination) {
          return;
        }

        // Extract the source and destination category IDs
        const sourceCategory = source.droppableId; // The source category
        const destinationCategory = destination.droppableId; // The destination category

        // Ensure valid source and destination categories and they are not the same
        if (sourceCategory && destinationCategory) {
          // Retrieve node document from the anodes object
          const nodeData = { ...currentVisibleNode };
          if (
            property !== "specializations" &&
            property !== "generalizations" &&
            nodeData.inheritance &&
            nodeData.inheritance[property].ref
          ) {
            const nodeId = nodeData.inheritance[property].ref;
            const inheritedNode = nodes[nodeId as string];
            nodeData.properties[property] = JSON.parse(
              JSON.stringify(inheritedNode.properties[property])
            );
          }

          // Ensure nodeData exists
          if (nodeData) {
            let propertyValue: any = null;
            if (
              property === "specializations" ||
              property === "generalizations"
            ) {
              // Get the children and specializations related to the provided subType
              previousValue = JSON.parse(JSON.stringify(nodeData[property]));
              propertyValue = nodeData[property];
            } else {
              propertyValue = nodeData.properties[property];
              previousValue = JSON.parse(
                JSON.stringify(nodeData.properties[property])
              );
            }

            // Find the index of the draggable item in the source category
            const nodeIdx = propertyValue[sourceCategory].findIndex(
              (onto: any) => onto.id === draggableId
            );

            // If the draggable item is found in the source category
            if (nodeIdx !== -1) {
              const moveValue = propertyValue[sourceCategory][nodeIdx];

              // Remove the item from the source category
              propertyValue[sourceCategory].splice(nodeIdx, 1);

              // Move the item to the destination category
              propertyValue[destinationCategory].splice(
                destination.index,
                0,
                moveValue
              );

              setCurrentVisibleNode(nodeData);
            }
            // Update the nodeData with the new property values
            const nodeRef = doc(collection(db, NODES), currentVisibleNode.id);
            if (
              property === "specializations" ||
              property === "generalizations"
            ) {
              updateDoc(nodeRef, {
                [property]: propertyValue,
              });
            } else {
              if (nodeData.inheritance) {
                nodeData.inheritance[property].ref = null;
              }
              updateDoc(nodeRef, {
                [`properties.${property}`]: propertyValue,
                [`inheritance.${property}.ref`]: null,
              });
              updateInheritance({
                nodeId: currentVisibleNode.id,
                updatedProperty: property,
                db,
              });
            }

            saveNewChange(db, {
              nodeId: currentVisibleNode.id,
              modifiedBy: user?.uname,
              modifiedProperty: property,
              previousValue,
              newValue:
                property === "specializations" || property === "generalizations"
                  ? nodeData[property]
                  : nodeData.properties[property],
              modifiedAt: new Date(),
              changeType: "sort elements",
              fullNode: currentVisibleNode,
            });

            // Record a log of the sorting action
            recordLogs({
              action: "sort elements",
              field: property,
              sourceCategory:
                sourceCategory === "main" ? "outside" : sourceCategory,
              destinationCategory:
                destinationCategory === "main"
                  ? "outside"
                  : destinationCategory,
              nodeId: currentVisibleNode.id,
            });
          }
        }
      } catch (error) {
        // Log any errors that occur during the sorting process
        console.error(error);
        recordLogs({
          type: "error",
          error,
        });
      }
    },
    [currentVisibleNode, db, nodes, recordLogs]
  );

  //  function to handle the deletion of a Node
  const deleteNode = useCallback(async () => {
    try {
      // Confirm deletion with the user using a custom confirmation dialog
      if (
        await confirmIt(
          `Are you sure you want to delete this Node?`,
          "Delete Node",
          "Keep Node"
        )
      ) {
        if (!user?.uname) return;

        const specializations = Object.values(
          currentVisibleNode.specializations
        ).flat();

        if (specializations.length > 0) {
          if (
            specializations.some((spc: { id: string }) => {
              return Object.values(nodes[spc.id].generalizations).length === 1;
            })
          ) {
            await confirmIt(
              "To delete a Node you need to delete it's specializations or move them under a different generalization",
              "Ok",
              ""
            );
            return;
          }
        }
        // Retrieve the document reference of the node to be deleted
        const nodeRef = doc(collection(db, NODES), currentVisibleNode.id);
        const generalizationId = Object.values(
          currentVisibleNode.generalizations
        ).flat()[0].id;
        if (generalizationId && nodes[generalizationId]) {
          setCurrentVisibleNode(nodes[generalizationId]);
        }
        // call removeIsPartOf function to remove the node link from all the nodes where it's linked
        removeIsPartOf(db, currentVisibleNode as INode);
        // Update the user document by removing the deleted node's ID
        await updateDoc(nodeRef, { deleted: true });

        saveNewChange(db, {
          nodeId: currentVisibleNode.id,
          modifiedBy: user?.uname,
          modifiedProperty: null,
          previousValue: null,
          newValue: null,
          modifiedAt: new Date(),
          changeType: "delete node",
          fullNode: currentVisibleNode,
        });
        // Record a log entry for the deletion action
        recordLogs({
          action: "Deleted Node",
          node: currentVisibleNode.id,
        });
      }
    } catch (error) {
      // Log any errors that occur during the execution of the function
      console.error(error);
      recordLogs({
        type: "error",
        error,
      });
    }
  }, [currentVisibleNode.id, user?.uname]);

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
    [setExpandedNodes]
  );

  const updateSpecializationsInheritance = async (
    specializations: { id: string }[],
    batch: any,
    property: string,
    propertyValue: any,
    ref: string,
    propertyType: string
  ) => {
    try {
      let newBatch = batch;
      for (let specialization of specializations) {
        const nodeRef = doc(collection(db, NODES), specialization.id);
        let objectUpdate: any = {
          [`inheritance.${property}.inheritanceType`]:
            "inheritUnlessAlreadyOverRidden",
          [`properties.${property}`]: propertyValue,
          [`inheritance.${property}.ref`]: ref,
          [`propertyType.${property}`]: propertyType,
        };

        if (newBatch._committed) {
          newBatch = writeBatch(db);
        }
        updateDoc(nodeRef, objectUpdate);

        if (newBatch._mutations.length > 498) {
          await newBatch.commit();
          newBatch = writeBatch(db);
        }

        newBatch = await updateSpecializationsInheritance(
          Object.values(nodes[specialization.id].specializations).flat(),
          newBatch,
          property,
          propertyValue,
          ref,
          propertyType
        );
      }
      return newBatch;
    } catch (error) {
      console.error(error);
    }
  };

  const addNewProperty = async (
    newProperty: string,
    newPropertyType: string
  ) => {
    try {
      if (newProperty in currentVisibleNode.properties) {
        await confirmIt(
          `The property ${newProperty} already exist under this node`,
          "Ok",
          ""
        );
        return;
      }
      if (!newProperty.trim() || !newPropertyType.trim()) return;
      const nodeRef = doc(collection(db, NODES), currentVisibleNode.id);
      const properties = currentVisibleNode.properties;
      const propertyType = currentVisibleNode.propertyType;
      const inheritance = currentVisibleNode.inheritance;

      propertyType[newProperty] = newPropertyType.toLowerCase();

      if (newPropertyType.toLowerCase() === "string") {
        properties[newProperty] = "";
      } else {
        properties[newProperty] = {
          main: [],
        };
      }
      inheritance[newProperty] = {
        ref: null,
        inheritanceType: "inheritUnlessAlreadyOverRidden",
      };
      await updateDoc(nodeRef, {
        properties,
        propertyType,
        inheritance,
      });
      setNewProperty("");
      setOpenAddProperty(false);
      const batch = writeBatch(db);
      await updateSpecializationsInheritance(
        Object.values(currentVisibleNode.specializations).flat(),
        batch,
        newProperty,
        properties[newProperty],
        currentVisibleNode.id,
        newPropertyType.toLowerCase()
      );
      await batch.commit();

      recordLogs({
        action: "add new property",
        node: currentVisibleNode.id,
        newProperty,
        newPropertyType,
      });
    } catch (error) {
      setOpenAddProperty(false);
      console.error(error);
    }
  };

  const removeProperty = async (property: string) => {
    if (
      await confirmIt(
        <Typography>
          Are sure you want delete the property{" "}
          <strong>{DISPLAY[property] || property}</strong>?
        </Typography>,
        "Delete",
        "Keep"
      )
    ) {
      const nodeRef = doc(collection(db, NODES), currentVisibleNode.id);
      const properties = currentVisibleNode.properties;
      const propertyType = currentVisibleNode.propertyType;
      delete properties[property];
      await updateDoc(nodeRef, { propertyType, properties });
      recordLogs({
        action: "removeProperty",
        node: currentVisibleNode.id,
        property,
      });
    }
  };

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

  const scrollToTop = () => {
    if (scrolling.current) {
      scrolling.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const getTitleNode = useCallback(
    (nodeId: string) => {
      return getTitle(nodes, nodeId);
    },
    [nodes]
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
        pt: "40px",
        mb: "90px",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          width: "100%",
        }}
      >
        <Text
          currentVisibleNode={currentVisibleNode}
          setCurrentVisibleNode={setCurrentVisibleNode}
          nodes={nodes}
          property={"title"}
          text={currentVisibleNode.title}
          confirmIt={confirmIt}
          recordLogs={recordLogs}
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
          displayInheritanceSettings={displayInheritanceSettings}
          displayNodeChat={displayNodeChat}
          displayNodeHistory={displayNodeHistory}
          activeSidebar={activeSidebar}
        />
        <Text
          nodes={nodes}
          recordLogs={recordLogs}
          text={
            getPropertyValue(
              nodes,
              currentVisibleNode.inheritance.description.ref,
              "description"
            ) || currentVisibleNode.properties.description
          }
          currentVisibleNode={currentVisibleNode}
          property={"description"}
          setCurrentVisibleNode={setCurrentVisibleNode}
          locked={locked}
          selectedDiffNode={selectedDiffNode}
          getTitleNode={getTitleNode}
        />

        {currentVisibleNode?.properties.hasOwnProperty("actor") && (
          <StructuredProperty
            selectedDiffNode={selectedDiffNode}
            currentVisibleNode={currentVisibleNode}
            showListToSelect={showListToSelect}
            setOpenAddCategory={setOpenAddCategory}
            setSelectedProperty={setSelectedProperty}
            handleSorting={handleSorting}
            handleEditCategory={handleEditCategory}
            deleteCategory={deleteCollection}
            navigateToNode={navigateToNode}
            recordLogs={recordLogs}
            setSnackbarMessage={setSnackbarMessage}
            setCurrentVisibleNode={setCurrentVisibleNode}
            updateInheritance={updateInheritance}
            property={"actor"}
            nodes={nodes}
            locked={locked}
          />
        )}

        <Stack
          direction={width < 1050 ? "column" : "row"}
          sx={{
            gap: 3,
          }}
        >
          {["generalizations", "specializations"].map((property, index) => (
            <StructuredProperty
              key={property + index}
              selectedDiffNode={selectedDiffNode}
              currentVisibleNode={currentVisibleNode}
              showListToSelect={showListToSelect}
              setOpenAddCategory={setOpenAddCategory}
              setSelectedProperty={setSelectedProperty}
              handleSorting={handleSorting}
              handleEditCategory={handleEditCategory}
              deleteCategory={deleteCollection}
              navigateToNode={navigateToNode}
              recordLogs={recordLogs}
              setSnackbarMessage={setSnackbarMessage}
              setCurrentVisibleNode={setCurrentVisibleNode}
              updateInheritance={updateInheritance}
              property={property}
              nodes={nodes}
              locked={locked}
              addNewSpecialization={addNewSpecialization}
              reviewId={reviewId}
              setReviewId={setReviewId}
            />
          ))}
        </Stack>
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
              selectedDiffNode={selectedDiffNode}
              currentVisibleNode={currentVisibleNode}
              showListToSelect={showListToSelect}
              setOpenAddCategory={setOpenAddCategory}
              setSelectedProperty={setSelectedProperty}
              handleSorting={handleSorting}
              handleEditCategory={handleEditCategory}
              deleteCategory={deleteCollection}
              navigateToNode={navigateToNode}
              recordLogs={recordLogs}
              setSnackbarMessage={setSnackbarMessage}
              setCurrentVisibleNode={setCurrentVisibleNode}
              updateInheritance={updateInheritance}
              property={property}
              nodes={nodes}
              locked={locked}
            />
          ))}
        </Stack>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            // p: "17px",
            width: "100%",
          }}
        >
          <NodeBody
            currentVisibleNode={currentVisibleNode}
            setCurrentVisibleNode={setCurrentVisibleNode}
            recordLogs={recordLogs}
            updateInheritance={updateInheritance}
            showListToSelect={showListToSelect}
            handleEditCategory={handleEditCategory}
            deleteCategory={deleteCollection}
            handleSorting={handleSorting}
            navigateToNode={navigateToNode}
            setSnackbarMessage={setSnackbarMessage}
            setOpenAddCategory={setOpenAddCategory}
            setSelectedProperty={setSelectedProperty}
            setOpenAddField={setOpenAddProperty}
            removeProperty={removeProperty}
            user={user}
            nodes={nodes}
            locked={locked}
            selectedDiffNode={selectedDiffNode}
            getTitleNode={getTitleNode}
          />
        </Box>
      </Box>

      {ConfirmDialog}

      <Modal
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "transparent",
          // backgroundColor: "rgba(0, 0, 0, 0.5)",
        }}
        open={openSelectModel}
        onClose={handleClose}
      >
        <Box
          sx={{
            maxHeight: "80vh",
            overflowY: "auto",
            borderRadius: 2,
            boxShadow: 24,
            ...SCROLL_BAR_STYLE,
          }}
        >
          <Paper sx={{ position: "sticky", top: "0", px: "15px", zIndex: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Typography>
                Check the Box for the{" "}
                <strong style={{ color: "orange" }}>
                  {capitalizeFirstLetter(
                    DISPLAY[selectedProperty]
                      ? DISPLAY[selectedProperty]
                      : selectedProperty
                  )}
                </strong>{" "}
                that you want to add:
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <SearchBox
                  setSearchValue={setSearchValue}
                  label={"Search ..."}
                />
                {selectedProperty === "specializations" && (
                  <Button
                    onClick={() =>
                      addNewSpecialization(
                        selectedCategory || "main",
                        searchValue
                      )
                    }
                    sx={{ borderRadius: "25px", minWidth: "200px" }}
                    variant="outlined"
                    disabled={
                      searchValue.length < 3 ||
                      searchResultsForSelection[0].title.trim() ===
                        searchValue.trim()
                    }
                  >
                    {"Add new specialization"}
                  </Button>
                )}
              </Box>
            </Box>
          </Paper>
          <Paper>
            {searchValue ? (
              <Box>
                {" "}
                {searchResultsForSelection.map((node: any) => (
                  <ListItem
                    key={node.id}
                    onClick={() => {
                      markItemAsChecked(node.id);
                    }}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      color: "white",
                      cursor: "pointer",
                      borderRadius: "4px",
                      padding: "8px",
                      transition: "background-color 0.3s",
                      // border: "1px solid #ccc",
                      mt: "5px",
                      "&:hover": {
                        backgroundColor: (theme: Theme) =>
                          theme.palette.mode === "dark"
                            ? DESIGN_SYSTEM_COLORS.notebookG450
                            : DESIGN_SYSTEM_COLORS.gray200,
                      },
                    }}
                  >
                    {" "}
                    {user?.manageLock || !node.locked ? (
                      <Checkbox
                        checked={checkedItems.has(node.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          markItemAsChecked(node.id);
                        }}
                        name={node.id}
                      />
                    ) : (
                      <LockIcon
                        sx={{
                          color: "orange",
                          mx: "15px",
                        }}
                      />
                    )}
                    <Typography>{node.title}</Typography>
                  </ListItem>
                ))}
              </Box>
            ) : (
              <TreeViewSimplified
                treeVisualization={selectFromTree()}
                expandedNodes={expandedNodes}
                onOpenNodesTree={handleToggle}
                markItemAsChecked={markItemAsChecked}
                checkedItems={checkedItems}
                handleCloning={handleCloning}
                clone={true}
                stopPropagation={currentVisibleNode.id}
                manageLock={user?.manageLock}
              />
            )}
          </Paper>
          {/* {selectedProperty === "specializations" && (
              <Button
                variant="contained"
                onClick={() => handleNewSpecialization()}
              >
                Add new
              </Button>
            )} */}
          <Paper
            sx={{
              display: "flex",
              position: "sticky",
              bottom: "0px",
              p: 3,
              justifyContent: "space-between",
            }}
          >
            <Button variant="contained" onClick={handleClose} color="primary">
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveLinkChanges}
              color="success"
            >
              Save
            </Button>
          </Paper>
        </Box>
      </Modal>
      <Dialog
        onClose={() => {
          setOpenAddProperty(false);
        }}
        open={openAddProprety}
      >
        <DialogContent>
          <Box sx={{ height: "auto", width: "500px" }}>
            <FormControl fullWidth margin="normal" sx={{ width: "500px" }}>
              <InputLabel>Type</InputLabel>
              <Select
                value={newFieldType}
                onChange={(event) => setNewFieldType(event.target.value)}
                label="Difficulty"
                MenuProps={{
                  sx: {
                    zIndex: "9999",
                  },
                }}
                sx={{ borderRadius: "20px" }}
              >
                {[
                  "String",
                  /* "Number",
                  "Boolean", */
                  "Activity",
                  "Object",
                  "Actor",
                  "Evaluation Dimension",
                  "Incentive",
                  "Reward",
                ].map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
              </Select>
              <TextField
                label="New Property"
                sx={{ mt: "14px" }}
                value={newFieldTitle}
                onChange={(event) => setNewProperty(event.target.value)}
                InputLabelProps={{
                  sx: { color: "grey" },
                }}
              />
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center" }}>
          <Button
            onClick={() => addNewProperty(newFieldTitle, newFieldType)}
            color="primary"
            disabled={!newFieldType || !newFieldTitle}
            variant="contained"
            sx={{ borderRadius: "25px" }}
          >
            {"Add"}
          </Button>
          <Button
            onClick={() => {
              setOpenAddProperty(false);
              setNewProperty("");
            }}
            color="primary"
            variant="contained"
            sx={{ borderRadius: "25px" }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog onClose={handleCloseAddCollection} open={openAddCategory}>
        <DialogContent>
          <Box sx={{ height: "auto", width: "500px" }}>
            <Typography sx={{ mb: "13px", fontSize: "19px" }}>
              {editCollection ? "Edit " : "Add "}a new Collection:
            </Typography>
            <TextField
              placeholder={`Add Collection`}
              fullWidth
              value={newCollection}
              multiline
              onChange={(e: any) => setNewCollection(e.target.value)}
              sx={{
                fontWeight: 400,
                fontSize: {
                  xs: "14px",
                  md: "16px",
                },
                marginBottom: "5px",
                width: "100%",
                display: "block",
              }}
              autoFocus
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center" }}>
          <Button
            onClick={addNewCollection}
            color="primary"
            variant="outlined"
            sx={{ borderRadius: "25px" }}
          >
            {editCollection ? "Save" : "Add"}
          </Button>
          <Button
            onClick={handleCloseAddCollection}
            color="primary"
            variant="outlined"
            sx={{ borderRadius: "25px" }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Node;
