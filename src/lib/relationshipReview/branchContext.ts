// Server-side context projection, imported only by the authenticated API handler.
import { GENERALIZATION_BRANCH_VERSION } from '../../types/IBranchReview';
import type {
  BranchContext,
  BranchContextRequest,
  BranchDataset,
  BranchFamily,
  BranchPage,
} from '../../types/IBranchReview';
import type { RelationshipNode } from '../../types/IRelationshipReview';
import { getBranchSourceGraph } from './branchDataset';
import { RelationshipError } from './feedback';

export { RelationshipError } from './feedback';
export type BranchContextOptions = Pick<
  BranchContextRequest,
  'focusId' | 'activityOffset' | 'sourceOffset' | 'limit'
>;
/** Loader-normalized index, not raw source JSON. */
export type BranchContextIndex = ReturnType<typeof getBranchSourceGraph>;

const SHA256 = /^[a-f0-9]{64}$/;
const OPTION_KEYS = new Set(['focusId', 'activityOffset', 'sourceOffset', 'limit']);
const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 25;

function fail(message: string): never {
  throw new RelationshipError(400, message);
}

function requireHash(value: unknown, label: string): asserts value is string {
  // Length also rejects a trailing newline, which JavaScript's $ can otherwise accept.
  if (typeof value !== 'string' || value.length !== 64 || !SHA256.test(value)) {
    fail(`Invalid ${label} SHA-256.`);
  }
}

function select(
  dataset: BranchDataset,
  sha256: string,
  caseId: string,
  options?: BranchContextOptions,
) {
  if (!dataset || typeof dataset !== 'object' ||
      dataset.schemaVersion !== 'generalization-branch-review-v1' ||
      dataset.version !== GENERALIZATION_BRANCH_VERSION) {
    fail('Unknown branch dataset version.');
  }
  requireHash(sha256, 'dataset');
  requireHash(dataset.sourceSha256, 'source');
  if (typeof caseId !== 'string' || !caseId.trim()) fail('Invalid family case ID.');
  if (!Array.isArray(dataset.families)) fail('Invalid branch families.');
  const matches = dataset.families.filter((family) => family && family.id === caseId);
  const family = matches[0];
  if (!family || matches.length !== 1) fail('Unknown or ambiguous family case ID.');

  const raw: unknown = options === undefined ? {} : options;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail('Context options must be an object.');
  }
  const prototype = Object.getPrototypeOf(raw);
  if (prototype !== Object.prototype && prototype !== null) {
    fail('Context options must be a plain object.');
  }
  const fields = raw as Record<string, unknown>;
  for (const key of Reflect.ownKeys(fields)) {
    if (typeof key !== 'string' || !OPTION_KEYS.has(key)) fail('Unknown context option.');
  }
  const has = (key: string) => Object.prototype.hasOwnProperty.call(fields, key);
  const focusId = has('focusId') ? fields.focusId : caseId;
  if (typeof focusId !== 'string' || !focusId.trim()) fail('Invalid focus ID.');
  const integer = (
    key: 'activityOffset' | 'sourceOffset' | 'limit',
    fallback: number,
    minimum: number,
    maximum = Number.MAX_SAFE_INTEGER,
  ): number => {
    const value = has(key) ? fields[key] : fallback;
    if (typeof value !== 'number' || !Number.isSafeInteger(value) ||
        value < minimum || value > maximum) {
      fail(`Invalid ${key}: expected a safe integer from ${minimum} to ${maximum}.`);
    }
    return value;
  };
  return {
    family,
    focusId,
    activityOffset: integer('activityOffset', 0, 0),
    sourceOffset: integer('sourceOffset', 0, 0),
    limit: integer('limit', DEFAULT_LIMIT, 1, MAX_LIMIT),
  };
}

function links(
  index: BranchContextIndex,
  kind: 'parents' | 'children',
  id: string,
): readonly string[] {
  const refs = index[kind].get(id);
  if (refs === undefined) return [];
  if (!Array.isArray(refs) || refs.some((ref) => typeof ref !== 'string' || !ref.trim())) {
    fail('Invalid frozen source links.');
  }
  return refs;
}

function frozenNode(index: BranchContextIndex, id: string): RelationshipNode | undefined {
  const row = index.nodes.get(id);
  if (row === undefined) return undefined;
  if (!row || typeof row !== 'object' || Array.isArray(row) ||
      row.id !== id || typeof row.title !== 'string' ||
      (row.description !== undefined && typeof row.description !== 'string') ||
      (row.level !== undefined && row.level !== null &&
        (typeof row.level !== 'number' || !Number.isFinite(row.level))) ||
      (row.oNetTask !== undefined && row.oNetTask !== null && typeof row.oNetTask !== 'boolean') ||
      (row.descriptionSource !== undefined && row.descriptionSource !== null &&
        typeof row.descriptionSource !== 'string')) {
    fail('Invalid frozen source node.');
  }
  // Project only normalized public node fields; never expose raw private metadata.
  const node: RelationshipNode = { id: row.id, title: row.title };
  if (row.description !== undefined) node.description = row.description;
  if (row.level !== undefined) node.level = row.level;
  if (row.oNetTask !== undefined) node.oNetTask = row.oNetTask;
  if (row.descriptionSource !== undefined) node.descriptionSource = row.descriptionSource;
  return node;
}

