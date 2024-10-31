import React, { useRef, useState } from "react";
import {
  Modal,
  Box,
  Paper,
  Typography,
  Button,
  Checkbox,
  IconButton,
  TextField,
  Tooltip,
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
import LinkEditor from "../LinkNode/LinkEditor";
import { INodeTypes } from " @components/types/INode";
import { NODES } from " @components/lib/firestoreClient/collections";
import {
  getDocs,
  query,
  collection,
  where,
  getFirestore,
} from "firebase/firestore";

const SelectModelModal = ({
  openSelectModel,
  handleCloseAddLinksModel,
  selectedProperty,
  currentVisibleNode,
  setSearchValue,
  searchValue,
  searchResultsForSelection,
  addNewSpecialization,
  selectedCategory,
  checkedItems,
  markItemAsChecked,
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
  handleSaveLinkChanges,
  onGetPropertyValue,
  setCurrentVisibleNode,
  reviewId,
  setReviewId,
}: {
  openSelectModel: any;
  handleCloseAddLinksModel: any;
  selectedProperty: any;
  currentVisibleNode: any;
  setSearchValue: any;
  searchValue: any;
  searchResultsForSelection: any;
  addNewSpecialization: any;
  selectedCategory: any;
  checkedItems: any;
  markItemAsChecked: any;
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
  reviewId: string;
  setReviewId: any;
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
        to add, by searching existing ${displayNodeType}, or navigating through
        the ontology.
      </div>
    );
  };

  const renderSelectedItems = () => (
    <Box
      sx={{
        borderRadius: "19px",
        height: "700px",
        overflowY: "auto",
        "&::-webkit-scrollbar": { display: "none" },
        px: "15px",
      }}
    >
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          backgroundColor: (theme) =>
            theme.palette.mode === "dark" ? "#303134" : "#f0f0f0",
          textAlign: "center",
          p: 1,
        }}
      >
        <Typography variant="h6">Selected Items</Typography>
      </Box>
      <Box sx={{ p: 3 }}>
        {Array.from(checkedItems).map((id: any) => (
          <Box key={id} sx={{ display: "flex", alignItems: "center", mb: 2 }}>
            <Checkbox
              checked={checkedItems.has(id)}
              onChange={() => markItemAsChecked(id)}
            />
            {reviewId === id ? (
              <LinkEditor
                reviewId={reviewId}
                setReviewId={setReviewId}
                title={nodes[id].title}
              />
            ) : (
              <Typography>{nodes[id].title}</Typography>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );

  const renderSearchOrTree = () =>
    searchValue ? (
      <ExpandSearchResult
        searchResultsForSelection={searchResultsForSelection}
        markItemAsChecked={markItemAsChecked}
        handleCloning={handleCloning}
        checkedItems={checkedItems}
        user={user}
        nodes={nodes}
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
        preventLoops={getPath(currentVisibleNode.id, selectedCategory)}
        manageLock={user?.manageLock}
      />
    );
  const cloneUnclassifiedNode = async () => {
    const unclassifiedNodeDocs = await getDocs(
      query(
        collection(db, NODES),
        where("unclassified", "==", true),
        where("nodeType", "==", currentVisibleNode.nodeType)
      )
    );
    if (unclassifiedNodeDocs.docs.length > 0) {
      const unclassifiedId = unclassifiedNodeDocs.docs[0].id;
      handleCloning({ id: unclassifiedId }, searchValue);
    }
  };
  return (
    <Modal
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "transparent",
      }}
      open={openSelectModel}
      onClose={handleCloseAddLinksModel}
    >
      <Box sx={{ display: "flex", height: "700px" }}>
        <Paper sx={{ display: "flex", borderRadius: "19px" }}>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
              borderRadius: "19px",
              ...SCROLL_BAR_STYLE,
              flexGrow: 1,
            }}
          >
            <Box
              sx={{
                position: "sticky",
                top: 0,
                width: "950px",
                zIndex: 1,
                backgroundColor: (theme) =>
                  theme.palette.mode === "light" ? "#f0f0f0" : "#303134",
              }}
            >
              <Box sx={{ textAlign: "center" }}>
                <Typography sx={{ pt: "15px", pl: "15px", fontSize: "20px" }}>
                  Editing{" "}
                  <strong style={{ color: "orange" }}>
                    {currentVisibleNode.title}
                  </strong>
                </Typography>
              </Box>
              <Box sx={{ pt: "15px" }}>
                {selectedProperty === "specializations" ? (
                  <Typography sx={{ pl: "15px" }}>
                    Select the{" "}
                    <strong style={{ color: "orange" }}>Specialization</strong>{" "}
                    to add, by either:
                    <strong style={{ color: "orange" }}> A) </strong> Searching
                    existing{" "}
                    {currentVisibleNode.nodeType === "activity"
                      ? "activities"
                      : currentVisibleNode.nodeType === "evaluationDimension"
                      ? "Evaluation Dimensions"
                      : currentVisibleNode.nodeType + "s"}
                    , <strong style={{ color: "orange" }}> B) </strong>{" "}
                    Navigating through the ontology,{" "}
                    <strong style={{ color: "orange" }}> C) </strong>
                    Creating what you searched as a new specialization
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
                    display: "flex",
                    alignItems: "center",

                    pr: "5px",
                  }}
                >
                  <SearchBox
                    setSearchValue={setSearchValue}
                    label="Search ..."
                  />
                  <Tooltip
                    title={`Create as a new Specialization 
                    ${
                      selectedProperty !== "specializations"
                        ? "Under " + UNCLASSIFIED[currentVisibleNode.nodeType]
                        : ""
                    } Node`}
                  >
                    <Button
                      onClick={async () => {
                        setDisabledButton(true);
                        if (selectedProperty === "specializations") {
                          await addNewSpecialization(
                            selectedCategory || "main",
                            searchValue
                          );
                        } else {
                          await cloneUnclassifiedNode();
                        }
                        setDisabledButton(false);
                      }}
                      sx={{ borderRadius: "18px", minWidth: "300px" }}
                      variant="outlined"
                      disabled={
                        searchValue.length < 3 ||
                        searchResultsForSelection[0]?.title.trim() ===
                          searchValue.trim() ||
                        disabledButton
                      }
                    >
                      Create{" "}
                      {selectedProperty !== "specializations"
                        ? "Under " + UNCLASSIFIED[currentVisibleNode.nodeType]
                        : ""}
                    </Button>
                  </Tooltip>
                </Box>
              </Box>
            </Box>

            <Box
              sx={{
                flexGrow: 1,
                overflowY: "auto",
                px: "4px",
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
                  width: "950px",
                  backgroundColor: (theme) =>
                    theme.palette.mode === "light" ? "#f0f0f0" : "#303134",
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
                justifyContent: "space-between",
                p: 3,
                pt: 0,
                backgroundColor: (theme) =>
                  theme.palette.mode === "light" ? "#f0f0f0" : "#303134",
              }}
            >
              <Button
                variant="contained"
                onClick={handleCloseAddLinksModel}
                color="primary"
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleSaveLinkChanges}
                color="success"
                sx={{ color: "white" }}
              >
                Save
              </Button>
            </Box>
          </Box>

          {/* Selected Items Section */}
          {renderSelectedItems()}
        </Paper>
      </Box>
    </Modal>
  );
};

export default SelectModelModal;
