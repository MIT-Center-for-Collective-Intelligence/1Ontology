import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { TextDecoder } from 'util';
import { getRelationshipDataset } from './dataset';
import { RelationshipError } from './feedback';
import {
  GENERALIZATION_BRANCH_VERSION,
  type BranchDataset,
  type BranchFamily,
  type BranchFamilyTrace,
  type BranchTraceCoverage,
} from '../../types/IBranchReview';
import type { RelationshipNode } from '../../types/IRelationshipReview';

export const BRANCH_FAMILY_COUNT = 18;
export const BRANCH_GROUP_COUNT = 82;
export const BRANCH_PRIOR_CASE_COUNT = 103;

export interface BranchPackageManifest {
  schemaVersion: 'private-generalization-branch-package-v1';
  version: string;
  directory: string;
  families: number;
  groups: number;
  /** Required for history entries; the current release defaults to 103. */
  priorCases?: number;
  bundleSha256: string;
  releaseLockSha256: string;
  sourceSha256: string;
  sourceGraph: { directory: string; sha256: string };
  archiveSha256: string;
  gcsUri: string;
}

export interface BranchReleaseLock {
  datasetSha256: string;
  familyCount: number;
  groupCount: number;
  sourceSha256: string;
  traceHashes: Record<string, string>;
}

export interface BranchSourceGraph {
  sha256: string;
  nodes: ReadonlyMap<string, RelationshipNode>;
  parents: ReadonlyMap<string, readonly string[]>;
  children: ReadonlyMap<string, readonly string[]>;
}

interface PinnedFile { key: string; bytes: Buffer; sha256: string }
const pins = new Map<string, string>();
const parsed = new Map<string, unknown>();
const own = (v: object, key: string) => Object.prototype.hasOwnProperty.call(v, key);
const NODE_KEYS = ['id', 'title', 'description', 'level', 'oNetTask', 'descriptionSource'];
const SOURCE_KEYS = [
  'sourceApp', 'sourceCapturedAt', 'sourceRecheckedAt', 'sourceSha256',
  'priorDatasetVersion', 'priorDatasetSha256',
];

function invalid(message: string, code = 'branch_package_invalid'): never {
  throw new RelationshipError(503, message, code);
}

export function isSafeBranchNodeId(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[A-Za-z0-9_-]{1,128}$/.test(value) &&
    !['__proto__', 'prototype', 'constructor'].includes(value);
}

function id(value: unknown, label: string): string {
  if (!isSafeBranchNodeId(value)) invalid(`${label} has an unsafe ID.`);
  return value;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
    invalid(`${label} must be a JSON object.`);
  return value as Record<string, unknown>;
}

function keys(value: Record<string, unknown>, allowed: readonly string[], label: string) {
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    invalid(`${label} contains an unknown field.`);
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) invalid(`${label} must be an array.`);
  return value;
}

function text(value: unknown, label: string, empty = false): string {
  if (typeof value !== 'string' || value.length > 1000000 ||
      (!empty && value.trim().length === 0)) invalid(`${label} must be text.`);
  return value;
}

function hash(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value))
    invalid(`${label} must be an exact lowercase SHA-256 digest.`);
  return value;
}

function strings(value: unknown, label: string): string[] {
  return array(value, label).map((v) => text(v, label));
}

function ids(value: unknown, label: string): string[] {
  const result = array(value, label).map((v) => id(v, label));
  if (new Set(result).size !== result.length) invalid(`${label} contains duplicate IDs.`);
  return result;
}

function sameIds(a: readonly string[], b: readonly string[], label: string) {
  const expected = new Set(b);
  if (a.length !== b.length || new Set(a).size !== a.length ||
      a.some((v) => !expected.has(v))) invalid(`${label} does not have exact coverage.`);
}

function timestamp(value: unknown, label: string): number {
  const s = text(value, label);
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{1,3})?Z$/.test(s))
    invalid(`${label} must be a UTC ISO timestamp.`);
  const n = Date.parse(s);
  if (!Number.isFinite(n) || new Date(n).toISOString().slice(0, 19) !== s.slice(0, 19))
    invalid(`${label} is not a valid timestamp.`);
  return n;
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

/** JSON.parse would otherwise silently accept duplicate alias/lock object keys. */
function rejectDuplicateKeys(s: string, label: string) {
  let i = 0;
  const whitespace = () => {
    while ([9, 10, 13, 32].includes(s.charCodeAt(i))) i++;
  };
  const stringToken = () => {
    const start = i++;
    while (i < s.length) {
      const c = s.charCodeAt(i++);
      if (c === 92) i++;
      else if (c === 34) return s.slice(start, i);
    }
    invalid(`${label} has invalid JSON.`);
  };
  const walk = (depth: number): void => {
    if (depth > 200) invalid(`${label} has excessively nested JSON.`);
    whitespace();
    if (s[i] === '{') {
      i++;
      whitespace();
      const seen = new Set<string>();
      if (s[i] === '}') { i++; return; }
      for (;;) {
        const key = JSON.parse(stringToken()) as string;
        if (seen.has(key)) invalid(`${label} contains duplicate JSON keys.`);
        seen.add(key);
        whitespace();
        i++;
        walk(depth + 1);
        whitespace();
        if (s[i++] === '}') return;
        whitespace();
      }
    } else if (s[i] === '[') {
      i++;
      whitespace();
      if (s[i] === ']') { i++; return; }
      for (;;) {
        walk(depth + 1);
        whitespace();
        if (s[i++] === ']') return;
      }
    } else if (s.charCodeAt(i) === 34) {
      stringToken();
    } else {
      while (i < s.length && s.charCodeAt(i) > 32 &&
             ![',', ']', '}'].includes(s[i])) i++;
    }
  };
  walk(0);
}

function json(file: PinnedFile, label: string): unknown {
  if (parsed.has(file.sha256)) return parsed.get(file.sha256);
  try {
    const s = new TextDecoder('utf-8', { fatal: true }).decode(file.bytes);
    const value: unknown = JSON.parse(s);
    rejectDuplicateKeys(s, label);
    const result = freeze(value);
    parsed.set(file.sha256, result);
    return result;
  } catch (error) {
    if (error instanceof RelationshipError) throw error;
    invalid(`${label} is not valid UTF-8 JSON.`);
  }
}

function identity(a: fs.Stats, b: fs.Stats, file: boolean): boolean {
  return a.dev === b.dev && a.ino === b.ino && a.mode === b.mode &&
    (!file || (a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs));
}

/** Only fixed, scoped paths enter here. Audit every component and use a
 * non-following file descriptor; recheck identities after reading as well. */
