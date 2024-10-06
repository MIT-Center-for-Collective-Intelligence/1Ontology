import React, { useMemo } from "react";
import { Box, Button, useTheme } from "@mui/material";

import { getPropertyValue } from " @components/lib/utils/string.utils";
import { INode } from " @components/types/INode";
import Text from "../OntologyComponents/Text";
import { collection, doc, getFirestore, updateDoc } from "firebase/firestore";
import { NODES } from " @components/lib/firestoreClient/collections";
import StructuredProperty from "../StructuredProperty/StructuredProperty";

interface NodeBodyProps {
  currentVisibleNode: INode;
  setCurrentVisibleNode: any;
  recordLogs: any;
  updateInheritance: any;
  showListToSelect: any;
  handleEditCategory: any;
  deleteCategory: any;
  handleSorting: any;
  navigateToNode: any;
  setSnackbarMessage: any;
  setOpenAddCategory: any;
  setSelectedProperty: any;
  setOpenAddField: any;
  removeProperty: any;
  user: any;
  nodes: { [id: string]: INode };
  locked: boolean;
  selectedDiffNode: any;
  getTitleNode: any;
  confirmIt: any;
  onGetPropertyValue: any;
}

const NodeBody: React.FC<NodeBodyProps> = ({
  currentVisibleNode,
  setCurrentVisibleNode,
  recordLogs,
  updateInheritance,
  showListToSelect,
  handleEditCategory,
  deleteCategory,
  handleSorting,
  navigateToNode,
  setSnackbarMessage,
  setOpenAddCategory,
  setSelectedProperty,
  setOpenAddField,
  removeProperty,
  user,
  nodes,
  locked,
  selectedDiffNode,
  getTitleNode,
  confirmIt,
  onGetPropertyValue,
}) => {
  const theme = useTheme();
  const BUTTON_COLOR = theme.palette.mode === "dark" ? "#373739" : "#dde2ea";
  const db = getFirestore();

  const changeInheritance = (event: any, property: string) => {
    try {
      const newGeneralizationId = event.target.value;

      if (newGeneralizationId) {
        const nodeRef = doc(collection(db, NODES), currentVisibleNode.id);
        updateDoc(nodeRef, {
          [`inheritance.${property}.ref`]: newGeneralizationId,
        });
        updateInheritance({
          nodeId: currentVisibleNode.id,
          updatedProperty: property,
        });
      }
    } catch (error) {
      console.log(error);
    }
  };

  const properties = useMemo(() => {
    if (
      (selectedDiffNode && selectedDiffNode?.changeType === "add property") ||
      selectedDiffNode?.changeType === "add property"
    ) {
      return selectedDiffNode?.fullNode.properties;
    } else {
      return currentVisibleNode.properties;
    }
  }, [currentVisibleNode, selectedDiffNode]);

  const currentNode = useMemo(() => {
    if (
      selectedDiffNode &&
      (selectedDiffNode?.changeType === "add property" ||
        selectedDiffNode?.changeType === "add property")
    ) {
      return selectedDiffNode.fullNode;
    } else {
      return currentVisibleNode;
    }
  }, [currentVisibleNode, selectedDiffNode]);

  // {Object.values(currentVisibleNode.generalizations).flat()
  //   .length > 1 && (
  //   <TextField
  //     value={
  //       currentVisibleNode.inheritance[property]?.ref || ""
  //     }
  //     onChange={(e) => {
  //       changeInheritance(e, property);
  //     }}
  //     select
  //     label="Change Inheritance"
  //     sx={{ minWidth: "200px" }}
  //     InputProps={{
  //       sx: {
  //         height: "40px",
  //         padding: "0 14px",
  //         borderRadius: "25px",
  //       },
  //     }}
  //     InputLabelProps={{
  //       style: { color: "grey" },
  //     }}
  //   >
  //     <MenuItem
  //       value=""
  //       disabled
  //       sx={{
  //         backgroundColor: (theme) =>
  //           theme.palette.mode === "dark" ? "" : "white",
  //       }}
  //     >
  //       Select Inheritance
  //     </MenuItem>
  //     {[
  //       ...Object.values(currentVisibleNode.generalizations),
  //       {
  //         id:
  //           currentVisibleNode.inheritance[property]?.ref || "",
  //         title: getTitle(
  //           nodes,
  //           currentVisibleNode.inheritance[property]?.ref || ""
  //         ),
  //       },
  //     ]
  //       .flat()
  //       .map((generalization) => (
  //         <MenuItem
  //           key={generalization.id}
  //           value={generalization.id}
  //         >
  //           {getTitle(nodes, generalization.id)}{" "}
  //         </MenuItem>
  //       ))}
  //   </TextField>
  // )}

  return (
    <Box>
      <Box>
        {Object.keys(properties || {})
          .filter(
            (p) =>
              p !== "parts" &&
              p !== "isPartOf" &&
              p !== "description" &&
              p.toLowerCase() !== "actor"
          )
          .sort()
          .map((property: string, index) => (
            <Box key={property} sx={{ mt: "15px" }}>
              {currentNode.propertyType[property] !== "string" ? (
                <StructuredProperty
                  key={property + index}
                  selectedDiffNode={selectedDiffNode}
                  currentVisibleNode={currentNode}
                  showListToSelect={showListToSelect}
                  setOpenAddCategory={setOpenAddCategory}
                  setSelectedProperty={setSelectedProperty}
                  handleSorting={handleSorting}
                  handleEditCategory={handleEditCategory}
                  deleteCategory={deleteCategory}
                  navigateToNode={navigateToNode}
                  recordLogs={recordLogs}
                  setSnackbarMessage={setSnackbarMessage}
                  setCurrentVisibleNode={setCurrentVisibleNode}
                  updateInheritance={updateInheritance}
                  property={property}
                  nodes={nodes}
                  locked={locked}
                />
              ) : (
                property !== "description" &&
                currentNode.propertyType[property] === "string" && (
                  <Text
                    recordLogs={recordLogs}
                    text={onGetPropertyValue(property)}
                    currentVisibleNode={currentNode}
                    property={property}
                    setCurrentVisibleNode={setCurrentVisibleNode}
                    nodes={nodes}
                    locked={locked}
                    selectedDiffNode={selectedDiffNode}
                    getTitleNode={getTitleNode}
                    confirmIt={confirmIt}
                  />
                )
              )}
            </Box>
          ))}
      </Box>
      {!locked && (
        <Button
          onClick={() => {
            setOpenAddField(true);
          }}
          variant="outlined"
          sx={{
            borderRadius: "25px",
            backgroundColor: BUTTON_COLOR,
            mt: "15px",
          }}
        >
          Add New Property
        </Button>
      )}
    </Box>
  );
};

