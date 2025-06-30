import { INode } from "@components/types/INode";
import React, { useEffect, useMemo, useState } from "react";
import ChipInput from "../ChipInput/ChipInput";
import {
  capitalizeFirstLetter,
  getPropertyValue,
  getTooltipHelper,
} from "@components/lib/utils/string.utils";
import { Box, Paper, Tooltip, Typography } from "@mui/material";
import { DISPLAY } from "@components/lib/CONSTANTS";
import SelectInheritance from "../SelectInheritance/SelectInheritance";
import {
  saveNewChangeLog,
  updateInheritance,
} from "@components/lib/utils/helpers";
import { collection, doc, getFirestore, updateDoc } from "firebase/firestore";
import { NODES } from "@components/lib/firestoreClient/collections";
import PropertyContributors from "./PropertyContributors";

const ChipsProperty = ({
  currentVisibleNode,
  property,
  nodes,
  selectedDiffNode,
  locked,
  currentImprovement,
  user,
  skillsFuture,
  enableEdit,
  skillsFutureApp,
}: {
  currentVisibleNode: INode;
  property: string;
  nodes: { [id: string]: INode };
  selectedDiffNode: any;
  locked: boolean;
  currentImprovement: any;
  user: any;
  skillsFuture: boolean;
  enableEdit: boolean;
  skillsFutureApp: string;
}) => {
  const db = getFirestore();
  const [value, setValue] = useState<string[]>([]);

  const propertyValue: string[] = useMemo(() => {
    if (
      currentImprovement &&
      currentImprovement.modifiedProperty === property
    ) {
      return [
        ...currentImprovement.detailsOfChange.newValue,
        ...currentImprovement.detailsOfChange.removedElements,
      ];
    }
    if (selectedDiffNode && selectedDiffNode.modifiedProperty === property) {
      if (
        selectedDiffNode.changeDetails &&
        selectedDiffNode.changeDetails.addedElements.length > 0
      ) {
        return selectedDiffNode.newValue;
      } else if (
        selectedDiffNode.changeDetails &&
        selectedDiffNode.changeDetails.removedElements.length > 0
      ) {
        return selectedDiffNode.previousValue;
      }
    }
    const result = currentVisibleNode.inheritance[property]?.ref
      ? getPropertyValue(
          nodes,
          currentVisibleNode.inheritance[property]?.ref,
          property,
        )
      : currentVisibleNode.properties[property];

    return Array.isArray(result) &&
      result.every((item) => typeof item === "string")
      ? result
      : [];
  }, [
    property,
    currentVisibleNode,
    selectedDiffNode,
    currentImprovement,
    nodes,
  ]);

  useEffect(() => {
    setValue(propertyValue);
  }, [propertyValue]);

  const updateValue = async (
    newValue: string[],
    added: string[],
    removed: string[],
  ) => {
    try {
      if (
        !!currentImprovement ||
        !!selectedDiffNode ||
        !!currentVisibleNode.unclassified
      )
        return;

      setValue(newValue);

      const previousValue: string[] = currentVisibleNode.properties[
        property
      ] as string[];

      const nodeRef = doc(collection(db, NODES), currentVisibleNode?.id);

      await updateDoc(nodeRef, {
        [`properties.${property}`]: newValue,
        [`inheritance.${property}.ref`]: null,
      });
      if (!!currentVisibleNode.inheritance[property]?.ref) {
        await updateInheritance({
          nodeId: currentVisibleNode?.id,
          updatedProperties: [property],
          db,
        });
      }
      let changeMessage: "add element" | "remove element" | "modify elements" =
        "add element";

      if (added.length === 1) {
        changeMessage = "add element";
      }
      if (removed.length === 1) {
        changeMessage = "remove element";
      }
      if (added.length > 1 || removed.length > 1) {
        changeMessage = "modify elements";
      }

      saveNewChangeLog(db, {
        nodeId: currentVisibleNode?.id,
        modifiedBy: user?.uname,
        modifiedProperty: property,
        previousValue,
        newValue,
        modifiedAt: new Date(),
        changeType: changeMessage,
        fullNode: currentVisibleNode,
        changeDetails: {
          addedElements: added,
          removedElements: removed,
        },
        skillsFuture,
        ...(skillsFutureApp ? { appName: skillsFutureApp } : {}),
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Paper
      id={`property-${property}`}
      elevation={9}
      sx={{
        borderRadius: property !== "context" ? "30px" : "",
        borderBottomRightRadius: "18px",
        borderBottomLeftRadius: "18px",
        minWidth: "500px",
        width: "100%",
        minHeight: "150px",
        maxHeight: "100%",
        overflow: "auto",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
      }}
    >
      {" "}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          background: (theme: any) =>
            theme.palette.mode === "dark" ? "#242425" : "#d0d5dd",
          p: 3,

          backgroundColor:
            selectedDiffNode &&
            selectedDiffNode.changeType === "add property" &&
            selectedDiffNode.changeDetails.addedProperty === property
              ? "green"
              : "",
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
          {!currentImprovement && !currentVisibleNode.unclassified && (
            <SelectInheritance
              currentVisibleNode={currentVisibleNode}
              property={property}
              nodes={nodes}
              enableEdit={enableEdit}
            />
          )}
        </Box>
      </Box>
      <ChipInput
        tags={value}
        selectedTags={() => {}}
        updateTags={updateValue}
        placeholder={`Type a new ${property} and click enter ↵ to add it..`}
        added={
          currentImprovement?.modifiedProperty === property
            ? currentImprovement.detailsOfChange.addedElements || []
            : selectedDiffNode?.modifiedProperty === property
              ? selectedDiffNode?.changeDetails?.addedElements || []
              : []
        }
        removed={
          currentImprovement?.modifiedProperty === property
            ? currentImprovement.detailsOfChange.removedElements || []
            : selectedDiffNode?.modifiedProperty === property
              ? selectedDiffNode?.changeDetails?.removedElements || []
              : []
        }
        readOnly={
          !!selectedDiffNode ||
          !!currentVisibleNode.unclassified ||
          !!currentImprovement ||
          !enableEdit
        }
      />
    </Paper>
  );
};

export default ChipsProperty;
