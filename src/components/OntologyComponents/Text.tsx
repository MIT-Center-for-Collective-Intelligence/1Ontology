import React, { useEffect, useRef, useState, useCallback } from "react";
import { Box, Paper, TextField, Typography } from "@mui/material";
import { debounce } from "lodash";
import {
  getDoc,
  collection,
  doc,
  updateDoc,
  getDocs,
  query,
  where,
  getFirestore,
} from "firebase/firestore";
import { useTheme } from "@emotion/react";
import { INode } from " @components/types/INode";
import { NODES } from " @components/lib/firestoreClient/collections";
import {
  randomProminentColor,
  saveNewChangeLog,
  updateInheritance,
} from " @components/lib/utils/helpers";
import { diffWords, diffLines } from "diff"; // Using diffLines for line-by-line diff
import {
  capitalizeFirstLetter,
  getTitle,
} from " @components/lib/utils/string.utils";
import ManageNodeButtons from "./ManageNodeButtons";
import { DISPLAY } from " @components/lib/CONSTANTS";
import { useAuth } from "../context/AuthContext";
// import YjsEditor from "../YJSEditor/YjsEditor";

type ISubOntologyProps = {
  currentVisibleNode: INode;
  setCurrentVisibleNode: (state: any) => void;
  property: string;
  text: string; // Real-time text from WebSocket
  confirmIt: any;
  nodes: { [id: string]: INode };
  recordLogs: (logs: any) => void;
  setSelectTitle?: any;
  selectTitle?: any;
  locked: boolean;
  selectedDiffNode: any;
  getTitleNode: any;
  root?: any;
  manageLock?: any;
  deleteNode?: any;
  handleLockNode?: any;
  navigateToNode?: any;
  displayInheritanceSettings?: any;
  displayNodeChat?: any;
  displayNodeHistory?: any;
  activeSidebar?: any;
};

