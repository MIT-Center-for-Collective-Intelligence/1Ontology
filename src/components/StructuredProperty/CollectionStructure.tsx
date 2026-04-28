import { DISPLAY } from "@components/lib/CONSTANTS";
import { DESIGN_SYSTEM_COLORS } from "@components/lib/theme/colors";
import {
  capitalizeFirstLetter,
  getTitle,
} from "@components/lib/utils/string.utils";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SubdirectoryArrowRightIcon from "@mui/icons-material/SubdirectoryArrowRight";
import { ICollection, ILinkNode, INode } from "@components/types/INode";
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
import theme from "quill/core/theme";
import React, { useCallback, useRef, useState } from "react";
import AddIcon from "@mui/icons-material/Add";

import NewCollection from "../Collection/NewCollection";
import LinkNode from "../LinkNode/LinkNode";
import { useAuth } from "../context/AuthContext";
import {
  recordLogs,
  saveNewChangeLog,
  updateInheritance,
  unlinkPropertyOf,
  updateLinksForInheritance,
} from "@components/lib/utils/helpers";
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  updateDoc,
} from "firebase/firestore";
import { NODES } from "@components/lib/firestoreClient/collections";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  type CollisionDetection,
  type DragStartEvent,
  type DragMoveEvent,
  type DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import StructuredPropertySelector from "./StructuredPropertySelector";
import { reorderChildInTree, reorderCollectionInTree, moveNodeInTree } from "@components/lib/utils/instantTreeUpdate";

interface LoadMoreNode extends ILinkNode {
  id: string;
  isLoadMore: boolean;
  displayText: string;
  parentCollection: string;
}


const NodeDraggableWrapper = ({
  id,
  collectionIndex,
  index,
  disabled,
  nodeItemRefs,
  children,
}: {
  id: string;
  collectionIndex: number;
  index: number;
  disabled: boolean;
  nodeItemRefs: React.MutableRefObject<Map<string, HTMLElement>>;
  children: (props: { isDragging: boolean }) => React.ReactNode;
}) => {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id,
    data: { type: "LINK", collectionIndex, index },
    disabled,
  });

  const { setNodeRef: setDropRef } = useDroppable({
    id,
    data: { type: "LINK_TARGET", collectionIndex, index },
  });

  const combinedRef = (el: HTMLElement | null) => {
    setDragRef(el);
    setDropRef(el);
    if (el) nodeItemRefs.current.set(id, el);
    else nodeItemRefs.current.delete(id);
  };

  return (
    <Box
      ref={combinedRef}
      {...attributes}
      {...listeners}
      sx={{
        touchAction: "none",
        cursor: disabled ? "default" : isDragging ? "grabbing" : "grab",
      }}
    >
      {children({ isDragging }) as React.ReactNode}
    </Box>
  );
};

const EmptyCollectionDropZone = ({
  id,
  collectionName,
}: {
  id: string;
  collectionName: string;
}) => {
  const { setNodeRef } = useDroppable({ id });
  return (
    <Typography
      ref={setNodeRef as any}
      variant="body2"
      sx={{ p: 2, color: "text.secondary", textAlign: "center" }}
    >
      {collectionName === "main" ? "" : "No items"}
    </Typography>
  );
};

