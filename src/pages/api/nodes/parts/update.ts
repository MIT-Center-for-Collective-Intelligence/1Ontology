import type { NextApiRequest, NextApiResponse } from "next";
import fbAuth from "@components/middlewares/fbAuth";
import { db } from "@components/lib/firestoreServer/admin";
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

/**
 * Saves a node's `parts`. The client sends the full new value; the server
 * stores it, mirrors each change onto the linked nodes' `isPartOf`, and logs it.
 */

/** Validates the incoming collections; returns null if malformed. */
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
      if (n.id === selfId || seen.has(n.id)) continue; // no self-link, no dupes
      seen.add(n.id);
      const node: any = {
        id: n.id,
        title: typeof n.title === "string" ? n.title : "",
      };
      if (n.optional === true) node.optional = true;
      // Ownership tags belong to the new parts model; wiping them here would
      // mis-classify inherited parts as owned on the next model write.
      if (typeof n.inheritedFrom === "string") {
        node.inheritedFrom = n.inheritedFrom;
      }
      nodes.push(node);
    }
    out.push({ collectionName: c.collectionName, nodes });
  }
  return out;
}

/** Reads a stored value as collections, defaulting to an empty `main`. */
function asCollections(value: any): ICollection[] {
  if (Array.isArray(value) && value.length > 0) {
    return JSON.parse(JSON.stringify(value));
  }
  return [{ collectionName: "main", nodes: [] }];
}

/** Every node id in a collections value. */
function idsOf(collections: ICollection[]): Set<string> {
  return new Set(collections.flatMap((c) => c.nodes.map((n) => n.id)));
}

/** Adds a node to the `main` collection; returns false if already there. */
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

/** Writes a log to LOGS under `uname`. */
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

/** Logs a NodeChange and updates the user's last-activity time. */
async function writeChangeLog(change: NodeChange): Promise<void> {
  if (!change.modifiedBy) return;
  const diffValue = computeDiffValue(change);
  if (diffValue) change.diffValue = diffValue;
  await db
    .collection(NODES_LOGS)
    .doc()
    .set(change as any);
  if (change.modifiedBy !== "ouhrac") {
    await db.collection(USERS).doc(change.modifiedBy).update({
      lasChangeMadeAt: new Date(),
    });
  }
}

/**
 * Stores the new `parts` and updates each linked node's `isPartOf`: added
 * parts gain this node, removed parts lose it. Parts are a plain own value;
 * inheritance is computed through another endpoint: `generate-inheritance-part-details`.
 */
