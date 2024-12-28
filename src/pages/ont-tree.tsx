import { NODES_ONET } from " @components/lib/firestoreClient/collections";
import { collection, getDocs, getFirestore, query } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { TreeItem } from "@mui/lab";
import { Box, CircularProgress, Typography } from "@mui/material";
import { INode, TreeData } from " @components/types/INode";
import DraggableTree from " @components/components/OntologyComponents/DraggableTree";
import { TreeApi } from "react-arborist";

type TreeNode = {
  title: string;
  children: TreeNode[];
};

const getTreeView = (
  mainCategories: INode[],
  visited: Map<string, any> = new Map(),
  nodes: any,
  parentId?: string,
): any => {
  const newNodes = [];
  for (let node of mainCategories) {
    if (!node) {
      continue;
    }

    const specializations = node.specializations;
    let collections = [];
    let mainChildren = [];
    for (let collection of specializations) {
      const children = [];
      for (let _node of collection.nodes) {
        if (nodes[_node.id]) {
          children.push(nodes[_node.id]);
        }
      }

      // if (children.length > 0) {
      if (collection.collectionName !== "main") {
        const id = parentId
          ? `${parentId}-${node.id}-${collection.collectionName}`
          : `${node.id}-${collection.collectionName}`;
        if (visited.has(id)) {
          continue;
        }
        visited.set(id, true);

        collections.push({
          id: id,
          nodeId: node.id,
          nodeType: node.nodeType,
          name: collection.collectionName,
          children: getTreeView(
            children,
            visited,
            nodes,
            !node.category ? node.id : undefined,
          ),

          category: true,
        });
      } else {
        mainChildren.push(...children);
      }

      // } else {
      //   collections.push({
      //     id: `${parentId}-${node.id}`,
      //     nodeId: node.id,
      //     name: node.title,
      //     category: !!parentId
      //   });
      // }
    }
    const id = parentId ? `${parentId}-${node.id}` : `${node.id}`;
    if (visited.has(id)) {
      continue;
    }
    visited.set(id, true);
    newNodes.push({
      id,
      nodeId: node.id,
      name: node.title,
      nodeType: node.nodeType,
      children: [
        ...collections,
        ...getTreeView(
          mainChildren,
          visited,
          nodes,
          !node.category ? node.id : undefined,
        ),
      ],
      category: !!node.category,
    });
  }
  return newNodes;
};

const buildTree = (data: any[], nodes: any): TreeNode[] => {
  const mainCategories = Object.values(data).filter((node: INode) => node.root);

  // Sort main nodes based on a predefined order
  mainCategories.sort((nodeA: any, nodeB: any) => {
    const order = [
      "Information Input",
      "Interacting With Others",
      "Mental Processes",
      "Work Output",
    ];
    const nodeATitle = nodeA.title;
    const nodeBTitle = nodeB.title;
    return order.indexOf(nodeATitle) - order.indexOf(nodeBTitle);
  });

  return getTreeView(mainCategories, new Map(), nodes);
};

function OntTree() {
  const db = getFirestore();
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [tree, setTree] = useState<TreeApi<TreeData> | null | undefined>(null);

  const getData = async () => {
    setLoading(true);
    const nodesDocs = await getDocs(query(collection(db, NODES_ONET)));
    const nodes_data: any = [];
    const nodes: any = {};
    nodesDocs.docs.forEach((doc) => {
      nodes_data.push(doc.data());
      nodes[doc.id] = doc.data();
    });
    setTreeData(buildTree(nodes_data, nodes));
    setLoading(false);
  };

  useEffect(() => {
    getData();
  }, []);

  const handleDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    node: TreeNode,
  ) => {
    event.dataTransfer.setData("application/json", JSON.stringify(node));
  };

  const renderTree = (
    nodes: TreeNode,
    visitedNodes: Set<string> = new Set(),
  ) => {
    if (visitedNodes.has(nodes.title)) {
      return null;
    }

    visitedNodes.add(nodes.title);
    return (
      <TreeItem
        key={nodes.title}
        nodeId={nodes.title}
        label={
          <div
            draggable
            onDragStart={(event) => handleDragStart(event, nodes)}
            style={{ cursor: "grab" }}
          >
            {nodes.title}
          </div>
        }
      >
        {nodes.children.map((child) =>
          renderTree(child, new Set(visitedNodes)),
        )}
      </TreeItem>
    );
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          flexDirection: "column",
        }}
      >
        <CircularProgress />
        <Typography sx={{ mt: "5px" }}> Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%" }}>
      <DraggableTree
        treeViewData={treeData}
        setSnackbarMessage={() => {}}
        expandedNodes={new Set()}
        currentVisibleNode={null}
        nodes={{}}
        onOpenNodesTree={() => {}}
        tree={tree}
        setTree={setTree}
        treeType="oNet"
      />
    </Box>
  );
}

export default OntTree;
