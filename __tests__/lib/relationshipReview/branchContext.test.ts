/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('../../../src/lib/relationshipReview/branchDataset', () => ({
  getBranchSourceGraph: jest.fn(),
}));

import { createHash } from 'crypto';
import { GENERALIZATION_BRANCH_VERSION } from '../../../src/types/IBranchReview';
import type {
  BranchDataset,
  BranchFamily,
  BranchMember,
  BranchMemberDecision,
} from '../../../src/types/IBranchReview';
import type { RelationshipNode } from '../../../src/types/IRelationshipReview';
import { getBranchSourceGraph } from '../../../src/lib/relationshipReview/branchDataset';
import { RelationshipError as SharedRelationshipError } from '../../../src/lib/relationshipReview/feedback';
import {
  branchContext,
  buildBranchContext,
  RelationshipError,
} from '../../../src/lib/relationshipReview/branchContext';
import type {
  BranchContextIndex,
  BranchContextOptions,
} from '../../../src/lib/relationshipReview/branchContext';

const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const ids = (nodes: readonly RelationshipNode[]) => nodes.map((node) => node.id);
const loadGraph = getBranchSourceGraph as jest.MockedFunction<typeof getBranchSourceGraph>;

type Collection = { collectionName: string; nodes: { id: string; title: string }[] };
type SourceRecord = {
  id: string;
  title: string;
  nodeType: 'activity';
  properties: { description: string };
  level: number | null;
  oNetTask: boolean | null;
  descriptionSource: string | null;
  generalizations: Collection[];
  specializations: Collection[];
};

function collections(refs: string[]): Collection[] {
  const split = Math.ceil(refs.length / 2);
  const records = (items: string[]) => items.map((id) => ({ id, title: `Link label ${id}` }));
  return [
    { collectionName: 'main', nodes: records(refs.slice(0, split)) },
    { collectionName: 'independent', nodes: records(refs.slice(split)) },
  ];
}

function record(
  id: string,
  parents: string[] = [],
  children: string[] = [],
  extra: Partial<SourceRecord> = {},
): SourceRecord {
  return {
    id, title: `Frozen ${id}`, nodeType: 'activity',
    properties: { description: `Frozen description ${id}.` },
    level: 1, oNetTask: false, descriptionSource: 'Synthetic source-graph.json',
    generalizations: collections(parents), specializations: collections(children),
    ...extra,
  };
}

function source(): SourceRecord[] {
  const activityIds = Array.from({ length: 10 }, (_, index) => `A${index}`);
  const sourceIds = Array.from({ length: 4 }, (_, index) => `SRC${index}`);
  return [
    record('F', ['TOP', 'ROOT_CO'], ['DIRECT', 'EXTRA_DIRECT', 'ROOT_SOURCE']),
    record('TOP', [], ['F']), record('ROOT_CO', [], ['F']),
    record('DIRECT', ['F', 'DIRECT_PARENT']),
    record('DIRECT_PARENT', [], ['DIRECT', 'DIRECT_SIB']),
    record('DIRECT_SIB', ['DIRECT_PARENT']),
    record('EXTRA_DIRECT', ['F', 'EXTRA_PARENT']), record('EXTRA_PARENT', [], ['EXTRA_DIRECT']),
    record('ROOT_SOURCE', ['F'], [], { oNetTask: true }),
    record('G', ['GROUP_PARENT', 'GROUP_CO']),
    record('GROUP_PARENT', [], ['G']), record('GROUP_CO', [], ['G']),
    record('M', ['P1', 'P2', 'P1'], ['A0', 'SRC0', 'A1', 'SRC1', ...activityIds.slice(2), ...sourceIds.slice(2)], { level: 0 }),
    record('H', ['P1']), record('X', ['EX_PARENT']), record('EX_PARENT', [], ['X']),
    record('P1', ['OUTSIDE_ANCESTOR'], ['M', 'H', 'SIB1', 'SHARED', 'SIB_SOURCE', 'SIB1']),
    record('P2', [], ['M', 'SHARED', 'SIB2', 'SIB1']),
    record('SIB1', ['P1', 'P2']), record('SHARED', ['P1', 'P2']), record('SIB2', ['P2']),
    record('SIB_SOURCE', ['P1'], [], { oNetTask: true }),
    record('OUTSIDE_ANCESTOR', [], ['P1']), record('OUTSIDE'), record('F2'),
    ...activityIds.map((id, index) => record(id, ['M'], [], {
      oNetTask: index === 3 ? null : false,
      descriptionSource: index === 3 ? null : 'Synthetic source-graph.json',
      title: index === 9 ? 'O*NET words alone do not mark a source' : `Frozen ${id}`,
    })),
    ...sourceIds.map((id) => record(id, ['M'], [], { oNetTask: true })),
  ];
}

