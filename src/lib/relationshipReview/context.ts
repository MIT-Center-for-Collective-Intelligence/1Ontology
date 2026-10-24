import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import type {
  RelationshipDataset,
  RelationshipNode,
} from "../../types/IRelationshipReview";
import { RelationshipError } from "./feedback";

// Node-only, without adding a dependency. Client consumers must import type only.
if ("window" in globalThis) {
  throw new Error("Frozen relationship context is server-only");
}

export type ContextNode = RelationshipNode;
export type ContextRole = "focal" | "current" | "proposed" | "alternative";

export interface ContextPage {
  items: ContextNode[];
  total: number;
  offset: number;
  limit: number;
  nextOffset: number | null;
}

export interface RelationshipContext {
  available: boolean;
  caseId: string;
  datasetVersion: string;
  datasetSha256: string;
  sourceSha256: string;
  disclosureVersion: string;
  contextSha256: string;
  sourceApp: string;
  sourceCapturedAt: string;
  focus: ContextNode | null;
  choices: { node: ContextNode; roles: ContextRole[] }[];
  generalizations: ContextNode[];
  generalizationsTotal: number;
  specializationPage: ContextPage;
  sourcePage: ContextPage;
  ancestors: {
    nodes: ContextNode[];
    edges: { generalizationId: string; specializationId: string }[];
    truncated: boolean;
    cycles: string[][];
  };
  missingNodeIds: string[];
  limitations: string[];
}

export interface ContextOptions {
  focusId?: unknown;
  activityOffset?: unknown;
  sourceOffset?: unknown;
  limit?: unknown;
}

/** The recorded source shape, also accepted by the pure test builder. */
export interface FrozenGraphNode {
  id: string;
  title: string;
  oNetTask?: boolean;
  nodeType?: string;
  root?: boolean;
  level?: number;
  properties?: { description?: string };
  generalizations?: readonly {
    collectionName?: string;
    nodes: readonly { id: string; title?: string }[];
  }[];
  specializations?: FrozenGraphNode["generalizations"];
}

export { RelationshipError };

const SOURCE_SHA256 =
  "06daeedf3153e3f7efa00659d69d076aa0962efdd1c373642050f5831a96a703";
const SOURCE_FILE = path.join(
  process.cwd(),
  "src/lib/relationshipReview/data/atomic-v1/source-graph.json",
);
const VERSIONS = new Set([
  "atomic-generalizations-20261019-v1",
  "atomic-generalizations-20261019-v3",
]);
const DISCLOSURE_VERSION = "frozen-ontology-neighborhood-v1";
const MAX_PARENTS = 120;
const MAX_VISITED = 120; // Includes the selected node.
const MAX_DEPTH = 6;
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const OPTION_KEYS = new Set([
  "focusId",
  "activityOffset",
  "sourceOffset",
  "limit",
]);

interface ChoiceCase {
  id: string;
  currentGeneralizationIds?: string[];
  currentParents?: { id: string }[];
  analysis?: {
    proposedParents?: { nodeId: string }[];
    alternatives?: { nodeId: string }[];
  };
}

interface Request {
  focusId: string;
  activityOffset: number;
  sourceOffset: number;
  limit: number;
  roles: Map<string, ContextRole[]>;
}

interface IndexedNode {
  summary: ContextNode;
  parents: string[];
  children: string[];
}
type GraphIndex = ReadonlyMap<string, IndexedNode>;
type Payload = Omit<RelationshipContext, "contextSha256">;
let cachedGraph: GraphIndex | undefined;

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function finish(payload: Payload): RelationshipContext {
  return { ...payload, contextSha256: sha256(JSON.stringify(payload)) };
}

function integer(
  value: unknown,
  fallback: number,
  minimum: number,
  label: string,
) {
  if (value === undefined) return fallback;
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum
  ) {
    throw new RelationshipError(
      400,
      `${label} must be a safe whole number >= ${minimum}`,
    );
  }
  return value === 0 ? 0 : value;
}

