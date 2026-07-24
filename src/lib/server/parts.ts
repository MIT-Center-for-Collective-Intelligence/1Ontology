import { db } from "@components/lib/firestoreServer/admin";
import { NODES } from "@components/lib/firestoreClient/collections";
import {
  ICollection,
  IInheritance,
  ILinkNode,
  INode,
  NodeChange,
} from "@components/types/INode";
import { NodeCache, getNode, walkSpecializations } from "./hierarchy";
import {
  derivePartsAndRef,
  matchesSource,
  overallRefThroughGen,
  partsAfterGenChange,
} from "./partsModel";

/**
 * Server-side helpers for parts inheritance.
 * "inheritedFrom": the node that owns it. (specific inheritance)
 * "partsOverallSource": the generalization a node draws its arrangement from. (direct generalization)
 * "inheritance.parts.ref": the owner that source derives to.
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
 * Builds a complete `inheritance.parts` entry so a
 * legacy node with no entry still gets a valid one.
 */
export function partsInheritanceEntry(
  ref: string | null,
  title: string,
  existingType?: string,
): IInheritance[string] {
  return {
    ref,
    title,
    inheritanceType:
      (existingType as IInheritance[string]["inheritanceType"]) ??
      "inheritUnlessAlreadyOverRidden",
  };
}

/**
 * A node's tagged parts + its stored overall source. For an old node it
 * fills the gaps once: tags come from the generalizations, the source from
 * the old `inheritance.parts.ref` (a null ref stays null).
 */
export function taggedPartsAndSource(
  node: INode,
  gens: GenForAttach[],
): { tagged: ILinkNode[]; stored: string | null } {
  const parts = partsNodes(node.properties?.parts);
  if (node.partsOverallSource !== undefined) {
    return { tagged: parts, stored: node.partsOverallSource };
  }
  const legacyRef = node.inheritance?.parts?.ref ?? null;
  const stored =
    legacyRef === null
      ? null
      : (gens.find(
          (g) =>
            overallRefThroughGen(g) === legacyRef && matchesSource(parts, g),
        )?.id ?? null);
  const tagged = parts.some((p) => !!p.inheritedFrom)
    ? parts
    : derivePartsAndRef(parts, gens, { oldParts: [], sourceId: stored }).parts;
  return { tagged, stored };
}

/**
 * Applies a generalization change to `nodeId`'s parts: parts tracked through a
 * removed gen are dropped (kept when a remaining gen still provides them), and
 * losing the attached source re-attaches to the first remaining gen by merge.
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

  const remainingGens = await buildGensForAttach(node, cache);
  const removedGens: GenForAttach[] = [];
  for (const id of removedGenIds) {
    const g = await getNode(id, cache);
    if (!g) continue;
    removedGens.push({
      id,
      parts: partsNodes(g.properties?.parts),
      ref: g.inheritance?.parts?.ref ?? null,
    });
  }

  const { tagged, stored } = taggedPartsAndSource(node, remainingGens);
  const {
    parts: newParts,
    sourceId: newSource,
    ref,
  } = partsAfterGenChange({ tagged, stored, removedGens, remainingGens });

  const before = partsNodes(node.properties?.parts);
  const unchanged =
    node.partsOverallSource !== undefined &&
    newSource === node.partsOverallSource &&
    newParts.length === before.length &&
    newParts.every(
      (p, i) =>
        before[i]?.id === p.id &&
        (before[i]?.inheritedFrom ?? null) === (p.inheritedFrom ?? null),
    );
  if (unchanged) return;

  const beforeCol = asPartsCollections(node.properties?.parts);
  const ownerTitle = ref ? ((await getNode(ref, cache))?.title ?? "") : "";
  const partsEntry = partsInheritanceEntry(
    ref,
    ownerTitle,
    node.inheritance?.parts?.inheritanceType,
  );
  await db
    .collection(NODES)
    .doc(nodeId)
    .update({
      "properties.parts": toParts(newParts),
      "inheritance.parts": partsEntry,
      partsOverallSource: newSource,
    });
  cache.set(nodeId, {
    ...node,
    properties: { ...node.properties, parts: toParts(newParts) },
    inheritance: { ...node.inheritance, parts: partsEntry },
    partsOverallSource: newSource,
  } as INode);

  const keptIds = new Set(newParts.map((p) => p.id));
  const dropped = before.map((p) => p.id).filter((id) => !keptIds.has(id));
  await applyIsPartOfOwnerOnly(
    nodeId,
    node.title ?? "",
    [],
    dropped,
    cache,
    parentLog,
    uname,
    appName,
    childLogs,
  );

  if (uname) {
    childLogs.push({
      nodeId,
      modifiedBy: uname,
      modifiedProperty: "parts",
      previousValue: beforeCol,
      newValue: toParts(newParts),
      modifiedAt: new Date(),
      changeType: "modify elements",
      fullNode: node,
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

export type GenForAttach = {
  id: string;
  parts: ILinkNode[];
  /** The generalization's own parts.ref (used to resolve part owners). */
  ref: string | null;
};

/** Builds the attachment candidates from a node's generalizations, in order. */
export async function buildGensForAttach(
  nodeData: INode,
  cache: NodeCache,
): Promise<GenForAttach[]> {
  const genIds = (nodeData.generalizations || []).flatMap((c) =>
    (c.nodes || []).map((n) => n.id),
  );
  const gens: GenForAttach[] = [];
  for (const id of genIds) {
    const g = await getNode(id, cache);
    if (!g || g.deleted) continue;
    gens.push({
      id,
      parts: partsNodes(g.properties?.parts),
      ref: g.inheritance?.parts?.ref ?? null,
    });
  }
  return gens;
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
