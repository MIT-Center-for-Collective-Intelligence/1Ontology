import React, { useCallback, useEffect, useMemo, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import {
  Box,
  Button,
  Typography,
  Tooltip,
  Paper,
  useTheme,
  useMediaQuery,
  IconButton,
  Slide,
  CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import {
  capitalizeFirstLetter,
  getPropertyValue,
  getTitle,
  getTooltipHelper,
  lowercaseFirstLetter,
} from "@components/lib/utils/string.utils";
import {
  getGeneralizationParts,
  getAllGeneralizations,
  getEffectiveGeneralizations,
} from "@components/lib/utils/partsHelper";
import {
  ICollection,
  ILinkNode,
  InheritedPartsDetail,
  INode,
} from "@components/types/INode";
import { DISPLAY, UNCLASSIFIED } from "@components/lib/CONSTANTS";
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  updateDoc,
} from "firebase/firestore";
import EditIcon from "@mui/icons-material/Edit";
import {
  recordLogs,
  saveNewChangeLog,
  unlinkPropertyOf,
  updateInheritance,
  updatePartsAndPartsOf,
  updatePropertyOf,
} from "@components/lib/utils/helpers";
import SelectInheritance from "../SelectInheritance/SelectInheritance";
import VisualizeTheProperty from "./VisualizeTheProperty";
import CollectionStructure from "./CollectionStructure";
import PropertyContributors from "./PropertyContributors";
import { NODES } from "@components/lib/firestoreClient/collections";
import { Post } from "@components/lib/utils/Post";
import { pendingWrites } from "@components/lib/utils/pendingWrites";
import InheritedPartsLegend from "../Common/InheritedPartsLegend";
import EditProperty from "../AddPropertyForm/EditProperty";
import StructuredPropertySelector from "./StructuredPropertySelector";
import PartViewer from "./PartViewer";

const INITIAL_LOAD_COUNT = 20;
const LOAD_MORE_COUNT = 20;

interface PaginatedCollection extends ICollection {
  allNodes?: ILinkNode[];
  isLoadMore?: boolean;
  loadedCount?: number;
}

interface LoadMoreNode extends ILinkNode {
  id: string;
  isLoadMore: boolean;
  displayText: string;
  parentCollection: string;
}

type IStructuredPropertyProps = {
  currentVisibleNode: INode;
  editStructuredProperty: any;
  setSelectedProperty: any;
  navigateToNode: any;
  setSnackbarMessage: any;
  setCurrentVisibleNode: any;
  property: string;
  relatedNodes: { [id: string]: INode };
  fetchNode: (nodeId: string, force?: boolean) => Promise<INode | null>;
  addNodesToCache?: (
    nodes: { [id: string]: INode },
    parentNodeId?: string,
  ) => void;
  locked: boolean;
  selectedDiffNode: any;
  confirmIt: any;
  onGetPropertyValue: any;
  currentImprovement: any;
  cloneNode?: any;
  handleCloseAddLinksModel?: any;
  selectedProperty?: any;
  setSearchValue?: any;
  searchValue?: any;
  searchResultsForSelection?: any;
  checkedItems?: any;
  setCheckedItems?: any;
  setCheckedItemsCopy?: any;
  checkedItemsCopy?: any;
  handleCloning?: any;
  user?: any;
  selectFromTree?: any;
  expandedNodes?: any;
  setExpandedNodes?: any;
  handleToggle?: any;
  getPath?: any;
  handleSaveLinkChanges?: any;
  checkDuplicateTitle?: any;
  cloning?: any;
  addACloneNodeQueue?: any;
  setClonedNodesQueue?: any;
  clonedNodesQueue?: any;
  newOnes?: any;
  setNewOnes?: any;
  loadingIds: any;
  setLoadingIds: any;
  editableProperty?: ICollection[];
  setEditableProperty?: any;
  removedElements: any;
  setRemovedElements: any;
  addedElements: any;
  setAddedElements: any;
  glowIds: Set<string>;
  setGlowIds: any;
  selectedCollection: any;
  appName?: string;
  partsInheritance?: {
    [nodeId: string]: { inheritedFrom: string; partInheritance: string };
  };
  enableEdit: boolean;
  inheritanceDetails?: any;
  inheritedPartsDetails?: InheritedPartsDetail[] | null;
  deleteProperty?: Function;
  modifyProperty?: Function;
  onInstantTreeUpdate?: (updateFn: (treeData: any[]) => any[]) => void;
};

const StructuredProperty = ({
  currentVisibleNode,
  editStructuredProperty,
  navigateToNode,
  setSnackbarMessage,
  setCurrentVisibleNode,
  property,
  relatedNodes,
  fetchNode,
  addNodesToCache,
  locked,
  selectedDiffNode,
  confirmIt,
  onGetPropertyValue,
  currentImprovement,
  cloneNode,
  handleCloseAddLinksModel,
  selectedProperty,
  setSearchValue,
  searchValue,
  searchResultsForSelection,
  checkedItems,
  setCheckedItems,
  setCheckedItemsCopy,
  checkedItemsCopy,
  handleCloning,
  user,
  selectFromTree,
  expandedNodes,
  setExpandedNodes,
  handleToggle,
  getPath,
  handleSaveLinkChanges,
  checkDuplicateTitle,
  cloning,
  addACloneNodeQueue,
  setClonedNodesQueue,
  clonedNodesQueue,
  newOnes,
  setNewOnes,
  loadingIds,
  setLoadingIds,
  editableProperty,
  setEditableProperty,
  removedElements,
  setRemovedElements,
  addedElements,
  setAddedElements,
  glowIds,
  setGlowIds,
  selectedCollection,
  appName,
  enableEdit,
  deleteProperty,
  modifyProperty,
  onInstantTreeUpdate,
  inheritanceDetails,
  inheritedPartsDetails,
}: IStructuredPropertyProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery("(max-width:599px)");
  const [openAddCollection, setOpenAddCollection] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const BUTTON_COLOR = theme.palette.mode === "dark" ? "#373739" : "#dde2ea";
  const [modifiedOrder, setModifiedOrder] = useState(false);
  const [displayOptional, setDisplayOptional] = useState(false);
  const [showTopOptionalLegend, setShowTopOptionalLegend] = useState(true);
  const [editProperty, setEditProperty] = useState("");
  const [newPropertyValue, setNewPropertyValue] = useState("");

  const [paginationState, setPaginationState] = useState<Map<string, number>>(
    new Map(),
  );
  const [loadingStates, setLoadingStates] = useState<Set<string>>(new Set());
  const db = getFirestore();

  const processCollectionData = useCallback(
    (collections: ICollection[]): PaginatedCollection[] => {
      if (property !== "specializations") return collections;

      return collections.map((collection) => {
        if (
          !currentVisibleNode.unclassified ||
          !collection.nodes ||
          collection.nodes.length <= INITIAL_LOAD_COUNT
        ) {
          return {
            ...collection,
            allNodes: collection.nodes ? [...collection.nodes] : [],
          };
        }

        const loadedCount =
          paginationState.get(collection.collectionName) || INITIAL_LOAD_COUNT;
        const allNodes = [...collection.nodes];
        const visibleNodes = allNodes.slice(0, loadedCount);
        const remainingCount = allNodes.length - loadedCount;

        const processedCollection: PaginatedCollection = {
          ...collection,
          nodes: [...visibleNodes],
          allNodes,
          loadedCount,
        };

        if (remainingCount > 0) {
          const loadMoreNode: LoadMoreNode = {
            id: `${collection.collectionName}-load-more`,
            isLoadMore: true,
            displayText: `Show ${Math.min(remainingCount, LOAD_MORE_COUNT)} more specializations`,
            parentCollection: collection.collectionName,
          };
          processedCollection.nodes.push(loadMoreNode);
        }

        return processedCollection;
      });
    },
    [property, currentVisibleNode.unclassified, paginationState],
  );

  const handleLoadMore = useCallback(
    (loadMoreNodeId: string, collectionName: string) => {
      setLoadingStates((prev) => new Set(prev).add(loadMoreNodeId));

      setTimeout(() => {
        const currentLoaded =
          paginationState.get(collectionName) || INITIAL_LOAD_COUNT;
        const newLoadedCount = currentLoaded + LOAD_MORE_COUNT;

        setPaginationState((prev) => {
          const newState = new Map(prev);
          newState.set(collectionName, newLoadedCount);
          return newState;
        });

        setLoadingStates((prev) => {
          const newSet = new Set(prev);
          newSet.delete(loadMoreNodeId);
          return newSet;
        });
      }, 300);
    },
    [paginationState],
  );

  const propertyValue: PaginatedCollection[] = useMemo(() => {
    try {
      let result = null;
      if (property === "specializations" || property === "generalizations") {
        result =
          currentVisibleNode[property as "specializations" | "generalizations"];
      } else {
        // Parts always reflect this node's `properties.parts` only; do not
        // substitute the collection from `inheritance.parts.ref` (the UI
        // still explains inheritance via InheritedPartsViewer / details).
        if (property === "parts") {
          result = currentVisibleNode?.properties?.parts;
        } else {
          result =
            getPropertyValue(
              relatedNodes,
              currentVisibleNode.inheritance[property]?.ref,
              property,
            ) || currentVisibleNode?.properties[property];
        }
      }

      if (!selectedDiffNode) {
        return processCollectionData(result || []);
      }
      if (
        selectedDiffNode &&
        selectedDiffNode.modifiedProperty === property &&
        (selectedDiffNode.changeType === "delete collection" ||
          selectedDiffNode.changeType === "edit collection")
      ) {
        result = selectedDiffNode.previousValue;
      }

      let finalResult: any = [];
      const listOfChanges = [];

      if (
        selectedDiffNode &&
        selectedDiffNode.modifiedProperty === property &&
        (selectedDiffNode.changeType === "sort elements" ||
          selectedDiffNode.changeType === "remove element" ||
          selectedDiffNode.changeType === "modify elements" ||
          selectedDiffNode.changeType === "add element")
      ) {
        listOfChanges.push(JSON.parse(JSON.stringify(selectedDiffNode)));
      }

      if (
        selectedDiffNode &&
        selectedDiffNode.modifiedProperty === property &&
        selectedDiffNode.changeType === "sort elements" &&
        selectedDiffNode.changeDetails
      ) {
        const { draggableNodeId, destination, source } =
          selectedDiffNode.changeDetails;

        const sourceCollectionIndex = parseInt(source.droppableId, 10);
        const destinationCollectionIndex = parseInt(
          destination?.droppableId || "0",
          10,
        );
        const previousValue = JSON.parse(
          JSON.stringify(selectedDiffNode.previousValue),
        );
        previousValue[sourceCollectionIndex].relatedNodes[source.index].change =
          "removed";
        previousValue[sourceCollectionIndex].relatedNodes[
          source.index
        ].changeType = "sort";
        previousValue[destinationCollectionIndex].nodes.splice(
          destination.index,
          0,
          {
            id: draggableNodeId,
            change: "added",
            changeType: "sort",
            randomId: doc(collection(db, NODES)).id,
            diffElementId: `${draggableNodeId}-${property}`,
          },
        );
        return processCollectionData(previousValue);
      }

      for (let improvementChange of listOfChanges || []) {
        if (improvementChange.modifiedProperty === property) {
          improvementChange.newValue.forEach(
            (collectionNewValue: ICollection, collectionIndex: number) => {
              const collectionPrevious: ICollection =
                improvementChange.previousValue[collectionIndex];

              collectionNewValue.nodes.forEach((nodeLink) => {
                const foundInPrevious = collectionPrevious.nodes.find(
                  (prevElement: ILinkNode) => prevElement.id === nodeLink.id,
                );
                if (!foundInPrevious) {
                  nodeLink.change = "added";
                  return {
                    ...nodeLink,
                    change: "added",
                    randomId: doc(collection(db, NODES)).id,
                    diffElementId: `${nodeLink.id}-${property}`,
                  };
                }
              });
              collectionPrevious.nodes.forEach((prevElement: any) => {
                const foundInNew = collectionNewValue.nodes.find(
                  (newElement: ILinkNode) => newElement.id === prevElement.id,
                );
                if (!foundInNew) {
                  collectionNewValue.nodes.push({
                    ...prevElement,
                    change: "removed",
                    randomId: doc(collection(db, NODES)).id,
                    diffElementId: `${prevElement.id}-${property}`,
                  });
                }
              });
              finalResult.push(collectionNewValue);
            },
          );
        }
      }
      if (listOfChanges.length > 0) {
        return processCollectionData([...finalResult]);
      }
      return processCollectionData(result || []);
    } catch (error) {
      console.error(error);
      return [];
    }
  }, [
    currentVisibleNode,
    relatedNodes,
    property,
    selectedDiffNode,
    processCollectionData,
    db,
  ]);

  const isReparenting =
    property === "generalizations" &&
    !(typeof currentVisibleNode?.root === "boolean" && currentVisibleNode.root) &&
    (currentVisibleNode?.generalizations || []).flatMap(
      (c: ICollection) => c.nodes,
    ).length === 0;

  const reparentRootName = useMemo(() => {
    const nt = currentVisibleNode?.nodeType;
    const root = Object.values(relatedNodes).find(
      (n: any) => n?.root && n?.nodeType === nt && !n?.deleted,
    ) as INode | undefined;
    return root?.title || UNCLASSIFIED[nt] || "Unclassified";
  }, [relatedNodes, currentVisibleNode?.nodeType]);

  useEffect(() => {
    if (property === "parts") {
      const someAreOptional = (propertyValue[0]?.nodes || [])?.some(
        (c) => !!c.optional,
      );
      setDisplayOptional(selectedProperty === "parts" || someAreOptional);
    }
  }, [propertyValue, selectedProperty]);

  const unlinkVisible = useCallback(
    (nodeId: string) => {
      if (
        property === "generalizations" &&
        (editableProperty || propertyValue).flatMap((n) => n.nodes).length <= 1
      ) {
        return false;
      }
      if (newOnes && newOnes.has(nodeId)) {
        return true;
      }
      if (!!selectedDiffNode) {
        return false;
      }
      let numberOfGeneralizations = 0;
      if (property === "specializations") {
        for (let colGeneralization of relatedNodes[nodeId]?.generalizations ||
          []) {
          numberOfGeneralizations += colGeneralization.nodes.length;
        }
      }
      return (
        (property === "generalizations" &&
          (editableProperty || propertyValue).flatMap((n) => n.nodes).length !==
            1) ||
        (property === "specializations" && numberOfGeneralizations > 1) ||
        (property !== "generalizations" && property !== "specializations")
      );
    },
    [
      propertyValue,
      property,
      relatedNodes,
      selectedDiffNode,
      newOnes,
      editableProperty,
    ],
  );

  const getCategoryStyle = useCallback(
    (collection: string) => {
      if (!selectedDiffNode || selectedDiffNode.modifiedProperty !== property)
        return "";

      if (
        selectedDiffNode.changeType === "add collection" &&
        collection === selectedDiffNode.changeDetails.addedCollection
      ) {
        return theme.palette.mode === "dark" ? "green" : "#4ccf37";
      }
      if (
        selectedDiffNode.changeType === "delete collection" &&
        collection === selectedDiffNode.changeDetails.deletedCollection
      ) {
        return "red";
      }
      return "";
    },
    [selectedDiffNode, property],
  );

  // Function to handle sorting of draggable items
  const unlinkElement = (id: string, collectionIdx: number) => {
    setEditableProperty((prev: ICollection[]) => {
      const _prev = [...prev];
      _prev[collectionIdx].nodes = _prev[collectionIdx].nodes.filter(
        (n: ILinkNode) => n.id !== id,
      );
      return _prev;
    });
    setRemovedElements((prev: Set<string>) => {
      if (checkedItemsCopy.has(id)) {
        prev.add(id);
      }
      return prev;
    });
    setAddedElements((prev: Set<string>) => {
      prev.delete(id);
      return prev;
    });
    setCheckedItems((checkedItems: any) => {
      let _oldChecked = new Set(checkedItems);
      if (_oldChecked.has(id)) {
        _oldChecked.delete(id);
      } else {
        _oldChecked.add(id);
      }
      if (selectedProperty === "generalizations" && _oldChecked.size === 0) {
        return checkedItems;
      }
      return _oldChecked;
    });
  };

  const saveNewSpecialization = async (nId: string, collectionName: string) => {
    try {
      if (loadingIds.has(nId)) {
        return;
      }
      setLoadingIds((prev: Set<string>) => {
        const _prev = new Set(prev);
        _prev.add(nId);
        return _prev;
      });
      const queued = clonedNodesQueue[nId];
      const property = queued.property;

      // Spec/gen go through the cloning endpoint: it creates the new node as a
      // specialization of the searched node and links it into this node's side.
      if (property === "specializations" || property === "generalizations") {
        const targetId = currentVisibleNode?.id;
        setCurrentVisibleNode((prev: any) => {
          if (!prev || prev.id !== targetId) return prev;
          const next: ICollection[] = JSON.parse(
            JSON.stringify(
              Array.isArray(prev[property]) && prev[property].length
                ? prev[property]
                : [{ collectionName: "main", nodes: [] }],
            ),
          );
          let i = next.findIndex((c) => c.collectionName === collectionName);
          if (i === -1) i = 0;
          if (!next.flatMap((c) => c.nodes).some((n) => n.id === nId)) {
            next[i].nodes.push({ id: nId, title: queued.title });
          }
          return { ...prev, [property]: next };
        });

        pendingWrites.start(targetId, property);
        try {
          await Post("/nodes/hierarchy/cloning", {
            newNodeId: nId,
            title: queued.title,
            generalizationId: queued.id,
            targetNodeId: targetId,
            targetProperty: property,
            collectionName,
            ...(appName ? { appName } : {}),
          });
          await Post("/triggerChroma", { nodeId: nId, update: true });
          const fresh = await fetchNode(targetId, true);
          setCurrentVisibleNode((prev: any) =>
            prev?.id === targetId && fresh ? fresh : prev,
          );
          await fetchNode(nId, true);
        } catch (error: any) {
          const fresh = await fetchNode(targetId, true);
          setCurrentVisibleNode((prev: any) =>
            prev?.id === targetId && fresh ? fresh : prev,
          );
          const reason =
            (typeof error === "string" ? error : error?.message) ||
            "Please try again.";
          setSnackbarMessage(`Failed to add specialization: ${reason}`);
          recordLogs({
            type: "error",
            error: JSON.stringify({
              name: error?.name,
              message: typeof error === "string" ? error : error?.message,
              stack: error?.stack,
            }),
            at: "saveNewSpecialization",
          });
        } finally {
          pendingWrites.end(targetId, property);
        }
        setLoadingIds((prev: Set<string>) => {
          const _prev = new Set(prev);
          _prev.delete(nId);
          return _prev;
        });
        setClonedNodesQueue((prev: any) => {
          const _prev = { ...prev };
          delete _prev[nId];
          return _prev;
        });
        return;
      }

      const addedElements: string[] = [nId];
      await handleSaveLinkChanges(
        [],
        addedElements,
        property,
        currentVisibleNode?.id,
        collectionName,
      );
      setLoadingIds((prev: Set<string>) => {
        const _prev = new Set(prev);
        _prev.delete(nId);
        return _prev;
      });
      const id = queued.id;
      const title = queued.title;
      setClonedNodesQueue((prev: any) => {
        const _prev = { ...prev };
        delete _prev[nId];
        return _prev;
      });
      await handleCloning({ id }, title, nId, collectionName, property);
    } catch (error) {
      console.error(error);
    }
  };

  const cancelPendingPart = (queuedId: string) => {
    setEditableProperty((prev: ICollection[]) =>
      prev.map((collection) => ({
        ...collection,
        nodes: collection.nodes.filter((node) => node.id !== queuedId),
      })),
    );
    setAddedElements((prev: Set<string>) => {
      const updated = new Set(prev);
      updated.delete(queuedId);
      return updated;
    });
    setNewOnes((prev: Set<string>) => {
      const updated = new Set(prev);
      updated.delete(queuedId);
      return updated;
    });
    setClonedNodesQueue(
      (prev: {
        [nodeId: string]: { title: string; id: string; property: string };
      }) => {
        const updated = { ...prev };
        delete updated[queuedId];
        return updated;
      },
    );
  };

  const updatePendingPartTitle = (queuedId: string, title: string) => {
    setClonedNodesQueue(
      (prev: {
        [nodeId: string]: { title: string; id: string; property: string };
      }) => ({
        ...prev,
        [queuedId]: {
          ...prev[queuedId],
          title,
        },
      }),
    );
  };

  const logChange = (
    action: string,
    prevValue: any,
    newValue: any,
    nodeDoc: any,
    property: any,
  ) => {
    recordLogs({
      action,
      previousValue: prevValue,
      newValue,
      node: nodeDoc.id,
      property: property,
    });
  };
  const onSave = useCallback(async () => {
    try {
      setIsSaving(true);
      const _removedElements = new Set(removedElements);
      const _addedElements = new Set(addedElements);
      const _selectedProperty = selectedProperty;
      handleCloseAddLinksModel();
      for (let nId in clonedNodesQueue) {
        await handleCloning(
          { id: clonedNodesQueue[nId].id },
          clonedNodesQueue[nId].title,
          nId,
        );
      }
      await handleSaveLinkChanges(
        _removedElements,
        _addedElements,
        _selectedProperty,
        currentVisibleNode?.id,
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
        at: "recordLogs",
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    clonedNodesQueue,
    addedElements,
    removedElements,
    selectedProperty,
    modifiedOrder,
    currentVisibleNode?.id,
  ]);

  const scrollToElement = (elementId: string) => {
    setTimeout(() => {
      const element = document.getElementById(`${elementId}-${property}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        setGlowIds((prev: Set<string>) => {
          const _prev = new Set(prev);
          _prev.add(`${elementId}-${property}`);
          return _prev;
        });
      }
    }, 500);
    setTimeout(() => {
      setGlowIds((prev: Set<string>) => {
        const _prev = new Set(prev);
        _prev.delete(`${elementId}-${property}`);
        return _prev;
      });
    }, 2000);
  };

  const getInheritedPartsSet = (): Set<string> => {
    const inheritedParts = new Set<string>();

    if (currentVisibleNode.inheritanceParts) {
      Object.keys(currentVisibleNode.inheritanceParts).forEach(
        (partId: string) => {
          inheritedParts.add(partId);
        },
      );
    }

    if (currentVisibleNode.properties?.parts) {
      currentVisibleNode.properties.parts.forEach((collection: any) => {
        collection.nodes.forEach((part: any) => {
          inheritedParts.add(part.id);
        });
      });
    }

    return inheritedParts;
  };
  // Single write point for the focused node's parts. 
  // On failure it re-fetches so the UI never keeps an unsaved change.
  const saveParts = useCallback(
    async (
      newParts: ICollection[],
      inheritedPartsDetails?: InheritedPartsDetail[] | null,
    ) => {
      const nodeId = currentVisibleNode?.id;
      if (!nodeId) return;
      setCurrentVisibleNode((prev: any) =>
        prev && prev.id === nodeId
          ? { ...prev, properties: { ...prev.properties, parts: newParts } }
          : prev,
      );
      pendingWrites.start(nodeId, "properties.parts");
      try {
        await Post("/nodes/parts/update", {
          nodeId,
          parts: newParts,
          ...(inheritedPartsDetails ? { inheritedPartsDetails } : {}),
          ...(appName ? { appName } : {}),
        });
      } catch (error: any) {
        const fresh = await fetchNode(nodeId);
        setCurrentVisibleNode((prev: any) =>
          prev?.id === nodeId && fresh ? fresh : prev,
        );
        const reason =
          (typeof error === "string" ? error : error?.message) ||
          "Please try again.";
        setSnackbarMessage(`Failed to update parts: ${reason}`);
      } finally {
        pendingWrites.end(nodeId, "properties.parts");
      }
    },
    [
      currentVisibleNode,
      appName,
      setCurrentVisibleNode,
      fetchNode,
      setSnackbarMessage,
    ],
  );

  const unlinkNodeRelation = async (
    currentNodeId: string,
    linkId: string,
    linkIndex: number,
    collectionIndex: number,
    fromModel: boolean = false,
  ) => {
    try {
      // Parts: drop the id from the node's own parts and persist via endpoint.
      if (property === "parts") {
        const source = currentVisibleNode?.properties?.parts;
        const newParts: ICollection[] = Array.isArray(source)
          ? JSON.parse(JSON.stringify(source))
          : [{ collectionName: "main", nodes: [] }];
        for (const c of newParts) {
          c.nodes = (c.nodes || []).filter((n: ILinkNode) => n.id !== linkId);
        }
        await saveParts(newParts);
        return;
      }
      if (
        fromModel ||
        (await confirmIt(
          `Are you sure you want remove this item the list?`,
          `Remove`,
          "Keep",
        ))
      ) {
        const nodeDoc = await getDoc(doc(collection(db, NODES), currentNodeId));
        if (nodeDoc.exists()) {
          const nodeData = nodeDoc.data() as any;

          const inheritedRef = nodeData.inheritance?.[property]?.ref;
          if (inheritedRef) {
            let inheritedNode: INode | null =
              relatedNodes[inheritedRef] ?? null;
            if (!inheritedNode) {
              inheritedNode = await fetchNode(inheritedRef);
            }
            if (inheritedNode?.properties?.[property]) {
              nodeData.properties[property] = JSON.parse(
                JSON.stringify(inheritedNode.properties[property]),
              );
            }
          }
          const previousValue = JSON.parse(
            JSON.stringify(nodeData.properties[property]),
          );

          if (
            linkIndex !== -1 &&
            Array.isArray(nodeData.properties[property]) &&
            nodeData.propertyType[property] !== "string" &&
            nodeData.propertyType[property] !== "string-array"
          ) {
            nodeData.properties[property][collectionIndex].nodes.splice(
              linkIndex,
              1,
            );
          }

          let shouldBeRemovedFromParent = false;

          if (Array.isArray(nodeData.properties[property])) {
            const stillExists = nodeData.properties[property].some(
              (col: any) =>
                Array.isArray(col.nodes) &&
                col.nodes.some((n: { id: string }) => n.id === linkId),
            );
            shouldBeRemovedFromParent = !stillExists;
          } else {
            shouldBeRemovedFromParent = true;
          }

          if (shouldBeRemovedFromParent) {
            unlinkPropertyOf(db, property, currentVisibleNode?.id, linkId);
          }

          const propertyUpdateObject: any = {
            [`properties.${property}`]: nodeData.properties[property],
          };

          await updateDoc(nodeDoc.ref, propertyUpdateObject);

          const inheritanceEntry = nodeData.inheritance?.[property];
          if (property !== "isPartOf" || inheritanceEntry) {
            const reference = inheritanceEntry?.ref ?? null;
            let updateObject: any = {
              [`inheritance.${property}.ref`]: null,
              [`inheritance.${property}.title`]: "",
            };
            let referenceNode = null;
            if (reference) {
              referenceNode = relatedNodes[reference];
              if (!referenceNode) {
                referenceNode = await fetchNode(reference);
              }
            }

            if (
              referenceNode &&
              referenceNode.textValue &&
              referenceNode.textValue.hasOwnProperty(property) &&
              Array.isArray(nodeData.properties[property]) &&
              nodeData.propertyType[property] !== "string" &&
              nodeData.propertyType[property] !== "string-array"
            ) {
              const links = nodeData.properties[property].flatMap(
                (c: any) => c.relatedNodes,
              );
              if (property === "isPartOf") {
                updatePartsAndPartsOf(
                  links,
                  {
                    id: currentVisibleNode?.id,
                    title: currentVisibleNode?.title ?? "",
                  },
                  "isPartOf",
                  db,
                  relatedNodes,
                );
              } else {
                updatePropertyOf(
                  links,
                  { id: currentVisibleNode?.id },
                  property,
                  relatedNodes,
                  db,
                );
              }
              updateObject = {
                ...updateObject,
                [`textValue.${property}`]: referenceNode.textValue[property],
              };
            }
            await updateDoc(nodeDoc.ref, updateObject);

            await updateInheritance({
              nodeId: nodeDoc.id,
              updatedProperties: [property],
              db,
            });
          }
          saveNewChangeLog(db, {
            nodeId: currentVisibleNode?.id,
            modifiedBy: user?.uname || "",
            modifiedProperty: property,
            previousValue,
            newValue: nodeData.properties[property],
            modifiedAt: new Date(),
            changeType: "remove element",
            fullNode: currentVisibleNode,
            ...(appName ? { appName } : {}),
          });
          recordLogs({
            action: "unlinked a node",
            property,
            unlinked: linkId,
            node: nodeDoc.id,
          });

          if (currentVisibleNode?.id) {
            // Optimistic update: Property links don't affect tree structure
            // but trigger a refresh for consistency
            if (onInstantTreeUpdate) {
              onInstantTreeUpdate((tree) => [...tree]);
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
      await confirmIt(
        `There is an issue with unlinking the node, please try again.`,
        `Ok`,
        "",
      );
    }
  };

  const linkNodeRelation = async ({
    currentNodeId,
    partId,
  }: {
    currentNodeId: string;
    partId: string;
  }) => {
    try {
      const source = currentVisibleNode?.properties?.parts;
      const newParts: ICollection[] =
        Array.isArray(source) && source.length
          ? JSON.parse(JSON.stringify(source))
          : [{ collectionName: "main", nodes: [] }];
      if (newParts[0].nodes.some((n: ILinkNode) => n.id === partId)) return;
      newParts[0].nodes.push({
        id: partId,
        title: relatedNodes[partId]?.title ?? "",
      });
      await saveParts(newParts);
    } catch (error) {
      console.error(error);
    }
  };
  const replaceWith = useCallback(
    async (
      oldPartId: string,
      newPartId: string,
      updatedInheritedPartsDetails?: InheritedPartsDetail[] | null,
    ) => {
      try {
        if (property !== "parts") return;
        if (!currentVisibleNode?.id || !user?.uname) return;
        if (!oldPartId || !newPartId || oldPartId === newPartId) return;

        // scrollToElement(oldPartId);

        // Following linkNodeRelation and unlinkNodeRelation but updated as a single Function for clarity

        const sourceParts: ICollection[] | undefined =
          currentVisibleNode.properties?.parts;
        if (!Array.isArray(sourceParts) || !sourceParts[0]?.nodes) return;

        const updatedParts: ICollection[] = JSON.parse(
          JSON.stringify(sourceParts),
        );
        const elementIdx = updatedParts[0].nodes.findIndex(
          (n: ILinkNode) => n.id === oldPartId,
        );
        if (elementIdx === -1) return;
        if (updatedParts[0].nodes.some((n: ILinkNode) => n.id === newPartId)) {
          return; // newPartId already in parts
        }

        // Replace id + title at the same slot (keeps position and optional flag).
        updatedParts[0].nodes[elementIdx].id = newPartId;
        updatedParts[0].nodes[elementIdx].title =
          relatedNodes[newPartId]?.title || "";

        await saveParts(updatedParts, updatedInheritedPartsDetails);

        recordLogs({
          action: "replace part",
          field: "parts",
          oldPartId,
          newPartId,
          nodeId: currentVisibleNode.id,
        });
      } catch (error: any) {
        console.error(error);
        recordLogs({
          type: "error",
          error: JSON.stringify({
            name: error?.name,
            message: error?.message,
            stack: error?.stack,
          }),
        });
      }
    },
    [currentVisibleNode, relatedNodes, property, user, saveParts],
  );

  if (
    (currentImprovement &&
      !currentImprovement.implemented &&
      !currentImprovement?.newNode &&
      currentImprovement.modifiedProperty === property) ||
    (selectedDiffNode?.modifiedProperty === property &&
      selectedDiffNode.changeType !== "edit collection")
  ) {
    return (
      <Paper
        id={`property-${property}`}
        elevation={9}
        sx={{
          borderRadius: property !== "context" ? "30px" : "",
          borderBottomRightRadius: "18px",
          borderBottomLeftRadius: "18px",
          width: "100%",
          minHeight: "150px",
          maxHeight: "100%",
          overflow: "hidden",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          overflowX: "hidden",
          overflowY: "hidden",
          "&::-webkit-scrollbar": {
            display: "none",
          },
          border:
            selectedProperty === property && !selectedCollection
              ? "2px solid green"
              : "2px solid orange",
        }}
      >
        <VisualizeTheProperty
          currentImprovement={selectedDiffNode || currentImprovement}
          property={property}
          getTitle={getTitle}
          nodes={relatedNodes}
        />
      </Paper>
    );
  }

  return (
    // <Slide direction="up" in={true} mountOnEnter unmountOnExit timeout={500}></Slide>
    <Paper
      id={`property-${property}`}
      elevation={9}
      sx={{
        borderRadius: property !== "context" ? "30px" : "",
        borderBottomRightRadius: "18px",
        borderBottomLeftRadius: "18px",
        minWidth: isMobile ? "100%" : "500px",
        width: "100%",
        minHeight: "120px",
        maxHeight: "100%",
        overflow: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
        overflowY: "hidden",
        "&::-webkit-scrollbar": {
          display: "none",
        },
        border:
          selectedProperty === property && !selectedCollection
            ? "2px solid green"
            : "",
      }}
    >
      <Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            background: (theme: any) =>
              theme.palette.mode === "dark" ? "#242425" : "#d0d5dd",
            p: 3,

            backgroundColor:
              selectedDiffNode &&
              selectedDiffNode.changeType === "add property" &&
              selectedDiffNode.changeDetails.addedProperty === property
                ? "green"
                : "",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center" }}>
            {editProperty === property && modifyProperty ? (
              <EditProperty
                value={newPropertyValue}
                onChange={setNewPropertyValue}
                onSave={() => {
                  modifyProperty({
                    newValue: newPropertyValue,
                    previousValue: property,
                  });
                  setEditProperty("");
                  setNewPropertyValue("");
                }}
                onCancel={() => {
                  setEditProperty("");
                  setNewPropertyValue("");
                }}
                property={property}
              />
            ) : (
              <Tooltip title={getTooltipHelper(lowercaseFirstLetter(property))}>
                <Box
                  sx={{
                    position: "relative",
                    display: "inline-block",
                    pl: "1px",
                    "&:hover":
                      enableEdit && modifyProperty
                        ? {
                            border: "2px solid orange",
                            borderRadius: "15px",
                            pr: "15px",
                            cursor: "pointer",
                            backgroundColor: "gray",
                          }
                        : {},
                    "&:hover .edit-icon":
                      enableEdit && modifyProperty
                        ? {
                            display: "block",
                          }
                        : {},
                  }}
                  onClick={() => {
                    if (enableEdit && modifyProperty) {
                      setEditProperty(property);
                      setNewPropertyValue(property);
                    }
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: "20px",
                      fontWeight: 500,
                      fontFamily: "Roboto, sans-serif",
                      padding: "4px",
                    }}
                  >
                    {capitalizeFirstLetter(
                      DISPLAY[property] ? DISPLAY[property] : property,
                    )}
                  </Typography>
                  <EditIcon
                    className="edit-icon"
                    sx={{
                      position: "absolute",
                      top: "-8px",
                      right: "-8px",
                      color: "orange",
                      backgroundColor: "white",
                      borderRadius: "50%",
                      fontSize: "16px",
                      display: "none",
                    }}
                  />
                </Box>
              </Tooltip>
            )}
            {(property === "generalizations" ||
              property === "specializations" ||
              property === "isPartOf" ||
              property === "parts") && (
              <PropertyContributors
                currentVisibleNode={currentVisibleNode}
                property={property}
                sx={{ pl: "5px" }}
              />
            )}
          </Box>

          {selectedProperty === property &&
            !selectedCollection &&
            property !== "parts" && (
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
                    sx={{ borderRadius: "25px", backgroundColor: "red" }}
                  >
                    <CloseIcon sx={{ color: "white" }} />
                  </IconButton>
                </Tooltip>
                {/*  <LoadingButton
                size="small"
                onClick={onSave}
                loading={isSaving}
                color="success"
                variant="contained"
                sx={{ borderRadius: "25px", color: "white" }}
                disabled={
                  addedElements.size === 0 && removedElements.size === 0
                }
              >
                Save
              </LoadingButton> */}
              </Box>
            )}
          {(!currentVisibleNode.unclassified ||
            property === "specializations") &&
            selectedProperty !== property &&
            !selectedDiffNode &&
            !currentImprovement &&
            property !== "isPartOf" && (
              <Box sx={{ ml: "auto", display: "flex", gap: "14px" }}>
                {property !== "generalizations" &&
                  property !== "specializations" &&
                  property !== "isPartOf" &&
                  property !== "parts" && (
                    <PropertyContributors
                      currentVisibleNode={currentVisibleNode}
                      property={property}
                    />
                  )}
                {property === "specializations" && !locked && (
                  <Button
                    onClick={() => {
                      setOpenAddCollection(true);
                    }}
                    sx={{
                      borderRadius: "18px",
                      backgroundColor: BUTTON_COLOR,
                      display: !enableEdit ? "none" : "block",
                    }}
                    variant="outlined"
                  >
                    Add Collection
                  </Button>
                )}
                {property !== "isPartOf" &&
                  property !== "parts" &&
                  property !== "specializations" &&
                  property !== "generalizations" &&
                  deleteProperty && (
                    <Tooltip title={"Delete property"} placement="top">
                      <Button
                        variant="outlined"
                        color="error"
                        sx={{ borderRadius: "25px" }}
                        onClick={() => {
                          deleteProperty(property);
                        }}
                      >
                        Delete Property
                      </Button>
                    </Tooltip>
                  )}
                {property !== "specializations" && property !== "parts" && (
                  <Button
                    onClick={() => editStructuredProperty(property)}
                    sx={{
                      borderRadius: "18px",
                      backgroundColor: BUTTON_COLOR,
                      ":hover": {
                        backgroundColor:
                          theme.palette.mode === "light" ? "#f0f0f0" : "",
                      },
                      display: !enableEdit ? "none" : "block",
                    }}
                    variant="outlined"
                  >
                    {`Edit ${capitalizeFirstLetter(
                      DISPLAY[property] || property,
                    )}`}{" "}
                  </Button>
                )}
                {property !== "generalizations" &&
                  property !== "specializations" &&
                  property !== "isPartOf" &&
                  property !== "parts" &&
                  !currentVisibleNode.unclassified && (
                    <SelectInheritance
                      currentVisibleNode={currentVisibleNode}
                      property={property}
                      nodes={relatedNodes}
                      enableEdit={enableEdit}
                    />
                  )}
                {property !== "parts" &&
                  currentVisibleNode.inheritance[property]?.ref &&
                  !enableEdit && (
                    <Typography
                      sx={{ fontSize: "14px", ml: "9px", color: "gray" }}
                    >
                      {'(Inherited from "'}
                      {relatedNodes[
                        currentVisibleNode.inheritance[property].ref
                      ]?.title || ""}
                      {'")'}
                    </Typography>
                  )}
              </Box>
            )}
        </Box>
        {isReparenting && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              p: "12px",
            }}
          >
            <CircularProgress size={18} />
            <Typography
              sx={{
                fontSize: "14px",
                fontStyle: "italic",
                color: "text.secondary",
              }}
            >
              {`Moving under "${reparentRootName}"…`}
            </Typography>
          </Box>
        )}
        {!isReparenting &&
          (property !== "parts" || !enableEdit) &&
          currentVisibleNode.propertyType[property] !== "string-array" && (
            <CollectionStructure
              locked={locked}
              selectedDiffNode={selectedDiffNode}
              currentImprovement={currentImprovement}
              property={property}
              propertyValue={
                selectedProperty === property
                  ? editableProperty ?? []
                  : propertyValue ?? []
              }
              setEditableProperty={setEditableProperty}
              getCategoryStyle={getCategoryStyle}
              navigateToNode={navigateToNode}
              setSnackbarMessage={setSnackbarMessage}
              currentVisibleNode={currentVisibleNode}
              setCurrentVisibleNode={setCurrentVisibleNode}
              nodes={relatedNodes}
              fetchNode={fetchNode}
              unlinkVisible={unlinkVisible}
              editStructuredProperty={editStructuredProperty}
              confirmIt={confirmIt}
              logChange={logChange}
              cloneNode={cloneNode}
              openAddCollection={openAddCollection}
              setOpenAddCollection={setOpenAddCollection}
              unlinkElement={unlinkElement}
              selectedProperty={selectedProperty}
              clonedNodesQueue={clonedNodesQueue}
              model={!!selectedProperty}
              setModifiedOrder={setModifiedOrder}
              glowIds={glowIds}
              scrollToElement={scrollToElement}
              selectedCollection={selectedCollection}
              handleCloseAddLinksModel={handleCloseAddLinksModel}
              onSave={onSave}
              isSaving={isSaving}
              addedElements={addedElements}
              removedElements={removedElements}
              setSearchValue={setSearchValue}
              searchValue={searchValue}
              searchResultsForSelection={searchResultsForSelection}
              checkedItems={
                new Set(propertyValue.flatMap((c) => c.nodes).map((c) => c.id))
              }
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
              saveNewSpecialization={saveNewSpecialization}
              cancelPendingClone={cancelPendingPart}
              setLoadingIds={setLoadingIds}
              editableProperty={editableProperty}
              onGetPropertyValue={onGetPropertyValue}
              setRemovedElements={setRemovedElements}
              setAddedElements={setAddedElements}
              addACloneNodeQueue={addACloneNodeQueue}
              appName={appName}
              enableEdit={enableEdit}
              handleLoadMore={handleLoadMore}
              loadingStates={loadingStates}
              unlinkNodeRelation={unlinkNodeRelation}
              linkNodeRelation={linkNodeRelation}
              onInstantTreeUpdate={onInstantTreeUpdate}
            />
          )}
        {property === "parts" &&
          displayOptional &&
          !enableEdit &&
          showTopOptionalLegend && (
            <InheritedPartsLegend
              sx={{ ml: 2 }}
              legendItems={[{ symbol: "(o)", description: "Optional" }]}
            />
          )}
        {property === "parts" && !selectedDiffNode && !currentImprovement && (
          <PartViewer
            enableEdit={enableEdit}
            property={property}
            getAllGeneralizations={getAllGeneralizations}
            currentVisibleNode={currentVisibleNode}
            relatedNodes={relatedNodes}
            fetchNode={fetchNode}
            addNodesToCache={addNodesToCache}
            linkNodeRelation={linkNodeRelation}
            unlinkNodeRelation={unlinkNodeRelation}
            saveParts={saveParts}
            user={user}
            navigateToNode={navigateToNode}
            replaceWith={replaceWith}
            appName={appName}
            getGeneralizationParts={getGeneralizationParts}
            clonedNodesQueue={clonedNodesQueue}
            saveNewSpecialization={saveNewSpecialization}
            cancelPendingPart={cancelPendingPart}
            updatePendingPartTitle={updatePendingPartTitle}
            onDisplayDetailsChange={(isExpanded) =>
              setShowTopOptionalLegend(!isExpanded)
            }
          />
        )}
      </Box>
      {property === "parts" && enableEdit && selectedProperty !== property && (
        <Button
          sx={{
            borderRadius: "25px",
            border: "1px solid",
            m: "0px 5px 5px 5px",
            mt: "auto",
          }}
          onClick={() => {
            editStructuredProperty(property);
          }}
        >
          {" "}
          <AddIcon
            sx={{
              mr: "5px",
            }}
          />
          Add new Part
        </Button>
      )}
      {handleCloseAddLinksModel &&
        selectedProperty === property &&
        !selectedCollection && (
          <StructuredPropertySelector
            onSave={onSave}
            currentVisibleNode={currentVisibleNode}
            relatedNodes={relatedNodes}
            fetchNode={fetchNode}
            handleCloseAddLinksModel={handleCloseAddLinksModel}
            selectedProperty={selectedProperty}
            setSearchValue={setSearchValue}
            searchValue={searchValue}
            searchResultsForSelection={searchResultsForSelection}
            checkedItems={
              new Set(propertyValue.flatMap((c) => c.nodes).map((c) => c.id))
            }
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
            addACloneNodeQueue={addACloneNodeQueue}
            setClonedNodesQueue={setClonedNodesQueue}
            clonedNodesQueue={clonedNodesQueue}
            newOnes={newOnes}
            setNewOnes={setNewOnes}
            loadingIds={loadingIds}
            saveNewSpecialization={saveNewSpecialization}
            setLoadingIds={setLoadingIds}
            editableProperty={editableProperty}
            setEditableProperty={setEditableProperty}
            locked={locked}
            selectedDiffNode={selectedDiffNode}
            confirmIt={confirmIt}
            currentImprovement={currentImprovement}
            onGetPropertyValue={onGetPropertyValue}
            setCurrentVisibleNode={setCurrentVisibleNode}
            removedElements={removedElements}
            addedElements={addedElements}
            setRemovedElements={setRemovedElements}
            setAddedElements={setAddedElements}
            isSaving={isSaving}
            scrollToElement={scrollToElement}
            selectedCollection={selectedCollection}
            appName={appName}
            inheritanceDetails={inheritanceDetails}
            linkNodeRelation={linkNodeRelation}
            unlinkNodeRelation={unlinkNodeRelation}
          />
        )}
      {/* {selectedProperty !== property && (
        <CommentsSection
          handleCloseAddLinksModel={handleCloseAddLinksModel}
          property={property}
          onGetPropertyValue={onGetPropertyValue}
          showComments={showComments}
          setShowComments={setShowComments}
        />
      )} */}
    </Paper>
    // </Slide>
  );
};

export default StructuredProperty;