function validateRequest(
  dataset: RelationshipDataset,
  datasetSha256: string,
  caseId: string,
  options?: ContextOptions,
): Request {
  if (typeof caseId !== "string" || !ID.test(caseId))
    throw new RelationshipError(400, "Invalid case ID");
  if (
    typeof datasetSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(datasetSha256)
  )
    throw new RelationshipError(400, "Invalid dataset SHA256");
  if (
    options !== undefined &&
    (options === null ||
      typeof options !== "object" ||
      Array.isArray(options) ||
      Object.keys(options).some((key) => !OPTION_KEYS.has(key)))
  )
    throw new RelationshipError(400, "Invalid context options");

  const found = dataset.cases.find((item) => item.id === caseId);
  if (!found) throw new RelationshipError(404, "Unknown case");
  const reviewCase = found as unknown as ChoiceCase;
  const roles = new Map<string, ContextRole[]>();
  const add = (id: string, role: ContextRole) => {
    if (typeof id !== "string" || !ID.test(id))
      throw new RelationshipError(500, "Invalid frozen case choice");
    const existing = roles.get(id) || [];
    if (!existing.includes(role)) existing.push(role);
    roles.set(id, existing);
  };
  add(reviewCase.id, "focal");
  for (const id of reviewCase.currentGeneralizationIds || [])
    add(id, "current");
  for (const parent of reviewCase.currentParents || [])
    add(parent.id, "current");
  for (const parent of reviewCase.analysis?.proposedParents || [])
    add(parent.nodeId, "proposed");
  for (const parent of reviewCase.analysis?.alternatives || [])
    add(parent.nodeId, "alternative");

  const input = options || {};
  const focusId = input.focusId === undefined ? caseId : input.focusId;
  if (typeof focusId !== "string" || !ID.test(focusId))
    throw new RelationshipError(400, "Invalid focus ID");
  if (!roles.has(focusId))
    throw new RelationshipError(
      404,
      "Focus is not a choice supplied by this case",
    );
  return {
    focusId,
    roles,
    activityOffset: integer(input.activityOffset, 0, 0, "Activity offset"),
    sourceOffset: integer(input.sourceOffset, 0, 0, "Source offset"),
    limit: Math.min(25, integer(input.limit, 8, 1, "Limit")),
  };
}

function referenceIds(groups: FrozenGraphNode["generalizations"]): string[] {
  if (groups === undefined) return [];
  if (!Array.isArray(groups))
    throw new RelationshipError(500, "Invalid frozen relationship list");
  const ids = new Set<string>();
  for (const group of groups) {
    if (!group || !Array.isArray(group.nodes))
      throw new RelationshipError(
        500,
        "Invalid frozen relationship collection",
      );
    for (const ref of group.nodes) {
      if (!ref || typeof ref.id !== "string" || !ID.test(ref.id))
        throw new RelationshipError(500, "Invalid frozen node reference");
      ids.add(ref.id);
    }
  }
  return [...ids];
}

function indexGraph(input: readonly FrozenGraphNode[]): GraphIndex {
  if (!Array.isArray(input))
    throw new RelationshipError(500, "Invalid frozen source graph");
  const graph = new Map<string, IndexedNode>();
  for (const raw of input) {
    if (
      !raw ||
      typeof raw.id !== "string" ||
      !ID.test(raw.id) ||
      typeof raw.title !== "string" ||
      graph.has(raw.id)
    )
      throw new RelationshipError(500, "Invalid or duplicate frozen node ID");
    const parents = referenceIds(raw.generalizations);
    const children = referenceIds(raw.specializations);
    const description =
      typeof raw.properties?.description === "string"
        ? raw.properties.description
        : "";
    const oNetTask = raw.oNetTask === true || /^\(O\*Net\)/i.test(raw.title);
    const summary: ContextNode = {
      id: raw.id,
      title: raw.title,
      description,
      oNetTask,
      ...(typeof raw.level === "number" &&
      Number.isSafeInteger(raw.level) &&
      raw.level >= 0
        ? { level: raw.level }
        : {}),
      descriptionSource:
        oNetTask && !description
          ? "title (complete O*NET description)"
          : "properties.description",
    };
    graph.set(raw.id, { summary, parents, children });
  }
  return graph;
}

function assertSourcePin(dataset: RelationshipDataset) {
  if (dataset.sourceSha256 !== SOURCE_SHA256)
    throw new RelationshipError(500, "Dataset source pin mismatch");
}

function verifiedGraph(): GraphIndex {
  if (cachedGraph) return cachedGraph;
  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(SOURCE_FILE);
  } catch {
    throw new RelationshipError(500, "Frozen source file is unavailable");
  }
  if (sha256(bytes) !== SOURCE_SHA256)
    throw new RelationshipError(
      500,
      "Frozen source file does not match its pin",
    );
  try {
    const parsed = JSON.parse(bytes.toString("utf8"));
    cachedGraph = indexGraph(Array.isArray(parsed) ? parsed : parsed?.nodes);
  } catch (error) {
    if (error instanceof RelationshipError) throw error;
    throw new RelationshipError(500, "Frozen source file cannot be parsed");
  }
  return cachedGraph;
}

