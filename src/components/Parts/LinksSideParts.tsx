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
import { capitalizeFirstLetter } from " @components/lib/utils/string.utils";
import { INode } from " @components/types/INode";
import ChildNode from "../OntologyComponents/ChildNode";
import { DISPLAY } from " @components/lib/CONSTANTS";

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
  relationType: "parts" | "isPartOf";
};

const LinksSideParts = ({
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
  relationType,
}: ILinksSideProps) => {
  const properties = currentVisibleNode.properties[relationType] || {};

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
            onClick={() => showList(relationType, "main")}
            sx={{ px: 1, py: 0 }}
            variant="outlined"
          >
            {"Select "}
            {capitalizeFirstLetter(DISPLAY[relationType])}
          </Button>

          <Button
            onClick={() => {
              setOpenAddCategory(true);
              setType(relationType);
            }}
            sx={{ px: 1, py: 0 }}
            variant="outlined"
          >
            Add Category
          </Button>
        </Box>

        {/* List of categories within the property */}
        <DragDropContext onDragEnd={(e) => handleSorting(e, relationType)}>
          <ul style={{ padding: 0 }}>
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
                          <Button
                            onClick={() => showList(relationType, category)}
                          >
                            {"Select"} {relationType}
                          </Button>
                          <Button
                            onClick={() =>
                              handleEditCategory(relationType, category)
                            }
                          >
                            Edit
                          </Button>
                          <Button
                            onClick={() =>
                              deleteCategory(relationType, category)
                            }
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
                                  ? "#f0f0f0"
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
                                      <ChildNode
                                        navigateToNode={navigateToNode}
                                        recordLogs={recordLogs}
                                        setSnackbarMessage={setSnackbarMessage}
                                        currentVisibleNode={currentVisibleNode}
                                        setCurrentVisibleNode={
                                          setCurrentVisibleNode
                                        }
                                        sx={{}}
                                        child={child}
                                        type={relationType}
                                        category={category}
                                        updateInheritance={updateInheritance}
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
