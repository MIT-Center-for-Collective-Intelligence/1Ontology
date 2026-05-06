/**
 * Producer for `NodeChange.diffValue` — the pre-computed, ready-to-render
 * representation of a collection-typed change. Computed at write time inside
 * `saveNewChangeLog` so the UI never has to re-diff or resolve titles when
 * displaying history.
 *
 * Returns `null` for changeTypes that have no collection diff representation
 * (`change text`, `add images`, `add property`, `add node`, `delete node`,
 * etc.). Callers should treat `null` as "no diffValue field on this record"
 * and the UI falls back to its legacy rendering path.
 *
 * Title resolution is purely local — every `ILinkNode` inside
 * `previousValue` / `newValue` is expected to carry its `title` (set by
 * whichever caller wrote the link into the live document). The producer
 * never reaches outside the `NodeChange` to fetch titles, so the function
 * stays synchronous and historical entries render correctly even after a
 * node is renamed or unloaded from the local cache.
 *
 * Mirrors the runtime behaviour of `diffCollections` / `diffSortedCollections`
 * in `helpers.ts`, but emits the typed `DiffCollection[]` shape.
 */

import {
  DiffCollection,
  DiffLinkNode,
  ICollection,
  NodeChange,
} from "@components/types/INode";

/**
 * `NodeChange.changeType` values that produce a `diffValue`. All other
 * changeTypes (text edits, image add/remove, schema changes, node create/
 * delete, etc.) are renderable directly from `previousValue` / `newValue` and
 * carry no `diffValue`.
 */
const COLLECTION_CHANGE_TYPES: ReadonlySet<NodeChange["changeType"]> = new Set([
  "add element",
  "remove element",
  "add elements",
  "remove elements",
  "modify elements",
  "sort elements",
  "add collection",
  "delete collection",
  "sort collections",
]);

export const hasDiffValue = (changeType: NodeChange["changeType"]): boolean =>
  COLLECTION_CHANGE_TYPES.has(changeType);

export const computeDiffValue = (
  change: NodeChange,
): DiffCollection[] | null => {
  if (!hasDiffValue(change.changeType)) return null;

  const previous = asCollections(change.previousValue);
  const next = asCollections(change.newValue);
  if (!previous || !next) return null;

  return change.changeType === "sort collections"
    ? diffSortedCollections(previous, next)
    : diffCollectionContents(previous, next);
};

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const asCollections = (value: any): ICollection[] | null => {
  if (!Array.isArray(value)) return null;
  for (const v of value) {
    if (
      !v ||
      typeof v !== "object" ||
      typeof v.collectionName !== "string" ||
      !Array.isArray(v.nodes)
    ) {
      return null;
    }
  }
  return value as ICollection[];
};

/**
 * Build a `DiffLinkNode` from a source `ILinkNode` carried inside
 * `previousValue` / `newValue`. The source's `title` is taken verbatim — it
 * is the snapshot at edit time, set by whichever caller wrote the link into
 * the live document. If `title` is missing, we fall back to the empty
 * string rather than throwing.
 */
const buildDiffNode = (
  id: string,
  source: { title?: string; optional?: boolean },
  marker?: {
    change?: "added" | "removed";
    sort?: boolean;
    optionalChange?: "added" | "removed";
  },
): DiffLinkNode => {
  const node: DiffLinkNode = { id, title: source.title || "" };
  if (source.optional) node.optional = true;
  if (marker?.change) node.change = marker.change;
  if (marker?.sort) node.changeType = "sort";
  if (marker?.optionalChange) node.optionalChange = marker.optionalChange;
  return node;
};

/**
 * Mirrors `diffCollections` in `helpers.ts` but emits `DiffCollection[]`.
 * Used for everything except `sort collections`.
 */
