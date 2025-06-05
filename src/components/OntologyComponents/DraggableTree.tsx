import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
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

const INDENT_STEP = 15;

function DraggableTree({
  treeViewData,
  setSnackbarMessage,
  nodes,
  currentVisibleNode,
  onOpenNodesTree,
  treeRef,
  treeType,
  eachOntologyPath,
  skillsFuture = false,
  scrollTrigger,
  specializationNumsUnder,
}: {
  treeViewData: any;
  setSnackbarMessage: any;
  nodes: any;
  currentVisibleNode: any;
  onOpenNodesTree: any;
  treeRef: any;
  treeType?: string;
  eachOntologyPath?: any;
  skillsFuture?: boolean;
  scrollTrigger: boolean;
  specializationNumsUnder: { [key: string]: number };
}) {
  const db = getFirestore();
  const [{ user }] = useAuth();
  const [focused, setFocused] = useState<TreeData | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [count, setCount] = useState(0);
  const [followsFocus, setFollowsFocus] = useState(false);
  const [disableMulti, setDisableMulti] = useState(true);
  const [treeData, setTreeData] = useState<TreeData[]>([...treeViewData]);
  const [editEnabled, setEditEnabled] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const collapsingLoader = useRef<boolean>(false);

  const isNodeVisible = (nodeId: string): boolean => {
    const element = document.getElementById(nodeId);
    if (!element) return false;

    const rect = element.getBoundingClientRect();
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight;

    return rect.top >= 0 && rect.bottom <= viewportHeight;
  };
  const expandNodeById = async (nodeId: string) => {
    const tree = treeRef.current;
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
    const tree = treeRef.current;
    if (tree && currentVisibleNode?.id) {
      // Wait for the tree to initialize its nodes before scrolling
      const timeout = setTimeout(() => {
        /*         const generalizationId =
          currentVisibleNode.generalizations[0]?.nodes[0]?.id; */
        if (!eachOntologyPath[currentVisibleNode.id]) {
          return;
        }
        const rootId =
          eachOntologyPath[currentVisibleNode.id][0].id.split("-")[0];

        const path = eachOntologyPath[currentVisibleNode.id]
          .filter((p: any) => !p.category)
          .map((c: { id: string }) => c.id)
          .join("-");
        expandNodeById(skillsFuture ? `${path}` : `${rootId}-${path}`);
        setFirstLoad(false);
      }, 500);

      return () => clearTimeout(timeout);
    }
  }, [treeRef, currentVisibleNode?.id]);

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
      setTreeData(treeViewData);
    }, 1000);

    return () => {
      clearTimeout(handler);
    };
  }, [treeRef, searchTerm, treeViewData]);

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
          pl: "10px",
          py: "4px",
          gap: 1,
        }}
      >
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
