import React, { useCallback, useMemo, useState, useEffect, useRef } from "react";
import {
  Box,
  Button,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import ExpandSearchResult from "../OntologyComponents/ExpandSearchResult";
import Text from "../OntologyComponents/Text";
import {
  SCROLL_BAR_STYLE,
  DISPLAY,
  UNCLASSIFIED,
  development,
} from "@components/lib/CONSTANTS";
import { capitalizeFirstLetter } from "@components/lib/utils/string.utils";
import { Post } from "@components/lib/utils/Post";
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
import {
  saveAsInheritancePart,
  getGeneralizationParts,
  breakInheritanceAndCopyParts,
} from "@components/lib/utils/partsHelper";
import { SearchBox } from "../SearchBox/SearchBox";
import { property } from "lodash";

const SelectModel = ({
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
  inheritanceDetails,
  skillsFutureApp,
  linkNodeRelation,
  unlinkNodeRelation,
  relatedNodes,
  fetchNode,
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
  inheritanceDetails?: any;
  skillsFutureApp: string;
  linkNodeRelation: any;
  unlinkNodeRelation: any;
  relatedNodes: { [id: string]: any };
  fetchNode: (nodeId: string) => Promise<any | null>;
}) => {
  const [disabledButton, setDisabledButton] = useState(false);
  const [isUpdatingInheritance, setIsUpdatingInheritance] = useState(false);
  const [glowSearchBox, setGlowSearchBox] = useState(false);
  const [chromaSearchResults, setChromaSearchResults] = useState<any[]>([]);
  const [loadingChromaSearch, setLoadingChromaSearch] = useState(false);
  const [useChromaResults, setUseChromaResults] = useState(false);
  const previousSearchValue = useRef(searchValue);

  const db = getFirestore();

  // Reset to fuse search when user types
  // Will be removed when fuse search is removed
  useEffect(() => {
    if (searchValue !== previousSearchValue.current && useChromaResults) {
      setUseChromaResults(false);
      setChromaSearchResults([]);
    }
    previousSearchValue.current = searchValue;
  }, [searchValue, useChromaResults]);

  // Fetch all child nodes from search results
  const fetchChildNodesForSearchResults = useCallback(async (searchResults: any[]) => {
    if (!fetchNode || searchResults.length === 0) return;

    const childIds = new Set<string>();

    searchResults.forEach(result => {
      // Get specializations
      result.specializations?.forEach((collection: any) => {
        collection.nodes?.forEach((node: any) => {
          if (!relatedNodes[node.id]) {
            childIds.add(node.id);
          }
        });
      });

      // Get generalizations
      result.generalizations?.forEach((collection: any) => {
        collection.nodes?.forEach((node: any) => {
          if (!relatedNodes[node.id]) {
            childIds.add(node.id);
          }
        });
      });

      // Get parts if applicable
      if (result.properties?.parts) {
        result.properties.parts.forEach((collection: any) => {
          collection.nodes?.forEach((node: any) => {
            if (!relatedNodes[node.id]) {
              childIds.add(node.id);
            }
          });
        });
      }
    });

    // Fetch all missing child nodes in parallel
    if (childIds.size > 0) {
      await Promise.all(Array.from(childIds).map(id => fetchNode(id)));
    }
  }, [fetchNode, relatedNodes]);

  // Fetch child nodes for fuse search results
  // Since handleChromaSearch is triggered only by clicking search, useEffect is used here to display child results for fuse searches
  useEffect(() => {
    if (searchValue && searchResultsForSelection.length > 0 && !useChromaResults) {
      fetchChildNodesForSearchResults(searchResultsForSelection);
    }
  }, [searchResultsForSelection, searchValue, useChromaResults, fetchChildNodesForSearchResults]);

  // Handle Chroma search with child node fetching
  const handleChromaSearch = useCallback(async () => {
    const query = searchValue?.trim();

    if (!query || query.length < 3) {
      setUseChromaResults(false);
      setChromaSearchResults([]);
      return;
    }

    const fuseResults = searchResultsForSelection;

    // skip chroma in development
    if (development) {
      setUseChromaResults(false);
      setChromaSearchResults(fuseResults);
      return;
    }

    try {
      setLoadingChromaSearch(true);
      setUseChromaResults(true);

      const response: any = await Post("/searchChroma", {
        query: query,
        skillsFuture,
        appName: skillsFuture ? skillsFutureApp : null,
      });

      let results: any[] = [...(response?.results || [])];

      // Fallback to fuse if no chroma results
      if (results.length === 0 && fuseResults?.length > 0) {
        results = fuseResults.slice();
        setUseChromaResults(false);
      }

      // Ensure exact match is at the top
      const exactResult = fuseResults?.[0];
      if (
        exactResult &&
        exactResult.title?.trim()?.toLowerCase() === query.toLowerCase() &&
        !results.some((r) => r.id === exactResult.id)
      ) {
        results.unshift({ id: exactResult.id, title: exactResult.title });
      }

      setChromaSearchResults(results);

      if (results.length > 0) {
        await fetchChildNodesForSearchResults(results);
      }

    } catch (err) {
      // Fallback to Fuse only
      setUseChromaResults(false);
      setChromaSearchResults(fuseResults);

      if (fuseResults.length > 0) {
        await fetchChildNodesForSearchResults(fuseResults);
      }

    } finally {
      setLoadingChromaSearch(false);
    }
  }, [
    searchValue,
    development,
    skillsFuture,
    skillsFutureApp,
    searchResultsForSelection,
    fetchChildNodesForSearchResults
  ]);

  const refreshEditableProperty = useCallback(() => {
    let freshData: ICollection[] = [];

    if (
      selectedProperty === "specializations" ||
      selectedProperty === "generalizations"
    ) {
      freshData =
        currentVisibleNode[
          selectedProperty as "specializations" | "generalizations"
        ] || [];
    } else {
      freshData =
        onGetPropertyValue(
          relatedNodes,
          currentVisibleNode.inheritance[selectedProperty]?.ref,
          selectedProperty,
        ) ||
        currentVisibleNode?.properties[selectedProperty] ||
        [];
    }

    setEditableProperty([...freshData]);
  }, [selectedProperty, currentVisibleNode, relatedNodes, setEditableProperty]);

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
          relatedNodes,
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
            if (relatedNodes[itemId]) {
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
    relatedNodes,
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
    if (!relatedNodes[id] || newOnes.has(id)) {
      return false;
    }
    const generalizations = relatedNodes[id].generalizations
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
          relatedNodes[fromGeneralizationDropdown.generalizationId];
        const partInGeneralization = getGeneralizationParts(
          fromGeneralizationDropdown.generalizationId,
          relatedNodes,
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
              relatedNodes,
              user,
              skillsFutureApp,
            );
          } else {
            const inheritanceRef = currentVisibleNode.inheritance.parts.ref;
            const referencedNode = relatedNodes[inheritanceRef];

            if (referencedNode) {
              const allPartsFromRef = getGeneralizationParts(
                inheritanceRef,
                relatedNodes,
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
          updated.has(checkedId)
            ? updated.delete(checkedId)
            : updated.add(checkedId);
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
          updated.forEach((collection) => {
            collection.nodes = collection.nodes.filter(
              (n) => n.id !== checkedId,
            );
          });
        } else {
          const targetCollectionName = selectedCollection || "main";
          let targetCollection = updated.find(
            (c) => c.collectionName === targetCollectionName,
          );

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
        updated.has(checkedId)
          ? updated.delete(checkedId)
          : updated.add(checkedId);
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
        updated.has(checkedId)
          ? updated.delete(checkedId)
          : updated.add(checkedId);
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
  const renderSearchOrTree = () => {
    const resultsToDisplay = useChromaResults
      ? chromaSearchResults
      : searchResultsForSelection;

    return searchValue && (
      <ExpandSearchResult
        searchResultsForSelection={resultsToDisplay.slice(0, 10)}
        markItemAsChecked={markItemAsChecked}
        handleCloning={handleCloning}
        checkedItems={checkedItems}
        user={user}
        nodes={relatedNodes}
        cloning={cloning}
        addACloneNodeQueue={_add}
        isSaving={isSaving}
        disabledAddButton={
          selectedProperty === "generalizations" && checkedItems.size === 1
        }
        getNumOfGeneralizations={getNumOfGeneralizations}
        selectedProperty={selectedProperty}
        currentVisibleNode={currentVisibleNode}
      />
    );
  };
  return (
    <Paper
      sx={{
        display: "flex",
        borderRadius: "7px",
        /*      width: "100%",
        height: "100%", */
        // m: "19px",
        border: "2px solid",
        mx: "5px",
        mb: "7px",
      }}
      elevation={6}
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
        {" "}
        {selectedProperty === "parts" && (
          <Box sx={{ display: "flex", ml: "14px", mt: "13px" }}>
            <Typography sx={{ fontSize: "20px" }}>Add new part:</Typography>{" "}
            <Box
              sx={{
                display: "flex",
                pt: 0,
                m: "7px",
                ml: "auto",
                gap: "14px",
              }}
            >
              <IconButton
                onClick={handleCloseAddLinksModel}
                sx={{ borderRadius: "25px", backgroundColor: "gray", p: "2px" }}
              >
                <CloseIcon sx={{ color: "white" }} />
              </IconButton>
            </Box>
          </Box>
        )}
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
            <SearchBox
              setSearch={setSearchValue}
              search={searchValue}
              glowSearchBox={glowSearchBox}
              label="Search ..."
              onSearch={handleChromaSearch}
              loading={loadingChromaSearch}
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
              relatedNodes={relatedNodes}
              fetchNode={fetchNode}
              locked={locked}
              selectedDiffNode={selectedDiffNode}
              confirmIt={confirmIt}
              structured
              currentImprovement={currentImprovement}
              sx={{ borderRadius: "none", backgroundColor: "gray" }}
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

export default SelectModel;
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