function readFile(
  parts: readonly string[], label: string, maxBytes: number, expected?: string,
  integrityCode = 'branch_package_integrity', unavailableCode = 'branch_package_unavailable',
): PinnedFile {
  if (parts.some((p) => p === '.' || p === '..' || !/^[A-Za-z0-9._-]+$/.test(p)))
    invalid('An unsafe private package path was rejected.', 'branch_unsafe_file');
  const base = path.resolve(process.cwd());
  const file = path.join(base, ...parts);
  if (!file.startsWith(base + path.sep))
    invalid('An unsafe private package path was rejected.', 'branch_unsafe_file');
  let fd: number | undefined;
  try {
    const root = path.parse(file).root;
    const components = path.relative(root, file).split(path.sep);
    let cursor = root;
    const checked: { file: string; stat: fs.Stats }[] = [{ file: root, stat: fs.lstatSync(root) }];
    for (const component of components) {
      cursor = path.join(cursor, component);
      const stat = fs.lstatSync(cursor);
      if (stat.isSymbolicLink()) invalid(`${label} contains a symlink.`, 'branch_unsafe_file');
      checked.push({ file: cursor, stat });
    }
    checked.forEach((entry, index) => {
      if (entry.stat.isSymbolicLink() ||
          (index === checked.length - 1 ? !entry.stat.isFile() : !entry.stat.isDirectory()))
        invalid(`${label} is not a regular, non-symlink package file.`, 'branch_unsafe_file');
    });
    const initial = checked[checked.length - 1].stat;
    if (!Number.isSafeInteger(initial.size) || initial.size > maxBytes)
      invalid(`${label} exceeds its explicit size limit.`);
    if (typeof fs.constants.O_NOFOLLOW !== 'number')
      invalid('Non-following file access is unavailable on this server.', 'branch_unsafe_file');
    fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    if (!identity(initial, fs.fstatSync(fd), true))
      invalid(`${label} changed while being opened.`, 'branch_package_changed');
    const bytes = fs.readFileSync(fd);
    if (bytes.length > maxBytes || bytes.length !== initial.size ||
        !identity(initial, fs.fstatSync(fd), true))
      invalid(`${label} changed while being read.`, 'branch_package_changed');
    checked.forEach((entry, index) => {
      const after = fs.lstatSync(entry.file);
      if (after.isSymbolicLink() || !identity(entry.stat, after, index === checked.length - 1))
        invalid(`${label} was replaced while being read.`, 'branch_package_changed');
    });
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (expected !== undefined && sha256 !== expected)
      invalid(`${label} SHA-256 does not match its release pin.`, integrityCode);
    if (pins.has(file) && pins.get(file) !== sha256)
      invalid(`${label} was silently replaced in this running release.`, 'branch_package_changed');
    return { key: file, bytes, sha256 };
  } catch (error) {
    if (error instanceof RelationshipError) throw error;
    return invalid(`${label} is unavailable. Stage the pinned private package before reviewing.`, unavailableCode);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function commitPins(files: readonly PinnedFile[]) {
  files.forEach((file) => pins.set(file.key, file.sha256));
}

function manifestEntry(value: unknown, current: boolean): BranchPackageManifest {
  const m = record(value, 'Branch release manifest');
  keys(m, ['schemaVersion', 'version', 'directory', 'families', 'groups', 'priorCases',
    'bundleSha256', 'releaseLockSha256', 'sourceSha256', 'sourceGraph', 'archiveSha256', 'gcsUri'], 'Branch release manifest');
  const count = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
  const priorCases = own(m, 'priorCases') ? m.priorCases : current ? BRANCH_PRIOR_CASE_COUNT : undefined;
  if (m.schemaVersion !== 'private-generalization-branch-package-v1' ||
      !isSafeBranchNodeId(m.version) || !m.version.startsWith('generalization-branches-') ||
      typeof m.directory !== 'string' || !/^branches-[A-Za-z0-9_-]+$/.test(m.directory) ||
      !count(m.families) || !count(m.groups) || !count(priorCases))
    invalid('Branch release registration, paths or pinned counts are incorrect.');
  if (current && (m.version !== GENERALIZATION_BRANCH_VERSION || m.directory !== 'branches-v1' ||
      m.families !== BRANCH_FAMILY_COUNT || m.groups !== BRANCH_GROUP_COUNT || priorCases !== BRANCH_PRIOR_CASE_COUNT))
    invalid('The current branch manifest must pin all 18 families, 82 groups and 103 prior cases.');
  ['bundleSha256', 'releaseLockSha256', 'sourceSha256', 'archiveSha256'].forEach((k) => hash(m[k], k));
  const source = record(m.sourceGraph, 'Frozen source manifest');
  keys(source, ['directory', 'sha256'], 'Frozen source manifest');
  if (typeof source.directory !== 'string' || !/^atomic-[A-Za-z0-9_-]+$/.test(source.directory) ||
      (current && source.directory !== 'atomic-v1') || hash(source.sha256, 'Frozen source hash') !== m.sourceSha256)
    invalid('The branch manifest does not pin its scoped atomic source graph.');
  const uri = text(m.gcsUri, 'Archive URI');
  const uriParts = uri.startsWith('gs://') ? uri.slice(5).split('/') : [];
  if (uriParts.length < 2 || !/^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$/.test(uriParts[0]) ||
      uriParts.slice(1).some((p) => !p || p === '.' || p === '..' || !/^[A-Za-z0-9._-]+$/.test(p)))
    invalid('The archive URI must be a credential-free, scoped GCS object URI.');
  return m as unknown as BranchPackageManifest;
}

/** Optional history contains complete release entries, not mutable redirects. */
function manifestFile(version: string = GENERALIZATION_BRANCH_VERSION): { file: PinnedFile; manifest: BranchPackageManifest } {
  const file = readFile(['scripts', 'deployment', 'branch-review-package.json'], 'Branch manifest', 65536);
  const root = record(json(file, 'Branch manifest'), 'Branch manifest');
  const current = { ...root };
  delete current.history;
  const releases = [manifestEntry(current, true),
    ...array(own(root, 'history') ? root.history : [], 'Branch history').map((v) => manifestEntry(v, false))];
  const versions = new Set<string>();
  const directories = new Set<string>();
  const sources = new Map<string, string>();
  releases.forEach((release) => {
    if (versions.has(release.version) || directories.has(release.directory))
      invalid('Branch history contains a duplicate version or reused release directory.');
    versions.add(release.version);
    directories.add(release.directory);
    const previous = sources.get(release.sourceGraph.directory);
    if (previous !== undefined && previous !== release.sourceSha256)
      invalid('Branch history repins an immutable source directory.');
    sources.set(release.sourceGraph.directory, release.sourceSha256);
  });
  const manifest = releases.find((release) => release.version === version);
  if (!manifest) throw new RelationshipError(404, 'Unknown branch dataset version.', 'branch_version_not_found');
  return { file, manifest };
}

function nodeShape(value: unknown, label: string, strict = true): RelationshipNode {
  const n = record(value, label);
  if (strict) keys(n, NODE_KEYS, label);
  const result: RelationshipNode = { id: id(n.id, label), title: text(n.title, label) };
  if (own(n, 'description')) result.description = text(n.description, label, true);
  if (own(n, 'descriptionSource'))
    result.descriptionSource = n.descriptionSource === null ? null : text(n.descriptionSource, label, true);
  if (own(n, 'level')) {
    if (n.level !== null && (typeof n.level !== 'number' || !Number.isFinite(n.level)))
      invalid(`${label} has an invalid level.`);
    result.level = n.level as number | null;
  }
  if (own(n, 'oNetTask')) {
    if (n.oNetTask !== null && typeof n.oNetTask !== 'boolean') invalid(`${label} has an invalid source flag.`);
    result.oNetTask = n.oNetTask as boolean | null;
  }
  return result;
}

function inverse(
  nodeIds: Iterable<string>, links: ReadonlyMap<string, Iterable<string>>,
): Map<string, string[]> {
  const result = new Map(Array.from(nodeIds, (v) => [v, [] as string[]]));
  links.forEach((targets, owner) => {
    for (const target of targets) {
      const row = result.get(target);
      if (!row) invalid('The frozen graph references a missing node.');
      row.push(owner);
    }
  });
  return result;
}

function acyclic(
  nodeIds: Iterable<string>, parents: ReadonlyMap<string, Iterable<string>>, label: string,
) {
  const all = Array.from(nodeIds);
  const counts = new Map(all.map((v) => [v, Array.from(parents.get(v) || []).length]));
  const children = inverse(all, parents);
  const queue = all.filter((v) => counts.get(v) === 0);
  let visited = 0;
  for (let i = 0; i < queue.length; i++) {
    visited++;
    for (const child of children.get(queue[i]) || []) {
      const remaining = counts.get(child)! - 1;
      counts.set(child, remaining);
      if (remaining === 0) queue.push(child);
    }
  }
  if (visited !== all.length) invalid(`${label} contains a Generalization cycle.`);
}

/** Collection links are flattened across collections without losing independent
 * parents. Flat legacy references remain supported. Supplied directions and
 * adjacency representations must agree; no graph repair or live lookup occurs. */
function parseGraph(file: PinnedFile): BranchSourceGraph {
  const raw = json(file, 'Frozen source graph');
  const root = Array.isArray(raw) ? {} : record(raw, 'Frozen source graph');
  const nodeData = Array.isArray(raw) ? raw : root.nodes;
  const entries: [string | undefined, unknown][] = Array.isArray(nodeData)
    ? nodeData.map((n) => [undefined, n])
    : Object.entries(record(nodeData, 'Frozen graph nodes'));
  const rows = new Map<string, Record<string, unknown>>();
  const nodes = new Map<string, RelationshipNode>();
  entries.forEach(([key, value]) => {
    const row = record(value, 'Frozen graph node');
    if (typeof row.oNetTask !== 'boolean') invalid('Every frozen node must have a boolean oNetTask flag.');
    const normalized: Record<string, unknown> = { ...row, id: own(row, 'id') ? row.id : key };
    delete normalized.descriptionSource;
    const properties = own(row, 'properties') ? record(row.properties, 'Frozen node properties') : undefined;
    if (properties && own(properties, 'description')) {
      normalized.description = text(properties.description, 'Frozen properties.description', true);
      normalized.descriptionSource = 'properties.description';
    } else if (own(row, 'description')) {
      normalized.descriptionSource = 'description';
    }
    const n = nodeShape(normalized, 'Frozen graph node', false);
    if ((key !== undefined && key !== n.id) || nodes.has(n.id))
      invalid('The frozen graph contains duplicate or inconsistent node IDs.');
    rows.set(n.id, row);
    nodes.set(n.id, Object.freeze(n));
  });
  if (!nodes.size) invalid('The frozen graph is empty.');
  const reference = (value: unknown, owner: string): string => {
    const r = typeof value === 'string' ? undefined : record(value, 'Frozen graph reference');
    if (r) keys(r, ['id', 'title'], 'Frozen graph reference');
    const target = id(r ? r.id : value, 'Frozen graph reference');
    if (target === owner) invalid('The frozen graph contains a self link.');
    const node = nodes.get(target);
    if (!node) invalid('The frozen graph references a missing node.');
    if (r && own(r, 'title') && text(r.title, 'Frozen reference title') !== node.title)
      invalid('A frozen reference title differs from its target.');
    return target;
  };
  const refs = (value: unknown, owner: string): string[] => {
    const result = new Set<string>();
    const flat = new Set<string>();
    array(value, 'Frozen graph links').forEach((v) => {
      const r = typeof v === 'string' ? undefined : record(v, 'Frozen graph link');
      if (r && own(r, 'nodes')) {
        keys(r, ['collectionName', 'nodes'], 'Frozen graph collection');
        text(r.collectionName, 'Frozen collection name');
        const within = new Set<string>();
        array(r.nodes, 'Frozen collection nodes').forEach((entry) => {
          const target = reference(entry, owner);
          if (within.has(target)) invalid('A frozen collection contains duplicate link IDs.');
          within.add(target);
          result.add(target);
        });
      } else {
        const target = reference(v, owner);
        if (flat.has(target)) invalid('The frozen graph contains duplicate flat link IDs.');
        flat.add(target);
        result.add(target);
      }
    });
    return Array.from(result);
  };
  const relationships = (field: string, alias: string): Map<string, string[]> | undefined => {
    const candidates: Map<string, string[]>[] = [];
    for (const name of [field, alias]) {
      if (!own(root, name)) continue;
      const table = record(root[name], 'Frozen graph adjacency table');
      Object.keys(table).forEach((v) => {
        if (!isSafeBranchNodeId(v) || !nodes.has(v)) invalid('A frozen adjacency table has a missing owner ID.');
      });
      candidates.push(new Map(Array.from(nodes.keys(), (v) => [v, own(table, v) ? refs(table[v], v) : []])));
    }
    if (Array.from(rows.values()).some((row) => own(row, field) || own(row, alias))) {
      const local = new Map<string, string[]>();
      rows.forEach((row, owner) => {
        const a = own(row, field) ? refs(row[field], owner) : undefined;
        const b = own(row, alias) ? refs(row[alias], owner) : undefined;
        if (a && b) sameIds(a, b, 'Frozen graph adjacency aliases');
        local.set(owner, a || b || []);
      });
      candidates.push(local);
    }
    candidates.slice(1).forEach((candidate) => {
      nodes.forEach((_, v) => sameIds(candidate.get(v)!, candidates[0].get(v)!, 'Frozen graph adjacency representations'));
    });
    return candidates[0];
  };
  let parents = relationships('generalizations', 'parents');
  let children = relationships('specializations', 'children');
  if (!parents && !children) invalid('The frozen graph has no supported Generalization adjacency.');
  if (!parents) parents = inverse(nodes.keys(), children!);
  const derivedChildren = inverse(nodes.keys(), parents);
  if (children) nodes.forEach((_, v) => sameIds(children!.get(v)!, derivedChildren.get(v)!, 'Frozen graph reciprocal links'));
  else children = derivedChildren;
  acyclic(nodes.keys(), parents, 'The frozen graph');
  parents.forEach((row) => Object.freeze(row));
  children.forEach((row) => Object.freeze(row));
  return { sha256: file.sha256, nodes, parents, children };
}

function sourceFile(manifest: BranchPackageManifest): { file: PinnedFile; graph: BranchSourceGraph } {
  const file = readFile(['src', 'lib', 'relationshipReview', 'data', manifest.sourceGraph.directory,
    'source-graph.json'], 'Frozen source graph', 128 * 1024 * 1024, manifest.sourceSha256,
    'branch_source_pin_mismatch', 'branch_source_unavailable');
  try {
    return { file, graph: parseGraph(file) };
  } catch (error) {
    if (error instanceof RelationshipError && error.code === 'branch_package_invalid')
      throw new RelationshipError(503, error.message, 'branch_source_invalid');
    throw error;
  }
}

/** Reads and hashes the frozen bytes on EVERY call, including parsed cache hits. */
export function getBranchSourceGraph(expectedSourceSha256: string, version?: string): BranchSourceGraph {
  const { file: manifestPin, manifest } = manifestFile(version);
  if (expectedSourceSha256 !== manifest.sourceSha256)
    invalid('The requested context source does not match the branch source pin.', 'branch_source_pin_mismatch');
  const source = sourceFile(manifest);
  commitPins([manifestPin, source.file]);
  return source.graph;
}

function validateDataset(value: unknown, manifest: BranchPackageManifest, graph: BranchSourceGraph): BranchDataset {
  const d = record(value, 'Branch dataset');
  keys(d, ['schemaVersion', 'version', 'title', 'createdAt', 'model', 'modelVersion', 'reasoning',
    'fundingRoute', ...SOURCE_KEYS, 'scopeNote', 'titleStatusNote', 'nounNote', 'prompt',
    'criticPrompts', 'families'], 'Branch dataset');
  if (d.schemaVersion !== 'generalization-branch-review-v1' || d.version !== manifest.version)
    invalid('The branch dataset schema or version does not match its manifest.');
  const correctModel = (d.model === 'GPT-6.1 Sol' || d.model === 'gpt-6.1-sol') &&
    d.modelVersion === '2026-09-29';
  if (!correctModel || d.reasoning !== 'max' || d.fundingRoute !== 'ACCESS')
    invalid('Branch model, maximum reasoning or ACCESS funding provenance is incorrect.');
  ['title', 'sourceApp', 'scopeNote', 'titleStatusNote', 'nounNote', 'prompt'].forEach((k) => text(d[k], k));
  if (hash(d.sourceSha256, 'Dataset source hash') !== manifest.sourceSha256 || graph.sha256 !== d.sourceSha256)
    invalid('The dataset does not match the frozen source pin.', 'branch_source_pin_mismatch');
  id(d.priorDatasetVersion, 'Prior dataset version');
  hash(d.priorDatasetSha256, 'Prior dataset hash');
  const captured = timestamp(d.sourceCapturedAt, 'Source capture');
  const rechecked = timestamp(d.sourceRecheckedAt, 'Source recheck');
  const created = timestamp(d.createdAt, 'Dataset creation');
  if (captured > rechecked || rechecked > created) invalid('Branch provenance timestamps are out of order.');
  if (strings(d.criticPrompts, 'Critic prompts').length !== 2) invalid('Exactly two critic prompt templates are required.');
  let prior: ReturnType<typeof getRelationshipDataset>;
  try { prior = getRelationshipDataset(d.priorDatasetVersion as string); }
  catch { invalid('The pinned prior review package is unavailable.', 'branch_legacy_pin_mismatch'); }
  if (prior.sha256 !== d.priorDatasetSha256 || prior.dataset.version !== d.priorDatasetVersion ||
      prior.dataset.sourceSha256 !== d.sourceSha256 || prior.dataset.sourceApp !== d.sourceApp ||
      prior.dataset.sourceCapturedAt !== d.sourceCapturedAt ||
      prior.dataset.cases.length !== (manifest.priorCases ?? BRANCH_PRIOR_CASE_COUNT))
    invalid('The pinned prior cohort or its source provenance does not match.', 'branch_legacy_pin_mismatch');
  const cohort = new Set<string>();
  const expectedGroupIds = new Set<string>();
  const priorCasesByGroup = new Map<string, Set<string>>();
  prior.dataset.cases.forEach((c) => {
    const v = id(c.id, 'Prior cohort case');
    if (cohort.has(v) || !graph.nodes.has(v)) invalid('The pinned prior cohort has duplicate or missing graph IDs.');
    cohort.add(v);
    c.analysis.proposedParents.forEach((p) => {
      const parentId = id(p.nodeId, 'Prior proposed Generalization');
      const parent = graph.nodes.get(parentId);
      if (!parent || parent.oNetTask === true)
        invalid('The pinned prior cohort proposes a missing or non-activity frozen graph ID.', 'branch_legacy_pin_mismatch');
      expectedGroupIds.add(parentId);
      const caseIds = priorCasesByGroup.get(parentId) || new Set<string>();
      caseIds.add(v);
      priorCasesByGroup.set(parentId, caseIds);
    });
  });
  const checkNode = (v: unknown): RelationshipNode => {
    const n = nodeShape(v, 'Supplied relationship node');
    const frozen = graph.nodes.get(n.id);
    if (!frozen) invalid('A supplied relationship node is missing from the frozen graph.');
    NODE_KEYS.forEach((key) => {
      if (own(n, key) !== own(frozen, key) ||
          n[key as keyof RelationshipNode] !== frozen[key as keyof RelationshipNode])
        invalid('A supplied node differs from its frozen source record.');
    });
    return n;
  };
  const checkNodes = (v: unknown, expected: readonly string[], label: string) => {
    const actual = array(v, label).map((n) => checkNode(n).id);
    sameIds(actual, expected, label);
  };
  const sources = (owner: string) => (graph.children.get(owner) || []).filter((v) => graph.nodes.get(v)!.oNetTask === true);
  const activities = (owner: string) => (graph.children.get(owner) || []).filter((v) => graph.nodes.get(v)!.oNetTask !== true);
  const families = array(d.families, 'Branch families');
  if (families.length !== manifest.families) invalid('The branch package must retain every manifest-pinned family.');
  const reviewIds = new Set<string>();
  families.forEach((v) => {
    const familyId = id(record(v, 'Branch family').id, 'Branch family');
    if (reviewIds.has(familyId)) invalid('The branch dataset contains duplicate family IDs.');
    reviewIds.add(familyId);
  });
  const candidateIds = new Set<string>();
  const retainedCases = new Set<string>();
  const proposedParents = new Map(Array.from(graph.parents, ([v, row]) => [v, new Set(row)]));
  let groupCount = 0;
  families.forEach((v) => {
    const f = record(v, 'Branch family');
    keys(f, ['id', 'title', 'description', 'generalizations', 'currentSpecializations',
      'currentSourceRecords', 'summary', 'scopeNote', 'groups', 'sourceCaseIds', 'remainingQuestions'], 'Branch family');
    const familyId = id(f.id, 'Branch family');
    const root = graph.nodes.get(familyId);
    if (!root || root.oNetTask === true) invalid('A family root must be a frozen activity node.');
    ['title', 'summary', 'scopeNote'].forEach((k) => text(f[k], k));
    text(f.description, 'Family description', true);
    if (f.title !== root.title || f.description !== (root.description ?? ''))
      invalid('A family title or description differs from its frozen root.');
    strings(f.remainingQuestions, 'Family remaining questions');
    checkNodes(f.generalizations, graph.parents.get(familyId)!, 'Family Generalizations');
    const currentSpecializations = activities(familyId);
    checkNodes(f.currentSpecializations, currentSpecializations, 'Complete current activity Specializations');
    checkNodes(f.currentSourceRecords, sources(familyId), 'Complete current source records');
    const sourceCases = ids(f.sourceCaseIds, 'Family source cases');
    if (!sourceCases.length || sourceCases.some((c) => !cohort.has(c)))
      invalid('A family references cases outside the pinned prior cohort.');
    const expectedCaseIds = new Set<string>();
    const retainedFamilyCases = new Set<string>();
    currentSpecializations.forEach((caseId) => {
      if (cohort.has(caseId)) {
        expectedCaseIds.add(caseId);
        retainedFamilyCases.add(caseId);
      }
    });
    const groups = array(f.groups, 'Branch groups');
    if (!groups.length) invalid('A branch family has no candidate subgroup arrangement.');
    groups.forEach((value) => {
      groupCount++;
      const g = record(value, 'Branch group');
      keys(g, ['id', 'node', 'summary', 'coherence', 'eligible', 'members', 'remainingQuestions'], 'Branch group');
      const groupId = id(g.id, 'Branch group');
      if (reviewIds.has(groupId)) invalid('The branch dataset contains duplicate review IDs.');
      reviewIds.add(groupId);
      const parent = checkNode(g.node);
      if (parent.id === familyId || parent.oNetTask === true || candidateIds.has(parent.id) ||
          !expectedGroupIds.has(parent.id))
        invalid('Candidate subgroup IDs must uniquely cover the pinned prior proposed Generalizations.');
      if (groupId !== parent.id) invalid('A group ID must be its real frozen Generalization ID.');
      candidateIds.add(parent.id);
      const priorGroupCaseIds = priorCasesByGroup.get(parent.id)!;
      priorGroupCaseIds.forEach((caseId) => expectedCaseIds.add(caseId));
      const currentGroupSpecializations = new Set<string>(activities(parent.id));
      text(g.summary, 'Group summary');
      text(g.coherence, 'Group coherence');
      strings(g.remainingQuestions, 'Group remaining questions');
      if (typeof g.eligible !== 'boolean') invalid('Group eligibility must be boolean.');
      const memberIds = new Set<string>();
      let included = 0;
      array(g.members, 'Group members').forEach((value) => {
        const m = record(value, 'Branch member');
        keys(m, ['node', 'decision', 'reason', 'titleDependency', 'currentGeneralizations',
          'nounEvidenceNote', 'sourceRecords'], 'Branch member');
        const member = checkNode(m.node);
        if (memberIds.has(member.id)) invalid('A subgroup contains duplicate candidate member IDs.');
        memberIds.add(member.id);
        if (member.oNetTask !== false) invalid('A candidate activity must not be an O*Net source record.');
        if (cohort.has(member.id)) {
          retainedFamilyCases.add(member.id);
          if (currentGroupSpecializations.has(member.id)) expectedCaseIds.add(member.id);
        }
        if (!['include', 'hold', 'exclude'].includes(String(m.decision)) || typeof m.decision !== 'string')
          invalid('A member has an invalid raw decision.');
        if (!['none-observed', 'recheck-after-title-change', 'requires-title-clarification'].includes(String(m.titleDependency)) ||
            typeof m.titleDependency !== 'string') invalid('A member has an invalid title dependency.');
        text(m.reason, 'Member reason');
        text(m.nounEvidenceNote, 'Member noun evidence');
        checkNodes(m.currentGeneralizations, graph.parents.get(member.id)!, 'Complete independent member Generalizations');
        checkNodes(m.sourceRecords, sources(member.id), 'Complete member source records');
        if (m.decision === 'include') {
          included++;
          if (g.eligible) {
            if (member.id === parent.id || member.id === familyId ||
                m.titleDependency === 'requires-title-clarification')
              invalid('An eligible placement is self-referential, a source task or still title-dependent.');
            proposedParents.get(member.id)!.add(parent.id);
          }
        }
      });
      priorGroupCaseIds.forEach((caseId) => {
        if (!memberIds.has(caseId))
          invalid('A candidate subgroup omits an original child activity proposed for it in the pinned prior cohort.');
      });
      if (g.eligible) {
        if (!included) invalid('An eligible subgroup has no included members.');
        proposedParents.get(parent.id)!.add(familyId);
      }
    });
    sameIds(sourceCases, Array.from(expectedCaseIds), 'Family retained prior candidate provenance');
    sameIds(Array.from(retainedFamilyCases), Array.from(expectedCaseIds), 'Family retained prior candidate scope');
    retainedFamilyCases.forEach((v) => retainedCases.add(v));
  });
  if (groupCount !== manifest.groups || candidateIds.size !== manifest.groups)
    invalid('The branch package must retain every distinct manifest-pinned candidate subgroup.');
  sameIds(Array.from(candidateIds), Array.from(expectedGroupIds), 'Complete pinned prior proposed Generalizations');
  sameIds(Array.from(retainedCases), Array.from(cohort), 'Complete retained prior candidates');
  // Existing edges are retained in the union. Nothing here writes ontology data.
  acyclic(graph.nodes.keys(), proposedParents, 'Eligible proposed placements plus the frozen graph');
  return d as unknown as BranchDataset;
}

function sameText(a: readonly string[], b: readonly string[], label: string) {
  if (a.length !== b.length || a.some((v, i) => v !== b[i])) invalid(`${label} differs from the raw output.`);
}

function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((v, i) => jsonEqual(v, b[i]));
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(b)) return false;
  const x = record(a, 'Compared JSON');
  const y = record(b, 'Compared JSON');
  return Object.keys(x).length === Object.keys(y).length &&
    Object.keys(x).every((k) => own(y, k) && jsonEqual(x[k], y[k]));
}

