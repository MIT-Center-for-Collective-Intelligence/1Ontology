import React, { useEffect, useRef, useState } from "react";
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
  Popover,
  TextField,
} from "@mui/material";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import {
  ICollection,
  InheritedPartsDetail,
  ILinkNode,
  INode,
} from "@components/types/INode";
import ArrowRightAltIcon from "@mui/icons-material/ArrowRightAlt";
import RemoveIcon from "@mui/icons-material/Remove";
import SearchIcon from "@mui/icons-material/Search";
import CheckIcon from "@mui/icons-material/Check";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";

import AddIcon from "@mui/icons-material/Add";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import DragHandleIcon from "@mui/icons-material/DragHandle";
import CloseIcon from "@mui/icons-material/Close";
import InheritedPartsLegend from "../Common/InheritedPartsLegend";
import GeneralizationTabs from "./GeneralizationTabs";

import { Timestamp } from "firebase/firestore";
import { recordLogs } from "@components/lib/utils/helpers";
import { getPartGeneralizationSources } from "@components/lib/utils/partsHelper";
import SyncedSpinner from "@components/components/SyncedSpinner";

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
  addNodesToCache?: (
    nodes: { [id: string]: INode },
    parentNodeId?: string,
  ) => void;
  readOnly?: boolean;
  currentVisibleNode: any;
  setDisplayDetails: any;
  enableEdit: boolean;
  replaceWith: any;
  saveParts: (
    newParts: ICollection[],
    inheritedPartsDetails?: InheritedPartsDetail[] | null,
  ) => Promise<void>;
  user: any;
  appName?: string;
  navigateToNode?: any;
  triggerSearch?: any;
  addPart?: any;
  removePart?: any;
  inheritedPartsDetails?: InheritedPartsDetail[] | null;
  inheritedPartsLoading?: boolean;
  mutateInheritedPartsDetails?: (
    newData: InheritedPartsDetail[] | null,
  ) => void;
  refetchNow?: () => void;
  clonedNodesQueue?: {
    [nodeId: string]: { title: string; id: string; property: string };
  };
  approvePendingPart?: (queuedId: string) => Promise<void> | void;
  cancelPendingPart?: (queuedId: string) => void;
  updatePendingPartTitle?: (queuedId: string, title: string) => void;
}

