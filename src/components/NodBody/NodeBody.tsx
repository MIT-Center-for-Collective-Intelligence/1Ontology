import React, { useCallback, useMemo, useRef, useState } from "react";
import { Box, Button, Paper, Typography, useTheme } from "@mui/material";
import { ICollection, INode } from "@components/types/INode";
import Text from "../OntologyComponents/Text";
import { getFirestore } from "firebase/firestore";
import { Post } from "@components/lib/utils/Post";
import StructuredProperty from "../StructuredProperty/StructuredProperty";
import { PROPERTIES_ORDER } from "@components/lib/CONSTANTS";
import {
  recordLogs,
  saveNewChangeLog,
  updateInheritance,
} from "@components/lib/utils/helpers";
import AddPropertyForm from "../AddPropertyForm/AddPropertyForm";
import { useAuth } from "../context/AuthContext";
import ChipsProperty from "../StructuredProperty/ChipsProperty";
import { NodeImageManager } from "./NodeImageManager";
import { DisplayAddedRemovedProperty } from "../StructuredProperty/DisplayAddedRemovedProperty";
import SelectProperty from "../StructuredProperty/SelectProprety";
import NumericProperty from "../StructuredProperty/NumericProperty";

interface NodeBodyProps {
  currentVisibleNode: INode;
  setCurrentVisibleNode: Function;
  showListToSelect: Function;
  navigateToNode: Function;
  setSnackbarMessage: Function;
  setSelectedProperty: Function;
  relatedNodes: { [id: string]: INode };
  fetchNode: (nodeId: string) => Promise<INode | null>;
  locked: boolean;
  selectedDiffNode: any;
  getTitleNode: any;
  confirmIt: any;
  onGetPropertyValue: any;
  currentImprovement: any;
  /*  */
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
  selectedCollection: string;
  storage: any;
  appName?: string;
  enableEdit: boolean;
  deleteProperty: Function;
}

