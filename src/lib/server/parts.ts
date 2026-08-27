import {
  db,
  MAX_TRANSACTION_WRITES,
} from "@components/lib/firestoreServer/admin";
import { NODES } from "@components/lib/firestoreClient/collections";
import {
  ICollection,
  ILinkNode,
  INode,
  NodeChange,
} from "@components/types/INode";
import { NodeCache, generalizationIds, getNode } from "./hierarchy";
import {
  absorbOwnedForGens,
  absorbOwnedPart,
  applyGenChange,
  applyTrackerFlag,
  applyViaFlag,
  applyViaFollowerChange,
  childSourceOf,
  dissolveMatchingOverride,
  isOwnedPart,
  partSourcesOf,
  repointTracked,
  resolveParts,
  toPartsNode,
  PartsGraph,
} from "./partsModel";
import {
  computeInheritedPartsDetails,
  fetchPartsContext,
  makeResolvedOf,
} from "./partsAnnotation";

/**
 * Server-side helpers for parts inheritance (ref model).
 * "inheritedFrom" on a stored entry: the node that OWNS the part.
 * "partsInheritance.source": the direct generalization the node follows.
 */

/** Parts live in a single "main" collection; read its node list. */
export function partsNodes(parts?: ICollection[] | null): ILinkNode[] {
  if (!Array.isArray(parts) || parts.length === 0) return [];
  return parts[0]?.nodes ?? [];
}

/** Wrap a flat node list back into the single "main" collection shape. */
export function toParts(nodes: ILinkNode[]): ICollection[] {
  return [{ collectionName: "main", nodes }];
}

/** Reads a stored parts value, defaulting to an empty "main" collection. */
export function asPartsCollections(value: any): ICollection[] {
  if (Array.isArray(value) && value.length > 0) {
    return JSON.parse(JSON.stringify(value));
  }
  return [{ collectionName: "main", nodes: [] }];
}

/**
 * Apply a gen change to `nodeId`'s parts: entries tracked through a removed
 * gen drop unless another gen provides them; losing the source re-attaches to
 * the first remaining gen. Added gens absorb owned copies, here and below.
 */
