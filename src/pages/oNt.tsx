// import { NODES_ONET } from "@components/lib/firestoreClient/collections";
import { collection, getDocs, getFirestore, query } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { TreeItem } from "@mui/lab";
import CloseIcon from "@mui/icons-material/Close";
import WorkspacesIcon from "@mui/icons-material/Workspaces";
import {
  Box,
  CircularProgress,
  Drawer,
  Grid,
  IconButton,
  Typography,
} from "@mui/material";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import { INode, TreeData } from "@components/types/INode";
import DraggableTree from "@components/components/OntologyComponents/DraggableTree";
import { TreeApi } from "react-arborist";
import DomainLookupSidebar from "@components/components/DomainLookup/DomainLookupSidebar";
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

const domainsEmojis: Record<string, string> = {
  "🌾": "Agriculture & Farming",
  "📒": "Accounting & Bookkeeping",
  "📁": "Administration & Clerical",
  "🤖": "AI & Machine Learning",
  "🐟": "Aquaculture Management",
  "✈️": "Aviation Management",
  "🧬": "Bioinformatics & Computational Biology",
  "🏗️": "Construction & Infrastructure Management",
  "💼": "Consulting & Advisory",
  "🎨": "Creative & Design",
  "🍽️": "Culinary & Food Services",
  "🔒": "Cybersecurity",
  "🛠️": "Design & Manufacturing",
  "🎓": "Education & Academic Research",
  "🚑": "Emergency Services",
  "⚡": "Energy Management",
  "⚙️": "Engineering & Technical Support",
  "🌱": "Environmental Management",
  "🎉": "Event Coordination",
  "🏢": "Facilities Management",
  "💰": "Finance",
  "🧯": "Fire Safety & Protection Systems",
  "🏋️": "Fitness & Wellness",
  "⚰️": "Funeral Services",
  "🏛️": "Government & Policy",
  "🩺": "Healthcare & Clinical Services",
  "🏥": "Healthcare Management",
  "🏨": "Hospitality Management",
  "👥": "Human Resources",
  "💻": "Information Technology",
  "⚖️": "Legal Services",
  "📚": "Library & Information Services",
  "🚚": "Logistics & Supply Chain Management",
  "🧑‍💼": "Management & Administration",
  "🏭": "Manufacturing & Operations",
  "📣": "Marketing & Customer Acquisition",
  "🎥": "Media Production",
  "🖼️": "Museum & Gallery Management",
  "💸": "Nonprofit & Educational Fundraising",
  "🐛": "Pest & Weed Management",
  "🎭": "Performing Arts",
  "🗓️": "Project Management",
  "🏠": "Property Management",
  "🌐": "Public Health",
  "✔️": "Quality Assurance & Testing",
  "✅": "Regulatory Compliance",
  "🔬": "Research & Development",
  "💵": "Sales & Business Development",
  "🛡️": "Security & Loss Prevention",
  "📱": "Social Media Management",
  "🧑‍💻": "Software Development",
  "🚦": "Traffic Management",
  "🐾": "Veterinary Services",
};

const getTreeView = (
  mainCategories: any[],
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
          actionAlternatives: node.actionAlternatives,
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
      id: node.title.toLowerCase() === "act" ? "root" : id,
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
      actionAlternatives: node.actionAlternatives,
      category: !!node.category,
      task: !!node.task,
      comments: !!node.comments,
    });
  }
  return newNodes.sort((a, b) => {
    if ((!!a.task || !!a.comments) && (!!b.task || !!b.comments)) {
      return 0;
    }

    if (!!a.task || b.comments) {
      return 1;
    }
    if (!!b.task || !!b.comments) {
      return -1;
    }

    return b.children.length - a.children.length;
  });
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
      const index = order.indexOf(title.toLowerCase());
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
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [expandDefault, setExpandDefault] = useState("");

  const getData = async () => {
    setLoading(true);
    const nodesDocs = await getDocs(
      query(collection(db, "oNetNodesDecomposedTree")),
    );
    const nodes_data: any = [];
    const nodes: any = {};
    let actId = "";
    nodesDocs.docs.forEach((doc) => {
      nodes_data.push(doc.data());
      nodes[doc.id] = {
        ...doc.data(),
        category: doc.data().title.endsWith("?"),
      };
      if (doc.data().title === "act") {
        actId = doc.id;
      }
      setExpandDefault(actId);
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
      }}
    >
      <Box sx={{ display: "flex" }}>
        <Box sx={{ width: /* isExpanded ? "80%" : "98%" */ "100%" }}>
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
            domainsEmojis={domainsEmojis}
            treeType="oNet"
            expandDefault={expandDefault}
          />
        </Box>
        {/*  <Box
          sx={{
            width: isExpanded ? "20%" : "2%",
            backgroundColor: isExpanded ? "#424242" : "",
            borderRadius: "25px",
          }}
        >
          <Box
            display="flex"
            alignItems="center"
            sx={{
              position: !isExpanded ? "absolute" : "sticky",
              backgroundColor: isExpanded ? "#424242" : "",
              zIndex: isExpanded ? 7 : "",
              top: 0,
              right: 0,
              alignContent: "center",
              alignItems: "center",
              borderRadius: "25px",
            }}
          >
            <IconButton
              onClick={() => setIsExpanded(!isExpanded)}
              sx={{ mr: "10px" }}
            >
              {isExpanded ? <CloseIcon /> : <WorkspacesIcon />}
            </IconButton>{" "}
            {isExpanded && (
              <Typography
                variant="h6"
                gutterBottom
                sx={{ alignItems: "center" }}
              >
                Domain Lookup
              </Typography>
            )}
          </Box>
          {isExpanded && (
            <Box sx={{ height: "100vh" }}>
              <DomainLookupSidebar />
            </Box>
          )}
        </Box> */}
      </Box>
    </Box>
  );
}

export default OntTree;
