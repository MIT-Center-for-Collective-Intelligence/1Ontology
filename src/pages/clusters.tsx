import { getAuth } from "firebase/auth";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { TreeItem } from "@mui/lab";
import CloseIcon from "@mui/icons-material/Close";
import WorkspacesIcon from "@mui/icons-material/Workspaces";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
  alpha,
  Autocomplete,
  Box,
  GlobalStyles,
  Drawer,
  Grid,
  IconButton,
  InputAdornment,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import type { Theme } from "@mui/material/styles";
import Head from "next/head";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import { TreeApi } from "react-arborist";
import { INode, TreeData } from "@components/types/INode";
import DraggableTree from "@components/components/OntologyComponents/OutlineView";
import FullPageLogoLoading from "@components/components/layouts/FullPageLogoLoading";
import ClustersGraph, {
  CATEGORY_FILL,
  DEFAULT_FILL,
} from "@components/components/OntologyComponents/ClustersGraph";
import { SCROLL_BAR_STYLE } from "@components/lib/CONSTANTS";
import { usePageVisitLog } from "@components/lib/hooks/usePageVisitLog";
import { useAuth } from "@components/components/context/AuthContext";
import withAuthUser from "@components/components/hoc/withAuthUser";
import type { ClustersNode } from "@components/pages/api/clusters/nodes";

/** The search dropdown's background (the theme's Paper colors, made explicit). */
const searchPaperBg = (t: Theme) =>
  t.palette.mode === "dark" ? "#303134" : "#f0f0f0";

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
  /** Question rows are docs, so the outline may highlight them when selected. */
  highlightWhenActive?: boolean;
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
        collections.push({
          name: collection.collectionName,
          docs: uniqueById(docs),
        });
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
    highlightWhenActive: !!doc.category,
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
      const memberGraphKeys = [
        ...childGraphKeys,
        graphCollectionKey(doc.id, name),
      ];
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
          (parentsOf[link.id] ||= []).push({
            parentId: doc.id,
            collectionName,
          });
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