export async function applyPartsForGenChange(
  nodeId: string,
  removedGenIds: string[],
  addedGenIds: string[],
  cache: NodeCache,
  parentLog: NodeChange["triggeredBy"],
  uname: string | undefined,
  appName: string | undefined,
  childLogs: NodeChange[],
): Promise<void> {
  cache.delete(nodeId);
  const node = await getNode(nodeId, cache);
  if (!node || node.deleted) return;
  const current = { ...node, id: nodeId } as INode;

  // Context around the PRE-change state; the removed gens are no longer among
  // the node's generalizations, so they ride the first wave explicitly.
  const { relatedNodes } = await fetchPartsContext(current, removedGenIds);
  const graph: PartsGraph = new Map(
    Object.values(relatedNodes).map((n) => [n.id, toPartsNode(n)]),
  );
  const remainingGenIds = (current.generalizations ?? []).flatMap((c) =>
    (c.nodes ?? []).map((n) => n.id),
  );
  let { parts, partsInheritance } = applyGenChange(
    nodeId,
    graph,
    removedGenIds,
    remainingGenIds,
  );

  const presentAddedGens = addedGenIds.filter((id) => graph.has(id));
  let ownConverted: { partId: string; owner: string }[] = [];
  if (presentAddedGens.length > 0) {
    const scratch: PartsGraph = new Map(graph);
    scratch.set(nodeId, { id: nodeId, parts, partsInheritance });
    const absorbed = absorbOwnedForGens(nodeId, scratch, presentAddedGens);
    parts = absorbed.parts;
    partsInheritance = absorbed.partsInheritance;
    ownConverted = absorbed.converted;
  }

  const beforeEntries = partsNodes(current.properties?.parts);
  const beforeCol = asPartsCollections(current.properties?.parts);
  const side = toParts(parts);
  const updatedNode = {
    ...current,
    properties: { ...current.properties, parts: side },
    partsInheritance,
  } as INode;
  const updatedRelated = { ...relatedNodes, [nodeId]: updatedNode };
  const resolvedOfUpdated = makeResolvedOf(updatedRelated);

  // Gen list changed ⇒ refresh the pair even if the stored parts are identical.
  await db
    .collection(NODES)
    .doc(nodeId)
    .update({
      "properties.parts": side,
      partsInheritance,
      partSources: partSourcesOf(
        parts,
        Object.keys(partsInheritance.overrides),
      ),
      inheritedPartsDetails: computeInheritedPartsDetails({
        currentNode: updatedNode,
        relatedNodes: updatedRelated,
        resolvedOf: resolvedOfUpdated,
      }),
      resolvedParts: resolvedOfUpdated(nodeId),
    });
  cache.set(nodeId, updatedNode);

  // Entries elsewhere still tracking a copy this node just stopped owning
  // follow it to the new owner.
  for (const { partId, owner } of ownConverted) {
    await repointTrackedEntries(nodeId, partId, owner);
  }

  // Strip isPartOf for entries that dropped AND for entries this node no
  // longer OWNS (an absorb re-tags them in place).
  const keptIds = new Set(parts.map((p) => p.id));
  const ownedAfter = new Set(parts.filter(isOwnedPart).map((p) => p.id));
  const stripped = [
    ...new Set(
      beforeEntries
        .filter(
          (e) =>
            !keptIds.has(e.id) || (isOwnedPart(e) && !ownedAfter.has(e.id)),
        )
        .map((e) => e.id),
    ),
  ];
  if (stripped.length > 0) {
    await applyIsPartOfOwnerOnly(
      nodeId,
      current.title ?? "",
      [],
      stripped,
      cache,
      parentLog,
      uname,
      appName,
      childLogs,
    );
  }

  // Every part an added gen provides may also be owned somewhere below.
  if (presentAddedGens.length > 0) {
    const seen = new Set<string>();
    const genProvided: { partId: string; owner: string }[] = [];
    for (const genId of presentAddedGens) {
      for (const p of resolveParts(genId, graph)) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        genProvided.push({ partId: p.id, owner: childSourceOf(p, genId) });
      }
    }
    if (genProvided.length > 0) {
      await absorbDescendantOwnership(
        nodeId,
        genProvided,
        updatedRelated,
        cache,
        parentLog,
        uname,
        appName,
        childLogs,
      );
    }
  }

  const changed =
    (current.partsInheritance?.source ?? null) !== partsInheritance.source ||
    parts.length !== beforeEntries.length ||
    parts.some(
      (p, i) =>
        beforeEntries[i]?.id !== p.id ||
        (beforeEntries[i]?.inheritedFrom ?? null) !== (p.inheritedFrom ?? null),
    );
  if (uname && changed) {
    childLogs.push({
      nodeId,
      modifiedBy: uname,
      modifiedProperty: "parts",
      previousValue: beforeCol,
      newValue: side,
      modifiedAt: new Date(),
      changeType: "modify elements",
      fullNode: current,
      triggeredBy: parentLog,
      ...(appName ? { appName } : {}),
    } as NodeChange);
  }
}

/**
 * Owner-only isPartOf: `addedOwn` parts gain `nodeId` in their isPartOf,
 * `removed` parts lose it (even inherited ones, to clean up legacy data).
 */
export async function applyIsPartOfOwnerOnly(
  nodeId: string,
  nodeTitle: string,
  addedOwn: string[],
  removed: string[],
  cache: NodeCache,
  parentLog: NodeChange["triggeredBy"],
  uname: string | undefined,
  appName: string | undefined,
  childLogs: NodeChange[],
): Promise<void> {
  for (const id of addedOwn) {
    const linked = await getNode(id, cache);
    if (!linked || linked.deleted) continue;
    const before = asPartsCollections(linked.properties?.isPartOf);
    const after: ICollection[] = JSON.parse(JSON.stringify(before));
    let main = after.find((c) => c.collectionName === "main");
    if (!main) {
      main = { collectionName: "main", nodes: [] };
      after.unshift(main);
    }
    if (main.nodes.some((n) => n.id === nodeId)) continue;
    main.nodes.push({ id: nodeId, title: nodeTitle });
    await db.collection(NODES).doc(id).update({ "properties.isPartOf": after });
    cache.set(id, {
      ...linked,
      properties: { ...linked.properties, isPartOf: after },
    } as INode);
    if (uname) {
      childLogs.push({
        nodeId: id,
        modifiedBy: uname,
        modifiedProperty: "isPartOf",
        previousValue: before,
        newValue: after,
        modifiedAt: new Date(),
        changeType: "add element",
        fullNode: linked,
        triggeredBy: parentLog,
        ...(appName ? { appName } : {}),
      } as NodeChange);
    }
  }
  for (const id of removed) {
    const linked = await getNode(id, cache);
    if (!linked) continue;
    const raw = linked.properties?.isPartOf;
    if (!Array.isArray(raw)) continue;
    const before: ICollection[] = JSON.parse(JSON.stringify(raw));
    if (!before.some((c) => (c.nodes || []).some((n) => n.id === nodeId))) {
      continue;
    }
    const after: ICollection[] = JSON.parse(JSON.stringify(raw));
    for (const c of after) {
      c.nodes = (c.nodes || []).filter((n) => n.id !== nodeId);
    }
    await db.collection(NODES).doc(id).update({ "properties.isPartOf": after });
    cache.set(id, {
      ...linked,
      properties: { ...linked.properties, isPartOf: after },
    } as INode);
    if (uname) {
      childLogs.push({
        nodeId: id,
        modifiedBy: uname,
        modifiedProperty: "isPartOf",
        previousValue: before,
        newValue: after,
        modifiedAt: new Date(),
        changeType: "remove element",
        fullNode: linked,
        triggeredBy: parentLog,
        ...(appName ? { appName } : {}),
      } as NodeChange);
    }
  }
}

