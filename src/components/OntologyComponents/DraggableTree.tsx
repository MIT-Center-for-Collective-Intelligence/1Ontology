import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { NodeApi, NodeRendererProps, Tree, TreeApi } from "react-arborist";
import styles from "./drag.tree.module.css";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { Box, Button, Switch, Tooltip } from "@mui/material";
import {
  saveNewChangeLog,
  unlinkPropertyOf,
  updateLinksForInheritance,
} from " @components/lib/utils/helpers";
import { collection, doc, getFirestore, updateDoc } from "firebase/firestore";
import { ICollection, TreeData } from " @components/types/INode";
import { NODES } from " @components/lib/firestoreClient/collections";
import { useAuth } from "../context/AuthContext";
import { FillFlexParent } from "./fill-flex-parent";

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

  const isNodeVisible = (nodeId: string): boolean => {
    const element = document.getElementById(nodeId);
    if (!element) return false;

    const rect = element.getBoundingClientRect();
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight;

    return rect.top >= 0 && rect.bottom <= viewportHeight;
  };
  const expandNodeById = async (nodeId: string) => {
    if (!tree || !nodeId) return;

    //  Expand all parent nodes
    let currentNode = tree.get(nodeId);
    if (currentNode) {
      let parentNode = currentNode.parent;
      while (parentNode) {
        parentNode.open();
        parentNode = parentNode.parent;
      }
    }

    if (!isNodeVisible(nodeId)) {
      await tree.scrollTo(nodeId);
    }

    setTimeout(() => {
      const targetNode = tree.get(nodeId);
      if (targetNode) {
        targetNode.select();
        /*const element = document.getElementById(nodeId);
        element?.scrollIntoView({ behavior: "smooth", block: "center" }); */
      }
    }, 500);
  };

  useEffect(() => {
    if (tree && currentVisibleNode?.id) {
      // Wait for the tree to initialize its nodes before scrolling
      const timeout = setTimeout(() => {
        const generalizationId =
          currentVisibleNode.generalizations[0]?.nodes[0]?.id;
        expandNodeById(
          generalizationId
            ? `${generalizationId}-${currentVisibleNode.id}`
            : `${currentVisibleNode.id}`,
        );
        setFirstLoad(false);
      }, 500);

      return () => clearTimeout(timeout);
    }
  }, [tree, currentVisibleNode?.id]);

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
      debugger;
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
            node.data.nodeId === currentVisibleNode.id && !node.data.category
              ? "#26631c"
              : "",
        }}
      >
        <Box className={styles.indentLines}>
          {new Array(indentSize / INDENT_STEP).fill(0).map((_, index) => {
            return <div key={index}></div>;
          })}
        </Box>
        <FolderArrow node={node} />

        <span
          className={clsx(styles.text, {
            [styles.categoryText]: node.data.category,
          })}
        >
          {node.isEditing ? (
            <Input node={node} inputRef={inputRef} />
          ) : (
            `${node.data.name}`
          )}
        </span>
      </Box>
    );
  }

  return (
    <Box className={styles.container}>
      <Box className={styles.split}>
        <Box className={styles.treeContainer}>
          <FillFlexParent>
            {(dimens) => (
              <Tree
                {...dimens}
                data={treeData}
                onMove={handleMove}
                selectionFollowsFocus={followsFocus}
                disableMultiSelection={disableMulti}
                ref={(t) => setTree(t)}
                openByDefault={false}
                searchTerm={searchTerm}
                className={styles.tree}
                rowClassName={styles.row}
                paddingTop={15}
                indent={INDENT_STEP}
                overscanCount={50}
                // onSelect={(selected) => setSelectedCount(selected.length)}
                onActivate={(node) => {
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
      {treeType !== "oNet" && (
        <Box
          sx={{
            position: "sticky",
            bottom: 0,
            backgroundColor: (theme) =>
              theme.palette.mode === "dark" ? "#303134" : "#efefef",
            alignItems: "center",
            textAlign: "center",
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
    <span className={styles.arrow}>
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
