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
  Chip,
} from "@mui/material";
import { saveNewChangeLog } from "@components/lib/utils/helpers";
import { collection, doc, getFirestore, updateDoc } from "firebase/firestore";
import { NODES } from "@components/lib/firestoreClient/collections";
import PropertyContributors from "./PropertyContributors";

import { DISPLAY, performerColors } from "@components/lib/CONSTANTS";
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
  const [value, setValue] = useState<{
    performer: string;
    reason: string;
    sources: { domain: string; title: string }[];
  }>({
    performer: "",
    reason: "",
    sources: [],
  });

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
    const prop = currentVisibleNode.properties[property];
    setValue(JSON.parse(JSON.stringify(prop)));
  }, [property, currentVisibleNode.id]);

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

      saveNewChangeLog(db, {
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

  const handlePerformerChange = (newPerformer: string) => {
    const updated = { ...value };
    updated.performer = newPerformer;
    updateValue(updated);
  };

  const handleReasonChange = (newReason: string) => {
    const updated = { ...value };
    updated.reason = newReason;
    setValue(updated);
    updateValue(updated);
  };

  const handleURLsChange = (sources: { title: string; domain: string }[]) => {
    const newSources: { title: string; domain: string }[] = sources;
    const updated = { ...value };
    updated.sources = newSources;
    updateValue(updated);
  };

  interface Source {
    domain?: string;
    title: string;
  }

  interface Value {
    performer: string;
    reason: string;
    sources: Source[];
  }

  function renderDiff(previousValue: Value, newValue: Value): React.ReactNode {
    const blocks: React.ReactNode[] = [];

    const isDifferent = (a: unknown, b: unknown) =>
      JSON.stringify(a) !== JSON.stringify(b);

    // Performer
    if (previousValue.performer !== newValue.performer) {
      blocks.push(
        <Box key="performer" sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: "20px" }}>Performer:</Typography>
          <Box sx={{ color: "red", textDecoration: "line-through" }}>
            {previousValue.performer}
          </Box>
          <Box sx={{ color: "green" }}>{newValue.performer}</Box>
        </Box>,
      );
    } else {
      blocks.push(
        <Box key="performer" sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: "20px" }}>Performer:</Typography>
          <Box>{newValue.performer}</Box>
        </Box>,
      );
    }

    if (previousValue.reason !== newValue.reason) {
      blocks.push(
        <Box key="reason" sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: "20px" }}>Reason:</Typography>
          <Box sx={{ color: "red", textDecoration: "line-through" }}>
            {" "}
            {previousValue.reason}
          </Box>
          <Box sx={{ color: "green" }}> {newValue.reason}</Box>
        </Box>,
      );
    } else {
      blocks.push(
        <Box key="reason" sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: "20px" }}>Reason:</Typography>
          <Box>{newValue.reason}</Box>
        </Box>,
      );
    }

    const prevSources = previousValue.sources || [];
    const newSources = newValue.sources || [];
    const sourcesChanged = isDifferent(prevSources, newSources);

    if (sourcesChanged) {
      blocks.push(
        <Box key="sources">
          <Typography sx={{ fontSize: "20px" }}>Sources:</Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: "5px", mb: 1 }}>
            {prevSources.length > 0 ? (
              prevSources.map((c, i) => (
                <Chip
                  key={`prev-${i}`}
                  label={
                    c.domain
                      ? `Domain: ${c.domain} Title: ${c.title}`
                      : `${c.title}`
                  }
                  sx={{ backgroundColor: "red", color: "white" }}
                />
              ))
            ) : (
              <Chip
                label="No sources"
                sx={{ backgroundColor: "red", color: "white" }}
              />
            )}
          </Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
            {newSources.length > 0 ? (
              newSources.map((c, i) => (
                <Chip
                  key={`new-${i}`}
                  label={
                    c.domain
                      ? `Domain: ${c.domain} Title: ${c.title}`
                      : `${c.title}`
                  }
                  sx={{ backgroundColor: "green", color: "white" }}
                />
              ))
            ) : (
              <Chip
                label="No sources"
                sx={{ backgroundColor: "green", color: "white" }}
              />
            )}
          </Box>
        </Box>,
      );
    } else {
      blocks.push(
        <Box key="sources">
          <Typography sx={{ fontSize: "20px" }}>Sources:</Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
            {newSources.length > 0 ? (
              newSources.map((c, i) => (
                <Chip
                  key={`same-${i}`}
                  label={
                    c.domain
                      ? `Domain: ${c.domain} Title: ${c.title}`
                      : `${c.title}`
                  }
                  sx={{ backgroundColor: "grey.400", color: "white" }}
                />
              ))
            ) : (
              <Chip
                label="No sources"
                sx={{ backgroundColor: "grey.400", color: "white" }}
              />
            )}
          </Box>
        </Box>,
      );
    }

    return <>{blocks}</>;
  }

  return (
    <Paper
      id={`property-${property}`}
      elevation={9}
      sx={{
        borderRadius: "30px",
        borderBottomRightRadius: "18px",
        borderBottomLeftRadius: "18px",
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
          <Box
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
                <Select
                  value={value.performer || ""}
                  onChange={(e) => handlePerformerChange(e.target.value)}
                  fullWidth
                  sx={{ borderRadius: "20px" }}
                >
                  {[
                    "A single human",
                    "Collaboration of humans",
                    "Collaboration of humans and AI",
                    "AI",
                  ].map((opt) => (
                    <MenuItem key={opt} value={opt}>
                      {opt}
                    </MenuItem>
                  ))}
                </Select>

                <TextField
                  label="Reason"
                  value={value.reason || ""}
                  onChange={(e) => handleReasonChange(e.target.value)}
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
                    tags={value.sources}
                    selectedTags={() => {}}
                    updateTags={(newTags: any, added, removed) =>
                      handleURLsChange(newTags)
                    }
                    placeholder="Add URL"
                    label="Sources"
                    fontSize="17px"
                  />
                </Box>
              </Box>
            ) : (
              <>
                <Typography
                  sx={{ fontSize: "18px", textTransform: "capitalize" }}
                >
                  Performer: {value.performer}
                </Typography>
                <Typography sx={{ fontSize: "18px", mt: 1 }}>
                  Reason: {value.reason}
                </Typography>
                <Box sx={{ mt: "6px" }}>
                  <Typography>Sources:</Typography>
                  <ChipInput
                    tags={value.sources}
                    selectedTags={() => {}}
                    updateTags={() => {}}
                    placeholder="Sources"
                    readOnly
                    fontSize="17px"
                    clickable={true}
                  />
                </Box>
              </>
            )}
          </Box>
        </Box>
      )}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
          mt: 2,
          alignItems: "center",
          ml: "10px",
        }}
      >
        {Object.keys(performerColors).map((cTitle) => (
          <Chip
            key={cTitle}
            label={cTitle}
            sx={{ backgroundColor: performerColors[cTitle], color: "white" }}
          />
        ))}
      </Box>
    </Paper>
  );
};

export default SelectProperty;
