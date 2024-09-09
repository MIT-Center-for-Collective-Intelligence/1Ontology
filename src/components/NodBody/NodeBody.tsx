import React from "react";
import {
  Box,
  Typography,
  Button,
  Tooltip,
  List,
  ListItem,
  ListItemIcon,
  Paper,
} from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import ChildNode from "../OntologyComponents/ChildNode";
import { capitalizeFirstLetter } from " @components/lib/utils/string.utils";
import { DESIGN_SYSTEM_COLORS } from " @components/lib/theme/colors";
import { INode } from " @components/types/INode";
import { DISPLAY } from " @components/lib/CONSTANTS";
import Text from "../OntologyComponents/Text";
import LinkNode from "../LinkNode/LinkNode";

interface NodeBodyProps {
  currentVisibleNode: INode;
  setCurrentVisibleNode: any;
  recordLogs: any;
  updateInheritance: any;
  showList: any;
  handleEditCategory: any;
  deleteCategory: any;
  handleSorting: any;
  navigateToNode: any;
  setSnackbarMessage: any;
  setOpenAddCategory: any;
  setType: any;
  setEditNode: any;
  setOpenAddField: any;
  removeProperty: any;
  addLock: any;
  lockedNodeFields: any;
  user: any;
}

const NodeBody: React.FC<NodeBodyProps> = ({
  currentVisibleNode,
  setCurrentVisibleNode,
  recordLogs,
  updateInheritance,
  showList,
  handleEditCategory,
  deleteCategory,
  handleSorting,
  navigateToNode,
  setSnackbarMessage,
  setOpenAddCategory,
  setType,
  setEditNode,
  setOpenAddField,
  removeProperty,
  addLock,
  lockedNodeFields,
  user,
}) => {
  return (
    <Box>
      <Box>
        {Object.keys(currentVisibleNode.properties).map((property: string) =>
          currentVisibleNode.propertyType[property] !== "string" ? (
            <Box key={property} sx={{ display: "grid", mt: "5px" }}>
              <Paper key={property} sx={{ p: 2, mt: "4px" }} elevation={3}>
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <Typography sx={{ fontSize: "20px", fontWeight: "500" }}>
                    {capitalizeFirstLetter(
                      DISPLAY[property] ? DISPLAY[property] : property
                    )}
                    :
                  </Typography>
                  <Tooltip title={""}>
                    <Button
                      onClick={() => showList(property, "main")}
                      sx={{ ml: "5px" }}
                    >
                      {property !== "specializations" ? "Select" : "Add"}{" "}
                      {capitalizeFirstLetter(
                        DISPLAY[property] ? DISPLAY[property] : property
                      )}
                    </Button>
                  </Tooltip>

                  <Button
                    onClick={() => {
                      setOpenAddCategory(true);
                      setType(property);
                    }}
                    sx={{ ml: "5px" }}
                  >
                    Add Category
                  </Button>

                  <Button
                    onClick={() => removeProperty(property)}
                    sx={{ ml: "5px" }}
                  >
                    Delete
                  </Button>

                  {currentVisibleNode.inheritance?.[property]?.ref && (
                    <Typography
                      sx={{ color: "grey", fontSize: "14px", ml: "auto" }}
                    >
                      {'(Inherited from "'}
                      {currentVisibleNode.inheritance[property]?.title || ""}
                      {'")'}
                    </Typography>
                  )}
                </Box>

                <DragDropContext onDragEnd={(e) => handleSorting(e, property)}>
                  <ul>
                    {Object.keys(currentVisibleNode.properties[property] || {})
                      .sort((a, b) =>
                        a === "main"
                          ? -1
                          : b === "main"
                          ? 1
                          : a.localeCompare(b)
                      )
                      .map((category) => {
                        const children =
                          currentVisibleNode.properties[property][category] ||
                          [];

                        const showGap =
                          Object.keys(
                            currentVisibleNode.properties[property]
                          ).filter(
                            (c) =>
                              (currentVisibleNode.properties[property][c] || [])
                                .length > 0 && c !== "main"
                          ).length > 0;
                        return (
                          <Box key={category} id={category}>
                            {category !== "main" && (
                              <li>
                                <Box
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                  }}
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

                            {(children.length > 0 || showGap) && (
                              <List>
                                <Droppable
                                  droppableId={category}
                                  type="CATEGORY"
                                >
                                  {(provided, snapshot) => (
                                    <Box
                                      {...provided.droppableProps}
                                      ref={provided.innerRef}
                                      sx={{
                                        backgroundColor: snapshot.isDraggingOver
                                          ? DESIGN_SYSTEM_COLORS.gray250
                                          : "",
                                        pl: "25px",
                                        borderRadius: "25px",
                                        userSelect: "none",
                                      }}
                                    >
                                      {children.map(
                                        (child: any, index: any) => (
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
                                                <ListItemIcon>
                                                  <DragIndicatorIcon />
                                                </ListItemIcon>
                                                <LinkNode
                                                  navigateToNode={
                                                    navigateToNode
                                                  }
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
                                                  sx={{ mt: "15px" }}
                                                  child={child}
                                                  property={property}
                                                  category={category}
                                                  updateInheritance={
                                                    updateInheritance
                                                  }
                                                />
                                              </ListItem>
                                            )}
                                          </Draggable>
                                        )
                                      )}
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
              </Paper>
            </Box>
          ) : (
            property !== "description" && (
              <Paper key={property} sx={{ p: 2, mt: "4px" }} elevation={3}>
                <Text
                  updateInheritance={updateInheritance}
                  recordLogs={recordLogs}
                  user={user}
                  lockedNodeFields={
                    lockedNodeFields[currentVisibleNode.id] || {}
                  }
                  addLock={addLock}
                  text={currentVisibleNode.properties[property]}
                  currentVisibleNode={currentVisibleNode}
                  property={property}
                  setSnackbarMessage={setSnackbarMessage}
                  setCurrentVisibleNode={setCurrentVisibleNode}
                  setEditNode={setEditNode}
                  removeField={removeProperty}
                />
              </Paper>
            )
          )
        )}
      </Box>
      <Button
        onClick={() => {
          setOpenAddField(true);
        }}
        variant="contained"
        sx={{ borderRadius: "25px", mt: "14px" }}
      >
        Add Property
      </Button>
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
