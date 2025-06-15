import React, { useCallback, useMemo, useState } from "react";
import {
  Box,
  Button,
  Typography,
  Tooltip,
  Paper,
  useTheme,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import {
  capitalizeFirstLetter,
  getPropertyValue,
  getTitle,
  getTooltipHelper,
} from "@components/lib/utils/string.utils";
import {
  getGeneralizationParts,
  getAllGeneralizations,
} from "@components/lib/utils/partsHelper";
import { ICollection, ILinkNode, INode } from "@components/types/INode";
import { DISPLAY } from "@components/lib/CONSTANTS";
import { useAuth } from "../context/AuthContext";
import { collection, doc, getFirestore } from "firebase/firestore";
import { recordLogs } from "@components/lib/utils/helpers";
import SelectInheritance from "../SelectInheritance/SelectInheritance";
import MarkdownRender from "../Markdown/MarkdownRender";
import VisualizeTheProperty from "./VisualizeTheProperty";
import CollectionStructure from "./CollectionStructure";
import SelectModelModal from "../Models/SelectModel";
import { LoadingButton } from "@mui/lab";
import PropertyContributors from "./PropertyContributors";
import { NODES } from "@components/lib/firestoreClient/collections";
import CommentsSection from "./CommentsSection";
import InheritedPartsViewer from "./InheritedPartsViewer";

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
}: IStructuredPropertyProps) => {
  const theme = useTheme();
  const [openAddCollection, setOpenAddCollection] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const BUTTON_COLOR = theme.palette.mode === "dark" ? "#373739" : "#dde2ea";
  const [modifiedOrder, setModifiedOrder] = useState(false);
  const [displayDetails, setDisplayDetails] = useState(false);
  const [showComments, setShowComments] = useState(false);

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

  if (
    (currentImprovement &&
      !currentImprovement.implemented &&
      !currentImprovement?.newNode &&
      currentImprovement.modifiedProperty === property) ||
    (selectedDiffNode?.modifiedProperty === property &&
      selectedDiffNode.changeType !== "add collection" &&
      selectedDiffNode.changeType !== "delete collection" &&
      selectedDiffNode.changeType !== "edit collection")
  ) {
    return (
      <Box id={`property-${property}`}>
        <VisualizeTheProperty
          currentImprovement={selectedDiffNode || currentImprovement}
          property={property}
          getTitle={getTitle}
          nodes={nodes}
        />
      </Box>
    );
  }

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
            <Tooltip title={getTooltipHelper(property)}>
              <Typography
                sx={{
                  fontSize: "20px",
                  fontWeight: 500,
                  fontFamily: "Roboto, sans-serif",
                }}
              >
                {capitalizeFirstLetter(
                  DISPLAY[property] ? DISPLAY[property] : property,
                )}
              </Typography>
            </Tooltip>{" "}
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

          {selectedProperty === property && !selectedCollection && (
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
                {property !== "specializations" && (
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

        {currentVisibleNode.propertyType[property] !== "array-string" && (
          <CollectionStructure
            locked={locked}
            selectedDiffNode={selectedDiffNode}
            currentImprovement={currentImprovement}
            property={property}
            propertyValue={
              selectedProperty === property
                ? (editableProperty ?? [])
                : (propertyValue ?? [])
            }
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
          />
        )}
        {property === "parts" && !displayDetails && (
          <Button
            variant="outlined"
            sx={{ borderRadius: "25px", p: 0.5, px: 2, ml: "10px", mb: "9px" }}
            onClick={() => {
              setDisplayDetails((prev) => !prev);
            }}
          >
            <KeyboardArrowDownIcon />
            Inherited From
          </Button>
        )}
        {displayDetails &&
          property === "parts" &&
          selectedProperty !== property &&
          !selectedDiffNode &&
          !currentImprovement && (
            <InheritedPartsViewer
              selectedProperty={property}
              getAllGeneralizations={() =>
                getAllGeneralizations(currentVisibleNode, nodes)
              }
              getGeneralizationParts={(generalizationId: string) =>
                getGeneralizationParts(generalizationId, nodes)
              }
              getTitle={getTitle}
              nodes={nodes}
              checkedItems={getInheritedPartsSet()}
              markItemAsChecked={() => {}}
              isSaving={false}
              readOnly={true}
              setDisplayDetails={setDisplayDetails}
              inheritanceDetails={inheritanceDetails}
              currentVisibleNode={currentVisibleNode}
            />
          )}
      </Box>
      {handleCloseAddLinksModel &&
        selectedProperty === property &&
        !selectedCollection && (
          <SelectModelModal
            onSave={onSave}
            currentVisibleNode={currentVisibleNode}
            nodes={nodes}
            handleCloseAddLinksModel={handleCloseAddLinksModel}
            selectedProperty={selectedProperty}
            setSearchValue={setSearchValue}
            searchValue={searchValue}
            searchResultsForSelection={searchResultsForSelection}
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
            setDisplayDetails={setDisplayDetails}
            inheritanceDetails={inheritanceDetails}
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
  );
};

export default StructuredProperty;
