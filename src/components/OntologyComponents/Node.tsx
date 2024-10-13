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
  ICollection,
  ILinkNode,
  ILockedNode,
  INode,
  INodeTypes,
  MainSpecializations,
} from " @components/types/INode";
import { NODES } from " @components/lib/firestoreClient/collections";
import {
  DISPLAY,
  SCROLL_BAR_STYLE,
  SpecialCharacterRegex,
} from " @components/lib/CONSTANTS";
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
import {
  checkIfCanDeleteANode,
  createNewNode,
  generateInheritance,
  recordLogs,
  removeIsPartOf,
  saveNewChangeLog,
  unlinkPropertyOf,
  updateInheritance,
  updateSpecializations,
} from " @components/lib/utils/helpers";

import StructuredProperty from "../StructuredProperty/StructuredProperty";
import { NodeChange } from " @components/types/INode";
import { User } from " @components/types/IAuth";

type INodeProps = {
  currentVisibleNode: INode;
  setCurrentVisibleNode: (node: INode) => void;
  setSnackbarMessage: (message: string) => void;
  user: User;
  mainSpecializations: MainSpecializations;
  nodes: { [id: string]: INode };
  addNewNode: ({ id, newNode }: { id: string; newNode: INode }) => void;
  navigateToNode: (nodeId: string) => void;
  eachOntologyPath: { [key: string]: any };
  searchWithFuse: (query: string, nodeType?: INodeTypes) => INode[];
  locked: boolean;
  selectedDiffNode: NodeChange | null;
  displaySidebar: Function;
  activeSidebar: any;
};

