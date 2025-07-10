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
} from "@mui/material";
import {
  saveNewChangeLog,
  updateInheritance,
} from "@components/lib/utils/helpers";
import { collection, doc, getFirestore, updateDoc } from "firebase/firestore";
import { NODES } from "@components/lib/firestoreClient/collections";
import PropertyContributors from "./PropertyContributors";
import SelectInheritance from "../SelectInheritance/SelectInheritance";
import { DISPLAY } from "@components/lib/CONSTANTS";

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
  const [value, setValue] = useState<string>("");

  const propertyValue: string = useMemo(() => {
    if (
      currentImprovement &&
      currentImprovement.modifiedProperty === property
    ) {
      return currentImprovement.detailsOfChange.newValue || "";
    }
    if (selectedDiffNode && selectedDiffNode.modifiedProperty === property) {
      return selectedDiffNode.newValue || "";
    }

    const result = currentVisibleNode.properties[property];

    return typeof result === "string" ? result : "";
  }, [property, currentVisibleNode, selectedDiffNode, currentImprovement]);

  useEffect(() => {
    setValue(propertyValue);
  }, [propertyValue]);

  const updateValue = async (newValue: string) => {
    try {
      if (
        !!currentImprovement ||
        !!selectedDiffNode ||
        !!currentVisibleNode.unclassified
      )
        return;

      setValue(newValue);

      const previousValue: string = currentVisibleNode.properties[
        property
      ] as string;

      const nodeRef = doc(collection(db, NODES), currentVisibleNode?.id);

      await updateDoc(nodeRef, {
        [`properties.${property}`]: newValue,
        [`inheritance.${property}.ref`]: null,
      });

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

      saveNewChangeLog(db, {
        nodeId: currentVisibleNode?.id,
        modifiedBy: user?.uname,
        modifiedProperty: property,
        previousValue,
        newValue,
        modifiedAt: new Date(),
        changeType: "change text",
        fullNode: currentVisibleNode,
        changeDetails: {
          addedElements: [newValue],
          removedElements: [previousValue],
        },
        skillsFuture,
        ...(skillsFutureApp ? { appName: skillsFutureApp } : {}),
      });
    } catch (error) {
      console.error(error);
    }
  };

  const renderDiff = (previousValue: string, newValue: string) => {
    return (
      <div>
        <div
          style={{
            color: "red",
            textDecoration: "line-through",
            textTransform: "capitalize",
          }}
        >
          {previousValue}
        </div>
        <div style={{ color: "green", textTransform: "capitalize" }}>
          {newValue}
        </div>
      </div>
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
        <Box sx={{ p: 3 }}>
          {enableEdit &&
          !selectedDiffNode &&
          !currentVisibleNode.unclassified &&
          !currentImprovement ? (
            <Select
              value={value.toLowerCase()}
              onChange={(e) => updateValue(e.target.value as string)}
              fullWidth
            >
              {options.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
            </Select>
          ) : (
            <Typography
              sx={{ fontSize: "18px", p: 1, textTransform: "capitalize" }}
            >
              {value}
            </Typography>
          )}
        </Box>
      )}
    </Paper>
  );
};

export default SelectProperty;
