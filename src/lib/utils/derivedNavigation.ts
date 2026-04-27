import type { ICollection } from "@components/types/INode";

/** Ordered unique parent ids (generalizations) — collection order, then node order, deduplicated. */
export function parentIdsFromGeneralizations(
  generalizations: ICollection[] | undefined,
): string[] {
  if (!generalizations?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of generalizations) {
    for (const n of c.nodes || []) {
      if (n?.id && !seen.has(n.id)) {
        seen.add(n.id);
        out.push(n.id);
      }
    }
  }
  return out;
}

/**
 * Stable primary parent: first id in the "main" collection when present and non-empty;
 * else first id in the same order as `parentIdsFromGeneralizations`.
 */
export function choosePrimaryParentId(
  generalizations: ICollection[] | undefined,
): string | null {
  if (!generalizations?.length) return null;
  const main = generalizations.find((c) => c.collectionName === "main");
  if (main?.nodes?.length) {
    const first = main.nodes[0];
    if (first?.id) return first.id;
  }
  return parentIdsFromGeneralizations(generalizations)[0] ?? null;
}

export function pathsEqual(
  a: string[] | undefined,
  b: string[] | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function parentMetaEqual(
  a: string[] | undefined,
  b: string[] | undefined,
  pa: string | null | undefined,
  pb: string | null | undefined,
): boolean {
  if (!pathsEqual(a, b)) return false;
  if (pa === pb) return true;
  if ((pa == null || pa === "") && (pb == null || pb === "")) return true;
  return false;
}

/**
 * BFS from `nodeId` along all specialization links; returns if `targetId` is reached.
 * Used to detect whether adding a parent would create a cycle in the DAG.
 */
export function isReachableViaSpecializations(
  nodeId: string,
  targetId: string,
  getChildIds: (id: string) => string[],
  maxVisits: number = 1_000_000,
): boolean {
  if (nodeId === targetId) return true;
  const q: string[] = [nodeId];
  const seen = new Set<string>([nodeId]);
  let visits = 0;
  while (q.length) {
    const x = q.shift()!;
    visits++;
    if (visits > maxVisits) return true;
    for (const c of getChildIds(x)) {
      if (c === targetId) return true;
      if (seen.has(c)) continue;
      seen.add(c);
      q.push(c);
    }
  }
  return false;
}

export type NodeLike = {
  id: string;
  specializations?: ICollection[];
};

/** Collect specialization child ids in stable order (all collections, all nodes). */
export function childIdsFromSpecializations(
  n: NodeLike | undefined,
): string[] {
  if (!n?.specializations?.length) return [];
  return n.specializations.flatMap((c) => (c.nodes || []).map((x) => x.id));
}
