/* 
The `Text` component is a React component designed to handle the display and editing of text fields within a children node in a Firebase Firestore database. It provides functionality for viewing text in markdown format, editing text fields, saving changes, and handling inheritance of text fields from parent nodes. Additionally, it includes features for locking fields to prevent concurrent edits and logging changes for audit purposes.

## Props

The component accepts the following props:

- `currentVisibleNode`: An object representing the currently visible node in the ontology.
- `setCurrentVisibleNode`: A function to update the state of the current visible node.
- `type`: A string indicating the type of text field (e.g., 'title', 'description').
- `setSnackbarMessage`: A function to display a message in a snackbar/notification.
- `text`: The text content to be displayed or edited.
- `editNode`: An optional string representing the ID of the node being edited.
- `setEditOntology`: A function to update the state of the node being edited.
- `lockedNodeFields`: An object containing information about which fields are locked and by whom.
- `addLock`: A function to add or remove a lock on a node field.
- `user`: An object representing the current user.
- `recordLogs`: A function to record actions taken by the user for logging purposes.
- `deleteNode`: An optional function to delete the current children.
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

Calls the `deleteNode` function to delete the current children.

### `onCancelTextChange()`

Cancels the text change, reverts the `copyValue` to the original text, and removes the lock.

## Rendering

The component renders the following:

- A `Typography` component displaying the field type (if not 'title').
- A `LockIcon` if the field is locked by another user.
- Edit and Cancel buttons to toggle edit mode and save or cancel changes.
- A `TextField` for editing the text when in edit mode.
- A `MarkdownRender` component to display the text in markdown format when not in edit mode.
- A Delete button to delete the node if the type is 'title' and the node is not locked.

## Usage

The `Text` component is used within a larger application to manage ontologies in a Firestore database. It provides a user-friendly interface for viewing and editing text fields, handling field locking to prevent concurrent edits, and maintaining a log of changes for auditing purposes. */

import LockIcon from "@mui/icons-material/Lock";
import { Box, Button, TextField, Tooltip, Typography } from "@mui/material";
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import { NODES } from " @components/lib/firestoreClient/collections";
import { INode } from " @components/types/INode";
import * as Y from "yjs";
// import { WebrtcProvider } from "y-webrtc";
import { WebsocketProvider } from "y-websocket";
import { useTheme } from "@emotion/react";
import ContentText from "./ContentText";

