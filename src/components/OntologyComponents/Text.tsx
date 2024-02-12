/* 
The `Text` component is a React component designed to handle the display and editing of text fields within a sub-ontology node in a Firebase Firestore database. It provides functionality for viewing text in markdown format, editing text fields, saving changes, and handling inheritance of text fields from parent nodes. Additionally, it includes features for locking fields to prevent concurrent edits and logging changes for audit purposes.

## Props

The component accepts the following props:

- `currentVisibleNode`: An object representing the currently visible node in the ontology.
- `setCurrentVisibleNode`: A function to update the state of the current visible node.
- `type`: A string indicating the type of text field (e.g., 'title', 'description').
- `setSnackbarMessage`: A function to display a message in a snackbar/notification.
- `text`: The text content to be displayed or edited.
- `editNode`: An optional string representing the ID of the node being edited.
- `setEditOntology`: A function to update the state of the ontology being edited.
- `lockedNodeFields`: An object containing information about which fields are locked and by whom.
- `addLock`: A function to add or remove a lock on a node field.
- `user`: An object representing the current user.
- `recordLogs`: A function to record actions taken by the user for logging purposes.
- `deleteNode`: An optional function to delete the current sub-ontology.
- `updateInheritance`: A function to update the inheritance of text fields for child nodes.

## State

The component maintains the following state:

- `editMode`: A boolean indicating whether the component is in edit mode.
- `copyValue`: A string holding the current value of the text field being edited.

## Functions

### `capitalizeFirstLetter(word: string)`

Capitalizes the first letter of the given word.

### `editTitleChildNode({ parentData, newTitle, id })`

Updates the title of a child node within the parent node's data.

### `onSaveTextChange()`

Handles the saving of text changes to the Firestore database and toggles the edit mode.

### `handleEditText(e)`

Updates the `copyValue` state with the value from the text field.

### `handleFocus(event)`

Selects the text in the target element if the type is 'title' and the current node matches the node being edited.

### `handleDeleteOntology()`

Calls the `deleteNode` function to delete the current sub-ontology.

### `onCancelTextChange()`

Cancels the text change, reverts the `copyValue` to the original text, and removes the lock.

## Rendering

The component renders the following:

- A `Typography` component displaying the field type (if not 'title').
- A `LockIcon` if the field is locked by another user.
- Edit and Cancel buttons to toggle edit mode and save or cancel changes.
- A `TextField` for editing the text when in edit mode.
- A `MarkdownRender` component to display the text in markdown format when not in edit mode.
- A Delete button to delete the ontology if the type is 'title' and the node is not locked.

## Usage

The `Text` component is used within a larger application to manage ontologies in a Firestore database. It provides a user-friendly interface for viewing and editing text fields, handling field locking to prevent concurrent edits, and maintaining a log of changes for auditing purposes. */

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
  currentVisibleNode: INode;
  setCurrentVisibleNode: (state: any) => void;
  type: string;
  setSnackbarMessage: (message: any) => void;
  text: string;
  editNode?: string | null;
  setEditOntology: (state: string) => void;
  lockedNodeFields: {
    [field: string]: {
      id: string;
      uname: string;
      node: string;
      field: string;
      deleted: boolean;
      createdAt: Timestamp;
    };
  };
  addLock: (node: string, field: string, type: string) => void;
  user: any;
  recordLogs: (logs: any) => void;
  deleteNode?: () => void;
  updateInheritance: (parameters: {
    updatedNode: INode;
    updatedField: string;
    type: "children" | "plainText";
    newValue: any;
    ancestorTitle: string;
  }) => void;
};
const Text = ({
  text,
  type,
  currentVisibleNode,
  setCurrentVisibleNode,
  editNode = null,
  setEditOntology,
  lockedNodeFields,
  addLock,
  user,
  recordLogs,
  deleteNode = () => {},
  updateInheritance,
}: ISubOntologyProps) => {
  const db = getFirestore();
  const [editMode, setEditMode] = useState(false);
  const [copyValue, setCopyValue] = useState("");
  const textFieldRef = useRef<any>(null);

  useEffect(() => {
    setCopyValue(currentVisibleNode.plainText[type]);
  }, [currentVisibleNode, type, editMode]);
  const capitalizeFirstLetter = (word: string) => {
    return word.charAt(0).toUpperCase() + word.slice(1);
  };

  // This function is responsible for editing the title of a childe node.
  // It takes an object with three parameters: parentData (parentNode), newTitle, and id.

  const editTitleChildNode = ({ parentData, newTitle, id }: any) => {
    // Iterate over the types of children in the parentData.
    for (let type in parentData.children) {
      // Iterate over the categories within each type of childe node.
      for (let category in parentData.children[type] || {}) {
        // Check if the current category has ontologies defined.
        if ((parentData.children[type][category] || []).length > 0) {
          // Find the index of the childe node with the given id within the current category.
          const childIdx = parentData.children[type][category].findIndex(
            (sub: any) => sub.id === id
          );

          // If the childe node with the specified id is found in the current category.
          if (childIdx !== -1) {
            // Update the title of the childe node with the new title.
            parentData.children[type][category][childIdx].title = newTitle;
          }
        }
      }
    }
  };

  useEffect(() => {
    if (type === "title" && editNode) {
      setEditMode(editNode === currentVisibleNode.id);
    }
  }, [editNode, currentVisibleNode]);

  const onSaveTextChange = async () => {
    // Toggle the edit mode

    // Check if the edit mode is true
    if (editMode) {
      // Fetch the node document from the database
      const nodeDoc = await getDoc(
        doc(collection(db, NODES), currentVisibleNode.id)
      );

      // Check if the node document exists
      if (nodeDoc.exists()) {
        // Extract node data from the document
        const nodeData: any = nodeDoc.data();
        // If the field being edited is not "description" or "title"
        let previousValue = nodeData.plainText[type] || "";
        let newValue = copyValue;
        // If the field being edited is the "title"
        if (type === "title") {
          // Reset the editNode state
          setEditOntology("");

          // Update titles of children for each parent node
          for (let parentId of currentVisibleNode?.parents || []) {
            const parentRef = doc(collection(db, NODES), parentId);
            const parentDoc = await getDoc(parentRef);
            const parentData: any = parentDoc.data();

            // Call a function to edit the title of children
            editTitleChildNode({
              parentData,
              newTitle: newValue,
              id: currentVisibleNode.id,
            });

            // Update the parent node in the database
            updateDoc(parentRef, parentData);
          }
        }

        nodeData.plainText[type] = copyValue || "";

        if (
          type !== "title" &&
          nodeData.inheritance &&
          previousValue.trim() !== newValue.trim()
        ) {
          nodeData.inheritance.plainText[type] = {
            ref: null,
            title: "",
          };
        }

        // Update the node document in the database
        await updateDoc(nodeDoc.ref, nodeData);

        // Update the children according to inheritance
        // (Title doesn't have inheritance, so it's excluded)
        updateInheritance({
          updatedField: type,
          type: "plainText",
          newValue: newValue,
          updatedNode: { ...nodeData, id: currentVisibleNode.id },
          ancestorTitle: nodeData.plainText.title,
        });

        // Add a lock for the edited node
        addLock(currentVisibleNode.id, type, "remove");

        // Record the edit action in the logs
        recordLogs({
          action: "Edited a field",
          field: type,
          previousValue,
          newValue,
        });
      }
      setEditMode((edit) => !edit);
    } else {
      // If edit mode is false, add a lock for the node
      addLock(currentVisibleNode.id, type, "add");
      setEditMode(true);
    }
  };

  // Define a function to handle text edits, taking an event as a parameter (assumed to be a React event)
  const handleEditText = (e: any) => {
    // Update the state using the setCurrentVisibleNode function, which receives the current state
    setCopyValue(e.target.value);
  };

  // Function to handle focus events
  const handleFocus = (event: any) => {
    // Check if the type is "title" and the current ontology being edited matches the open ontology
    if (type === "title" && editNode === currentVisibleNode.id) {
      // If conditions are met, select the text in the target element
      event.target.select();
    }
  };

  // Function to handle the deletion of an ontology
  const handleDeleteOntology = () => {
    // Call the function to delete the editable sub-ontology
    deleteNode();
  };
  const onCancelTextChange = () => {
    setCopyValue(currentVisibleNode.plainText[type]);
    setEditMode((edit) => !edit);
    addLock(currentVisibleNode.id, type, "remove");
  };
  return (
    <Box>
      {type !== "title" && (
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Typography sx={{ fontSize: "19px" }}>
            {capitalizeFirstLetter(type)}:
          </Typography>
          {lockedNodeFields[type] &&
          user.uname !== lockedNodeFields[type].uname ? (
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
          {(currentVisibleNode.inheritance || {}).plainText &&
            (currentVisibleNode.inheritance || {}).plainText[type]?.ref && (
              <Typography sx={{ color: "grey" }}>
                {"("}
                {"Inherited from "}
                {'"'}
                {(currentVisibleNode.inheritance || {}).plainText[type]?.title}
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
          {type === "title" && !currentVisibleNode.locked && (
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {lockedNodeFields[type] &&
              user.uname !== lockedNodeFields[type].uname ? (
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
