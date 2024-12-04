import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, TextField, Tooltip, IconButton } from "@mui/material";
import DoneIcon from "@mui/icons-material/Done";
import { NODES } from " @components/lib/firestoreClient/collections";
import { doc, collection, updateDoc, getFirestore } from "firebase/firestore";
import { link } from "fs";
import { useAuth } from "../context/AuthContext";
type LinkEditorProps = {
  reviewId: string;
  title: string;
  checkDuplicateTitle: any;
  setClonedNodesQueue: any;
};

const LinkEditor: React.FC<LinkEditorProps> = ({
  reviewId,
  title,
  checkDuplicateTitle,
  setClonedNodesQueue,
}) => {
  const db = getFirestore();
  const [{ user }] = useAuth();

  const textFieldRef = useRef<HTMLInputElement>(null);
  const [editorContent, setEditorContent] = useState(title);

  const saveNodeTitle = useCallback(() => {
    try {
      // setClonedNodesQueue(
      //   (prev: { [nodeId: string]: { title: string; id: string } }) => {
      //     prev[reviewId].title = editorContent;
      //     return prev;
      //   }
      // );
      // const nodeRef = doc(collection(db, NODES), reviewId);
      // updateDoc(nodeRef, { title: editorContent });
    } catch (e: any) {
      console.error(e.message);
    }
  }, [db, editorContent, reviewId]);

  // useEffect(() => {
  //   return () => {
  //     saveNodeTitle();
  //   };
  // }, [saveNodeTitle]);

  const handleChanges = (e: any) => {
    setEditorContent(e.target.value);
    setClonedNodesQueue(
      (prev: { [nodeId: string]: { title: string; id: string } }) => {
        prev[reviewId].title = e.target.value;
        return prev;
      }
    );
  };
  useEffect(() => {
    if (textFieldRef.current) {
      textFieldRef.current.focus();
      textFieldRef.current.select();
    }
  }, [reviewId]);
  // const cancelEditingNode = () => {
  //   try {
  //     const currentNode = nodes[link.id];
  //     /*       const generalization = Object.values(
  //       currentNode.generalizations
  //     ).flat()[0] as { id: string }; */

  //     for (let genCollection of currentNode.generalizations) {
  //       for (let generalizationLink of genCollection.nodes) {
  //         const generalizationNode = nodes[generalizationLink.id];
  //         for (
  //           let specCollectionIndex = 0;
  //           specCollectionIndex < generalizationNode.specializations.length;
  //           specCollectionIndex++
  //         ) {
  //           generalizationNode.specializations[specCollectionIndex].nodes =
  //             generalizationNode.specializations[
  //               specCollectionIndex
  //             ].nodes.filter((l: ILinkNode) => l.id !== link.id);
  //         }

  //         const generalizationRef = doc(
  //           collection(db, NODES),
  //           generalizationLink.id
  //         );
  //         updateDoc(generalizationRef, {
  //           specializations: generalizationNode.specializations,
  //         });

  //         const nodeRef = doc(collection(db, NODES), link.id);
  //         updateDoc(nodeRef, { title: editorContent, deleted: true });
  //       }
  //     }

  //     saveNewChangeLog(db, {
  //       nodeId: link.id,
  //       modifiedBy: user?.uname,
  //       modifiedProperty: null,
  //       previousValue: null,
  //       newValue: null,
  //       modifiedAt: new Date(),
  //       changeType: "delete node",
  //       fullNode: currentNode,
  //     });

  //     if (setReviewId) setReviewId("");
  //   } catch (e: any) {
  //     console.error(e.message);
  //   }
  // };
  return (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      <TextField
        inputRef={textFieldRef}
        value={editorContent}
        onChange={handleChanges}
        // sx={{ width: "100%" }}
        placeholder="Node title..."
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            saveNodeTitle();
          }
        }}
        InputProps={{
          inputProps: {
            style: {
              padding: 10,
            },
          },
        }}
      />
    </Box>
  );
};

export default LinkEditor;