function copyNode(entry: IndexedNode): ContextNode {
  return { ...entry.summary };
}

function page(
  ids: string[],
  graph: GraphIndex,
  offset: number,
  limit: number,
): ContextPage {
  const picked = offset >= ids.length ? [] : ids.slice(offset, offset + limit);
  const next = offset + picked.length;
  return {
    items: picked.map((id) => copyNode(graph.get(id)!)),
    total: ids.length,
    offset,
    limit,
    nextOffset: next < ids.length ? next : null,
  };
}

function emptyPayload(
  dataset: RelationshipDataset,
  datasetSha256: string,
  caseId: string,
  request: Request,
): Payload {
  const capturedAt = (
    dataset as RelationshipDataset & { sourceCapturedAt?: string }
  ).sourceCapturedAt;
  const emptyPage = (offset: number): ContextPage => ({
    items: [],
    total: 0,
    offset,
    limit: request.limit,
    nextOffset: null,
  });
  return {
    available: false,
    caseId,
    datasetVersion: dataset.version,
    datasetSha256,
    sourceSha256: dataset.sourceSha256,
    disclosureVersion: DISCLOSURE_VERSION,
    sourceApp: dataset.sourceApp || "",
    sourceCapturedAt: typeof capturedAt === "string" ? capturedAt : "",
    focus: null,
    choices: [],
    generalizations: [],
    generalizationsTotal: 0,
    specializationPage: emptyPage(request.activityOffset),
    sourcePage: emptyPage(request.sourceOffset),
    ancestors: { nodes: [], edges: [], truncated: false, cycles: [] },
    missingNodeIds: [],
    limitations: [],
  };
}

function cyclesWithin(
  graph: GraphIndex,
  visited: Set<string>,
  focusId: string,
): string[][] {
  const active = new Map<string, number>();
  const done = new Set<string>();
  const route: string[] = [];
  const cycles: string[][] = [];
  const visit = (id: string) => {
    active.set(id, route.length);
    route.push(id);
    for (const parent of graph.get(id)!.parents) {
      if (!visited.has(parent)) continue;
      const start = active.get(parent);
      if (start !== undefined) cycles.push([...route.slice(start), parent]);
      else if (!done.has(parent)) visit(parent);
    }
    route.pop();
    active.delete(id);
    done.add(id);
  };
  visit(focusId);
  return cycles;
}

function recordedAncestors(
  graph: GraphIndex,
  focusId: string,
  missing: Set<string>,
) {
  const nodes: ContextNode[] = [];
  const edges: RelationshipContext["ancestors"]["edges"] = [];
  const edgeKeys = new Set<string>();
  const visited = new Set([focusId]);
  const queue = [{ id: focusId, depth: 0 }];
  let depthHit = false;
  let nodeHit = false;
  const edge = (parentId: string, childId: string) => {
    const key = parentId + ":" + childId;
    if (!edgeKeys.has(key)) {
      edgeKeys.add(key);
      edges.push({ generalizationId: parentId, specializationId: childId });
    }
  };
  // Breadth first retains the shortest recorded depth for shared ancestors.
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    for (const parentId of graph.get(current.id)!.parents) {
      const parent = graph.get(parentId);
      if (!parent) {
        missing.add(parentId);
        if (current.depth < MAX_DEPTH) edge(parentId, current.id);
        else depthHit = true;
        continue;
      }
      // Keep links between visited nodes, including loop-closing links.
      if (visited.has(parentId)) {
        edge(parentId, current.id);
        continue;
      }
      if (current.depth >= MAX_DEPTH) {
        depthHit = true;
        continue;
      }
      if (visited.size >= MAX_VISITED) {
        nodeHit = true;
        continue;
      }
      visited.add(parentId);
      nodes.push(copyNode(parent));
      edge(parentId, current.id);
      queue.push({ id: parentId, depth: current.depth + 1 });
    }
  }
  const cycles = cyclesWithin(graph, visited, focusId);
  const limitations: string[] = [];
  if (depthHit) limitations.push("Ancestor paths stop at 6 recorded steps.");
  if (nodeHit)
    limitations.push(
      "Ancestor paths stop at 120 visited nodes, counting the selected node.",
    );
  if (cycles.length)
    limitations.push(
      "Loops were found in the recorded Generalizations within the shown ancestor area.",
    );
  return {
    value: { nodes, edges, truncated: depthHit || nodeHit, cycles },
    limitations,
  };
}

