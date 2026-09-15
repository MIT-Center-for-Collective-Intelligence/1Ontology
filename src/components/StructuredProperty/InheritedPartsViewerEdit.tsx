import React, { useEffect, useMemo, useRef, useState } from "react";
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
  alpha,
} from "@mui/material";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import {
  ICollection,
  InheritedPartsDetail,
  ILinkNode,
  INode,
} from "@components/types/INode";
import ArrowRightAltIcon from "@mui/icons-material/ArrowRightAlt";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SearchIcon from "@mui/icons-material/Search";
import CheckIcon from "@mui/icons-material/Check";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";

import AddIcon from "@mui/icons-material/Add";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import DragHandleIcon from "@mui/icons-material/DragHandle";
import CloseIcon from "@mui/icons-material/Close";
import InheritedPartsLegend from "../Common/InheritedPartsLegend";
import PartOrderSeparator, {
  ORDER_INHERITANCE_ICON_GUTTER,
} from "../Common/PartOrderSeparator";
import PartInheritanceModeButton, {
  InheritanceMode,
} from "../Common/PartInheritanceModeButton";

/** Fixed width for = / > / x / + so symbols stay in one column. */
const SYMBOL_COL_SX = {
  minWidth: 28,
  width: 28,
  justifyContent: "center",
  display: "flex",
  alignItems: "center",
} as const;

