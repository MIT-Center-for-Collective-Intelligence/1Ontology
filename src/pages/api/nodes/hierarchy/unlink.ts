import type { NextApiRequest, NextApiResponse } from "next";
import fbAuth from "@components/middlewares/fbAuth";
import { db } from "@components/lib/firestoreServer/admin";
import { NODES, NODES_LOGS } from "@components/lib/firestoreClient/collections";
import { ICollection, INode, NodeChange } from "@components/types/INode";
import { updateDerivedPaths } from "@components/lib/server/updateDerivedPaths";
import {
  HttpError,
  Side,
  NodeCache,
  oppositeOf,
  asCollections,
  idsOf,
  collectOrphanReparents,
  applyReciprocityRemove,
  reparentToUnclassified,
  recomputeInheritance,
  writeChangeLog,
  recordLogs,
} from "@components/lib/server/hierarchy";
import { applyPartsForGenChange } from "@components/lib/server/parts";

/**
 * Removes one or more specialization/generalization links. The client sends
 * only the ids to remove, so this endpoint can only remove, and concurrent
 * unlinks are safe in any order. The server handles the rest: reverse links,
 * moving orphans under their root, inheritance, derived paths, and logs.
 */
async function applyUnlink(ctx: {
  nodeId: string;
  nodeData: INode;
  side: Side;
  removeIds: string[];
  uname?: string;
  appName?: string;
}): Promise<{ ok: true }> {
  const { nodeId, nodeData, side, removeIds, uname, appName } = ctx;
  const opposite = oppositeOf(side);
  const cache: NodeCache = new Map([[nodeId, nodeData]]);

  const previousValue = asCollections(nodeData[side]);
  const toRemove = new Set(removeIds);
  const removed: string[] = [];
  const value: ICollection[] = previousValue.map((c) => ({
    ...c,
    nodes: (c.nodes || []).filter((n) => {
      if (toRemove.has(n.id)) {
        removed.push(n.id);
        return false;
      }
      return true;
    }),
  }));
  if (removed.length === 0) return { ok: true };

  const newIds = idsOf(value);

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

  // Editing generalizations recomputes this node; editing specializations
  // recomputes each removed child whose generalizations changed.
  if (side === "generalizations") {
    cache.delete(nodeId);
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
    for (const id of removed) {
      cache.delete(id);
      await recomputeInheritance(id, cache);
      await applyPartsForGenChange(
        id,
        [nodeId],
        cache,
        parentLog,
        uname,
        appName,
        childLogs,
      );
    }
  }

  // Only nodes whose generalizations changed need their paths recomputed: this
  // node when editing generalizations, the removed children when editing
  // specializations. The old parent and the reparent root keep their own paths.
  await updateDerivedPaths({
    db,
    changedNodeIds: side === "generalizations" ? [nodeId] : removed,
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
  const rawIds: any[] | null = Array.isArray(data.removeIds)
    ? data.removeIds
    : typeof data.removeId === "string"
      ? [data.removeId]
      : null;
  if (!rawIds || !rawIds.length || !rawIds.every((id) => typeof id === "string")) {
    return fail(res, 400, "removeIds must be a non-empty array of node ids");
  }
  const removeIds: string[] = [
    ...new Set(rawIds.filter((id) => id !== nodeId) as string[]),
  ];
  if (removeIds.length === 0) {
    return fail(res, 400, "removeIds must reference other nodes");
  }

  try {
    const nodeData = (await db.collection(NODES).doc(nodeId).get()).data() as
      | INode
      | undefined;
    if (!nodeData || nodeData.deleted) return fail(res, 404, "Node not found");
    if (appName && nodeData.appName && nodeData.appName !== appName) {
      return fail(res, 403, "Node does not belong to this app");
    }

    const result = await applyUnlink({
      nodeId,
      nodeData,
      side,
      removeIds,
      uname,
      appName,
    });
    return res.status(200).json(result);
  } catch (error: any) {
    if (error instanceof HttpError) return fail(res, error.status, error.message);
    console.error("nodes/hierarchy/unlink error", error);
    recordLogs(
      {
        type: "error",
        error: JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
        at: "nodes/hierarchy/unlink",
      },
      uname,
    );
    const message = error?.message || "Internal error";
    return res.status(500).json({ error: message, message });
  }
};

export default fbAuth(handler);
