import crypto from "crypto";
import fs from "fs";
import path from "path";

export const SELL_ONTOLOGY_APP_ID = "final-hierarchy-with-o*net";
export const SELL_ONTOLOGY_NAME = "Final Hierarchy with O*Net";

export interface SomOntologySnapshot {
  schemaVersion: "som-ontology-snapshot-v1";
  ontologyAppId: string;
  ontologyName: string;
  firestoreProjectId: string;
  environment: "development" | "production";
  capturedAt: string;
  sellRootNodeId: string;
  nodes: Array<{ id: string; title: string }>;
  edges: Array<{
    parentId: string;
    childId: string;
    collectionName: string;
  }>;
}

export interface SomProposalSourceRefs {
  sourceOntologyAppId: string;
  sourceOntologyName: string;
  sourceSnapshotSha256: string;
  subjectNodeId: string;
  parentNodeId: string;
  referencedNodeIds: string[];
}

type SnapshotIndex = {
  snapshot: SomOntologySnapshot;
  nodesById: Map<string, { id: string; title: string }>;
  idsByTitle: Map<string, string[]>;
  edgeKeys: Set<string>;
  edgePairs: Set<string>;
};

const normalizeCollection = (value?: string): string => {
  const unwrapped = String(value || "")
    .trim()
    .replace(/^\[/, "")
    .replace(/\]$/, "");
  return !unwrapped || unwrapped === "default" ? "main" : unwrapped;
};

const isCollectionLabel = (value: string): boolean =>
  /^\[[^\]]+\]$/.test(value.trim());

const edgeKey = (
  parentId: string,
  childId: string,
  collectionName?: string,
): string =>
  `${parentId}\u001f${normalizeCollection(collectionName)}\u001f${childId}`;

const edgePair = (parentId: string, childId: string): string =>
  `${parentId}\u001f${childId}`;

export const sha256File = (filePath: string): string =>
  crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");

export const buildSnapshotIndex = (
  snapshot: SomOntologySnapshot,
): SnapshotIndex => {
  if (snapshot.schemaVersion !== "som-ontology-snapshot-v1") {
    throw new Error(
      `Unexpected ontology snapshot schemaVersion: ${snapshot.schemaVersion}`,
    );
  }
  if (snapshot.ontologyAppId !== SELL_ONTOLOGY_APP_ID) {
    throw new Error(
      `Review dataset targets ${snapshot.ontologyAppId}, expected ${SELL_ONTOLOGY_APP_ID}`,
    );
  }
  if (snapshot.ontologyName !== SELL_ONTOLOGY_NAME) {
    throw new Error(
      `Review dataset targets ${snapshot.ontologyName}, expected ${SELL_ONTOLOGY_NAME}`,
    );
  }

  const nodesById = new Map<string, { id: string; title: string }>();
  const idsByTitle = new Map<string, string[]>();
  for (const node of snapshot.nodes) {
    if (!node.id || !node.title) {
      throw new Error(
        "Ontology snapshot contains a node without an id or title",
      );
    }
    if (nodesById.has(node.id)) {
      throw new Error(`Duplicate node id in ontology snapshot: ${node.id}`);
    }
    nodesById.set(node.id, node);
    idsByTitle.set(node.title, [
      ...(idsByTitle.get(node.title) || []),
      node.id,
    ]);
  }

  const edgeKeys = new Set<string>();
  const edgePairs = new Set<string>();
  for (const edge of snapshot.edges) {
    if (!nodesById.has(edge.parentId) || !nodesById.has(edge.childId)) {
      throw new Error(
        `Ontology snapshot edge references a missing node: ${edge.parentId} -> ${edge.childId}`,
      );
    }
    edgeKeys.add(edgeKey(edge.parentId, edge.childId, edge.collectionName));
    edgePairs.add(edgePair(edge.parentId, edge.childId));
  }

  if (!nodesById.has(snapshot.sellRootNodeId)) {
    throw new Error("Ontology snapshot is missing its Sell root node");
  }

  return { snapshot, nodesById, idsByTitle, edgeKeys, edgePairs };
};

const resolveUniqueTitle = (index: SnapshotIndex, title: string): string => {
  const ids = index.idsByTitle.get(title) || [];
  if (ids.length === 0) {
    throw new Error(`Current ontology node does not exist: ${title}`);
  }
  if (ids.length > 1) {
    throw new Error(`Current ontology title is ambiguous: ${title}`);
  }
  return ids[0];
};