/* The pure API consumes the loader-normalized index. Synthetic evidence uses the
 * real collection-link / properties.description export shape, then projects it
 * solely for test inputs. Production normalization remains loader-owned. */
function normalizedIndex(rows: SourceRecord[]): BranchContextIndex {
  const nodes = new Map<string, RelationshipNode>();
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  for (const row of rows) {
    nodes.set(row.id, {
      id: row.id, title: row.title, description: row.properties.description,
      level: row.level, oNetTask: row.oNetTask, descriptionSource: row.descriptionSource,
    });
    parents.set(row.id, row.generalizations.flatMap((collection) => collection.nodes.map((node) => node.id)));
    children.set(row.id, row.specializations.flatMap((collection) => collection.nodes.map((node) => node.id)));
  }
  return { sha256: hash(JSON.stringify(rows)), nodes, parents, children };
}

function dataset(sourceSha256: string): BranchDataset {
  const saved = (id: string): RelationshipNode => ({
    id, title: `Draft ${id}`, description: `Draft description ${id}.`, level: 999, oNetTask: false,
  });
  const member = (id: string, decision: BranchMemberDecision, parents: string[]): BranchMember => ({
    node: saved(id), decision, reason: 'Synthetic review reason.',
    titleDependency: 'none-observed', currentGeneralizations: parents.map(saved),
    nounEvidenceNote: 'No synthetic noun inference.', sourceRecords: id === 'M' ? [saved('SRC0')] : [],
  });
  const family: BranchFamily = {
    id: 'F', title: 'Draft family', description: 'Draft family description.',
    generalizations: ['TOP', 'ROOT_CO'].map(saved),
    currentSpecializations: [saved('DIRECT')], currentSourceRecords: [saved('ROOT_SOURCE')],
    summary: 'Synthetic full family arrangement.', scopeNote: 'Synthetic frozen scope.',
    groups: [{
      id: 'review-group-alias', node: saved('G'), summary: 'Synthetic group.',
      coherence: 'Unresolved synthetic group.', eligible: false,
      members: [member('M', 'include', ['P1', 'P2']), member('H', 'hold', ['P1']), member('X', 'exclude', ['EX_PARENT'])],
      remainingQuestions: ['Synthetic open question.'],
    }],
    sourceCaseIds: ['OUTSIDE'], remainingQuestions: ['Synthetic family question.'],
  };
  const date = '2026-10-24T00:00:00Z';
  return {
    schemaVersion: 'generalization-branch-review-v1', version: GENERALIZATION_BRANCH_VERSION,
    title: 'Synthetic family release', createdAt: date,
    model: 'Synthetic test model', modelVersion: 'test-v1', reasoning: 'Synthetic test evidence.',
    fundingRoute: 'ACCESS', sourceApp: 'synthetic-frozen-source',
    sourceCapturedAt: date, sourceRecheckedAt: date, sourceSha256,
    priorDatasetVersion: 'synthetic-child-review-v1', priorDatasetSha256: hash('synthetic prior dataset bytes'),
    scopeNote: 'Synthetic frozen scope.', titleStatusNote: 'No title changes in this test.',
    nounNote: 'No noun inference.', prompt: 'Synthetic template only.', criticPrompts: ['Synthetic critic template.'],
    families: [family, {
      ...family, id: 'F2', title: 'Other synthetic family', generalizations: [],
      currentSpecializations: [], currentSourceRecords: [], groups: [], sourceCaseIds: [],
    }],
  };
}

function fixture(rows = source()) {
  const index = normalizedIndex(rows);
  const release = dataset(index.sha256);
  return { source: rows, index, dataset: release, datasetSha256: hash(JSON.stringify(release)) };
}

