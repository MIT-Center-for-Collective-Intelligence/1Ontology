import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  ListItemText,
  ListItemIcon,
  ListItem,
  List,
  Select,
  MenuItem,
  ListSubheader,
  Tabs,
  Tab,
  Popover,
} from "@mui/material";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import {
  ICollection,
  ILinkNode,
  INode,
  TransferInheritance,
} from "@components/types/INode";
import ArrowRightAltIcon from "@mui/icons-material/ArrowRightAlt";
import RemoveIcon from "@mui/icons-material/Remove";
import SearchIcon from "@mui/icons-material/Search";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";

import AddIcon from "@mui/icons-material/Add";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import DragHandleIcon from "@mui/icons-material/DragHandle";
import CloseIcon from "@mui/icons-material/Close";
import InheritedPartsLegend from "../Common/InheritedPartsLegend";

import {
  query,
  collection,
  where,
  onSnapshot,
  getFirestore,
  doc,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import {
  INHERITANCE_FOR_PARTS_COLLECTION_NAME,
  NODES,
} from "@components/lib/firestoreClient/collections";
import { recordLogs, saveNewChangeLog } from "@components/lib/utils/helpers";

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
  readOnly?: boolean;
  inheritanceDetails: any;
  currentVisibleNode: any;
  setDisplayDetails: any;
  enableEdit: boolean;
  replaceWith: any;
  user: any;
  skillsFutureApp: string;
  navigateToNode?: any;
  triggerSearch?: any;
  addPart?: any;
  removePart?: any;
}