/** Docs holding a stored entry that tracks `owner`'s copy of `partId`. */
async function queryTrackingDocs(
  partId: string,
  owner: string,
): Promise<Map<string, INode>> {
  const snap = await db
    .collection(NODES)
    .where("partSources", "array-contains", `${partId}:${owner}`)
    .get();
  const docs = new Map<string, INode>();
  for (const d of snap.docs) {
    const data = d.data() as INode;
    if (!data.deleted) docs.set(d.id, { ...data, id: d.id });
  }
  return docs;
}

/**
 * After an owner's remove/replace: every stored entry tracking `ownerId`,
 * found via partSources (so nodes outside the subtree are reached too),
 * drops — or morphs when `to` is given. resolvedParts stay stale; read-repair fixes them.
 */
export async function propagateOwnedPartChange(
  ownerId: string,
  changes: {
    fromId: string;
    to?: { id: string; title: string; owner?: string };
  }[],
): Promise<void> {
  const docs = new Map<string, INode>();
  for (const c of changes) {
    for (const [id, data] of await queryTrackingDocs(c.fromId, ownerId)) {
      if (!docs.has(id)) docs.set(id, data);
    }
  }

  let batch = db.batch();
  let pending = 0;
  for (const [id, node] of docs) {
    const entries = partsNodes(asPartsCollections(node.properties?.parts));
    const presentIds = new Set(entries.map((e) => e.id));
    const droppedIds = new Set<string>();
    let touched = false;
    const next: ILinkNode[] = [];
    for (const e of entries) {
      const change = changes.find(
        (c) => c.fromId === e.id && e.inheritedFrom === ownerId,
      );
      if (!change) {
        next.push(e);
        continue;
      }
      touched = true;
      // Morph keeps the recorder; a collision with an existing entry drops it.
      // Trackers follow the replacement's true owner, not necessarily the editor.
      if (change.to && !presentIds.has(change.to.id)) {
        next.push({
          ...e,
          id: change.to.id,
          title: change.to.title,
          inheritedFrom: change.to.owner ?? ownerId,
        });
      } else {
        droppedIds.add(e.id);
      }
    }
    if (!touched) continue;
    const byId = new Map(entries.map((e) => [e.id, e]));
    const rePointed = next.map((e) => {
      if (e.after == null || !droppedIds.has(e.after)) return e;
      let cursor: string | null | undefined = e.after;
      while (cursor != null && droppedIds.has(cursor)) {
        cursor = byId.get(cursor)?.after;
      }
      const copy = { ...e };
      if (cursor === undefined) delete copy.after;
      else copy.after = cursor;
      return copy;
    });
    batch.update(db.collection(NODES).doc(id), {
      "properties.parts": toParts(rePointed),
      partSources: partSourcesOf(
        rePointed,
        Object.keys(node.partsInheritance?.overrides ?? {}),
      ),
    });
    pending += 1;
    if (pending >= MAX_TRANSACTION_WRITES) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }
  if (pending > 0) await batch.commit();
}

/**
 * Entries elsewhere that FOLLOW `genId` (`via`, found by the "partId@genId"
 * key) mirror its remove/replace — for EVERY edited part, owned or not:
 * that is the point of a pick.
 */
export async function propagateViaFollowers(
  genId: string,
  changes: {
    fromId: string;
    to?: { id: string; title: string; owner?: string };
  }[],
): Promise<void> {
  const docs = new Map<string, INode>();
  for (const c of changes) {
    const snap = await db
      .collection(NODES)
      .where("partSources", "array-contains", `${c.fromId}@${genId}`)
      .get();
    for (const d of snap.docs) {
      const data = d.data() as INode;
      if (!data.deleted && !docs.has(d.id)) {
        docs.set(d.id, { ...data, id: d.id });
      }
    }
  }

  let batch = db.batch();
  let pending = 0;
  for (const [id, node] of docs) {
    const entries = partsNodes(asPartsCollections(node.properties?.parts));
    const { parts, changed } = applyViaFollowerChange(entries, genId, changes);
    if (!changed) continue;
    batch.update(db.collection(NODES).doc(id), {
      "properties.parts": toParts(parts),
      partSources: partSourcesOf(
        parts,
        Object.keys(node.partsInheritance?.overrides ?? {}),
      ),
    });
    pending += 1;
    if (pending >= MAX_TRANSACTION_WRITES) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }
  if (pending > 0) await batch.commit();
}

