import React, { useEffect, useRef, useState, useCallback } from "react";
import { Box, Paper, TextField, Typography } from "@mui/material";
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
  saveNewChange,
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

type ISubOntologyProps = {
  currentVisibleNode: INode;
  setCurrentVisibleNode: (state: any) => void;
  property: string;
  text: string;
  confirmIt?: any;
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
};

const Text = ({
  currentVisibleNode,
  setCurrentVisibleNode,
  property,
  text,
  confirmIt,
  recordLogs,
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
}: ISubOntologyProps) => {
  const db = getFirestore();
  const theme: any = useTheme();
  const [editorContent, setEditorContent] = useState(text);
  const textAreaRef = useRef<any>(null);
  const [error, setError] = useState("");
  const [diffContent, setDiffContent] = useState<any[]>([]);
  // const [debouncedContent, setDebouncedContent] = useState(text);
  const [{ user }] = useAuth();

  const onSaveTextChange = useCallback(
    async (copyValue: string) => {
      if (!user?.uname) return;
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
        console.log(
          "currentVisibleNode.id",
          currentVisibleNode.id,
          nodeDocs.docs[0].id,
          nodeDocs.docs.length > 0 &&
            currentVisibleNode.id &&
            nodeDocs.docs[0].id !== currentVisibleNode.id,
          text
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
        if (property === "title") {
          console.log({
            previousValue,
            newValue,
            com: previousValue.trim() !== newValue.trim(),
          });
        }
        if (previousValue.trim() === newValue.trim()) {
          return;
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

        recordLogs({
          action: "Edited a property",
          field: property,
          previousValue,
          newValue,
        });

        saveNewChange(db, {
          nodeId: currentVisibleNode.id,
          modifiedBy: user?.uname,
          modifiedProperty: property,
          previousValue,
          newValue,
          modifiedAt: new Date(),
          changeType: "modify elements",
          fullNode: currentVisibleNode,
        });
      }
    },
    [currentVisibleNode.id, user?.uname, property]
  );

  useEffect(() => {
    setTimeout(() => {
      setEditorContent(text);
    }, 1000);

    setError("");
    if (setSelectTitle) {
      setSelectTitle(false);
    }

    if (selectedDiffNode && selectedDiffNode.modifiedProperty === property) {
      const diff = diffLines(
        selectedDiffNode.previousValue || "",
        selectedDiffNode.newValue || ""
      );
      setDiffContent(diff);
    }
  }, [currentVisibleNode.id, selectedDiffNode, text]);

  useEffect(() => {
    if (selectTitle && property === "title" && textAreaRef.current) {
      textAreaRef.current.focus();
      setTimeout(() => {
        setEditorContent("");
      }, 0);
    }
  }, [currentVisibleNode.id, textAreaRef.current, selectTitle]);

  // useEffect(() => {
  //   const handler = setTimeout(() => {
  //     setDebouncedContent(editorContent);
  //   }, 400);

  //   return () => {
  //     clearTimeout(handler);
  //   };
  // }, [editorContent, text]);

  // useEffect(() => {
  //   if (debouncedContent !== "") {
  //     onSaveTextChange(debouncedContent);
  //   }
  // }, [debouncedContent, onSaveTextChange, currentVisibleNode.id]);

  const handleChanges = (e: any) => {
    setEditorContent(e.target.value);
    onSaveTextChange(e.target.value);
  };

  const handleBlur = () => {
    if (setSelectTitle) {
      setSelectTitle(false);
    }
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
            ...lineStyle,
          }}
        >
          <Typography
            sx={{
              fontWeight: part.added || part.removed ? "bold" : "normal",
              whiteSpace: "pre-wrap",
              flex: 1,
              wordBreak: "break-word",
            }}
            component="div"
          >
            {part.added ? "+ " : part.removed ? "- " : "  "}
            {renderWordDiff(part.value, part.added, part.removed)}
          </Typography>
        </Box>
      );
    });
  };

  // Render word-level diff with stronger colors for added/removed words
  const renderWordDiff = (
    value: string,
    isAdded: boolean,
    isRemoved: boolean
  ) => {
    const diffedWords = diffWords(value, value); // Get word-by-word diff
    return diffedWords.map((wordPart: any, i: any) => {
      const wordStyle = wordPart.added
        ? { backgroundColor: "#acf2bd", fontWeight: "bold" } // Stronger green
        : wordPart.removed
        ? {
            backgroundColor: "#fdb8c0",
            fontWeight: "bold",
            textDecoration: "line-through",
          } // Stronger red
        : {};

      return (
        <span key={i} style={wordStyle}>
          {wordPart.value}
        </span>
      );
    });
  };
  console.log("diffContent ==>", diffContent);
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
            theme.palette.mode === "dark" ? "#242425" : "#d0d5dd",
          p: 3,
          borderTopRightRadius: "25px",
          borderTopLeftRadius: "25px",
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
        {currentVisibleNode.inheritance?.property?.ref && (
          <Typography sx={{ fontSize: "14px", ml: "9px" }}>
            {'(Inherited from "'}
            {getTitleNode(currentVisibleNode.inheritance.property.ref || "")}
            {'")'}
          </Typography>
        )}
        {property === "title" && (
          <ManageNodeButtons
            locked={locked}
            root={root}
            manageLock={manageLock}
            deleteNode={deleteNode}
            getTitleNode={getTitleNode}
            handleLockNode={handleLockNode}
            navigateToNode={navigateToNode}
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
            <Box
              sx={{ p: "10px", border: "1px solid gray", borderRadius: "5px" }}
            >
              <Box>{renderDiff()}</Box>
            </Box>
          ) : (
            <TextField
              inputRef={textAreaRef}
              multiline
              minRows={2}
              value={editorContent}
              onChange={handleChanges}
              onBlur={handleBlur}
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
