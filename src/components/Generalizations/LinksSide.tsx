import React from "react";
import {
  Box,
  Button,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  useTheme,
} from "@mui/material";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import {
  capitalizeFirstLetter,
  getTitle,
} from " @components/lib/utils/string.utils";
import { INode } from " @components/types/INode";
import ChildNode from "../OntologyComponents/ChildNode";
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
  relationType: "generalizations" | "specializations";
  nodes: { [id: string]: INode };
  handleNewSpecialization?: any;
  locked: boolean;
};

const LinksSide = ({
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
  relationType,
  nodes,
  handleNewSpecialization,
  locked,
}: ILinksSideProps) => {
  const theme = useTheme();
  const BUTTON_COLOR = theme.palette.mode === "dark" ? "#373739" : "#dde2ea";

  const properties = currentVisibleNode[relationType];
  const getNumOfGeneralizations = (id: string) => {
    return nodes[id]
      ? Object.values(nodes[id]?.generalizations || {}).flat().length
      : 0;
  };

  return (
    <Box sx={{ p: "13px", width: "500px" /* , height: "100vh" */ }}>
      <Box>
        {!locked && (
          <Box
            sx={{
              alignItems: "center",
              display: "flex",
              gap: "15px",
            }}
          >
            <Button
              onClick={() => showList(relationType, "main")}
              sx={{ borderRadius: "25px", backgroundColor: BUTTON_COLOR }}
              variant="outlined"
            >
              {"Select"}
              {capitalizeFirstLetter(relationType)}
            </Button>

            {relationType === "specializations" && (
              <Button
                onClick={() => handleNewSpecialization()}
                sx={{ borderRadius: "25px", backgroundColor: BUTTON_COLOR }}
                variant="outlined"
              >
                Add Specialization
              </Button>
            )}
            <Button
              onClick={() => {
                setOpenAddCategory(true);
                setType(relationType);
              }}
              sx={{ borderRadius: "25px", backgroundColor: BUTTON_COLOR }}
              variant="outlined"
            >
              Add Collection
            </Button>
          </Box>
        )}

        {/* List of categories within the property */}
        <DragDropContext onDragEnd={(e) => handleSorting(e, relationType)}>
          <ul style={{ padding: "15px", paddingTop: 0 }}>
            {Object.keys(properties)
              .sort((a, b) =>
                a === "main" ? -1 : b === "main" ? 1 : a.localeCompare(b)
              )
              .map((category: string, index: number) => {
                const children: {
                  id: string;
                }[] = properties[category] || [];
                const showGap =
                  Object.keys(properties).filter(
                    (c) => (properties[c] || []).length > 0 && c !== "main"
                  ).length > 0;
                return (
                  <Box key={category} id={category} sx={{ width: "500px" }}>
                    {category !== "main" && (
                      <li>
                        <Box
                          sx={
                            {
                              // mt: "15px",
                              /*     display: "flex",
                            alignItems: "center",
                            alignContent: "center",
                            textAlign: "center", */
                            }
                          }
                        >
                          <Typography
                            sx={{
                              fontWeight: "bold",
                              pt: index !== 0 ? "25px" : "",
                              mb: "14px",
                            }}
                          >
                            {category} :
                          </Typography>{" "}
                          {!locked && (
                            <Box
                              sx={{
                                display: "flex",
                                gap: "14px",
                              }}
                            >
                              <Button
                                sx={{
                                  borderRadius: "25px",
                                  backgroundColor: BUTTON_COLOR,
                                }}
                                variant="outlined"
                                onClick={() => showList(relationType, category)}
                              >
                                {relationType === "specializations"
                                  ? "Select"
                                  : "Add "}{" "}
                                {capitalizeFirstLetter(relationType)}
                              </Button>
                              {relationType === "specializations" && (
                                <Button
                                  onClick={() => {
                                    handleNewSpecialization(category);
                                  }}
                                  sx={{
                                    borderRadius: "25px",
                                    backgroundColor: BUTTON_COLOR,
                                  }}
                                  variant="outlined"
                                >
                                  Add Specialization
                                </Button>
                              )}
                              <Button
                                sx={{
                                  borderRadius: "25px",
                                  backgroundColor: BUTTON_COLOR,
                                }}
                                variant="outlined"
                                onClick={() =>
                                  handleEditCategory(relationType, category)
                                }
                              >
                                Edit
                              </Button>
                              <Button
                                sx={{
                                  borderRadius: "25px",
                                  backgroundColor: BUTTON_COLOR,
                                }}
                                variant="outlined"
                                onClick={() =>
                                  deleteCategory(relationType, category)
                                }
                              >
                                Delete
                              </Button>
                            </Box>
                          )}
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
                                backgroundColor: (theme) =>
                                  theme.palette.mode === "dark"
                                    ? snapshot.isDraggingOver
                                      ? DESIGN_SYSTEM_COLORS.notebookG450
                                      : ""
                                    : snapshot.isDraggingOver
                                    ? DESIGN_SYSTEM_COLORS.gray250
                                    : "",
                                borderRadius: "25px",
                                userSelect: "none",
                                p: 0.3,
                              }}
                            >
                              {children.map((child, index) => (
                                <Draggable
                                  key={child.id + index}
                                  draggableId={child.id}
                                  index={index}
                                >
                                  {(provided) => (
                                    <ListItem
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      sx={{ m: 0, p: 0, mt: "14px" }}
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
                                        deleteVisible={
                                          (relationType === "generalizations" &&
                                            Object.values(properties).flat()
                                              .length !== 1) ||
                                          (relationType === "specializations" &&
                                            getNumOfGeneralizations(child.id) >
                                              1)
                                        }
                                        title={getTitle(nodes, child.id)}
                                        index={index}
                                        childLocked={false}
                                        locked={locked}
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

export default LinksSide;
