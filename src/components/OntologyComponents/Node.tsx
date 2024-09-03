/* ## Overview

The `Node` component is a complex React component that interacts with a Firestore database to manage a hierarchical structure of nodes. It allows users to view and edit nodes, add and remove specializations, clone nodes, and handle inheritance of properties between nodes. The component also supports drag-and-drop functionality for reordering nodes within the hierarchy.

## Features

- **Viewing and Editing Nodes**: Display node information such as title and description, and allow users to edit these fields if they have the appropriate permissions.
- **Specializations Management**: Add new specializations to nodes, select existing ones, and clone specializations for reuse.
- **Inheritance Handling**: Manage inherited properties from parent nodes to ensure consistency across the hierarchy.
- **Drag-and-Drop Sorting**: Reorder nodes within a category using a drag-and-drop interface.
- **Category Management**: Add, edit, and delete categories within a node.
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
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { TreeItem, TreeView } from "@mui/lab";
import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemIcon,
  MenuItem,
  Modal,
  Paper,
  Select,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import Dialog from "@mui/material/Dialog";
import { Box } from "@mui/system";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useCallback, useEffect, useState } from "react";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";

// import useConfirmDialog from "@/hooks/useConfirmDialog";
// import { DESIGN_SYSTEM_COLORS } from "@/lib/theme/colors";

import Text from "./Text";
import useConfirmDialog from " @components/lib/hooks/useConfirmDialog";
import { DESIGN_SYSTEM_COLORS } from " @components/lib/theme/colors";
import {
  IActivity,
  IActor,
  IEvaluation,
  IGroup,
  IIncentive,
  ILockedNode,
  INode,
  INodePath,
  IProcess,
  IReward,
  IRole,
  IChildNode,
  MainSpecializations,
} from " @components/types/INode";
import { LOCKS, NODES } from " @components/lib/firestoreClient/collections";
import ChildNode from "./ChildNode";
import {
  DISPLAY,
  NODES_TYPES,
  ORDER_CHILDREN,
} from " @components/lib/CONSTANTS";
import TreeViewSimplified from "./TreeViewSimplified";
import { SearchBox } from "../SearchBox/SearchBox";

type INodeProps = {
  currentVisibleNode: INode;
  setCurrentVisibleNode: (node: INode) => void;
  handleLinkNavigation: (
    path: { id: string; title: string },
    type: string
  ) => void;
  setOntologyPath: (state: INodePath[]) => void;
  ontologyPath: INodePath[];
  setSnackbarMessage: (message: string) => void;
  updateUserDoc: (ontologyPath: INodePath[]) => void;
  user: any;
  mainSpecializations: MainSpecializations;
  nodes: INode[];
  addNewNode: ({ id, newNode }: { id: string; newNode: any }) => void;
  editNode: string;
  setEditNode: (state: string) => void;
  lockedNodeFields: ILockedNode;
  recordLogs: (logs: any) => void;
  updateInheritance: (parameters: {
    updatedNode: INode;
    updatedField: string;
    type: "children" | "plainText";
    newValue: any;
    ancestorTitle: string;
  }) => void;
  navigateToNode: (nodeId: string) => void;
  eachOntologyPath: { [key: string]: any };
};

const Node = ({
  currentVisibleNode,
  setCurrentVisibleNode,
  setSnackbarMessage,
  updateUserDoc,
  mainSpecializations,
  nodes,
  addNewNode,
  // INITIAL_VALUES,
  ontologyPath,
  editNode,
  setEditNode,
  lockedNodeFields,
  user,
  recordLogs,
  updateInheritance,
  navigateToNode,
  eachOntologyPath,
}: INodeProps) => {
  // const [newTitle, setNewTitle] = useState<string>("");
  // const [description, setDescription] = useState<string>("");

  const [openSelectModel, setOpenSelectModel] = useState(false);
  const handleClose = () => {
    setCheckedSpecializations([]);
    setOpenSelectModel(false);
    setSelectedCategory("");
  };
  const [openAddCategory, setOpenAddCategory] = useState(false);
  const handleCloseAddCategory = () => {
    setType("");
    setNewCategory("");
    setOpenAddCategory(false);
    setEditCategory(null);
  };
  const [newCategory, setNewCategory] = useState("");
  const [type, setType] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [checkedSpecializations, setCheckedSpecializations] = useState<any>([]);
  const [editCategory, setEditCategory] = useState<any>(null);
  const { confirmIt, ConfirmDialog } = useConfirmDialog();
  const [rootTitle, setRootTitle] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [newFieldType, setNewFieldType] = useState("");
  const [openAddField, setOpenAddField] = useState(false);
  const db = getFirestore();

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const getRooTitle = async (nodeId: string) => {
    if (nodeId) {
      const nodeDoc = await getDoc(doc(collection(db, NODES), nodeId));
      const nodeData = nodeDoc.data();
      if (nodeData) {
        return setRootTitle(nodeData.plainText.title);
      }
    }
    setRootTitle("");
  };
  useEffect(() => {
    getRooTitle(currentVisibleNode.root);
  }, [currentVisibleNode.root]);

  const capitalizeFirstLetter = (word: string) => {
    if (word === "role") {
      return "Roles";
    }
    if (word === "individual") {
      return "Type of individuals in group";
    }
    return word.charAt(0).toUpperCase() + word.slice(1);
  };

  const checkSpecialization = (checkedId: string) => {
    setCheckedSpecializations((oldChecked: string[]) => {
      let _oldChecked = [...oldChecked];
      if (_oldChecked.includes(checkedId)) {
        _oldChecked = _oldChecked.filter((cheked) => cheked !== checkedId);
      } else {
        _oldChecked.push(checkedId);
      }
      return _oldChecked;
    });
  };

  const cloneNode = async (
    nodeId: string
  ): Promise<{ newCloneId: string; newCloneTitle: string }> => {
    try {
      // Retrieve the document of the original node from Firestore.
      const parentNodeDoc = await getDoc(doc(collection(db, NODES), nodeId));

      // If the node document doesn't exist, return early.
      if (!parentNodeDoc.exists()) return { newCloneId: "", newCloneTitle: "" };

      // Extract data from the original node document.
      const parentNodeData = parentNodeDoc.data();

      // Create a reference for the new node document in Firestore.
      const newNodeRef = doc(collection(db, NODES));

      // Prepare the data for the new node by copying existing data.
      const newNode: any = {
        ...parentNodeDoc.data(),
      };

      // Set a new ID for the cloned node.
      newNode.id = newNodeRef.id;

      // Update the parents array to include the ID of the original node.
      newNode.parents = [parentNodeDoc.id];
      // Modify the title to indicate that it is a new node.
      newNode.plainText.title = `New ${parentNodeData.plainText.title}`;

      // Initialize an empty Specializations object for children.
      newNode.children.Specializations = { main: [] };

      // Remove the 'locked' property from the new node.
      delete newNode.locked;

      // Update the original node to include the reference to the new node in its children.
      parentNodeData.children.Specializations = {
        ["main"]: [
          ...(parentNodeData.children?.Specializations["main"] || []),
          {
            id: newNodeRef.id,
            title: `New ${parentNodeData.plainText.title}`,
          },
        ],
      };
      // Update the original node document in Firestore with the modified data.
      await updateDoc(parentNodeDoc.ref, {
        ...parentNodeData,
        updatedAt: new Date(),
      });

      // // Create a new document in Firestore for the cloned node with the modified data.
      await setDoc(newNodeRef, { ...newNode, createdAt: new Date() });

      // Return the ID of the newly created node.
      return {
        newCloneId: newNodeRef.id,
        newCloneTitle: newNode.plainText.title,
      };
    } catch (error) {
      // Log any errors that occur during the cloning process.
      confirmIt(
        "There was an error while creating the new node, please try again",
        "OK",
        ""
      );
      console.error(error);
      return {
        newCloneId: "",
        newCloneTitle: "",
      };
    }
  };

  /**
   * getInheritance function retrieves inheritance information for specified fields
   *
   * @param {string[]} fields - Array of fields for which inheritance is to be determined
   * @param {string} ancestorTitle - Default title to be used if specific inheritance title is not available
   *
   * @returns {Object} - Object containing inheritance information for each field
   */
  const getInheritance = (
    fields: string[],
    type: "plainText" | "children",
    parentNode: INode
  ): {
    [key: string]: {
      ref: string;
      title: string;
    };
  } => {
    // Initialize an empty object to store inheritance information
    const inheritance: {
      [key: string]: {
        ref: string;
        title: string;
      };
    } = {};
    const ancestorId = parentNode.id;
    const ancestorTitle = parentNode.plainText.title;
    // Iterate through each field, excluding "Specializations"
    for (let field of fields) {
      if (field === "Specializations") continue;
      let inheritanceRef: { ref: string; title: string } = {
        ref: ancestorId,
        title: ancestorTitle,
      };
      if (
        parentNode.inheritance &&
        parentNode.inheritance[type] &&
        parentNode.inheritance[type][field]?.ref
      ) {
        inheritanceRef = {
          ref: parentNode.inheritance[type][field]?.ref,
          title: parentNode.inheritance[type][field]?.title,
        };
      }
      inheritance[field] = { ...inheritanceRef };
    }
    // Return the final inheritance object
    return inheritance;
  };

  // Function to add a new specialization to the node
  const addNewSpecialization = async (type: string, category: string) => {
    try {
      // Get a reference to the parent node document
      const nodeParentRef = doc(collection(db, NODES), currentVisibleNode.id);

      // Retrieve the parent node document
      const nodeParentDoc = await getDoc(nodeParentRef);

      // Extract data from the parent node document
      const parentNode: any = {
        ...nodeParentDoc.data(),
        id: nodeParentDoc.id,
      };

      // Check if the parent node document exists
      if (!nodeParentDoc.exists()) return;

      // Create a new node document reference
      const newNodeRef = doc(collection(db, NODES));

      // Clone the parent node data
      const newNode = { ...nodeParentDoc.data() };

      // Initialize the Specializations sub-node
      newNode.children.specializations = { main: [] };

      // Remove unnecessary fields from the new node
      delete newNode.locked;
      delete newNode.cat;

      // Set the parents and title for the new node
      newNode.parents = [currentVisibleNode.id];
      newNode.children.generalizations = {
        main: [
          {
            id: currentVisibleNode.id,
            title: currentVisibleNode.plainText.title,
          },
        ],
      };
      newNode.root = currentVisibleNode.root || "";
      newNode.plainText.title = `New ${parentNode.plainText.title}`;
      newNode.id = newNodeRef.id;

      // Build the inheritance object for the new node
      newNode.inheritance = {
        plainText: {
          ...getInheritance(
            Object.keys(newNode.plainText),
            "plainText",
            parentNode
          ),
        },
        children: {
          ...getInheritance(
            Object.keys(newNode.children),
            "children",
            parentNode
          ),
        },
      };

      // Check if the specified type and category exist in the parent node
      if (!parentNode.children[type].hasOwnProperty(category)) {
        // If not, create the specified type and category
        parentNode.children[type] = {
          ...parentNode.children[type],
          [category]: [],
        };
      }

      // Add the new node to the specified type and category
      parentNode.children[type][category].push({
        title: `New ${parentNode.plainText.title}`,
        id: newNodeRef.id,
      });

      // Update the user document with the path
      updateUserDoc([
        ...ontologyPath,
        { id: newNodeRef.id, title: newNode.plainText.title, category: false },
      ]);
      // Add the new node to the database
      addNewNode({ id: newNodeRef.id, newNode });
      // Update the parent node document in the database
      await updateDoc(nodeParentRef, parentNode);
    } catch (error) {
      // Handle errors by logging to the console
      confirmIt("Sorry there was an Error please try again!", "Ok", "");
      console.error(error);
    }
  };

  const showList = async (type: string, category: string) => {
    // const _type = currentVisibleNode.nodeType;
    setOpenSelectModel(true);
    setType(type);
    setSelectedCategory(category);
    const specializations = (
      (currentVisibleNode.children[type] || {})[category] || []
    ).map((onto: any) => onto.id);
    setCheckedSpecializations(specializations || []);
  };

  // This function handles the cloning of an node.
  const handleCloning = async (node: {
    id: string;
    path: string[];
    title: string;
    specializations: MainSpecializations;
  }) => {
    // Call the asynchronous function to clone the node with the given ID.
    const {
      newCloneId,
      newCloneTitle,
    }: { newCloneId: string; newCloneTitle: string } = await cloneNode(node.id);
    const newPath = eachOntologyPath[node.id];
    if (newCloneId) {
      // Update the user document by appending the new clone's ID to the node path.
      newPath.push({ id: newCloneId, title: newCloneTitle, category: false });
      updateUserDoc([...newPath]);
    }

    // Close the modal or perform any necessary cleanup.
    handleClose();
  };
  const handleSaveChildrenChanges = async () => {
    try {
      // Get the node document from the database
      const nodeDoc = await getDoc(
        doc(collection(db, NODES), currentVisibleNode.id)
      );

      // If the node document does not exist, return early
      if (!nodeDoc.exists()) return;

      // Extract existing node data from the document
      const nodeData: any = nodeDoc.data();

      // Initialize a new array for storing updated children
      const oldChildren =
        type === "Specializations"
          ? [...nodeData.children[type][selectedCategory]]
          : [];

      // Iterate through checkedSpecializations to update newchildren
      for (let checkd of checkedSpecializations) {
        // Find the node object from the children array
        const findNode = nodes.find((node: INode) => node.id === checkd);

        // Check if the node is not already present in newchildren
        const indexFound = oldChildren.findIndex((onto) => onto.id === checkd);
        if (indexFound === -1 && findNode) {
          // Add the node to newchildren if not present
          oldChildren.push({
            id: checkd,
            title: findNode.plainText.title,
          });
        }
      }

      // If type is "Specializations", update main children
      if (type === "Specializations") {
        nodeData.children[type]["main"] = nodeData.children[type][
          "main"
        ].filter(
          (node: any) => oldChildren.findIndex((o) => o.id === node.id) === -1
        );
      }

      // Update the node data with the new children
      nodeData.children[type] = {
        ...(nodeData.children[type] || {}),
        [selectedCategory]: oldChildren,
      };

      // If inheritance is present, reset the children field
      if (nodeData.inheritance) {
        nodeData.inheritance.children[type] = {
          ref: null,
          title: "",
        };
      }
      // Update the node document in the database
      await updateDoc(nodeDoc.ref, nodeData);

      // If type is not "Specializations", update the inheritance
      if (type !== "Specializations") {
        updateInheritance({
          updatedNode: { ...nodeData, id: currentVisibleNode.id },
          updatedField: type,
          type: "children",
          newValue: nodeData.children[type],
          ancestorTitle: nodeData.title,
        });
      }

      // Close the modal or perform any other necessary actions
      handleClose();
    } catch (error) {
      // Handle any errors that occur during the process
      console.error(error);
    }
  };

  const addNewCategory = useCallback(async () => {
    try {
      // Check if newCategory is provided
      if (!newCategory) return;

      // Fetch the node document based on the currentVisibleNode.id
      const nodeDoc = await getDoc(
        doc(collection(db, NODES), currentVisibleNode.id)
      );

      // Check if the node document exists
      if (nodeDoc.exists()) {
        // Retrieve node data from the document
        const ontologyData = nodeDoc.data();

        // If editCategory is provided, update existing category
        if (editCategory) {
          // Log the action of editing a category
          recordLogs({
            action: "Edited a category",
            previousValue: editCategory.category,
            newValue: newCategory,
            node: nodeDoc.id,
            feild: editCategory.type,
          });

          // Update ontologyData for the edited category
          ontologyData.children[editCategory.type][newCategory] =
            ontologyData.children[editCategory.type][editCategory.category];
          delete ontologyData.children[editCategory.type][
            editCategory.category
          ];
        } else {
          // If it's a new category, create it
          if (
            !ontologyData?.children[type]?.hasOwnProperty(newCategory.trim())
          ) {
            ontologyData.children[type] = {
              ...(ontologyData?.children[type] || {}),
              [newCategory]: [],
            };
            // Log the action of creating a new category
            recordLogs({
              action: "Created a category",
              category: newCategory,
              node: nodeDoc.id,
              field: type,
            });
          } else {
            confirmIt("This category has already been added.", "Ok", "");
            return;
          }
        }

        // Update the node document with the modified data
        await updateDoc(nodeDoc.ref, ontologyData);

        // Close the add category modal
        handleCloseAddCategory();
      }
    } catch (error) {
      // Log any errors that occur during the process
      console.error(error);
    }
  }, [newCategory]);

  const handleNewSpecialization = async () => {
    if (type === "specializations") {
      await addNewSpecialization(type, selectedCategory);
      handleClose();
    } else {
      await handleCloning(mainSpecializations[type]);
      handleClose();
    }
  };
  const handleEditCategory = (type: string, category: string) => {
    setNewCategory(category);
    setOpenAddCategory(true);
    setEditCategory({
      type,
      category,
    });
  };

  const deleteCategory = async (type: string, category: string) => {
    if (
      await confirmIt(
        "Are you sure you want to delete this Category?",
        "Delete Category",
        "Keep Category"
      )
    ) {
      const nodeDoc = await getDoc(
        doc(collection(db, NODES), currentVisibleNode.id)
      );
      if (nodeDoc.exists()) {
        const nodeData = nodeDoc.data();
        nodeData.children[type]["main"] = [
          ...(nodeData.children[type]["main"] || []),
          ...nodeData.children[type][category],
        ];

        delete nodeData.children[type][category];
        await updateDoc(nodeDoc.ref, nodeData);
        recordLogs({
          action: "Deleted a category",
          category,
          node: nodeDoc.id,
        });
      }
    }
  };

  // This function adds or removes a lock for a specific user on a given node field.

  const addLock = async (node: string, field: string, type: string) => {
    try {
      // Check if a user is authenticated before proceeding
      if (!user) return;

      // If the type is 'add', create a new lock and add it to the 'ontologyLock' collection
      if (type == "add") {
        // Create a new lock object with user information, node, field, and timestamp
        const newLock = {
          uname: user?.uname,
          node,
          field,
          deleted: false,
          createdAt: new Date(),
        };

        // Set the document with the new lock information
        await setDoc(doc(collection(db, LOCKS)), newLock);
      } else {
        // If the type is not 'add', remove existing locks for the specified node, field, and user
        const locksDocs = await getDocs(
          query(
            collection(db, LOCKS),
            where("field", "==", field),
            where("node", "==", node),
            where("uname", "==", user?.uname)
          )
        );

        // Iterate through each lock document and delete it
        for (let lockDoc of locksDocs.docs) {
          await deleteDoc(lockDoc.ref);
        }
      }
    } catch (error) {
      // Handle any errors that occur during the process
      console.error(error);
    }
  };

  // Function to handle sorting of draggable items
  const handleSorting = async (result: any, subType: string) => {
    try {
      // Destructure properties from the result object
      const { source, destination, draggableId, type } = result;

      // If there is no destination, no sorting needed
      if (!destination) {
        return;
      }

      // Check if the type of sorting is for a CATEGORY
      if (type === "CATEGORY") {
        // Extract the source and destination category IDs
        const sourceCategory = source.droppableId; // The source category
        const destinationCategory = destination.droppableId; // The destination category

        // Ensure valid source and destination categories and they are not the same
        if (
          sourceCategory &&
          destinationCategory &&
          sourceCategory !== destinationCategory
        ) {
          // Retrieve node document from the database
          const nodeDoc = await getDoc(
            doc(collection(db, NODES), currentVisibleNode.id)
          );

          // Check if node document exists
          if (nodeDoc.exists()) {
            // Extract node data from the document
            const nodeData = nodeDoc.data();

            // Get the children and specializations related to the provided subType
            const specializations = nodeData.children[subType];

            // Find the index of the draggable item in the source category
            const nodeIdx = specializations[sourceCategory].findIndex(
              (onto: any) => onto.id === draggableId
            );

            // If the draggable item is found in the source category
            if (nodeIdx !== -1) {
              // Move the item to the destination category
              specializations[destinationCategory].push(
                specializations[sourceCategory][nodeIdx]
              );

              // Remove the item from the source category
              specializations[sourceCategory].splice(nodeIdx, 1);
            }

            // Update the node data with the modified specializations
            nodeData.children[subType] = specializations;

            // Update the node document in the database
            await updateDoc(nodeDoc.ref, nodeData);

            // Record a log of the sorting action
            await recordLogs({
              action: "Moved a field to a category",
              field: subType,
              sourceCategory:
                sourceCategory === "main" ? "outside" : sourceCategory,
              destinationCategory:
                destinationCategory === "main"
                  ? "outside"
                  : destinationCategory,
            });
          }
        }
      }
    } catch (error) {
      // Log any errors that occur during the sorting process
      console.error(error);
    }
  };

  /**
   * Removes a child-node with the specified ID from the given node data.
   * @param {Object} params - An object containing ontologyData and id.
   * @param {Object} ontologyData - The main node data object.
   * @param {string} id - The ID of the child-node to be removed.
   */
  const removeChildNode = (parentNode: INode, childId: string) => {
    // Iterate over the types of children in the main node data.
    for (let type in parentNode.children) {
      // Iterate over the categories within each type of child-node.
      for (let category in parentNode.children[type] || {}) {
        // Check if there are children present in the current category.
        if ((parentNode.children[type][category] || []).length > 0) {
          // Find the index of the child-node with the specified ID within the children array.
          const subOntologyIdx = parentNode.children[type][category].findIndex(
            (sub: any) => sub.id === childId
          );

          // If the child-node with the specified ID is found, remove it from the array.
          if (subOntologyIdx !== -1) {
            parentNode.children[type][category].splice(subOntologyIdx, 1);
          }
        }
      }
    }
    return parentNode;
  };

  // Asynchronous function to handle the deletion of a child-node
  const deleteNode = async () => {
    try {
      // Confirm deletion with the user using a custom confirmation dialog
      if (
        await confirmIt(
          "Are you sure you want to delete this Node?",
          "Delete Node",
          "Keep Node"
        )
      ) {
        // Retrieve the document reference of the node to be deleted
        const nodeDoc = await getDoc(
          doc(collection(db, NODES), currentVisibleNode.id)
        );

        // Check if the node document exists
        if (nodeDoc.exists()) {
          // Retrieve node data from the document
          const nodeData = nodeDoc.data();

          // Extract the parent IDs from the node data
          const parents = nodeData?.parents || [];

          // Iterate through each parent ID
          for (let parent of parents) {
            // Retrieve the document reference of the parent node
            const parentNodeDoc = await getDoc(
              doc(collection(db, NODES), parent)
            );

            // Check if the parent node document exists
            if (parentNodeDoc.exists()) {
              // Retrieve data of the parent node
              let parentNodeData = parentNodeDoc.data() as INode;

              // Remove the reference to the child-node from the parent
              parentNodeData = removeChildNode(
                parentNodeData,
                currentVisibleNode.id
              );

              // Update the parent node document with the modified data
              await updateDoc(parentNodeDoc.ref, parentNodeData);
            }
          }

          // Update the user document by removing the deleted node's ID
          updateUserDoc([...ontologyPath.slice(0, -1)]);

          // Mark the node as deleted by updating its document
          await updateDoc(nodeDoc.ref, { deleted: true });

          // Record a log entry for the deletion action
          recordLogs({
            action: "Deleted Node",
            node: nodeDoc.id,
          });
        }
      }
    } catch (error) {
      // Log any errors that occur during the execution of the function
      console.error(error);
    }
  };

  const selectFromTree = () => {
    if (type === "dependents" || type === "dependencies") {
      return mainSpecializations["act"]?.specializations || {};
    } else if (type === "specializations" || type === "generalizations") {
      return (
        mainSpecializations[rootTitle.toLowerCase()]?.specializations || {}
      );
    } else {
      return mainSpecializations[type]?.specializations || {};
    }
  };
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

  /* "root": "T
  of the direct specializations of 'Act'/'Actor'/'Evaluation Dimension'/'Incentive'/'Reward'. The user should not be able to modify the value of this field. Please automatically specify it by tracing the generalizations of this descendent activity back to reach one of the direct specializations of 'Act'/'Actor'/'Evaluation Dimension'/'Incentive'/'Reward'. So, obviously the root of the node 'Act'/'Actor'/'Evaluation Dimension'/'Incentive'/'Reward' itself and its direct specializations would be empty string because they are already roots."*/

  return (
    <Box
      sx={{
        padding: "40px 40px 40px 40px",
        mb: "90px",
      }}
    >
      <Modal
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0, 0, 0, 0.5)",
        }}
        open={openSelectModel}
        onClose={handleClose}
      >
        <Box
          sx={{
            width: "80%",
            maxHeight: "80vh",
            backgroundColor: "white",
            overflowY: "auto",
            borderRadius: 2,
            boxShadow: 24,
            "&::-webkit-scrollbar": {
              width: "12px",
            },
            "&::-webkit-scrollbar-track": {
              background: (theme) =>
                theme.palette.mode === "dark" ? "#28282a" : "white",
            },
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: "#888",
              borderRadius: "10px",
              border: (theme) =>
                theme.palette.mode === "dark"
                  ? "3px solid #28282a"
                  : "3px solid white",
            },
            "&::-webkit-scrollbar-thumb:hover": {
              background: DESIGN_SYSTEM_COLORS.orange400,
            },
          }}
        >
          <Paper sx={{ position: "sticky", top: "0", px: "15px", zIndex: 1 }}>
            <Box sx={{ mt: 1, display: "flex", alignItems: "center" }}>
              <Typography>
                Check the Box for the{" "}
                <strong style={{ color: "orange" }}>{type}</strong> that you
                want to add:
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <SearchBox
                  setSearchValue={setSearchValue}
                  label={"Search ..."}
                />
              </Box>
            </Box>
          </Paper>
          <TreeViewSimplified
            treeVisualization={selectFromTree()}
            expandedNodes={expandedNodes}
            onOpenNodesTree={handleToggle}
            checkSpecialization={checkSpecialization}
            checkedSpecializations={checkedSpecializations}
            handleCloning={handleCloning}
            clone={true}
            stopPropagation={currentVisibleNode.id}
          />
          <Paper
            sx={{
              display: "flex",
              position: "sticky",
              bottom: "0px",
              p: 3,
              justifyContent: "center",
              gap: "8px",
            }}
          >
            {type !== "dependents" &&
              type !== "dependencies" &&
              type !== "generalizations" && (
                <Button variant="contained" onClick={handleNewSpecialization}>
                  Add new {type}
                </Button>
              )}
            <Button
              variant="contained"
              onClick={handleSaveChildrenChanges}
              color="primary"
            >
              Save
            </Button>
            <Button variant="contained" onClick={handleClose} color="primary">
              Cancel
            </Button>
          </Paper>
        </Box>
      </Modal>
      <Dialog
        onClose={() => {
          setOpenAddField(false);
        }}
        open={openAddField}
      >
        <DialogContent>
          <Box sx={{ height: "auto", width: "500px" }}>
            <FormControl fullWidth margin="normal" sx={{ width: "500px" }}>
              <InputLabel id="difficulty-label">Difficulty</InputLabel>
              <Select
                labelId="difficulty-label"
                value={newFieldType}
                onChange={(event) => setNewFieldType(event.target.value)}
                label="Difficulty"
                MenuProps={{
                  sx: {
                    zIndex: "9999",
                  },
                }}
              >
                {[
                  "String",
                  "Number",
                  "Boolean",
                  "Activity",
                  "Actor",
                  "Evaluation Dimension",
                  "Incentive",
                  "Reward",
                ].map((item) => (
                  <MenuItem key={item} value="easy">
                    {item}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center" }}>
          <Button onClick={addNewCategory} color="primary">
            {editCategory ? "Save" : "Add"}
          </Button>
          <Button onClick={handleCloseAddCategory} color="primary">
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog onClose={handleCloseAddCategory} open={openAddCategory}>
        <DialogContent>
          <Box sx={{ height: "auto", width: "500px" }}>
            <TextField
              placeholder={`Add Category`}
              variant="standard"
              fullWidth
              value={newCategory}
              multiline
              onChange={(e: any) => setNewCategory(e.target.value)}
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
          <Button onClick={addNewCategory} color="primary">
            {editCategory ? "Save" : "Add"}
          </Button>
          <Button onClick={handleCloseAddCategory} color="primary">
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      <Box sx={{ display: "flex", flexDirection: "column" }}>
        <Text
          updateInheritance={updateInheritance}
          recordLogs={recordLogs}
          user={user}
          lockedNodeFields={lockedNodeFields[currentVisibleNode.id] || {}}
          addLock={addLock}
          text={currentVisibleNode.plainText.title}
          currentVisibleNode={currentVisibleNode}
          type={"title"}
          setSnackbarMessage={setSnackbarMessage}
          setCurrentVisibleNode={setCurrentVisibleNode}
          editNode={editNode}
          setEditNode={setEditNode}
          deleteNode={deleteNode}
        />
        <Text
          updateInheritance={updateInheritance}
          recordLogs={recordLogs}
          user={user}
          lockedNodeFields={lockedNodeFields[currentVisibleNode.id] || {}}
          addLock={addLock}
          text={currentVisibleNode.plainText.description}
          currentVisibleNode={currentVisibleNode}
          type={"description"}
          setSnackbarMessage={setSnackbarMessage}
          setCurrentVisibleNode={setCurrentVisibleNode}
          setEditNode={setEditNode}
        />
      </Box>

      <Box key={currentVisibleNode.id} sx={{ mb: "15px", mt: "25px" }}>
        <Box>
          {(ORDER_CHILDREN[currentVisibleNode?.nodeType as string] || []).map(
            (type: string) =>
              // if it' a children we need to render it as one otherwise it's a Plain Text
              type in
              NODES_TYPES[currentVisibleNode?.nodeType as string].children ? (
                <Box key={type} sx={{ display: "grid", mt: "5px" }}>
                  <Box>
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      <Typography sx={{ fontSize: "19px" }}>
                        {capitalizeFirstLetter(
                          DISPLAY[type] ? DISPLAY[type] : type
                        )}
                        :
                      </Typography>
                      <Tooltip title={""}>
                        <Button
                          onClick={() => showList(type, "main")}
                          sx={{ ml: "5px" }}
                        >
                          {" "}
                          {type !== "specializations" ? "Select" : "Add"} {type}{" "}
                        </Button>
                      </Tooltip>
                      {["specializations", "role", "actor"].includes(type) && (
                        <Button
                          onClick={() => {
                            setOpenAddCategory(true);
                            setType(type);
                          }}
                          sx={{ ml: "5px" }}
                        >
                          Add Category
                        </Button>
                      )}
                      {(currentVisibleNode.inheritance || {}).children &&
                        (currentVisibleNode.inheritance || {}).children[type]
                          ?.ref && (
                          <Typography sx={{ color: "grey" }}>
                            {"("}
                            {"Inherited from "}
                            {'"'}
                            {(currentVisibleNode.inheritance || {}).children[
                              type
                            ]?.title || ""}
                            {'"'}
                            {")"}
                          </Typography>
                        )}
                    </Box>
                    {["role", "specializations", "actor"].includes(type) ? (
                      <DragDropContext
                        onDragEnd={(e: any) => handleSorting(e, type)}
                      >
                        <ul>
                          {Object.keys(currentVisibleNode?.children[type] || {})
                            .sort((a, b) => {
                              if (a === "main") return -1;
                              if (b === "main") return 1;
                              return a.localeCompare(b); // Alphabetical order for other keys
                            })
                            .map((category: any) => {
                              const children =
                                currentVisibleNode?.children[type][category] ||
                                [];
                              const showGap =
                                Object.keys(
                                  currentVisibleNode?.children[type]
                                ).filter(
                                  (c) =>
                                    (
                                      currentVisibleNode?.children[type][c] ||
                                      []
                                    ).length > 0 && c !== "main"
                                ).length > 0;
                              return (
                                <Box
                                  key={category}
                                  id={category} /* sx={{ ml: "15px" }} */
                                >
                                  {category !== "main" && (
                                    <li key={category}>
                                      <Box
                                        sx={{
                                          display: "flex",
                                          alignItems: "center",
                                        }}
                                      >
                                        <Typography sx={{ fontWeight: "bold" }}>
                                          {category}
                                        </Typography>{" "}
                                        :{" "}
                                        <Button
                                          onClick={() =>
                                            showList(type, category)
                                          }
                                          sx={{ ml: "5px" }}
                                        >
                                          {" "}
                                          {type !== "specializations"
                                            ? "Select"
                                            : "Add"}{" "}
                                          {type}{" "}
                                        </Button>
                                        <Button
                                          onClick={() =>
                                            handleEditCategory(type, category)
                                          }
                                          sx={{ ml: "5px" }}
                                        >
                                          {" "}
                                          Edit
                                        </Button>
                                        <Button
                                          onClick={() =>
                                            deleteCategory(type, category)
                                          }
                                          sx={{ ml: "5px" }}
                                        >
                                          {" "}
                                          Delete
                                        </Button>
                                      </Box>
                                    </li>
                                  )}

                                  {(children.length > 0 || showGap) && (
                                    <List>
                                      <Droppable
                                        droppableId={category}
                                        type="CATEGORY"
                                      >
                                        {/* //snapshot.isDraggingOver */}
                                        {(provided: any, snapshot: any) => (
                                          <Box
                                            {...provided.droppableProps}
                                            ref={provided.innerRef}
                                            sx={{
                                              backgroundColor: (theme) =>
                                                theme.palette.mode === "dark"
                                                  ? snapshot.isDraggingOver
                                                    ? DESIGN_SYSTEM_COLORS.notebookG450
                                                    : ""
                                                  : snapshot.isDraggingOver
                                                  ? DESIGN_SYSTEM_COLORS.gray250
                                                  : "",
                                              // minHeight: /* children.length > 0 ?  */ "25px" /*  : "" */,
                                              userSelect: "none",
                                            }}
                                          >
                                            {children.map(
                                              (child: any, index: any) => {
                                                return (
                                                  <Draggable
                                                    key={child.id}
                                                    draggableId={child.id}
                                                    index={index}
                                                  >
                                                    {(provided: any) => (
                                                      <ListItem
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                        sx={{ m: 0, p: 0 }}
                                                      >
                                                        <ListItemIcon>
                                                          <DragIndicatorIcon />
                                                        </ListItemIcon>
                                                        <ChildNode
                                                          navigateToNode={
                                                            navigateToNode
                                                          }
                                                          recordLogs={
                                                            recordLogs
                                                          }
                                                          setSnackbarMessage={
                                                            setSnackbarMessage
                                                          }
                                                          currentVisibleNode={
                                                            currentVisibleNode
                                                          }
                                                          setCurrentVisibleNode={
                                                            setCurrentVisibleNode
                                                          }
                                                          sx={{ mt: "15px" }}
                                                          key={
                                                            currentVisibleNode.id
                                                          }
                                                          child={child}
                                                          type={type}
                                                          category={category}
                                                          updateInheritance={
                                                            updateInheritance
                                                          }
                                                        />
                                                      </ListItem>
                                                    )}
                                                  </Draggable>
                                                );
                                              }
                                            )}
                                            {provided.placeholder}
                                          </Box>
                                        )}
                                      </Droppable>
                                    </List>
                                  )}
                                </Box>
                              );
                            })}
                        </ul>
                      </DragDropContext>
                    ) : (
                      <ul>
                        {Object.keys(
                          currentVisibleNode?.children[type] || {}
                        ).map((category: any) => {
                          const children =
                            currentVisibleNode?.children[type][category] || [];
                          return (
                            <Box
                              key={category}
                              id={category} /* sx={{ ml: "15px" }} */
                            >
                              {category !== "main" && (
                                <li key={category}>
                                  <Box
                                    sx={{
                                      display: "flex",
                                      alignItems: "center",
                                    }}
                                  >
                                    <Typography sx={{ fontWeight: "bold" }}>
                                      {category}
                                    </Typography>{" "}
                                    :{" "}
                                    <Button
                                      onClick={() => showList(type, category)}
                                      sx={{ ml: "5px" }}
                                    >
                                      {" "}
                                      {type !== "Specializations"
                                        ? "Select"
                                        : "Add"}{" "}
                                      {type}{" "}
                                    </Button>
                                    <Button
                                      onClick={() =>
                                        handleEditCategory(type, category)
                                      }
                                      sx={{ ml: "5px" }}
                                    >
                                      {" "}
                                      Edit
                                    </Button>
                                    <Button
                                      onClick={() =>
                                        deleteCategory(type, category)
                                      }
                                      sx={{ ml: "5px" }}
                                    >
                                      {" "}
                                      Delete
                                    </Button>
                                  </Box>
                                </li>
                              )}

                              <ul>
                                {children.map((child: any) => {
                                  return (
                                    <li key={child.id}>
                                      <ChildNode
                                        navigateToNode={navigateToNode}
                                        recordLogs={recordLogs}
                                        setSnackbarMessage={setSnackbarMessage}
                                        currentVisibleNode={currentVisibleNode}
                                        setCurrentVisibleNode={
                                          setCurrentVisibleNode
                                        }
                                        sx={{ mt: "15px" }}
                                        key={currentVisibleNode.id}
                                        child={child}
                                        type={type}
                                        category={category}
                                        updateInheritance={updateInheritance}
                                      />
                                    </li>
                                  );
                                })}
                              </ul>
                            </Box>
                          );
                        })}
                      </ul>
                    )}
                  </Box>
                </Box>
              ) : type in
                NODES_TYPES[currentVisibleNode?.nodeType as string]
                  .plainText ? (
                <Box key={type}>
                  <Text
                    updateInheritance={updateInheritance}
                    recordLogs={recordLogs}
                    user={user}
                    lockedNodeFields={
                      lockedNodeFields[currentVisibleNode.id] || {}
                    }
                    addLock={addLock}
                    text={currentVisibleNode.plainText[type]}
                    currentVisibleNode={currentVisibleNode}
                    type={type}
                    setSnackbarMessage={setSnackbarMessage}
                    setCurrentVisibleNode={setCurrentVisibleNode}
                    setEditNode={setEditNode}
                  />
                </Box>
              ) : (
                rootTitle && (
                  <Box sx={{ display: "flex", gap: "15px" }}>
                    {" "}
                    <Typography>Root:</Typography>
                    <Typography>{rootTitle}</Typography>
                  </Box>
                )
              )
          )}

          <Box
            sx={{ mt: "19px" }}
            onClick={() => {
              setOpenAddField(true);
            }}
          >
            <Button variant="contained">Add new Field</Button>
          </Box>
        </Box>
      </Box>
      {ConfirmDialog}
    </Box>
  );
};

export default Node;