const InheritedPartsViewerEdit: React.FC<InheritedPartsViewerProps> = ({
  selectedProperty,
  getAllGeneralizations,
  getGeneralizationParts,
  nodes,
  fetchNode,
  addNodesToCache,
  readOnly = false,
  enableEdit,
  replaceWith,
  saveParts,
  currentVisibleNode,
  triggerSearch,
  addPart,
  removePart,
  user,
  navigateToNode,
  setDisplayDetails,
  appName,
  inheritedPartsDetails,
  inheritedPartsLoading,
  mutateInheritedPartsDetails,
  refetchNow,
  clonedNodesQueue,
  approvePendingPart,
  cancelPendingPart,
  updatePendingPartTitle,
}) => {
  const [activeTab, setActiveTab] = React.useState<string | null>(null);
  const generalizationsFromParent: GeneralizationNode[] =
    getAllGeneralizations();

  // Root node: no generalizations, but may have own parts. Treat current node as its own
  // "generalization" so parts can be displayed for comparison.
  const partsSource = currentVisibleNode.properties?.parts;
  const hasOwnParts = (partsSource?.[0]?.nodes?.length ?? 0) > 0;
  const generalizations: GeneralizationNode[] =
    generalizationsFromParent.length > 0
      ? generalizationsFromParent
      : hasOwnParts
        ? [
            {
              id: currentVisibleNode.id,
              title:
                nodes[currentVisibleNode.id]?.title ??
                currentVisibleNode.title ??
                "Current",
            },
          ]
        : [];

  const [pickingFor, setPickingFor] = useState<string>("");
  const [anchorEl, setAnchorEl] = useState(null);
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const [approvingPendingIds, setApprovingPendingIds] = useState<Set<string>>(
    new Set(),
  );
  // Titles of just-approved parts, used as a fallback while the cloned node
  // hasn't loaded into relatedNodes yet (otherwise the new row shows blank).
  const [approvedTitles, setApprovedTitles] = useState<{ [id: string]: string }>(
    {},
  );
  const [loadingSpecializations, setLoadingSpecializations] = useState<
    Set<string>
  >(new Set());
  const [fetchedNodes, setFetchedNodes] = useState<{ [id: string]: INode }>({});
  const seenQueuedPendingIdsRef = useRef<Set<string>>(new Set());
  const [highlightedPendingIds, setHighlightedPendingIds] = useState<Set<string>>(
    new Set(),
  );

  // Merge nodes from props with locally fetched nodes
  const allNodes = { ...nodes, ...fetchedNodes };
  // Ids of parts already on this node — used to filter them out of the
  // dropdown options so the user can't pick a duplicate.
  const currentNodePartIdsSet = new Set<string>(
    currentVisibleNode.properties?.parts?.[0]?.nodes?.map(
      (n: { id: string }) => n.id,
    ) ?? [],
  );

  useEffect(() => {
    const currentQueuedIds = Object.keys(clonedNodesQueue || {});
    const previouslySeenIds = seenQueuedPendingIdsRef.current;
    const newlyQueuedIds = currentQueuedIds.filter((id) => !previouslySeenIds.has(id));

    seenQueuedPendingIdsRef.current = new Set(currentQueuedIds);

    setHighlightedPendingIds((prev) => {
      const next = new Set([...prev].filter((id) => currentQueuedIds.includes(id)));
      newlyQueuedIds.forEach((id) => next.add(id));
      return next;
    });

    if (newlyQueuedIds.length === 0) return;

    const clearHighlightTimeout = setTimeout(() => {
      setHighlightedPendingIds((prev) => {
        const next = new Set(prev);
        newlyQueuedIds.forEach((id) => next.delete(id));
        return next;
      });
    }, 1000);

    return () => {
      clearTimeout(clearHighlightTimeout);
    };
  }, [clonedNodesQueue]);

  const handleClose = () => {
    setAnchorEl(null);
    setPickingFor("");
  };

  const open = Boolean(anchorEl);
  const id = open ? "switch-popover" : undefined;

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
  }, [currentVisibleNode.id]);


  const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
    setActiveTab(newValue);
  };

  if (selectedProperty !== "parts" || generalizations.length <= 0) {
    return null;
  }

  const handleClick = (event: any, from: string) => {
    setAnchorEl(event.currentTarget);
    setPickingFor(from);
  };

  const formatPartTitle = (
    partId: string,
    isOptional: boolean,
    optionalChange?: "added" | "removed" | "none",
    fallbackTitle?: string,
  ) => {
    const title = allNodes[partId]?.title || fallbackTitle || "";

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

  // Handler to fetch missing specializations when dropdown opens
  const handleDropdownOpen = async (partNodeId: string) => {
    if (!fetchNode) return;

    const partNode = allNodes[partNodeId];
    if (!partNode) return;

    // Extract specialization IDs that aren't in cache yet
    const missingSpecIds: string[] = [];
    if (partNode.specializations) {
      partNode.specializations.forEach(
        (collection: { nodes: { id: string }[] }) => {
          collection.nodes.forEach((n: { id: string }) => {
            if (!allNodes[n.id]) {
              missingSpecIds.push(n.id);
            }
          });
        },
      );
    }

    // Check for missing generalizations as well
    const missingGenIds: string[] = [];
    if (partNode.generalizations) {
      partNode.generalizations.forEach(
        (collection: { nodes: { id: string }[] }) => {
          collection.nodes.forEach((n: { id: string }) => {
            if (!allNodes[n.id]) {
              missingGenIds.push(n.id);
            }
          });
        },
      );
    }

    const allMissingIds = [...missingSpecIds, ...missingGenIds];

    if (allMissingIds.length > 0) {
      setLoadingSpecializations((prev) => new Set([...prev, partNodeId]));

      try {
        // Fetch all missing nodes in parallel
        const fetchedNodesArray = await Promise.all(
          allMissingIds.map(async (id) => {
            const node = await fetchNode(id);
            return node ? { id, node } : null;
          }),
        );

        // Add fetched nodes to local state
        const newFetchedNodes: { [id: string]: INode } = {};
        fetchedNodesArray.forEach((result) => {
          if (result) {
            newFetchedNodes[result.id] = result.node;
          }
        });

        setFetchedNodes((prev) => ({ ...prev, ...newFetchedNodes }));

        // Register these nodes with parent for snapshot listeners
        if (addNodesToCache && Object.keys(newFetchedNodes).length > 0) {
          addNodesToCache(newFetchedNodes, currentVisibleNode.id);
        }
      } catch (error) {
        console.error("Error loading parts", error);
      } finally {
        setLoadingSpecializations((prev) => {
          const updated = new Set(prev);
          updated.delete(partNodeId);
          return updated;
        });
      }
    }
  };

  const handleSelect = async (option: string) => {
    const fromId = pickingFor;
    const activeGenId = activeTab;
    handleClose();

    try {
      if (!user?.uname || !fromId || !option || !activeGenId) return;

      // The current pick (oldTo) for this generalization part.
      const activeGen = inheritedPartsDetails?.find(
        (g) => g.generalizationId === activeGenId,
      );
      const xRow = activeGen?.details.find((d) => d.from === fromId && d.to);
      if (!xRow) return;

      const oldTo = xRow.to;
      const newTo = option;
      if (!oldTo || oldTo === newTo) return;
      const newToTitle = allNodes[newTo]?.title || xRow.toTitle || "";
      const oldToTitle = xRow.toTitle || allNodes[oldTo]?.title || "";

      const sourceParts: ICollection[] | undefined =
        currentVisibleNode.properties?.["parts"];
      if (!sourceParts?.[0]) return;

      // Swap the parts' positions so the picked part takes the old one's slot:
      // the generalization row stays put and only its right column flips.
      const updatedParts: ICollection[] = JSON.parse(
        JSON.stringify(sourceParts),
      );
      const partsNodes = updatedParts[0].nodes;
      const oldIdx = partsNodes.findIndex((n: any) => n.id === oldTo);
      const newIdx = partsNodes.findIndex((n: any) => n.id === newTo);
      if (oldIdx === -1 || newIdx === -1) return;
      const tmp = partsNodes[oldIdx];
      partsNodes[oldIdx] = partsNodes[newIdx];
      partsNodes[newIdx] = tmp;
      const newOrder: string[] = partsNodes.map((n: any) => n.id);

      // Update details locally for an instant switch; refetchNow reconciles.
      const updatedDetails: InheritedPartsDetail[] | null =
        inheritedPartsDetails
          ? JSON.parse(JSON.stringify(inheritedPartsDetails))
          : null;
      if (updatedDetails) {
        updatedDetails.forEach((gen, idx) => {
          // Keep createdAt a real Timestamp.
          const original: any = inheritedPartsDetails![idx]?.createdAt;
          if (original && typeof original.toMillis === "function") {
            gen.createdAt = original;
          } else {
            const seconds = original?._seconds ?? original?.seconds;
            const nanos =
              original?._nanoseconds ?? original?.nanoseconds ?? 0;
            gen.createdAt =
              typeof seconds === "number"
                ? new Timestamp(seconds, nanos)
                : Timestamp.now();
          }

          if (gen.generalizationId !== activeGenId) return;

          const row = gen.details.find(
            (d) => d.from === fromId && d.to === oldTo,
          );
          if (row) {
            row.to = newTo;
            row.toTitle = newToTitle;
            row.userOverride = true;
            row.symbol = row.from === row.to ? "=" : ">";
          }

          // Drop the row newTo already had, so it isn't listed twice.
          gen.details = gen.details.filter((d) => d === row || d.to !== newTo);

          // Give the displaced oldTo a "+" row so it keeps a row.
          if (!gen.details.some((d) => d.to === oldTo)) {
            gen.details.push({
              from: "",
              to: oldTo,
              symbol: "+",
              fromTitle: "",
              toTitle: oldToTitle,
              fromOptional: false,
              toOptional: false,
              optionalChange: "none",
              hops: 0,
            });
          }

          // Order rows by the new parts order, like the server does.
          gen.details.sort((a, b) => {
            const ia = newOrder.indexOf(a.to);
            const ib = newOrder.indexOf(b.to);
            return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
          });

          // Switch alternatives: drop newTo, offer oldTo as the way back.
          if (!gen.nonPickedOnes[fromId]) gen.nonPickedOnes[fromId] = [];
          gen.nonPickedOnes[fromId] = gen.nonPickedOnes[fromId].filter(
            (item) => item.id !== newTo,
          );
          gen.nonPickedOnes[fromId].push({ id: oldTo, title: oldToTitle });
        });
      }

      // Show it now, then persist and let the server decide.
      mutateInheritedPartsDetails?.(updatedDetails);
      await saveParts(updatedParts, updatedDetails);
      refetchNow?.();

      recordLogs({
        action: "switch to",
        field: "parts",
        from: fromId,
        oldTo,
        newTo,
        nodeId: currentVisibleNode?.id,
      });
    } catch (error: any) {
      console.error(error);
      recordLogs({
        type: "error",
        error: JSON.stringify({
          name: error?.name,
          message: error?.message,
          stack: error?.stack,
        }),
      });
    }
  };

  // onAddPart/onRemovePart/onReplacePart route through saveParts. Rows derive
  // from properties.parts, so they update at once; a new part shows a pending
  // spinner until the recompute fills its annotation.
  const onAddPart = (partId: string) => {
    addPart(partId);
  };

  const onRemovePart = (partId: string) => {
    removePart(partId);
  };

  const onReplacePart = async (oldPartId: string, newPartId: string) => {
    if (!oldPartId || !newPartId || oldPartId === newPartId) return;
    // The new id shows a pending row until the recompute fills its symbol;
    // refetch so it resolves promptly.
    await replaceWith(oldPartId, newPartId);
    refetchNow?.();
  };

  const onApprovePendingPart = async (queuedId: string, title: string) => {
    setApprovingPendingIds((prev) => {
      const updated = new Set(prev);
      updated.add(queuedId);
      return updated;
    });
    setApprovedTitles((prev) => ({ ...prev, [queuedId]: title }));
    try {
      await Promise.resolve(approvePendingPart?.(queuedId));
    } finally {
      setApprovingPendingIds((prev) => {
        const updated = new Set(prev);
        updated.delete(queuedId);
        return updated;
      });
    }
  };

  const toggleOptional = async (partId: string) => {
    try {
      if (!user?.uname || !partId) return;
      const sourceParts: ICollection[] | undefined =
        currentVisibleNode.properties?.["parts"];
      if (!sourceParts) return;

      // Flip optional on the part. Rows read optional live from properties.parts,
      // so the (o) badge updates as soon as saveParts runs.
      const updatedParts: ICollection[] = JSON.parse(
        JSON.stringify(sourceParts),
      );

      let newOptional = false;
      let found = false;
      for (const col of updatedParts) {
        const part = col.nodes.find((n: any) => n.id === partId);
        if (part) {
          part.optional = !part.optional;
          newOptional = !!part.optional;
          found = true;
          break;
        }
      }
      if (!found) return;

      // Save through saveParts (maintains isPartOf, logs, handles failure).
      saveParts(updatedParts);

      recordLogs({
        action: "toggle optional",
        field: "parts",
        partId,
        optional: newOptional,
        nodeId: currentVisibleNode?.id,
      });
    } catch (error: any) {
      console.error(error);
      recordLogs({
        type: "error",
        error: JSON.stringify({
          name: error?.name,
          message: error?.message,
          stack: error?.stack,
        }),
      });
    }
  };

  // Switch which generalization a part is inherited from: point the part's
  // `inheritedFrom` at that gen's owner and persist. The server honors the
  // choice, recomputes the overall ref (two sources => break) and cascades.
  const switchPartSource = (partId: string, genId: string) => {
    try {
      if (!partId || !genId) return;
      const genParts = allNodes[genId]?.properties?.parts?.[0]?.nodes || [];
      const genPart = genParts.find((n: any) => n.id === partId);
      if (!genPart) return;
      // Same rule as the server's childSourceOf.
      const owner = genPart.inheritedFrom || genId;

      const sourceParts: ICollection[] | undefined =
        currentVisibleNode.properties?.["parts"];
      if (!sourceParts?.[0]?.nodes) return;
      const updatedParts: ICollection[] = JSON.parse(
        JSON.stringify(sourceParts),
      );
      const target = updatedParts[0].nodes.find((n: any) => n.id === partId);
      if (!target || target.inheritedFrom === owner) return;
      target.inheritedFrom = owner;

      saveParts(updatedParts);

      recordLogs({
        action: "switch part source",
        field: "parts",
        partId,
        genId,
        owner,
        nodeId: currentVisibleNode?.id,
      });
    } catch (error: any) {
      console.error(error);
      recordLogs({
        type: "error",
        error: JSON.stringify({
          name: error?.name,
          message: error?.message,
          stack: error?.stack,
        }),
      });
    }
  };

  const getTabContent = (generalizationId: string): JSX.Element => {
    // Check if node has any parts at all
    const hasParts =
      currentVisibleNode.properties?.parts?.[0]?.nodes?.length > 0;

    // Computed first so the nodes with no parts can render pending rows too
    const pendingQueuedParts = Object.entries(clonedNodesQueue || {})
      // Hide a row the moment its checkmark is clicked: the approved part shows
      // up as its own row, so keeping this one would briefly double it.
      .filter(
        ([queuedId, queuedNode]) =>
          queuedNode?.property === "parts" &&
          !approvingPendingIds.has(queuedId),
      )
      .map(([queuedId, queuedNode]) => ({
        id: queuedId,
        title: queuedNode?.title || "",
      }));

    const pendingRowsList =
      pendingQueuedParts.length > 0 ? (
        <List sx={{ px: 1.8, py: 1, mt: -0.5 }}>
          {pendingQueuedParts.map((pendingPart) => {
            const isNewlyQueued = highlightedPendingIds.has(pendingPart.id);

            return (
              <ListItem
                key={`pending-${pendingPart.id}`}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 1,
                  py: 0.2,
                  borderRadius: "12px",
                  border: "1px dashed",
                  borderColor: (theme) =>
                    theme.palette.mode === "dark" ? "#5a5a5a" : "#c8c8c8",
                  mb: 0.5,
                  "@keyframes pendingPartHighlight": {
                    "0%": {
                      backgroundColor: "rgba(255, 165, 0, 0.32)",
                      boxShadow: "0 0 0 1px rgba(255, 165, 0, 0.45)",
                    },
                    "100%": {
                      backgroundColor: "transparent",
                      boxShadow: "0 0 0 0 rgba(255, 165, 0, 0)",
                    },
                  },
                  animation: isNewlyQueued
                    ? "pendingPartHighlight 1s ease-out"
                    : "none",
                }}
              >
                <ListItemText primary={null} sx={{ flex: 1, minWidth: 0.3 }} />
                <ListItemIcon sx={{ minWidth: "auto" }}>
                  <AddIcon sx={{ fontSize: 20, color: "orange" }} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box
                      sx={{ display: "flex", alignItems: "center", gap: 1 }}
                    >
                      <TextField
                        size="small"
                        value={pendingPart.title}
                        onChange={(e) =>
                          updatePendingPartTitle?.(
                            pendingPart.id,
                            e.target.value,
                          )
                        }
                        placeholder="New part title"
                        sx={{
                          flex: 1,
                          "& .MuiInputBase-root": {
                            borderRadius: "12px",
                          },
                        }}
                      />
                      {!!approvePendingPart && (
                        <Tooltip title={"Approve part"} placement="top">
                          <IconButton
                            sx={{ p: 0.5 }}
                            onClick={() => {
                              onApprovePendingPart(
                                pendingPart.id,
                                pendingPart.title,
                              );
                            }}
                          >
                            <CheckIcon
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
                      {!!cancelPendingPart && (
                        <Tooltip title={"Cancel part"} placement="top">
                          <IconButton
                            sx={{ p: 0.5 }}
                            onClick={() => {
                              cancelPendingPart(pendingPart.id);
                            }}
                          >
                            <CloseIcon
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
                    </Box>
                  }
                  // flex-basis reserves the width of the action-button column
                  // the rows above have, so the + stays aligned while the field
                  // (not an invisible icon) fills that space.
                  sx={{ flex: "1 1 36px", minWidth: 0.3 }}
                />
              </ListItem>
            );
          })}
        </List>
      ) : null;

    if (!hasParts) {
      if (pendingRowsList) {
        return <Box>{pendingRowsList}</Box>;
      }
      return (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            py: 2,
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: (theme) =>
                theme.palette.mode === "light" ? "#95a5a6" : "#7f8c8d",
              fontStyle: "italic",
              fontSize: "0.75rem",
            }}
          >
            No parts available
          </Typography>
        </Box>
      );
    }

    const cachedGeneralizationData = inheritedPartsDetails?.find(
      (calc) => calc.generalizationId === generalizationId,
    );

    if (!inheritedPartsDetails || !cachedGeneralizationData) {
      return (
        <Box>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 1,
              py: 2,
            }}
          >
            <SyncedSpinner size={16} />
            <Typography
              variant="body2"
              sx={{
                color: (theme) =>
                  theme.palette.mode === "light" ? "#95a5a6" : "#7f8c8d",
                fontStyle: "italic",
                fontSize: "0.75rem",
              }}
            >
              Loading...
            </Typography>
          </Box>
          {pendingRowsList}
        </Box>
      );
    }

    const details = cachedGeneralizationData.details || [];
    const nonPickedOnes = Object.entries(
      cachedGeneralizationData.nonPickedOnes || {},
    ).reduce(
      (acc, [key, value]) => {
        acc[key] = value.map((item) => item.id);
        return acc;
      },
      {} as { [key: string]: string[] },
    );
    // Rows come from the node's own parts, so edits show at once. details is
    // just an annotation lookup (from/symbol/switch options); a part with no
    // entry yet renders `pending`. optional/optionalChange are read live.
    const detailByTo = new Map<string, any>();
    for (const d of details) {
      if (d.to) detailByTo.set(d.to, d);
    }
    const draggableItems = (
      currentVisibleNode.properties?.parts?.[0]?.nodes ?? []
    ).map((partNode: any) => {
      const liveOptional = !!partNode.optional;
      const entry = detailByTo.get(partNode.id);
      if (entry) {
        const optionalChange = entry.from
          ? entry.fromOptional === liveOptional
            ? "none"
            : liveOptional
              ? "added"
              : "removed"
          : "none";
        return {
          ...entry,
          toOptional: liveOptional,
          optionalChange,
          pending: false,
          inheritedFrom: partNode.inheritedFrom,
        };
      }
      return {
        from: "",
        to: partNode.id,
        symbol: "",
        fromTitle: "",
        toTitle:
          allNodes[partNode.id]?.title ||
          partNode.title ||
          approvedTitles[partNode.id] ||
          "",
        fromOptional: false,
        toOptional: liveOptional,
        optionalChange: "none",
        hops: 0,
        pending: true,
        inheritedFrom: partNode.inheritedFrom,
      };
    });

    const partAlternativesLookup: {
      [partId: string]: {
        specs: { id: string; title: string }[];
        gens: { id: string; title: string }[];
      };
    } = {};

    // Calculate available dropdown options per part
    for (const entry of draggableItems) {
      if (partAlternativesLookup[entry.to]) continue;
      const node = allNodes[entry.to];
      const specs = (node?.specializations ?? [])
        .flatMap((c: { nodes: { id: string }[] }) => c.nodes)
        .filter((n: { id: string }) => !currentNodePartIdsSet.has(n.id))
        .map((n: { id: string }) => ({
          id: n.id,
          title: allNodes[n.id]?.title,
        }));
      const gens = (node?.generalizations ?? [])
        .flatMap((c: { nodes: { id: string }[] }) => c.nodes)
        .filter((n: { id: string }) => !currentNodePartIdsSet.has(n.id))
        .map((n: { id: string }) => ({
          id: n.id,
          title: allNodes[n.id]?.title,
        }));
      partAlternativesLookup[entry.to] = { specs, gens };
    }

    const nonDraggableItems = Object.keys(nonPickedOnes).filter((id) => {
      const index = details.findIndex((d) => d.from === id);
      return index === -1;
    });
    // Generalization parts the node hasn't inherited/added yet (annotation "x").
    // Surfaced as addable rows: no replace dropdown, a + button (no remove).
    const missingParts = details
      .filter((d) => d.symbol === "x" && d.from)
      .map((d) => d.from);
    const addableParts = Array.from(
      new Set<string>([...missingParts, ...nonDraggableItems]),
    );

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
                  key={entry.to}
                  draggableId={entry.to}
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
                                    title: allNodes[entry.from]?.title,
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
                                entry.optionalChange,
                                entry.fromTitle,
                              )}
                            </Typography>
                          ) : null
                        }
                        sx={{ flex: 1, minWidth: 0.3 }}
                      />

                      <ListItemIcon sx={{ minWidth: "auto" }}>
                        {entry.pending ? (
                          <Tooltip
                            title="Calculating inheritance for this part"
                            placement="top"
                          >
                            <SyncedSpinner size={18} />
                          </Tooltip>
                        ) : entry.symbol === "x" ? (
                          <CloseIcon sx={{ fontSize: 20, color: "orange" }} />
                        ) : entry.symbol === ">" ? (
                          <Tooltip
                            title={
                              (nonPickedOnes[entry.from] || []).length > 0
                                ? "Switch To"
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
                                cursor:
                                  (nonPickedOnes[entry.from] || []).length > 0
                                    ? "pointer"
                                    : "",
                              }}
                              onClick={(e) => {
                                if (
                                  (nonPickedOnes[entry.from] || []).length > 0
                                ) {
                                  handleClick(e, entry.from);
                                }
                              }}
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
                          <span
                            style={{
                              cursor: entry.pending
                                ? "not-allowed"
                                : undefined,
                              display: "inline-flex",
                            }}
                          >
                            <IconButton
                              sx={{ p: 0.5 }}
                              disabled={entry.pending}
                              onClick={() => {
                                onRemovePart(entry.to);
                              }}
                            >
                              <RemoveIcon
                                sx={{
                                  fontSize: 20,
                                  color: entry.pending
                                    ? "gray"
                                    : "red",
                                  border: entry.pending
                                    ? "1px solid gray"
                                    : "1px solid red",
                                  borderRadius: "50%",
                                  opacity: entry.pending
                                    ? 0.5
                                    : 1,
                                }}
                              />
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}

                      {entry.symbol === "x" && !!addPart && (
                        <Tooltip title={"Add Part"} placement="top">
                          <IconButton
                            sx={{ p: 0.5 }}
                            onClick={() => {
                              onAddPart(entry.from);
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

                      <Box
                        sx={{
                          flex: 1,
                          minWidth: 0,
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                        }}
                      >
                      <ListItemText
                        primary={
                          entry.to ? (
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              <Tooltip
                                title={
                                  entry.toOptional
                                    ? "Mark as required"
                                    : "Mark as optional"
                                }
                                placement="top"
                              >
                                <Box
                                  component="button"
                                  type="button"
                                  disabled={entry.pending}
                                  onMouseDown={(e: React.MouseEvent) => {
                                    e.stopPropagation();
                                  }}
                                  onClick={(e: React.MouseEvent) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleOptional(entry.to);
                                  }}
                                  sx={{
                                    cursor: entry.pending
                                      ? "not-allowed"
                                      : "pointer",
                                    "&:disabled": { opacity: 0.5 },
                                    textTransform: "none",
                                    fontSize: 12,
                                    fontWeight: entry.toOptional ? 700 : 600,
                                    color: entry.toOptional
                                      ? "#f2a43a"
                                      : (theme) =>
                                          theme.palette.mode === "light"
                                            ? "#111827"
                                            : "#f3f4f6",
                                    width: 28,
                                    height: 28,
                                    flexShrink: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    borderRadius: "50%",
                                    border: entry.toOptional
                                      ? "1px solid rgba(242, 164, 58, 0.55)"
                                      : (theme) =>
                                          theme.palette.mode === "light"
                                            ? "1px solid #d0d5dd"
                                            : "1px solid #3b3b3b",
                                    background: entry.toOptional
                                      ? (theme) =>
                                          theme.palette.mode === "light"
                                            ? "linear-gradient(180deg, #f8fafc 0%, #e8edf3 100%)"
                                            : "linear-gradient(180deg, #2b2f39 0%, #1d2129 100%)"
                                      : (theme) =>
                                          theme.palette.mode === "light"
                                            ? "linear-gradient(180deg, #ffffff 0%, #f3f5f8 100%)"
                                            : "linear-gradient(180deg, #17191f 0%, #101217 100%)",
                                    boxShadow: entry.toOptional
                                      ? (theme) =>
                                          theme.palette.mode === "light"
                                            ? "inset 0 0 0 1px rgba(242, 164, 58, 0.22)"
                                            : "inset 0 0 0 1px rgba(255, 187, 86, 0.16)"
                                      : "none",
                                    transition: "all 0.2s ease",
                                    "&:hover": {
                                      background: (theme) =>
                                        theme.palette.mode === "light"
                                          ? "rgba(15, 23, 42, 0.05)"
                                          : "rgba(255, 255, 255, 0.06)",
                                    },
                                  }}
                                >
                                  (o)
                                </Box>
                              </Tooltip>
                              <Tooltip
                                title={
                                  !isSelectOpen
                                    ? allNodes[entry.to]?.title || ""
                                    : ""
                                }
                                placement="top"
                                disableHoverListener={isSelectOpen}
                              >
                                <Select
                                  value={entry.to}
                                  disabled={entry.pending}
                                  onChange={(e) => {
                                    const newPartId = e.target.value;
                                    onReplacePart(entry.to, newPartId);
                                  }}
                                  onOpen={() => {
                                    setIsSelectOpen(true);
                                    handleDropdownOpen(entry.to);
                                  }}
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
                                      {allNodes[entry.to]?.title ||
                                        entry.toTitle}
                                    </Box>
                                  )}
                                  sx={{
                                    color: (theme) =>
                                      theme.palette.mode === "dark"
                                        ? "white"
                                        : "black",
                                    fontSize: "0.9rem",
                                    flex: 1,
                                    minWidth: 0,
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
                                  {loadingSpecializations.has(entry.to) && (
                                    <MenuItem disabled>
                                      <Box
                                        sx={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 1,
                                        }}
                                      >
                                        <SyncedSpinner size={16} />
                                        <Typography
                                          sx={{
                                            fontStyle: "italic",
                                            color: "gray",
                                            fontSize: "0.9rem",
                                          }}
                                        >
                                          Loading specializations...
                                        </Typography>
                                      </Box>
                                    </MenuItem>
                                  )}
                                  {(partAlternativesLookup[entry.to]?.specs
                                    .length ?? 0) > 0 && (
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
                                  {(partAlternativesLookup[entry.to]?.specs ?? []).map(
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

                                  {(partAlternativesLookup[entry.to]?.gens
                                    .length ?? 0) > 0 && (
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
                                  {(partAlternativesLookup[entry.to]?.gens ?? []).map(
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
                                  {/* Fallback when filtering has emptied both
                                      sections, so the menu isn't blank. */}
                                  {!loadingSpecializations.has(entry.to) &&
                                    (partAlternativesLookup[entry.to]?.specs
                                      .length ?? 0) === 0 &&
                                    (partAlternativesLookup[entry.to]?.gens
                                      .length ?? 0) === 0 && (
                                      <MenuItem
                                        disabled
                                        sx={{
                                          "&.Mui-disabled": { opacity: 1 },
                                        }}
                                      >
                                        <Typography
                                          sx={{
                                            fontStyle: "italic",
                                            fontSize: "0.9rem",
                                            color: (theme) =>
                                              theme.palette.mode === "light"
                                                ? "#555"
                                                : "#cfcfcf",
                                          }}
                                        >
                                          No alternatives available
                                        </Typography>
                                      </MenuItem>
                                    )}
                                </Select>
                              </Tooltip>
                            </Box>
                          ) : null
                        }
                        sx={{ flex: 1, minWidth: 0.3 }}
                      />

                      {/* Source switch — lives inside the `to` half so the middle
                          symbol never moves; only shows when 2+ gens provide the
                          part. Persists via saveParts (the server honors it). */}
                      {(() => {
                        const sources = getPartGeneralizationSources(
                          entry.to,
                          generalizations,
                          allNodes,
                        );
                        if (sources.length < 2) return null;
                        // Mirrors the server's childSourceOf: the owner this part
                        // gets when tracked through `genId`.
                        const ownerVia = (genId: string) => {
                          const gp = (
                            allNodes[genId]?.properties?.parts?.[0]?.nodes || []
                          ).find((n: any) => n.id === entry.to);
                          return gp?.inheritedFrom || genId;
                        };
                        const current =
                          sources.find(
                            (s) =>
                              ownerVia(s.generalizationId) ===
                              entry.inheritedFrom,
                          )?.generalizationId ?? sources[0]?.generalizationId;
                        return (
                          <Tooltip title="Inherited from" placement="top">
                            <Select
                              size="small"
                              value={current}
                              onMouseDown={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                switchPartSource(
                                  entry.to,
                                  e.target.value as string,
                                )
                              }
                              sx={{
                                flexShrink: 0,
                                minWidth: 120,
                                maxWidth: 150,
                                height: 30,
                                fontSize: 12,
                                borderRadius: "12px",
                              }}
                            >
                              {sources.map((s) => (
                                <MenuItem
                                  key={s.generalizationId}
                                  value={s.generalizationId}
                                  sx={{ fontSize: 12 }}
                                >
                                  {s.generalizationTitle}
                                </MenuItem>
                              ))}
                            </Select>
                          </Tooltip>
                        );
                      })()}
                      </Box>
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
          disableRestoreFocus
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
                  primary={allNodes[option]?.title}
                  onClick={() => handleSelect(option)}
                />
              </ListItem>
            ))}
          </List>
        </Popover>
        {addableParts.length > 0 && (
          <List sx={{ px: 1.8, py: 1, mt: -0.5 }}>
            {addableParts.map((entryFrom: string, index: number) => (
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
                  <Tooltip title={"Add Part"} placement="top">
                    <IconButton
                      sx={{ p: 0.5 }}
                      onClick={() => {
                        onAddPart(entryFrom);
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
        {pendingRowsList}
      </Box>
    );
  };

  const activeGeneralization = generalizations.find((g) => g.id === activeTab);
  const activeGenId = activeGeneralization?.id;
  const activeGenTitle = activeGeneralization?.title;
  // Only turn the arrow into a spinner when rows are actually showing. If the
  // active gen has no details yet, the tab body shows its own "Loading…", so a
  // second spinner here would be redundant.
  const showRecomputeSpinner =
    !!inheritedPartsLoading &&
    !!inheritedPartsDetails?.some((c) => c.generalizationId === activeGenId);
  const handleSorting = (e: any) => {
    try {
      // draggableId === the part id (see the Draggable above).
      const { source, destination, draggableId } = e;
      // No destination, or dropped back in the same spot: nothing to persist.
      if (
        !destination ||
        !user?.uname ||
        destination.index === source?.index
      ) {
        return;
      }

      /* these have index 0 by default since parts don't have collections but that may change in the future */
      const sourceCollectionIndex = 0;
      const destinationCollectionIndex = 0;

      const source_ = currentVisibleNode.properties?.["parts"];
      if (!source_) return;

      // Work on a clone so we never mutate the live node state in place.
      const newParts: ICollection[] = JSON.parse(JSON.stringify(source_));

      const nodeIdx = newParts[sourceCollectionIndex].nodes.findIndex(
        (link: ILinkNode) => link.id === draggableId,
      );

      if (nodeIdx !== -1) {
        const moveValue = newParts[sourceCollectionIndex].nodes[nodeIdx];
        newParts[sourceCollectionIndex].nodes.splice(nodeIdx, 1);
        newParts[destinationCollectionIndex].nodes.splice(
          destination.index,
          0,
          moveValue,
        );
      }

      // Persist the reordered parts through the shared saveParts.
      saveParts(newParts);

      recordLogs({
        action: "sort elements",
        field: "parts",
        sourceCategory: "main",
        destinationCategory: "main",
        nodeId: currentVisibleNode?.id,
      });
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

      <GeneralizationTabs
        generalizations={generalizations}
        activeTab={activeTab}
        onChange={handleTabChange}
      />

      {activeGeneralization && activeGenId && activeGenTitle && (
        <Box key={activeGenId}>
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
              <Tooltip title={activeGenTitle}>
                <Typography
                  sx={{
                    color: "orange",
                    fontWeight: "bold",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {activeGenTitle}
                </Typography>
              </Tooltip>
            </Box>

            <Box
              sx={{
                position: "absolute",
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                height: "50px",
                width: showRecomputeSpinner ? "auto" : "50px",
                whiteSpace: "nowrap",
              }}
            >
              {/* Spinner + label while the gen→node mapping recomputes. */}
              {showRecomputeSpinner ? (
                <>
                  <SyncedSpinner size={20} />
                  <Typography
                    sx={{
                      fontSize: "0.8rem",
                      fontWeight: "bold",
                      fontStyle: "italic",
                      color: "orange",
                    }}
                  >
                    Generating inheritance…
                  </Typography>
                </>
              ) : (
                <ArrowRightAltIcon sx={{ color: "orange", fontSize: "50px" }} />
              )}
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
            {getTabContent(activeGenId)}
          </DragDropContext>
        </Box>
      )}

      <InheritedPartsLegend
        legendItems={[
          { symbol: "(o)", description: "Optional" },
          { symbol: "=", description: "No Change" },
          { symbol: ">", description: "Specialized Part" },
          { symbol: "x", description: "Part not Inherited" },
          { symbol: "+", description: "Part Added" },
        ]}
      />
    </Box>
  );
};

export default InheritedPartsViewerEdit;
