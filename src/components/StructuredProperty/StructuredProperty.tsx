import React, { useCallback, useMemo, useState } from "react";
import {
  Box,
  Button,
  Typography,
  Tooltip,
  Paper,
  useTheme,
} from "@mui/material";

import {
  capitalizeFirstLetter,
  getPropertyValue,
  getTitle,
  getTooltipHelper,
} from " @components/lib/utils/string.utils";
import { ICollection, ILinkNode, INode } from " @components/types/INode";
import { DISPLAY } from " @components/lib/CONSTANTS";
import { useAuth } from "../context/AuthContext";
import { getFirestore } from "firebase/firestore";
import { recordLogs } from " @components/lib/utils/helpers";
import SelectInheritance from "../SelectInheritance/SelectInheritance";
import MarkdownRender from "../Markdown/MarkdownRender";
import VisualizeTheProperty from "./VisualizeTheProperty";
import CollectionStructure from "./CollectionStructure";

type IStructuredPropertyProps = {
  currentVisibleNode: INode;
  showListToSelect: any;
  setSelectedProperty: any;
  navigateToNode: any;
  setSnackbarMessage: any;
  setCurrentVisibleNode: any;
  property: string;
  nodes: { [id: string]: INode };
  locked: boolean;
  selectedDiffNode: any;
  confirmIt: any;
  onGetPropertyValue: any;
  currentImprovement: any;
  cloneNode?: any;
};

