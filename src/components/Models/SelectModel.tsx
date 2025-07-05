import React, { useCallback, useMemo, useState, useEffect } from "react";
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
import InheritedPartsViewer from "../StructuredProperty/InheritedPartsViewer";
import Text from "../OntologyComponents/Text";
import {
  SCROLL_BAR_STYLE,
  DISPLAY,
  UNCLASSIFIED,
} from "@components/lib/CONSTANTS";
import { capitalizeFirstLetter } from "@components/lib/utils/string.utils";
import CloseIcon from "@mui/icons-material/Close";
import { ICollection, ILinkNode, INodeTypes } from "@components/types/INode";
import { NODES } from "@components/lib/firestoreClient/collections";
import {
  getDocs,
  query,
  collection,
  where,
  getFirestore,
  getDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { LoadingButton } from "@mui/lab";
import {
  saveAsInheritancePart,
  getGeneralizationParts,
  getAllGeneralizations,
  breakInheritanceAndCopyParts,
} from "@components/lib/utils/partsHelper";
import { getTitle } from "@components/lib/utils/string.utils";

const SelectModelModal = ({
  handleCloseAddLinksModel,
  onSave,
  selectedProperty,
  currentVisibleNode,
  setSearchValue,
  searchValue,
  searchResultsForSelection,
  handleSaveLinkChanges,
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
  setLoadingIds,
  loadingIds,
  setEditableProperty,
  removedElements,
  addedElements,
  setRemovedElements,
  setAddedElements,
  isSaving,
  scrollToElement,
  selectedCollection,
  skillsFuture,
  saveNewSpecialization,
  setDisplayDetails,
  inheritanceDetails,
  skillsFutureApp,
  linkNodeRelation,
  unlinkNodeRelation,
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
  loadingIds: any;
  setLoadingIds: any;
  editableProperty: ICollection[] | undefined;
  setEditableProperty: any;
  removedElements: Set<string>;
  setRemovedElements: any;
  addedElements: Set<string>;
  setAddedElements: any;
  isSaving: boolean;
  scrollToElement: (nodeId: string) => void;
  selectedCollection: string;
  skillsFuture: boolean;
  saveNewSpecialization: any;
  setDisplayDetails?: any;
  inheritanceDetails?: any;
  skillsFutureApp: string;
  linkNodeRelation: any;
  unlinkNodeRelation: any;
}) => {
  const [disabledButton, setDisabledButton] = useState(false);
  const [isUpdatingInheritance, setIsUpdatingInheritance] = useState(false);
  const [glowSearchBox, setGlowSearchBox] = useState(false);

  const db = getFirestore();

  const refreshEditableProperty = useCallback(() => {
    let freshData: ICollection[] = [];

    if (selectedProperty === "specializations" || selectedProperty === "generalizations") {
      freshData = currentVisibleNode[selectedProperty as "specializations" | "generalizations"] || [];
    } else {
      freshData = onGetPropertyValue(
        nodes,
        currentVisibleNode.inheritance[selectedProperty]?.ref,
        selectedProperty
      ) || currentVisibleNode?.properties[selectedProperty] || [];
    }

    setEditableProperty([...freshData]);
  }, [selectedProperty, currentVisibleNode, nodes, setEditableProperty]);

  // Initialize checkedItems with parts that are already inherited
  useEffect(() => {
    if (
      selectedProperty === "parts" &&
      currentVisibleNode &&
      !isUpdatingInheritance
    ) {
      const partsToCheck = new Set<string>();

      // Case 1: Broken inheritance - add parts from inheritanceParts
      if (currentVisibleNode.inheritanceParts) {
        Object.keys(currentVisibleNode.inheritanceParts).forEach((partId) => {
          partsToCheck.add(partId);
        });
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
          partsToCheck.add(part.id);
        });
      }

      // Add direct parts from the node itself
      if (currentVisibleNode.properties?.parts) {
        currentVisibleNode.properties.parts.forEach((collection: any) => {
          collection.nodes.forEach((part: any) => {
            partsToCheck.add(part.id);
          });
        });
      }

      // Always update checkedItems to reflect current state
      setCheckedItems((prevCheckedItems: Set<string>) => {
        const newCheckedItems = new Set<string>();
        partsToCheck.forEach((partId) => {
          newCheckedItems.add(partId);
        });

        prevCheckedItems.forEach((itemId) => {
          if (!partsToCheck.has(itemId)) {
            // Check if this item is still valid (exists in nodes)
            if (nodes[itemId]) {
              newCheckedItems.add(itemId);
            }
          }
        });

        return newCheckedItems;
      });
    }
  }, [
    selectedProperty,
    currentVisibleNode?.id,
    currentVisibleNode?.inheritanceParts,
    currentVisibleNode?.inheritance?.parts?.ref,
    currentVisibleNode?.properties?.parts,
    setCheckedItems,
    nodes,
    isUpdatingInheritance,
  ]);

  useEffect(() => {
    if (selectedProperty && currentVisibleNode) {
      refreshEditableProperty();
    }
  }, [selectedProperty, currentVisibleNode?.id, refreshEditableProperty]);

  const getSelectingModelTitle = (
    property: string,
    nodeType: string,
    propertyType: INodeTypes,
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
      .filter((n: { id: string }) => n.id !== currentVisibleNode?.id);

    return generalizations.length === 0;
  };

  const markItemAsChecked = async (
    checkedId: string,
    radioSelection = false,
    fromGeneralizationDropdown?: {
      generalizationId: string;
      generalizationTitle: string;
    },
  ) => {
    const removedElements: string[] = [];
    const addedElements: string[] = [];
    const isRemoving = checkedItems.has(checkedId);

    if (isRemoving) {
      removedElements.push(checkedId);
    } else {
      addedElements.push(checkedId);
    }

    setLoadingIds((prev: Set<string>) => new Set(prev).add(checkedId));

    // Handle parts property with new inheritance logic
    if (selectedProperty === "parts" && fromGeneralizationDropdown) {
      // This is a part selected from generalization dropdown - save to inheritanceParts
      setIsUpdatingInheritance(true);
      try {
        const action = isRemoving ? "remove" : "add";
        const hasIntactInheritance =
          currentVisibleNode?.inheritance?.parts?.ref;

        // Check if this part is inherited or direct from the generalization
        const generalizationNode =
          nodes[fromGeneralizationDropdown.generalizationId];
        const partInGeneralization = getGeneralizationParts(
          fromGeneralizationDropdown.generalizationId,
          nodes,
        ).find((p) => p.id === checkedId);

        let inheritedFromId = fromGeneralizationDropdown.generalizationId;
        let inheritedFromTitle = fromGeneralizationDropdown.generalizationTitle;

        // If the part is inherited in the generalization, preserve the original inheritance chain
        if (
          partInGeneralization?.isInherited &&
          generalizationNode?.inheritanceParts?.[checkedId]
        ) {
          const originalInheritance =
            generalizationNode.inheritanceParts[checkedId];
          inheritedFromId = originalInheritance.inheritedFromId;
          inheritedFromTitle = originalInheritance.inheritedFromTitle;
        }

        if (hasIntactInheritance) {
          if (action === "remove") {
            // Break inheritance and copy all parts except the one being removed
            await breakInheritanceAndCopyParts(
              currentVisibleNode?.id,
              checkedId,
              nodes,
              user,
              skillsFutureApp,
            );
          } else {
            const inheritanceRef = currentVisibleNode.inheritance.parts.ref;
            const referencedNode = nodes[inheritanceRef];

            if (referencedNode) {
              const allPartsFromRef = getGeneralizationParts(
                inheritanceRef,
                nodes,
              );

              const nodeDoc = await getDoc(
                doc(collection(getFirestore(), NODES), currentVisibleNode?.id),
              );
              if (nodeDoc.exists()) {
                const currentInheritanceParts =
                  currentVisibleNode?.inheritanceParts || {};
                const newInheritanceParts = { ...currentInheritanceParts };

                // Copy all parts from referenced generalization
                allPartsFromRef.forEach((part) => {
                  if (!newInheritanceParts[part.id]) {
                    newInheritanceParts[part.id] = {
                      inheritedFromTitle: part.isInherited
                        ? referencedNode.inheritanceParts[part.id]
                          .inheritedFromTitle
                        : referencedNode.title,
                      inheritedFromId: part.isInherited
                        ? referencedNode.inheritanceParts[part.id]
                          .inheritedFromId
                        : inheritanceRef,
                    };
                  }
                });

                await updateDoc(nodeDoc.ref, {
                  inheritanceParts: newInheritanceParts,
                  "inheritance.parts.ref": null,
                });
              }
            }

            await saveAsInheritancePart(
              currentVisibleNode?.id,
              checkedId,
              inheritedFromId,
              inheritedFromTitle,
              user,
              "add",
              skillsFutureApp,
            );
          }
        } else {
          // Node already has broken inheritance - directly add/remove
          await saveAsInheritancePart(
            currentVisibleNode?.id,
            checkedId,
            inheritedFromId,
            inheritedFromTitle,
            user,
            action,
            skillsFutureApp,
          );
        }

        // Refresh state after inheritance operations
        refreshEditableProperty();

        setCheckedItems((prev: Set<string>) => {
          const updated = new Set(prev);
          if (updated.has(checkedId)) {
            updated.delete(checkedId);
          } else {
            if (radioSelection) updated.clear();
            updated.add(checkedId);
          }
          if (selectedProperty === "generalizations" && updated.size === 0) {
            return prev;
          }
          return updated;
        });

        // Update newOnes state for inheritance parts
        setNewOnes((prev: Set<string>) => {
          const updated = new Set(prev);
          updated.has(checkedId) ? updated.delete(checkedId) : updated.add(checkedId);
          return updated;
        });
      } catch (error) {
        console.error("Error saving inheritance part:", error);
      } finally {
        setIsUpdatingInheritance(false);
      }
    } else {
      // Existing logic for non-parts properties or direct parts
      setEditableProperty((prev: ICollection[]) => {
        const updated = [...prev];
        if (checkedItems.has(checkedId)) {
          updated.forEach(collection => {
            collection.nodes = collection.nodes.filter(n => n.id !== checkedId);
          });
        } else {
          const targetCollectionName = selectedCollection || "main";
          let targetCollection = updated.find(c => c.collectionName === targetCollectionName);

          if (!targetCollection) {
            targetCollection = { collectionName: "main", nodes: [] };
            updated.push(targetCollection);
          }

          targetCollection.nodes.push({ id: checkedId });
        }
        return updated;
      });

      setAddedElements((prev: Set<string>) => {
        const updated = new Set(prev);
        updated.has(checkedId) ? updated.delete(checkedId) : updated.add(checkedId);
        return updated;
      });

      setCheckedItems((prev: Set<string>) => {
        const updated = new Set(prev);
        if (updated.has(checkedId)) {
          updated.delete(checkedId);
        } else {
          if (radioSelection) updated.clear();
          updated.add(checkedId);
        }
        if (selectedProperty === "generalizations" && updated.size === 0) {
          return prev;
        }
        return updated;
      });

      setNewOnes((prev: Set<string>) => {
        const updated = new Set(prev);
        updated.has(checkedId) ? updated.delete(checkedId) : updated.add(checkedId);
        return updated;
      });

      // Persist changes and refresh state
      try {
        await handleSaveLinkChanges(
          removedElements,
          addedElements,
          selectedProperty,
          currentVisibleNode?.id,
          selectedCollection,
        );

        // Refresh editableProperty after database update
        setTimeout(() => refreshEditableProperty(), 100);
      } catch (error) {
        console.error("Error saving link changes:", error);
      }
    }

    scrollToElement(checkedId);
    setLoadingIds((prev: Set<string>) => {
      const updated = new Set(prev);
      updated.delete(checkedId);
      return updated;
    });
  };

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
      if (selectedCollection) {
        const collectionIdx = _prev.findIndex(
          (c) => c.collectionName === selectedCollection,
        );
        if (collectionIdx !== -1) {
          _prev[collectionIdx].nodes.push({
            id,
          });
        }
      } else {
        const collectionIdx = _prev.findIndex(
          (c) => c.collectionName === "main",
        );

        if (collectionIdx !== -1) {
          _prev[collectionIdx].nodes.push({
            id,
          });
        } else {
          _prev.push({
            collectionName: "main",
            nodes: [
              {
                id,
              },
            ],
          });
        }
      }
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
        where("nodeType", "==", nodeType),
      ),
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

  const triggerSearch = (triggeredValue: { id: string; title: string }) => {
    setSearchValue(triggeredValue.title);
    setExpandedNodes((prev: Set<string>) => {
      const _prev = new Set(prev);
      _prev.add(triggeredValue.id);
      return _prev;
    });
    setGlowSearchBox(true);
    setTimeout(() => {
      setGlowSearchBox(false);
    }, 1000);
  };

  const renderSearchOrTree = () =>
    searchValue ? (
      <ExpandSearchResult
        searchResultsForSelection={searchResultsForSelection.slice(0, 10)}
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
          selectedProperty === "generalizations" ? currentVisibleNode?.id : ""
        }
        preventLoops={getPath(currentVisibleNode?.id, selectedProperty)}
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
        loadingIds={loadingIds}
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
        mx: "5px",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          overflowY: "hidden",
          borderRadius: "19px",
          flexGrow: 1,
          "&::-webkit-scrollbar": {
            display: "none",
          },
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
          <InheritedPartsViewer
            selectedProperty={selectedProperty}
            getAllGeneralizations={() =>
              getAllGeneralizations(currentVisibleNode, nodes)
            }
            getGeneralizationParts={(generalizationId: string) =>
              getGeneralizationParts(generalizationId, nodes)
            }
            getTitle={getTitle}
            nodes={nodes}
            checkedItems={checkedItems}
            markItemAsChecked={markItemAsChecked}
            isSaving={isSaving}
            readOnly={false}
            setDisplayDetails={setDisplayDetails}
            inheritanceDetails={inheritanceDetails}
            currentVisibleNode={currentVisibleNode}
            triggerSearch={triggerSearch}
            addPart={(partId: string) => {
              linkNodeRelation({
                currentNodeId: currentVisibleNode.id,
                partId,
              });
            }}
            removePart={(partId: any) => {
              unlinkNodeRelation(currentVisibleNode.id, partId, -1, 0, true);
            }}
          />
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              pr: "5px",
            }}
          >
            <SearchBox
              setSearch={setSearchValue}
              search={searchValue}
              glowSearchBox={glowSearchBox}
              label="Search ..."
            />
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
                      currentVisibleNode?.id,
                      searchValue,
                    );
                    setEditableProperty((prev: ICollection[]) => {
                      const _prev = [...prev];
                      if (selectedCollection) {
                        const collectionIdx = _prev.findIndex(
                          (c) => c.collectionName === selectedCollection,
                        );
                        if (collectionIdx !== -1) {
                          _prev[collectionIdx].nodes.push({
                            id,
                          });
                        }
                      } else {
                        _prev[0].nodes.push({
                          id,
                        });
                      }
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
                  setSearchValue("");
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
              currentVisibleNode.propertyType[selectedProperty],
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
                  DISPLAY[selectedProperty] || selectedProperty,
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
              skillsFuture={skillsFuture}
              enableEdit={true}
              skillsFutureApp={skillsFutureApp}
            />
          </Box>
        )}
        {/* Save/Cancel Buttons */}
        {/*<Box
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
        </Box> */}
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
