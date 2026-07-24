import type { NextApiRequest, NextApiResponse } from "next";
import fbAuth from "@components/middlewares/fbAuth";
import { db } from "@components/lib/firestoreServer/admin";
import { NODES, NODES_LOGS } from "@components/lib/firestoreClient/collections";
import {
  ICollection,
  ILinkNode,
  INode,
  NodeChange,
} from "@components/types/INode";
import {
  HttpError,
  NodeCache,
  recordLogs,
  writeChangeLog,
} from "@components/lib/server/hierarchy";
import {
  applyIsPartOfOwnerOnly,
  asPartsCollections,
  partsNodes,
  toParts,
} from "@components/lib/server/parts";
import { childSourceOf, isOwnedPart } from "@components/lib/server/partsModel";
import {
  computeInheritedPartsDetails,
  fetchPartsContext,
  makeResolvedOf,
} from "@components/lib/server/partsAnnotation";

/**
 * Appends parts to a node's stored entries. With `genId`, each part is
 * inherited specifically through that generalization; without it the part is
 * owned (and gains an isPartOf backlink). An absent anchor resolves to the end
 * of the list, and appending never breaks attachment.
 */
async function applyAdd(ctx: {
  nodeId: string;
  nodeData: INode;
  partIds: string[];
  genId?: string;
  uname?: string;
  appName?: string;
}): Promise<{ ok: true; parts: ICollection[] }> {
  const { nodeId, nodeData, partIds, genId, uname, appName } = ctx;
  const cache: NodeCache = new Map([[nodeId, nodeData]]);

  const nodeGenIds = new Set(
    (nodeData.generalizations ?? []).flatMap((c) =>
      (c.nodes ?? []).map((n) => n.id),
    ),
  );
  if (genId && !nodeGenIds.has(genId)) {
    throw new HttpError(400, "genId is not a generalization of this node");
  }

  const { relatedNodes } = await fetchPartsContext(nodeData, partIds);
  const resolvedOf = makeResolvedOf(relatedNodes);

  const oldPartsCol = asPartsCollections(nodeData.properties?.parts);
  const entries = partsNodes(oldPartsCol);
  const existing = new Set(resolvedOf(nodeId).map((p) => p.id));
  const genResolved = genId ? resolvedOf(genId) : [];

  const additions: ILinkNode[] = [];
  for (const partId of partIds) {
    if (existing.has(partId)) continue;
    existing.add(partId);
    const partNode = relatedNodes[partId];
    if (!partNode) {
      throw new HttpError(400, `part ${partId} does not exist`);
    }
    const node: ILinkNode = { id: partId, title: partNode.title ?? "" };
    if (genId) {
      const genPart = genResolved.find((p) => p.id === partId);
      if (!genPart) {
        throw new HttpError(
          400,
          "the generalization does not provide this part",
        );
      }
      node.inheritedFrom = childSourceOf(genPart, genId);
    }
    additions.push(node);
  }
  if (additions.length === 0) {
    throw new HttpError(400, "all of the parts are already on this node");
  }

  const side = toParts([...entries, ...additions]);
  const updatedNode = {
    ...nodeData,
    properties: { ...nodeData.properties, parts: side },
  } as INode;
  const updatedRelated = { ...relatedNodes, [nodeId]: updatedNode };
  const resolvedOfUpdated = makeResolvedOf(updatedRelated);

  await db
    .collection(NODES)
    .doc(nodeId)
    .update({
      "properties.parts": side,
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

  const addedOwn = additions.filter((p) => isOwnedPart(p)).map((p) => p.id);
  await applyIsPartOfOwnerOnly(
    nodeId,
    nodeData.title ?? "",
    addedOwn,
    [],
    cache,
    parentLog,
    uname,
    appName,
    childLogs,
  );

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
  const { nodeId, partIds, genId, appName, user } = data as {
    nodeId?: string;
    partIds?: string[];
    genId?: string;
    appName?: string;
    user?: any;
  };
  const { uname } = user?.userData || {};

  if (!nodeId || typeof nodeId !== "string") {
    return fail(res, 400, "nodeId is required");
  }
  if (
    !Array.isArray(partIds) ||
    partIds.length === 0 ||
    partIds.some((id) => typeof id !== "string")
  ) {
    return fail(res, 400, "partIds must be a non-empty array of part ids");
  }
  if (partIds.includes(nodeId)) {
    return fail(res, 400, "a node cannot be a part of itself");
  }
  if (genId !== undefined && typeof genId !== "string") {
    return fail(res, 400, "genId must be a string");
  }

  try {
    const nodeData = (await db.collection(NODES).doc(nodeId).get()).data() as
      | INode
      | undefined;
    if (!nodeData || nodeData.deleted) return fail(res, 404, "Node not found");
    if (appName && nodeData.appName && nodeData.appName !== appName) {
      return fail(res, 403, "Node does not belong to this app");
    }

    const result = await applyAdd({
      nodeId,
      nodeData: { ...nodeData, id: nodeId },
      partIds,
      genId,
      uname,
      appName,
    });
    return res.status(200).json(result);
  } catch (error: any) {
    if (error instanceof HttpError)
      return fail(res, error.status, error.message);
    console.error("nodes/parts/add error", error);
    recordLogs(
      {
        type: "error",
        error: JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
        at: "nodes/parts/add",
      },
      uname,
    );
    const message = error?.message || "Internal error";
    return res.status(500).json({ error: message, message });
  }
}

export default fbAuth(handler);
