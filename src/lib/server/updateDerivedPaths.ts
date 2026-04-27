/**
 * Maintains denormalized navigation fields on node documents after graph edits.
 *
 * Write entry points that trigger this (via HTTP `POST /api/nodes/update-derived-paths`):
 * - `src/components/OntologyComponents/Node.tsx` — handleSaveLinkChanges (specializations / generalizations)
 * - `src/components/Improvements/Improvements.tsx` — handleSaveLinkChanges
 * - `src/components/OntologyComponents/DraggableTree.tsx` — tree reparent (cross-parent move)
 * - `src/components/LinkNode/LinkNode.tsx` — unlink specialization / generalization
 *
 * Same `updateDerivedPaths` function can be invoked from Cloud Functions / batch jobs by importing
 * this module with the Admin Firestore instance.
 */
import type { Firestore, DocumentReference, DocumentData } from "firebase-admin/firestore";
import { NODES } from "../firestoreClient/collections";
import {
  childIdsFromSpecializations,
  choosePrimaryParentId,
  parentIdsFromGeneralizations,
  parentMetaEqual,
  pathsEqual,
} from "../utils/derivedNavigation";
import {
  MAX_DERIVED_PATH_BFS_NODES,
  MAX_DERIVED_PATH_OP_VISITS,
  MAX_DERIVED_PATH_WRITES,
} from "../CONSTANTS";

export type UpdateDerivedPathsResult = {
  ok: boolean;
  error?: "cycle" | "cap_exceeded" | "primary_order_stuck" | "seed_not_found";
  seeds: number;
  bfsTouched: number;
  written: number;
  skipped: number;
  seedsWithCycle: string[];
  details?: string;
};

type FirestoreData = { id: string; [k: string]: any };

const DEFAULT_MAX_ATTEMPTS = 5;
const CHUNK = 20;

function getBulkWriter(db: Firestore) {
  const make = (db as Firestore & { bulkWriter?: () => import("firebase-admin/firestore").BulkWriter })
    .bulkWriter;
  if (typeof make !== "function") return null;
  const w = make.call(db);
  w.onWriteError(
    (err) => (err as { failedAttempts: number }).failedAttempts < DEFAULT_MAX_ATTEMPTS,
  );
  return w;
}

async function fetchDocData(
  db: Firestore,
  id: string,
): Promise<FirestoreData | null> {
  const snap = await db.collection(NODES).doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as DocumentData) };
}

/**
 * BFS from `fromId` along all specializations edges, loading on demand. True if `toId` is reached.
 * Used to detect: parent must not be reachable as a descendant (would create a directed cycle).
 */
export async function isReachableAlongSpecializations(
  db: Firestore,
  fromId: string,
  toId: string,
  maxVisits: number = MAX_DERIVED_PATH_OP_VISITS,
): Promise<boolean> {
  if (fromId === toId) return true;
  const q: string[] = [fromId];
  const seen = new Set<string>([fromId]);
  let visits = 0;
  let qi = 0;
  const cache = new Map<string, FirestoreData | null>();

  const get = async (id: string) => {
    if (cache.has(id)) return cache.get(id) ?? null;
    const d = await fetchDocData(db, id);
    cache.set(id, d);
    return d;
  };

  while (qi < q.length) {
    if (visits++ > maxVisits) {
      console.warn(
        "[isReachableAlongSpecializations] visit cap, treating as not reachable",
        { fromId, toId, maxVisits },
      );
      return false;
    }
    const x = q[qi++];
    const node = await get(x);
    if (!node) continue;
    for (const c of childIdsFromSpecializations(node)) {
      if (c === toId) return true;
      if (seen.has(c)) continue;
      seen.add(c);
      q.push(c);
    }
  }
  return false;
}

/**
 * BFS over specialization edges; union of all nodes reachable from seeds. Caps at MAX.
 */
export async function collectSpecDescendantIds(
  db: Firestore,
  seedIds: string[],
  max: number = MAX_DERIVED_PATH_BFS_NODES,
): Promise<Set<string> | { capExceeded: true; partial: Set<string> }> {
  const out = new Set<string>();
  const q: string[] = [];
  for (const s of seedIds) {
    if (!out.has(s)) {
      out.add(s);
      q.push(s);
    }
  }
  if (out.size > max) return { capExceeded: true, partial: out };
  let qi = 0;
  const loadCache = new Map<string, FirestoreData | null>();
  const load = async (id: string) => {
    if (loadCache.has(id)) return loadCache.get(id) ?? null;
    const d = await fetchDocData(db, id);
    loadCache.set(id, d);
    return d;
  };

  while (qi < q.length) {
    if (out.size > max) return { capExceeded: true, partial: out };
    const id = q[qi++];
    const node = await load(id);
    if (!node) continue;
    for (const c of childIdsFromSpecializations(node)) {
      if (out.size >= max) return { capExceeded: true, partial: out };
      if (!out.has(c)) {
        out.add(c);
        q.push(c);
      }
    }
  }
  return out;
}

