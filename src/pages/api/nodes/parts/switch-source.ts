import type { NextApiRequest, NextApiResponse } from "next";
import fbAuth from "@components/middlewares/fbAuth";
import { db } from "@components/lib/firestoreServer/admin";
import { NODES } from "@components/lib/firestoreClient/collections";
import { ICollection, INode, NodeChange } from "@components/types/INode";
import {
  HttpError,
  recordLogs,
  writeChangeLog,
} from "@components/lib/server/hierarchy";
import { asPartsCollections, toParts } from "@components/lib/server/parts";
import {
  applySwitchSource,
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
 * Switches which generalization a part is SPECIFICALLY inherited from: the
 * part starts tracking the owner resolved through the picked gen — a virtual
 * part mints a stored entry in its slot, an existing entry repoints.
 * Membership and order don't change, so attachment is untouched.
 */
async function applySwitch(ctx: {
  nodeId: string;
  nodeData: INode;
  partId: string;
  genId: string;
  uname?: string;
  appName?: string;
}): Promise<{ ok: true; parts: ICollection[] }> {
  const { nodeId, nodeData, partId, genId, uname, appName } = ctx;

  const nodeGenIds = new Set(
    (nodeData.generalizations ?? []).flatMap((c) =>
      (c.nodes ?? []).map((n) => n.id),
    ),
  );
  if (!nodeGenIds.has(genId)) {
    throw new HttpError(400, "genId is not a generalization of this node");
  }

  const { relatedNodes } = await fetchPartsContext(nodeData);
  const graph: PartsGraph = new Map(
    Object.values(relatedNodes).map((n) => [n.id, toPartsNode(n)]),
  );
  const resolvedOf = makeResolvedOf(relatedNodes);
  const viewed = resolvedOf(nodeId).find((p) => p.id === partId);
  if (!viewed) throw new HttpError(400, "partId is not a part of this node");
  if (isOwnedPart(viewed)) {
    throw new HttpError(400, "this node owns the part; nothing to switch");
  }
  if (!resolvedOf(genId).some((p) => p.id === partId)) {
    throw new HttpError(400, "the generalization does not provide this part");
  }

  const { parts, partsInheritance } = applySwitchSource(
    nodeId,
    graph,
    partId,
    genId,
  );

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

  if (uname) {
    await writeChangeLog({
      nodeId,
      modifiedBy: uname,
      modifiedProperty: "parts",
      previousValue: oldPartsCol,
      newValue: side,
      modifiedAt: new Date(),
      changeType: "modify elements",
      fullNode: nodeData,
      ...(appName ? { appName } : {}),
    } as NodeChange);
  }

  return { ok: true, parts: side };
}

function fail(res: NextApiResponse, status: number, msg: string) {
  return res.status(status).json({ error: msg, message: msg });
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return fail(res, 405, "Method not allowed");
  const data = req.body.data;
  const { nodeId, partId, genId, appName, user } = data as {
    nodeId?: string;
    partId?: string;
    genId?: string;
    appName?: string;
    user?: any;
  };
  const { uname } = user?.userData || {};

  if (!nodeId || typeof nodeId !== "string") {
    return fail(res, 400, "nodeId is required");
  }
  if (!partId || typeof partId !== "string") {
    return fail(res, 400, "partId is required");
  }
  if (!genId || typeof genId !== "string") {
    return fail(res, 400, "genId is required");
  }

  try {
    const nodeData = (await db.collection(NODES).doc(nodeId).get()).data() as
      | INode
      | undefined;
    if (!nodeData || nodeData.deleted) return fail(res, 404, "Node not found");
    if (appName && nodeData.appName && nodeData.appName !== appName) {
      return fail(res, 403, "Node does not belong to this app");
    }

    const result = await applySwitch({
      nodeId,
      nodeData: { ...nodeData, id: nodeId },
      partId,
      genId,
      uname,
      appName,
    });
    return res.status(200).json(result);
  } catch (error: any) {
    if (error instanceof HttpError)
      return fail(res, error.status, error.message);
    console.error("nodes/parts/switch-source error", error);
    recordLogs(
      {
        type: "error",
        error: JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
        at: "nodes/parts/switch-source",
      },
      uname,
    );
    const message = error?.message || "Internal error";
    return res.status(500).json({ error: message, message });
  }
}

export default fbAuth(handler);
