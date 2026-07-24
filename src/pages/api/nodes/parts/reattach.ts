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
  convertToOverlay,
  toPartsNode,
  PartsGraph,
} from "@components/lib/server/partsModel";
import {
  computeInheritedPartsDetails,
  fetchPartsContext,
  makeResolvedOf,
} from "@components/lib/server/partsAnnotation";

/**
 * Attaches a node's overall parts inheritance to one of its generalizations —
 * repairing a break, or moving a healthy node to another source. Both are the
 * same HARD RESET: only owned entries survive (one the source also provides
 * keeps its slot), everything else follows the source virtually. Destructive:
 * the client confirms first. Owned parts survive, so isPartOf is invariant.
 */
async function applyReattach(ctx: {
  nodeId: string;
  nodeData: INode;
  sourceId: string;
  uname?: string;
  appName?: string;
}): Promise<{ ok: true; parts: ICollection[] }> {
  const { nodeId, nodeData, sourceId, uname, appName } = ctx;

  const nodeGenIds = new Set(
    (nodeData.generalizations ?? []).flatMap((c) =>
      (c.nodes ?? []).map((n) => n.id),
    ),
  );
  if (!nodeGenIds.has(sourceId)) {
    throw new HttpError(400, "sourceId is not a generalization of this node");
  }

  const { relatedNodes } = await fetchPartsContext(nodeData);
  const graph: PartsGraph = new Map(
    Object.values(relatedNodes).map((n) => [n.id, toPartsNode(n)]),
  );
  const { parts, partsInheritance } = convertToOverlay(nodeId, graph, sourceId);

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
  const { nodeId, sourceId, appName, user } = data as {
    nodeId?: string;
    sourceId?: string;
    appName?: string;
    user?: any;
  };
  const { uname } = user?.userData || {};

  if (!nodeId || typeof nodeId !== "string") {
    return fail(res, 400, "nodeId is required");
  }
  if (!sourceId || typeof sourceId !== "string") {
    return fail(res, 400, "sourceId is required");
  }

  try {
    const nodeData = (await db.collection(NODES).doc(nodeId).get()).data() as
      | INode
      | undefined;
    if (!nodeData || nodeData.deleted) return fail(res, 404, "Node not found");
    if (appName && nodeData.appName && nodeData.appName !== appName) {
      return fail(res, 403, "Node does not belong to this app");
    }

    const result = await applyReattach({
      nodeId,
      nodeData: { ...nodeData, id: nodeId },
      sourceId,
      uname,
      appName,
    });
    return res.status(200).json(result);
  } catch (error: any) {
    if (error instanceof HttpError)
      return fail(res, error.status, error.message);
    console.error("nodes/parts/reattach error", error);
    recordLogs(
      {
        type: "error",
        error: JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
        at: "nodes/parts/reattach",
      },
      uname,
    );
    const message = error?.message || "Internal error";
    return res.status(500).json({ error: message, message });
  }
}

export default fbAuth(handler);
