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

import {
  saveNewChangeLog,
  unlinkPropertyOf,
  updateLinksForInheritance,
} from "@components/lib/utils/helpers";
import { collection, doc, getFirestore, updateDoc } from "firebase/firestore";
import { ICollection, TreeData } from "@components/types/INode";
import { NODES } from "@components/lib/firestoreClient/collections";
import { useAuth } from "../context/AuthContext";
import { FillFlexParent } from "./fill-flex-parent";
import { triggerUpdateDerivedPaths } from "@components/lib/utils/triggerUpdateDerivedPaths";

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
  onOpenNodesTree,
  treeRef,
  treeType,
  skillsFuture = false,
  specializationNumsUnder,
  skillsFutureApp,
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
  onOpenNodesTree: any;
  treeRef: any;
  treeType?: string;
  skillsFuture?: boolean;
  specializationNumsUnder: { [key: string]: number };
  skillsFutureApp: string;
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

        // Always render all children directly (no pagination "Show … more" nodes).
        if (node.children) processedNode.children = [...node.children];

        if (processedNode.children) {
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
    const rafId = requestAnimationFrame(() => {
      expandNodeById(targetNodeId);

      // Select and scroll to the target node
      const paths = nodePathIndex.get(targetNodeId);
      if (paths && paths.length > 0) {
        // Select the first occurrence found
        const treeId = paths[0][paths[0].length - 1];
        tree.select(treeId, { align: "auto" });
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

  const moveElement = (
    arr: ICollection[],
    fromIndex: number,
    toIndex: number,
  ) => {
    if (
      fromIndex < 0 ||
      fromIndex >= arr.length ||
      toIndex < 0 ||
      toIndex >= arr.length
    ) {
      throw new Error("Invalid indices");
    }

    const element = arr.splice(fromIndex, 1)[0];
    arr.splice(toIndex, 0, element);

    return arr;
  };
  const handleMove = async (args: {
    dragIds: string[];
    dragNodes: NodeApi<PaginatedTreeData>[];
    parentId: string | null;
    parentNode: NodeApi<PaginatedTreeData> | null;
    index: number;
  }) => {
    try {
      if (!editEnabled || !user?.uname) return;

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

      // Local update for immediate visual feedback
      const newData = [...treeData];

      // Find dragged node's current visual position before removing it
      let draggedNodeVisualIndex = -1;
      if (args.parentNode?.children && args.dragNodes[0]) {
        for (let i = 0; i < args.parentNode.children.length; i++) {
          if (
            args.parentNode.children[i].data.nodeId ===
            args.dragNodes[0].data.nodeId
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

      // Update shared tree state with local update to prevent glitch when treeViewData updates
      if (onInstantTreeUpdate) {
        // Clean the newData to remove pagination properties
        const cleanTreeData = (data: PaginatedTreeData[]): TreeData[] => {
          return data
            .filter((node) => !node.isLoadMore)
            .map((node) => ({
              id: node.id,
              nodeId: node.nodeId,
              name: node.name,
              nodeType: node.nodeType,
              category: node.category,
              unclassified: node.unclassified,
              children: node.children
                ? cleanTreeData(node.children)
                : undefined,
            }));
        };

        onInstantTreeUpdate(() => cleanTreeData(newData));
      }

      if (draggedNodes[0].category) {
        const parentId = args.parentId;
        if (parentId) {
          const nodeRef = doc(collection(db, NODES), parentId);
          const nodeData = nodes[parentId];
          const specializations = nodeData.specializations;
          const previousValue = JSON.parse(JSON.stringify(specializations));
          const draggedElement = args.dragIds[0];
          const index = draggedElement.indexOf("-");
          const draggedCollection = draggedElement.substring(index + 1);
          const fromIndex = specializations.findIndex(
            (c: ICollection) => c.collectionName === draggedCollection,
          );
          const newSpecializations = moveElement(
            specializations,
            fromIndex,
            args.index,
          );
          await updateDoc(nodeRef, { specializations: newSpecializations });
          saveNewChangeLog(db, {
            nodeId: parentId,
            modifiedBy: user?.uname,
            modifiedProperty: "specializations",
            previousValue,
            newValue: newSpecializations,
            modifiedAt: new Date(),
            changeType: "sort collections",
            fullNode: nodes[parentId],
            skillsFuture,
            appName: skillsFutureApp,
            ...(skillsFutureApp ? { appName: skillsFutureApp } : {}),
          });
        }
        return;
      }

      if (toParent.nodeId === fromParents[0].nodeId) {
        const nodeRef = doc(collection(db, NODES), toParent.nodeId);
        const nodeData = nodes[toParent.nodeId];

        // Determine source and target collection names
        let from = "main";
        if (fromParents[0].category) {
          from = fromParents[0].name.replace(/^\[|\]$/g, "");
        }
        let to = "main";
        if (toParent.category) {
          to = toParent.name.replace(/^\[|\]$/g, "");
        }

        const specializations = nodeData.specializations;
        const previousValue = JSON.parse(JSON.stringify(specializations));

        // Find collection indices
        const fromCollectionIdx = specializations.findIndex(
          (s: ICollection) => s.collectionName === from,
        );
        const toCollectionIdx = specializations.findIndex(
          (s: ICollection) => s.collectionName === to,
        );

        if (fromCollectionIdx === -1 || toCollectionIdx === -1) {
          return;
        }

        if (from === to) {
          // SAME COLLECTION REORDERING
          const currentIndex = specializations[
            fromCollectionIdx
          ].nodes.findIndex(
            (n: { id: string }) => n.id === draggedNodes[0].nodeId,
          );

          if (currentIndex === -1) {
            console.error(
              "[HANDLE MOVE] Node not found in collection:",
              draggedNodes[0].nodeId,
            );
            return;
          }

          const [movedNode] = specializations[fromCollectionIdx].nodes.splice(
            currentIndex,
            1,
          );

          // Find dragged node's position for adjustment
          let draggedNodeVisualIndex = -1;
          if (args.parentNode?.children) {
            for (let i = 0; i < args.parentNode.children.length; i++) {
              if (
                args.parentNode.children[i].data.nodeId ===
                draggedNodes[0].nodeId
              ) {
                draggedNodeVisualIndex = i;
                break;
              }
            }
          }

          // Count category/load-more nodes before args.index
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

          // Calculate target index for Firestore array
          let firestoreTargetIndex = args.index - categoryCount;

          // Dragging down operation needs to be adjusted
          let firestoreSpliceIndex = firestoreTargetIndex;
          if (
            draggedNodeVisualIndex >= 0 &&
            draggedNodeVisualIndex < args.index
          ) {
            firestoreSpliceIndex--; // Dragging down - adjust for shifted array
          }

          // Insert at calculated position
          specializations[fromCollectionIdx].nodes.splice(
            firestoreSpliceIndex,
            0,
            movedNode,
          );

          await updateDoc(nodeRef, { specializations });

          saveNewChangeLog(db, {
            nodeId: toParent.nodeId,
            modifiedBy: user?.uname,
            modifiedProperty: "specializations",
            previousValue,
            newValue: specializations,
            modifiedAt: new Date(),
            changeType: "sort elements",
            fullNode: nodes[toParent.nodeId],
            skillsFuture,
            ...(skillsFutureApp ? { appName: skillsFutureApp } : {}),
          });
          return;
        } else {
          // CROSS COLLECTION MOVE

          // Find current index in SOURCE collection
          let originalFromIndex = 0;
          if (fromCollectionIdx !== -1) {
            originalFromIndex = specializations[
              fromCollectionIdx
            ].nodes.findIndex(
              (n: { id: string }) => n.id === draggedNodes[0].nodeId,
            );

            // Remove from source collection
            specializations[fromCollectionIdx].nodes = specializations[
              fromCollectionIdx
            ].nodes.filter(
              (n: { id: string }) => n.id !== draggedNodes[0].nodeId,
            );
          }

          // Count category/load-more nodes before args.index in target collection
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

          // Calculate target index
          let toFirestoreIndex = args.index - categoryCount;

          // Insert into target collection
          specializations[toCollectionIdx].nodes.splice(toFirestoreIndex, 0, {
            id: draggedNodes[0].nodeId,
            title: nodes[draggedNodes[0].nodeId]?.title ?? "",
          });

          await updateDoc(nodeRef, { specializations });

          saveNewChangeLog(db, {
            nodeId: toParent.nodeId,
            modifiedBy: user?.uname,
            modifiedProperty: "specializations",
            previousValue,
            newValue: specializations,
            modifiedAt: new Date(),
            changeType: "sort elements",
            fullNode: nodes[toParent.nodeId],
            skillsFuture,
            ...(skillsFutureApp ? { appName: skillsFutureApp } : {}),
          });
          return;
        }
      }

      setSnackbarMessage(
        `Node${draggedNodes.length > 1 ? "s" : ""} has been moved to ${toParent.name}`,
      );
      // if (draggedNodes[0].category) {
      //   return;
      //   /*  updateLinksForInheritance(
      //   db,
      //   specializationId,
      //   addedLinks,
      //   removedLinks,
      //   specializationData,
      //   newLinks,
      //   nodes,
      // ); */
      // } else {
      const generalizationId = fromParents[0].nodeId;
      const addedLinks = [toParent.nodeId];
      const removedLinks = [generalizationId];
      const specializationId = draggedNodes[0].nodeId;
      const specializationData = nodes[specializationId];
      const newLinks = [toParent.nodeId];

      const newGeneralizations = nodes[specializationId].generalizations;
      const previousValue = JSON.parse(JSON.stringify(newGeneralizations));

      newGeneralizations[0].nodes = newGeneralizations[0].nodes.filter(
        (n: { id: string }) => n.id !== generalizationId,
      );

      newGeneralizations[0].nodes.push({
        id: toParent.nodeId,
        title: nodes[toParent.nodeId]?.title ?? "",
      });

      const docRef = doc(collection(db, NODES), specializationId);

      await updateDoc(docRef, {
        generalizations: newGeneralizations,
      });

      for (let linkId of removedLinks) {
        await unlinkPropertyOf(db, "generalizations", specializationId, linkId);
      }

      const newGeneralizationData = nodes[toParent.nodeId];
      const specializations = newGeneralizationData.specializations;
      const previousSValue = JSON.parse(JSON.stringify(specializations));

      const alreadyExist = newGeneralizationData.specializations
        .flatMap((c: ICollection) => c.nodes)
        .map((n: { id: string }) => n.id);

      if (!alreadyExist.includes(specializationId)) {
        let targetCollectionIndex = 0;

        if (toParent.category) {
          targetCollectionIndex = specializations.findIndex(
            (s: ICollection) => s.collectionName === toParent.name,
          );
        } else {
          const mainCollectionIndex = specializations.findIndex(
            (s: ICollection) => s.collectionName === "main",
          );

          if (mainCollectionIndex !== -1) {
            targetCollectionIndex = mainCollectionIndex;
          }
        }

        if (targetCollectionIndex === -1) {
          targetCollectionIndex = 0;
        }

        specializations[targetCollectionIndex].nodes.splice(args.index, 0, {
          id: specializationId,
          title: nodes[specializationId]?.title ?? "",
        });

        await updateDoc(doc(collection(db, NODES), toParent.nodeId), {
          specializations,
        });
      }
      /* Specialization Change Log */
      saveNewChangeLog(db, {
        nodeId: specializationId,
        modifiedBy: user?.uname,
        modifiedProperty: "generalizations",
        previousValue,
        newValue: newGeneralizations,
        modifiedAt: new Date(),
        changeType: "modify elements",
        fullNode: nodes[specializationId],
        skillsFuture,
        ...(skillsFutureApp ? { appName: skillsFutureApp } : {}),
      });

      saveNewChangeLog(db, {
        nodeId: toParent.nodeId,
        modifiedBy: user?.uname,
        modifiedProperty: "specializations",
        previousValue: previousSValue,
        newValue: specializations,
        modifiedAt: new Date(),
        changeType: "modify elements",
        fullNode: nodes[toParent.nodeId],
        skillsFuture,
        ...(skillsFutureApp ? { appName: skillsFutureApp } : {}),
      });

      // await updateLinks(
      //   newLinks,
      //   { id: specializationId },
      //   "specializations",
      //   nodes,
      //   db,
      // );
      const currentNewLinks = newGeneralizations[0].nodes;
      await updateLinksForInheritance(
        db,
        specializationId,
        addedLinks.map((id) => {
          return { id };
        }),
        currentNewLinks,
        specializationData,
        nodes,
      );
      await triggerUpdateDerivedPaths([
        specializationId,
        toParent.nodeId,
        generalizationId,
      ]);
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
          onClick={(e) => {
            e.stopPropagation();
            if (!node.isInternal) return;
            const opening = !node.isOpen;
            node.toggle();
            node.select();
            if (opening) {
              ensureExpandedWithLazyLoad(node);
            }
          }}
          className={clsx(styles.arrowHitbox, {
            [styles.clickableArrow]: node.isInternal,
          })}
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
      {treeType !== "oNet" && user?.claims.editAccess && (
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
                    const opening = !node.isOpen;
                    node.toggle();
                    if (opening) {
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
                  ensureExpandedWithLazyLoad(node as any);
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

function FolderArrow({ node }: { node: NodeApi<TreeData> }) {
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

function findNode(
  data: PaginatedTreeData[],
  id: string,
): PaginatedTreeData | null {
  for (const node of data) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

function removeNode(data: PaginatedTreeData[], id: string): boolean {
  for (let i = 0; i < data.length; i++) {
    if (data[i].id === id) {
      data.splice(i, 1);
      return true;
    }
    if (data[i].children && removeNode(data[i].children!, id)) {
      return true;
    }
  }
  return false;
}
