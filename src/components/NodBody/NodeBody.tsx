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
  FormControl,
  InputLabel,
  Select,
  OutlinedInput,
  MenuItem,
  useTheme,
  FormLabel,
  TextField,
} from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";

import {
  capitalizeFirstLetter,
  getPropertyValue,
  getTitle,
} from " @components/lib/utils/string.utils";
import { DESIGN_SYSTEM_COLORS } from " @components/lib/theme/colors";
import { INode } from " @components/types/INode";
import { DISPLAY } from " @components/lib/CONSTANTS";
import Text from "../OntologyComponents/Text";
import LinkNode from "../LinkNode/LinkNode";
import { collection, doc, getFirestore, updateDoc } from "firebase/firestore";
import { NODES } from " @components/lib/firestoreClient/collections";

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
  user: any;
  nodes: { [id: string]: INode };
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
  user,
  nodes,
}) => {
  const theme = useTheme();
  const BUTTON_COLOR = theme.palette.mode === "dark" ? "#373739" : "#dde2ea";
  const db = getFirestore();

  const changeInheritance = (event: any, property: string) => {
    try {
      const selectedTitle = event.target.value;
      const selectedGeneralization = Object.values(
        currentVisibleNode.generalizations
      )
        .flat()
        .find((generalization) => generalization.title === selectedTitle);

      if (selectedGeneralization) {
        const nodeRef = doc(collection(db, NODES), currentVisibleNode.id);
        updateDoc(nodeRef, {
          [`inheritance.${property}.ref`]: selectedGeneralization.id,
        });
        updateInheritance({
          nodeId: selectedGeneralization.id,
          updatedProperty: property,
        });
      }
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <Box>
      <Box>
        {Object.keys(currentVisibleNode.properties)
          .filter(
            (p) => p !== "parts" && p !== "isPartOf" && p !== "description"
          )
          .sort()
          .map((property: string) => (
            <Paper
              key={property}
              sx={{
                mt: "4px",
                borderRadius: "25px",
                borderTopRightRadius: "25px",
                borderTopLeftRadius: "25px",
                mb: "15px",
              }}
              elevation={3}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  background: (theme) =>
                    theme.palette.mode === "dark" ? "#242425" : "#d0d5dd",

                  p: 3,
                  borderTopRightRadius: "25px",
                  borderTopLeftRadius: "25px",
                }}
              >
                <Typography
                  sx={{
                    fontSize: "20px",
                    fontWeight: "500",

                    fontFamily: "Roboto, sans-serif",
                  }}
                >
                  {capitalizeFirstLetter(
                    DISPLAY[property] ? DISPLAY[property] : property
                  )}
                  :
                </Typography>
                <Box sx={{ display: "flex", ml: "15px", gap: "15px" }}>
                  {currentVisibleNode.propertyType[property] !== "string" && (
                    <Button
                      variant="outlined"
                      onClick={() => showList(property, "main")}
                      sx={{
                        borderRadius: "25px",
                        backgroundColor: BUTTON_COLOR,
                      }}
                    >
                      {property !== "specializations" ? "Select" : "Add"}{" "}
                      {capitalizeFirstLetter(
                        DISPLAY[property] ? DISPLAY[property] : property
                      )}
                    </Button>
                  )}
                  {currentVisibleNode.propertyType[property] !== "string" && (
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setOpenAddCategory(true);
                        setType(property);
                      }}
                      sx={{
                        borderRadius: "25px",
                        backgroundColor: BUTTON_COLOR,
                      }}
                    >
                      Add Category
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    onClick={() => removeProperty(property)}
                    sx={{ borderRadius: "25px", backgroundColor: BUTTON_COLOR }}
                  >
                    Delete
                  </Button>
                </Box>

                <Box
                  sx={{
                    display: "flex",
                    gap: "15px",
                    ml: "auto",
                    alignItems: "center",
                    mb: "5px",
                  }}
                >
                  {currentVisibleNode.inheritance?.[property]?.ref && (
                    <Typography
                      sx={{
                        color: (theme) =>
                          theme.palette.mode === "dark" ? "white" : "black",
                        fontSize: "14px",
                      }}
                    >
                      {'(Inherited from "'}
                      {getTitle(
                        nodes,
                        currentVisibleNode.inheritance[property].ref || ""
                      )}
                      {'")'}
                    </Typography>
                  )}

                  {Object.values(currentVisibleNode.generalizations).flat()
                    .length > 1 && (
                    <TextField
                      value={getTitle(
                        nodes,
                        currentVisibleNode.inheritance[property].ref || ""
                      )}
                      onChange={(e) => {
                        changeInheritance(e, property);
                      }}
                      select
                      label="Change Inheritance"
                      sx={{ minWidth: "200px" }}
                      InputProps={{
                        sx: {
                          height: "40px",
                          padding: "0 14px",
                          borderRadius: "25px",
                        },
                      }}
                      InputLabelProps={{
                        style: { color: "grey" },
                      }}
                    >
                      <MenuItem
                        value=""
                        disabled
                        sx={{
                          backgroundColor: (theme) =>
                            theme.palette.mode === "dark" ? "" : "white",
                        }}
                      >
                        Select Course
                      </MenuItem>
                      {Object.values(currentVisibleNode.generalizations)
                        .flat()
                        .map((generalization) => (
                          <MenuItem
                            key={generalization.id}
                            value={generalization.title}
                          >
                            {getTitle(nodes, generalization.id || "")}
                          </MenuItem>
                        ))}
                    </TextField>
                  )}
                </Box>
              </Box>
              <Box
                sx={
                  {
                    /*  p: "13px"  */
                  }
                }
              >
                {currentVisibleNode.propertyType[property] !== "string" &&
                property !== "parts" &&
                property !== "isPartOf" ? (
                  <Box
                    key={property}
                    sx={{ display: "grid", mt: "5px", px: "15px" }}
                  >
                    <DragDropContext
                      onDragEnd={(e) => handleSorting(e, property)}
                    >
                      <ul style={{ padding: 0 }}>
                        {Object.keys(
                          getPropertyValue(
                            nodes,
                            currentVisibleNode.inheritance[property].ref,
                            property
                          ) || currentVisibleNode.properties[property]
                        )
                          .sort((a, b) =>
                            a === "main"
                              ? -1
                              : b === "main"
                              ? 1
                              : a.localeCompare(b)
                          )
                          .map((category) => {
                            const specials =
                              getPropertyValue(
                                nodes,
                                currentVisibleNode.inheritance[property].ref,
                                property
                              ) || currentVisibleNode.properties[property];

                            const children = specials[category] || [];

                            const showGap =
                              Object.keys(specials).filter(
                                (c) =>
                                  (specials[c] || []).length > 0 && c !== "main"
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
                                        onClick={() =>
                                          showList(property, category)
                                        }
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
                                  <List sx={{ p: 0 }}>
                                    <Droppable
                                      droppableId={category}
                                      type="CATEGORY"
                                    >
                                      {(provided, snapshot) => (
                                        <Box
                                          {...provided.droppableProps}
                                          ref={provided.innerRef}
                                          sx={{
                                            backgroundColor:
                                              snapshot.isDraggingOver
                                                ? DESIGN_SYSTEM_COLORS.gray250
                                                : "",
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
                                                    sx={{
                                                      m: 0,
                                                      p: 0,
                                                      my: "5px",
                                                    }}
                                                  >
                                                    <ListItemIcon
                                                      sx={{ minWidth: 0 }}
                                                    >
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
                                                      child={child}
                                                      property={property}
                                                      category={category}
                                                      updateInheritance={
                                                        updateInheritance
                                                      }
                                                      title={
                                                        getTitle(
                                                          nodes,
                                                          child.id
                                                        ) || child.title
                                                      }
                                                      nodes={nodes}
                                                      sx={{ pl: 1 }}
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
                  </Box>
                ) : (
                  property !== "description" &&
                  currentVisibleNode.propertyType[property] === "string" && (
                    <Text
                      updateInheritance={updateInheritance}
                      recordLogs={recordLogs}
                      text={
                        getPropertyValue(
                          nodes,
                          currentVisibleNode.inheritance[property].ref,
                          property
                        ) || currentVisibleNode.properties[property]
                      }
                      currentVisibleNode={currentVisibleNode}
                      property={property}
                      setCurrentVisibleNode={setCurrentVisibleNode}
                      nodes={nodes}
                    />
                  )
                )}
              </Box>
            </Paper>
          ))}
      </Box>
      <Button
        onClick={() => {
          setOpenAddField(true);
        }}
        variant="outlined"
        sx={{ borderRadius: "25px", mb: "5px", backgroundColor: BUTTON_COLOR }}
      >
        Add New Property
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
