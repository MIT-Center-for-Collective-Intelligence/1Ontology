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
import { INode, InheritanceType } from " @components/types/INode";
import { DISPLAY } from " @components/lib/CONSTANTS";
import { capitalizeFirstLetter } from " @components/lib/utils/string.utils";
import { NODES } from " @components/lib/firestoreClient/collections";
import {
  collection,
  doc,
  getFirestore,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

type InheritanceProps = {
  selectedNode: INode;
  nodes: { [id: string]: INode };
};

const Inheritance: React.FC<InheritanceProps> = ({ selectedNode, nodes }) => {
  const [inheritanceState, setInheritanceState] = useState<{
    [key: string]: InheritanceType;
  }>(
    Object.keys(selectedNode.inheritance).reduce((acc: any, key) => {
      acc[key] = selectedNode.inheritance[key].inheritanceType;
      return acc;
    }, {} as { [key: string]: InheritanceType })
  );

  const db = getFirestore();

  useEffect(() => {
    setInheritanceState(
      Object.keys(selectedNode.inheritance).reduce((acc: any, key) => {
        acc[key] = selectedNode.inheritance[key].inheritanceType;
        return acc;
      }, {} as { [key: string]: InheritanceType })
    );
  }, [selectedNode]);

  const updateSpecializationsInheritance = async (
    specializations: { id: string }[],
    batch: any,
    property: string,
    newValue: string | InheritanceType,
    ref: string
  ) => {
    try {
      let newBatch = batch;
      for (let specialization of specializations) {
        const specializationData = nodes[specialization.id];
        const nodeRef = doc(collection(db, NODES), specialization.id);
        let objectUpdate: any = {
          [`inheritance.${property}.inheritanceType`]: newValue,
        };
        if (newValue === "neverInherit") {
          const referenceId = specializationData.inheritance[property].ref;
          objectUpdate = {
            ...objectUpdate,
            [`inheritance.${property}.ref`]: null,
          };
          if (referenceId && referenceId !== null) {
            const referenceValue = nodes[referenceId].properties[property];
            objectUpdate = {
              ...objectUpdate,
              [`properties.${property}`]: referenceValue,
              [`inheritance.${property}.ref`]: null,
            };
          }
        } else {
          objectUpdate = {
            ...objectUpdate,
            [`inheritance.${property}.ref`]: ref,
          };
        }

        if (newBatch._committed) {
          newBatch = writeBatch(db);
        }
        updateDoc(nodeRef, objectUpdate);

        if (newBatch._mutations.length > 498) {
          await newBatch.commit();
          newBatch = writeBatch(db);
        }

        newBatch = await updateSpecializationsInheritance(
          Object.values(nodes[specialization.id].specializations).flat(),
          newBatch,
          property,
          newValue,
          ref
        );
      }
      return newBatch;
    } catch (error) {
      console.error(error);
    }
  };

  const handleInheritanceChange = useCallback(
    async (property: string, event: any) => {
      const newInheritance = event.target.value as InheritanceType;
      const batch = writeBatch(db);

      const nodeRef = doc(collection(db, NODES), selectedNode.id);
      updateDoc(nodeRef, {
        [`inheritance.${property}.inheritanceType`]: newInheritance,
      });

      const newState = { ...inheritanceState };
      newState[property] = newInheritance;
      setInheritanceState(newState);
      await updateSpecializationsInheritance(
        Object.values(selectedNode.specializations).flat(),
        batch,
        property,
        newInheritance,
        selectedNode.id
      );

      await batch.commit();
    },
    [selectedNode]
  );

  return (
    <Box sx={{ padding: 2 }}>
      <Typography sx={{ fontSize: "20px", mb: "14px", fontWeight: "bold" }}>
        Update Inheritance for {selectedNode.title}
      </Typography>
      {Object.entries(selectedNode.inheritance)
        .sort()
        .map(([key, inheritance]) => (
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
