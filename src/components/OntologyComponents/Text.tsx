/* # Text Component

The `Text` component is a React component used for displaying and editing plain text fields within an ontology. It supports markdown rendering and integrates with Firebase Firestore for data persistence.

## Features

- Editable text fields with markdown support.
- Firestore integration for data retrieval and updates.
- Inheritance handling for ontology fields.
- Locking mechanism to prevent concurrent edits.
- Logging of edit actions for audit trails.
- Deletion of sub-ontologies.

## Props

The component accepts the following props:

- `text`: The text content to be displayed or edited.
- `type`: The type of the text field (e.g., 'title', 'description').
- `openOntology`: The current ontology object being viewed or edited.
- `setOpenOntology`: Function to update the state of the current ontology.
- `editOntology`: The ID of the ontology being edited, if any.
- `setEditOntology`: Function to set the ID of the ontology being edited.
- `lockedOntology`: An object containing information about locked ontologies to prevent concurrent edits.
- `addLock`: Function to add or remove a lock on an ontology field.
- `user`: The current user object.
- `recordLogs`: Function to record logs for edit actions.
- `deleteSubOntologyEditable`: Function to delete a sub-ontology.
- `updateInheritance`: Function to update the inheritance of ontology fields.

## Usage

To use the `Text` component, import it into your React application and provide the necessary props as shown in the example below:

```jsx
import Text from './Text';

// ... within your component's render method or function component body
<Text
  text={yourTextContent}
  type="description"
  openOntology={yourCurrentOntology}
  setOpenOntology={yourSetOpenOntologyFunction}
  editOntology={yourEditOntologyId}
  setEditOntology={yourSetEditOntologyFunction}
  lockedOntology={yourLockedOntologyObject}
  addLock={yourAddLockFunction}
  user={yourCurrentUser}
  recordLogs={yourRecordLogsFunction}
  deleteSubOntologyEditable={yourDeleteSubOntologyEditableFunction}
  updateInheritance={yourUpdateInheritanceFunction}
/>
```

## Component Structure

The component consists of the following main parts:

- A `TextField` component for editing the text, which appears when the `editMode` state is `true`.
- A `MarkdownRender` component for displaying the text content with markdown formatting.
- Buttons for toggling `editMode`, saving changes, and deleting the ontology.
- Lock icons and tooltips to indicate when a field is locked for editing.

## Editing Flow

1. The user clicks the "Edit" button, which sets `editMode` to `true`.
2. The `TextField` component becomes editable, allowing the user to make changes.
3. The user clicks the "Save" button, which triggers the `onSaveTextChange` function.
4. The function updates the Firestore document with the new text and toggles `editMode` to `false`.
5. If the text field has inheritance, the `updateInheritance` function is called to propagate changes to child ontologies.

## Locking Mechanism

The component uses a locking mechanism to prevent concurrent edits. When a user starts editing a field, a lock is added to the `lockedOntology` object. Other users will see a lock icon indicating that the field is currently being edited. Once the user saves or cancels the edit, the lock is removed.

## Logging

The `recordLogs` function is called whenever a user saves changes to a field. It records the action, field type, previous value, and new value for audit purposes.

## Deletion

The `handleDeleteOntology` function is called when the user clicks the "Delete" button. It triggers the `deleteSubOntologyEditable` function to remove the sub-ontology from the database.

## Styling

The component uses Material-UI components and styles for a consistent look and feel. Custom styles are applied using the `sx` prop.

## Dependencies

- `@mui/icons-material`
- `@mui/material`
- `firebase/firestore`
- `react`
- `MarkdownRender` (a custom component for rendering markdown)

## Importing Types

The component imports the `INode` and `ILockedOntology` types from `@components/types/INode` for TypeScript type checking.

---
 */

import LockIcon from "@mui/icons-material/Lock";
import { Box, Button, TextField, Tooltip, Typography } from "@mui/material";
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getFirestore,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";

import MarkdownRender from "../Markdown/MarkdownRender";

import { NODES } from " @components/lib/firestoreClient/collections";
import { INode } from " @components/types/INode";

