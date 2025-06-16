import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Checkbox,
  IconButton,
  Tooltip,
  MenuItem,
  Select,
  ListItemText,
  ListItemIcon,
  ListItem,
  List,
} from "@mui/material";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import ArrowRightAltIcon from "@mui/icons-material/ArrowRightAlt";

import SearchIcon from "@mui/icons-material/Search";

import AddIcon from "@mui/icons-material/Add";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import DragHandleIcon from "@mui/icons-material/DragHandle";
import CloseIcon from "@mui/icons-material/Close";

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
  currentVisibleNode: any;
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
  currentVisibleNode,
  triggerSearch,
}) => {
  const [selectedGeneralizationIndex, setSelectedGeneralizationIndex] =
    useState<number>(0);

  if (selectedProperty !== "parts") return null;
  const generalizations: any = getAllGeneralizations();

  const handleSelectedGenChange = (
    event: React.SyntheticEvent,
    newValue: number,
  ): void => {
    setSelectedGeneralizationIndex(newValue);
  };
  const analyzeInheritance = (
    inheritance: any,
    parts: string[],
    generalizationId: string,
    currentParts: string[],
  ) => {
    const result: {
      from: string;
      to: string;
      symbol: ">" | "x" | "=" | "+";
    }[] = [];
    const matchedParts = new Set();
    const usedKeys = new Set();

    for (const [key, entries] of Object.entries(inheritance)) {
      if (entries === null) continue;

      for (const entry of entries as any) {
        if (entry.genId !== generalizationId) {
          continue;
        }
        const part = entry.partOf;

        if (parts.includes(part)) {
          matchedParts.add(part);
          usedKeys.add(key);

          if (key === part) {
            result.push({
              from: part,
              to: key,
              symbol: "=",
            });
          } else {
            result.push({
              from: part,
              to: key,
              symbol: ">",
            });
          }
        }
      }
    }

    for (const part of parts) {
      if (!matchedParts.has(part)) {
        result.push({
          from: part,
          to: "",
          symbol: "x",
        });
      }
    }

    for (const [key, value] of Object.entries(inheritance)) {
      if (value === null) {
        result.push({
          from: "",
          to: key,
          symbol: "+",
        });
      }
    }
    const seen = new Set();
    const uniqueResult = result.filter((entry) => {
      const key = `${entry.from}|${entry.to}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    uniqueResult.sort((a, b) => {
      const indexA = currentParts.indexOf(a.to);
      const indexB = currentParts.indexOf(b.to);

      return (
        (indexA === -1 ? Infinity : indexA) -
        (indexB === -1 ? Infinity : indexB)
      );
    });
    return uniqueResult;
  };

  const getTabContent = (generalizationId: string): JSX.Element => {
    const parts = getGeneralizationParts(generalizationId);
    const displayedParts = parts.map((c) => c.id);
    const inheritanceRef = currentVisibleNode.inheritance["parts"].ref;
    const _parts = inheritanceRef
      ? nodes[inheritanceRef].properties["parts"]
      : currentVisibleNode.properties["parts"];
    const currentParts = _parts[0].nodes.map((c: { id: string }) => c.id);

    const details = analyzeInheritance(
      inheritanceDetails,
      displayedParts,
      generalizationId,
      currentParts,
    );

    if (Object.keys(inheritanceDetails).length === 0) {
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
      <List
        sx={{
          py: 1,
          border: parts.length > 0 ? "1px dashed gray" : "",
          px: 1.8,
          borderRadius: "20px",
        }}
      >
        {details.map(
          (
            {
              from,
              to,
              symbol,
            }: {
              from: string;
              to: string;
              symbol: ">" | "x" | "=" | "+";
            },
            index,
          ) => (
            <ListItem
              key={`${from}-${to}`}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 0,
                py: 0,
                backgroundImage:
                  index !== 0
                    ? "repeating-linear-gradient(to right, gray 0, gray 1px, transparent 1px, transparent 6px)"
                    : "",
                backgroundPosition: index !== 0 ? "top" : "",
                backgroundRepeat: "repeat-x",
                backgroundSize: "100% 1px",
              }}
            >
              {!readOnly && from && (
                <ListItemIcon sx={{ minWidth: "auto" }}>
                  <Tooltip title="Search it below" placement="left">
                    <IconButton
                      sx={{ p: 0.4 }}
                      onClick={() => triggerSearch(from)}
                    >
                      <SearchIcon sx={{ fontSize: 19, color: "orange" }} />
                    </IconButton>
                  </Tooltip>
                </ListItemIcon>
              )}

              <ListItemText
                primary={
                  from ? (
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: "0.9rem",
                      }}
                    >
                      {nodes[from].title}
                    </Typography>
                  ) : null
                }
                sx={{ flex: 1, minWidth: 0.3 }}
              />

              <ListItemIcon sx={{ minWidth: "auto" }}>
                {symbol === "x" ? (
                  <CloseIcon sx={{ fontSize: 20, color: "orange" }} />
                ) : symbol === ">" ? (
                  <ArrowForwardIosIcon sx={{ fontSize: 20, color: "orange" }} />
                ) : symbol === "=" ? (
                  <DragHandleIcon sx={{ fontSize: 20, color: "orange" }} />
                ) : symbol === "+" ? (
                  <AddIcon sx={{ fontSize: 20, color: "orange" }} />
                ) : null}
              </ListItemIcon>

              <ListItemText
                primary={
                  to ? (
                    <Typography
                      sx={{
                        fontStyle: "italic",
                        fontSize: "0.9rem",
                        textAlign: "right",
                      }}
                    >
                      {nodes[to].title}
                    </Typography>
                  ) : null
                }
                sx={{ flex: 1, minWidth: 0.3 }}
              />
            </ListItem>
          ),
        )}
      </List>
    );
  };
  if (generalizations.length <= 0) {
    return null;
  }
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
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 2,
          }}
        >
          <Typography>{"Parts inherited from generalizations"}</Typography>
          {!triggerSearch && (
            <Tooltip title={"Collapse"} placement="top" sx={{ ml: "auto" }}>
              <IconButton
                sx={{
                  border: "1px solid gray",
                  p: 0,
                  backgroundColor: "",
                  color: "gray",
                }}
                onClick={() => {
                  setDisplayDetails(false);
                }}
              >
                <CloseIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: "7px",
        }}
      >
        {generalizations.length > 0 ? (
          <Select
            value={selectedGeneralizationIndex}
            onChange={(e: any) => handleSelectedGenChange(e, e.target.value)}
            displayEmpty
            renderValue={(selected) => {
              const selectedGen = generalizations[selected];
              return (
                <Tooltip title={selectedGen.title} placement="top">
                  <Typography
                    sx={{
                      fontWeight: 500,
                      fontSize: "0.85rem",
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      maxWidth: "200px",
                    }}
                  >
                    {selectedGen.title}
                  </Typography>
                </Tooltip>
              );
            }}
            sx={{
              backgroundColor: (theme) =>
                theme.palette.mode === "light" ? "#fff" : "#2a2a2a",
              color: (theme) =>
                theme.palette.mode === "light" ? "#2c3e50" : "#e0e0e0",
              "& .MuiSelect-icon": {
                color: "#ff9500",
              },
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "#ff9500",
              },
              p: 0,
              borderRadius: "25px",
            }}
            inputProps={{
              sx: {
                p: 1,
                pl: "12px",
              },
            }}
          >
            {generalizations.map((generalization: any, index: number) => {
              const parts = getGeneralizationParts(generalization.id);

              return (
                <MenuItem key={generalization.id} value={index}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      width: "100%",
                    }}
                  >
                    <Tooltip title={generalization.title}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 500,
                          fontSize: "0.85rem",
                          flex: 1,
                          textOverflow: "ellipsis",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {generalization.title}
                      </Typography>
                    </Tooltip>
                  </Box>
                </MenuItem>
              );
            })}
          </Select>
        ) : (
          <Tooltip title={generalizations[0].title}>
            <Typography sx={{ color: "orange", fontWeight: "bold" }}>
              {generalizations[0].title}
            </Typography>
          </Tooltip>
        )}

        <Box sx={{ mx: 2, display: "flex", alignItems: "center" }}>
          <ArrowRightAltIcon
            sx={{
              fontSize: "55px",
              color: "orange",
              fontWeight: "bold",
              transform: "scaleX(2)",
            }}
          />
        </Box>

        <Tooltip title={currentVisibleNode.title}>
          <Typography
            sx={{
              fontWeight: 500,
              fontSize: "0.95rem",
              maxWidth: "150px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              cursor: "default",
            }}
          >
            {currentVisibleNode.title}
          </Typography>
        </Tooltip>
      </Box>

      {selectedGeneralizationIndex < generalizations.length && (
        <Box sx={{ mt: 1.5 }}>
          {getTabContent(generalizations[selectedGeneralizationIndex].id)}
        </Box>
      )}
    </Box>
  );
};

export default InheritedPartsViewer;
