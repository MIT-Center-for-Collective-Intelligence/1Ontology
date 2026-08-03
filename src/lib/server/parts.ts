import { db } from "@components/lib/firestoreServer/admin";
import { NODES } from "@components/lib/firestoreClient/collections";
import {
  ICollection,
  ILinkNode,
  INode,
  NodeChange,
} from "@components/types/INode";
import { NodeCache, getNode, walkSpecializations } from "./hierarchy";
import { applyGenChange, toPartsNode, PartsGraph } from "./partsModel";
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
 * Applies a generalization change to `nodeId`'s parts: stored entries tracked
 * through a removed gen drop unless a remaining gen still provides them, and
 * losing the attached source re-attaches to the first remaining gen by MERGE.
 * The gen list changed, so the annotation pair is refreshed even when the
 * stored parts came out identical.
 */
export async function applyPartsForGenChange(
  nodeId: string,
  removedGenIds: string[],
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
  const { parts, partsInheritance } = applyGenChange(
    nodeId,
    graph,
    removedGenIds,
    remainingGenIds,
  );

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

  const keptIds = new Set(parts.map((p) => p.id));
  const dropped = beforeEntries
    .map((e) => e.id)
    .filter((id) => !keptIds.has(id));
  if (dropped.length > 0) {
    await applyIsPartOfOwnerOnly(
      nodeId,
      current.title ?? "",
      [],
      dropped,
      cache,
      parentLog,
      uname,
      appName,
      childLogs,
    );
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
