import crypto from "crypto";
import fs from "fs";
import path from "path";

export { SELL_ONTOLOGY_APP_ID, SELL_ONTOLOGY_NAME } from "./ontologyConfig";

export interface SomOntologySnapshot {
  schemaVersion: "som-ontology-snapshot-v1";
  ontologyAppId: string;
  ontologyName: string;
  firestoreProjectId: string;
  environment: "development" | "production";
  capturedAt: string;
  sellRootNodeId: string;
  nodes: Array<{
    id: string;
    title: string;
    description?: string;
    synsets?: string;
    actionAlternatives?: string[];
    referenceOnly?: boolean;
  }>;
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
  nodesById: Map<string, SomOntologySnapshot["nodes"][number]>;
  idsByTitle: Map<string, string[]>;
  edgeKeys: Set<string>;
  edgePairs: Set<string>;
  childrenByParent: Map<string, Set<string>>;
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
  const nodesById = new Map<string, SomOntologySnapshot["nodes"][number]>();
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
  const childrenByParent = new Map<string, Set<string>>();
  for (const edge of snapshot.edges) {
    if (!nodesById.has(edge.parentId) || !nodesById.has(edge.childId)) {
      throw new Error(
        `Ontology snapshot edge references a missing node: ${edge.parentId} -> ${edge.childId}`,
      );
    }
    edgeKeys.add(edgeKey(edge.parentId, edge.childId, edge.collectionName));
    edgePairs.add(edgePair(edge.parentId, edge.childId));
    const children = childrenByParent.get(edge.parentId) || new Set<string>();
    children.add(edge.childId);
    childrenByParent.set(edge.parentId, children);
  }

  if (!nodesById.has(snapshot.sellRootNodeId)) {
    throw new Error("Ontology snapshot is missing its Sell root node");
  }

  return {
    snapshot,
    nodesById,
    idsByTitle,
    edgeKeys,
    edgePairs,
    childrenByParent,
  };
};

const currentChildTitles = (index: SnapshotIndex, parentId: string): string[] =>
  [...(index.childrenByParent.get(parentId) || [])]
    .map((childId) => index.nodesById.get(childId)?.title || "")
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, "en"));

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
      if (collectionName === "main") requireAnyEdge(index, parentId, nodeId);
      else requireEdge(index, parentId, nodeId, collectionName);
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

const nodeSynonyms = (
  node?: SomOntologySnapshot["nodes"][number],
): string[] => {
  const values = new Set<string>();
  for (const value of node?.actionAlternatives || []) {
    if (String(value).trim()) values.add(String(value).trim());
  }
  for (const value of String(node?.synsets || "").split(",")) {
    const lemma = value.trim().replace(/\.[a-z]+\.\d+$/i, "");
    if (lemma) values.add(lemma.replace(/_/g, " "));
  }
  return [...values].sort((left, right) => left.localeCompare(right, "en"));
};

