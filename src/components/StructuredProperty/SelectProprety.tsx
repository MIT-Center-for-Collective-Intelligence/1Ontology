import { INode } from "@components/types/INode";
import React, { useEffect, useMemo, useState } from "react";
import {
  capitalizeFirstLetter,
  getTooltipHelper,
} from "@components/lib/utils/string.utils";
import {
  Box,
  Paper,
  Tooltip,
  Typography,
  Select,
  MenuItem,
  TextField,
  Button,
} from "@mui/material";
import {
  saveNewChangeLog,
  updateInheritance,
} from "@components/lib/utils/helpers";
import { collection, doc, getFirestore, updateDoc } from "firebase/firestore";
import { NODES } from "@components/lib/firestoreClient/collections";
import PropertyContributors from "./PropertyContributors";

import { DISPLAY } from "@components/lib/CONSTANTS";
import DeleteIcon from "@mui/icons-material/Delete";
import ChipInput from "../ChipInput/ChipInput";

const SelectProperty = ({
  currentVisibleNode,
  property,
  nodes,
  selectedDiffNode,
  currentImprovement,
  user,
  options,
  skillsFuture,
  enableEdit,
  skillsFutureApp,
}: {
  currentVisibleNode: INode;
  property: string;
  nodes: { [id: string]: INode };
  selectedDiffNode: any;
  currentImprovement: any;
  user: any;
  options: string[];
  skillsFuture: boolean;
  enableEdit: boolean;
  skillsFutureApp: string;
}) => {
  const db = getFirestore();
  const [value, setValue] = useState<
    { performer: string; reason: string; URLs: string[] }[]
  >([]);

  const propertyValue: any[] = useMemo(() => {
    let result = [];
    if (
      currentImprovement &&
      currentImprovement.modifiedProperty === property
    ) {
      result = currentImprovement.detailsOfChange.newValue || [];
    } else if (
      selectedDiffNode &&
      selectedDiffNode.modifiedProperty === property
    ) {
      result = selectedDiffNode.newValue || [];
    } else {
      const prop = currentVisibleNode.properties[property];
      result = Array.isArray(prop) ? prop : [];
    }
    return result;
  }, [property, currentVisibleNode, selectedDiffNode, currentImprovement]);

  useEffect(() => {
    setValue(JSON.parse(JSON.stringify(propertyValue)));
  }, [propertyValue]);

  const updateValue = async (newValue: any) => {
    try {
      if (
        !!currentImprovement ||
        !!selectedDiffNode ||
        !!currentVisibleNode.unclassified
      )
        return;

      setValue(newValue);

      const previousValue: any = JSON.parse(
        JSON.stringify(currentVisibleNode.properties[property]),
      );

      const nodeRef = doc(collection(db, NODES), currentVisibleNode?.id);

      if (
        !!currentVisibleNode.inheritance[property] &&
        !!currentVisibleNode.inheritance[property]?.ref
      ) {
        await updateInheritance({
          nodeId: currentVisibleNode?.id,
          updatedProperties: [property],
          db,
        });
      }

      await saveNewChangeLog(db, {
        nodeId: currentVisibleNode?.id,
        modifiedBy: user?.uname,
        modifiedProperty: property,
        previousValue,
        newValue,
        modifiedAt: new Date(),
        changeType: "change select-string",
        fullNode: currentVisibleNode,
        skillsFuture,
        ...(skillsFutureApp ? { appName: skillsFutureApp } : {}),
      });
      await updateDoc(nodeRef, {
        [`properties.${property}`]: newValue,
        [`inheritance.${property}.ref`]: null,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handlePerformerChange = (index: number, newPerformer: string) => {
    const updated = [...value];
    updated[index].performer = newPerformer;
    updateValue(updated);
  };

  const handleReasonChange = (index: number, newReason: string) => {
    const updated = [...value];
    updated[index].reason = newReason;
    setValue(updated);
    updateValue(updated);
  };

  const handleURLsChange = (
    index: number,
    newURLs: string[],
    added: string[],
    removed: string[],
  ) => {
    const updated = [...value];
    updated[index].URLs = newURLs;
    updateValue(updated);
  };

  const handleAddEntry = () => {
    const updated = [...value, { performer: "", reason: "", URLs: [] }];
    updateValue(updated);
  };

  const handleRemoveEntry = (index: number) => {
    const updated = [...value];
    updated.splice(index, 1);
    updateValue(updated);
  };
  const DiffLine = ({
    label,
    prev,
    next,
  }: {
    label: string;
    prev: string;
    next: string;
  }) => {
    if (prev === next) {
      return (
        <Typography sx={{ mb: 0.5 }}>
          {label}: {next || "-"}
        </Typography>
      );
    }

    return (
      <Typography sx={{ mb: 0.5 }}>
        {label}:{" "}
        <span style={{ color: "red", textDecoration: "line-through" }}>
          {prev || "-"}
        </span>{" "}
        → <span style={{ color: "green" }}>{next || "-"}</span>
      </Typography>
    );
  };

  const renderDiff = (previousValue: any[], newValue: any[]) => {
    const maxLength = Math.max(previousValue.length, newValue.length);

    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {[...Array(maxLength)].map((_, index) => {
          const prev = previousValue[index] || {};
          const next = newValue[index] || {};

          return (
            <Paper
              key={index}
              sx={{ p: 2, border: "1px solid #ccc", borderRadius: "10px" }}
            >
              <Typography sx={{ fontWeight: "bold", mb: 1 }}>
                Entry {index + 1}
              </Typography>

              <DiffLine
                label="Performer"
                prev={prev.performer}
                next={next.performer}
              />
              <DiffLine label="Reason" prev={prev.reason} next={next.reason} />

              <DiffLine
                label="URLs"
                prev={(prev.URLs || []).join(", ")}
                next={(next.URLs || []).join(", ")}
              />
            </Paper>
          );
        })}
      </Box>
    );
  };

  return (
    <Paper
      id={`property-${property}`}
      elevation={9}
      sx={{
        borderRadius: "30px",
        borderBottomRightRadius: "18px",
        borderBottomLeftRadius: "18px",
        minWidth: "500px",
        width: "100%",
        maxHeight: "100%",
        overflow: "auto",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
        pb: "10px",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          background: (theme: any) =>
            theme.palette.mode === "dark" ? "#242425" : "#d0d5dd",
          p: 3,
        }}
      >
        <Tooltip title={getTooltipHelper(property)}>
          <Typography
            sx={{
              fontSize: "20px",
              fontWeight: 500,
              fontFamily: "Roboto, sans-serif",
            }}
          >
            {capitalizeFirstLetter(
              DISPLAY[property] ? DISPLAY[property] : property,
            )}
          </Typography>
        </Tooltip>

        <Box sx={{ display: "flex", ml: "auto", gap: "14px" }}>
          <PropertyContributors
            currentVisibleNode={currentVisibleNode}
            property={property}
          />
        </Box>
      </Box>

      {selectedDiffNode && selectedDiffNode.modifiedProperty === property ? (
        <Box sx={{ p: "10px", borderRadius: "5px" }}>
          <Box sx={{ display: "flow", gap: "3px", p: "14px" }}>
            {renderDiff(
              selectedDiffNode.previousValue,
              selectedDiffNode.newValue,
            )}
          </Box>
        </Box>
      ) : (
        <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 4 }}>
          {value.map((entry, index) => (
            <Box
              key={index}
              sx={{
                p: 2,
                borderRadius: "10px",
                border: (theme) =>
                  theme.palette.mode === "dark"
                    ? "1px solid #ccc"
                    : "1px solid #221f1f",
                backgroundColor: (theme) =>
                  theme.palette.mode === "dark" ? "#3f3f40" : "#e2e2e2",
              }}
            >
              {enableEdit ? (
                <Box>
                  <Button
                    onClick={() => handleRemoveEntry(index)}
                    sx={{
                      mt: 1,
                      color: "red",
                      border: "1px solid red",
                      borderRadius: "15px",
                      ml: "auto",
                      mb: "10px",
                    }}
                  >
                    Delete
                  </Button>
                  <Select
                    value={entry.performer || ""}
                    onChange={(e) =>
                      handlePerformerChange(index, e.target.value)
                    }
                    fullWidth
                    sx={{ borderRadius: "20px" }}
                  >
                    {[
                      "a single human",
                      "collaboration of humans",
                      "collaboration of humans and ai",
                      "ai",
                    ].map((opt) => (
                      <MenuItem key={opt} value={opt}>
                        {opt}
                      </MenuItem>
                    ))}
                  </Select>

                  <TextField
                    label="Reason"
                    value={entry.reason || ""}
                    onChange={(e) => handleReasonChange(index, e.target.value)}
                    fullWidth
                    multiline
                    sx={{ mt: 2 }}
                  />
                  <Box
                    sx={{
                      border: "1px solid gray",
                      borderRadius: "15px",
                      mt: "15px",
                    }}
                  >
                    <ChipInput
                      tags={entry.URLs || []}
                      selectedTags={() => {}}
                      updateTags={(newTags, added, removed) =>
                        handleURLsChange(index, newTags, added, removed)
                      }
                      placeholder="Add URL"
                      label="URLs"
                      fontSize="10px"
                    />
                  </Box>
                </Box>
              ) : (
                <>
                  <Typography
                    sx={{ fontSize: "18px", textTransform: "capitalize" }}
                  >
                    Performer: {entry.performer}
                  </Typography>
                  <Typography sx={{ fontSize: "18px", mt: 1 }}>
                    Reason: {entry.reason}
                  </Typography>
                  <ChipInput
                    tags={entry.URLs || []}
                    selectedTags={() => {}}
                    updateTags={() => {}}
                    placeholder="URLs"
                    readOnly
                    fontSize="10px"
                  />
                </>
              )}
            </Box>
          ))}

          {enableEdit && (
            <Button
              variant="outlined"
              onClick={handleAddEntry}
              sx={{ alignSelf: "flex-start", borderRadius: "25px" }}
            >
              Add Entry
            </Button>
          )}
        </Box>
      )}
    </Paper>
  );
};

export default SelectProperty;
