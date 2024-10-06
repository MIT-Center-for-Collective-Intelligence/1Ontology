import React, { useCallback, useMemo, useState } from "react";
import {
  Box,
  Button,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  Tooltip,
  Paper,
  useTheme,
  IconButton,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import {
  capitalizeFirstLetter,
  getPropertyValue,
  getTitle,
} from " @components/lib/utils/string.utils";
import { INode } from " @components/types/INode";
import { DISPLAY } from " @components/lib/CONSTANTS";
import LinkNode from "../LinkNode/LinkNode";
import { DESIGN_SYSTEM_COLORS } from " @components/lib/theme/colors";
import { useAuth } from "../context/AuthContext";
import { boolean } from "yup";
import { collection, doc, getFirestore, updateDoc } from "firebase/firestore";
import { NODES } from " @components/lib/firestoreClient/collections";

type IStructuredPropertyProps = {
  currentVisibleNode: INode;
  showListToSelect: any;
  setOpenAddCategory: any;
  setSelectedProperty: any;
  handleSorting: any;
  handleEditCategory: any;
  deleteCategory: any;
  navigateToNode: any;
  recordLogs: any;
  setSnackbarMessage: any;
  setCurrentVisibleNode: any;
  updateInheritance: any;
  property: string;
  nodes: { [id: string]: INode };
  locked: boolean;
  selectedDiffNode: any;
  addNewSpecialization?: any;
  reviewId?: string;
  setReviewId?: Function;
};

const StructuredProperty = ({
  currentVisibleNode,
  showListToSelect: showList,
  setOpenAddCategory,
  setSelectedProperty,
  handleSorting,
  handleEditCategory,
  deleteCategory,
  navigateToNode,
  recordLogs,
  setSnackbarMessage,
  setCurrentVisibleNode,
  updateInheritance,
  property,
  nodes,
  locked,
  selectedDiffNode,
  addNewSpecialization,
  reviewId,
  setReviewId,
}: IStructuredPropertyProps) => {
  const [{ user }] = useAuth();
  const theme = useTheme();
  const db = getFirestore();

  const BUTTON_COLOR = theme.palette.mode === "dark" ? "#373739" : "#dde2ea";

  const properties = useMemo(() => {
    let result =
      getPropertyValue(
        nodes,
        currentVisibleNode.inheritance[property]?.ref,
        property
      ) ||
      currentVisibleNode?.properties[property] ||
      currentVisibleNode[property as "specializations" | "generalizations"];

    if (
      selectedDiffNode &&
      selectedDiffNode.modifiedProperty === property &&
      (selectedDiffNode.changeType === "delete collection" ||
        selectedDiffNode.changeType === "edit collection")
    ) {
      result = selectedDiffNode.previousValue;
    }

    let finalResult: any = {};

    if (
      selectedDiffNode &&
      selectedDiffNode.modifiedProperty === property &&
      (selectedDiffNode.changeType === "sort elements" ||
        selectedDiffNode.changeType === "remove element" ||
        selectedDiffNode.changeType === "modify elements" ||
        selectedDiffNode.changeType === "add element")
    ) {
      Object.keys(selectedDiffNode.newValue).forEach((key) => {
        const newValueArray = selectedDiffNode.newValue[key];
        const previousValueArray = selectedDiffNode.previousValue[key] || [];
        if (Array.isArray(newValueArray)) {
          finalResult[key] = newValueArray.map((newElement) => {
            const foundInPrevious = previousValueArray.find(
              (prevElement: any) => prevElement.id === newElement.id
            );
            if (foundInPrevious) {
              return { ...newElement };
            } else {
              return { ...newElement, change: "added" };
            }
          });

          previousValueArray.forEach((prevElement: any) => {
            const foundInNew = newValueArray.find(
              (newElement) => newElement.id === prevElement.id
            );
            if (!foundInNew) {
              finalResult[key].push({ ...prevElement, change: "removed" });
            }
          });
        }
      });
      return { ...finalResult };
    }

    return result;
  }, [currentVisibleNode, nodes, property, selectedDiffNode]);

  const unlinkVisible = useCallback(
    (nodeId: string) => {
      const getNumOfGeneralizations = (id: string) => {
        return nodes[id]
          ? Object.values(nodes[id]?.generalizations || {}).flat().length
          : 0;
      };
      if (!!selectedDiffNode) {
        return false;
      }
      return (
        (property === "generalizations" &&
          Object.values(properties).flat().length !== 1) ||
        (property === "specializations" &&
          getNumOfGeneralizations(nodeId) > 1) ||
        (property !== "generalizations" && property !== "specializations")
      );
    },
    [properties, property, nodes, selectedDiffNode]
  );

  const handleCategorySorting = (e: any, property: any) => {
    try {
      const categoriesOrder =
        (currentVisibleNode.categoriesOrder || {})[property] ||
        Object.keys(properties || {});

      const sourceIndex = e.source.index;
      const destinationIndex = e.destination.index;

      if (sourceIndex === undefined || destinationIndex === undefined) {
        console.error("Invalid source or destination index");
        return;
      }

      const [movedElement] = categoriesOrder.splice(sourceIndex, 1);
      categoriesOrder.splice(destinationIndex, 0, movedElement);

      const mainIndex = categoriesOrder.indexOf("main");
      if (mainIndex !== -1) {
        categoriesOrder.splice(mainIndex, 1);
        categoriesOrder.push("main");
      }

      const newRef = doc(collection(db, NODES), currentVisibleNode.id);
      updateDoc(newRef, { [`categoriesOrder.${property}`]: categoriesOrder });
    } catch (error) {
      console.log(error);
    }
  };

  const getCategoryStyle = useCallback(
    (collection: string) => {
      if (!selectedDiffNode) return "";

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
    [selectedDiffNode]
  );
  const getOrder = useMemo(() => {
    if (selectedDiffNode || !currentVisibleNode.categoriesOrder) {
      return Object.keys(properties || {});
    }
    return (
      (currentVisibleNode.categoriesOrder || {})[property] ||
      Object.keys(properties)
    );
  }, [
    selectedDiffNode,
    currentVisibleNode.categoriesOrder,
    property,
    properties,
  ]);

  return (
    <Paper
      elevation={9}
      sx={{
        borderRadius: "30px",
        minWidth: "500px",
        width: "100%",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          background: (theme: any) =>
            theme.palette.mode === "dark" ? "#242425" : "#d0d5dd",
          p: 3,
          borderTopRightRadius: "25px",
          borderTopLeftRadius: "25px",
          backgroundColor:
            selectedDiffNode &&
            selectedDiffNode.changeType === "add property" &&
            selectedDiffNode.changeDetails.addedProperty === property
              ? "green"
              : "",
        }}
      >
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
        {currentVisibleNode?.inheritance[property]?.ref && (
          <Typography sx={{ fontSize: "14px", ml: "9px" }}>
            {'(Inherited from "'}
            {getTitle(
              nodes,
              currentVisibleNode.inheritance[property].ref || ""
            )}
            {'")'}
          </Typography>
        )}
      </Box>
      <Box sx={{ p: "15px" }}>
        {!locked && !selectedDiffNode && (
          <Box
            sx={{
              alignItems: "center",
              display: "flex",
              gap: "15px",
            }}
          >
            {property === "specializations" && (
              <Button
                onClick={() => showList(property, "main")}
                sx={{ borderRadius: "25px", backgroundColor: BUTTON_COLOR }}
                variant="outlined"
              >
                {"Add "}
                {capitalizeFirstLetter(DISPLAY[property] || property)}
              </Button>
            )}
            {property !== "specializations" && (
              <Button
                onClick={() => showList(property, "main")}
                sx={{ borderRadius: "25px", backgroundColor: BUTTON_COLOR }}
                variant="outlined"
              >
                {"Select "}
                {capitalizeFirstLetter(DISPLAY[property] || property)}
              </Button>
            )}
            {property !== "parts" && property !== "isPartOf" && (
              <Button
                onClick={() => {
                  setOpenAddCategory(true);
                  setSelectedProperty(property);
                }}
                sx={{ borderRadius: "25px", backgroundColor: BUTTON_COLOR }}
                variant="outlined"
              >
                Add Collection
              </Button>
            )}
          </Box>
        )}

        <DragDropContext
          onDragEnd={(e) => {
            if (locked) return;
            if (e.type === "CATEGORY") {
              handleCategorySorting(e, property);
            } else {
              handleSorting(e, property);
            }
          }}
        >
          {/* Droppable for categories */}
          <Droppable droppableId="categories" type="CATEGORY">
            {(provided) => (
              <Box ref={provided.innerRef} {...provided.droppableProps}>
                {(getOrder || []).map((category: string, index) => {
                  const links: {
                    id: string;
                    change?: string;
                  }[] = properties[category] || [];

                  return (
                    <Draggable
                      key={category}
                      draggableId={category}
                      index={index}
                    >
                      {(provided) => (
                        <Paper
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          id={category}
                          sx={{
                            mt: "15px",
                            borderRadius: "20px",
                          }}
                          elevation={category !== "main" ? 6 : 0}
                        >
                          {category !== "main" && (
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                background: (theme: any) =>
                                  theme.palette.mode === "dark"
                                    ? "#242425"
                                    : "#d0d5dd",
                                borderTopLeftRadius: "21px",
                                borderTopRightRadius: "21px",
                                m: 0,
                                p: 2,
                                gap: "10px",
                                backgroundColor: getCategoryStyle(category),
                              }}
                            >
                              {selectedDiffNode &&
                              selectedDiffNode.changeType ===
                                "edit collection" &&
                              selectedDiffNode.changeDetails
                                .modifiedCollection === category ? (
                                <Box sx={{ display: "flex" }}>
                                  <Typography
                                    sx={{
                                      fontWeight: "bold",
                                      mr: "13px",
                                      color: "red",
                                      textDecoration: "line-through",
                                    }}
                                  >
                                    {capitalizeFirstLetter(category)}
                                  </Typography>
                                  <Typography
                                    sx={{
                                      fontWeight: "bold",
                                      mr: "13px",
                                      color: "green",
                                    }}
                                  >
                                    {capitalizeFirstLetter(
                                      selectedDiffNode.changeDetails.newValue
                                    )}
                                  </Typography>
                                </Box>
                              ) : (
                                <Typography
                                  sx={{
                                    fontWeight: "bold",
                                    mr: "13px",
                                  }}
                                >
                                  {capitalizeFirstLetter(category)}
                                </Typography>
                              )}
                              {property === "specializations" &&
                                !selectedDiffNode && (
                                  <Button
                                    onClick={() => showList(property, category)}
                                    sx={{
                                      borderRadius: "25px",
                                      backgroundColor: BUTTON_COLOR,
                                      ":hover": {
                                        backgroundColor:
                                          theme.palette.mode === "light"
                                            ? "#f0f0f0"
                                            : "",
                                      },
                                    }}
                                    variant="outlined"
                                  >
                                    {"Add Specializations"}
                                  </Button>
                                )}
                              {!selectedDiffNode && (
                                <Box
                                  sx={{
                                    display: "flex",
                                    ml: "auto",
                                  }}
                                >
                                  <Tooltip title="Edit collection title">
                                    <IconButton
                                      onClick={() => {
                                        handleEditCategory(property, category);
                                      }}
                                    >
                                      <EditIcon />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Delete collection">
                                    <IconButton
                                      onClick={() =>
                                        deleteCategory(property, category)
                                      }
                                    >
                                      <DeleteIcon />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              )}
                            </Box>
                          )}

                          <List sx={{ p: 1 }}>
                            <Droppable droppableId={category} type="LINK">
                              {(provided, snapshot) => (
                                <Box
                                  {...provided.droppableProps}
                                  ref={provided.innerRef}
                                  sx={{
                                    backgroundColor: snapshot.isDraggingOver
                                      ? (theme) =>
                                          theme.palette.mode === "light"
                                            ? DESIGN_SYSTEM_COLORS.gray250
                                            : DESIGN_SYSTEM_COLORS.notebookG400
                                      : "",
                                    borderRadius: "25px",
                                    userSelect: "none",
                                  }}
                                >
                                  {links.length > 0 ? (
                                    links.map((link, index) => (
                                      <Draggable
                                        key={link.id + index}
                                        draggableId={link.id}
                                        index={index}
                                      >
                                        {(provided) => (
                                          <ListItem
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            {...provided.dragHandleProps}
                                            sx={{
                                              my: 1,
                                              p: 0,
                                            }}
                                          >
                                            <ListItemIcon sx={{ minWidth: 0 }}>
                                              <DragIndicatorIcon
                                                sx={{
                                                  color:
                                                    link.change === "added"
                                                      ? "green"
                                                      : link.change ===
                                                        "removed"
                                                      ? "red"
                                                      : "",
                                                }}
                                              />
                                            </ListItemIcon>
                                            <LinkNode
                                              navigateToNode={navigateToNode}
                                              recordLogs={recordLogs}
                                              setSnackbarMessage={
                                                setSnackbarMessage
                                              }
                                              currentVisibleNode={
                                                currentVisibleNode
                                              }
                                              setCurrentVisibleNode={
                                                setCurrentVisibleNode
                                              }
                                              sx={{ pl: 1 }}
                                              link={link}
                                              property={property}
                                              category={category}
                                              updateInheritance={
                                                updateInheritance
                                              }
                                              title={getTitle(nodes, link.id)}
                                              nodes={nodes}
                                              index={index}
                                              deleteVisible={unlinkVisible(
                                                link.id
                                              )}
                                              linkLocked={false}
                                              locked={locked}
                                              user={user}
                                              reviewId={reviewId}
                                              setReviewId={setReviewId}
                                            />
                                          </ListItem>
                                        )}
                                      </Draggable>
                                    ))
                                  ) : (
                                    <Typography
                                      variant="body2"
                                      sx={{
                                        p: 2,
                                        color: "text.secondary",
                                        textAlign: "center",
                                      }}
                                    >
                                      {category === "main" ? "" : "No items"}
                                    </Typography>
                                  )}
                                  {provided.placeholder}
                                </Box>
                              )}
                            </Droppable>
                          </List>
                        </Paper>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </Box>
            )}
          </Droppable>
        </DragDropContext>
      </Box>
    </Paper>
  );
};

export default StructuredProperty;