const requireEdge = (
  index: SnapshotIndex,
  parentId: string,
  childId: string,
  collectionName?: string,
): void => {
  if (!index.edgeKeys.has(edgeKey(parentId, childId, collectionName))) {
    const parent = index.nodesById.get(parentId)?.title || parentId;
    const child = index.nodesById.get(childId)?.title || childId;
    throw new Error(
      `Current ontology relation does not exist: ${parent} [${normalizeCollection(
        collectionName,
      )}] -> ${child}`,
    );
  }
};

const requireAnyEdge = (
  index: SnapshotIndex,
  parentId: string,
  childId: string,
): void => {
  if (!index.edgePairs.has(edgePair(parentId, childId))) {
    const parent = index.nodesById.get(parentId)?.title || parentId;
    const child = index.nodesById.get(childId)?.title || childId;
    throw new Error(
      `Current ontology relation does not exist: ${parent} -> ${child}`,
    );
  }
};

const validatePath = (index: SnapshotIndex, sourcePath: unknown): void => {
  if (!Array.isArray(sourcePath)) return;
  const sellIndex = sourcePath.findIndex((part) => part === "Sell");
  const parts = sourcePath.slice(Math.max(0, sellIndex));
  let parentId = "";
  let collectionName = "main";

  for (const part of parts) {
    if (typeof part !== "string" || !part.trim()) continue;
    if (isCollectionLabel(part)) {
      collectionName = normalizeCollection(part);
      continue;
    }
    const ids = index.idsByTitle.get(part) || [];
    if (ids.length === 0) continue;
    const nodeId = resolveUniqueTitle(index, part);
    if (parentId && parentId !== nodeId) {
      requireEdge(index, parentId, nodeId, collectionName);
    }
    parentId = nodeId;
    collectionName = "main";
  }
};

const sourceParent = (
  index: SnapshotIndex,
  record: any,
): { id: string; collectionName: string } => {
  const parentTitle = String(record?.subject?.parentTitle || "");
  if (!parentTitle) return { id: "", collectionName: "main" };
  if (!isCollectionLabel(parentTitle)) {
    return {
      id: resolveUniqueTitle(index, parentTitle),
      collectionName: "main",
    };
  }

  const sourcePath = Array.isArray(record?.subject?.path)
    ? record.subject.path
    : [];
  const collectionIndex = sourcePath.lastIndexOf(parentTitle);
  for (let i = collectionIndex - 1; i >= 0; i -= 1) {
    const candidate = sourcePath[i];
    if (typeof candidate === "string" && !isCollectionLabel(candidate)) {
      return {
        id: resolveUniqueTitle(index, candidate),
        collectionName: normalizeCollection(parentTitle),
      };
    }
  }
  throw new Error(`Cannot resolve collection parent from path: ${parentTitle}`);
};

const sameStringArray = (left: unknown, right: string[]): boolean =>
  Array.isArray(left) &&
  left.length === right.length &&
  left.every((value, index) => value === right[index]);

