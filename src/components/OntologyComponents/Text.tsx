import React, { useEffect, useRef, useState, useCallback } from "react";
import { Box, TextField } from "@mui/material";
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

type ISubOntologyProps = {
  currentVisibleNode: INode;
  setCurrentVisibleNode: (state: any) => void;
  property: string;
  text: string;
  updateInheritance: (parameters: {
    nodeId: string;
    updatedProperty: string;
  }) => void;
  confirmIt?: any;
  nodes: { [id: string]: INode };
  recordLogs: (logs: any) => void;
  setSelectTitle?: any;
  selectTitle?: any;
};

const Text = ({
  currentVisibleNode,
  setCurrentVisibleNode,
  property,
  text,
  updateInheritance,
  confirmIt,
  recordLogs,
  setSelectTitle,
  selectTitle,
}: ISubOntologyProps) => {
  const db = getFirestore();
  const theme: any = useTheme();
  const [editorContent, setEditorContent] = useState(text);
  const textAreaRef = useRef<any>(null); // Create a ref for the TextField

  useEffect(() => {
    setEditorContent(text); // Initialize editor content
  }, [currentVisibleNode.id]);

  useEffect(() => {
    if (selectTitle && property === "title" && textAreaRef.current) {
      textAreaRef.current.focus();
      setTimeout(() => {
        const inputLength = editorContent.length;
        textAreaRef.current.setSelectionRange(0, inputLength + 1000);
      }, 550);
    }
  }, [currentVisibleNode.id, textAreaRef.current, selectTitle]);

  const onSaveTextChange = useCallback(
    async (copyValue: string) => {
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

      if (nodeDoc.exists()) {
        const nodeData = nodeDoc.data() as INode;
        let previousValue = nodeData.properties[property] || "";
        let newValue = copyValue;

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
          nodeData.inheritance[property].title = "";
        }

        await updateDoc(nodeDoc.ref, nodeData);

        if (property !== "title") {
          updateInheritance({
            nodeId: currentVisibleNode.id,
            updatedProperty: property,
          });
        }

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

  const handleChanges = (e: any) => {
    setEditorContent(e.target.value);
    onSaveTextChange(e.target.value);
  };

  const handleBlur = () => {
    if (setSelectTitle) {
      setSelectTitle(false);
    }
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
    </Box>
  );
};

export default Text;
