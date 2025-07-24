import React, { useCallback, useEffect, useMemo, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import {
  Box,
  Button,
  Typography,
  Tooltip,
  Paper,
  useTheme,
  IconButton,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Slide,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
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
  breakInheritanceAndCopyParts,
} from "@components/lib/utils/partsHelper";
import { ICollection, ILinkNode, INode } from "@components/types/INode";
import { DISPLAY } from "@components/lib/CONSTANTS";
import { useAuth } from "../context/AuthContext";
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
import MarkdownRender from "../Markdown/MarkdownRender";
import VisualizeTheProperty from "./VisualizeTheProperty";
import CollectionStructure from "./CollectionStructure";
import SelectModel from "../Models/SelectModel";
import { LoadingButton } from "@mui/lab";
import PropertyContributors from "./PropertyContributors";
import { NODES } from "@components/lib/firestoreClient/collections";
import CommentsSection from "./CommentsSection";
import InheritedPartsViewer from "./InheritedPartsViewer";
import InheritedPartsLegend from "../Common/InheritedPartsLegend";
import { Post } from "@components/lib/utils/Post";
import EditProperty from "../AddPropertyForm/EditProprety";
import InheritedPartsViewerEdit from "./InheritedPartsViewerEdit";

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
  nodes: { [id: string]: INode };
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
  skillsFuture: boolean;
  partsInheritance?: {
    [nodeId: string]: { inheritedFrom: string; partInheritance: string };
  };
  enableEdit: boolean;
  inheritanceDetails?: any;
  skillsFutureApp: string;
  deleteProperty?: Function;
  modifyProperty?: Function;
};

