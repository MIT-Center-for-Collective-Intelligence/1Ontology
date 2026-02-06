import React, { useCallback, useEffect, useState } from "react";
import {
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Box,
  Typography,
  Paper,
} from "@mui/material";
import { INode, InheritanceType } from "@components/types/INode";
import { DISPLAY, SCROLL_BAR_STYLE } from "@components/lib/CONSTANTS";
import { capitalizeFirstLetter } from "@components/lib/utils/string.utils";
import { NODES } from "@components/lib/firestoreClient/collections";
import {
  collection,
  doc,
  getFirestore,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

type InheritanceProps = {
  selectedNode: INode;
  nodes: { [id: string]: INode };
  fetchNode: (nodeId: string) => Promise<INode | null>;
};

const Inheritance: React.FC<InheritanceProps> = ({ selectedNode, nodes, fetchNode }) => {
  const [inheritanceState, setInheritanceState] = useState<{
    [key: string]: InheritanceType;
  }>(
    Object.keys(selectedNode.inheritance).reduce((acc: any, key) => {
      acc[key] = selectedNode.inheritance[key].inheritanceType;
      return acc;
    }, {} as { [key: string]: InheritanceType })
  );

  const [{ user }] = useAuth();

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
        // lookup specialization data
        let specializationData: INode | null = nodes[specialization.id] || null;
        if (!specializationData) {
          console.log("[INHERITANCE] Fetching specialization not in cache:", specialization.id);
          specializationData = await fetchNode(specialization.id);
          if (!specializationData) {
            console.warn("[INHERITANCE] Could not fetch specialization:", specialization.id);
            continue;
          }
        }

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
            // lookup reference value
            let referenceNode: INode | null = nodes[referenceId] || null;
            if (!referenceNode) {
              console.log("[INHERITANCE] Fetching reference node not in cache:", referenceId);
              referenceNode = await fetchNode(referenceId);
            }

            if (referenceNode) {
              const referenceValue = referenceNode.properties[property];
              objectUpdate = {
                ...objectUpdate,
                [`properties.${property}`]: referenceValue,
                [`inheritance.${property}.ref`]: null,
              };
            }
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
        newBatch.update(nodeRef, objectUpdate);

        if (newBatch._mutations.length > 498) {
          await newBatch.commit();
          newBatch = writeBatch(db);
        }

        // lookup for specializations
        let specializationNodeData: INode | null = nodes[specialization.id] || null;
        if (!specializationNodeData) {
          console.log("[INHERITANCE] Fetching specialization (for recursive call) not in cache:", specialization.id);
          specializationNodeData = await fetchNode(specialization.id);
        }

        if (specializationNodeData) {
          newBatch = await updateSpecializationsInheritance(
            specializationNodeData.specializations.flatMap((n) => n.nodes),
            newBatch,
            property,
            newValue,
            ref
          );
        }
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
        selectedNode.specializations.flatMap((n) => n.nodes),
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
    <Box
      sx={{
        padding: 2,
        overflow: "auto",
        height: "90vh",
        width: "100%",
        borderRadius: "10px",
        ...SCROLL_BAR_STYLE,
      }}
    >
      {Object.entries(selectedNode.inheritance)
        .sort()
        .map(([key, inheritance]) => (
          <Paper
            key={key}
            sx={{
              marginBottom: 3,
              borderRadius: "15px",
              overflow: "hidden",
              boxShadow: (theme) =>
                theme.palette.mode === "dark"
                  ? "0px 4px 8px rgba(0, 0, 0, 0.3)"
                  : "0px 4px 8px rgba(0, 0, 0, 0.1)",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                backgroundColor: (theme) =>
                  theme.palette.mode === "dark" ? "#242425" : "#d0d5dd",
                color: (theme) =>
                  theme.palette.mode === "dark" ? "#fff" : "#fff",
                padding: "12px 20px",
                gap: "10px",
                width: "100%",
                borderTopLeftRadius: "15px",
                borderTopRightRadius: "15px",
              }}
            >
              <Typography sx={{ fontWeight: "bold", fontSize: "1.2rem" }}>
                {capitalizeFirstLetter(DISPLAY[key] ? DISPLAY[key] : key)}
              </Typography>
            </Box>
            <Box sx={{ padding: 2 }}>
              <FormControl component="fieldset" disabled={!user?.manageLock}>
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
                      sx={{
                        "& .MuiTypography-root": {
                          fontSize: "0.95rem",
                          color: (theme) =>
                            theme.palette.mode === "dark" ? "#ddd" : "#333",
                        },
                        "& .MuiRadio-root": {
                          color: (theme) =>
                            theme.palette.mode === "dark" ? "#fff" : "#3f51b5",
                        },
                      }}
                    />
                  ))}
                </RadioGroup>
              </FormControl>
            </Box>
          </Paper>
        ))}
    </Box>
  );
};

export default Inheritance;
