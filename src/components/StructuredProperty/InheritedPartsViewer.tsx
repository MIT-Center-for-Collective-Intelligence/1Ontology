import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  MenuItem,
  Select,
  ListItemText,
  ListItemIcon,
  ListItem,
  List,
  Link,
  Popover,
  Tabs,
  Tab,
  Button,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ArrowRightAltIcon from "@mui/icons-material/ArrowRightAlt";
import RemoveIcon from "@mui/icons-material/Remove";
import SearchIcon from "@mui/icons-material/Search";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import AddIcon from "@mui/icons-material/Add";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import DragHandleIcon from "@mui/icons-material/DragHandle";
import CloseIcon from "@mui/icons-material/Close";
import InheritedPartsLegend from "../Common/InheritedPartsLegend";
import {
  ICollection,
  INode,
  TransferInheritance,
} from "@components/types/INode";
import {
  query,
  collection,
  where,
  getFirestore,
  onSnapshot,
  doc,
  setDoc,
} from "firebase/firestore";

import { INHERITANCE_FOR_PARTS_COLLECTION_NAME } from "@components/lib/firestoreClient/collections";

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
  nodes: { [id: string]: any };
  fetchNode?: (nodeId: string) => Promise<INode | null>;
  readOnly?: boolean;
  setDisplayDetails: any;
  displayDetails: boolean;
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
  nodes,
  fetchNode,
  readOnly = false,
  setDisplayDetails,
  displayDetails,
  inheritanceDetails,
  currentVisibleNode,
  triggerSearch,
  addPart,
  removePart,
  navigateToNode,
}) => {
  const db = getFirestore();
  const [activeTab, setActiveTab] = React.useState<string | null>(null);
  const generalizations: GeneralizationNode[] = getAllGeneralizations();
  const [selectedGeneralizationIndex, setSelectedGeneralizationIndex] =
    useState<number>(0);
  const [inheritanceForParts, setInheritanceForParts] = useState<{
    [pickingFor: string]: string;
  }>({});
  const [pickingFor, setPickingFor] = useState<string>("");
  const [anchorEl, setAnchorEl] = useState(null);

  const handleClick = (event: any, from: string) => {
    setAnchorEl(event.currentTarget);
    setPickingFor(from);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setPickingFor("");
  };

  const open = Boolean(anchorEl);
  const id = open ? "switch-popover" : undefined;

  useEffect(() => {
    const nodesQuery = query(
      collection(db, INHERITANCE_FOR_PARTS_COLLECTION_NAME),
      where("nodeId", "==", currentVisibleNode.id),
    );
    const unsubscribeNodes = onSnapshot(nodesQuery, (snapshot) => {
      const docChanges = snapshot.docChanges();
      if (docChanges.length > 0) {
        if (docChanges[0].type === "removed") {
          setInheritanceForParts({});
          return;
        }
        const docChange = docChanges[0].doc;
        const dataChange = docChange.data().inheritedFrom || {};
        setInheritanceForParts(dataChange);
      }
    });
    return () => unsubscribeNodes();
  }, [currentVisibleNode.id]);
  useEffect(() => {
    // Set the first generalization as the active tab initially
    if (generalizations.length > 0 && !activeTab) {
      setActiveTab(generalizations[0].id);
    } else if (
      generalizations.length > 0 &&
      !generalizations.find((g) => g.id === activeTab)
    ) {
      // If the active tab is no longer in the list, reset to the first one
      setActiveTab(generalizations[0].id);
    } else if (generalizations.length === 0) {
      // Clear active tab if there are no generalizations
      setActiveTab(null);
    }
  }, [generalizations, activeTab]);

  // Fetch missing inheritance reference for parts
  useEffect(() => {
    const fetchMissingInheritanceRef = async () => {
      if (!fetchNode || !currentVisibleNode.inheritance?.parts?.ref) return;
      const inheritanceRef = currentVisibleNode.inheritance.parts.ref;

      // Check if inheritance reference is missing from cache
      if (!nodes[inheritanceRef]) {
        await fetchNode(inheritanceRef);
      }
    };

    fetchMissingInheritanceRef();
  }, [currentVisibleNode.inheritance?.parts?.ref, fetchNode]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
    setActiveTab(newValue);
  };

  if (selectedProperty !== "parts") return null;

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
    const currentNodeParts =
      inheritanceRef && nodes[inheritanceRef]
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
    generalizationParts: string[],
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
      hops?: number;
    }[] = [];

    const matchedParts = new Set<string>();   // Track generalization parts found in current node 
    const usedKeys = new Set<string>();  // Track current node part IDs that have been matched to a generalization part
    const usedGeneralizationParts = new Set<string>(); // Track generalization parts that are unchanged (same ID)

    const findHierarchicalDistance = (
      fromPartId: string,
      toPartId: string,
      visited = new Set<string>(),
    ): number => {
      if (visited.has(fromPartId)) return -1;
      if (fromPartId === toPartId) return 0;

      visited.add(fromPartId);

      const fromNode = nodes[fromPartId];
      if (!fromNode) return -1;

      let minDistance = -1;

      for (const collection of fromNode.properties.parts) {
        for (const part of collection.nodes) {
          if (part.id === toPartId) {
            return 1;
          }
        }
      }
      for (let specializationNode of fromNode.specializations.flatMap(
        (c: ICollection) => c.nodes,
      )) {
        const deeperDistance = findHierarchicalDistance(
          specializationNode.id,
          toPartId,
          new Set(visited),
        );

        if (deeperDistance !== -1) {
          const totalDistance = 1 + deeperDistance;
          minDistance =
            minDistance === -1
              ? totalDistance
              : Math.min(minDistance, totalDistance);
        }
      }

      return minDistance;
    };

    for (const [key, entries] of Object.entries(inheritance)) {
      if (entries === null) continue;

      for (const entry of entries as any) {
        if (entry.genId !== generalizationId) {
          continue;
        }
        const part = entry.partOf;

        if (generalizationParts.includes(part)) {
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
              hops: 0,
            });
            usedGeneralizationParts.add(part);
          } else {
            const hops = findHierarchicalDistance(part, key);
            result.push({
              from: part,
              to: key,
              symbol: ">",
              fromOptional,
              toOptional,
              optionalChange,
              hops,
            });
          }
        }
      }
    }

    for (const generalizationPart of generalizationParts) {
      if (!matchedParts.has(generalizationPart)) {
        for (const currentPart of currentParts) {
          const hops = findHierarchicalDistance(
            generalizationPart,
            currentPart,
          );
          if (hops !== -1) {
            const fromOptional = getPartOptionalStatus(
              generalizationPart,
              generalizationId,
            );
            const toOptional = getCurrentPartOptionalStatus(currentPart);

            let optionalChange: "added" | "removed" | "none" = "none";
            if (fromOptional !== toOptional) {
              optionalChange = toOptional ? "added" : "removed";
            }

            result.push({
              from: generalizationPart,
              to: currentPart,
              symbol: ">",
              fromOptional,
              toOptional,
              optionalChange,
              hops,
            });
            matchedParts.add(generalizationPart);
            break;
          }
        }
      }
    }

    const groupedByGeneralization = result.reduce(
      (acc, entry) => {
        if (entry.symbol === ">") {
          if (!acc[entry.from]) acc[entry.from] = [];
          acc[entry.from].push(entry);
        }

        return acc;
      },
      {} as Record<string, typeof result>,
    );

    const inheritanceRef = currentVisibleNode.inheritance["parts"]?.ref;
    const currentNodeParts =
      inheritanceRef && nodes[inheritanceRef]
        ? nodes[inheritanceRef].properties["parts"]
        : currentVisibleNode.properties["parts"];
    const currentPartsOrder =
      currentNodeParts?.[0]?.nodes?.map((c: any) => c.id) || [];

    const hasSeenTo = new Set();
    const filteredSpecializations: TransferInheritance[] = Object.entries(
      groupedByGeneralization,
    ).reduce((acc, [from, entries]) => {
      const picked =
        entries.length === 1
          ? entries[0]
          : entries.reduce((a, b) => {
              const aHops = a.hops ?? -1;
              const bHops = b.hops ?? -1;
              if (
                inheritanceForParts[from] &&
                inheritanceForParts[from] === b.to
              ) {
                return b;
              }
              if (aHops === -1 && bHops === -1) {
                return currentPartsOrder.indexOf(a.to) <=
                  currentPartsOrder.indexOf(b.to)
                  ? a
                  : b;
              }
              if (aHops === -1) return b;
              if (bHops === -1) return a;

              if (aHops !== bHops) return aHops < bHops ? a : b;

              return currentPartsOrder.indexOf(a.to) <=
                currentPartsOrder.indexOf(b.to)
                ? a
                : b;
            });

      if (!hasSeenTo.has(picked.to)) {
        hasSeenTo.add(picked.to);
        acc.push(picked);
      }

      return acc;
    }, [] as any);

    const nonPickedOnes: any = {};

    for (let key in groupedByGeneralization) {
      const exist = filteredSpecializations.findIndex((c) => c.from === key);
      if (exist === -1) {
        filteredSpecializations.push({
          from: key,
          to: "",
          symbol: "x",
          fromOptional: false,
          toOptional: false,
          optionalChange: "none",
          hops: 0,
        });
      }
      nonPickedOnes[key] = new Array(
        ...new Set(
          groupedByGeneralization[key]
            .filter((c) => {
              const index = filteredSpecializations.findIndex(
                (l) => l.to === c.to && l.from === c.from,
              );
              return index === -1;
            })
            .map((c) => c.to),
        ),
      );
    }

    const directMatches = result.filter((entry) => entry.symbol === "=");
    const finalSpecializations = filteredSpecializations.filter(
      (entry) => !usedGeneralizationParts.has(entry.from),
    );

    const finalResult = [...directMatches, ...finalSpecializations];

    for (const part of generalizationParts) {
      if (!matchedParts.has(part) && !usedGeneralizationParts.has(part)) {
        finalResult.push({
          from: part,
          to: "",
          symbol: "x",
          fromOptional: getPartOptionalStatus(part, generalizationId),
          toOptional: false,
          optionalChange: "none",
          hops: -1,
        });
      }
    }

    for (const [key, value] of Object.entries(inheritance)) {
      const existIdx = finalResult.findIndex((c) => c.to === key);
      if (existIdx === -1) {
        finalResult.push({
          from: "",
          to: key,
          symbol: "+",
          fromOptional: false,
          toOptional: getCurrentPartOptionalStatus(key),
          optionalChange: "none",
          hops: 0,
        });
      }
    }

    // Add parts that exist in current node but have no inheritance tracking entry
    // (This can happen if the part node isn't loaded in relatedNodes yet)
    for (const currentPart of currentParts) {
      const existIdx = finalResult.findIndex((c) => c.to === currentPart);
      if (existIdx === -1) {
        if (!generalizationParts.includes(currentPart)) {
          finalResult.push({
            from: "",
            to: currentPart,
            symbol: "+",
            fromOptional: false,
            toOptional: getCurrentPartOptionalStatus(currentPart),
            optionalChange: "none",
            hops: 0,
          });
        }
      }
    }

    const seen = new Set();
    const uniqueResult = finalResult.filter((entry) => {
      const key = `${entry.from}|${entry.to}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    uniqueResult.sort((a, b) => {
      const indexA = currentPartsOrder.indexOf(a.to);
      const indexB = currentPartsOrder.indexOf(b.to);

      return (
        (indexA === -1 ? Infinity : indexA) -
        (indexB === -1 ? Infinity : indexB)
      );
    });

    return { details: uniqueResult, nonPickedOnes };
  };

  const formatPartTitle = (
    partId: string,
    isOptional: boolean,
    optionalChange?: "added" | "removed" | "none",
  ) => {
    const title = nodes[partId]?.title || "";

    if (optionalChange === "added") {
      return (
        <Box component="span" sx={{ display: "inline" }}>
          {title}{" "}
          <Box component="span" sx={{ color: "#ff9500", fontWeight: "bold" }}>
            +(O)
          </Box>
        </Box>
      );
    } else if (optionalChange === "removed") {
      return (
        <Box component="span" sx={{ display: "inline" }}>
          {title}{" "}
          <Box
            component="span"
            sx={{
              textDecoration: "line-through",
              color: "#ff9500",
              fontWeight: "bold",
            }}
          >
            (O)
          </Box>
        </Box>
      );
    } else if (isOptional) {
      return (
        <Box component="span" sx={{ display: "inline" }}>
          {title}{" "}
          <Box component="span" sx={{ color: "#ff9500", fontWeight: "bold" }}>
            (O)
          </Box>
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

    const inheritanceRef = currentVisibleNode.inheritance["parts"]?.ref;

    // Check if inheritance ref is loading
    const isWaitingForInheritanceRef = inheritanceRef && !nodes[inheritanceRef];

    const currentNodeParts =
      inheritanceRef && nodes[inheritanceRef]
        ? nodes[inheritanceRef].properties["parts"]
        : currentVisibleNode.properties["parts"];

    if (!currentNodeParts || !Array.isArray(currentNodeParts) || !currentNodeParts[0]) {
      if (isWaitingForInheritanceRef) {
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
            Loading parts...
          </Typography>
        );
      }
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

    const currentParts = currentNodeParts[0].nodes.map(
      (c: { id: string }) => c.id,
    );

    const { details, nonPickedOnes } = analyzeInheritance(
      inheritanceDetails,
      generalizationParts,
      generalizationId,
      currentParts,
    );
    // Only show "No parts available" if both generalization and current parts are empty and not waitng for any data to load
    if (!isWaitingForInheritanceRef &&
        generalizationParts.length === 0 &&
        currentParts.length === 0) {
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

    const handleSelect = (option: string) => {
      const _previous = { ...inheritanceForParts };
      _previous[pickingFor] = option;
      setInheritanceForParts(_previous);
      const inheritanceRef = doc(
        collection(db, INHERITANCE_FOR_PARTS_COLLECTION_NAME),
        currentVisibleNode.id,
      );
      setDoc(inheritanceRef, {
        inheritedFrom: _previous,
        nodeId: currentVisibleNode.id,
      });
      handleClose();
    };

    return (
      <>
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

              {!readOnly &&
                entry.from &&
                entry.symbol !== "x" &&
                entry.symbol !== "=" && (
                  <ListItemIcon sx={{ minWidth: "auto" }}>
                    <Tooltip title="Search it below" placement="left">
                      <IconButton
                        sx={{ p: 0.4 }}
                        onClick={() =>
                          triggerSearch({
                            id: entry.from,
                            title: nodes[entry.from]?.title || "Unknown",
                          })
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
                      onClick={(e) => {
                        if (!navigateToNode) return;

                        if (e.metaKey || e.ctrlKey) {
                          const url = `${window.location.origin}${window.location.pathname}#${entry.from}`;
                          window.open(url, "_blank");
                        } else {
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
                  <ArrowForwardIosIcon
                    sx={{
                      fontSize: 20,
                      color: pickingFor === entry.from ? "white" : "orange",
                      p: 0.2,
                      borderRadius: "50%",
                    }}
                  />
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
                      onClick={(e) => {
                        if (!navigateToNode) return;

                        if (e.metaKey || e.ctrlKey) {
                          const url = `${window.location.origin}${window.location.pathname}#${entry.to}`;
                          window.open(url, "_blank");
                        } else {
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
                      {formatPartTitle(
                        entry.to,
                        entry.toOptional || false,
                        entry.optionalChange,
                      )}
                    </Link>
                  ) : null
                }
                sx={{ flex: 1, minWidth: 0.3 }}
              />
            </ListItem>
          ))}
        </List>
        <Popover
          id={id}
          open={open}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{
            vertical: "center",
            horizontal: "right",
          }}
          transformOrigin={{
            vertical: "center",
            horizontal: "left",
          }}
          PaperProps={{
            sx: {
              border: "1.5px solid orange",
              borderRadius: "10px",
              backgroundColor: (theme) =>
                theme.palette.mode === "light" ? "#cccccc" : "#524e4e",
            },
          }}
        >
          <List sx={{ p: 0, mx: "4px" }}>
            {(nonPickedOnes[pickingFor] || []).map((option: string) => (
              <ListItem
                disablePadding
                key={option}
                sx={{
                  px: 2,
                  cursor: "pointer",
                  ":hover": {
                    backgroundColor: "gray",
                  },
                  gap: "5px",
                  border: "1px solid gray",
                  borderRadius: "25px",
                  my: "4px",
                }}
              >
                <SwapHorizIcon />
                <ListItemText
                  primary={nodes[option]?.title || "Unknown"}
                  onClick={() => handleSelect(option)}
                />
              </ListItem>
            ))}
          </List>
        </Popover>
      </>
    );
  };
  const activeGeneralization = generalizations.find((g) => g.id === activeTab);

  if (generalizations.length <= 0) {
    return null;
  }

  return (
    <Box>
      {!displayDetails && (
        <Button
          variant="outlined"
          sx={{
            borderRadius: "25px",
            p: 0.5,
            px: 2,
            ml: "10px",
            mb: "9px",
          }}
          onClick={() => {
            setDisplayDetails((prev: boolean) => !prev);
          }}
        >
          <KeyboardArrowDownIcon />
          Parts inherited from ...
        </Button>
      )}
      {displayDetails && (
        <Box
          sx={{
            px: "10px",
            py: "10px",
            mt: "8px",
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
                mb: 1,
              }}
            >
              <Typography
                sx={{ ml: "7px", fontSize: "19px", fontWeight: "bold" }}
              >
                {"Parts inherited from generalizations:"}
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

          {generalizations.length > 1 && (
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              aria-label="Generalization selection tabs"
              variant="scrollable"
              scrollButtons="auto"
              sx={{ mt: 2.5, border: "1px solid gray", borderRadius: "25px" }}
            >
              {generalizations.map((generalization) => (
                <Tab
                  key={generalization.id}
                  label={generalization.title}
                  value={generalization.id}
                  sx={{
                    textTransform: "none",
                    fontWeight: activeTab === generalization.id ? 900 : 500,
                    bgcolor:
                      activeTab === generalization.id
                        ? (theme) =>
                            theme.palette.mode === "light"
                              ? "#bfbfbf"
                              : "#4c4c4c"
                        : "transparent",
                    borderRadius: "16px",
                  }}
                />
              ))}
            </Tabs>
          )}

          {activeGeneralization && (
            <Box key={activeGeneralization.id}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  height: 40,
                  position: "relative",
                  mx: 2,
                }}
              >
                {/* Left Text */}
                <Box
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    pr: "30px", // space to avoid overlap with center icon
                  }}
                >
                  <Tooltip title={activeGeneralization.title}>
                    <Typography
                      sx={{
                        color: "orange",
                        fontWeight: "bold",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {activeGeneralization.title}
                    </Typography>
                  </Tooltip>
                </Box>

                <Box
                  sx={{
                    position: "absolute",
                    left: "50%",
                    transform: "translateX(-50%)",
                  }}
                >
                  <ArrowRightAltIcon
                    sx={{ color: "orange", fontSize: "50px" }}
                  />
                </Box>

                <Box
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    pl: "30px",
                    display: "flex",
                    justifyContent: "flex-end",
                  }}
                >
                  <Tooltip title={currentVisibleNode.title}>
                    <Typography
                      sx={{
                        fontWeight: 500,
                        fontSize: "0.95rem",
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
              </Box>

              {getTabContent(activeGeneralization.id)}
            </Box>
          )}

          <InheritedPartsLegend
            legendItems={[
              { symbol: "(o)", description: "Optional" },
              { symbol: "=", description: "no change" },
              { symbol: ">", description: "specialized part" },
              { symbol: "x", description: "part not inherited" },
              { symbol: "+", description: "part added" },
            ]}
          />
        </Box>
      )}
    </Box>
  );
};

export default InheritedPartsViewer;
