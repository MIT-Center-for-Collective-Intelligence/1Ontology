import React, { useCallback, useEffect, useState } from "react";
import {
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Box,
  Typography,
} from "@mui/material";
import { INode } from " @components/types/INode";
import { DISPLAY } from " @components/lib/CONSTANTS";
import { capitalizeFirstLetter } from " @components/lib/utils/string.utils";
import { updateDocSimple } from " @components/lib/firestoreClient/collections";
import { getFirestore } from "firebase/firestore";

type InheritanceProps = {
  selectedNode: INode;
};

const Inheritance: React.FC<InheritanceProps> = ({ selectedNode }) => {
  const [inheritanceState, setInheritanceState] = useState<{
    [key: string]: string;
  }>(
    Object.keys(selectedNode.inheritance).reduce((acc, key) => {
      acc[key] = selectedNode.inheritance[key].inheritanceType;
      return acc;
    }, {} as { [key: string]: string })
  );

  const db = getFirestore();

  useEffect(() => {
    setInheritanceState(
      Object.keys(selectedNode.inheritance).reduce((acc, key) => {
        acc[key] = selectedNode.inheritance[key].inheritanceType;
        return acc;
      }, {} as { [key: string]: string })
    );
  }, [selectedNode]);

  const handleInheritanceChange = useCallback(
    (property: string, event: any) => {
      const newInheritance = selectedNode.inheritance;
      newInheritance[property].inheritanceType = event.target.value;

      updateDocSimple(db, selectedNode.id, {
        inheritance: newInheritance,
      });
      const newState = { ...inheritanceState };
      newState[property] = event.target.value;

      setInheritanceState(newState);
    },
    [selectedNode]
  );

  return (
    <Box sx={{ padding: 2 }}>
      <Typography sx={{ fontSize: "20px", mb: "14px", fontWeight: "bold" }}>
        Update Inheritance for {selectedNode.title}
      </Typography>
      {Object.entries(selectedNode.inheritance).map(([key, inheritance]) => (
        <Box key={key} sx={{ marginBottom: 3 }}>
          <FormControl component="fieldset">
            <FormLabel
              component="legend"
              sx={{
                fontSize: "20px",
                fontWeight: "bold",
                ml: "15px",
                mb: "13px",
                backgroundColor: (theme) =>
                  theme.palette.mode === "dark" ? "#242425" : "#D0D5D1",
                p: "10px",
                borderRadius: "25px",
              }}
            >
              {capitalizeFirstLetter(DISPLAY[key] ? DISPLAY[key] : key)}
            </FormLabel>
            <RadioGroup
              value={inheritanceState[key]}
              onChange={(e) => handleInheritanceChange(key, e)}
              sx={{ ml: "15px" }}
            >
              {[
                { value: "neverInherit", label: "Never Inherit" },
                { value: "alwaysInherit", label: "Always Inherit" },
                {
                  value: "inheritUnlessAlreadyOverRidden",
                  label: "Inherit Unless Already Overridden",
                },
              ].map(({ value, label }) => (
                <FormControlLabel
                  key={value}
                  value={value}
                  control={<Radio />}
                  label={label}
                  id={value}
                />
              ))}
            </RadioGroup>
          </FormControl>
        </Box>
      ))}
    </Box>
  );
};

export default Inheritance;