/**
 * `exOwnerId`'s copy of `partId` moved to `newOwner` (absorption lifted it):
 * re-point every stored entry still tracking the old copy, wherever it lives,
 * so the new owner's future removals and morphs keep reaching it.
 */
export async function repointTrackedEntries(
  exOwnerId: string,
  partId: string,
  newOwner: string,
): Promise<void> {
  const docs = await queryTrackingDocs(partId, exOwnerId);
  let batch = db.batch();
  let pending = 0;
  for (const [id, node] of docs) {
    const entries = partsNodes(asPartsCollections(node.properties?.parts));
    const { parts, changed } = repointTracked(
      entries,
      partId,
      exOwnerId,
      newOwner,
    );
    if (!changed) continue;
    batch.update(db.collection(NODES).doc(id), {
      "properties.parts": toParts(parts),
      partSources: partSourcesOf(
        parts,
        Object.keys(node.partsInheritance?.overrides ?? {}),
      ),
    });
    pending += 1;
    if (pending >= MAX_TRANSACTION_WRITES) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }
  if (pending > 0) await batch.commit();
}

/**
 * Deliver a flag toggle: trackers of the toggler's copy and followers of its
 * pick mirror the flag; overrides that now match their line dissolve. Receivers
 * get no logs — their resolvedParts stay stale for read-repair to fix.
 */
export async function propagateFlagChange(
  togglerId: string,
  partId: string,
  optional: boolean,
  ownsPart: boolean,
): Promise<void> {
  const docs = new Map<string, INode>();
  if (ownsPart) {
    for (const [id, data] of await queryTrackingDocs(partId, togglerId)) {
      docs.set(id, data);
    }
  }
  for (const key of [`${partId}@${togglerId}`, `${partId}!`]) {
    const snap = await db
      .collection(NODES)
      .where("partSources", "array-contains", key)
      .get();
    for (const d of snap.docs) {
      const data = d.data() as INode;
      if (!data.deleted && !docs.has(d.id)) {
        docs.set(d.id, { ...data, id: d.id });
      }
    }
  }

  const cache: NodeCache = new Map();
  for (const [id, n] of docs) cache.set(id, n);
  // Chain graph for a node's line flag; the toggler's doc reads fresh (its
  // own write already landed), so the resolved flag is the post-toggle one.
  const chainGraphFor = async (startId: string): Promise<PartsGraph> => {
    const graph: PartsGraph = new Map();
    let cursor: string | null | undefined = startId;
    while (cursor && !graph.has(cursor)) {
      const doc = await getNode(cursor, cache);
      if (!doc) break;
      const partsNode = toPartsNode(doc);
      graph.set(cursor, partsNode);
      cursor = partsNode.partsInheritance.source;
    }
    return graph;
  };

  let batch = db.batch();
  let pending = 0;
  for (const [id, node] of docs) {
    let parts = partsNodes(asPartsCollections(node.properties?.parts));
    let touched = false;
    if (ownsPart) {
      const r = applyTrackerFlag(parts, partId, togglerId, optional);
      if (r.changed) {
        parts = r.parts;
        touched = true;
      }
    }
    const v = applyViaFlag(parts, partId, togglerId, optional);
    if (v.changed) {
      parts = v.parts;
      touched = true;
    }
    let pi = node.partsInheritance ?? { source: null, overrides: {} };
    if (pi.overrides?.[partId] && pi.source) {
      const graph = await chainGraphFor(pi.source);
      const linePart = resolveParts(pi.source, graph).find(
        (p) => p.id === partId,
      );
      if (linePart) {
        const r = dissolveMatchingOverride(pi, partId, !!linePart.optional);
        if (r.changed) {
          pi = r.partsInheritance;
          touched = true;
        }
      }
    }
    if (!touched) continue;
    batch.update(db.collection(NODES).doc(id), {
      "properties.parts": toParts(parts),
      partsInheritance: pi,
      partSources: partSourcesOf(parts, Object.keys(pi.overrides ?? {})),
    });
    pending += 1;
    if (pending >= MAX_TRANSACTION_WRITES) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }
  if (pending > 0) await batch.commit();
}

