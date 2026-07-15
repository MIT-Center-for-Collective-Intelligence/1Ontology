import type { NextApiRequest, NextApiResponse } from "next";
import fbAuth from "@components/middlewares/fbAuth";
import { db } from "@components/lib/firestoreServer/admin";
import { NODES, NODES_LOGS } from "@components/lib/firestoreClient/collections";
import { INode, ICollection, NodeChange } from "@components/types/INode";
import { updateDerivedPaths } from "@components/lib/server/updateDerivedPaths";
import {
  HttpError,
  NodeCache,
  asCollections,
  generalizationIds,
  assertNoCycle,
  applyReciprocityAdd,
  applyReciprocityRemove,
  removeFromUnclassified,
  recomputeInheritance,
  writeChangeLog,
  recordLogs,
} from "@components/lib/server/hierarchy";
import { applyPartsForGenChange } from "@components/lib/server/parts";

/**
 * Relocates a node to a new parent: drops `fromParentId` from its
 * generalizations and adds `toParentId` (in `toCollectionName` of the new
 * parent's specializations). Cross-parent only — same-parent reordering and
 * re-bucketing go through the sort endpoint.
 */
async function applyMove(ctx: {
  nodeId: string;
  nodeData: INode;
  fromParentId: string;
  toParentId: string;
  toCollectionName: string;
  uname?: string;
  appName?: string;
}): Promise<{ ok: true }> {
  const {
    nodeId,
    nodeData,
    fromParentId,
    toParentId,
    toCollectionName,
    uname,
    appName,
  } = ctx;

  if (fromParentId === toParentId) return { ok: true };

  const previousValue = asCollections(nodeData.generalizations);
  const currentGens = generalizationIds(nodeData);
  if (!currentGens.includes(fromParentId)) {
    throw new HttpError(400, "Node is not a specialization of the source parent");
  }
  if (currentGens.includes(toParentId)) {
    throw new HttpError(409, "Node is already a specialization of the target parent");
  }

  await assertNoCycle("generalizations", nodeId, [toParentId]);

  // Drop the old parent and add the new one (generalizations are single-collection).
  const newGens: ICollection[] = previousValue.map((c) => ({
    ...c,
    nodes: (c.nodes || []).filter((n) => n.id !== fromParentId),
  }));
  let main = newGens.find((c) => c.collectionName === "main");
  if (!main) {
    main = { collectionName: "main", nodes: [] };
    newGens.unshift(main);
  }
  main.nodes.push({ id: toParentId, title: "" });

  const cache: NodeCache = new Map([[nodeId, nodeData]]);

  const parentLogId = db.collection(NODES_LOGS).doc().id;
  const parentLog = {
    logId: parentLogId,
    nodeId,
    nodeTitle: nodeData.title ?? "",
    changeType: "modify elements" as const,
  };

  await db.collection(NODES).doc(nodeId).update({ generalizations: newGens });

  const childLogs: NodeChange[] = [];
  await applyReciprocityRemove(
    nodeId,
    "specializations",
    [fromParentId],
    cache,
    parentLog,
    uname,
    appName,
    childLogs,
  );
  await applyReciprocityAdd(
    nodeId,
    nodeData.title ?? "",
    "specializations",
    [toParentId],
    cache,
    parentLog,
    uname,
    appName,
    childLogs,
    toCollectionName,
  );

  await removeFromUnclassified(nodeId, cache, parentLog, uname, appName, childLogs);

  cache.delete(nodeId); // re-read so recompute sees the new generalizations
  await recomputeInheritance(nodeId, cache);
  await applyPartsForGenChange(
    nodeId,
    [fromParentId],
    cache,
    parentLog,
    uname,
    appName,
    childLogs,
  );

  await updateDerivedPaths({ db, changedNodeIds: [nodeId] });

  if (uname) {
    await writeChangeLog(
      {
        nodeId,
        modifiedBy: uname,
        modifiedProperty: "generalizations",
        previousValue,
        newValue: newGens,
        modifiedAt: new Date(),
        changeType: "modify elements",
        changeDetails: { action: "move", fromParentId, toParentId },
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
  const { nodeId, fromParentId, toParentId, toCollectionName, appName, user } =
    data as {
      nodeId?: string;
      fromParentId?: string;
      toParentId?: string;
      toCollectionName?: string;
      appName?: string;
      user?: any;
    };
  const { uname } = user?.userData || {};

  if (!nodeId || typeof nodeId !== "string") {
    return fail(res, 400, "nodeId is required");
  }
  if (!fromParentId || typeof fromParentId !== "string") {
    return fail(res, 400, "fromParentId is required");
  }
  if (!toParentId || typeof toParentId !== "string") {
    return fail(res, 400, "toParentId is required");
  }

  try {
    const nodeData = (await db.collection(NODES).doc(nodeId).get()).data() as
      | INode
      | undefined;
    if (!nodeData || nodeData.deleted) return fail(res, 404, "Node not found");
    if (appName && nodeData.appName && nodeData.appName !== appName) {
      return fail(res, 403, "Node does not belong to this app");
    }

    const result = await applyMove({
      nodeId,
      nodeData,
      fromParentId,
      toParentId,
      toCollectionName:
        typeof toCollectionName === "string" ? toCollectionName : "main",
      uname,
      appName,
    });
    return res.status(200).json(result);
  } catch (error: any) {
    if (error instanceof HttpError) return fail(res, error.status, error.message);
    console.error("nodes/hierarchy/move error", error);
    recordLogs(
      {
        type: "error",
        error: JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
        at: "nodes/hierarchy/move",
      },
      uname,
    );
    const message = error?.message || "Internal error";
    return res.status(500).json({ error: message, message });
  }
};

export default fbAuth(handler);
