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
  addLock,
  lockedNodeFields,
  user,
  nodes,
}) => {
  return (
    <Box>
      <Box>
        {Object.keys(currentVisibleNode.properties)
          .filter(
            (p) => p !== "parts" && p !== "isPartOf" && p !== "description"
          )
          .sort()
          .map((property: string) => (
            <Paper key={property} sx={{ p: 4, mt: "4px" }} elevation={3}>
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <Typography sx={{ fontSize: "20px", fontWeight: "500" }}>
                  {capitalizeFirstLetter(
                    DISPLAY[property] ? DISPLAY[property] : property
                  )}
                  :
                </Typography>

                {currentVisibleNode.propertyType[property] !== "string" && (
                  <Button
                    onClick={() => showList(property, "main")}
                    sx={{ ml: "5px" }}
                  >
                    {property !== "specializations" ? "Select" : "Add"}{" "}
                    {capitalizeFirstLetter(
                      DISPLAY[property] ? DISPLAY[property] : property
                    )}
                  </Button>
                )}
                {currentVisibleNode.propertyType[property] !== "string" && (
                  <Button
                    onClick={() => {
                      setOpenAddCategory(true);
                      setType(property);
                    }}
                    sx={{ ml: "5px" }}
                  >
                    Add Category
                  </Button>
                )}
                <Button
                  onClick={() => removeProperty(property)}
                  sx={{ ml: "5px" }}
                >
                  Delete
                </Button>
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
                    <Typography sx={{ color: "grey", fontSize: "14px" }}>
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
                    <FormControl
                      sx={{
                        m: 1,
                        width: "130px",
                        borderRadius: "25px",
                      }}
                    >
                      <Select
                        value={getTitle(
                          nodes,
                          currentVisibleNode.inheritance[property].ref || ""
                        )}
                        onChange={(event) => {
                          console.log(event);
                        }}
                        sx={{ borderRadius: "25px", maxHeight: "30px" }}
                        input={<OutlinedInput label="Name" />}
                        MenuProps={{
                          PaperProps: {
                            style: {
                              width: 50,
                              borderRadius: "25px",
                            },
                          },
                        }}
                      >
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
                      </Select>
                    </FormControl>
                  )}
                </Box>
              </Box>
              <Box>
                {currentVisibleNode.propertyType[property] !== "string" &&
                property !== "parts" &&
                property !== "isPartOf" ? (
                  <Box key={property} sx={{ display: "grid", mt: "5px" }}>
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
                                                    sx={{ m: 0, p: 0 }}
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
                      user={user}
                      lockedNodeFields={
                        lockedNodeFields[currentVisibleNode.id] || {}
                      }
                      addLock={addLock}
                      text={
                        getPropertyValue(
                          nodes,
                          currentVisibleNode.inheritance[property].ref,
                          property
                        ) || currentVisibleNode.properties[property]
                      }
                      currentVisibleNode={currentVisibleNode}
                      property={property}
                      setSnackbarMessage={setSnackbarMessage}
                      setCurrentVisibleNode={setCurrentVisibleNode}
                      setEditNode={setEditNode}
                      removeField={removeProperty}
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