async function changeParts(ctx: {
  nodeId: string;
  nodeData: INode;
  parts: ICollection[];
  inheritedPartsDetails?: any[];
  uname?: string;
  appName?: string;
}): Promise<{ ok: true }> {
  const { nodeId, nodeData, parts, inheritedPartsDetails, uname, appName } =
    ctx;

  const previousValue = asCollections(nodeData.properties?.parts);
  const newValue = parts;

  const prevIds = idsOf(previousValue);
  const newIds = idsOf(newValue);
  const added = [...newIds].filter((id) => !prevIds.has(id));
  const removed = [...prevIds].filter((id) => !newIds.has(id));

  const nodeUpdates: Record<string, any> = {
    [`properties.parts`]: newValue,
  };
  // Reorder/optional edits don't change inheritance, so the client sends the
  // already-patched details to store as-is. Update createdAt.
  if (Array.isArray(inheritedPartsDetails)) {
    nodeUpdates.inheritedPartsDetails = inheritedPartsDetails.map((g) => ({
      ...g,
      createdAt: new Date(),
    }));
  }
  if (uname && uname !== "ouhrac") {
    nodeUpdates.contributors = FieldValue.arrayUnion(uname);
  }
  await db.collection(NODES).doc(nodeId).update(nodeUpdates);

  // Mirror onto each linked part's `isPartOf` (add this node, or drop it) and
  // give each one its own log so the change shows in its activity feed.
  const batch = db.batch();
  const partLogs: NodeChange[] = [];
  for (const id of added) {
    const snap = await db.collection(NODES).doc(id).get();
    const d = snap.data() as INode | undefined;
    if (!d || d.deleted) continue;
    const before = asCollections(d.properties?.isPartOf);
    const after: ICollection[] = JSON.parse(JSON.stringify(before));
    if (!addToMain(after, { id: nodeId, title: nodeData.title ?? "" })) continue;
    batch.update(snap.ref, { [`properties.isPartOf`]: after });
    if (uname) {
      partLogs.push({
        nodeId: id,
        modifiedBy: uname,
        modifiedProperty: "isPartOf",
        previousValue: before,
        newValue: after,
        modifiedAt: new Date(),
        changeType: "add element",
        fullNode: d,
        ...(appName ? { appName } : {}),
      } as NodeChange);
    }
  }
  for (const id of removed) {
    const snap = await db.collection(NODES).doc(id).get();
    const d = snap.data() as INode | undefined;
    const raw = d?.properties?.isPartOf;
    if (!Array.isArray(raw)) continue;
    const before: ICollection[] = JSON.parse(JSON.stringify(raw));
    const after: ICollection[] = JSON.parse(JSON.stringify(raw));
    for (const c of after) {
      c.nodes = (c.nodes || []).filter((n) => n.id !== nodeId);
    }
    batch.update(snap.ref, { [`properties.isPartOf`]: after });
    if (uname && d) {
      partLogs.push({
        nodeId: id,
        modifiedBy: uname,
        modifiedProperty: "isPartOf",
        previousValue: before,
        newValue: after,
        modifiedAt: new Date(),
        changeType: "remove element",
        fullNode: d,
        ...(appName ? { appName } : {}),
      } as NodeChange);
    }
  }
  // Pure reorder/optional changes touch no other node, so the batch is empty.
  if (added.length || removed.length) await batch.commit();

  if (uname) {
    await writeChangeLog({
      nodeId,
      modifiedBy: uname,
      modifiedProperty: "parts",
      previousValue,
      newValue,
      modifiedAt: new Date(),
      changeType: "modify elements",
      fullNode: nodeData,
      ...(appName ? { appName } : {}),
    } as NodeChange);
  }
  for (const log of partLogs) await writeChangeLog(log);

  return { ok: true };
}

function fail(res: NextApiResponse, status: number, msg: string) {
  return res.status(status).json({ error: msg, message: msg });
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return fail(res, 405, "Method not allowed");
  const data = req.body.data;
  const { nodeId, appName, user } = data as {
    nodeId?: string;
    appName?: string;
    user?: any;
  };
  const { uname } = user?.userData || {};

  if (!nodeId || typeof nodeId !== "string") {
    return fail(res, 400, "nodeId is required");
  }

  const parts = sanitizeCollections(data.parts, nodeId);
  if (!parts) {
    return fail(res, 400, "parts must be an array of collections");
  }

  try {
    const nodeData = (await db.collection(NODES).doc(nodeId).get()).data() as
      | INode
      | undefined;
    if (!nodeData || nodeData.deleted) return fail(res, 404, "Node not found");
    if (appName && nodeData.appName && nodeData.appName !== appName) {
      return fail(res, 403, "Node does not belong to this app");
    }

    const result = await changeParts({
      nodeId,
      nodeData,
      parts,
      inheritedPartsDetails: Array.isArray(data.inheritedPartsDetails)
        ? data.inheritedPartsDetails
        : undefined,
      uname,
      appName,
    });
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("nodes/parts/update error", error);
    recordLogs(
      {
        type: "error",
        error: JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
        at: "nodes/parts/update",
      },
      uname,
    );
    const message = error?.message || "Internal error";
    return res.status(500).json({ error: message, message });
  }
}

export default fbAuth(handler);
