import { DISPLAY } from " @components/lib/CONSTANTS";
import { DESIGN_SYSTEM_COLORS } from " @components/lib/theme/colors";
import {
  capitalizeFirstLetter,
  getTitle,
} from " @components/lib/utils/string.utils";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { ICollection, ILinkNode, INode } from " @components/types/INode";
import DoneIcon from "@mui/icons-material/Done";
import {
  Box,
  Paper,
  Typography,
  Tooltip,
  IconButton,
  TextField,
  List,
  Button,
  useTheme,
} from "@mui/material";
import { property } from "lodash";
import theme from "quill/core/theme";
import React, { useCallback, useState } from "react";
import AddIcon from "@mui/icons-material/Add";

import NewCollection from "../Collection/NewCollection";
import LinkNode from "../LinkNode/LinkNode";
import { useAuth } from "../context/AuthContext";
import {
  recordLogs,
  saveNewChangeLog,
  updateInheritance,
} from " @components/lib/utils/helpers";
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  updateDoc,
} from "firebase/firestore";
import { NODES } from " @components/lib/firestoreClient/collections";
import {
  DragDropContext,
  Draggable,
  Droppable,
  DropResult,
} from "@hello-pangea/dnd";
import { LoadingButton } from "@mui/lab";
import SelectModelModal from "../Models/SelectModel";

