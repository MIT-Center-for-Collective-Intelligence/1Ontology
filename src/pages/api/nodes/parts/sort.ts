import type { NextApiRequest, NextApiResponse } from "next";
import fbAuth from "@components/middlewares/fbAuth";
import { db } from "@components/lib/firestoreServer/admin";
import { NODES } from "@components/lib/firestoreClient/collections";
import { ICollection, INode, NodeChange } from "@components/types/INode";
import {
  HttpError,
  getNode,
  NodeCache,
  recordLogs,
  writeChangeLog,
} from "@components/lib/server/hierarchy";
import {
  asPartsCollections,
  buildGensForAttach,
  partsInheritanceEntry,
  taggedPartsAndSource,
  toParts,
} from "@components/lib/server/parts";
import { derivePartsAndRef } from "@components/lib/server/partsModel";

/**
 * Reorders a node's parts. Ordering inherited parts out of the overall source's
 * relative order BREAKS the overall inheritance but moving own parts around never does. 
 * Pure reorder, there is no isPartOf changes, and descendants are not touched yet.
 */
async function applySort(ctx: {
  nodeId: string;
  nodeData: INode;
  orderedIds: string[];
  uname?: string;
  appName?: string;
}): Promise<{ ok: true; ref: string | null; parts: ICollection[] }> {
  const { nodeId, nodeData, orderedIds, uname, appName } = ctx;
  const cache: NodeCache = new Map([[nodeId, nodeData]]);

  const oldPartsCol = asPartsCollections(nodeData.properties?.parts);
  const gens = await buildGensForAttach(nodeData, cache);
  const { tagged, stored } = taggedPartsAndSource(nodeData, gens);

  const byId = new Map(tagged.map((p) => [p.id, p]));
  const sameMembership =
    orderedIds.length === tagged.length &&
    orderedIds.every((id) => byId.has(id)) &&
    new Set(orderedIds).size === orderedIds.length;
  if (!sameMembership) {
    throw new HttpError(400, "orderedIds must be a permutation of the parts");
  }
  const reordered = orderedIds.map((id) => byId.get(id)!);

  const {
    parts: newParts,
    sourceId: newSource,
    ref,
  } = derivePartsAndRef(reordered, gens, { oldParts: tagged, sourceId: stored });
  const ownerTitle = ref ? ((await getNode(ref, cache))?.title ?? "") : "";
  const partsEntry = partsInheritanceEntry(
    ref,
    ownerTitle,
    nodeData.inheritance?.parts?.inheritanceType,
  );

  await db.collection(NODES).doc(nodeId).update({
    "properties.parts": toParts(newParts),
    "inheritance.parts": partsEntry,
    partsOverallSource: newSource,
  });

  if (uname) {
    await writeChangeLog({
      nodeId,
      modifiedBy: uname,
      modifiedProperty: "parts",
      previousValue: oldPartsCol,
      newValue: toParts(newParts),
      modifiedAt: new Date(),
      changeType: "sort elements",
      fullNode: nodeData,
      ...(appName ? { appName } : {}),
    } as NodeChange);
  }

  return { ok: true, ref, parts: toParts(newParts) };
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
      nodeData,
      orderedIds,
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
