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
  applyToggleOptional,
  toPartsNode,
  PartsGraph,
} from "@components/lib/server/partsModel";
import {
  computeInheritedPartsDetails,
  fetchPartsContext,
  makeResolvedOf,
} from "@components/lib/server/partsAnnotation";

/**
 * Sets or clears a part's `optional` flag as this node sees it: a stored
 * entry flips its own flag, a virtual part records an override. Never breaks
 * attachment and never cascades.
 */
async function applyToggle(ctx: {
  nodeId: string;
  nodeData: INode;
  partId: string;
  optional: boolean;
  uname?: string;
  appName?: string;
}): Promise<{ ok: true; parts: ICollection[] }> {
  const { nodeId, nodeData, partId, optional, uname, appName } = ctx;

  const { relatedNodes } = await fetchPartsContext(nodeData);
  const graph: PartsGraph = new Map(
    Object.values(relatedNodes).map((n) => [n.id, toPartsNode(n)]),
  );
  const { parts, partsInheritance, changed } = applyToggleOptional(
    nodeId,
    graph,
    partId,
    optional,
  );
  if (!changed) throw new HttpError(400, "partId is not a part of this node");

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
  const { nodeId, partId, optional, appName, user } = data as {
    nodeId?: string;
    partId?: string;
    optional?: boolean;
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
  if (typeof optional !== "boolean") {
    return fail(res, 400, "optional must be a boolean");
  }

  try {
    const nodeData = (await db.collection(NODES).doc(nodeId).get()).data() as
      | INode
      | undefined;
    if (!nodeData || nodeData.deleted) return fail(res, 404, "Node not found");
    if (appName && nodeData.appName && nodeData.appName !== appName) {
      return fail(res, 403, "Node does not belong to this app");
    }

    const result = await applyToggle({
      nodeId,
      nodeData: { ...nodeData, id: nodeId },
      partId,
      optional,
      uname,
      appName,
    });
    return res.status(200).json(result);
  } catch (error: any) {
    if (error instanceof HttpError)
      return fail(res, error.status, error.message);
    console.error("nodes/parts/toggle-optional error", error);
    recordLogs(
      {
        type: "error",
        error: JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
        at: "nodes/parts/toggle-optional",
      },
      uname,
    );
    const message = error?.message || "Internal error";
    return res.status(500).json({ error: message, message });
  }
}

export default fbAuth(handler);