function textObject(value: string, label: string): Record<string, unknown> {
  try {
    const s = text(value, label);
    const result: unknown = JSON.parse(s);
    rejectDuplicateKeys(s, label);
    return record(result, label);
  } catch (error) {
    if (error instanceof RelationshipError) throw error;
    invalid(`${label} is not valid JSON.`);
  }
}

export function isBranchReviewModel(value: unknown): boolean {
  return value === 'gpt-6.1-sol' || value === 'gpt-6-1-sol-society-of-mind';
}

function providerOutput(result: Record<string, unknown>): Record<string, unknown> {
  const chunks: string[] = [];
  array(result.output, 'Provider output').forEach((v) => {
    const item = record(v, 'Provider output item');
    if (own(item, 'status') && item.status !== 'completed') invalid('A provider output item is incomplete.');
    if (!own(item, 'content')) return;
    array(item.content, 'Provider output content').forEach((v) => {
      const part = record(v, 'Provider output content');
      if (part.type === 'output_text') chunks.push(text(part.text, 'Provider output text', true));
      if (part.type === 'refusal') invalid('A completed review contains a refusal instead of a review.');
    });
  });
  return textObject(chunks.join(''), 'Decoded model output');
}

export function authorIds(value: unknown, resolve: (v: unknown) => string): Record<string, unknown> {
  const out = record(value, 'Author output');
  keys(out, ['familyId', 'summary', 'titleStatusNote', 'groups', 'familyLevelIssues',
    'preferredReviewOrder'], 'Author output');
  text(out.summary, 'Author summary');
  text(out.titleStatusNote, 'Author title status note');
  strings(out.familyLevelIssues, 'Author family-level issues');
  return { ...out, familyId: resolve(out.familyId),
    preferredReviewOrder: array(out.preferredReviewOrder, 'Preferred review order').map(resolve),
    groups: array(out.groups, 'Author groups').map((v) => {
      const g = record(v, 'Author group');
      keys(g, ['generalizationId', 'summary', 'coherence', 'memberDecisions', 'remainingQuestions'], 'Author group');
      text(g.summary, 'Author group summary');
      text(g.coherence, 'Author group coherence');
      strings(g.remainingQuestions, 'Author group remaining questions');
      return { ...g, generalizationId: resolve(g.generalizationId),
        memberDecisions: array(g.memberDecisions, 'Author member decisions').map((v) => {
          const m = record(v, 'Author member decision');
          keys(m, ['activityId', 'decision', 'reason', 'titleDependency',
            'otherCurrentGeneralizationIds', 'nounEvidenceNote'], 'Author member decision');
          return { ...m, activityId: resolve(m.activityId),
            otherCurrentGeneralizationIds: array(m.otherCurrentGeneralizationIds, 'Other current Generalizations').map(resolve) };
        }) };
    }) };
}