export const validateProposalAgainstSnapshot = (
  record: any,
  index: SnapshotIndex,
  snapshotSha256: string,
): SomProposalSourceRefs => {
  const context = record?.reviewerView?.context;
  if (!context?.type) throw new Error("Proposal is missing reviewer context");
  validatePath(index, record?.subject?.path);

  const referenced = new Set<string>();
  const addTitle = (title: string): string => {
    const id = resolveUniqueTitle(index, title);
    referenced.add(id);
    return id;
  };
  const addDirectChild = (
    parentTitle: string,
    childTitle: string,
    collectionName?: string,
  ): { parentId: string; childId: string } => {
    const parentId = addTitle(parentTitle);
    const childId = addTitle(childTitle);
    requireEdge(index, parentId, childId, collectionName);
    return { parentId, childId };
  };

  let subjectNodeId = "";
  let parentNodeId = "";

  switch (context.type) {
    case "title-comparison": {
      subjectNodeId = addTitle(context.currentTitle);
      const parent = sourceParent(index, record);
      parentNodeId = parent.id;
      if (parentNodeId) {
        referenced.add(parentNodeId);
        requireEdge(index, parentNodeId, subjectNodeId, parent.collectionName);
      }
      break;
    }
    case "grouping-outline": {
      if ((index.idsByTitle.get(context.proposedGroupTitle) || []).length > 0) {
        throw new Error(
          `Proposed grouping already exists in the current ontology: ${context.proposedGroupTitle}`,
        );
      }
      parentNodeId = addTitle(context.parentTitle);
      for (const title of [
        ...(context.proposedChildren || []),
        ...(context.unaffectedChildren || []),
      ]) {
        const childId = addTitle(title);
        requireEdge(index, parentNodeId, childId);
      }
      break;
    }
    case "flat-list": {
      parentNodeId = addTitle(context.parentTitle);
      for (const title of context.currentChildren || []) {
        const childId = addTitle(title);
        requireEdge(index, parentNodeId, childId);
      }
      break;
    }
    case "duplicate-comparison": {
      const first = addDirectChild(context.parentTitle, context.canonicalTitle);
      addDirectChild(context.parentTitle, context.candidateSynonymTitle);
      parentNodeId = first.parentId;
      subjectNodeId = first.childId;
      break;
    }
    case "placement-comparison": {
      parentNodeId = addTitle(context.currentParentTitle);
      subjectNodeId = addTitle(context.nodeTitle);
      requireAnyEdge(index, parentNodeId, subjectNodeId);
      if (
        context.candidateHome &&
        (index.idsByTitle.get(context.candidateHome) || []).length === 1
      ) {
        addTitle(context.candidateHome);
      }
      break;
    }
    case "overlap-comparison": {
      const first = addDirectChild(
        context.parentTitle,
        context.firstTitle,
        context.firstCollection,
      );
      addDirectChild(
        context.parentTitle,
        context.secondTitle,
        context.secondCollection,
      );
      parentNodeId = first.parentId;
      subjectNodeId = first.childId;
      break;
    }
    default:
      throw new Error(`Unsupported proposal context type: ${context.type}`);
  }

  const expected: SomProposalSourceRefs = {
    sourceOntologyAppId: SELL_ONTOLOGY_APP_ID,
    sourceOntologyName: SELL_ONTOLOGY_NAME,
    sourceSnapshotSha256: snapshotSha256,
    subjectNodeId,
    parentNodeId,
    referencedNodeIds: [...referenced].sort(),
  };
  const provenance = record?.provenance || {};
  for (const key of [
    "sourceOntologyAppId",
    "sourceOntologyName",
    "sourceSnapshotSha256",
    "subjectNodeId",
    "parentNodeId",
  ] as const) {
    if (provenance[key] !== expected[key]) {
      throw new Error(
        `Proposal ${record?.proposalId || "<unknown>"} has stale ${key}`,
      );
    }
  }
  if (
    !sameStringArray(provenance.referencedNodeIds, expected.referencedNodeIds)
  ) {
    throw new Error(
      `Proposal ${record?.proposalId || "<unknown>"} has stale referencedNodeIds`,
    );
  }

  return expected;
};

export const loadOntologySnapshot = (
  datasetRoot: string,
  manifest: any,
): { snapshot: SomOntologySnapshot; index: SnapshotIndex; sha256: string } => {
  const source = manifest?.sourceSnapshot;
  if (!source?.file || !source?.sha256) {
    throw new Error(
      "Dataset manifest is missing its Firestore source snapshot",
    );
  }
  const snapshotPath = path.join(datasetRoot, source.file);
  const sha256 = sha256File(snapshotPath);
  if (sha256 !== source.sha256 || sha256 !== manifest.sourceOntologySha256) {
    throw new Error(
      "Ontology source snapshot hash does not match the manifest",
    );
  }
  const snapshot = JSON.parse(
    fs.readFileSync(snapshotPath, "utf8"),
  ) as SomOntologySnapshot;
  if (source.ontologyAppId !== snapshot.ontologyAppId) {
    throw new Error(
      "Ontology source snapshot app id does not match the manifest",
    );
  }
  if (source.ontologyName !== snapshot.ontologyName) {
    throw new Error(
      "Ontology source snapshot name does not match the manifest",
    );
  }
  return { snapshot, index: buildSnapshotIndex(snapshot), sha256 };
};
