/* 
# SubOntology Component

The `SubOntology` component is responsible for rendering a single sub-ontology item within the application. It provides functionality for navigating to the sub-ontology's details, as well as deleting the sub-ontology from the database.

## Props

The component accepts the following props:

- `subOntology`: The sub-ontology object to be displayed.
- `openOntology`: The currently open ontology object.
- `sx`: Style object for customizing the appearance of the component.
- `type`: The type of the sub-ontology.
- `setOpenOntology`: Function to update the currently open ontology.
- `saveSubOntology`: Function to save the sub-ontology.
- `setSnackbarMessage`: Function to display a message in a snackbar.
- `category`: The category of the sub-ontology.
- `ontologyPath`: The path of ontologies leading to the current sub-ontology.
- `updateUserDoc`: Function to update the user document with the new ontology path.
- `recordLogs`: Function to record logs for actions performed.
- `updateInheritance`: Function to update inheritance of the ontology.

## Usage

The `SubOntology` component is used within the application to display a list of sub-ontologies. It provides an interactive link to navigate to the sub-ontology's details and a delete button to remove the sub-ontology from the database.

## Functions

### linkNavigation

Handles the navigation to the sub-ontology's details by updating the user document with the new ontology path.

### removeSubOntology

Removes the sub-ontology from the parent ontology's sub-ontologies list.

### deleteSubOntologyEditable

Handles the deletion of the sub-ontology. It confirms the action with the user, updates the parent ontology, and records the action in logs.

## Rendering

The component renders a `Box` containing a `Link` for the sub-ontology title and a `Button` for the delete action. A `Tooltip` is used to provide additional information for the delete button.

## ConfirmDialog

A `ConfirmDialog` component is used to confirm the deletion action with the user before proceeding.

## Example

```jsx
<ChildNode
  subOntology={subOntologyData}
  openOntology={openOntologyData}
  sx={customStyles}
  type="Specializations"
  setOpenOntology={handleSetOpenOntology}
  saveSubOntology={handleSaveSubOntology}
  setSnackbarMessage={handleSetSnackbarMessage}
  category="CategoryName"
  ontologyPath={ontologyPathData}
  updateUserDoc={handleUpdateUserDoc}
  recordLogs={handleRecordLogs}
  updateInheritance={handleUpdateInheritance}
/>
```

## Source Code

The source code for the `SubOntology` component is located in the `SubOntology.tsx` file within the project repository.

---

This documentation provides an overview of the `SubOntology` component's functionality and usage within the application. For more detailed information, refer to the source code and comments within the `SubOntology.tsx` file. */




import { NODES } from " @components/lib/firestoreClient/collections";
import useConfirmDialog from " @components/lib/hooks/useConfirmDialog";
import {
  INode,
  INodePath,
  ISubOntology,
} from " @components/types/INode";
import { Box, Button, Link, Tooltip } from "@mui/material";
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  updateDoc,
} from "firebase/firestore";

type ISubOntologyProps = {
  subOntology: ISubOntology;
  openOntology: INode;
  sx: { [key: string]: any };
  type: string;
  setOpenOntology: (openOntology: any) => void;
  saveSubOntology: any;
  setSnackbarMessage: (message: any) => void;
  category: string;
  ontologyPath: INodePath[];
  updateUserDoc: (ontologyPath: string[]) => void;
  recordLogs: (logs: any) => void;
  updateInheritance: (parameters: {
    updatedNode: INode;
    updatedField: string;
    type: "subOntologies" | "plainText";
    newValue: any;
    ancestorTitle: string;
  }) => void;
};

const ChildNode = ({
  subOntology,
  sx,
  type,
  openOntology,
  category,
  ontologyPath,
  updateUserDoc,
  recordLogs,
  updateInheritance,
}: ISubOntologyProps) => {
  const db = getFirestore();
  const { confirmIt, ConfirmDialog } = useConfirmDialog();

  const linkNavigation = async () => {
    updateUserDoc([
      ...ontologyPath.map((p: { id: string }) => p.id),
      subOntology.id,
    ]);
    // handleLinkNavigation({ id: subOntology.id, title: subOntology.title });
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
      if (
        await confirmIt("Are you sure you want to delete?", "Delete", "Keep")
      ) {
        const ontologyDoc = await getDoc(
          doc(collection(db, NODES), openOntology.id)
        );
        if (ontologyDoc.exists()) {
          const ontologyData: any = ontologyDoc.data();
          const subOntologyIdx = (
            ontologyData?.subOntologies[type][category]?.ontologies || []
          ).findIndex((sub: any) => sub.id === subOntology.id);
          if (subOntologyIdx !== -1) {
            ontologyData.subOntologies[type][category].ontologies.splice(
              subOntologyIdx,
              1
            );
          }
          const subOntologyDoc = await getDoc(
            doc(collection(db, NODES), subOntology.id)
          );

          if (subOntologyDoc.exists()) {
            const subOntologyData = subOntologyDoc.data();
            const parents = subOntologyData?.parents || [];
            if (type === "Specializations") {
              for (let parent of parents) {
                const ontologyDoc = await getDoc(
                  doc(collection(db, NODES), parent)
                );
                if (ontologyDoc.exists()) {
                  const ontologyData = ontologyDoc.data();
                  removeSubOntology({
                    ontologyData,
                    id: subOntology.id,
                    subtype: type,
                  });
                  await updateDoc(ontologyDoc.ref, ontologyData);
                }
              }
            }

            if (type === "Specializations") {
              await updateDoc(subOntologyDoc.ref, { deleted: true });
            }
            if (type !== "Specializations") {
              updateInheritance({
                updatedNode: { ...ontologyData, id: ontologyDoc.id },
                updatedField: type,
                type: "subOntologies",
                newValue: ontologyData.subOntologies[type],
                ancestorTitle: ontologyData.title,
              });
            }
            await recordLogs({
              action: "Deleted a field",
              field: subOntologyData.title,
              ontology: ontologyDoc.id,
            });
          }

          await updateDoc(ontologyDoc.ref, ontologyData);
        }
        // setOpenOntology((openOntology: any) => {
        //   const _openOntology: any = { ...openOntology };
        //   const subOntologyIdx = _openOntology.subOntologies[type].findIndex((sub: any) => sub.id === subOntology.id);
        //   if (subOntologyIdx !== -1) {
        //     _openOntology.subOntologies[type].splice(subOntologyIdx, 1);
        //   }
        //   return _openOntology;
        // });
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Box key={subOntology.id} sx={{ ...sx }}>
      <Box
        key={subOntology.id}
        style={{ display: "flex", alignItems: "center", marginBottom: "15px" }}
      >
        <Link
          underline="hover"
          onClick={linkNavigation}
          sx={{
            cursor: "pointer",
            color: (theme) =>
              theme.palette.mode === "dark"
                ? theme.palette.common.gray50
                : theme.palette.common.notebookMainBlack,
          }}
        >
          {" "}
          {subOntology.title}
        </Link>
        <Tooltip title={"Delete"}>
          <Button onClick={deleteSubOntologyEditable} sx={{ ml: "5px" }}>
            Delete
          </Button>
        </Tooltip>
      </Box>

      {ConfirmDialog}
    </Box>
  );
};

export default ChildNode;