export function criticIds(value: unknown, resolve: (v: unknown) => string): Record<string, unknown> {
  const out = record(value, 'Critic output');
  keys(out, ['familyId', 'verdict', 'summary', 'groups', 'familyLevelIssues'], 'Critic output');
  const verdict = text(out.verdict, 'Critic family verdict');
  if (verdict !== 'supported' && verdict !== 'needs-discussion')
    invalid('A critic has an invalid family verdict.');
  text(out.summary, 'Critic summary');
  strings(out.familyLevelIssues, 'Critic family-level issues');
  return { ...out, familyId: resolve(out.familyId), groups: array(out.groups, 'Critic groups').map((v) => {
    const g = record(v, 'Critic group');
    return { ...g, generalizationId: resolve(g.generalizationId),
      memberAudits: array(g.memberAudits, 'Critic member audits').map((v) => {
        const m = record(v, 'Critic member audit');
        return { ...m, activityId: resolve(m.activityId) };
      }) };
  }) };
}

export function criticGroupReceipt(value: unknown): {
  supported: boolean; unresolvedMaterialObjections: string[];
} {
  const group = record(value, 'Critic group');
  keys(group, ['generalizationId', 'verdict', 'reason', 'memberAudits', 'materialObjections'], 'Critic group');
  id(group.generalizationId, 'Critic Generalization');
  const verdict = text(group.verdict, 'Critic group verdict');
  if (verdict !== 'supported' && verdict !== 'needs-discussion')
    invalid('A critic has an invalid group verdict.');
  text(group.reason, 'Critic group reason');
  // Receipt: literal group materialObjections, then issue for each supported:false audit
  // in saved memberAudits order. Preserve duplicates; omit family issues and supported:true prose.
  // All omitted prose remains visible in the untouched raw trace.
  const objections = [...strings(group.materialObjections, 'Critic group material objections')];
  let allMembersSupported = true;
  array(group.memberAudits, 'Critic member audits').forEach((value) => {
    const audit = record(value, 'Critic member audit');
    keys(audit, ['activityId', 'supported', 'issue'], 'Critic member audit');
    id(audit.activityId, 'Critic activity');
    if (typeof audit.supported !== 'boolean')
      invalid('A critic member audit must have a boolean supported flag.');
    const issue = text(audit.issue, 'Critic member issue');
    if (audit.supported === false) {
      allMembersSupported = false;
      objections.push(issue);
    }
  });
  return {
    supported: verdict === 'supported' && allMembersSupported && objections.length === 0,
    unresolvedMaterialObjections: objections,
  };
}

function usageCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    invalid('Provider usage must contain nonnegative safe integer token counts.');
  return value;
}

function usageTree(value: unknown): void {
  if (typeof value === 'number') { usageCount(value); return; }
  Object.values(record(value, 'Provider usage details')).forEach(usageTree);
}

function reviewInput(request: Record<string, unknown>): Record<string, unknown> {
  // Responses accepts a direct input string as well as typed user messages.
  // Decode the saved body as submitted; never rewrite raw provider provenance.
  if (typeof request.input === 'string')
    return textObject(request.input, 'Final private review input');
  const input = array(request.input, 'Exact request input');
  const last = record(input[input.length - 1], 'Final review input');
  if (last.role !== 'user') invalid('The final private review data message must be a user message.');
  const chunks = array(last.content, 'Final review input content').map((v) => {
    const part = record(v, 'Final review input content');
    if (part.type !== 'input_text') invalid('The final private review data message must contain JSON input_text.');
    return text(part.text, 'Final review input text', true);
  });
  return textObject(chunks.join(''), 'Final private review input');
}

function validateNounJoin(value: unknown, family: BranchFamily, graph: BranchSourceGraph): Record<string, unknown> {
  const join = record(value, 'Final noun source join');
  keys(join, ['method', 'rows', 'unmatchedSourceIds'], 'Final noun source join');
  if (join.method !== 'exact-full-description-nfc-whitespace-v1')
    invalid('Only the final exact-description noun source join is permitted.');
  const expected = new Set<string>();
  const owners = [family.id, ...family.groups.flatMap((g) => [g.node.id, ...g.members.map((m) => m.node.id)])];
  owners.forEach((owner) => (graph.children.get(owner) || []).forEach((v) => {
    if (graph.nodes.get(v)!.oNetTask === true) expected.add(v);
  }));
  const matched = new Set<string>();
  const locators = new Set<string>();
  const normalize = (s: string) => s.normalize('NFC').replace(/\s+/g, ' ').trim();
  array(join.rows, 'Noun join rows').forEach((v) => {
    const row = record(v, 'Noun join row');
    keys(row, ['sourceId', 'sourceField', 'sourceFullDescription', 'sheetFullDescription', 'workbook', 'sheet', 'row'], 'Noun join row');
    const sourceId = id(row.sourceId, 'Original noun source ID');
    const node = graph.nodes.get(sourceId);
    if (!node || node.oNetTask !== true || !expected.has(sourceId)) invalid('A noun join references an unrelated or missing source record.');
    const field = text(row.sourceField, 'Noun source field');
    // Strip only the documented imported display prefix; never use its number as a task ID.
    const full = field === 'title' ? node.title.replace(/^\(O\*Net\)\s+\S+\s+-\s+/, '') :
      field === node.descriptionSource && ['properties.description', 'description'].includes(field) ? node.description : undefined;
    const original = text(row.sourceFullDescription, 'Original full source description');
    const sheetDescription = text(row.sheetFullDescription, 'Original full sheet description');
    if (full === undefined || original !== full || normalize(original) !== normalize(sheetDescription))
      invalid('A noun join is not an exact full-description NFC/whitespace match.');
    const workbook = text(row.workbook, 'Original workbook locator');
    const sheet = text(row.sheet, 'Original sheet locator');
    const sheetRow = usageCount(row.row);
    if (sheetRow < 1) invalid('A noun join must retain a positive original sheet row locator.');
    const locator = JSON.stringify([sourceId, workbook, sheet, sheetRow]);
    if (locators.has(locator)) invalid('A noun join contains a duplicate source/row locator.');
    locators.add(locator);
    matched.add(sourceId);
  });
  const unmatched = ids(join.unmatchedSourceIds, 'Unmatched noun source IDs');
  if (unmatched.some((v) => matched.has(v))) invalid('A noun source is both matched and unmatched.');
  sameIds([...matched, ...unmatched], [...expected], 'Complete noun source join provenance');
  return join;
}

