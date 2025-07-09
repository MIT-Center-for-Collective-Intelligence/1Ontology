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
  Link,
} from "@mui/material";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import ArrowRightAltIcon from "@mui/icons-material/ArrowRightAlt";
import RemoveIcon from "@mui/icons-material/Remove";
import SearchIcon from "@mui/icons-material/Search";

import AddIcon from "@mui/icons-material/Add";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import DragHandleIcon from "@mui/icons-material/DragHandle";
import CloseIcon from "@mui/icons-material/Close";
import InheritedPartsLegend from "../Common/InheritedPartsLegend";
import { INode } from "@components/types/INode";

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
  getGeneralizationParts: (
    generalizationId: string,
    nodes: { [nodeId: string]: INode },
  ) => PartNode[];
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
  navigateToNode?: any;
  triggerSearch?: any;
  addPart?: any;
  removePart?: any;
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
  addPart,
  removePart,
  navigateToNode,
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

  const getPartOptionalStatus = (partId: string, nodeId: string): boolean => {
    const node = nodes[nodeId];
    if (!node?.properties?.parts) return false;
    
    for (const collection of node.properties.parts) {
      const part = collection.nodes.find((n: any) => n.id === partId);
      if (part) return !!part.optional;
    }
    return false;
  };

  const getCurrentPartOptionalStatus = (partId: string): boolean => {
    const inheritanceRef = currentVisibleNode.inheritance["parts"]?.ref;
    const currentNodeParts = inheritanceRef && nodes[inheritanceRef]
      ? nodes[inheritanceRef].properties["parts"]
      : currentVisibleNode.properties["parts"];
    
    if (!currentNodeParts) return false;
    
    for (const collection of currentNodeParts) {
      const part = collection.nodes.find((n: any) => n.id === partId);
      if (part) return !!part.optional;
    }
    return false;
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
      fromOptional?: boolean;
      toOptional?: boolean;
      optionalChange?: "added" | "removed" | "none";
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

          const fromOptional = getPartOptionalStatus(part, generalizationId);
          const toOptional = getCurrentPartOptionalStatus(key);
          
          let optionalChange: "added" | "removed" | "none" = "none";
          if (fromOptional !== toOptional) {
            optionalChange = toOptional ? "added" : "removed";
          }

          if (key === part) {
            result.push({
              from: part,
              to: key,
              symbol: "=",
              fromOptional,
              toOptional,
              optionalChange,
            });
          } else {
            result.push({
              from: part,
              to: key,
              symbol: ">",
              fromOptional,
              toOptional,
              optionalChange,
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
          fromOptional: getPartOptionalStatus(part, generalizationId),
          toOptional: false,
          optionalChange: "none",
        });
      }
    }

    for (const [key, value] of Object.entries(inheritance)) {
      if (value === null) {
        result.push({
          from: "",
          to: key,
          symbol: "+",
          fromOptional: false,
          toOptional: getCurrentPartOptionalStatus(key),
          optionalChange: "none",
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

    const inheritanceRef = currentVisibleNode.inheritance["parts"]?.ref;
    const currentNodeParts = inheritanceRef && nodes[inheritanceRef]
      ? nodes[inheritanceRef].properties["parts"]
      : currentVisibleNode.properties["parts"];
    const currentPartsOrder = currentNodeParts?.[0]?.nodes?.map((c: any) => c.id) || [];

    uniqueResult.sort((a, b) => {
      const indexA = currentPartsOrder.indexOf(a.to);
      const indexB = currentPartsOrder.indexOf(b.to);

      return (
        (indexA === -1 ? Infinity : indexA) -
        (indexB === -1 ? Infinity : indexB)
      );
    });
    return uniqueResult;
  };

  const formatPartTitle = (
    partId: string, 
    isOptional: boolean, 
    optionalChange?: "added" | "removed" | "none"
  ) => {
    const title = nodes[partId]?.title || "";
    
    if (optionalChange === "added") {
      return (
        <Box component="span" sx={{ display: "inline" }}>
          {title} <Box component="span" sx={{ color: "#ff9500", fontWeight: "bold" }}>+(O)</Box>
        </Box>
      );
    } else if (optionalChange === "removed") {
      return (
        <Box component="span" sx={{ display: "inline" }}>
          {title} <Box component="span" sx={{ textDecoration: "line-through", color: "#ff9500", fontWeight: "bold" }}>(O)</Box>
        </Box>
      );
    } else if (isOptional) {
      return (
        <Box component="span" sx={{ display: "inline" }}>
          {title} <Box component="span" sx={{ color: "#ff9500", fontWeight: "bold" }}>(O)</Box>
        </Box>
      );
    }
    
    return title;
  };

  const getTabContent = (generalizationId: string): JSX.Element => {
    const generalizationParts = getGeneralizationParts(
      generalizationId,
      nodes,
    ).map((c) => c.id);

    const inheritanceRef = currentVisibleNode.inheritance["parts"].ref;
    const currentNodeParts =
      inheritanceRef && nodes[inheritanceRef]
        ? nodes[inheritanceRef].properties["parts"]
        : currentVisibleNode.properties["parts"];
    const currentParts = currentNodeParts[0].nodes.map(
      (c: { id: string }) => c.id,
    );

    const details = analyzeInheritance(
      inheritanceDetails,
      generalizationParts,
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

    return (
      <List
        sx={{
          py: 1,
          border: generalizationParts.length > 0 ? "1px dashed gray" : "",
          px: 1.8,
          borderRadius: "20px",
        }}
      >
        {details.map((entry, index) => (
          <ListItem
            key={`${entry.from}-${entry.to}`}
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
            {!readOnly && entry.symbol === "x" && !!addPart && (
              <Tooltip title={"Add part"} placement="top">
                <IconButton
                  sx={{ p: 0.5 }}
                  onClick={() => {
                    addPart(entry.from);
                  }}
                >
                  <AddIcon
                    sx={{
                      fontSize: 20,
                      color: "green",
                      border: "1px solid green",
                      borderRadius: "50%",
                    }}
                  />
                </IconButton>
              </Tooltip>
            )}

            {!readOnly && entry.symbol === "=" && !!removePart && (
              <Tooltip title={"Remove part"} placement="top">
                <IconButton
                  sx={{ p: 0.5 }}
                  onClick={() => {
                    removePart(entry.to);
                  }}
                >
                  <RemoveIcon
                    sx={{
                      fontSize: 20,
                      color: "red",
                      border: "1px solid red",
                      borderRadius: "50%",
                    }}
                  />
                </IconButton>
              </Tooltip>
            )}

            {!readOnly && entry.from && entry.symbol !== "x" && entry.symbol !== "=" && (
              <ListItemIcon sx={{ minWidth: "auto" }}>
                <Tooltip title="Search it below" placement="left">
                  <IconButton
                    sx={{ p: 0.4 }}
                    onClick={() =>
                      triggerSearch({ id: entry.from, title: nodes[entry.from].title })
                    }
                  >
                    <SearchIcon sx={{ fontSize: 19, color: "orange" }} />
                  </IconButton>
                </Tooltip>
              </ListItemIcon>
            )}

            <ListItemText
              primary={
                entry.from ? (
                  <Link
                    underline={!!navigateToNode ? "hover" : "none"}
                    onClick={() => {
                      if (navigateToNode) {
                        navigateToNode(entry.from);
                      }
                    }}
                    sx={{
                      cursor: !!navigateToNode ? "pointer" : "",
                      color: (them) =>
                        them.palette.mode === "dark" ? "white" : "black",
                      fontSize: "0.9rem",
                    }}
                  >
                    {formatPartTitle(entry.from, entry.fromOptional || false)}
                  </Link>
                ) : null
              }
              sx={{ flex: 1, minWidth: 0.3 }}
            />

            <ListItemIcon sx={{ minWidth: "auto" }}>
              {entry.symbol === "x" ? (
                <CloseIcon sx={{ fontSize: 20, color: "orange" }} />
              ) : entry.symbol === ">" ? (
                <ArrowForwardIosIcon sx={{ fontSize: 20, color: "orange" }} />
              ) : entry.symbol === "=" ? (
                <DragHandleIcon sx={{ fontSize: 20, color: "orange" }} />
              ) : entry.symbol === "+" ? (
                <AddIcon sx={{ fontSize: 20, color: "orange" }} />
              ) : null}
            </ListItemIcon>

            <ListItemText
              primary={
                entry.to ? (
                  <Link
                    underline={!!navigateToNode ? "hover" : "none"}
                    onClick={() => {
                      if (navigateToNode) {
                        navigateToNode(entry.to);
                      }
                    }}
                    sx={{
                      cursor: !!navigateToNode ? "pointer" : "",
                      color: (them) =>
                        them.palette.mode === "dark" ? "white" : "black",
                      fontSize: "0.9rem",
                    }}
                  >
                    {formatPartTitle(entry.to, entry.toOptional || false, entry.optionalChange)}
                  </Link>
                ) : null
              }
              sx={{ flex: 1, minWidth: 0.3 }}
            />
          </ListItem>
        ))}
      </List>
    );
  };

  if (generalizations.length <= 0) {
    return null;
  }
  return (
    <Box
      sx={{
        px: "10px",
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
          <Typography sx={{ ml: "7px" }}>
            {"Parts inherited from generalizations"}
          </Typography>
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
          position: "relative",
          display: "flex",
          alignItems: "center",
          px: "7px",
          height: 40,
        }}
      >
        {generalizations.length > 1 ? (
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
                      maxWidth: "170px",
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

        <ArrowRightAltIcon
          sx={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%) scaleX(2)",
            fontSize: 24,
            color: "orange",
            fontWeight: "bold",
            zIndex: 1,
            pointerEvents: "none",
          }}
        />

        <Tooltip title={currentVisibleNode.title}>
          <Typography
            sx={{
              position: "absolute",
              top: "50%",
              left: `calc(50% + 24px)`,
              transform: "translateY(-50%)",
              fontWeight: 500,
              fontSize: "0.95rem",
              maxWidth: "210px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              cursor: "default",
              zIndex: 2,
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

      <InheritedPartsLegend
        legendItems={[
          { symbol: "=", description: "no change" },
          { symbol: ">", description: "specialized part" },
          { symbol: "x", description: "part not inherited" },
          { symbol: "+", description: "part added" },
        ]}
      />
    </Box>
  );
};

export default InheritedPartsViewer;
