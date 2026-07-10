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
import {
  derivePartsAndRef,
  isOwnedPart,
} from "@components/lib/server/partsModel";

/**
 * Swaps one part for another node of its hierarchy in place, 
 * keeping position and the optional flag. Replacing a part
 * inherited from the overall source BREAKS the overall inheritance, in both
 * directions. Descendants are not touched yet (cascade comes later).
 */
async function applyReplace(ctx: {
  nodeId: string;
  nodeData: INode;
  fromId: string;
  toId: string;
  uname?: string;
  appName?: string;
}): Promise<{ ok: true; ref: string | null; parts: ICollection[] }> {
  const { nodeId, nodeData, fromId, toId, uname, appName } = ctx;
  const cache: NodeCache = new Map([[nodeId, nodeData]]);

  const oldPartsCol = asPartsCollections(nodeData.properties?.parts);
  const gens = await buildGensForAttach(nodeData, cache);
  const { tagged, stored } = taggedPartsAndSource(nodeData, gens);

  const from = tagged.find((p) => p.id === fromId);
  if (!from) throw new HttpError(400, "fromId is not a part of this node");
  if (tagged.some((p) => p.id === toId)) {
    throw new HttpError(400, "toId is already a part of this node");
  }
  const toNode = await getNode(toId, cache);
  if (!toNode || toNode.deleted) {
    throw new HttpError(400, "toId does not exist");
  }

  // Swap in place, untagged: derive decides whether the new part is inherited
  // (a generalization provides it) or owned by this node.
  const swapped: ILinkNode = { id: toId, title: toNode.title ?? "" };
  if (from.optional) swapped.optional = true;
  const edited = tagged.map((p) => (p.id === fromId ? swapped : p));

  const {
    parts: newParts,
    sourceId: newSource,
    ref,
  } = derivePartsAndRef(edited, gens, { oldParts: tagged, sourceId: stored });
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

  const newTo = newParts.find((p) => p.id === toId);
  await applyIsPartOfOwnerOnly(
    nodeId,
    nodeData.title ?? "",
    newTo && isOwnedPart(newTo) ? [toId] : [],
    [fromId],
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

    const result = await applyReplace({
      nodeId,
      nodeData,
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