function freeze(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  if (value instanceof Map) {
    for (const item of value.values()) freeze(item);
  } else {
    for (const item of Object.values(value)) freeze(item);
  }
  Object.freeze(value);
}

const indexSnapshot = (index: BranchContextIndex) =>
  JSON.stringify([index.sha256, [...index.nodes], [...index.parents], [...index.children]]);

const badHashes: unknown[] = [
  undefined, null, 123, '', 'a'.repeat(63), 'a'.repeat(65), 'g'.repeat(64), 'A'.repeat(64),
  ` ${'a'.repeat(64)}`, 'a'.repeat(64) + String.fromCharCode(10),
];
const badOffsets: unknown[] = [undefined, null, '0', false, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1];

let f: ReturnType<typeof fixture>;
function context(options?: BranchContextOptions) {
  return buildBranchContext(f.dataset, f.datasetSha256, 'F', f.index, options);
}

beforeEach(() => {
  f = fixture();
  loadGraph.mockReset();
  loadGraph.mockReturnValue(f.index);
});

test('uses normalized frozen nodes, all collections and all current independent Generalizations', () => {
  const result = context({ focusId: 'M', limit: 25 });
  const raw = f.source.find((node) => node.id === 'M')!;
  expect(raw.generalizations).toEqual([
    { collectionName: 'main', nodes: [{ id: 'P1', title: 'Link label P1' }, { id: 'P2', title: 'Link label P2' }] },
    { collectionName: 'independent', nodes: [{ id: 'P1', title: 'Link label P1' }] },
  ]);
  expect(result).toMatchObject({
    caseId: 'F', datasetVersion: GENERALIZATION_BRANCH_VERSION,
    datasetSha256: f.datasetSha256, sourceSha256: f.index.sha256,
    focus: { id: 'M', title: 'Frozen M', description: raw.properties.description, level: 0, oNetTask: false },
  });
  expect(result.focus).not.toHaveProperty('properties');
  expect(result.focus).not.toHaveProperty('generalizations');
  expect(ids(result.generalizations)).toEqual(['P1', 'P2']);
  expect(ids(result.generalizations)).not.toContain('G');
  expect(ids(result.siblings.items)).toEqual(['H', 'SIB1', 'SHARED', 'SIB_SOURCE', 'SIB2']);
  for (const node of [result.focus, ...result.generalizations, ...result.specializations.items, ...result.sources.items, ...result.siblings.items]) {
    expect(node).toEqual(f.index.nodes.get(node.id));
    expect(node).not.toBe(f.index.nodes.get(node.id));
  }
  const limitations = result.limitations.join(' ');
  expect(limitations).toMatch(/frozen current context/i);
  expect(limitations).toMatch(/not an endorsement/i);
  expect(limitations).toMatch(/not an exhaustive semantic search/i);
  expect(RelationshipError).toBe(SharedRelationshipError);
});

test('defaults to the family root, eight items and zero offsets', () => {
  expect(context().focus.id).toBe('F');
  const result = context({ focusId: 'M' });
  expect(result.specializations).toMatchObject({ total: 10, offset: 0, limit: 8, nextOffset: 8 });
  expect(ids(result.specializations.items)).toEqual(Array.from({ length: 8 }, (_, index) => `A${index}`));
  expect(result.sources).toMatchObject({ total: 4, offset: 0, limit: 8, nextOffset: null });
  expect(result.siblings).toMatchObject({ total: 5, offset: 0, limit: 8, nextOffset: null });
});

test('classifies sources only by normalized oNetTask, retaining null and false fields', () => {
  const result = context({ focusId: 'M', limit: 25 });
  expect(ids(result.sources.items)).toEqual(['SRC0', 'SRC1', 'SRC2', 'SRC3']);
  expect(result.sources.items.every((node) => node.oNetTask === true)).toBe(true);
  expect(result.specializations.items.find((node) => node.id === 'A3')).toMatchObject({ oNetTask: null, descriptionSource: null });
  expect(ids(result.specializations.items)).toContain('A9');
  expect(result.siblings.items.find((node) => node.id === 'SIB_SOURCE')?.oNetTask).toBe(true);
});