function validateTrace(
  value: unknown, dataset: BranchDataset, family: BranchFamily, graph: BranchSourceGraph,
  responseIds: Set<string>,
): BranchFamilyTrace {
  const t = record(value, 'Private family trace');
  keys(t, ['schemaVersion', 'familyId', 'datasetVersion', 'fundingRoute', 'source',
    'promptProvenance', 'author', 'critics'], 'Private family trace');
  if (t.schemaVersion !== 'private-generalization-branch-trace-v1' || t.familyId !== family.id ||
      t.datasetVersion !== dataset.version || t.fundingRoute !== 'ACCESS')
    invalid('A private trace has incorrect family, version or funding provenance.');
  const source = record(t.source, 'Trace source provenance');
  keys(source, [...SOURCE_KEYS, 'sourceCaseIds'], 'Trace source provenance');
  SOURCE_KEYS.forEach((k) => {
    if (source[k] !== dataset[k as keyof BranchDataset]) invalid('A trace differs from the pinned source or prior dataset provenance.');
  });
  sameIds(ids(source.sourceCaseIds, 'Trace source cases'), family.sourceCaseIds, 'Trace source cases');
  const provenance = record(t.promptProvenance, 'Private prompt provenance');
  const nounJoin = validateNounJoin(provenance.nounSourceJoin, family, graph);
  const groups = new Map(family.groups.map((g) => [g.id, g]));
  const requiredAliases = new Set([family.id, ...family.groups.flatMap((g) => [g.node.id,
    ...g.members.flatMap((m) => [m.node.id, ...m.currentGeneralizations.map((n) => n.id)])])]);
  const validateRun = (value: unknown): { completed: boolean; coverage: Map<string, BranchTraceCoverage> } => {
    const run = record(value, 'Author or critic trace');
    keys(run, ['status', 'request', 'result', 'aliasMap', 'coverage'], 'Author or critic trace');
    if (!['completed', 'pending', 'failed'].includes(String(run.status)) || typeof run.status !== 'string')
      invalid('A trace run has an invalid completion status.');
    if (run.request !== null) {
      const request = record(run.request, 'Exact model request');
      if (!isBranchReviewModel(request.model) || record(request.reasoning, 'Request reasoning').effort !== 'max')
        invalid('A raw model request does not attest GPT-6.1 Sol with maximum reasoning.');
    } else if (run.status !== 'pending') invalid('A submitted trace is missing its exact request.');
    if (run.result !== null) record(run.result, 'Exact model result');
    const completed = run.status === 'completed';
    if (completed) {
      const result = record(run.result, 'Completed model result');
      if (result.status !== 'completed') invalid('A completed trace has no completed provider result.');
      if (own(result, 'model') && !isBranchReviewModel(result.model)) invalid('A provider result has inconsistent model provenance.');
      const responseId = text(result.id, 'Provider response ID');
      if (responseIds.has(responseId)) invalid('An author or critic provider result was reused.');
      responseIds.add(responseId);
    } else if (run.result !== null && record(run.result, 'Model result').status === 'completed') {
      invalid('A trace completion receipt conflicts with its provider result.');
    }
    if (run.status === 'pending' && run.result !== null) invalid('A pending trace must not invent a result.');
    const aliases = record(run.aliasMap, 'Original alias map');
    const aliasValues = Object.entries(aliases).map(([alias, v]) => {
      id(alias, 'Original alias');
      const nodeId = id(v, 'Original alias target');
      if (!graph.nodes.has(nodeId)) invalid('An original alias references a missing frozen node.');
      return nodeId;
    });
    if (new Set(aliasValues).size !== aliasValues.length) invalid('An original alias map is not one-to-one.');
    if (completed && Array.from(requiredAliases).some((v) => !aliasValues.includes(v)))
      invalid('A completed trace is missing original aliases for reviewed candidates.');
    const coverage = new Map<string, BranchTraceCoverage>();
    array(run.coverage, 'Trace coverage').forEach((value) => {
      const row = record(value, 'Trace coverage receipt');
      keys(row, ['groupId', 'memberIds', 'unresolvedMaterialObjections'], 'Trace coverage receipt');
      const groupId = id(row.groupId, 'Trace group');
      const group = groups.get(groupId);
      if (!group || coverage.has(groupId)) invalid('Trace coverage contains an unknown or duplicate group ID.');
      const memberIds = ids(row.memberIds, 'Trace member coverage');
      const expected = group.members.map((m) => m.node.id);
      if (completed) sameIds(memberIds, expected, 'Completed trace member coverage');
      else if (memberIds.some((v) => !expected.includes(v))) invalid('Partial trace coverage contains an unknown member.');
      const objections = strings(row.unresolvedMaterialObjections, 'Unresolved material objections');
      coverage.set(groupId, { groupId, memberIds, unresolvedMaterialObjections: objections });
    });
    if (completed) sameIds(Array.from(coverage.keys()), Array.from(groups.keys()), 'Completed trace group coverage');
    if (run.status === 'pending' && coverage.size) invalid('A pending critic must not invent judgments.');
    return { completed, coverage };
  };
  const critics = array(t.critics, 'Two critic traces');
  if (critics.length !== 2) invalid('Exactly two independent critic traces are required.');
  // Producer-only proof derived from the actual saved crosswalk, never model output:
  // {method:'exact-full-description-nfc-whitespace-v1',rows:[{sourceId,sourceField,sourceFullDescription,sheetFullDescription,workbook,sheet,row}],unmatchedSourceIds:[]}.
  // Model input separately uses context.nounCrosswalk.version='exact-source-description-crosswalk-v2'.
  // Recorded encoding may describe lossless dictionary/grouping of nounAssignments; do not impose an older table layout.
  if (array(nounJoin.unmatchedSourceIds, 'Unmatched noun source IDs').length)
    invalid('The final noun source proof must have no unmatched sources.');

  const decodeRun = (value: unknown) => {
    const run = record(value, 'Author or critic trace');
    const checked = validateRun(run);
    const aliases = record(run.aliasMap, 'Original alias map');
    const resolve = (value: unknown): string => {
      const alias = id(value, 'Raw model alias');
      if (!own(aliases, alias)) invalid('A raw model ID is absent from its original alias map.');
      return id(aliases[alias], 'Resolved model ID');
    };
    const input = run.request === null ? null : reviewInput(record(run.request, 'Exact model request'));
    if (input !== null) {
      keys(input, ['encoding', 'context', 'projectionLimits', 'author'], 'Final private review input');
      if (!own(input, 'encoding') || input.encoding === null ||
          !own(input, 'projectionLimits') || input.projectionLimits === null)
        invalid('The exact review input must retain its encoding and projection limits.');
      if (typeof input.encoding === 'string') text(input.encoding, 'Recorded input encoding');
      const context = record(input.context, 'Exact model input context');
      if (record(context.nounCrosswalk, 'Exact model input noun crosswalk').version !==
          'exact-source-description-crosswalk-v2')
        invalid('The model request does not contain the corrected exact-description noun crosswalk.');
    }
    let output: Record<string, unknown> | null = null;
    if (checked.completed) {
      const result = record(run.result, 'Completed model result');
      if (!isBranchReviewModel(result.model) ||
          (own(result, 'reasoning') && record(result.reasoning, 'Result reasoning').effort !== 'max') ||
          (own(result, 'error') && result.error !== null) ||
          (own(result, 'incomplete_details') && result.incomplete_details !== null))
        invalid('A provider response has incorrect completed deployment provenance.');
      const responseTime = usageCount(result.created_at) * 1000;
      if (!Number.isSafeInteger(responseTime) ||
          responseTime < Date.parse(`${dataset.modelVersion}T00:00:00Z`) ||
          responseTime < timestamp(dataset.sourceCapturedAt, 'Source capture') ||
          responseTime > timestamp(dataset.createdAt, 'Dataset creation'))
        invalid('A provider response date is outside the pinned deployment and release.');
      const usage = record(result.usage, 'Completed provider usage');
      usageTree(usage);
      const inputTokens = usageCount(usage.input_tokens);
      const outputTokens = usageCount(usage.output_tokens);
      const totalTokens = usageCount(usage.total_tokens);
      if (!inputTokens || !outputTokens || !Number.isSafeInteger(inputTokens + outputTokens) ||
          totalTokens !== inputTokens + outputTokens)
        invalid('Completed provider usage has inconsistent token totals.');
      if (own(usage, 'input_tokens_details')) {
        const details = record(usage.input_tokens_details, 'Input token details');
        const cached = own(details, 'cached_tokens') ? usageCount(details.cached_tokens) : 0;
        const cacheWrite = own(details, 'cache_write_tokens') ? usageCount(details.cache_write_tokens) : 0;
        const cacheTokens = cached + cacheWrite;
        if (!Number.isSafeInteger(cacheTokens) || cacheTokens > inputTokens)
          invalid('Cached plus cache-write token usage exceeds input token usage.');
      }
      if (own(usage, 'output_tokens_details')) {
        const details = record(usage.output_tokens_details, 'Output token details');
        if (own(details, 'reasoning_tokens') && usageCount(details.reasoning_tokens) > outputTokens)
          invalid('Reasoning token usage exceeds output token usage.');
      }
      output = providerOutput(result);
    } else if (run.result !== null) {
      const result = record(run.result, 'Incomplete model result');
      if (own(result, 'id')) {
        const responseId = text(result.id, 'Provider response ID');
        if (responseIds.has(responseId)) invalid('An author or critic provider result was reused.');
        responseIds.add(responseId);
      }
    }
    return { ...checked, input, output, resolve };
  };
  const author = decodeRun(t.author);
  const reviewers = critics.map(decodeRun);
  const authored = author.output === null ? null : authorIds(author.output, author.resolve);
  const authorObjections = new Map<string, string[]>();
  if (authored !== null) {
    if (authored.familyId !== family.id) invalid('The raw author reviewed a different family.');
    const order = ids(authored.preferredReviewOrder, 'Author preferred review order');
    if (order.some((v) => !groups.has(v))) invalid('The author review order contains an unrelated group.');
    const familyIssues = strings(authored.familyLevelIssues, 'Author family-level issues');
    sameText(familyIssues, family.remainingQuestions, 'Family remaining questions');
    const rawGroups = array(authored.groups, 'Decoded author groups').map((v) => record(v, 'Decoded author group'));
    sameIds(rawGroups.map((g) => id(g.generalizationId, 'Author Generalization')),
      Array.from(groups.keys()), 'Raw author group coverage');
    rawGroups.forEach((rawGroup) => {
      const groupId = id(rawGroup.generalizationId, 'Author Generalization');
      const group = groups.get(groupId)!;
      const questions = strings(rawGroup.remainingQuestions, 'Author group remaining questions');
      sameText(questions, group.remainingQuestions, 'Group remaining questions');
      const decisions = array(rawGroup.memberDecisions, 'Decoded author member decisions')
        .map((v) => record(v, 'Decoded author member decision'));
      sameIds(decisions.map((m) => id(m.activityId, 'Author activity')),
        group.members.map((m) => m.node.id), 'Raw author complete member coverage');
      const members = new Map(group.members.map((m) => [m.node.id, m]));
      decisions.forEach((decision) => {
        const member = members.get(id(decision.activityId, 'Author activity'))!;
        if (text(decision.decision, 'Author decision') !== member.decision ||
            text(decision.reason, 'Author reason') !== member.reason ||
            text(decision.titleDependency, 'Author title dependency') !== member.titleDependency ||
            text(decision.nounEvidenceNote, 'Author noun evidence') !== member.nounEvidenceNote)
          invalid('A dataset member differs from its actual raw author decision or evidence.');
        sameIds(ids(decision.otherCurrentGeneralizationIds, 'Author other current Generalizations'),
          member.currentGeneralizations.map((n) => n.id).filter((v) => v !== group.node.id),
          'Author retained independent Generalizations');
      });
      // Root familyLevelIssues remain verbatim context, not a global material gate.
      const objections = [...questions];
      authorObjections.set(groupId, objections);
      const receipt = author.coverage.get(groupId)!;
      sameIds(receipt.memberIds, decisions.map((m) => id(m.activityId, 'Author activity')),
        'Author raw-output coverage receipt');
      sameText(receipt.unresolvedMaterialObjections, objections, 'Author material-question receipt');
    });
  }
  const criticSupport = reviewers.map((run) => {
    const supported = new Map<string, boolean>();
    if (run.output === null) return supported;
    if (authored === null || run.input === null || !own(run.input, 'author'))
      invalid('A completed critic must audit the saved completed author.');
    if (!jsonEqual(authorIds(run.input.author, run.resolve), authored))
      invalid('A completed critic did not receive the exact saved author output.');
    const output = criticIds(run.output, run.resolve);
    if (output.familyId !== family.id) invalid('The raw critic reviewed a different family.');
    // An overall mixed verdict may reflect unrelated held groups; it is not a group eligibility gate.
    // criticIds validates the actual verdict and familyLevelIssues; root issues remain visible
    // in the untouched raw trace, without classification or inclusion in group receipts.
    const rawGroups = array(output.groups, 'Decoded critic groups').map((v) => record(v, 'Decoded critic group'));
    sameIds(rawGroups.map((g) => id(g.generalizationId, 'Critic Generalization')),
      Array.from(groups.keys()), 'Raw critic group coverage');
    rawGroups.forEach((rawGroup) => {
      const groupId = id(rawGroup.generalizationId, 'Critic Generalization');
      const group = groups.get(groupId)!;
      const checkedGroup = criticGroupReceipt(rawGroup);
      const audits = array(rawGroup.memberAudits, 'Decoded critic member audits')
        .map((v) => record(v, 'Decoded critic member audit'));
      sameIds(audits.map((m) => id(m.activityId, 'Critic activity')),
        group.members.map((m) => m.node.id), 'Raw critic complete member coverage');
      const receipt = run.coverage.get(groupId)!;
      sameIds(receipt.memberIds, audits.map((m) => id(m.activityId, 'Critic activity')),
        'Critic raw-output coverage receipt');
      sameText(receipt.unresolvedMaterialObjections, checkedGroup.unresolvedMaterialObjections,
        'Critic material-objection receipt');
      supported.set(groupId, checkedGroup.supported);
    });
    return supported;
  });
  // Validate flags only; never infer or promote eligibility. Dataset validation already rejects
  // included requires-title-clarification members; recheck-after-title-change alone is not a veto.
  family.groups.forEach((group) => {
    if (group.eligible && (!author.completed || authorObjections.get(group.id)?.length !== 0 ||
        !reviewers.every((run) => run.completed) ||
        !criticSupport.every((support) => support.get(group.id) === true)))
      invalid('An eligible subgroup lacks full, question-free author and objection-free critic support.');
  });
  return t as unknown as BranchFamilyTrace;
}

