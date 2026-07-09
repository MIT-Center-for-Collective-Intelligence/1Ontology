import {
  db,
  MAX_TRANSACTION_WRITES,
} from "@components/lib/firestoreServer/admin";
import {
  LOGS,
  NODES,
  NODES_LOGS,
  USERS,
} from "@components/lib/firestoreClient/collections";
import { getDoerCreate } from "@components/lib/utils/helpers";
import { computeDiffValue } from "@components/lib/utils/diffValue";
import { FieldValue } from "firebase-admin/firestore";
import { ICollection, ILinkNode, INode, NodeChange } from "@components/types/INode";
import { isReachableAlongSpecializations } from "@components/lib/server/updateDerivedPaths";
import { childSourceOf, overallRefThroughGen } from "./partsModel";
import { UNCLASSIFIED_COLLECTION } from "../CONSTANTS";

/**
 * Shared helpers for the specializations/generalizations endpoints (link,
 * unlink, move, sort, ...). Each endpoint does its own work; this file only
 * holds the pieces they reuse.
 */

// ──────── Types, errors & small utilities ────────

export type Side = "specializations" | "generalizations";

export const PARTS_EDGES = new Set(["parts", "isPartOf"]);

/** Parts live in a single "main" collection; read its node list. */
function partsNodesOf(parts?: ICollection[] | null): ILinkNode[] {
  if (!Array.isArray(parts) || parts.length === 0) return [];
  return parts[0]?.nodes ?? [];
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const hasOwn = (obj: any, key: string) =>
  !!obj && Object.prototype.hasOwnProperty.call(obj, key);

export const oppositeOf = (side: Side): Side =>
  side === "specializations" ? "generalizations" : "specializations";

// ──────── Collection & id helpers ────────

/** Checks the incoming collections; returns null if malformed. */
export function sanitizeCollections(
  value: any,
  selfId: string,
): ICollection[] | null {
  if (!Array.isArray(value)) return null;
  const seen = new Set<string>();
  const out: ICollection[] = [];
  for (const c of value) {
    if (!c || typeof c.collectionName !== "string" || !Array.isArray(c.nodes)) {
      return null;
    }
    const nodes = [];
    for (const n of c.nodes) {
      if (!n || typeof n.id !== "string") return null;
      if (n.id === selfId || seen.has(n.id)) continue; // skip self-links and dupes
      seen.add(n.id);
      nodes.push({
        id: n.id,
        title: typeof n.title === "string" ? n.title : "",
      });
    }
    out.push({ collectionName: c.collectionName, nodes });
  }
  return out;
}

/** Reads a stored side as collections; defaults to an empty `main`. */
export function asCollections(value: any): ICollection[] {
  if (Array.isArray(value) && value.length > 0) {
    return JSON.parse(JSON.stringify(value));
  }
  return [{ collectionName: "main", nodes: [] }];
}

/** All node ids across every collection. */
export function idsOf(collections: ICollection[]): Set<string> {
  return new Set(collections.flatMap((c) => c.nodes.map((n) => n.id)));
}

/** Adds a node to `main`; returns false if it's already there. */
export function addToMain(
  collections: ICollection[],
  linkNode: { id: string; title?: string },
): boolean {
  let main = collections.find((c) => c.collectionName === "main");
  if (!main) {
    main = { collectionName: "main", nodes: [] };
    collections.unshift(main);
  }
  if (main.nodes.some((n) => n.id === linkNode.id)) return false;
  main.nodes.push(linkNode);
  return true;
}

/** Adds a node to a named collection (created at the end); false if present. */
export function addToCollection(
  collections: ICollection[],
  collectionName: string,
  linkNode: { id: string; title?: string },
): boolean {
  let target = collections.find((c) => c.collectionName === collectionName);
  if (!target) {
    target = { collectionName, nodes: [] };
    collections.push(target);
  }
  if (target.nodes.some((n) => n.id === linkNode.id)) return false;
  target.nodes.push(linkNode);
  return true;
}

export function specializationIds(
  node: Pick<INode, "specializations">,
): string[] {
  return (node.specializations || []).flatMap((collection) =>
    (collection.nodes || []).map((n) => n.id),
  );
}

export function generalizationIds(
  node: Pick<INode, "generalizations">,
): string[] {
  return (node.generalizations || []).flatMap((collection) =>
    (collection.nodes || []).map((n) => n.id),
  );
}

/** Starting value for a newly inherited property that carries no value. */
export function defaultValueForProperty(propertyType: string): any {
  if (propertyType === "string-array") return [];
  if (propertyType === "numeric") return 0;
  return "";
}

/** Which ids were added vs removed between the stored value and the new one. */
export function diffSides(
  previous: ICollection[],
  next: ICollection[],
): { added: string[]; removed: string[]; newIds: Set<string> } {
  const prevIds = idsOf(previous);
  const newIds = idsOf(next);
  const added = [...newIds].filter((id) => !prevIds.has(id));
  const removed = [...prevIds].filter((id) => !newIds.has(id));
  return { added, removed, newIds };
}

/** True when `next` has the same nodes as `previous`, just in a different order. */
export function isSameMembership(
  previous: ICollection[],
  next: ICollection[],
): boolean {
  const a = idsOf(previous);
  const b = idsOf(next);
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

/** Saves a new order for one side's collections, without changing their nodes. */
export async function writeSideOrder(
  nodeId: string,
  side: Side,
  value: ICollection[],
): Promise<void> {
  await db.collection(NODES).doc(nodeId).update({ [side]: value });
}

// ──────── Subtree traversal ────────

/**
 * Visits every specialization below `rootId` (not the root itself). `apply`
 * returns the update to save for a node, or `null` to skip it. When
 * `descendPastSkipped` is false, skipping a node also skips everything below
 * it — so a node that owns or overrides a property shields its children.
 */
export async function walkSpecializations(
  rootId: string,
  apply: (node: INode, nodeId: string) => Record<string, any> | null,
  { descendPastSkipped = true }: { descendPastSkipped?: boolean } = {},
): Promise<void> {
  const visited = new Set<string>([rootId]);
  const rootSnap = await db.collection(NODES).doc(rootId).get();
  const rootData = rootSnap.data() as INode | undefined;
  if (!rootData) return;

  const queue = specializationIds(rootData).filter((id) => !visited.has(id));
  queue.forEach((id) => visited.add(id));

  let batch = db.batch();
  let pending = 0;

  while (queue.length > 0) {
    const currentId = queue.shift() as string;
    const snap = await db.collection(NODES).doc(currentId).get();
    const data = snap.data() as INode | undefined;
    if (!data) continue;

    const update = apply(data, currentId);
    if (update) {
      batch.update(snap.ref, update);
      pending += 1;
      if (pending >= MAX_TRANSACTION_WRITES) {
        await batch.commit();
        batch = db.batch();
        pending = 0;
      }
    } else if (!descendPastSkipped) {
      continue; // this node shields its subtree, so don't descend
    }

    for (const childId of specializationIds(data)) {
      if (!visited.has(childId)) {
        visited.add(childId);
        queue.push(childId);
      }
    }
  }

  if (pending > 0) await batch.commit();
}

// ──────── Logging ────────

/** Writes a log entry to LOGS, attributed to `uname`. */
export const recordLogs = async (
  logs: { [key: string]: any },
  uname: string,
) => {
  try {
    if (uname === "ouhrac") return;
    const logRef = db.collection(LOGS).doc();
    const doerCreate = getDoerCreate(uname || "");
    await logRef.set({
      type: "info",
      ...logs,
      createdAt: new Date(),
      doer: uname,
      doerCreate,
    });
  } catch (error) {
    console.error(error);
  }
};

/**
 * Writes a NodeChange to NODES_LOGS, then updates the node's contributors and
 * the user's last-activity time. Pass `preGeneratedId` so child logs can point
 * back to the parent via `triggeredBy.logId`.
 */
export async function writeChangeLog(
  change: NodeChange,
  preGeneratedId?: string,
): Promise<void> {
  if (!change.modifiedBy) return;
  const diffValue = computeDiffValue(change);
  if (diffValue) change.diffValue = diffValue;
  const logRef = preGeneratedId
    ? db.collection(NODES_LOGS).doc(preGeneratedId)
    : db.collection(NODES_LOGS).doc();
  await logRef.set(change as any);
  if (change.modifiedBy === "ouhrac") return;
  await db.collection(USERS).doc(change.modifiedBy).update({
    lasChangeMadeAt: new Date(),
  });
  const nodeUpdates: Record<string, any> = {
    contributors: FieldValue.arrayUnion(change.modifiedBy),
  };
  if (change.modifiedProperty) {
    nodeUpdates[`contributorsByProperty.${change.modifiedProperty}`] =
      FieldValue.arrayUnion(change.modifiedBy);
  }
  await db.collection(NODES).doc(change.nodeId).update(nodeUpdates);
}

// ──────── Node fetching & root lookup ────────

export type NodeCache = Map<string, INode | undefined>;

export async function getNode(
  id: string,
  cache: NodeCache,
): Promise<INode | undefined> {
  if (cache.has(id)) return cache.get(id);
  const data = (await db.collection(NODES).doc(id).get()).data() as
    | INode
    | undefined;
  cache.set(id, data);
  return data;
}

/** Finds the root node for a node's type (one root per app + nodeType). */
export async function findRootId(node: INode): Promise<string | undefined> {
  if (!node.nodeType) return undefined;
  let q = db
    .collection(NODES)
    .where("root", "==", true)
    .where("nodeType", "==", node.nodeType)
    .where("deleted", "==", false);
  if (node.appName) q = q.where("appName", "==", node.appName);
  const snap = await q.limit(1).get();
  return snap.empty ? undefined : snap.docs[0].id;
}

// ──────── Orphan detection & cycle checks ────────

export type Reparent = { orphanId: string; rootId: string };

/**
 * Finds nodes that a removal would leave with no generalization, and the root
 * each should move under. Looks up the roots first, so a missing root fails
 * before anything is written. Two cases: this node loses its last
 * generalization, or a removed child loses its last generalization.
 */
export async function collectOrphanReparents(
  side: Side,
  nodeId: string,
  nodeData: INode,
  removed: string[],
  newIds: Set<string>,
  cache: NodeCache,
): Promise<Reparent[]> {
  const reparents: Reparent[] = [];
  if (side === "generalizations" && newIds.size === 0) {
    const rootId = await findRootId(nodeData);
    if (!rootId) {
      throw new HttpError(
        400,
        "No root node found to reparent this node under.",
      );
    }
    reparents.push({ orphanId: nodeId, rootId });
  }
  if (side === "specializations") {
    for (const id of removed) {
      const spec = await getNode(id, cache);
      if (!spec) continue;
      const remainingGens = generalizationIds(spec).filter((g) => g !== nodeId);
      if (remainingGens.length === 0) {
        const rootId = await findRootId(spec);
        if (!rootId) {
          throw new HttpError(
            400,
            `No root node found to reparent "${spec.title ?? id}" under.`,
          );
        }
        reparents.push({ orphanId: id, rootId });
      }
    }
  }
  return reparents;
}

/** Rejects the whole save if any added edge would create a cycle. */
export async function assertNoCycle(
  side: Side,
  nodeId: string,
  addedIds: string[],
): Promise<void> {
  for (const id of addedIds) {
    const wouldCycle =
      side === "generalizations"
        ? await isReachableAlongSpecializations(db, nodeId, id)
        : await isReachableAlongSpecializations(db, id, nodeId);
    if (wouldCycle) {
      throw new HttpError(
        400,
        "This link would create a cycle in the hierarchy.",
      );
    }
  }
}

// ──────── Reciprocal edge updates ────────

/** Takes `nodeId` off the opposite side of each removed link; logs each. */
export async function applyReciprocityRemove(
  nodeId: string,
  opposite: Side,
  removedIds: string[],
  cache: NodeCache,
  parentLog: NodeChange["triggeredBy"],
  uname: string | undefined,
  appName: string | undefined,
  childLogs: NodeChange[],
): Promise<void> {
  for (const id of removedIds) {
    const linked = await getNode(id, cache);
    if (!linked) continue;
    const before = asCollections(linked[opposite]);
    const after: ICollection[] = JSON.parse(JSON.stringify(before));
    for (const c of after) {
      c.nodes = (c.nodes || []).filter((n) => n.id !== nodeId);
    }
    await db
      .collection(NODES)
      .doc(id)
      .update({ [opposite]: after });
    cache.set(id, { ...linked, [opposite]: after });
    if (uname) {
      childLogs.push({
        nodeId: id,
        modifiedBy: uname,
        modifiedProperty: opposite,
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
 * Adds `nodeId` to the opposite side of each added link; logs each. Lands in
 * `main` by default, or in `collectionName` when given (e.g. move's target
 * collection on the new parent).
 */
export async function applyReciprocityAdd(
  nodeId: string,
  nodeTitle: string,
  opposite: Side,
  addedIds: string[],
  cache: NodeCache,
  parentLog: NodeChange["triggeredBy"],
  uname: string | undefined,
  appName: string | undefined,
  childLogs: NodeChange[],
  collectionName?: string,
): Promise<void> {
  for (const id of addedIds) {
    const linked = await getNode(id, cache);
    if (!linked) continue;
    const before = asCollections(linked[opposite]);
    const after: ICollection[] = JSON.parse(JSON.stringify(before));
    const added =
      collectionName && collectionName !== "main"
        ? addToCollection(after, collectionName, { id: nodeId, title: nodeTitle })
        : addToMain(after, { id: nodeId, title: nodeTitle });
    if (!added) continue;
    await db
      .collection(NODES)
      .doc(id)
      .update({ [opposite]: after });
    cache.set(id, { ...linked, [opposite]: after });
    if (uname) {
      childLogs.push({
        nodeId: id,
        modifiedBy: uname,
        modifiedProperty: opposite,
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
}

// ──────── Inheritance recompute ────────

/**
 * Recomputes which properties `nodeId` inherits from its current
 * generalizations, then pushes the result down to its specializations. For
 * each inherited property: keep it if a generalization still provides it, move
 * it to one that owns it, or drop it if none do. Properties the generalizations
 * have but the node lacks get added.
 * `parts`/`isPartOf` are skipped — they inherit through their own model
 * (`partsOverallSource` + the parts cascade), not by inheritance ref.
 */
export async function recomputeInheritance(
  nodeId: string,
  cache: NodeCache,
): Promise<void> {
  const node = await getNode(nodeId, cache);
  if (!node) return;
  const gens = generalizationIds(node);

  const titleOf = async (id: string) => (await getNode(id, cache))?.title ?? "";

  const deleted: string[] = [];
  const repoint: Record<string, { ref: string; title: string }> = {};
  for (const property in node.inheritance || {}) {
    if (PARTS_EDGES.has(property)) continue;
    const ref = node.inheritance[property]?.ref;
    if (!ref) continue; // the node owns this value, nothing to recompute

    let reachable = false;
    const owners: string[] = [];
    for (const genId of gens) {
      const gen = await getNode(genId, cache);
      if (!gen) continue;
      if (ref === genId || ref === gen.inheritance?.[property]?.ref) {
        reachable = true;
        break;
      }
      if (hasOwn(gen.properties, property)) owners.push(genId);
    }
    if (reachable) continue;

    if (owners.length > 0) {
      const owner = await getNode(owners[0], cache);
      const targetRef = owner?.inheritance?.[property]?.ref || owners[0];
      repoint[property] = { ref: targetRef, title: await titleOf(targetRef) };
    } else {
      deleted.push(property);
    }
  }

  const added: Record<
    string,
    { value: any; type: string; ref: string; title: string }
  > = {};
  for (const genId of gens) {
    const gen = await getNode(genId, cache);
    if (!gen) continue;
    for (const property in gen.properties || {}) {
      if (PARTS_EDGES.has(property)) continue;
      if (hasOwn(node.properties, property) || added[property]) continue;
      const targetRef = gen.inheritance?.[property]?.ref || genId;
      const type = (gen.propertyType as any)?.[property];
      const value =
        gen.inheritance?.[property]?.inheritanceType === "neverInherit"
          ? defaultValueForProperty(type)
          : gen.properties[property];
      added[property] = {
        value,
        type,
        ref: targetRef,
        title: await titleOf(targetRef),
      };
    }
  }

  if (
    deleted.length === 0 &&
    Object.keys(repoint).length === 0 &&
    Object.keys(added).length === 0
  ) {
    return;
  }

  const del = FieldValue.delete();
  const deleteFields = (p: string) => ({
    [`inheritance.${p}`]: del,
    [`properties.${p}`]: del,
    [`textValue.${p}`]: del,
    [`propertyType.${p}`]: del,
  });
  const repointFields = (p: string) => ({
    [`inheritance.${p}.ref`]: repoint[p].ref,
    [`inheritance.${p}.title`]: repoint[p].title,
  });
  const addFields = (p: string) => {
    const u: Record<string, any> = {
      [`inheritance.${p}`]: {
        inheritanceType: "inheritUnlessAlreadyOverRidden",
        ref: added[p].ref,
        title: added[p].title,
      },
      [`properties.${p}`]: added[p].value,
    };
    if (added[p].type) u[`propertyType.${p}`] = added[p].type;
    return u;
  };

  // The node itself inherited through the removed link, so update it directly.
  const rootUpdate: Record<string, any> = {};
  for (const p of deleted) Object.assign(rootUpdate, deleteFields(p));
  for (const p in repoint) Object.assign(rootUpdate, repointFields(p));
  for (const p in added) Object.assign(rootUpdate, addFields(p));
  if (Object.keys(rootUpdate).length) {
    await db.collection(NODES).doc(nodeId).update(rootUpdate);
  }

  // One property at a time. Each walk stops at a descendant that blocks
  // inheritance (it overrode the property, can't inherit, or owns it).
  const inheritsProp = (d: INode, p: string) => {
    const inh = d.inheritance?.[p];
    return !!inh && inh.inheritanceType !== "neverInherit" && inh.ref !== null;
  };
  for (const p of deleted) {
    await walkSpecializations(
      nodeId,
      (d) => (inheritsProp(d, p) ? deleteFields(p) : null),
      { descendPastSkipped: false },
    );
  }
  for (const p in repoint) {
    await walkSpecializations(
      nodeId,
      (d) => {
        const inh = d.inheritance?.[p];
        if (!inh || inh.inheritanceType === "neverInherit") return null;
        const canInherit =
          inh.inheritanceType === "alwaysInherit" ||
          (inh.inheritanceType === "inheritUnlessAlreadyOverRidden" &&
            inh.ref !== null);
        return canInherit ? repointFields(p) : null;
      },
      { descendPastSkipped: false },
    );
  }
  for (const p in added) {
    await walkSpecializations(
      nodeId,
      (d) => (hasOwn(d.properties, p) ? null : addFields(p)),
      { descendPastSkipped: false },
    );
  }
}

// ──────── Reparenting orphans ────────

/**
 * Moves an orphaned node under its type's root: the orphan gets the root as a
 * generalization (in `main`), and the root gets the orphan as a specialization
 * in its `unclassified` collection. Both sides log an "add element" change. The
 * orphan is re-read fresh because the caller just changed its generalizations.
 */
export async function reparentToUnclassified(
  orphanId: string,
  rootId: string,
  cache: NodeCache,
  parentLog: NodeChange["triggeredBy"],
  uname: string | undefined,
  appName: string | undefined,
  childLogs: NodeChange[],
): Promise<void> {
  cache.delete(orphanId);
  const orphan = await getNode(orphanId, cache);
  const root = await getNode(rootId, cache);
  if (!orphan || !root) return;

  const orphanGens = asCollections(orphan.generalizations);
  if (addToMain(orphanGens, { id: rootId, title: root.title ?? "" })) {
    await db
      .collection(NODES)
      .doc(orphanId)
      .update({ generalizations: orphanGens });
    if (uname) {
      childLogs.push({
        nodeId: orphanId,
        modifiedBy: uname,
        modifiedProperty: "generalizations",
        previousValue: asCollections(orphan.generalizations),
        newValue: orphanGens,
        modifiedAt: new Date(),
        changeType: "add element",
        fullNode: orphan,
        triggeredBy: parentLog,
        ...(appName ? { appName } : {}),
      } as NodeChange);
    }
    cache.set(orphanId, { ...orphan, generalizations: orphanGens });
  }

  const rootSpecs = asCollections(root.specializations);
  if (
    addToCollection(rootSpecs, UNCLASSIFIED_COLLECTION, {
      id: orphanId,
      title: orphan.title ?? "",
    })
  ) {
    await db
      .collection(NODES)
      .doc(rootId)
      .update({ specializations: rootSpecs });
    if (uname) {
      childLogs.push({
        nodeId: rootId,
        modifiedBy: uname,
        modifiedProperty: "specializations",
        previousValue: asCollections(root.specializations),
        newValue: rootSpecs,
        modifiedAt: new Date(),
        changeType: "add element",
        fullNode: root,
        triggeredBy: parentLog,
        ...(appName ? { appName } : {}),
      } as NodeChange);
    }
    cache.set(rootId, { ...root, specializations: rootSpecs });
  }
}

/**
 * The opposite of `reparentToUnclassified`: when a node in a root's
 * `unclassified` collection gains a real generalization, drop the root link and
 * its entry in that collection (each logged as "remove element"), unless the
 * root is its only generalization. Returns the removed root's id, or null.
 */
export async function removeFromUnclassified(
  nodeId: string,
  cache: NodeCache,
  parentLog: NodeChange["triggeredBy"],
  uname: string | undefined,
  appName: string | undefined,
  childLogs: NodeChange[],
): Promise<string | null> {
  cache.delete(nodeId);
  const node = await getNode(nodeId, cache);
  if (!node) return null;
  const genIds = generalizationIds(node);

  let parkedRootId: string | undefined;
  for (const gid of genIds) {
    const root = await getNode(gid, cache);
    if (!root?.root) continue;
    const parked = (root.specializations || []).some(
      (c) =>
        c.collectionName === UNCLASSIFIED_COLLECTION &&
        (c.nodes || []).some((n) => n.id === nodeId),
    );
    if (parked) {
      parkedRootId = gid;
      break;
    }
  }
  if (!parkedRootId) return null;
  if (genIds.filter((id) => id !== parkedRootId).length === 0) return null;

  const root = await getNode(parkedRootId, cache);
  if (!root) return null;

  const beforeGens = asCollections(node.generalizations);
  const afterGens: ICollection[] = beforeGens.map((c) => ({
    ...c,
    nodes: (c.nodes || []).filter((n) => n.id !== parkedRootId),
  }));
  await db.collection(NODES).doc(nodeId).update({ generalizations: afterGens });
  cache.set(nodeId, { ...node, generalizations: afterGens });
  if (uname) {
    childLogs.push({
      nodeId,
      modifiedBy: uname,
      modifiedProperty: "generalizations",
      previousValue: beforeGens,
      newValue: afterGens,
      modifiedAt: new Date(),
      changeType: "remove element",
      fullNode: node,
      triggeredBy: parentLog,
      ...(appName ? { appName } : {}),
    } as NodeChange);
  }

  const beforeSpecs = asCollections(root.specializations);
  const afterSpecs: ICollection[] = beforeSpecs.map((c) =>
    c.collectionName === UNCLASSIFIED_COLLECTION
      ? { ...c, nodes: (c.nodes || []).filter((n) => n.id !== nodeId) }
      : c,
  );
  await db
    .collection(NODES)
    .doc(parkedRootId)
    .update({ specializations: afterSpecs });
  cache.set(parkedRootId, { ...root, specializations: afterSpecs });
  if (uname) {
    childLogs.push({
      nodeId: parkedRootId,
      modifiedBy: uname,
      modifiedProperty: "specializations",
      previousValue: beforeSpecs,
      newValue: afterSpecs,
      modifiedAt: new Date(),
      changeType: "remove element",
      fullNode: root,
      triggeredBy: parentLog,
      ...(appName ? { appName } : {}),
    } as NodeChange);
  }

  return parkedRootId;
}

/**
 * Builds a new node that is a child of `source` and inherits its properties.
 * Only returns the object; the caller writes it to the database.
 */
export function buildSpecializationNode(
  source: INode,
  newNodeId: string,
  title: string,
  uname: string,
  appName?: string,
): INode {
  const inheritance: any = JSON.parse(JSON.stringify(source.inheritance || {}));
  for (const property in inheritance) {
    if (inheritance[property].title === undefined) inheritance[property].title = "";
    if (!inheritance[property].ref && property !== "isPartOf") {
      inheritance[property].ref = source.id;
      inheritance[property].title = source.title ?? "";
    }
  }

  const properties: any = {};
  for (const property in source.properties || {}) {
    if (source.inheritance?.[property]?.inheritanceType === "neverInherit") {
      properties[property] = defaultValueForProperty(
        (source.propertyType as any)?.[property],
      );
      if (inheritance[property]) {
        inheritance[property].ref = null;
        inheritance[property].title = "";
      }
    } else {
      properties[property] = source.properties[property];
    }
  }

  // Parts don't inherit by ref: the child stores its own list, each part tagged
  // with the node that OWNS it, and attaches to `source` as its overall source.
  const sourceParts = partsNodesOf(source.properties?.parts);
  properties.parts = [
    {
      collectionName: "main",
      nodes: sourceParts.map((p) => ({
        ...p,
        inheritedFrom: childSourceOf(p, source.id),
      })),
    },
  ];
  const partsRef = overallRefThroughGen({
    id: source.id,
    ref: source.inheritance?.parts?.ref ?? null,
    parts: sourceParts,
  });
  inheritance.parts = {
    ref: partsRef,
    title:
      partsRef === source.id
        ? source.title ?? ""
        : source.inheritance?.parts?.title ?? "",
    inheritanceType:
      source.inheritance?.parts?.inheritanceType ?? "inheritUnlessAlreadyOverRidden",
  };

  const newNode: any = {
    ...source,
    id: newNodeId,
    title,
    partsOverallSource: source.id,
    createdBy: uname,
    contributors: [],
    contributorsByProperty: {},
    textValue: {},
    unclassified: false,
    deleted: false,
    locked: false,
    inheritance,
    specializations: [{ collectionName: "main", nodes: [] }],
    generalizations: [
      {
        collectionName: "main",
        nodes: [{ id: source.id, title: source.title ?? "" }],
      },
    ],
    propertyOf: {},
    numberOfGeneralizations: (source.numberOfGeneralizations || 0) + 1,
    properties: { ...properties, isPartOf: [{ collectionName: "main", nodes: [] }] },
    propertyType: { ...(source.propertyType || {}) },
    nodeType: source.nodeType,
    ...(appName ? { appName } : {}),
    createdAt: new Date(),
  };
  delete newNode.root;
  delete newNode.oNetTask;
  if (newNode?.textValue?.specializations) delete newNode.textValue.specializations;
  if (newNode?.textValue?.generalizations) delete newNode.textValue.generalizations;
  if (newNode.properties?.["ONetID"]) {
    delete newNode.properties["ONetID"];
    delete newNode.propertyType?.["ONetID"];
  }
  return newNode as INode;
}

// ──────── Endpoint context type ────────

export type ChangeCtx = {
  nodeId: string;
  nodeData: INode;
  side: Side;
  value: ICollection[];
  uname?: string;
  appName?: string;
};