type ISubOntologyProps = {
  openOntology: INode;
  setOpenOntology: (state: any) => void;
  type: string;
  setSnackbarMessage: (message: any) => void;
  text: string;
  editOntology?: string | null;
  setEditOntology: (state: string) => void;
  lockedOntology: {
    [field: string]: {
      id: string;
      uname: string;
      ontology: string;
      field: string;
      deleted: boolean;
      createdAt: Timestamp;
    };
  };
  addLock: (ontology: string, field: string, type: string) => void;
  user: any;
  recordLogs: (logs: any) => void;
  deleteSubOntologyEditable?: () => void;
  updateInheritance: (parameters: {
    updatedNode: INode;
    updatedField: string;
    type: "subOntologies" | "plainText";
    newValue: any;
    ancestorTitle: string;
  }) => void;
};
const Text = ({
  text,
  type,
  openOntology,
  setOpenOntology,
  editOntology = null,
  setEditOntology,
  lockedOntology,
  addLock,
  user,
  recordLogs,
  deleteSubOntologyEditable = () => {},
  updateInheritance,
}: ISubOntologyProps) => {
  const db = getFirestore();
  const [editMode, setEditMode] = useState(false);
  const [copyValue, setCopyValue] = useState(openOntology.plainText[type]);
  const textFieldRef = useRef<any>(null);

  const capitalizeFirstLetter = (word: string) => {
    return word.charAt(0).toUpperCase() + word.slice(1);
  };

  // This function is responsible for editing the title of a sub-ontology.
  // It takes an object with three parameters: parentData, newTitle, and id.

  const editTitleChildNode = ({ parentData, newTitle, id }: any) => {
    // Iterate over the types of sub-ontologies in the parentData.
    for (let type in parentData.subOntologies) {
      // Iterate over the categories within each type of sub-ontology.
      for (let category in parentData.subOntologies[type] || {}) {
        // Check if the current category has ontologies defined.
        if (
          (parentData.subOntologies[type][category].ontologies || []).length > 0
        ) {
          // Find the index of the sub-ontology with the given id within the current category.
          const subOntologyIdx = parentData.subOntologies[type][
            category
          ].ontologies.findIndex((sub: any) => sub.id === id);

          // If the sub-ontology with the specified id is found in the current category.
          if (subOntologyIdx !== -1) {
            // Update the title of the sub-ontology with the new title.
            parentData.subOntologies[type][category].ontologies[
              subOntologyIdx
            ].title = newTitle;
          }
        }
      }
    }
  };

  useEffect(() => {
    if (type === "title" && editOntology) {
      setEditMode(editOntology === openOntology.id);
    }
  }, [editOntology, openOntology]);

  const onSaveTextChange = async () => {
    // Toggle the edit mode
    setEditMode((edit) => !edit);

    // Check if the edit mode is true
    if (editMode) {
      // Fetch the ontology document from the database
      const nodeDoc = await getDoc(doc(collection(db, NODES), openOntology.id));

      // Check if the ontology document exists
      if (nodeDoc.exists()) {
        // Extract ontology data from the document
        const nodeData: any = nodeDoc.data();

        // If the field being edited is the "title"
        if (type === "title") {
          // Reset the editOntology state
          setEditOntology("");

          // Update titles of sub-ontologies for each parent ontology
          for (let parentId of openOntology?.parents || []) {
            const parentRef = doc(collection(db, NODES), parentId);
            const parentDoc = await getDoc(parentRef);
            const parentData: any = parentDoc.data();

            // Call a function to edit the title of sub-ontology
            editTitleChildNode({
              parentData,
              newTitle: openOntology.title,
              id: openOntology.id,
            });

            // Update the parent ontology in the database
            await updateDoc(parentRef, parentData);
          }
        }

        let previousValue = "";
        let newValue = "";

        // If the field being edited is not "description" or "title"
        previousValue = nodeData.plainText[type];
        newValue = openOntology.plainText[type];
        nodeData.plainText[type] = openOntology.plainText[type] || "";

        // If the field is not "title" and the ontology has inheritance
        if (type !== "title" && nodeData.inheritance) {
          nodeData.inheritance.plainText[type] = {
            ref: null,
            title: "",
          };
        }

        // Update the ontology document in the database
        await updateDoc(nodeDoc.ref, nodeData);

        // Update the children according to inheritance
        // (Title doesn't have inheritance, so it's excluded)
        updateInheritance({
          updatedField: type,
          type: "plainText",
          newValue: newValue,
          updatedNode: { ...nodeData, id: openOntology.id },
          ancestorTitle: nodeData.title,
        });

        // Add a lock for the edited ontology
        addLock(openOntology.id, type, "remove");

        // Record the edit action in the logs
        recordLogs({
          action: "Edited a field",
          field: type,
          previousValue,
          newValue,
        });
      }
    } else {
      // If edit mode is false, add a lock for the ontology
      addLock(openOntology.id, type, "add");
    }
  };

  // Define a function to handle text edits, taking an event as a parameter (assumed to be a React event)
  const handleEditText = (e: any) => {
    // Update the state using the setOpenOntology function, which receives the current state
    setCopyValue(e.target.value);
  };

  // Function to handle focus events
  const handleFocus = (event: any) => {
    // Check if the type is "title" and the current ontology being edited matches the open ontology
    if (type === "title" && editOntology === openOntology.id) {
      // If conditions are met, select the text in the target element
      event.target.select();
    }
  };

  // Function to handle the deletion of an ontology
  const handleDeleteOntology = () => {
    // Call the function to delete the editable sub-ontology
    deleteSubOntologyEditable();
  };
  const onCancelTextChange = () => {
    setCopyValue(openOntology.plainText[type]);
    setEditMode((edit) => !edit);
    addLock(openOntology.id, type, "remove");
  };
  return (
    <Box>
      {type !== "title" && (
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Typography sx={{ fontSize: "19px" }}>
            {capitalizeFirstLetter(type)}:
          </Typography>
          {lockedOntology[type] && user.uname !== lockedOntology[type].uname ? (
            <Tooltip title={"Locked"} sx={{ ml: "5px" }}>
              <LockIcon />
            </Tooltip>
          ) : (
            <Box>
              <Tooltip title={editMode ? "Save" : "Edit"}>
                <Button onClick={onSaveTextChange} sx={{ ml: "5px" }}>
                  {editMode ? "Save" : "Edit"}
                </Button>
              </Tooltip>
              {editMode && (
                <Tooltip title={"Cancel"}>
                  <Button onClick={onCancelTextChange} sx={{ ml: "5px" }}>
                    {"Cancel"}
                  </Button>
                </Tooltip>
              )}
            </Box>
          )}
          {(openOntology.inheritance || {}).plainText &&
            (openOntology.inheritance || {}).plainText[type]?.ref && (
              <Typography sx={{ color: "grey" }}>
                {"("}
                {"Inherited from "}
                {'"'}
                {(openOntology.inheritance || {}).plainText[type]?.title}
                {'"'}
                {")"}
              </Typography>
            )}
        </Box>
      )}
      {editMode ? (
        <TextField
          placeholder={type}
          variant="standard"
          fullWidth
          value={copyValue}
          multiline
          onChange={handleEditText}
          InputProps={{
            style: { fontSize: type === "title" ? "30px" : "" },
            endAdornment: (
              <Box
                style={{
                  marginRight: "18px",
                  cursor: "pointer",
                  display: "flex",
                }}
              >
                {type === "title" && (
                  <Box sx={{ display: "flex" }}>
                    <Tooltip title={"Save"}>
                      <Button onClick={onSaveTextChange} sx={{ ml: "5px" }}>
                        {editMode ? "Save" : "Edit"}
                      </Button>
                    </Tooltip>
                    {editMode && (
                      <Tooltip title={"Cancel"}>
                        <Button onClick={onCancelTextChange} sx={{ ml: "5px" }}>
                          {"Cancel"}
                        </Button>
                      </Tooltip>
                    )}
                  </Box>
                )}
              </Box>
            ),
          }}
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
          focused={editMode}
          autoFocus
          inputRef={textFieldRef}
          onFocus={handleFocus}
        />
      ) : (
        <Box
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "15px",
          }}
        >
          <MarkdownRender
            text={text}
            sx={{ fontSize: type === "title" ? "30px" : "" }}
          />
          {type === "title" && !openOntology.locked && (
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {lockedOntology[type] &&
              user.uname !== lockedOntology[type].uname ? (
                <Tooltip title={"Locked"} sx={{ ml: "5px" }}>
                  <LockIcon />
                </Tooltip>
              ) : (
                <Box>
                  <Tooltip title={editMode ? "Save" : "Edit"}>
                    <Button onClick={onSaveTextChange} sx={{ ml: "5px" }}>
                      {editMode ? "Save" : "Edit"}
                    </Button>
                  </Tooltip>
                </Box>
              )}
              <Tooltip title={"Delete Ontology"} sx={{ ml: "5px" }}>
                <Button onClick={handleDeleteOntology} sx={{ ml: "5px" }}>
                  Delete
                </Button>
              </Tooltip>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default Text;
