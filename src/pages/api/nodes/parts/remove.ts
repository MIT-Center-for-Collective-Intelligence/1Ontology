import type { NextApiRequest, NextApiResponse } from "next";
import fbAuth from "@components/middlewares/fbAuth";
import { db } from "@components/lib/firestoreServer/admin";
import { NODES, NODES_LOGS } from "@components/lib/firestoreClient/collections";
import { ICollection, INode, NodeChange } from "@components/types/INode";
import {
  HttpError,
  NodeCache,
  recordLogs,
  writeChangeLog,
} from "@components/lib/server/hierarchy";
import {
  applyIsPartOfOwnerOnly,
  asPartsCollections,
  propagateOwnedPartChange,
  toParts,
} from "@components/lib/server/parts";
import {
  applyRemove,
  isOwnedPart,
  toPartsNode,
  PartsGraph,
} from "@components/lib/server/partsModel";
import {
  computeInheritedPartsDetails,
  fetchPartsContext,
  makeResolvedOf,
} from "@components/lib/server/partsAnnotation";

/**
 * Removes parts from a node's resolved view. Removing a part the source chain
 * provides BREAKS attachment (the view materializes without it); removing a
 * floating local entry just drops it. Removed parts lose this node from their
 * isPartOf, and an OWNER's removal also drops descendants' stored recorders.
 */
async function applyRemoveParts(ctx: {
  nodeId: string;
  nodeData: INode;
  removeIds: string[];
  uname?: string;
  appName?: string;
}): Promise<{ ok: true; parts: ICollection[] }> {
  const { nodeId, nodeData, removeIds, uname, appName } = ctx;
  const cache: NodeCache = new Map([[nodeId, nodeData]]);

  const { relatedNodes } = await fetchPartsContext(nodeData);
  const graph: PartsGraph = new Map(
    Object.values(relatedNodes).map((n) => [n.id, toPartsNode(n)]),
  );
  const { parts, partsInheritance, removed } = applyRemove(
    nodeId,
    graph,
    removeIds,
  );
  if (removed.length === 0) {
    throw new HttpError(400, "none of the parts are on this node");
  }

  const oldPartsCol = asPartsCollections(nodeData.properties?.parts);
  const side = toParts(parts);
  const updatedNode = {
    ...nodeData,
    properties: { ...nodeData.properties, parts: side },
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

  const parentLogId = db.collection(NODES_LOGS).doc().id;
  const parentLog = {
    logId: parentLogId,
    nodeId,
    nodeTitle: nodeData.title ?? "",
    changeType: "modify elements" as const,
  };
  const childLogs: NodeChange[] = [];

  await applyIsPartOfOwnerOnly(
    nodeId,
    nodeData.title ?? "",
    [],
    removed.map((p) => p.id),
    cache,
    parentLog,
    uname,
    appName,
    childLogs,
  );

  // Removals of OWNED parts follow the tracked source into the subtree.
  const ownedRemoved = removed.filter((p) => isOwnedPart(p)).map((p) => p.id);
  if (ownedRemoved.length > 0) {
    await propagateOwnedPartChange(
      nodeId,
      ownedRemoved.map((fromId) => ({ fromId })),
    );
  }

  if (uname) {
    await writeChangeLog(
      {
        nodeId,
        modifiedBy: uname,
        modifiedProperty: "parts",
        previousValue: oldPartsCol,
        newValue: side,
        modifiedAt: new Date(),
        changeType: "modify elements",
        fullNode: nodeData,
        ...(appName ? { appName } : {}),
      } as NodeChange,
      parentLogId,
    );
  }
  for (const log of childLogs) await writeChangeLog(log);

  return { ok: true, parts: side };
}

function fail(res: NextApiResponse, status: number, msg: string) {
  return res.status(status).json({ error: msg, message: msg });
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return fail(res, 405, "Method not allowed");
  const data = req.body.data;
  const { nodeId, removeIds, appName, user } = data as {
    nodeId?: string;
    removeIds?: string[];
    appName?: string;
    user?: any;
  };
  const { uname } = user?.userData || {};

  if (!nodeId || typeof nodeId !== "string") {
    return fail(res, 400, "nodeId is required");
  }
  if (
    !Array.isArray(removeIds) ||
    removeIds.length === 0 ||
    removeIds.some((id) => typeof id !== "string")
  ) {
    return fail(res, 400, "removeIds must be a non-empty array of part ids");
  }

  try {
    const nodeData = (await db.collection(NODES).doc(nodeId).get()).data() as
      | INode
      | undefined;
    if (!nodeData || nodeData.deleted) return fail(res, 404, "Node not found");
    if (appName && nodeData.appName && nodeData.appName !== appName) {
      return fail(res, 403, "Node does not belong to this app");
    }

    const result = await applyRemoveParts({
      nodeId,
      nodeData: { ...nodeData, id: nodeId },
      removeIds,
      uname,
      appName,
    });
    return res.status(200).json(result);
  } catch (error: any) {
    if (error instanceof HttpError)
      return fail(res, error.status, error.message);
    console.error("nodes/parts/remove error", error);
    recordLogs(
      {
        type: "error",
        error: JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
        at: "nodes/parts/remove",
      },
      uname,
    );
    const message = error?.message || "Internal error";
    return res.status(500).json({ error: message, message });
  }
}

export default fbAuth(handler);
