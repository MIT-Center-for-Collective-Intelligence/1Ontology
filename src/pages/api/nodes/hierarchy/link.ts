import type { NextApiRequest, NextApiResponse } from "next";
import fbAuth from "@components/middlewares/fbAuth";
import { db } from "@components/lib/firestoreServer/admin";
import { NODES, NODES_LOGS } from "@components/lib/firestoreClient/collections";
import { INode, NodeChange } from "@components/types/INode";
import { updateDerivedPaths } from "@components/lib/server/updateDerivedPaths";
import {
  HttpError,
  Side,
  ChangeCtx,
  NodeCache,
  oppositeOf,
  asCollections,
  sanitizeCollections,
  diffSides,
  assertNoCycle,
  collectOrphanReparents,
  applyReciprocityAdd,
  applyReciprocityRemove,
  reparentToUnclassified,
  removeFromUnclassified,
  recomputeInheritance,
  writeChangeLog,
  recordLogs,
} from "@components/lib/server/hierarchy";
import { applyPartsForGenChange } from "@components/lib/server/parts";

/**
 * Saves a node's specializations or generalizations. This is the full editor:
 * the client sends the complete new value for the side, so one save can both
 * add and remove links.
 */
async function applyLink(ctx: ChangeCtx): Promise<{ ok: true }> {
  const { nodeId, nodeData, side, value, uname, appName } = ctx;
  const opposite = oppositeOf(side);
  const cache: NodeCache = new Map([[nodeId, nodeData]]);

  const previousValue = asCollections(nodeData[side]);
  const { added, removed, newIds } = diffSides(previousValue, value);
  if (added.length === 0 && removed.length === 0) return { ok: true };

  await assertNoCycle(side, nodeId, added);

  // Work out orphan moves first, so a missing root fails before any write.
  const reparents = await collectOrphanReparents(
    side,
    nodeId,
    nodeData,
    removed,
    newIds,
    cache,
  );

  const parentLogId = db.collection(NODES_LOGS).doc().id;
  const parentLog = {
    logId: parentLogId,
    nodeId,
    nodeTitle: nodeData.title ?? "",
    changeType: "modify elements" as const,
  };

  await db.collection(NODES).doc(nodeId).update({ [side]: value });

  const childLogs: NodeChange[] = [];
  await applyReciprocityRemove(
    nodeId,
    opposite,
    removed,
    cache,
    parentLog,
    uname,
    appName,
    childLogs,
  );
  await applyReciprocityAdd(
    nodeId,
    nodeData.title ?? "",
    opposite,
    added,
    cache,
    parentLog,
    uname,
    appName,
    childLogs,
  );

  // Move orphans before recomputing inheritance, so the recompute sees the
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

  // The inverse of reparenting: a node that just gained a real generalization
  // leaves its root's unclassified collection.
  if (side === "generalizations") {
    if (added.length > 0) {
      await removeFromUnclassified(
        nodeId,
        cache,
        parentLog,
        uname,
        appName,
        childLogs,
      );
    }
  } else {
    for (const id of added) {
      await removeFromUnclassified(
        id,
        cache,
        parentLog,
        uname,
        appName,
        childLogs,
      );
    }
  }

  // Editing generalizations recomputes this node; editing specializations
  // recomputes each child whose generalizations changed.
  if (side === "generalizations") {
    cache.delete(nodeId); // re-read so we see the generalizations we just saved
    await recomputeInheritance(nodeId, cache);
    await applyPartsForGenChange(
      nodeId,
      removed,
      cache,
      parentLog,
      uname,
      appName,
      childLogs,
    );
  } else {
    for (const id of [...added, ...removed]) {
      cache.delete(id);
      await recomputeInheritance(id, cache);
      await applyPartsForGenChange(
        id,
        removed.includes(id) ? [nodeId] : [],
        cache,
        parentLog,
        uname,
        appName,
        childLogs,
      );
    }
  }

  // Only nodes whose generalizations changed need their paths recomputed: this
  // node when editing generalizations, the added/removed children when editing
  // specializations. Linked parents and the reparent root keep their own paths.
  await updateDerivedPaths({
    db,
    changedNodeIds:
      side === "generalizations" ? [nodeId] : [...added, ...removed],
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

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") return fail(res, 405, "Method not allowed");
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
  if (!value) return fail(res, 400, "value must be an array of collections");

  try {
    const nodeData = (await db.collection(NODES).doc(nodeId).get()).data() as
      | INode
      | undefined;
    if (!nodeData || nodeData.deleted) return fail(res, 404, "Node not found");
    if (appName && nodeData.appName && nodeData.appName !== appName) {
      return fail(res, 403, "Node does not belong to this app");
    }

    const result = await applyLink({
      nodeId,
      nodeData,
      side,
      value,
      uname,
      appName,
    });
    return res.status(200).json(result);
  } catch (error: any) {
    if (error instanceof HttpError) return fail(res, error.status, error.message);
    console.error("nodes/hierarchy/link error", error);
    recordLogs(
      {
        type: "error",
        error: JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
        at: "nodes/hierarchy/link",
      },
      uname,
    );
    const message = error?.message || "Internal error";
    return res.status(500).json({ error: message, message });
  }
};

export default fbAuth(handler);
