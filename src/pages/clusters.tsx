// import { NODES_ONET } from " @components/lib/firestoreClient/collections";
import { collection, getDocs, getFirestore, query } from "firebase/firestore";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Bar, Container, Section } from "@column-resizer/react";
import SettingsEthernetIcon from "@mui/icons-material/SettingsEthernet";
import { TreeItem } from "@mui/lab";
import CloseIcon from "@mui/icons-material/Close";
import WorkspacesIcon from "@mui/icons-material/Workspaces";
import {
  Box,
  Drawer,
  Grid,
  IconButton,
  Typography,
} from "@mui/material";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import { TreeApi } from "react-arborist";
import { INode, TreeData } from "@components/types/INode";
import DraggableTree from "@components/components/OntologyComponents/OutlineView";
import FullPageLogoLoading from "@components/components/layouts/FullPageLogoLoading";
import GraphView from "@components/components/OntologyComponents/GraphView";
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

// The hierarchy is a DAG: a node with several parents is shown in full under
// each of them. Building every copy up front grows multiplicatively and froze
// the page, so the outline is built lazily (one level per opened node) and the
// graph only builds the nodes that are expanded in it.

const ROOT_ORDER = [
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

type TreeRow = {
  id: string;
  nodeId: string;
  name: string;
  nodeType?: string;
  children: TreeRow[];
  actionAlternatives?: string[];
  category: boolean;
  task?: boolean;
  oNetTask?: boolean;
  comments?: boolean;
  childCount?: number;
  /** Doc ids above this row on its branch (used for cycle checks). */
  ancestorIds?: string[];
  /** Graph expansion keys (doc ids and `${docId}-${collection}`) that make this row visible in the graph. */
  graphKeys?: string[];
  outlineLoadChildren?: boolean;
  hasUnresolvedChildren?: boolean;
};

const uniqueById = (docs: any[]) => {
  const seen = new Set<string>();
  return docs.filter((doc) => !seen.has(doc.id) && !!seen.add(doc.id));
};

// Splits a doc's specializations into named collections and the main list.
// Links to missing docs, or to docs already on the branch (cycles), are dropped.
const getChildGroups = (
  doc: any,
  nodesById: Record<string, any>,
  branch: Set<string>,
) => {
  const collections: { name: string; docs: any[] }[] = [];
  const main: any[] = [];
  for (const collection of doc.specializations || []) {
    const docs = (collection.nodes || [])
      .map((link: { id: string }) => nodesById[link.id])
      .filter((child: any) => child && !branch.has(child.id));
    if (collection.collectionName && collection.collectionName !== "main") {
      if (docs.length > 0) {
        collections.push({ name: collection.collectionName, docs: uniqueById(docs) });
      }
    } else {
      main.push(...docs);
    }
  }
  return { collections, main: uniqueById(main) };
};

const sortRows = (rows: TreeRow[]) =>
  rows.sort((a, b) => {
    if ((!!a.task || !!a.comments) && (!!b.task || !!b.comments)) {
      return 0;
    }
    if (!!a.task || b.comments) {
      return 1;
    }
    if (!!b.task || !!b.comments) {
      return -1;
    }
    return (b.childCount || 0) - (a.childCount || 0);
  });

const getRootDocs = (nodesById: Record<string, any>) => {
  const rootIndex = (title: string) => {
    const index = ROOT_ORDER.indexOf(title.toLowerCase());
    return index !== -1 ? index : ROOT_ORDER.length;
  };
  return Object.values(nodesById)
    .filter((doc: any) => (doc.generalizations?.[0]?.nodes?.length ?? 0) <= 0)
    .sort((a: any, b: any) => rootIndex(a.title) - rootIndex(b.title));
};

// A collapsed outline row: children are filled in by expandRow when opened.
const makeRow = (
  doc: any,
  id: string,
  ancestorIds: string[],
  nodesById: Record<string, any>,
  graphKeys: string[],
): TreeRow => {
  const { collections, main } = getChildGroups(
    doc,
    nodesById,
    new Set([...ancestorIds, doc.id]),
  );
  const childCount = collections.length + main.length;
  return {
    id,
    nodeId: doc.id,
    name: doc.title,
    nodeType: doc.nodeType,
    children: [],
    actionAlternatives: doc.actionAlternatives,
    category: !!doc.category,
    task: !!doc.task,
    oNetTask: !!doc.oNetTask,
    comments: !!doc.comments,
    childCount,
    ancestorIds,
    graphKeys,
    outlineLoadChildren: childCount > 0,
    hasUnresolvedChildren: childCount > 0,
  };
};

// Builds one level under a row: its named collections (with their members)
// and its main children. Row ids are full paths, so every copy is unique.
const expandRow = (row: TreeRow, nodesById: Record<string, any>): TreeRow => {
  const doc = nodesById[row.nodeId];
  if (!doc) {
    return { ...row, outlineLoadChildren: false, hasUnresolvedChildren: false };
  }
  const ancestorIds = [...(row.ancestorIds || []), doc.id];
  // In the graph, children show once this doc (and their collection) is expanded.
  const childGraphKeys = [...(row.graphKeys || []), doc.id];
  const { collections, main } = getChildGroups(
    doc,
    nodesById,
    new Set(ancestorIds),
  );
  const children: TreeRow[] = [
    ...collections.map(({ name, docs }) => {
      const collectionId = `${row.id}-${name}`;
      const memberGraphKeys = [...childGraphKeys, graphCollectionKey(doc.id, name)];
      const members = sortRows(
        docs.map((child) =>
          makeRow(
            child,
            `${collectionId}-${child.id}`,
            ancestorIds,
            nodesById,
            memberGraphKeys,
          ),
        ),
      );
      return {
        id: collectionId,
        nodeId: doc.id,
        nodeType: doc.nodeType,
        name,
        children: members,
        actionAlternatives: doc.actionAlternatives,
        category: true,
        childCount: members.length,
        graphKeys: childGraphKeys,
      };
    }),
    ...sortRows(
      main.map((child) =>
        makeRow(
          child,
          `${row.id}-${child.id}`,
          ancestorIds,
          nodesById,
          childGraphKeys,
        ),
      ),
    ),
  ];
  return {
    ...row,
    children,
    outlineLoadChildren: false,
    hasUnresolvedChildren: false,
  };
};

const buildOutline = (nodesById: Record<string, any>): TreeRow[] =>
  getRootDocs(nodesById).map((doc: any) =>
    expandRow(
      makeRow(
        doc,
        doc.title.toLowerCase() === "act" ? "root" : doc.id,
        [],
        nodesById,
        [],
      ),
      nodesById,
    ),
  );

// Replaces the row with `targetId`, only walking the branch that leads to it.
const mapRowAtId = (
  rows: TreeRow[],
  targetId: string,
  update: (row: TreeRow) => TreeRow,
): TreeRow[] =>
  rows.map((row) => {
    if (row.id === targetId) {
      return update(row);
    }
    if (
      row.children.length > 0 &&
      (row.id === "root" || targetId.startsWith(`${row.id}-`))
    ) {
      return { ...row, children: mapRowAtId(row.children, targetId, update) };
    }
    return row;
  });

const findRow = (rows: TreeRow[], targetId: string): TreeRow | undefined => {
  for (const row of rows) {
    if (row.id === targetId) {
      return row;
    }
    if (
      row.children.length > 0 &&
      (row.id === "root" || targetId.startsWith(`${row.id}-`))
    ) {
      const found = findRow(row.children, targetId);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
};

/** The graph's expansion key for a named collection under a doc. */
const graphCollectionKey = (docId: string, collectionName: string) =>
  `${docId}-${collectionName}`;

/** One step down a path: the doc, and the parent's collection it sits in (null = main). */
type PathStep = { docId: string; collectionName: string | null };
type ParentLink = { parentId: string; collectionName: string | null };

// child id -> the docs that list it in their specializations (what the outline uses).
const buildParentIndex = (nodesById: Record<string, any>) => {
  const parentsOf: Record<string, ParentLink[]> = {};
  for (const doc of Object.values(nodesById)) {
    for (const collection of doc.specializations || []) {
      const collectionName =
        collection.collectionName && collection.collectionName !== "main"
          ? collection.collectionName
          : null;
      for (const link of collection.nodes || []) {
        if (nodesById[link.id] && link.id !== doc.id) {
          (parentsOf[link.id] ||= []).push({ parentId: doc.id, collectionName });
        }
      }
    }
  }
  return parentsOf;
};

// Shortest path from a root down to `targetId`. Links that pass `isPreferred`
// are tried first, so the path follows what the user already has open.
const findPathFromRoot = (
  targetId: string,
  parentsOf: Record<string, ParentLink[]>,
  rootIds: Set<string>,
  isPreferred: (link: ParentLink) => boolean,
): PathStep[] | null => {
  if (rootIds.has(targetId)) {
    return [{ docId: targetId, collectionName: null }];
  }
  const search = (allow: (link: ParentLink) => boolean) => {
    // parent id -> the step from that parent down toward the target.
    const down = new Map<string, PathStep>();
    const visited = new Set([targetId]);
    let queue = [targetId];
    while (queue.length > 0) {
      const nextQueue: string[] = [];
      for (const childId of queue) {
        for (const link of parentsOf[childId] || []) {
          if (!allow(link) || visited.has(link.parentId)) continue;
          visited.add(link.parentId);
          down.set(link.parentId, {
            docId: childId,
            collectionName: link.collectionName,
          });
          if (rootIds.has(link.parentId)) {
            const path: PathStep[] = [
              { docId: link.parentId, collectionName: null },
            ];
            let current = link.parentId;
            while (current !== targetId) {
              const step = down.get(current)!;
              path.push(step);
              current = step.docId;
            }
            return path;
          }
          nextQueue.push(link.parentId);
        }
      }
      queue = nextQueue;
    }
    return null;
  };
  return search(isPreferred) ?? search(() => true);
};

/** Graph keys that must be expanded to show the last doc of `path`. */
const graphKeysForPath = (path: PathStep[]) =>
  path.slice(1).flatMap((step, i) => {
    const parentId = path[i].docId;
    return step.collectionName
      ? [parentId, graphCollectionKey(parentId, step.collectionName)]
      : [parentId];
  });

// Builds the outline rows along `path` (expanding each one) so its last doc
// has a row the outline can select. Returns the new rows and that row's id.
const revealPath = (
  rows: TreeRow[],
  path: PathStep[],
  nodesById: Record<string, any>,
): { rows: TreeRow[]; rowId: string | null } => {
  const rootRow = rows.find(
    (row) => row.nodeId === path[0].docId && !row.category,
  );
  if (!rootRow) {
    return { rows, rowId: null };
  }
  let rowId = rootRow.id;
  for (const step of path.slice(1)) {
    rows = mapRowAtId(rows, rowId, (row) =>
      row.outlineLoadChildren ? expandRow(row, nodesById) : row,
    );
    const childId = step.collectionName
      ? `${rowId}-${step.collectionName}-${step.docId}`
      : `${rowId}-${step.docId}`;
    if (!findRow(rows, childId)) {
      break;
    }
    rowId = childId;
  }
  return { rows, rowId };
};

// Graph tree: one entry per doc (GraphView merges copies by nodeId anyway).
// Children are built only for expanded nodes; collapsed nodes get lightweight
// placeholders so the graph's "N▸" child count stays correct.
const buildGraphTree = (
  rootDocs: any[],
  nodesById: Record<string, any>,
  expanded: Set<string>,
): TreeRow[] => {
  const memo = new Map<string, TreeRow>();
  const onBranch = new Set<string>();
  const placeholder = (id: string, name: string): TreeRow => ({
    id,
    nodeId: id,
    name,
    category: false,
    children: [],
  });

  const build = (doc: any): TreeRow => {
    const cached = memo.get(doc.id);
    if (cached) {
      return cached;
    }
    onBranch.add(doc.id);
    const { collections, main } = getChildGroups(doc, nodesById, onBranch);
    const isOpen = expanded.has(doc.id);
    const children: TreeRow[] = [
      ...collections.map(({ name, docs }) => {
        const collectionId = `${doc.id}-${name}`;
        return {
          id: collectionId,
          nodeId: doc.id,
          name,
          category: true,
          children:
            isOpen && expanded.has(collectionId)
              ? docs.map(build)
              : docs.map((child) => placeholder(child.id, child.title)),
        };
      }),
      ...(isOpen
        ? main.map(build)
        : main.map((child) => placeholder(child.id, child.title))),
    ];
    onBranch.delete(doc.id);
    const row: TreeRow = {
      id: doc.id,
      nodeId: doc.id,
      name: doc.title,
      nodeType: doc.nodeType,
      children,
      actionAlternatives: doc.actionAlternatives,
      category: !!doc.category,
      oNetTask: !!doc.oNetTask,
    };
    memo.set(doc.id, row);
    return row;
  };

  return rootDocs.map(build);
};

function OntTree() {
  const db = getFirestore();
  const [treeData, setTreeData] = useState<TreeRow[]>([]);
  const [nodesById, setNodesById] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [tree, setTree] = useState<TreeApi<TreeData> | null | undefined>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [expandDefault, setExpandDefault] = useState("");
  const treeRef = useRef<TreeApi<TreeData>>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  // Shared selection: selecting a node in either view navigates the other to it.
  const [currentVisibleNode, setCurrentVisibleNode] = useState<{
    id: string;
  } | null>(null);

  const rootDocs = useMemo(() => getRootDocs(nodesById), [nodesById]);
  const rootIds = useMemo(
    () => new Set<string>(rootDocs.map((doc: any) => doc.id)),
    [rootDocs],
  );
  const parentsOf = useMemo(() => buildParentIndex(nodesById), [nodesById]);

  // Outline -> graph: open the graph nodes/collections on the clicked row's path.
  const onOutlineSelect = useCallback(
    (nodeId: string, _name?: string, row?: TreeRow) => {
      const keys =
        row?.graphKeys ??
        graphKeysForPath(
          findPathFromRoot(nodeId, parentsOf, rootIds, () => true) || [],
        );
      if (keys.length > 0) {
        setExpandedNodes((prev) => {
          const next = new Set(prev);
          keys.forEach((key) => next.add(key));
          return next;
        });
      }
      setCurrentVisibleNode({ id: nodeId });
    },
    [parentsOf, rootIds],
  );

  // Graph -> outline: build the outline rows down to the clicked node, following
  // the links the graph has open, so the outline can select and scroll to it.
  const onGraphSelect = useCallback(
    (nodeId: string) => {
      const path = findPathFromRoot(
        nodeId,
        parentsOf,
        rootIds,
        (link) =>
          expandedNodes.has(link.parentId) &&
          (!link.collectionName ||
            expandedNodes.has(
              graphCollectionKey(link.parentId, link.collectionName),
            )),
      );
      if (path) {
        setTreeData((prev) => revealPath(prev, path, nodesById).rows);
      }
      setCurrentVisibleNode({ id: nodeId });
    },
    [expandedNodes, nodesById, parentsOf, rootIds],
  );

  // Builds the next level of the outline when a collapsed row is opened.
  const onOutlineNodeOpen = useCallback(
    async (apiNode: { data: TreeRow }) => {
      const row = apiNode.data;
      if (!row.outlineLoadChildren) {
        return;
      }
      setTreeData((prev) =>
        mapRowAtId(prev, row.id, (target) => expandRow(target, nodesById)),
      );
    },
    [nodesById],
  );

  const graphTreeData = useMemo(
    () => buildGraphTree(rootDocs, nodesById, expandedNodes),
    [rootDocs, nodesById, expandedNodes],
  );

  const getData = async () => {
    setLoading(true);
    const nodesDocs = await getDocs(
      query(collection(db, "oNetNodesDecomposed")),
    );
    const nodes: Record<string, any> = {};
    let actId = "";
    nodesDocs.docs.forEach((doc) => {
      const data = doc.data();
      nodes[doc.id] = {
        ...data,
        // Links in specializations are looked up by Firestore doc id.
        id: doc.id,
        category: data.title.endsWith("?"),
      };
      if (data.title === "act") {
        actId = doc.id;
      }
    });
    setExpandDefault(actId);
    setNodesById(nodes);
    setTreeData(buildOutline(nodes));
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
    return <FullPageLogoLoading />;
  }

  return (
    <Box
      sx={{
        width: "100%",
        height: "100vh",
      }}
    >
      <Container
        style={{ height: "100%", display: "flex", overflow: "hidden" }}
      >
        <Section
          minSize={250}
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <DraggableTree
            treeViewData={treeData}
            setSnackbarMessage={() => {}}
            currentVisibleNode={currentVisibleNode}
            nodes={{}}
            onOpenNodesTree={onOutlineSelect}
            onOutlineNodeOpen={onOutlineNodeOpen as any}
            treeRef={treeRef}
            treeType="oNet"
            appName=""
            specializationNumsUnder={{}}
          />
        </Section>
        <Bar
          size={10}
          style={{
            background: "transparent",
            cursor: "col-resize",
            position: "relative",
          }}
        >
          <SettingsEthernetIcon
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              color: (theme) =>
                theme.palette.mode === "dark"
                  ? theme.palette.common.gray50
                  : theme.palette.common.notebookMainBlack,
              borderRadius: "50%",
              ":hover": {
                backgroundColor: "orange",
              },
            }}
          />
        </Bar>
        <Section minSize={250} style={{ height: "100%", overflow: "hidden" }}>
          <GraphView
            treeData={graphTreeData as any}
            expandedNodes={expandedNodes}
            setExpandedNodes={setExpandedNodes}
            onOpenNodeDagre={onGraphSelect}
            currentVisibleNode={currentVisibleNode}
          />
        </Section>
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
      </Container>
    </Box>
  );
}

export default OntTree;