test.each([
  { activityOffset: 0, sourceOffset: 0, limit: 2, activities: ['A0', 'A1'], sources: ['SRC0', 'SRC1'], siblings: ['H', 'SIB1'], nextActivity: 2, nextSource: 2, nextSibling: 2 },
  { activityOffset: 2, sourceOffset: 1, limit: 2, activities: ['A2', 'A3'], sources: ['SRC1', 'SRC2'], siblings: ['SHARED', 'SIB_SOURCE'], nextActivity: 4, nextSource: 3, nextSibling: 4 },
  { activityOffset: 8, sourceOffset: 3, limit: 3, activities: ['A8', 'A9'], sources: ['SRC3'], siblings: [], nextActivity: null, nextSource: null, nextSibling: null },
  { activityOffset: 10, sourceOffset: 4, limit: 25, activities: [], sources: [], siblings: [], nextActivity: null, nextSource: null, nextSibling: null },
])('pages independently at activity $activityOffset and source $sourceOffset', (row) => {
  const result = context({ focusId: 'M', activityOffset: row.activityOffset, sourceOffset: row.sourceOffset, limit: row.limit });
  expect(ids(result.generalizations)).toEqual(['P1', 'P2']);
  expect(ids(result.specializations.items)).toEqual(row.activities);
  expect(ids(result.sources.items)).toEqual(row.sources);
  expect(ids(result.siblings.items)).toEqual(row.siblings);
  expect(result.specializations).toMatchObject({ total: 10, offset: row.activityOffset, limit: row.limit, nextOffset: row.nextActivity });
  expect(result.sources).toMatchObject({ total: 4, offset: row.sourceOffset, limit: row.limit, nextOffset: row.nextSource });
  expect(result.siblings).toMatchObject({ total: 5, offset: row.activityOffset, limit: row.limit, nextOffset: row.nextSibling });
});

test.each([1, 25])('accepts boundary limit %i without paging Generalizations', (limit) => {
  const result = context({ focusId: 'M', limit });
  expect(ids(result.generalizations)).toEqual(['P1', 'P2']);
  expect(result.specializations.items).toHaveLength(Math.min(limit, 10));
  expect(result.sources.items).toHaveLength(Math.min(limit, 4));
  expect(result.siblings.items).toHaveLength(Math.min(limit, 5));
});

test('preserves safe out-of-range offsets without overflow or resetting the target', () => {
  const offset = Number.MAX_SAFE_INTEGER;
  const result = context({ focusId: 'M', activityOffset: offset, sourceOffset: offset, limit: 25 });
  for (const page of [result.specializations, result.sources, result.siblings]) {
    expect(page).toMatchObject({ items: [], offset, limit: 25, nextOffset: null });
  }
  expect(result.specializations.total).toBe(10);
  expect(result.sources.total).toBe(4);
  expect(result.siblings.total).toBe(5);
});

test.each([
  'F', 'G', 'M', 'H', 'X', 'DIRECT', 'EXTRA_DIRECT', 'TOP', 'ROOT_CO',
  'GROUP_PARENT', 'GROUP_CO', 'P1', 'P2', 'EX_PARENT', 'DIRECT_PARENT', 'EXTRA_PARENT',
])('permits arrangement/current-context focus %s, including held and excluded members', (focusId) => {
  expect(context({ focusId }).focus.id).toBe(focusId);
});

test.each([
  'OUTSIDE', 'OUTSIDE_ANCESTOR', 'SIB1', 'SIB_SOURCE', 'ROOT_SOURCE',
  'SRC0', 'A0', 'F2', 'review-group-alias', 'not-in-source',
])('rejects out-of-scope focus %s without traversing the entire graph', (focusId) => {
  expect(() => context({ focusId })).toThrow(/Focus is not supplied/);
});

test('binds the case independently from the focus and never substitutes another family', () => {
  const result = buildBranchContext(f.dataset, f.datasetSha256, 'F2', f.index);
  expect(result).toMatchObject({ caseId: 'F2', focus: { id: 'F2', title: 'Frozen F2' } });
});