function permittedFocusIds(family: BranchFamily, index: BranchContextIndex): Set<string> {
  const primary = new Set([family.id]);
  const suppliedGeneralizations = new Set<string>();
  const add = (target: Set<string>, nodes: readonly RelationshipNode[]) => {
    if (!Array.isArray(nodes)) fail('Invalid supplied family nodes.');
    for (const node of nodes) {
      if (!node || typeof node.id !== 'string' || !node.id.trim()) {
        fail('Invalid supplied family node ID.');
      }
      target.add(node.id);
    }
  };
  add(primary, family.currentSpecializations);
  add(suppliedGeneralizations, family.generalizations);
  if (!Array.isArray(family.groups)) fail('Invalid supplied family groups.');
  for (const group of family.groups) {
    if (!group || !Array.isArray(group.members)) fail('Invalid supplied family group.');
    add(primary, [group.node]);
    for (const member of group.members) {
      if (!member) fail('Invalid supplied family member.');
      add(primary, [member.node]);
      add(suppliedGeneralizations, member.currentGeneralizations);
    }
  }
  for (const id of links(index, 'children', family.id)) {
    const node = frozenNode(index, id);
    if (node && node.oNetTask !== true) primary.add(id);
  }
  const permitted = new Set([...primary, ...suppliedGeneralizations]);
  // One hop from arrangement nodes only: no recursive whole-graph browsing.
  for (const id of primary) {
    for (const parentId of links(index, 'parents', id)) permitted.add(parentId);
  }
  return permitted;
}

function page<T>(items: T[], offset: number, limit: number): BranchPage<T> {
  const total = items.length;
  // Do not add limit to a potentially MAX_SAFE_INTEGER offset or silently reset it.
  if (offset >= total) return { items: [], total, offset, limit, nextOffset: null };
  const end = Math.min(total, offset + limit);
  return { items: items.slice(offset, end), total, offset, limit, nextOffset: end < total ? end : null };
}

function assemble(
  dataset: BranchDataset,
  sha256: string,
  selection: ReturnType<typeof select>,
  index: BranchContextIndex,
): BranchContext {
  if (!index || typeof index !== 'object' || !(index.nodes instanceof Map) ||
      !(index.parents instanceof Map) || !(index.children instanceof Map)) {
    fail('Invalid frozen source index.');
  }
  requireHash(index.sha256, 'indexed source');
  if (index.sha256 !== dataset.sourceSha256) {
    fail('Frozen source hash does not match the pinned dataset source.');
  }
  const { family, focusId, activityOffset, sourceOffset, limit } = selection;
  if (!frozenNode(index, family.id)) fail('The family root is missing from the pinned frozen source graph.');
  if (!permittedFocusIds(family, index).has(focusId)) {
    fail('Focus is not supplied by this family or its direct current context.');
  }
  const focus = frozenNode(index, focusId);
  if (!focus) fail('The focus is missing from the pinned frozen source graph.');

  const missing = new Set<string>();
  const resolve = (refs: Iterable<string>, excludeId?: string): RelationshipNode[] => {
    const result: RelationshipNode[] = [];
    const seen = new Set<string>();
    for (const id of refs) {
      if (id === excludeId || seen.has(id)) continue;
      seen.add(id);
      const node = frozenNode(index, id);
      if (node) result.push(node);
      else missing.add(id);
    }
    return result;
  };
  const parentIds = links(index, 'parents', focusId);
  const generalizations = resolve(parentIds);
  const children = resolve(links(index, 'children', focusId));
  const siblingIds = new Set<string>();
  for (const parentId of new Set(parentIds)) {
    for (const id of links(index, 'children', parentId)) siblingIds.add(id);
  }
  const siblings = resolve(siblingIds, focusId);
  const limitations = [
    'Frozen current context only: these recorded Generalizations and Specializations are not live updates.',
    'These links are not an endorsement of the proposed family arrangement or of any placement.',
    'Only direct recorded links are followed, not an exhaustive semantic search. Specializations, O*NET sources and siblings are paged.',
  ];
  if (missing.size) {
    limitations.push(`${missing.size} referenced node${missing.size === 1 ? ' is' : 's are'} missing from the frozen source graph. Unavailable references are omitted; page totals count available nodes only.`);
  }
  return {
    caseId: family.id,
    datasetVersion: dataset.version,
    datasetSha256: sha256,
    sourceSha256: dataset.sourceSha256,
    focus,
    generalizations,
    specializations: page(children.filter((node) => node.oNetTask !== true), activityOffset, limit),
    sources: page(children.filter((node) => node.oNetTask === true), sourceOffset, limit),
    siblings: page(siblings, activityOffset, limit),
    limitations,
  };
}

/** Pure counterpart: index must be loader-normalized and carry the exact source pin.
 * Missing link targets are disclosed and omitted, never reconstructed from dataset copies.
 * Ordering follows the frozen index, deduplicated by ID at first occurrence. */
export function buildBranchContext(
  dataset: BranchDataset,
  sha256: string,
  caseId: string,
  index: BranchContextIndex,
  options?: BranchContextOptions,
): BranchContext {
  return assemble(dataset, sha256, select(dataset, sha256, caseId, options), index);
}

/** Server callers supply the dataset and byte hash returned together by getBranchDataset. */
export function branchContext(
  dataset: BranchDataset,
  sha256: string,
  caseId: string,
  options?: BranchContextOptions,
): BranchContext {
  const selection = select(dataset, sha256, caseId, options);
  return assemble(dataset, sha256, selection, getBranchSourceGraph(dataset.sourceSha256));
}
