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
                              {`${entry.from}-`}
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
                              title={nodes[entry.to].title}
                              placement="top"
                            >
                              <Select
                                value={entry.to}
                                onChange={(e) => {
                                  const newPartId = e.target.value;
                                  replaceWith(entry.to, newPartId);
                                }}
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
                                    },
                                  },
                                }}
                              >
                                {getSpecializations(entry.to).length > 0 && (
                                  <ListSubheader
                                    sx={{ color: "orange", fontSize: "16px" }}
                                  >
                                    Specializations{" "}
                                  </ListSubheader>
                                )}
                                {getSpecializations(entry.to).map(
                                  (spec: any) => (
                                    <MenuItem
                                      key={`spec-${spec.id}`}
                                      value={spec.id}
                                      sx={{ display: "flex", gap: "10px" }}
                                    >
                                      <SwapHorizIcon />
                                      <Typography>{spec.title}</Typography>
                                    </MenuItem>
                                  ),
                                )}

                                {getGeneralizations(entry.to).length > 0 && (
                                  <ListSubheader
                                    sx={{ color: "orange", fontSize: "16px" }}
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
              border: "2px solid orange",
              backgroundColor: (theme) =>
                theme.palette.mode === "light" ? "#cccccc" : "#524e4e",
            },
          }}
        >
          <List>
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