/**
 * `editedNodeId` now provides these parts, so descendants that owned a copy
 * stop owning it; the parts' isPartOf drops them. Descendants' resolvedParts
 * are left stale on purpose — read-repair fixes them per node.
 */
export async function absorbDescendantOwnership(
  editedNodeId: string,
  absorptions: { partId: string; owner: string }[],
  relatedNodes: { [id: string]: INode },
  cache: NodeCache,
  parentLog: NodeChange["triggeredBy"],
  uname: string | undefined,
  appName: string | undefined,
  childLogs: NodeChange[],
): Promise<void> {
  for (const [id, n] of Object.entries(relatedNodes)) {
    if (!cache.has(id)) cache.set(id, n);
  }

  // Ancestor test: pathIds is a quick positive (primary-parent spine); the
  // upward generalization walk is authoritative for multi-gen paths.
  const isDescendant = async (nodeId: string): Promise<boolean> => {
    const direct = await getNode(nodeId, cache);
    if (((direct as any)?.pathIds ?? []).includes(editedNodeId)) return true;
    const visited = new Set<string>([nodeId]);
    const queue = [nodeId];
    while (queue.length > 0) {
      const doc = await getNode(queue.shift() as string, cache);
      if (!doc) continue;
      for (const gid of generalizationIds(doc)) {
        if (gid === editedNodeId) return true;
        if (!visited.has(gid)) {
          visited.add(gid);
          queue.push(gid);
        }
      }
    }
    return false;
  };

  const chainGraphFor = async (nodeId: string): Promise<PartsGraph> => {
    const graph: PartsGraph = new Map();
    let cursor: string | null | undefined = nodeId;
    while (cursor && !graph.has(cursor)) {
      const doc = await getNode(cursor, cache);
      if (!doc) break;
      const partsNode = toPartsNode({ ...doc, id: cursor });
      graph.set(cursor, partsNode);
      cursor = partsNode.partsInheritance.source;
    }
    return graph;
  };

  for (const { partId, owner } of absorptions) {
    const partDoc = await getNode(partId, cache);
    if (!partDoc) continue;
    const candidateIds = [
      ...new Set(
        (partDoc.properties?.isPartOf ?? [])
          .flatMap((c: ICollection) => c.nodes ?? [])
          .map((n: ILinkNode) => n.id)
          .filter((id: string) => id !== owner && id !== editedNodeId),
      ),
    ];

    const convertedIds: string[] = [];
    for (const candidateId of candidateIds) {
      const candidate = await getNode(candidateId, cache);
      if (!candidate || candidate.deleted) continue;
      const entries = partsNodes(
        asPartsCollections(candidate.properties?.parts),
      );
      if (!entries.some((e) => e.id === partId && isOwnedPart(e))) continue;
      if (!(await isDescendant(candidateId))) continue;

      const graph = await chainGraphFor(candidateId);
      const { parts, partsInheritance, changed } = absorbOwnedPart(
        candidateId,
        graph,
        partId,
        owner,
      );
      if (!changed) continue;
      const side = toParts(parts);
      await db
        .collection(NODES)
        .doc(candidateId)
        .update({
          "properties.parts": side,
          partsInheritance,
          partSources: partSourcesOf(
            parts,
            Object.keys(partsInheritance.overrides),
          ),
        });
      cache.set(candidateId, {
        ...candidate,
        properties: { ...candidate.properties, parts: side },
        partsInheritance,
      } as INode);
      convertedIds.push(candidateId);
      // Deeper entries still tracking the dissolved owner follow the copy.
      await repointTrackedEntries(candidateId, partId, owner);
    }
    if (convertedIds.length === 0) continue;

    const before = asPartsCollections(partDoc.properties?.isPartOf);
    const dropSet = new Set(convertedIds);
    const after: ICollection[] = JSON.parse(JSON.stringify(before));
    for (const c of after) {
      c.nodes = (c.nodes || []).filter((n) => !dropSet.has(n.id));
    }
    await db
      .collection(NODES)
      .doc(partId)
      .update({ "properties.isPartOf": after });
    cache.set(partId, {
      ...partDoc,
      properties: { ...partDoc.properties, isPartOf: after },
    } as INode);
    if (uname) {
      childLogs.push({
        nodeId: partId,
        modifiedBy: uname,
        modifiedProperty: "isPartOf",
        previousValue: before,
        newValue: after,
        modifiedAt: new Date(),
        changeType: "remove element",
        fullNode: partDoc,
        triggeredBy: parentLog,
        ...(appName ? { appName } : {}),
      } as NodeChange);
    }
  }
}
