// import { NODES_ONET } from " @components/lib/firestoreClient/collections";
import { collection, getDocs, getFirestore, query } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { TreeItem } from "@mui/lab";
import { Box, CircularProgress, Grid, Typography } from "@mui/material";
import { INode, TreeData } from " @components/types/INode";
import DraggableTree from " @components/components/OntologyComponents/DraggableTree";
import { TreeApi } from "react-arborist";
import DomainLookupSidebar from " @components/components/DomainLookup/DomainLookupSidebar";
const NODES_ONET = "oNetNodesDecomposed";
type TreeNode = {
  title: string;
  children: TreeNode[];
};
const alternatives = {
  direct: [
    "Oversee",
    "Supervise",
    "Manage",
    "Monitor",
    "Guide",
    "Instruct",
    "Command",
    "Lead",
  ],
  engage: ["Take part", "Participate", "Contribute"],
  inspire: ["Motivate", "Encourage"],
  provide: ["Deliver", "Administer", "Dispense", "Apply", "Offer"],
  organize: [
    "Manage",
    "Coordinate",
    "Align",
    "Arrange",
    "Set up",
    "Deploy",
    "Install",
    "Facilitate",
  ],
  conduct: ["Facilitate", "Perform", "Execute", "Carry out", "Implement"],
  evaluate: ["Assess", "Review", "Appraise", "Examine", "Grade", "Score"],
  inform: ["Alert", "Notify", "Convey", "Relay", "Communicate"],
  initiate: [
    "Begin",
    "Start",
    "Set",
    "Determine",
    "Establish",
    "Define",
    "Plan",
    "Strategize",
  ],
  observe: ["Monitor", "Follow", "Track"],
  assist: ["Help", "Support", "Aid"],
  request: [
    "Prescribe",
    "Order",
    "Requisition",
    "Delegate",
    "Assign",
    "Allocate",
  ],
  log: ["Document", "Record"],
  alert: ["Warn"],
  recommend: ["Counsel", "Advise", "Prescribe", "Advocate", "Suggest"],
  redirect: ["Reroute"],
  rank: ["Order", "Prioritize"],
  toggle: ["Change", "Switch"],
  assume: ["Take"],
  utilize: ["Use", "Apply"],
  terminate: ["Discontinue", "Cancel"],
  create: ["Formulate", "Develop"],
  authorize: ["Sanction", "Approve"],
  distribute: ["Allocate", "Deliver", "Dispense"],
  modify: ["Adjust"],
  combine: ["Incorporate", "Integrate"],
  file: ["Present", "Submit"],
  question: ["Interview"],
  verify: ["Inspect", "Check", "Confirm", "Ensure"],
  care: ["Treat", "Bandage", "Wrap"],
  select: ["Choose", "Pick"],
  accompany: ["Escort"],
  instruct: ["Teach", "Educate", "Train"],
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
      if (collection.collectionName !== "main" && collection.collectionName) {
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
  return newNodes.sort((a, b) => b.children.length - a.children.length);
};

const buildTree = (data: any[], nodes: any): TreeNode[] => {
  const mainCategories = Object.values(data).filter(
    (node: INode) => node.generalizations[0].nodes.length <= 0,
  );

  // Sort main nodes based on a predefined order
  mainCategories.sort((nodeA: any, nodeB: any) => {
    const order = [
      "direct",
      "engage",
      "inspire",
      "provide",
      "organize",
      "conduct",
      "evaluate",
      "inform",
      "initiate",
      "observe",
      "assist",
      "request",
      "log",
      "alert",
      "recommend",
      "redirect",
      "rank",
      "toggle",
      "assume",
      "utilize",
      "terminate",
      "create",
      "authorize",
      "distribute",
      "modify",
      "combine",
      "file",
      "question",
      "verify",
      "care",
      "select",
      "accompany",
      "instruct",
    ];

    const getIndex = (title: string): number => {
      const index = order.indexOf(title);
      return index !== -1 ? index : order.length;
    };

    return getIndex(nodeA.title) - getIndex(nodeB.title);
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
      nodes[doc.id] = {
        ...doc.data(),
        category: doc.data().title.endsWith("?"),
      };
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
    <Box
      sx={{
        width: "100%",
        height: "100vh",
        ml: "13px",
      }}
    >
      <Grid container spacing={2}>
        <Grid item xs={8}>
          <DraggableTree
            treeViewData={treeData}
            setSnackbarMessage={() => {}}
            expandedNodes={new Set()}
            currentVisibleNode={null}
            nodes={{}}
            onOpenNodesTree={() => {}}
            tree={tree}
            setTree={setTree}
            alternatives={alternatives}
            treeType="oNet"
          />
        </Grid>
        <Grid item xs={3}>
          <DomainLookupSidebar />
        </Grid>
      </Grid>
    </Box>
  );
}

export default OntTree;
