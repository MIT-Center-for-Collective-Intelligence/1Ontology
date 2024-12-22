import React, { useCallback, useMemo, useState } from "react";
import {
  Modal,
  Box,
  Paper,
  Typography,
  Button,
  Tooltip,
  Divider,
} from "@mui/material";

import ExpandSearchResult from "../OntologyComponents/ExpandSearchResult";
import TreeViewSimplified from "../OntologyComponents/TreeViewSimplified";
import { SearchBox } from "../SearchBox/SearchBox";
import Text from "../OntologyComponents/Text";
import {
  SCROLL_BAR_STYLE,
  DISPLAY,
  UNCLASSIFIED,
} from " @components/lib/CONSTANTS";
import { capitalizeFirstLetter } from " @components/lib/utils/string.utils";
import CloseIcon from "@mui/icons-material/Close";
import { ICollection, ILinkNode, INodeTypes } from " @components/types/INode";
import { NODES } from " @components/lib/firestoreClient/collections";
import {
  getDocs,
  query,
  collection,
  where,
  getFirestore,
} from "firebase/firestore";
import { LoadingButton } from "@mui/lab";

const SelectModelModal = ({
  handleCloseAddLinksModel,
  onSave,
  selectedProperty,
  currentVisibleNode,
  setSearchValue,
  searchValue,
  searchResultsForSelection,

  checkedItems,
  setCheckedItems,
  checkedItemsCopy,
  handleCloning,
  user,
  nodes,
  selectFromTree,
  expandedNodes,
  setExpandedNodes,
  handleToggle,
  getPath,
  locked,
  selectedDiffNode,
  confirmIt,
  currentImprovement,
  onGetPropertyValue,
  setCurrentVisibleNode,
  cloning,
  addACloneNodeQueue,
  newOnes,
  setNewOnes,
  setEditableProperty,
  removedElements,
  addedElements,
  setRemovedElements,
  setAddedElements,
  isSaving,
  scrollToElement,
}: {
  onSave: any;
  handleCloseAddLinksModel: any;
  selectedProperty: any;
  currentVisibleNode: any;
  setSearchValue: any;
  searchValue: any;
  searchResultsForSelection: any;
  setCheckedItems: any;
  setCheckedItemsCopy: any;
  checkedItemsCopy: any;
  checkedItems: any;
  handleCloning: any;
  user: any;
  nodes: any;
  selectFromTree: any;
  expandedNodes: any;
  setExpandedNodes: any;
  handleToggle: any;
  getPath: any;
  locked: any;
  selectedDiffNode: any;
  confirmIt: any;
  currentImprovement: any;
  handleSaveLinkChanges: any;
  onGetPropertyValue: any;
  setCurrentVisibleNode: any;
  checkDuplicateTitle: any;
  cloning: string | null;
  addACloneNodeQueue: (nodeId: string, title?: string) => string;
  setClonedNodesQueue: Function;
  clonedNodesQueue: { [nodeId: string]: { title: string; id: string } };
  newOnes: any;
  setNewOnes: any;
  editableProperty: ICollection[] | undefined;
  setEditableProperty: any;
  removedElements: Set<string>;
  setRemovedElements: any;
  addedElements: Set<string>;
  setAddedElements: any;
  isSaving: boolean;
  scrollToElement: (nodeId: string) => void;
}) => {
  const [disabledButton, setDisabledButton] = useState(false);

  const db = getFirestore();
  const getSelectingModelTitle = (
    property: string,
    nodeType: string,
    propertyType: INodeTypes
  ) => {
    if (property === "specializations") {
      property = "specialization";
    } else if (property === "generalizations") {
      property = "generalization";
    } else if (property === "parts") {
      property = "part";
    } else if (property === "evaluationDimension") {
      property = "Evaluation Dimension";
    }
    let displayNodeType: string = propertyType;
    if (
      property === "specialization" ||
      property === "generalization" ||
      property === "parts" ||
      property === "isPartOf"
    ) {
      displayNodeType = nodeType;
    }

    if (displayNodeType === "activity") {
      displayNodeType = "activities";
    } else if (displayNodeType === "evaluationDimension") {
      displayNodeType = "Evaluation Dimensions";
    } else {
      displayNodeType += "s";
    }
    return (
      <div>
        Select the{" "}
        <strong style={{ color: "orange" }}>
          {capitalizeFirstLetter(property)}(s)
        </strong>{" "}
        to add, by searching existing {displayNodeType}, or navigating through
        the ontology.
      </div>
    );
  };
  const getCreateNewButtonText = useMemo(() => {
    let nodeType = currentVisibleNode.propertyType[selectedProperty];
    if (
      selectedProperty === "specializations" ||
      selectedProperty === "generalizations" ||
      selectedProperty === "parts" ||
      selectedProperty === "isPartOf"
    ) {
      nodeType = currentVisibleNode.nodeType;
    }
    return UNCLASSIFIED[nodeType];
  }, [
    currentVisibleNode.nodeType,
    currentVisibleNode.propertyType,
    selectedProperty,
  ]);

  const getNumOfGeneralizations = (id: string) => {
    if (!nodes[id] || newOnes.has(id)) {
      return false;
    }
    const generalizations = nodes[id].generalizations
      .flatMap((c: any) => c.nodes)
      .filter((n: { id: string }) => n.id !== currentVisibleNode.id);

    return generalizations.length === 0;
  };

  const markItemAsChecked = (checkedId: string, radioSelection = false) => {
    setEditableProperty((prev: ICollection[]) => {
      const _prev = [...prev];
      if (checkedItems.has(checkedId)) {
        for (let collection of _prev) {
          collection.nodes = collection.nodes.filter((n) => n.id !== checkedId);
        }
      } else {
        _prev[0].nodes.push({
          id: checkedId,
        });
      }
      return _prev;
    });
    scrollToElement(checkedId);
    setAddedElements((prev: Set<string>) => {
      const _prev = new Set(prev);
      if (_prev.has(checkedId)) {
        _prev.delete(checkedId);
      } else {
        _prev.add(checkedId);
      }

      return _prev;
    });

    setCheckedItems((checkedItems: any) => {
      let _oldChecked = new Set(checkedItems);
      if (_oldChecked.has(checkedId)) {
        _oldChecked.delete(checkedId);
      } else {
        if (radioSelection) {
          _oldChecked = new Set();
        }
        _oldChecked.add(checkedId);
      }
      if (selectedProperty === "generalizations" && _oldChecked.size === 0) {
        return checkedItems;
      }
      return _oldChecked;
    });
    setNewOnes((newOnes: any) => {
      let _oldChecked = new Set(newOnes);
      if (_oldChecked.has(checkedId)) {
        _oldChecked.delete(checkedId);
      } else {
        _oldChecked.add(checkedId);
      }
      return _oldChecked;
    });
  };

  const unlinkElement = (id: string, collectionIdx: number) => {
    setEditableProperty((prev: ICollection[]) => {
      const _prev = [...prev];
      _prev[collectionIdx].nodes = _prev[collectionIdx].nodes.filter(
        (n: ILinkNode) => n.id !== id
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
  };

  // const propertyValue: ICollection[] = useMemo(() => {
  //   try {
  //     let result = null;
  //     if (
  //       selectedProperty === "specializations" ||
  //       selectedProperty === "generalizations"
  //     ) {
  //       result =
  //         currentVisibleNode[
  //           selectedProperty as "specializations" | "generalizations"
  //         ];
  //     } else {
  //       result =
  //         getPropertyValue(
  //           nodes,
  //           currentVisibleNode.inheritance[selectedProperty]?.ref,
  //           selectedProperty
  //         ) || currentVisibleNode?.properties[selectedProperty];
  //     }
  //     return result;
  //   } catch (error) {
  //     console.error(error);
  //   }
  // }, [
  //   currentVisibleNode,
  //   nodes,
  //   selectedProperty,
  //   selectedDiffNode,
  // ]) as ICollection[];

  const _add = (nodeId: string, title?: string) => {
    const id = addACloneNodeQueue(nodeId, title);

    setEditableProperty((prev: ICollection[]) => {
      const _prev = [...prev];
      _prev[0].nodes.push({
        id,
      });
      return _prev;
    });
    setAddedElements((prev: Set<string>) => {
      prev.add(id);
      return prev;
    });
    scrollToElement(id);
  };

  const cloneUnclassifiedNode = async () => {
    let nodeType = currentVisibleNode.propertyType[selectedProperty];
    if (
      selectedProperty === "parts" ||
      selectedProperty === "isPartOf" ||
      selectedProperty === "specializations" ||
      selectedProperty === "generalizations"
    ) {
      nodeType = currentVisibleNode.nodeType;
    }
    const unclassifiedNodeDocs = await getDocs(
      query(
        collection(db, NODES),
        where("unclassified", "==", true),
        where("nodeType", "==", nodeType)
      )
    );
    if (unclassifiedNodeDocs.docs.length > 0) {
      const unclassifiedId = unclassifiedNodeDocs.docs[0].id;
      // handleCloning({ id: unclassifiedId }, searchValue);
      const id = addACloneNodeQueue(unclassifiedId, searchValue);
      setEditableProperty((prev: ICollection[]) => {
        const _prev = [...prev];
        _prev[0].nodes.push({
          id,
        });
        return _prev;
      });
      setAddedElements((prev: Set<string>) => {
        prev.add(id);
        return prev;
      });
    }
  };
  const renderSearchOrTree = () =>
    searchValue ? (
      <ExpandSearchResult
        searchResultsForSelection={searchResultsForSelection}
        markItemAsChecked={markItemAsChecked}
        handleCloning={handleCloning}
        checkedItems={checkedItems}
        user={user}
        nodes={nodes}
        cloning={cloning}
        addACloneNodeQueue={_add}
        isSaving={isSaving}
        disabledAddButton={
          selectedProperty === "generalizations" && checkedItems.size === 1
        }
        getNumOfGeneralizations={getNumOfGeneralizations}
        selectedProperty={selectedProperty}
      />
    ) : (
      <TreeViewSimplified
        treeVisualization={selectFromTree()}
        expandedNodes={expandedNodes}
        setExpandedNodes={setExpandedNodes}
        onOpenNodesTree={handleToggle}
        markItemAsChecked={(id: string) =>
          markItemAsChecked(id, selectedProperty === "context")
        }
        checkedItems={checkedItems}
        handleCloning={handleCloning}
        clone
        stopPropagation={
          selectedProperty === "generalizations" ? currentVisibleNode.id : ""
        }
        preventLoops={getPath(currentVisibleNode.id, selectedProperty)}
        manageLock={user?.manageLock}
        cloning={cloning}
        addACloneNodeQueue={_add}
        isSaving={isSaving}
        disabledAddButton={
          checkedItems.size === 1 && selectedProperty === "generalizations"
        }
        selectedProperty={selectedProperty}
        getNumOfGeneralizations={getNumOfGeneralizations}
        currentVisibleNode={currentVisibleNode}
      />
    );
  return (
    <Paper
      sx={{
        display: "flex",
        borderRadius: "19px",
        /*      width: "100%",
        height: "100%", */
        // m: "19px",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          borderRadius: "19px",
          ...SCROLL_BAR_STYLE,
          width: "00px",
          flexGrow: 1,
        }}
      >
        <Box
          sx={{
            position: "sticky",
            top: 0,
            // width: "950px",
            // zIndex: 1,
            backgroundColor: (theme) =>
              theme.palette.mode === "light" ? "#f0f0f0" : "#303134",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              pr: "5px",
            }}
          >
            <SearchBox setSearchValue={setSearchValue} label="Search ..." />
            <Tooltip
              title={`Create as a new Specialization 
                    ${
                      selectedProperty !== "specializations"
                        ? `Under ${getCreateNewButtonText}`
                        : ""
                    } Node`}
            >
              <Button
                onClick={async () => {
                  setDisabledButton(true);
                  if (selectedProperty === "specializations") {
                    const id = addACloneNodeQueue(
                      currentVisibleNode.id,
                      searchValue
                    );
                    setEditableProperty((prev: ICollection[]) => {
                      const _prev = [...prev];
                      _prev[0].nodes.push({
                        id,
                      });
                      return _prev;
                    });
                    setAddedElements((prev: Set<string>) => {
                      prev.add(id);
                      return prev;
                    });
                    // await addNewSpecialization(
                    //   selectedCategory || "main",
                    //   searchValue
                    // );
                  } else {
                    await cloneUnclassifiedNode();
                  }
                  setDisabledButton(false);
                }}
                sx={{ borderRadius: "18px" /* , minWidth: "300px" */ }}
                variant="outlined"
                disabled={
                  isSaving ||
                  searchValue.length < 3 ||
                  searchResultsForSelection[0]?.title.trim() ===
                    searchValue.trim() ||
                  disabledButton
                }
              >
                Create{" "}
                {selectedProperty !== "specializations"
                  ? "Under " + getCreateNewButtonText
                  : ""}
              </Button>
            </Tooltip>
          </Box>
        </Box>
        {selectedProperty === "specializations" ? (
          <Typography sx={{ pl: "15px" }}>
            Select the{" "}
            <strong style={{ color: "orange" }}>Specialization</strong> to add,
            by either:
            <ul>
              <li>
                {" "}
                <strong style={{ color: "orange" }}> A) </strong> Searching
                existing{" "}
                {currentVisibleNode.nodeType === "activity"
                  ? "activities"
                  : currentVisibleNode.nodeType === "evaluationDimension"
                  ? "Evaluation Dimensions"
                  : currentVisibleNode.nodeType + "s"}
              </li>
              <li>
                <strong style={{ color: "orange" }}> B) </strong> Navigating
                through the ontology{" "}
              </li>
              <li>
                <strong style={{ color: "orange" }}> C) </strong>
                Creating what you searched as a new specialization
              </li>
            </ul>
          </Typography>
        ) : (
          <Typography sx={{ pl: "15px" }}>
            {getSelectingModelTitle(
              selectedProperty,
              currentVisibleNode.nodeType,
              currentVisibleNode.propertyType[selectedProperty]
            )}
          </Typography>
        )}
        <Box
          sx={{
            flexGrow: 1,
            overflowY: "auto",
            px: "4px",
            backgroundColor: (theme) =>
              theme.palette.mode === "dark" ? "#242425" : "#d0d5dd",
            py: "12px",
            ...SCROLL_BAR_STYLE,
          }}
        >
          {renderSearchOrTree()}
        </Box>
        {selectedProperty !== "context" && (
          <Box
            sx={{
              p: "16px",
              mt: "auto",
              // width: "950px",
            }}
          >
            <Typography sx={{ mb: "4px" }}>
              If you cannot find the existing{" "}
              <strong>
                {capitalizeFirstLetter(
                  DISPLAY[selectedProperty] || selectedProperty
                )}
              </strong>{" "}
              to link, you can describe them below:
            </Typography>
            <Text
              text={onGetPropertyValue(selectedProperty, true) as string}
              currentVisibleNode={currentVisibleNode}
              property={selectedProperty}
              setCurrentVisibleNode={setCurrentVisibleNode}
              nodes={nodes}
              locked={locked}
              selectedDiffNode={selectedDiffNode}
              confirmIt={confirmIt}
              structured
              currentImprovement={currentImprovement}
              sx={{ borderRadius: "none", backgroundColor: "" }}
              getTitleNode={() => {}}
            />
          </Box>
        )}
        {/* Save/Cancel Buttons */}
        <Box
          sx={{
            display: "flex",
            pt: 0,
            ml: "auto",
            gap: "14px",
            justifyContent: "space-between",
            m: 2,
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
            sx={{ borderRadius: "25px", color: "white" }}
            disabled={addedElements.size === 0 && removedElements.size === 0}
          >
            Save
          </LoadingButton>
        </Box>
      </Box>{" "}
    </Paper>
  );
};

export default SelectModelModal;
{
  /* Selected Items Section */
}
{
  /*       <Box sx={{ width: "30%" }}>
        <CollectionStructure
          model={true}
          locked={locked}
          selectedDiffNode={selectedDiffNode}
          currentImprovement={currentImprovement}
          property={selectedProperty}
          propertyValue={editableProperty}
          openAddCollection={openAddCollection}
          setOpenAddCollection={setOpenAddCollection}
          clonedNodesQueue={clonedNodesQueue}
          currentVisibleNode={currentVisibleNode}
          setCurrentVisibleNode={setCurrentVisibleNode}
          nodes={nodes}
          confirmIt={confirmIt}
          setEditableProperty={setEditableProperty}
          unlinkElement={unlinkElement}
          addACloneNodeQueue={addACloneNodeQueue}
          unlinkVisible={unlinkVisible}
          getCategoryStyle={() => {}}
          navigateToNode={() => {}}
          setSnackbarMessage={() => {}}
          showListToSelect={() => {}}
          logChange={() => {}}
        />
      </Box> */
}