const StructuredProperty = ({
  currentVisibleNode,
  editStructuredProperty,
  navigateToNode,
  setSnackbarMessage,
  setCurrentVisibleNode,
  property,
  nodes,
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
  skillsFuture,
  partsInheritance,
  enableEdit,
  inheritanceDetails,
  skillsFutureApp,
  deleteProperty,
  modifyProperty,
}: IStructuredPropertyProps) => {
  const theme = useTheme();
  const [openAddCollection, setOpenAddCollection] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const BUTTON_COLOR = theme.palette.mode === "dark" ? "#373739" : "#dde2ea";
  const [modifiedOrder, setModifiedOrder] = useState(false);
  const [displayDetails, setDisplayDetails] = useState(false);
  const [displayOptional, setDisplayOptional] = useState(false);
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
        result =
          getPropertyValue(
            nodes,
            currentVisibleNode.inheritance[property]?.ref,
            property,
          ) || currentVisibleNode?.properties[property];
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
        previousValue[sourceCollectionIndex].nodes[source.index].change =
          "removed";
        previousValue[sourceCollectionIndex].nodes[source.index].changeType =
          "sort";
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
    nodes,
    property,
    selectedDiffNode,
    processCollectionData,
    db,
  ]);

  useEffect(() => {
    if (property === "parts") {
      const someAreOptional = propertyValue[0].nodes.some((c) => !!c.optional);
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
        for (let colGeneralization of nodes[nodeId]?.generalizations || []) {
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
      nodes,
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
      await handleCloning(
        { id: clonedNodesQueue[nId].id },
        clonedNodesQueue[nId].title,
        nId,
        collectionName,
      );
      const addedElements: string[] = [nId];

      await handleSaveLinkChanges(
        [],
        addedElements,
        selectedProperty,
        currentVisibleNode?.id,
        collectionName,
      );

      setClonedNodesQueue((prev: any) => {
        const _prev = { ...prev };
        delete _prev[nId];
        return _prev;
      });
      setLoadingIds((prev: Set<string>) => {
        const _prev = new Set(prev);
        _prev.delete(nId);
        return _prev;
      });
    } catch (error) {
      console.error(error);
    }
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

    // Case 1: Broken inheritance - add parts from inheritanceParts
    if (currentVisibleNode.inheritanceParts) {
      Object.keys(currentVisibleNode.inheritanceParts).forEach(
        (partId: string) => {
          inheritedParts.add(partId);
        },
      );
    }

    // Case 2: Intact inheritance - add all parts from referenced generalization
    if (currentVisibleNode.inheritance?.parts?.ref) {
      const referencedGeneralizationId =
        currentVisibleNode.inheritance.parts.ref;
      const allPartsFromRef = getGeneralizationParts(
        referencedGeneralizationId,
        nodes,
      );
      allPartsFromRef.forEach((part) => {
        inheritedParts.add(part.id);
      });
    }

    // Add direct parts from the node itself
    if (currentVisibleNode.properties?.parts) {
      currentVisibleNode.properties.parts.forEach((collection: any) => {
        collection.nodes.forEach((part: any) => {
          inheritedParts.add(part.id);
        });
      });
    }

    return inheritedParts;
  };
  const unlinkNodeRelation = async (
    currentNodeId: string,
    linkId: string,
    linkIndex: number,
    collectionIndex: number,
    fromModel: boolean = false,
  ) => {
    try {
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

          // Handle for parts - break inheritance
          const inheritedRef = nodeData.inheritance[property]?.ref;
          if (property === "parts" && inheritedRef) {
            await breakInheritanceAndCopyParts(
              currentNodeId,
              linkId,
              nodes,
              user,
              skillsFutureApp,
            );
            const inheritanceFrom = nodes[inheritedRef];

            nodeData.properties["parts"] = JSON.parse(
              JSON.stringify(inheritanceFrom.properties["parts"]),
            );
          } else if (inheritedRef) {
            // Existing logic for non-parts properties
            const nodeId = nodeData.inheritance[property].ref;
            const inheritedNode = nodes[nodeId as string];
            nodeData.properties[property] = JSON.parse(
              JSON.stringify(inheritedNode.properties[property]),
            );
          }
          const previousValue = JSON.parse(
            JSON.stringify(nodeData.properties[property]),
          );

          let removedFromInheritanceParts = false;

          if (property === "parts") {
            if (linkIndex === -1) {
              linkIndex = nodeData.properties[property][
                collectionIndex
              ].nodes.findIndex((c: { id: string }) => c.id === linkId);
            }
            if (
              nodeData.inheritanceParts &&
              nodeData.inheritanceParts[linkId]
            ) {
              // Remove from inheritanceParts (broken inheritance scenario)
              delete nodeData.inheritanceParts[linkId];
              removedFromInheritanceParts = true;
            } else if (
              linkIndex !== -1 &&
              Array.isArray(nodeData.properties[property]) &&
              nodeData.propertyType[property] !== "string" &&
              nodeData.propertyType[property] !== "string-array"
            ) {
              // Remove from direct parts (intact inheritance scenario)
              nodeData.properties[property][collectionIndex].nodes.splice(
                linkIndex,
                1,
              );
            }
          } else if (
            linkIndex !== -1 &&
            Array.isArray(nodeData.properties[property]) &&
            nodeData.propertyType[property] !== "string" &&
            nodeData.propertyType[property] !== "string-array"
          ) {
            // Remove from other properties (generalizations, specializations, etc.)
            nodeData.properties[property][collectionIndex].nodes.splice(
              linkIndex,
              1,
            );
          }

          let shouldBeRemovedFromParent = false;

          if (property === "parts" && removedFromInheritanceParts) {
            // For inheritanceParts removal, always remove from parent since it's not in direct properties
            shouldBeRemovedFromParent = true;
          } else {
            // Existing logic for other properties
            shouldBeRemovedFromParent = !(
              Object.values(nodeData.properties[property]) as { id: string }[]
            )
              .flat()
              .some((c: { id: string }) => c.id === linkId);
          }

          // const childDoc = await getDoc(doc(collection(db, NODES), child.id));
          // const childData = childDoc.data() as INode;
          if (shouldBeRemovedFromParent) {
            unlinkPropertyOf(db, property, currentVisibleNode?.id, linkId);
          }

          let propertyUpdateObject: any = {};

          // Update based on where the item was removed from
          if (property === "parts" && removedFromInheritanceParts) {
            // Update inheritanceParts for broken inheritance
            propertyUpdateObject.inheritanceParts = nodeData.inheritanceParts;
          } else {
            // Update direct properties for intact inheritance or other properties
            propertyUpdateObject[`properties.${property}`] =
              nodeData.properties[property];
          }

          await updateDoc(nodeDoc.ref, propertyUpdateObject);

          if (property !== "isPartOf" || nodeData.inheritance[property]) {
            const reference = nodeData.inheritance[property].ref;
            let updateObject: any = {
              [`inheritance.${property}.ref`]: null,
            };
            if (
              reference &&
              nodes[reference].textValue &&
              nodes[reference].textValue.hasOwnProperty(property) &&
              Array.isArray(nodeData.properties[property]) &&
              nodeData.propertyType[property] !== "string" &&
              nodeData.propertyType[property] !== "string-array"
            ) {
              const links = nodeData.properties[property].flatMap(
                (c: any) => c.nodes,
              );
              if (property === "isPartOf") {
                updatePartsAndPartsOf(
                  links,
                  { id: currentVisibleNode?.id },
                  "isPartOf",
                  db,
                  nodes,
                );
              } else {
                updatePropertyOf(
                  links,
                  { id: currentVisibleNode?.id },
                  property,
                  nodes,
                  db,
                );
              }
              updateObject = {
                ...updateObject,
                [`textValue.${property}`]: nodes[reference].textValue[property],
              };
            }
            await updateDoc(nodeDoc.ref, updateObject);

            await updateInheritance({
              nodeId: nodeDoc.id,
              updatedProperties: [property],
              db,
            });
          }
          await Post("/triggerChroma", {
            nodeId: currentNodeId,
            updateAll: false,
          });
          saveNewChangeLog(db, {
            nodeId: currentVisibleNode?.id,
            modifiedBy: user?.uname || "",
            modifiedProperty: property,
            previousValue,
            newValue: nodeData.properties[property],
            modifiedAt: new Date(),
            changeType: "remove element",
            fullNode: currentVisibleNode,
            skillsFuture,
            ...(skillsFutureApp ? { appName: skillsFutureApp } : {}),
          });
          recordLogs({
            action: "unlinked a node",
            property,
            unlinked: linkId,
            node: nodeDoc.id,
          });
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
      const nodeData = nodes[currentNodeId];

      let parts = nodeData.properties["parts"];
      const inheritanceRefId = nodeData.inheritance["parts"].ref;
      if (inheritanceRefId) {
        parts = nodes[inheritanceRefId].properties["parts"];
      }
      const previousPartsValue = JSON.parse(JSON.stringify(parts));
      parts[0].nodes.push({
        id: partId,
      });

      const nodeRef = doc(collection(db, NODES), currentNodeId);

      const linkRef = doc(collection(db, NODES), partId);
      const linkData = nodes[partId];
      const previousIsPartOfValue = JSON.parse(
        JSON.stringify(linkData.properties["isPartOf"]),
      );
      linkData.properties["isPartOf"][0].nodes.push({
        id: currentNodeId,
      });

      updateDoc(linkRef, {
        "properties.isPartOf": linkData.properties["isPartOf"],
      });
      updateDoc(nodeRef, {
        "properties.parts": parts,
        "inheritance.parts.ref": null,
      });
      saveNewChangeLog(db, {
        nodeId: currentNodeId,
        modifiedBy: user?.uname || "",
        modifiedProperty: property,
        previousValue: previousPartsValue,
        newValue: parts,
        modifiedAt: new Date(),
        changeType: "add element",
        fullNode: currentVisibleNode,
        skillsFuture,
        ...(skillsFutureApp ? { appName: skillsFutureApp } : {}),
      });

      saveNewChangeLog(db, {
        nodeId: partId,
        modifiedBy: user?.uname || "",
        modifiedProperty: property,
        previousValue: previousIsPartOfValue,
        newValue: linkData.properties["isPartOf"],
        modifiedAt: new Date(),
        changeType: "add element",
        fullNode: currentVisibleNode,
        skillsFuture,
        ...(skillsFutureApp ? { appName: skillsFutureApp } : {}),
      });
      await updateInheritance({
        nodeId: currentNodeId,
        updatedProperties: ["parts"],
        db,
      });
    } catch (error) {
      console.error(error);
    }
  };
  const replaceWith = useCallback(
    async (partId: string, newPartId: string) => {
      try {
        scrollToElement(partId);
        if (property === "parts" && currentVisibleNode?.id) {
          const _propertyValue = currentVisibleNode.properties["parts"];
          const elementIdx = _propertyValue[0].nodes.findIndex(
            (n: { id: string }) => n.id === partId,
          );
          const existIdx = _propertyValue[0].nodes.findIndex(
            (n: { id: string }) => n.id === newPartId,
          );

          if (existIdx === -1) {
            _propertyValue[0].nodes[elementIdx].id = newPartId;
            const nodeRef = doc(collection(db, NODES), currentVisibleNode?.id);
            updateDoc(nodeRef, {
              "properties.parts": _propertyValue,
            });
          }
        }
      } catch (error) {
        console.error(error);
      }
    },
    [currentVisibleNode?.id, db, property],
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
          minWidth: "500px",
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
          nodes={nodes}
        />
      </Paper>
    );
  }

  return (
    <Slide direction="up" in={true} mountOnEnter unmountOnExit timeout={500}>
      <Paper
        id={`property-${property}`}
        elevation={9}
        sx={{
          borderRadius: property !== "context" ? "30px" : "",
          borderBottomRightRadius: "18px",
          borderBottomLeftRadius: "18px",
          minWidth: "500px",
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
                <Tooltip
                  title={getTooltipHelper(lowercaseFirstLetter(property))}
                >
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
                        nodes={nodes}
                        enableEdit={enableEdit}
                      />
                    )}
                  {currentVisibleNode.inheritance[property]?.ref &&
                    !enableEdit && (
                      <Typography
                        sx={{ fontSize: "14px", ml: "9px", color: "gray" }}
                      >
                        {'(Inherited from "'}
                        {nodes[currentVisibleNode.inheritance[property].ref]
                          ?.title || ""}
                        {'")'}
                      </Typography>
                    )}
                </Box>
              )}
          </Box>
          {(property !== "parts" || !enableEdit) &&
            currentVisibleNode.propertyType[property] !== "string-array" && (
              <CollectionStructure
                locked={locked}
                selectedDiffNode={selectedDiffNode}
                currentImprovement={currentImprovement}
                property={property}
                propertyValue={propertyValue ?? []}
                setEditableProperty={setEditableProperty}
                getCategoryStyle={getCategoryStyle}
                navigateToNode={navigateToNode}
                setSnackbarMessage={setSnackbarMessage}
                currentVisibleNode={currentVisibleNode}
                setCurrentVisibleNode={setCurrentVisibleNode}
                nodes={nodes}
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
                  new Set(
                    propertyValue.flatMap((c) => c.nodes).map((c) => c.id),
                  )
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
                setLoadingIds={setLoadingIds}
                editableProperty={editableProperty}
                onGetPropertyValue={onGetPropertyValue}
                setRemovedElements={setRemovedElements}
                setAddedElements={setAddedElements}
                addACloneNodeQueue={addACloneNodeQueue}
                skillsFuture={skillsFuture}
                partsInheritance={partsInheritance ?? {}}
                enableEdit={enableEdit}
                handleLoadMore={handleLoadMore}
                loadingStates={loadingStates}
                skillsFutureApp={skillsFutureApp}
                unlinkNodeRelation={unlinkNodeRelation}
                linkNodeRelation={linkNodeRelation}
              />
            )}{" "}
          {property === "parts" && displayOptional && !enableEdit && (
            <InheritedPartsLegend
              legendItems={[{ symbol: "(o)", description: "Optional" }]}
            />
          )}
          {property === "parts" && !displayDetails && !enableEdit && (
            <Button
              variant="outlined"
              sx={{
                borderRadius: "25px",
                p: 0.5,
                px: 2,
                ml: "10px",
                mb: "9px",
              }}
              onClick={() => {
                setDisplayDetails((prev) => !prev);
              }}
            >
              <KeyboardArrowDownIcon />
              Parts inherited from ...
            </Button>
          )}
          {property === "parts" && !selectedDiffNode && !currentImprovement && (
            <>
              {enableEdit ? (
                <InheritedPartsViewerEdit
                  selectedProperty={property}
                  getAllGeneralizations={() =>
                    getAllGeneralizations(currentVisibleNode, nodes)
                  }
                  getGeneralizationParts={getGeneralizationParts}
                  nodes={nodes}
                  readOnly={true}
                  inheritanceDetails={inheritanceDetails}
                  currentVisibleNode={currentVisibleNode}
                  setDisplayDetails={setDisplayDetails}
                  enableEdit={enableEdit}
                  addPart={
                    enableEdit
                      ? (partId: string) => {
                          linkNodeRelation({
                            currentNodeId: currentVisibleNode.id,
                            partId,
                          });
                        }
                      : null
                  }
                  removePart={
                    enableEdit
                      ? (partId: any) => {
                          unlinkNodeRelation(
                            currentVisibleNode.id,
                            partId,
                            -1,
                            0,
                            true,
                          );
                        }
                      : null
                  }
                  user={user}
                  navigateToNode={navigateToNode}
                  replaceWith={replaceWith}
                  skillsFutureApp={skillsFutureApp}
                />
              ) : (
                <InheritedPartsViewer
                  selectedProperty={property}
                  getAllGeneralizations={() =>
                    getAllGeneralizations(currentVisibleNode, nodes)
                  }
                  getGeneralizationParts={getGeneralizationParts}
                  nodes={nodes}
                  readOnly={true}
                  inheritanceDetails={inheritanceDetails}
                  currentVisibleNode={currentVisibleNode}
                  setDisplayDetails={setDisplayDetails}
                  addPart={
                    enableEdit
                      ? (partId: string) => {
                          linkNodeRelation({
                            currentNodeId: currentVisibleNode.id,
                            partId,
                          });
                        }
                      : null
                  }
                  removePart={
                    enableEdit
                      ? (partId: any) => {
                          unlinkNodeRelation(
                            currentVisibleNode.id,
                            partId,
                            -1,
                            0,
                            true,
                          );
                        }
                      : null
                  }
                  navigateToNode={navigateToNode}
                />
              )}
            </>
          )}
        </Box>
        {property === "parts" &&
          enableEdit &&
          selectedProperty !== property && (
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
                  borderRadius: "50%",
                  border: "1px solid orange",
                  mr: "5px",
                }}
              />
              Add new Part
            </Button>
          )}
        {handleCloseAddLinksModel &&
          selectedProperty === property &&
          !selectedCollection && (
            <SelectModel
              onSave={onSave}
              currentVisibleNode={currentVisibleNode}
              nodes={nodes}
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
              skillsFuture={skillsFuture}
              inheritanceDetails={inheritanceDetails}
              skillsFutureApp={skillsFutureApp}
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
    </Slide>
  );
};

export default StructuredProperty;