const Text = ({
  currentVisibleNode,
  property,
  text, // Real-time text prop from firestore snapshot
  recordLogs,
  confirmIt,
  setSelectTitle,
  selectTitle,
  locked,
  selectedDiffNode,
  getTitleNode,
  root,
  manageLock,
  deleteNode,
  handleLockNode,
  navigateToNode,
  displayInheritanceSettings,
  displayNodeChat,
  displayNodeHistory,
  activeSidebar,
}: ISubOntologyProps) => {
  const db = getFirestore();
  const theme: any = useTheme();
  const [editorContent, setEditorContent] = useState(text); // Local state to manage text
  const textAreaRef = useRef<any>(null);
  const [error, setError] = useState("");
  const [diffContent, setDiffContent] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false); // State to check if user is editing
  const [{ user }] = useAuth();
  const previousValueRef = useRef("");

  const debouncedSaveNewChangeLog = useCallback(
    debounce(async (db, currentVisibleNode, user, property, newValue) => {
      saveNewChangeLog(db, {
        nodeId: currentVisibleNode.id,
        modifiedBy: user?.uname,
        modifiedProperty: property,
        previousValue: previousValueRef.current,
        newValue,
        modifiedAt: new Date(),
        changeType: "change text",
        fullNode: currentVisibleNode,
      });
      previousValueRef.current = "";
    }, 3000),
    []
  );

  const onSaveTextChange = useCallback(
    async (copyValue: string) => {
      if (!user?.uname) return;

      /*       if (currentVisibleNode.inheritance[property]?.ref) {
        if (
          await confirmIt(
            `Are you sure you want to break the inheritance of ${property}?`,
            "Yes",
            "Cancel"
          )
        ) {
          const nodeRef = doc(collection(db, NODES), currentVisibleNode.id);
          updateDoc(nodeRef, {
            [`inheritance.${property}.ref`]: null,
          });
        } else {
          return;
        }
      } */
      const nodeDoc = await getDoc(
        doc(collection(db, NODES), currentVisibleNode.id)
      );

      if (property === "title") {
        const nodeDocs = await getDocs(
          query(
            collection(db, NODES),
            where("title", "==", copyValue.trim()),
            where("deleted", "==", false)
          )
        );
        if (
          nodeDocs.docs.length > 0 &&
          currentVisibleNode.id &&
          nodeDocs.docs[0].id !== currentVisibleNode.id
        ) {
          setError(
            "A node with this title already exists. Please choose a different title."
          );
          return;
        }
      }
      setError("");
      if (nodeDoc.exists()) {
        const nodeData = nodeDoc.data() as INode;
        let previousValue =
          property === "title"
            ? nodeData[property]
            : nodeData.properties[property] || "";
        let newValue = copyValue;

        if (previousValue.trim() === newValue.trim()) {
          return;
        }
        if (!previousValueRef.current) {
          previousValueRef.current = previousValue;
        }
        if (setSelectTitle) {
          setSelectTitle(false);
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
        }

        await updateDoc(nodeDoc.ref, nodeData);

        if (property !== "title") {
          updateInheritance({
            nodeId: currentVisibleNode.id,
            updatedProperty: property,
            db,
          });
        }

        // Call the debounced function instead of directly logging
        debouncedSaveNewChangeLog(
          db,
          currentVisibleNode,
          user,
          property,
          previousValue
        );
      }
    },
    [currentVisibleNode, user?.uname, property]
  );

  useEffect(() => {
    if (!isEditing) {
      setEditorContent(text);
    }
  }, [text, isEditing]);

  useEffect(() => {
    setError("");
    if (selectTitle) {
      textAreaRef.current.focus();
      setEditorContent("");
    } else {
      if (textAreaRef.current) {
        textAreaRef.current.blur();
      }
    }
    if (selectedDiffNode && selectedDiffNode.modifiedProperty === property) {
      const diff = diffLines(
        selectedDiffNode.previousValue || "",
        selectedDiffNode.newValue || ""
      );
      setDiffContent(diff);
    }
  }, [currentVisibleNode.id, selectedDiffNode]);

  const handleChanges = (e: any) => {
    setEditorContent(e.target.value);
    onSaveTextChange(e.target.value);
  };

  const handleBlur = () => {
    setIsEditing(false); // User stopped editing
    if (setSelectTitle) {
      setSelectTitle(false);
    }
  };

  const handleFocus = () => {
    setIsEditing(true); // User started editing
  };

  // Function to render the GitHub-style diff view
  const renderDiff = () => {
    return diffContent.map((part, index) => {
      const lineStyle = part.added
        ? { backgroundColor: "#e6ffed", color: "#2cbe4e" }
        : part.removed
        ? { backgroundColor: "#ffeef0", color: "#d73a49" }
        : {};

      return (
        <Box
          key={index}
          sx={{
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-start",
            gap: "5px",
            padding: "5px 10px",
            borderRadius: "5px",
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: "14px",
            // ...lineStyle,
          }}
        >
          <Typography
            sx={{
              fontWeight: part.added || part.removed ? "bold" : "normal",
              whiteSpace: "pre-wrap",
              flex: 1,
              wordBreak: "break-word",
              color: part.removed ? "red" : "green",
            }}
            component="div"
          >
            {part.added ? "+ " : part.removed ? "- " : "  "}
            {part.value}
          </Typography>
        </Box>
      );
    });
  };

  return (
    <Paper
      elevation={9}
      sx={{ borderRadius: "30px", minWidth: "500px", width: "100%" }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          background: (theme: any) =>
            selectedDiffNode?.changeType === "delete node" &&
            property === "title"
              ? "red"
              : selectedDiffNode?.changeType === "add node" &&
                property === "title"
              ? "green"
              : theme.palette.mode === "dark"
              ? "#242425"
              : "#d0d5dd",
          p: 3,
          pb: 1.5,
          borderTopRightRadius: "25px",
          borderTopLeftRadius: "25px",
          backgroundColor:
            selectedDiffNode &&
            selectedDiffNode.changeType === "add property" &&
            selectedDiffNode.changeDetails.addedProperty === property
              ? "green"
              : "",
        }}
      >
        <Typography
          sx={{
            fontSize: "20px",
            fontWeight: 500,
            fontFamily: "Roboto, sans-serif",
          }}
        >
          {capitalizeFirstLetter(
            DISPLAY[property] ? DISPLAY[property] : property
          )}
        </Typography>
        {selectedDiffNode &&
          selectedDiffNode.changeType === "delete node" &&
          property === "title" && (
            <Typography sx={{ mx: "5px", ml: "145px", fontWeight: "bold" }}>
              DELETED NODE
            </Typography>
          )}
        {currentVisibleNode.inheritance[property]?.ref && (
          <Typography sx={{ fontSize: "14px", ml: "9px" }}>
            {'(Inherited from "'}
            {getTitleNode(currentVisibleNode.inheritance[property].ref || "")}
            {'")'}
          </Typography>
        )}

        {property === "title" && !selectedDiffNode && (
          <ManageNodeButtons
            locked={locked}
            root={root}
            manageLock={manageLock}
            deleteNode={deleteNode}
            getTitleNode={getTitleNode}
            handleLockNode={handleLockNode}
            navigateToNode={navigateToNode}
            displayInheritanceSettings={displayInheritanceSettings}
            displayNodeChat={displayNodeChat}
            displayNodeHistory={displayNodeHistory}
            activeSidebar={activeSidebar}
          />
        )}
      </Box>
      <Typography color="red">{error}</Typography>
      {locked ||
      (selectedDiffNode && selectedDiffNode.modifiedProperty !== property) ? (
        <Typography
          sx={{ fontSize: property === "title" ? "34px" : "19px", p: "19px" }}
        >
          {text}
        </Typography>
      ) : (
        <>
          {selectedDiffNode &&
          selectedDiffNode.modifiedProperty === property ? (
            <Box sx={{ p: "10px", borderRadius: "5px" }}>
              <Box>{renderDiff()}</Box>
            </Box> /* : !currentVisibleNode.inheritance[property]?.ref ? (
            <YjsEditor
              uname={`${user?.fName} ${user?.lName}`}
              property={property}
              nodeId={currentVisibleNode.id}
              color={randomProminentColor()}
              saveChanges={onSaveTextChange}
            />
          ) */
          ) : (
            <TextField
              inputRef={textAreaRef}
              multiline
              minRows={2}
              value={editorContent}
              onChange={handleChanges}
              onFocus={handleFocus} // When the user starts editing
              onBlur={handleBlur} // When the user stops editing
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
          )}
        </>
      )}
    </Paper>
  );
};

export default Text;
