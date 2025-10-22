import clsx from "clsx";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { NodeApi, NodeRendererProps, Tree, TreeApi } from "react-arborist";
import SyncAltIcon from "@mui/icons-material/SyncAlt";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import styles from "./drag.tree.module.css";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import {
  Box,
  Button,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import EditOffIcon from "@mui/icons-material/EditOff";

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
import { Post } from "@components/lib/utils/Post";

const INDENT_STEP = 15;
const INITIAL_LOAD_COUNT = 6;
const LOAD_MORE_COUNT = 20;

interface PaginatedTreeData extends TreeData {
  isLoadMore?: boolean;
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
  eachOntologyPath,
  multipleOntologyPaths,
  skillsFuture = false,
  specializationNumsUnder,
  skillsFutureApp,
}: {
  treeViewData?: any;
  setSnackbarMessage: any;
  nodes?: any;
  currentVisibleNode?: any;
  onOpenNodesTree: any;
  treeRef: any;
  treeType?: string;
  eachOntologyPath: any;
  multipleOntologyPaths: any;
  skillsFuture?: boolean;
  specializationNumsUnder: { [key: string]: number };
  skillsFutureApp: string;
}) {
  const db = getFirestore();
  const [{ user }] = useAuth();
  const [focused, setFocused] = useState<PaginatedTreeData | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [count, setCount] = useState(0);
  const [followsFocus, setFollowsFocus] = useState(false);
  const [disableMulti, setDisableMulti] = useState(true);
  const [treeData, setTreeData] = useState<PaginatedTreeData[]>([]);
  const [editEnabled, setEditEnabled] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [loadingStates, setLoadingStates] = useState<Set<string>>(new Set());
  const [paginationState, setPaginationState] = useState<Map<string, number>>(
    new Map(),
  );
  const [focusedWindowState, setFocusedWindowState] = useState<
    Map<string, { startIndex: number; endIndex: number }>
  >(new Map());
  const collapsingLoader = useRef<boolean>(false);
  const isTreeClickRef = useRef(false);

  const getFocusedNodeWindow = useCallback(
    (children: TreeData[], focusedNodeId: string): TreeData[] => {
      const focusedIndex = children.findIndex(
        (child) => child.nodeId === focusedNodeId || child.id === focusedNodeId,
      );
      if (focusedIndex === -1) return children;

      const startIndex = Math.max(
        0,
        focusedIndex - Math.floor(INITIAL_LOAD_COUNT / 2),
      );
      const endIndex = Math.min(
        children.length,
        startIndex + INITIAL_LOAD_COUNT,
      );

      return children.slice(startIndex, endIndex);
    },
    [],
  );

  const processTreeData = useCallback(
    (data: TreeData[]): PaginatedTreeData[] => {
      return data.map((node) => {
        const processedNode: PaginatedTreeData = {
          ...node,
          allChildren: node.children ? [...node.children] : undefined,
        };

        if (
          node.children &&
          node.children.length > INITIAL_LOAD_COUNT &&
          node.unclassified
        ) {
          const hasCurrentVisibleNode =
            currentVisibleNode?.id &&
            node.children.some(
              (child) => child.nodeId === currentVisibleNode.id,
            );
          const focusedWindow = focusedWindowState.get(node.id);

          if (hasCurrentVisibleNode) {
            let actualStartIndex, actualEndIndex;

            if (focusedWindow) {
              actualStartIndex = focusedWindow.startIndex;
              actualEndIndex = focusedWindow.endIndex;
            } else {
              const focusedIndex = node.children.findIndex(
                (child) => child.nodeId === currentVisibleNode.id,
              );
              actualStartIndex = Math.max(
                0,
                focusedIndex - Math.floor(INITIAL_LOAD_COUNT / 2),
              );
              actualEndIndex = Math.min(
                node.children.length,
                actualStartIndex + INITIAL_LOAD_COUNT,
              );
            }

            const visibleChildren = node.children.slice(
              actualStartIndex,
              actualEndIndex,
            );
            processedNode.children = [...visibleChildren];

            if (actualStartIndex > 0) {
              const topLoadMoreNode: PaginatedTreeData = {
                id: `${node.id}-load-more-top`,
                name: `Show ${Math.min(actualStartIndex, LOAD_MORE_COUNT)} more specializations`,
                isLoadMore: true,
                isTopLoader: true,
                parentId: node.id,
                totalChildren: node.children.length,
                loadedChildren: INITIAL_LOAD_COUNT,
                loadDirection: "top",
                nodeType: "load-more",
                nodeId: `${node.id}-load-more-top`,
              };
              processedNode.children.unshift(topLoadMoreNode);
            }

            if (actualEndIndex < node.children.length) {
              const remainingCount = node.children.length - actualEndIndex;
              const bottomLoadMoreNode: PaginatedTreeData = {
                id: `${node.id}-load-more-bottom`,
                name: `Show ${Math.min(remainingCount, LOAD_MORE_COUNT)} more specializations`,
                isLoadMore: true,
                isBottomLoader: true,
                parentId: node.id,
                totalChildren: node.children.length,
                loadedChildren: INITIAL_LOAD_COUNT,
                loadDirection: "bottom",
                nodeType: "load-more",
                nodeId: `${node.id}-load-more-bottom`,
              };
              processedNode.children.push(bottomLoadMoreNode);
            }
          } else {
            const loadedCount =
              paginationState.get(node.id) || INITIAL_LOAD_COUNT;

            if (loadedCount === -1) {
              processedNode.children = [...node.children];
            } else {
              const visibleChildren = node.children.slice(0, loadedCount);
              const remainingCount = node.children.length - loadedCount;

              processedNode.children = [...visibleChildren];

              if (remainingCount > 0) {
                const loadMoreNode: PaginatedTreeData = {
                  id: `${node.id}-load-more`,
                  name: `Show ${Math.min(remainingCount, LOAD_MORE_COUNT)} more specializations`,
                  isLoadMore: true,
                  parentId: node.id,
                  totalChildren: node.children.length,
                  loadedChildren: loadedCount,
                  nodeType: "load-more",
                  nodeId: `${node.id}-load-more`,
                };
                processedNode.children.push(loadMoreNode);
              }
            }
          }
        } else if (node.children) {
          processedNode.children = [...node.children];
        }

        if (processedNode.children) {
          processedNode.children = processTreeData(processedNode.children);
        }

        return processedNode;
      });
    },
    [
      paginationState,
      currentVisibleNode,
      getFocusedNodeWindow,
      focusedWindowState,
    ],
  );

  const handleLoadMore = useCallback(
    (loadMoreNodeId: string) => {
      const loadMoreNode = findNode(
        treeData,
        loadMoreNodeId,
      ) as PaginatedTreeData;
      if (!loadMoreNode || !loadMoreNode.parentId) return;

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
    [treeData],
  );

  useEffect(() => {
    setTreeData(processTreeData(treeViewData));
  }, [treeViewData, processTreeData]);

  const isNodeVisible = (nodeId: string): boolean => {
    const element = document.getElementById(nodeId);
    if (!element) return false;

    const rect = element.getBoundingClientRect();
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight;

    return rect.top >= 0 && rect.bottom <= viewportHeight;
  };
  const expandNodeById = useCallback(
    async (targetNodeId: string) => {
      const tree = treeRef.current;

      if (!tree || !targetNodeId) return;

      const allPaths = multipleOntologyPaths?.[targetNodeId];

      if (!allPaths?.length) return;

      const parentPathsWithDepth = new Map<string, number>();

      for (const path of allPaths) {
        const pathIds = path
          .filter((p: any) => !p.category)
          .map((c: { id: string }) => c.id)
          .join("-");

        const segments = pathIds.split("-");
        for (let i = 1; i < segments.length; i++) {
          const parentId = segments.slice(0, i + 1).join("-");
          if (parentId !== pathIds) {
            parentPathsWithDepth.set(parentId, i);
          }
        }
      }

      const sortedPaths = Array.from(parentPathsWithDepth.entries()).sort(
        ([, depthA], [, depthB]) => depthA - depthB,
      );

      for (const [parentId] of sortedPaths) {
        const parentNode = tree.get(parentId);
        if (parentNode && !parentNode.isOpen) {
          parentNode.open();
          await new Promise((resolve) => setTimeout(resolve, 50));

          if (parentNode.children) {
            for (const child of parentNode.children) {
              if (child.data.category && !child.isOpen) {
                child.open();
                await new Promise((resolve) => setTimeout(resolve, 25));
              }
            }
          }
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 100));

      // scroll to first node
      const path =
        eachOntologyPath[targetNodeId]
          ?.filter((p: any) => !p.category)
          ?.map((c: { id: string }) => c.id)
          ?.join("-") || "";
      const rootId = allPaths[0][0]?.id?.split("-")[0];
      const nodeIdWithPath = skillsFuture ? `${path}` : `${rootId}-${path}`;

      if (!isNodeVisible(nodeIdWithPath)) {
        await tree.scrollTo(nodeIdWithPath);
      }
    },
    [treeRef, multipleOntologyPaths, eachOntologyPath, skillsFuture],
  );

  useEffect(() => {
    const tree = treeRef.current;

    if (!tree || !currentVisibleNode?.id) return;

    const timeout = setTimeout(async () => {
      const targetNodeId = currentVisibleNode.id;
      const isFromTreeClick = isTreeClickRef.current;

      if (firstLoad || !isFromTreeClick) {
        await expandNodeById(targetNodeId);
      }

      setTimeout(() => {
        const targetNode = tree.get(targetNodeId);
        if (targetNode) {
          targetNode.select();
        }
      }, 500);

      isTreeClickRef.current = false;
      setFirstLoad(false);
    }, 500);

    return () => clearTimeout(timeout);
  }, [
    treeRef,
    currentVisibleNode?.id,
    multipleOntologyPaths,
    firstLoad,
    expandNodeById,
  ]);

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

  useEffect(() => {
    const tree = treeRef.current;
    setCount(tree?.visibleNodes.length ?? 0);

    const handler = setTimeout(() => {
      setTreeData(processTreeData(treeViewData));
    }, 1000);

    return () => {
      clearTimeout(handler);
    };
  }, [treeRef, searchTerm, treeViewData, processTreeData]);

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

      const newData = [...treeData];
      args.dragNodes.forEach((node) => {
        removeNode(newData, node.data.id);
      });

      const targetParent = args.parentId
        ? findNode(newData, args.parentId)
        : { children: newData };
      args.dragNodes.forEach((node) => {
        targetParent?.children?.splice(args.index, 0, node.data);
      });
      setTreeData(newData);

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
        let from = "main";
        if (fromParents[0].category) {
          from = fromParents[0].name;
        }
        let to = "main";
        if (toParent.category) {
          to = toParent.name;
        }
        if (toParent.name === from) {
          return;
        }
        const specializations = nodeData.specializations;
        const previousValue = JSON.parse(JSON.stringify(specializations));

        const fromCollectionIdx = specializations.findIndex(
          (s: ICollection) => s.collectionName === from,
        );
        if (fromCollectionIdx !== -1) {
          specializations[fromCollectionIdx].nodes = specializations[
            fromCollectionIdx
          ].nodes.filter(
            (n: { id: string }) => n.id !== draggedNodes[0].nodeId,
          );
        }

        const toCollectionIdx = specializations.findIndex(
          (s: ICollection) => s.collectionName === to,
        );
        specializations[toCollectionIdx].nodes.splice(args.index, 0, {
          id: draggedNodes[0].nodeId,
        });

        await updateDoc(nodeRef, {
          specializations,
        });
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
    } catch (error) {
      console.error(error);
    }
  };
  const handleExpandAll = () => {
    treeRef.current?.openAll();
  };

  const handleCollapseAll = () => {
    treeRef.current?.closeAll();
  };

  const expandOrCollapseAll = () => {
    collapsingLoader.current = true;
    if (expanded) {
      handleCollapseAll();
    } else {
      handleExpandAll();
    }
    setExpanded((prev) => !prev);
    collapsingLoader.current = false;
  };

  const generateDomElementId = (node: NodeApi<PaginatedTreeData>): string => {
    const { id } = node.data;
    const isRootNode = node.level === 0;

    // Prefix root nodes to prevent browser hash auto-scrolling
    return isRootNode ? `tree-root-${id}` : id;
  };

  function Node({
    node,
    style,
    dragHandle,
  }: NodeRendererProps<PaginatedTreeData>) {
    const indentSize = Number.parseFloat(`${style.paddingLeft || 0}`);
    const inputRef = useRef<HTMLInputElement>(null);
    const isLoading = loadingStates.has(node.data.id);

    if (node.data.isLoadMore) {
      let displayText = "•••";

      return (
        <Tooltip
          title={node.data.name}
          arrow
          placement="top"
          PopperProps={{
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
          }}
        >
          <Box
            style={style}
            className={clsx(styles.node, styles.loadMoreNode)}
            id={generateDomElementId(node)}
            onClick={() => !isLoading && handleLoadMore(node.data.id)}
            sx={{
              cursor: isLoading ? "default" : "pointer",
              transition: "background-color 0.2s ease-in-out",
              borderRadius: "4px",
              userSelect: "none",
              "&:hover": {
                backgroundColor: isLoading
                  ? "transparent"
                  : "rgba(255, 165, 0, 0.06)",
              },
              "&:active": {
                backgroundColor: isLoading
                  ? "transparent"
                  : "rgba(255, 165, 0, 0.1)",
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
                  ? "rgba(255, 165, 0, 0.5)"
                  : "rgba(255, 165, 0, 0.8)",
                fontSize: "18px",
                fontWeight: "bold",
                transition: "all 0.2s ease-in-out",
                ".loadMoreNode:hover &": {
                  color: isLoading ? "rgba(255, 165, 0, 0.5)" : "#ff8c00",
                  transform: isLoading ? "none" : "scale(1.02)",
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
        className={clsx(styles.node, node.state)}
        onClick={() => node.isInternal && node.toggle()}
        id={generateDomElementId(node)}
        sx={{
          backgroundColor:
            node.data.nodeId === currentVisibleNode?.id && !node.data.category
              ? (theme) =>
                  theme.palette.mode === "dark" ? "#26631c" : "#4ccf37"
              : "",
        }}
      >
        <Box className={styles.indentLines}>
          {new Array(indentSize / INDENT_STEP).fill(0).map((_, index) => {
            return <div key={index}></div>;
          })}
        </Box>
        <FolderArrow node={node} />
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            width: "calc(100% - 20px)",
          }}
        >
          <span
            className={clsx(styles.text, {
              [styles.categoryText]: node.data.category,
            })}
          >
            {node.isEditing ? (
              <Input node={node} inputRef={inputRef} />
            ) : (
              <Typography
                sx={{
                  color:
                    node.data.task || node.data.comments
                      ? "gray"
                      : node.data.category
                        ? "orange"
                        : "",
                }}
              >
                {node.data.name}
                {specializationNumsUnder[node.data.id] > 0 && (
                  <Tooltip
                    title={`Total number of ${node.data.name.toLowerCase() === "act" ? "activities" : "entities"} under this sub-ontology`}
                  >
                    <span
                      style={{
                        color: "orange",
                        marginLeft: "5px",
                        fontWeight: "bold",
                      }}
                    >
                      {specializationNumsUnder[node.data.id]}
                    </span>
                  </Tooltip>
                )}
                {specializationNumsUnder[`${node.data.id}-extra`] > 0 && (
                  <Tooltip
                    title={
                      "Total number of O*Net tasks under this sub-ontology"
                    }
                  >
                    <span
                      style={{
                        color: "orange",
                        marginLeft: "5px",
                        fontWeight: "bold",
                      }}
                    >
                      {specializationNumsUnder[`${node.data.id}-extra`]}
                    </span>
                  </Tooltip>
                )}
                {(node.data.actionAlternatives || []).length > 0 && (
                  <span style={{ color: "orange", marginLeft: "8px" }}>
                    Alternatives:
                  </span>
                )}
                {(node.data.actionAlternatives || []).length >= 0 && (
                  <span style={{ fontSize: "14px" }}>
                    {(node.data.actionAlternatives || []).join(", ")}
                  </span>
                )}
              </Typography>
            )}
          </span>
        </Box>
      </Box>
    );
  }

  return (
    <Box className={styles.container}>
      <Box
        sx={{
          position: "sticky",
          top: 0,
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          zIndex: 20,
          backgroundColor: (theme) =>
            theme.palette.mode === "dark" ? "#303134" : "#ffffff",
          pl: "5px",
          py: "7px",
          gap: 1,
        }}
      >
        {!treeType && (
          <Button
            variant={expanded ? "contained" : "outlined"}
            size="small"
            onClick={expandOrCollapseAll}
            sx={{
              borderRadius: "20px",
              textTransform: "none",
            }}
          >
            {collapsingLoader.current
              ? "Collapsing..."
              : expanded
                ? "Collapse All"
                : "Expand All"}
          </Button>
        )}
        {/* <Button
          variant="outlined"
          size="small"
          onClick={handleCollapseAll}
          sx={{ borderRadius: "20px", textTransform: "none" }}
        >
          Collapse All
        </Button> */}

        {treeType !== "oNet" && user?.claims.editAccess && (
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
                theme.palette.mode === "dark" ? "#2b2b2b" : "#f5f5f5",
              color: (theme) =>
                theme.palette.mode === "dark" ? "#f5f5f5" : "#222",
              "&:hover": {
                bgcolor: (theme) =>
                  theme.palette.mode === "dark" ? "#3a3a3a" : "#f0e6e6",
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
        )}
      </Box>
      <Box className={styles.split}>
        <Box className={styles.treeContainer}>
          <FillFlexParent>
            {(dimens) => (
              <Tree
                {...dimens}
                ref={treeRef}
                data={treeData}
                onMove={handleMove}
                selectionFollowsFocus={followsFocus}
                disableMultiSelection={disableMulti}
                // ref={(t) => setTree(t)}   ref={treeRef}
                openByDefault={false}
                searchTerm={searchTerm}
                className={styles.tree}
                rowClassName={styles.row}
                paddingTop={5}
                indent={INDENT_STEP}
                overscanCount={50}
                // onSelect={(selected) => setSelectedCount(selected.length)}
                onActivate={(node) => {
                  if (!!node.data.category || node.data.isLoadMore) {
                    return;
                  }
                  isTreeClickRef.current = true;
                  onOpenNodesTree(node.data.nodeId);
                }}
                onFocus={(node) => setFocused(node.data)}
                onToggle={() => {
                  setTimeout(() => {
                    setCount(treeRef.current?.visibleNodes.length ?? 0);
                  });
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

function sortData(data: TreeData[]) {
  function sortIt(data: TreeData[]) {
    data.sort((a, b) => (a.name < b.name ? -1 : 1));
    data.forEach((d) => {
      if (d.children) sortIt(d.children);
    });
    return data;
  }
  return sortIt(data);
}

function FolderArrow({ node }: { node: NodeApi<TreeData> }) {
  const hasChildren = node.isInternal && (node.children || []).length > 0;

  return (
    <span className={styles.arrow} style={{ minWidth: "20px" }}>
      {node.isInternal && hasChildren ? (
        node.isOpen ? (
          <KeyboardArrowDownIcon sx={{ pr: "5px" }} />
        ) : (
          <KeyboardArrowRightIcon sx={{ pr: "5px" }} />
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