/**
 * Root → … → node, following `choosePrimaryParentId` upward until no parent. Detects primary cycles.
 */
export async function getPathRootToNodeByPrimary(
  db: Firestore,
  nodeId: string,
  maxHops: number = 2_000,
): Promise<{ pathIds: string[]; error?: "primary_cycle" }> {
  const up: string[] = [];
  let cur: string | null = nodeId;
  const seen = new Set<string>();
  for (let h = 0; h < maxHops; h++) {
    if (!cur) break;
    if (seen.has(cur)) {
      return { pathIds: [], error: "primary_cycle" };
    }
    seen.add(cur);
    up.push(cur);
    const d = await fetchDocData(db, cur);
    if (!d) break;
    cur = choosePrimaryParentId(d.generalizations);
  }
  return { pathIds: up.slice().reverse() };
}

function depthInPrimarySubforest(
  id: string,
  S: Set<string>,
  byId: Map<string, FirestoreData>,
  memo: Map<string, number | "cycle">,
  stack: Set<string>,
): number | "cycle" {
  if (memo.has(id)) return memo.get(id) as number | "cycle";
  if (stack.has(id)) return "cycle";
  const d = byId.get(id);
  const p = d ? choosePrimaryParentId(d.generalizations) : null;
  if (p == null || !S.has(p)) {
    memo.set(id, 0);
    return 0;
  }
  stack.add(id);
  const dp = depthInPrimarySubforest(p, S, byId, memo, stack);
  stack.delete(id);
  if (dp === "cycle") {
    memo.set(id, "cycle");
    return "cycle";
  }
  const v = dp + 1;
  if (v > S.size) {
    memo.set(id, "cycle");
    return "cycle";
  }
  memo.set(id, v);
  return v;
}

export type UpdateDerivedPathsOptions = {
  db: Firestore;
  changedNodeIds: string[];
};

/**
 * Recomputes parentIds, primaryParentId, and pathIds for the specialization-reachable
 * subgraph from the seeds, using: parentIds from generalization ids, primary from main-first rule,
 * pathIds = path(primaryParent) + [id] (primary parent’s path from Firestore or computed).
 * Only writes when values change. Uses BulkWriter when available, else batch commits.
 */