const diffCollectionContents = (
  oldValue: ICollection[],
  newValue: ICollection[],
): DiffCollection[] => {
  const oldMap = new Map(oldValue.map((c) => [c.collectionName, c]));
  const newMap = new Map(newValue.map((c) => [c.collectionName, c]));
  const allCollectionNames = new Set([...oldMap.keys(), ...newMap.keys()]);

  // Where each node lived on each side — used to detect cross-collection moves.
  const oldNodeToCollection = new Map<string, string>();
  for (const { collectionName, nodes } of oldValue) {
    for (const n of nodes) oldNodeToCollection.set(n.id, collectionName);
  }
  const newNodeToCollection = new Map<string, string>();
  for (const { collectionName, nodes } of newValue) {
    for (const n of nodes) newNodeToCollection.set(n.id, collectionName);
  }

  const result: DiffCollection[] = [];

  for (const collectionName of allCollectionNames) {
    const oldCollection = oldMap.get(collectionName);
    const newCollection = newMap.get(collectionName);

    const isAddedCollection = !oldCollection && !!newCollection;
    const isRemovedCollection = !!oldCollection && !newCollection;

    const oldNodes = new Map((oldCollection?.nodes || []).map((n) => [n.id, n]));
    const newNodes = new Map((newCollection?.nodes || []).map((n) => [n.id, n]));
    const ids = new Set<string>([...oldNodes.keys(), ...newNodes.keys()]);

    // Detect within-collection reorders: of the IDs present in BOTH sides of
    // this collection, anything not in their LCS is one of the items that
    // actually moved relative to the others. Skipped when the collection only
    // exists on one side — there's no order to compare.
    let stableIds: Set<string> = new Set();
    if (oldCollection && newCollection) {
      const sharedOldOrder = oldCollection.nodes
        .map((n) => n.id)
        .filter((id) => newNodes.has(id));
      const sharedNewOrder = newCollection.nodes
        .map((n) => n.id)
        .filter((id) => oldNodes.has(id));
      stableIds = longestCommonSubsequence(sharedOldOrder, sharedNewOrder);
    }

    const merged: DiffLinkNode[] = [];
    for (const id of ids) {
      const inOld = oldNodes.has(id);
      const inNew = newNodes.has(id);
      const source = (newNodes.get(id) ?? oldNodes.get(id))!;

      if (!inOld && inNew) {
        const movedFrom = oldNodeToCollection.get(id);
        merged.push(
          buildDiffNode(id, source, {
            change: "added",
            sort: !!movedFrom && movedFrom !== collectionName,
          }),
        );
      } else if (inOld && !inNew) {
        const movedTo = newNodeToCollection.get(id);
        merged.push(
          buildDiffNode(id, source, {
            change: "removed",
            sort: !!movedTo && movedTo !== collectionName,
          }),
        );
      } else {
        // Node is in both old and new of the same collection. Two annotations
        // can fire here, independently and orthogonally:
        //   * `sort` — moved relative to the other shared nodes (LCS-minimal).
        //   * `optionalChange` — the `optional` boolean flipped, e.g. the
        //     toggle-optional path in InheritedPartsViewerEdit.tsx that logs
        //     a `modify elements` change differing only on this boolean.
        const oldOptional = !!oldNodes.get(id)?.optional;
        const newOptional = !!newNodes.get(id)?.optional;
        const optionalChange =
          oldOptional === newOptional
            ? undefined
            : newOptional
              ? ("added" as const)
              : ("removed" as const);
        const moved = !stableIds.has(id);
        const marker: {
          sort?: boolean;
          optionalChange?: "added" | "removed";
        } = {};
        if (moved) marker.sort = true;
        if (optionalChange) marker.optionalChange = optionalChange;
        merged.push(
          buildDiffNode(
            id,
            source,
            Object.keys(marker).length ? marker : undefined,
          ),
        );
      }
    }

    // Order: nodes present in `new` first, in their new order; then leftovers
    // (i.e. removed nodes) at the end, preserving their old relative order.
    if (newCollection) {
      const newOrder = newCollection.nodes.map((n) => n.id);
      merged.sort((a, b) => {
        const aIn = newNodes.has(a.id);
        const bIn = newNodes.has(b.id);
        if (aIn && bIn) return newOrder.indexOf(a.id) - newOrder.indexOf(b.id);
        if (aIn && !bIn) return -1;
        if (!aIn && bIn) return 1;
        return 0;
      });
    }

    const collection: DiffCollection = { collectionName, nodes: merged };
    if (isAddedCollection) collection.change = "added";
    else if (isRemovedCollection) collection.change = "removed";
    result.push(collection);
  }

  return result;
};

/**
 * Mirrors `diffSortedCollections` for the `sort collections` changeType
 * (reordering of containers). Stable collections are kept in place; moved
 * ones get `changeType: "sort"` plus an `added`/`removed` pair at the new and
 * old positions.
 */
const diffSortedCollections = (
  oldValue: ICollection[],
  newValue: ICollection[],
): DiffCollection[] => {
  const oldOrder = new Map(oldValue.map((c, i) => [c.collectionName, i]));
  const newMap = new Map(newValue.map((c) => [c.collectionName, c]));
  const stable = lcsCollectionNames(oldValue, newValue);

  const projectNodes = (nodes: ICollection["nodes"]): DiffLinkNode[] =>
    nodes.map((n) => buildDiffNode(n.id, n));

  const result: DiffCollection[] = newValue.map((newCol) => {
    const isStable = stable.has(newCol.collectionName);
    const wasInOld = oldOrder.has(newCol.collectionName);
    const base: DiffCollection = {
      collectionName: newCol.collectionName,
      nodes: projectNodes(newCol.nodes),
    };
    if (isStable) return base;
    if (wasInOld) return { ...base, changeType: "sort", change: "added" };
    return { ...base, change: "added" };
  });

  // Splice removed/moved-source rows back in at their old indices, biggest
  // index first so earlier indices stay valid.
  const pending: { index: number; col: DiffCollection }[] = [];
  oldValue.forEach((oldCol, oldIndex) => {
    if (stable.has(oldCol.collectionName)) return;
    const isInNew = newMap.has(oldCol.collectionName);
    const col: DiffCollection = {
      collectionName: oldCol.collectionName,
      nodes: projectNodes(oldCol.nodes),
      change: "removed",
    };
    if (isInNew) col.changeType = "sort";
    pending.push({ index: oldIndex, col });
  });
  pending
    .sort((a, b) => b.index - a.index)
    .forEach(({ index, col }) => result.splice(index, 0, col));

  return result;
};

const lcsCollectionNames = (
  oldValue: ICollection[],
  newValue: ICollection[],
): Set<string> =>
  longestCommonSubsequence(
    oldValue.map((c) => c.collectionName),
    newValue.map((c) => c.collectionName),
  );

/**
 * Generic LCS: returns the set of values that appear in the longest common
 * subsequence of `a` and `b`. Used for two purposes:
 *   1. Finding stable collections during `sort collections` diffs.
 *   2. Finding stable nodes inside a collection during within-collection
 *      reorder detection.
 *
 * Tiebreaker (when `dp[i-1][j] === dp[i][j-1]` we move `i--`) matches
 * `findLcsNames` in helpers.ts:1599-1637 so emitted diffs stay byte-identical
 * to the legacy renderer's behaviour for the existing `sort collections` case.
 */
const longestCommonSubsequence = <T>(a: T[], b: T[]): Set<T> => {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const result = new Set<T>();
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.add(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return result;
};