const allRecordedSynonyms = (
  node?: SomOntologySnapshot["nodes"][number],
): string[] => {
  const values = new Set(nodeSynonyms(node));
  const match = String(node?.description || "").match(/Synonyms?:\s*([^.;]+)/i);
  if (match) {
    for (const value of match[1].split(/,|\bor\b/i)) {
      if (value.trim()) values.add(value.trim());
    }
  }
  return [...values].sort((left, right) => left.localeCompare(right, "en"));
};

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
    case "title-split": {
      subjectNodeId = addTitle(context.currentTitle);
      const parent = sourceParent(index, record);
      parentNodeId = parent.id;
      if (parentNodeId) {
        referenced.add(parentNodeId);
        requireEdge(index, parentNodeId, subjectNodeId, parent.collectionName);
      }
      for (const proposedNode of context.proposedNodes || []) {
        const existingIds = index.idsByTitle.get(proposedNode.title) || [];
        if (proposedNode.status === "new" && existingIds.length > 0) {
          throw new Error(
            `Proposed split node already exists: ${proposedNode.title}`,
          );
        }
        if (proposedNode.status === "current") {
          if (proposedNode.title !== context.currentTitle) {
            throw new Error(
              `Current split node does not match the subject: ${proposedNode.title}`,
            );
          }
          referenced.add(subjectNodeId);
        }
        if (proposedNode.status === "existing") addTitle(proposedNode.title);
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
      const canonicalParentId = addTitle(
        context.canonicalParentTitle || context.parentTitle,
      );
      const candidateParentId = addTitle(
        context.candidateParentTitle || context.parentTitle,
      );
      parentNodeId = candidateParentId;
      const canonicalId = addTitle(context.canonicalTitle);
      subjectNodeId = addTitle(context.candidateSynonymTitle);
      requireAnyEdge(index, canonicalParentId, canonicalId);
      requireAnyEdge(index, candidateParentId, subjectNodeId);
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
    case "merge-action": {
      const canonicalParentId = addTitle(
        context.canonicalParentTitle || context.parentTitle,
      );
      const absorbedParentId = addTitle(
        context.absorbedParentTitle || context.parentTitle,
      );
      parentNodeId = absorbedParentId;
      const canonicalId = addTitle(context.canonicalTitle);
      const absorbedId = addTitle(context.absorbedTitle);
      requireEdge(
        index,
        canonicalParentId,
        canonicalId,
        context.canonicalCollection,
      );
      requireEdge(
        index,
        absorbedParentId,
        absorbedId,
        context.absorbedCollection,
      );
      const canonicalChildren = [...(context.canonicalChildren || [])].sort(
        (left, right) => left.localeCompare(right, "en"),
      );
      const absorbedChildren = [...(context.absorbedChildren || [])].sort(
        (left, right) => left.localeCompare(right, "en"),
      );
      if (
        !sameStringArray(
          canonicalChildren,
          currentChildTitles(index, canonicalId),
        )
      ) {
        throw new Error(
          `Merge proposal for ${context.canonicalTitle} does not list every current direct child`,
        );
      }
      if (
        !sameStringArray(
          absorbedChildren,
          currentChildTitles(index, absorbedId),
        )
      ) {
        throw new Error(
          `Merge proposal for ${context.absorbedTitle} does not list every current direct child`,
        );
      }
      for (const title of context.canonicalChildren || []) {
        const childId = addTitle(title);
        requireAnyEdge(index, canonicalId, childId);
      }
      for (const title of context.absorbedChildren || []) {
        const childId = addTitle(title);
        requireAnyEdge(index, absorbedId, childId);
      }
      const expectedChildren = [
        ...new Set([...canonicalChildren, ...absorbedChildren]),
      ].sort((left, right) => left.localeCompare(right, "en"));
      const resultingChildren = [...(context.resultingChildren || [])].sort(
        (left, right) => left.localeCompare(right, "en"),
      );
      if (!sameStringArray(resultingChildren, expectedChildren)) {
        throw new Error(
          `Merge result for ${context.canonicalTitle} does not match the current child union`,
        );
      }
      subjectNodeId = absorbedId;
      break;
    }
    case "relocation-action": {
      parentNodeId = addTitle(context.currentParentTitle);
      const proposedParentId = addTitle(context.proposedParentTitle);
      subjectNodeId = addTitle(context.nodeTitle);
      requireEdge(
        index,
        parentNodeId,
        subjectNodeId,
        context.currentCollection,
      );
      if (
        index.edgeKeys.has(
          edgeKey(proposedParentId, subjectNodeId, context.proposedCollection),
        )
      ) {
        throw new Error(
          `Proposed relocation already exists: ${context.proposedParentTitle} -> ${context.nodeTitle}`,
        );
      }
      for (const title of context.childTitles || []) {
        const childId = addTitle(title);
        requireAnyEdge(index, subjectNodeId, childId);
      }
      break;
    }
    case "addition-action": {
      parentNodeId = addTitle(context.parentTitle);
      if ((index.idsByTitle.get(context.proposedTitle) || []).length > 0) {
        throw new Error(
          `Proposed missing activity already exists: ${context.proposedTitle}`,
        );
      }
      break;
    }
    case "merge-up-action": {
      parentNodeId = addTitle(context.parentTitle);
      subjectNodeId = addTitle(context.nodeTitle);
      requireEdge(index, parentNodeId, subjectNodeId, context.parentCollection);
      for (const title of context.childTitles || []) {
        const childId = addTitle(title);
        requireAnyEdge(index, subjectNodeId, childId);
      }
      break;
    }
    case "metadata-edit": {
      subjectNodeId = addTitle(context.nodeTitle);
      const node = index.nodesById.get(subjectNodeId);
      if (
        context.field === "description" &&
        String(context.currentText || "") !== String(node?.description || "")
      ) {
        throw new Error(
          `Description proposal for ${context.nodeTitle} is stale`,
        );
      }
      if (
        context.field === "synonyms" &&
        Array.isArray(context.currentValues)
      ) {
        const currentValues = [...context.currentValues].sort((left, right) =>
          left.localeCompare(right, "en"),
        );
        const recordedValues =
          context.synonymScope === "all-recorded"
            ? allRecordedSynonyms(node)
            : nodeSynonyms(node);
        if (!sameStringArray(currentValues, recordedValues)) {
          throw new Error(`Synonym proposal for ${context.nodeTitle} is stale`);
        }
      }
      break;
    }
    case "polysemy-review": {
      parentNodeId = addTitle(context.currentParentTitle);
      subjectNodeId = addTitle(context.nodeTitle);
      requireAnyEdge(index, parentNodeId, subjectNodeId);
      for (const sense of context.proposedSenses || []) {
        if ((index.idsByTitle.get(sense.title) || []).length === 1) {
          addTitle(sense.title);
        }
        if ((index.idsByTitle.get(sense.destination) || []).length === 1) {
          addTitle(sense.destination);
        }
      }
      break;
    }
    case "collection-design": {
      parentNodeId = addTitle(context.parentTitle);
      for (const title of context.currentChildren || []) {
        const childId = addTitle(title);
        requireAnyEdge(index, parentNodeId, childId);
      }
      for (const branch of context.proposedBranches || []) {
        if (branch.status === "existing") addTitle(branch.title);
        if (
          branch.status === "new" &&
          (index.idsByTitle.get(branch.title) || []).length > 0
        ) {
          throw new Error(
            `Proposed collection branch already exists: ${branch.title}`,
          );
        }
        for (const title of branch.children || []) addTitle(title);
      }
      break;
    }
    case "sense-relocation-action": {
      parentNodeId = addTitle(context.currentParentTitle);
      subjectNodeId = addTitle(context.nodeTitle);
      requireEdge(
        index,
        parentNodeId,
        subjectNodeId,
        context.currentCollection,
      );
      const retainedId = addTitle(context.retainedSenseTitle);
      const retainedParentId = addTitle(context.retainedParentTitle);
      requireAnyEdge(index, retainedParentId, retainedId);
      addTitle(context.proposedParentTitle);
      break;
    }
    default:
      throw new Error(`Unsupported proposal context type: ${context.type}`);
  }

  const expected: SomProposalSourceRefs = {
    sourceOntologyAppId: index.snapshot.ontologyAppId,
    sourceOntologyName: index.snapshot.ontologyName,
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