const CollectionStructure = ({
  model,
  locked,
  selectedDiffNode,
  currentImprovement,
  property,
  propertyValue,
  getCategoryStyle,
  navigateToNode,
  setSnackbarMessage,
  currentVisibleNode,
  setCurrentVisibleNode,
  nodes,
  unlinkVisible,
  editStructuredProperty,
  confirmIt,
  logChange,
  cloneNode,
  openAddCollection,
  setOpenAddCollection,
  clonedNodesQueue,
  setEditableProperty,
  unlinkElement,
  addACloneNodeQueue,
  selectedProperty,
  setModifiedOrder,
  glowIds,
  scrollToElement,
  selectedCollection,
  handleCloseAddLinksModel,
  onSave,
  isSaving,
  addedElements,
  removedElements,
  setSearchValue,
  searchValue,
  searchResultsForSelection,
  checkedItems,
  setCheckedItems,
  setCheckedItemsCopy,
  checkedItemsCopy,
  handleCloning,
  selectFromTree,
  expandedNodes,
  setExpandedNodes,
  handleToggle,
  getPath,
  handleSaveLinkChanges,
  checkDuplicateTitle,
  cloning,
  setClonedNodesQueue,
  newOnes,
  setNewOnes,
  editableProperty,
  onGetPropertyValue,
  setRemovedElements,
  setAddedElements,
  skillsFuture,
}: {
  model?: boolean;
  locked: boolean;
  selectedDiffNode: any;
  currentImprovement: any;
  property: string;
  propertyValue: any;
  getCategoryStyle: any;
  navigateToNode: any;
  setSnackbarMessage: any;
  currentVisibleNode: any;
  setCurrentVisibleNode: any;
  nodes: { [inodeId: string]: INode };
  unlinkVisible: any;
  editStructuredProperty: any;
  confirmIt: any;
  logChange: any;
  cloneNode?: any;
  openAddCollection: any;
  setOpenAddCollection: any;
  clonedNodesQueue: any;
  setEditableProperty: any;
  unlinkElement: any;
  addACloneNodeQueue: any;
  selectedProperty: string;
  setModifiedOrder: any;
  glowIds: Set<string>;
  scrollToElement: (elementId: string) => void;
  selectedCollection: string;
  handleCloseAddLinksModel: any;
  onSave: any;
  isSaving: any;
  addedElements: any;
  removedElements: any;
  setSearchValue: any;
  searchValue: any;
  searchResultsForSelection: any;
  checkedItems: any;
  setCheckedItems: any;
  setCheckedItemsCopy: any;
  checkedItemsCopy: any;
  handleCloning: any;
  user: any;
  selectFromTree: any;
  expandedNodes: any;
  setExpandedNodes: any;
  handleToggle: any;
  getPath: any;
  handleSaveLinkChanges: any;
  checkDuplicateTitle: any;
  cloning: any;
  setClonedNodesQueue: any;
  newOnes: any;
  setNewOnes: any;
  editableProperty: any;
  onGetPropertyValue: any;
  setRemovedElements: any;
  setAddedElements: any;
  skillsFuture: boolean;
}) => {
  const db = getFirestore();
  const [{ user }] = useAuth();

  const [editCollection, setEditCollection] = useState<string | null>(null);
  const [newEditCollection, setNewEditCollection] = useState("");

  const theme = useTheme();
  const BUTTON_COLOR = theme.palette.mode === "dark" ? "#373739" : "#dde2ea";

  const handleCollectionSorting = useCallback(
    (e: any) => {
      try {
        const sourceIndex = e.source.index;
        const destinationIndex = e.destination.index;

        if (sourceIndex === undefined || destinationIndex === undefined) {
          throw new Error("Invalid source or destination index");
        }

        if (model) {
          setEditableProperty((prev: ICollection[]) => {
            const newArray = [...prev];
            const [movedElement] = newArray.splice(sourceIndex, 1);
            newArray.splice(destinationIndex, 0, movedElement);
            return newArray;
          });
          setModifiedOrder(true);
          return;
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
            JSON.stringify(inheritedNode.properties[property]),
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
          const nodeRef = doc(collection(db, NODES), currentVisibleNode?.id);

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
              nodeId: currentVisibleNode?.id,
              updatedProperties: [property],
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
          nodeId: currentVisibleNode?.id,
        });
      }
    },
    [property, currentVisibleNode],
  );

  const handleSorting = useCallback(
    async (
      result: DropResult,
      property: string,
      propertyValue: ICollection[],
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
        if (model) {
          setEditableProperty((prev: ICollection[]) => {
            const nodeIdx = prev[sourceCollectionIndex].nodes.findIndex(
              (link: ILinkNode) => link.id === draggableId,
            );
            const moveValue = prev[sourceCollectionIndex].nodes[nodeIdx];

            // Remove the item from the source category
            prev[sourceCollectionIndex].nodes.splice(nodeIdx, 1);

            // Move the item to the destination category
            prev[destinationCollectionIndex].nodes.splice(
              destination.index,
              0,
              moveValue,
            );
            return prev;
          });
          setModifiedOrder(true);
          return;
        }
        // Ensure defined source and destination categories
        if (sourceCollection && destinationCollection && propertyValue) {
          // Ensure nodeData exists

          const previousValue = JSON.parse(JSON.stringify(propertyValue));

          if (!propertyValue) return;
          // Find the index of the draggable item in the source category

          const nodeIdx = propertyValue[sourceCollectionIndex].nodes.findIndex(
            (link: ILinkNode) => link.id === draggableId,
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
              moveValue,
            );
          }
          // Update the nodeData with the new property values
          const nodeRef = doc(collection(db, NODES), currentVisibleNode?.id);
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
              nodeId: currentVisibleNode?.id,
              updatedProperties: [property],
              db,
            });
          }

          saveNewChangeLog(db, {
            nodeId: currentVisibleNode?.id,
            modifiedBy: user?.uname,
            modifiedProperty: property,
            previousValue,
            newValue: propertyValue,
            modifiedAt: new Date(),
            changeType: "sort elements",
            changeDetails: {
              draggableNodeId: draggableId,
              source,
              destination,
            },
            fullNode: currentVisibleNode,
            skillsFuture,
          });

          // Record a log of the sorting action
          recordLogs({
            action: "sort elements",
            field: property,
            sourceCategory: sourceCollection,
            destinationCategory: destinationCollection,
            nodeId: currentVisibleNode?.id,
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
    [currentVisibleNode, db, nodes, recordLogs, property],
  );

  const addCollection = useCallback(
    async (newCollection: string) => {
      try {
        if (
          newCollection.toLowerCase() === "main" ||
          newCollection.toLowerCase() === "default"
        ) {
          return;
        }
        setOpenAddCollection(false);
        if (!newCollection || !user?.uname) return;

        const nodeDoc = await getDoc(
          doc(collection(db, NODES), currentVisibleNode?.id),
        );
        if (!nodeDoc.exists()) return;

        const nodeData = nodeDoc.data();
        const isSpecialization =
          property === "specializations" || property === "generalizations";

        const propertyPath = isSpecialization
          ? property
          : `properties.${property}`;

        const existIndex = nodeData[propertyPath].findIndex(
          (c: ICollection) => c.collectionName === newCollection,
        );
        // Check if the collection already exists
        if (existIndex !== -1) {
          confirmIt(
            `This category already exists under the property ${property}`,
            "Ok",
            "",
          );
          return;
        }

        // Create a deep copy of the previous value for logs
        let previousValue = JSON.parse(
          JSON.stringify(
            isSpecialization
              ? nodeData[propertyPath] || {}
              : nodeData.properties[property] || {},
          ),
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
            updatedProperties: [property],
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
          nodeId: currentVisibleNode?.id,
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
          skillsFuture,
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
    [user?.uname, db, currentVisibleNode?.id, property],
  );
  const saveNewAndSwapIt = (newPartTitle: string, partId: string) => {
    try {
      if (model && addACloneNodeQueue) {
        const newId = addACloneNodeQueue(partId, newPartTitle);
        replaceWith(newId, partId);
        return;
      }
      if (property === "parts" && cloneNode) {
        const nodeId = partId;
        const newId = doc(collection(db, NODES)).id;
        const clonedNode = cloneNode(nodeId, newPartTitle, newId, property);

        replaceWith(newId, partId);
      }
    } catch (error) {
      console.error(error);
    }
  };
  const replaceWith = useCallback(
    async (partId: string, id: string) => {
      try {
        scrollToElement(partId);
        if (model) {
          setEditableProperty((prev: ICollection[]) => {
            const _prev = [...prev];
            const elementIdx = _prev[0].nodes.findIndex((n) => n.id === id);
            const existIdx = _prev[0].nodes.findIndex((n) => n.id === partId);
            if (existIdx === -1) {
              _prev[0].nodes[elementIdx].id = partId;
            }
            return _prev;
          });
          return;
        }

        if (property === "parts" && currentVisibleNode?.id) {
          const elementIdx = propertyValue[0].nodes.findIndex(
            (n: { id: string }) => n.id === id,
          );
          const existIdx = propertyValue[0].nodes.findIndex(
            (n: { id: string }) => n.id === partId,
          );
          if (existIdx === -1) {
            propertyValue[0].nodes[elementIdx].id = partId;
            const nodeRef = doc(collection(db, NODES), currentVisibleNode?.id);

            updateDoc(nodeRef, {
              "properties.parts": propertyValue,
            });
            if (currentVisibleNode.inheritance.parts.ref) {
              updateInheritance({
                nodeId: currentVisibleNode?.id,
                updatedProperties: ["parts"],
                db,
              });
            }
          }
        }
      } catch (error) {
        console.error(error);
      }
    },
    [currentVisibleNode?.id, db, property, propertyValue, model],
  );
  const saveEditCollection = useCallback(
    async (newCollection: string) => {
      try {
        if (!newCollection || !user?.uname || newCollection === editCollection)
          return;

        const nodeDoc = await getDoc(
          doc(collection(db, NODES), currentVisibleNode?.id),
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
              : nodeData.properties[property] || {},
          ),
        );

        // Find the collection to be edited
        if (isSpecialization) {
          const collection = nodeData[propertyPath].find(
            (c: ICollection) => c.collectionName === editCollection,
          );
          if (collection) {
            collection.collectionName = newCollection;
          }
        } else {
          const collection = nodeData.properties[property].find(
            (c: ICollection) => c.collectionName === editCollection,
          );
          if (collection) {
            collection.collectionName = newCollection;
          }
        }

        // Log the edited category
        logChange(
          "Edited a category",
          editCollection,
          newCollection,
          nodeDoc,
          property,
        );

        // Update inheritance if necessary
        if (!isSpecialization) {
          updateInheritance({
            nodeId: nodeDoc.id,
            updatedProperties: [property],
            db,
          });
        }

        // Update the node document with the edited collection
        const updateData = {
          [propertyPath]: isSpecialization
            ? nodeData[propertyPath]
            : nodeData.properties[property],
        };

        setEditableProperty((prev: ICollection[]) => {
          const _prev = [...prev];
          const collection = _prev.find(
            (c: ICollection) => c.collectionName === editCollection,
          );
          if (collection) {
            collection.collectionName = newCollection;
          }
          return _prev;
        });
        await updateDoc(nodeDoc.ref, updateData);

        // Save the change log
        saveNewChangeLog(db, {
          nodeId: currentVisibleNode?.id,
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
          skillsFuture,
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
    [property, editCollection, user?.uname],
  );
  const deleteCollection = useCallback(
    async (property: string, collectionIdx: number, collectionName: string) => {
      if (
        user?.uname &&
        (await confirmIt(
          `Are you sure you want to delete the collection ${collectionName}?`,
          "Delete Collection",
          "Keep Collection",
        ))
      ) {
        try {
          const nodeDoc = await getDoc(
            doc(collection(db, NODES), currentVisibleNode?.id),
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
                  : nodeData.properties[property],
              ),
            );

            // Merge the category into "main" and delete the category
            if (isSpecialization) {
              let mainCollectionIdx = nodeData[propertyPath].findIndex(
                (c: { collectionName: string }) => c.collectionName === "main",
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
                (c: { collectionName: string }) => c.collectionName === "main",
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
              nodeId: currentVisibleNode?.id,
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
              skillsFuture,
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
    [confirmIt, currentVisibleNode, db, user?.uname],
  );
  const handleEditCollection = (collectionName: string) => {
    setEditCollection(collectionName);
    setNewEditCollection(collectionName);
  };

  return (
    <Box
      sx={{
        p: "15px",
        pt: 0,
      }}
    >
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
          if (locked || !!selectedDiffNode || !!currentImprovement) return;
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
              {(propertyValue || []).map(
                (collection: ICollection, collectionIndex: number) => {
                  return (
                    <Draggable
                      key={collection.collectionName + collectionIndex}
                      draggableId={`${collectionIndex}`}
                      index={collectionIndex}
                      isDragDisabled={property !== "specializations"}
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
                            border:
                              selectedCollection ===
                                collection.collectionName &&
                              selectedProperty === property
                                ? "2px solid green"
                                : "",
                          }}
                          elevation={property !== "specializations" ? 0 : 3}
                        >
                          {property === "specializations" && (
                            <Box>
                              {editCollection === null ||
                              editCollection !== collection.collectionName ? (
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
                                      collection.collectionName,
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
                                          collection.collectionName,
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
                                          selectedDiffNode.changeDetails
                                            .newValue,
                                        )}
                                      </Typography>
                                    </Box>
                                  ) : collection.collectionName !== "main" ? (
                                    <Typography
                                      sx={{
                                        fontWeight: "bold",
                                        mr: "13px",
                                      }}
                                    >
                                      {capitalizeFirstLetter(
                                        collection.collectionName,
                                      )}
                                    </Typography>
                                  ) : (
                                    <></>
                                  )}
                                  {!selectedDiffNode &&
                                    collection.collectionName !== "main" &&
                                    !currentImprovement &&
                                    !model && (
                                      <Box
                                        sx={{
                                          display: "flex",
                                          ml: "auto",
                                          gap: "5px",
                                        }}
                                      >
                                        <Tooltip title="Edit collection title">
                                          <IconButton
                                            onClick={() => {
                                              handleEditCollection(
                                                collection.collectionName,
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
                                                collection.collectionName,
                                              )
                                            }
                                          >
                                            <DeleteIcon />
                                          </IconButton>
                                        </Tooltip>
                                      </Box>
                                    )}{" "}
                                  {selectedProperty === property &&
                                    !!selectedCollection &&
                                    selectedCollection ===
                                      collection.collectionName && (
                                      <Box
                                        sx={{
                                          display: "flex",
                                          pt: 0,
                                          ml: "auto",
                                          gap: "14px",
                                        }}
                                      >
                                        <Button
                                          variant="contained"
                                          onClick={handleCloseAddLinksModel}
                                          color="error"
                                          sx={{ borderRadius: "25px" }}
                                        >
                                          Cancel
                                        </Button>
                                        <LoadingButton
                                          size="small"
                                          onClick={onSave}
                                          loading={isSaving}
                                          color="success"
                                          variant="contained"
                                          sx={{
                                            borderRadius: "25px",
                                            color: "white",
                                          }}
                                          disabled={
                                            addedElements.size === 0 &&
                                            removedElements.size === 0
                                          }
                                        >
                                          Save
                                        </LoadingButton>
                                      </Box>
                                    )}
                                </Box>
                              ) : editCollection ===
                                collection.collectionName ? (
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
                                      collection.collectionName,
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
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        if (
                                          newEditCollection.trim() &&
                                          collection.collectionName !==
                                            newEditCollection
                                        ) {
                                          saveEditCollection(newEditCollection);
                                        }
                                      }
                                      if (e.key === "Escape") {
                                        setEditCollection(null);
                                        setNewEditCollection("");
                                      }
                                    }}
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
                            </Box>
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
                                    borderRadius: "18px",
                                    userSelect: "none",
                                  }}
                                >
                                  {propertyValue[collectionIndex].nodes.length >
                                  0 ? (
                                    propertyValue[collectionIndex].nodes.map(
                                      (link: ILinkNode, index: number) => (
                                        <Draggable
                                          key={link.randomId || link.id}
                                          draggableId={link.id}
                                          index={index}
                                        >
                                          {(provided) => (
                                            <LinkNode
                                              provided={provided}
                                              navigateToNode={navigateToNode}
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
                                              title={getTitle(nodes, link.id)}
                                              nodes={nodes}
                                              linkIndex={index}
                                              /* unlinkVisible={unlinkVisible(
                                                link.id,
                                              )} */
                                              linkLocked={false}
                                              locked={
                                                locked || !!currentImprovement
                                              }
                                              user={user}
                                              collectionIndex={collectionIndex}
                                              selectedDiffNode={
                                                selectedDiffNode
                                              }
                                              replaceWith={replaceWith}
                                              saveNewAndSwapIt={
                                                saveNewAndSwapIt
                                              }
                                              clonedNodesQueue={
                                                clonedNodesQueue
                                              }
                                              unlinkElement={unlinkElement}
                                              selectedProperty={
                                                selectedProperty
                                              }
                                              glowIds={glowIds}
                                              skillsFuture={skillsFuture}
                                            />
                                          )}
                                        </Draggable>
                                      ),
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

                          {handleCloseAddLinksModel &&
                            selectedProperty === property &&
                            !!selectedProperty &&
                            selectedCollection ===
                              collection.collectionName && (
                              <SelectModelModal
                                onSave={onSave}
                                currentVisibleNode={currentVisibleNode}
                                nodes={nodes}
                                handleCloseAddLinksModel={
                                  handleCloseAddLinksModel
                                }
                                selectedProperty={selectedProperty}
                                setSearchValue={setSearchValue}
                                searchValue={searchValue}
                                searchResultsForSelection={
                                  searchResultsForSelection
                                }
                                checkedItems={checkedItems}
                                setCheckedItems={setCheckedItems}
                                setCheckedItemsCopy={setCheckedItemsCopy}
                                checkedItemsCopy={checkedItemsCopy}
                                handleCloning={handleCloning}
                                user={user}
                                selectFromTree={selectFromTree}
                                expandedNodes={expandedNodes}
                                setExpandedNodes={setExpandedNodes}
                                handleToggle={handleToggle}
                                getPath={getPath}
                                handleSaveLinkChanges={handleSaveLinkChanges}
                                checkDuplicateTitle={checkDuplicateTitle}
                                cloning={cloning}
                                setClonedNodesQueue={setClonedNodesQueue}
                                newOnes={newOnes}
                                setNewOnes={setNewOnes}
                                editableProperty={editableProperty}
                                onGetPropertyValue={onGetPropertyValue}
                                setRemovedElements={setRemovedElements}
                                setAddedElements={setAddedElements}
                                clonedNodesQueue={clonedNodesQueue}
                                isSaving={isSaving}
                                scrollToElement={scrollToElement}
                                addACloneNodeQueue={addACloneNodeQueue}
                                removedElements={removedElements}
                                addedElements={addedElements}
                                setCurrentVisibleNode={setCurrentVisibleNode}
                                setEditableProperty={setEditableProperty}
                                locked={locked}
                                selectedDiffNode={selectedDiffNode}
                                confirmIt={confirmIt}
                                currentImprovement={currentImprovement}
                                selectedCollection={selectedCollection}
                              />
                            )}
                          {property === "specializations" &&
                            selectedProperty !== property && (
                              <Button
                                onClick={() =>
                                  editStructuredProperty(
                                    property,
                                    collection.collectionName,
                                  )
                                }
                                sx={{
                                  borderRadius: "18px",
                                  backgroundColor: BUTTON_COLOR,
                                  ":hover": {
                                    backgroundColor:
                                      theme.palette.mode === "light"
                                        ? "#f0f0f0"
                                        : "",
                                  },
                                  // ml: "auto",
                                }}
                                fullWidth
                                variant="outlined"
                              >
                                <AddIcon />{" "}
                                {`Add ${capitalizeFirstLetter(
                                  DISPLAY[property] || property,
                                )}`}{" "}
                              </Button>
                            )}
                        </Paper>
                      )}
                    </Draggable>
                  );
                },
              )}
              {provided.placeholder}
            </Box>
          )}
        </Droppable>
      </DragDropContext>
    </Box>
  );
};

export default CollectionStructure;
