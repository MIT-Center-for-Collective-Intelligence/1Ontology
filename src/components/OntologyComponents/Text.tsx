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
import YjsEditor from "../YJSEditor/YjsEditor";
// import YjsEditor from "../YJSEditor/YjsEditor";

type ISubOntologyProps = {
  currentVisibleNode: INode;
  setCurrentVisibleNode: Function;
  property: string;
  text: string; // Real-time text from WebSocket
  confirmIt: any;
  nodes: { [id: string]: INode };
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
  displaySidebar?: Function;
  activeSidebar?: any;
};

const Text = ({
  currentVisibleNode,
  property,
  text, // Real-time text prop from firestore snapshot
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
  displaySidebar,
  activeSidebar,
}: ISubOntologyProps) => {
  const db = getFirestore();
  const theme: any = useTheme();
  const [editorContent, setEditorContent] = useState(text); // Local state to manage text
  const textAreaRef = useRef<any>(null);
  const [error, setError] = useState("");

  const [isEditing, setIsEditing] = useState(false); // State to check if user is editing
  const [{ user }] = useAuth();
  const previousValueRef = useRef("");

  /*   const debouncedSaveNewChangeLog = useCallback(
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
  ); */

  const saveChangeHistory = useCallback(
    (previousValue: string, newValue: string) => {
      if (!user?.uname) return;
      saveNewChangeLog(db, {
        nodeId: currentVisibleNode.id,
        modifiedBy: user.uname,
        modifiedProperty: property,
        previousValue: previousValue,
        newValue,
        modifiedAt: new Date(),
        changeType: "change text",
        fullNode: currentVisibleNode,
      });
    },
    [currentVisibleNode.id, db, property, user]
  );

  const onSaveTextChange = useCallback(
    async (copyValue: string) => {
      if (!user?.uname) return;

      if (currentVisibleNode.inheritance[property]?.ref) {
        const nodeRef = doc(collection(db, NODES), currentVisibleNode.id);
        updateDoc(nodeRef, {
          [`inheritance.${property}.ref`]: null,
          [`properties.${property}`]: text,
        });
        updateInheritance({
          nodeId: currentVisibleNode.id,
          updatedProperty: property,
          db,
        });
      } else {
        return;
      }

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
        if (typeof nodeData.properties[property] !== "string") return;
        let previousValue: string =
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
      }
    },
    [currentVisibleNode, user?.uname, property, text]
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
  }, [currentVisibleNode.id]);

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

  const renderDiff = (previousValue: string, newValue: string) => {
    const diffContent = diffWords(previousValue, newValue);

    const addedText = diffContent
      .filter((part) => part.added)
      .map((part) => part.value)
      .join("");

    return diffContent.map((word) => (
      <div key={word.value}>
        <span
          style={{
            fontSize: property === "title" ? "29px" : "19px",
            color: word.added ? "green" : word.removed ? "red" : "",
            textDecoration: word.removed ? "line-through" : "none",
          }}
        >
          {word.value}
        </span>
      </div>
    ));
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

        {property === "title" && !selectedDiffNode && displaySidebar && (
          <ManageNodeButtons
            locked={locked}
            root={root}
            manageLock={manageLock}
            deleteNode={deleteNode}
            getTitleNode={getTitleNode}
            handleLockNode={handleLockNode}
            navigateToNode={navigateToNode}
            displaySidebar={displaySidebar}
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
              <Box sx={{ display: "flow", gap: "3px", p: "14px" }}>
                {renderDiff(
                  selectedDiffNode.previousValue,
                  selectedDiffNode.newValue
                )}
              </Box>
            </Box>
          ) : !currentVisibleNode.inheritance[property]?.ref ? (
            <YjsEditor
              fullname={`${user?.fName} ${user?.lName}`}
              property={property}
              nodeId={currentVisibleNode.id}
              color={randomProminentColor()}
              saveChangeHistory={saveChangeHistory}
            />
          ) : (
            <TextField
              inputRef={textAreaRef}
              multiline
              minRows={2}
              value={editorContent}
              onChange={handleChanges}
              onFocus={handleFocus} // When the user starts editing
              onBlur={handleBlur} // When the user stops editing
              placeholder=""
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
