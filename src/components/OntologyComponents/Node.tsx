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
  List,
  ListItem,
  ListItemIcon,
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
import React, { useCallback, useState } from "react";
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
  updateUserDoc: (ids: string[]) => void;
  user: any;
  mainSpecializations: MainSpecializations;
  nodes: INode[];
  addNewNode: ({ id, newNode }: { id: string; newNode: any }) => void;
  NODES_TYPES: {
    [key: string]:
      | IActivity
      | IActor
      | IProcess
      | IEvaluation
      | IRole
      | IIncentive
      | IReward
      | IGroup;
  };
  editNode: string;
  setEditOntology: (state: string) => void;
  lockedNodeFields: ILockedNode;
  recordLogs: (logs: any) => void;
  updateInheritance: (parameters: {
    updatedNode: INode;
    updatedField: string;
    type: "children" | "plainText";
    newValue: any;
    ancestorTitle: string;
  }) => void;
};

const ORDER_CHILDREN: { [key: string]: string[] } = {
  Activity: [
    "Actor",
    "Preconditions",
    "Postconditions",
    "Evaluation Dimension",
    "Process",
    "Specializations",
    "Notes",
  ],
  Actor: ["Type of actor", "Abilities", "Specializations", "Notes"],
  Process: [
    "Type of Process",
    "Role",
    "Subactivities",
    "Dependencies",
    "Performance prediction models",
    "Specializations",
    "Notes",
  ],
  Role: [
    "Role type",
    "Actor",
    "Incentive",
    "Capabilities required",
    "Specializations",
  ],
  "Evaluation Dimension": [
    "Evaluation type",
    "Measurement units",
    "Direction of desirability",
    "Criteria for acceptability",
    "Specializations",
    "Notes",
  ],
  Incentive: [
    "Evaluation Dimension",
    "Reward",
    "Reward function",
    "Specializations",
    "Notes",
  ],
  Reward: ["Reward type", "Units", "Specializations", "Notes"],
  Group: [
    "Type of actor",
    "Abilities",
    "Individual",
    "Number of individuals in group",
    "List of individuals in group",
    "Specializations",
    "Notes",
  ],
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
  setEditOntology,
  lockedNodeFields,
  user,
  recordLogs,
  updateInheritance,
}: INodeProps) => {
  // const [newTitle, setNewTitle] = useState<string>("");
  // const [description, setDescription] = useState<string>("");

  const [open, setOpen] = useState(false);
  const handleClose = () => {
    setCheckedSpecializations([]);
    setOpen(false);
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
  const db = getFirestore();

  const capitalizeFirstLetter = (word: string) => {
    if (word === "Role") {
      return "Roles";
    }
    if (word === "Individual") {
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

  const cloneNode = async (nodeId: string): Promise<string | undefined> => {
    try {
      // Retrieve the document of the original node from Firestore.
      const parentNodeDoc = await getDoc(doc(collection(db, NODES), nodeId));

      // If the node document doesn't exist, return early.
      if (!parentNodeDoc.exists()) return undefined;

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
      return newNodeRef.id;
    } catch (error) {
      // Log any errors that occur during the cloning process.
      console.error(error);
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
  const addNewSpecialisation = async (type: string, category: string) => {
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
      newNode.children.Specializations = { main: [] };

      // Remove unnecessary fields from the new node
      delete newNode.locked;
      delete newNode.cat;

      // Set the parents and title for the new node
      newNode.parents = [currentVisibleNode.id];
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
        ...ontologyPath.map((path: any) => path.id),
        newNodeRef.id,
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
    if (type !== "Specializations") {
      setOpen(true);
      setType(type);
      setSelectedCategory(category);
      const specializations = (
        currentVisibleNode.children[type][category] || []
      ).map((onto: any) => onto.id);
      setCheckedSpecializations(specializations || []);
    } else {
      await addNewSpecialisation(type, category);
    }
  };

  // This function handles the cloning of an node.
  const handleCloning = async (node: {
    id: string;
    path: string[];
    title: string;
    specializations: MainSpecializations;
  }) => {
    // Call the asynchronous function to clone the node with the given ID.
    const newCloneId: string | undefined = await cloneNode(node.id);
    const newPath = [...node.path];
    if (newCloneId) {
      newPath.push(newCloneId);
    }
    // Update the user document by appending the new clone's ID to the node path.
    updateUserDoc([...newPath]);

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

  const getCurrentSpecializations = () => {
    // Create an empty object to store main specializations
    const _mainSpecializations: any = {};

    const _specializations = nodes.filter((onto: any) => {
      // Find the index of node in the main specializations list
      const findIdx = (
        currentVisibleNode?.children?.Specializations["main"] || []
      ).findIndex((o: any) => o.id === onto.id);

      // Include node in the filtered list if found in the main specializations list
      return findIdx !== -1;
    });

    // Loop through the filtered specializations
    for (let specialization of _specializations) {
      // Add each specialization to the _mainSpecializations object
      _mainSpecializations[specialization.title] = {
        id: specialization.id,
        path: [],
        specializations: {},
      };
    }

    // Return the final object containing main specializations
    return _mainSpecializations;
  };

  const handleNewSpecialization = async () => {
    if (type === "Specializations") {
      await addNewSpecialisation(type, selectedCategory);
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
          updateUserDoc([
            ...ontologyPath.slice(0, -1).map((path: any) => path.id),
          ]);

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

  // TreeViewSimplifiedForSelecting is a functional component created using React's useCallback hook
  const TreeViewSimplifiedForSelecting = useCallback(
    // Destructure the props, including mainSpecializations and clone
    ({ mainSpecializations, clone }: any) => {
      // Initialize an array to store initially expanded categories
      const expanded = [];

      // Iterate through categories and add their IDs to the expanded array
      for (let category of Object.keys(mainSpecializations)) {
        expanded.push(mainSpecializations[category].id);
      }

      // Return the TreeView component with specified configurations
      return (
        <TreeView
          defaultCollapseIcon={<ExpandMoreIcon />}
          defaultExpandIcon={<ChevronRightIcon />}
          sx={{
            "& .Mui-selected": {
              backgroundColor: "transparent",
            },
          }}
          defaultExpanded={[...expanded]}
        >
          {/* Iterate through categories and create TreeItem components */}
          {Object.keys(mainSpecializations).map((category) => (
            <TreeItem
              key={mainSpecializations[category]?.id || category}
              nodeId={mainSpecializations[category]?.id || category}
              sx={{ mt: "5px" }}
              label={
                // Customized label using Box, Checkbox, Typography, and Button components
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    height: "auto",
                    minHeight: "50px",
                    mt: "5px",
                  }}
                >
                  {/* Render Checkbox only if it's not a category */}
                  {!mainSpecializations[category].isCategory && (
                    <Checkbox
                      checked={checkedSpecializations.includes(
                        mainSpecializations[category]?.id
                      )}
                      onChange={(e) => {
                        e.stopPropagation();
                        checkSpecialization(mainSpecializations[category].id);
                      }}
                      name={mainSpecializations[category].id}
                    />
                  )}
                  {/* Display category name with ellipsis if more than 3 words */}
                  <Typography>
                    {category.split(" ").splice(0, 3).join(" ") +
                      (category.split(" ").length > 3 ? "..." : "")}
                  </Typography>
                  {/* Render a Button for cloning if clone prop is true */}
                  {clone && !mainSpecializations[category].isCategory && (
                    <Button
                      variant="outlined"
                      sx={{ m: "9px" }}
                      onClick={() =>
                        handleCloning(mainSpecializations[category])
                      }
                    >
                      New{" "}
                      {category.split(" ").splice(0, 3).join(" ") +
                        (category.split(" ").length > 3 ? "..." : "")}{" "}
                      Specialization
                    </Button>
                  )}
                </Box>
              }
            >
              {/* Recursive call to TreeViewSimplifiedForSelecting for nested specializations */}
              {Object.keys(mainSpecializations[category].specializations)
                .length > 0 && (
                <TreeViewSimplifiedForSelecting
                  mainSpecializations={
                    mainSpecializations[category].specializations
                  }
                  clone={clone}
                />
              )}
            </TreeItem>
          ))}
        </TreeView>
      );
    },
    // Dependencies for the useCallback hook
    [mainSpecializations, checkedSpecializations]
  );

  return (
    <Box
      sx={{
        padding: "40px 40px 40px 40px",
        mb: "90px",
      }}
    >
      <Dialog onClose={handleClose} open={open}>
        <DialogContent>
          <Box sx={{ height: "auto", width: "500px" }}>
            <TreeViewSimplifiedForSelecting
              mainSpecializations={
                type === "Specializations"
                  ? getCurrentSpecializations()
                  : mainSpecializations[type]?.specializations || {}
              }
              clone={type !== "Specializations"}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center" }}>
          <Button onClick={handleNewSpecialization}>Add new {type}</Button>
          <Button onClick={handleSaveChildrenChanges} color="primary">
            Save
          </Button>
          <Button onClick={handleClose} color="primary">
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
          setEditOntology={setEditOntology}
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
          setEditOntology={setEditOntology}
        />
      </Box>

      <Box key={currentVisibleNode.id} sx={{ mb: "15px", mt: "25px" }}>
        <Box>
          {(ORDER_CHILDREN[currentVisibleNode?.nodeType as string] || []).map(
            (type: string) =>
              // if it' a children we need to render it as one otherwise it's a Plain Text
              Object.keys(currentVisibleNode.children).includes(type) ? (
                <Box key={type} sx={{ display: "grid", mt: "5px" }}>
                  <Box>
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      <Typography sx={{ fontSize: "19px" }}>
                        {capitalizeFirstLetter(type)}:
                      </Typography>
                      <Tooltip title={""}>
                        <Button
                          onClick={() => showList(type, "main")}
                          sx={{ ml: "5px" }}
                        >
                          {" "}
                          {type !== "Specializations" ? "Select" : "Add"} {type}{" "}
                        </Button>
                      </Tooltip>
                      {["Specializations", "Role", "Actor"].includes(type) && (
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
                    {["Role", "Specializations", "Actor"].includes(type) ? (
                      <DragDropContext
                        onDragEnd={(e: any) => handleSorting(e, type)}
                      >
                        <ul>
                          {Object.keys(currentVisibleNode?.children[type])
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
                                                          ontologyPath={
                                                            ontologyPath
                                                          }
                                                          updateUserDoc={
                                                            updateUserDoc
                                                          }
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
                        {Object.keys(currentVisibleNode?.children[type]).map(
                          (category: any) => {
                            const children =
                              currentVisibleNode?.children[type][category] ||
                              [];
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
                                          recordLogs={recordLogs}
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
                                          key={currentVisibleNode.id}
                                          child={child}
                                          type={type}
                                          category={category}
                                          ontologyPath={ontologyPath}
                                          updateUserDoc={updateUserDoc}
                                          updateInheritance={updateInheritance}
                                        />
                                      </li>
                                    );
                                  })}
                                </ul>
                              </Box>
                            );
                          }
                        )}
                      </ul>
                    )}
                  </Box>
                </Box>
              ) : (
                Object.keys(currentVisibleNode.plainText).includes(type) && (
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
                      setEditOntology={setEditOntology}
                    />
                  </Box>
                )
              )
          )}
        </Box>
      </Box>
      {ConfirmDialog}
    </Box>
  );
};

export default Node;