const NodeBody: React.FC<NodeBodyProps> = ({
  currentVisibleNode,
  setCurrentVisibleNode,
  showListToSelect,
  navigateToNode,
  setSnackbarMessage,
  setSelectedProperty,
  relatedNodes,
  fetchNode,
  locked,
  selectedDiffNode,
  getTitleNode,
  confirmIt,
  onGetPropertyValue,
  currentImprovement,
  /*  */
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
  storage,
  appName,
  enableEdit,
  deleteProperty,
}) => {
  const theme = useTheme();
  const BUTTON_COLOR = theme.palette.mode === "dark" ? "#373739" : "#dde2ea";
  const db = getFirestore();
  const [openAddProperty, setOpenAddProperty] = useState(false);
  const [{ user }] = useAuth();
  const scrollRef = useRef<any>(null);

  const currentNode = useMemo(() => {
    if (
      selectedDiffNode &&
      (selectedDiffNode?.changeType === "add property" ||
        selectedDiffNode?.changeType === "add property")
    ) {
      return selectedDiffNode.fullNode;
    } else {
      return currentVisibleNode;
    }
  }, [currentVisibleNode, selectedDiffNode]);

  const addNewProperty = async (
    newProperty: string,
    newPropertyType: string,
  ) => {
    // Captured outside `try` so the catch can roll back / report against the
    // node the property was added to, even if the user has since navigated.
    const targetNodeId = currentVisibleNode?.id;
    const targetNodeTitle = currentVisibleNode?.title ?? "";
    try {
      if (!user) return;
      if (newProperty in currentVisibleNode.properties) {
        await confirmIt(
          `The property ${newProperty} already exist under this node`,
          "Ok",
          "",
        );
        return;
      }
      if (!newProperty.trim() || !newPropertyType.trim()) return;

      const normalizedType = newPropertyType.toLowerCase();
      const propertyValue =
        normalizedType === "string"
          ? ""
          : normalizedType === "numeric"
            ? 0
            : [{ collectionName: "main", nodes: [] }];

      // Show the new (empty) property instantly.
      setCurrentVisibleNode((prev: any) => {
        const _prev = { ...prev };
        _prev.properties = {
          ...(_prev.properties || {}),
          [newProperty]: propertyValue,
        };
        _prev.propertyType = {
          ...(_prev.propertyType || {}),
          [newProperty]: normalizedType,
        };
        _prev.inheritance = {
          ...(_prev.inheritance || {}),
          [newProperty]: {
            ref: null,
            title: "",
            inheritanceType: "inheritUnlessAlreadyOverRidden",
          },
        };
        return _prev;
      });
      setTimeout(() => {
        const element = document.getElementById(`property-${newProperty}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });

          element.style.transition = "box-shadow 0.3s ease";
          element.style.boxShadow = "0 0 0 3px limegreen";

          setTimeout(() => {
            element.style.boxShadow = "";
          }, 2000);
        }
      }, 500);

      setOpenAddProperty(false);

      await Post("/nodes/properties/update", {
        action: "add",
        nodeId: targetNodeId,
        propertyName: newProperty,
        propertyType: newPropertyType,
        ...(appName ? { appName } : {}),
      });

      recordLogs({
        action: "add new property",
        node: currentVisibleNode?.id,
        newProperty,
        newPropertyType,
      });
    } catch (error: any) {
      setOpenAddProperty(false);

      // The write failed, so no snapshot will arrive to undo the instant
      // update — reset from the source of truth (only if still on that node).
      const fresh = await fetchNode(targetNodeId);
      setCurrentVisibleNode((prev: any) =>
        prev?.id === targetNodeId && fresh ? fresh : prev,
      );

      const reason =
        (typeof error === "string" ? error : error?.message) ||
        "Please try again.";
      setSnackbarMessage(
        `Failed to add property "${newProperty}" to "${targetNodeTitle}": ${reason}`,
      );

      recordLogs({
        type: "error",
        error: JSON.stringify({
          name: error?.name,
          message: typeof error === "string" ? error : error?.message,
          stack: error?.stack,
        }),
        action: "add new property (failed)",
        node: targetNodeId,
      });
    }
  };

  const orderOfProperties = useMemo(() => {
    const priorityOrder = PROPERTIES_ORDER[currentVisibleNode.nodeType] || [];

    let properties = null;
    if (
      (selectedDiffNode && selectedDiffNode?.changeType === "add property") ||
      selectedDiffNode?.changeType === "add property"
    ) {
      properties = selectedDiffNode?.fullNode.properties;
    } else {
      properties = currentVisibleNode.properties;
    }

    const sortedKeys = Object.keys(properties || {})
      .filter(
        (p) =>
          p !== "parts" &&
          p !== "isPartOf" &&
          p !== "description" &&
          p !== "actor" &&
          p !== "alternatives" &&
          p !== "context" &&
          p !== "images",
      )
      .sort((a, b) => {
        const indexA = priorityOrder.indexOf(a);
        const indexB = priorityOrder.indexOf(b);

        // Force "References" to be placed at the bottom
        if (a === "References") return 1;
        if (b === "References") return -1;

        if (indexA !== -1 && indexB !== -1) return indexA - indexB;

        if (indexA !== -1) return -1;

        if (indexB !== -1) return 1;

        return a.localeCompare(b);
      });

    return sortedKeys;
  }, [currentVisibleNode, selectedDiffNode]);

  const hasReferences = orderOfProperties.includes("References");

  const modifyProperty = useCallback(
    async ({
      newValue,
      previousValue,
    }: {
      newValue: string;
      previousValue: string;
    }) => {
      try {
        if (!user?.uname) return;

        const properties = currentVisibleNode.properties || {};

        if (
          properties.hasOwnProperty(newValue) ||
          newValue.toLowerCase() === "specializations" ||
          newValue.toLowerCase() === "generalizations" ||
          newValue.toLowerCase() === "title"
        ) {
          confirmIt("This property already exist");
          return;
        }

        // Captured before the await so the failure path can revert / report
        // against the right node even if the user navigates away mid-flight.
        const targetNodeId = currentVisibleNode?.id;
        const targetNodeTitle = currentVisibleNode?.title ?? "";

        // Move a property key from `from` -> `to` across all of a node's maps.
        const renameKeyInNode = (node: any, from: string, to: string) => {
          const _node = { ...node };
          for (const mapName of [
            "properties",
            "propertyType",
            "inheritance",
            "textValue",
            "propertyOf",
          ]) {
            const map = _node[mapName];
            if (map && Object.prototype.hasOwnProperty.call(map, from)) {
              const { [from]: val, ...rest } = map;
              _node[mapName] = { ...rest, [to]: val };
            }
          }
          return _node;
        };

        // Rename instantly on the current node.
        setCurrentVisibleNode((prev: any) =>
          !prev || prev.id !== targetNodeId
            ? prev
            : renameKeyInNode(prev, previousValue, newValue),
        );

        try {
          await Post("/nodes/properties/update", {
            action: "rename",
            nodeId: targetNodeId,
            previousValue,
            newValue,
            ...(appName ? { appName } : {}),
          });
        } catch (error: any) {
          // The write failed, so no snapshot will arrive to undo the instant
          // update — reset from truth (only if still on that node).
          const fresh = await fetchNode(targetNodeId);
          setCurrentVisibleNode((prev: any) =>
            prev?.id === targetNodeId && fresh ? fresh : prev,
          );
          const reason =
            (typeof error === "string" ? error : error?.message) ||
            "Please try again.";
          setSnackbarMessage(
            `Failed to rename property "${previousValue}" on "${targetNodeTitle}": ${reason}`,
          );
          recordLogs({
            type: "error",
            error: JSON.stringify({
              name: error?.name,
              message: typeof error === "string" ? error : error?.message,
              stack: error?.stack,
            }),
            action: "rename property (failed)",
            node: targetNodeId,
          });
        }
      } catch (error) {
        console.error(error);
      }
    },
    [user?.uname, currentVisibleNode, appName, fetchNode],
  );

  return (
    <Box>
      <Box>
        {orderOfProperties.map((property: string, index) => {
          const shouldRenderImageManager = property === "References";
          return (
            <React.Fragment key={property}>
              {shouldRenderImageManager && user && !appName && (
                <Box sx={{ mt: "15px" }}>
                  <NodeImageManager
                    nodeId={currentVisibleNode?.id}
                    currentVisibleNode={currentVisibleNode}
                    user={user}
                    firestore={db}
                    storage={storage}
                    confirmIt={confirmIt}
                    saveNewChangeLog={saveNewChangeLog}
                    selectedDiffNode={selectedDiffNode}
                    nodes={relatedNodes}
                    getTitleNode={getTitleNode}
                    enableEdit={enableEdit}
                  />
                </Box>
              )}
              <Box sx={{ mt: "15px" }}>
                {currentNode.propertyType[property] === "string-select" ? (
                  <></>
                ) : /*    <SelectProperty
                    currentVisibleNode={currentVisibleNode}
                    property={property}
                    nodes={nodes}
                    selectedDiffNode={selectedDiffNode}
                    currentImprovement={currentImprovement}
                    user={user}
                    options={[
                      "a single human",
                      "collaboration of humans",
                      "collaboration of humans and ai",
                      "ai",
                    ]}
                    enableEdit={enableEdit}
                    appName={appName}
                  /> */
                currentNode.propertyType[property] === "string-array" ? (
                  <ChipsProperty
                    currentVisibleNode={currentVisibleNode}
                    property={property}
                    relatedNodes={relatedNodes}
                    fetchNode={fetchNode}
                    locked={locked}
                    currentImprovement={currentImprovement}
                    selectedDiffNode={selectedDiffNode}
                    user={user}
                    enableEdit={enableEdit}
                    appName={appName}
                  />
                ) : currentNode.propertyType[property] === "numeric" ? (
                  <NumericProperty
                    currentVisibleNode={currentNode}
                    property={property}
                    value={onGetPropertyValue(property)}
                    relatedNodes={relatedNodes}
                    fetchNode={fetchNode}
                    locked={locked}
                    selectedDiffNode={selectedDiffNode}
                    currentImprovement={currentImprovement}
                    enableEdit={enableEdit}
                    appName={appName}
                    deleteProperty={deleteProperty}
                    modifyProperty={modifyProperty}
                  />
                ) : currentNode.propertyType[property] !== "string" ? (
                  <StructuredProperty
                    key={property + index}
                    confirmIt={confirmIt}
                    selectedDiffNode={selectedDiffNode}
                    currentVisibleNode={currentNode}
                    editStructuredProperty={showListToSelect}
                    setSelectedProperty={setSelectedProperty}
                    navigateToNode={navigateToNode}
                    setSnackbarMessage={setSnackbarMessage}
                    setCurrentVisibleNode={setCurrentVisibleNode}
                    property={property}
                    relatedNodes={relatedNodes}
                    fetchNode={fetchNode}
                    locked={locked}
                    onGetPropertyValue={onGetPropertyValue}
                    currentImprovement={currentImprovement}
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
                    setLoadingIds={setLoadingIds}
                    editableProperty={editableProperty}
                    setEditableProperty={setEditableProperty}
                    removedElements={removedElements}
                    setRemovedElements={setRemovedElements}
                    addedElements={addedElements}
                    setAddedElements={setAddedElements}
                    glowIds={glowIds}
                    setGlowIds={setGlowIds}
                    selectedCollection={selectedCollection}
                    enableEdit={enableEdit}
                    appName={appName}
                    deleteProperty={deleteProperty}
                    modifyProperty={modifyProperty}
                  />
                ) : (
                  property !== "description" &&
                  currentNode.propertyType[property] === "string" && (
                    <Text
                      text={onGetPropertyValue(property)}
                      currentVisibleNode={currentNode}
                      property={property}
                      setCurrentVisibleNode={setCurrentVisibleNode}
                      relatedNodes={relatedNodes}
                      fetchNode={fetchNode}
                      locked={locked}
                      selectedDiffNode={selectedDiffNode}
                      getTitleNode={getTitleNode}
                      confirmIt={confirmIt}
                      currentImprovement={currentImprovement}
                      enableEdit={enableEdit}
                      appName={appName}
                      deleteProperty={deleteProperty}
                      modifyProperty={modifyProperty}
                    />
                  )
                )}
              </Box>
            </React.Fragment>
          );
        })}
        {selectedDiffNode &&
          selectedDiffNode.changeType === "remove property" && (
            <DisplayAddedRemovedProperty selectedDiffNode={selectedDiffNode} />
          )}
        {!hasReferences &&
          user &&
          (!appName ||
            currentVisibleNode.appName === "Top-Down Gemini 2.5 Pro") && (
            <Box sx={{ mt: "15px" }}>
              <NodeImageManager
                nodeId={currentVisibleNode?.id}
                currentVisibleNode={currentVisibleNode}
                user={user}
                firestore={db}
                storage={storage}
                confirmIt={confirmIt}
                saveNewChangeLog={saveNewChangeLog}
                selectedDiffNode={selectedDiffNode}
                nodes={relatedNodes}
                getTitleNode={getTitleNode}
                enableEdit={enableEdit}
              />
            </Box>
          )}
        {selectedDiffNode?.changeType === "edit property" &&
          !(selectedDiffNode.newValue in currentVisibleNode.properties) && (
            <Paper
              id={`property-${selectedDiffNode.modifiedProperty}`}
              elevation={9}
              sx={{
                borderRadius: "30px",
                borderBottomRightRadius: "18px",
                borderBottomLeftRadius: "18px",
                width: "100%",
                maxHeight: "100%",
                overflow: "auto",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                overflowX: "hidden",
                pb: "10px",
                mt: "14px",
                minHeight: "100px",
              }}
            >
              {" "}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  background: (theme: any) =>
                    theme.palette.mode === "dark" ? "#242425" : "#d0d5dd",
                  p: 3,
                  gap: "10px",
                }}
              >
                {" "}
                <Typography
                  sx={{
                    fontSize: "20px",
                    fontWeight: 500,
                    fontFamily: "Roboto, sans-serif",
                    color: "red",
                    textDecoration: "line-through",
                  }}
                >
                  {selectedDiffNode.previousValue}
                </Typography>
                <Typography
                  sx={{
                    fontSize: "20px",
                    fontWeight: 500,
                    fontFamily: "Roboto, sans-serif",
                    color: "green",
                  }}
                >
                  {selectedDiffNode.newValue}
                </Typography>
              </Box>
            </Paper>
          )}
      </Box>
      {!locked && openAddProperty && (
        <AddPropertyForm
          addNewProperty={addNewProperty}
          setOpenAddProperty={setOpenAddProperty}
          locked={locked}
          exitingProperties={Object.keys(currentVisibleNode.properties || {})}
          appName={appName}
        />
      )}
      {!locked && !openAddProperty && !currentImprovement && (
        <Button
          onClick={() => {
            setOpenAddProperty(true);
            if (scrollRef.current) {
              setTimeout(() => {
                scrollRef.current.scrollIntoView({
                  behavior: "smooth",
                  block: "end",
                });
              }, 10);
            }
          }}
          variant="outlined"
          sx={{
            borderRadius: "18px",
            backgroundColor: BUTTON_COLOR,
            mt: "15px",
            display: !enableEdit ? "none" : "block",
          }}
        >
          Add New Property
        </Button>
      )}
      <div ref={scrollRef}></div>
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
