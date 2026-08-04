import { db } from "@components/lib/firestoreServer/admin";
import { NODES } from "@components/lib/firestoreClient/collections";
import {
  ICollection,
  ILinkNode,
  INode,
  NodeChange,
} from "@components/types/INode";
import {
  NodeCache,
  generalizationIds,
  getNode,
  walkSpecializations,
} from "./hierarchy";
import {
  absorbOwnedForGens,
  absorbOwnedPart,
  applyGenChange,
  childSourceOf,
  isOwnedPart,
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
  if (presentAddedGens.length > 0) {
    const scratch: PartsGraph = new Map(graph);
    scratch.set(nodeId, { id: nodeId, parts, partsInheritance });
    const absorbed = absorbOwnedForGens(nodeId, scratch, presentAddedGens);
    parts = absorbed.parts;
    partsInheritance = absorbed.partsInheritance;
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
      inheritedPartsDetails: computeInheritedPartsDetails({
        currentNode: updatedNode,
        relatedNodes: updatedRelated,
        resolvedOf: resolvedOfUpdated,
      }),
      resolvedParts: resolvedOfUpdated(nodeId),
    });
  cache.set(nodeId, updatedNode);

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

/**
 * v1 truth propagation for an OWNER's remove/replace: walk the spec subtree
 * and update stored entries that track `ownerId` — broken-node and switched
 * recorders — dropping them, or morphing them when `to` is given. Resolved
 * copies are left stale on purpose; the read-repair path refreshes per node.
 */
export async function propagateOwnedPartChange(
  ownerId: string,
  changes: { fromId: string; to?: { id: string; title: string } }[],
): Promise<void> {
  await walkSpecializations(ownerId, (node) => {
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
      if (change.to && !presentIds.has(change.to.id)) {
        next.push({ ...e, id: change.to.id, title: change.to.title });
      } else {
        droppedIds.add(e.id);
      }
    }
    if (!touched) return null;
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
    return { "properties.parts": toParts(rePointed) };
  });
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
      await db.collection(NODES).doc(candidateId).update({
        "properties.parts": side,
        partsInheritance,
      });
      cache.set(candidateId, {
        ...candidate,
        properties: { ...candidate.properties, parts: side },
        partsInheritance,
      } as INode);
      convertedIds.push(candidateId);
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
