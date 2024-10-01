import React, { useCallback, useMemo } from "react";
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
} from "@mui/material";
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
}: IStructuredPropertyProps) => {
  const [{ user }] = useAuth();
  const theme = useTheme();
  const BUTTON_COLOR = theme.palette.mode === "dark" ? "#373739" : "#dde2ea";

  const properties = useMemo(() => {
    const result =
      getPropertyValue(
        nodes,
        currentVisibleNode.inheritance[property]?.ref,
        property
      ) ||
      currentVisibleNode?.properties[property] ||
      currentVisibleNode[property as "specializations" | "generalizations"];

    let finalResult: any = {};

    if (selectedDiffNode && selectedDiffNode.modifiedProperty === property) {
      Object.keys(selectedDiffNode.newValue).forEach((key) => {
        const newValueArray = selectedDiffNode.newValue[key];
        const previousValueArray = selectedDiffNode.previousValue[key];
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

  console.log(properties, "properties ====>", property);

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
    console.log("event ==>", e);
    console.log("property ==>", property);
  };

  return (
    <Paper
      elevation={9}
      sx={{ borderRadius: "30px", minWidth: "500px", width: "100%" }}
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
        {!locked && (
          <Box
            sx={{
              alignItems: "center",
              display: "flex",
              gap: "15px",
            }}
          >
            {property === "specializations" && (
              <Button
                onClick={() => addNewSpecialization("main")}
                sx={{ borderRadius: "25px", backgroundColor: BUTTON_COLOR }}
                variant="outlined"
              >
                {"Add "}
                {capitalizeFirstLetter(DISPLAY[property] || property)}
              </Button>
            )}
            <Button
              onClick={() => showList(property, "main")}
              sx={{ borderRadius: "25px", backgroundColor: BUTTON_COLOR }}
              variant="outlined"
            >
              {"Select "}
              {capitalizeFirstLetter(DISPLAY[property] || property)}
            </Button>

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
        {/* List of categories within the property */}
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
                {Object.keys(properties || {})
                  .sort((a, b) =>
                    a === "main" ? -1 : b === "main" ? 1 : a.localeCompare(b)
                  )
                  .map((category: string, index) => {
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
                                  backgroundColor: (theme) =>
                                    theme.palette.mode === "dark"
                                      ? "#1f232f"
                                      : "#969faf",
                                  borderTopLeftRadius: "25px",
                                  borderTopRightRadius: "25px",
                                  m: 0,
                                  p: 2,
                                  gap: "10px",
                                }}
                              >
                                <Typography
                                  sx={{ fontWeight: "bold", mr: "13px" }}
                                >
                                  {category} :
                                </Typography>
                                {property === "specializations" && (
                                  <Button
                                    onClick={() =>
                                      addNewSpecialization(category)
                                    }
                                    sx={{
                                      borderRadius: "25px",
                                      backgroundColor: BUTTON_COLOR,
                                    }}
                                    variant="outlined"
                                  >
                                    {"Add "}
                                  </Button>
                                )}
                                <Button
                                  variant="outlined"
                                  onClick={() => showList(property, category)}
                                  sx={{
                                    borderRadius: "25px",
                                    backgroundColor: BUTTON_COLOR,
                                  }}
                                >
                                  {"Select"}
                                </Button>
                                <Button
                                  variant="outlined"
                                  onClick={() =>
                                    handleEditCategory(property, category)
                                  }
                                  sx={{
                                    borderRadius: "25px",
                                    backgroundColor: BUTTON_COLOR,
                                  }}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="outlined"
                                  onClick={() =>
                                    deleteCategory(property, category)
                                  }
                                  sx={{
                                    borderRadius: "25px",
                                    backgroundColor: BUTTON_COLOR,
                                  }}
                                >
                                  Delete
                                </Button>
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
                                              <ListItemIcon
                                                sx={{ minWidth: 0 }}
                                              >
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
