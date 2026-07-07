import type { NextApiRequest, NextApiResponse } from "next";
import fbAuth from "@components/middlewares/fbAuth";
import { db } from "@components/lib/firestoreServer/admin";
import { NODES, NODES_LOGS } from "@components/lib/firestoreClient/collections";
import { ICollection, INode, NodeChange } from "@components/types/INode";
import {
  HttpError,
  NodeCache,
  getNode,
  recordLogs,
  writeChangeLog,
} from "@components/lib/server/hierarchy";
import {
  GenForAttach,
  applyIsPartOfOwnerOnly,
  asPartsCollections,
  buildGensForAttach,
  cascadeParts,
  detectAttachment,
  ownPartIds,
  partsInheritanceEntry,
  partsNodes,
  sanitizeParts,
} from "@components/lib/server/parts";

/**
 * Saves a node's `parts` under the "overall" inheritance model. The client sends
 * the full new value; the server attaches/breaks `inheritance.parts.ref` (ordered-
 * subsequence rule), materializes the change down the attached subtree, maintains
 * owner-only `isPartOf`, and logs it.
 */
async function applyParts(ctx: {
  nodeId: string;
  nodeData: INode;
  parts: ICollection[];
  inheritedPartsDetails?: any[];
  uname?: string;
  appName?: string;
}): Promise<{ ok: true; ref: string | null }> {
  const { nodeId, nodeData, parts, inheritedPartsDetails, uname, appName } = ctx;
  const cache: NodeCache = new Map([[nodeId, nodeData]]);

  const oldPartsCol = asPartsCollections(nodeData.properties?.parts);
  const oldParts = partsNodes(oldPartsCol);
  const newParts = partsNodes(parts);
  const oldRef = nodeData.inheritance?.parts?.ref ?? null;

  // 1. Attachment: pick the generalization this node now inherits parts from.
  const gens = await buildGensForAttach(nodeData, cache);
  const { ref: newRef, sourceGenId } = detectAttachment(newParts, gens, oldRef);
  const ownerOf = (g: GenForAttach) => g.ref ?? g.id;
  const oldSourceParts = oldRef
    ? gens.find((g) => ownerOf(g) === oldRef)?.parts ?? []
    : [];
  const newSourceParts = sourceGenId
    ? gens.find((g) => g.id === sourceGenId)?.parts ?? []
    : [];
  const ownerTitle = newRef ? (await getNode(newRef, cache))?.title ?? "" : "";

  // 2. Write the edited node's parts + attachment ref.
  const nodeUpdates: Record<string, any> = {
    "properties.parts": parts,
    "inheritance.parts": partsInheritanceEntry(
      newRef,
      ownerTitle,
      nodeData.inheritance?.parts?.inheritanceType,
    ),
  };
  // Reorder/optional/switch edits ship pre-patched details to store as-is;
  // otherwise the annotation table is recomputed by the client hook.
  if (Array.isArray(inheritedPartsDetails)) {
    nodeUpdates.inheritedPartsDetails = inheritedPartsDetails.map((g) => ({
      ...g,
      createdAt: new Date(),
    }));
  }
  await db.collection(NODES).doc(nodeId).update(nodeUpdates);

  const parentLogId = db.collection(NODES_LOGS).doc().id;
  const parentLog = {
    logId: parentLogId,
    nodeId,
    nodeTitle: nodeData.title ?? "",
    changeType: "modify elements" as const,
  };
  const childLogs: NodeChange[] = [];

  // 3. Owner-only isPartOf reciprocity, driven by the change in OWN parts.
  const oldOwn = ownPartIds(oldParts, oldSourceParts);
  const newOwn = ownPartIds(newParts, newSourceParts);
  const oldOwnSet = new Set(oldOwn);
  const newOwnSet = new Set(newOwn);
  const addedOwn = newOwn.filter((id) => !oldOwnSet.has(id));
  const removedOwn = oldOwn.filter((id) => !newOwnSet.has(id));
  await applyIsPartOfOwnerOnly(
    nodeId,
    nodeData.title ?? "",
    addedOwn,
    removedOwn,
    cache,
    parentLog,
    uname,
    appName,
    childLogs,
  );

  // 4. Materialize the change down the attached subtree (+ repoint their ref).
  await cascadeParts({
    startId: nodeId,
    startOldParts: oldParts,
    startNewParts: newParts,
    oldOwner: oldRef ?? nodeId,
    newOwner: newRef ?? nodeId,
    newOwnerTitle: newRef ? ownerTitle : nodeData.title ?? "",
    cache,
  });

  // 5. Logs: the node's "modify elements" (parent) + each isPartOf child log.
  if (uname) {
    await writeChangeLog(
      {
        nodeId,
        modifiedBy: uname,
        modifiedProperty: "parts",
        previousValue: oldPartsCol,
        newValue: parts,
        modifiedAt: new Date(),
        changeType: "modify elements",
        fullNode: nodeData,
        ...(appName ? { appName } : {}),
      } as NodeChange,
      parentLogId,
    );
  }
  for (const log of childLogs) await writeChangeLog(log);

  return { ok: true, ref: newRef };
}

function fail(res: NextApiResponse, status: number, msg: string) {
  return res.status(status).json({ error: msg, message: msg });
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return fail(res, 405, "Method not allowed");
  const data = req.body.data;
  const { nodeId, appName, user } = data as {
    nodeId?: string;
    appName?: string;
    user?: any;
  };
  const { uname } = user?.userData || {};

  if (!nodeId || typeof nodeId !== "string") {
    return fail(res, 400, "nodeId is required");
  }

  const parts = sanitizeParts(data.parts, nodeId);
  if (!parts) {
    return fail(res, 400, "parts must be an array of collections");
  }

  try {
    const nodeData = (await db.collection(NODES).doc(nodeId).get()).data() as
      | INode
      | undefined;
    if (!nodeData || nodeData.deleted) return fail(res, 404, "Node not found");
    if (appName && nodeData.appName && nodeData.appName !== appName) {
      return fail(res, 403, "Node does not belong to this app");
    }

    const result = await applyParts({
      nodeId,
      nodeData,
      parts,
      inheritedPartsDetails: Array.isArray(data.inheritedPartsDetails)
        ? data.inheritedPartsDetails
        : undefined,
      uname,
      appName,
    });
    return res.status(200).json(result);
  } catch (error: any) {
    if (error instanceof HttpError) return fail(res, error.status, error.message);
    console.error("nodes/parts/update error", error);
    recordLogs(
      {
        type: "error",
        error: JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
        at: "nodes/parts/update",
      },
      uname,
    );
    const message = error?.message || "Internal error";
    return res.status(500).json({ error: message, message });
  }
}

export default fbAuth(handler);