import { Timestamp } from "firebase/firestore";
import { recordLogs } from "@components/lib/utils/helpers";
import { Post } from "@components/lib/utils/Post";
import {
  computeOrderInheritanceForGen,
  getPartGeneralizationSources,
  separatorInheritsOrder,
} from "@components/lib/utils/partsHelper";
import { makeResolvedOf } from "@components/lib/hooks/useResolvedParts";
import SyncedSpinner from "@components/components/SyncedSpinner";
import { DESIGN_SYSTEM_COLORS } from "@components/lib/theme/colors";

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
  resolvedParts: ILinkNode[];
  setDisplayDetails: any;
  enableEdit: boolean;
  replaceWith: any;
  sortParts: (
    orderedIds: string[],
    inheritedPartsDetails?: InheritedPartsDetail[] | null,
  ) => Promise<void>;
  switchPartSource: (partId: string, genId: string) => Promise<void>;
  addPartFromGen: (partId: string, genId?: string) => Promise<void>;
  togglePartOptional: (partId: string, optional: boolean) => Promise<void>;
  savingPartIds: Set<string>;
  user: any;
  appName?: string;
  navigateToNode?: any;
  triggerSearch?: any;
  addPart?: any;
  removePart?: any;
  inheritedPartsDetails?: InheritedPartsDetail[] | null;
  inheritedPartsRepairing?: boolean;
  mutateInheritedPartsDetails?: (
    newData: InheritedPartsDetail[] | null,
  ) => void;
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
  sortParts,
  switchPartSource,
  addPartFromGen,
  togglePartOptional,
  savingPartIds,
  currentVisibleNode,
  resolvedParts,
  triggerSearch,
  addPart,
  removePart,
  user,
  navigateToNode,
  setDisplayDetails,
  appName,
  inheritedPartsDetails,
  inheritedPartsRepairing,
  mutateInheritedPartsDetails,
  clonedNodesQueue,
  approvePendingPart,
  cancelPendingPart,
  updatePendingPartTitle,
}) => {
  const [activeTab, setActiveTab] = React.useState<string | null>(null);
  const generalizationsFromParent: GeneralizationNode[] =
    getAllGeneralizations();

  // Root node: no generalizations, but may have own parts. Treat current node as its own
  // "generalization" so parts can still be displayed, but hide the left-side label.
  const hasOwnParts = resolvedParts.length > 0;
  // True when the node has no real generalizations (it is a root).
  const isRootNode = generalizationsFromParent.length === 0;
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
  const defaultPartInheritanceMode: InheritanceMode =
    (currentVisibleNode.inheritance?.parts?.inheritanceType as
      | InheritanceMode
      | undefined) ?? "inheritUnlessAlreadyOverRidden";
  const [partInheritanceModes, setPartInheritanceModes] = useState<{
    [partId: string]: InheritanceMode;
  }>(currentVisibleNode.partInheritanceModes || {});

  useEffect(() => {
    if (currentVisibleNode.partInheritanceModes) {
      setPartInheritanceModes(currentVisibleNode.partInheritanceModes);
    }
  }, [currentVisibleNode.id, currentVisibleNode.partInheritanceModes]);

  const getPartInheritanceMode = (partId: string): InheritanceMode =>
    partInheritanceModes[partId] ?? defaultPartInheritanceMode;
  const setPartInheritanceMode = (partId: string, mode: InheritanceMode) => {
    setPartInheritanceModes((prev) => ({ ...prev, [partId]: mode }));
  };

  const [orderInheritanceModes, setOrderInheritanceModes] = useState<{
    [orderId: string]: InheritanceMode;
  }>({});

  const getOrderInheritanceMode = (orderId: string): InheritanceMode =>
    orderInheritanceModes[orderId] ?? defaultPartInheritanceMode;

  const setOrderInheritanceMode = (orderId: string, mode: InheritanceMode) => {
    setOrderInheritanceModes((prev) => ({ ...prev, [orderId]: mode }));
  };
  const [approvingPendingIds, setApprovingPendingIds] = useState<Set<string>>(
    new Set(),
  );
  const [hoveredPartIndex, setHoveredPartIndex] = useState<number | null>(null);
  // Titles of just-approved parts, used as a fallback while the cloned node
  // hasn't loaded into relatedNodes yet (otherwise the new row shows blank).
  const [approvedTitles, setApprovedTitles] = useState<{
    [id: string]: string;
  }>({});
  const [loadingSpecializations, setLoadingSpecializations] = useState<
    Set<string>
  >(new Set());
  const [fetchedNodes, setFetchedNodes] = useState<{ [id: string]: INode }>({});
  const seenQueuedPendingIdsRef = useRef<Set<string>>(new Set());
  const [highlightedPendingIds, setHighlightedPendingIds] = useState<
    Set<string>
  >(new Set());

  // Merge nodes from props with locally fetched nodes
  const allNodes = { ...nodes, ...fetchedNodes };
  // Gen part lists resolve through the ref chain, like the rows themselves.
  const resolvedOf = useMemo(
    () => makeResolvedOf({ ...nodes, ...fetchedNodes }),
    [nodes, fetchedNodes],
  );
  // Ids of parts already on this node — used to filter them out of the
  // dropdown options so the user can't pick a duplicate.
  const currentNodePartIdsSet = new Set<string>(resolvedParts.map((n) => n.id));

  useEffect(() => {
    const currentQueuedIds = Object.keys(clonedNodesQueue || {});
    const previouslySeenIds = seenQueuedPendingIdsRef.current;
    const newlyQueuedIds = currentQueuedIds.filter(
      (id) => !previouslySeenIds.has(id),
    );

    seenQueuedPendingIdsRef.current = new Set(currentQueuedIds);

    setHighlightedPendingIds((prev) => {
      const next = new Set(
        [...prev].filter((id) => currentQueuedIds.includes(id)),
      );
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
            +*
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
            *
          </Box>
        </Box>
      );
    } else if (isOptional) {
      return (
        <Box component="span" sx={{ display: "inline" }}>
          {title}{" "}
          <Box component="span" sx={{ color: "#ff9500", fontWeight: "bold" }}>
            *
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
    99;
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

      // Swap the parts' positions in the RESOLVED view so the picked part
      // takes the old one's slot: the generalization row stays put and only
      // its right column flips.
      const newOrder: string[] = resolvedParts.map((p: ILinkNode) => p.id);
      const oldIdx = newOrder.indexOf(oldTo);
      const newIdx = newOrder.indexOf(newTo);
      if (oldIdx === -1 || newIdx === -1) return;
      newOrder[oldIdx] = newTo;
      newOrder[newIdx] = oldTo;

      // Update details locally for an instant switch; the endpoint's fresh
      // annotation write reconciles.
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
            const nanos = original?._nanoseconds ?? original?.nanoseconds ?? 0;
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

      // The swap changes positions only, membership and sources stay.
      // So it persists through the SORT endpoint, which
      // applies the usual reorder rules. The patched details ride along so
      // the user's pick survives a recompute.
      mutateInheritedPartsDetails?.(updatedDetails);
      await sortParts(newOrder, updatedDetails);

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

  // Rows derive from the resolved view, so they update at once; a new part
  // shows no symbol until the endpoint's annotation write lands.
  const onAddPart = (partId: string) => {
    addPart(partId);
  };

  const onRemovePart = (partId: string) => {
    removePart(partId);
  };

  const onReplacePart = async (oldPartId: string, newPartId: string) => {
    if (!oldPartId || !newPartId || oldPartId === newPartId) return;
    if (inheritedPartsDetails) {
      const updated: InheritedPartsDetail[] = JSON.parse(
        JSON.stringify(inheritedPartsDetails),
      );
      for (const gen of updated) {
        const row = gen.details.find((d) => d.to === oldPartId);
        if (row) {
          row.to = newPartId;
          row.toTitle = allNodes[newPartId]?.title || row.toTitle || "";
          row.symbol = row.from === newPartId ? "=" : ">";
        }
      }
      mutateInheritedPartsDetails?.(updated);
    }
    await replaceWith(oldPartId, newPartId);
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
      // Rows read optional live from the resolved view, so the (o) badge
      // updates as soon as the instant patch lands.
      const current = resolvedParts.find((n) => n.id === partId);
      if (!current) return;
      const newOptional = !current.optional;

      togglePartOptional(partId, newOptional);

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

  const getTabContent = (generalizationId: string): JSX.Element => {
    const genTitle =
      generalizations.find((g) => g.id === generalizationId)?.title ?? "";
    // Check if node has any parts at all
    const hasParts = resolvedParts.length > 0;

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
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
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

    // No annotation for this gen yet: rows still render from the resolved
    // view, just without symbols, until the silent repair fills them in.
    const cachedGeneralizationData = inheritedPartsDetails?.find(
      (calc) => calc.generalizationId === generalizationId,
    );

    const details = cachedGeneralizationData?.details || [];
    const nonPickedOnes = Object.entries(
      cachedGeneralizationData?.nonPickedOnes || {},
    ).reduce(
      (acc, [key, value]) => {
        acc[key] = value.map((item) => item.id);
        return acc;
      },
      {} as { [key: string]: string[] },
    );
    // Rows come from the RESOLVED parts view, so edits show at once. details
    // is just an annotation lookup (from/symbol/switch options); a part with
    // no entry yet spins until the annotation covers it. optional/
    // optionalChange are read live.
    const detailByTo = new Map<string, any>();
    for (const d of details) {
      if (d.to) detailByTo.set(d.to, d);
    }
    const draggableItems = resolvedParts.map((partNode: any) => {
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
          inheritedFrom: partNode.inheritedFrom,
          via: partNode.via,
        };
      }
      const isInheritedFromThisGen =
        partNode.inheritedFrom === generalizationId ||
        partNode.via === generalizationId;
      return {
        from: isInheritedFromThisGen ? partNode.id : "",
        to: partNode.id,
        symbol: isInheritedFromThisGen ? "=" : "+",
        fromTitle: isInheritedFromThisGen
          ? allNodes[partNode.id]?.title || partNode.title || ""
          : "",
        toTitle:
          allNodes[partNode.id]?.title ||
          partNode.title ||
          approvedTitles[partNode.id] ||
          "",
        fromOptional: isInheritedFromThisGen
          ? Boolean(
              resolvedOf(generalizationId)?.find(
                (p: any) => p.id === partNode.id,
              )?.optional,
            )
          : false,
        toOptional: liveOptional,
        optionalChange: "none",
        hops: 0,
        pending: Boolean(inheritedPartsRepairing),
        inheritedFrom: partNode.inheritedFrom,
        via: partNode.via,
      };
    });
    const orderInheritance = computeOrderInheritanceForGen(
      resolvedParts,
      generalizationId,
      genTitle,
      resolvedOf,
      details,
    );

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

    // Per part: the generalizations it can be specifically inherited from,
    // each resolved to the owner it would record (skips a pass-through gen).
    const partSourcesLookup: {
      [partId: string]: { genId: string; title: string; owner: string }[];
    } = {};
    for (const entry of draggableItems) {
      if (partSourcesLookup[entry.to]) continue;
      partSourcesLookup[entry.to] = getPartGeneralizationSources(
        entry.to,
        generalizations,
        allNodes,
      ).map((s) => {
        const genPart = resolvedOf(s.generalizationId).find(
          (n) => n.id === entry.to,
        );
        return {
          genId: s.generalizationId,
          title: s.generalizationTitle,
          owner: genPart?.inheritedFrom || s.generalizationId,
        };
      });
    }

    // The source a part currently resolves to: the picked gen (via) if it's
    // still a valid source, else the overall source, else the first match.
    const getCurrentSource = (entry: any) => {
      const sources = partSourcesLookup[entry.to] ?? [];
      const matching = sources
        .filter((s) => s.owner === entry.inheritedFrom)
        .map((s) => s.genId);
      const overallSource = currentVisibleNode.partsInheritance?.source ?? "";
      const currentGenId =
        entry.via && sources.some((s) => s.genId === entry.via)
          ? entry.via
          : matching.includes(overallSource)
            ? overallSource
            : matching[0];
      return sources.find((s) => s.genId === currentGenId);
    };

    const nonDraggableItems = Object.keys(nonPickedOnes).filter((id) => {
      const index = details.findIndex((d) => d.from === id);
      return index === -1;
    });

    // Parts the generalization has but this node did not inherit.
    // They have no own-part row, so the draggable list above skips them
    const notInheritedItems = details.filter(
      (d: any) => d.symbol === "x" && !currentNodePartIdsSet.has(d.from),
    );

    // "x" rows render in their own lists right below the draggable one; the
    // draggable list drops its bottom padding then so they read as one list.
    const hasTrailingXRows =
      notInheritedItems.length > 0 || nonDraggableItems.length > 0;

    // Shared styling for both part dropdowns' menus.
    const menuPaperSx = {
      mt: 0.5,
      borderRadius: "14px",
      boxShadow: (theme: any) =>
        theme.palette.mode === "dark"
          ? "0 14px 34px rgba(0, 0, 0, 0.6)"
          : "0 14px 34px rgba(15, 23, 42, 0.16)",
      overflow: "hidden",
      "&::-webkit-scrollbar": { display: "none" },
    };
    const menuTitleSx = {
      color: "text.primary",
      fontSize: "1.1rem",
      fontWeight: 700,
      lineHeight: 1.5,
      px: 1.75,
      pt: 2,
      pb: 1.75,
      backgroundColor: (theme: any) =>
        theme.palette.mode === "dark"
          ? "rgba(0, 0, 0, 0.45)"
          : "rgba(15, 23, 42, 0.14)",
    };

    const sectionHeaderSx = {
      color: "text.secondary",
      fontSize: "0.78rem",
      fontWeight: 700,
      letterSpacing: "0.09em",
      textTransform: "uppercase",
      lineHeight: 2.2,
      px: 1.75,
      backgroundColor: (theme: any) => theme.palette.background.paper,
    };
    const optionItemSx = {
      display: "flex",
      gap: 1,
      mx: "10px",
      my: "6px",
      px: 1.5,
      py: 0.9,
      borderRadius: "10px",
      border: "1px solid rgba(242, 164, 58, 0.4)",
      transition: "background-color 0.15s ease, border-color 0.15s ease",
      "&:hover": {
        backgroundColor: (theme: any) =>
          theme.palette.mode === "dark"
            ? "rgba(242, 164, 58, 0.1)"
            : "rgba(242, 164, 58, 0.08)",
        borderColor: "#f2a43a",
      },
      "&.Mui-selected, &.Mui-selected:hover": {
        backgroundColor: (theme: any) =>
          theme.palette.mode === "dark"
            ? "rgba(242, 164, 58, 0.14)"
            : "rgba(242, 164, 58, 0.12)",
        borderColor: "#f2a43a",
      },
    };
    // The already-inherited source: disabled (can't re-pick it) but emphasized
    // with a filled accent and a solid orange outline, floated to the top.
    const currentSourceItemSx = {
      ...optionItemSx,
      cursor: "default",
      fontWeight: 700,
      backgroundColor: (theme: any) =>
        theme.palette.mode === "dark"
          ? "rgba(242, 164, 58, 0.16)"
          : "rgba(242, 164, 58, 0.14)",
      borderColor: "#f2a43a",
      "&.Mui-disabled": { opacity: 1 },
    };
    const emptyStateSx = {
      justifyContent: "center",
      "&.Mui-disabled": { opacity: 1 },
    };
    const emptyTextSx = {
      fontStyle: "italic",
      fontSize: "0.95rem",
      color: "text.disabled",
    };
    const rowHeightSpacer = (
      <Select
        value=""
        displayEmpty
        disabled
        size="small"
        aria-hidden
        renderValue={() => <Box>{"\u00A0"}</Box>}
        sx={{
          visibility: "hidden",
          fontSize: "0.9rem",
          minWidth: 0,
          borderRadius: "15px",
        }}
      />
    );

    return (
      <Box
        sx={{
          border: (theme) =>
            draggableItems.length > 0
              ? `1px dashed ${alpha(theme.palette.divider, theme.palette.mode === "dark" ? 0.55 : 0.85)}`
              : "none",
          borderRadius: "16px",
          py: 1,
          px: 1.5,
          my: 1.5,
          backgroundColor: (theme) =>
            draggableItems.length > 0
              ? alpha(
                  theme.palette.common.white,
                  theme.palette.mode === "dark" ? 0.02 : 0.4,
                )
              : "transparent",
        }}
      >
        <Droppable droppableId={`droppable-${generalizationId}`}>
          {(provided) => (
            <List
              dense
              disablePadding
              ref={provided.innerRef}
              {...provided.droppableProps}
              sx={{
                px: 1,
                py: 0,
                pb: hasTrailingXRows ? 0 : undefined,
              }}
            >
              {draggableItems.map((entry: any, index: number) => {
                const prevEntry = index > 0 ? draggableItems[index - 1] : null;
                const inheritsOrder =
                  index !== 0 &&
                  separatorInheritsOrder(prevEntry, entry, orderInheritance);
                return (
                  <Draggable
                    key={entry.to}
                    draggableId={entry.to}
                    index={index}
                  >
                    {(providedDraggable) => {
                      return (
                        <ListItem
                          dense
                          disableGutters
                          ref={providedDraggable.innerRef}
                          {...providedDraggable.draggableProps}
                          sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "stretch",
                            gap: 0,
                            px: 0,
                            py: 0,
                            minHeight: 0,
                            overflow: "visible",
                          }}
                        >
                          {index !== 0 ? (
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                width: "100%",
                                minHeight: 0,
                                height: "auto",
                                py: 0,
                                px: 1,
                                overflow: "visible",
                              }}
                            >
                              <PartOrderSeparator
                                inheritsOrder={inheritsOrder}
                                orderMode={getOrderInheritanceMode(
                                  entry.to || entry.from,
                                )}
                                onChangeOrderMode={(mode) =>
                                  setOrderInheritanceMode(
                                    entry.to || entry.from,
                                    mode,
                                  )
                                }
                                disabled={savingPartIds.has(
                                  entry.to || entry.from,
                                )}
                                forceShowIcons={
                                  hoveredPartIndex === index ||
                                  hoveredPartIndex === index - 1
                                }
                                noGeneralizations={isRootNode}
                              />
                            </Box>
                          ) : null}
                          <Box
                            {...providedDraggable.dragHandleProps}
                            onMouseEnter={() => setHoveredPartIndex(index)}
                            onMouseLeave={() => setHoveredPartIndex(null)}
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                              width: "100%",
                              py: 0.25,
                              pl: 1,
                              pr: 1,
                              minHeight: 0,
                              boxSizing: "border-box",
                              "&:hover .part-remove-button, &:focus-within .part-remove-button":
                                {
                                  opacity: 1,
                                  pointerEvents: "auto",
                                },
                            }}
                          >
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 0.5,
                                flex: 1,
                                minWidth: 0,
                              }}
                            >
                              {!readOnly &&
                                entry.from &&
                                entry.symbol !== "x" &&
                                entry.symbol !== "=" && (
                                  <ListItemIcon sx={{ minWidth: "auto" }}>
                                    <Tooltip
                                      title="Search it below"
                                      placement="left"
                                    >
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
                                        Boolean(
                                          entry.fromOptional ??
                                          resolvedOf(generalizationId)?.find(
                                            (p: any) => p.id === entry.from,
                                          )?.optional,
                                        ),
                                        "none",
                                        entry.fromTitle,
                                      )}
                                    </Typography>
                                  ) : null
                                }
                                sx={{ flex: 1, minWidth: 0, my: 0 }}
                              />
                            </Box>

                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 0.5,
                                flexShrink: 0,
                                px: 0.5,
                              }}
                            >
                              {!!removePart && entry.symbol !== "x" && (
                                <Tooltip title={"Remove part"} placement="top">
                                  <Box
                                    component="span"
                                    className="part-remove-button"
                                    sx={{
                                      cursor: savingPartIds.has(entry.to)
                                        ? "not-allowed"
                                        : undefined,
                                      display: "inline-flex",
                                      opacity: 0,
                                      pointerEvents: "none",
                                      transition: "opacity 0.2s ease-in-out",
                                      "&:focus-within": {
                                        opacity: 1,
                                        pointerEvents: "auto",
                                      },
                                    }}
                                  >
                                    <IconButton
                                      sx={{ p: 0.5 }}
                                      disabled={savingPartIds.has(entry.to)}
                                      onClick={() => {
                                        onRemovePart(entry.to);
                                      }}
                                    >
                                      <DeleteOutlineIcon
                                        sx={{
                                          fontSize: 20,
                                          color: savingPartIds.has(entry.to)
                                            ? "gray"
                                            : "red",
                                          opacity: savingPartIds.has(entry.to)
                                            ? 0.5
                                            : 1,
                                        }}
                                      />
                                    </IconButton>
                                  </Box>
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

                              <ListItemIcon sx={SYMBOL_COL_SX}>
                                {savingPartIds.has(entry.to) ? (
                                  <Tooltip
                                    title="Linking this part…"
                                    placement="top"
                                  >
                                    <span
                                      style={{
                                        display: "inline-flex",
                                        cursor: "default",
                                      }}
                                    >
                                      <SyncedSpinner size={18} />
                                    </span>
                                  </Tooltip>
                                ) : entry.pending ? (
                                  <Tooltip
                                    title="Calculating inheritance…"
                                    placement="top"
                                  >
                                    <span
                                      style={{
                                        display: "inline-flex",
                                        cursor: "default",
                                      }}
                                    >
                                      <SyncedSpinner size={18} />
                                    </span>
                                  </Tooltip>
                                ) : entry.symbol === "x" ? (
                                  <Tooltip
                                    title={`"${genTitle}" has this part, but this node does not inherit it.`}
                                    placement="top"
                                  >
                                    <CloseIcon
                                      sx={{ fontSize: 20, color: "orange" }}
                                    />
                                  </Tooltip>
                                ) : entry.symbol === ">" ? (
                                  <Tooltip
                                    title={`"${genTitle}" has the part "${
                                      allNodes[entry.from]?.title ||
                                      entry.fromTitle ||
                                      ""
                                    }". This node has "${
                                      allNodes[entry.to]?.title ||
                                      entry.toTitle ||
                                      ""
                                    }", a descendant of it.${
                                      (nonPickedOnes[entry.from] || []).length >
                                      0
                                        ? " Click to switch."
                                        : ""
                                    }`}
                                    placement="top"
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
                                            : (nonPickedOnes[entry.from] || [])
                                                  .length > 0
                                              ? (theme) =>
                                                  theme.palette.mode === "light"
                                                    ? "#a8a8a8"
                                                    : "#4a4646"
                                              : "",
                                        p: 0.2,
                                        borderRadius: "50%",
                                        ":hover":
                                          (nonPickedOnes[entry.from] || [])
                                            .length > 0
                                            ? {
                                                backgroundColor: "gray",
                                              }
                                            : {},
                                        cursor:
                                          (nonPickedOnes[entry.from] || [])
                                            .length > 0
                                            ? "pointer"
                                            : "",
                                      }}
                                      onClick={(e) => {
                                        if (
                                          (nonPickedOnes[entry.from] || [])
                                            .length > 0
                                        ) {
                                          handleClick(e, entry.from);
                                        }
                                      }}
                                    />
                                  </Tooltip>
                                ) : entry.symbol === "=" ? (
                                  <Tooltip
                                    title={`This part is inherited from "${genTitle}". If it changes there, it changes here too.`}
                                    placement="top"
                                  >
                                    <DragHandleIcon
                                      sx={{
                                        fontSize: 20,
                                        color: "orange",
                                        visibility:
                                          !entry.inheritedFrom ||
                                          (getCurrentSource(entry)?.genId ??
                                            generalizationId) ===
                                            generalizationId
                                            ? "visible"
                                            : "hidden",
                                      }}
                                    />
                                  </Tooltip>
                                ) : entry.symbol === "+" ? (
                                  <Tooltip
                                    title={`This part was added directly to this node. "${genTitle}" does not have it, so it is not inherited.`}
                                    placement="top"
                                  >
                                    <AddIcon
                                      sx={{ fontSize: 20, color: "orange" }}
                                    />
                                  </Tooltip>
                                ) : null}
                              </ListItemIcon>

                              {entry.to ? (
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
                                    disabled={savingPartIds.has(entry.to)}
                                    onMouseDown={(e: React.MouseEvent) => {
                                      e.stopPropagation();
                                    }}
                                    onClick={(e: React.MouseEvent) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      toggleOptional(entry.to);
                                    }}
                                    sx={{
                                      cursor: savingPartIds.has(entry.to)
                                        ? "not-allowed"
                                        : "pointer",
                                      "&:disabled": { opacity: 0.5 },
                                      textTransform: "none",
                                      fontSize: "0.8125rem",
                                      fontFamily:
                                        "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                                      letterSpacing: "-0.03em",
                                      lineHeight: 1,
                                      fontWeight: 700,
                                      color: entry.toOptional
                                        ? DESIGN_SYSTEM_COLORS.orange250
                                        : (theme) =>
                                            theme.palette.mode === "light"
                                              ? "#111827"
                                              : "#797b7dff",
                                      width: 23,
                                      height: 23,
                                      flexShrink: 0,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      borderRadius: "50%",
                                      border: entry.toOptional
                                        ? "1.5px solid #f2a43a"
                                        : (theme) =>
                                            theme.palette.mode === "light"
                                              ? "1px solid #9ca3af"
                                              : "1px solid rgba(255, 255, 255, 0.45)",
                                      background: "transparent",
                                      boxShadow: "none",
                                      transition: "all 0.2s ease",
                                      "&:hover": {
                                        background: entry.toOptional
                                          ? "#e0942e"
                                          : (theme) =>
                                              theme.palette.mode === "light"
                                                ? "rgba(15, 23, 42, 0.06)"
                                                : "rgba(255, 255, 255, 0.08)",
                                        borderColor: entry.toOptional
                                          ? "#e0942e"
                                          : (theme) =>
                                              theme.palette.mode === "light"
                                                ? "#6b7280"
                                                : "rgba(255, 255, 255, 0.7)",
                                      },
                                    }}
                                  >
                                    *
                                  </Box>
                                </Tooltip>
                              ) : null}

                              {entry.to ? (
                                <PartInheritanceModeButton
                                  value={getPartInheritanceMode(
                                    entry.to || entry.from,
                                  )}
                                  disabled={savingPartIds.has(entry.to)}
                                  onChange={async (mode) => {
                                    const partId = entry.to || entry.from;
                                    if (!partId) return;

                                    setPartInheritanceMode(partId, mode);

                                    // Get the true owner of this part from the resolved view.
                                    // If the part is inherited (has an inheritedFrom), use that;
                                    // otherwise the current node is the owner.
                                    const partOwner =
                                      entry.inheritedFrom ??
                                      resolvedParts.find((p) => p.id === partId)
                                        ?.inheritedFrom ??
                                      currentVisibleNode.id;
                                    const partTitle =
                                      entry.toTitle ||
                                      entry.fromTitle ||
                                      resolvedParts.find((p) => p.id === partId)
                                        ?.title ||
                                      allNodes[partId]?.title ||
                                      "";
                                    const optional =
                                      entry.toOptional ??
                                      resolvedParts.find((p) => p.id === partId)
                                        ?.optional ??
                                      false;

                                    // Cascade to all descendants:
                                    // - neverInherit: removes the part from descendants
                                    // - alwaysInherit / inheritUnlessAlreadyOverRidden: adds the part back to descendants
                                    // The part always stays on the current node (e.g. Act).
                                    try {
                                      await Post(
                                        "/nodes/parts/set-inheritance-mode",
                                        {
                                          nodeId: currentVisibleNode.id,
                                          partId,
                                          partOwner,
                                          mode,
                                          partTitle,
                                          optional,
                                          ...(appName ? { appName } : {}),
                                        },
                                      );
                                    } catch (err: any) {
                                      console.error(
                                        "set-inheritance-mode cascade failed",
                                        err,
                                      );
                                      recordLogs({
                                        type: "error",
                                        error: JSON.stringify({
                                          name: err?.name,
                                          message: err?.message,
                                          stack: err?.stack,
                                        }),
                                      });
                                    }
                                  }}
                                />
                              ) : null}
                            </Box>

                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                flex: 1,
                                minWidth: 0,
                              }}
                            >
                              {entry.to ? (
                                <Box
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    width: "100%",
                                    minWidth: 0,
                                  }}
                                >
                                  <Tooltip
                                    title={
                                      !isSelectOpen
                                        ? allNodes[entry.to]?.title || ""
                                        : ""
                                    }
                                    placement="top"
                                    disableHoverListener={isSelectOpen}
                                  >
                                    <Box
                                      component="span"
                                      sx={{
                                        display: "flex",
                                        flex: 1,
                                        minWidth: 0,
                                      }}
                                    >
                                      <Select
                                        value={entry.to}
                                        disabled={
                                          savingPartIds.has(entry.to) ||
                                          (partAlternativesLookup[entry.to]
                                            ?.specs.length ?? 0) +
                                            (partAlternativesLookup[entry.to]
                                              ?.gens.length ?? 0) ===
                                            0
                                        }
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
                                          "& .MuiSelect-select": {
                                            py: "4px",
                                            minHeight: "unset",
                                            display: "flex",
                                            alignItems: "center",
                                          },
                                        }}
                                        MenuProps={{
                                          PaperProps: { sx: menuPaperSx },
                                          MenuListProps: {
                                            sx: {
                                              paddingTop: 0.5,
                                              paddingBottom: 0.5,
                                            },
                                          },
                                        }}
                                      >
                                        <ListSubheader sx={menuTitleSx}>
                                          Switch to:
                                        </ListSubheader>
                                        <ListSubheader sx={sectionHeaderSx}>
                                          Specializations
                                        </ListSubheader>
                                        {loadingSpecializations.has(
                                          entry.to,
                                        ) ? (
                                          <MenuItem disabled sx={emptyStateSx}>
                                            <SyncedSpinner size={16} />
                                            <Typography
                                              sx={{ ...emptyTextSx, ml: 1 }}
                                            >
                                              Loading specializations...
                                            </Typography>
                                          </MenuItem>
                                        ) : (partAlternativesLookup[entry.to]
                                            ?.specs.length ?? 0) > 0 ? (
                                          (
                                            partAlternativesLookup[entry.to]
                                              ?.specs ?? []
                                          ).map((spec: any) => (
                                            <MenuItem
                                              key={`spec-${spec.id}`}
                                              value={spec.id}
                                              sx={optionItemSx}
                                            >
                                              <SwapHorizIcon
                                                sx={{
                                                  fontSize: 18,
                                                  color: "#f2a43a",
                                                }}
                                              />
                                              <Typography
                                                sx={{ fontSize: "1rem" }}
                                              >
                                                {spec.title}
                                              </Typography>
                                            </MenuItem>
                                          ))
                                        ) : (
                                          <MenuItem disabled sx={emptyStateSx}>
                                            <Typography sx={emptyTextSx}>
                                              There is no Specializations to
                                              switch to.
                                            </Typography>
                                          </MenuItem>
                                        )}

                                        <ListSubheader
                                          sx={{ ...sectionHeaderSx, mt: 1 }}
                                        >
                                          Generalizations
                                        </ListSubheader>
                                        {loadingSpecializations.has(
                                          entry.to,
                                        ) ? (
                                          <MenuItem disabled sx={emptyStateSx}>
                                            <SyncedSpinner size={16} />
                                            <Typography
                                              sx={{ ...emptyTextSx, ml: 1 }}
                                            >
                                              Loading generalizations...
                                            </Typography>
                                          </MenuItem>
                                        ) : (partAlternativesLookup[entry.to]
                                            ?.gens.length ?? 0) > 0 ? (
                                          (
                                            partAlternativesLookup[entry.to]
                                              ?.gens ?? []
                                          ).map((gen: any) => (
                                            <MenuItem
                                              key={`gen-${gen.id}`}
                                              value={gen.id}
                                              sx={optionItemSx}
                                            >
                                              <SwapHorizIcon
                                                sx={{
                                                  fontSize: 18,
                                                  color: "#f2a43a",
                                                }}
                                              />
                                              <Typography
                                                sx={{ fontSize: "1rem" }}
                                              >
                                                {gen.title}
                                              </Typography>
                                            </MenuItem>
                                          ))
                                        ) : (
                                          <MenuItem disabled sx={emptyStateSx}>
                                            <Typography sx={emptyTextSx}>
                                              There is no Generalizations to
                                              switch to.
                                            </Typography>
                                          </MenuItem>
                                        )}
                                      </Select>
                                    </Box>
                                  </Tooltip>
                                  {!!entry.inheritedFrom &&
                                    (partSourcesLookup[entry.to] ?? [])
                                      .length >= 2 && (
                                      <Tooltip
                                        title={`Exists in ${
                                          (partSourcesLookup[entry.to] ?? [])
                                            .length
                                        } generalizations, but inherited from ${getCurrentSource(entry)?.title ?? ""}`}
                                        placement="top"
                                      >
                                        {/* Span, not the input: InputBase fires an
                              event-less onBlur when disabled
                              mid-focus. */}
                                        <Box
                                          component="span"
                                          sx={{
                                            display: "flex",
                                            flex: "0 0 25%",
                                            minWidth: 0,
                                          }}
                                        >
                                          <Select
                                            value=""
                                            displayEmpty
                                            disabled={savingPartIds.has(
                                              entry.to,
                                            )}
                                            size="small"
                                            renderValue={() => (
                                              <Box
                                                sx={{
                                                  overflow: "hidden",
                                                  textOverflow: "ellipsis",
                                                  whiteSpace: "nowrap",
                                                  fontSize: "0.72rem",
                                                  fontWeight: "bold",
                                                }}
                                              >
                                                Inherited from
                                              </Box>
                                            )}
                                            sx={{
                                              flex: 1,
                                              minWidth: 0,
                                              color: "#f2a43a",
                                              fontWeight: "bold",
                                              borderRadius: "15px",
                                              backgroundColor: (theme) =>
                                                theme.palette.background.paper,
                                              "& .MuiOutlinedInput-notchedOutline":
                                                {
                                                  borderColor:
                                                    "rgba(242, 164, 58, 0.55)",
                                                },
                                              "&:hover .MuiOutlinedInput-notchedOutline":
                                                {
                                                  borderColor: "#f2a43a",
                                                },
                                            }}
                                            MenuProps={{
                                              PaperProps: { sx: menuPaperSx },
                                              MenuListProps: {
                                                sx: {
                                                  paddingTop: 0.5,
                                                  paddingBottom: 0.5,
                                                },
                                              },
                                            }}
                                          >
                                            <ListSubheader sx={menuTitleSx}>
                                              This part is specifically
                                              inherited from:
                                            </ListSubheader>
                                            {(() => {
                                              // Check sits on the picked gen (via),
                                              // else on the resolution path. Picking
                                              // a relay records the pick; picking
                                              // another owner repoints.
                                              const sources =
                                                partSourcesLookup[entry.to] ??
                                                [];
                                              const currentGenId =
                                                getCurrentSource(entry)?.genId;
                                              return [...sources]
                                                .sort(
                                                  (a, b) =>
                                                    (b.genId === currentGenId
                                                      ? 1
                                                      : 0) -
                                                    (a.genId === currentGenId
                                                      ? 1
                                                      : 0),
                                                )
                                                .map((source) => {
                                                  const isCurrent =
                                                    source.genId ===
                                                    currentGenId;
                                                  return (
                                                    <MenuItem
                                                      key={`source-${source.genId}`}
                                                      disabled={isCurrent}
                                                      onClick={() => {
                                                        if (
                                                          isCurrent ||
                                                          savingPartIds.has(
                                                            entry.to,
                                                          )
                                                        ) {
                                                          return;
                                                        }
                                                        switchPartSource(
                                                          entry.to,
                                                          source.genId,
                                                        );
                                                      }}
                                                      sx={
                                                        isCurrent
                                                          ? currentSourceItemSx
                                                          : optionItemSx
                                                      }
                                                    >
                                                      <CheckIcon
                                                        sx={{
                                                          fontSize: 18,
                                                          color: "#f2a43a",
                                                          visibility: isCurrent
                                                            ? "visible"
                                                            : "hidden",
                                                        }}
                                                      />
                                                      <Typography
                                                        sx={{
                                                          fontSize: "1rem",
                                                          fontWeight: isCurrent
                                                            ? 700
                                                            : 400,
                                                        }}
                                                      >
                                                        {source.title}
                                                      </Typography>
                                                    </MenuItem>
                                                  );
                                                });
                                            })()}
                                          </Select>
                                        </Box>
                                      </Tooltip>
                                    )}
                                </Box>
                              ) : null}
                            </Box>
                          </Box>
                        </ListItem>
                      );
                    }}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </List>
          )}
        </Droppable>
        {notInheritedItems.length > 0 && (
          <List sx={{ px: 1, py: 0, pt: "15px" }}>
            {notInheritedItems.map((entry: any, index: number) => (
              <ListItem
                key={`not-inherited-${entry.from || index}`}
                dense
                disableGutters
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  pl: 1,
                  pr: 1,
                  py: 0,
                  minHeight: 0,
                  boxSizing: "border-box",

                  backgroundPosition: "top",
                  backgroundRepeat: "repeat-x",
                  backgroundSize: "100% 1px",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {!readOnly && (
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
                          <SearchIcon sx={{ fontSize: 19, color: "orange" }} />
                        </IconButton>
                      </Tooltip>
                    </ListItemIcon>
                  )}
                  <ListItemText
                    primary={
                      <Typography>
                        {formatPartTitle(
                          entry.from,
                          Boolean(
                            entry.fromOptional ??
                            resolvedOf(generalizationId)?.find(
                              (p: any) => p.id === entry.from,
                            )?.optional,
                          ),
                          "none",
                          entry.fromTitle,
                        )}
                      </Typography>
                    }
                    sx={{ flex: 1, minWidth: 0, my: 0 }}
                  />
                </Box>

                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 0.5,
                    flexShrink: 0,
                    px: 0.5,
                  }}
                >
                  <ListItemIcon sx={SYMBOL_COL_SX}>
                    <Tooltip
                      title={`"${genTitle}" has this part, but this node does not inherit it.`}
                      placement="top"
                    >
                      <CloseIcon sx={{ fontSize: 20, color: "orange" }} />
                    </Tooltip>
                  </ListItemIcon>

                  {/* Inherits the part specifically through this tab's
                      generalization. Unlike a plain add, it never becomes
                      owned and overall inheritance is untouched. */}
                  {!!addPartFromGen && (
                    <Tooltip title={"Inherit this part"} placement="top">
                      <IconButton
                        sx={{ p: 0.5 }}
                        onClick={async () => {
                          await addPartFromGen(entry.from, generalizationId);
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
                </Box>

                {/* Not inherited: no switch dropdown since the part isn't on
                    this node — an invisible one keeps the row height equal. */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <ListItemText
                    primary={rowHeightSpacer}
                    sx={{ flex: 1, minWidth: 0, my: 0 }}
                  />
                </Box>
              </ListItem>
            ))}
          </List>
        )}
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
          slotProps={{
            paper: {
              sx: {
                border: "1.5px solid orange",
                borderRadius: "10px",
                backgroundColor: (theme) =>
                  theme.palette.mode === "light" ? "#f8f8f8" : "#524e4e",
              },
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
        {nonDraggableItems.length > 0 && (
          <List sx={{ px: 1, py: 0 }}>
            {nonDraggableItems.map((entryFrom: string, index: number) => (
              <ListItem
                key={`non-draggable-${entryFrom || index}`}
                dense
                disableGutters
                sx={{
                  display: "flex",
                  alignItems: "center",
                  backgroundImage:
                    "repeating-linear-gradient(to right, rgba(180,180,180,0.55) 0px, rgba(180,180,180,0.55) 4px, transparent 4px, transparent 8px)",
                  backgroundPosition: "top",
                  backgroundRepeat: "repeat-x",
                  backgroundSize: "100% 1px",
                  gap: 0.5,
                  pl: 1,
                  pr: 1,
                  py: 0,
                  minHeight: 0,
                  boxSizing: "border-box",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {!readOnly && entryFrom && (
                    <ListItemIcon sx={{ minWidth: "auto" }}>
                      <Tooltip title="Search it below" placement="left">
                        <IconButton
                          sx={{ p: 0.4 }}
                          onClick={() =>
                            triggerSearch({
                              id: entryFrom,
                              title: allNodes[entryFrom]?.title,
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
                      entryFrom ? (
                        <Typography>
                          {formatPartTitle(
                            entryFrom,
                            Boolean(
                              resolvedOf(generalizationId)?.find(
                                (p: any) => p.id === entryFrom,
                              )?.optional,
                            ),
                            "none",
                            allNodes[entryFrom]?.title,
                          )}
                        </Typography>
                      ) : null
                    }
                    sx={{ flex: 1, minWidth: 0, my: 0 }}
                  />
                </Box>

                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 0.5,
                    flexShrink: 0,
                    px: 0.5,
                  }}
                >
                  <ListItemIcon sx={SYMBOL_COL_SX}>
                    <Tooltip
                      title={`"${genTitle}" has this part, but this node does not inherit it.`}
                      placement="top"
                    >
                      <CloseIcon sx={{ fontSize: 20, color: "orange" }} />
                    </Tooltip>
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
                            fontSize: 20,
                            color: "green",
                            border: "1px solid green",
                            borderRadius: "50%",
                          }}
                        />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>

                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <ListItemText
                    primary={rowHeightSpacer}
                    sx={{ flex: 1, minWidth: 0, my: 0 }}
                  />
                </Box>
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
  const handleSorting = (e: any) => {
    try {
      // draggableId === the part id (see the Draggable above).
      const { source, destination, draggableId } = e;
      // No destination, or dropped back in the same spot: nothing to persist.
      if (!destination || !user?.uname || destination.index === source?.index) {
        return;
      }

      // The rows render the RESOLVED view, so the new order is a move within
      // its ids. The sort endpoint classifies whether it breaks.
      const orderedIds = resolvedParts.map((p: ILinkNode) => p.id);
      const fromIdx = orderedIds.indexOf(draggableId);
      if (fromIdx === -1) return;
      orderedIds.splice(fromIdx, 1);
      orderedIds.splice(destination.index, 0, draggableId);

      sortParts(orderedIds);

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

      {activeGeneralization && activeGenId && activeGenTitle && (
        <Box key={activeGenId}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              height: 40,
              position: "relative",
              mx: 2,
              mt: 2,
              mb: 2.5,
            }}
          >
            {/* Left Text — hidden for root nodes (no real generalizations) */}
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                gap: 1,
                pr: "30px", // space to avoid overlap with center icon
              }}
            >
              {!isRootNode &&
                (generalizations.length > 1 ? (
                  <TextField
                    value={activeGenId}
                    onChange={(e) => setActiveTab(e.target.value)}
                    select
                    label="Generalizations"
                    sx={{ flex: 1, minWidth: 0 }}
                    slotProps={{
                      input: {
                        sx: {
                          height: "40px",
                          borderRadius: "18px",
                          color: "orange",
                          fontWeight: 700,
                          fontSize: "1.15rem",
                          backgroundColor: (theme) =>
                            theme.palette.background.paper,
                        },
                      },
                      inputLabel: { style: { color: "grey" } },
                      select: {
                        MenuProps: {
                          PaperProps: {
                            sx: {
                              border: "2px solid orange",
                              borderRadius: "12px",
                              "&::-webkit-scrollbar": { display: "none" },
                            },
                          },
                          MenuListProps: {
                            sx: { paddingTop: 0, paddingBottom: 0 },
                          },
                        },
                        renderValue: () => (
                          <Box
                            sx={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {activeGenTitle}
                          </Box>
                        ),
                      },
                    }}
                  >
                    {generalizations.map((gen) => (
                      <MenuItem
                        key={gen.id}
                        value={gen.id}
                        sx={{
                          border: "1px solid gray",
                          borderRadius: "25px",
                          my: "4px",
                          mx: "8px",
                        }}
                      >
                        <Typography>{gen.title}</Typography>
                      </MenuItem>
                    ))}
                  </TextField>
                ) : (
                  <Tooltip title={activeGenTitle}>
                    <Typography
                      sx={{
                        color: "orange",
                        fontWeight: 700,
                        fontSize: "1.15rem",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {activeGenTitle}
                    </Typography>
                  </Tooltip>
                ))}
            </Box>

            <Box
              sx={{
                position: "absolute",
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 0.5,
                height: "40px",
                whiteSpace: "nowrap",
              }}
            >
              {/* Rows keep rendering from the resolved view; only the arrow
                  hints that the annotation is recomputing. */}
              {inheritedPartsRepairing ? (
                <>
                  <SyncedSpinner size={20} />
                  <Typography
                    sx={{
                      fontSize: "0.7rem",
                      fontWeight: "bold",
                      fontStyle: "italic",
                      color: "orange",
                      whiteSpace: "nowrap",
                      pointerEvents: "none",
                      lineHeight: 1,
                    }}
                  >
                    Calculating inheritance…
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
                    fontWeight: 700,
                    fontSize: "1.15rem",
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

      <InheritedPartsLegend sx={{ px: 2, pr: 3 }} />
    </Box>
  );
};

export default InheritedPartsViewerEdit;
