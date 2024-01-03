/* # Ontology Component Documentation

The `Ontology` component is a complex React component that is part of a larger application, likely dealing with the management and visualization of ontologies in a hierarchical structure. This component interacts with a Firestore database to perform CRUD operations on ontology data and provides a user interface for these operations.

## Overview

The `Ontology` component allows users to:

- View and edit the title and description of an ontology.
- Manage sub-ontologies and their categories.
- Clone existing ontologies.
- Add new specializations to ontologies.
- Select and save sub-ontologies.
- Delete ontologies and categories.
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
- `addNewOntology`: Function to add a new ontology.
- `ontologyPath`: Array representing the path of the current ontology in the hierarchy.
- `editOntology`: String indicating the ontology being edited.
- `setEditOntology`: Function to set the ontology being edited.
- `lockedOntology`: Object containing information about locked ontologies.
- `recordLogs`: Function to record logs of actions.
- `updateInheritance`: Function to update inheritance data.

## Component Structure

The component is structured into several parts:

- Dialogs for adding categories and selecting sub-ontologies.
- `SubPlainText` components for editing the title and description.
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
  addNewOntology={handleAddNewOntology}
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

import SubOntology from "./SubOntology";
import SubPlainText from "./SubPlainText";
import useConfirmDialog from " @components/lib/hooks/useConfirmDialog";
import { DESIGN_SYSTEM_COLORS } from " @components/lib/theme/colors";
import {
  IActivity,
  IActor,
  IEvaluation,
  IGroup,
  IIncentive,
  ILockecOntology,
  IOntology,
  IOntologyPath,
  IProcesse,
  IReward,
  IRole,
  ISubOntology,
  MainSpecializations,
} from " @components/types/IOntology";

type IOntologyProps = {
  openOntology: IOntology;
  setOpenOntology: (ontology: IOntology) => void;
  handleLinkNavigation: (
    path: { id: string; title: string },
    type: string
  ) => void;
  setOntologyPath: (state: IOntologyPath[]) => void;
  ontologyPath: IOntologyPath[];
  saveSubOntology: (
    subOntology: ISubOntology,
    type: string,
    id: string
  ) => void;
  setSnackbarMessage: (message: string) => void;
  updateUserDoc: (ids: string[]) => void;
  user: any;
  mainSpecializations: MainSpecializations;
  ontologies: IOntology[];
  addNewOntology: ({
    id,
    newOntology,
  }: {
    id: string;
    newOntology: any;
  }) => void;
  INITIAL_VALUES: {
    [key: string]:
      | IActivity
      | IActor
      | IProcesse
      | IEvaluation
      | IRole
      | IIncentive
      | IReward
      | IGroup;
  };
  editOntology: string;
  setEditOntology: (state: string) => void;
  lockedOntology: ILockecOntology;
  recordLogs: (logs: any) => void;
  updateInhiretance: (parameters: {
    updatedOntology: IOntology;
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

const Ontology = ({
  openOntology,
  setOpenOntology,
  saveSubOntology,
  setSnackbarMessage,
  updateUserDoc,
  mainSpecializations,
  ontologies,
  addNewOntology,
  // INITIAL_VALUES,
  ontologyPath,
  editOntology,
  setEditOntology,
  lockedOntology,
  user,
  recordLogs,
  updateInhiretance,
}: IOntologyProps) => {
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
  // const {
  //   palette: { mode },
  // } = useTheme();

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

  const cloneOntology = async (ontologyId: string) => {
    try {
      const ontologyDoc = await getDoc(
        doc(collection(db, "ontology"), ontologyId)
      );
      if (!ontologyDoc.exists()) return;
      const ontologyData = ontologyDoc.data();
      const newOntologyRef = doc(collection(db, "ontology"));
      const newOntology: any = {
        ...ontologyDoc.data(),
      };
      newOntology.id = newOntologyRef.id;
      newOntology.parents = [ontologyDoc.id];
      newOntology.title = `New ${ontologyData.title}`;
      newOntology.subOntologies.Specializations = {};
      delete newOntology.locked;
      ontologyData.subOntologies.Specializations = {
        ["main"]: {
          ontologies: [
            ...(ontologyData.subOntologies?.Specializations["main"]
              ?.ontologies || []),
            {
              id: newOntologyRef.id,
              title: `New ${ontologyData.title}`,
            },
          ],
        },
      };
      await updateDoc(ontologyDoc.ref, ontologyData);
      await setDoc(newOntologyRef, newOntology);
      return newOntologyRef.id;
    } catch (error) {
      console.error(error);
    }
  };

  const getInheritance = (
    fields: string[],
    ancestorTitle: string
  ): {
    [key: string]: {
      ref: string;
      title: string;
    };
  } => {
    const inheritance: {
      [key: string]: {
        ref: string;
        title: string;
      };
    } = {};
    fields
      .filter((f) => f !== "Specializations")
      .forEach(
        (p) =>
          (inheritance[p] = {
            ref: openOntology.id,
            title: (openOntology.inheritance &&
            openOntology.inheritance[p]?.title
              ? openOntology.inheritance[p]?.title
              : ancestorTitle) as string,
          })
      );
    return inheritance;
  };

  const addNewSpecialisation = async (type: string, category: string) => {
    try {
      const ontologyParentRef = doc(
        collection(db, "ontology"),
        openOntology.id
      );
      const ontologyParentDoc = await getDoc(ontologyParentRef);
      const ontologyParent: any = ontologyParentDoc.data();
      if (!ontologyParentDoc.exists()) return;
      const newOntologyRef = doc(collection(db, "ontology"));

      const newOntology = { ...ontologyParentDoc.data() };
      newOntology.subOntologies.Specializations = {};
      delete newOntology.locked;
      delete newOntology.cat;
      newOntology.parents = [openOntology.id];
      newOntology.title = `New ${ontologyParent.title}`;
      newOntology.id = newOntologyRef.id;
      newOntology.inheritance = {
        plainText: {
          ...getInheritance(
            Object.keys(newOntology.plainText),
            ontologyParent.title
          ),
          description: {
            ref: openOntology.id,
            title: openOntology.inheritance
              ? openOntology.inheritance["description"]?.title ||
                ontologyParent.title
              : ontologyParent.title,
          },
        },
        subOntologies: {
          ...getInheritance(
            Object.keys(newOntology.subOntologies),
            ontologyParent.title
          ),
        },
      };

      if (!ontologyParent.subOntologies[type].hasOwnProperty(category)) {
        ontologyParent.subOntologies[type] = {
          ...ontologyParent.subOntologies[type],
          [category]: {
            ontologies: [],
          },
        };
      }
      ontologyParent.subOntologies[type][category].ontologies.push({
        title: `New ${ontologyParent.title}`,
        id: newOntologyRef.id,
      });
      updateUserDoc([
        ...ontologyPath.map((path: any) => path.id),
        newOntologyRef.id,
      ]);
      addNewOntology({ id: newOntologyRef.id, newOntology });
      await updateDoc(ontologyParentRef, ontologyParent);
    } catch (error) {
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

  const handleCloning = async (ontology: any) => {
    const newCloneId = await cloneOntology(ontology.id);
    updateUserDoc([...ontology.path, newCloneId]);
    handleClose();
  };

  const TreeViewSimplified = useCallback(
    ({ mainSpecializations, clone }: any) => {
      const expanded = [];
      for (let category of Object.keys(mainSpecializations)) {
        expanded.push(mainSpecializations[category].id);
      }
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
          {Object.keys(mainSpecializations).map((category) => (
            <TreeItem
              key={mainSpecializations[category]?.id || category}
              nodeId={mainSpecializations[category]?.id || category}
              sx={{ mt: "5px" }}
              label={
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    height: "auto",
                    minHeight: "50px",
                    mt: "5px",
                  }}
                >
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
                  <Typography>
                    {category.split(" ").splice(0, 3).join(" ") +
                      (category.split(" ").length > 3 ? "..." : "")}
                  </Typography>
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
              {Object.keys(mainSpecializations[category].specializations)
                .length > 0 && (
                <TreeViewSimplified
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
    [mainSpecializations, checkedSpecializations]
  );

  const handleSave = async () => {
    try {
      const ontologyDoc = await getDoc(
        doc(collection(db, "ontology"), openOntology.id)
      );
      if (!ontologyDoc.exists()) return;
      const ontologyData: any = ontologyDoc.data();
      const newSubOntologies =
        type === "Specializations"
          ? [...ontologyData.subOntologies[type][selectedCategory].ontologies]
          : [];

      for (let checkd of checkedSpecializations) {
        const findOntology = ontologies.find(
          (ontology: any) => ontology.id === checkd
        );
        const indexFound = newSubOntologies.findIndex(
          (onto) => onto.id === checkd
        );
        if (indexFound === -1 && findOntology) {
          newSubOntologies.push({
            id: checkd,
            title: findOntology.title,
          });
        }
      }
      if (type === "Specializations") {
        ontologyData.subOntologies[type]["main"].ontologies =
          ontologyData.subOntologies[type]["main"].ontologies.filter(
            (ontology: any) =>
              newSubOntologies.findIndex((o) => o.id === ontology.id) === -1
          );
      }

      ontologyData.subOntologies[type] = {
        ...(ontologyData.subOntologies[type] || {}),
        [selectedCategory]: {
          ontologies: newSubOntologies,
        },
      };
      if (ontologyData.inheritance) {
        ontologyData.inheritance.subOntologies[type] = {
          ref: null,
          title: "",
        };
      }

      await updateDoc(ontologyDoc.ref, ontologyData);
      if (type !== "Specializations") {
        updateInhiretance({
          updatedOntology: { ...ontologyData, id: openOntology.id },
          updatedField: type,
          type: "subOntologies",
          newValue: ontologyData.subOntologies[type],
          ancestorTitle: ontologyData.title,
        });
      }
      handleClose();
    } catch (error) {
      console.error(error);
    }
  };
  const addCatgory = useCallback(async () => {
    try {
      if (!newCategory) return;
      const ontologyDoc = await getDoc(
        doc(collection(db, "ontology"), openOntology.id)
      );
      if (ontologyDoc.exists()) {
        const ontologyData = ontologyDoc.data();
        if (editCategory) {
          await recordLogs({
            action: "Edited a category",
            previousValue: editCategory.category,
            newValue: newCategory,
            ontology: ontologyDoc.id,
            feild: editCategory.type,
          });
          ontologyData.subOntologies[editCategory.type][newCategory] =
            ontologyData.subOntologies[editCategory.type][
              editCategory.category
            ];
          delete ontologyData.subOntologies[editCategory.type][
            editCategory.category
          ];
        } else {
          if (!ontologyData?.subOntologies[type]?.hasOwnProperty(newCategory)) {
            ontologyData.subOntologies[type] = {
              ...(ontologyData?.subOntologies[type] || {}),
              [newCategory]: {
                ontologies: [],
              },
            };
          }
          await recordLogs({
            action: "Created a category",
            category: newCategory,
            ontology: ontologyDoc.id,
            feild: type,
          });
        }

        await updateDoc(ontologyDoc.ref, ontologyData);
        handleCloseAddCategory();
      }
    } catch (error) {
      console.error(error);
    }
  }, [newCategory]);

  const getCurrentSpecializations = () => {
    const _mainSpecializations: any = {};
    const _specializations = ontologies.filter((onto: any) => {
      const findIdx = (
        openOntology?.subOntologies?.Specializations["main"]?.ontologies || []
      ).findIndex((o: any) => o.id === onto.id);
      return findIdx !== -1;
    });

    for (let specialization of _specializations) {
      _mainSpecializations[specialization.title] = {
        id: specialization.id,
        path: [],
        specializations: {},
      };
    }

    return _mainSpecializations;
  };

  const handleNewSpec = async () => {
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
        doc(collection(db, "ontology"), openOntology.id)
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

  const addLock = async (ontology: string, field: string, type: string) => {
    try {
      if (!user) return;
      if (type == "add") {
        const newLock = {
          uname: user?.uname,
          ontology,
          field,
          deleted: false,
          createdAt: new Date(),
        };
        const ontologyDocref = doc(collection(db, "ontologyLock"));
        await setDoc(ontologyDocref, newLock);
      } else {
        const locksDocs = await getDocs(
          query(
            collection(db, "ontologyLock"),
            where("field", "==", field),
            where("ontology", "==", ontology),
            where("uname", "==", user?.uname)
          )
        );
        for (let lockDoc of locksDocs.docs) {
          await deleteDoc(lockDoc.ref);
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleSorting = async (result: any, subType: string) => {
    try {
      const { source, destination, draggableId, type } = result;

      if (!destination) {
        return;
      }
      if (type === "CATEGORY") {
        const sourceCategory = source.droppableId; // The source category
        const destinationCategory = destination.droppableId; // The destination category

        if (
          sourceCategory &&
          destinationCategory &&
          sourceCategory !== destinationCategory
        ) {
          const ontlogyDoc = await getDoc(
            doc(collection(db, "ontology"), openOntology.id)
          );
          if (ontlogyDoc.exists()) {
            const ontlogyData = ontlogyDoc.data();
            const specializations = ontlogyData.subOntologies[subType];
            const ontoIdx = specializations[
              sourceCategory
            ].ontologies.findIndex((onto: any) => onto.id === draggableId);
            if (ontoIdx !== -1) {
              specializations[destinationCategory].ontologies.push(
                specializations[sourceCategory].ontologies[ontoIdx]
              );
              specializations[sourceCategory].ontologies.splice(ontoIdx, 1);
            }
            ontlogyData.subOntologies[subType] = specializations;
            await updateDoc(ontlogyDoc.ref, ontlogyData);
            await recordLogs({
              action: "Moved a field to a category",
              feild: subType,
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
      console.error(error);
    }
  };

  const removeSubOntology = ({ ontologyData, id }: any) => {
    for (let type in ontologyData.subOntologies) {
      for (let category in ontologyData.subOntologies[type] || {}) {
        if (
          (ontologyData.subOntologies[type][category].ontologies || []).length >
          0
        ) {
          const subOntologyIdx = ontologyData.subOntologies[type][
            category
          ].ontologies.findIndex((sub: any) => sub.id === id);
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
  const deleteSubOntologyEditable = async () => {
    try {
      console.info("deleteSubOntologyEditable");
      if (
        await confirmIt(
          "Are you sure you want to delete the Ontology?",
          "Delete Ontology",
          "Keep Ontology"
        )
      ) {
        const ontologyDoc = await getDoc(
          doc(collection(db, "ontology"), openOntology.id)
        );
        if (ontologyDoc.exists()) {
          const ontologyData = ontologyDoc.data();
          const parents = ontologyData?.parents || [];
          for (let parent of parents) {
            const parentDoc = await getDoc(
              doc(collection(db, "ontology"), parent)
            );
            if (parentDoc.exists()) {
              const ontologyData = parentDoc.data();
              removeSubOntology({ ontologyData, id: ontologyDoc.id });
              await updateDoc(parentDoc.ref, ontologyData);
            }
          }
          updateUserDoc([
            ...ontologyPath.slice(0, -1).map((path: any) => path.id),
          ]);
          await updateDoc(ontologyDoc.ref, { deleted: true });
          recordLogs({
            action: "Deleted Ontology",
            ontology: ontologyDoc.id,
          });
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

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
            <TreeViewSimplified
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
          <Button onClick={handleNewSpec}>Add new {type}</Button>
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
        <SubPlainText
          updateInhiretance={updateInhiretance}
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
        <SubPlainText
          updateInhiretance={updateInhiretance}
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
                                      {(provided: any, snapshot: any) => (
                                        <Box
                                          {...provided.droppableProps}
                                          ref={provided.innerRef}
                                          style={{
                                            backgroundColor:
                                              snapshot.isDraggingOver
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
                                                      <SubOntology
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
                                                        updateInhiretance={
                                                          updateInhiretance
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
                                      <SubOntology
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
                                        updateInhiretance={updateInhiretance}
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
              <Box key={type}>
                <SubPlainText
                  updateInhiretance={updateInhiretance}
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
          )}
        </Box>
      </Box>
      {ConfirmDialog}
    </Box>
  );
};

export default Ontology;
