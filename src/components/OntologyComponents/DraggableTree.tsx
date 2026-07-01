import clsx from "clsx";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { NodeApi, NodeRendererProps, Tree, TreeApi } from "react-arborist";
import styles from "./drag.tree.module.css";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { Box, Skeleton, ToggleButton, Tooltip, useTheme } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import EditOffIcon from "@mui/icons-material/EditOff";
import ChatIcon from "@mui/icons-material/Chat";
import { buildOneLevelFromSpecializations } from "@components/lib/utils/loadOutlineFromPathIds";

import { recordLogs } from "@components/lib/utils/helpers";
import {
  collection,
  doc,
  getDoc,
  getFirestore,
} from "firebase/firestore";
import { ICollection, TreeData } from "@components/types/INode";
import { NODES } from "@components/lib/firestoreClient/collections";
import { Post } from "@components/lib/utils/Post";
import { pendingWrites } from "@components/lib/utils/pendingWrites";
import { useAuth } from "../context/AuthContext";
import { FillFlexParent } from "./fill-flex-parent";
import { findNode, removeNode } from "./treeUtils";
import { userHasOntologyEditAccess } from "@components/lib/utils/helpers";

const INDENT_STEP = 15;
const INITIAL_LOAD_COUNT = 20;
const LOAD_MORE_COUNT = 20;
const EMPTY_SET = new Set<string>();

interface PaginatedTreeData extends TreeData {
  isLoadMore?: boolean;
  isLoadingPlaceholder?: boolean;
  parentId?: string;
  totalChildren?: number;
  loadedChildren?: number;
  allChildren?: TreeData[];
  isTopLoader?: boolean;
  isBottomLoader?: boolean;
  loadDirection?: "top" | "bottom";
}

