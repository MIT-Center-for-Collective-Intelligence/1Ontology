import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { NodeApi, NodeRendererProps, Tree, TreeApi } from "react-arborist";
import SyncAltIcon from "@mui/icons-material/SyncAlt";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import styles from "./drag.tree.module.css";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { Box, Button, Switch, Tooltip, Typography } from "@mui/material";

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

interface INodePath {
  id: string;
  title: string;
  category?: boolean;
}

const INDENT_STEP = 15;

function DraggableTree({
  treeViewData,
  setSnackbarMessage,
  nodes,
  expandedNodes,
  currentVisibleNode,
  onOpenNodesTree,
  tree,
  setTree,
  treeType,
  eachOntologyPath,
  alternatives,
  domainsEmojis,
  expandDefault,
  skillsFuture = false,
}: {
  treeViewData: any;
  setSnackbarMessage: any;
  nodes: any;
  expandedNodes: any;
  currentVisibleNode: any;
  onOpenNodesTree: any;
  tree: TreeApi<TreeData> | null | undefined;
  setTree: any;
  treeType?: string;
  eachOntologyPath?: any;
  alternatives?: { [key: string]: string[] };
  domainsEmojis?: Record<string, string>;
  expandDefault?: string;
  skillsFuture?: boolean;
}) {
  const db = getFirestore();
  const [{ user }] = useAuth();
  const [active, setActive] = useState<TreeData | null>(null);
  const [focused, setFocused] = useState<TreeData | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [count, setCount] = useState(0);
  const [followsFocus, setFollowsFocus] = useState(false);
  const [disableMulti, setDisableMulti] = useState(true);
  const [treeData, setTreeData] = useState<TreeData[]>([]);
  const [editEnabled, setEditEnabled] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [treeCheckAttempts, setTreeCheckAttempts] = useState(0);
  const MAX_TREE_CHECK_ATTEMPTS = 20;
  const treeRef = useRef<TreeApi<TreeData> | null>(null) as React.MutableRefObject<TreeApi<TreeData> | null>;

  useEffect(() => {
    if (!tree && currentVisibleNode?.id) {
      setPendingNavigation(currentVisibleNode.id);
      setTreeCheckAttempts(0);
      return;
    }

    if (tree && currentVisibleNode?.id) {
      const timeout = setTimeout(() => {
        if (!eachOntologyPath[currentVisibleNode.id]) {
          return;
        }
        expandNodeById(currentVisibleNode.id);
        setFirstLoad(false);
        setPendingNavigation(null);
      }, 500);

      return () => {
        clearTimeout(timeout);
      };
    }
  }, [tree, currentVisibleNode?.id, eachOntologyPath]);

  useEffect(() => {
    if (pendingNavigation && treeCheckAttempts < MAX_TREE_CHECK_ATTEMPTS) {
      const timeout = setTimeout(() => {
        if (tree) {
          if (eachOntologyPath[pendingNavigation]) {
            expandNodeById(pendingNavigation);
            setPendingNavigation(null);
          }
        } else {
          setTreeCheckAttempts(prev => prev + 1);
        }
      }, 500);

      return () => clearTimeout(timeout);
    } else if (pendingNavigation && treeCheckAttempts >= MAX_TREE_CHECK_ATTEMPTS) {
      setPendingNavigation(null);
    }
  }, [tree, pendingNavigation, treeCheckAttempts, eachOntologyPath]);

  const isNodeVisible = (nodeId: string): boolean => {
    const element = document.getElementById(nodeId);
    if (!element) return false;

    const rect = element.getBoundingClientRect();
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight;

    return rect.top >= 0 && rect.bottom <= viewportHeight;
  };

  // Finds a node by ID using direct match, ID inclusion, or name matching
  const findNodeById = (nodeId: string): NodeApi<TreeData> | undefined => {
    if (!tree) return undefined;

    const visibleNodes = Object.values(tree.visibleNodes || {});

    let node = visibleNodes.find(n => n.data.nodeId === nodeId);
    if (node) return node;

    node = visibleNodes.find(n => n.id.includes(nodeId));
    if (node) return node;

    if (nodes && nodes[nodeId]) {
      const nodeName = nodes[nodeId].title;
      node = visibleNodes.find(n => n.data.name === nodeName);
      if (node) return node;
    }

    return undefined;
  };

  // Smooth scrolls an element into view with animation
  const smoothScrollToElement = (elementId: string) => {
    const element = document.getElementById(elementId);
    if (!element) return;

    const treeContainer = document.querySelector('.tree-container');
    if (!treeContainer) return;

    const containerRect = treeContainer.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

    const targetScrollTop = treeContainer.scrollTop +
      (elementRect.top - containerRect.top) -
      (containerRect.height / 2) +
      (elementRect.height / 2);

    const startScrollTop = treeContainer.scrollTop;
    const distance = targetScrollTop - startScrollTop;

    const duration = 500;
    const startTime = performance.now();

    const easeInOutCubic = (t: number): number => {
      return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };

    const animateScroll = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeInOutCubic(progress);

      treeContainer.scrollTop = startScrollTop + distance * easedProgress;

      if (progress < 1) {
        requestAnimationFrame(animateScroll);
      }
    };

    requestAnimationFrame(animateScroll);
  };

  // Navigates to a node by expanding its path and handling generalizations
  const navigateToFoundNode = async (targetNode: NodeApi<TreeData>): Promise<boolean> => {
    let parent = targetNode.parent;
    const parentsToOpen: NodeApi<TreeData>[] = [];

    while (parent) {
      parentsToOpen.push(parent);
      parent = parent.parent;
    }

    for (let i = parentsToOpen.length - 1; i >= 0; i--) {
      parentsToOpen[i].open();
      await new Promise(resolve => setTimeout(resolve, 30));
    }

    if (targetNode.isInternal) {
      targetNode.open();
    }

    if (nodes && targetNode.data.nodeId && nodes[targetNode.data.nodeId]) {
      const nodeData = nodes[targetNode.data.nodeId];

      if (nodeData.generalizations && nodeData.generalizations.length > 0) {
        const generalizationIds: string[] = [];
        nodeData.generalizations.forEach((collection: ICollection) => {
          collection.nodes.forEach((genNode: { id: string }) => {
            generalizationIds.push(genNode.id);
          });
        });

        for (const genId of generalizationIds) {
          await expandGeneralizationPath(genId, targetNode.data.nodeId);
        }
      }
    }

    tree!.scrollTo(targetNode.id);
    await new Promise(resolve => setTimeout(resolve, 50));
    smoothScrollToElement(targetNode.id);

    setTimeout(() => {
      targetNode.select();
    }, 250);

    return true;
  };

  // Expands path to a generalization node, traversing ontology path if needed
  const expandGeneralizationPath = async (generalizationId: string, childNodeId: string): Promise<boolean> => {
    if (!tree) return false;

    const genNode = findNodeById(generalizationId);

    if (genNode) {
      let parent = genNode.parent;
      const parentsToOpen: NodeApi<TreeData>[] = [];

      while (parent) {
        parentsToOpen.push(parent);
        parent = parent.parent;
      }

      for (let i = parentsToOpen.length - 1; i >= 0; i--) {
        parentsToOpen[i].open();
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      genNode.open();
      return true;
    } else if (eachOntologyPath && eachOntologyPath[generalizationId]) {
      const path = eachOntologyPath[generalizationId];
      const rootSegment = path[0];
      const rootId = rootSegment.id.split("-")[0];

      const visibleNodes = Object.values(tree.visibleNodes || {});
      const rootNodes = visibleNodes.filter(n => !n.parent || n.parent.id === "root");

      let rootNode = rootNodes.find(n => n.id.includes(rootId) || n.data.nodeId === rootId);

      if (!rootNode) {
        for (const node of rootNodes) {
          node.open();
        }

        await new Promise(resolve => setTimeout(resolve, 200));

        const updatedNodes = Object.values(tree.visibleNodes || {});
        rootNode = updatedNodes.find(n => n.id.includes(rootId) || n.data.nodeId === rootId);

        if (!rootNode) {
          return false;
        }
      }

      rootNode.open();
      await new Promise(resolve => setTimeout(resolve, 150));

      let currentNode: NodeApi<TreeData> = rootNode;

      for (let i = 1; i < path.length; i++) {
        if (path[i].category) continue;

        const segment = path[i];
        const childNodes = currentNode.children || [];
        let childNode = childNodes.find(n =>
          n.data.nodeId === segment.id ||
          n.id.includes(segment.id) ||
          n.data.name === segment.title
        );

        if (!childNode) {
          currentNode.open();
          await new Promise(resolve => setTimeout(resolve, 150));

          const updatedNodes = Object.values(tree.visibleNodes || {});
          childNode = updatedNodes.find(n =>
            n.data.nodeId === segment.id ||
            n.id.includes(segment.id) ||
            n.data.name === segment.title
          );

          if (!childNode) continue;
        }

        currentNode = childNode;
        currentNode.open();
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      return true;
    }

    return false;
  };

  // Smart node search with iterative expansion and early exit
  const iterativeSearchAndExpand = async (targetNodeId: string): Promise<boolean> => {
    if (!tree) return false;

    let visibleNodes = Object.values(tree.visibleNodes || {});
    let targetNode = findNodeById(targetNodeId);

    if (targetNode) {
      return await navigateToFoundNode(targetNode);
    }

    const nodesToExpand: NodeApi<TreeData>[] = visibleNodes.filter(n => n.isInternal && !n.isOpen);
    const targetName = nodes && nodes[targetNodeId] ? nodes[targetNodeId].title : null;

    const MAX_ITERATIONS = 3;
    let iterations = 0;

    while (nodesToExpand.length > 0 && iterations < MAX_ITERATIONS) {
      iterations++;

      const batch = nodesToExpand.splice(0, 5);

      for (const node of batch) {
        if (targetName && node.data.name.includes(targetName.split(' ')[0])) {
          node.open();
        } else {
          node.open();
        }
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      targetNode = findNodeById(targetNodeId);

      if (targetNode) {
        return await navigateToFoundNode(targetNode);
      }

      visibleNodes = Object.values(tree.visibleNodes || {});
      const newNodesToExpand = visibleNodes.filter(n => n.isInternal && !n.isOpen);

      for (const node of newNodesToExpand) {
        if (!nodesToExpand.includes(node)) {
          nodesToExpand.push(node);
        }
      }
    }

    tree.openAll();
    await new Promise(resolve => setTimeout(resolve, 500));

    targetNode = findNodeById(targetNodeId);

    if (targetNode) {
      tree.closeAll();
      await new Promise(resolve => setTimeout(resolve, 300));
      return await navigateToFoundNode(targetNode);
    }

    return false;
  };

  // Navigates tree following a path to reach target node
  const navigateByPath = async (path: INodePath[], targetNodeId: string): Promise<boolean> => {
    if (!tree) return false;

    const rootSegment = path[0];
    const rootId = rootSegment.id.split("-")[0];

    const visibleNodes = Object.values(tree.visibleNodes || {});
    const rootNodes = visibleNodes.filter(n => !n.parent || n.parent.id === "root");

    let rootNode = rootNodes.find(n => n.id.includes(rootId) || n.data.nodeId === rootId);

    if (!rootNode) {
      for (const node of rootNodes) {
        node.open();
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      const updatedNodes = Object.values(tree.visibleNodes || {});
      rootNode = updatedNodes.find(n => n.id.includes(rootId) || n.data.nodeId === rootId);

      if (!rootNode) {
        return false;
      }
    }

    rootNode.open();
    await new Promise(resolve => setTimeout(resolve, 150));

    let currentNode: NodeApi<TreeData> = rootNode;

    for (let i = 1; i < path.length; i++) {
      if (path[i].category) continue;

      const segment = path[i];
      const childNodes = currentNode.children || [];
      let childNode = childNodes.find(n =>
        n.data.nodeId === segment.id ||
        n.id.includes(segment.id) ||
        n.data.name === segment.title
      );

      if (!childNode) {
        currentNode.open();
        await new Promise(resolve => setTimeout(resolve, 150));

        const updatedNodes = Object.values(tree.visibleNodes || {});
        childNode = updatedNodes.find(n =>
          n.data.nodeId === segment.id ||
          n.id.includes(segment.id) ||
          n.data.name === segment.title
        );

        if (!childNode) continue;
      }

      currentNode = childNode;
      currentNode.open();
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    const targetNode = currentNode.data.nodeId === targetNodeId ?
      currentNode :
      findNodeById(targetNodeId);

    if (targetNode) {
      if (nodes && nodes[targetNodeId]) {
        const nodeData = nodes[targetNodeId];

        if (nodeData.generalizations && nodeData.generalizations.length > 0) {
          const generalizationIds: string[] = [];
          nodeData.generalizations.forEach((collection: ICollection) => {
            collection.nodes.forEach((genNode: { id: string }) => {
              generalizationIds.push(genNode.id);
            });
          });

          for (const genId of generalizationIds) {
            if (path.some(p => p.id === genId)) continue;
            await expandGeneralizationPath(genId, targetNodeId);
          }
        }
      }

      if (targetNode.isInternal) {
        targetNode.open();
      }

      tree.scrollTo(targetNode.id);
      await new Promise(resolve => setTimeout(resolve, 50));
      smoothScrollToElement(targetNode.id);

      setTimeout(() => {
        if (targetNode) {
          targetNode.select();
          const element = document.getElementById(targetNode.id);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }
      }, 200);

      return true;
    }

    return false;
  };

  // Expands node by ID using path navigation or iterative search
  const expandNodeById = async (nodeId: string): Promise<boolean> => {
    if (!tree || !nodeId) {
      if (tree && nodeId) {
        setPendingNavigation(nodeId);
      }
      return false;
    }

    try {
      if (eachOntologyPath && eachOntologyPath[nodeId]) {
        const path = eachOntologyPath[nodeId];
        return await navigateByPath(path, nodeId);
      } else {
        const visibleNodes = Object.values(tree.visibleNodes || {});
        let targetNode = visibleNodes.find(n => n.data.nodeId === nodeId);

        if (targetNode) {
          return await navigateToFoundNode(targetNode);
        } else if (nodes && nodes[nodeId]) {
          const nodeName = nodes[nodeId].title;
          targetNode = visibleNodes.find(n => n.data.name === nodeName);

          if (targetNode) {
            return await navigateToFoundNode(targetNode);
          }
        }

        const rootNodes = Object.values(tree.visibleNodes).filter(n => !n.parent || n.parent.id === "root");

        for (const rootNode of rootNodes) {
          rootNode.open();
        }

        await new Promise(resolve => setTimeout(resolve, 200));

        targetNode = findNodeById(nodeId);

        if (targetNode) {
          return await navigateToFoundNode(targetNode);
        }

        return await iterativeSearchAndExpand(nodeId);
      }
    } catch (error) {
      return false;
    }
  };

  useEffect(() => {
    if (!tree && currentVisibleNode?.id) {
      setPendingNavigation(currentVisibleNode.id);
      return;
    }

    if (tree && currentVisibleNode?.id) {
      // Wait for the tree to initialize its nodes before scrolling
      const timeout = setTimeout(() => {
        /*         const generalizationId =
          currentVisibleNode.generalizations[0]?.nodes[0]?.id; */
        if (!eachOntologyPath[currentVisibleNode.id]) {
          return;
        }
        expandNodeById(currentVisibleNode.id);
        setFirstLoad(false);
        setPendingNavigation(null);
      }, 500);

      return () => {
        clearTimeout(timeout);
      };
    }
  }, [tree, currentVisibleNode?.id, eachOntologyPath]);

  useEffect(() => {
    if (tree && pendingNavigation) {
      const timeout = setTimeout(() => {
        if (eachOntologyPath[pendingNavigation]) {
          expandNodeById(pendingNavigation);
          setPendingNavigation(null);
        }
      }, 800);

      return () => clearTimeout(timeout);
    }
  }, [tree, pendingNavigation, eachOntologyPath]);

  useEffect(() => {
    if (tree && treeData.length > 0 && firstLoad) {
      const rootNode = tree.get("root");

      if (rootNode) {
        rootNode.open();
      }

      if (currentVisibleNode?.id) {
        setTimeout(() => {
          expandNodeById(currentVisibleNode.id);
        }, 1000);
      }

      setFirstLoad(false);
    }
  }, [tree, treeData, firstLoad, currentVisibleNode?.id]);

  useEffect(() => {
    setCount(tree?.visibleNodes.length ?? 0);
    setTreeData(treeViewData);
  }, [tree, searchTerm, treeViewData]);

  const handleMove = async (args: {
    dragIds: string[];
    dragNodes: NodeApi<TreeData>[];
    parentId: string | null;
    parentNode: NodeApi<TreeData> | null;
    index: number;
  }) => {
    try {
      if (!editEnabled || !user?.uname) return;

      const draggedNodes = args.dragNodes.map((node) => node.data);
      if (draggedNodes[0].category) {
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

      const newPosition = args.index;
      const differentNodeType = draggedNodes.some(
        (n) => n.nodeType !== toParent.nodeType,
      );

      if (
        differentNodeType ||
        toParent.id === "root" ||
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
        });
        return;
      }

      setSnackbarMessage(
        `Node${draggedNodes.length > 1 ? "s" : ""} has been moved to ${toParent.name}`,
      );
      if (draggedNodes[0].category) {
        return;
        /*  updateLinksForInheritance(
        db,
        specializationId,
        addedLinks,
        removedLinks,
        specializationData,
        newLinks,
        nodes,
      ); */
      } else {
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
          await unlinkPropertyOf(
            db,
            "generalizations",
            specializationId,
            linkId,
          );
        }
        const newGeneralizationData = nodes[toParent.nodeId];
        const specializations = newGeneralizationData.specializations;
        const previousSValue = JSON.parse(JSON.stringify(specializations));

        const alreadyExist = newGeneralizationData.specializations
          .flatMap((c: ICollection) => c.nodes)
          .map((n: { id: string }) => n.id);
        if (!alreadyExist.includes(specializationId)) {
          specializations[0].nodes.splice(args.index, 0, {
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
        });
        // await updateLinks(
        //   newLinks,
        //   { id: specializationId },
        //   "specializations",
        //   nodes,
        //   db,
        // );

        await updateLinksForInheritance(
          db,
          specializationId,
          addedLinks.map((id) => {
            return { id };
          }),
          removedLinks.map((id) => {
            return { id };
          }),
          specializationData,
          newLinks.map((id) => {
            return { id };
          }),
          nodes,
        );
      }
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

  function Node({ node, style, dragHandle }: NodeRendererProps<TreeData>) {
    const indentSize = Number.parseFloat(`${style.paddingLeft || 0}`);
    const inputRef = useRef<HTMLInputElement>(null);

    return (
      <Box
        ref={dragHandle}
        style={style}
        className={clsx(styles.node, node.state)}
        onClick={() => node.isInternal && node.toggle()}
        id={node.data.id}
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
                {node.data.name}{" "}
                {(node.data.actionAlternatives || []).length > 0 && (
                  <span style={{ color: "orange", marginRight: "8px" }}>
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
      <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
        <Button variant="outlined" size="small" onClick={handleExpandAll}>
          Expand All
        </Button>
        <Button variant="outlined" size="small" onClick={handleCollapseAll}>
          Collapse All
        </Button>
      </Box>
      <Box className={styles.split}>
        <Box className={styles.treeContainer}>
          <FillFlexParent>
            {(dimens) => (
              <Tree
                {...dimens}
                ref={(t) => {
                  treeRef.current = t || null;
                  if (t && setTree) {
                    setTree(t);
                  }
                }}
                data={treeData}
                onMove={handleMove}
                selectionFollowsFocus={followsFocus}
                disableMultiSelection={disableMulti}
                // ref={(t) => setTree(t)}   ref={treeRef}
                openByDefault={false}
                searchTerm={searchTerm}
                className={styles.tree}
                rowClassName={styles.row}
                paddingTop={15}
                indent={INDENT_STEP}
                overscanCount={50}
                // onSelect={(selected) => setSelectedCount(selected.length)}
                onActivate={(node) => {
                  if (!!node.data.category) {
                    return;
                  }
                  onOpenNodesTree(node.data.nodeId);
                }}
                onFocus={(node) => setFocused(node.data)}
                onToggle={() => {
                  setTimeout(() => {
                    setCount(tree?.visibleNodes.length ?? 0);
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
      {treeType !== "oNet" &&
        (user?.uname === "ouhrac" ||
          user?.uname === "1man" ||
          user?.uname === "malonetw") && (
          <Box
            sx={{
              position: "absolute",
              bottom: 0,
              left: "35%",
              alignItems: "center",
              textAlign: "center",
              backgroundColor: (theme) =>
                theme.palette.mode === "dark" ? "#303134" : "#efefef",
              borderRadius: "25px",
              border: "1px solid orange",
              px: "10px",
              width: "180px",
            }}
          >
            <Switch
              checked={editEnabled}
              onChange={() => {
                setEditEnabled((prev) => !prev);
              }}
            />
            Edit {editEnabled ? "On" : "Off"}
          </Box>
        )}
    </Box>
  );
}
export default DraggableTree;

function Input({
  node,
  inputRef,
}: {
  node: NodeApi<TreeData>;
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

function findNode(data: TreeData[], id: string): TreeData | null {
  for (const node of data) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

function removeNode(data: TreeData[], id: string): boolean {
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