export default NodeBody;

/* (
  <ul>
    {Object.keys(
      currentVisibleNode.properties[property] || {}
    ).map((category: any) => {
      const children =
        currentVisibleNode.properties[property][category] || [];
      return (
        <Box key={category} id={category}>
          {category !== "main" && (
            <li>
              <Box
                sx={{ display: "flex", alignItems: "center" }}
              >
                <Typography sx={{ fontWeight: "bold" }}>
                  {category}
                </Typography>{" "}
                :
                <Button
                  onClick={() => showList(property, category)}
                  sx={{ ml: "5px" }}
                >
                  {"Select"} {property}
                </Button>
                <Button
                  onClick={() =>
                    handleEditCategory(property, category)
                  }
                  sx={{ ml: "5px" }}
                >
                  Edit
                </Button>
                <Button
                  onClick={() =>
                    deleteCategory(property, category)
                  }
                  sx={{ ml: "5px" }}
                >
                  Delete
                </Button>
              </Box>
            </li>
          )}

          <ul>
            {children.map((child: any) => (
              <li key={child.id}>
                <ChildNode
                  navigateToNode={navigateToNode}
                  recordLogs={recordLogs}
                  setSnackbarMessage={setSnackbarMessage}
                  currentVisibleNode={currentVisibleNode}
                  setCurrentVisibleNode={setCurrentVisibleNode}
                  sx={{ mt: "15px" }}
                  child={child}
                  type={property}
                  category={category}
                  updateInheritance={updateInheritance}
                />
              </li>
            ))}
          </ul>
        </Box>
      );
    })}
  </ul>
)} */
