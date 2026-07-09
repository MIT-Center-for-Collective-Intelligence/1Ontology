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
  applyIsPartOfOwnerOnly,
  asPartsCollections,
  buildGensForAttach,
  cascadeParts,
  overallSourceOf,
  partsInheritanceEntry,
  partsNodes,
  sanitizeParts,
  toParts,
} from "@components/lib/server/parts";
import {
  derivePartsAndRef,
  isOwnedPart,
} from "@components/lib/server/partsModel";

/**
 * Saves a node's `parts`. The client sends the full new list; the server
 * re-derives each part's owner (`inheritedFrom`) and the overall
 * `inheritance.parts.ref` from the node's generalizations, materializes the
 * change down the attached subtree, updates owner-only `isPartOf`, and logs it.
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
  const clientParts = partsNodes(parts);

  // 1. Re-derive each part's owner (inheritedFrom) from this node's
  //    generalizations, preserving the user's order, and re-check the stored
  //    overall source — the edit may have broken it, and it never reattaches.
  const gens = await buildGensForAttach(nodeData, cache);
  const {
    parts: newParts,
    sourceId: newSource,
    ref: newRef,
  } = derivePartsAndRef(clientParts, gens, {
    oldParts,
    sourceId: overallSourceOf(nodeData),
  });
  const ownerTitle = newRef ? (await getNode(newRef, cache))?.title ?? "" : "";

  // 2. Write the edited node's parts + attachment.
  const nodeUpdates: Record<string, any> = {
    "properties.parts": toParts(newParts),
    "inheritance.parts": partsInheritanceEntry(
      newRef,
      ownerTitle,
      nodeData.inheritance?.parts?.inheritanceType,
    ),
    partsOverallSource: newSource,
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
  // Keep the cache fresh: the cascade re-reads this node as a generalization of
  // its descendants, so it must see the new parts + ref, not the stored ones.
  cache.set(nodeId, {
    ...nodeData,
    properties: { ...nodeData.properties, parts: toParts(newParts) },
    inheritance: {
      ...nodeData.inheritance,
      parts: nodeUpdates["inheritance.parts"],
    },
    partsOverallSource: newSource,
  } as INode);

  const parentLogId = db.collection(NODES_LOGS).doc().id;
  const parentLog = {
    logId: parentLogId,
    nodeId,
    nodeTitle: nodeData.title ?? "",
    changeType: "modify elements" as const,
  };
  const childLogs: NodeChange[] = [];

  // 3. Owner-only isPartOf: a node lists a part iff it OWNS it (the part
  //    carries no inheritedFrom).
  const oldOwn = oldParts.filter(isOwnedPart).map((p) => p.id);
  const newOwn = newParts.filter(isOwnedPart).map((p) => p.id);
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

  // 4. Materialize the change down the attached subtree (each descendant keeps
  //    ref = its direct parent).
  await cascadeParts({
    startId: nodeId,
    startOldParts: oldParts,
    startNewParts: newParts,
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