test.each([undefined, null, 12, '', ' F', 'G', 'unknown'].map((value) => [value]))('rejects unknown or invalid case %p before loading', (value) => {
  expect(() => buildBranchContext(f.dataset, f.datasetSha256, value as string, f.index)).toThrow(SharedRelationshipError);
  expect(() => branchContext(f.dataset, f.datasetSha256, value as string)).toThrow(SharedRelationshipError);
  expect(loadGraph).not.toHaveBeenCalled();
});

test.each([
  null, [], 'options', 1, true, new Date(0), new Map(), Object.create({ focusId: 'M' }),
  { nodeId: 'M' }, { caseId: 'F' }, { datasetVersion: GENERALIZATION_BRANCH_VERSION },
  { activityOffset: 0, unknown: true }, { [Symbol('extra')]: true },
  Object.defineProperty({}, 'hidden', { value: true }),
].map((value) => [value]))('rejects unknown option keys/types %p before loading', (value) => {
  const options = value as BranchContextOptions;
  expect(() => context(options)).toThrow(SharedRelationshipError);
  expect(() => branchContext(f.dataset, f.datasetSha256, 'F', options)).toThrow(SharedRelationshipError);
  expect(loadGraph).not.toHaveBeenCalled();
});

test.each([undefined, null, '', ' ', 1, false, [], {}].map((value) => [value]))('rejects explicitly invalid focus type/value %p', (value) => {
  expect(() => context({ focusId: value } as BranchContextOptions)).toThrow(/Invalid focus ID/);
});

describe.each(['activityOffset', 'sourceOffset'])('%s validation', (key) => {
  test.each(badOffsets.map((value) => [value]))('rejects %p before loading', (value) => {
    const options = { [key]: value } as BranchContextOptions;
    expect(() => context(options)).toThrow(SharedRelationshipError);
    expect(() => branchContext(f.dataset, f.datasetSha256, 'F', options)).toThrow(SharedRelationshipError);
    expect(loadGraph).not.toHaveBeenCalled();
  });
});

test.each([...badOffsets, 0, 26, Number.MAX_SAFE_INTEGER].map((value) => [value]))('rejects invalid limit %p rather than clamping it', (value) => {
  expect(() => context({ limit: value } as BranchContextOptions)).toThrow(/Invalid limit/);
});

test.each(badHashes.map((value) => [value]))('validates dataset hash format on pure and server calls: %p', (value) => {
  expect(() => buildBranchContext(f.dataset, value as string, 'F', f.index)).toThrow(/dataset SHA-256/);
  expect(() => branchContext(f.dataset, value as string, 'F')).toThrow(/dataset SHA-256/);
  expect(loadGraph).not.toHaveBeenCalled();
});

test.each(badHashes.map((value) => [value]))('validates source hash format on pure and server calls: %p', (value) => {
  const release = { ...f.dataset, sourceSha256: value as string };
  expect(() => buildBranchContext(release, f.datasetSha256, 'F', f.index)).toThrow(/source SHA-256/);
  expect(() => branchContext(release, f.datasetSha256, 'F')).toThrow(/source SHA-256/);
  expect(loadGraph).not.toHaveBeenCalled();
  expect(() => buildBranchContext(f.dataset, f.datasetSha256, 'F', { ...f.index, sha256: value as string })).toThrow(/indexed source SHA-256/);
});

test.each([
  { version: 'synthetic-child-review-v1' },
  { schemaVersion: 'unknown-schema' },
])('rejects unknown versions/schema without old-dataset fallback: %p', (change) => {
  const release = { ...f.dataset, ...change } as unknown as BranchDataset;
  expect(() => buildBranchContext(release, f.datasetSha256, 'F', f.index)).toThrow(/Unknown branch dataset version/);
  expect(() => branchContext(release, f.datasetSha256, 'F')).toThrow(/Unknown branch dataset version/);
  expect(loadGraph).not.toHaveBeenCalled();
});

