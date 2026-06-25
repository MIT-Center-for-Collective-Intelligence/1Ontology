import type { NextApiRequest, NextApiResponse } from "next";
import fbAuth from "@components/middlewares/fbAuth";
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
import { ICollection, INode, NodeChange } from "@components/types/INode";
import {
  isReachableAlongSpecializations,
  updateDerivedPaths,
} from "@components/lib/server/updateDerivedPaths";

/**
 * Saves a node's `specializations` or `generalizations`. The client sends the
 * full new value for the edited side. The server stores it, mirrors it onto
 * each linked node's opposite side, recomputes inheritance, refreshes derived
 * paths, and logs the change.
 */

type Side = "specializations" | "generalizations";

const PARTS_EDGES = new Set(["parts", "isPartOf"]);

// Orphaned nodes are reparented under their type's root in this collection.
const UNCLASSIFIED_COLLECTION = "unclassified";

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const hasOwn = (obj: any, key: string) =>
  !!obj && Object.prototype.hasOwnProperty.call(obj, key);

const oppositeOf = (side: Side): Side =>
  side === "specializations" ? "generalizations" : "specializations";

/** Checks the incoming collections; returns null if malformed. */
function sanitizeCollections(value: any, selfId: string): ICollection[] | null {
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
function asCollections(value: any): ICollection[] {
  if (Array.isArray(value) && value.length > 0) {
    return JSON.parse(JSON.stringify(value));
  }
  return [{ collectionName: "main", nodes: [] }];
}

/** All node ids across every collection. */
function idsOf(collections: ICollection[]): Set<string> {
  return new Set(collections.flatMap((c) => c.nodes.map((n) => n.id)));
}

/** Adds a node to `main`; returns false if it's already there. */
function addToMain(
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
function addToCollection(
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

function specializationIds(node: Pick<INode, "specializations">): string[] {
  return (node.specializations || []).flatMap((collection) =>
    (collection.nodes || []).map((n) => n.id),
  );
}

function generalizationIds(node: Pick<INode, "generalizations">): string[] {
  return (node.generalizations || []).flatMap((collection) =>
    (collection.nodes || []).map((n) => n.id),
  );
}

/** Starting value for a newly inherited property that carries no value. */
function defaultValueForProperty(propertyType: string): any {
  if (propertyType === "string-array") return [];
  if (propertyType === "numeric") return 0;
  return "";
}

/**
 * Walks the specialization subtree below `rootId` (root itself is skipped).
 * `apply` returns a Firestore update to batch, or `null` to skip the node.
 * With `descendPastSkipped` false, a skipped node also stops the walk into its
 * subtree — so a node that owns or overrides a property shields its children.
 */
async function walkSpecializations(
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

/** Writes a log entry to LOGS, attributed to `uname`. */
const recordLogs = async (logs: { [key: string]: any }, uname: string) => {
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
async function writeChangeLog(
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

type NodeCache = Map<string, INode | undefined>;

async function getNode(id: string, cache: NodeCache): Promise<INode | undefined> {
  if (cache.has(id)) return cache.get(id);
  const data = (await db.collection(NODES).doc(id).get()).data() as
    | INode
    | undefined;
  cache.set(id, data);
  return data;
}

/** Finds the root node for a node's type (one root per app + nodeType). */
async function findRootId(node: INode): Promise<string | undefined> {
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

/**
 * Re-resolves `nodeId`'s inherited properties against its current
 * generalizations, then cascades the result down the subtree. For each
 * inherited property: keep it if a current generalization still provides it,
 * re-point it to one that owns it, or delete it if none do. Properties the
 * generalizations provide but the node lacks are added.
 * `parts`/`isPartOf` are skipped — those inherit via `inheritanceParts`.
 */
async function recomputeInheritance(
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
    if (!ref) continue; // the node owns this value, nothing to re-resolve

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
      added[property] = { value, type, ref: targetRef, title: await titleOf(targetRef) };
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

  // Cascade one property at a time. Each walk stops at a descendant that
  // shields its subtree (it overrode the property, can't inherit, or owns it).
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

/**
 * Reparents an orphaned node under its type's root: the orphan gains the root
 * as a generalization (`main`), and the root gains the orphan as a
 * specialization in its `unclassified` collection. Both sides emit an
 * "add element" child log. The orphan is re-read fresh because the caller just
 * wrote its side / its reciprocal generalizations.
 */
async function reparentToUnclassified(
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
    await db.collection(NODES).doc(orphanId).update({ generalizations: orphanGens });
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
    await db.collection(NODES).doc(rootId).update({ specializations: rootSpecs });
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

type ChangeCtx = {
  nodeId: string;
  nodeData: INode;
  side: Side;
  value: ICollection[];
  uname?: string;
  appName?: string;
};

async function changeHierarchy(ctx: ChangeCtx): Promise<{ ok: true }> {
  const { nodeId, nodeData, side, value, uname, appName } = ctx;
  const opposite = oppositeOf(side);
  const cache: NodeCache = new Map([[nodeId, nodeData]]);

  const previousValue = asCollections(nodeData[side]);
  const prevIds = idsOf(previousValue);
  const newIds = idsOf(value);
  const added = [...newIds].filter((id) => !prevIds.has(id));
  const removed = [...prevIds].filter((id) => !newIds.has(id));
  if (added.length === 0 && removed.length === 0) return { ok: true };

  // A node left with no generalization is reparented under its type's root
  // (the `unclassified` collection), never rejected. Resolve the roots up
  // front so a missing root aborts before any write. gen-side: this node
  // empties; spec-side: a removed child is left with no other generalization.
  const reparents: { orphanId: string; rootId: string }[] = [];
  if (side === "generalizations" && newIds.size === 0) {
    const rootId = await findRootId(nodeData);
    if (!rootId) {
      throw new HttpError(400, "No root node found to reparent this node under.");
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

  // Reject the entire save if any new link would create a cycle.
  for (const id of added) {
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

  const parentLogId = db.collection(NODES_LOGS).doc().id;
  const parentLog = {
    logId: parentLogId,
    nodeId,
    nodeTitle: nodeData.title ?? "",
    changeType: "modify elements" as const,
  };

  await db.collection(NODES).doc(nodeId).update({ [side]: value });

  const childLogs: NodeChange[] = [];

  // Removals: take this node off the opposite side of each removed link.
  for (const id of removed) {
    const linked = await getNode(id, cache);
    if (!linked) continue;
    const before = asCollections(linked[opposite]);
    const after: ICollection[] = JSON.parse(JSON.stringify(before));
    for (const c of after) {
      c.nodes = (c.nodes || []).filter((n) => n.id !== nodeId);
    }
    await db.collection(NODES).doc(id).update({ [opposite]: after });
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

  // Additions: add this node to the opposite side of each new link.
  for (const id of added) {
    const linked = await getNode(id, cache);
    if (!linked) continue;
    const before = asCollections(linked[opposite]);
    const after: ICollection[] = JSON.parse(JSON.stringify(before));
    if (!addToMain(after, { id: nodeId, title: nodeData.title ?? "" })) continue;
    await db.collection(NODES).doc(id).update({ [opposite]: after });
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

  // Reparent orphans under their root before recompute, so recompute sees the
  // root as the new generalization.
  for (const { orphanId, rootId } of reparents) {
    await reparentToUnclassified(
      orphanId,
      rootId,
      cache,
      parentLog,
      uname,
      appName,
      childLogs,
    );
  }

  // Recompute inheritance: a generalizations edit re-resolves this node; a
  // specializations edit re-resolves each child whose generalizations changed.
  if (side === "generalizations") {
    cache.delete(nodeId); // re-read so we see the generalizations just written
    await recomputeInheritance(nodeId, cache);
  } else {
    for (const id of [...added, ...removed]) {
      cache.delete(id);
      await recomputeInheritance(id, cache);
    }
  }

  await updateDerivedPaths({
    db,
    changedNodeIds: [
      ...new Set([nodeId, ...added, ...removed, ...reparents.map((r) => r.rootId)]),
    ],
  });

  if (uname) {
    await writeChangeLog(
      {
        nodeId,
        modifiedBy: uname,
        modifiedProperty: side,
        previousValue,
        newValue: value,
        modifiedAt: new Date(),
        changeType: "modify elements",
        fullNode: nodeData,
        ...(appName ? { appName } : {}),
      } as NodeChange,
      parentLogId,
    );
  }
  for (const log of childLogs) await writeChangeLog(log);

  return { ok: true };
}

function fail(res: NextApiResponse, status: number, msg: string) {
  return res.status(status).json({ error: msg, message: msg });
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return fail(res, 405, "Method not allowed");
  console.log("Hierarchy Update triggered");
  const data = req.body.data;
  const { nodeId, side, appName, user } = data as {
    nodeId?: string;
    side?: Side;
    appName?: string;
    user?: any;
  };
  const { uname } = user?.userData || {};

  if (!nodeId || typeof nodeId !== "string") {
    return fail(res, 400, "nodeId is required");
  }
  if (side !== "specializations" && side !== "generalizations") {
    return fail(res, 400, "side must be 'specializations' or 'generalizations'");
  }
  const value = sanitizeCollections(data.value, nodeId);
  if (!value) {
    return fail(res, 400, "value must be an array of collections");
  }

  try {
    const nodeData = (await db.collection(NODES).doc(nodeId).get()).data() as
      | INode
      | undefined;
    if (!nodeData || nodeData.deleted) return fail(res, 404, "Node not found");
    if (appName && nodeData.appName && nodeData.appName !== appName) {
      return fail(res, 403, "Node does not belong to this app");
    }

    const result = await changeHierarchy({
      nodeId,
      nodeData,
      side,
      value,
      uname,
      appName,
    });
    console.log("FINISHED: Hierarchy Update");
    return res.status(200).json(result);
  } catch (error: any) {
    console.log("Error in Hierarchy Update", error);
    if (error instanceof HttpError) {
      return fail(res, error.status, error.message);
    }
    console.error("nodes/hierarchy/update error", error);
    recordLogs(
      {
        type: "error",
        error: JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
        at: "nodes/hierarchy/update",
      },
      uname,
    );
    const message = error?.message || "Internal error";
    return res.status(500).json({ error: message, message });
  }
}

export default fbAuth(handler);