/** Re-read and hash every registered file, including parsed cache hits; commit pins only after full validation. */
function loadBranchPackage(version?: string): {
  dataset: BranchDataset; sha256: string; manifest: BranchPackageManifest;
  traces: ReadonlyMap<string, BranchFamilyTrace>;
} {
  const { file: manifestPin, manifest } = manifestFile(version);
  if (manifest.families !== BRANCH_FAMILY_COUNT || manifest.groups !== BRANCH_GROUP_COUNT ||
      (manifest.priorCases ?? BRANCH_PRIOR_CASE_COUNT) !== BRANCH_PRIOR_CASE_COUNT ||
      manifest.sourceGraph.directory !== 'atomic-v1')
    invalid('A branch release must retain 18 families, 82 groups, 103 prior cases and the shared atomic-v1 source.');
  const base = ['src', 'lib', 'relationshipReview', 'branch-data', manifest.directory];
  const lockPin = readFile([...base, 'release-lock.json'], 'Branch release lock', 65536, manifest.releaseLockSha256);
  const lock = record(json(lockPin, 'Branch release lock'), 'Branch release lock');
  keys(lock, ['datasetSha256', 'familyCount', 'groupCount', 'sourceSha256', 'traceHashes'], 'Branch release lock');
  if (hash(lock.datasetSha256, 'Locked dataset hash') !== manifest.bundleSha256 ||
      lock.familyCount !== manifest.families || lock.groupCount !== manifest.groups ||
      hash(lock.sourceSha256, 'Locked source hash') !== manifest.sourceSha256)
    invalid('The branch release lock differs from its registered manifest.', 'branch_package_integrity');
  const traceHashes = record(lock.traceHashes, 'Locked trace hashes');
  Object.entries(traceHashes).forEach(([familyId, digest]) => {
    id(familyId, 'Locked trace family');
    hash(digest, 'Locked trace hash');
  });
  const datasetPin = readFile([...base, 'dataset.json'], 'Branch dataset', 32 * 1024 * 1024, manifest.bundleSha256);
  const source = sourceFile(manifest);
  const dataset = validateDataset(json(datasetPin, 'Branch dataset'), manifest, source.graph);
  sameIds(Object.keys(traceHashes), dataset.families.map((family) => family.id), 'Locked trace family coverage');
  const files = [manifestPin, lockPin, datasetPin, source.file];
  const traces = new Map<string, BranchFamilyTrace>();
  const responseIds = new Set<string>();
  for (const family of dataset.families) {
    const tracePin = readFile([...base, 'traces', `${family.id}.json`], 'Private branch family trace',
      32 * 1024 * 1024, hash(traceHashes[family.id], 'Locked trace hash'));
    const trace = validateTrace(json(tracePin, 'Private branch family trace'), dataset, family, source.graph, responseIds);
    traces.set(family.id, trace);
    files.push(tracePin);
  }
  commitPins(files);
  return { dataset, sha256: datasetPin.sha256, manifest, traces };
}

export function getBranchDataset(version?: string): {
  dataset: BranchDataset; sha256: string; manifest: BranchPackageManifest;
} {
  const { dataset, sha256, manifest } = loadBranchPackage(version);
  return freeze({ dataset, sha256, manifest });
}

export function getBranchTrace(caseId: string, version?: string): BranchFamilyTrace {
  if (!isSafeBranchNodeId(caseId))
    throw new RelationshipError(404, 'Unknown branch review case.', 'branch_case_not_found');
  const trace = loadBranchPackage(version).traces.get(caseId);
  if (!trace) throw new RelationshipError(404, 'Unknown branch review case.', 'branch_case_not_found');
  return trace;
}
