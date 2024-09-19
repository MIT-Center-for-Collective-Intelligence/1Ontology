/* ## Overview

The `Node` component is a complex React component that interacts with a Firestore database to manage a hierarchical structure of nodes. It allows users to view and edit nodes, add and remove specializations, clone nodes, and handle inheritance of properties between nodes. The component also supports drag-and-drop functionality for reordering nodes within the hierarchy.

## Features

- **Viewing and Editing Nodes**: Display node information such as title and description, and allow users to edit these fields if they have the appropriate permissions.
- **specializations Management**: Add new specializations to nodes, select existing ones, and clone specializations for reuse.
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
  Link,
  List,
  ListItem,
  ListItemIcon,
  MenuItem,
  Modal,
  Paper,
  Select,
  Tab,
  Tabs,
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
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { TabPanel, a11yProps } from " @components/lib/utils/TabPanel";
// import useConfirmDialog from "@/hooks/useConfirmDialog";
// import { DESIGN_SYSTEM_COLORS } from "@/lib/theme/colors";

import Text from "./Text";
import useConfirmDialog from " @components/lib/hooks/useConfirmDialog";
import { DESIGN_SYSTEM_COLORS } from " @components/lib/theme/colors";
import {
  ILockedNode,
  INode,
  INodePath,
  MainSpecializations,
} from " @components/types/INode";
import { LOCKS, NODES } from " @components/lib/firestoreClient/collections";

import { DISPLAY, SCROLL_BAR_STYLE } from " @components/lib/CONSTANTS";
import TreeViewSimplified from "./TreeViewSimplified";
import { SearchBox } from "../SearchBox/SearchBox";
import NodeBody from "../NodBody/NodeBody";
import LinksSide from "../Generalizations/LinksSide";
import LinksSideParts from "../Parts/LinksSideParts";
import {
  getPropertyValue,
  getTitle,
} from " @components/lib/utils/string.utils";

type INodeProps = {
  scrolling: any;
  currentVisibleNode: INode;
  setCurrentVisibleNode: (node: INode) => void;
  handleLinkNavigation: (
    path: { id: string; title: string },
    type: string
  ) => void;
  ontologyPath: INodePath[];
  setSnackbarMessage: (message: string) => void;

  user: any;
  mainSpecializations: MainSpecializations;
  nodes: { [id: string]: INode };
  addNewNode: ({ id, newNode }: { id: string; newNode: any }) => void;
  editNode: string;
  setEditNode: (state: string) => void;
  lockedNodeFields: ILockedNode;
  recordLogs: (logs: any) => void;
  updateInheritance: (parameters: {
    nodeId: string;
    updatedProperty: string;
  }) => void;
  navigateToNode: (nodeId: string) => void;
  eachOntologyPath: { [key: string]: any };
  searchWithFuse: any;
};
function getRandomProminentColor() {
  // Define a list of prominent colors
  const prominentColors = [
    "#FF5733", // Red-Orange
    "#33FF57", // Green
    "#3357FF", // Blue
    "#FF33A1", // Pink
    "#FFBD33", // Yellow-Orange
    "#33FFBD", // Aqua
    "#8D33FF", // Purple
    "#FF5733", // Coral
    "#FF33FF", // Magenta
    "#FFFF33", // Bright Yellow
  ];

  // Get a random index from the list
  const randomIndex = Math.floor(Math.random() * prominentColors.length);

  // Return the color at the random index
  return prominentColors[randomIndex];
}
const Node = ({
  scrolling,
  currentVisibleNode,
  setCurrentVisibleNode,
  setSnackbarMessage,
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
  searchWithFuse,
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
    setSelectedProperty("");
    setNewCategory("");
    setOpenAddCategory(false);
    setEditCategory(null);
  };
  const [newCategory, setNewCategory] = useState("");
  const [selectedProperty, setSelectedProperty] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [checkedSpecializations, setCheckedSpecializations] = useState<any>([]);
  const [editCategory, setEditCategory] = useState<{
    property: string;
    category: string;
  } | null>(null);
  const { confirmIt, ConfirmDialog } = useConfirmDialog();
  const [rootTitle, setRootTitle] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [newFieldType, setNewFieldType] = useState("String");
  const [openAddField, setOpenAddField] = useState(false);
  const [newFieldTitle, setNewFieldTitle] = useState("");
  const [saveType, setSaveType] = useState("");
  const [viewValue, setViewValue] = useState<number>(0);
  const [viewValueSpecialization, setViewValueSpecialization] =
    useState<number>(1);
  const [selectTitle, setSelectTitle] = useState(false);

  const color = getRandomProminentColor();

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


  const getRooTitle = async (nodeId: string) => {
    if (nodeId) {
      setRootTitle(nodes[nodeId].title);
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
      const parentNodeData = parentNodeDoc.data() as INode;

      // Create a reference for the new node document in Firestore.
      const newNodeRef = doc(collection(db, NODES));

      // Prepare the data for the new node by copying existing data.
      const newNode = {
        ...parentNodeDoc.data(),
      };

      // Set a new ID for the cloned node.
      newNode.id = newNodeRef.id;

      // Modify the title to indicate that it is a new node.
      newNode.title = `New ${parentNodeData.title}`;

      // Initialize an empty specializations object for children.
      newNode.specializations = { main: [] };
      newNode.generalizations = {
        main: [
          {
            id: nodeId,
            title: parentNodeData.title,
          },
        ],
      };

      // Remove the 'locked' property from the new node.
      delete newNode.locked;

      // Update the original node to include the reference to the new node in its children.

      if (!parentNodeData?.specializations.hasOwnProperty("main")) {
        parentNodeData.specializations["main"] = [];
      }
      parentNodeData?.specializations["main"].push({
        id: newNodeRef.id,
        title: `New ${parentNodeData.title}`,
      });

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
        newCloneTitle: newNode.title,
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

  // Function to generate a unique title
  const generateUniqueTitle = (title: string, existingTitles: string[]) => {
    let uniqueTitle = title;
    let count = 1;

    // Check if the title already exists in the array of titles
    while (existingTitles.includes(uniqueTitle)) {
      count++;
      uniqueTitle = `${title} ${count}`; // Append a number if the title already exists
    }

    return uniqueTitle;
  };

  // Function to add a new specialization to the node
  const addNewSpecialization = useCallback(
    async (category: string = "main") => {
      try {
        if (!category) {
          category = "main";
        }

        // Get a reference to the parent node document
        const nodeParentRef = doc(collection(db, NODES), currentVisibleNode.id);

        // Retrieve the parent node document
        const nodeParentDoc = await getDoc(nodeParentRef);

        // Extract data from the parent node document
        const parentNode = {
          ...nodeParentDoc.data(),
          id: nodeParentDoc.id,
        } as INode;

        // Check if the parent node document exists
        if (!nodeParentDoc.exists()) return;

        // Create a new node document reference
        const newNodeRef = doc(collection(db, NODES));
        const inheritance = JSON.parse(
          JSON.stringify({ ...parentNode.inheritance })
        );
        for (let property in inheritance) {
          if (!inheritance[property].ref) {
            inheritance[property].ref = nodeParentDoc.id;
            inheritance[property].title = parentNode.title;
          }
        }
        // Clone the parent node data
        // Check if the specified type and category exist in the parent node
        let newTitle = `New ${parentNode.title}`;
        const specializationsTitles = Object.values(parentNode.specializations)
          .flat()
          .map((spec) => spec.title);
        newTitle = generateUniqueTitle(newTitle, specializationsTitles);
        const newNode = {
          ...nodeParentDoc.data(),
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
                title: newTitle,
                id: newNodeRef.id,
              },
            ],
          };
        } else {
          // Add the new node to the specified type and category
          parentNode.specializations[category].push({
            title: newTitle,
            id: newNodeRef.id,
          });
        }

        // Add the new node to the database
        addNewNode({ id: newNodeRef.id, newNode });

        // Update the parent node document in the database
        setOpenSelectModel(false);
        await updateDoc(nodeParentRef, parentNode);
        setTimeout(() => {
          scrollToTop();
          setSelectTitle(true);
        }, 900);
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

  const showList = async (property: string, category: string) => {
    let newType = property;
    if (
      currentVisibleNode?.propertyType &&
      currentVisibleNode.propertyType[property]
    ) {
      setSaveType(property);
      newType = currentVisibleNode.propertyType[property];
    }

    // const _type = currentVisibleNode.nodeType;
    setOpenSelectModel(true);
    setSelectedProperty(newType);
    setSelectedCategory(category);
    let children = [];
    if (property === "specializations" || property === "generalizations") {
      children = ((currentVisibleNode[property] || {})[category] || []).map(
        (onto: any) => onto.id
      );
    } else {
      children = (
        (currentVisibleNode.properties[property] || {})[category] || []
      ).map((onto: any) => onto.id);
    }

    setCheckedSpecializations(children);
  };
  const selectFromTree = () => {
    if (
      ["parts", "isPartOf", "specializations", "generalizations"].includes(
        selectedProperty
      )
    ) {
      return (
        mainSpecializations[rootTitle.toLowerCase()]?.specializations || {}
      );
    } else {
      return mainSpecializations[selectedProperty]?.specializations || {};
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
    /* const {
      newCloneId,
      newCloneTitle,
    }: { newCloneId: string; newCloneTitle: string } = */

    await cloneNode(node.id);

    // const newPath = eachOntologyPath[node.id];
    // if (newCloneId) {
    //   // Update the user document by appending the new clone's ID to the node path.
    //   newPath.push({ id: newCloneId, title: newCloneTitle, category: false });
    //   updateUserDoc([...newPath]);
    // }

    // Close the modal or perform any necessary cleanup.
  };
  const updateSpecializations = (
    children: { id: string; title: string }[],
    newLink: { id: string; title: string }
  ) => {
    for (let child of children) {
      const childData = nodes[child.id];
      const specializations = childData.specializations;
      const oldSpecializations = Object.keys(specializations).flat();
      const index = oldSpecializations.findIndex(
        (e: any) => e.id === newLink.id
      );

      if (index === -1) {
        specializations["main"].push(newLink);
        const childRef = doc(collection(db, NODES), child.id);
        updateDoc(childRef, {
          specializations,
        });
      }
    }
  };
  const updateGeneralizations = (
    children: { id: string; title: string }[],
    newLink: { id: string; title: string }
  ) => {
    for (let child of children) {
      const childData = nodes[child.id];
      const generalizations = childData.generalizations;
      const keys = Object.keys(generalizations).flat();
      const index = keys.findIndex((e: any) => e.id === newLink.id);
      if (index === -1) {
        generalizations["main"].push(newLink);
        const childRef = doc(collection(db, NODES), child.id);
        updateDoc(childRef, {
          generalizations,
        });
      }
    }
  };

  const handleSaveChildrenChanges = async () => {
    try {
      // Get the node document from the database
      const nodeDoc = await getDoc(
        doc(collection(db, NODES), currentVisibleNode.id)
      );
      const property = saveType || selectedProperty;
      // If the node document does not exist, return early
      if (!nodeDoc.exists()) return;

      // Extract existing node data from the document
      const nodeData: any = nodeDoc.data();

      // Initialize a new array for storing updated children
      let oldChildren = [];

      if (property === "specializations" || property === "generalizations") {
        oldChildren = [...nodeData[property][selectedCategory]];
      } else {
        oldChildren = [
          ...((nodeData.properties[property] || {})[selectedCategory] || []),
        ];
      }
      // Iterate through checkedSpecializations to update newchildren
      for (let checked of checkedSpecializations) {
        // Find the node object from the children array
        const findNode = nodes[checked];

        // Check if the node is not already present in newchildren
        const indexFound = oldChildren.findIndex((onto) => onto.id === checked);
        if (indexFound === -1 && findNode) {
          // Add the node to newchildren if not present
          oldChildren.push({
            id: checked,
            title: findNode.title,
          });
        }
      }

      oldChildren = oldChildren.filter((onto) =>
        checkedSpecializations.includes(onto.id)
      );

      if (property === "generalizations" && oldChildren.length === 0) {
        await confirmIt(
          "You cannot remove all the generalizations for this node make sure it at least link to one generalization",
          "Ok",
          ""
        );
        return;
      }
      // If _type is "specializations", update main children

      if (property === "specializations" || property === "generalizations") {
        nodeData[property][selectedCategory] = oldChildren;
      } else {
        if (!nodeData.properties[property]) {
          nodeData.properties[property] = { [selectedCategory]: oldChildren };
        } else {
          nodeData.properties[property][selectedCategory] = oldChildren;
        }
      }
      if (property === "specializations") {
        updateGeneralizations(Object.values(oldChildren).flat(), {
          id: currentVisibleNode.id,
          title: currentVisibleNode.title,
        });
      }
      if (property === "generalizations") {
        updateSpecializations(Object.values(oldChildren).flat(), {
          id: currentVisibleNode.id,
          title: currentVisibleNode.title,
        });
      }
      // If inheritance is present, reset the children field
      if (
        nodeData.inheritance &&
        property !== "specializations" &&
        property !== "generalizations" &&
        property !== "parts" &&
        property !== "isPartOf" &&
        nodeData.inheritance[property]
      ) {
        nodeData.inheritance[property].ref = null;
        nodeData.inheritance[property].title = "";
      }
      // Update the node document in the database
      await updateDoc(nodeDoc.ref, nodeData);

      // If _type is not "specializations", update the inheritance
      if (property !== "specializations" && property !== "generalizations") {
        updateInheritance({
          nodeId: currentVisibleNode.id,
          updatedProperty: property,
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
            property: editCategory.property,
          });
          if (
            editCategory.property === "specializations" ||
            editCategory.property === "specializations"
          ) {
            // Update ontologyData for the edited category
            ontologyData[editCategory.property][newCategory] =
              ontologyData[editCategory.property][editCategory.category];
            delete ontologyData[editCategory.property][editCategory.category];
          } else {
            // Update ontologyData for the edited category
            ontologyData.properties[editCategory.property][newCategory] =
              ontologyData.properties[editCategory.property][
                editCategory.category
              ];
            delete ontologyData.properties[editCategory.property][
              editCategory.category
            ];
          }
        } else {
          // If it's a new category, create it
          if (
            !ontologyData?.properties[selectedProperty]?.hasOwnProperty(
              newCategory.trim()
            )
          ) {
            if (
              selectedProperty === "specializations" ||
              selectedProperty === "specializations"
            ) {
              ontologyData[selectedProperty] = {
                ...(ontologyData[selectedProperty] || {}),
                [newCategory]: [],
              };
            } else {
              ontologyData.properties[selectedProperty] = {
                ...(ontologyData?.properties[selectedProperty] || {}),
                [newCategory]: [],
              };
            }

            // Log the action of creating a new category
            recordLogs({
              action: "Created a category",
              category: newCategory,
              node: nodeDoc.id,
              field: selectedProperty,
            });
          } else {
            if (editCategory !== null) {
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
            updatedProperty: editCategory
              ? editCategory.property
              : selectedProperty,
          });
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

  const handleNewSpecialization = async (category?: string) => {
    await addNewSpecialization(category || selectedCategory);
    handleClose();
  };

  const handleEditCategory = (property: string, category: string) => {
    setNewCategory(category);
    setOpenAddCategory(true);
    setEditCategory({
      property,
      category,
    });
  };

  const scrollToTop = () => {
    if (scrolling.current) {
      scrolling.current.scrollIntoView({ behaviour: "smooth" });
    }
  };

  const deleteCategory = async (property: string, category: string) => {
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
        if (property === "specializations" || property === "specializations") {
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
      }
    }
  };

  // Function to handle sorting of draggable items
  const handleSorting = useCallback(
    async (result: any, property: string) => {
      try {
        // Destructure properties from the result object
        const { source, destination, draggableId, type } = result;

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
            let propertyValue = null;
            if (
              property === "specializations" ||
              property === "generalizations"
            ) {
              // Get the children and specializations related to the provided subType
              propertyValue = nodeData[property];
            } else {
              propertyValue = nodeData.properties[property];
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
              });
            }

            // Record a log of the sorting action
            recordLogs({
              action: "Moved a field to a category",
              field: property,
              sourceCategory:
                sourceCategory === "main" ? "outside" : sourceCategory,
              destinationCategory:
                destinationCategory === "main"
                  ? "outside"
                  : destinationCategory,
            });
          }
        }
      } catch (error) {
        // Log any errors that occur during the sorting process
        console.error(error);
      }
    },
    [currentVisibleNode, db, nodes, recordLogs]
  );

  /**
   * Removes a child-node with the specified ID from the given node data.
   * @param {Object} params - An object containing ontologyData and id.
   * @param {Object} ontologyData - The main node data object.
   * @param {string} id - The ID of the child-node to be removed.
   */
  const removeSpecializationNode = (
    generalizationNode: INode,
    specializationId: string
  ) => {
    // Iterate over the categories within each type of child-node.
    for (let category in generalizationNode.specializations || {}) {
      // Check if there are children present in the current category.
      if ((generalizationNode.specializations[category] || []).length > 0) {
        // Find the index of the child-node with the specified ID within the children array.
        const specializationIdx = generalizationNode.specializations[
          category
        ].findIndex((sub: any) => sub.id === specializationId);

        // If the child-node with the specified ID is found, remove it from the array.
        if (specializationIdx !== -1) {
          generalizationNode.specializations[category].splice(
            specializationIdx,
            1
          );
        }
      }
    }
    return generalizationNode;
  };
  /**
   * Removes a child-node with the specified ID from the given node data.
   * @param {Object} params - An object containing ontologyData and id.
   * @param {Object} ontologyData - The main node data object.
   * @param {string} id - The ID of the child-node to be removed.
   */
  const removeGeneralizationNode = (
    specializationNode: INode,
    generalizationId: string
  ) => {
    // Iterate over the categories within each type of child-node.
    for (let category in specializationNode.generalizations || {}) {
      // Check if there are children present in the current category.
      if ((specializationNode.generalizations[category] || []).length > 0) {
        // Find the index of the child-node with the specified ID within the children array.
        const specializationIdx = specializationNode.generalizations[
          selectedProperty
        ].findIndex((sub: any) => sub.id === generalizationId);

        // If the child-node with the specified ID is found, remove it from the array.
        if (specializationIdx !== -1) {
          specializationNode.generalizations[selectedProperty].splice(
            specializationIdx,
            1
          );
        }
      }
    }

    return specializationNode;
  };
  // Asynchronous function to handle the deletion of a child-node
  const deleteNode = async () => {
    try {
      // Confirm deletion with the user using a custom confirmation dialog
      if (
        await confirmIt(
          `Are you sure you want to delete this Node?`,
          "Delete Node",
          "Keep Node"
        )
      ) {
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
        const nodeDoc = await getDoc(
          doc(collection(db, NODES), currentVisibleNode.id)
        );
        if (nodeDoc.exists()) {
          // Check if the node document exists
          // Retrieve node data from the document
          const nodeData = nodeDoc.data() as INode;

          // Extract the parent IDs from the node data
          const generalizations = Object.values(
            nodeData?.generalizations
          ).flat();

          // Iterate through each parent ID
          for (let { id: generalizationId } of generalizations) {
            // Retrieve the document reference of the parent node
            const generalizationDoc = await getDoc(
              doc(collection(db, NODES), generalizationId)
            );

            // Check if the parent node document exists
            if (generalizationDoc.exists()) {
              // Retrieve data of the parent node
              let generalizationData = generalizationDoc.data() as INode;

              // Remove the reference to the child-node from the parent
              generalizationData = removeSpecializationNode(
                generalizationData,
                currentVisibleNode.id
              );

              // Update the parent node document with the modified data
              await updateDoc(generalizationDoc.ref, generalizationData);
            }
          }

          for (let { id: specializationId } of specializations) {
            // Retrieve the document reference of the parent node
            const specializationDoc = await getDoc(
              doc(collection(db, NODES), specializationId)
            );

            // Check if the parent node document exists
            if (specializationDoc.exists()) {
              // Retrieve data of the parent node
              let specializationNode = specializationDoc.data() as INode;
              if (
                Object.values(specializationNode.generalizations).length > 1
              ) {
                // Remove the reference to the child-node from the parent
                specializationNode = removeGeneralizationNode(
                  specializationNode,
                  currentVisibleNode.id
                );

                // Update the parent node document with the modified data
                await updateDoc(specializationDoc.ref, specializationNode);
              }
            }
          }
          await updateDoc(nodeDoc.ref, { deleted: true });
          // Update the user document by removing the deleted node's ID
          let lastNodeId: string = ontologyPath.at(-2)?.id || "";

          if (ontologyPath.at(-2)?.category) {
            lastNodeId = ontologyPath.at(-3)?.id || "";
          }

          if (lastNodeId && nodes[lastNodeId]) {
            setCurrentVisibleNode(nodes[lastNodeId]);
          }
          // Mark the node as deleted by updating its document

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
  const addNewProperty = async (
    newProperty: string,
    newPropertyType: string
  ) => {
    try {
      if (!newProperty.trim() || !newPropertyType.trim()) return;
      const nodeRef = doc(collection(db, NODES), currentVisibleNode.id);
      const properties = currentVisibleNode.properties;
      const propertyType = currentVisibleNode.propertyType;
      propertyType[newProperty] = newPropertyType.toLowerCase();

      if (newPropertyType.toLowerCase() === "string") {
        properties[newProperty] = "";
      } else {
        properties[newProperty] = {
          main: [],
        };
      }
      await updateDoc(nodeRef, {
        properties,
        propertyType,
      });

      setOpenAddField(false);
    } catch (error) {
      setOpenAddField(false);
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
    }
  };

  const searchResults = useMemo(() => {
    return searchWithFuse(searchValue, currentVisibleNode.nodeType);
  }, [searchValue]);

  /* "root": "T
  of the direct specializations of 'Act'/'Actor'/'Evaluation Dimension'/'Incentive'/'Reward'. The user should not be able to modify the value of this field. Please automatically specify it by tracing the generalizations of this descendent activity back to reach one of the direct specializations of 'Act'/'Actor'/'Evaluation Dimension'/'Incentive'/'Reward'. So, obviously the root of the node 'Act'/'Actor'/'Evaluation Dimension'/'Incentive'/'Reward' itself and its direct specializations would be empty string because they are already roots."*/

  return (
    <Box
      sx={{
        // padding: "40px 40px 40px 40px",
        pt: "40px",
        mb: "90px",
      }}
    >
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
              </Box>
            </Box>
          </Paper>
          <Paper>
            {searchValue ? (
              <Box>
                {" "}
                {searchResults.map((node: any) => (
                  <ListItem
                    key={node.id}
                    onClick={() => {
                      checkSpecialization(node.id);
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
                        backgroundColor: (theme) =>
                          theme.palette.mode === "dark"
                            ? DESIGN_SYSTEM_COLORS.notebookG450
                            : DESIGN_SYSTEM_COLORS.gray200,
                      },
                    }}
                  >
                    {" "}
                    <Checkbox
                      checked={checkedSpecializations.includes(node.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      onChange={(e) => {
                        e.stopPropagation();
                        checkSpecialization(node.id);
                      }}
                      name={node.id}
                    />
                    <Typography>{node.title}</Typography>
                  </ListItem>
                ))}
              </Box>
            ) : (
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
            )}
          </Paper>
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
            {selectedProperty === "specializations" && (
              <Button
                variant="contained"
                onClick={() => handleNewSpecialization()}
              >
                Add new
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
              <InputLabel id="difficulty-label">Type</InputLabel>
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
                sx={{ borderRadius: "20px" }}
              >
                {[
                  "String",
                  /* "Number",
                  "Boolean", */
                  "Activity",
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
                onChange={(event) => setNewFieldTitle(event.target.value)}
                InputLabelProps={{
                  style: { color: "grey" },
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
            {editCategory ? "Save" : "Add"}
          </Button>
          <Button
            onClick={() => {
              setOpenAddField(false);
              setNewFieldTitle("");
            }}
            color="primary"
            variant="contained"
            sx={{ borderRadius: "25px" }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog onClose={handleCloseAddCategory} open={openAddCategory}>
        <DialogContent>
          <Box sx={{ height: "auto", width: "500px" }}>
            <Typography sx={{ mb: "13px", fontSize: "19px" }}>
              {editCategory ? "Edit " : "Add "}a new Category:
            </Typography>
            <TextField
              placeholder={`Add Category`}
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
          <Button
            onClick={addNewCategory}
            color="primary"
            variant="outlined"
            sx={{ borderRadius: "25px" }}
          >
            {editCategory ? "Save" : "Add"}
          </Button>
          <Button
            onClick={handleCloseAddCategory}
            color="primary"
            variant="outlined"
            sx={{ borderRadius: "25px" }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          width: "100%",
        }}
      >
        {" "}
        <Paper
          sx={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            borderRadius: "25px",
          }}
          elevation={6}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              background: (theme) =>
                theme.palette.mode === "dark" ? "#242425" : "#d0d5dd",

              p: 3,
              pb: 0.5,
              borderTopRightRadius: "25px",
              borderTopLeftRadius: "25px",
            }}
          >
            <Typography
              sx={{
                fontSize: "20px",
                fontWeight: "500",
                mb: "13px",
              }}
            >
              Node Title:
            </Typography>

            {!currentVisibleNode.locked && (
              <Box
                sx={{
                  display: "flex",
                  mb: "5px",
                  ml: "auto",
                  alignItems: "center",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    px: "19px",
                    mb: "15px",
                    alignItems: "center",
                    alignContent: "center",
                  }}
                >
                  {rootTitle && (
                    <Box
                      sx={{
                        display: "flex",
                        mt: "5px",
                        gap: "15px",
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: "19px",
                          fontWeight: "bold",
                          color: (theme) =>
                            theme.palette.mode === "dark"
                              ? theme.palette.common.gray50
                              : theme.palette.common.notebookMainBlack,
                        }}
                      >
                        Root:
                      </Typography>
                      <Link
                        underline="hover"
                        onClick={() => navigateToNode(currentVisibleNode.root)}
                        sx={{
                          cursor: "pointer",
                          textDecoration: "underline",
                          color: "orange",
                        }}
                      >
                        {rootTitle}
                      </Link>
                    </Box>
                  )}
                </Box>
                <Button
                  onClick={deleteNode}
                  variant="contained"
                  sx={{ borderRadius: "25px", mb: "7px" }}
                >
                  Delete Node
                </Button>
              </Box>
            )}
          </Box>

          <Box>
            {currentVisibleNode.locked ? (
              <Typography sx={{ fontSize: "34px", p: "19px" }}>
                {currentVisibleNode.title}
              </Typography>
            ) : (
              <Box>
                <Text
                  currentVisibleNode={currentVisibleNode}
                  setCurrentVisibleNode={setCurrentVisibleNode}
                  nodes={nodes}
                  property={"title"}
                  text={currentVisibleNode.title}
                  confirmIt={confirmIt}
                  color={color}
                  recordLogs={recordLogs}
                  updateInheritance={updateInheritance}
                  setSelectTitle={setSelectTitle}
                  selectTitle={selectTitle}
                />
              </Box>
            )}
          </Box>
        </Paper>
        <Paper
          sx={{
            display: "flex",
            flexDirection: "column",
            borderRadius: "25px",

            width: "100%",
          }}
          elevation={6}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              background: (theme) =>
                theme.palette.mode === "dark" ? "#242425" : "#d0d5dd",

              p: 3,
              borderTopRightRadius: "25px",
              borderTopLeftRadius: "25px",
            }}
          >
            <Typography sx={{ fontSize: "20px", fontWeight: "500" }}>
              Description:
            </Typography>
            {currentVisibleNode.inheritance?.description?.ref && (
              <Typography
                sx={{
                  color: (theme) =>
                    theme.palette.mode === "dark" ? "white" : "black",
                  fontSize: "14px",
                  ml: "auto",
                }}
              >
                {'(Inherited from "'}
                {getTitle(
                  nodes,
                  currentVisibleNode.inheritance.description.ref || ""
                )}
                {'")'}
              </Typography>
            )}
          </Box>
          <Box>
            <Text
              nodes={nodes}
              updateInheritance={updateInheritance}
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
              color={color}
            />
          </Box>
        </Paper>
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
            showList={showList}
            handleEditCategory={handleEditCategory}
            deleteCategory={deleteCategory}
            handleSorting={handleSorting}
            navigateToNode={navigateToNode}
            setSnackbarMessage={setSnackbarMessage}
            setOpenAddCategory={setOpenAddCategory}
            setType={setSelectedProperty}
            setEditNode={setEditNode}
            setOpenAddField={setOpenAddField}
            removeProperty={removeProperty}
            user={user}
            nodes={nodes}
            color={color}
          />
        </Box>
        <Box sx={{ display: "flex", gap: "15px", ...(width <= 1150 && { flexDirection: "column" }) }}>
          <Paper elevation={9} sx={{ width: "100%", borderRadius: "30px" }}>
            <Tabs
              value={viewValueSpecialization}
              onChange={(event: any, newValue: number) => {
                setViewValueSpecialization(newValue);
              }}
              variant="fullWidth"
              sx={{
                background: (theme) =>
                  theme.palette.mode === "dark" ? "#242425" : "#d0d5dd",
                color: "black",
                ".MuiTab-root.Mui-selected": {
                  color: "#ff6d00",
                },
                borderTopLeftRadius: "25px",
                borderTopRightRadius: "25px",
              }}
              aria-label="basic tabs example"
            >
              <Tab
                sx={{ width: "50%", fontSize: "20px", borderRadius: "30px" }}
                label={
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <Typography
                      sx={{
                        color: viewValueSpecialization === 0 ? "#ff6d00" : "",
                        fontSize: "20px",
                        fontWeight: "bold",
                      }}
                    >
                      Generalizations
                    </Typography>
                  </Box>
                }
                {...a11yProps(0)}
              />
              <Tab
                sx={{ width: "50%", fontSize: "20px" }}
                label={
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <Typography
                      sx={{
                        color: viewValueSpecialization === 1 ? "#ff6d00" : "",
                        fontSize: "20px",
                        fontWeight: "bold",
                      }}
                    >
                      Specializations
                    </Typography>
                  </Box>
                }
                {...a11yProps(1)}
              />
            </Tabs>

            <TabPanel
              value={viewValueSpecialization}
              index={0}
              sx={{
                mt: "5px",
              }}
            >
              <LinksSide
                properties={
                  currentVisibleNode?.properties?.generalizations || {}
                }
                currentVisibleNode={currentVisibleNode}
                showList={showList}
                setOpenAddCategory={setOpenAddCategory}
                setType={setSelectedProperty}
                handleSorting={handleSorting}
                handleEditCategory={handleEditCategory}
                deleteCategory={deleteCategory}
                navigateToNode={navigateToNode}
                recordLogs={recordLogs}
                setSnackbarMessage={setSnackbarMessage}
                setCurrentVisibleNode={setCurrentVisibleNode}
                updateInheritance={updateInheritance}
                relationType={"generalizations"}
                nodes={nodes}
              />
            </TabPanel>
            <TabPanel
              value={viewValueSpecialization}
              index={1}
              sx={{
                mt: "5px",
              }}
            >
              <LinksSide
                properties={currentVisibleNode?.specializations || {}}
                currentVisibleNode={currentVisibleNode}
                showList={showList}
                setOpenAddCategory={setOpenAddCategory}
                setType={setSelectedProperty}
                handleSorting={handleSorting}
                handleEditCategory={handleEditCategory}
                deleteCategory={deleteCategory}
                navigateToNode={navigateToNode}
                recordLogs={recordLogs}
                setSnackbarMessage={setSnackbarMessage}
                setCurrentVisibleNode={setCurrentVisibleNode}
                updateInheritance={updateInheritance}
                relationType={"specializations"}
                handleNewSpecialization={handleNewSpecialization}
                nodes={nodes}
              />
            </TabPanel>
          </Paper>
          <Paper elevation={9} sx={{ width: "100%", borderRadius: "25px" }}>
            <Tabs
              value={viewValue}
              onChange={(event: any, newValue: number) => {
                setViewValue(newValue);
              }}
              variant="fullWidth"
              sx={{
                background: (theme) =>
                  theme.palette.mode === "dark" ? "#242425" : "#d0d5dd",
                ".MuiTab-root.Mui-selected": {
                  color: "#ff6d00",
                },
                borderTopLeftRadius: "25px",
                borderTopRightRadius: "25px",
              }}
              aria-label="basic tabs example"
            >
              <Tab
                sx={{ width: "50%", fontSize: "20px" }}
                label={
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <Typography
                      sx={{
                        color: viewValue === 0 ? "#ff6d00" : "",
                        fontSize: "20px",
                        fontWeight: "bold",
                      }}
                    >
                      Is Part of
                    </Typography>
                    {currentVisibleNode.inheritance?.["isPartOf"]?.ref && (
                      <Typography sx={{ fontSize: "14px", ml: "9px" }}>
                        {'(Inherited from "'}
                        {getTitle(
                          nodes,
                          currentVisibleNode.inheritance["isPartOf"].ref || ""
                        )}
                        {'")'}
                      </Typography>
                    )}
                  </Box>
                }
                {...a11yProps(0)}
              />
              <Tab
                sx={{ width: "50%", fontSize: "20px" }}
                label={
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <Typography
                      sx={{
                        color: viewValue === 1 ? "#ff6d00" : "",
                        fontSize: "20px",
                        fontWeight: "bold",
                      }}
                    >
                      Parts
                    </Typography>
                    {currentVisibleNode.inheritance?.["parts"]?.ref && (
                      <Typography sx={{ fontSize: "14px", ml: "9px" }}>
                        {'(Inherited from "'}
                        {getTitle(
                          nodes,
                          currentVisibleNode.inheritance["parts"].ref || ""
                        )}
                        {'")'}
                      </Typography>
                    )}
                  </Box>
                }
                {...a11yProps(1)}
              />
            </Tabs>

            <TabPanel
              value={viewValue}
              index={0}
              sx={{
                mt: "5px",
              }}
            >
              <LinksSideParts
                properties={
                  getPropertyValue(
                    nodes,
                    currentVisibleNode.inheritance.isPartOf.ref,
                    "isPartOf"
                  ) || currentVisibleNode?.properties?.isPartOf
                }
                currentVisibleNode={currentVisibleNode}
                showList={showList}
                setOpenAddCategory={setOpenAddCategory}
                setType={setSelectedProperty}
                handleSorting={handleSorting}
                handleEditCategory={handleEditCategory}
                deleteCategory={deleteCategory}
                navigateToNode={navigateToNode}
                recordLogs={recordLogs}
                setSnackbarMessage={setSnackbarMessage}
                setCurrentVisibleNode={setCurrentVisibleNode}
                updateInheritance={updateInheritance}
                property={"isPartOf"}
                nodes={nodes}
              />
            </TabPanel>
            <TabPanel
              value={viewValue}
              index={1}
              sx={{
                mt: "5px",
                width: "100%",
              }}
            >
              <LinksSideParts
                properties={
                  getPropertyValue(
                    nodes,
                    currentVisibleNode.inheritance.parts.ref,
                    "parts"
                  ) || currentVisibleNode?.properties?.parts
                }
                currentVisibleNode={currentVisibleNode}
                showList={showList}
                setOpenAddCategory={setOpenAddCategory}
                setType={setSelectedProperty}
                handleSorting={handleSorting}
                handleEditCategory={handleEditCategory}
                deleteCategory={deleteCategory}
                navigateToNode={navigateToNode}
                recordLogs={recordLogs}
                setSnackbarMessage={setSnackbarMessage}
                setCurrentVisibleNode={setCurrentVisibleNode}
                updateInheritance={updateInheritance}
                property={"parts"}
                nodes={nodes}
              />
            </TabPanel>
          </Paper>
        </Box>
      </Box>

      {ConfirmDialog}
    </Box>
  );
};

export default Node;
