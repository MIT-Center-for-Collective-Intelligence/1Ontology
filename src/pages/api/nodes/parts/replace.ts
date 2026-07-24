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
  applyReplace,
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
 * Swaps one resolved part for another node in place, keeping position and the
 * optional flag; the replacement is OWNED. Replacing a part the source chain
 * provides BREAKS attachment; an OWNER's replace also morphs descendants'
 * stored recorders.
 */
async function applyReplaceParts(ctx: {
  nodeId: string;
  nodeData: INode;
  fromId: string;
  toId: string;
  uname?: string;
  appName?: string;
}): Promise<{ ok: true; parts: ICollection[] }> {
  const { nodeId, nodeData, fromId, toId, uname, appName } = ctx;
  const cache: NodeCache = new Map([[nodeId, nodeData]]);

  const { relatedNodes } = await fetchPartsContext(nodeData, [toId]);
  const toNode = relatedNodes[toId];
  if (!toNode) throw new HttpError(400, "toId does not exist");

  const graph: PartsGraph = new Map(
    Object.values(relatedNodes).map((n) => [n.id, toPartsNode(n)]),
  );
  const resolvedBefore = makeResolvedOf(relatedNodes)(nodeId);
  const from = resolvedBefore.find((p) => p.id === fromId);
  if (!from) throw new HttpError(400, "fromId is not a part of this node");
  if (resolvedBefore.some((p) => p.id === toId)) {
    throw new HttpError(400, "toId is already a part of this node");
  }

  const { parts, partsInheritance } = applyReplace(nodeId, graph, fromId, {
    id: toId,
    title: toNode.title ?? "",
  });

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
    [toId],
    [fromId],
    cache,
    parentLog,
    uname,
    appName,
    childLogs,
  );

  // An OWNED part's replace morphs descendants' stored recorders in place.
  if (isOwnedPart(from)) {
    await propagateOwnedPartChange(nodeId, [
      { fromId, to: { id: toId, title: toNode.title ?? "" } },
    ]);
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
  const { nodeId, fromId, toId, appName, user } = data as {
    nodeId?: string;
    fromId?: string;
    toId?: string;
    appName?: string;
    user?: any;
  };
  const { uname } = user?.userData || {};

  if (!nodeId || typeof nodeId !== "string") {
    return fail(res, 400, "nodeId is required");
  }
  if (!fromId || typeof fromId !== "string") {
    return fail(res, 400, "fromId is required");
  }
  if (!toId || typeof toId !== "string") {
    return fail(res, 400, "toId is required");
  }
  if (fromId === toId) {
    return fail(res, 400, "fromId and toId must differ");
  }
  if (toId === nodeId) {
    return fail(res, 400, "a node cannot be a part of itself");
  }

  try {
    const nodeData = (await db.collection(NODES).doc(nodeId).get()).data() as
      | INode
      | undefined;
    if (!nodeData || nodeData.deleted) return fail(res, 404, "Node not found");
    if (appName && nodeData.appName && nodeData.appName !== appName) {
      return fail(res, 403, "Node does not belong to this app");
    }

    const result = await applyReplaceParts({
      nodeId,
      nodeData: { ...nodeData, id: nodeId },
      fromId,
      toId,
      uname,
      appName,
    });
    return res.status(200).json(result);
  } catch (error: any) {
    if (error instanceof HttpError)
      return fail(res, error.status, error.message);
    console.error("nodes/parts/replace error", error);
    recordLogs(
      {
        type: "error",
        error: JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
        at: "nodes/parts/replace",
      },
      uname,
    );
    const message = error?.message || "Internal error";
    return res.status(500).json({ error: message, message });
  }
}

export default fbAuth(handler);
