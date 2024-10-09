import React, { useCallback, useMemo, useState } from "react";
import DoneIcon from "@mui/icons-material/Done";
import CloseIcon from "@mui/icons-material/Close";
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
  TextField,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "react-beautiful-dnd";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import {
  capitalizeFirstLetter,
  getPropertyValue,
  getTitle,
} from " @components/lib/utils/string.utils";
import { ICollection, ILinkNode, INode } from " @components/types/INode";
import { DISPLAY } from " @components/lib/CONSTANTS";
import LinkNode from "../LinkNode/LinkNode";
import { DESIGN_SYSTEM_COLORS } from " @components/lib/theme/colors";
import { useAuth } from "../context/AuthContext";
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  updateDoc,
} from "firebase/firestore";
import { NODES } from " @components/lib/firestoreClient/collections";
import {
  recordLogs,
  saveNewChangeLog,
  updateInheritance,
} from " @components/lib/utils/helpers";
import NewCollection from "../Collection/NewCollection";

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
  reviewId?: string;
  setReviewId?: Function;
  confirmIt: any;
};

const StructuredProperty = ({
  currentVisibleNode,
  showListToSelect: showList,
  navigateToNode,
  setSnackbarMessage,
  setCurrentVisibleNode,
  property,
  nodes,
  locked,
  selectedDiffNode,
  reviewId,
  setReviewId,
  confirmIt,
}: IStructuredPropertyProps) => {
  const [{ user }] = useAuth();
  const theme = useTheme();
  const db = getFirestore();
  const [openAddCollection, setOpenAddCollection] = useState(false);
  const [editCollection, setEditCollection] = useState<string | null>(null);
  const [newEditCollection, setNewEditCollection] = useState("");

  const BUTTON_COLOR = theme.palette.mode === "dark" ? "#373739" : "#dde2ea";

  const propertyValue: ICollection[] = useMemo(() => {
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

    let finalResult: any = [];

    if (
      selectedDiffNode &&
      selectedDiffNode.modifiedProperty === property &&
      (selectedDiffNode.changeType === "sort elements" ||
        selectedDiffNode.changeType === "remove element" ||
        selectedDiffNode.changeType === "modify elements" ||
        selectedDiffNode.changeType === "add element")
    ) {
      selectedDiffNode.newValue.forEach(
        (collectionNewValue: ICollection, collectionIndex: number) => {
          const collectionPrevious: ICollection =
            selectedDiffNode.previousValue[collectionIndex];

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

    return result;
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

  const handleCollectionSorting = useCallback(
    (e: any) => {
      try {
        const sourceIndex = e.source.index;
        const destinationIndex = e.destination.index;

        if (sourceIndex === undefined || destinationIndex === undefined) {
          throw new Error("Invalid source or destination index");
        }

        const nodeData = { ...currentVisibleNode } as INode;
        let propertyValue: ICollection[] | null = null;

        if (
          property !== "specializations" &&
          property !== "generalizations" &&
          nodeData.inheritance &&
          nodeData.inheritance[property]?.ref
        ) {
          const nodeId = nodeData.inheritance[property].ref;
          const inheritedNode = nodes[nodeId as string];

          nodeData.properties[property] = JSON.parse(
            JSON.stringify(inheritedNode.properties[property])
          );
        }

        if (property === "specializations" || property === "generalizations") {
          propertyValue = [...(nodeData[property] || [])];
        } else if (Array.isArray(nodeData.properties[property])) {
          propertyValue = [...(nodeData.properties[property] || [])];
        }

        if (propertyValue) {
          const newArray = [...propertyValue];
          const [movedElement] = newArray.splice(sourceIndex, 1);
          newArray.splice(destinationIndex, 0, movedElement);

          const mainIndex = newArray.findIndex(
            (item) => item.collectionName === "main"
          );

          if (mainIndex !== -1 && mainIndex !== newArray.length - 1) {
            const [mainCollection] = newArray.splice(mainIndex, 1);
            newArray.push(mainCollection);
          }

          const nodeRef = doc(collection(db, NODES), currentVisibleNode.id);

          if (
            property === "specializations" ||
            property === "generalizations"
          ) {
            updateDoc(nodeRef, {
              [property]: newArray,
            });
          } else {
            if (nodeData.inheritance) {
              nodeData.inheritance[property].ref = null;
            }
            updateDoc(nodeRef, {
              [`properties.${property}`]: newArray,
              [`inheritance.${property}.ref`]: null,
            });

            updateInheritance({
              nodeId: currentVisibleNode.id,
              updatedProperty: property,
              db,
            });
          }
        }
      } catch (error: any) {
        console.error(error);
        recordLogs({
          type: "error",
          error: JSON.stringify({
            name: error.name,
            message: error.message,
            stack: error.stack,
          }),
          nodeId: currentVisibleNode.id,
        });
      }
    },
    [property, currentVisibleNode]
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
  const handleSorting = useCallback(
    async (
      result: DropResult,
      property: string,
      propertyValue: ICollection[]
    ) => {
      try {
        // Destructure properties from the result object
        const { source, destination, draggableId, type } = result;

        // If there is no destination, no sorting needed

        if (!destination || !user?.uname) {
          return;
        }

        // Extract the source and destination collection IDs
        const { droppableId: sourceCollection } = source; // The source collection
        const { droppableId: destinationCollection } = destination; // The destination collection
        const sourceCollectionIndex = Number(sourceCollection);
        const destinationCollectionIndex = Number(destinationCollection);

        // Ensure defined source and destination categories
        if (sourceCollection && destinationCollection && propertyValue) {
          // Ensure nodeData exists

          const previousValue = JSON.parse(JSON.stringify(propertyValue));

          if (!propertyValue) return;
          // Find the index of the draggable item in the source category

          const nodeIdx = propertyValue[sourceCollectionIndex].nodes.findIndex(
            (link: ILinkNode) => link.id === draggableId
          );

          // If the draggable item is found in the source category
          if (nodeIdx !== -1) {
            const moveValue =
              propertyValue[sourceCollectionIndex].nodes[nodeIdx];

            // Remove the item from the source category
            propertyValue[sourceCollectionIndex].nodes.splice(nodeIdx, 1);

            // Move the item to the destination category
            propertyValue[destinationCollectionIndex].nodes.splice(
              destination.index,
              0,
              moveValue
            );
          }
          // Update the nodeData with the new property values
          const nodeRef = doc(collection(db, NODES), currentVisibleNode.id);
          if (
            property === "specializations" ||
            property === "generalizations"
          ) {
            updateDoc(nodeRef, {
              [property]: propertyValue,
            });
          } else {
            updateDoc(nodeRef, {
              [`properties.${property}`]: propertyValue,
              [`inheritance.${property}.ref`]: null,
            });
            updateInheritance({
              nodeId: currentVisibleNode.id,
              updatedProperty: property,
              db,
            });
          }

          saveNewChangeLog(db, {
            nodeId: currentVisibleNode.id,
            modifiedBy: user?.uname,
            modifiedProperty: property,
            previousValue,
            newValue: propertyValue,
            modifiedAt: new Date(),
            changeType: "sort elements",
            fullNode: currentVisibleNode,
          });

          // Record a log of the sorting action
          recordLogs({
            action: "sort elements",
            field: property,
            sourceCategory: sourceCollection,
            destinationCategory: destinationCollection,
            nodeId: currentVisibleNode.id,
          });
        }
      } catch (error: any) {
        // Log any errors that occur during the sorting process
        console.error(error);
        recordLogs({
          type: "error",
          error: JSON.stringify({
            name: error.name,
            message: error.message,
            stack: error.stack,
          }),
        });
      }
    },
    [currentVisibleNode, db, nodes, recordLogs, property]
  );
  const deleteCollection = useCallback(
    async (property: string, collectionIdx: number, collectionName: string) => {
      if (
        user?.uname &&
        (await confirmIt(
          `Are you sure you want to delete the collection ${collectionIdx}?`,
          "Delete Collection",
          "Keep Collection"
        ))
      ) {
        try {
          const nodeDoc = await getDoc(
            doc(collection(db, NODES), currentVisibleNode.id)
          );
          if (nodeDoc.exists()) {
            let previousValue = null;
            const nodeData = nodeDoc.data();
            const isSpecialization =
              property === "specializations" || property === "generalizations";

            const propertyPath = isSpecialization
              ? property
              : `properties.${property}`;

            // Handle collection deletion for both 'specializations' and other properties
            previousValue = JSON.parse(
              JSON.stringify(
                isSpecialization
                  ? nodeData[propertyPath]
                  : nodeData.properties[property]
              )
            );

            // Merge the category into "main" and delete the category
            if (isSpecialization) {
              let mainCollectionIdx = nodeData[propertyPath].findIndex(
                (c: { collectionName: string }) => c.collectionName === "main"
              );

              if (mainCollectionIdx === -1) {
                nodeData[propertyPath].push({
                  collectionName: "main",
                  nodes: [],
                });
                mainCollectionIdx = nodeData[propertyPath].length - 1;
              }

              nodeData[propertyPath][mainCollectionIdx].nodes = [
                ...(nodeData[propertyPath][mainCollectionIdx].nodes || []),
                ...nodeData[propertyPath][collectionIdx].nodes,
              ];
              nodeData[propertyPath].splice(collectionIdx, 1);
            } else {
              let mainCollectionIdx = nodeData.properties[property].findIndex(
                (c: { collectionName: string }) => c.collectionName === "main"
              );
              if (mainCollectionIdx === -1) {
                nodeData.properties[property].push({
                  collectionName: "main",
                  nodes: [],
                });
                mainCollectionIdx = nodeData.properties[property].length - 1;
              }
              nodeData.properties[property][mainCollectionIdx] = [
                ...(nodeData.properties[property][mainCollectionIdx].nodes ||
                  []),
                ...nodeData.properties[property][collectionIdx].nodes,
              ];
              nodeData.properties[property].splice(collectionIdx, 1);
            }

            // Prepare the updated document data
            const updateData = {
              [propertyPath]: isSpecialization
                ? nodeData[propertyPath]
                : nodeData.properties[property],
            };

            // Update the node document
            await updateDoc(nodeDoc.ref, updateData);

            recordLogs({
              action: "Deleted a collection",
              category: collectionIdx,
              node: nodeDoc.id,
            });

            // Log the changes
            saveNewChangeLog(db, {
              nodeId: currentVisibleNode.id,
              modifiedBy: user?.uname,
              modifiedProperty: property,
              previousValue,
              newValue: isSpecialization
                ? nodeData[propertyPath]
                : nodeData.properties[property],
              modifiedAt: new Date(),
              changeType: "delete collection",
              fullNode: currentVisibleNode,
              changeDetails: {
                deletedCollection: collectionName || "",
              },
            });
          }
        } catch (error: any) {
          console.error("error", error);
          recordLogs({
            type: "error",
            error: JSON.stringify({
              name: error.name,
              message: error.message,
              stack: error.stack,
            }),
            at: "deleteCollection",
          });
        }
      }
    },
    [user?.uname]
  );

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

  const addCollection = useCallback(
    async (newCollection: string) => {
      try {
        setOpenAddCollection(false);
        if (!newCollection || !user?.uname) return;

        const nodeDoc = await getDoc(
          doc(collection(db, NODES), currentVisibleNode.id)
        );
        if (!nodeDoc.exists()) return;

        const nodeData = nodeDoc.data();
        const isSpecialization =
          property === "specializations" || property === "generalizations";

        const propertyPath = isSpecialization
          ? property
          : `properties.${property}`;

        const existIndex = nodeData[propertyPath].findIndex(
          (c: ICollection) => c.collectionName === newCollection
        );
        // Check if the collection already exists
        if (existIndex !== -1) {
          confirmIt(
            `This category already exists under the property ${property}`,
            "Ok",
            ""
          );
          return;
        }

        // Create a deep copy of the previous value for logs
        let previousValue = JSON.parse(
          JSON.stringify(
            isSpecialization
              ? nodeData[propertyPath] || {}
              : nodeData.properties[property] || {}
          )
        );

        // Add new collection
        if (isSpecialization) {
          nodeData[propertyPath].unshift({
            collectionName: newCollection,
            nodes: [],
          });
        } else {
          nodeData.properties[property].unshift({
            collectionName: newCollection,
            nodes: [],
          });
        }

        // Log the new collection addition
        logChange("add collection", null, newCollection, nodeDoc, property);

        // Update inheritance if necessary
        if (!isSpecialization) {
          updateInheritance({
            nodeId: nodeDoc.id,
            updatedProperty: property,
            db,
          });
        }

        // Update the node document with the new collection
        const updateData = {
          [propertyPath]: isSpecialization
            ? nodeData[propertyPath]
            : nodeData.properties[property],
        };
        await updateDoc(nodeDoc.ref, updateData);

        // Save the change log
        saveNewChangeLog(db, {
          nodeId: currentVisibleNode.id,
          modifiedBy: user?.uname,
          modifiedProperty: property,
          previousValue,
          newValue: nodeData[propertyPath] || nodeData.properties[property],
          modifiedAt: new Date(),
          changeType: "add collection",
          fullNode: currentVisibleNode,
          changeDetails: {
            addedCollection: newCollection || "",
          },
        });
      } catch (error: any) {
        console.error(error);
        recordLogs({
          type: "error",
          error: JSON.stringify({
            name: error.name,
            message: error.message,
            stack: error.stack,
          }),
          at: "addCollection",
        });
      }
    },
    [user?.uname, property]
  );

  const saveEditCollection = useCallback(
    async (newCollection: string) => {
      try {
        if (!newCollection || !user?.uname || newCollection === editCollection)
          return;

        const nodeDoc = await getDoc(
          doc(collection(db, NODES), currentVisibleNode.id)
        );
        if (!nodeDoc.exists()) return;

        const nodeData = nodeDoc.data();
        const isSpecialization =
          property === "specializations" || property === "generalizations";

        const propertyPath = isSpecialization
          ? property
          : `properties.${property}`;

        // Create a deep copy of the previous value for logs
        let previousValue = JSON.parse(
          JSON.stringify(
            isSpecialization
              ? nodeData[propertyPath]
              : nodeData.properties[property] || {}
          )
        );

        // Find the collection to be edited
        if (isSpecialization) {
          const collection = nodeData[propertyPath].find(
            (c: ICollection) => c.collectionName === editCollection
          );

          collection.collectionName = newCollection;
        } else {
          const collection = nodeData.properties[property].find(
            (c: ICollection) => c.collectionName === editCollection
          );
          collection.collectionName = newCollection;
        }

        // Log the edited category
        logChange(
          "Edited a category",
          editCollection,
          newCollection,
          nodeDoc,
          property
        );

        // Update inheritance if necessary
        if (!isSpecialization) {
          updateInheritance({
            nodeId: nodeDoc.id,
            updatedProperty: property,
            db,
          });
        }

        // Update the node document with the edited collection
        const updateData = {
          [propertyPath]: isSpecialization
            ? nodeData[propertyPath]
            : nodeData.properties[property],
        };
        await updateDoc(nodeDoc.ref, updateData);

        // Save the change log
        saveNewChangeLog(db, {
          nodeId: currentVisibleNode.id,
          modifiedBy: user?.uname,
          modifiedProperty: property,
          previousValue,
          newValue: nodeData[propertyPath] || nodeData.properties[property],
          modifiedAt: new Date(),
          changeType: "edit collection",
          fullNode: currentVisibleNode,
          changeDetails: {
            modifiedCollection: editCollection || "",
            newValue: newCollection,
          },
        });
      } catch (error: any) {
        console.error(error);
        recordLogs({
          type: "error",
          error: JSON.stringify({
            name: error.name,
            message: error.message,
            stack: error.stack,
          }),
          at: "saveEditCollection",
        });
      }
      setEditCollection(null);
    },
    [property, editCollection, user?.uname]
  );

  const handleEditCollection = (collectionName: string) => {
    setEditCollection(collectionName);
    setNewEditCollection(collectionName);
  };
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
                {"Add "}
                {capitalizeFirstLetter(DISPLAY[property] || property)}
              </Button>
            )}
            {property !== "parts" && property !== "isPartOf" && (
              <Button
                onClick={() => {
                  setOpenAddCollection(true);
                }}
                sx={{ borderRadius: "25px", backgroundColor: BUTTON_COLOR }}
                variant="outlined"
              >
                Add Collection
              </Button>
            )}
          </Box>
        )}
        {openAddCollection && (
          <NewCollection
            onAdd={addCollection}
            onCancel={() => {
              setOpenAddCollection(false);
            }}
          />
        )}

        <DragDropContext
          onDragEnd={(e) => {
            if (locked) return;
            if (e.type === "CATEGORY") {
              handleCollectionSorting(e);
            } else {
              handleSorting(e, property, propertyValue);
            }
          }}
        >
          {/* Droppable for categories */}
          <Droppable droppableId="categories" type="CATEGORY">
            {(provided) => (
              <Box ref={provided.innerRef} {...provided.droppableProps}>
                {propertyValue.map(
                  (collection: ICollection, collectionIndex: number) => {
                    return (
                      <Draggable
                        key={collection.collectionName + collectionIndex}
                        draggableId={`${collectionIndex}`}
                        index={collectionIndex}
                      >
                        {(provided) => (
                          <Paper
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            id={`${collectionIndex}`}
                            sx={{
                              mt: "15px",
                              borderRadius: "20px",
                            }}
                            elevation={
                              collection.collectionName !== "main" ? 6 : 0
                            }
                          >
                            {collection.collectionName !== "main" &&
                            editCollection === null ? (
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
                                  backgroundColor: getCategoryStyle(
                                    collection.collectionName
                                  ),
                                }}
                              >
                                {selectedDiffNode &&
                                selectedDiffNode.changeType ===
                                  "edit collection" &&
                                selectedDiffNode.changeDetails
                                  .modifiedCollection ===
                                  collection.collectionName ? (
                                  <Box sx={{ display: "flex" }}>
                                    <Typography
                                      sx={{
                                        fontWeight: "bold",
                                        mr: "13px",
                                        color: "red",
                                        textDecoration: "line-through",
                                      }}
                                    >
                                      {capitalizeFirstLetter(
                                        collection.collectionName
                                      )}
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
                                    {capitalizeFirstLetter(
                                      collection.collectionName
                                    )}
                                  </Typography>
                                )}
                                {property === "specializations" &&
                                  !selectedDiffNode && (
                                    <Button
                                      onClick={() =>
                                        showList(property, collection)
                                      }
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
                                          handleEditCollection(
                                            collection.collectionName
                                          );
                                        }}
                                      >
                                        <EditIcon />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete collection">
                                      <IconButton
                                        onClick={() =>
                                          deleteCollection(
                                            property,
                                            collectionIndex,
                                            collection.collectionName
                                          )
                                        }
                                      >
                                        <DeleteIcon />
                                      </IconButton>
                                    </Tooltip>
                                  </Box>
                                )}
                              </Box>
                            ) : editCollection === collection.collectionName ? (
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
                                  backgroundColor: getCategoryStyle(
                                    collection.collectionName
                                  ),
                                }}
                              >
                                <TextField
                                  sx={{ p: 0 }}
                                  fullWidth
                                  placeholder="Edit collection..."
                                  onChange={(e) =>
                                    setNewEditCollection(e.target.value)
                                  }
                                  value={newEditCollection}
                                />
                                <Tooltip title="Save">
                                  <IconButton
                                    onClick={() => {
                                      saveEditCollection(newEditCollection);
                                    }}
                                    disabled={
                                      !newEditCollection ||
                                      collection.collectionName ===
                                        newEditCollection
                                    }
                                    sx={{ ml: "5px" }}
                                  >
                                    <DoneIcon
                                      sx={{
                                        color:
                                          !newEditCollection ||
                                          collection.collectionName ===
                                            newEditCollection
                                            ? "gray"
                                            : "green",
                                      }}
                                    />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Cancel">
                                  <IconButton
                                    onClick={() => {
                                      setEditCollection(null);
                                      setNewEditCollection("");
                                    }}
                                    sx={{ ml: "5px" }}
                                  >
                                    <CloseIcon sx={{ color: "red" }} />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            ) : (
                              <></>
                            )}

                            <List sx={{ p: 1 }}>
                              <Droppable
                                droppableId={`${collectionIndex}`}
                                type="LINK"
                              >
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
                                    {propertyValue[collectionIndex].nodes
                                      .length > 0 ? (
                                      propertyValue[collectionIndex].nodes.map(
                                        (link: ILinkNode, index: number) => (
                                          <Draggable
                                            key={link.id + index}
                                            draggableId={link.id}
                                            index={collectionIndex}
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
                                                  navigateToNode={
                                                    navigateToNode
                                                  }
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
                                                  title={getTitle(
                                                    nodes,
                                                    link.id
                                                  )}
                                                  nodes={nodes}
                                                  linkIndex={index}
                                                  unlinkVisible={unlinkVisible(
                                                    link.id
                                                  )}
                                                  linkLocked={false}
                                                  locked={locked}
                                                  user={user}
                                                  reviewId={reviewId}
                                                  setReviewId={setReviewId}
                                                  collectionIndex={
                                                    collectionIndex
                                                  }
                                                />
                                              </ListItem>
                                            )}
                                          </Draggable>
                                        )
                                      )
                                    ) : (
                                      <Typography
                                        variant="body2"
                                        sx={{
                                          p: 2,
                                          color: "text.secondary",
                                          textAlign: "center",
                                        }}
                                      >
                                        {collection.collectionName === "main"
                                          ? ""
                                          : "No items"}
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
                  }
                )}
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