[
  {
    title: "Act",
    generalizations: [],
    specializations: [
      {
        collectionName: "Act by whom?",
        nodes: ["Act by a group", "Act by an individual"],
      },
      {
        collectionName: "Act on what?",
        nodes: [
          "Act on information (“Think”)",
          "Act on physical objects (“Do”)",
          "Act with other actors (“Interact”)",
        ],
      },
      {
        collectionName: "Act how?",
        nodes: ["Create", "Modify", "Transfer", "Store"],
      },
      {
        collectionName: "Act for what purpose?",
        nodes: ["Maintain", "Change"],
      },
      {
        collectionName: "Act by process phase?",
        nodes: ["Keep", "Work"],
      },
      {
        collectionName: "Act by what composite action?",
        nodes: ["Acquire"],
      },
      {
        collectionName: "Act by process step?",
        nodes: ["Prepare to Act", "Execute Act", "Conclude Act"],
      },
    ],
    parts: [
      {
        title: "Get",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Decide to Act",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Act",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Act",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Act",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Provide",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
    ],
    description:
      "To perform a primary work-related action. This is the most general activity in the ontology, representing the root of all actions. It can be specialized by what is being acted upon (information, physical objects, other actors), by the fundamental nature of the action (create, modify, transfer, store), or by its ultimate purpose (maintain, change).",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Act by a group",
    generalizations: ["Act"],
    specializations: [
      {
        collectionName: "Act by what type of group?",
        nodes: [
          "Act by a hierarchy",
          "Act by a market",
          "Act by a community",
          "Act by a democracy",
          "Act by an ecosystem",
        ],
      },
      {
        collectionName: "Act by what kind of group?",
        nodes: [
          "Act by a group of humans",
          "Act by a group of machines",
          "Act by a group of humans and machines",
        ],
      },
      {
        collectionName: "Act by a group how?",
        nodes: [
          "Create by a group",
          "Modify by a group",
          "Transfer by a group",
          "Store by a group",
        ],
      },
      {
        collectionName: "Act by a group for what purpose?",
        nodes: ["Maintain by a group", "Change by a group"],
      },
      {
        collectionName: "Act by a group by process phase?",
        nodes: ["Keep by a group", "Work by a group"],
      },
      {
        collectionName: "Interact how by a group?",
        nodes: [
          "Negotiate by a group",
          "Collaborate by a group",
          "Guide by a group",
        ],
      },
      {
        collectionName: "Act by a group by process step?",
        nodes: [
          "Prepare to Act by a group",
          "Execute Act by a group",
          "Conclude Act by a group",
        ],
      },
      {
        collectionName: "Act by a group for what function?",
        nodes: ["Manage by a group", "Resolve Problem by a group"],
      },
      {
        collectionName: "Act by a group on what?",
        nodes: [
          "Act on information by a group",
          "Act on physical objects by a group",
          "Act with other actors by a group",
        ],
      },
    ],
    parts: [
      {
        title: "Get by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Decide to Act by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Act by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Act by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Act by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Provide by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
    ],
    description:
      "To perform a primary work-related action as a collective effort by a group of actors. This is a specialization of 'Act' where the action is not performed by a single individual, but by a coordinated or collaborative group.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Act by a hierarchy",
    generalizations: ["Act by a group"],
    specializations: [
      {
        collectionName: "Act on what by a hierarchy?",
        nodes: [
          "Act on information by a hierarchy",
          "Act on physical objects by a hierarchy",
        ],
      },
      {
        collectionName: "Act by a hierarchy how?",
        nodes: [
          "Create by a hierarchy",
          "Modify by a hierarchy",
          "Store by a hierarchy",
          "Transfer by a hierarchy",
        ],
      },
      {
        collectionName: "Act by a hierarchy for what purpose?",
        nodes: ["Maintain by a hierarchy", "Change by a hierarchy"],
      },
      {
        collectionName: "Act by a hierarchy by what kind of group?",
        nodes: [
          "Act by a hierarchy by a group of machines",
          "Act by a hierarchy by a group of humans and machines",
          "Act by a hierarchy by a group of humans",
        ],
      },
      {
        collectionName: "Act by a hierarchy with whom?",
        nodes: ["Act with other actors by a hierarchy"],
      },
      {
        collectionName: "Interact how by a hierarchy?",
        nodes: [
          "Negotiate by a hierarchy",
          "Collaborate by a hierarchy",
          "Guide by a hierarchy",
        ],
      },
    ],
    parts: [
      {
        title: "Get by a hierarchy",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Decide to Act by a hierarchy",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Act by a hierarchy",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Act by a hierarchy",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Act by a hierarchy",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Provide by a hierarchy",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
    ],
    description:
      "To perform a primary work-related action as a group organized in a hierarchical structure, where authority and responsibility are distributed in a tiered or command-based system.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Act by a market",
    generalizations: ["Act by a group"],
    specializations: [
      {
        collectionName: "Act by a market how?",
        nodes: [
          "Create by a market",
          "Modify by a market",
          "Transfer by a market",
          "Store by a market",
        ],
      },
      {
        collectionName: "Act by a market on what?",
        nodes: [
          "Act on information by a market",
          "Act on physical objects by a market",
          "Act with other actors by a market",
        ],
      },
      {
        collectionName: "Act by a market by what kind of group?",
        nodes: [
          "Act by a market by a group of humans",
          "Act by a market by a group of machines",
        ],
      },
    ],
    parts: [
      {
        title: "Get by a market",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Decide to Act by a market",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Act by a market",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Act by a market",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Act by a market",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Provide by a market",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
    ],
    description:
      "To perform a primary work-related action within a market structure, where activities are driven by supply and demand and interactions are typically transactional.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Act by a community",
    generalizations: ["Act by a group"],
    specializations: [
      {
        collectionName: "Act by a community on what?",
        nodes: [
          "Act on information by a community",
          "Act on physical objects by a community",
          "Act with other actors by a community",
        ],
      },
      {
        collectionName: "Act by a community how?",
        nodes: [
          "Create by a community",
          "Modify by a community",
          "Transfer by a community",
          "Store by a community",
        ],
      },
      {
        collectionName: "Act by a community for what purpose?",
        nodes: ["Maintain by a community", "Change by a community"],
      },
      {
        collectionName: "Act by a community by process phase?",
        nodes: ["Keep by a community", "Work by a community"],
      },
      {
        collectionName: "Act by a community by what kind of group?",
        nodes: [
          "Act by a community by a group of humans",
          "Act by a community by a group of machines",
          "Act by a community by a group of humans and machines",
        ],
      },
    ],
    parts: [
      {
        title: "Get by a community",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Decide to Act by a community",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Act by a community",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Act by a community",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Act by a community",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Provide by a community",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
    ],
    description:
      "To perform a primary work-related action as a group based on shared interests, values, or goals, often involving informal collaboration and mutual support.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Act by a democracy",
    generalizations: ["Act by a group"],
    specializations: [
      {
        collectionName: "Act by a democracy how?",
        nodes: [
          "Create by a democracy",
          "Modify by a democracy",
          "Transfer by a democracy",
          "Store by a democracy",
        ],
      },
      {
        collectionName: "Act by a democracy by what kind of group?",
        nodes: [
          "Act by a democracy by a group of humans",
          "Act by a democracy by a group of machines",
          "Act by a democracy by a group of humans and machines",
        ],
      },
      {
        collectionName: "Act by a democracy on what?",
        nodes: [
          "Act on information by a democracy",
          "Act on physical objects by a democracy",
        ],
      },
      {
        collectionName: "Act by a democracy for what purpose?",
        nodes: ["Maintain by a democracy", "Change by a democracy"],
      },
    ],
    parts: [
      {
        title: "Get by a democracy",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Decide to Act by a democracy",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Act by a democracy",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Act by a democracy",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Act by a democracy",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Provide by a democracy",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
    ],
    description:
      "To perform a primary work-related action as a group where decisions and control are exercised by all members, typically through voting or consensus.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Act by an ecosystem",
    generalizations: ["Act by a group"],
    specializations: [
      {
        collectionName: "Act by an ecosystem on what?",
        nodes: [
          "Act on information by an ecosystem",
          "Act on physical objects by an ecosystem",
          "Act with other actors by an ecosystem",
        ],
      },
      {
        collectionName: "Act by an ecosystem how?",
        nodes: [
          "Create by an ecosystem",
          "Modify by an ecosystem",
          "Transfer by an ecosystem",
          "Store by an ecosystem",
        ],
      },
      {
        collectionName: "Act by an ecosystem for what function?",
        nodes: ["Resolve Problem by an ecosystem", "Manage by an ecosystem"],
      },
      {
        collectionName: "Create what by an ecosystem?",
        nodes: ["Create information by an ecosystem"],
      },
    ],
    parts: [
      {
        title: "Get by an ecosystem",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Decide to Act by an ecosystem",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Act by an ecosystem",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Act by an ecosystem",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Act by an ecosystem",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Provide by an ecosystem",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
    ],
    description:
      "To perform a primary work-related action within a complex network of interconnected and interdependent actors, where the actions of one entity can affect many others.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Act by a group of humans",
    generalizations: ["Act by a group"],
    specializations: [
      {
        collectionName: "Act by a group of humans on what?",
        nodes: [
          "Act on physical objects by a group of humans",
          "Act on information by a group of humans",
          "Act with other actors by a group of humans",
        ],
      },
      {
        collectionName: "Act by what type of group?",
        nodes: [
          "Act by a democracy by a group of humans",
          "Act by a market by a group of humans",
          "Act by a hierarchy by a group of humans",
        ],
      },
      {
        collectionName: "Act by a group of humans how?",
        nodes: ["Create by a group of humans"],
      },
      {
        collectionName: "Act with other actors how by a group of humans?",
        nodes: ["Collaborate by a group of humans"],
      },
      {
        collectionName: "Act by what other type of group?",
        nodes: ["Act by a community by a group of humans"],
      },
    ],
    parts: [
      {
        title: "Get by a group of humans",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Decide to Act by a group of humans",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Act by a group of humans",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Act by a group of humans",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Act by a group of humans",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Provide by a group of humans",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
    ],
    description:
      "To perform a primary work-related action as a collective effort by a group of human actors. This is a specialization of 'Act by a group' specifying the actors are humans.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Act by a group of machines",
    generalizations: ["Act by a group"],
    specializations: [
      {
        collectionName: "Act by what type of group?",
        nodes: [
          "Act by a democracy by a group of machines",
          "Act by a market by a group of machines",
          "Act by a hierarchy by a group of machines",
        ],
      },
      {
        collectionName: "Act by a group of machines how?",
        nodes: ["Create by a group of machines"],
      },
      {
        collectionName: "Act by what other type of group?",
        nodes: ["Act by a community by a group of machines"],
      },
    ],
    parts: [
      {
        title: "Get by a group of machines",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Decide to Act by a group of machines",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Act by a group of machines",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Act by a group of machines",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Act by a group of machines",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Provide by a group of machines",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
    ],
    description:
      "To perform a primary work-related action as a collective effort by a group of machine actors. This is a specialization of 'Act by a group' specifying the actors are machines.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Act by a group of humans and machines",
    generalizations: ["Act by a group"],
    specializations: [
      {
        collectionName: "Act by what type of group?",
        nodes: [
          "Act by a democracy by a group of humans and machines",
          "Act by a hierarchy by a group of humans and machines",
        ],
      },
      {
        collectionName: "Act by a group of humans and machines how?",
        nodes: ["Create by a group of humans and machines"],
      },
      {
        collectionName: "Act by what other type of group?",
        nodes: ["Act by a community by a group of humans and machines"],
      },
    ],
    parts: [
      {
        title: "Get by a group of humans and machines",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Decide to Act by a group of humans and machines",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Act by a group of humans and machines",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Act by a group of humans and machines",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Act by a group of humans and machines",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Provide by a group of humans and machines",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
    ],
    description:
      "To perform a primary work-related action as a collective effort by a mixed group of human and machine actors. This is a specialization of 'Act by a group' for hybrid human-machine teams.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Create by a group",
    generalizations: ["Create", "Act by a group"],
    specializations: [
      {
        collectionName: "Create by what type of group?",
        nodes: [
          "Create by a hierarchy",
          "Create by a market",
          "Create by a community",
          "Create by a democracy",
        ],
      },
      {
        collectionName: "Create what by a group?",
        nodes: [
          "Create information by a group",
          "Create physical objects by a group",
        ],
      },
      {
        collectionName: "Create with whom by a group?",
        nodes: ["Create with other actors by a group"],
      },
      {
        collectionName: "Create how by a group?",
        nodes: ["Form by a group"],
      },
      {
        collectionName: "Create for what purpose by a group?",
        nodes: ["Create to Maintain by a group", "Create to Change by a group"],
      },
      {
        collectionName: "Create by process phase by a group?",
        nodes: ["Create by keeping by a group", "Create by working by a group"],
      },
      {
        collectionName: "Create by what kind of group?",
        nodes: [
          "Create by a group of humans",
          "Create by a group of machines",
          "Create by a group of humans and machines",
        ],
      },
    ],
    parts: [
      {
        title: "Decide to Create by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Create by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Creation by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Finalize Creation by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To bring something new into existence as a collective effort by a group of actors. This is a virtual specialization of 'Create' and 'Act by a group'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Modify by a group",
    generalizations: ["Modify", "Act by a group"],
    specializations: [
      {
        collectionName: "Modify by what type of group?",
        nodes: ["Modify by a hierarchy", "Modify by a democracy"],
      },
      {
        collectionName: "Modify what by a group?",
        nodes: [
          "Modify information by a group",
          "Modify physical objects by a group",
        ],
      },
      {
        collectionName: "Modify by a group how?",
        nodes: [
          "Move by a group",
          "Combine by a group",
          "Separate by a group",
          "Transform by a group",
        ],
      },
      {
        collectionName: "Modify by a group for what purpose?",
        nodes: ["Modify to Maintain by a group", "Modify to Change by a group"],
      },
      {
        collectionName: "Modify by a group by process phase?",
        nodes: ["Modify by keeping by a group", "Modify by working by a group"],
      },
    ],
    parts: [
      {
        title: "Decide to Modify by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Modify by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Modification by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Modification by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To cause a change in an entity's form, quality, or properties through the collective effort of a group of actors. This is a virtual specialization of 'Modify' and 'Act by a group'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Transfer by a group",
    generalizations: ["Transfer", "Act by a group"],
    specializations: [
      {
        collectionName: "Transfer by what type of group?",
        nodes: [
          "Transfer by a hierarchy",
          "Transfer by a community",
          "Transfer by a democracy",
        ],
      },
      {
        collectionName: "Transfer what by a group?",
        nodes: [
          "Transfer information by a group",
          "Transfer physical objects by a group",
          "Transfer service by a group",
        ],
      },
      {
        collectionName: "Transfer in what direction by a group?",
        nodes: [
          "Transfer in by a group",
          "Transfer out by a group",
          "Transfer end-to-end by a group",
          "Transfer both ways by a group",
        ],
      },
      {
        collectionName: "Transfer by interacting by a group?",
        nodes: ["Transfer with other actors by a group"],
      },
      {
        collectionName: "Transfer what software by a group?",
        nodes: ["Deploy Software by a group"],
      },
    ],
    parts: [
      {
        title: "Initiate Transfer by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Transfer by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Finalize Transfer by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
    ],
    description:
      "To move something from one place to another through the collective effort of a group of actors. This is a virtual specialization of 'Transfer' and 'Act by a group'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Store by a group",
    generalizations: ["Store", "Act by a group"],
    specializations: [
      {
        collectionName: "Store by what type of group?",
        nodes: [
          "Store by a hierarchy",
          "Store by a community",
          "Store by a democracy",
        ],
      },
    ],
    parts: [
      {
        title: "Decide to Store by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare for storage by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Execute Storage by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Storage by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To keep or lay aside something for future use through the collective effort of a group of actors. This is a virtual specialization of 'Store' and 'Act by a group'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Maintain by a group",
    generalizations: ["Act by a group", "Maintain"],
    specializations: [
      {
        collectionName: "Maintain by what type of group?",
        nodes: ["Maintain by a hierarchy"],
      },
      {
        collectionName: "Maintain what by a group?",
        nodes: ["Maintain physical objects by a group"],
      },
      {
        collectionName: "Maintain by what other type of group?",
        nodes: ["Maintain by a democracy"],
      },
    ],
    parts: [
      {
        title: "Decide to Maintain by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Maintain by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Maintenance by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Maintenance by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To keep an object or information in its existing state through the collective effort of a group of actors. This is a virtual specialization of 'Maintain' and 'Act by a group'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Change by a group",
    generalizations: ["Act by a group", "Change"],
    specializations: [
      {
        collectionName: "Change by what type of group?",
        nodes: ["Change by a hierarchy"],
      },
      {
        collectionName: "Change by what other type of group?",
        nodes: ["Change by a democracy"],
      },
    ],
    parts: [
      {
        title: "Decide to Change by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Change by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Change by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Change by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To make or become different through the collective effort of a group of actors. This is a virtual specialization of 'Change' and 'Act by a group'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Keep by a group",
    generalizations: ["Keep", "Act by a group"],
    specializations: [],
    parts: [
      {
        title: "Decide to Keep by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Keep by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Keep by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Keep by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To retain possession of or maintain something through the collective effort of a group of actors. This is a virtual specialization of 'Keep' and 'Act by a group'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Work by a group",
    generalizations: ["Work", "Act by a group"],
    specializations: [],
    parts: [
      {
        title: "Decide to Work by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Work by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Work by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Work by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To engage in activity involving mental or physical effort through the collective action of a group of actors. This is a virtual specialization of 'Work' and 'Act by a group'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Negotiate by a group",
    generalizations: ["Negotiate", "Act by a group"],
    specializations: [
      {
        collectionName: "Negotiate by what type of group?",
        nodes: ["Negotiate by a hierarchy"],
      },
    ],
    parts: [
      {
        title: "Prepare for Negotiation by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conduct Negotiation by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Finalize Agreement by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To confer with others in order to reach a compromise or agreement, where the negotiation is conducted by a collective group. This is a virtual specialization of 'Negotiate' and 'Act by a group'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Collaborate by a group",
    generalizations: ["Collaborate", "Act by a group"],
    specializations: [
      {
        collectionName: "Collaborate by what type of group?",
        nodes: ["Collaborate by a hierarchy"],
      },
      {
        collectionName: "Collaborate by a group how?",
        nodes: [
          "Participate by a group",
          "Agree by a group",
          "Arrange by a group",
          "Join by a group",
        ],
      },
      {
        collectionName: "Collaborate by a group for what action?",
        nodes: [
          "Collaborate to create by a group",
          "Collaborate to modify by a group",
        ],
      },
      {
        collectionName: "Collaborate by a group for what purpose?",
        nodes: [
          "Collaborate to maintain by a group",
          "Collaborate to change by a group",
        ],
      },
      {
        collectionName: "Collaborate by what kind of group?",
        nodes: ["Collaborate by a group of humans"],
      },
    ],
    parts: [
      {
        title: "Decide to Collaborate by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Collaborate by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Collaboration by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Collaboration by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To work jointly with others on a common enterprise or project, where the collaborating entity is a group.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Guide by a group",
    generalizations: ["Act by a group", "Guide"],
    specializations: [
      {
        collectionName: "Guide by what type of group?",
        nodes: ["Guide by a hierarchy"],
      },
    ],
    parts: [
      {
        title: "Assess Needs of Guided Party by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Formulate Guidance by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Provide Guidance by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
    ],
    description:
      "To show the way to or advise a person or group, where the guidance is provided by a collective group of actors.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Prepare to Act by a group",
    generalizations: ["Prepare to Act", "Act by a group"],
    specializations: [
      {
        collectionName: "Prepare to Act by what type of group?",
        nodes: ["Prepare to Act by a hierarchy"],
      },
      {
        collectionName: "Prepare to Act by what kind of group?",
        nodes: [
          "Prepare to Act by a group of humans",
          "Prepare to Act by a group of machines",
          "Prepare to Act by a group of humans and machines",
        ],
      },
      {
        collectionName: "Prepare to do what by a group?",
        nodes: ["Prepare to Create Information by a group"],
      },
      {
        collectionName: "Prepare to Act on what by a group?",
        nodes: [
          "Prepare to Modify Physical Object by a group",
          "Prepare to Act on Information by a group",
          "Prepare to Act on Physical Object by a group",
        ],
      },
      {
        collectionName: "Prepare for what interaction by a group?",
        nodes: [
          "Prepare to Collaborate by a group",
          "Prepare for Negotiation by a group",
          "Prepare to Work by a group",
          "Prepare to Keep by a group",
        ],
      },
      {
        collectionName: "Prepare to interact how by a group?",
        nodes: ["Prepare to Interact by a group"],
      },
      {
        collectionName: "Prepare to Act by what other type of group?",
        nodes: [
          "Prepare to Act by a market",
          "Prepare to Act by a community",
          "Prepare to Act by a democracy",
          "Prepare to Act by an ecosystem",
        ],
      },
    ],
    parts: [],
    description:
      "To get ready to perform the main part of an action, performed collectively by a group of actors. This is a virtual specialization of 'Prepare to Act' and 'Act by a group'.",
    "Editorial Notes": "",
    isPartOf: ["Act by a group"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Execute Act by a group",
    generalizations: ["Execute Act", "Act by a group"],
    specializations: [
      {
        collectionName: "Execute Act by what type of group?",
        nodes: ["Execute Act by a hierarchy"],
      },
      {
        collectionName: "Execute Act by what kind of group?",
        nodes: [
          "Execute Act by a group of humans",
          "Execute Act by a group of machines",
          "Execute Act by a group of humans and machines",
        ],
      },
      {
        collectionName: "Execute Act on what by a group?",
        nodes: ["Execute Information Creation by a group"],
      },
      {
        collectionName: "Execute what interaction by a group?",
        nodes: ["Execute Interaction by a group"],
      },
      {
        collectionName: "Execute what action by a group?",
        nodes: [
          "Execute Physical Object Modification by a group",
          "Execute Act on Information by a group",
          "Execute Act on Physical Object by a group",
        ],
      },
      {
        collectionName: "Execute what specific interaction by a group?",
        nodes: [
          "Execute Collaboration by a group",
          "Conduct Negotiation by a group",
          "Execute Work by a group",
          "Execute Keep by a group",
        ],
      },
      {
        collectionName: "Execute Act by what other type of group?",
        nodes: [
          "Execute Act by a market",
          "Execute Act by a community",
          "Execute Act by a democracy",
          "Execute Act by an ecosystem",
        ],
      },
    ],
    parts: [],
    description:
      "The core performance of an action, performed collectively by a group of actors. This is a virtual specialization of 'Execute Act' and 'Act by a group'.",
    "Editorial Notes": "",
    isPartOf: ["Act by a group"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Conclude Act by a group",
    generalizations: ["Conclude Act", "Act by a group"],
    specializations: [
      {
        collectionName: "Conclude Act by what type of group?",
        nodes: ["Conclude Act by a hierarchy"],
      },
      {
        collectionName: "Conclude Act by what kind of group?",
        nodes: [
          "Conclude Act by a group of humans",
          "Conclude Act by a group of machines",
          "Conclude Act by a group of humans and machines",
        ],
      },
      {
        collectionName: "Conclude Act on what by a group?",
        nodes: ["Finalize Information Creation by a group"],
      },
      {
        collectionName: "Conclude what interaction by a group?",
        nodes: ["Conclude Interaction by a group"],
      },
      {
        collectionName: "Conclude what action by a group?",
        nodes: [
          "Conclude Physical Object Modification by a group",
          "Conclude Act on Information by a group",
          "Conclude Act on Physical Object by a group",
        ],
      },
      {
        collectionName: "Conclude what specific interaction by a group?",
        nodes: [
          "Conclude Collaboration by a group",
          "Finalize Agreement by a group",
          "Conclude Work by a group",
          "Conclude Keep by a group",
        ],
      },
      {
        collectionName: "Conclude Act by what other type of group?",
        nodes: [
          "Conclude Act by a market",
          "Conclude Act by a community",
          "Conclude Act by a democracy",
          "Conclude Act by an ecosystem",
        ],
      },
    ],
    parts: [],
    description:
      "The final activities to wrap up an action, performed collectively by a group of actors. This is a virtual specialization of 'Conclude Act' and 'Act by a group'.",
    "Editorial Notes": "",
    isPartOf: ["Act by a group"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Manage by a group",
    generalizations: ["Manage", "Act by a group"],
    specializations: [],
    parts: [],
    description:
      "To coordinate and oversee activities, resources, or people to achieve specific goals, as performed by a collective group.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Resolve Problem by a group",
    generalizations: ["Resolve Problem", "Act by a group"],
    specializations: [],
    parts: [],
    description:
      "To find a definitive solution or settlement for a problem through the collective actions of a group.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Act on information by a group",
    generalizations: ["Act by a group", "Act on information (“Think”)"],
    specializations: [
      {
        collectionName: "Act on information by what type of group?",
        nodes: [
          "Act on information by a hierarchy",
          "Act on information by a community",
          "Act on information by a market",
          "Act on information by a democracy",
        ],
      },
      {
        collectionName: "Act on information by a group how?",
        nodes: [
          "Create information by a group",
          "Modify information by a group",
          "Store information by a group",
          "Transfer information by a group",
        ],
      },
    ],
    parts: [
      {
        title: "Decide to Act on Information by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Act on Information by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Act on Information by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Act on Information by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To perform a work-related action on information as a collective effort by a group of actors. This is a virtual specialization of 'Act on information (“Think”)' and 'Act by a group'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Act on physical objects by a group",
    generalizations: ["Act by a group", "Act on physical objects (“Do”)"],
    specializations: [
      {
        collectionName: "Act on physical objects by what type of group?",
        nodes: [
          "Act on physical objects by a hierarchy",
          "Act on physical objects by a community",
          "Act on physical objects by a market",
        ],
      },
      {
        collectionName: "Act on physical objects by what kind of group?",
        nodes: ["Act on physical objects by a group of humans"],
      },
      {
        collectionName: "Act on physical objects by a group how?",
        nodes: ["Assemble by a group"],
      },
      {
        collectionName: "Modify what by a group?",
        nodes: ["Modify physical objects by a group"],
      },
    ],
    parts: [
      {
        title: "Decide to Act on Physical Object by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Act on Physical Object by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Act on Physical Object by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Act on Physical Object by a group",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To perform a work-related action on physical objects as a collective effort by a group of actors. This is a virtual specialization of 'Act on physical objects (“Do”)' and 'Act by a group'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Act with other actors by a group",
    generalizations: ["Act by a group", "Act with other actors (“Interact”)"],
    specializations: [],
    parts: [],
    description:
      "To interact with other actors as a collective effort by a group. This is a virtual specialization of 'Act with other actors (“Interact”)' and 'Act by a group'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Act by an individual",
    generalizations: ["Act"],
    specializations: [
      {
        collectionName: "Act by what kind of individual?",
        nodes: ["Act by a human", "Act by a machine"],
      },
      {
        collectionName: "Act on what by an individual?",
        nodes: [
          "Act on information by an individual",
          "Act on physical objects by an individual",
          "Act with other actors by an individual",
        ],
      },
      {
        collectionName: "Act how by an individual?",
        nodes: [
          "Create by an individual",
          "Modify by an individual",
          "Transfer by an individual",
          "Store by an individual",
        ],
      },
      {
        collectionName: "Act by an individual for what function?",
        nodes: ["Provide service by an individual"],
      },
      {
        collectionName: "Act by an individual for what purpose?",
        nodes: ["Maintain by an individual", "Change by an individual"],
      },
      {
        collectionName: "Act by an individual by process phase?",
        nodes: ["Keep by an individual", "Work by an individual"],
      },
      {
        collectionName: "Interact how by an individual?",
        nodes: ["Collaborate by an individual", "Negotiate by an individual"],
      },
      {
        collectionName: "Act by an individual for what other function?",
        nodes: ["Resolve Problem by an individual", "Manage by an individual"],
      },
      {
        collectionName: "Act by an individual for what specific interaction?",
        nodes: ["Guide by an individual"],
      },
      {
        collectionName: "Act by an individual by process step?",
        nodes: [
          "Prepare to Act by an individual",
          "Execute Act by an individual",
          "Conclude Act by an individual",
        ],
      },
    ],
    parts: [
      {
        title: "Decide to Act by an individual",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To perform a primary work-related action by a single, individual actor (e.g., a human, a machine). This is a specialization of 'Act' that contrasts with actions performed by groups.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Act by a human",
    generalizations: ["Act by an individual"],
    specializations: [
      {
        collectionName: "Act on what by a human?",
        nodes: [
          "Act on information by a human",
          "Act on physical objects by a human",
          "Act with other actors by a human",
        ],
      },
      {
        collectionName: "Act how by a human?",
        nodes: [
          "Create by a human",
          "Modify by a human",
          "Transfer by a human",
          "Store by a human",
        ],
      },
      {
        collectionName: "Act for what purpose by a human?",
        nodes: ["Maintain by a human", "Change by a human"],
      },
      {
        collectionName: "Act for what specific purpose by a human?",
        nodes: ["Ensure Safety by a human"],
      },
      {
        collectionName: "Act by a human for what function?",
        nodes: ["Provide service by a human", "Manage by a human"],
      },
      {
        collectionName: "Act by process phase by a human?",
        nodes: ["Keep by a human", "Work by a human"],
      },
      {
        collectionName: "Act by a human by process step?",
        nodes: [
          "Prepare to Act by a human",
          "Execute Act by a human",
          "Conclude Act by a human",
        ],
      },
      {
        collectionName: "Act by a human for what abstract function?",
        nodes: ["Resolve Problem by a human"],
      },
      {
        collectionName: "Interact how by a human?",
        nodes: ["Collaborate by a human", "Negotiate by a human"],
      },
      {
        collectionName: "Act by a human for what medical purpose?",
        nodes: [],
      },
    ],
    parts: [
      {
        title: "Get by a human",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Decide to Act by a human",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Act by a human",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Act by a human",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Act by a human",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Provide by a human",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
    ],
    description:
      "To perform a primary work-related action by a single human actor. This is a specialization of 'Act by an individual' where the actor is a person.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Act by a machine",
    generalizations: ["Act by an individual"],
    specializations: [
      {
        collectionName: "Act on what by a machine?",
        nodes: [
          "Act on information by a machine",
          "Act on physical objects by a machine",
          "Act with other actors by a machine",
        ],
      },
    ],
    parts: [
      {
        title: "Decide to Act by a machine",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Act by a machine",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Act by a machine",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Act by a machine",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To perform a primary work-related action by a single machine actor, such as a computer or robot. This is a specialization of 'Act by an individual' where the actor is a machine.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Act on information by an individual",
    generalizations: ["Act by an individual", "Act on information (“Think”)"],
    specializations: [
      {
        collectionName: "Act on information by what kind of individual?",
        nodes: [
          "Act on information by a human",
          "Act on information by a machine",
        ],
      },
    ],
    parts: [],
    description:
      "To perform a work-related action on information by a single, individual actor. This is a virtual specialization of 'Act on information (“Think”)' and 'Act by an individual'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Act on physical objects by an individual",
    generalizations: ["Act by an individual", "Act on physical objects (“Do”)"],
    specializations: [
      {
        collectionName: "Act on physical objects by an individual how?",
        nodes: ["Assemble by an individual"],
      },
      {
        collectionName: "Act on physical objects by what kind of individual?",
        nodes: ["Act on physical objects by a human"],
      },
    ],
    parts: [],
    description:
      "To perform a work-related action on a physical object by a single, individual actor. This is a virtual specialization of 'Act on physical objects (“Do”)' and 'Act by an individual'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Act with other actors by an individual",
    generalizations: [
      "Act by an individual",
      "Act with other actors (“Interact”)",
    ],
    specializations: [
      {
        collectionName: "Act with other actors by what kind of individual?",
        nodes: ["Act with other actors by a human"],
      },
    ],
    parts: [
      {
        title: "Decide to Interact by an individual",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Interact by an individual",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Interaction by an individual",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Interaction by an individual",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To interact with other actors as a single, individual actor. This is a virtual specialization of 'Act with other actors (“Interact”)' and 'Act by an individual'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Create by an individual",
    generalizations: ["Create", "Act by an individual"],
    specializations: [
      {
        collectionName: "Create by what kind of individual?",
        nodes: ["Create by a human"],
      },
      {
        collectionName: "Create what by an individual?",
        nodes: [
          "Create information by an individual",
          "Create physical objects by an individual",
        ],
      },
    ],
    parts: [
      {
        title: "Decide to Create by an individual",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Create by an individual",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Creation by an individual",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Finalize Creation by an individual",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To bring something new into existence through the effort of a single individual actor. This is a virtual specialization of 'Create' and 'Act by an individual'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Modify by an individual",
    generalizations: ["Modify", "Act by an individual"],
    specializations: [
      {
        collectionName: "Modify what by an individual?",
        nodes: [
          "Modify physical objects by an individual",
          "Modify information by an individual",
        ],
      },
      {
        collectionName: "Modify by what kind of individual?",
        nodes: ["Modify by a human"],
      },
      {
        collectionName: "Modify physical objects by an individual how?",
        nodes: [
          "Move physical objects by an individual",
          "Combine physical objects by an individual",
          "Separate physical objects by an individual",
          "Transform physical objects by an individual",
          "Connect by an individual",
        ],
      },
    ],
    parts: [
      {
        title: "Decide to Modify by an individual",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Modify by an individual",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Modification by an individual",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Modification by an individual",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To cause a change in an entity's form, quality, or properties through the effort of a single individual actor. This is a virtual specialization of 'Modify' and 'Act by an individual'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Transfer by an individual",
    generalizations: ["Transfer", "Act by an individual"],
    specializations: [
      {
        collectionName: "Transfer what by an individual?",
        nodes: ["Exchange physical objects by an individual"],
      },
      {
        collectionName: "Transfer by what kind of individual?",
        nodes: ["Transfer by a human"],
      },
      {
        collectionName: "Transfer by an individual in what direction?",
        nodes: ["Transfer in by an individual"],
      },
    ],
    parts: [
      {
        title: "Initiate Transfer by an individual",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Transfer by an individual",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Finalize Transfer by an individual",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
    ],
    description:
      "To move something from one place, person, or system to another through the effort of a single individual actor. This is a virtual specialization of 'Transfer' and 'Act by an individual'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Store by an individual",
    generalizations: ["Store", "Act by an individual"],
    specializations: [
      {
        collectionName: "Store by what kind of individual?",
        nodes: ["Store by a human"],
      },
    ],
    parts: [
      {
        title: "Decide to Store by an individual",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare for storage by an individual",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Execute Storage by an individual",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Storage by an individual",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To keep or lay aside something for future use through the effort of a single individual actor. This is a virtual specialization of 'Store' and 'Act by an individual'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Provide service by an individual",
    generalizations: ["Provide service", "Act by an individual"],
    specializations: [
      {
        collectionName: "Provide service by what kind of individual?",
        nodes: ["Provide service by a human"],
      },
    ],
    parts: [],
    description:
      "To perform a service or set of tasks for a recipient, where the provider is a single actor (e.g., a person or machine).",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Maintain by an individual",
    generalizations: ["Act by an individual", "Maintain"],
    specializations: [
      {
        collectionName: "Maintain by what kind of individual?",
        nodes: ["Maintain by a human"],
      },
    ],
    parts: [
      {
        title: "Decide to Maintain by an individual",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Maintain by an individual",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Maintenance by an individual",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Maintenance by an individual",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To keep an object or information in its existing state through the effort of a single individual actor. This is a virtual specialization of 'Maintain' and 'Act by an individual'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Change by an individual",
    generalizations: ["Act by an individual", "Change"],
    specializations: [
      {
        collectionName: "Change by what kind of individual?",
        nodes: ["Change by a human"],
      },
    ],
    parts: [
      {
        title: "Decide to Change by an individual",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Change by an individual",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Change by an individual",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Change by an individual",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To make or become different through the effort of a single individual actor. This is a virtual specialization of 'Change' and 'Act by an individual'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Keep by an individual",
    generalizations: ["Act by an individual", "Keep"],
    specializations: [
      {
        collectionName: "Keep by what kind of individual?",
        nodes: ["Keep by a human"],
      },
    ],
    parts: [],
    description:
      "To retain possession of or maintain something in a particular place or condition through the effort of a single individual actor. This is a virtual specialization of 'Keep' and 'Act by an individual'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Work by an individual",
    generalizations: ["Act by an individual", "Work"],
    specializations: [
      {
        collectionName: "Work by what kind of individual?",
        nodes: ["Work by a human"],
      },
    ],
    parts: [],
    description:
      "To engage in activity involving mental or physical effort done in order to achieve a purpose or result, performed by a single individual actor. This is a virtual specialization of 'Work' and 'Act by an individual'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Collaborate by an individual",
    generalizations: ["Collaborate", "Act by an individual"],
    specializations: [
      {
        collectionName: "Collaborate by what kind of individual?",
        nodes: ["Collaborate by a human"],
      },
    ],
    parts: [],
    description:
      "To work jointly with others on a common enterprise or project, where the collaborating entity is a single individual.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Negotiate by an individual",
    generalizations: ["Negotiate", "Act by an individual"],
    specializations: [
      {
        collectionName: "Negotiate by what kind of individual?",
        nodes: ["Negotiate by a human"],
      },
    ],
    parts: [],
    description:
      "To confer with others in order to reach a compromise or agreement, where the negotiation is conducted by a single individual. This is a virtual specialization of 'Negotiate' and 'Act by an individual'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Resolve Problem by an individual",
    generalizations: ["Resolve Problem", "Act by an individual"],
    specializations: [],
    parts: [],
    description:
      "To find a definitive solution or settlement for a problem through the actions of a single individual.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Manage by an individual",
    generalizations: ["Manage", "Act by an individual"],
    specializations: [],
    parts: [],
    description:
      "To coordinate and oversee activities, resources, or people to achieve specific goals, as performed by a single individual.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Guide by an individual",
    generalizations: ["Act by an individual", "Guide"],
    specializations: [],
    parts: [],
    description:
      "To show the way to or advise a person or group, where the guidance is provided by a single individual actor.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Prepare to Act by an individual",
    generalizations: ["Prepare to Act", "Act by an individual"],
    specializations: [
      {
        collectionName: "Prepare to Act by what kind of individual?",
        nodes: ["Prepare to Act by a human", "Prepare to Act by a machine"],
      },
      {
        collectionName: "Prepare to do what by an individual?",
        nodes: [
          "Prepare to Create by an individual",
          "Prepare to Modify by an individual",
          "Initiate Transfer by an individual",
          "Prepare for storage by an individual",
          "Prepare to Maintain by an individual",
          "Prepare to Change by an individual",
        ],
      },
      {
        collectionName: "Prepare for what interaction by an individual?",
        nodes: ["Prepare to Interact by an individual"],
      },
    ],
    parts: [],
    description:
      "To get ready to perform the main part of an action, performed by a single individual.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Execute Act by an individual",
    generalizations: ["Execute Act", "Act by an individual"],
    specializations: [
      {
        collectionName: "Execute Act by what kind of individual?",
        nodes: ["Execute Act by a human", "Execute Act by a machine"],
      },
      {
        collectionName: "Execute what action by an individual?",
        nodes: [
          "Execute Creation by an individual",
          "Execute Modification by an individual",
          "Execute Transfer by an individual",
          "Execute Storage by an individual",
          "Execute Maintenance by an individual",
          "Execute Change by an individual",
        ],
      },
      {
        collectionName: "Execute what interaction by an individual?",
        nodes: ["Execute Interaction by an individual"],
      },
    ],
    parts: [],
    description:
      "The core performance of an action, performed by a single individual.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Conclude Act by an individual",
    generalizations: ["Conclude Act", "Act by an individual"],
    specializations: [
      {
        collectionName: "Conclude Act by what kind of individual?",
        nodes: ["Conclude Act by a human", "Conclude Act by a machine"],
      },
      {
        collectionName: "Conclude what action by an individual?",
        nodes: [
          "Finalize Creation by an individual",
          "Conclude Modification by an individual",
          "Finalize Transfer by an individual",
          "Conclude Storage by an individual",
          "Conclude Maintenance by an individual",
          "Conclude Change by an individual",
        ],
      },
      {
        collectionName: "Conclude what interaction by an individual?",
        nodes: ["Conclude Interaction by an individual"],
      },
    ],
    parts: [],
    description:
      "The final activities to wrap up an action, performed by a single individual.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Act on information (“Think”)",
    generalizations: ["Act"],
    specializations: [
      {
        collectionName: "Act on information by whom?",
        nodes: [
          "Act on information by a group",
          "Act on information by an individual",
          "Act on information by an ecosystem",
        ],
      },
      {
        collectionName: "Act on information how?",
        nodes: [
          "Create information",
          "Modify information",
          "Store information",
          "Transfer information",
        ],
      },
      {
        collectionName: "Act on information for what purpose?",
        nodes: ["Maintain information", "Change information"],
      },
      {
        collectionName: "Act on information by process phase?",
        nodes: ["Keep information", "Work on information"],
      },
      {
        collectionName: "Act on what information artifact?",
        nodes: ["Manage Correspondence", "Manage mail"],
      },
      {
        collectionName: "Act on information by process step?",
        nodes: [
          "Prepare to Act on Information",
          "Execute Act on Information",
          "Conclude Act on Information",
        ],
      },
      {
        collectionName: "Act on what specific information domain?",
        nodes: ["Apply Music Theory"],
      },
    ],
    parts: [
      {
        title: "Decide to Act on Information",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Act on Information",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Act on Information",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Act on Information",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To perform a primary work-related action on information, a process often colloquially referred to as 'thinking'. This includes creating, modifying, storing, and transferring information, as well as the cognitive processes that underpin these actions. Its core process involves deciding to act, preparing for the action, executing it, and concluding it.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Act on information by an ecosystem",
    generalizations: ["Act by an ecosystem", "Act on information (“Think”)"],
    specializations: [],
    parts: [],
    description:
      "To perform a primary work-related action on information within a complex network of interconnected and interdependent actors. This is a virtual specialization of 'Act on information (“Think”)' and 'Act by an ecosystem'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Create information",
    generalizations: ["Create", "Act on information (“Think”)"],
    specializations: [
      {
        collectionName: "Create what abstract information?",
        nodes: [
          "Analyze",
          "Calculate",
          "Decide",
          "Define Problem",
          "Formulate advice",
          "Generate Potential Solutions",
          "Plan",
          "Reason",
          "Solve",
          "Solve Problem",
        ],
      },
      {
        collectionName: "Create what kind of information artifact?",
        nodes: [
          "Create database",
          "Create financial instrument",
          "Develop instructional materials",
          "Express information",
          "Form information",
          "Record information",
        ],
      },
      {
        collectionName: "Create with whom?",
        nodes: ["Create information with other actors"],
      },
      {
        collectionName: "Create information by whom?",
        nodes: [
          "Create information by a group",
          "Create information by an individual",
          "Create information by an ecosystem",
        ],
      },
      {
        collectionName: "Create by process phase?",
        nodes: [
          "Create information by keeping",
          "Create information by working",
        ],
      },
      {
        collectionName: "Create for what purpose?",
        nodes: [
          "Create information to Maintain",
          "Create information to Change",
        ],
      },
      {
        collectionName: "Create information for what specific purpose?",
        nodes: ["Justify Budget Request", "Research"],
      },
      {
        collectionName: "Create what financial document?",
        nodes: ["Create invoice", "Create financial reports"],
      },
      {
        collectionName: "Create what other information artifact?",
        nodes: ["Create prescription order"],
      },
      {
        collectionName: "Create information how?",
        nodes: [
          "Translate Information",
          "Create Design Specification",
          "Generate",
          "Synthesize Information",
          "Structure Information",
        ],
      },
      {
        collectionName: "Create what guidance?",
        nodes: ["Formulate Guidance"],
      },
      {
        collectionName: "Create what medical information?",
        nodes: ["Prescribe Medication"],
      },
    ],
    parts: [
      {
        title: "Decide to Create Information",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Create Information",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Information Creation",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Finalize Information Creation",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      'Creating information involves using information to create information that did not exist before. \n\nWith physical objects, a newly created object still contains, as parts, many of the physical objects used to create it. But with newly created information, many of the information objects used to create it are not part of the resulting information.   \n\nIn general, all forms of creating information involve some form of "reasoning," but here we classify many important forms of reasoning as activities such as such as deciding, planning, and analyzing. We also have a separate activity called "Reason," which includes other forms of reasoning that don\'t fit into any of these categories.\n\nCreation, as used here, can occur inside a single mind (or computer) without ever being expressed.\n',
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Modify information",
    generalizations: ["Act on information (“Think”)", "Modify"],
    specializations: [
      {
        collectionName: "Modify information how?",
        nodes: ["Move information", "Revise", "Encode"],
      },
      {
        collectionName: "Modify information for what specific purpose?",
        nodes: ["Tailor information for client"],
      },
      {
        collectionName: "Modify with whom?",
        nodes: ["Modify information with other actors"],
      },
      {
        collectionName: "Modify information for what purpose?",
        nodes: [
          "Modify information to prepare for storage",
          "Modify information to Change",
          "Modify information to Maintain",
        ],
      },
      {
        collectionName: "Modify information by process phase?",
        nodes: [
          "Modify information by keeping",
          "Modify information by working",
        ],
      },
      {
        collectionName: "Modify information by action type?",
        nodes: [
          "Transform information",
          "Combine information",
          "Separate information",
          "Modify Software",
        ],
      },
      {
        collectionName: "Modify information by whom?",
        nodes: ["Modify information by an individual"],
      },
      {
        collectionName: "Modify what information artifact?",
        nodes: ["Format Document"],
      },
      {
        collectionName: "Modify what visual information?",
        nodes: ["Incorporate Visuals"],
      },
      {
        collectionName: "Modify what kind of information plan?",
        nodes: ["Adjust Treatment Plan"],
      },
      {
        collectionName: "Modify what information domain?",
        nodes: ["Modify Music"],
      },
    ],
    parts: [
      {
        title: "Prepare to Modify Information",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Information Modification",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Information Modification",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To alter or make different any form of information. This includes changing the content (revising), format (encoding), structure (combining/separating), or location (moving) of information.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Store information",
    generalizations: ["Act on information (“Think”)", "Store"],
    specializations: [
      {
        collectionName: "Store information for what purpose?",
        nodes: ["Archive information"],
      },
      {
        collectionName: "Store information how?",
        nodes: ["Register"],
      },
      {
        collectionName: "Store what information artifact?",
        nodes: ["File client paperwork"],
      },
      {
        collectionName: "Store what specific information?",
        nodes: ["File official forms"],
      },
    ],
    parts: [
      {
        title: "Decide to Store Information",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare information for storage",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Place information in storage",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Maintain information in storage",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Conclude Information Storage",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To keep or lay aside information for future use. This involves processes for preparing, placing, maintaining, and retrieving information from a storage system, which can be mental, digital, or physical.",
    "Editorial Notes":
      "These meanings of “store” and “conserve” can apply to both information and physical objects. So we should classify things here only when they use a verb like “store” or “conserve and when the object of the verb is a kind of information.\n\nThe parts of this activity could include encode, put in storage, keep in storage, retrieve\n",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Transfer information",
    generalizations: ["Act on information (“Think”)", "Transfer"],
    specializations: [
      {
        collectionName: "Transfer information in what direction?",
        nodes: [
          "Transfer information in",
          "Transfer information out",
          "Transfer information end-to-end",
          "Transfer information both ways",
        ],
      },
      {
        collectionName: "Transfer information by whom?",
        nodes: [
          "Transfer information by a group",
          "Transfer information by a human",
        ],
      },
    ],
    parts: [
      {
        title: "Initiate Information Transfer",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Information Transfer",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Finalize Information Transfer",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
    ],
    description:
      "To move information from one place, person, or system to another. This can be one-way (in or out), two-way (exchange), or a complete end-to-end communication.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Maintain information",
    generalizations: ["Maintain", "Act on information (“Think”)"],
    specializations: [
      {
        collectionName: "Maintain what kind of information?",
        nodes: ["Maintain information in storage"],
      },
      {
        collectionName: "Maintain information by inspecting?",
        nodes: ["Inspect documentation"],
      },
      {
        collectionName: "Maintain what information?",
        nodes: ["Maintain records"],
      },
      {
        collectionName: "Maintain what kind of information structure?",
        nodes: ["Maintain database"],
      },
      {
        collectionName: "Maintain what information artifact?",
        nodes: ["Maintain Software"],
      },
      {
        collectionName: "Maintain what specific information?",
        nodes: ["Maintain professional knowledge"],
      },
      {
        collectionName: "Maintain by what action?",
        nodes: ["Record maintenance information"],
      },
    ],
    parts: [
      {
        title: "Decide to maintain information",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Maintain Information",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Information Maintenance",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Information Maintenance",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To keep information in its existing state, condition, or location over a period of time. This includes actions of ensuring integrity, accessibility, and security.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Change information",
    generalizations: ["Change", "Act on information (“Think”)"],
    specializations: [],
    parts: [
      {
        title: "Decide to change information",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Change Information",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Information Change",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Information Change",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To alter or modify information, making it different from its previous state. This is a virtual specialization corresponding to the 'Change' action purpose applied to information.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Keep information",
    generalizations: ["Act on information (“Think”)", "Keep"],
    specializations: [
      {
        collectionName: "Keep information how?",
        nodes: ["Create information by keeping"],
      },
    ],
    parts: [],
    description:
      "To retain possession of or maintain information in a particular place or condition. This is a virtual specialization of 'Act on information (“Think”)' inherited from 'Act'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Work on information",
    generalizations: ["Act on information (“Think”)", "Work"],
    specializations: [
      {
        collectionName: "Work on information how?",
        nodes: ["Create information by working"],
      },
      {
        collectionName: "Work on what information?",
        nodes: ["Manage Procurement Rule Knowledge"],
      },
    ],
    parts: [],
    description:
      "To engage in mental effort on an informational task in order to achieve a purpose or result. This is a virtual specialization of 'Act on information (“Think”)' inherited from 'Act'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Manage Correspondence",
    generalizations: ["Act on information (“Think”)"],
    specializations: [
      {
        collectionName: "Manage what correspondence?",
        nodes: ["Manage mail"],
      },
    ],
    parts: [],
    description:
      "To handle incoming and outgoing communications, including physical mail, email, and other forms of messages. This involves sorting, distributing, responding to, and archiving correspondence.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Manage mail",
    generalizations: ["Manage Correspondence"],
    specializations: [],
    parts: [],
    description:
      "To handle incoming and outgoing physical and electronic mail, including sorting, distributing, and preparing items for dispatch.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Prepare to Act on Information",
    generalizations: ["Prepare to Act"],
    specializations: [
      {
        collectionName: "Prepare for what specific process?",
        nodes: ["Prepare for Head Count"],
      },
      {
        collectionName: "Prepare for what specific scholarly purpose?",
        nodes: ["Prepare Scholarly Work"],
      },
      {
        collectionName: "Prepare what information artifact?",
        nodes: [
          "Prepare Lecture",
          "Prepare course materials",
          "Prepare Documentation or Presentations",
        ],
      },
      {
        collectionName: "Prepare what educational materials?",
        nodes: ["Prepare Lesson"],
      },
      {
        collectionName: "Prepare for what data process?",
        nodes: ["Prepare for Data Input"],
      },
      {
        collectionName: "Prepare what information for action?",
        nodes: ["Prepare Document for Scanning"],
      },
      {
        collectionName: "Prepare by whom?",
        nodes: ["Prepare to Act on Information by a group"],
      },
      {
        collectionName: "Prepare for what observation activity?",
        nodes: ["Prepare to Observe"],
      },
      {
        collectionName: "Prepare by what actor type?",
        nodes: ["Prepare to Act on Information by a machine"],
      },
      {
        collectionName: "Prepare for what situation?",
        nodes: ["Assess Situation for Order"],
      },
    ],
    parts: [
      {
        title: "Gather Information",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
    ],
    description:
      "The preparatory activities for acting on information, such as identifying sources, setting up analytical tools, or formulating questions. This stage includes gathering the necessary informational inputs.",
    "Editorial Notes": "",
    isPartOf: ["Act on information (“Think”)"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Execute Act on Information",
    generalizations: ["Execute Act"],
    specializations: [
      {
        collectionName: "Execute Act on Information what?",
        nodes: ["Process Information"],
      },
      {
        collectionName: "Execute what data process?",
        nodes: ["Execute Data Input"],
      },
      {
        collectionName: "Execute what action on information?",
        nodes: ["Scan Document"],
      },
      {
        collectionName: "Execute what specific monitoring?",
        nodes: ["Execute Information Monitoring"],
      },
      {
        collectionName: "Execute by whom?",
        nodes: ["Execute Act on Information by a group"],
      },
      {
        collectionName: "Execute what specific action?",
        nodes: ["Execute Selection"],
      },
      {
        collectionName: "Execute what specific informational action?",
        nodes: ["Execute Search"],
      },
      {
        collectionName: "Execute what observation activity?",
        nodes: ["Execute Observation"],
      },
      {
        collectionName: "Execute what specific financial action?",
        nodes: ["Execute count of money"],
      },
      {
        collectionName: "Execute what order?",
        nodes: ["Formulate and Issue Order"],
      },
    ],
    parts: [],
    description:
      "The core performance of an action on information, where the primary transformation or work is accomplished. This is a specialized form of 'Execute Act'.",
    "Editorial Notes": "",
    isPartOf: ["Act on information (“Think”)"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Conclude Act on Information",
    generalizations: ["Conclude Act"],
    specializations: [
      {
        collectionName: "Conclude what informational act?",
        nodes: ["Finalize Document"],
      },
      {
        collectionName: "Finalize what creation process?",
        nodes: ["Finalize Information Creation"],
      },
      {
        collectionName: "Conclude by whom?",
        nodes: ["Conclude Act on Information by a group"],
      },
      {
        collectionName: "Conclude by what actor type?",
        nodes: ["Conclude Act on Information by a machine"],
      },
    ],
    parts: [
      {
        title: "Disseminate Information",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "The concluding activities after acting on information, such as formatting the output, sharing results, or archiving the process. This stage includes the dissemination of the final information product.",
    "Editorial Notes": "",
    isPartOf: ["Act on information (“Think”)"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Apply Music Theory",
    generalizations: ["Act on information (“Think”)"],
    specializations: [],
    parts: [],
    description:
      "To use theoretical knowledge of harmony, melody, and rhythm to make creative or structural changes to a piece of music.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Act on physical objects (“Do”)",
    generalizations: ["Act"],
    specializations: [
      {
        collectionName: "Act on physical objects by whom?",
        nodes: [
          "Act on physical objects by an ecosystem",
          "Act on physical objects by a democracy",
          "Act on physical objects by a group",
          "Act on physical objects by an individual",
        ],
      },
      {
        collectionName: "Act on physical objects how?",
        nodes: [
          "Create physical objects",
          "Modify physical objects",
          "Store physical objects",
          "Transfer physical objects",
        ],
      },
      {
        collectionName: "Act on physical objects by process phase?",
        nodes: ["Keep physical objects", "Work on physical objects"],
      },
      {
        collectionName: "Act on physical objects by process step?",
        nodes: [
          "Prepare to Act on Physical Object",
          "Execute Act on Physical Object",
          "Conclude Act on Physical Object",
        ],
      },
      {
        collectionName: "Act on physical objects for what purpose?",
        nodes: ["Change physical objects", "Maintain physical objects"],
      },
      {
        collectionName: "Act on physical objects by what actor type?",
        nodes: ["Act on physical objects by a machine"],
      },
    ],
    parts: [
      {
        title: "Decide to Act on Physical Object",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Act on Physical Object",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Act on Physical Object",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Act on Physical Object",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To perform a primary work-related action on physical objects, a process often colloquially referred to as 'doing'. This includes creating, modifying, storing, and transferring physical things.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Act on physical objects by an ecosystem",
    generalizations: ["Act by an ecosystem", "Act on physical objects (“Do”)"],
    specializations: [
      {
        collectionName: "Act on physical objects by an ecosystem how?",
        nodes: ["Modify physical objects by an ecosystem"],
      },
    ],
    parts: [],
    description:
      "To perform a primary work-related action on physical objects within a complex network of interconnected and interdependent actors. This is a virtual specialization of 'Act on physical objects (“Do”)' and 'Act by an ecosystem'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Act on physical objects by a democracy",
    generalizations: ["Act on physical objects (“Do”)", "Act by a democracy"],
    specializations: [
      {
        collectionName: "Act on physical objects by a democracy how?",
        nodes: [
          "Create physical objects by a democracy",
          "Modify physical objects by a democracy",
          "Store physical objects by a democracy",
          "Transfer physical objects by a democracy",
        ],
      },
      {
        collectionName:
          "Act on physical objects by a democracy for what purpose?",
        nodes: [
          "Maintain physical objects by a democracy",
          "Change physical objects by a democracy",
        ],
      },
      {
        collectionName:
          "Act on physical objects by a democracy by process phase?",
        nodes: [
          "Keep physical objects by a democracy",
          "Work on physical objects by a democracy",
        ],
      },
    ],
    parts: [
      {
        title: "Decide to Act on Physical Object by a democracy",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Act on Physical Object by a democracy",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Act on Physical Object by a democracy",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Act on Physical Object by a democracy",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To perform a primary work-related action on physical objects as a group where decisions and control are exercised by all members. This is a virtual specialization.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Create physical objects",
    generalizations: ["Act on physical objects (“Do”)", "Create"],
    specializations: [
      {
        collectionName: "Create physical objects by whom?",
        nodes: [
          "Create physical objects by a group",
          "Create physical objects by an individual",
        ],
      },
      {
        collectionName: "Create physical objects how?",
        nodes: ["Assemble"],
      },
      {
        collectionName: "Create physical objects for what purpose?",
        nodes: [
          "Create physical objects to Maintain",
          "Create physical objects to Change",
        ],
      },
      {
        collectionName: "Create physical objects by process phase?",
        nodes: [
          "Create physical objects by keeping",
          "Create physical objects by working",
        ],
      },
      {
        collectionName: "Create what physical objects?",
        nodes: ["Fabricate", "Develop Material"],
      },
    ],
    parts: [
      {
        title: "Decide to Create Physical Object",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Create Physical Object",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Physical Object Creation",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Finalize Physical Object Creation",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To bring a new physical object into existence. This process involves planning, acquiring the necessary materials and tools, executing the assembly or fabrication, and performing any final steps to complete the object.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Modify physical objects",
    generalizations: ["Act on physical objects (“Do”)", "Modify"],
    specializations: [
      {
        collectionName: "Modify physical objects by whom?",
        nodes: [
          "Modify physical objects by a group",
          "Modify physical objects by an individual",
          "Modify physical objects by an ecosystem",
        ],
      },
      {
        collectionName: "Modify physical objects how?",
        nodes: [
          "Move physical objects",
          "Separate physical objects",
          "Combine physical objects",
          "Transform physical objects",
          "Secure Equipment",
        ],
      },
      {
        collectionName: "Modify what type of physical objects?",
        nodes: ["Handle object"],
      },
      {
        collectionName: "Modify what material state?",
        nodes: ["Prepare Materials"],
      },
      {
        collectionName: "Modify what device?",
        nodes: ["Adjust Machine"],
      },
      {
        collectionName: "Modify what animate object?",
        nodes: ["Groom"],
      },
      {
        collectionName: "Modify what specific physical object?",
        nodes: ["Secure Covering"],
      },
      {
        collectionName: "Modify physical objects for what purpose?",
        nodes: [
          "Modify physical objects to maintain physical objects",
          "Modify physical objects to Change",
        ],
      },
      {
        collectionName: "Modify physical objects by process phase?",
        nodes: [
          "Modify physical objects by keeping",
          "Modify physical objects by working",
        ],
      },
      {
        collectionName: "Modify by what general action?",
        nodes: ["Apply"],
      },
      {
        collectionName: "Modify physical objects by application?",
        nodes: ["Apply Covering"],
      },
      {
        collectionName: "Modify by finishing action?",
        nodes: ["Finish Workpiece"],
      },
      {
        collectionName: "Modify physical objects by action?",
        nodes: ["Replace Physical Object"],
      },
      {
        collectionName: "Modify by what specific composite action?",
        nodes: [
          "Lay and Cut Carpet",
          "Stretch and Secure Carpet",
          "Finish Seams and Edges",
        ],
      },
      {
        collectionName:
          "Modify physical objects for what construction purpose?",
        nodes: ["Mark guidelines", "Position and brace formwork"],
      },
    ],
    parts: [
      {
        title: "Decide to Modify Physical Object",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Modify Physical Object",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Physical Object Modification",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Physical Object Modification",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To alter the properties, structure, or location of physical objects. This includes actions like moving, combining, separating, or transforming them.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Store physical objects",
    generalizations: ["Act on physical objects (“Do”)", "Store"],
    specializations: [
      {
        collectionName: "Store physical objects by whom?",
        nodes: ["Store physical objects by a human"],
      },
      {
        collectionName: "Store what physical objects?",
        nodes: ["Store Food and Supplies"],
      },
    ],
    parts: [
      {
        title: "Decide to Store Physical Object",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare physical object for storage",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Place physical object in storage",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Maintain physical object in storage",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Conclude Physical Object Storage",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To keep or lay aside physical objects for future use. This involves processes for preparing, placing, maintaining, and retrieving physical objects from a storage system.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Transfer physical objects",
    generalizations: ["Act on physical objects (“Do”)", "Transfer"],
    specializations: [
      {
        collectionName: "Transfer physical objects in what direction?",
        nodes: [
          "Get physical objects",
          "Provide physical objects",
          "Exchange physical objects",
        ],
      },
      {
        collectionName: "Transfer physical objects by whom?",
        nodes: ["Transfer physical objects by a human"],
      },
      {
        collectionName: "Transfer physical objects for what purpose?",
        nodes: ["Transfer physical objects to maintain physical objects"],
      },
      {
        collectionName: "Transfer physical objects how?",
        nodes: [
          "Transfer physical objects via collaboration",
          "Transfer physical objects via negotiation",
          "Place physical object",
        ],
      },
      {
        collectionName: "Transfer physical objects by whom else?",
        nodes: ["Transfer physical objects by a group"],
      },
      {
        collectionName: "Transport what physical objects?",
        nodes: ["Transport Machine Parts and Equipment"],
      },
      {
        collectionName: "Transfer what financial-related objects?",
        nodes: ["Transfer financial assets"],
      },
    ],
    parts: [
      {
        title: "Initiate Physical Object Transfer",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Physical Object Transfer",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Finalize Physical Object Transfer",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
    ],
    description:
      "To cause physical objects to move from one place, person, or system to another. This is the specialization of 'Transfer' for tangible items and includes processes such as carrying, pushing, or pulling.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Keep physical objects",
    generalizations: ["Act on physical objects (“Do”)", "Keep"],
    specializations: [
      {
        collectionName: "Keep physical objects how?",
        nodes: ["Modify physical objects by keeping"],
      },
      {
        collectionName: "Keep physical objects by action type?",
        nodes: ["Create physical objects by keeping"],
      },
      {
        collectionName: "Keep physical objects by what type of group?",
        nodes: ["Keep physical objects by a democracy"],
      },
    ],
    parts: [],
    description:
      "To retain possession of or maintain physical objects in a particular place or condition. This is a virtual specialization of 'Act on physical objects (“Do”)' inherited from 'Act'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Work on physical objects",
    generalizations: ["Act on physical objects (“Do”)", "Work"],
    specializations: [
      {
        collectionName: "Work on physical objects how?",
        nodes: ["Modify physical objects by working"],
      },
      {
        collectionName: "Work on physical objects by action type?",
        nodes: ["Create physical objects by working"],
      },
      {
        collectionName: "Work on physical objects by whom?",
        nodes: ["Work on physical objects by a human"],
      },
      {
        collectionName: "Work on physical objects by method?",
        nodes: ["Operate Machine", "Perform Laboratory Procedure"],
      },
      {
        collectionName: "Work on physical objects by what type of group?",
        nodes: ["Work on physical objects by a democracy"],
      },
      {
        collectionName: "Work on what physical object process?",
        nodes: [],
      },
    ],
    parts: [],
    description:
      "To engage in physical effort on a task involving physical objects in order to achieve a purpose or result. This is a virtual specialization of 'Act on physical objects (“Do”)' inherited from 'Act'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Prepare to Act on Physical Object",
    generalizations: ["Prepare to Act"],
    specializations: [
      {
        collectionName: "Prepare by what type of group?",
        nodes: ["Prepare to Act on Physical Object by a democracy"],
      },
      {
        collectionName: "Prepare what?",
        nodes: [
          "Prepare Equipment",
          "Prepare Materials",
          "Set up Machine",
          "Prepare Physical Environment",
          "Prepare Surface",
        ],
      },
      {
        collectionName: "Prepare by whom?",
        nodes: ["Prepare to Act on Physical Object by a group"],
      },
      {
        collectionName: "Prepare what components?",
        nodes: ["Prepare Machine Components"],
      },
      {
        collectionName: "Prepare for what finishing process?",
        nodes: ["Prepare for Weld Finishing"],
      },
      {
        collectionName: "Prepare for what welding process?",
        nodes: ["Prepare to Clean Weld"],
      },
      {
        collectionName: "Prepare for what construction activity?",
        nodes: ["Prepare book components"],
      },
      {
        collectionName: "Prepare for what process?",
        nodes: ["Prepare to Change Physical Object"],
      },
      {
        collectionName: "Prepare by what other actor type?",
        nodes: ["Prepare to Act on Physical Object by a machine"],
      },
      {
        collectionName: "Prepare what for transaction?",
        nodes: ["Prepare bank deposit"],
      },
      {
        collectionName: "Prepare for what specific operation?",
        nodes: ["Prepare to Operate Machine", "Prepare to Drive"],
      },
    ],
    parts: [],
    description:
      "The preparatory activities for acting on a physical object, such as gathering tools or materials. This is a specialized form of 'Prepare to Act'.",
    "Editorial Notes": "",
    isPartOf: ["Act on physical objects (“Do”)"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Execute Act on Physical Object",
    generalizations: ["Execute Act"],
    specializations: [
      {
        collectionName: "Execute what act on physical objects?",
        nodes: ["Start up production machinery"],
      },
      {
        collectionName: "Execute Act on Physical Object how?",
        nodes: ["Spread Adhesive"],
      },
      {
        collectionName: "Execute what specific adjustment?",
        nodes: [],
      },
      {
        collectionName: "Execute Act on Physical Object by whom?",
        nodes: ["Execute Act on Physical Object by a group"],
      },
      {
        collectionName: "Execute what finishing process?",
        nodes: ["Execute Weld Finishing"],
      },
      {
        collectionName: "Execute by whom?",
        nodes: ["Execute Act on Physical Object by a democracy"],
      },
      {
        collectionName: "Execute what bookbinding action?",
        nodes: ["Join book components"],
      },
      {
        collectionName: "Execute what process?",
        nodes: ["Execute Change Physical Object"],
      },
      {
        collectionName: "Execute by what other actor type?",
        nodes: ["Execute Act on Physical Object by a machine"],
      },
      {
        collectionName: "Execute what specific operation?",
        nodes: ["Execute Driving", "Execute adjustment"],
      },
    ],
    parts: [],
    description:
      "The core performance of an action on a physical object. This is a specialized form of 'Execute Act'.",
    "Editorial Notes": "",
    isPartOf: ["Act on physical objects (“Do”)"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Conclude Act on Physical Object",
    generalizations: ["Conclude Act"],
    specializations: [
      {
        collectionName: "Conclude what physical action?",
        nodes: ["Finish Installation"],
      },
      {
        collectionName: "Conclude what final action?",
        nodes: ["Cure Glue"],
      },
      {
        collectionName: "Conclude what specific action?",
        nodes: ["Finalize Installation", "Conclude Weld Finishing"],
      },
      {
        collectionName: "Conclude Act on Physical Object by whom?",
        nodes: ["Conclude Act on Physical Object by a group"],
      },
      {
        collectionName: "Conclude by whom?",
        nodes: ["Conclude Act on Physical Object by a democracy"],
      },
      {
        collectionName: "Conclude what bookbinding action?",
        nodes: ["Finish binding"],
      },
      {
        collectionName: "Conclude what process?",
        nodes: ["Conclude Change Physical Object"],
      },
      {
        collectionName: "Conclude by what other actor type?",
        nodes: ["Conclude Act on Physical Object by a machine"],
      },
      {
        collectionName: "Conclude what specific operation?",
        nodes: ["Conclude Driving"],
      },
    ],
    parts: [],
    description:
      "The concluding activities after acting on a physical object, such as cleanup or inspection. This is a specialized form of 'Conclude Act'.",
    "Editorial Notes": "",
    isPartOf: ["Act on physical objects (“Do”)"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Change physical objects",
    generalizations: ["Change", "Act on physical objects (“Do”)"],
    specializations: [],
    parts: [
      {
        title: "Decide to Change Physical Object",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Change Physical Object",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Change Physical Object",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Change Physical Object",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To alter or modify physical objects, making them different from their previous state. This is a virtual specialization corresponding to the 'Change' action purpose applied to physical objects.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Maintain physical objects",
    generalizations: ["Maintain", "Act on physical objects (“Do”)"],
    specializations: [
      {
        collectionName: "Maintain what kind of physical object?",
        nodes: ["Maintain physical object in storage"],
      },
      {
        collectionName: "Maintain physical object how?",
        nodes: [
          "Modify physical objects to maintain physical objects",
          "Transfer physical objects to maintain physical objects",
        ],
      },
      {
        collectionName: "Maintain what kind of system?",
        nodes: ["Regulate Physical System"],
      },
      {
        collectionName: "Maintain physical objects how?",
        nodes: ["Perform Aseptic Technique", "Service Physical System"],
      },
      {
        collectionName: "Maintain what specific object?",
        nodes: ["Maintain vehicle"],
      },
      {
        collectionName: "Maintain by whom?",
        nodes: [
          "Maintain physical objects by a human",
          "Maintain physical objects by a group",
        ],
      },
      {
        collectionName: "Maintain physical objects by testing?",
        nodes: ["Test Physical System"],
      },
      {
        collectionName: "Maintain physical objects by action type?",
        nodes: ["Perform Corrective Maintenance on Machine"],
      },
      {
        collectionName: "Maintain what equipment?",
        nodes: ["Maintain equipment"],
      },
    ],
    parts: [
      {
        title: "Decide to Maintain Physical Object",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Maintain Physical Object",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Physical Object Maintenance",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Physical Object Maintenance",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To keep a physical object in its existing state, condition, or location over a period of time. This includes actions such as cleaning, servicing, or protecting the object.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Act on physical objects by a machine",
    generalizations: ["Act by a machine", "Act on physical objects (“Do”)"],
    specializations: [],
    parts: [
      {
        title: "Decide to Act on Physical Object by a machine",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Act on Physical Object by a machine",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Act on Physical Object by a machine",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Act on Physical Object by a machine",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To perform a primary work-related action on a physical object by a single, individual machine actor. This is a virtual specialization of 'Act on physical objects (“Do”)' and 'Act by a machine'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Act with other actors (“Interact”)",
    generalizations: ["Act"],
    specializations: [
      {
        collectionName: "Interact by transferring what?",
        nodes: ["Transfer service"],
      },
      {
        collectionName: "Interact by action type?",
        nodes: ["Create with other actors", "Modify with other actors"],
      },
      {
        collectionName: "Interact how?",
        nodes: ["Collaborate", "Negotiate", "Obey"],
      },
      {
        collectionName: "Interact by fundamental action?",
        nodes: ["Transfer with other actors", "Store with other actors"],
      },
      {
        collectionName: "Interact for what purpose?",
        nodes: ["Maintain with other actors", "Change with other actors"],
      },
      {
        collectionName: "Interact for what function?",
        nodes: ["Manage", "Develop Relationships"],
      },
      {
        collectionName: "Interact by fundamental motivation?",
        nodes: ["Influence"],
      },
      {
        collectionName: "Interact by whom?",
        nodes: [
          "Act with other actors by a group",
          "Act with other actors by an individual",
          "Act with other actors by an ecosystem",
          "Act with other actors by a machine",
          "Act with other actors by a group of humans",
        ],
      },
      {
        collectionName: "Interact by what type of group?",
        nodes: [
          "Act with other actors by a market",
          "Act with other actors by a community",
        ],
      },
      {
        collectionName: "Interact for what specific purpose?",
        nodes: ["Guide"],
      },
      {
        collectionName: "Interact with whom by what type of group?",
        nodes: ["Act with other actors by a hierarchy"],
      },
      {
        collectionName: "Interact in what social context?",
        nodes: [],
      },
      {
        collectionName: "Interact for what other purpose?",
        nodes: ["Register for activity"],
      },
    ],
    parts: [
      {
        title: "Decide to Interact",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Interact",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Interaction",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Interaction",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To perform a primary work-related action that inherently involves other actors, a process often referred to as 'interacting'. This includes collaboration, negotiation, and the transfer of services. It is the root node for all social or interactive work.",
    "Editorial Notes":
      "Original content of this section (before editing here) came from Rob’s version of this section (see: https://docs.google.com/document/d/1RGy0GoAiq_ff6YjrnTcODegcM_c9GLf3SsFFbwGcB7E/edit?tab=t.hzx3nxu7gupl).\n",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Transfer service",
    generalizations: ["Act with other actors (“Interact”)"],
    specializations: [
      {
        collectionName: "Transfer service in what direction?",
        nodes: ["Get service", "Provide service", "Exchange service"],
      },
      {
        collectionName: "Transfer service by whom?",
        nodes: ["Transfer service by a human"],
      },
      {
        collectionName: "Transfer service by whom else?",
        nodes: ["Transfer service by a group"],
      },
    ],
    parts: [],
    description:
      "To transfer the performance of a task or set of tasks from one actor to another. Unlike transferring information or physical objects, a service is an intangible action performed over a period of time. This includes getting a service from others, providing a service to others, or exchanging services.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Create with other actors",
    generalizations: ["Create", "Act with other actors (“Interact”)"],
    specializations: [
      {
        collectionName: "Create what with other actors?",
        nodes: [
          "Create information with other actors",
          "Create physical objects with other actors",
        ],
      },
      {
        collectionName: "Create with other actors how?",
        nodes: ["Collaborate to create"],
      },
      {
        collectionName: "Create with other actors by whom?",
        nodes: ["Create with other actors by a group"],
      },
    ],
    parts: [],
    description:
      "To bring something new into existence through a collaborative process or interaction with other actors. This can include co-authoring a document, jointly designing a product, or forming a new team or organization.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Modify with other actors",
    generalizations: ["Modify", "Act with other actors (“Interact”)"],
    specializations: [
      {
        collectionName: "Modify what with other actors?",
        nodes: [
          "Modify information with other actors",
          "Modify physical objects with other actors",
        ],
      },
      {
        collectionName: "Modify with other actors how?",
        nodes: ["Collaborate to modify"],
      },
    ],
    parts: [],
    description:
      "To change an existing entity, agreement, relationship, or other social construct through interaction with other actors. This includes activities like renegotiating a contract or amending group bylaws.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Collaborate",
    generalizations: ["Act with other actors (“Interact”)"],
    specializations: [
      {
        collectionName: "Collaborate how?",
        nodes: ["Participate", "Agree", "Arrange", "Join"],
      },
      {
        collectionName: "Collaborate for what action?",
        nodes: ["Collaborate to create", "Collaborate to modify"],
      },
      {
        collectionName: "Collaborate by transferring what?",
        nodes: ["Collaborate by transferring service"],
      },
      {
        collectionName: "Collaborate for what purpose?",
        nodes: ["Collaborate to maintain", "Collaborate to change"],
      },
      {
        collectionName: "Collaborate for what outcome?",
        nodes: [
          "Establish Relationship with Network Members",
          "Resolve Problem by Collaborating",
        ],
      },
      {
        collectionName: "Collaborate for what service action?",
        nodes: ["Provide service by collaborating"],
      },
      {
        collectionName: "Collaborate by fundamental action?",
        nodes: ["Collaborate by transferring", "Collaborate by storing"],
      },
      {
        collectionName: "Collaborate by fundamental motivation?",
        nodes: ["Collaborate to influence"],
      },
      {
        collectionName: "Collaborate in what context?",
        nodes: ["Facilitate Classroom Discussion"],
      },
      {
        collectionName: "Collaborate on what specific learning activity?",
        nodes: ["Facilitate learning activities"],
      },
      {
        collectionName: "Collaborate by whom?",
        nodes: [
          "Collaborate by a group",
          "Collaborate by an individual",
          "Collaborate by an ecosystem",
          "Collaborate by a machine",
        ],
      },
      {
        collectionName: "Collaborate for what function?",
        nodes: [
          "Collaborate to Manage",
          "Collaborate to Develop Relationships",
        ],
      },
      {
        collectionName: "Collaborate for what business process?",
        nodes: ["Assist in Procurement Processes"],
      },
      {
        collectionName: "Collaborate on what specific task?",
        nodes: ["Hold Meeting", "Coordinate layout with supervisors"],
      },
      {
        collectionName: "Collaborate by what meeting activity?",
        nodes: ["Attend committee meeting", "Deliberate in Committee Meeting"],
      },
      {
        collectionName: "Collaborate for what problem-solving step?",
        nodes: [
          "Collaborate to Define Problem",
          "Collaborate to Analyze Problem",
          "Collaborate to Generate Potential Solutions",
          "Collaborate to Implement Solution",
        ],
      },
      {
        collectionName: "Collaborate by what general action?",
        nodes: ["Coordinate"],
      },
      {
        collectionName: "Collaborate by what general interaction?",
        nodes: ["Confer with others", "Coordinate Activities"],
      },
      {
        collectionName: "Collaborate on what?",
        nodes: ["Collaborate on Research"],
      },
    ],
    parts: [
      {
        title: "Decide to Collaborate",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Collaborate",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Collaboration",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Collaboration",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To work jointly with others on a common enterprise or project. Collaboration involves shared goals, resources, and responsibility, and typically includes activities like communication, coordination, and mutual agreement to achieve an outcome that would be difficult to attain individually.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Negotiate",
    generalizations: ["Act with other actors (“Interact”)"],
    specializations: [
      {
        collectionName: "Negotiate by whom?",
        nodes: [
          "Negotiate by a group",
          "Negotiate by an individual",
          "Negotiate by an ecosystem",
          "Negotiate by a machine",
        ],
      },
      {
        collectionName: "Negotiate by role?",
        nodes: ["Lead Negotiation", "Support Negotiation"],
      },
      {
        collectionName: "Negotiate about what?",
        nodes: ["Transfer physical objects via negotiation"],
      },
      {
        collectionName: "Negotiate for what purpose?",
        nodes: ["Provide service by negotiating"],
      },
      {
        collectionName: "Negotiate what?",
        nodes: ["Negotiate Agreement"],
      },
      {
        collectionName: "Negotiate for what outcome?",
        nodes: ["Negotiate with Authorities for Resolution"],
      },
      {
        collectionName: "Negotiate to do what?",
        nodes: ["Resolve Problem by Negotiating"],
      },
      {
        collectionName: "Negotiate what specifically?",
        nodes: ["Propose meeting times"],
      },
      {
        collectionName: "Negotiate with whom?",
        nodes: ["Negotiate with investors"],
      },
    ],
    parts: [
      {
        title: "Prepare for Negotiation",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conduct Negotiation",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Finalize Agreement",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To confer with others in order to reach a compromise or agreement. It is a form of interaction focused on resolving differences of interest or opinion. The process typically involves preparing for the negotiation, conducting the discussion and exchange of offers, and finalizing a formal or informal agreement.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Obey",
    generalizations: ["Act with other actors (“Interact”)"],
    specializations: [
      {
        collectionName: "Obey for what purpose?",
        nodes: ["Provide service by obeying"],
      },
      {
        collectionName: "Obey to do what?",
        nodes: ["Resolve Problem by Obeying"],
      },
    ],
    parts: [],
    description:
      "To comply with the command, direction, or request of a person or authority.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Transfer with other actors",
    generalizations: ["Act with other actors (“Interact”)", "Transfer"],
    specializations: [
      {
        collectionName: "Transfer with other actors how?",
        nodes: ["Collaborate by transferring"],
      },
      {
        collectionName: "Transfer with other actors by whom?",
        nodes: ["Transfer with other actors by a group"],
      },
    ],
    parts: [],
    description:
      "To move something from one place to another through interaction with other actors. This is a virtual specialization of 'Act with other actors (“Interact”)' and 'Transfer'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Store with other actors",
    generalizations: ["Act with other actors (“Interact”)", "Store"],
    specializations: [
      {
        collectionName: "Store with other actors how?",
        nodes: ["Collaborate by storing"],
      },
    ],
    parts: [],
    description:
      "To keep or lay aside something for future use through a coordinated or interactive process with other actors (e.g., depositing items in a shared repository). This is a virtual specialization of 'Act with other actors (“Interact”)' and 'Store'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Maintain with other actors",
    generalizations: ["Act with other actors (“Interact”)", "Maintain"],
    specializations: [
      {
        collectionName: "Maintain with other actors how?",
        nodes: [
          "Collaborate to maintain",
          "Provide service to maintain",
          "Maintain Network Relationships",
        ],
      },
      {
        collectionName: "Maintain what specific service?",
        nodes: ["Provide ongoing technical support to customers"],
      },
    ],
    parts: [],
    description:
      "To keep an object, system, or information in its existing state through interaction with other actors (e.g., a team performing maintenance on a shared server). This is a virtual specialization of 'Act with other actors (“Interact”)' and 'Maintain'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Change with other actors",
    generalizations: ["Act with other actors (“Interact”)", "Change"],
    specializations: [
      {
        collectionName: "Change with other actors how?",
        nodes: ["Collaborate to change", "Provide service to change"],
      },
    ],
    parts: [],
    description:
      "To make something different through interaction with other actors (e.g., a committee voting to amend bylaws). This is a virtual specialization of 'Act with other actors (“Interact”)' and 'Change'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Manage",
    generalizations: ["Act with other actors (“Interact”)"],
    specializations: [
      {
        collectionName: "Manage what system?",
        nodes: ["Review and Approve System Implementation"],
      },
      {
        collectionName: "Manage what?",
        nodes: ["Manage Personnel"],
      },
      {
        collectionName: "Manage how?",
        nodes: ["Collaborate to Manage"],
      },
      {
        collectionName: "Manage what process?",
        nodes: ["Coordinate Communication", "Manage Communication"],
      },
      {
        collectionName: "Manage what resource?",
        nodes: ["Manage Inventory"],
      },
      {
        collectionName: "Manage what resource or entity?",
        nodes: ["Manage Resource"],
      },
      {
        collectionName: "Manage by whom?",
        nodes: [
          "Manage by an individual",
          "Manage by a group",
          "Manage by an ecosystem",
        ],
      },
      {
        collectionName: "Manage what program-related activity?",
        nodes: [
          "Manage Program",
          "Establish Program Governance",
          "Manage Program Stakeholders",
        ],
      },
      {
        collectionName: "Manage what specific operations?",
        nodes: ["Manage Operations"],
      },
      {
        collectionName: "Manage what domain?",
        nodes: ["Develop and Manage Curriculum and Instruction"],
      },
      {
        collectionName: "Manage what information artifact?",
        nodes: ["Manage Contract Modifications"],
      },
    ],
    parts: [
      {
        title: "Decide to Manage",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Manage",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Management",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Management",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To coordinate and oversee activities, resources, or people to achieve specific goals. It typically involves a cycle of planning, organizing, leading, and controlling.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Develop Relationships",
    generalizations: ["Act with other actors (“Interact”)"],
    specializations: [
      {
        collectionName: "Develop what kind of relationships?",
        nodes: ["Develop Network"],
      },
      {
        collectionName: "Develop relationships how?",
        nodes: ["Collaborate to Develop Relationships"],
      },
      {
        collectionName: "Develop what specific professional relationship?",
        nodes: ["Maintain Professional Network"],
      },
      {
        collectionName: "Develop Relationships by whom?",
        nodes: ["Develop Relationships by a human"],
      },
      {
        collectionName: "Develop what relationships?",
        nodes: ["Establish Partnerships for Student Opportunities"],
      },
    ],
    parts: [],
    description:
      "To establish, cultivate, and maintain connections with other individuals or groups for mutual benefit, professional advancement, or social purposes.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Influence",
    generalizations: ["Act with other actors (“Interact”)"],
    specializations: [
      {
        collectionName: "Influence how?",
        nodes: ["Advocate", "Recruit"],
      },
      {
        collectionName: "Influence by whom?",
        nodes: ["Influence by a human"],
      },
    ],
    parts: [],
    description:
      "To have an effect on the character, development, or behavior of someone or something. It is a fundamental interaction that aims to persuade, convince, or change the course of actions or opinions of others.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Act with other actors by an ecosystem",
    generalizations: [
      "Act by an ecosystem",
      "Act with other actors (“Interact”)",
    ],
    specializations: [
      {
        collectionName: "Interact how by an ecosystem?",
        nodes: ["Collaborate by an ecosystem", "Negotiate by an ecosystem"],
      },
    ],
    parts: [
      {
        title: "Decide to Interact by an ecosystem",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Interact by an ecosystem",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Interaction by an ecosystem",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Interaction by an ecosystem",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To perform a primary work-related action with other actors within a complex network of interconnected and interdependent actors. This is a virtual specialization of 'Act with other actors (“Interact”)' and 'Act by an ecosystem'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Act with other actors by a machine",
    generalizations: ["Act by a machine", "Act with other actors (“Interact”)"],
    specializations: [
      {
        collectionName: "Interact how by a machine?",
        nodes: ["Collaborate by a machine", "Negotiate by a machine"],
      },
    ],
    parts: [],
    description:
      "To interact with other actors as a single, individual machine. This is a virtual specialization of 'Act with other actors (“Interact”)' and 'Act by a machine'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Act with other actors by a group of humans",
    generalizations: [
      "Act by a group of humans",
      "Act with other actors (“Interact”)",
    ],
    specializations: [],
    parts: [],
    description:
      "To interact with other actors as a collective group of humans. This is a virtual specialization of 'Act with other actors (“Interact”)' and 'Act by a group of humans'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Act with other actors by a market",
    generalizations: ["Act by a market", "Act with other actors (“Interact”)"],
    specializations: [],
    parts: [],
    description:
      "To perform a primary work-related action with other actors within a market structure. This is a virtual specialization of 'Act with other actors (“Interact”)' and 'Act by a market'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Act with other actors by a community",
    generalizations: [
      "Act by a community",
      "Act with other actors (“Interact”)",
    ],
    specializations: [],
    parts: [],
    description:
      "To perform a primary work-related action with other actors, where the action is performed by a group based on shared interests, values, or goals. This is a virtual specialization of 'Act with other actors (“Interact”)' and 'Act by a community'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Guide",
    generalizations: ["Act with other actors (“Interact”)"],
    specializations: [
      {
        collectionName: "Guide how?",
        nodes: ["Advise", "Suggest improvement"],
      },
      {
        collectionName: "Guide by whom?",
        nodes: [
          "Guide by a human",
          "Guide by a group",
          "Guide by an individual",
        ],
      },
      {
        collectionName: "Guide whom or what?",
        nodes: ["Supervise"],
      },
      {
        collectionName: "Guide by example?",
        nodes: ["Model behavior"],
      },
      {
        collectionName: "Guide what activities?",
        nodes: ["Guide children", "Demonstrate Task"],
      },
      {
        collectionName: "Guide for what function?",
        nodes: ["Motivate Personnel"],
      },
      {
        collectionName: "Guide for what purpose?",
        nodes: ["Help Customer Decide"],
      },
      {
        collectionName: "Guide for what medical purpose?",
        nodes: ["Educate Patient on Medication"],
      },
    ],
    parts: [
      {
        title: "Assess Needs of Guided Party",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Formulate Guidance",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Provide Guidance",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
    ],
    description:
      "To show the way to or advise a person or group. This is a general interactive activity focused on providing direction, leadership, or counsel.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Act with other actors by a hierarchy",
    generalizations: [
      "Act by a hierarchy",
      "Act with other actors (“Interact”)",
    ],
    specializations: [],
    parts: [],
    description:
      "To interact with other actors as part of a group organized in a hierarchical structure. This is a virtual specialization of 'Act with other actors (“Interact”)' and 'Act by a hierarchy'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Register for activity",
    generalizations: ["Act with other actors (“Interact”)"],
    specializations: [],
    parts: [],
    description:
      "To officially sign up or enroll for an event, conference, or workshop, typically involving providing personal details and paying a fee.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Create",
    generalizations: ["Act"],
    specializations: [
      {
        collectionName: "Create what?",
        nodes: ["Create information", "Create physical objects"],
      },
      {
        collectionName: "Create with whom?",
        nodes: ["Create with other actors"],
      },
      {
        collectionName: "Create how?",
        nodes: ["Form"],
      },
      {
        collectionName: "Create for what purpose?",
        nodes: ["Create to Maintain", "Create to Change"],
      },
      {
        collectionName: "Create by whom?",
        nodes: [
          "Create by a group",
          "Create by an individual",
          "Create by an ecosystem",
        ],
      },
      {
        collectionName: "Create by process phase?",
        nodes: ["Create by keeping", "Create by working"],
      },
      {
        collectionName: "Create what kind of channel?",
        nodes: ["Establish Communication Channels"],
      },
    ],
    parts: [
      {
        title: "Decide to Create",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Create",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Creation",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Finalize Creation",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To bring something new into existence that was not there before. This fundamental action can apply to information, physical objects, or even abstract concepts like relationships. It involves a process of planning, preparing, executing the creation, and finalizing the new entity.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Form",
    generalizations: ["Create"],
    specializations: [
      {
        collectionName: "Form what?",
        nodes: ["Form information"],
      },
      {
        collectionName: "Form by whom?",
        nodes: ["Form by a group"],
      },
    ],
    parts: [],
    description: "To bring together parts or combine to create something.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Create to Maintain",
    generalizations: ["Create", "Maintain"],
    specializations: [
      {
        collectionName: "Create what to Maintain?",
        nodes: ["Create physical objects to Maintain"],
      },
      {
        collectionName: "Create what kind of information to Maintain?",
        nodes: ["Create information to Maintain"],
      },
      {
        collectionName: "Create to Maintain by whom?",
        nodes: ["Create to Maintain by a group"],
      },
    ],
    parts: [],
    description:
      "To create something with the primary purpose of maintaining an existing system, state, or standard.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Create to Change",
    generalizations: ["Create", "Change"],
    specializations: [
      {
        collectionName: "Create what to Change?",
        nodes: ["Create physical objects to Change"],
      },
      {
        collectionName: "Create what kind of information to Change?",
        nodes: ["Create information to Change"],
      },
      {
        collectionName: "Create to Change by whom?",
        nodes: ["Create to Change by a group"],
      },
    ],
    parts: [],
    description:
      "To create something with the primary purpose of changing an existing system, state, or standard.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Create by an ecosystem",
    generalizations: ["Act by an ecosystem", "Create"],
    specializations: [],
    parts: [],
    description:
      "To bring something new into existence within a complex network of interconnected and interdependent actors. This is a virtual specialization of 'Create' and 'Act by an ecosystem'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Create by keeping",
    generalizations: ["Create", "Keep"],
    specializations: [
      {
        collectionName: "Create by keeping by whom?",
        nodes: ["Create by keeping by a group"],
      },
    ],
    parts: [],
    description:
      "To bring something new into existence as part of an action to retain or maintain something else. This is a virtual specialization of 'Create' inherited from 'Act'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Create by working",
    generalizations: ["Create", "Work"],
    specializations: [
      {
        collectionName: "Create by working by whom?",
        nodes: ["Create by working by a group"],
      },
    ],
    parts: [],
    description:
      "To bring something new into existence as part of engaging in mental or physical effort. This is a virtual specialization of 'Create' inherited from 'Act'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Establish Communication Channels",
    generalizations: ["Create"],
    specializations: [],
    parts: [],
    description:
      "To set up the means and methods of communication between parties, such as meetings, phone calls, emails, or a dedicated communication platform.",
    "Editorial Notes": "",
    isPartOf: ["Coordinate Communication"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Modify",
    generalizations: ["Act"],
    specializations: [
      {
        collectionName: "Modify how?",
        nodes: ["Move", "Combine", "Separate", "Transform"],
      },
      {
        collectionName: "Modify what?",
        nodes: ["Modify information", "Modify physical objects"],
      },
      {
        collectionName: "Modify by whom?",
        nodes: [
          "Modify by a group",
          "Modify by an ecosystem",
          "Modify by an individual",
          "Modify by a market",
        ],
      },
      {
        collectionName: "Modify by interacting?",
        nodes: ["Modify with other actors"],
      },
      {
        collectionName: "Modify for what purpose?",
        nodes: ["Modify to Maintain", "Modify to Change"],
      },
      {
        collectionName: "Modify by process phase?",
        nodes: ["Modify by keeping", "Modify by working"],
      },
      {
        collectionName: "Modify by state change?",
        nodes: ["Activate", "Deactivate"],
      },
      {
        collectionName: "Modify what plan?",
        nodes: ["Adjust Plan Implementation"],
      },
    ],
    parts: [
      {
        title: "Decide to Modify",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Modify",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Modification",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Modification",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To cause a change in an entity's form, quality, or properties; to make different or cause a transformation.",
    "Editorial Notes":
      'The previous definition of this verb ("make less severe or harsh or extreme") was not general enough for its current position in the verb hierarchy, so it was changed to the definition for a different meaning of "modify" in WordNet.\n',
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Move",
    generalizations: ["Modify"],
    specializations: [
      {
        collectionName: "Move how?",
        nodes: ["Transport", "Put", "Reorient", "Exercise"],
      },
      {
        collectionName: "Move what?",
        nodes: ["Move information", "Move physical objects", "Move self"],
      },
      {
        collectionName: "Move by whom?",
        nodes: ["Move by a group"],
      },
      {
        collectionName: "Move for what purpose?",
        nodes: ["Move to Maintain", "Move to Change"],
      },
    ],
    parts: [
      {
        title: "Prepare to Move",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Move",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Move",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "Definition: cause to move or shift into a new position or place, both in a concrete and in an abstract sense\n\nSynonyms: displace",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Combine",
    generalizations: ["Modify"],
    specializations: [
      {
        collectionName: "Combine what?",
        nodes: ["Combine physical objects", "Combine information"],
      },
      {
        collectionName: "Combine by whom?",
        nodes: ["Combine by a group"],
      },
      {
        collectionName: "Combine what materials?",
        nodes: ["Add Materials"],
      },
    ],
    parts: [
      {
        title: "Decide to Combine",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Combine",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Combination",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Combination",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To join or merge two or more things to form a single entity. This can apply to information (e.g., merging documents) or physical objects (e.g., mixing ingredients).",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Separate",
    generalizations: ["Modify"],
    specializations: [
      {
        collectionName: "Separate what?",
        nodes: ["Separate physical objects", "Separate information"],
      },
      {
        collectionName: "Separate by whom?",
        nodes: ["Separate by a group"],
      },
    ],
    parts: [
      {
        title: "Decide to Separate",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Separate",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Separation",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Separation",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description: "Definition: come apart\n\nSynonyms: divide, part",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Transform",
    generalizations: ["Modify"],
    specializations: [
      {
        collectionName: "Transform what?",
        nodes: ["Transform physical objects", "Transform information"],
      },
      {
        collectionName: "Transform by whom?",
        nodes: ["Transform by a group"],
      },
    ],
    parts: [
      {
        title: "Decide to Transform",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Transform",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Transformation",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Transformation",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "Definition: change or alter in form, appearance, or nature\n\nSynonyms: transmute, transubstantiate",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Modify by an ecosystem",
    generalizations: ["Act by an ecosystem", "Modify"],
    specializations: [],
    parts: [],
    description:
      "To cause a change in an entity's form, quality, or properties within a complex network of interconnected and interdependent actors. This is a virtual specialization of 'Modify' and 'Act by an ecosystem'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Modify by a market",
    generalizations: ["Act by a market", "Modify"],
    specializations: [],
    parts: [],
    description:
      "To cause a change in an entity's form or properties within a market structure. This is a virtual specialization of 'Modify' and 'Act by a market'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Modify to Maintain",
    generalizations: ["Modify", "Maintain"],
    specializations: [
      {
        collectionName: "Modify what to Maintain?",
        nodes: ["Modify physical objects to maintain physical objects"],
      },
      {
        collectionName: "Modify to Maintain how?",
        nodes: ["Move to Maintain"],
      },
      {
        collectionName: "Modify what information to Maintain?",
        nodes: ["Modify information to Maintain"],
      },
      {
        collectionName: "Modify to Maintain by whom?",
        nodes: ["Modify to Maintain by a group"],
      },
    ],
    parts: [],
    description:
      "To cause a change in an entity for the primary purpose of keeping it in its existing state, condition, or location over time (e.g., patching software to fix a bug, replacing a worn part).",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Modify to Change",
    generalizations: ["Modify", "Change"],
    specializations: [
      {
        collectionName: "Modify what to Change?",
        nodes: [
          "Modify information to Change",
          "Modify physical objects to Change",
        ],
      },
      {
        collectionName: "Modify to Change how?",
        nodes: ["Move to Change"],
      },
      {
        collectionName: "Modify to Change by whom?",
        nodes: ["Modify to Change by a group"],
      },
    ],
    parts: [],
    description:
      "To cause a change in an entity for the primary purpose of making it different from its previous state (e.g., upgrading software with new features, renovating a building).",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Modify by keeping",
    generalizations: ["Modify", "Keep"],
    specializations: [
      {
        collectionName: "Modify what by keeping?",
        nodes: ["Modify information by keeping"],
      },
      {
        collectionName: "Modify by keeping by whom?",
        nodes: ["Modify by keeping by a group"],
      },
    ],
    parts: [],
    description:
      "To modify an entity as part of an action to retain or maintain it. This is a virtual specialization of 'Modify' inherited from 'Act'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Modify by working",
    generalizations: ["Modify", "Work"],
    specializations: [
      {
        collectionName: "Modify what by working?",
        nodes: ["Modify information by working"],
      },
      {
        collectionName: "Modify by working by whom?",
        nodes: ["Modify by working by a group"],
      },
    ],
    parts: [],
    description:
      "To modify an entity as part of engaging in mental or physical effort. This is a virtual specialization of 'Modify' inherited from 'Act'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Activate",
    generalizations: ["Modify"],
    specializations: [
      {
        collectionName: "Activate what?",
        nodes: ["Activate Warning Signals"],
      },
      {
        collectionName: "Activate by what process?",
        nodes: ["Ignite"],
      },
    ],
    parts: [],
    description:
      "To make something operative; to turn on or start a process or mechanism.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Deactivate",
    generalizations: ["Modify"],
    specializations: [
      {
        collectionName: "Deactivate what?",
        nodes: ["Deactivate Warning Signals"],
      },
    ],
    parts: [],
    description:
      "To make something inoperative; to turn off or stop a process or mechanism.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Adjust Plan Implementation",
    generalizations: ["Modify"],
    specializations: [],
    parts: [],
    description:
      "To make changes to the execution of a plan in response to unforeseen circumstances, monitoring feedback, or changing requirements.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Transfer",
    generalizations: ["Act"],
    specializations: [
      {
        collectionName: "Transfer what?",
        nodes: [
          "Transfer information",
          "Transfer physical objects",
          "Transfer service",
        ],
      },
      {
        collectionName: "Transfer in what direction?",
        nodes: [
          "Transfer in",
          "Transfer out",
          "Transfer end-to-end",
          "Transfer both ways",
        ],
      },
      {
        collectionName: "Transfer by interacting?",
        nodes: ["Transfer with other actors"],
      },
      {
        collectionName: "Transfer by whom?",
        nodes: [
          "Transfer by a group",
          "Transfer by an individual",
          "Transfer by an ecosystem",
        ],
      },
      {
        collectionName: "Transfer what by deployment?",
        nodes: ["Deploy"],
      },
      {
        collectionName: "Transfer how?",
        nodes: ["Place"],
      },
    ],
    parts: [
      {
        title: "Initiate Transfer",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Transfer",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Finalize Transfer",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
    ],
    description:
      "To move something (information, physical objects, or service) from one place, person, or system to another. This is a fundamental action that can occur in various directions (in, out, end-to-end, both ways) and can be performed with or without other actors.",
    "Editorial Notes": "\n",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Transfer in",
    generalizations: ["Transfer"],
    specializations: [
      {
        collectionName: "Transfer in how?",
        nodes: ["Get", "Find inputs needed"],
      },
      {
        collectionName: "Transfer in by whom?",
        nodes: ["Transfer in by a group"],
      },
      {
        collectionName: "Transfer in what?",
        nodes: ["Transfer information in"],
      },
      {
        collectionName: "Transfer in by what individual actor?",
        nodes: ["Transfer in by an individual"],
      },
    ],
    parts: [],
    description: "",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Transfer out",
    generalizations: ["Transfer"],
    specializations: [
      {
        collectionName: "Transfer out how?",
        nodes: ["Provide"],
      },
      {
        collectionName: "Transfer out by whom?",
        nodes: ["Transfer out by a group"],
      },
      {
        collectionName: "Transfer out what?",
        nodes: ["Transfer information out"],
      },
    ],
    parts: [],
    description: "",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Transfer end-to-end",
    generalizations: ["Transfer"],
    specializations: [
      {
        collectionName: "Transfer what end-to-end?",
        nodes: ["Communicate", "Ship"],
      },
      {
        collectionName: "Transfer what information end-to-end?",
        nodes: ["Transfer information end-to-end"],
      },
      {
        collectionName: "Transfer end-to-end by whom?",
        nodes: ["Transfer end-to-end by a group"],
      },
    ],
    parts: [
      {
        title: "Provide",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Get",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
    ],
    description: "",
    "Editorial Notes": "",
    isPartOf: ["Transfer both ways"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Transfer both ways",
    generalizations: ["Transfer"],
    specializations: [
      {
        collectionName: "Transfer both ways what?",
        nodes: ["Exchange physical objects"],
      },
      {
        collectionName: "Transfer what information both ways?",
        nodes: ["Transfer information both ways"],
      },
      {
        collectionName: "Transfer both ways by whom?",
        nodes: ["Transfer both ways by a group"],
      },
    ],
    parts: [
      {
        title: "Transfer end-to-end",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
    ],
    description:
      "To transfer something in two directions between actors, which involves at least one complete end-to-end transfer. This represents an exchange.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Transfer by an ecosystem",
    generalizations: ["Act by an ecosystem", "Transfer"],
    specializations: [],
    parts: [],
    description:
      "To move something from one place to another within a complex network of interconnected and interdependent actors. This is a virtual specialization of 'Transfer' and 'Act by an ecosystem'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Deploy",
    generalizations: ["Transfer"],
    specializations: [
      {
        collectionName: "Deploy what?",
        nodes: ["Deploy Material", "Deploy Software"],
      },
      {
        collectionName: "Deploy what solution?",
        nodes: ["Deploy Solution"],
      },
    ],
    parts: [],
    description:
      "To release, install, and make the developed solution available for use in its target environment.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Place",
    generalizations: ["Transfer"],
    specializations: [
      {
        collectionName: "Place what?",
        nodes: ["Place physical object"],
      },
    ],
    parts: [],
    description:
      "To assign or position someone or something in a particular location, role, or situation. This involves determining a suitable destination or context and facilitating the move or assignment.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Store",
    generalizations: ["Act"],
    specializations: [
      {
        collectionName: "Store what?",
        nodes: ["Store information", "Store physical objects"],
      },
      {
        collectionName: "Store by interacting?",
        nodes: ["Store with other actors"],
      },
      {
        collectionName: "Store by whom?",
        nodes: [
          "Store by a group",
          "Store by an ecosystem",
          "Store by an individual",
          "Store by a market",
        ],
      },
    ],
    parts: [
      {
        title: "Decide to Store",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare for storage",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Execute Storage",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Storage",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "Definition: keep or lay aside for future use\n\nSynonyms: hive_away, lay_in, put_in, salt_away, stack_away, stash_away",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Store by an ecosystem",
    generalizations: ["Act by an ecosystem", "Store"],
    specializations: [],
    parts: [],
    description:
      "To keep or lay aside something for future use within a complex network of interconnected and interdependent actors. This is a virtual specialization of 'Store' and 'Act by an ecosystem'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Store by a market",
    generalizations: ["Act by a market", "Store"],
    specializations: [],
    parts: [],
    description:
      "To keep or lay aside something for future use within a market structure. This is a virtual specialization of 'Store' and 'Act by a market'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Maintain",
    generalizations: ["Act"],
    specializations: [
      {
        collectionName: "Maintain by whom?",
        nodes: [
          "Maintain by a group",
          "Maintain by a community",
          "Maintain by an individual",
        ],
      },
      {
        collectionName: "Maintain what?",
        nodes: [
          "Maintain information",
          "Maintain physical objects",
          "Maintain in storage",
        ],
      },
      {
        collectionName: "Maintain how?",
        nodes: ["Create to Maintain", "Modify to Maintain"],
      },
      {
        collectionName: "Maintain by what cognitive process?",
        nodes: ["Plan to Maintain"],
      },
      {
        collectionName: "Maintain what abstract concept?",
        nodes: ["Ensure Safety"],
      },
      {
        collectionName: "Maintain by interacting?",
        nodes: ["Maintain with other actors"],
      },
    ],
    parts: [
      {
        title: "Decide to Maintain",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Maintain",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Maintenance",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Maintenance",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To keep an object or information in its existing state, condition, or location over a period of time. This includes actions of preservation, protection, and ensuring continued function or integrity.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Maintain by a community",
    generalizations: ["Act by a community", "Maintain"],
    specializations: [],
    parts: [],
    description:
      "To keep an object or information in its existing state through the collective effort of a community. This is a virtual specialization of 'Maintain' and 'Act by a community'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Maintain in storage",
    generalizations: ["Maintain"],
    specializations: [],
    parts: [],
    description:
      "The ongoing activities required to ensure an item remains in its desired condition while in storage.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Plan to Maintain",
    generalizations: ["Plan", "Maintain"],
    specializations: [],
    parts: [],
    description:
      "To create a plan with the primary purpose of maintaining an existing system, state, or standard.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Ensure Safety",
    generalizations: ["Maintain"],
    specializations: [
      {
        collectionName: "Ensure safety of what or whom?",
        nodes: ["Ensure Worker Safety", "Ensure Environmental Safety"],
      },
      {
        collectionName: "Ensure safety of whom?",
        nodes: ["Ensure Safety of Participants"],
      },
      {
        collectionName: "Ensure safety how?",
        nodes: ["Ensure Compliance", "Ensure Subject Safety"],
      },
      {
        collectionName: "Ensure safety by whom?",
        nodes: ["Ensure Safety by a human"],
      },
      {
        collectionName: "Ensure safety of what?",
        nodes: ["Maintain Facility Safety and Order"],
      },
      {
        collectionName: "Ensure safety by what action?",
        nodes: ["Check Excavated Material Levels"],
      },
    ],
    parts: [
      {
        title: "Identify Hazards",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Assess Risks",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Implement Controls",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Monitor Safety",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To take actions and follow procedures with the primary goal of preventing harm, injury, or other negative outcomes to people, property, or the environment.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Change",
    generalizations: ["Act"],
    specializations: [
      {
        collectionName: "Change what?",
        nodes: ["Change information"],
      },
      {
        collectionName: "Change how?",
        nodes: ["Create to Change", "Modify to Change"],
      },
      {
        collectionName: "Change by what cognitive process?",
        nodes: ["Plan to Change"],
      },
      {
        collectionName: "Change for what purpose?",
        nodes: ["Take corrective action"],
      },
      {
        collectionName: "Change by what action?",
        nodes: ["Improve", "Change physical objects"],
      },
      {
        collectionName: "Change by whom?",
        nodes: [
          "Change by a group",
          "Change by an individual",
          "Change with other actors",
        ],
      },
    ],
    parts: [
      {
        title: "Decide to Change",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Change",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Change",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Change",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To make or become different; to alter or modify. This is a fundamental action that results in a different state or form for an object, information, or situation.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Plan to Change",
    generalizations: ["Plan", "Change"],
    specializations: [],
    parts: [],
    description:
      "To create a plan with the primary purpose of changing an existing system, state, or standard.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Take corrective action",
    generalizations: ["Change"],
    specializations: [
      {
        collectionName: "Take what corrective action?",
        nodes: ["Execute Corrective Action for Facility Safety"],
      },
      {
        collectionName: "Take corrective action for what purpose?",
        nodes: ["Take Enforcement Action"],
      },
    ],
    parts: [],
    description:
      "To implement measures or perform an activity designed to rectify a deviation, non-conformance, or problem that has been identified.",
    "Editorial Notes": "",
    isPartOf: ["Ensure Compliance"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Improve",
    generalizations: ["Change"],
    specializations: [
      {
        collectionName: "Improve what?",
        nodes: [
          "Improve Production Method",
          "Improve Equipment Performance",
          "Improve Product Quality",
          "Improve Process Efficiency",
        ],
      },
    ],
    parts: [],
    description:
      "To make something better or bring it into a more desirable or valuable condition. This is a specialization of 'Change' focused on positive alteration.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Keep",
    generalizations: ["Act"],
    specializations: [
      {
        collectionName: "Keep by whom?",
        nodes: [
          "Keep by a group",
          "Keep by a community",
          "Keep by an individual",
        ],
      },
      {
        collectionName: "Keep what?",
        nodes: ["Keep information", "Keep physical objects"],
      },
      {
        collectionName: "Keep how?",
        nodes: ["Create by keeping", "Modify by keeping"],
      },
    ],
    parts: [
      {
        title: "Decide to Keep",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Keep",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Keep",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Keep",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To retain possession of or maintain something in a particular place, condition, or activity. This involves actions to ensure continuity, preservation, or possession over time.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Keep by a community",
    generalizations: ["Act by a community", "Keep"],
    specializations: [],
    parts: [],
    description:
      "To retain possession of or maintain something through the collective effort of a community. This is a virtual specialization of 'Keep' and 'Act by a community'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Work",
    generalizations: ["Act"],
    specializations: [
      {
        collectionName: "Work by whom?",
        nodes: [
          "Work by a group",
          "Work by a community",
          "Work by an individual",
        ],
      },
      {
        collectionName: "Work on what?",
        nodes: ["Work on information", "Work on physical objects"],
      },
      {
        collectionName: "Work how?",
        nodes: ["Create by working", "Modify by working"],
      },
      {
        collectionName: "Work what?",
        nodes: ["Conduct Research"],
      },
    ],
    parts: [
      {
        title: "Decide to Work",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
      {
        title: "Prepare to Work",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Work",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Work",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "true",
      },
    ],
    description:
      "To engage in activity involving mental or physical effort done in order to achieve a purpose or result, typically as part of a job or occupation.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Work by a community",
    generalizations: ["Act by a community", "Work"],
    specializations: [],
    parts: [],
    description:
      "To engage in activity involving mental or physical effort through the collective action of a community. This is a virtual specialization of 'Work' and 'Act by a community'.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Conduct Research",
    generalizations: ["Work", "Execute Information Creation"],
    specializations: [
      {
        collectionName: "Conduct Research how?",
        nodes: ["Collaborate to Conduct Research"],
      },
    ],
    parts: [],
    description:
      "To carry out the main activities of a research plan, including gathering data, performing experiments, and analyzing information.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Acquire",
    generalizations: ["Act"],
    specializations: [
      {
        collectionName: "Acquire what?",
        nodes: ["Secure capital"],
      },
    ],
    parts: [
      {
        title: "Select",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Obtain",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
    ],
    description:
      "A composite activity that involves the full process of gaining possession of something, typically through selection and subsequent obtainment.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Secure capital",
    generalizations: ["Acquire"],
    specializations: [],
    parts: [],
    description:
      "To finalize the transfer of funds from investors to the company, completing the capital-raising process.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Prepare to Act",
    generalizations: ["Act"],
    specializations: [
      {
        collectionName: "Prepare to Act by whom?",
        nodes: ["Prepare to Act by a group", "Prepare to Act by an individual"],
      },
      {
        collectionName: "Prepare to Act how?",
        nodes: [
          "Prepare to Act on Physical Object",
          "Prepare to Modify",
          "Prepare to Act on Information",
          "Initiate Transfer",
          "Prepare Patient for Treatment",
          "Prepare Treatment Environment",
          "Prepare to Interact",
          "Prepare to Create",
          "Prepare for storage",
          "Prepare for Test",
        ],
      },
      {
        collectionName: "Prepare for what process?",
        nodes: ["Prepare to Change", "Prepare to Maintain"],
      },
      {
        collectionName: "Prepare to Act for what purpose?",
        nodes: ["Prepare to Change Information"],
      },
      {
        collectionName: "Prepare how by practicing?",
        nodes: ["Rehearse"],
      },
      {
        collectionName: "Prepare for what specific purpose?",
        nodes: [
          "Assess situation and needs",
          "Identify key parties",
          "Prepare to Implement Plan",
        ],
      },
      {
        collectionName: "Prepare for what specific action?",
        nodes: ["Prepare to Install"],
      },
      {
        collectionName: "Prepare for what specific service?",
        nodes: ["Prepare for Occupational Therapy Session"],
      },
      {
        collectionName: "Prepare for what specific cleaning?",
        nodes: ["Prepare for Cleaning"],
      },
      {
        collectionName: "Prepare by process phase?",
        nodes: ["Prepare to Keep", "Prepare to Work"],
      },
      {
        collectionName: "Prepare for what specific application?",
        nodes: ["Prepare for Application"],
      },
      {
        collectionName: "Prepare for what specific process?",
        nodes: [
          "Prepare for medical examination",
          "Prepare for medical procedure",
          "Establish Reference Points",
          "Prepare to Perform",
          "Prepare for Inspection",
        ],
      },
      {
        collectionName: "Prepare for what legal action?",
        nodes: ["Prepare for Questioning"],
      },
      {
        collectionName: "Prepare for what law enforcement action?",
        nodes: ["Prepare for Raid"],
      },
      {
        collectionName: "Prepare for what investment activity?",
        nodes: ["Develop investment proposal"],
      },
    ],
    parts: [],
    description:
      "The set of activities undertaken to get ready to perform the main part of an action, such as gathering resources, creating a plan, or setting up equipment.",
    "Editorial Notes": "",
    isPartOf: ["Act"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Prepare to Modify",
    generalizations: ["Prepare to Act"],
    specializations: [
      {
        collectionName: "Modify how?",
        nodes: [
          "Prepare to Combine",
          "Prepare to Separate",
          "Prepare to Transform",
        ],
      },
      {
        collectionName: "Prepare to Modify what?",
        nodes: [
          "Prepare to Modify Information",
          "Prepare to Modify Physical Object",
        ],
      },
      {
        collectionName: "Prepare to Modify how?",
        nodes: ["Prepare to Move"],
      },
      {
        collectionName: "Prepare to modify by whom?",
        nodes: [
          "Prepare to Modify by a group",
          "Prepare to Modify by an individual",
          "Prepare to Adjust",
        ],
      },
    ],
    parts: [],
    description:
      "The preparatory steps for a modification, such as acquiring the object to be modified. This is a specialized form of 'Prepare to Act'.",
    "Editorial Notes": "",
    isPartOf: ["Modify"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Initiate Transfer",
    generalizations: ["Prepare to Act"],
    specializations: [
      {
        collectionName: "Initiate what kind of transfer?",
        nodes: ["Initiate Order"],
      },
      {
        collectionName: "Initiate Transfer what?",
        nodes: [
          "Initiate Information Transfer",
          "Initiate Physical Object Transfer",
        ],
      },
      {
        collectionName: "Initiate Transfer by whom?",
        nodes: [
          "Initiate Transfer by a group",
          "Initiate Transfer by an individual",
        ],
      },
      {
        collectionName: "Initiate what transfer?",
        nodes: ["Initiate Physical Object Transport"],
      },
    ],
    parts: [],
    description:
      "The preparatory steps of a transfer process, which can include packaging, addressing, or otherwise preparing an object or information to be moved.",
    "Editorial Notes": "",
    isPartOf: ["Transfer"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Prepare Patient for Treatment",
    generalizations: ["Prepare to Act"],
    specializations: [],
    parts: [],
    description:
      "To ready a patient for a therapeutic procedure. This may include explaining the procedure, positioning the patient, ensuring their comfort, and taking baseline measurements.",
    "Editorial Notes": "",
    isPartOf: ["Administer Therapeutic Treatment"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Prepare Treatment Environment",
    generalizations: ["Prepare to Act"],
    specializations: [],
    parts: [],
    description:
      "To set up the physical space and equipment needed for a therapeutic procedure. This may include gathering supplies, calibrating equipment, and ensuring the area is clean and safe.",
    "Editorial Notes": "",
    isPartOf: ["Administer Therapeutic Treatment"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Prepare to Interact",
    generalizations: ["Prepare to Act"],
    specializations: [
      {
        collectionName: "Prepare for what kind of interaction?",
        nodes: [
          "Prepare for Negotiation",
          "Prepare to Collaborate",
          "Prepare to Transfer Service",
        ],
      },
      {
        collectionName: "Prepare for what specific interaction?",
        nodes: ["Prepare to Manage", "Open Tribunal Proceedings"],
      },
      {
        collectionName: "Prepare for what other interaction?",
        nodes: [
          "Prepare for Client Conference",
          "Prepare educational materials and environment",
        ],
      },
      {
        collectionName: "Prepare to Interact by whom?",
        nodes: ["Prepare to Interact by a group"],
      },
      {
        collectionName: "Prepare for what specific educational interaction?",
        nodes: [
          "Prepare to Teach",
          "Prepare Lesson Plan",
          "Prepare to Interact by an individual",
        ],
      },
      {
        collectionName: "Prepare for what specific meeting or interaction?",
        nodes: [
          "Prepare for committee meeting",
          "Prepare to Interact by an ecosystem",
        ],
      },
    ],
    parts: [],
    description:
      "The preparatory activities for an interaction, such as defining goals, identifying participants, or preparing materials.",
    "Editorial Notes": "",
    isPartOf: ["Act with other actors (“Interact”)"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Prepare to Create",
    generalizations: ["Prepare to Act"],
    specializations: [
      {
        collectionName: "Prepare to Create by whom?",
        nodes: [
          "Prepare to Create by a group",
          "Prepare to Create by an individual",
        ],
      },
      {
        collectionName: "Prepare to Create what?",
        nodes: [
          "Prepare to Create Information",
          "Prepare to Create Physical Object",
        ],
      },
      {
        collectionName: "Prepare to do what?",
        nodes: ["Prepare to Record"],
      },
      {
        collectionName: "Develop what?",
        nodes: ["Plan Development"],
      },
    ],
    parts: [
      {
        title: "Plan Creation",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Get",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
    ],
    description:
      "The preparatory activities for a creation process, including planning the creation and acquiring the necessary resources.",
    "Editorial Notes": "",
    isPartOf: ["Create"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Prepare for storage",
    generalizations: ["Prepare to Act"],
    specializations: [
      {
        collectionName: "Prepare what for storage?",
        nodes: [
          "Modify information to prepare for storage",
          "Prepare information for storage",
          "Prepare physical object for storage",
        ],
      },
      {
        collectionName: "Prepare for storage by whom?",
        nodes: [
          "Prepare for storage by a group",
          "Prepare for storage by an individual",
        ],
      },
    ],
    parts: [],
    description:
      "The set of activities performed to make an object or information ready for placement into a storage system. This may include cleaning, packaging, labeling, or formatting.",
    "Editorial Notes": "",
    isPartOf: ["Store"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Prepare for Test",
    generalizations: ["Prepare to Act"],
    specializations: [
      {
        collectionName: "Prepare for what kind of test?",
        nodes: ["Prepare for Validation"],
      },
      {
        collectionName: "Prepare what for testing?",
        nodes: ["Prepare Food for Testing"],
      },
      {
        collectionName: "Prepare to test what?",
        nodes: [],
      },
      {
        collectionName: "Prepare to test what system?",
        nodes: ["Prepare to Test Physical System"],
      },
    ],
    parts: [],
    description:
      "To make preparations for conducting a test, which may include gathering materials, setting up equipment, and preparing the test subject or environment.",
    "Editorial Notes": "",
    isPartOf: ["Test"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Prepare to Change",
    generalizations: ["Prepare to Act"],
    specializations: [
      {
        collectionName: "Prepare to Change by whom?",
        nodes: [
          "Prepare to Change by a group",
          "Prepare to Change by an individual",
        ],
      },
      {
        collectionName: "Prepare to change what?",
        nodes: ["Prepare to Change Physical Object"],
      },
    ],
    parts: [],
    description:
      "The preparatory activities for making a change, such as gathering requirements, tools, or source materials. A specialized form of 'Prepare to Act'.",
    "Editorial Notes": "",
    isPartOf: ["Change"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Prepare to Maintain",
    generalizations: ["Prepare to Act"],
    specializations: [
      {
        collectionName: "Maintain by whom?",
        nodes: [
          "Prepare to Maintain by a group",
          "Prepare to Maintain by an individual",
        ],
      },
      {
        collectionName: "Maintain what?",
        nodes: [
          "Prepare to Maintain Information",
          "Prepare to Maintain Physical Object",
        ],
      },
    ],
    parts: [],
    description:
      "The preparatory activities for maintaining something, such as gathering tools, materials, or diagnostic information.",
    "Editorial Notes": "",
    isPartOf: ["Maintain"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Prepare to Change Information",
    generalizations: ["Prepare to Act"],
    specializations: [],
    parts: [],
    description:
      "The preparatory activities for changing information, such as gathering the source data and reference materials. This is a specialized form of 'Prepare to Act'.",
    "Editorial Notes": "",
    isPartOf: ["Change information"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Rehearse",
    generalizations: ["Prepare to Act"],
    specializations: [
      {
        collectionName: "Rehearse what?",
        nodes: ["Rehearse Lecture"],
      },
    ],
    parts: [],
    description:
      "To practice a performance, presentation, or speech in private before the public performance.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Assess situation and needs",
    generalizations: ["Prepare to Act"],
    specializations: [
      {
        collectionName: "Assess what specific situation?",
        nodes: [
          "Assess crisis situation and client's immediate needs",
          "Assess situation and needs by a human",
        ],
      },
    ],
    parts: [],
    description:
      "To evaluate the circumstances and requirements of a situation or individual to understand the context and determine the necessary course of action. This is a foundational preparatory step for many intervention and support activities.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Identify key parties",
    generalizations: ["Prepare to Act"],
    specializations: [
      {
        collectionName: "Identify whom?",
        nodes: ["Identify key parties for crisis resolution"],
      },
    ],
    parts: [],
    description:
      "To determine and list the individuals, groups, or organizations that have a stake in a situation, hold decision-making power, or are essential for communication and negotiation.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Prepare to Implement Plan",
    generalizations: ["Prepare to Act"],
    specializations: [],
    parts: [],
    description:
      "To make all necessary preparations before executing a plan, such as gathering resources, notifying stakeholders, and setting up the environment.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Prepare to Install",
    generalizations: ["Prepare to Act"],
    specializations: [
      {
        collectionName: "Prepare to install what?",
        nodes: ["Prepare to Install Covering"],
      },
      {
        collectionName: "[default]",
        nodes: [
          "Prepare to Install Motorcycle Accessory",
          "Prepare for Motorcycle Accessory Installation",
        ],
      },
    ],
    parts: [],
    description:
      "The preparatory activities for an installation, such as gathering tools, materials, and components, and preparing the installation site.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Prepare for Occupational Therapy Session",
    generalizations: ["Prepare to Act"],
    specializations: [],
    parts: [],
    description:
      "To perform all preparatory tasks required before an occupational therapy session begins, including laying out necessary materials and preparing the environment.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Prepare for Cleaning",
    generalizations: ["Prepare to Act"],
    specializations: [
      {
        collectionName: "Prepare for what specific cleaning?",
        nodes: ["Prepare for Cleaning of Biofuels Processing Work Area"],
      },
    ],
    parts: [],
    description:
      "The preparatory activities for a cleaning process, such as gathering cleaning supplies, preparing the area to be cleaned, and putting on personal protective equipment.",
    "Editorial Notes": "",
    isPartOf: ["Clean"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Prepare to Keep",
    generalizations: ["Prepare to Act"],
    specializations: [
      {
        collectionName: "Prepare to Keep by whom?",
        nodes: ["Prepare to Keep by a group"],
      },
    ],
    parts: [],
    description:
      "The preparatory activities for an action to retain or maintain something.",
    "Editorial Notes": "",
    isPartOf: ["Keep"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Prepare to Work",
    generalizations: ["Prepare to Act"],
    specializations: [
      {
        collectionName: "Prepare to Work by whom?",
        nodes: ["Prepare to Work by a group"],
      },
    ],
    parts: [],
    description:
      "The preparatory activities for an action involving mental or physical effort.",
    "Editorial Notes": "",
    isPartOf: ["Work"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Prepare for Application",
    generalizations: ["Prepare to Act"],
    specializations: [],
    parts: [],
    description:
      "The preparatory activities for an application, such as cleaning the surface or mixing the substance to be applied.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Prepare for medical examination",
    generalizations: ["Prepare to Act"],
    specializations: [
      {
        collectionName: "Prepare for what specific examination?",
        nodes: ["Prepare for ear examination"],
      },
    ],
    parts: [],
    description:
      "To perform the preparatory steps before a medical examination, including gathering equipment, preparing the patient, and ensuring a sterile environment.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Prepare for medical procedure",
    generalizations: ["Prepare to Act"],
    specializations: [
      {
        collectionName: "Prepare for what specific procedure?",
        nodes: ["Prepare for ear canal cleaning"],
      },
    ],
    parts: [],
    description:
      "To perform the preparatory steps before a medical procedure, including gathering supplies, preparing the patient, and setting up equipment.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Establish Reference Points",
    generalizations: ["Prepare to Act"],
    specializations: [
      {
        collectionName: "Establish what reference points?",
        nodes: ["Establish curb reference points"],
      },
    ],
    parts: [],
    description:
      "To identify and mark initial points or benchmarks on a surface from which all subsequent measurements will be taken. This ensures accuracy and consistency.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Prepare to Perform",
    generalizations: ["Prepare to Act"],
    specializations: [],
    parts: [],
    description:
      "The preparatory activities undertaken before a performance, such as practicing, rehearsing, and preparing materials or equipment.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Prepare for Inspection",
    generalizations: ["Prepare to Act"],
    specializations: [
      {
        collectionName: "Prepare for what specific inspection?",
        nodes: ["Prepare for Tree Inspection"],
      },
    ],
    parts: [],
    description:
      "The set of activities undertaken to get ready to perform an inspection, such as gathering tools, reviewing relevant information, and preparing the subject to be inspected.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Prepare for Questioning",
    generalizations: ["Prepare to Act"],
    specializations: [],
    parts: [],
    description:
      "To make all necessary preparations before questioning a witness or suspect, such as reviewing case files, setting up a recording device, and ensuring the interview environment is appropriate.",
    "Editorial Notes": "",
    isPartOf: ["Question Witnesses and Suspects"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Prepare for Raid",
    generalizations: ["Prepare to Act"],
    specializations: [],
    parts: [],
    description:
      "To undertake all necessary preparations before executing a raid, such as assembling personnel, checking equipment, and conducting final briefings.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Develop investment proposal",
    generalizations: ["Prepare to Act"],
    specializations: [],
    parts: [],
    description:
      "To create a comprehensive document or presentation that outlines the business case for investment, including financial projections, market analysis, and use of funds.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Execute Act",
    generalizations: ["Act"],
    specializations: [
      {
        collectionName: "Execute Act by whom?",
        nodes: ["Execute Act by a group", "Execute Act by an individual"],
      },
      {
        collectionName: "Execute Act how?",
        nodes: [
          "Execute Act on Physical Object",
          "Execute Modification",
          "Execute Act on Information",
          "Execute Transfer",
          "Conduct Negotiation",
          "Administer Treatment",
          "Execute Interaction",
          "Execute Creation",
          "Execute Test",
          "Take Maintenance Action",
        ],
      },
      {
        collectionName: "Execute what fundamental action?",
        nodes: ["Execute Storage"],
      },
      {
        collectionName: "Execute Act for what purpose?",
        nodes: ["Implement Solution", "Execute Information Change"],
      },
      {
        collectionName: "Execute what process?",
        nodes: ["Execute Change", "Execute Maintenance", "Implement"],
      },
      {
        collectionName: "Execute what specific plan?",
        nodes: ["Execute Plan"],
      },
      {
        collectionName: "Execute what specific service?",
        nodes: ["Conduct Occupational Therapy Session"],
      },
      {
        collectionName: "Execute what program?",
        nodes: ["Execute Program"],
      },
      {
        collectionName: "Execute what specific maintenance act?",
        nodes: ["Attempt Local Repair or Replacement"],
      },
      {
        collectionName: "Execute by process phase?",
        nodes: ["Execute Keep", "Execute Work"],
      },
      {
        collectionName: "Execute what specific application?",
        nodes: ["Execute Application"],
      },
      {
        collectionName: "Execute what specific action?",
        nodes: [
          "Follow Up on Committee Action Items",
          "Execute medical examination",
          "Execute medical procedure",
          "Execute Professional Service",
          "Execute Improvement Implementation",
        ],
      },
      {
        collectionName: "Execute what specific process?",
        nodes: [
          "Execute Performance",
          "Execute Examination",
          "Conduct Inspection",
        ],
      },
      {
        collectionName: "Execute what legal action?",
        nodes: ["Conduct Questioning"],
      },
      {
        collectionName: "Execute what law enforcement action?",
        nodes: ["Execute Raid"],
      },
    ],
    parts: [],
    description:
      "The core performance of an action, where the primary transformation or work is accomplished.",
    "Editorial Notes": "",
    isPartOf: ["Act"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Execute Modification",
    generalizations: ["Execute Act"],
    specializations: [
      {
        collectionName: "Execute modification how?",
        nodes: [
          "Execute Combination",
          "Execute Separation",
          "Execute Transformation",
        ],
      },
      {
        collectionName: "Execute Modification what?",
        nodes: [
          "Execute Information Modification",
          "Execute Physical Object Modification",
        ],
      },
      {
        collectionName: "Execute Modification how?",
        nodes: ["Execute Move"],
      },
      {
        collectionName: "Execute Modification by whom?",
        nodes: [
          "Execute Modification by a group",
          "Execute Modification by an individual",
        ],
      },
    ],
    parts: [],
    description:
      "The core act of changing an entity. This is a specialized form of 'Execute Act'.",
    "Editorial Notes": "",
    isPartOf: ["Modify"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Execute Transfer",
    generalizations: ["Execute Act"],
    specializations: [
      {
        collectionName: "Execute Transfer by whom?",
        nodes: [
          "Execute Transfer by a group",
          "Execute Transfer by an individual",
        ],
      },
      {
        collectionName: "Execute Transfer what?",
        nodes: [
          "Execute Information Transfer",
          "Execute Physical Object Transfer",
        ],
      },
      {
        collectionName: "Transfer what physical object by what method?",
        nodes: ["Execute Physical Object Transport"],
      },
    ],
    parts: [],
    description:
      "The core step of a transfer process where the object or information is actively in transit from its source to its destination.",
    "Editorial Notes": "",
    isPartOf: ["Transfer"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Conduct Negotiation",
    generalizations: ["Execute Interaction"],
    specializations: [
      {
        collectionName: "Conduct Negotiation by whom?",
        nodes: ["Conduct Negotiation by a group"],
      },
    ],
    parts: [],
    description:
      "The core interactive process of a negotiation, involving communication, presentation of positions, exchange of offers and counter-offers, and bargaining with other parties.",
    "Editorial Notes": "",
    isPartOf: ["Negotiate"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Administer Treatment",
    generalizations: ["Execute Act", "Provide Medical Service"],
    specializations: [
      {
        collectionName: "Administer what kind of treatment?",
        nodes: ["Administer Physical Therapy"],
      },
      {
        collectionName: "Administer what treatment?",
        nodes: ["Administer medication"],
      },
      {
        collectionName: "Administer what specific treatment?",
        nodes: [
          "Implement Treatment Plan",
          "Administer Speech-Language Therapy",
        ],
      },
    ],
    parts: [],
    description:
      "The core execution of a therapeutic intervention on a patient. This is the generic action of applying a therapy.",
    "Editorial Notes": "",
    isPartOf: ["Administer Therapeutic Treatment"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Execute Interaction",
    generalizations: ["Execute Act"],
    specializations: [
      {
        collectionName: "Execute what kind of interaction?",
        nodes: [
          "Conduct Negotiation",
          "Execute Collaboration",
          "Execute Service Transfer",
        ],
      },
      {
        collectionName: "Execute what management interaction?",
        nodes: ["Execute Management"],
      },
      {
        collectionName: "Execute what specific interaction?",
        nodes: ["Execute Advocacy"],
      },
      {
        collectionName: "Execute what specific service interaction?",
        nodes: ["Deliver Instruction", "Conduct Client Conference"],
      },
      {
        collectionName: "Execute Interaction by whom?",
        nodes: [],
      },
      {
        collectionName: "Execute interaction by whom?",
        nodes: [
          "Execute Interaction by a group",
          "Execute Interaction by an individual",
          "Execute Interaction by an ecosystem",
        ],
      },
      {
        collectionName: "Execute what transaction?",
        nodes: ["Execute deposit at bank"],
      },
    ],
    parts: [],
    description:
      "The core performance of an interaction, involving communication, collaboration, or negotiation with other actors.",
    "Editorial Notes": "",
    isPartOf: ["Act with other actors (“Interact”)"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Execute Creation",
    generalizations: ["Execute Act"],
    specializations: [
      {
        collectionName: "Execute Creation of what?",
        nodes: [
          "Execute Physical Object Creation",
          "Execute Information Creation",
          "Execute Recording",
        ],
      },
      {
        collectionName: "Execute what kind of software creation?",
        nodes: ["Implement Software"],
      },
      {
        collectionName: "Execute Creation by whom?",
        nodes: [
          "Execute Creation by a group",
          "Execute Creation by an individual",
        ],
      },
      {
        collectionName: "Execute what process?",
        nodes: ["Execute Development"],
      },
    ],
    parts: [],
    description:
      "The core activity of transforming resources into a new entity according to a plan.",
    "Editorial Notes": "",
    isPartOf: ["Create"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Execute Test",
    generalizations: ["Execute Act"],
    specializations: [
      {
        collectionName: "Execute what kind of test?",
        nodes: ["Execute Test on Sample", "Execute Validation"],
      },
      {
        collectionName: "Execute test of what?",
        nodes: [],
      },
      {
        collectionName: "Execute what test?",
        nodes: ["Execute Test of Physical System", "Execute Food Test"],
      },
    ],
    parts: [],
    description:
      "To perform the core procedure of a test according to a defined protocol.",
    "Editorial Notes": "",
    isPartOf: ["Test"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Take Maintenance Action",
    generalizations: ["Execute Act"],
    specializations: [
      {
        collectionName: "Take Maintenance Action on what?",
        nodes: ["Take Maintenance Action on Information"],
      },
      {
        collectionName: "Take Maintenance Action on what else?",
        nodes: ["Take Maintenance Action on physical objects"],
      },
      {
        collectionName: "Take what kind of maintenance action?",
        nodes: ["Execute Repair"],
      },
    ],
    parts: [],
    description:
      "To perform a specific task intended to keep an entity in its existing state or restore it to that state. This is a generic action that can be specialized into activities like updating, repairing, or replacing.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Execute Storage",
    generalizations: ["Execute Act"],
    specializations: [
      {
        collectionName: "Execute Storage by whom?",
        nodes: [
          "Execute Storage by a group",
          "Execute Storage by an individual",
        ],
      },
    ],
    parts: [
      {
        title: "Place in storage",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
    ],
    description:
      "The core performance of placing an item into storage. This is a specialized form of 'Execute Act'.",
    "Editorial Notes": "",
    isPartOf: ["Store"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Implement Solution",
    generalizations: ["Execute Act"],
    specializations: [
      {
        collectionName: "Implement what specific solution?",
        nodes: ["Implement Solution for Student Problem"],
      },
      {
        collectionName: "Implement what kind of solution?",
        nodes: ["Implement Fix"],
      },
      {
        collectionName: "Implement solution how?",
        nodes: ["Build Solution"],
      },
      {
        collectionName: "Implement what solution?",
        nodes: [
          "Implement Solution for Teaching and Research Issues",
          "Implement Solution by Collaborating",
        ],
      },
      {
        collectionName: "Implement what other solution?",
        nodes: [
          "Implement Solution for Worker Problem",
          "Collaborate to Implement Solution",
        ],
      },
    ],
    parts: [],
    description:
      "To execute the selected solution, putting the plan into action.",
    "Editorial Notes": "",
    isPartOf: ["Solve Problem"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Execute Information Change",
    generalizations: ["Execute Act"],
    specializations: [],
    parts: [],
    description:
      "The core performance of altering or modifying information. This is a specialized form of 'Execute Act'.",
    "Editorial Notes": "",
    isPartOf: ["Change information"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Execute Change",
    generalizations: ["Execute Act"],
    specializations: [
      {
        collectionName: "Execute Change by whom?",
        nodes: ["Execute Change by a group", "Execute Change by an individual"],
      },
      {
        collectionName: "Execute change of what?",
        nodes: ["Execute Change Physical Object"],
      },
    ],
    parts: [],
    description:
      "The core performance of altering or modifying something. A specialized form of 'Execute Act'.",
    "Editorial Notes": "",
    isPartOf: ["Change"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Execute Maintenance",
    generalizations: ["Execute Act"],
    specializations: [
      {
        collectionName: "Execute maintenance by whom?",
        nodes: [
          "Execute Maintenance by a group",
          "Execute Maintenance by an individual",
        ],
      },
      {
        collectionName: "Execute maintenance of what?",
        nodes: [
          "Execute Information Maintenance",
          "Execute Physical Object Maintenance",
        ],
      },
    ],
    parts: [],
    description:
      "The core performance of a maintenance action, such as repairing, cleaning, or adjusting.",
    "Editorial Notes": "",
    isPartOf: ["Maintain"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Implement",
    generalizations: ["Execute Act"],
    specializations: [
      {
        collectionName: "Implement what?",
        nodes: ["Implement Adherence Support Plan"],
      },
      {
        collectionName: "Implement what else?",
        nodes: [
          "Implement Safety Procedures",
          "Incorporate regulatory changes into practice",
          "Implement Design",
          "Implement Plan",
        ],
      },
      {
        collectionName: "[default]",
        nodes: [
          "Implement Controls",
          "Implement Database Schema",
          "Implement Improvement",
        ],
      },
    ],
    parts: [],
    description: "To put a decision, plan, or agreement into effect.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Execute Plan",
    generalizations: ["Execute Act"],
    specializations: [],
    parts: [],
    description:
      "To carry out the primary actions and steps as detailed in a plan.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Conduct Occupational Therapy Session",
    generalizations: ["Execute Act"],
    specializations: [],
    parts: [],
    description:
      "The core execution of an occupational therapy session, involving direct interaction with the patient and the application of therapeutic techniques.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Execute Program",
    generalizations: ["Execute Act"],
    specializations: [],
    parts: [],
    description:
      "The active phase of program management, involving launching, directing, and managing the constituent projects and activities defined in the program plan.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Attempt Local Repair or Replacement",
    generalizations: ["Execute Act"],
    specializations: [],
    parts: [],
    description:
      "To perform hands-on corrective actions on a machine, which may include repairing existing components or replacing them with new ones.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Execute Keep",
    generalizations: ["Execute Act"],
    specializations: [
      {
        collectionName: "Execute Keep by whom?",
        nodes: ["Execute Keep by a group"],
      },
    ],
    parts: [],
    description:
      "The core performance of an action to retain or maintain something.",
    "Editorial Notes": "",
    isPartOf: ["Keep"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Execute Work",
    generalizations: ["Execute Act"],
    specializations: [
      {
        collectionName: "Execute Work by whom?",
        nodes: ["Execute Work by a group"],
      },
    ],
    parts: [],
    description:
      "The core performance of an action involving mental or physical effort.",
    "Editorial Notes": "",
    isPartOf: ["Work"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Execute Application",
    generalizations: ["Execute Act"],
    specializations: [],
    parts: [],
    description:
      "The core performance of applying a substance or force to a surface.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Follow Up on Committee Action Items",
    generalizations: ["Execute Act"],
    specializations: [],
    parts: [],
    description:
      "To undertake and complete tasks assigned during a committee meeting, or to monitor the implementation of committee decisions.",
    "Editorial Notes": "",
    isPartOf: ["Participate in committee"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Execute medical examination",
    generalizations: ["Execute Act"],
    specializations: [
      {
        collectionName: "Execute what specific medical examination?",
        nodes: ["Perform otoscopic examination"],
      },
    ],
    parts: [],
    description:
      "The core performance of a medical examination, involving the physical act of inspecting the patient using various techniques and tools.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Execute medical procedure",
    generalizations: ["Execute Act"],
    specializations: [
      {
        collectionName: "Execute what specific medical procedure?",
        nodes: ["Perform ear canal cleaning"],
      },
    ],
    parts: [],
    description:
      "The core performance of a medical procedure, involving the hands-on application of a therapeutic or diagnostic technique.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Execute Professional Service",
    generalizations: ["Execute Act"],
    specializations: [],
    parts: [],
    description:
      "To perform the core expert work as defined in a service agreement or proposal.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Execute Improvement Implementation",
    generalizations: ["Execute Act"],
    specializations: [],
    parts: [],
    description:
      "To carry out the steps and actions detailed in an improvement plan.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Execute Performance",
    generalizations: ["Execute Act"],
    specializations: [],
    parts: [],
    description: "The core execution of a performance in front of an audience.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Execute Examination",
    generalizations: ["Execute Act"],
    specializations: [],
    parts: [],
    description:
      "To perform the core act of carefully observing, inspecting, or studying a subject to discover information.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Conduct Inspection",
    generalizations: ["Execute Act"],
    specializations: [
      {
        collectionName: "Conduct what inspection?",
        nodes: ["Conduct Visual Tree Inspection"],
      },
    ],
    parts: [],
    description:
      "The core performance of an inspection, where the primary examination and observation takes place.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Conduct Questioning",
    generalizations: ["Execute Act"],
    specializations: [],
    parts: [],
    description:
      "The core act of asking a series of questions to a witness or suspect to elicit information relevant to an investigation.",
    "Editorial Notes": "",
    isPartOf: ["Question Witnesses and Suspects"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Execute Raid",
    generalizations: ["Execute Act"],
    specializations: [],
    parts: [],
    description:
      "The core performance of a law enforcement raid, involving entry, securing the premises, and apprehending individuals.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Conclude Act",
    generalizations: ["Act"],
    specializations: [
      {
        collectionName: "Conclude Act by whom?",
        nodes: ["Conclude Act by a group", "Conclude Act by an individual"],
      },
      {
        collectionName: "Conclude what action?",
        nodes: [
          "Conclude Act on Physical Object",
          "Conclude Modification",
          "Conclude Storage",
          "Conclude Act on Information",
          "Finalize Transfer",
          "Conclude Treatment",
          "Conclude Interaction",
          "Finalize Creation",
        ],
      },
      {
        collectionName: "Conclude what informational process?",
        nodes: ["Conclude Information Change"],
      },
      {
        collectionName: "Conclude Act for what purpose?",
        nodes: ["Conclude Change", "Conclude Maintenance"],
      },
      {
        collectionName: "Conclude what specific action?",
        nodes: ["Conclude Installation"],
      },
      {
        collectionName: "Conclude what specific process?",
        nodes: ["Conclude Plan Implementation"],
      },
      {
        collectionName: "Conclude what specific service?",
        nodes: ["Conclude Occupational Therapy Session"],
      },
      {
        collectionName: "Conclude what program?",
        nodes: ["Close Program"],
      },
      {
        collectionName: "Conclude by process phase?",
        nodes: ["Conclude Keep", "Conclude Work"],
      },
      {
        collectionName: "Conclude what specific application?",
        nodes: ["Finalize Application"],
      },
      {
        collectionName: "Conclude what specific act?",
        nodes: ["Close Out Contract"],
      },
      {
        collectionName: "Conclude what other specific action?",
        nodes: ["Conclude medical procedure", "Conclude Performance"],
      },
      {
        collectionName: "Conclude what law enforcement action?",
        nodes: ["Secure Scene and Evidence"],
      },
      {
        collectionName: "Conclude what legal action?",
        nodes: ["Document Questioning"],
      },
    ],
    parts: [],
    description:
      "The final activities to wrap up an action, which may include cleanup, reporting, or verifying completion.",
    "Editorial Notes": "",
    isPartOf: ["Act"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Conclude Modification",
    generalizations: ["Conclude Act"],
    specializations: [
      {
        collectionName: "Conclude what modification?",
        nodes: [
          "Conclude Combination",
          "Conclude Separation",
          "Conclude Transformation",
        ],
      },
      {
        collectionName: "Conclude Modification what?",
        nodes: [
          "Conclude Information Modification",
          "Conclude Physical Object Modification",
        ],
      },
      {
        collectionName: "Conclude Modification how?",
        nodes: ["Conclude Move"],
      },
      {
        collectionName: "Conclude what specific modification?",
        nodes: ["Conclude Repair"],
      },
      {
        collectionName: "Conclude Modification by whom?",
        nodes: [
          "Conclude Modification by a group",
          "Conclude Modification by an individual",
          "Conclude Adjustment",
        ],
      },
    ],
    parts: [],
    description:
      "The final steps after a modification, such as returning the modified object. This is a specialized form of 'Conclude Act'.",
    "Editorial Notes": "",
    isPartOf: ["Modify"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Conclude Storage",
    generalizations: ["Conclude Act"],
    specializations: [
      {
        collectionName: "Conclude Storage by whom?",
        nodes: [
          "Conclude Storage by a group",
          "Conclude Storage by an individual",
        ],
      },
      {
        collectionName: "Conclude Storage of what?",
        nodes: [
          "Conclude Information Storage",
          "Conclude Physical Object Storage",
        ],
      },
    ],
    parts: [],
    description:
      "The activities performed to finalize the storage process, such as sealing a container or updating a storage log. A specialization of 'Conclude Act'.",
    "Editorial Notes": "",
    isPartOf: ["Store"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Finalize Transfer",
    generalizations: ["Conclude Act"],
    specializations: [
      {
        collectionName: "Finalize Transfer by whom?",
        nodes: [
          "Finalize Transfer by a group",
          "Finalize Transfer by an individual",
        ],
      },
      {
        collectionName: "Finalize Transfer what?",
        nodes: [
          "Finalize Information Transfer",
          "Finalize Physical Object Transfer",
        ],
      },
      {
        collectionName: "Finalize what transfer?",
        nodes: ["Finalize Physical Object Transport"],
      },
    ],
    parts: [],
    description:
      "The concluding steps of a transfer process, which can include receipt, unpacking, and verification of the transferred object or information.",
    "Editorial Notes": "",
    isPartOf: ["Transfer"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Conclude Treatment",
    generalizations: ["Conclude Act"],
    specializations: [],
    parts: [],
    description:
      "To complete a therapeutic session. This may include cleaning the area, putting away equipment, documenting the session, and providing post-treatment instructions to the patient.",
    "Editorial Notes": "",
    isPartOf: ["Administer Therapeutic Treatment"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Conclude Interaction",
    generalizations: ["Conclude Act"],
    specializations: [
      {
        collectionName: "Conclude what kind of interaction?",
        nodes: [
          "Finalize Agreement",
          "Conclude Collaboration",
          "Conclude Service Transfer",
        ],
      },
      {
        collectionName: "Conclude what other interaction?",
        nodes: ["Conclude Management", "Close Tribunal Proceedings"],
      },
      {
        collectionName: "Conclude what specific interaction?",
        nodes: ["Document Client Conference Outcomes"],
      },
      {
        collectionName: "Conclude what specific educational interaction?",
        nodes: ["Conclude educational program session"],
      },
      {
        collectionName: "Conclude what interaction?",
        nodes: ["Conclude Customer Interaction"],
      },
      {
        collectionName: "Conclude Interaction by whom?",
        nodes: [],
      },
      {
        collectionName: "Conclude what support or other interaction?",
        nodes: [
          "Conclude support interaction",
          "Conclude Interaction by a group",
          "Conclude Interaction by an individual",
          "Conclude Interaction by an ecosystem",
        ],
      },
    ],
    parts: [],
    description:
      "The final activities to wrap up an interaction, such as summarizing outcomes, formalizing agreements, or documenting the interaction.",
    "Editorial Notes": "",
    isPartOf: ["Act with other actors (“Interact”)"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Finalize Creation",
    generalizations: ["Conclude Act"],
    specializations: [
      {
        collectionName: "Finalize what specific creation?",
        nodes: ["Finalize instructional materials"],
      },
      {
        collectionName: "Finalize what?",
        nodes: [
          "Finalize Physical Object Creation",
          "Formulate Information Output",
          "Finalize Recording",
          "Review and Finalize Report",
          "Finalize Design",
        ],
      },
      {
        collectionName: "Finalize what information artifact?",
        nodes: ["Finalize Information Creation"],
      },
      {
        collectionName: "Finalize Creation by whom?",
        nodes: [
          "Finalize Creation by a group",
          "Finalize Creation by an individual",
        ],
      },
      {
        collectionName: "Finalize what development process?",
        nodes: ["Finalize Development"],
      },
    ],
    parts: [],
    description:
      "The activity of completing, packaging, or documenting the newly created entity.",
    "Editorial Notes": "",
    isPartOf: ["Create"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Conclude Information Change",
    generalizations: ["Conclude Act"],
    specializations: [],
    parts: [],
    description:
      "The concluding activities after changing information, such as saving the new version or distributing the updated information. This is a specialized form of 'Conclude Act'.",
    "Editorial Notes": "",
    isPartOf: ["Change information"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Conclude Change",
    generalizations: ["Conclude Act"],
    specializations: [
      {
        collectionName: "Conclude change by whom?",
        nodes: [
          "Conclude Change by a group",
          "Conclude Change by an individual",
        ],
      },
      {
        collectionName: "Conclude change of what?",
        nodes: ["Conclude Change Physical Object"],
      },
    ],
    parts: [],
    description:
      "The concluding activities after making a change, such as validation, documentation, or release. A specialized form of 'Conclude Act'.",
    "Editorial Notes": "",
    isPartOf: ["Change"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Conclude Maintenance",
    generalizations: ["Conclude Act"],
    specializations: [
      {
        collectionName: "Conclude Maintenance by whom?",
        nodes: [
          "Conclude Maintenance by a group",
          "Conclude Maintenance by an individual",
        ],
      },
      {
        collectionName: "Conclude maintenance of what?",
        nodes: [
          "Conclude Information Maintenance",
          "Conclude Physical Object Maintenance",
        ],
      },
    ],
    parts: [],
    description:
      "The concluding activities after performing maintenance, such as cleanup, testing, and documenting the work performed.",
    "Editorial Notes": "",
    isPartOf: ["Maintain"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Conclude Installation",
    generalizations: ["Conclude Act"],
    specializations: [],
    parts: [],
    description:
      "The final activities to wrap up an installation, which may include testing, cleanup, and inspection.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Conclude Plan Implementation",
    generalizations: ["Conclude Act"],
    specializations: [],
    parts: [],
    description:
      "To perform the final activities to wrap up the execution of a plan, such as reporting on outcomes or archiving results.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Conclude Occupational Therapy Session",
    generalizations: ["Conclude Act"],
    specializations: [],
    parts: [],
    description:
      "To perform all concluding tasks after an occupational therapy session has ended, including cleaning and repairing tools used during the session.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Close Program",
    generalizations: ["Conclude Act"],
    specializations: [
      {
        collectionName: "Close what specific program?",
        nodes: ["Close Facility and Resource Program"],
      },
      {
        collectionName: "Close what program?",
        nodes: ["Close medical program"],
      },
    ],
    parts: [],
    description:
      "To formally conclude a program by verifying that all projects and deliverables are complete, transitioning outputs to operations, closing contracts, and documenting lessons learned.",
    "Editorial Notes": "",
    isPartOf: ["Administer Program"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Conclude Keep",
    generalizations: ["Conclude Act"],
    specializations: [
      {
        collectionName: "Conclude Keep by whom?",
        nodes: ["Conclude Keep by a group"],
      },
    ],
    parts: [],
    description:
      "The final activities to wrap up an action of retaining or maintaining something.",
    "Editorial Notes": "",
    isPartOf: ["Keep"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Conclude Work",
    generalizations: ["Conclude Act"],
    specializations: [
      {
        collectionName: "Conclude Work by whom?",
        nodes: ["Conclude Work by a group"],
      },
    ],
    parts: [],
    description:
      "The final activities to wrap up an action involving mental or physical effort.",
    "Editorial Notes": "",
    isPartOf: ["Work"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Finalize Application",
    generalizations: ["Conclude Act"],
    specializations: [],
    parts: [],
    description:
      "The concluding activities after an application, such as allowing for drying time, cleaning up tools, or inspecting the result.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Close Out Contract",
    generalizations: ["Conclude Act"],
    specializations: [],
    parts: [],
    description:
      "To perform the final administrative actions to formally close a contract, including verifying that all obligations have been met, all payments have been made, and all documentation is complete.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Conclude medical procedure",
    generalizations: ["Conclude Act"],
    specializations: [],
    parts: [],
    description:
      "To perform the final steps after a medical procedure, such as cleaning the area, providing post-procedure instructions, and documenting the outcome.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Conclude Performance",
    generalizations: ["Conclude Act"],
    specializations: [],
    parts: [],
    description:
      "The concluding activities of a performance, such as bowing, acknowledging the audience, and post-performance cleanup.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Secure Scene and Evidence",
    generalizations: ["Conclude Act"],
    specializations: [],
    parts: [],
    description:
      "To establish control over a location after a law enforcement operation and to properly collect and preserve any evidence found.",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Document Questioning",
    generalizations: ["Conclude Act"],
    specializations: [],
    parts: [],
    description:
      "To create a formal record of a questioning session, which may include written notes, audio or video recordings, or a formal transcribed statement.",
    "Editorial Notes": "",
    isPartOf: ["Question Witnesses and Suspects"],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Transport physical objects",
    generalizations: ["Transport", "Move physical objects"],
    specializations: [
      {
        collectionName: "Transport physical objects how?",
        nodes: [
          "Carry physical objects",
          "Pull physical objects",
          "Push physical objects",
        ],
      },
      {
        collectionName: "Transport physical objects for what purpose?",
        nodes: ["Load physical objects", "Unload physical objects"],
      },
      {
        collectionName: "Transport what specific physical objects?",
        nodes: ["Transport suspect to custody"],
      },
      {
        collectionName: "[default]",
        nodes: [
          "Transport Machine Parts and Equipment",
          "Transport Person",
          "Transport deposit to bank",
        ],
      },
    ],
    parts: [
      {
        title: "Prepare to Transport Physical Object",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Execute Transport of Physical Object",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
      {
        title: "Conclude Transport of Physical Object",
        inheritedFrom: {
          generalization: "",
          part: "",
        },
        optional: "false",
      },
    ],
    description:
      "To cause physical objects to move from one place to another, typically over a distance, using a vehicle, machinery, or manual effort.",
    "Editorial Notes":
      '"Carry", "Pull", and "Push" may sound like specializations of "Transport physical object", but they are broader, and one could find many use cases of carrying, pulling, or pushing information, processes, or actors.\n\nFor "Load physical objects" and "Unload physical objects", one needs to move the object from one place to another, so they are also specializations of "Transport physical objects". They indicate the purpose of each type of transportation, so they should be grouped under the collection "Transport physical objects for what purpose?"\n',
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Carry physical objects",
    generalizations: ["Transport physical objects"],
    specializations: [
      {
        collectionName: "Carry physical objects by whom?",
        nodes: ["Carry by vehicle", "Carry physical objects by a human"],
      },
    ],
    parts: [],
    description: "",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Pull physical objects",
    generalizations: ["Transport physical objects"],
    specializations: [
      {
        collectionName: "Pull physical objects by what agent?",
        nodes: [
          "Pull physical objects by human",
          "Pull physical objects by vehicle",
        ],
      },
    ],
    parts: [],
    description: "",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
  {
    title: "Push physical objects",
    generalizations: ["Transport physical objects"],
    specializations: [
      {
        collectionName: "Push physical objects by what agent?",
        nodes: [
          "Push physical objects by vehicle",
          "Push physical objects by human",
        ],
      },
    ],
    parts: [],
    description: "",
    "Editorial Notes": "",
    isPartOf: [],
    most_efficiently_performed_by: {
      performer: "",
      reason: "",
      sources: [],
    },
  },
];
