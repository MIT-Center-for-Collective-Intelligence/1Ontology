import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Checkbox,
  IconButton,
  Tooltip,
} from "@mui/material";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import ArrowRightAltIcon from "@mui/icons-material/ArrowRightAlt";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";

interface GeneralizationNode {
  id: string;
  title: string;
}

interface PartNode {
  id: string;
  title: string;
  isInherited: boolean;
}

interface InheritedPartsViewerProps {
  selectedProperty: string;
  getAllGeneralizations: () => GeneralizationNode[];
  getGeneralizationParts: (generalizationId: string) => PartNode[];
  getTitle: (nodes: { [id: string]: any }, nodeId: string) => string;
  nodes: { [id: string]: any };
  checkedItems: Set<string>;
  markItemAsChecked: (
    checkedId: string,
    radioSelection?: boolean,
    fromGeneralizationDropdown?: {
      generalizationId: string;
      generalizationTitle: string;
    },
  ) => void;
  isSaving: boolean;
  readOnly?: boolean;
  setDisplayDetails: any;
  inheritanceDetails: any;
  triggerSearch?: any;
}

const InheritedPartsViewer: React.FC<InheritedPartsViewerProps> = ({
  selectedProperty,
  getAllGeneralizations,
  getGeneralizationParts,
  getTitle,
  nodes,
  checkedItems,
  markItemAsChecked,
  isSaving,
  readOnly = false,
  setDisplayDetails,
  inheritanceDetails,
  triggerSearch,
}) => {
  const [selectedTab, setSelectedTab] = useState(0);

  if (selectedProperty !== "parts") return null;

  const generalizations = getAllGeneralizations();

  if (generalizations.length === 0) {
    return null;
  }

  // Reset to first tab if current selection is invalid
  /*   useEffect(() => {
    if (selectedTab >= generalizations.length) {
      setSelectedTab(0);
    }
  }, [generalizations.length, selectedTab]); */

  const handleTabChange = (
    event: React.SyntheticEvent,
    newValue: number,
  ): void => {
    setSelectedTab(newValue);
  };

  const getTabContent = (generalizationId: string): JSX.Element => {
    const parts = getGeneralizationParts(generalizationId);
    const displayedParts = parts.slice(0, 10);

    if (displayedParts.length === 0) {
      return (
        <Typography
          variant="body2"
          sx={{
            color: (theme) =>
              theme.palette.mode === "light" ? "#95a5a6" : "#7f8c8d",
            fontStyle: "italic",
            textAlign: "center",
            py: 2,
            fontSize: "0.75rem",
          }}
        >
          No parts available
        </Typography>
      );
    }

    const getPartGeneralization = (partId: string): string | null => {
      const partNode = nodes[partId];
      if (!partNode?.generalizations?.[0]?.nodes?.[0]?.id) {
        return null;
      }
      const firstGeneralizationId = partNode.generalizations[0].nodes[0].id;
      return getTitle(nodes, firstGeneralizationId);
    };

    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, py: 1 }}>
        {displayedParts.map((part) => {
          const partGeneralization = getPartGeneralization(part.id);

          return (
            <Box
              key={part.id}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              {readOnly ? (
                checkedItems.has(part.id) ||
                (inheritanceDetails[part.id] || []).length > 0 ? (
                  <CheckIcon
                    sx={{
                      color: "#4caf50",
                      fontSize: "20px",
                    }}
                  />
                ) : (
                  <CloseIcon
                    sx={{
                      color: "#f44336",
                      fontSize: "20px",
                    }}
                  />
                )
              ) : (
                <Tooltip title={"Search it below"} placement="left">
                  <IconButton
                    sx={{ p: 0.4 }}
                    onClick={() => {
                      triggerSearch(part);
                    }}
                  >
                    <SearchIcon sx={{ fontSize: "19px", color: "orange" }} />
                  </IconButton>
                </Tooltip>
              )}
              <Box
                sx={{
                  flex: 1,
                  display: "flex",
                  gap: 0.5,
                }}
              >
                {partGeneralization && (
                  <Typography
                    variant="body2"
                    sx={{
                      color: (theme) =>
                        theme.palette.mode === "light" ? "#666" : "#999",
                      fontSize: "0.9rem",
                    }}
                  >
                    {part.title}
                  </Typography>
                )}
                {((inheritanceDetails || {})[part.id] || []).length > 0 ? (
                  <ArrowRightAltIcon sx={{ color: "orange" }} />
                ) : (
                  ""
                )}
                {((inheritanceDetails || {})[part.id] || []).length > 0 ? (
                  <Typography
                    sx={{
                      fontStyle: "italic",
                      color: (theme) =>
                        theme.palette.mode === "light" ? "#666" : "#999",
                      fontSize: "0.9rem",
                    }}
                  >
                    {(inheritanceDetails || {})[part.id][0]}
                  </Typography>
                ) : (
                  ""
                )}
                {!partGeneralization && (
                  <Typography
                    variant="body2"
                    sx={{
                      color: (theme) =>
                        theme.palette.mode === "light" ? "#2c3e50" : "#e0e0e0",
                      fontWeight: 400,
                      fontSize: "1rem",
                    }}
                  >
                    {part.title}
                  </Typography>
                )}
              </Box>
              {/* {part.isInherited && (
                <Typography
                  variant="caption"
                  sx={{
                    color: (theme) => theme.palette.mode === "light" ? "#f39c12" : "#e67e22",
                    fontSize: "0.7rem",
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px"
                  }}
                >
                  inherited
                </Typography>
              )} */}
            </Box>
          );
        })}
      </Box>
    );
  };

  return (
    <Box
      sx={{
        px: "15px",
        py: "10px",
        backgroundColor: (theme) =>
          theme.palette.mode === "light" ? "#fafbfc" : "#1e1e1f",
      }}
    >
      <Box>
        <Typography
          variant="subtitle2"
          sx={{
            mb: 2,
            fontWeight: 600,
            display: "flex",
            fontSize: "0.85rem",
            color: (theme) =>
              theme.palette.mode === "light" ? "#2c3e50" : "#e0e0e0",
            gap: "5px",
          }}
        >
          {!triggerSearch && (
            <IconButton
              sx={{ border: "1px solid gray", p: 0, backgroundColor: "orange" }}
              onClick={() => {
                setDisplayDetails(false);
              }}
            >
              <KeyboardArrowUpIcon />
            </IconButton>
          )}{" "}
          <Typography>{"Generalizations' Parts:"}</Typography>
        </Typography>
      </Box>

      <Tabs
        value={selectedTab}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          mb: 2,
          "& .MuiTabs-scrollButtons": {
            "&.Mui-disabled": { opacity: 0.3 },
          },
          "& .MuiTabs-indicator": {
            backgroundColor: readOnly ? "#ff9500" : "#ff9500",
          },
        }}
      >
        {generalizations.map((generalization, index) => {
          const parts = getGeneralizationParts(generalization.id);
          const selectedPartsFromThisGen = parts.filter((part) =>
            checkedItems.has(part.id),
          );

          return (
            <Tab
              key={generalization.id}
              label={
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    minWidth: 0,
                    maxWidth: "160px",
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 500,
                      fontSize: "0.85rem",
                      textTransform: "none",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                    }}
                  >
                    {generalization.title}
                  </Typography>
                  {selectedPartsFromThisGen.length > 0 && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: "#ff9500",
                        fontWeight: 600,
                        fontSize: "0.75rem",
                      }}
                    >
                      ({selectedPartsFromThisGen.length})
                    </Typography>
                  )}
                </Box>
              }
              sx={{
                minWidth: "auto",
                maxWidth: "180px",
                px: 2,
                py: 1,
                textTransform: "none",
                "&.Mui-selected": {
                  color: "#ff9500",
                },
              }}
            />
          );
        })}
      </Tabs>

      {selectedTab < generalizations.length && (
        <Box sx={{ mt: 1.5 }}>
          {getTabContent(generalizations[selectedTab].id)}
        </Box>
      )}
    </Box>
  );
};

export default InheritedPartsViewer;
