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
import { ILockecOntology, IOntology } from " @components/types/IOntology";

type ISubOntologyProps = {
  openOntology: IOntology;
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
  updateInhiretance: (parameters: {
    updatedOntology: IOntology;
    updatedField: string;
    type: "subOntologies" | "plainText";
    newValue: any;
    ancestorTitle: string;
  }) => void;
};
const SubPlainText = ({
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
  updateInhiretance,
}: ISubOntologyProps) => {
  const db = getFirestore();
  const [editMode, setEditMode] = useState(false);
  const textFieldRef = useRef<any>(null);

  const capitalizeFirstLetter = (word: string) => {
    return word.charAt(0).toUpperCase() + word.slice(1);
  };

  const editTitleSubOntology = ({ parentData, newTitle, id }: any) => {
    for (let type in parentData.subOntologies) {
      for (let category in parentData.subOntologies[type] || {}) {
        if (
          (parentData.subOntologies[type][category].ontologies || []).length > 0
        ) {
          const subOntologyIdx = parentData.subOntologies[type][
            category
          ].ontologies.findIndex((sub: any) => sub.id === id);
          if (subOntologyIdx !== -1) {
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
    setEditMode((edit) => !edit);
    if (editMode) {
      const ontologyDoc = await getDoc(
        doc(collection(db, "ontology"), openOntology.id)
      );
      if (ontologyDoc.exists()) {
        const ontologyData: any = ontologyDoc.data();

        if (type === "title") {
          setEditOntology("");
          for (let parentId of openOntology?.parents || []) {
            const parentRef = doc(collection(db, "ontology"), parentId);
            const parentDoc = await getDoc(parentRef);
            const parentData: any = parentDoc.data();
            editTitleSubOntology({
              parentData,
              newTitle: openOntology.title,
              id: openOntology.id,
            });
            await updateDoc(parentRef, parentData);
          }
        }
        let previousValue = "";
        let newValue = "";

        if (["description", "title"].includes(type)) {
          previousValue = ontologyData[type];
          newValue = openOntology[type as "description" | "title"];
          ontologyData[type] = openOntology[type as "description" | "title"];
        } else {
          previousValue = ontologyData.plainText[type];
          newValue = openOntology.plainText[type];
          ontologyData.plainText[type] = openOntology.plainText[type] || "";
        }
        if (type !== "title" && ontologyData.inheritance) {
          ontologyData.inheritance.plainText[type] = {
            ref: null,
            title: "",
          };
        }

        await updateDoc(ontologyDoc.ref, ontologyData);

        //need to call this to update the children according to the Inhiretance
        //Title doesn't have Inhiretance
        updateInhiretance({
          updatedField: type,
          type: "plainText",
          newValue: newValue,
          updatedOntology: { ...ontologyData, id: openOntology.id },
          ancestorTitle: ontologyData.title,
        });

        addLock(openOntology.id, type, "remove");
        recordLogs({
          action: "Edited a field",
          field: type,
          previousValue,
          newValue,
        });
      }
    } else {
      await addLock(openOntology.id, type, "add");
    }
  };

  const handleEditText = (e: any) => {
    setOpenOntology((openOntology: IOntology) => {
      const _openOntology: IOntology = { ...openOntology };
      if (["description", "title"].includes(type)) {
        _openOntology[type as "description" | "title"] = e.target.value;
      } else {
        _openOntology.plainText[type] = e.target.value;
      }

      return _openOntology;
    });
  };
  const handleFocus = (event: any) => {
    if (type === "title" && editOntology === openOntology.id) {
      event.target.select();
    }
  };

  const handleDeleteOntology = () => {
    deleteSubOntologyEditable();
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
            <Tooltip title={editMode ? "Save" : "Edit"}>
              <Button onClick={onSaveTextChange} sx={{ ml: "5px" }}>
                {editMode ? "Save" : "Edit"}
              </Button>
            </Tooltip>
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
          value={text}
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
                  <Tooltip title={"Save"}>
                    <Button onClick={onSaveTextChange} sx={{ ml: "5px" }}>
                      {editMode ? "Save" : "Edit"}
                    </Button>
                  </Tooltip>
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
                <Tooltip title={editMode ? "Save" : "Edit"}>
                  <Button onClick={onSaveTextChange} sx={{ ml: "5px" }}>
                    {editMode ? "Save" : "Edit"}
                  </Button>
                </Tooltip>
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

export default SubPlainText;