function disclose(
  dataset: RelationshipDataset,
  datasetSha256: string,
  caseId: string,
  request: Request,
  graph: GraphIndex,
): RelationshipContext {
  const payload = emptyPayload(dataset, datasetSha256, caseId, request);
  payload.available = true;
  payload.limitations.push(
    "This is the frozen source, not the live ontology.",
    "Links show recorded placement, not approval. Missing links are not guessed.",
    "Generalization totals count recorded IDs; page totals exclude missing nodes.",
    "Node levels are not calculated here; missing levels are omitted.",
  );
  const proposedIds = [...request.roles]
    .filter(([, roles]) => roles.includes("proposed"))
    .map(([id]) => id);
  if (proposedIds.length)
    payload.limitations.push(
      "Unapproved proposed-parent IDs: " +
        proposedIds.join(", ") +
        ". These are choices, not added links.",
    );
  if (!payload.sourceCapturedAt)
    payload.limitations.push("Capture time is not recorded in this dataset.");

  const missing = new Set<string>();
  for (const [id, roles] of request.roles) {
    const entry = graph.get(id);
    if (entry)
      payload.choices.push({ node: copyNode(entry), roles: [...roles] });
    else missing.add(id);
  }
  const focus = graph.get(request.focusId);
  if (focus) {
    payload.focus = copyNode(focus);
    payload.generalizationsTotal = focus.parents.length;
    for (const id of focus.parents) if (!graph.has(id)) missing.add(id);
    payload.generalizations = focus.parents
      .slice(0, MAX_PARENTS)
      .filter((id) => graph.has(id))
      .map((id) => copyNode(graph.get(id)!));
    if (focus.parents.length > MAX_PARENTS)
      payload.limitations.push(
        "Direct Generalizations are limited to the first 120 recorded IDs; the total includes all IDs.",
      );
    const activities: string[] = [];
    const sources: string[] = [];
    for (const id of focus.children) {
      const child = graph.get(id);
      if (!child) missing.add(id);
      else (child.summary.oNetTask ? sources : activities).push(id);
    }
    payload.specializationPage = page(
      activities,
      graph,
      request.activityOffset,
      request.limit,
    );
    payload.sourcePage = page(
      sources,
      graph,
      request.sourceOffset,
      request.limit,
    );
    const ancestors = recordedAncestors(graph, request.focusId, missing);
    payload.ancestors = ancestors.value;
    payload.limitations.push(...ancestors.limitations);
  } else {
    payload.limitations.push(
      "The selected node is missing from the frozen source.",
    );
  }
  payload.missingNodeIds = [...missing].sort();
  if (missing.size)
    payload.limitations.push(
      "Some referenced nodes are missing from the frozen source; their IDs are listed.",
    );
  return finish(payload);
}

function unavailable(
  dataset: RelationshipDataset,
  datasetSha256: string,
  caseId: string,
  request: Request,
) {
  const payload = emptyPayload(dataset, datasetSha256, caseId, request);
  payload.limitations.push(
    "This saved version has no approved frozen neighborhood.",
  );
  return finish(payload);
}

/** Pass the verified dataset and byte hash returned by getRelationshipDataset. */
export function relationshipContext(
  dataset: RelationshipDataset,
  datasetSha256: string,
  caseId: string,
  options?: ContextOptions,
): RelationshipContext {
  const request = validateRequest(dataset, datasetSha256, caseId, options);
  if (!VERSIONS.has(dataset.version))
    return unavailable(dataset, datasetSha256, caseId, request);
  assertSourcePin(dataset); // Check every call, including calls using the cache.
  return disclose(dataset, datasetSha256, caseId, request, verifiedGraph());
}

/** Pure synthetic-test builder; it does not read or verify source-file bytes. */
export function buildRelationshipContext(
  dataset: RelationshipDataset,
  datasetSha256: string,
  caseId: string,
  graph: readonly FrozenGraphNode[],
  options?: ContextOptions,
): RelationshipContext {
  const request = validateRequest(dataset, datasetSha256, caseId, options);
  if (!VERSIONS.has(dataset.version))
    return unavailable(dataset, datasetSha256, caseId, request);
  assertSourcePin(dataset);
  return disclose(dataset, datasetSha256, caseId, request, indexGraph(graph));
}