const Node = ({
  currentVisibleNode,
  setCurrentVisibleNode,
  setSnackbarMessage,
  mainSpecializations,
  nodes,
  addNewNode,
  user,
  navigateToNode,
  searchWithFuse,
  locked,
  selectedDiffNode,
  displaySidebar,
  activeSidebar,
}: INodeProps) => {
  // const [newTitle, setNewTitle] = useState<string>("");
  // const [description, setDescription] = useState<string>("");
  const isSmallScreen = useMediaQuery("(max-width: 600px)");

  const [openSelectModel, setOpenSelectModel] = useState(false);

  const handleCloseAddLinksModel = () => {
    setCheckedItems(new Set());
    setOpenSelectModel(false);
    setSelectedCategory("");
    setSearchValue("");
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
    const propertyType = currentVisibleNode.propertyType[
      selectedProperty
    ] as INodeTypes;
    if (propertyType) {
      return searchWithFuse(searchValue, propertyType);
    }
    if (
      selectedProperty === "specializations" ||
      selectedProperty === "generalizations"
    ) {
      return searchWithFuse(searchValue);
    }
    return [];
  }, [searchValue, selectedProperty]);

  const markItemAsChecked = (checkedId: string) => {
    const _oldChecked = new Set(checkedItems);
    if (_oldChecked.has(checkedId)) {
      _oldChecked.delete(checkedId);
    } else {
      _oldChecked.add(checkedId);
    }
    setCheckedItems(_oldChecked);
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

        // Generate a unique title based on existing specializations
        const specializationsTitles = parentNodeData.specializations.flatMap(
          (collection) =>
            collection.nodes.map((spec) => nodes[spec.id]?.title || "")
        );
        newTitle = generateUniqueTitle(newTitle, specializationsTitles);

        // Generate new inheritance structure
        const inheritance = generateInheritance(
          parentNodeData.inheritance,
          currentVisibleNode.id
        );

        // Create the new node object
        const newNode = createNewNode(
          parentNodeData,
          newNodeRef.id,
          newTitle,
          inheritance,
          nodeId
        );

        // Handle specific property updates for `parts` and `isPartOf`
        if (selectedProperty === "parts") {
          if (
            newNode.properties.isPartOf &&
            Array.isArray(newNode.properties.isPartOf)
          ) {
            newNode.properties.isPartOf.push({
              collectionName: "main",
              nodes: [{ id: currentVisibleNode.id }],
            });
          }
        }

        if (selectedProperty === "isPartOf") {
          if (
            newNode.properties.parts &&
            Array.isArray(newNode.properties.parts)
          ) {
            newNode.properties.parts.push({
              collectionName: "main",
              nodes: [{ id: currentVisibleNode.id }],
            });
          }

          // Update inheritance for parts
          newNode.inheritance.parts.ref = null;
        }

        // Update the parent node's specializations
        updateSpecializations(parentNodeData, newNodeRef.id);

        // Create a new document in Firestore for the cloned node
        await setDoc(newNodeRef, {
          ...newNode,
          locked: false,
          createdAt: new Date(),
        });

        // Update the original parent node
        await updateDoc(parentNodeDoc.ref, {
          ...parentNodeData,
          updatedAt: new Date(),
        });

        // Return the newly created node
        return newNode;
      } catch (error) {
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

  // This function handles the cloning of a node.
  const handleCloning = async (node: { id: string }) => {
    // Call the asynchronous function to clone the node with the given ID.
    const newNode = await cloneNode(node.id);
    if (!newNode) return;

    const nodeData = nodes[currentVisibleNode.id] as INode;
    const nodeRef = doc(collection(db, NODES), currentVisibleNode.id);

    // Handle the addition of specializations or generalizations
    if (
      selectedProperty === "specializations" ||
      selectedProperty === "generalizations"
    ) {
      const targetCollection = nodeData[selectedProperty].find(
        (collection) =>
          collection.collectionName === (selectedCategory || "main")
      );

      // If the collection does not exist, create it
      if (!targetCollection) {
        nodeData[selectedProperty].push({
          collectionName: selectedCategory || "main",
          nodes: [],
        });
      }

      // Push the new node ID into the corresponding collection
      const collectionToUpdate = nodeData[selectedProperty].find(
        (collection) =>
          collection.collectionName === (selectedCategory || "main")
      );
      collectionToUpdate?.nodes.push({ id: newNode.id });

      // Update Firestore document with the new specializations or generalizations
      await updateDoc(nodeRef, {
        [selectedProperty]: nodeData[selectedProperty],
      });
    } else {
      // Handling property updates
      if (nodeData.inheritance[selectedProperty]?.ref) {
        nodeData.properties[selectedProperty] = JSON.parse(
          JSON.stringify(
            nodes[nodeData.inheritance[selectedProperty].ref].properties[
              selectedProperty
            ]
          )
        );
      }
      if (!Array.isArray(nodeData.properties[selectedProperty])) return;

      const targetPropertyCollection = nodeData.properties[
        selectedProperty
      ].find(
        (collection) =>
          collection.collectionName === (selectedCategory || "main")
      );

      // If the property collection does not exist, create it
      if (!targetPropertyCollection) {
        nodeData.properties[selectedProperty].push({
          collectionName: selectedCategory || "main",
          nodes: [],
        });
      }

      // Push the new node ID into the corresponding property collection
      const propertyCollectionToUpdate = nodeData.properties[
        selectedProperty
      ].find(
        (collection) =>
          collection.collectionName === (selectedCategory || "main")
      );
      propertyCollectionToUpdate?.nodes.push({ id: newNode.id });
      if (!newNode.propertyOf) {
        newNode.propertyOf = {
          [selectedProperty]: [{ collectionName: "main", nodes: [] }],
        };
      }
      if (!newNode.propertyOf[selectedProperty]) {
        newNode.propertyOf[selectedProperty] = [
          { collectionName: "main", nodes: [] },
        ];
      }
      newNode.propertyOf[selectedProperty][0].nodes.push({
        id: nodeRef.id,
      });
      const newNodeRef = doc(collection(db, NODES), newNode.id);
      updateDoc(newNodeRef, {
        [`propertyOf.${selectedProperty}`]:
          newNode.propertyOf[selectedProperty],
      });
      // Update Firestore document with the updated properties and inheritance
      await updateDoc(nodeRef, {
        [`properties.${selectedProperty}`]:
          nodeData.properties[selectedProperty],
        [`inheritance.${selectedProperty}.ref`]: null,
      });

      // Update inheritance (if needed)
      updateInheritance({
        nodeId: currentVisibleNode.id,
        updatedProperty: selectedProperty,
        db,
      });
    }

    // Close the modal or perform any necessary cleanup.
    handleCloseAddLinksModel();
  };

  // Function to add a new specialization to a node
  const addNewSpecialization = useCallback(
    async (collectionName: string = "main", searchValue: string = "") => {
      try {
        if (!collectionName) {
          collectionName = "main";
        }

        // Get a reference to the parent node document
        const nodeParentRef = doc(collection(db, NODES), currentVisibleNode.id);

        // Retrieve the parent node data
        const nodeParentData = nodes[currentVisibleNode.id];
        const previousParentValue = JSON.parse(
          JSON.stringify(nodeParentData.specializations)
        );

        // Create a new node document reference
        const newNodeRef = doc(collection(db, NODES));

        // Generate new inheritance structure
        const inheritance = generateInheritance(
          nodeParentData.inheritance,
          currentVisibleNode.id
        );

        // Generate a new title
        let newTitle = searchValue
          ? searchValue
          : `New ${nodeParentData.title}`;
        const specializationsTitles = nodeParentData.specializations.flatMap(
          (collection) =>
            collection.nodes.map((spec) => nodes[spec.id]?.title || "")
        );
        newTitle = generateUniqueTitle(newTitle, specializationsTitles);

        // Create the new node object
        const newNode = createNewNode(
          nodeParentData,
          newNodeRef.id,
          newTitle,
          inheritance,
          currentVisibleNode.id
        );

        // Remove the `locked` property if it exists
        if ("locked" in newNode) {
          delete newNode.locked;
        }

        // Update the parent node's specializations
        updateSpecializations(nodeParentData, newNodeRef.id, collectionName);

        // Add the new node to the database
        addNewNode({ id: newNodeRef.id, newNode });

        setReviewId(newNodeRef.id);
        setOpenSelectModel(false);

        // Update the parent node document
        await updateDoc(nodeParentRef, {
          ...nodeParentData,
          specializations: nodeParentData.specializations,
        });

        // Save the change log
        saveNewChangeLog(db, {
          nodeId: currentVisibleNode.id,
          modifiedBy: user?.uname,
          modifiedProperty: "specializations",
          previousValue: previousParentValue,
          newValue: nodeParentData.specializations,
          modifiedAt: new Date(),
          changeType: "add element",
          fullNode: nodeParentData,
        });
      } catch (error) {
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

  const showListToSelect = async (
    property: string,
    collectionName: string,
    collectionIdx: number
  ) => {
    setOpenSelectModel(true);
    setSelectedProperty(property);
    setSelectedCategory(collectionName);

    let previousCheckedItems: string[] = [];

    // Handle specializations or generalizations
    if (property === "specializations" || property === "generalizations") {
      // Find the collection based on the collection name

      if (collectionName === "main") {
        let checked = [];
        for (let collection of currentVisibleNode[property]) {
          checked.push(...collection.nodes.map((link) => link.id));
        }
        previousCheckedItems = checked;
      } else {
        const collection = currentVisibleNode[property].find(
          (col) => col.collectionName === collectionName
        );
        if (collection) {
          previousCheckedItems = collection.nodes.map((link) => link.id);
        }
      }
    } else {
      // Handle properties case
      const propertyCollection = currentVisibleNode.properties[property];
      if (Array.isArray(propertyCollection)) {
        if (collectionName === "main") {
          let checked = [];
          for (let collection of propertyCollection) {
            checked.push(...collection.nodes.map((link) => link.id));
          }
          previousCheckedItems = checked;
        } else {
          const collection = propertyCollection.find(
            (col) => col.collectionName === collectionName
          );
          if (collection) {
            previousCheckedItems = collection.nodes.map((link) => link.id);
          }
        }
      }
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

  const updateLinks = (
    children: { id: string }[],
    newLink: { id: string },
    linkType: "specializations" | "generalizations"
  ) => {
    const filteredChildren = children.filter((child) => {
      const childData = nodes[child.id];
      const allLinks = [
        ...(childData.specializations || []),
        ...(childData.generalizations || []),
      ];

      return !allLinks.some((collection) => {
        return collection.nodes.some((node) => node.id === newLink.id);
      });
    });

    for (let child of filteredChildren) {
      const childData = nodes[child.id];
      const links = childData[linkType];

      const mainCollection = links.find(
        (collection) => collection.collectionName === "main"
      );

      if (mainCollection) {
        mainCollection.nodes.push(newLink);
        const childRef = doc(collection(db, NODES), child.id);
        updateDoc(childRef, {
          [linkType]: links,
        });
      } else {
        const newCollection = {
          collectionName: "main",
          nodes: [newLink],
        };
        links.push(newCollection);
        const childRef = doc(collection(db, NODES), child.id);
        updateDoc(childRef, {
          [linkType]: links,
        });
      }
    }
  };
  const updatePropertyOf = async (
    links: { id: string }[],
    newLink: { id: string },
    property: string
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

  const updatePartsAndPartsOf = async (
    links: { id: string }[],
    newLink: { id: string },
    property: "isPartOf" | "parts"
  ) => {
    links.forEach((child) => {
      const childData = nodes[child.id] as INode;
      if (Array.isArray(childData.properties[property])) {
        const propertyData = childData.properties[property] as ICollection[];
        const existingIds = propertyData.flatMap((collection) =>
          collection.nodes.map((spec) => spec.id)
        );
        if (!existingIds.includes(newLink.id)) {
          const childData = nodes[child.id];
          const propertyData = childData.properties[property];
          if (Array.isArray(propertyData)) {
            const mainCollection = propertyData.find(
              (collection) => collection.collectionName === "main"
            ) as ICollection;
            // Add the new link to the property data
            mainCollection.nodes.push(newLink);

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

  const handleSaveLinkChanges = useCallback(async () => {
    try {
      // Close the modal or perform any other necessary actions
      handleCloseAddLinksModel();

      // Get the node document from the database
      const nodeDoc = await getDoc(
        doc(collection(db, NODES), currentVisibleNode.id)
      );
      let previousValue: ICollection[] | null = null;
      let newValue: ICollection[] | null = null;

      // If the node document does not exist, return early
      if (!nodeDoc.exists()) return;

      // Extract existing node data from the document
      const nodeData = nodeDoc.data() as INode;

      // Initialize a new array for storing updated children
      let oldLinks: ILinkNode[] = [];
      let allLinks: ILinkNode[] = [];

      // Handle specializations or generalizations
      if (
        selectedProperty === "specializations" ||
        selectedProperty === "generalizations"
      ) {
        const selectedCollection = nodeData[selectedProperty].find(
          (c: ICollection) => c.collectionName === selectedCategory
        );
        if (selectedCollection) {
          oldLinks = [...(selectedCollection.nodes || [])];
          allLinks = nodeData[selectedProperty].flatMap(
            (collection) => collection.nodes
          );
        }

        previousValue = JSON.parse(JSON.stringify(nodeData[selectedProperty]));
      } else {
        if (Array.isArray(nodeData.properties[selectedProperty])) {
          const selectedCollection = (
            nodeData.properties[selectedProperty] || []
          ).find((c: ICollection) => c.collectionName === selectedCategory);
          if (selectedCollection) {
            oldLinks = [...selectedCollection.nodes];
            allLinks = nodeData.properties[selectedProperty].flatMap(
              (collection) => collection.nodes
            );
            previousValue = JSON.parse(
              JSON.stringify(nodeData.properties[selectedProperty])
            );
          }
        }
      }

      // Iterate through checkedItems to add new children
      checkedItems.forEach((checked) => {
        // Check if the node is not already present in oldLinks
        const indexFound = allLinks.findIndex(
          (link: ILinkNode) => link.id === checked
        );

        if (indexFound === -1) {
          // Add the node to oldLinks if not present
          oldLinks.push({
            id: checked,
          });
        }
      });

      // Filter out any children that are not in the checkedItems array
      const removedLinks = oldLinks.filter(
        (link) => !checkedItems.has(link.id)
      );

      // Only keep the checked links
      oldLinks = oldLinks.filter((link) => checkedItems.has(link.id));

      // Prevent removing all generalizations
      if (selectedProperty === "generalizations" && oldLinks.length === 0) {
        await confirmIt(
          "You cannot remove all the generalizations for this node. Make sure it links to at least one generalization.",
          "Ok",
          ""
        );
        return;
      }

      // Handle removed links
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
        const selectedCollection = nodeData[selectedProperty].find(
          (c: ICollection) => c.collectionName === selectedCategory
        );
        if (selectedCollection) {
          selectedCollection.nodes = oldLinks;
          newValue = JSON.parse(JSON.stringify(nodeData[selectedProperty]));
        }
      } else {
        if (Array.isArray(nodeData.properties[selectedProperty])) {
          const selectedCollection = (
            nodeData.properties[selectedProperty] || []
          ).find((c: ICollection) => c.collectionName === selectedCategory);
          if (selectedCollection) {
            selectedCollection.nodes = oldLinks;
            newValue = JSON.parse(
              JSON.stringify(nodeData.properties[selectedProperty])
            );
          }
        }
      }

      // Update links for specializations/generalizations
      if (
        selectedProperty === "specializations" ||
        selectedProperty === "generalizations"
      ) {
        updateLinks(
          oldLinks,
          { id: currentVisibleNode.id },
          selectedProperty === "specializations"
            ? "generalizations"
            : "specializations"
        );
      }

      // Update parts/isPartOf links
      if (selectedProperty === "parts" || selectedProperty === "isPartOf") {
        updatePartsAndPartsOf(
          oldLinks,
          { id: currentVisibleNode.id },
          selectedProperty === "parts" ? "isPartOf" : "parts"
        );
      }

      // Reset inheritance if applicable
      if (
        nodeData.inheritance &&
        !["specializations", "generalizations", "parts", "isPartOf"].includes(
          selectedProperty
        )
      ) {
        if (nodeData.inheritance[selectedProperty]) {
          nodeData.inheritance[selectedProperty].ref = null;
        }
      }

      // Update other properties if applicable
      if (
        !["specializations", "generalizations", "parts", "isPartOf"].includes(
          selectedProperty
        )
      ) {
        updatePropertyOf(
          oldLinks,
          { id: currentVisibleNode.id },
          selectedProperty
        );
      }

      // Update the node document in the database
      await updateDoc(nodeDoc.ref, nodeData);

      // Update inheritance for non-specialization/generalization properties
      if (
        !["specializations", "generalizations", "isPartOf"].includes(
          selectedProperty
        )
      ) {
        updateInheritance({
          nodeId: currentVisibleNode.id,
          updatedProperty: selectedProperty,
          db,
        });
      }

      saveNewChangeLog(db, {
        nodeId: currentVisibleNode.id,
        modifiedBy: user?.uname,
        modifiedProperty: selectedProperty,
        previousValue,
        newValue,
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
  }, [
    checkedItems,
    currentVisibleNode.id,
    currentVisibleNode.title,
    db,
    selectedCategory,
    selectedProperty,
  ]);

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

        const specializations = [];
        for (let collection of currentVisibleNode.specializations) {
          specializations.push(...collection.nodes);
        }

        if (specializations.length > 0) {
          if (checkIfCanDeleteANode(nodes, specializations)) {
            await confirmIt(
              "To delete a Node you need to delete it's specializations or move them under a different generalization",
              "Ok",
              ""
            );
            return;
          }
        }
        // Retrieve the document reference of the node to be deleted
        for (let collection of currentVisibleNode.generalizations) {
          if (collection.nodes.length > 0) {
            setCurrentVisibleNode(nodes[collection.nodes[0].id]);
            break;
          }
        }

        const nodeRef = doc(collection(db, NODES), currentVisibleNode.id);
        // call removeIsPartOf function to remove the node link from all the nodes where it's linked
        removeIsPartOf(db, currentVisibleNode as INode, user?.uname);
        // Update the user document by removing the deleted node's ID
        await updateDoc(nodeRef, { deleted: true });

        saveNewChangeLog(db, {
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
    [setExpandedNodes]
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
    [nodes]
  );
  const onGetPropertyValue = useCallback(
    (property: string) => {
      const inheritedProperty = getPropertyValue(
        nodes,
        currentVisibleNode.inheritance[property].ref,
        property
      );

      if (inheritedProperty !== null) {
        return inheritedProperty;
      } else {
        return currentVisibleNode.properties[property];
      }
    },
    [currentVisibleNode, nodes]
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
        pt: "15px",
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
        {/* title of the node */}
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
        />
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
        />
        {/* actors of the node if it's exist */}
        {currentVisibleNode?.properties.hasOwnProperty("actor") && (
          <StructuredProperty
            selectedDiffNode={selectedDiffNode}
            confirmIt={confirmIt}
            currentVisibleNode={currentVisibleNode}
            showListToSelect={showListToSelect}
            setSelectedProperty={setSelectedProperty}
            navigateToNode={navigateToNode}
            setSnackbarMessage={setSnackbarMessage}
            setCurrentVisibleNode={setCurrentVisibleNode}
            property={"actor"}
            nodes={nodes}
            locked={locked}
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
              showListToSelect={showListToSelect}
              setSelectedProperty={setSelectedProperty}
              navigateToNode={navigateToNode}
              setSnackbarMessage={setSnackbarMessage}
              setCurrentVisibleNode={setCurrentVisibleNode}
              property={property}
              nodes={nodes}
              locked={locked}
              reviewId={reviewId}
              setReviewId={setReviewId}
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
              showListToSelect={showListToSelect}
              setSelectedProperty={setSelectedProperty}
              navigateToNode={navigateToNode}
              setSnackbarMessage={setSnackbarMessage}
              setCurrentVisibleNode={setCurrentVisibleNode}
              property={property}
              nodes={nodes}
              locked={locked}
            />
          ))}
        </Stack>

        {/* rest of the properties in the NodeBody*/}
        <NodeBody
          currentVisibleNode={currentVisibleNode}
          setCurrentVisibleNode={setCurrentVisibleNode}
          showListToSelect={showListToSelect}
          navigateToNode={navigateToNode}
          setSnackbarMessage={setSnackbarMessage}
          setSelectedProperty={setSelectedProperty}
          nodes={nodes}
          locked={locked}
          selectedDiffNode={selectedDiffNode}
          getTitleNode={getTitleNode}
          confirmIt={confirmIt}
          onGetPropertyValue={onGetPropertyValue}
        />
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
        onClose={handleCloseAddLinksModel}
      >
        <Paper
          sx={{
            maxHeight: "80vh",
            overflowY: "auto",
            borderRadius: 2,
            boxShadow: 24,
            ...SCROLL_BAR_STYLE,
          }}
        >
          <Box sx={{ position: "sticky", top: "0", zIndex: 1 }}>
            <Paper sx={{ pt: "15px" }}>
              <Typography sx={{ pl: "15px" }}>
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
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  width: "950px",
                  pr: "5px",
                }}
              >
                <Typography sx={{ width: "300px", ml: "14px" }}>
                  Enter the new title:{" "}
                </Typography>
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
                    sx={{ borderRadius: "18px", minWidth: "200px" }}
                    variant="outlined"
                    disabled={
                      searchValue.length < 3 ||
                      searchResultsForSelection[0]?.title.trim() ===
                        searchValue.trim()
                    }
                  >
                    {"Add new specialization"}
                  </Button>
                )}
              </Box>
            </Paper>
          </Box>
          <Box>
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
                      checkedItems.has(node.id) ? (
                        <Checkbox
                          checked={true}
                          onChange={(e) => {
                            e.stopPropagation();
                            markItemAsChecked(node.id);
                          }}
                          name={node.id}
                        />
                      ) : (
                        <Checkbox
                          checked={false}
                          onChange={(e) => {
                            e.stopPropagation();
                            markItemAsChecked(node.id);
                          }}
                          name={node.id}
                        />
                      )
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
                setExpandedNodes={setExpandedNodes}
                onOpenNodesTree={handleToggle}
                markItemAsChecked={markItemAsChecked}
                checkedItems={checkedItems}
                handleCloning={handleCloning}
                clone={true}
                stopPropagation={currentVisibleNode.id}
                manageLock={user?.manageLock}
              />
            )}
          </Box>

          <Paper
            sx={{
              display: "flex",
              position: "sticky",
              bottom: "0px",
              p: 3,
              justifyContent: "space-between",
            }}
          >
            <Button
              variant="contained"
              onClick={handleCloseAddLinksModel}
              color="primary"
            >
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
        </Paper>
      </Modal>
    </Box>
  );
};

export default Node;