function DraggableTree({
  treeViewData,
  setSnackbarMessage,
  nodes,
  currentVisibleNode,
  setCurrentVisibleNode,
  fetchNode,
  onOpenNodesTree,
  treeRef,
  treeType,
  specializationNumsUnder,
  appName,
  onInstantTreeUpdate,
  onExpandEllipsis,
  onOutlineNodeOpen,
  nodesWithComments = EMPTY_SET,
  searchTerm = "",
}: {
  treeViewData: any;
  setSnackbarMessage: any;
  nodes: any;
  currentVisibleNode: any;
  setCurrentVisibleNode?: (node: any | ((prev: any) => any)) => void;
  fetchNode?: (nodeId: string, force?: boolean) => Promise<any>;
  onOpenNodesTree: any;
  treeRef: any;
  treeType?: string;
  specializationNumsUnder: { [key: string]: number };
  appName: string;
  onInstantTreeUpdate?: (
    updateFn: (treeData: TreeData[]) => TreeData[],
  ) => void;
  onExpandEllipsis?: (ellipsisNodeId: string) => void;
  onOutlineNodeOpen?: (node: NodeApi<PaginatedTreeData>) => Promise<void>;
  nodesWithComments?: Set<string>;
  searchTerm?: string;
}) {
  const db = getFirestore();
  const [{ user }] = useAuth();
  const theme = useTheme();
  const [treeData, setTreeData] = useState<PaginatedTreeData[]>([]);
  const [editEnabled, setEditEnabled] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);
  const [loadingStates, setLoadingStates] = useState<Set<string>>(new Set());
  const loadingStatesRef = useRef(loadingStates);
  const isDarkMode = theme.palette.mode === "dark";

  useEffect(() => {
    loadingStatesRef.current = loadingStates;
  }, [loadingStates]);

  const treeThemeVars = useMemo(
    () => ({
      "--tree-surface": isDarkMode ? "#2f3136" : "#eef2f7",
      "--tree-active-bg": isDarkMode
        ? "rgba(76, 175, 80, 0.16)"
        : "rgba(76, 175, 80, 0.12)",
      "--tree-active-hover-bg": isDarkMode
        ? "rgba(76, 175, 80, 0.2)"
        : "rgba(76, 175, 80, 0.16)",
      "--tree-hover-bg": isDarkMode
        ? "rgba(255,255,255,0.05)"
        : "rgba(0,0,0,0.04)",
      "--tree-primary-text": theme.palette.text.primary,
      "--tree-secondary-text": theme.palette.text.secondary,
      "--tree-skeleton-bg": isDarkMode
        ? "rgba(255,255,255,0.08)"
        : "rgba(0,0,0,0.08)",
    }),
    [isDarkMode, theme.palette.text.primary, theme.palette.text.secondary],
  );
  const setNodeChildrenOptimistic = useCallback(
    (targetTreeId: string, children: TreeData[]) => {
      if (!onInstantTreeUpdate) return;
      const mapAtId = (nodes: TreeData[]): TreeData[] => {
        return nodes.map((n) => {
          if (n.id === targetTreeId) {
            return { ...n, children };
          }
          if (n.children) {
            return { ...n, children: mapAtId(n.children) };
          }
          return n;
        });
      };
      onInstantTreeUpdate((prev) => mapAtId(prev));
    },
    [onInstantTreeUpdate],
  );

  const ensureExpandedWithLazyLoad = useCallback(
    (node: NodeApi<PaginatedTreeData>) => {
      if (!node.isInternal) return;

      // Expand immediately (no waiting on network).
      if (!node.isOpen) node.open();

      const needOutline =
        onOutlineNodeOpen &&
        (node.data.outlineSpineOnly || node.data.outlineLoadChildren);

      if (!needOutline) return;
      if (loadingStatesRef.current.has(node.data.id)) return;

      // Prefer rendering known specialization titles immediately (if present)
      // instead of flashing skeleton rows. We still run the outline fetch in
      // the background to upgrade node types + lazy flags accurately.
      if ((node.data.children || []).length === 0) {
        const parent = (nodes as any)?.[node.data.nodeId];
        if (parent?.specializations?.length) {
          const childById: Record<string, any> = { ...(nodes as any) };
          for (const c of parent.specializations || []) {
            for (const link of c.nodes || []) {
              if (!childById[link.id]) {
                childById[link.id] = {
                  id: link.id,
                  title: link.title ?? link.id,
                  // Best-effort; the outline fetch will replace with real nodeType.
                  nodeType: "group",
                };
              }
            }
          }
          const optimisticChildren = buildOneLevelFromSpecializations(
            parent,
            node.data.id,
            childById,
          );
          if (optimisticChildren.length > 0) {
            setNodeChildrenOptimistic(node.data.id, optimisticChildren);
          } else {
            setNodeChildrenOptimistic(node.data.id, [
              {
                id: `${node.data.id}-loading-1`,
                nodeId: `${node.data.nodeId}-loading-1`,
                name: "",
                nodeType: "loading",
                category: false,
                isLoadingPlaceholder: true,
              } as any,
              {
                id: `${node.data.id}-loading-2`,
                nodeId: `${node.data.nodeId}-loading-2`,
                name: "",
                nodeType: "loading",
                category: false,
                isLoadingPlaceholder: true,
              } as any,
              {
                id: `${node.data.id}-loading-3`,
                nodeId: `${node.data.nodeId}-loading-3`,
                name: "",
                nodeType: "loading",
                category: false,
                isLoadingPlaceholder: true,
              } as any,
            ]);
          }
        } else {
          // Fallback: show skeleton placeholder rows instantly.
          setNodeChildrenOptimistic(node.data.id, [
            {
              id: `${node.data.id}-loading-1`,
              nodeId: `${node.data.nodeId}-loading-1`,
              name: "",
              nodeType: "loading",
              category: false,
              isLoadingPlaceholder: true,
            } as any,
            {
              id: `${node.data.id}-loading-2`,
              nodeId: `${node.data.nodeId}-loading-2`,
              name: "",
              nodeType: "loading",
              category: false,
              isLoadingPlaceholder: true,
            } as any,
            {
              id: `${node.data.id}-loading-3`,
              nodeId: `${node.data.nodeId}-loading-3`,
              name: "",
              nodeType: "loading",
              category: false,
              isLoadingPlaceholder: true,
            } as any,
          ]);
        }
      }

      setLoadingStates((s) => new Set(s).add(node.data.id));
      Promise.resolve(onOutlineNodeOpen!(node))
        .catch((err) => console.error(err))
        .finally(() => {
          setLoadingStates((s) => {
            const n = new Set(s);
            n.delete(node.data.id);
            return n;
          });
        });
    },
    [onOutlineNodeOpen, setNodeChildrenOptimistic, nodes],
  );

  const [paginationState, setPaginationState] = useState<Map<string, number>>(
    new Map(),
  );
  const [focusedWindowState, setFocusedWindowState] = useState<
    Map<string, { startIndex: number; endIndex: number }>
  >(new Map());
  const isTreeClickRef = useRef(false);
  const treeActivatedNodeIdRef = useRef<string | null>(null);
  const hasExpandedSuccessfully = useRef<boolean>(false);
  const pendingExpansionNodeId = useRef<string | null>(null);

  const processTreeData = useCallback(
    (data: TreeData[]): PaginatedTreeData[] => {
      return data.map((node) => {
        const processedNode: PaginatedTreeData = {
          ...node,
          allChildren: node.children ? [...node.children] : undefined,
        };

        // Always assign a children array (empty) so react-arborist classifies every node as a drop target
        processedNode.children = node.children ? [...node.children] : [];

        if (processedNode.children.length > 0) {
          processedNode.children = processTreeData(processedNode.children);
        }

        return processedNode;
      });
    },
    [],
  );

  const handleLoadMore = useCallback(
    (loadMoreNodeId: string) => {
      const loadMoreNode = findNode(
        treeData,
        loadMoreNodeId,
      ) as PaginatedTreeData;
      if (!loadMoreNode) return;

      // Check if this is a filtered ellipsis node
      const isFilteredEllipsis =
        loadMoreNode.isLoadMore &&
        (loadMoreNode as any).hiddenNodesCount !== undefined &&
        !loadMoreNode.parentId;

      if (isFilteredEllipsis && onExpandEllipsis) {
        onExpandEllipsis(loadMoreNodeId);
        return;
      }

      // Pagination logic for normal load-more nodes (for unclassified nodes)
      if (!loadMoreNode.parentId) return;

      setLoadingStates((prev) => new Set(prev).add(loadMoreNodeId));

      setTimeout(() => {
        if (loadMoreNode.isTopLoader || loadMoreNode.isBottomLoader) {
          const parentNode = findNode(
            treeData,
            loadMoreNode.parentId!,
          ) as PaginatedTreeData;
          if (!parentNode?.allChildren) return;

          const currentWindow =
            focusedWindowState.get(loadMoreNode.parentId!) ||
            (() => {
              const focusedIndex = parentNode.allChildren!.findIndex(
                (child) => child.nodeId === currentVisibleNode?.id,
              );
              const startIndex = Math.max(
                0,
                focusedIndex - Math.floor(INITIAL_LOAD_COUNT / 2),
              );
              const endIndex = Math.min(
                parentNode.allChildren!.length,
                startIndex + INITIAL_LOAD_COUNT,
              );
              return { startIndex, endIndex };
            })();

          let newStartIndex = currentWindow.startIndex;
          let newEndIndex = currentWindow.endIndex;

          if (loadMoreNode.isTopLoader) {
            newStartIndex = Math.max(
              0,
              currentWindow.startIndex - LOAD_MORE_COUNT,
            );
          } else if (loadMoreNode.isBottomLoader) {
            newEndIndex = Math.min(
              parentNode.allChildren!.length,
              currentWindow.endIndex + LOAD_MORE_COUNT,
            );
          }

          setFocusedWindowState((prev) => {
            const newState = new Map(prev);
            newState.set(loadMoreNode.parentId!, {
              startIndex: newStartIndex,
              endIndex: newEndIndex,
            });
            return newState;
          });
        } else {
          const currentLoaded =
            loadMoreNode.loadedChildren || INITIAL_LOAD_COUNT;
          const newLoadedCount = currentLoaded + LOAD_MORE_COUNT;

          setPaginationState((prev) => {
            const newState = new Map(prev);
            newState.set(loadMoreNode.parentId!, newLoadedCount);
            return newState;
          });
        }

        setLoadingStates((prev) => {
          const newSet = new Set(prev);
          newSet.delete(loadMoreNodeId);
          return newSet;
        });
      }, 300);
    },
    [treeData, onExpandEllipsis, currentVisibleNode?.id, focusedWindowState],
  );

  useEffect(() => {
    // Use tree data from current node's nodeTreeData field
    setTreeData(processTreeData(treeViewData));
  }, [treeViewData, processTreeData]);

  const nodePathIndex = useMemo(() => {
    const index = new Map<string, string[][]>();

    const visit = (items: PaginatedTreeData[], path: string[]) => {
      for (const item of items) {
        const currentPath = [...path, item.id];
        const paths = index.get(item.nodeId);
        if (paths) {
          paths.push(currentPath);
        } else {
          index.set(item.nodeId, [currentPath]);
        }

        if (item.children?.length) {
          visit(item.children as PaginatedTreeData[], currentPath);
        }
      }
    };

    visit(treeData, []);
    return index;
  }, [treeData]);

  // Helper function to find all occurrences of a node by its nodeId
  const findNodesByNodeId = useCallback(
    (
      tree: TreeApi<PaginatedTreeData>,
      targetNodeId: string,
    ): NodeApi<PaginatedTreeData>[] => {
      const paths = nodePathIndex.get(targetNodeId);
      if (!paths) return [];

      const matches: NodeApi<PaginatedTreeData>[] = [];
      for (const path of paths) {
        const treeNode = tree.get(path[path.length - 1]);
        if (treeNode) {
          matches.push(treeNode);
        }
      }

      return matches;
    },
    [nodePathIndex],
  );

  const expandNodeById = useCallback(
    (targetNodeId: string) => {
      if (!targetNodeId) return;

      const tree = treeRef.current;
      if (!tree) {
        pendingExpansionNodeId.current = targetNodeId;
        return;
      }

      // Find all paths to this nodeId in the tree
      const paths = nodePathIndex.get(targetNodeId);

      if (!paths || paths.length === 0) {
        pendingExpansionNodeId.current = targetNodeId;
        return;
      }

      // Expand ALL occurrences by opening all ancestors in their respective paths
      for (const path of paths) {
        // path is an array of tree-specific IDs: [rootId, ..., parentId, targetId]
        // We open every node except the target itself (which is the last element)
        for (let i = 0; i < path.length - 1; i++) {
          const ancestorId = path[i];
          tree.open(ancestorId);

          // Best-effort: also expand categories for this ancestor if we can get the node API
          const ancestorNode = tree.get(ancestorId);
          if (ancestorNode?.children) {
            for (const child of ancestorNode.children) {
              if (child.data.category && !child.isOpen) {
                child.open();
              }
            }
          }
        }
      }

      hasExpandedSuccessfully.current = true;
      pendingExpansionNodeId.current = null;
    },
    [treeRef, nodePathIndex],
  );

  // Track whether the last navigation attempt needs to wait for new treeData.
  const expansionPendingForTreeData = useRef(false);
  // Track the node id we last scrolled/selected to. Used to distinguish a real
  // navigation (focused node changed) from an incidental treeData update caused
  // by expanding an unrelated node — we must NOT scroll in the latter case.
  const lastScrolledNodeIdRef = useRef<string | null>(null);

  useEffect(() => {
    const tree = treeRef.current;

    if (!tree || !currentVisibleNode?.id) {
      return;
    }

    const targetNodeId = currentVisibleNode.id;

    if (
      treeActivatedNodeIdRef.current &&
      treeActivatedNodeIdRef.current !== targetNodeId
    ) {
      treeActivatedNodeIdRef.current = null;
    }

    if (
      isTreeClickRef.current ||
      treeActivatedNodeIdRef.current === targetNodeId
    ) {
      hasExpandedSuccessfully.current = true;
      pendingExpansionNodeId.current = null;
      expansionPendingForTreeData.current = false;
      isTreeClickRef.current = false;
      // The node the user clicked is already in view; record it so later
      // treeData updates (e.g. expanding another node) don't re-scroll here.
      lastScrolledNodeIdRef.current = targetNodeId;
      setFirstLoad(false);
      return;
    }

    // Reset expansion tracking for this new navigation
    hasExpandedSuccessfully.current = false;
    pendingExpansionNodeId.current = null;

    // Defer by one animation frame so react-arborist has had time to commit
    // the latest treeData into its internal node map before we call tree.get().
    // Without this, treeData can have updated in React state while the tree
    // API still reflects the previous render — causing findNodesByNodeId to
    // return nothing and leaving the target stuck in pendingExpansionNodeId.
    // Only scroll/select when the focused node actually changed. When this
    // effect re-fires solely because `treeData` changed (e.g. the user expanded
    // an unrelated node and its children loaded), the outline must stay where it
    // is instead of jumping back to the current node.
    const isNewNavigation = lastScrolledNodeIdRef.current !== targetNodeId;

    const rafId = requestAnimationFrame(() => {
      expandNodeById(targetNodeId);

      // Select and scroll to the target node
      const paths = nodePathIndex.get(targetNodeId);
      if (paths && paths.length > 0) {
        // Select the first occurrence found
        const treeId = paths[0][paths[0].length - 1];
        if (isNewNavigation) {
          tree.select(treeId, { align: "auto" });
          lastScrolledNodeIdRef.current = targetNodeId;
        }
        expansionPendingForTreeData.current = false;
      } else {
        // Node still not in tree; mark pending so the retry effect can pick it up.
        expansionPendingForTreeData.current = true;
      }
    });

    isTreeClickRef.current = false;
    setFirstLoad(false);

    return () => cancelAnimationFrame(rafId);
    // `treeData` is included so this retries after the platform reloads its
    // tree for a new focused node (e.g. returning from the navigator). The
    // first attempt can fire before the new tree arrives, which would park
    // the target id in pendingExpansionNodeId without ever retrying.
  }, [
    treeRef,
    currentVisibleNode?.id,
    expandNodeById,
    findNodesByNodeId,
    treeData,
  ]);

  // Retry expansion when tab becomes visible, window gains focus, or the URL
  // hash changes. The hashchange case covers the navigator round-trip when the
  // focused node didn't change (currentVisibleNode.id stable, treeData stable
  // — the main nav effect would otherwise never re-fire). Same shape as the
  // tab-visibility/focus handlers, just one more trigger.
  useEffect(() => {
    const retryExpansion = async () => {
      // If expansion hasn't succeeded yet, retry it
      if (!hasExpandedSuccessfully.current && currentVisibleNode?.id) {
        const nodeToExpand =
          pendingExpansionNodeId.current || currentVisibleNode.id;

        await new Promise((resolve) => setTimeout(resolve, 150));

        expandNodeById(nodeToExpand);

        const tree = treeRef.current;
        if (tree && currentVisibleNode?.id) {
          const targetNodes = findNodesByNodeId(tree, currentVisibleNode.id);
          if (targetNodes.length > 0) {
            tree.select(targetNodes[0].id, { align: "auto" });
            lastScrolledNodeIdRef.current = currentVisibleNode.id;
          }
        }
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        retryExpansion();
      }
    };

    const handleWindowFocus = () => {
      retryExpansion();
    };

    const handleHashChange = () => {
      // Mark expansion as not succeededd so retryExpansion will run
      hasExpandedSuccessfully.current = false;
      retryExpansion();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("hashchange", handleHashChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [treeRef, expandNodeById, findNodesByNodeId, currentVisibleNode?.id]);

  useEffect(() => {
    const tree = treeRef.current;
    if (tree && treeData.length > 0 && firstLoad) {
      const rootNode = tree.get("root");

      if (rootNode) {
        rootNode.open();
      }

      setFirstLoad(false);
    }
  }, [treeRef, treeData, firstLoad]);

  const handleMove = async (args: {
    dragIds: string[];
    dragNodes: NodeApi<PaginatedTreeData>[];
    parentId: string | null;
    parentNode: NodeApi<PaginatedTreeData> | null;
    index: number;
  }) => {
    try {
      if (!editEnabled || !user?.uname) return;

      // Fetch from Firestore if the node isn't in the relatedNodes cache
      const ensureNodeDoc = async (nodeId: string): Promise<any | null> => {
        if (nodes[nodeId]) return nodes[nodeId];
        try {
          const snap = await getDoc(doc(collection(db, NODES), nodeId));
          if (!snap.exists()) return null;
          return { id: snap.id, ...snap.data() };
        } catch (e) {
          console.error("ensureNodeDoc failed for", nodeId, e);
          return null;
        }
      };

      const draggedNodes = args.dragNodes.map((node) => node.data);
      if (draggedNodes[0].isLoadMore) {
        return;
      }

      const fromParents: any = args.dragNodes.map(
        (node) =>
          node.parent?.data || { id: "root", name: "Root", nodeType: null },
      );
      const toParent: any = args.parentNode?.data || {
        id: "root",
        name: "Root",
        nodeType: null,
      };

      const differentNodeType = draggedNodes.some(
        (n) => n.nodeType !== toParent.nodeType,
      );

      if (
        differentNodeType ||
        toParent.id === "root" ||
        toParent.isLoadMore ||
        fromParents[0].id === "__REACT_ARBORIST_INTERNAL_ROOT__"
      ) {
        return;
      }

      // A collection can't be nested inside another collection — reject before
      // the instant edit so the tree doesn't briefly show the nesting.
      if (draggedNodes[0].category && toParent.category) {
        setSnackbarMessage(
          "Collections can't be placed inside another collection.",
        );
        return;
      }

      // Drop pagination/loading fields and keep lazy flags so chevrons persist after edits
      const cleanTreeData = (data: PaginatedTreeData[]): TreeData[] => {
        return data
          .filter((node) => !node.isLoadMore && !node.isLoadingPlaceholder)
          .map((node) => {
            const {
              isLoadMore,
              isLoadingPlaceholder,
              parentId,
              totalChildren,
              loadedChildren,
              allChildren,
              isTopLoader,
              isBottomLoader,
              loadDirection,
              children,
              ...rest
            } = node;
            return {
              ...rest,
              children: children
                ? cleanTreeData(children as PaginatedTreeData[])
                : undefined,
            } as TreeData;
          });
      };

      // Snapshot the tree (deep — the instant edit splices shared nested
      // children arrays) and the viewed node, so a rejected write rolls back.
      const prevTreeData: PaginatedTreeData[] = JSON.parse(
        JSON.stringify(treeData),
      );
      const prevVisible = currentVisibleNode;
      const revert = () => {
        setTreeData(prevTreeData);
        if (onInstantTreeUpdate) {
          onInstantTreeUpdate(() => cleanTreeData(prevTreeData));
        }
        if (prevVisible && setCurrentVisibleNode) {
          setCurrentVisibleNode((cur: any) =>
            cur && cur.id === prevVisible.id ? prevVisible : cur,
          );
        }
      };

      // Local update for immediate visual feedback
      const newData = [...treeData];

      // Find dragged node's current visual position before removing it.
      // Match by tree `id` (unique): category rows all share the owning node's
      // `nodeId`, so matching on nodeId would resolve the wrong row.
      let draggedNodeVisualIndex = -1;
      if (args.parentNode?.children && args.dragNodes[0]) {
        for (let i = 0; i < args.parentNode.children.length; i++) {
          if (
            args.parentNode.children[i].data.id === args.dragNodes[0].data.id
          ) {
            draggedNodeVisualIndex = i;
            break;
          }
        }
      }

      // Remove node
      args.dragNodes.forEach((node) => {
        removeNode(newData, node.data.id);
      });

      // Calculate correct index for local update
      let localTargetIndex = args.index;
      if (args.parentNode?.children) {
        localTargetIndex = args.index;

        // When dragging down: removal shifts positions after the dragged node
        // When dragging up: removal doesn't affect positions before the dragged node
        if (
          draggedNodeVisualIndex >= 0 &&
          draggedNodeVisualIndex < args.index
        ) {
          localTargetIndex--; // adjust shift
        }
      }

      const targetParent = args.parentId
        ? findNode(newData, args.parentId)
        : { children: newData };

      args.dragNodes.forEach((node) => {
        targetParent?.children?.splice(localTargetIndex, 0, node.data);
      });
      setTreeData(newData);

      if (onInstantTreeUpdate) {
        onInstantTreeUpdate(() => cleanTreeData(newData));
      }

      // Collection reorder: sort endpoint
      if (draggedNodes[0].category) {
        // The owning node — args.parentId is a tree id, not the Firestore id.
        const parentNodeId = args.parentNode?.data?.nodeId;
        if (!parentNodeId) return;
        const nodeData = await ensureNodeDoc(parentNodeId);
        if (!nodeData) {
          revert();
          setSnackbarMessage("Could not load parent node; reorder not saved.");
          return;
        }
        const specializations: ICollection[] = JSON.parse(
          JSON.stringify(nodeData.specializations),
        );

        // Put the stored collections in the new visual order of the category
        // rows, keeping each collection's nodes as-is. "main" goes where its
        // direct children appear; any collection without a row is added at the
        // end so none are lost.
        const owningChildren = (targetParent?.children ||
          []) as PaginatedTreeData[];
        const order: string[] = [];
        let mainPlaced = false;
        for (const child of owningChildren) {
          if (child.category) {
            order.push((child.name || "").replace(/^\[|\]$/g, ""));
          } else if (!child.isLoadMore && !mainPlaced) {
            order.push("main");
            mainPlaced = true;
          }
        }
        const byName = new Map(
          specializations.map((c) => [c.collectionName, c]),
        );
        const newSpecializations: ICollection[] = [];
        for (const name of order) {
          const c = byName.get(name);
          if (c) {
            newSpecializations.push(c);
            byName.delete(name);
          }
        }
        for (const c of byName.values()) newSpecializations.push(c);

        if (setCurrentVisibleNode && currentVisibleNode?.id === parentNodeId) {
          setCurrentVisibleNode((prev: any) =>
            prev && prev.id === parentNodeId
              ? { ...prev, specializations: newSpecializations }
              : prev,
          );
        }

        pendingWrites.start(parentNodeId, "specializations");
        try {
          await Post("/nodes/hierarchy/sort", {
            nodeId: parentNodeId,
            side: "specializations",
            value: newSpecializations,
            sortType: "collections",
            ...(appName ? { appName } : {}),
          });
        } catch (error: any) {
          revert();
          setSnackbarMessage(
            `Failed to reorder collections: ${
              (typeof error === "string" ? error : error?.message) ||
              "Please try again."
            }`,
          );
          recordLogs({
            type: "error",
            error: JSON.stringify({
              name: error?.name,
              message: typeof error === "string" ? error : error?.message,
              stack: error?.stack,
            }),
            at: "handleMove/sort-collections",
          });
        } finally {
          pendingWrites.end(parentNodeId, "specializations");
        }
        return;
      }

      if (toParent.nodeId === fromParents[0].nodeId) {
        const nodeData = await ensureNodeDoc(toParent.nodeId);
        if (!nodeData) {
          revert();
          setSnackbarMessage("Could not load parent node; reorder not saved.");
          return;
        }

        let from = "main";
        if (fromParents[0].category) {
          from = fromParents[0].name.replace(/^\[|\]$/g, "");
        }
        let to = "main";
        if (toParent.category) {
          to = toParent.name.replace(/^\[|\]$/g, "");
        }

        const specializations: ICollection[] = JSON.parse(
          JSON.stringify(nodeData.specializations),
        );
        const fromCollectionIdx = specializations.findIndex(
          (s) => s.collectionName === from,
        );
        const toCollectionIdx = specializations.findIndex(
          (s) => s.collectionName === to,
        );
        if (fromCollectionIdx === -1 || toCollectionIdx === -1) {
          revert();
          return;
        }

        if (from === to) {
          // SAME COLLECTION REORDERING
          const currentIndex = specializations[
            fromCollectionIdx
          ].nodes.findIndex((n) => n.id === draggedNodes[0].nodeId);
          if (currentIndex === -1) {
            revert();
            return;
          }
          const [movedNode] = specializations[fromCollectionIdx].nodes.splice(
            currentIndex,
            1,
          );

          let visualIndex = -1;
          if (args.parentNode?.children) {
            for (let i = 0; i < args.parentNode.children.length; i++) {
              if (
                args.parentNode.children[i].data.nodeId ===
                draggedNodes[0].nodeId
              ) {
                visualIndex = i;
                break;
              }
            }
          }

          let categoryCount = 0;
          if (args.parentNode?.children) {
            for (
              let i = 0;
              i < args.index && i < args.parentNode.children.length;
              i++
            ) {
              const child = args.parentNode.children[i];
              if (child.data.category || child.data.isLoadMore) {
                categoryCount++;
              }
            }
          }

          let firestoreSpliceIndex = args.index - categoryCount;
          if (visualIndex >= 0 && visualIndex < args.index) {
            firestoreSpliceIndex--; // dragging down is adjusted for shifted array
          }
          specializations[fromCollectionIdx].nodes.splice(
            firestoreSpliceIndex,
            0,
            movedNode,
          );
        } else {
          // CROSS COLLECTION
          specializations[fromCollectionIdx].nodes = specializations[
            fromCollectionIdx
          ].nodes.filter((n) => n.id !== draggedNodes[0].nodeId);

          let categoryCount = 0;
          if (args.parentNode?.children) {
            for (
              let i = 0;
              i < args.index && i < args.parentNode.children.length;
              i++
            ) {
              const child = args.parentNode.children[i];
              if (child.data.category || child.data.isLoadMore) {
                categoryCount++;
              }
            }
          }
          const toFirestoreIndex = args.index - categoryCount;
          specializations[toCollectionIdx].nodes.splice(toFirestoreIndex, 0, {
            id: draggedNodes[0].nodeId,
            title: nodes[draggedNodes[0].nodeId]?.title ?? "",
          });
        }

        if (setCurrentVisibleNode && currentVisibleNode?.id === toParent.nodeId) {
          setCurrentVisibleNode((prev: any) =>
            prev && prev.id === toParent.nodeId
              ? { ...prev, specializations }
              : prev,
          );
        }

        pendingWrites.start(toParent.nodeId, "specializations");
        try {
          await Post("/nodes/hierarchy/sort", {
            nodeId: toParent.nodeId,
            side: "specializations",
            value: specializations,
            sortType: "elements",
            ...(appName ? { appName } : {}),
          });
        } catch (error: any) {
          revert();
          setSnackbarMessage(
            `Failed to reorder: ${
              (typeof error === "string" ? error : error?.message) ||
              "Please try again."
            }`,
          );
          recordLogs({
            type: "error",
            error: JSON.stringify({
              name: error?.name,
              message: typeof error === "string" ? error : error?.message,
              stack: error?.stack,
            }),
            at: "handleMove/sort-elements",
          });
        } finally {
          pendingWrites.end(toParent.nodeId, "specializations");
        }
        return;
      }

      // ── Cross-parent relocation → move endpoint ──
      const generalizationId = fromParents[0].nodeId;
      const specializationId = draggedNodes[0].nodeId;
      const toCollectionName = toParent.category
        ? toParent.name.replace(/^\[|\]$/g, "")
        : "main";

      pendingWrites.start(specializationId, "generalizations");
      try {
        await Post("/nodes/hierarchy/move", {
          nodeId: specializationId,
          fromParentId: generalizationId,
          toParentId: toParent.nodeId,
          toCollectionName,
          ...(appName ? { appName } : {}),
        });
        setSnackbarMessage(
          `Node${draggedNodes.length > 1 ? "s" : ""} has been moved to ${toParent.name}`,
        );
        // If the detail panel shows one of the affected nodes, refresh it —
        // the move changed its generalizations or specializations server-side.
        const viewedId = currentVisibleNode?.id;
        if (
          fetchNode &&
          setCurrentVisibleNode &&
          (viewedId === specializationId ||
            viewedId === generalizationId ||
            viewedId === toParent.nodeId)
        ) {
          const fresh = await fetchNode(viewedId, true);
          if (fresh) {
            setCurrentVisibleNode((cur: any) =>
              cur?.id === fresh.id ? fresh : cur,
            );
          }
        }
      } catch (error: any) {
        revert();
        setSnackbarMessage(
          `Failed to move "${nodes[specializationId]?.title ?? "node"}": ${
            (typeof error === "string" ? error : error?.message) ||
            "Please try again."
          }`,
        );
        recordLogs({
          type: "error",
          error: JSON.stringify({
            name: error?.name,
            message: typeof error === "string" ? error : error?.message,
            stack: error?.stack,
          }),
          at: "handleMove/move",
        });
      } finally {
        pendingWrites.end(specializationId, "generalizations");
      }
    } catch (error) {
      console.error(error);
    }
  };
  // const generateDomElementId = (node: NodeApi<PaginatedTreeData>): string => {
  //   const { id } = node.data;
  //   const isRootNode = node.level === 0;

  //   // Prefix root nodes to prevent browser hash auto-scrolling
  //   return isRootNode ? `tree-root-${id}` : id;
  // };

  function Node({
    node,
    style,
    dragHandle,
  }: NodeRendererProps<PaginatedTreeData>) {
    const indentSize = Number.parseFloat(`${style.paddingLeft || 0}`);
    const inputRef = useRef<HTMLInputElement>(null);
    const isLoading = loadingStates.has(node.data.id);
    const isActiveNode =
      node.data.nodeId === currentVisibleNode?.id && !node.data.category;

    if (node.data.isLoadingPlaceholder) {
      const width = node.data.id.endsWith("-1")
        ? "74%"
        : node.data.id.endsWith("-2")
          ? "58%"
          : "66%";
      return (
        <Box
          style={style}
          className={clsx(styles.node, styles.loadMoreNode)}
          id={node.data.id}
          sx={{
            px: 0.75,
            py: 0.35,
            display: "flex",
            alignItems: "center",
            gap: 1,
            opacity: 0.95,
            borderLeft: "2px solid transparent",
          }}
        >
          <Box className={styles.indentLines}>
            {new Array(indentSize / INDENT_STEP).fill(0).map((_, index) => {
              return <div key={index}></div>;
            })}
          </Box>
          <Box sx={{ flex: 1, pr: 1 }}>
            <Skeleton
              animation="wave"
              variant="rounded"
              height={16}
              width={width}
              sx={{
                borderRadius: "8px",
                bgcolor: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(0,0,0,0.08)",
              }}
            />
          </Box>
        </Box>
      );
    }

    if (node.data.isLoadMore) {
      let displayText = "•••";

      return (
        <Tooltip
          title={node.data.name}
          arrow
          placement="top"
          slotProps={{
            popper: {
              sx: {
                "& .MuiTooltip-tooltip": {
                  backgroundColor: (theme) =>
                    theme.palette.mode === "dark" ? "#424242" : "#616161",
                  color: "#fff",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  borderRadius: "8px",
                  padding: "8px 12px",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
                },
                "& .MuiTooltip-arrow": {
                  color: (theme) =>
                    theme.palette.mode === "dark" ? "#424242" : "#616161",
                },
              },
            },
          }}
        >
          <Box
            style={style}
            className={clsx(styles.node, styles.loadMoreNode)}
            id={node.data.id}
            onClick={() => !isLoading && handleLoadMore(node.data.id)}
            sx={{
              cursor: isLoading ? "default" : "pointer",
              transition: "background-color 0.2s ease",
              borderRadius: "8px",
              minHeight: "24px",
              px: 0.75,
              userSelect: "none",
              borderLeft: "2px solid transparent",
              "&:hover": {
                backgroundColor: isLoading
                  ? "transparent"
                  : "rgba(255, 165, 0, 0.08)",
              },
              "&:active": {
                backgroundColor: isLoading
                  ? "transparent"
                  : "rgba(255, 165, 0, 0.12)",
              },
            }}
          >
            <Box className={styles.indentLines}>
              {new Array(indentSize / INDENT_STEP).fill(0).map((_, index) => {
                return <div key={index}></div>;
              })}
            </Box>
            <FolderArrow node={node as NodeApi<PaginatedTreeData>} />
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                color: isLoading
                  ? "rgba(255, 165, 0, 0.45)"
                  : "rgba(255, 165, 0, 0.7)",
                fontSize: "16px",
                fontWeight: 700,
                transition: "all 0.2s ease-in-out",
                ".loadMoreNode:hover &": {
                  color: isLoading ? "rgba(255, 165, 0, 0.45)" : "#ff9800",
                },
              }}
            >
              {isLoading ? (
                <Box
                  sx={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid rgba(255, 165, 0, 0.3)",
                    borderTop: "2px solid rgba(255, 165, 0, 0.8)",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                    "@keyframes spin": {
                      "0%": { transform: "rotate(0deg)" },
                      "100%": { transform: "rotate(360deg)" },
                    },
                  }}
                />
              ) : (
                displayText
              )}
            </Box>
          </Box>
        </Tooltip>
      );
    }

    return (
      <Box
        ref={dragHandle}
        style={style}
        className={clsx(styles.node, styles.treeNode, node.state, {
          [styles.activeNode]: isActiveNode,
        })}
        id={node.data.id}
      >
        <Box className={styles.indentLines}>
          {new Array(indentSize / INDENT_STEP).fill(0).map((_, index) => {
            return <div key={index}></div>;
          })}
        </Box>
        <Box
          className={clsx(styles.arrowHitbox, {
            [styles.clickableArrow]: node.isInternal,
          })}
          onClick={(e) => {
            if (node.isInternal) {
              e.stopPropagation();
              const wasOpen = node.isOpen;
              node.toggle();
              if (!wasOpen) {
                ensureExpandedWithLazyLoad(node);
              }
            }
          }}
        >
          <FolderArrow node={node} />
        </Box>
        <Box className={styles.labelContainer}>
          <span
            className={clsx(styles.text, {
              [styles.categoryText]: node.data.category,
            })}
          >
            {node.isEditing ? (
              <Input node={node} inputRef={inputRef} />
            ) : (
              <span
                className={clsx(styles.nodeLabel, {
                  [styles.mutedLabel]: node.data.task || node.data.comments,
                  [styles.categoryLabel]: node.data.category,
                })}
              >
                <span className={styles.nodeTitle}>{node.data.name}</span>
                {!node.data.category &&
                  nodesWithComments.has(node.data.nodeId) && (
                    <Tooltip title="You have unread comments" arrow>
                      <ChatIcon className={styles.commentIcon} />
                    </Tooltip>
                  )}
                {specializationNumsUnder[node.data.id] > 0 && (
                  <Tooltip
                    title={`Total number of ${node.data.name.toLowerCase() === "act" ? "activities" : "entities"} under this sub-ontology`}
                    arrow
                  >
                    <Box component="span" className={styles.countBadge}>
                      {specializationNumsUnder[node.data.id]}
                    </Box>
                  </Tooltip>
                )}
                {specializationNumsUnder[`${node.data.id}-extra`] > 0 && (
                  <Tooltip
                    title={
                      "Total number of O*Net tasks under this sub-ontology"
                    }
                    arrow
                  >
                    <Box component="span" className={styles.countBadge}>
                      {specializationNumsUnder[`${node.data.id}-extra`]}
                    </Box>
                  </Tooltip>
                )}
                {(node.data.actionAlternatives || []).length > 0 && (
                  <Box component="span" className={styles.alternativesLabel}>
                    Alternatives:
                  </Box>
                )}
                {(node.data.actionAlternatives || []).length > 0 && (
                  <Box component="span" className={styles.alternativesText}>
                    {(node.data.actionAlternatives || []).join(", ")}
                  </Box>
                )}
              </span>
            )}
          </span>
        </Box>
      </Box>
    );
  }

  return (
    <Box className={styles.container}>
      {treeType !== "oNet" && userHasOntologyEditAccess(user, appName) && (
        <Box
          sx={{
            position: "sticky",
            top: 0,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            zIndex: 1,
            width: "95%",
            backgroundColor: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(48, 49, 52, 0.96)"
                : "#eef2f7",
            border: "1px solid",
            borderColor: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(255,255,255,0.08)"
                : "rgba(15, 23, 42, 0.08)",
            borderRadius: "10px",
            px: "8px",
            py: "8px",
            my: "6px",
            gap: 1,
            mx: "5px",
          }}
        >
          <ToggleButton
            value="edit"
            selected={editEnabled}
            onChange={() => setEditEnabled((prev: boolean) => !prev)}
            aria-label="Toggle edit mode"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              borderRadius: "25px",
              px: 2.5,
              py: 0.2,
              fontWeight: 500,
              fontSize: "0.95rem",
              textTransform: "none",
              border: "1.5px solid orange",
              transition: "all 0.2s ease-in-out",
              bgcolor: (theme) =>
                theme.palette.mode === "dark" ? "#2b2b2b" : "#f8fafc",
              color: (theme) =>
                theme.palette.mode === "dark" ? "#f5f5f5" : "#1f2937",
              "&:hover": {
                bgcolor: (theme) =>
                  theme.palette.mode === "dark" ? "#3a3a3a" : "#eef2f7",
              },
              "&.Mui-selected": {
                bgcolor: "orange",
                color: "#fff",
                "&:hover": {
                  bgcolor: "#d17b00",
                },
              },
            }}
          >
            {editEnabled ? (
              <EditIcon fontSize="small" />
            ) : (
              <EditOffIcon fontSize="small" />
            )}
            Edit Outline: {editEnabled ? "On" : "Off"}
          </ToggleButton>
        </Box>
      )}
      <Box className={styles.split}>
        <Box
          className={styles.treeContainer}
          sx={{
            ...treeThemeVars,
            backgroundColor: (theme) =>
              theme.palette.mode === "dark" ? "#2f3136" : "#eef2f7",
            border: "1px solid",
            borderColor: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(255,255,255,0.08)"
                : "rgba(15, 23, 42, 0.08)",
            borderRadius: "10px",
            overflow: "hidden",
          }}
        >
          <FillFlexParent>
            {(dimens) => (
              <Tree
                {...dimens}
                ref={treeRef}
                data={treeData}
                onMove={handleMove}
                selectionFollowsFocus={false}
                disableMultiSelection
                // ref={(t) => setTree(t)}   ref={treeRef}
                openByDefault={false}
                searchTerm={searchTerm}
                className={styles.tree}
                rowClassName={styles.row}
                rowHeight={30}
                paddingTop={2}
                indent={INDENT_STEP}
                overscanCount={50}
                // onSelect={(selected) => setSelectedCount(selected.length)}
                onActivate={(node) => {
                  if (node.data.category) {
                    const wasOpen = node.isOpen;
                    node.toggle();
                    if (!wasOpen) {
                      ensureExpandedWithLazyLoad(node as any);
                    }
                    return;
                  }
                  if (node.data.isLoadMore) {
                    return;
                  }
                  isTreeClickRef.current = true;
                  treeActivatedNodeIdRef.current = node.data.nodeId;
                  onOpenNodesTree(node.data.nodeId, node.data.name);
                  // Selecting a node should also expand it (and lazy-load children if needed).
                  if (!node.isOpen) {
                    ensureExpandedWithLazyLoad(node as any);
                  }
                }}
                disableDrag={!editEnabled}
                disableDrop={!editEnabled}
                // onScroll={}
                // onMove={handleMove}
              >
                {Node}
              </Tree>
            )}
          </FillFlexParent>
        </Box>
      </Box>
    </Box>
  );
}
export default DraggableTree;

function Input({
  node,
  inputRef,
}: {
  node: NodeApi<PaginatedTreeData>;
  inputRef: React.RefObject<HTMLInputElement>;
}) {
  return (
    <input
      ref={inputRef}
      autoFocus
      name="name"
      type="text"
      defaultValue={node.data.name}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => node.reset()}
      onKeyDown={(e) => {
        if (e.key === "Escape") node.reset();
        if (e.key === "Enter") node.submit(e.currentTarget.value);
      }}
      style={{
        width: "100%",
      }}
    />
  );
}

function FolderArrow({ node }: { node: NodeApi<PaginatedTreeData> }) {
  const hasChildren = node.isInternal && (node.children || []).length > 0;
  const hasUnresolvedChildren = (node.data as any).hasUnresolvedChildren;

  return (
    <span className={styles.arrow}>
      {node.isInternal && (hasChildren || hasUnresolvedChildren) ? (
        node.isOpen && hasChildren ? (
          <KeyboardArrowDownIcon sx={{ fontSize: "1.1rem" }} />
        ) : (
          <KeyboardArrowRightIcon sx={{ fontSize: "1.1rem" }} />
        )
      ) : null}
    </span>
  );
}
