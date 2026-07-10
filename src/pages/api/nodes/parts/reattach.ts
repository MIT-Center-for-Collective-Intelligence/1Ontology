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
  partsNodes,
  toParts,
} from "@components/lib/server/parts";
import {
  derivePartsAndRef,
  resetOntoSource,
} from "@components/lib/server/partsModel";

/**
 * Attaches a node's overall parts inheritance to one of its generalizations —
 * repairing a break, or moving a healthy node to a different source. Both are the
 * same HARD RESET: the node keeps only the parts it OWNS, adopts the source's
 * parts in the source's order, and re-points them at the source. Parts it drew
 * from another generalization are discarded, so this is destructive: the client
 * confirms first. Descendants are not touched yet (cascade comes later).
 */
async function applyReattach(ctx: {
  nodeId: string;
  nodeData: INode;
  sourceId: string;
  uname?: string;
  appName?: string;
}): Promise<{ ok: true; ref: string | null; parts: ICollection[] }> {
  const { nodeId, nodeData, sourceId, uname, appName } = ctx;
  const cache: NodeCache = new Map([[nodeId, nodeData]]);

  const oldPartsCol = asPartsCollections(nodeData.properties?.parts);
  const oldParts = partsNodes(oldPartsCol);

  const gens = await buildGensForAttach(nodeData, cache);
  const source = gens.find((g) => g.id === sourceId);
  if (!source) {
    throw new HttpError(400, "sourceId is not a generalization of this node");
  }

  // A node that has never been through the model carries no ownership tags, so
  // every part would read as owned and survive the reset. Establish ownership
  // from the generalizations once; afterwards the stored tags are the truth.
  const modeled =
    nodeData.partsOverallSource !== undefined ||
    oldParts.some((p) => !!p.inheritedFrom);
  const tagged = modeled
    ? oldParts
    : derivePartsAndRef(oldParts, gens, { oldParts: [] }).parts;

  // Reset onto the source, then re-derive: the reset list always matches, so the
  // node comes back attached with `sourceId` recorded as its stored choice.
  const reset = resetOntoSource(tagged, source);
  const {
    parts: newParts,
    sourceId: newSource,
    ref,
  } = derivePartsAndRef(reset, gens, { oldParts: tagged, sourceId });
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
      changeType: "modify elements",
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
      nodeData,
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
