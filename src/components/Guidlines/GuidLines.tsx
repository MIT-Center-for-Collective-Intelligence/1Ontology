import React, { useEffect, useState } from "react";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  TextField,
  IconButton,
  Button,
  Box,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AddIcon from "@mui/icons-material/Add";
import {
  collection,
  getFirestore,
  onSnapshot,
  query,
  addDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { GUIDELINES } from " @components/lib/firestoreClient/collections";
import { useAuth } from "../context/AuthContext";
import GuidLineText from "./GuidLineText";

const GuidLines = ({ setDisplayGuidelines }: { setDisplayGuidelines: any }) => {
  const db = getFirestore();
  const [{ user }] = useAuth();
  const [guidelines, setGuidelines] = useState<{ [id: string]: any }>({});
  const [newGuidelines, setNewGuidelines] = useState<{ [id: string]: string }>(
    {}
  );

  useEffect(() => {
    const nodesQuery = query(collection(db, GUIDELINES));

    const unsubscribeNodes = onSnapshot(nodesQuery, (snapshot) => {
      const docChanges = snapshot.docChanges();
      setGuidelines((prev) => {
        const updatedGuidelines = { ...prev };
        for (let change of docChanges) {
          const changeData: any = change.doc.data();
          const id = change.doc.id;
          if (change.type === "removed") {
            delete updatedGuidelines[id];
          } else {
            updatedGuidelines[id] = { ...changeData, id };
          }
        }
        return updatedGuidelines;
      });
    });

    return () => unsubscribeNodes();
  }, [db]);

  const handleNewGuidelineChange = (categoryId: string, value: string) => {
    setNewGuidelines((prev) => ({ ...prev, [categoryId]: value }));
  };

  const addNewGuideline = async (categoryId: string) => {
    const newGuideline = newGuidelines[categoryId];
    if (newGuideline.trim()) {
      const categoryGuidelines = guidelines[categoryId]?.guidelines || [];
      const updatedGuidelines = [...categoryGuidelines, newGuideline];
      await addDoc(collection(db, GUIDELINES), {
        ...guidelines[categoryId],
        guidelines: updatedGuidelines,
      });
      setNewGuidelines((prev) => ({ ...prev, [categoryId]: "" }));
    }
  };

  const sortedCategories = Object.keys(guidelines).sort(
    (a, b) => guidelines[a].index - guidelines[b].index
  );

  const modifyGuidelines = (newValue: string, gId: string, gIdx: number) => {
    const gRef = doc(collection(db, GUIDELINES), gId);
    const gData = { ...guidelines[gId] };
    gData.guidelines[gIdx] = newValue;
    updateDoc(gRef, gData);
  };

  return (
    <Box>
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 3,
          py: 3,
          backgroundColor: (theme) =>
            theme.palette.mode === "dark" ? "#1b1a1a" : "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography sx={{ fontSize: "45px" }}>Guidelines</Typography>
        <Button
          variant="contained"
          sx={{ mb: "3px", mr: 2, ml: "auto" }}
          onClick={() => {
            setDisplayGuidelines(false);
          }}
        >
          Hide guidelines
        </Button>
      </Box>

      {sortedCategories.map((catId) => (
        <Accordion
          defaultExpanded={true}
          key={catId}
          sx={{ borderRadius: "16px", border: "none" }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontSize: "29px", fontWeight: "bold" }}>
              {guidelines[catId].category}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ mt: -5.5 }}>
            {!!user?.copilot ? (
              guidelines[catId].guidelines.map(
                (guideline: string, index: number) => (
                  <GuidLineText
                    key={index + catId}
                    guideline={guideline}
                    index={index}
                    onSaveGuideline={modifyGuidelines}
                    catId={catId}
                  />
                )
              )
            ) : (
              <ul>
                {guidelines[catId].guidelines.map(
                  (guideline: string, index: number) => (
                    <li key={guideline + index}>{guideline}</li>
                  )
                )}
              </ul>
            )}
            {!!user?.copilot && (
              <TextField
                fullWidth
                label="Add new guideline"
                value={newGuidelines[catId] || ""}
                onChange={(e) =>
                  handleNewGuidelineChange(catId, e.target.value)
                }
                variant="outlined"
                margin="normal"
                InputLabelProps={{
                  style: { color: "grey" },
                }}
              />
            )}
            {newGuidelines[catId]?.trim() && !!user?.copilot && (
              <Button
                color="primary"
                onClick={() => addNewGuideline(catId)}
                disabled={!newGuidelines[catId]?.trim()}
              >
                Add new guideline
              </Button>
            )}
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

export default GuidLines;
