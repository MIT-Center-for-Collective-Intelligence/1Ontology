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
import InheritanceDetailsPanel from "./InheritanceDetailsPanel";

const ChipsProperty = ({
  currentVisibleNode,
  property,
  relatedNodes,
  fetchNode,
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
  relatedNodes: { [id: string]: INode };
  fetchNode: (nodeId: string) => Promise<INode | null>;
  selectedDiffNode: any;
  locked: boolean;
  currentImprovement: any;
  user: any;
  skillsFuture: boolean;
  enableEdit: boolean;
  skillsFutureApp: string;
}) => {
  const db = getFirestore();
  const [value, setValue] = useState<
    { title: string; added?: boolean; removed?: boolean }[]
  >([]);

  const propertyValue: {
    title: string;
    added?: boolean;
    removed?: boolean;
  }[] = useMemo(() => {
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
      const previousValue: string[] = selectedDiffNode.previousValue;
      const newValue: string[] = selectedDiffNode.newValue;

      const allTitles = Array.from(new Set([...previousValue, ...newValue]));

      const result = allTitles.map((title) => ({
        title,
        added: !previousValue.includes(title) && newValue.includes(title),
        removed: previousValue.includes(title) && !newValue.includes(title),
      }));
      return result;
    }
    const result = currentVisibleNode.inheritance[property]?.ref
      ? getPropertyValue(
          relatedNodes,
          currentVisibleNode.inheritance[property]?.ref,
          property,
        )
      : currentVisibleNode.properties[property];

    return Array.isArray(result) &&
      result.every((item) => typeof item === "string")
      ? result.map((alt) => {
          return {
            title: alt,
          };
        })
      : [];
  }, [
    property,
    currentVisibleNode,
    selectedDiffNode,
    currentImprovement,
    relatedNodes,
  ]);

  useEffect(() => {
    setValue(propertyValue);
  }, [propertyValue]);

  const updateValue = async (
    newValue: { title: string }[],
    added: { title: string }[],
    removed: { title: string }[],
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
        [`properties.${property}`]: newValue.map((c) => c.title),
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
        newValue: newValue.map((c) => c.title),
        modifiedAt: new Date(),
        changeType: changeMessage,
        fullNode: currentVisibleNode,
        changeDetails: {
          addedElements: added.map((c) => c.title),
          removedElements: removed.map((c) => c.title),
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
        width: "100%",
        maxHeight: "100%",
        overflow: "auto",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
        pb: "10px",
        border:
          selectedDiffNode?.modifiedProperty === property
            ? "1.5px solid orange"
            : "",
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
              nodes={relatedNodes}
              enableEdit={enableEdit}
            />
          )}
        </Box>
      </Box>
      <ChipInput
        tags={value}
        selectedTags={() => {}}
        updateTags={updateValue}
        placeholder={
          enableEdit
            ? `Type a new ${property} and click enter ↵ to add it..`
            : ""
        }
        readOnly={
          !!selectedDiffNode ||
          !!currentVisibleNode.unclassified ||
          !!currentImprovement ||
          !enableEdit
        }
        fontSize="19px"
      />
      <InheritanceDetailsPanel
        property={property}
        currentVisibleNode={currentVisibleNode}
        relatedNodes={relatedNodes}
        fetchNode={fetchNode}
      />
    </Paper>
  );
};

export default ChipsProperty;
