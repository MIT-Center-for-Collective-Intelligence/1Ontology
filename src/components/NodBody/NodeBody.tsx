import React, { useCallback, useMemo, useRef, useState } from "react";
import { Box, Button, Paper, Typography, useTheme } from "@mui/material";
import { ICollection, INode } from "@components/types/INode";
import Text from "../OntologyComponents/Text";
import {
  collection,
  deleteField,
  doc,
  getFirestore,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { NODES } from "@components/lib/firestoreClient/collections";
import StructuredProperty from "../StructuredProperty/StructuredProperty";
import { DISPLAY, PROPERTIES_ORDER } from "@components/lib/CONSTANTS";
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
  nodes: { [id: string]: INode };
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
  selectedCollection: string;
  storage: any;
  skillsFuture: boolean;
  enableEdit: boolean;
  skillsFutureApp: string;
  deleteProperty: Function;
}

const NodeBody: React.FC<NodeBodyProps> = ({
  currentVisibleNode,
  setCurrentVisibleNode,
  showListToSelect,
  navigateToNode,
  setSnackbarMessage,
  setSelectedProperty,
  nodes,
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
  storage,
  skillsFuture,
  enableEdit,
  skillsFutureApp,
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

  const removeProperty = async (property: string) => {
    if (
      await confirmIt(
        <Typography>
          Are sure you want delete the property{" "}
          <strong>{DISPLAY[property] || property}</strong>?
        </Typography>,
        "Delete",
        "Keep",
      )
    ) {
      const nodeRef = doc(collection(db, NODES), currentVisibleNode?.id);
      const properties = currentVisibleNode.properties;
      const propertyType = currentVisibleNode.propertyType;
      delete properties[property];
      await updateDoc(nodeRef, { propertyType, properties });
      recordLogs({
        action: "removeProperty",
        node: currentVisibleNode?.id,
        property,
      });
    }
  };

  const updateSpecializationsInheritance = async (
    specializations: ICollection[],
    batch: any,
    property: string,
    propertyValue: any,
    ref: string,
    propertyType: string,
  ) => {
    try {
      let newBatch = batch;
      for (let { nodes: links } of specializations) {
        for (let link of links) {
          const nodeRef = doc(collection(db, NODES), link.id);
          let objectUpdate = {
            [`inheritance.${property}.inheritanceType`]:
              "inheritUnlessAlreadyOverRidden",
            [`properties.${property}`]: propertyValue,
            [`inheritance.${property}.ref`]: ref,
            [`propertyType.${property}`]: propertyType,
          };

          if (newBatch._committed) {
            newBatch = writeBatch(db);
          }
          updateDoc(nodeRef, objectUpdate);

          if (newBatch._mutations.length > 498) {
            await newBatch.commit();
            newBatch = writeBatch(db);
          }

          newBatch = await updateSpecializationsInheritance(
            nodes[link.id].specializations,
            newBatch,
            property,
            propertyValue,
            ref,
            propertyType,
          );
        }
      }

      return newBatch;
    } catch (error) {
      console.error(error);
    }
  };

  const addNewProperty = async (
    newProperty: string,
    newPropertyType: string,
  ) => {
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

      const nodeRef = doc(collection(db, NODES), currentVisibleNode?.id);
      const properties = currentVisibleNode.properties;
      const previousValue = JSON.parse(
        JSON.stringify(currentVisibleNode.properties),
      );
      const propertyType = currentVisibleNode.propertyType;
      const inheritance = currentVisibleNode.inheritance;

      propertyType[newProperty] = newPropertyType.toLowerCase();

      if (newPropertyType.toLowerCase() === "string") {
        properties[newProperty] = "";
      } else if (newPropertyType.toLowerCase() === "numeric") {
        properties[newProperty] = 0;
      } else {
        properties[newProperty] = [{ collectionName: "main", nodes: [] }];
      }
      inheritance[newProperty] = {
        ref: null,
        inheritanceType: "inheritUnlessAlreadyOverRidden",
      };
      setCurrentVisibleNode((prev: any) => {
        const _prev = { ...prev };
        _prev.properties = properties;
        _prev.propertyType = propertyType;
        _prev.inheritance = inheritance;
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
      await updateDoc(nodeRef, {
        properties,
        propertyType,
        inheritance,
      });
      saveNewChangeLog(db, {
        nodeId: currentVisibleNode?.id,
        modifiedBy: user?.uname,
        modifiedProperty: null,
        previousValue,
        newValue: properties,
        modifiedAt: new Date(),
        changeType: "add property",
        fullNode: currentVisibleNode,
        changeDetails: { addedProperty: newProperty },
      });

      setOpenAddProperty(false);

      const batch = writeBatch(db);
      await updateSpecializationsInheritance(
        currentVisibleNode.specializations,
        batch,
        newProperty,
        properties[newProperty],
        currentVisibleNode?.id,
        newPropertyType.toLowerCase(),
      );
      await batch.commit();

      recordLogs({
        action: "add new property",
        node: currentVisibleNode?.id,
        newProperty,
        newPropertyType,
      });
    } catch (error: any) {
      setOpenAddProperty(false);
      recordLogs({
        type: "error",
        error: JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
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

        const currentNode = JSON.parse(JSON.stringify(currentVisibleNode));
        const properties = currentNode.properties;

        if (
          properties.hasOwnProperty(newValue) ||
          newValue.toLowerCase() === "specializations" ||
          newValue.toLowerCase() === "generalizations" ||
          newValue.toLowerCase() === "title"
        ) {
          confirmIt("This property already exist");
          return;
        }

        const nodeRef = doc(collection(db, NODES), currentVisibleNode.id);

        const propertyValue = currentNode.properties[previousValue];
        const propertyType = currentNode.propertyType[previousValue];
        const inheritanceValue = currentNode.inheritance[previousValue];

        let ObjectUpdates = {
          [`propertyType.${previousValue}`]: deleteField(),
          [`properties.${previousValue}`]: deleteField(),
          [`inheritance.${previousValue}`]: deleteField(),
          /* new values */
          [`propertyType.${newValue}`]: propertyType,
          [`properties.${newValue}`]: propertyValue,
          [`inheritance.${newValue}`]: inheritanceValue,
        };
        if (currentNode.textValue && currentNode.textValue[previousValue]) {
          const comments = currentNode.textValue[previousValue];
          ObjectUpdates = {
            ...ObjectUpdates,
            [`textValue.${previousValue}`]: deleteField(),
            [`textValue.${newValue}`]: comments,
          };
        }
        if (currentNode.propertyOf && currentNode.propertyOf[previousValue]) {
          const propertyOfValue = currentNode.propertyOf[previousValue];
          ObjectUpdates = {
            ...ObjectUpdates,
            [`propertyOf.${previousValue}`]: deleteField(),
            [`propertyOf.${newValue}`]: propertyOfValue,
          };
        }
        updateDoc(nodeRef, ObjectUpdates);
        await updateInheritance({
          nodeId: currentVisibleNode.id,
          updatedProperties: [],
          deletedProperties: [],
          editedProperties: [{ previousValue, newValue }],
          db,
        });
        saveNewChangeLog(db, {
          nodeId: currentNode.id,
          modifiedBy: user?.uname,
          modifiedProperty: newValue,
          previousValue,
          newValue,
          modifiedAt: new Date(),
          changeType: "edit property",
          fullNode: currentNode,
          skillsFuture,
          ...(skillsFutureApp ? { appName: skillsFutureApp } : {}),
        });
      } catch (error) {
        console.error(error);
      }
    },
    [user?.uname, currentVisibleNode],
  );

  return (
    <Box>
      <Box>
        {orderOfProperties.map((property: string, index) => {
          const shouldRenderImageManager = property === "References";
          return (
            <React.Fragment key={property}>
              {shouldRenderImageManager && user && !skillsFuture && (
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
                    nodes={nodes}
                    getTitleNode={getTitleNode}
                    enableEdit={enableEdit}
                  />
                </Box>
              )}
              <Box sx={{ mt: "15px" }}>
                {currentNode.propertyType[property] === "string-select" ? (
                  <SelectProperty
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
                    skillsFuture={skillsFuture}
                    enableEdit={enableEdit}
                    skillsFutureApp={skillsFutureApp}
                  />
                ) : currentNode.propertyType[property] === "string-array" ? (
                  <ChipsProperty
                    currentVisibleNode={currentVisibleNode}
                    property={property}
                    nodes={nodes}
                    locked={locked}
                    currentImprovement={currentImprovement}
                    selectedDiffNode={selectedDiffNode}
                    user={user}
                    skillsFuture={skillsFuture}
                    enableEdit={enableEdit}
                    skillsFutureApp={skillsFutureApp}
                  />
                ) : currentNode.propertyType[property] === "numeric" ? (
                  <NumericProperty
                    currentVisibleNode={currentNode}
                    property={property}
                    value={onGetPropertyValue(property)}
                    nodes={nodes}
                    locked={locked}
                    selectedDiffNode={selectedDiffNode}
                    currentImprovement={currentImprovement}
                    skillsFuture={skillsFuture}
                    enableEdit={enableEdit}
                    skillsFutureApp={skillsFutureApp}
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
                    nodes={nodes}
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
                    skillsFuture={skillsFuture}
                    enableEdit={enableEdit}
                    skillsFutureApp={skillsFutureApp}
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
                      nodes={nodes}
                      locked={locked}
                      selectedDiffNode={selectedDiffNode}
                      getTitleNode={getTitleNode}
                      confirmIt={confirmIt}
                      currentImprovement={currentImprovement}
                      skillsFuture={skillsFuture}
                      enableEdit={enableEdit}
                      skillsFutureApp={skillsFutureApp}
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
          (!skillsFuture ||
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
                nodes={nodes}
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
                minWidth: "500px",
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
          skillsFuture={skillsFuture}
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
