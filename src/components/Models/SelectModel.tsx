import React from "react";
import { Modal, Box, Paper, Typography, Button, Checkbox } from "@mui/material";

import ExpandSearchResult from "../OntologyComponents/ExpandSearchResult";
import TreeViewSimplified from "../OntologyComponents/TreeViewSimplified";
import { SearchBox } from "../SearchBox/SearchBox";
import Text from "../OntologyComponents/Text";
import { SCROLL_BAR_STYLE, DISPLAY } from " @components/lib/CONSTANTS";
import {
  getSelectingModelTitle,
  capitalizeFirstLetter,
} from " @components/lib/utils/string.utils";

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
}: any) => {
  const renderSelectedItems = () => (
    <Box
      sx={{
        borderRadius: "19px",
        height: "700px",
        overflowY: "auto",
        "&::-webkit-scrollbar": { display: "none" },
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
            <Typography>{nodes[id].title}</Typography>
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
              <Box sx={{ pt: "15px" }}>
                {selectedProperty === "specializations" ? (
                  <Typography sx={{ pl: "15px" }}>
                    Select the specialization to add, by either:
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
                  {selectedProperty === "specializations" && (
                    <Button
                      onClick={() =>
                        addNewSpecialization(
                          selectedCategory || "main",
                          searchValue
                        )
                      }
                      sx={{ borderRadius: "18px", minWidth: "300px" }}
                      variant="outlined"
                      disabled={
                        searchValue.length < 3 ||
                        searchResultsForSelection[0]?.title.trim() ===
                          searchValue.trim()
                      }
                    >
                      Create as a new Specialization
                    </Button>
                  )}
                </Box>
              </Box>
            </Box>

            <Box sx={{ flexGrow: 1, overflowY: "auto" }}>
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
          {checkedItems.size > 0 && renderSelectedItems()}
        </Paper>
      </Box>
    </Modal>
  );
};

export default SelectModelModal;