const InheritedPartsViewerEdit: React.FC<InheritedPartsViewerProps> = ({
  selectedProperty,
  getAllGeneralizations,
  getGeneralizationParts,
  nodes,
  readOnly = false,
  inheritanceDetails,
  enableEdit,
  replaceWith,
  currentVisibleNode,
  triggerSearch,
  addPart,
  removePart,
  user,
  navigateToNode,
  setDisplayDetails,
  skillsFutureApp,
}) => {
  const db = getFirestore();
  const [activeTab, setActiveTab] = React.useState<string | null>(null);
  const generalizations: GeneralizationNode[] = getAllGeneralizations();
  const [inheritanceForParts, setInheritanceForParts] = useState<{
    [pickingFor: string]: string;
  }>({});
  const [pickingFor, setPickingFor] = useState<string>("");
  const [anchorEl, setAnchorEl] = useState(null);
  const [isSelectOpen, setIsSelectOpen] = useState(false);

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

  React.useEffect(() => {
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

  const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
    setActiveTab(newValue);
  };

  if (selectedProperty !== "parts" || generalizations.length <= 0) {
    return null;
  }

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
  const handleClick = (event: any, from: string) => {
    setAnchorEl(event.currentTarget);
    setPickingFor(from);
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

    const matchedParts = new Set();
    const usedKeys = new Set();
    const usedGeneralizationParts = new Set();

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

  const getSpecializations = (nodeId: string) => {
    const value = nodes[nodeId].specializations
      .flatMap((s: { nodes: { id: string }[] }) => s.nodes)
      .map((n: { id: string }) => {
        return {
          title: nodes[n.id]?.title,
          id: n.id,
        };
      });

    return value;
  };
  const getGeneralizations = (nodeId: string) => {
    const value = nodes[nodeId].generalizations
      .flatMap((s: { nodes: { id: string }[] }) => s.nodes)
      .map((n: { id: string }) => {
        return {
          title: nodes[n.id]?.title,
          id: n.id,
        };
      });

    return value;
  };

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

    const { details, nonPickedOnes } = analyzeInheritance(
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
    const draggableItems = details.filter((entry: any) => entry.to);
    const nonDraggableItems = Object.keys(nonPickedOnes).filter((id) => {
      const index = details.findIndex((d) => d.from === id);
      return index === -1;
    });

    return (
      <Box
        sx={{
          border: draggableItems.length > 0 ? "1px dashed gray" : "",
          borderRadius: "20px",
        }}
      >
        <Droppable droppableId={`droppable-${generalizationId}`}>
          {(provided) => (
            <List
              ref={provided.innerRef}
              {...provided.droppableProps}
              sx={{
                px: 1.8,
              }}
            >
              {draggableItems.map((entry: any, index: number) => (
                <Draggable
                  key={`${entry.from}-${entry.to}`}
                  draggableId={`${entry.from}-${entry.to}`}
                  index={index}
                >
                  {(providedDraggable) => (
                    <ListItem
                      ref={providedDraggable.innerRef}
                      {...providedDraggable.draggableProps}
                      {...providedDraggable.dragHandleProps}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        px: 1,
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
                                    title: nodes[entry.from].title,
                                  })
                                }
                              >
                                <SearchIcon
                                  sx={{ fontSize: 19, color: "orange" }}
                                />
                              </IconButton>
                            </Tooltip>
                          </ListItemIcon>
                        )}

                      <ListItemText
                        primary={
                          entry.from ? (
                            <Typography>
                              {formatPartTitle(
                                entry.from,
                                entry.fromOptional || false,
                              )}
                            </Typography>
                          ) : null
                        }
                        sx={{ flex: 1, minWidth: 0.3 }}
                      />

                      <ListItemIcon sx={{ minWidth: "auto" }}>
                        {entry.symbol === "x" ? (
                          <CloseIcon sx={{ fontSize: 20, color: "orange" }} />
                        ) : entry.symbol === ">" ? (
                          <Tooltip
                            title={
                              (nonPickedOnes[entry.from] || []).length > 0
                                ? "Switch to"
                                : ""
                            }
                          >
                            <ArrowForwardIosIcon
                              sx={{
                                fontSize: 20,
                                color:
                                  pickingFor === entry.from
                                    ? "white"
                                    : "orange",
                                backgroundColor:
                                  pickingFor === entry.from
                                    ? "orange"
                                    : (nonPickedOnes[entry.from] || []).length >
                                        0
                                      ? (theme) =>
                                          theme.palette.mode === "light"
                                            ? "#a8a8a8"
                                            : "#4a4646"
                                      : "",
                                p: 0.2,
                                borderRadius: "50%",
                                ":hover":
                                  (nonPickedOnes[entry.from] || []).length > 0
                                    ? {
                                        backgroundColor: "gray",
                                      }
                                    : {},
                                cursor: "pointer",
                              }}
                              onClick={(e) => handleClick(e, entry.from)}
                            />
                          </Tooltip>
                        ) : entry.symbol === "=" ? (
                          <DragHandleIcon
                            sx={{ fontSize: 20, color: "orange" }}
                          />
                        ) : entry.symbol === "+" ? (
                          <AddIcon sx={{ fontSize: 20, color: "orange" }} />
                        ) : null}
                      </ListItemIcon>

                      {!!removePart && entry.symbol !== "x" && (
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

                      {entry.symbol === "x" && !!addPart && (
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

                      <ListItemText
                        primary={
                          entry.to ? (
                            <Tooltip
                              title={!isSelectOpen ? nodes[entry.to].title : ""}
                              placement="top"
                              disableHoverListener={isSelectOpen}
                            >
                              <Select
                                value={entry.to}
                                onChange={(e) => {
                                  const newPartId = e.target.value;
                                  replaceWith(entry.to, newPartId);
                                }}
                                onOpen={() => setIsSelectOpen(true)}
                                onClose={() => setIsSelectOpen(false)}
                                size="small"
                                renderValue={() => (
                                  <Box
                                    sx={{
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                      display: "block",
                                    }}
                                  >
                                    {nodes[entry.to].title}
                                  </Box>
                                )}
                                sx={{
                                  color: (theme) =>
                                    theme.palette.mode === "dark"
                                      ? "white"
                                      : "black",
                                  fontSize: "0.9rem",
                                  maxWidth: 250,
                                  width: "100%",
                                  borderRadius: "15px",
                                  backgroundColor: (theme) =>
                                    theme.palette.background.paper,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                                MenuProps={{
                                  PaperProps: {
                                    sx: {
                                      border: "2px solid orange",
                                      borderRadius: "12px",
                                      "&::-webkit-scrollbar": {
                                        display: "none",
                                      },
                                    },
                                  },
                                  MenuListProps: {
                                    sx: {
                                      paddingTop: 0,
                                      paddingBottom: 0,
                                    },
                                  },
                                }}
                              >
                                {getSpecializations(entry.to).length > 0 && (
                                  <ListSubheader
                                    sx={{
                                      color: (theme) =>
                                        theme.palette.mode === "dark"
                                          ? "white"
                                          : "black",
                                      fontSize: "16px",
                                      backgroundColor: (theme) =>
                                        theme.palette.mode === "dark"
                                          ? "#000000"
                                          : "#d0d5dd",
                                      borderBottomLeftRadius: "15px",
                                      borderBottomRightRadius: "15px",
                                    }}
                                  >
                                    Specializations{" "}
                                  </ListSubheader>
                                )}
                                {getSpecializations(entry.to).map(
                                  (spec: any) => (
                                    <MenuItem
                                      key={`spec-${spec.id}`}
                                      value={spec.id}
                                      sx={{
                                        display: "flex",
                                        gap: "10px",
                                        border: "1px solid gray",
                                        borderRadius: "25px",
                                        my: "4px",
                                        mx: "8px",
                                      }}
                                    >
                                      <SwapHorizIcon />
                                      <Typography>{spec.title}</Typography>
                                    </MenuItem>
                                  ),
                                )}

                                {getGeneralizations(entry.to).length > 0 && (
                                  <ListSubheader
                                    sx={{
                                      color: (theme) =>
                                        theme.palette.mode === "dark"
                                          ? "white"
                                          : "black",
                                      fontSize: "16px",
                                      backgroundColor: (theme) =>
                                        theme.palette.mode === "dark"
                                          ? "#000000"
                                          : "#d0d5dd",
                                      borderBottomLeftRadius: "15px",
                                      borderBottomRightRadius: "15px",
                                    }}
                                  >
                                    Generalizations
                                  </ListSubheader>
                                )}
                                {getGeneralizations(entry.to).map(
                                  (gen: any) => (
                                    <MenuItem
                                      key={`gen-${gen.id}`}
                                      value={gen.id}
                                      sx={{
                                        display: "flex",
                                        gap: "10px",
                                        border: "1px solid gray",
                                        borderRadius: "25px",
                                        my: "4px",
                                        mx: "8px",
                                      }}
                                    >
                                      <SwapHorizIcon />{" "}
                                      <Typography>{gen.title}</Typography>
                                    </MenuItem>
                                  ),
                                )}
                              </Select>
                            </Tooltip>
                          ) : null
                        }
                        sx={{ flex: 1, minWidth: 0.3 }}
                      />
                    </ListItem>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </List>
          )}
        </Droppable>
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
                theme.palette.mode === "light" ? "#f8f8f8" : "#524e4e",
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
                    backgroundColor: (theme) =>
                      theme.palette.mode === "dark" ? "#3c3939" : "#e6e6e6",
                  },
                  gap: "5px",
                  border: "1px solid gray",
                  borderRadius: "25px",
                  my: "4px",
                }}
              >
                <SwapHorizIcon />
                <ListItemText
                  primary={nodes[option].title}
                  onClick={() => handleSelect(option)}
                />
              </ListItem>
            ))}
          </List>
        </Popover>
        {nonDraggableItems.length > 0 && (
          <List sx={{ px: 1.8, py: 1, mt: -0.5 }}>
            {nonDraggableItems.map((entryFrom: string, index: number) => (
              <ListItem
                key={`non-draggable-${entryFrom || index}`}
                sx={{
                  display: "flex",
                  backgroundImage:
                    "repeating-linear-gradient(to right, gray 0, gray 1px, transparent 1px, transparent 6px)",
                  backgroundPosition: "top",
                  backgroundRepeat: "repeat-x",
                  backgroundSize: "100% 1px",
                  gap: 1,
                  px: 1,
                  py: 0,
                }}
              >
                <ListItemText
                  primary={
                    entryFrom ? (
                      <Typography>
                        {formatPartTitle(entryFrom, false)}
                      </Typography>
                    ) : null
                  }
                  sx={{ flex: 1, minWidth: 0.3 }}
                />

                <ListItemIcon sx={{ minWidth: "auto" }}>
                  <CloseIcon sx={{ fontSize: 24, color: "orange" }} />
                </ListItemIcon>

                {!!addPart && (
                  <Tooltip title={"Add part"} placement="top">
                    <IconButton
                      sx={{ p: 0.5 }}
                      onClick={() => {
                        addPart(entryFrom);
                      }}
                    >
                      <AddIcon
                        sx={{
                          fontSize: 23,
                          color: "green",
                          border: "1px solid green",
                          borderRadius: "50%",
                        }}
                      />
                    </IconButton>
                  </Tooltip>
                )}

                <ListItemText primary={null} sx={{ flex: 1, minWidth: 0.3 }} />
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    );
  };

  const activeGeneralization = generalizations.find((g) => g.id === activeTab);
  const handleSorting = (e: any) => {
    const draggedId = e.draggableId.split("-")[1];

    try {
      // Destructure properties from the result object
      let { source, destination, draggableId, type } = e;
      draggableId = draggableId.split("-")[1];
      // If there is no destination, no sorting needed

      if (!destination || !user?.uname) {
        return;
      }

      /* these have index 0 by default since parts don't have collections but that may change in the future */
      const sourceCollectionIndex = 0;
      const destinationCollectionIndex = 0;
      const propertyValue: ICollection[] =
        nodes[currentVisibleNode.id].properties["parts"];

      // Ensure defined source and destination categories
      if (propertyValue) {
        // Ensure nodeData exists

        const previousValue = JSON.parse(JSON.stringify(propertyValue));

        if (!propertyValue) return;
        // Find the index of the draggable item in the source category

        const nodeIdx = propertyValue[sourceCollectionIndex].nodes.findIndex(
          (link: ILinkNode) => link.id === draggableId,
        );

        // If the draggable item is found in the source category
        if (nodeIdx !== -1) {
          const moveValue = propertyValue[sourceCollectionIndex].nodes[nodeIdx];

          // Remove the item from the source category
          propertyValue[sourceCollectionIndex].nodes.splice(nodeIdx, 1);

          // Move the item to the destination category
          propertyValue[destinationCollectionIndex].nodes.splice(
            destination.index,
            0,
            moveValue,
          );
        }
        // Update the nodeData with the new property values
        const nodeRef = doc(collection(db, NODES), currentVisibleNode?.id);
        const property = "parts";
        updateDoc(nodeRef, {
          [`properties.${property}`]: propertyValue,
          [`inheritance.${property}.ref`]: null,
        });

        saveNewChangeLog(db, {
          nodeId: currentVisibleNode?.id,
          modifiedBy: user?.uname,
          modifiedProperty: property,
          previousValue,
          newValue: propertyValue,
          modifiedAt: new Date(),
          changeType: "sort elements",
          changeDetails: {
            draggableNodeId: draggableId,
            source,
            destination,
          },
          fullNode: currentVisibleNode,
          skillsFuture: !!skillsFutureApp,
          ...(skillsFutureApp ? { appName: skillsFutureApp } : {}),
        });

        // Record a log of the sorting action
        recordLogs({
          action: "sort elements",
          field: property,
          sourceCategory: "main",
          destinationCategory: "main",
          nodeId: currentVisibleNode?.id,
        });
      }
    } catch (error: any) {
      // Log any errors that occur during the sorting process
      console.error(error);
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

  return (
    <Box
      sx={{
        px: "10px",
        // py: "10px",
        backgroundColor: !enableEdit
          ? (theme) => (theme.palette.mode === "light" ? "#fafbfc" : "#1e1e1f")
          : "",
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
          {!enableEdit && (
            <Typography sx={{ ml: "7px" }}>
              {"Parts inherited from generalizations"}
            </Typography>
          )}
          {!triggerSearch && !enableEdit && (
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
                        theme.palette.mode === "light" ? "#bfbfbf" : "#4c4c4c"
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
              <ArrowRightAltIcon sx={{ color: "orange", fontSize: "50px" }} />
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

          <DragDropContext
            onDragEnd={(e) => {
              handleSorting(e);
            }}
          >
            {getTabContent(activeGeneralization.id)}
          </DragDropContext>
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
  );
};

export default InheritedPartsViewerEdit;
