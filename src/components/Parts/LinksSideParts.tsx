import React from "react";
import {
  Box,
  Button,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  Tooltip,
  Paper,
} from "@mui/material";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import {
  capitalizeFirstLetter,
  getTitle,
} from " @components/lib/utils/string.utils";
import { INode } from " @components/types/INode";
import { DISPLAY } from " @components/lib/CONSTANTS";
import LinkNode from "../LinkNode/LinkNode";
import { DESIGN_SYSTEM_COLORS } from " @components/lib/theme/colors";

type ILinksSideProps = {
  properties: { [key: string]: any };
  currentVisibleNode: INode;
  showList: any;
  setOpenAddCategory: any;
  setType: any;
  handleSorting: any;
  handleEditCategory: any;
  deleteCategory: any;
  navigateToNode: any;
  recordLogs: any;
  setSnackbarMessage: any;
  setCurrentVisibleNode: any;
  updateInheritance: any;
  property: "parts" | "isPartOf";
  nodes: { [id: string]: INode };
};

const LinksSideParts = ({
  properties,
  currentVisibleNode,
  showList,
  setOpenAddCategory,
  setType,
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
}: ILinksSideProps) => {
  return (
    <Box sx={{ p: "13px" /* , height: "100vh" */ }}>
      <Box>
        <Box
          sx={{
            alignItems: "center",
            display: "flex",
            gap: "15px",
          }}
        >
          <Button
            onClick={() => showList(property, "main")}
            sx={{ px: 1, py: 0 }}
            variant="outlined"
          >
            {"Select "}
            {capitalizeFirstLetter(DISPLAY[property])}
          </Button>

          <Button
            onClick={() => {
              setOpenAddCategory(true);
              setType(property);
            }}
            sx={{ px: 1, py: 0 }}
            variant="outlined"
          >
            Add Category
          </Button>
        </Box>

        {/* List of categories within the property */}
        <DragDropContext onDragEnd={(e) => handleSorting(e, property)}>
          <ul style={{ paddingLeft: 7 }}>
            {Object.keys(properties)
              .sort((a, b) =>
                a === "main" ? -1 : b === "main" ? 1 : a.localeCompare(b)
              )
              .map((category: string) => {
                const children: {
                  id: string;
                  title: string;
                }[] = properties[category] || [];
                const showGap =
                  Object.keys(properties).filter(
                    (c) => (properties[c] || []).length > 0 && c !== "main"
                  ).length > 0;
                return (
                  <Box key={category} id={category}>
                    {category !== "main" && (
                      <li>
                        <Box
                          sx={
                            {
                              /*    display: "flex",
                            alignItems: "center", */
                            }
                          }
                        >
                          <Typography sx={{ fontWeight: "bold" }}>
                            {category} :
                          </Typography>{" "}
                          <Button onClick={() => showList(property, category)}>
                            {"Select"} {property}
                          </Button>
                          <Button
                            onClick={() =>
                              handleEditCategory(property, category)
                            }
                          >
                            Edit
                          </Button>
                          <Button
                            onClick={() => deleteCategory(property, category)}
                          >
                            Delete
                          </Button>
                        </Box>
                      </li>
                    )}

                    {(children.length > 0 || showGap) && (
                      <List sx={{ p: 0 }}>
                        <Droppable droppableId={category} type="CATEGORY">
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
                              {children.map((child, index) => (
                                <Draggable
                                  key={child.id}
                                  draggableId={child.id}
                                  index={index}
                                >
                                  {(provided) => (
                                    <ListItem
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      sx={{ m: 0, p: 0 }}
                                    >
                                      <ListItemIcon sx={{ minWidth: 0 }}>
                                        <DragIndicatorIcon />
                                      </ListItemIcon>
                                      <LinkNode
                                        navigateToNode={navigateToNode}
                                        recordLogs={recordLogs}
                                        setSnackbarMessage={setSnackbarMessage}
                                        currentVisibleNode={currentVisibleNode}
                                        setCurrentVisibleNode={
                                          setCurrentVisibleNode
                                        }
                                        sx={{ pl: 1 }}
                                        child={child}
                                        property={property}
                                        category={category}
                                        updateInheritance={updateInheritance}
                                        title={
                                          getTitle(nodes, child.id) ||
                                          child.title
                                        }
                                      />
                                    </ListItem>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                            </Box>
                          )}
                        </Droppable>
                      </List>
                    )}
                  </Box>
                );
              })}
          </ul>
        </DragDropContext>
      </Box>
    </Box>
  );
};

export default LinksSideParts;