test('requires a normalized Map index with the exact source pin', () => {
  expect(() => buildBranchContext(f.dataset, f.datasetSha256, 'F', f.source as unknown as BranchContextIndex)).toThrow(/source index/);
  expect(() => buildBranchContext(f.dataset, f.datasetSha256, 'F', { ...f.index, sha256: hash('other synthetic graph bytes') })).toThrow(/source hash.*pinned/i);
  const nodes = new Map(f.index.nodes);
  nodes.set('M', { ...nodes.get('M')!, id: 'OUTSIDE' });
  expect(() => buildBranchContext(f.dataset, f.datasetSha256, 'F', { ...f.index, nodes }, { focusId: 'M' })).toThrow(/source node/);
});

test.each(['F', 'M'])('fails closed when required frozen node %s is missing, never using dataset labels', (missingId) => {
  const broken = fixture(source().filter((node) => node.id !== missingId));
  expect(() => buildBranchContext(broken.dataset, broken.datasetSha256, 'F', broken.index, { focusId: 'M' })).toThrow(/missing from the pinned frozen source graph/);
});

test('discloses deduplicated missing references and counts only available nodes', () => {
  const rows = source().map((node) => {
    if (node.id === 'M') return {
      ...node, generalizations: collections(['P1', 'MISSING_PARENT', 'P2', 'P1']),
      specializations: [...node.specializations, ...collections(['MISSING_CHILD', 'MISSING_CHILD'])],
    };
    if (node.id === 'P1') return {
      ...node, specializations: [...node.specializations, ...collections(['MISSING_SIBLING', 'MISSING_CHILD'])],
    };
    return node;
  });
  const broken = fixture(rows);
  const result = buildBranchContext(broken.dataset, broken.datasetSha256, 'F', broken.index, { focusId: 'M', limit: 25 });
  expect(ids(result.generalizations)).toEqual(['P1', 'P2']);
  expect(result.specializations.total).toBe(10);
  expect(result.sources.total).toBe(4);
  expect(ids(result.siblings.items)).toEqual(['H', 'SIB1', 'SHARED', 'SIB_SOURCE', 'SIB2']);
  expect(result.limitations.join(' ')).toMatch(/3 referenced nodes are missing/);
  expect(result.limitations.join(' ')).toMatch(/page totals count available nodes only/);
  expect(() => buildBranchContext(broken.dataset, broken.datasetSha256, 'F', broken.index, { focusId: 'MISSING_PARENT' })).toThrow(/focus is missing/i);
});

test('does not mutate inputs and returned evidence cannot mutate the frozen index', () => {
  freeze(f.dataset);
  freeze(f.index);
  const options = Object.freeze({ focusId: 'M', limit: 2 });
  const beforeDataset = JSON.stringify(f.dataset);
  const beforeIndex = indexSnapshot(f.index);
  const result = context(options);
  const beforeResult = JSON.stringify(result);
  result.focus.title = 'Changed output only';
  result.generalizations[0]!.description = 'Changed output only';
  result.specializations.items[0]!.title = 'Changed output only';
  result.sources.items[0]!.oNetTask = false;
  result.siblings.items[0]!.title = 'Changed output only';
  result.specializations.items.pop();
  result.limitations.push('Changed output only');
  expect(JSON.stringify(f.dataset)).toBe(beforeDataset);
  expect(indexSnapshot(f.index)).toBe(beforeIndex);
  expect(JSON.stringify(context(options))).toBe(beforeResult);
});

test('server entry uses exactly the dataset source pin and matches the pure result', () => {
  const options = { focusId: 'M', activityOffset: 2, sourceOffset: 1, limit: 2 };
  expect(branchContext(f.dataset, f.datasetSha256, 'F', options)).toEqual(context(options));
  expect(loadGraph).toHaveBeenCalledTimes(1);
  expect(loadGraph).toHaveBeenCalledWith(f.dataset.sourceSha256);
});

test('server entry propagates unavailable pins and rejects silently substituted sources', () => {
  const unavailable = new Error('Unknown synthetic source pin');
  loadGraph.mockImplementation(() => { throw unavailable; });
  expect(() => branchContext(f.dataset, f.datasetSha256, 'F')).toThrow(unavailable);
  expect(loadGraph).toHaveBeenCalledWith(f.dataset.sourceSha256);
  loadGraph.mockReturnValue({ ...f.index, sha256: hash('different synthetic source bytes') });
  expect(() => branchContext(f.dataset, f.datasetSha256, 'F')).toThrow(/source hash.*pinned/i);
});
