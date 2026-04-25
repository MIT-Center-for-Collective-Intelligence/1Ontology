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
  CircularProgress,
  TextField,
} from "@mui/material";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import {
  ICollection,
  InheritedPartsDetail,
  ILinkNode,
  INode,
  TransferInheritance,
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

import {
  collection,
  getFirestore,
  doc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { NODES } from "@components/lib/firestoreClient/collections";
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
  user: any;
  skillsFutureApp: string;
  navigateToNode?: any;
  triggerSearch?: any;
  addPart?: any;
  removePart?: any;
  inheritedPartsDetails?: InheritedPartsDetail[] | null;
  loadingInheritedPartsDetails?: boolean;
  mutateData?: (newData: InheritedPartsDetail[] | null) => void;
  debouncedRefetch?: () => void;
  refetchNow?: () => void;
  clonedNodesQueue?: { [nodeId: string]: { title: string; id: string } };
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
  currentVisibleNode,
  triggerSearch,
  addPart,
  removePart,
  user,
  navigateToNode,
  setDisplayDetails,
  skillsFutureApp,
  inheritedPartsDetails,
  loadingInheritedPartsDetails,
  mutateData,
  debouncedRefetch,
  refetchNow,
  clonedNodesQueue,
  approvePendingPart,
  cancelPendingPart,
  updatePendingPartTitle,
}) => {
  const db = getFirestore();
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
  const [loadingSpecializations, setLoadingSpecializations] = useState<
    Set<string>
  >(new Set());
  const [fetchedNodes, setFetchedNodes] = useState<{ [id: string]: INode }>({});
  const seenQueuedPendingIdsRef = useRef<Set<string>>(new Set());
  const [highlightedPendingIds, setHighlightedPendingIds] = useState<Set<string>>(
    new Set(),
  );
  // Parts whose inheritance symbol is being recomputed by the API after a
  // local replace. While present, the row's symbol is replaced with a spinner.
  const [calculatingPartIds, setCalculatingPartIds] = useState<Set<string>>(
    new Set(),
  );
  const prevLoadingInheritedRef = useRef<boolean | undefined>(
    loadingInheritedPartsDetails,
  );

  // When loading transitions from true → false, the API response just landed,
  // so the freshly recomputed symbols are now in inheritedPartsDetails: drop
  // every spinner.
  useEffect(() => {
    if (prevLoadingInheritedRef.current && !loadingInheritedPartsDetails) {
      setCalculatingPartIds((prev) => (prev.size > 0 ? new Set() : prev));
    }
    prevLoadingInheritedRef.current = loadingInheritedPartsDetails;
  }, [loadingInheritedPartsDetails]);

  // Merge nodes from props with locally fetched nodes
  const allNodes = { ...nodes, ...fetchedNodes };

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

  const getPartOptionalStatus = (partId: string, nodeId: string): boolean => {
    const node = allNodes[nodeId];
    if (!node?.properties?.parts) return false;

    for (const collection of node.properties.parts) {
      const part = collection.nodes.find((n: any) => n.id === partId);
      if (part) return !!part.optional;
    }
    return false;
  };

  const getCurrentPartOptionalStatus = (partId: string): boolean => {
    const currentNodeInCache =
      allNodes[currentVisibleNode.id] || currentVisibleNode;
    const currentNodeParts = currentNodeInCache.properties?.["parts"];

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

  const getSpecializations = (nodeId: string) => {
    const node = allNodes[nodeId];
    if (!node || !node.specializations) {
      return [];
    }

    const value = node.specializations
      .flatMap((s: { nodes: { id: string }[] }) => s.nodes)
      .map((n: { id: string }) => {
        return {
          title: allNodes[n.id]?.title,
          id: n.id,
        };
      });

    return value;
  };
  const getGeneralizations = (nodeId: string) => {
    const node = allNodes[nodeId];
    if (!node || !node.generalizations) {
      return [];
    }

    const value = node.generalizations
      .flatMap((s: { nodes: { id: string }[] }) => s.nodes)
      .map((n: { id: string }) => {
        return {
          title: allNodes[n.id]?.title,
          id: n.id,
        };
      });

    return value;
  };

  const handleSelect = async (option: string) => {
    const fromId = pickingFor;
    const activeGenId = activeTab;
    handleClose();

    try {
      if (!user?.uname || !fromId || !option || !activeGenId) return;

      // Identify the old pick (oldTo) by finding the row in the active gen
      const activeGen = inheritedPartsDetails?.find(
        (g) => g.generalizationId === activeGenId,
      );
      const xRow = activeGen?.details.find(
        (d) => d.from === fromId && d.to,
      );
      if (!xRow) return;

      const oldTo = xRow.to;
      const newTo = option;
      if (!oldTo || oldTo === newTo) return;
      const oldToTitle = xRow.toTitle || allNodes[oldTo]?.title || "";
      const newToTitle = allNodes[newTo]?.title || xRow.toTitle || "";

      const sourceParts: ICollection[] | undefined =
        currentVisibleNode.properties?.["parts"];
      if (!sourceParts) return;

      const updatedParts: ICollection[] = JSON.parse(
        JSON.stringify(sourceParts),
      );
      const previousParts = JSON.parse(
        JSON.stringify(currentVisibleNode.properties?.["parts"] || []),
      );
      const partsCol = updatedParts[0];
      if (!partsCol) return;
      const oldIdx = partsCol.nodes.findIndex((n: any) => n.id === oldTo);
      const newIdx = partsCol.nodes.findIndex((n: any) => n.id === newTo);
      if (oldIdx === -1 || newIdx === -1) return;
      const tmp = partsCol.nodes[oldIdx];
      partsCol.nodes[oldIdx] = partsCol.nodes[newIdx];
      partsCol.nodes[newIdx] = tmp;

      // Build updated inheritedPartsDetails. Only the active generalization's row + nonPickedOnes change
      const updatedDetails: InheritedPartsDetail[] | null =
        inheritedPartsDetails
          ? JSON.parse(JSON.stringify(inheritedPartsDetails))
          : null;
      if (updatedDetails) {
        updatedDetails.forEach((gen, idx) => {
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

          // Resolve both rows before updating either, so we don't grab the
          // wrong row after the generalization row's `to` flips to newTo.
          const xRow = gen.details.find(
            (d) => d.from === fromId && d.to === oldTo,
          );
          const otherRow = gen.details.find(
            (d) => d !== xRow && d.to === newTo,
          );

          // Swap the optional values
          const xRowToOptionalBefore = xRow?.toOptional ?? false;
          const otherRowToOptionalBefore = otherRow?.toOptional ?? false;

          // change symbol of the two rows
          if (xRow) {
            xRow.to = newTo;
            xRow.toTitle = newToTitle;
            xRow.userOverride = true;
            xRow.symbol = xRow.from === xRow.to ? "=" : ">";
            if (otherRow) xRow.toOptional = otherRowToOptionalBefore;
          }

          // Change new row and old row's "to" so that it does not appear in multiple places
          if (otherRow) {
            otherRow.to = oldTo;
            otherRow.toTitle = oldToTitle;
            if (xRow) otherRow.toOptional = xRowToOptionalBefore;
          }

          // nonPickedOnes: drop newTo, push oldTo back as an alternative
          if (!gen.nonPickedOnes[fromId]) {
            gen.nonPickedOnes[fromId] = [];
          }
          gen.nonPickedOnes[fromId] = gen.nonPickedOnes[fromId].filter(
            (item) => item.id !== newTo,
          );
          gen.nonPickedOnes[fromId].push({
            id: oldTo,
            title: oldToTitle,
          });
        });

        mutateData?.(updatedDetails);
      }

      // Firestore write for both fields
      const nodeRef = doc(collection(db, NODES), currentVisibleNode?.id);
      const updates: any = {
        "properties.parts": updatedParts,
      };
      if (updatedDetails) {
        updates.inheritedPartsDetails = updatedDetails;
      }
      await updateDoc(nodeRef, updates);

      saveNewChangeLog(db, {
        nodeId: currentVisibleNode?.id,
        modifiedBy: user.uname,
        modifiedProperty: "parts",
        previousValue: previousParts,
        newValue: updatedParts,
        modifiedAt: new Date(),
        changeType: "modify elements",
        changeDetails: {
          action: "switch to",
          from: fromId,
          oldTo,
          newTo,
        },
        fullNode: currentVisibleNode,
        skillsFuture: !!skillsFutureApp,
        ...(skillsFutureApp ? { appName: skillsFutureApp } : {}),
      });

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

  // Helper to clone and optimistically update inheritedPartsDetails
  const optimisticUpdate = (
    updater: (details: InheritedPartsDetail[]) => InheritedPartsDetail[],
  ) => {
    if (!inheritedPartsDetails || !mutateData) return;
    const updated = updater(JSON.parse(JSON.stringify(inheritedPartsDetails)));
    mutateData(updated);
    debouncedRefetch?.();
  };

  const onAddPart = (partId: string) => {
    addPart(partId);
    optimisticUpdate((data) => {
      for (const gen of data) {
        let updatedExistingEntry = false;
        const entry = gen.details.find(
          (d) => d.from === partId && d.symbol === "x",
        );
        if (entry) {
          entry.symbol = "=";
          entry.to = partId;
          entry.toTitle = entry.fromTitle;
          entry.toOptional = entry.fromOptional;
          entry.optionalChange = "none";
          updatedExistingEntry = true;
        }

        // If this part doesn't exist in inherited comparison rows,
        // optimistically render it as a newly added part.
        const alreadyPresent = gen.details.some((d) => d.to === partId);
        if (!updatedExistingEntry && !alreadyPresent) {
          gen.details.push({
            from: "",
            to: partId,
            symbol: "+",
            fromTitle: "",
            toTitle: allNodes[partId]?.title || "",
            fromOptional: false,
            toOptional: getCurrentPartOptionalStatus(partId),
            optionalChange: "none",
            hops: 0,
          });
        }
      }
      return data;
    });
  };

  const onRemovePart = (partId: string) => {
    removePart(partId);
    optimisticUpdate((data) => {
      for (const gen of data) {
        const entry = gen.details.find((d) => d.to === partId);
        if (entry) {
          if (entry.from) {
            entry.symbol = "x";
            entry.to = "";
            entry.toTitle = "";
            entry.toOptional = false;
            entry.optionalChange = "none";
          } else {
            // It was a "+" entry (added part with no generalization source)
            gen.details = gen.details.filter((d) => d.to !== partId);
          }
        }
      }
      return data;
    });
  };

  const onReplacePart = async (oldPartId: string, newPartId: string) => {
    if (!oldPartId || !newPartId || oldPartId === newPartId) return;

    // Build updated inheritedPartsDetails locally for instant UI feedback on
    // to/toTitle and to fold into replaceWith's single updateDoc. The symbol
    // is intentionally left stale — the API recompute below will replace it
    // with the correct value, and the row shows a spinner in the meantime.
    let updatedDetails: InheritedPartsDetail[] | null = null;
    if (inheritedPartsDetails) {
      updatedDetails = JSON.parse(JSON.stringify(inheritedPartsDetails));
      const newTitle = allNodes[newPartId]?.title || "";

      updatedDetails!.forEach((gen, idx) => {
        // Re-hydrate createdAt so the hook's freshness check survives.
        const original: any = inheritedPartsDetails[idx]?.createdAt;
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

        // Every row whose to === oldPartId now points at newPartId.
        for (const entry of gen.details) {
          if (entry.to === oldPartId) {
            entry.to = newPartId;
            entry.toTitle = newTitle;
          }
        }

        // Rename oldPartId → newPartId wherever it appears in nonPickedOnes.
        for (const fromKey of Object.keys(gen.nonPickedOnes)) {
          gen.nonPickedOnes[fromKey] = gen.nonPickedOnes[fromKey].map(
            (item) =>
              item.id === oldPartId
                ? { id: newPartId, title: newTitle }
                : item,
          );
        }
      });

      mutateData?.(updatedDetails);
    }

    // Show spinner in place of the symbol for this part until the API returns.
    setCalculatingPartIds((prev) => {
      const next = new Set(prev);
      next.add(newPartId);
      return next;
    });

    try {
      await replaceWith(oldPartId, newPartId, updatedDetails);
      // Trigger an immediate API recompute so the symbol updates as soon as
      // the parts changes are persisted. The loading→idle transition above
      // clears the spinner.
      refetchNow?.();
    } catch (error) {
      console.error(error);
      setCalculatingPartIds((prev) => {
        if (!prev.has(newPartId)) return prev;
        const next = new Set(prev);
        next.delete(newPartId);
        return next;
      });
    }
  };

  const onApprovePendingPart = async (queuedId: string, title: string) => {
    // Optimistically show the approved part immediately in the list.
    optimisticUpdate((data) => {
      for (const gen of data) {
        const alreadyExists = gen.details.some((entry) => entry.to === queuedId);
        if (!alreadyExists) {
          gen.details.push({
            from: "",
            to: queuedId,
            symbol: "+",
            fromTitle: "",
            toTitle: title,
            fromOptional: false,
            toOptional: false,
            optionalChange: "none",
            hops: 0,
          });
        }
      }
      return data;
    });

    setApprovingPendingIds((prev) => {
      const updated = new Set(prev);
      updated.add(queuedId);
      return updated;
    });
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

      // Build the new properties.parts with optional flipped on the matching node
      const updatedParts: ICollection[] = JSON.parse(
        JSON.stringify(sourceParts),
      );
      const previousParts = JSON.parse(
        JSON.stringify(currentVisibleNode.properties?.["parts"] || []),
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

      // Build the new inheritedPartsDetails with toOptional/optionalChange
      //    updated for every entry that points at this part
      const updatedDetails: InheritedPartsDetail[] | null = inheritedPartsDetails
        ? JSON.parse(JSON.stringify(inheritedPartsDetails))
        : null;
      if (updatedDetails) {
        updatedDetails.forEach((gen, idx) => {
          // JSON.stringify strips the Timestamp class off createdAt. The hook's
          // freshness check calls .toMillis(), so re-hydrate it: prefer the
          // original instance (already a Timestamp), otherwise rebuild from
          // {seconds,nanoseconds} (snapshot) or {_seconds,_nanoseconds} (API).
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

          for (const entry of gen.details) {
            if (entry.to !== partId) continue;
            entry.toOptional = newOptional;
            entry.optionalChange = entry.from
              ? entry.fromOptional === newOptional
                ? "none"
                : newOptional
                  ? "added"
                  : "removed"
              : "none";
          }
        });
        // Reflect the change in the React tree immediately.
        mutateData?.(updatedDetails);
      }

      // Persist both fields in a single write so the node doc stays consistent and the cached inheritedPartsDetails isn't stale
      const nodeRef = doc(collection(db, NODES), currentVisibleNode?.id);
      const updates: any = {
        "properties.parts": updatedParts,
      };
      if (updatedDetails) {
        updates.inheritedPartsDetails = updatedDetails;
      }
      await updateDoc(nodeRef, updates);

      saveNewChangeLog(db, {
        nodeId: currentVisibleNode?.id,
        modifiedBy: user.uname,
        modifiedProperty: "parts",
        previousValue: previousParts,
        newValue: updatedParts,
        modifiedAt: new Date(),
        changeType: "modify elements",
        changeDetails: {
          action: "toggle optional",
          partId,
          optional: newOptional,
        },
        fullNode: currentVisibleNode,
        skillsFuture: !!skillsFutureApp,
        ...(skillsFutureApp ? { appName: skillsFutureApp } : {}),
      });

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
    console.log(generalizationId, "generalizationId ==>");
    // Check if node has any parts at all
    const hasParts =
      currentVisibleNode.properties?.parts?.[0]?.nodes?.length > 0;

    if (!hasParts) {
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
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            py: 2,
          }}
        >
          <CircularProgress size={16} />
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
    const draggableItems = details.filter((entry: any) => entry.to);
    const nonDraggableItems = Object.keys(nonPickedOnes).filter((id) => {
      const index = details.findIndex((d) => d.from === id);
      return index === -1;
    });
    const pendingQueuedParts = Object.entries(clonedNodesQueue || {}).map(
      ([queuedId, queuedNode]) => ({
        id: queuedId,
        title: queuedNode?.title || "",
      }),
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
                  key={`${entry.from}::${entry.to}`}
                  draggableId={`${entry.from}::${entry.to}`}
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
                        {calculatingPartIds.has(entry.to) ? (
                          <Tooltip
                            title="Calculating inheritance for this part"
                            placement="top"
                          >
                            <CircularProgress
                              size={18}
                              sx={{ color: "orange" }}
                            />
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
                          <IconButton
                            sx={{ p: 0.5 }}
                            onClick={() => {
                              onRemovePart(entry.to);
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
                                  !isSelectOpen
                                    ? allNodes[entry.to]?.title || ""
                                    : ""
                                }
                                placement="top"
                                disableHoverListener={isSelectOpen}
                              >
                                <Select
                                  value={entry.to}
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
                                  {loadingSpecializations.has(entry.to) && (
                                    <MenuItem disabled>
                                      <Box
                                        sx={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 1,
                                        }}
                                      >
                                        <CircularProgress size={16} />
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
                                  onMouseDown={(e: React.MouseEvent) => {
                                    e.stopPropagation();
                                  }}
                                  onClick={(e: React.MouseEvent) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleOptional(entry.to);
                                  }}
                                  sx={{
                                    cursor: "pointer",
                                    textTransform: "none",
                                    fontSize: 12,
                                    fontWeight: entry.toOptional ? 700 : 600,
                                    color: entry.toOptional
                                      ? "#f2a43a"
                                      : (theme) =>
                                          theme.palette.mode === "light"
                                            ? "#111827"
                                            : "#f3f4f6",
                                    px: 1.5,
                                    py: 0.5,
                                    minHeight: 28,
                                    borderRadius: "999px",
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
                            </Box>
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
                  primary={allNodes[option]?.title}
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
        {pendingQueuedParts.length > 0 && (
          <List sx={{ px: 1.8, py: 1, mt: -0.5 }}>
            {pendingQueuedParts.map((pendingPart) => {
              const isNewlyQueued = highlightedPendingIds.has(pendingPart.id);

              return (
                <ListItem
                  key={`pending-${pendingPart.id}`}
                  sx={{
                    display: "flex",
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
                      <TextField
                        size="small"
                        fullWidth
                        value={pendingPart.title}
                        onChange={(e) =>
                          updatePendingPartTitle?.(pendingPart.id, e.target.value)
                        }
                        placeholder="New part title"
                        sx={{
                          "& .MuiInputBase-root": {
                            borderRadius: "12px",
                          },
                        }}
                      />
                    }
                    sx={{ flex: 1, minWidth: 0.3 }}
                  />
                  {!!approvePendingPart && (
                    <Tooltip title={"Approve part"} placement="top">
                      <IconButton
                        sx={{ p: 0.5 }}
                        disabled={approvingPendingIds.has(pendingPart.id)}
                        onClick={() => {
                          onApprovePendingPart(pendingPart.id, pendingPart.title);
                        }}
                      >
                        {approvingPendingIds.has(pendingPart.id) ? (
                          <CircularProgress size={20} />
                        ) : (
                          <CheckIcon
                            sx={{
                              fontSize: 20,
                              color: "green",
                              border: "1px solid green",
                              borderRadius: "50%",
                            }}
                          />
                        )}
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
                </ListItem>
              );
            })}
          </List>
        )}
      </Box>
    );
  };

  const activeGeneralization = generalizations.find((g) => g.id === activeTab);
  const activeGenId = activeGeneralization?.id;
  const activeGenTitle = activeGeneralization?.title;
  const handleSorting = (e: any) => {
    try {
      // Destructure properties from the result object
      let { source, destination, draggableId, type } = e;
      const separatorIdx = draggableId.indexOf("::");
      draggableId = separatorIdx !== -1
        ? draggableId.substring(separatorIdx + 2)
        : draggableId;
      // If there is no destination, no sorting needed

      if (!destination || !user?.uname) {
        return;
      }

      /* these have index 0 by default since parts don't have collections but that may change in the future */
      const sourceCollectionIndex = 0;
      const destinationCollectionIndex = 0;

      const propertyValue: ICollection[] =
        currentVisibleNode.properties?.["parts"];

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

        // Optimistic update: reorder details to match new parts order
        optimisticUpdate((data) => {
          const newPartsOrder =
            propertyValue[0]?.nodes?.map((n: any) => n.id) || [];
          for (const gen of data) {
            gen.details.sort((a, b) => {
              const aIdx = newPartsOrder.indexOf(a.to);
              const bIdx = newPartsOrder.indexOf(b.to);
              return (
                (aIdx === -1 ? Infinity : aIdx) -
                (bIdx === -1 ? Infinity : bIdx)
              );
            });
          }
          return data;
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
