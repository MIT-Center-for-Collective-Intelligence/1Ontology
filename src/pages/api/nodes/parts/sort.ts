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
  classifySort,
  toPartsNode,
  PartsGraph,
} from "@components/lib/server/partsModel";
import {
  computeInheritedPartsDetails,
  fetchPartsContext,
  makeResolvedOf,
} from "@components/lib/server/partsAnnotation";

/**
 * Reorders the resolved view. Moving only local entries re-anchors them and
 * never breaks; changing the source parts' relative order BREAKS and stores
 * the materialized list in the requested order. The "Switch To" pick's details
 * ride along and seed the fresh annotation's userOverride.
 */
async function applySort(ctx: {
  nodeId: string;
  nodeData: INode;
  orderedIds: string[];
  inheritedPartsDetails?: any[];
  uname?: string;
  appName?: string;
}): Promise<{ ok: true; parts: ICollection[] }> {
  const {
    nodeId,
    nodeData,
    orderedIds,
    inheritedPartsDetails,
    uname,
    appName,
  } = ctx;

  const { relatedNodes } = await fetchPartsContext(nodeData);
  const graph: PartsGraph = new Map(
    Object.values(relatedNodes).map((n) => [n.id, toPartsNode(n)]),
  );
  const currentIds = makeResolvedOf(relatedNodes)(nodeId).map((p) => p.id);
  const sameMembership =
    orderedIds.length === currentIds.length &&
    new Set(orderedIds).size === orderedIds.length &&
    orderedIds.every((id) => currentIds.includes(id));
  if (!sameMembership) {
    throw new HttpError(400, "orderedIds must be a permutation of the parts");
  }

  const result = classifySort(nodeId, graph, orderedIds);
  const side = toParts(result.parts);
  const partsInheritance = result.breaks
    ? result.partsInheritance
    : (nodeData.partsInheritance ?? { source: null, overrides: {} });

  const updatedNode = {
    ...nodeData,
    properties: { ...nodeData.properties, parts: side },
    partsInheritance,
    ...(Array.isArray(inheritedPartsDetails) ? { inheritedPartsDetails } : {}),
  } as INode;
  const updatedRelated = { ...relatedNodes, [nodeId]: updatedNode };
  const resolvedOfUpdated = makeResolvedOf(updatedRelated);

  const oldPartsCol = asPartsCollections(nodeData.properties?.parts);
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
      changeType: "sort elements",
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
  const { nodeId, orderedIds, appName, user } = data as {
    nodeId?: string;
    orderedIds?: string[];
    appName?: string;
    user?: any;
  };
  const inheritedPartsDetails = Array.isArray(data.inheritedPartsDetails)
    ? data.inheritedPartsDetails
    : undefined;
  const { uname } = user?.userData || {};

  if (!nodeId || typeof nodeId !== "string") {
    return fail(res, 400, "nodeId is required");
  }
  if (
    !Array.isArray(orderedIds) ||
    orderedIds.length === 0 ||
    orderedIds.some((id) => typeof id !== "string")
  ) {
    return fail(res, 400, "orderedIds must be a non-empty array of part ids");
  }

  try {
    const nodeData = (await db.collection(NODES).doc(nodeId).get()).data() as
      | INode
      | undefined;
    if (!nodeData || nodeData.deleted) return fail(res, 404, "Node not found");
    if (appName && nodeData.appName && nodeData.appName !== appName) {
      return fail(res, 403, "Node does not belong to this app");
    }

    const result = await applySort({
      nodeId,
      nodeData: { ...nodeData, id: nodeId },
      orderedIds,
      inheritedPartsDetails,
      uname,
      appName,
    });
    return res.status(200).json(result);
  } catch (error: any) {
    if (error instanceof HttpError)
      return fail(res, error.status, error.message);
    console.error("nodes/parts/sort error", error);
    recordLogs(
      {
        type: "error",
        error: JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
        at: "nodes/parts/sort",
      },
      uname,
    );
    const message = error?.message || "Internal error";
    return res.status(500).json({ error: message, message });
  }
}

export default fbAuth(handler);
