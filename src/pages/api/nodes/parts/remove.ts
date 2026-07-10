import type { NextApiRequest, NextApiResponse } from "next";
import fbAuth from "@components/middlewares/fbAuth";
import { db } from "@components/lib/firestoreServer/admin";
import { NODES, NODES_LOGS } from "@components/lib/firestoreClient/collections";
import { ICollection, INode, NodeChange } from "@components/types/INode";
import {
  HttpError,
  getNode,
  NodeCache,
  recordLogs,
  writeChangeLog,
} from "@components/lib/server/hierarchy";
import {
  applyIsPartOfOwnerOnly,
  asPartsCollections,
  buildGensForAttach,
  partsInheritanceEntry,
  taggedPartsAndSource,
  toParts,
} from "@components/lib/server/parts";
import { derivePartsAndRef } from "@components/lib/server/partsModel";

/**
 * Removes parts from a node. Removing a part the node inherits from its overall
 * source BREAKS the overall inheritance. 
 * The removed parts lose this node from their isPartOf.
 * Descendants are not touched yet (cascade comes later).
 */
async function applyRemove(ctx: {
  nodeId: string;
  nodeData: INode;
  removeIds: string[];
  uname?: string;
  appName?: string;
}): Promise<{ ok: true; ref: string | null; parts: ICollection[] }> {
  const { nodeId, nodeData, removeIds, uname, appName } = ctx;
  const cache: NodeCache = new Map([[nodeId, nodeData]]);

  const oldPartsCol = asPartsCollections(nodeData.properties?.parts);
  const gens = await buildGensForAttach(nodeData, cache);
  const { tagged, stored } = taggedPartsAndSource(nodeData, gens);

  const toRemove = new Set(removeIds);
  const present = tagged.filter((p) => toRemove.has(p.id)).map((p) => p.id);
  if (present.length === 0) {
    throw new HttpError(400, "none of the parts are on this node");
  }
  const presentSet = new Set(present);
  const remaining = tagged.filter((p) => !presentSet.has(p.id));

  const {
    parts: newParts,
    sourceId: newSource,
    ref,
  } = derivePartsAndRef(remaining, gens, { oldParts: tagged, sourceId: stored });
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
    present,
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
        newValue: toParts(newParts),
        modifiedAt: new Date(),
        changeType: "modify elements",
        fullNode: nodeData,
        ...(appName ? { appName } : {}),
      } as NodeChange,
      parentLogId,
    );
  }
  for (const log of childLogs) await writeChangeLog(log);

  return { ok: true, ref, parts: toParts(newParts) };
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

    const result = await applyRemove({
      nodeId,
      nodeData,
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