// Use pointer position to find which node is being hovered over.
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const nodeHit = hits.find(
    ({ data }) => data?.droppableContainer?.data?.current?.type === "LINK_TARGET",
  );
  if (nodeHit) return [nodeHit];
  return hits;
};

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
  loadingIds,
  setLoadingIds,
  saveNewSpecialization,
  editableProperty,
  onGetPropertyValue,
  setRemovedElements,
  setAddedElements,
  skillsFuture,
  enableEdit,
  handleLoadMore,
  loadingStates = new Set(),
  skillsFutureApp,
  unlinkNodeRelation,
  linkNodeRelation,
  fetchNode,
  onInstantTreeUpdate,
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
  loadingIds: any;
  setLoadingIds: any;
  saveNewSpecialization: any;
  editableProperty: any;
  onGetPropertyValue: any;
  setRemovedElements: any;
  setAddedElements: any;
  skillsFuture: boolean;
  enableEdit: boolean;
  handleLoadMore?: (loadMoreNodeId: string, collectionName: string) => void;
  loadingStates?: Set<string>;
  skillsFutureApp: string;
  unlinkNodeRelation: any;
  linkNodeRelation: any;
  fetchNode: (nodeId: string) => Promise<INode | null>;
  onInstantTreeUpdate?: (updateFn: (treeData: any[]) => any[]) => void;
}) => {
  const db = getFirestore();
  const [{ user }] = useAuth();

  const [editCollection, setEditCollection] = useState<string | null>(null);
  const [newEditCollection, setNewEditCollection] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggingNodeTitle, setDraggingNodeTitle] = useState<string>("");
  const nestTargetId = useRef<string | null>(null);
  const nodeItemRefs = useRef<Map<string, HTMLElement>>(new Map());
  const nestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    nodeId: string;
    position: "above" | "nest" | "below";
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const canNest = property === "specializations" && enableEdit;

  const theme = useTheme();
  const BUTTON_COLOR = theme.palette.mode === "dark" ? "#373739" : "#dde2ea";

  const isLoadMoreNode = (node: ILinkNode): node is LoadMoreNode => {
    return "isLoadMore" in node && (node as LoadMoreNode).isLoadMore === true;
  };

  const LoadMoreButton = ({
    loadMoreNode,
    isLoading,
    onLoadMore,
  }: {
    loadMoreNode: LoadMoreNode;
    isLoading: boolean;
    onLoadMore: () => void;
  }) => {
    return (
      <Tooltip
        title={loadMoreNode.displayText}
        arrow
        placement="top"
        PopperProps={{
          sx: {
            "& .MuiTooltip-tooltip": {
              backgroundColor: (theme) =>
                theme.palette.mode === "dark" ? "#424242" : "#616161",
              color: "#fff",
              fontSize: "0.875rem",
              fontWeight: 500,
              borderRadius: "8px",
              padding: "8px 12px",
              boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
            },
            "& .MuiTooltip-arrow": {
              color: (theme) =>
                theme.palette.mode === "dark" ? "#424242" : "#616161",
            },
          },
        }}
      >
        <Box
          onClick={() => !isLoading && onLoadMore()}
          sx={{
            cursor: isLoading ? "default" : "pointer",
            transition: "all 0.2s ease-in-out",
            padding: "8px 16px",
            display: "flex",
            alignItems: "flex-start",
            borderRadius: "18px",
            "&:hover": {
              backgroundColor: isLoading
                ? "transparent"
                : "rgba(255, 165, 0, 0.12)",
            },
            "&:active": {
              backgroundColor: isLoading
                ? "transparent"
                : "rgba(255, 165, 0, 0.15)",
            },
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              color: isLoading
                ? "rgba(255, 165, 0, 0.5)"
                : "rgba(255, 165, 0, 0.8)",
              fontSize: "18px",
              fontWeight: "bold",
              transition: "all 0.2s ease-in-out",
              "&:hover": {
                color: isLoading ? "rgba(255, 165, 0, 0.5)" : "#ff8c00",
                transform: isLoading ? "none" : "scale(1.02)",
              },
            }}
          >
            {isLoading ? (
              <Box
                sx={{
                  width: "16px",
                  height: "16px",
                  border: "2px solid rgba(255, 165, 0, 0.3)",
                  borderTop: "2px solid rgba(255, 165, 0, 0.8)",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                  marginRight: "8px",
                  "@keyframes spin": {
                    "0%": { transform: "rotate(0deg)" },
                    "100%": { transform: "rotate(360deg)" },
                  },
                }}
              />
            ) : (
              <>•••</>
            )}
          </Box>
        </Box>
      </Tooltip>
    );
  };

  const handleCollectionSorting = useCallback(
    async (sourceIndex: number, destinationIndex: number) => {
      try {
        if (sourceIndex === destinationIndex) return;

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
            if (property === "specializations" && onInstantTreeUpdate) {
              const fromCollectionName = propertyValue[sourceIndex]?.collectionName;
              const toCollectionName = propertyValue[destinationIndex]?.collectionName;

              onInstantTreeUpdate((tree) => {
                const updatedTree = reorderCollectionInTree(
                  tree,
                  currentVisibleNode.id,
                  sourceIndex,
                  destinationIndex,
                  fromCollectionName,
                  toCollectionName,
                  newArray
                );
                return updatedTree;
              });
            }

            updateDoc(nodeRef, {
              [property]: newArray,
            });
          } else {
            if (nodeData.inheritance) {
              nodeData.inheritance[property].ref = null;
              nodeData.inheritance[property].title = "";
            }
            updateDoc(nodeRef, {
              [`properties.${property}`]: newArray,
              [`inheritance.${property}.ref`]: null,
              [`inheritance.${property}.title`]: "",
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
      draggableId: string,
      sourceCollectionIndex: number,
      destinationCollectionIndex: number,
      destinationIndex: number,
      property: string,
      propertyValue: ICollection[],
    ) => {
      try {
        if (!user?.uname) return;

        setEditableProperty((prev: ICollection[]) => {
          if (prev.length > 0) {
            const nodeIdx = prev[sourceCollectionIndex].nodes.findIndex(
              (link: ILinkNode) => link.id === draggableId,
            );
            if (nodeIdx === -1) return prev;
            const moveValue = prev[sourceCollectionIndex].nodes[nodeIdx];
            prev[sourceCollectionIndex].nodes.splice(nodeIdx, 1);
            const adjustedDest =
              sourceCollectionIndex === destinationCollectionIndex &&
              nodeIdx < destinationIndex
                ? destinationIndex - 1
                : destinationIndex;
            prev[destinationCollectionIndex].nodes.splice(
              adjustedDest,
              0,
              moveValue,
            );
          }
          return prev;
        });
        setModifiedOrder(true);

        if (propertyValue) {
          const previousValue = JSON.parse(JSON.stringify(propertyValue));

          const nodeIdx = propertyValue[sourceCollectionIndex].nodes.findIndex(
            (link: ILinkNode) => link.id === draggableId,
          );

          if (nodeIdx !== -1) {
            const moveValue =
              propertyValue[sourceCollectionIndex].nodes[nodeIdx];
            propertyValue[sourceCollectionIndex].nodes.splice(nodeIdx, 1);
            const adjustedDest =
              sourceCollectionIndex === destinationCollectionIndex &&
              nodeIdx < destinationIndex
                ? destinationIndex - 1
                : destinationIndex;
            propertyValue[destinationCollectionIndex].nodes.splice(
              adjustedDest,
              0,
              moveValue,
            );
          }

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
              [`inheritance.${property}.title`]: "",
            });
            updateInheritance({
              nodeId: currentVisibleNode?.id,
              updatedProperties: [property],
              db,
            });
          }

          saveNewChangeLog(db, {
            nodeId: currentVisibleNode?.id,
            modifiedBy: user?.uname || "",
            modifiedProperty: property,
            previousValue,
            newValue: propertyValue,
            modifiedAt: new Date(),
            changeType: "sort elements",
            changeDetails: {
              draggableNodeId: draggableId,
              sourceCollectionIndex,
              destinationCollectionIndex,
              destinationIndex,
            },
            fullNode: currentVisibleNode,
            skillsFuture,
            ...(skillsFutureApp ? { appName: skillsFutureApp } : {}),
          });

          if (property === "specializations" && onInstantTreeUpdate) {

            // Get collection names from propertyValue array
            const fromCollectionName = propertyValue[sourceCollectionIndex]?.collectionName;
            const toCollectionName = propertyValue[destinationCollectionIndex]?.collectionName;

            onInstantTreeUpdate((tree) => {
              return reorderChildInTree(
                tree,
                currentVisibleNode.id,
                draggableId,
                sourceCollectionIndex,
                destinationCollectionIndex,
                nodeIdx,
                destinationIndex,
                fromCollectionName,
                toCollectionName
              );
            });
          }

          // Queue tree update after sorting elements
          if (currentVisibleNode?.id) {
            // Instant update: Reorder children in tree to reflect collection changes
            if (onInstantTreeUpdate) {
              // onInstantTreeUpdate((tree) => {
              //   // Helper to find and update the current node's children in the tree
              //   const updateTreeNode = (nodes: any[]): any[] => {
              //     return nodes.map((node) => {
              //       // Find the current visible node in the tree
              //       if (node.nodeId === currentVisibleNode.id) {
              //         if (!node.children) return node;
              //         // Get source and destination collection names
              //         const sourceCollName =
              //           propertyValue[sourceCollectionIndex]?.collectionName;
              //         const destCollName =
              //           propertyValue[destinationCollectionIndex]
              //             ?.collectionName;
              //         if (!sourceCollName || !destCollName) return node;
              //         // Case 1: Same collection - just reorder
              //         if (
              //           sourceCollectionIndex === destinationCollectionIndex
              //         ) {
              //           // Find the collection in the tree
              //           if (sourceCollName === "main") {
              //             // Main collection children are direct children
              //             const childIndex = node.children.findIndex(
              //               (c: any) => c.nodeId === draggableId,
              //             );
              //             if (childIndex !== -1) {
              //               const newChildren = [...node.children];
              //               const [movedChild] = newChildren.splice(
              //                 childIndex,
              //                 1,
              //               );
              //               newChildren.splice(
              //                 destination.index,
              //                 0,
              //                 movedChild,
              //               );
              //               return { ...node, children: newChildren };
              //             }
              //           } else {
              //             // Find collection node like "[collectionName]"
              //             const collectionNode = node.children.find(
              //               (c: any) => c.name === `[${sourceCollName}]`,
              //             );
              //             if (collectionNode && collectionNode.children) {
              //               const childIndex =
              //                 collectionNode.children.findIndex(
              //                   (c: any) => c.nodeId === draggableId,
              //                 );
              //               if (childIndex !== -1) {
              //                 const newCollChildren = [
              //                   ...collectionNode.children,
              //                 ];
              //                 const [movedChild] = newCollChildren.splice(
              //                   childIndex,
              //                   1,
              //                 );
              //                 newCollChildren.splice(
              //                   destination.index,
              //                   0,
              //                   movedChild,
              //                 );
              //                 const updatedCollNode = {
              //                   ...collectionNode,
              //                   children: newCollChildren,
              //                 };
              //                 const newChildren = node.children.map((c: any) =>
              //                   c.name === `[${sourceCollName}]`
              //                     ? updatedCollNode
              //                     : c,
              //                 );
              //                 return { ...node, children: newChildren };
              //               }
              //             }
              //           }
              //         } else {
              //           // Case 2: Different collections - move between them
              //           let movedChild: any = null;
              //           let newChildren = [...node.children];
              //           // Remove from source
              //           if (sourceCollName === "main") {
              //             const childIndex = newChildren.findIndex(
              //               (c: any) => c.nodeId === draggableId,
              //             );
              //             if (childIndex !== -1) {
              //               [movedChild] = newChildren.splice(childIndex, 1);
              //             }
              //           } else {
              //             const sourceCollNode = newChildren.find(
              //               (c: any) => c.name === `[${sourceCollName}]`,
              //             );
              //             if (sourceCollNode && sourceCollNode.children) {
              //               const childIndex =
              //                 sourceCollNode.children.findIndex(
              //                   (c: any) => c.nodeId === draggableId,
              //                 );
              //               if (childIndex !== -1) {
              //                 [movedChild] = sourceCollNode.children.splice(
              //                   childIndex,
              //                   1,
              //                 );
              //                 newChildren = newChildren.map((c: any) =>
              //                   c.name === `[${sourceCollName}]`
              //                     ? { ...sourceCollNode }
              //                     : c,
              //                 );
              //               }
              //             }
              //           }
              //           // Add to destination
              //           if (movedChild) {
              //             if (destCollName === "main") {
              //               newChildren.splice(
              //                 destination.index,
              //                 0,
              //                 movedChild,
              //               );
              //             } else {
              //               let destCollNode = newChildren.find(
              //                 (c: any) => c.name === `[${destCollName}]`,
              //               );
              //               if (!destCollNode) {
              //                 // Create collection node if it doesn't exist
              //                 destCollNode = {
              //                   id: `${node.id}-${destCollName}`,
              //                   nodeId: node.nodeId,
              //                   name: `[${destCollName}]`,
              //                   category: true,
              //                   children: [],
              //                 };
              //                 newChildren.push(destCollNode);
              //               }
              //               const destChildren = [
              //                 ...(destCollNode.children || []),
              //               ];
              //               destChildren.splice(
              //                 destination.index,
              //                 0,
              //                 movedChild,
              //               );
              //               newChildren = newChildren.map((c: any) =>
              //                 c.name === `[${destCollName}]`
              //                   ? { ...c, children: destChildren }
              //                   : c,
              //               );
              //             }
              //           }
              //           return { ...node, children: newChildren };
              //         }
              //       }
              //       // Recursively process children
              //       if (node.children) {
              //         return {
              //           ...node,
              //           children: updateTreeNode(node.children),
              //         };
              //       }
              //       return node;
              //     });
              //   };
              //   const updatedTree = updateTreeNode(tree);
              //     "[INSTANT UPDATE] Reordered children in tree after collection sorting",
              //   );
              //   return updatedTree;
              // });
            }

          }

          // Record a log of the sorting action
          recordLogs({
            action: "sort elements",
            field: property,
            sourceCategory: sourceCollectionIndex,
            destinationCategory: destinationCollectionIndex,
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

  const handleSpecializationLink = useCallback(
    async (
      nodeBId: string,
      nodeAId: string,
      sourceCollectionIndex: number,
    ) => {
      try {
        if (!user?.uname) return;

        if (nodeBId === nodeAId) return;

        const nodeAData = nodes[nodeAId];
        const nodeBData = nodes[nodeBId];
        if (!nodeAData || !nodeBData) return;

        // Check if is already a specialization
        const alreadyLinked = nodeAData.specializations
          .flatMap((c: ICollection) => c.nodes)
          .some((n: { id: string }) => n.id === nodeBId);
        if (alreadyLinked) {
          setSnackbarMessage(
            `"${getTitle(nodes, nodeBId)}" is already a specialization of "${getTitle(nodes, nodeAId)}"`,
          );
          return;
        }

        const currentNodeId = currentVisibleNode.id;

        // Remove nodeBId from currentVisibleNode's specializations
        await unlinkPropertyOf(db, "generalizations", nodeBId, currentNodeId);

        setSnackbarMessage(
          `"${getTitle(nodes, nodeBId)}" has been moved under "${getTitle(nodes, nodeAId)}"`,
        );

        // Update nodeB's generalizations: remove currentNodeId, add nodeAId
        const nodeBGeneralizations: ICollection[] = JSON.parse(
          JSON.stringify(nodeBData.generalizations),
        );
        for (const col of nodeBGeneralizations) {
          col.nodes = col.nodes.filter(
            (n: { id: string }) => n.id !== currentNodeId,
          );
        }
        nodeBGeneralizations[0].nodes.push({
          id: nodeAId,
          title: getTitle(nodes, nodeAId) ?? "",
        });
        await updateDoc(doc(collection(db, NODES), nodeBId), {
          generalizations: nodeBGeneralizations,
        });

        // Add nodeBId to nodeA's specializations in main collection
        const nodeASpecs: ICollection[] = JSON.parse(
          JSON.stringify(nodeAData.specializations),
        );
        const mainIdx = nodeASpecs.findIndex(
          (c) => c.collectionName === "main",
        );
        nodeASpecs[mainIdx !== -1 ? mainIdx : 0].nodes.push({
          id: nodeBId,
          title: getTitle(nodes, nodeBId) ?? "",
        });
        await updateDoc(doc(collection(db, NODES), nodeAId), {
          specializations: nodeASpecs,
        });

        // Remove nodeBId from the visible list
        setEditableProperty((prev: ICollection[]) => {
          const next: ICollection[] = JSON.parse(JSON.stringify(prev));
          if (next[sourceCollectionIndex]) {
            next[sourceCollectionIndex].nodes = next[
              sourceCollectionIndex
            ].nodes.filter((n: ILinkNode) => n.id !== nodeBId);
          }
          return next;
        });

        saveNewChangeLog(db, {
          nodeId: currentNodeId,
          modifiedBy: user.uname,
          modifiedProperty: "specializations",
          previousValue: propertyValue,
          newValue: null,
          modifiedAt: new Date(),
          changeType: "modify elements",
          changeDetails: {
            action: "nest-specialization",
            movedNode: nodeBId,
            newParent: nodeAId,
          },
          fullNode: currentVisibleNode,
          skillsFuture,
          ...(skillsFutureApp ? { appName: skillsFutureApp } : {}),
        });
        saveNewChangeLog(db, {
          nodeId: nodeBId,
          modifiedBy: user.uname,
          modifiedProperty: "generalizations",
          previousValue: nodeBData.generalizations,
          newValue: nodeBGeneralizations,
          modifiedAt: new Date(),
          changeType: "modify elements",
          changeDetails: {
            action: "nest-specialization",
            removedParent: currentNodeId,
            newParent: nodeAId,
          },
          fullNode: nodeBData,
          skillsFuture,
          ...(skillsFutureApp ? { appName: skillsFutureApp } : {}),
        });

        // Instant tree update: move nodeBId from currentNode's subtree to nodeA's subtree
        if (onInstantTreeUpdate) {
          onInstantTreeUpdate((tree) =>
            moveNodeInTree(tree, nodeBId, currentNodeId, nodeAId, 0),
          );
        }

        // Inheritance update
        await updateLinksForInheritance(
          db,
          nodeBId,
          [{ id: nodeAId }],
          nodeBGeneralizations[0].nodes,
          nodeBData,
          nodes,
        );
      } catch (error: any) {
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
    [
      currentVisibleNode,
      db,
      nodes,
      user,
      propertyValue,
      skillsFuture,
      skillsFutureApp,
      setEditableProperty,
      onInstantTreeUpdate,
    ],
  );

  const addCollection = useCallback(
    async (newCollection: string) => {
      try {
        if (
          newCollection.toLowerCase() === "main" ||
          newCollection.toLowerCase() === "default" ||
          !newCollection ||
          !user?.uname
        ) {
          return;
        }

        setOpenAddCollection(false);

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
          confirmIt(`This collection already exists!`, "Ok", "");
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
        debugger;
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
          ...(skillsFutureApp ? { appName: skillsFutureApp } : {}),
        });

        // Queue tree update after adding collection
        if (currentVisibleNode?.id && newCollection) {
          // Instant update: Add new collection node to tree
          if (onInstantTreeUpdate) {
            onInstantTreeUpdate((tree) => {
              const updateTreeNode = (nodes: any[]): any[] => {
                return nodes.map((node) => {
                  if (node.nodeId === currentVisibleNode.id) {
                    // Check if collection already exists
                    const collectionExists = node.children?.some(
                      (child: any) => child.name === `[${newCollection}]` && child.category
                    );

                    if (collectionExists) {
                      return node;
                    }

                    // Add new collection node (empty) to children
                    const newCollectionNode = {
                      id: `${node.id}-${newCollection}`,
                      nodeId: node.nodeId,
                      name: `[${newCollection}]`,
                      category: true,
                      children: [],
                    };
                    const newChildren = [
                      newCollectionNode,
                      ...(node.children || []),
                    ];
                    return { ...node, children: newChildren };
                  }
                  if (node.children) {
                    return { ...node, children: updateTreeNode(node.children) };
                  }
                  return node;
                });
              };
              const updatedTree = updateTreeNode(tree);
              return updatedTree;
            });
          }

        }
      } catch (error: any) {
        console.error({
          type: "error",
          error: JSON.stringify({
            name: error.name,
            message: error.message,
            stack: error.stack,
          }),
          at: "addCollection",
        });
        // recordLogs({
        //   type: "error",
        //   error: JSON.stringify({
        //     name: error.name,
        //     message: error.message,
        //     stack: error.stack,
        //   }),
        //   at: "addCollection",
        // });
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
        // scrollToElement(partId);
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
          ...(skillsFutureApp ? { appName: skillsFutureApp } : {}),
        });

        // Queue tree update after editing collection name
        if (currentVisibleNode?.id) {
          // Instant update: Rename collection node in tree
          if (onInstantTreeUpdate && editCollection && newCollection) {
            onInstantTreeUpdate((tree) => {
              const updateTreeNode = (nodes: any[]): any[] => {
                return nodes.map((node) => {
                  if (node.nodeId === currentVisibleNode.id && node.children) {
                    // Find and rename the collection node
                    const newChildren = node.children.map((child: any) => {
                      if (child.name === `[${editCollection}]`) {
                        return {
                          ...child,
                          name: `[${newCollection}]`,
                          id: child.id.replace(
                            `-${editCollection}`,
                            `-${newCollection}`,
                          ),
                        };
                      }
                      return child;
                    });
                    return { ...node, children: newChildren };
                  }
                  if (node.children) {
                    return { ...node, children: updateTreeNode(node.children) };
                  }
                  return node;
                });
              };
              const updatedTree = updateTreeNode(tree);
              return updatedTree;
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
          <Box sx={{ display: "flex" }}>
            <Typography>
              Are you sure you want to delete the collection:
            </Typography>
            <Typography sx={{ color: "orange", fontWeight: "bold", mx: "3px" }}>
              {`"`}
              {collectionName}
              {`"`}
            </Typography>
            ?
          </Box>,
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
              ...(skillsFutureApp ? { appName: skillsFutureApp } : {}),
            });

            // Queue tree update after deleting collection
            if (currentVisibleNode?.id) {
              // Instant update: Remove collection node and merge children to main
              if (onInstantTreeUpdate && collectionName) {
                onInstantTreeUpdate((tree) => {
                  const updateTreeNode = (nodes: any[]): any[] => {
                    return nodes.map((node) => {
                      if (
                        node.nodeId === currentVisibleNode.id &&
                        node.children
                      ) {
                        // Find the collection node being deleted
                        const deletedCollNode = node.children.find(
                          (c: any) => c.name === `[${collectionName}]`,
                        );
                        if (deletedCollNode) {
                          // Remove the collection node and move its children to main (direct children)
                          const childrenToMove = deletedCollNode.children || [];
                          const newChildren = node.children
                            .filter(
                              (c: any) => c.name !== `[${collectionName}]`,
                            )
                            .concat(childrenToMove);
                          return { ...node, children: newChildren };
                        }
                      }
                      if (node.children) {
                        return {
                          ...node,
                          children: updateTreeNode(node.children),
                        };
                      }
                      return node;
                    });
                  };
                  const updatedTree = updateTreeNode(tree);
                  return updatedTree;
                });
              }

            }
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

  const handleNodeDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      setActiveId(active.id as string);
      setDraggingNodeTitle(
        getTitle(nodes, active.id as string) || (active.id as string),
      );
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
    },
    [nodes],
  );

  const handleNodeDragMove = useCallback(
    (event: DragMoveEvent) => {
      if (event.active.data.current?.type !== "LINK") return;
      const { over, activatorEvent, delta } = event;

      if (
        !over ||
        over.id === event.active.id ||
        String(over.id).startsWith("empty-coll-")
      ) {
        if (nestTimerRef.current) {
          clearTimeout(nestTimerRef.current);
          nestTimerRef.current = null;
        }
        setDropIndicator(null);
        nestTargetId.current = null;
        return;
      }

      const overId = over.id as string;
      const el = nodeItemRefs.current.get(overId);
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const pointerY = (activatorEvent as PointerEvent).clientY + delta.y;
      const relY = (pointerY - rect.top) / rect.height;
      const rawPosition =
        relY < 0.25 ? "above" : relY > 0.75 ? "below" : "nest";

      if (rawPosition === "nest" && canNest) {
        if (nestTimerRef.current) clearTimeout(nestTimerRef.current);
        nestTimerRef.current = setTimeout(() => {
          setDropIndicator({ nodeId: overId, position: "nest" });
          nestTargetId.current = overId;
        }, 80);
      } else {
        if (nestTimerRef.current) {
          clearTimeout(nestTimerRef.current);
          nestTimerRef.current = null;
        }
        setDropIndicator({
          nodeId: overId,
          position: rawPosition === "nest" ? "above" : rawPosition,
        });
        nestTargetId.current = null;
      }
    },
    [canNest],
  );

  const handleNodeDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const currentDropIndicator = dropIndicator;
      if (nestTimerRef.current) {
        clearTimeout(nestTimerRef.current);
        nestTimerRef.current = null;
      }
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setActiveId(null);
      setDraggingNodeTitle("");
      setDropIndicator(null);
      const nestTarget = nestTargetId.current;
      nestTargetId.current = null;

      if (locked || !!selectedDiffNode || !!currentImprovement) return;

      const activeData = active.data.current;

      if (activeData?.type === "LINK") {
        if (nestTarget && property === "specializations" && enableEdit) {
          handleSpecializationLink(
            active.id as string,
            nestTarget,
            activeData.collectionIndex,
          );
        } else if (
          currentDropIndicator &&
          currentDropIndicator.position !== "nest"
        ) {
          let destCollIdx = -1;
          let destItemIdx = -1;
          (propertyValue || []).forEach((col: ICollection, cIdx: number) => {
            const nIdx = col.nodes.findIndex(
              (n: ILinkNode) => n.id === currentDropIndicator.nodeId,
            );
            if (nIdx !== -1) {
              destCollIdx = cIdx;
              destItemIdx =
                currentDropIndicator.position === "above" ? nIdx : nIdx + 1;
            }
          });
          if (destCollIdx !== -1) {
            handleSorting(
              active.id as string,
              activeData.collectionIndex,
              destCollIdx,
              destItemIdx,
              property,
              propertyValue,
            );
          }
        } else if (over && String(over.id).startsWith("empty-coll-")) {
          const destCollIdx = parseInt(
            (over.id as string).replace("empty-coll-", ""),
          );
          if (!isNaN(destCollIdx)) {
            handleSorting(
              active.id as string,
              activeData.collectionIndex,
              destCollIdx,
              0,
              property,
              propertyValue,
            );
          }
        }
      }
    },
    [
      dropIndicator,
      locked,
      selectedDiffNode,
      currentImprovement,
      property,
      enableEdit,
      handleSpecializationLink,
      handleSorting,
      propertyValue,
    ],
  );

  return (
    <Box
      sx={{
        p: "12px",
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
        onDragEnd={(result: DropResult) => {
          if (!result.destination || result.source.index === result.destination.index) return;
          if (result.type === "COLLECTION") {
            handleCollectionSorting(result.source.index, result.destination.index);
          }
        }}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleNodeDragStart}
          onDragMove={handleNodeDragMove}
          onDragEnd={handleNodeDragEnd}
        >
          <Droppable droppableId="collections" type="COLLECTION">
            {(provided) => (
              <Box ref={provided.innerRef} {...provided.droppableProps}>
                {(propertyValue || []).map(
            (collection: ICollection, collectionIndex: number) => {
              return (
                <Draggable
                  key={collection.collectionName + collectionIndex}
                  draggableId={String(collectionIndex)}
                  index={collectionIndex}
                  isDragDisabled={
                    property !== "specializations" ||
                    !enableEdit ||
                    propertyValue.length <= 1
                  }
                >
                  {(provided) => (
                    <Paper
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      id={`${collectionIndex}`}
                      sx={{
                        display:
                          !enableEdit &&
                          collection.collectionName === "main" &&
                          collection.nodes.length === 0
                            ? "none"
                            : "block",
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
                                  {...provided.dragHandleProps}
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
                                    cursor:
                                      propertyValue.length > 1 && enableEdit
                                        ? "grab"
                                        : "default",
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
                                          display: !enableEdit
                                            ? "none"
                                            : "flex",
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
                                        <Tooltip title={"Close Editing"}>
                                          <IconButton
                                            onClick={handleCloseAddLinksModel}
                                            sx={{
                                              borderRadius: "25px",
                                              backgroundColor: "red",
                                            }}
                                          >
                                            <CloseIcon
                                              sx={{ color: "white" }}
                                            />
                                          </IconButton>
                                        </Tooltip>
                                        {/*<LoadingButton
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
                                        </LoadingButton> */}
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
                                    sx={{
                                      p: 0,
                                      "& .MuiOutlinedInput-root": {
                                        borderRadius: "25px",
                                      },
                                    }}
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
                                      sx={{
                                        ml: "5px",
                                        border:
                                          !newEditCollection ||
                                          collection.collectionName ===
                                            newEditCollection
                                            ? "1px solid gray"
                                            : "1px solid green",
                                      }}
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
                                      sx={{
                                        ml: "5px",
                                        border: "1px solid red",
                                      }}
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

                          <List sx={{ p: 1, mx: "-5px" }}>
                            <Box
                              sx={{
                                borderRadius: "18px",
                                userSelect: "none",
                              }}
                            >
                              {propertyValue[collectionIndex].nodes.length >
                                  0 ? (
                                    propertyValue[collectionIndex].nodes.map(
                                      (link: ILinkNode, index: number) => {
                                        if (isLoadMoreNode(link)) {
                                          const isLoading = loadingStates?.has(
                                            link.id,
                                          );
                                          return (
                                            <LoadMoreButton
                                              key={link.id}
                                              loadMoreNode={link}
                                              isLoading={isLoading}
                                              onLoadMore={() =>
                                                handleLoadMore?.(
                                                  link.id,
                                                  link.parentCollection,
                                                )
                                              }
                                            />
                                          );
                                        }

                                        // Parts list uses this node's
                                        // `properties.parts` only (see StructuredProperty
                                        // propertyValue); do not annotate rows from
                                        // inheritance.parts.ref.
                                        const enhancedLink = link;

                                        const nodeKey =
                                          link.randomId ||
                                          `${link.id}-${index}`;
                                        const isDropAbove =
                                          dropIndicator?.nodeId === link.id &&
                                          dropIndicator.position === "above";
                                        const isDropBelow =
                                          dropIndicator?.nodeId === link.id &&
                                          dropIndicator.position === "below";
                                        const isDropNest =
                                          dropIndicator?.nodeId === link.id &&
                                          dropIndicator.position === "nest";

                                        return (
                                          <React.Fragment key={nodeKey}>
                                            {isDropAbove && (
                                              <Box
                                                sx={{
                                                  height: "2px",
                                                  backgroundColor:
                                                    "primary.main",
                                                  borderRadius: "1px",
                                                  mx: 1,
                                                  my: "3px",
                                                  position: "relative",
                                                  "&::before": {
                                                    content: '""',
                                                    position: "absolute",
                                                    left: -5,
                                                    top: -4,
                                                    width: 10,
                                                    height: 10,
                                                    borderRadius: "50%",
                                                    backgroundColor:
                                                      "primary.main",
                                                  },
                                                }}
                                              />
                                            )}
                                          <NodeDraggableWrapper
                                            id={link.id}
                                            collectionIndex={collectionIndex}
                                            index={index}
                                            disabled={!enableEdit}
                                            nodeItemRefs={nodeItemRefs}
                                          >
                                            {({ isDragging: isNodeDragging }) => (
                                              <Box
                                                sx={{
                                                  borderRadius: "25px",
                                                  opacity: isNodeDragging ? 0.3 : 1,
                                                  transition: "background-color 0.15s",
                                                  ...(enableEdit &&
                                                    !isNodeDragging &&
                                                    !isDropNest && {
                                                      "&:hover": {
                                                        backgroundColor:
                                                          "action.hover",
                                                      },
                                                    }),
                                                  ...(isDropNest && {
                                                      outline:
                                                        "2px solid #ed6c02",
                                                      backgroundColor:
                                                        "rgba(237,108,2,0.06)",
                                                    }),
                                                }}
                                              >
                                                <LinkNode
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
                                                  link={enhancedLink}
                                                  property={property}
                                                  title={
                                                    link.title ||
                                                    getTitle(nodes, link.id)
                                                  }
                                                  relatedNodes={nodes}
                                                  fetchNode={fetchNode}
                                                  linkIndex={index}
                                                  /* unlinkVisible={unlinkVisible(
                                                    link.id,
                                                  )} */
                                                  linkLocked={false}
                                                  locked={
                                                    locked || !!currentImprovement
                                                  }
                                                  user={user}
                                                  collectionIndex={
                                                    collectionIndex
                                                  }
                                                  collectionName={
                                                    propertyValue[collectionIndex]
                                                      .collectionName
                                                  }
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
                                                  currentImprovement={
                                                    currentImprovement
                                                  }
                                                  loadingIds={loadingIds}
                                                  saveNewSpecialization={
                                                    saveNewSpecialization
                                                  }
                                                  enableEdit={enableEdit}
                                                  setClonedNodesQueue={
                                                    setClonedNodesQueue
                                                  }
                                                  skillsFutureApp={
                                                    skillsFutureApp
                                                  }
                                                  setEditableProperty={
                                                    setEditableProperty
                                                  }
                                                  unlinkNodeRelation={
                                                    unlinkNodeRelation
                                                  }
                                                  onInstantTreeUpdate={
                                                    onInstantTreeUpdate
                                                  }
                                                />
                                                {dropIndicator?.nodeId ===
                                                  link.id &&
                                                  dropIndicator.position ===
                                                    "nest" && (
                                                    <Box
                                                      sx={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        ml: 4,
                                                        mb: 1,
                                                        px: 1.5,
                                                        py: 0.5,
                                                        borderRadius: "20px",
                                                        border:
                                                          "1px dashed #ed6c02",
                                                        backgroundColor:
                                                          "rgba(237,108,2,0.04)",
                                                        width: "fit-content",
                                                      }}
                                                    >
                                                      <SubdirectoryArrowRightIcon
                                                      sx={{
                                                          fontSize: 16,
                                                          mr: 0.75,
                                                          color: "#ed6c02",
                                                        }}
                                                      />
                                                      <Typography
                                                        variant="caption"
                                                        sx={{
                                                          color: "#ed6c02",
                                                          fontWeight: 500,
                                                        }}
                                                      >
                                                        {draggingNodeTitle}
                                                      </Typography>
                                                    </Box>
                                                  )}
                                              </Box>
                                            )}
                                          </NodeDraggableWrapper>
                                            {isDropBelow && (
                                              <Box
                                                sx={{
                                                  height: "2px",
                                                  backgroundColor:
                                                    "primary.main",
                                                  borderRadius: "1px",
                                                  mx: 1,
                                                  my: "3px",
                                                  position: "relative",
                                                  "&::before": {
                                                    content: '""',
                                                    position: "absolute",
                                                    left: -5,
                                                    top: -4,
                                                    width: 10,
                                                    height: 10,
                                                    borderRadius: "50%",
                                                    backgroundColor:
                                                      "primary.main",
                                                  },
                                                }}
                                              />
                                            )}
                                          </React.Fragment>
                                        );
                                      },
                                    )
                                  ) : enableEdit && !locked ? (
                                    <EmptyCollectionDropZone
                                      id={`empty-coll-${collectionIndex}`}
                                      collectionName={collection.collectionName}
                                    />
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

                                  {/* Display inheritanceParts from the referenced generalization when inheritance.parts.ref exists */}
                                  {/* {property === "parts" &&
                                    currentVisibleNode.inheritance?.parts
                                      ?.ref &&
                                    nodes[
                                      currentVisibleNode.inheritance.parts.ref
                                    ]?.inheritanceParts &&
                                    Object.entries(
                                      nodes[
                                        currentVisibleNode.inheritance.parts.ref
                                      ].inheritanceParts,
                                    ).map(
                                      ([nodeId, inheritanceInfo], index) => {
                                        if (!inheritanceInfo) return null;

                                        const info = inheritanceInfo as {
                                          inheritedFromTitle: string;
                                          inheritedFromId: string;
                                        };

                                        return (
                                          <LinkNode
                                            key={`inherited-from-ref-${nodeId}-${index}`}
                                            provided={{}}
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
                                            link={{
                                              id: nodeId,
                                              inheritedFrom:
                                                info.inheritedFromTitle,
                                            }}
                                            property={property}
                                            title={getTitle(nodes, nodeId)}
                                            nodes={nodes}
                                            linkIndex={-1} // -1 indicates inherited part
                                            linkLocked={false}
                                            locked={
                                              locked || !!currentImprovement
                                            }
                                            user={user}
                                            collectionIndex={collectionIndex}
                                            collectionName={
                                              propertyValue[collectionIndex]
                                                .collectionName
                                            }
                                            selectedDiffNode={selectedDiffNode}
                                            replaceWith={replaceWith}
                                            saveNewAndSwapIt={saveNewAndSwapIt}
                                            clonedNodesQueue={clonedNodesQueue}
                                            unlinkElement={unlinkElement}
                                            selectedProperty={selectedProperty}
                                            glowIds={glowIds}
                                            skillsFuture={skillsFuture}
                                            currentImprovement={
                                              currentImprovement
                                            }
                                            loadingIds={loadingIds}
                                            saveNewSpecialization={
                                              saveNewSpecialization
                                            }
                                            enableEdit={enableEdit}
                                            setClonedNodesQueue={
                                              setClonedNodesQueue
                                            }
                                            partsInheritance={partsInheritance}
                                            skillsFutureApp={skillsFutureApp}
                                            setEditableProperty={
                                              setEditableProperty
                                            }
                                            unlinkNodeRelation={
                                              unlinkNodeRelation
                                            }
                                            onInstantTreeUpdate={
                                              onInstantTreeUpdate
                                            }
                                          />
                                        );
                                      },
                                    )} */}

                                  {/* Display inherited parts from inheritanceParts only if inheritance.parts.ref is null */}
                                  {/*   {property === "parts" &&
                                    !currentVisibleNode.inheritance?.parts
                                      ?.ref &&
                                    nodes[currentVisibleNode.id]
                                      ?.inheritanceParts &&
                                    Object.entries(
                                      nodes[currentVisibleNode.id]
                                        .inheritanceParts,
                                    ).map(
                                      ([nodeId, inheritanceInfo], index) => {
                                        if (!inheritanceInfo) return null;

                                        const info = inheritanceInfo as {
                                          inheritedFromTitle: string;
                                          inheritedFromId: string;
                                        };

                                        return (
                                          <LinkNode
                                            key={`inherited-${nodeId}-${index}`}
                                            provided={{}}
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
                                            link={{
                                              id: nodeId,
                                              inheritedFrom:
                                                info.inheritedFromTitle,
                                            }}
                                            property={property}
                                            title={getTitle(nodes, nodeId)}
                                            nodes={nodes}
                                            linkIndex={-1} // -1 indicates inherited part
                                            linkLocked={false}
                                            locked={
                                              locked || !!currentImprovement
                                            }
                                            user={user}
                                            collectionIndex={collectionIndex}
                                            collectionName={
                                              propertyValue[collectionIndex]
                                                .collectionName
                                            }
                                            selectedDiffNode={selectedDiffNode}
                                            replaceWith={replaceWith}
                                            saveNewAndSwapIt={saveNewAndSwapIt}
                                            clonedNodesQueue={clonedNodesQueue}
                                            unlinkElement={unlinkElement}
                                            selectedProperty={selectedProperty}
                                            glowIds={glowIds}
                                            skillsFuture={skillsFuture}
                                            currentImprovement={
                                              currentImprovement
                                            }
                                            loadingIds={loadingIds}
                                            saveNewSpecialization={
                                              saveNewSpecialization
                                            }
                                            enableEdit={enableEdit}
                                            setClonedNodesQueue={
                                              setClonedNodesQueue
                                            }
                                            partsInheritance={partsInheritance}
                                            skillsFutureApp={skillsFutureApp}
                                            setEditableProperty={
                                              setEditableProperty
                                            }
                                            unlinkNodeRelation={
                                              unlinkNodeRelation
                                            }
                                            onInstantTreeUpdate={
                                              onInstantTreeUpdate
                                            }
                                          />
                                        );
                                      },
                                    )} */}

                                </Box>
                          </List>

                          {handleCloseAddLinksModel &&
                            selectedProperty === property &&
                            !!selectedProperty &&
                            selectedCollection ===
                              collection.collectionName && (
                              <StructuredPropertySelector
                                onSave={onSave}
                                currentVisibleNode={currentVisibleNode}
                                relatedNodes={nodes}
                                fetchNode={fetchNode}
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
                                loadingIds={loadingIds}
                                setLoadingIds={setLoadingIds}
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
                                skillsFuture={skillsFuture}
                                saveNewSpecialization={saveNewSpecialization}
                                skillsFutureApp={skillsFutureApp}
                                linkNodeRelation={linkNodeRelation}
                                unlinkNodeRelation={unlinkNodeRelation}
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
                                  display: !enableEdit ? "none" : "flex",
                                }}
                                fullWidth
                                variant="outlined"
                              >
                                <AddIcon
                                  sx={{
                                    mr: "5px",
                                  }}
                                />

                                {`Add ${capitalizeFirstLetter(
                                  DISPLAY[property] || property,
                                )}`}
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
          {activeId && (
            <DragOverlay>
              <Paper sx={{ opacity: 0.9, borderRadius: "25px", p: 1.5, maxWidth: 280 }} elevation={4}>
                <Typography variant="body2">{draggingNodeTitle || activeId}</Typography>
              </Paper>
            </DragOverlay>
          )}
        </DndContext>
      </DragDropContext>
    </Box>
  );
};

export default CollectionStructure;
