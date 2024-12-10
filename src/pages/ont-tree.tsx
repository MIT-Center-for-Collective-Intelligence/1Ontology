import { NODES_ONET } from " @components/lib/firestoreClient/collections";
import { collection, getDocs, getFirestore } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { TreeView, TreeItem } from "@mui/lab";
import { ExpandMore, ChevronRight } from "@mui/icons-material";
import { Box, Typography } from "@mui/material";

type TreeNode = {
  title: string;
  children: TreeNode[];
};

const buildTree = (
  data: { title: string; children: string[] }[]
): TreeNode[] => {
  const titleMap: { [key: string]: TreeNode } = {};

  data.forEach(({ title }) => {
    titleMap[title] = { title, children: [] };
  });

  data.forEach(({ title, children }) => {
    children.forEach((child) => {
      if (!titleMap[child]) {
        titleMap[child] = { title: child, children: [] };
      }
      titleMap[title].children.push(titleMap[child]);
    });
  });

  const childTitles = new Set(data.flatMap(({ children }) => children));
  return Object.values(titleMap).filter(({ title }) => !childTitles.has(title));
};

function OntTree() {
  const db = getFirestore();
  const [treeData, setTreeData] = useState<TreeNode[]>([]);

  const getData = async () => {
    const nodesDocs = await getDocs(collection(db, NODES_ONET));
    const nodes_data: any = [];
    nodesDocs.docs.forEach((doc) => {
      nodes_data.push(doc.data());
    });
    setTreeData(buildTree(nodes_data));
  };

  useEffect(() => {
    getData();
  }, []);

  const renderTree = (
    nodes: TreeNode,
    visitedNodes: Set<string> = new Set()
  ) => {
    if (visitedNodes.has(nodes.title)) {
      return null; // Avoid infinite recursion for circular references
    }

    visitedNodes.add(nodes.title);
    return (
      <TreeItem key={nodes.title} nodeId={nodes.title} label={nodes.title}>
        {nodes.children.map((child) =>
          renderTree(child, new Set(visitedNodes))
        )}
      </TreeItem>
    );
  };

  return (
    <Box>
      <Typography
        sx={{
          alignItems: "center",
          textAlign: "center",
          fontSize: "35px",
          position: "sticky",
          top: 0,
          backgroundColor: "white",
          zIndex: 5,
        }}
      >
        ONet
      </Typography>
      <TreeView
        defaultCollapseIcon={<ExpandMore />}
        defaultExpandIcon={<ChevronRight />}
      >
        {treeData.map((node) => renderTree(node))}
      </TreeView>
    </Box>
  );
}

export default OntTree;