export async function updateDerivedPaths(
  opts: UpdateDerivedPathsOptions,
): Promise<UpdateDerivedPathsResult> {
  const { db, changedNodeIds } = opts;
  const seeds = [...new Set(changedNodeIds.filter(Boolean))];
  if (seeds.length === 0) {
    return { ok: true, seeds: 0, bfsTouched: 0, written: 0, skipped: 0, seedsWithCycle: [] };
  }

  const bfs = await collectSpecDescendantIds(db, seeds, MAX_DERIVED_PATH_BFS_NODES);
  if ("capExceeded" in bfs) {
    return {
      ok: false,
      error: "cap_exceeded",
      seeds: seeds.length,
      bfsTouched: bfs.partial.size,
      written: 0,
      skipped: 0,
      seedsWithCycle: [],
      details: "specialization BFS cap exceeded",
    };
  }
  const S = bfs;

  const byId = new Map<string, FirestoreData>();
  for (const id of S) {
    const d = await fetchDocData(db, id);
    if (d) byId.set(id, d);
  }

  const seedsWithCycle: string[] = [];
  for (const seed of seeds) {
    if (!byId.has(seed)) {
      return {
        ok: false,
        error: "seed_not_found",
        seeds: seeds.length,
        bfsTouched: S.size,
        written: 0,
        skipped: 0,
        seedsWithCycle: [seed],
      };
    }
    const parentIds = parentIdsFromGeneralizations(
      (byId.get(seed) as FirestoreData).generalizations,
    );
    for (const p of parentIds) {
      const wouldCycle = await isReachableAlongSpecializations(db, seed, p);
      if (wouldCycle) {
        seedsWithCycle.push(seed);
        break;
      }
    }
  }
  if (seedsWithCycle.length) {
    console.warn(
      "[updateDerivedPaths] cycle: parent is reachable below node via specializations, skipping writes",
      { seedsWithCycle, bfsTouched: S.size },
    );
    return {
      ok: false,
      error: "cycle",
      seeds: seeds.length,
      bfsTouched: S.size,
      written: 0,
      skipped: 0,
      seedsWithCycle,
    };
  }

  const memo = new Map<string, number | "cycle">();
  const order = [...S].filter((id) => byId.has(id));
  const depths = new Map<string, number | "cycle">();
  for (const id of order) {
    const d = depthInPrimarySubforest(id, S, byId, memo, new Set());
    depths.set(id, d);
  }
  for (const id of order) {
    if (depths.get(id) === "cycle") {
      return {
        ok: false,
        error: "primary_order_stuck",
        seeds: seeds.length,
        bfsTouched: S.size,
        written: 0,
        skipped: 0,
        seedsWithCycle: [],
        details: "primary parent relation has a cycle within affected set",
      };
    }
  }
  order.sort((a, b) => {
    const da = depths.get(a) as number;
    const dbb = depths.get(b) as number;
    if (da !== dbb) return da - dbb;
    return a < b ? -1 : a > b ? 1 : 0;
  });

  const newPaths = new Map<string, string[]>();

  for (const id of order) {
    const d = byId.get(id) as FirestoreData;
    const pr = choosePrimaryParentId(d.generalizations);
    if (pr == null) {
      newPaths.set(id, [id]);
    } else if (S.has(pr)) {
      const pPath = newPaths.get(pr);
      if (pPath?.length) {
        newPaths.set(id, [...pPath, id]);
      } else {
        return {
          ok: false,
          error: "primary_order_stuck",
          seeds: seeds.length,
          bfsTouched: S.size,
          written: 0,
          skipped: 0,
          seedsWithCycle: [],
          details: `missing parent path for ${id} (parent ${pr} in S)`,
        };
      }
    } else {
      const pPathRes = await getPathRootToNodeByPrimary(db, pr);
      if (pPathRes.error) {
        return {
          ok: false,
          error: "primary_order_stuck",
          seeds: seeds.length,
          bfsTouched: S.size,
          written: 0,
          skipped: 0,
          seedsWithCycle: [],
          details: "primary walk cycle for external parent",
        };
      }
      const pPath = pPathRes.pathIds;
      if (pPath.length && pPath[pPath.length - 1] === pr) {
        newPaths.set(id, [...pPath, id]);
      } else if (pPath.length) {
        newPaths.set(id, [...pPath, id]);
      } else {
        newPaths.set(id, [pr, id]);
      }
    }
  }

  for (const id of S) {
    const path = newPaths.get(id);
    if (!path?.length || path[path.length - 1] !== id) {
      return {
        ok: false,
        error: "primary_order_stuck",
        seeds: seeds.length,
        bfsTouched: S.size,
        written: 0,
        skipped: 0,
        seedsWithCycle: [],
        details: `path for ${id} could not be formed`,
      };
    }
  }

  const updates: { ref: DocumentReference; data: Record<string, any> }[] = [];
  for (const id of S) {
    if (updates.length >= MAX_DERIVED_PATH_WRITES) {
      console.warn("[updateDerivedPaths] max derived-field writes in one run", {
        cap: MAX_DERIVED_PATH_WRITES,
        bfsTouched: S.size,
      });
      return {
        ok: false,
        error: "cap_exceeded",
        seeds: seeds.length,
        bfsTouched: S.size,
        written: updates.length,
        skipped: S.size - updates.length,
        seedsWithCycle: [],
        details: "max writes per operation",
      };
    }
    const d = byId.get(id) as FirestoreData;
    const pids = parentIdsFromGeneralizations(d.generalizations);
    const pr = choosePrimaryParentId(d.generalizations);
    const path = newPaths.get(id) ?? [id];
    if (
      parentMetaEqual(d.parentIds, pids, d.primaryParentId, pr) &&
      pathsEqual(d.pathIds, path)
    ) {
      continue;
    }
    updates.push({
      ref: db.collection(NODES).doc(id),
      data: { parentIds: pids, primaryParentId: pr, pathIds: path },
    });
  }

  if (updates.length === 0) {
    return {
      ok: true,
      seeds: seeds.length,
      bfsTouched: S.size,
      written: 0,
      skipped: S.size,
      seedsWithCycle: [],
    };
  }

  const bulk = getBulkWriter(db);
  if (bulk) {
    for (const u of updates) {
      bulk.update(u.ref, u.data);
    }
    await bulk.close();
  } else {
    for (let i = 0; i < updates.length; i += CHUNK) {
      const batch = db.batch();
      for (const u of updates.slice(i, i + CHUNK)) {
        batch.update(u.ref, u.data);
      }
      await batch.commit();
    }
  }

  console.log("[updateDerivedPaths] completed", {
    seeds: seeds.length,
    bfsTouched: S.size,
    written: updates.length,
    skipped: S.size - updates.length,
  });

  return {
    ok: true,
    seeds: seeds.length,
    bfsTouched: S.size,
    written: updates.length,
    skipped: S.size - updates.length,
    seedsWithCycle: [],
  };
}
