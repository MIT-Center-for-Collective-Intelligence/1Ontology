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
import CloseIcon from "@mui/icons-material/Close";

const GuidLines = ({ setDisplayGuidelines }: { setDisplayGuidelines: any }) => {
  const db = getFirestore();
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

  const sortedCategories = Object.keys(guidelines)
    .sort((a, b) => guidelines[a].index - guidelines[b].index)
    .map((categoryId) => guidelines[categoryId]);

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
        }}
      >
        <Button
          variant="contained"
          sx={{ mb: "3px" }}
          onClick={() => {
            setDisplayGuidelines(false);
          }}
        >
          Hide guidelines
        </Button>
      </Box>

      {sortedCategories.map((category) => (
        <Accordion defaultExpanded={true} key={category.id}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontSize: "24px" }}>
              {category.category}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            {category.guidelines.map((guideline: string, index: number) => (
              <TextField
                key={index}
                fullWidth
                label={`Guideline ${index + 1}`}
                defaultValue={guideline}
                variant="outlined"
                margin="normal"
                InputLabelProps={{
                  style: { color: "grey" },
                }}
                multiline
                onChange={(e) =>
                  modifyGuidelines(e.target.value, category.id, index)
                }
              />
            ))}
            <TextField
              fullWidth
              label="Add new guideline"
              value={newGuidelines[category.id] || ""}
              onChange={(e) =>
                handleNewGuidelineChange(category.id, e.target.value)
              }
              variant="outlined"
              margin="normal"
              InputLabelProps={{
                style: { color: "grey" },
              }}
            />
            {newGuidelines[category.id]?.trim() && (
              <Button
                color="primary"
                onClick={() => addNewGuideline(category.id)}
                disabled={!newGuidelines[category.id]?.trim()}
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
