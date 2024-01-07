/* # Ontology Component Documentation

The `Ontology` component is a complex React component that is part of a larger application, likely dealing with the management and visualization of ontologies in a hierarchical structure. This component interacts with a Firestore database to perform CRUD operations on ontology data and provides a user interface for these operations.

## Overview

The `Ontology` component allows users to:

- View and edit the title and description of an ontology.
- Manage sub-ontologies and their categories.
- Clone existing ontologies.
- Add new specializations to ontologies.
- Select and save sub-ontologies.
- Delete documents(nodes) and categories.
- Lock and unlock ontology fields for editing.
- Drag and drop sub-ontologies to reorganize them.

## Dependencies

The component imports several libraries and components:

- Material-UI components for UI elements.
- Firebase Firestore for database operations.
- `react-beautiful-dnd` for drag-and-drop functionality.
- Custom hooks and types from the project's internal structure.

## Props

The `Ontology` component accepts the following props:

- `openOntology`: The current ontology object being viewed or edited.
- `setOpenOntology`: Function to update the current ontology.
- `saveSubOntology`: Function to save a sub-ontology.
- `setSnackbarMessage`: Function to display messages to the user.
- `updateUserDoc`: Function to update the user document in the database.
- `mainSpecializations`: Object containing main specializations data.
- `ontologies`: Array of ontology objects.
- `addNewNode`: Function to add a new ontology.
- `ontologyPath`: Array representing the path of the current ontology in the hierarchy.
- `editOntology`: String indicating the ontology being edited.
- `setEditOntology`: Function to set the ontology being edited.
- `lockedOntology`: Object containing information about locked ontologies.
- `recordLogs`: Function to record logs of actions.
- `updateInheritance`: Function to update inheritance data.

## Component Structure

The component is structured into several parts:

- Dialogs for adding categories and selecting sub-ontologies.
- `Text` components for editing the title and description.
- A list of sub-ontologies that can be managed through UI elements like buttons and checkboxes.
- A `TreeView` component to visualize the ontology hierarchy.
- Drag-and-drop context for reordering sub-ontologies.

## Functions

The component includes several functions for handling various actions:

- `cloneOntology`: Clones an existing ontology.
- `getInheritance`: Retrieves inheritance data for an ontology.
- `addNewSpecialisation`: Adds a new specialization to an ontology.
- `showList`: Displays a list of sub-ontologies for selection.
- `handleCloning`: Handles the cloning of an ontology.
- `TreeViewSimplified`: Renders a simplified tree view of the ontology hierarchy.
- `handleSave`: Saves changes made to the ontology.
- `addCategory`: Adds a new category to the ontology.
- `getCurrentSpecializations`: Retrieves the current specializations for the ontology.
- `handleNewSpec`: Handles the addition of a new specialization.
- `handleEditCategory`: Handles the editing of a category.
- `deleteCategory`: Deletes a category from the ontology.
- `addLock`: Adds or removes a lock on an ontology field.
- `handleSorting`: Handles the sorting of sub-ontologies.
- `removeSubOntology`: Removes a sub-ontology from the ontology data.
- `deleteSubOntologyEditable`: Deletes an editable sub-ontology.

## Usage

To use the `Ontology` component, it must be provided with the necessary props, including the current ontology data, functions for updating the state, and any additional configuration required for interacting with the Firestore database.

## Example

```jsx
<Ontology
  openOntology={currentOntology}
  setOpenOntology={setCurrentOntology}
  saveSubOntology={handleSaveSubOntology}
  setSnackbarMessage={showSnackbarMessage}
  updateUserDoc={updateUserDocument}
  mainSpecializations={specializationsData}
  ontologies={ontologyList}
  addNewNode={handleaddNewNode}
  ontologyPath={currentOntologyPath}
  editOntology={ontologyBeingEdited}
  setEditOntology={setOntologyBeingEdited}
  lockedOntology={lockedOntologies}
  recordLogs={logActions}
  updateInheritance={handleUpdateInheritance}
/>
```

## Notes

- The component assumes a specific data structure for ontologies and their relationships.
- The Firestore database structure and security rules should be configured to work with this component.
- The component includes commented-out imports and state variables that may be part of the larger application context.
- The `ORDER_SUBONTOLOGIES` object defines the order in which sub-ontologies should be displayed.

## Conclusion

The `Ontology` component is a key part of an application that manages ontological data. It provides a rich set of features for interacting with ontologies and their hierarchical structure, making it a powerful tool for users who need to manage complex data relationships. */
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
  ILockedOntology,
  INode,
  INodePath,
  IProcess,
  IReward,
  IRole,
  ISubOntology,
  MainSpecializations,
} from " @components/types/INode";
import { LOCKS, NODES } from " @components/lib/firestoreClient/collections";
import ChildNode from "./ChildNode";