const StructuredProperty = ({
  currentVisibleNode,
  showListToSelect,
  navigateToNode,
  setSnackbarMessage,
  setCurrentVisibleNode,
  property,
  nodes,
  locked,
  selectedDiffNode,
  confirmIt,
  onGetPropertyValue,
  currentImprovement,
  cloneNode,
}: IStructuredPropertyProps) => {
  const theme = useTheme();
  const [openAddCollection, setOpenAddCollection] = useState(false);

  const BUTTON_COLOR = theme.palette.mode === "dark" ? "#373739" : "#dde2ea";

  const propertyValue: ICollection[] = useMemo(() => {
    try {
      let result = null;
      if (property === "specializations" || property === "generalizations") {
        result =
          currentVisibleNode[property as "specializations" | "generalizations"];
      } else {
        result =
          getPropertyValue(
            nodes,
            currentVisibleNode.inheritance[property]?.ref,
            property
          ) || currentVisibleNode?.properties[property];
      }

      if (
        selectedDiffNode &&
        selectedDiffNode.modifiedProperty === property &&
        (selectedDiffNode.changeType === "delete collection" ||
          selectedDiffNode.changeType === "edit collection")
      ) {
        result = selectedDiffNode.previousValue;
      }

      let finalResult: any = [];
      const listOfChanges = [];

      if (
        selectedDiffNode &&
        selectedDiffNode.modifiedProperty === property &&
        (selectedDiffNode.changeType === "sort elements" ||
          selectedDiffNode.changeType === "remove element" ||
          selectedDiffNode.changeType === "modify elements" ||
          selectedDiffNode.changeType === "add element")
      ) {
        listOfChanges.push(selectedDiffNode);
      }

      if (
        selectedDiffNode &&
        selectedDiffNode.modifiedProperty === property &&
        selectedDiffNode.changeType === "sort elements" &&
        selectedDiffNode.changeDetails
      ) {
        const { draggableNodeId, destination, source } =
          selectedDiffNode.changeDetails;

        const sourceCollectionIndex = parseInt(source.droppableId, 10);
        const destinationCollectionIndex = parseInt(
          destination?.droppableId || "0",
          10
        );
        const previousValue = selectedDiffNode.previousValue;
        previousValue[sourceCollectionIndex].nodes[source.index].change =
          "removed";
        previousValue[sourceCollectionIndex].nodes[source.index].changeType =
          "sort";
        previousValue[destinationCollectionIndex].nodes.splice(
          destination.index,
          0,
          { id: draggableNodeId, change: "added", changeType: "sort" }
        );
        return previousValue;
      }

      for (let improvementChange of listOfChanges || []) {
        if (improvementChange.modifiedProperty === property) {
          improvementChange.newValue.forEach(
            (collectionNewValue: ICollection, collectionIndex: number) => {
              const collectionPrevious: ICollection =
                improvementChange.previousValue[collectionIndex];

              collectionNewValue.nodes.forEach((nodeLink) => {
                const foundInPrevious = collectionPrevious.nodes.find(
                  (prevElement: ILinkNode) => prevElement.id === nodeLink.id
                );
                if (!foundInPrevious) {
                  nodeLink.change = "added";
                  return { ...nodeLink, change: "added" };
                }
              });
              collectionPrevious.nodes.forEach((prevElement: any) => {
                const foundInNew = collectionNewValue.nodes.find(
                  (newElement: ILinkNode) => newElement.id === prevElement.id
                );
                if (!foundInNew) {
                  collectionNewValue.nodes.push({
                    ...prevElement,
                    change: "removed",
                  });
                }
              });
              finalResult.push(collectionNewValue);
            }
          );

          return [...finalResult];
        }
      }

      return result;
    } catch (error) {
      console.error(error);
    }
  }, [currentVisibleNode, nodes, property, selectedDiffNode]) as ICollection[];

  const unlinkVisible = useCallback(
    (nodeId: string) => {
      if (!!selectedDiffNode) {
        return false;
      }
      let numberOfGeneralizations = 0;
      if (property === "specializations") {
        for (let colGeneralization of nodes[nodeId]?.generalizations || []) {
          numberOfGeneralizations += colGeneralization.nodes.length;
        }
      }
      return (
        (property === "generalizations" &&
          propertyValue.flatMap((n) => n.nodes).length !== 1) ||
        (property === "specializations" && numberOfGeneralizations > 1) ||
        (property !== "generalizations" && property !== "specializations")
      );
    },
    [propertyValue, property, nodes, selectedDiffNode]
  );

  const getCategoryStyle = useCallback(
    (collection: string) => {
      if (!selectedDiffNode || selectedDiffNode.modifiedProperty !== property)
        return "";

      if (
        selectedDiffNode.changeType === "add collection" &&
        collection === selectedDiffNode.changeDetails.addedCollection
      ) {
        return "green";
      }
      if (
        selectedDiffNode.changeType === "delete collection" &&
        collection === selectedDiffNode.changeDetails.deletedCollection
      ) {
        return "red";
      }
    },
    [selectedDiffNode, property]
  );

  // Function to handle sorting of draggable items

  const logChange = (
    action: string,
    prevValue: any,
    newValue: any,
    nodeDoc: any,
    property: any
  ) => {
    recordLogs({
      action,
      previousValue: prevValue,
      newValue,
      node: nodeDoc.id,
      property: property,
    });
  };

  if (
    currentImprovement &&
    !currentImprovement.implemented &&
    !currentImprovement?.newNode &&
    currentImprovement.modifiedProperty === property
  ) {
    return (
      <Box id={`property-${property}`}>
        <VisualizeTheProperty
          currentImprovement={currentImprovement}
          property={property}
          getTitle={getTitle}
          nodes={nodes}
        />
      </Box>
    );
  }

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
      <Box>
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
                DISPLAY[property] ? DISPLAY[property] : property
              )}
            </Typography>
          </Tooltip>

          {!currentVisibleNode.unclassified &&
            !selectedDiffNode &&
            !currentImprovement &&
            property !== "isPartOf" && (
              <Box sx={{ ml: "auto", display: "flex", gap: "14px" }}>
                {property === "specializations" && !locked && (
                  <Button
                    onClick={() => {
                      setOpenAddCollection(true);
                    }}
                    sx={{ borderRadius: "18px", backgroundColor: BUTTON_COLOR }}
                    variant="outlined"
                  >
                    Add Collection
                  </Button>
                )}
                <Button
                  onClick={() => showListToSelect(property, "main")}
                  sx={{
                    borderRadius: "18px",
                    backgroundColor: BUTTON_COLOR,
                    ":hover": {
                      backgroundColor:
                        theme.palette.mode === "light" ? "#f0f0f0" : "",
                    },
                  }}
                  variant="outlined"
                >
                  {`Edit ${capitalizeFirstLetter(
                    DISPLAY[property] || property
                  )}`}{" "}
                </Button>
                {property !== "generalizations" &&
                  property !== "specializations" &&
                  property !== "isPartOf" &&
                  !currentVisibleNode.unclassified && (
                    <SelectInheritance
                      currentVisibleNode={currentVisibleNode}
                      property={property}
                      nodes={nodes}
                    />
                  )}
              </Box>
            )}
        </Box>
        {currentVisibleNode?.inheritance[property]?.ref && (
          <Typography sx={{ fontSize: "14px", ml: "9px", color: "gray" }}>
            {'(Inherited from "'}
            {getTitle(
              nodes,
              currentVisibleNode.inheritance[property].ref || ""
            )}
            {'")'}
          </Typography>
        )}
        {currentVisibleNode.propertyType[property] !== "array-string" && (
          <CollectionStructure
            locked={locked}
            selectedDiffNode={selectedDiffNode}
            currentImprovement={currentImprovement}
            property={property}
            propertyValue={propertyValue}
            getCategoryStyle={getCategoryStyle}
            navigateToNode={navigateToNode}
            setSnackbarMessage={setSnackbarMessage}
            currentVisibleNode={currentVisibleNode}
            setCurrentVisibleNode={setCurrentVisibleNode}
            nodes={nodes}
            unlinkVisible={unlinkVisible}
            showListToSelect={showListToSelect}
            confirmIt={confirmIt}
            logChange={logChange}
            cloneNode={cloneNode}
            openAddCollection={openAddCollection}
            setOpenAddCollection={setOpenAddCollection}
          />
        )}
      </Box>
      {onGetPropertyValue(property, true).trim() && (
        <Box sx={{ p: "16px", mt: "auto" }}>
          <Typography sx={{ mb: "4px", fontWeight: "bold", fontSize: "17px" }}>
            Comments:
          </Typography>

          <MarkdownRender text={onGetPropertyValue(property, true)} />

          {/* <Text
              text={onGetPropertyValue(property, true)}
              currentVisibleNode={currentVisibleNode}
              property={property}
              setCurrentVisibleNode={setCurrentVisibleNode}
              nodes={nodes}
              locked={locked}
              selectedDiffNode={selectedDiffNode}
              getTitleNode={() => {}}
              confirmIt={confirmIt}
              structured={true}
              currentImprovement={currentImprovement}
            /> */}
        </Box>
      )}
    </Paper>
  );
};

export default StructuredProperty;