// One path from a root down to `nodeId` through each of its direct parents, so
// navigating can show the node under every parent. Links that pass
// `isPreferred` are tried first (paths the user already has open).
const pathsThroughEachParent = (
  nodeId: string,
  parentsOf: Record<string, ParentLink[]>,
  rootIds: Set<string>,
  isPreferred: (link: ParentLink) => boolean,
): PathStep[][] => {
  if (rootIds.has(nodeId)) {
    return [[{ docId: nodeId, collectionName: null }]];
  }
  const paths: PathStep[][] = [];
  const seen = new Set<string>();
  for (const link of parentsOf[nodeId] || []) {
    const key = `${link.parentId}\u0000${link.collectionName ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const toParent = findPathFromRoot(
      link.parentId,
      parentsOf,
      rootIds,
      isPreferred,
    );
    // Skip parents that are unreachable or only reachable through the node.
    if (!toParent || toParent.some((step) => step.docId === nodeId)) continue;
    paths.push([
      ...toParent,
      { docId: nodeId, collectionName: link.collectionName },
    ]);
  }
  return paths;
};

/** Outline row ids along `path`, root first (collection rows included). */
const outlineRowIdsForPath = (
  path: PathStep[],
  nodesById: Record<string, any>,
): string[] => {
  const rootId = path[0].docId;
  let rowId =
    nodesById[rootId]?.title?.toLowerCase() === "act" ? "root" : rootId;
  const rowIds = [rowId];
  for (const step of path.slice(1)) {
    if (step.collectionName) {
      rowIds.push(`${rowId}-${step.collectionName}`);
      rowId = `${rowId}-${step.collectionName}-${step.docId}`;
    } else {
      rowId = `${rowId}-${step.docId}`;
    }
    rowIds.push(rowId);
  }
  return rowIds;
};

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

// Graph tree. The graph merges every copy of a doc into one box, so each doc's
// children are built only the first time it appears; later appearances (under
// another parent, or a loop back to an ancestor) are childless references.
// The graph still draws an arrow from every parent, but walks each subtree
// once: with shared subtrees, interlinked docs (the "Think" verbs list each
// other as children) made it walk millions of rows per redraw.
// Children of collapsed docs are references too, so the "N▸" count is right.
type GraphFocus = Map<string, Set<string>>;

const graphFocusForPaths = (paths: PathStep[][]): GraphFocus => {
  const focus: GraphFocus = new Map();
  const allow = (parentKey: string, childKey: string) => {
    if (!focus.has(parentKey)) focus.set(parentKey, new Set());
    focus.get(parentKey)!.add(childKey);
  };
  for (const path of paths) {
    path.slice(1).forEach((step, i) => {
      const parentId = path[i].docId;
      if (step.collectionName) {
        const collectionKey = graphCollectionKey(parentId, step.collectionName);
        allow(parentId, collectionKey);
        allow(collectionKey, step.docId);
      } else {
        allow(parentId, step.docId);
      }
    });
  }
  return focus;
};

const buildGraphTree = (
  rootDocs: any[],
  nodesById: Record<string, any>,
  expanded: Set<string>,
  focus: GraphFocus,
  showAll: Set<string>,
  selectedId: string | null,
): { tree: TreeRow[]; hiddenCounts: Record<string, number> } => {
  const hiddenCounts: Record<string, number> = {};
  const built = new Set<string>();
  const isPinned = (key: string) => expanded.has(key) || key === selectedId;

  const visibleChildren = <T,>(
    items: T[],
    keyOf: (item: T) => string,
    parentKey: string,
  ): T[] => {
    const pathChildren = focus.get(parentKey);
    if (pathChildren) {
      return items.filter((item) => pathChildren.has(keyOf(item)));
    }
    if (showAll.has(parentKey) || items.length <= GRAPH_CHILD_CAP) {
      return items;
    }
    const keep = new Set<string>();
    for (const item of items) {
      if (isPinned(keyOf(item))) keep.add(keyOf(item));
    }
    for (const item of items) {
      if (keep.size >= GRAPH_CHILD_CAP) break;
      keep.add(keyOf(item));
    }
    return items.filter((item) => keep.has(keyOf(item)));
  };
  const reference = (doc: any): TreeRow => ({
    id: doc.id,
    nodeId: doc.id,
    name: doc.title,
    category: !!doc.category,
    oNetTask: !!doc.oNetTask,
    children: [],
  });

  const build = (doc: any): TreeRow => {
    if (built.has(doc.id)) {
      return reference(doc);
    }
    built.add(doc.id);
    const { collections, main } = getChildGroups(
      doc,
      nodesById,
      new Set([doc.id]),
    );
    const isOpen = expanded.has(doc.id);
    const entries = [
      ...collections.map((collection) => ({
        key: graphCollectionKey(doc.id, collection.name),
        collection,
        child: null as any,
      })),
      ...main.map((child) => ({ key: child.id as string, collection: null, child })),
    ];
    const shown = isOpen
      ? visibleChildren(entries, (entry) => entry.key, doc.id)
      : entries;
    if (isOpen && entries.length > shown.length) {
      hiddenCounts[doc.id] = entries.length - shown.length;
    }
    const children: TreeRow[] = shown.map(({ key, collection, child }) => {
      if (!collection) {
        return isOpen ? build(child) : reference(child);
      }
      const collectionOpen = isOpen && expanded.has(key);
      const shownDocs = collectionOpen
        ? visibleChildren(collection.docs, (member: any) => member.id, key)
        : collection.docs;
      if (collectionOpen && collection.docs.length > shownDocs.length) {
        hiddenCounts[key] = collection.docs.length - shownDocs.length;
      }
      return {
        id: key,
        nodeId: doc.id,
        name: collection.name,
        category: true,
        children: collectionOpen
          ? shownDocs.map(build)
          : collection.docs.map(reference),
      };
    });
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
    return row;
  };

  return { tree: rootDocs.map(build), hiddenCounts };
};

type ClustersView = "outline" | "graph";
type SearchOption = { id: string; title: string };

const MAX_SEARCH_RESULTS = 50;
const SEARCH_LOG_DELAY_MS = 1000;
const PULSE_MS = 2000;
/** Graph labels wrap onto a new line after about this many characters. */
const GRAPH_LABEL_MAX_CHARS = 28;
const GRAPH_CHILD_CAP = 30;
const ACCENT = "#ff8a1f";
/** Same orange the outline uses for O*NET task text (.onetLabel). */
const ONET_TASK_FILL = "#fb6c06";
const ACCENT_GRADIENT = "linear-gradient(180deg, #ffb15c 0%, #ff8a1f 100%)";

// Same border as the outline's tree container (the theme divider is harsher).
const subtleBorder = (t: Theme) =>
  t.palette.mode === "dark"
    ? "rgba(255,255,255,0.08)"
    : "rgba(15, 23, 42, 0.08)";

// Same card look as the outline's tree container, so both views match.
const viewCardSx = {
  backgroundColor: (t: Theme) =>
    t.palette.mode === "dark" ? "#2f3136" : "#eef2f7",
  border: "1px solid",
  borderColor: subtleBorder,
  borderRadius: "10px",
};

/** Renders `text` with the first case-insensitive match of `query` emphasized. */
const HighlightedText = ({ text, query }: { text: string; query: string }) => {
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <Box
        component="mark"
        sx={{ bgcolor: "transparent", color: ACCENT, fontWeight: 700 }}
      >
        {text.slice(at, at + query.length)}
      </Box>
      {text.slice(at + query.length)}
    </>
  );
};

// Memoized, with stable props below, so typing in the search box (which
// re-renders the page) doesn't re-render the outline or redraw the graph.
const MemoOutlineView = React.memo(DraggableTree);
const NO_NODES = {};
const NO_COUNTS: Record<string, number> = {};
const noop = () => {};

// The page is a full-screen layout (each view scrolls or pans inside its own
// card), so the document itself never needs to scroll. Without this, anything
// that sits just past the bottom edge gives the page a stray scrollbar.
// Applies only while this page is mounted.
const NO_PAGE_SCROLL = (
  <GlobalStyles styles={{ "html, body": { overflow: "hidden" } }} />
);

const GRAPH_LEGEND = [
  { label: "Activity", fill: DEFAULT_FILL },
  { label: "Collection", fill: CATEGORY_FILL },
  { label: "O*NET task", fill: ONET_TASK_FILL },
];

const GraphHint = () => (
  <Box
    sx={{
      position: "absolute",
      right: 12,
      bottom: 12,
      maxWidth: "calc(100% - 24px)",
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "flex-end",
      columnGap: 1.5,
      rowGap: 0.5,
      px: 1.5,
      py: 0.75,
      borderRadius: "16px",
      bgcolor: (t) => alpha(t.palette.background.paper, 0.85),
      border: "1px solid",
      borderColor: subtleBorder,
      backdropFilter: "blur(6px)",
      pointerEvents: "none",
    }}
  >
    {GRAPH_LEGEND.map(({ label, fill }) => (
      <Box
        key={label}
        sx={{ display: "flex", alignItems: "center", gap: 0.75 }}
      >
        <Box
          sx={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            bgcolor: fill,
            border: "1px solid rgba(0,0,0,0.35)",
            flexShrink: 0,
          }}
        />
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </Box>
    ))}
    <Typography variant="caption" color="text.disabled">
      Scroll to zoom · drag to pan
    </Typography>
  </Box>
);

function OntTree() {
  const logEvent = usePageVisitLog();
  const [{ isAuthenticated, isAuthInitialized }] = useAuth();
  const [view, setView] = useState<ClustersView>("outline");
  const [searchInput, setSearchInput] = useState("");
  const [searchValue, setSearchValue] = useState<SearchOption | null>(null);
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

  // Read through a ref so the handlers below keep a stable identity; otherwise
  // every graph expansion would hand the graph new callbacks and force a redraw.
  const expandedNodesRef = useRef(expandedNodes);
  expandedNodesRef.current = expandedNodes;
  const [graphFocus, setGraphFocus] = useState<GraphFocus>(() => new Map());
  const graphFocusRef = useRef(graphFocus);
  graphFocusRef.current = graphFocus;

  const [pulse, setPulse] = useState<{ nodeId: string; key: number } | null>(
    null,
  );
  const pulseTimer = useRef<number>();
  const pulseNode = useCallback((nodeId: string) => {
    setPulse({ nodeId, key: Date.now() });
    window.clearTimeout(pulseTimer.current);
    pulseTimer.current = window.setTimeout(() => setPulse(null), PULSE_MS);
  }, []);
  useEffect(() => () => window.clearTimeout(pulseTimer.current), []);

  const [graphShowAll, setGraphShowAll] = useState<Set<string>>(
    () => new Set(),
  );

  // Navigating from the outline or search focuses the graph on the node: only
  // the paths to it (and the node itself) stay open.
  const focusGraphOn = useCallback(
    (paths: PathStep[][], nodeId: string) => {
      setExpandedNodes(
        new Set([...rootIds, ...paths.flatMap(graphKeysForPath), nodeId]),
      );
      setGraphFocus(graphFocusForPaths(paths));
      setGraphShowAll(new Set());
    },
    [rootIds],
  );

  // A parent link the graph currently shows (parent, and its collection, open).
  const isOpenInGraph = useCallback((link: ParentLink) => {
    const open = expandedNodesRef.current;
    return (
      open.has(link.parentId) &&
      (!link.collectionName ||
        open.has(graphCollectionKey(link.parentId, link.collectionName)))
    );
  }, []);

  // Builds and opens the outline rows along each path, so the node shows up
  // under every parent. Rows are opened by id right away: the outline keeps
  // that open state and applies it as soon as the new rows arrive.
  const revealInOutline = useCallback(
    (paths: PathStep[][]) => {
      if (paths.length === 0) return;
      setTreeData((prev) =>
        paths.reduce(
          (rows, path) => revealPath(rows, path, nodesById).rows,
          prev,
        ),
      );
      const tree = treeRef.current;
      for (const path of paths) {
        outlineRowIdsForPath(path, nodesById)
          .slice(0, -1)
          .forEach((rowId) => tree?.open(rowId));
      }
    },
    [nodesById],
  );

  // A graph click selects the node and then toggles it; keys queued by the
  // selection are merged into the toggle, so both land in one update.
  const pendingGraphKeys = useRef<string[]>([]);
  const pendingGraphFocus = useRef<GraphFocus | null>(null);
  const setGraphExpandedNodes = useCallback((next: Set<string>) => {
    const pendingKeys = pendingGraphKeys.current;
    const focus = new Map(pendingGraphFocus.current ?? graphFocusRef.current);
    pendingGraphKeys.current = [];
    pendingGraphFocus.current = null;
    const showAll: string[] = [];
    for (const key of expandedNodesRef.current) {
      if (!next.has(key) && focus.has(key)) {
        focus.delete(key);
        showAll.push(key);
      }
    }
    setGraphFocus(focus);
    setExpandedNodes(new Set([...next, ...showAll, ...pendingKeys]));
  }, []);

  const toggleGraphNode = useCallback(
    (key: string) => {
      const next = new Set(expandedNodesRef.current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setGraphExpandedNodes(next);
    },
    [setGraphExpandedNodes],
  );

  const showHiddenGraphChildren = useCallback((key: string) => {
    if (graphFocusRef.current.has(key)) {
      const next = new Map(graphFocusRef.current);
      next.delete(key);
      setGraphFocus(next);
    } else {
      setGraphShowAll((prev) => new Set(prev).add(key));
    }
  }, []);

  // Outline -> both views: the clicked row stays put; the node's other parents
  // are opened in the outline, and every parent is opened in the graph.
  const onOutlineSelect = useCallback(
    (nodeId: string, _name?: string, row?: TreeRow) => {
      const rowParentId = row?.ancestorIds?.[row.ancestorIds.length - 1];
      const paths = pathsThroughEachParent(
        nodeId,
        parentsOf,
        rootIds,
        () => false,
      );
      const otherPaths = row
        ? paths.filter((path) => path[path.length - 2]?.docId !== rowParentId)
        : paths;
      revealInOutline(otherPaths);
      focusGraphOn(paths, nodeId);
      setCurrentVisibleNode({ id: nodeId });
      logEvent("node_navigate", {
        source: "outline",
        nodeId,
        nodeTitle: nodesById[nodeId]?.title ?? _name,
      });
    },
    [focusGraphOn, logEvent, nodesById, parentsOf, revealInOutline, rootIds],
  );

  // Graph -> both views: show the node under every parent in the outline, and
  // open every parent in the graph (merged into the node's toggle).
  const onGraphSelect = useCallback(
    (nodeId: string) => {
      const paths = pathsThroughEachParent(
        nodeId,
        parentsOf,
        rootIds,
        isOpenInGraph,
      );
      revealInOutline(paths);
      const open = expandedNodesRef.current;
      const current = graphFocusRef.current;
      const nextFocus = new Map(current);
      for (const [key, children] of graphFocusForPaths(paths)) {
        if (!open.has(key)) {
          nextFocus.set(key, children);
        } else if (current.has(key)) {
          nextFocus.set(key, new Set([...current.get(key)!, ...children]));
        }
      }
      pendingGraphFocus.current = nextFocus;
      pendingGraphKeys.current = paths.flatMap(graphKeysForPath);
      setCurrentVisibleNode({ id: nodeId });
      logEvent("node_navigate", {
        source: "graph",
        nodeId,
        nodeTitle: nodesById[nodeId]?.title,
      });
    },
    [isOpenInGraph, logEvent, nodesById, parentsOf, revealInOutline, rootIds],
  );

  const onGraphNodeClick = useCallback(
    (key: string, isCategory: boolean) => {
      if (!isCategory) onGraphSelect(key);
      toggleGraphNode(key);
    },
    [onGraphSelect, toggleGraphNode],
  );

  // Search -> both views: show the node under every parent in the outline, and
  // focus the graph on the node with every parent open.
  const navigateTo = useCallback(
    (nodeId: string) => {
      const paths = pathsThroughEachParent(
        nodeId,
        parentsOf,
        rootIds,
        isOpenInGraph,
      );
      revealInOutline(paths);
      if (paths.length > 0) {
        focusGraphOn(paths, nodeId);
      }
      setCurrentVisibleNode({ id: nodeId });
    },
    [focusGraphOn, isOpenInGraph, parentsOf, revealInOutline, rootIds],
  );

  const searchIndex = useMemo(
    () =>
      Object.values(nodesById).map((doc: any) => ({
        id: doc.id as string,
        title: (doc.title || "") as string,
        lower: (doc.title || "").toLowerCase() as string,
      })),
    [nodesById],
  );

  // Title matches across every loaded doc: prefix matches first, then
  // substring matches, shorter titles first within each group.
  const { searchResults, searchMatchCount } = useMemo(() => {
    const query = searchInput.trim().toLowerCase();
    if (query.length < 2) {
      return { searchResults: [] as SearchOption[], searchMatchCount: 0 };
    }
    const prefix: typeof searchIndex = [];
    const contains: typeof searchIndex = [];
    for (const item of searchIndex) {
      const at = item.lower.indexOf(query);
      if (at === 0) prefix.push(item);
      else if (at > 0) contains.push(item);
    }
    const byLength = (a: { title: string }, b: { title: string }) =>
      a.title.length - b.title.length;
    return {
      searchResults: [...prefix.sort(byLength), ...contains.sort(byLength)]
        .slice(0, MAX_SEARCH_RESULTS)
        .map(({ id, title }): SearchOption => ({ id, title })),
      searchMatchCount: prefix.length + contains.length,
    };
  }, [searchInput, searchIndex]);

  const lastLoggedSearch = useRef("");
  useEffect(() => {
    const query = searchInput.trim();
    if (query.length < 2 || query === searchValue?.title) return;
    const timer = window.setTimeout(() => {
      if (query === lastLoggedSearch.current) return;
      lastLoggedSearch.current = query;
      logEvent("search", { searchQuery: query, resultCount: searchMatchCount });
    }, SEARCH_LOG_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput, searchMatchCount, searchValue, logEvent]);

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

  // While the outline is showing, the graph keeps the inputs it last drew, so it
  // does no layout work in the background; it catches up once when shown.
  // It is still built once when the data arrives, so it initializes early.
  const graphVisible = view === "graph";
  const frozenGraph = useRef<{
    nodesById: Record<string, any>;
    treeData: TreeRow[];
    hiddenCounts: Record<string, number>;
    expandedNodes: Set<string>;
    currentVisibleNode: { id: string } | null;
  } | null>(null);
  const needsGraphBuild =
    graphVisible || frozenGraph.current?.nodesById !== nodesById;
  const graphBuild = useMemo(
    () =>
      needsGraphBuild
        ? buildGraphTree(
            rootDocs,
            nodesById,
            expandedNodes,
            graphFocus,
            graphShowAll,
            currentVisibleNode?.id ?? null,
          )
        : null,
    [
      needsGraphBuild,
      rootDocs,
      nodesById,
      expandedNodes,
      graphFocus,
      graphShowAll,
      currentVisibleNode,
    ],
  );
  if (graphBuild) {
    frozenGraph.current = {
      nodesById,
      treeData: graphBuild.tree,
      hiddenCounts: graphBuild.hiddenCounts,
      expandedNodes,
      currentVisibleNode,
    };
  }
  const graphInputs = frozenGraph.current!;

  const getData = async () => {
    setLoading(true);
    const token = await getAuth().currentUser?.getIdToken();
    const response = await fetch("/api/clusters/nodes", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(`Loading clusters failed (${response.status})`);
    }
    const { nodes: docs }: { nodes: ClustersNode[] } = await response.json();
    const nodes: Record<string, any> = {};
    let actId = "";
    for (const doc of docs) {
      nodes[doc.id] = { ...doc, category: doc.title.endsWith("?") };
      if (doc.title === "act") {
        actId = doc.id;
      }
    }
    setExpandDefault(actId);
    setNodesById(nodes);
    setTreeData(buildOutline(nodes));
    setExpandedNodes(new Set(getRootDocs(nodes).map((doc: any) => doc.id)));
    setLoading(false);
  };

  useEffect(() => {
    if (!isAuthInitialized || !isAuthenticated) return;
    getData();
  }, [isAuthInitialized, isAuthenticated]);

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
      <>
        <Head>
          <title>Clusters | 1Ontology</title>
        </Head>
        {NO_PAGE_SCROLL}
        <FullPageLogoLoading />
      </>
    );
  }

  const nodeCount = Object.keys(nodesById).length;
  const searchQuery = searchInput.trim();

  // Both views stay mounted so each keeps its open nodes and zoom; the hidden
  // one keeps its size (visibility, not display), so it can still follow the
  // selection while hidden and is already in place when switched to.
  const viewLayerSx = (active: boolean) => ({
    position: "absolute" as const,
    inset: 0,
    display: "flex",
    flexDirection: "column" as const,
    minHeight: 0,
    overflow: "hidden",
    visibility: active ? ("visible" as const) : ("hidden" as const),
    pointerEvents: active ? ("auto" as const) : ("none" as const),
    zIndex: active ? 1 : 0,
  });

  return (
    <Box
      sx={{
        width: "100%",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
      }}
    >
      <Head>
        <title>Clusters | 1Ontology</title>
      </Head>
      {NO_PAGE_SCROLL}
      <Box
        component="header"
        sx={{
          display: "flex",
          alignItems: "center",
          flexWrap: { xs: "wrap", md: "nowrap" },
          columnGap: 2,
          rowGap: 1.25,
          px: { xs: 1.5, sm: 2.5 },
          py: 1.5,
          borderBottom: "1px solid",
          borderColor: subtleBorder,
        }}
      >
        <Box sx={{ minWidth: 0, flexShrink: 0 }}>
          <Typography
            component="h1"
            sx={{ fontSize: 17, fontWeight: 700, lineHeight: 1.2 }}
          >
            Clusters
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", lineHeight: 1.3 }}
          >
            {nodeCount.toLocaleString()} nodes
          </Typography>
        </Box>
        <Autocomplete<SearchOption, false, false, false>
          options={searchResults}
          filterOptions={(options) => options}
          value={searchValue}
          inputValue={searchInput}
          onInputChange={(_, value) => setSearchInput(value)}
          onChange={(_, option) => {
            setSearchValue(option && { ...option });
            if (!option) return;
            if (option.id === currentVisibleNode?.id) {
              pulseNode(option.id);
            } else {
              navigateTo(option.id);
            }
            logEvent("node_navigate", {
              source: "search",
              nodeId: option.id,
              nodeTitle: option.title,
              searchQuery: searchInput.trim(),
            });
          }}
          getOptionLabel={(option) => option.title}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          forcePopupIcon={false}
          noOptionsText={
            searchQuery.length < 2
              ? "Type at least 2 characters to search"
              : "No nodes match this search"
          }
          renderOption={(props, option) => {
            const { key, ...optionProps } = props as typeof props & {
              key: string;
            };
            return (
              <Box
                component="li"
                key={option.id}
                {...optionProps}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start !important",
                  gap: 0.25,
                  py: "8px !important",
                  px: "14px !important",
                }}
              >
                <Typography variant="body2" sx={{ lineHeight: 1.35 }}>
                  <HighlightedText text={option.title} query={searchQuery} />
                </Typography>
              </Box>
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Search nodes"
              inputProps={{
                ...params.inputProps,
                "aria-label": "Search nodes",
              }}
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <InputAdornment position="start" sx={{ ml: 0.5, mr: 0 }}>
                    <SearchRoundedIcon
                      sx={{ fontSize: 20, color: "text.secondary" }}
                    />
                  </InputAdornment>
                ),
              }}
            />
          )}
          slotProps={{
            paper: {
              sx: {
                mt: 0.75,
                borderRadius: "12px",
                border: "1px solid",
                borderColor: subtleBorder,
                boxShadow: "0 12px 32px rgba(0,0,0,0.28)",
                bgcolor: searchPaperBg,
              },
            },
            listbox: {
              sx: {
                maxHeight: 420,
                py: 0.5,
                // The app's scrollbar, blended into the dropdown: no track,
                // and a thumb border in the dropdown's own color.
                ...SCROLL_BAR_STYLE,
                "&::-webkit-scrollbar-track": { background: "transparent" },
                "&::-webkit-scrollbar-thumb": {
                  backgroundColor: "#888",
                  borderRadius: "10px",
                  border: "3px solid",
                  borderColor: searchPaperBg,
                },
              },
            },
          }}
          sx={{
            order: { xs: 3, md: 0 },
            flexBasis: { xs: "100%", md: "auto" },
            flexGrow: 1,
            maxWidth: { md: 520 },
            mx: { md: "auto" },
            "& .MuiOutlinedInput-root": {
              height: 38,
              py: "0 !important",
              pl: 1,
              borderRadius: "999px",
              bgcolor: (t) =>
                t.palette.mode === "dark"
                  ? alpha("#ffffff", 0.06)
                  : alpha("#000000", 0.04),
              "& fieldset": { borderColor: "transparent" },
              "&:hover fieldset": {
                borderColor: (t) => alpha(t.palette.text.primary, 0.18),
              },
              "&.Mui-focused fieldset": {
                borderColor: ACCENT,
                borderWidth: "1px",
              },
            },
            "& .MuiAutocomplete-input": { fontSize: 14 },
          }}
        />
        <ToggleButtonGroup
          value={view}
          exclusive
          size="small"
          onChange={(_, value: ClustersView | null) => {
            if (value) setView(value);
          }}
          aria-label="View"
          sx={{
            ml: { xs: "auto", md: 0 },
            flexShrink: 0,
            borderRadius: "999px",
            height: 38,
            p: "3px",
            boxSizing: "border-box",
            background: (t) =>
              t.palette.mode === "dark"
                ? alpha("#ffffff", 0.06)
                : alpha("#000000", 0.05),
            "& .MuiToggleButtonGroup-grouped": {
              border: "none",
            },
            "& .MuiToggleButton-root": {
              border: "none",
              borderRadius: "999px !important",
              px: 1.75,
              py: 0,
              height: "100%",
              gap: 0.75,
              textTransform: "none",
              fontSize: "13px",
              fontWeight: 600,
              lineHeight: 1,
              color: "text.secondary",
              "&.Mui-selected": {
                color: "#ffffff",
                background: ACCENT_GRADIENT,
                "&:hover": { background: ACCENT_GRADIENT },
              },
            },
          }}
        >
          <ToggleButton value="outline">
            <AccountTreeOutlinedIcon sx={{ fontSize: 17 }} />
            Outline
          </ToggleButton>
          <ToggleButton value="graph">
            <HubOutlinedIcon sx={{ fontSize: 17 }} />
            Graph
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <Box
        component="main"
        sx={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          m: { xs: 1, sm: 1.5 },
        }}
      >
        <Box
          sx={viewLayerSx(view === "outline")}
          aria-hidden={view !== "outline"}
        >
          <MemoOutlineView
            treeViewData={treeData}
            setSnackbarMessage={noop}
            currentVisibleNode={currentVisibleNode}
            nodes={NO_NODES}
            onOpenNodesTree={onOutlineSelect}
            onOutlineNodeOpen={onOutlineNodeOpen as any}
            treeRef={treeRef}
            treeType="oNet"
            appName=""
            specializationNumsUnder={NO_COUNTS}
            selectAlign="center"
            showCopyButton
            expandAncestorCategories={false}
            pulse={view === "outline" ? pulse : null}
          />
        </Box>
        <Box
          sx={{ ...viewLayerSx(view === "graph"), ...viewCardSx }}
          aria-hidden={view !== "graph"}
        >
          <ClustersGraph
            tree={graphInputs.treeData}
            expanded={graphInputs.expandedNodes}
            hiddenCounts={graphInputs.hiddenCounts}
            selectedId={graphInputs.currentVisibleNode?.id ?? null}
            pulse={graphVisible ? pulse : null}
            maxLabelChars={GRAPH_LABEL_MAX_CHARS}
            oNetTaskFill={ONET_TASK_FILL}
            onNodeClick={onGraphNodeClick}
            onToggle={toggleGraphNode}
            onShowHidden={showHiddenGraphChildren}
          />
          <GraphHint />
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

export default withAuthUser({
  shouldRedirectToLogin: true,
  shouldRedirectToHomeIfAuthenticated: false,
})(OntTree);
