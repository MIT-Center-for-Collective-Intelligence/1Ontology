// import { NODES_ONET } from " @components/lib/firestoreClient/collections";
import { collection, getDocs, getFirestore, query } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { TreeItem } from "@mui/lab";
import { Box, CircularProgress, Typography } from "@mui/material";
import { INode, TreeData } from " @components/types/INode";
import DraggableTree from " @components/components/OntologyComponents/DraggableTree";
import { TreeApi } from "react-arborist";
const NODES_ONET = "oNetNodesDecomposed";
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
  return newNodes;
};

const buildTree = (data: any[], nodes: any): TreeNode[] => {
  const mainCategories = Object.values(data).filter(
    (node: INode) => node.generalizations[0].nodes.length <= 0,
  );

  // Sort main nodes based on a predefined order
  mainCategories.sort((nodeA: any, nodeB: any) => {
    const order = [
      "Oversee/supervise/direct/monitor",
      "Oversee/supervise/direct",
      "Oversee/supervise/direct/manage/administer",
      "Oversee/supervise/direct/manage",
      "Engage/take part/participate",
      "Promote/motivate/encourage",
      "Provide/deliver/administer/dispense",
      "Oversee/supervise/direct/guide",
      "Route/guide/direct/supervise/oversee/instruct/command",
      "Oversee/supervise/direct/manage/monitor",
      "Supervise/oversee/direct/lead/manage",
      "Organize/manage/coordinate/align",
      "Conduct/facilitate/administer",
      "Provide/deliver/administer/dispense/apply",
      "Manage/oversee/direct/supervise",
      "Supervise/oversee/direct/guide",
      "Organize/align/coordinate/facilitate",
      "Supervise/oversee/direct/manage",
      "Provide/deliver/administer",
      "Initiate/begin/start",
      "Supervise/oversee/direct",
      "Manage/oversee/administer",
      "Organize/manage/coordinate",
      "Immediate/direct",
      "Provide/deliver/administer/perform/offer",
      "Inform/alert/notify",
      "Guide/lead/direct/control/instruct/train",
      "Organize/manage/coordinate/arrange/align",
      "Analyze/evaluate/interpret",
      "Convey/move/transport",
      "Conduct/lead/direct",
      "Evaluate/assess/review",
      "Manage/control/direct/oversee/supervise",
      "Redirect/reroute",
      "Align/organize/coordinate",
      "Arrange/structure/organize",
      "Rank/order/prioritize",
      "Oversee/supervise/direct/instruct/guide/lead/manage",
      "Oversee/supervise/direct/lead",
      "Instruct/guide/direct",
      "Provide/dispense/administer",
      "Guide/lead/direct",
      "Supervise/oversee/direct/manage/guide/proctor",
      "Log/document/record",
      "Supervise/oversee/direct/monitor/observe",
      "Bandage/wrap",
      "Care for/treat",
      "Direct/refer",
      "Alert/warn",
      "Manage/oversee/administer/supervise/direct/lead/conduct/facilitate",
      "Guide/command/direct",
      "Conduct/perform/administer/oversee/carry out",
      "Request/prescribe/order",
      "Direct",
      "Set/determine/establish/define",
      "Plan/organize/schedule",
      "Monitor/follow/track",
      "Offer/deliver/provide",
      "Guarantee/confirm/ensure",
      "Implement/carry out/execute",
      "Conduct/oversee/administer",
      "Assess/review/evaluate/examine",
      "Oversee/supervise/direct/monitor/manage",
      "Review/examine/search/inspect",
      "Delegate/assign",
      "Assess/review/evaluate",
      "Recommend/counsel/advise",
      "Coordinate/arrange/stage",
      "Perform/carry out/conduct",
      "Choose/pick/select",
      "Allocate/deliver/distribute",
      "Supervise/direct/oversee",
      "Execute/carry out/perform",
      "Evaluate/appraise/assess/review",
      "Convey/relay/communicate",
      "Oversee/track/monitor",
      "Help/support/assist",
      "Observe/track/monitor/supervise",
      "Guide/instruct/direct/lead",
      "Enforce/implement/administer",
      "Examine/evaluate/analyze",
      "Create/formulate/develop",
      "Authorize/sanction/approve",
      "Lead/guide/direct",
      "Assist/aid/support",
      "Organize/align/coordinate",
      "Organize/coordinate",
      "Set up/deploy/install",
      "Terminate/discontinue/cancel",
      "Engage/take part/participate/contribute",
      "Instruct/command/direct",
      "Manage/direct",
      "Accompany/escort",
      "Observe/monitor",
      "Administer",
      "Engage/contribute/participate",
      "File/present/submit",
      "Guide/direct/instruct",
      "Conduct/administer",
      "Question/interview",
      "Request/order/requisition",
      "Verify/inspect/check",
      "Toggle/change/switch",
      "Assume/take",
      "Assist/aid/help",
      "Inspire/encourage/motivate",
      "Oversee/supervise/monitor",
      "Design/strategize/plan",
      "Execute/enforce/implement",
      "Oversee/supervise/direct/monitor/manage/observe",
      "Organize/align/coordinate/manage",
      "Distribute/dispense",
      "Recommend/prescribe",
      "Instruct/teach/train",
      "Instruct/educate/train",
      "Combine/incorporate/integrate",
      "Evaluate/grade/score",
      "Organize/set up/arrange",
      "Conduct/perform/administer",
      "Allocate/assign",
      "Verify/confirm/ensure",
      "Utilize/use/apply",
      "Grade/evaluate/score",
      "Modify/adjust",
      "Organize/facilitate/coordinate",
      "Advocate/suggest/recommend",
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