type INodeProps = {
  openOntology: INode;
  setOpenOntology: (ontology: INode) => void;
  handleLinkNavigation: (
    path: { id: string; title: string },
    type: string
  ) => void;
  setOntologyPath: (state: INodePath[]) => void;
  ontologyPath: INodePath[];
  saveSubOntology: (
    subOntology: ISubOntology,
    type: string,
    id: string
  ) => void;
  setSnackbarMessage: (message: string) => void;
  updateUserDoc: (ids: string[]) => void;
  user: any;
  mainSpecializations: MainSpecializations;
  ontologies: INode[];
  addNewNode: ({ id, newNode }: { id: string; newNode: any }) => void;
  ONTOLOGY_TYPES: {
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
  editOntology: string;
  setEditOntology: (state: string) => void;
  lockedOntology: ILockedOntology;
  recordLogs: (logs: any) => void;
  updateInheritance: (parameters: {
    updatedNode: INode;
    updatedField: string;
    type: "subOntologies" | "plainText";
    newValue: any;
    ancestorTitle: string;
  }) => void;
};

const ORDER_SUBONTOLOGIES: { [key: string]: string[] } = {
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
  openOntology,
  setOpenOntology,
  saveSubOntology,
  setSnackbarMessage,
  updateUserDoc,
  mainSpecializations,
  ontologies,
  addNewNode,
  // INITIAL_VALUES,
  ontologyPath,
  editOntology,
  setEditOntology,
  lockedOntology,
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

  // This asynchronous function clones an ontology identified by its ID.
  const cloneNode = async (ontologyId: string) => {
    try {
      // Retrieve the document of the original ontology from Firestore.
      const nodeDoc = await getDoc(doc(collection(db, NODES), ontologyId));

      // If the ontology document doesn't exist, return early.
      if (!nodeDoc.exists()) return;

      // Extract data from the original ontology document.
      const nodeData = nodeDoc.data();

      // Create a reference for the new ontology document in Firestore.
      const newNodeRef = doc(collection(db, NODES));

      // Prepare the data for the new ontology by copying existing data.
      const newNode: any = {
        ...nodeDoc.data(),
      };

      // Set a new ID for the cloned ontology.
      newNode.id = newNodeRef.id;

      // Update the parents array to include the ID of the original ontology.
      newNode.parents = [nodeDoc.id];

      // Modify the title to indicate that it is a new ontology.
      newNode.title = `New ${nodeData.title}`;

      // Initialize an empty Specializations object for sub-ontologies.
      newNode.subOntologies.Specializations = {};

      // Remove the 'locked' property from the new ontology.
      delete newNode.locked;

      // Update the original ontology to include the reference to the new ontology in its sub-ontologies.
      nodeData.subOntologies.Specializations = {
        ["main"]: {
          ontologies: [
            ...(nodeData.subOntologies?.Specializations["main"]?.ontologies ||
              []),
            {
              id: newNodeRef.id,
              title: `New ${nodeData.title}`,
            },
          ],
        },
      };

      // Update the original ontology document in Firestore with the modified data.
      await updateDoc(nodeDoc.ref, nodeData);

      // Create a new document in Firestore for the cloned ontology with the modified data.
      await setDoc(newNodeRef, newNode);

      // Return the ID of the newly created ontology.
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
    type: "plainText" | "subOntologies",
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
    const ancestorTitle = parentNode.title;
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

  // Function to add a new specialization to the ontology
  const addNewSpecialisation = async (type: string, category: string) => {
    try {
      // Get a reference to the parent ontology document
      const ontologyParentRef = doc(collection(db, NODES), openOntology.id);

      // Retrieve the parent ontology document
      const ontologyParentDoc = await getDoc(ontologyParentRef);

      // Extract data from the parent ontology document
      const parentNode: any = {
        ...ontologyParentDoc.data(),
        id: ontologyParentDoc.id,
      };

      // Check if the parent ontology document exists
      if (!ontologyParentDoc.exists()) return;

      // Create a new ontology document reference
      const newNodeRef = doc(collection(db, NODES));

      // Clone the parent ontology data
      const newNode = { ...ontologyParentDoc.data() };

      // Initialize the Specializations sub-ontology
      newNode.subOntologies.Specializations = {};

      // Remove unnecessary fields from the new ontology
      delete newNode.locked;
      delete newNode.cat;

      // Set the parents and title for the new ontology
      newNode.parents = [openOntology.id];
      newNode.title = `New ${parentNode.title}`;
      newNode.id = newNodeRef.id;

      let descriptionInheritance: { ref: string; title: string } = {
        ref: parentNode.id,
        title: parentNode.title,
      };
      if (
        parentNode.inheritance &&
        parentNode.inheritance.plainText["description"]?.ref
      ) {
        descriptionInheritance = {
          ref: parentNode.inheritance.plainText["description"]?.ref,
          title: parentNode.inheritance.plainText["description"]?.title,
        };
      }
      // Build the inheritance object for the new ontology
      newNode.inheritance = {
        plainText: {
          ...getInheritance(
            Object.keys(newNode.plainText),
            "plainText",
            parentNode
          ),
          description: {
            ...descriptionInheritance,
          },
        },
        subOntologies: {
          ...getInheritance(
            Object.keys(newNode.subOntologies),
            "subOntologies",
            parentNode
          ),
        },
      };

      // Check if the specified type and category exist in the parent ontology
      if (!parentNode.subOntologies[type].hasOwnProperty(category)) {
        // If not, create the specified type and category
        parentNode.subOntologies[type] = {
          ...parentNode.subOntologies[type],
          [category]: {
            ontologies: [],
          },
        };
      }

      // Add the new ontology to the specified type and category
      parentNode.subOntologies[type][category].ontologies.push({
        title: `New ${parentNode.title}`,
        id: newNodeRef.id,
      });

      // Update the user document with the ontology path
      updateUserDoc([
        ...ontologyPath.map((path: any) => path.id),
        newNodeRef.id,
      ]);

      // Add the new ontology to the database
      addNewNode({ id: newNodeRef.id, newNode });

      // Update the parent ontology document in the database
      await updateDoc(ontologyParentRef, parentNode);
    } catch (error) {
      // Handle errors by logging to the console
      console.error(error);
    }
  };

  const showList = async (type: string, category: string) => {
    if (type !== "Specializations") {
      setOpen(true);
      setType(type);
      setSelectedCategory(category);
      const specializations = (
        openOntology.subOntologies[type][category]?.ontologies || []
      ).map((onto: any) => onto.id);
      setCheckedSpecializations(specializations || []);
    } else {
      await addNewSpecialisation(type, category);
    }
  };

  // This function handles the cloning of an ontology.
  const handleCloning = async (ontology: any) => {
    // Call the asynchronous function to clone the ontology with the given ID.
    const newCloneId = await cloneNode(ontology.id);

    // Update the user document by appending the new clone's ID to the ontology path.
    updateUserDoc([...ontology.path, newCloneId]);

    // Close the modal or perform any necessary cleanup.
    handleClose();
  };

  const handleSave = async () => {
    try {
      // Get the ontology document from the database
      const ontologyDoc = await getDoc(
        doc(collection(db, NODES), openOntology.id)
      );

      // If the ontology document does not exist, return early
      if (!ontologyDoc.exists()) return;

      // Extract existing ontology data from the document
      const ontologyData: any = ontologyDoc.data();

      // Initialize a new array for storing updated sub-ontologies
      const newSubOntologies =
        type === "Specializations"
          ? [...ontologyData.subOntologies[type][selectedCategory].ontologies]
          : [];

      // Iterate through checkedSpecializations to update newSubOntologies
      for (let checkd of checkedSpecializations) {
        // Find the ontology object from the ontologies array
        const findOntology = ontologies.find(
          (ontology: any) => ontology.id === checkd
        );

        // Check if the ontology is not already present in newSubOntologies
        const indexFound = newSubOntologies.findIndex(
          (onto) => onto.id === checkd
        );
        if (indexFound === -1 && findOntology) {
          // Add the ontology to newSubOntologies if not present
          newSubOntologies.push({
            id: checkd,
            title: findOntology.title,
          });
        }
      }

      // If type is "Specializations", update main ontologies
      if (type === "Specializations") {
        ontologyData.subOntologies[type]["main"].ontologies =
          ontologyData.subOntologies[type]["main"].ontologies.filter(
            (ontology: any) =>
              newSubOntologies.findIndex((o) => o.id === ontology.id) === -1
          );
      }

      // Update the ontology data with the new subOntologies
      ontologyData.subOntologies[type] = {
        ...(ontologyData.subOntologies[type] || {}),
        [selectedCategory]: {
          ontologies: newSubOntologies,
        },
      };

      // If inheritance is present, reset the subOntologies field
      if (ontologyData.inheritance) {
        ontologyData.inheritance.subOntologies[type] = {
          ref: null,
          title: "",
        };
      }

      // Update the ontology document in the database
      await updateDoc(ontologyDoc.ref, ontologyData);

      // If type is not "Specializations", update the inheritance
      if (type !== "Specializations") {
        updateInheritance({
          updatedNode: { ...ontologyData, id: openOntology.id },
          updatedField: type,
          type: "subOntologies",
          newValue: ontologyData.subOntologies[type],
          ancestorTitle: ontologyData.title,
        });
      }

      // Close the modal or perform any other necessary actions
      handleClose();
    } catch (error) {
      // Handle any errors that occur during the process
      console.error(error);
    }
  };

  const addCatgory = useCallback(async () => {
    try {
      // Check if newCategory is provided
      if (!newCategory) return;

      // Fetch the ontology document based on the openOntology.id
      const ontologyDoc = await getDoc(
        doc(collection(db, NODES), openOntology.id)
      );

      // Check if the ontology document exists
      if (ontologyDoc.exists()) {
        // Retrieve ontology data from the document
        const ontologyData = ontologyDoc.data();

        // If editCategory is provided, update existing category
        if (editCategory) {
          // Log the action of editing a category
          recordLogs({
            action: "Edited a category",
            previousValue: editCategory.category,
            newValue: newCategory,
            ontology: ontologyDoc.id,
            feild: editCategory.type,
          });

          // Update ontologyData for the edited category
          ontologyData.subOntologies[editCategory.type][newCategory] =
            ontologyData.subOntologies[editCategory.type][
              editCategory.category
            ];
          delete ontologyData.subOntologies[editCategory.type][
            editCategory.category
          ];
        } else {
          // If it's a new category, create it
          if (!ontologyData?.subOntologies[type]?.hasOwnProperty(newCategory)) {
            ontologyData.subOntologies[type] = {
              ...(ontologyData?.subOntologies[type] || {}),
              [newCategory]: {
                ontologies: [],
              },
            };
          }

          // Log the action of creating a new category
          recordLogs({
            action: "Created a category",
            category: newCategory,
            ontology: ontologyDoc.id,
            feild: type,
          });
        }

        // Update the ontology document with the modified data
        await updateDoc(ontologyDoc.ref, ontologyData);

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

    // Filter ontologies based on a condition
    const _specializations = ontologies.filter((onto: any) => {
      // Find the index of ontology in the main specializations list
      const findIdx = (
        openOntology?.subOntologies?.Specializations["main"]?.ontologies || []
      ).findIndex((o: any) => o.id === onto.id);

      // Include ontology in the filtered list if found in the main specializations list
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
      const ontologyDoc = await getDoc(
        doc(collection(db, NODES), openOntology.id)
      );
      if (ontologyDoc.exists()) {
        const ontologyData = ontologyDoc.data();
        ontologyData.subOntologies[type]["main"] = {
          ontologies: [
            ...(ontologyData.subOntologies[type]["main"]?.ontologies || []),
            ...ontologyData.subOntologies[type][category].ontologies,
          ],
        };
        delete ontologyData.subOntologies[type][category];
        await updateDoc(ontologyDoc.ref, ontologyData);
        await recordLogs({
          action: "Deleted a category",
          category,
          ontology: ontologyDoc.id,
        });
      }
    }
  };

  // This function adds or removes a lock for a specific user on a given ontology field.

  const addLock = async (ontology: string, field: string, type: string) => {
    try {
      // Check if a user is authenticated before proceeding
      if (!user) return;

      // If the type is 'add', create a new lock and add it to the 'ontologyLock' collection
      if (type == "add") {
        // Create a new lock object with user information, ontology, field, and timestamp
        const newLock = {
          uname: user?.uname,
          ontology,
          field,
          deleted: false,
          createdAt: new Date(),
        };

        // Get a reference to the 'ontologyLock' collection
        const ontologyDocref = doc(collection(db, LOCKS));

        // Set the document with the new lock information
        await setDoc(ontologyDocref, newLock);
      } else {
        // If the type is not 'add', remove existing locks for the specified ontology, field, and user
        const locksDocs = await getDocs(
          query(
            collection(db, LOCKS),
            where("field", "==", field),
            where(NODES, "==", ontology),
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
          // Retrieve ontology document from the database
          const ontologyDoc = await getDoc(
            doc(collection(db, NODES), openOntology.id)
          );

          // Check if ontology document exists
          if (ontologyDoc.exists()) {
            // Extract ontology data from the document
            const ontologyData = ontologyDoc.data();

            // Get the sub-ontologies and specializations related to the provided subType
            const specializations = ontologyData.subOntologies[subType];

            // Find the index of the draggable item in the source category
            const ontoIdx = specializations[
              sourceCategory
            ].ontologies.findIndex((onto: any) => onto.id === draggableId);

            // If the draggable item is found in the source category
            if (ontoIdx !== -1) {
              // Move the item to the destination category
              specializations[destinationCategory].ontologies.push(
                specializations[sourceCategory].ontologies[ontoIdx]
              );

              // Remove the item from the source category
              specializations[sourceCategory].ontologies.splice(ontoIdx, 1);
            }

            // Update the ontology data with the modified specializations
            ontologyData.subOntologies[subType] = specializations;

            // Update the ontology document in the database
            await updateDoc(ontologyDoc.ref, ontologyData);

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
   * Removes a sub-ontology with the specified ID from the given ontology data.
   * @param {Object} params - An object containing ontologyData and id.
   * @param {Object} ontologyData - The main ontology data object.
   * @param {string} id - The ID of the sub-ontology to be removed.
   */
  const removeSubOntology = ({ ontologyData, id }: any) => {
    // Iterate over the types of sub-ontologies in the main ontology data.
    for (let type in ontologyData.subOntologies) {
      // Iterate over the categories within each type of sub-ontology.
      for (let category in ontologyData.subOntologies[type] || {}) {
        // Check if there are ontologies present in the current category.
        if (
          (ontologyData.subOntologies[type][category].ontologies || []).length >
          0
        ) {
          // Find the index of the sub-ontology with the specified ID within the ontologies array.
          const subOntologyIdx = ontologyData.subOntologies[type][
            category
          ].ontologies.findIndex((sub: any) => sub.id === id);

          // If the sub-ontology with the specified ID is found, remove it from the array.
          if (subOntologyIdx !== -1) {
            ontologyData.subOntologies[type][category].ontologies.splice(
              subOntologyIdx,
              1
            );
          }
        }
      }
    }
  };

  // Asynchronous function to handle the deletion of a sub-ontology
  const deleteSubOntologyEditable = async () => {
    try {
      // Log a message indicating the start of the function
      console.info("deleteSubOntologyEditable");

      // Confirm deletion with the user using a custom confirmation dialog
      if (
        await confirmIt(
          "Are you sure you want to delete this Document?",
          "Delete Document",
          "Keep Document"
        )
      ) {
        // Retrieve the document reference of the ontology to be deleted
        const ontologyDoc = await getDoc(
          doc(collection(db, NODES), openOntology.id)
        );

        // Check if the ontology document exists
        if (ontologyDoc.exists()) {
          // Retrieve ontology data from the document
          const ontologyData = ontologyDoc.data();

          // Extract the parent IDs from the ontology data
          const parents = ontologyData?.parents || [];

          // Iterate through each parent ID
          for (let parent of parents) {
            // Retrieve the document reference of the parent ontology
            const parentDoc = await getDoc(doc(collection(db, NODES), parent));

            // Check if the parent ontology document exists
            if (parentDoc.exists()) {
              // Retrieve data of the parent ontology
              const ontologyData = parentDoc.data();

              // Remove the reference to the sub-ontology from the parent
              removeSubOntology({ ontologyData, id: ontologyDoc.id });

              // Update the parent ontology document with the modified data
              await updateDoc(parentDoc.ref, ontologyData);
            }
          }

          // Update the user document by removing the deleted ontology's ID
          updateUserDoc([
            ...ontologyPath.slice(0, -1).map((path: any) => path.id),
          ]);

          // Mark the ontology as deleted by updating its document
          await updateDoc(ontologyDoc.ref, { deleted: true });

          // Record a log entry for the deletion action
          recordLogs({
            action: "Deleted Ontology",
            ontology: ontologyDoc.id,
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
          <Button onClick={handleSave} color="primary">
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
          <Button onClick={addCatgory} color="primary">
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
          lockedOntology={lockedOntology[openOntology.id] || {}}
          addLock={addLock}
          text={openOntology.title}
          openOntology={openOntology}
          type={"title"}
          setSnackbarMessage={setSnackbarMessage}
          setOpenOntology={setOpenOntology}
          editOntology={editOntology}
          setEditOntology={setEditOntology}
          deleteSubOntologyEditable={deleteSubOntologyEditable}
        />
        <Text
          updateInheritance={updateInheritance}
          recordLogs={recordLogs}
          user={user}
          lockedOntology={lockedOntology[openOntology.id] || {}}
          addLock={addLock}
          text={openOntology.description}
          openOntology={openOntology}
          type={"description"}
          setSnackbarMessage={setSnackbarMessage}
          setOpenOntology={setOpenOntology}
          setEditOntology={setEditOntology}
        />
      </Box>

      <Box key={openOntology.id} sx={{ mb: "15px", mt: "25px" }}>
        <Box>
          {(
            ORDER_SUBONTOLOGIES[openOntology?.ontologyType as string] || []
          ).map((type: string) =>
            // if it' a subOntologies we need to render it as one otherwise it's a Plain Text
            Object.keys(openOntology.subOntologies).includes(type) ? (
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
                    {(openOntology.inheritance || {}).subOntologies &&
                      (openOntology.inheritance || {}).subOntologies[type]
                        ?.ref && (
                        <Typography sx={{ color: "grey" }}>
                          {"("}
                          {"Inherited from "}
                          {'"'}
                          {(openOntology.inheritance || {}).subOntologies[type]
                            ?.title || ""}
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
                        {Object.keys(openOntology?.subOntologies[type])
                          .sort((a, b) => {
                            if (a === "main") return -1;
                            if (b === "main") return 1;
                            return a.localeCompare(b); // Alphabetical order for other keys
                          })
                          .map((category: any) => {
                            const subOntologies =
                              openOntology?.subOntologies[type][category]
                                ?.ontologies || [];
                            const showGap =
                              Object.keys(
                                openOntology?.subOntologies[type]
                              ).filter(
                                (c) =>
                                  (
                                    openOntology?.subOntologies[type][c]
                                      ?.ontologies || []
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

                                {(subOntologies.length > 0 || showGap) && (
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
                                            // minHeight: /* subOntologies.length > 0 ?  */ "25px" /*  : "" */,
                                            userSelect: "none",
                                          }}
                                        >
                                          {subOntologies.map(
                                            (subOntology: any, index: any) => {
                                              return (
                                                <Draggable
                                                  key={subOntology.id}
                                                  draggableId={subOntology.id}
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
                                                        recordLogs={recordLogs}
                                                        setSnackbarMessage={
                                                          setSnackbarMessage
                                                        }
                                                        saveSubOntology={
                                                          saveSubOntology
                                                        }
                                                        openOntology={
                                                          openOntology
                                                        }
                                                        setOpenOntology={
                                                          setOpenOntology
                                                        }
                                                        sx={{ mt: "15px" }}
                                                        key={openOntology.id}
                                                        subOntology={
                                                          subOntology
                                                        }
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
                      {Object.keys(openOntology?.subOntologies[type]).map(
                        (category: any) => {
                          const subOntologies =
                            openOntology?.subOntologies[type][category]
                              ?.ontologies || [];
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
                                {subOntologies.map((subOntology: any) => {
                                  return (
                                    <li key={subOntology.id}>
                                      <ChildNode
                                        recordLogs={recordLogs}
                                        setSnackbarMessage={setSnackbarMessage}
                                        saveSubOntology={saveSubOntology}
                                        openOntology={openOntology}
                                        setOpenOntology={setOpenOntology}
                                        sx={{ mt: "15px" }}
                                        key={openOntology.id}
                                        subOntology={subOntology}
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
              Object.keys(openOntology.plainText).includes(type) && (
                <Box key={type}>
                  <Text
                    updateInheritance={updateInheritance}
                    recordLogs={recordLogs}
                    user={user}
                    lockedOntology={lockedOntology[openOntology.id] || {}}
                    addLock={addLock}
                    text={openOntology.plainText[type]}
                    openOntology={openOntology}
                    type={type}
                    setSnackbarMessage={setSnackbarMessage}
                    setOpenOntology={setOpenOntology}
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