type ISubOntologyProps = {
  currentVisibleNode: INode;
  setCurrentVisibleNode: (state: any) => void;
  property: string;
  setSnackbarMessage: (message: any) => void;
  text: string;
  editNode?: string | null;
  setEditNode: (state: string) => void;
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

  updateInheritance: (parameters: {
    nodeId: string;
    updatedProperty: string;
  }) => void;
  disabled?: boolean;
  removeField?: any;
  confirmIt?: any;
  nodes: { [id: string]: INode };
  color: string;
};
const Text = ({
  text,
  property,
  currentVisibleNode,
  setCurrentVisibleNode,
  editNode = null,
  setEditNode,
  lockedNodeFields,
  addLock,
  user,
  recordLogs,
  updateInheritance,
  disabled,
  removeField,
  confirmIt,
  nodes,
  color,
}: ISubOntologyProps) => {
  const db = getFirestore();
  const theme: any = useTheme();
  const cursorOverlayRef = useRef<HTMLDivElement | null>(null);

  const [currentValue, setCurrentValue] = useState("");
  const [cursors, setCursors] = useState<{
    [key: string]: { position: number; color: string; name: string };
  }>({});
  const [editorContent, setEditorContent] = useState(text);

  const localClientId = useRef(user?.uname);

  const textAreaRef = useRef<any>(null);

  // useEffect(() => {
  //   console.log("text");
  //   const ydoc = new Y.Doc();

  //   const provider = new WebsocketProvider(
  //     "wss://demos.yjs.dev/ws",
  //     `${currentVisibleNode.id}-${property}`,
  //     ydoc
  //   );
  //   const yText = ydoc.getText("textarea");
  //   const yCursors = ydoc.getMap("cursors");
  //   // Initialize yText if it's empty
  //   const initialText = text;
  //   if (property === "description") {
  //     console.log(yText.toString().length, "yText.toString().length");
  //   }
  //   yText.delete(0, yText.toString().length); // Delete all existing content
  //   yText.insert(0, initialText); // Insert the new initialText
  //   /*    if (yText.toString().length === 0) {

  //   } */
  //   setCurrentValue(initialText);

  //   yText.observe(() => {
  //     setCurrentValue(yText.toString());
  //   });

  //   // Update cursors and notify users editing
  //   yCursors.observe(() => {
  //     const newCursors = yCursors.toJSON();
  //     setCursors(newCursors);
  //   });

  //   const handleInput = (event: any) => {
  //     const value = event.target.value;
  //     yText.delete(0, yText.length);
  //     yText.insert(0, value);
  //     setCurrentValue(yText.toString());
  //     onSaveTextChange(yText.toString());
  //   };

  //   const handleBlur = () => {
  //     yCursors.delete(localClientId.current);
  //   };
  //   if (textAreaRef.current) {
  //     textAreaRef.current.addEventListener("input", handleInput);

  //     textAreaRef.current.addEventListener("blur", handleBlur);
  //   }

  //   return () => {
  //     if (textAreaRef.current) {
  //       textAreaRef.current.removeEventListener("input", handleInput);
  //       textAreaRef.current.addEventListener("blur", handleBlur);
  //     }
  //     provider.destroy();
  //   };
  // }, [currentVisibleNode.id, text]);

  // This function is responsible for editing the title of a childe node.
  // It takes an object with three parameters: parentData (parentNode), newTitle, and id.

  const onSaveTextChange = useCallback(
    async (copyValue: string) => {
      // Toggle the edit mode
      // Fetch the node document from the database
      const nodeDoc = await getDoc(
        doc(collection(db, NODES), currentVisibleNode.id)
      );
      if (property === "title") {
        const nodeDocs = await getDocs(
          query(
            collection(db, NODES),
            where("title", "==", copyValue),
            where("deleted", "==", false)
          )
        );
        if (
          nodeDocs.docs.length > 0 &&
          nodeDocs.docs[0].id !== currentVisibleNode.id &&
          confirmIt
        ) {
          await confirmIt(
            "A node with this title already exists. Please choose a different title.",
            "OK",
            ""
          );
          return;
        }
      }

      // Check if the node document exists
      if (nodeDoc.exists()) {
        // Extract node data from the document
        const nodeData = nodeDoc.data() as INode;
        // If the field being edited is not "description" or "title"
        let previousValue = nodeData.properties[property] || "";
        let newValue = copyValue;
        // If the field being edited is the "title"
        if (property === "title") {
          // Reset the editNode state
          setEditNode("");
        }
        if (property === "title") {
          nodeData.title = copyValue || "";
        } else {
          nodeData.properties[property] = copyValue || "";
        }

        if (
          property !== "title" &&
          nodeData.inheritance &&
          previousValue.trim() !== newValue.trim()
        ) {
          nodeData.inheritance[property].ref = null;
          nodeData.inheritance[property].title = "";
        }

        // Update the node document in the database
        await updateDoc(nodeDoc.ref, nodeData);

        // Update the children according to inheritance
        // (Title doesn't have inheritance, so it's excluded)
        if (property !== "title") {
          updateInheritance({
            nodeId: currentVisibleNode.id,
            updatedProperty: property,
          });
        }

        // Add a lock for the edited node
        addLock(currentVisibleNode.id, property, "remove");

        // Record the edit action in the logs
        recordLogs({
          action: "Edited a field",
          field: property,
          previousValue,
          newValue,
        });
      }
    },
    [currentVisibleNode.id]
  );

  // Function to handle focus events
  const handleFocus = (event: any) => {
    // Check if the type is "title" and the current node being edited matches the open node
    if (property === "title" && editNode === currentVisibleNode.id) {
      // If conditions are met, select the text in the target element
      event.target.select();
    }
  };
  const handleChanges = (e: any) => {
    onSaveTextChange(e.target.value);
    setEditorContent(e.target.value);
  };
  return (
    <Box
      style={{
        position: "relative",
        width: "100%",
        borderRadius: "25px",
        height: "auto",
      }}
    >
      {/*    <ContentText
        uname={`${user.fName} ${user.lName}`}
        editorContent={text}
        setEditorContent={setEditorContent}
        fieldId={`${currentVisibleNode.id}-${property}`}
        color={color}
        saveChanges={onSaveTextChange}
      /> */}

      <TextField
        ref={textAreaRef}
        multiline
        minRows={2}
        value={editorContent}
        onChange={handleChanges}
        placeholder="Type something..."
        InputProps={{
          sx: {
            padding: "15px",
            borderBottomRightRadius: "25px",
            borderBottomLeftRadius: "25px",
            fontSize: "19px",
          },
        }}
        sx={{
          width: "100%",
          height: "auto",
          outline: "none",
          fontSize: property === "title" ? "29px" : "16px",
          fontFamily: "'Roboto', sans-serif",
          color: theme.palette.mode === "dark" ? "white" : "black",
          whiteSpace: "pre-wrap",
          resize: "none",
          zIndex: 1,
          position: "relative",
        }}
      />

      {/* Overlay for rendering cursors */}
      {/* <div
        ref={cursorOverlayRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none", // Prevent the overlay from blocking input
        }}
      >
        {Object.keys(cursors).map((clientId) => {
          if (clientId === localClientId.current) return null;

          const cursor = cursors[clientId];
          const cursorStyles = getCursorPositionStyles(cursor.position);

          return (
            <div
              key={clientId}
              style={{
                position: "absolute",
                top: cursorStyles.top,
                left: cursorStyles.left,
                zIndex: 2,
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  position: "relative",
                  bottom: "100%",
                  left: "50%",
                  transform: "translateX(-50%)",
                  backgroundColor: cursor.color,
                  color: "#fff",
                  padding: "5px",
                  borderRadius: "10px",
                  fontSize: "15px",
                  whiteSpace: "nowrap",
                  zIndex: 3,
                }}
              >
                {cursor.name}
              </div>
              <div
                style={{
                  position: "absolute",
                  transform: "translateX(8%)",
                  backgroundColor: cursor.color,
                  height: "20px",
                  width: "4px",
                  borderRadius: "2px",
                  zIndex: 2,
                  marginBottom: "14px",
                  animation: "blink 1s step-end infinite",
                }}
              />
            </div>
          );
        })}
      </div> */}
    </Box>
    // <Box>
    //   <TextField
    //     ref={textAreaRef}
    //     placeholder={"Type something..."}
    //     fullWidth
    //     value={currentValue}
    //     multiline
    //     minRows={property !== "title" ? 2 : 0}
    //     onChange={handleEditText}
    //     InputProps={{
    //       style: { fontSize: property === "title" ? "30px" : "" },
    //     }}
    //     sx={{
    //       fontWeight: 400,
    //       fontSize: {
    //         xs: "14px",
    //         md: "16px",
    //       },
    //       marginBottom: "5px",
    //       width: "100%",
    //       display: "block",
    //     }}
    //     autoFocus
    //     inputRef={textFieldRef}
    //     onFocus={handleFocus}
    //   />
    // </Box>
  );
};

export default Text;
