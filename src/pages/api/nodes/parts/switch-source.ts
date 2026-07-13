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
import {
  childSourceOf,
  derivePartsAndRef,
  isOwnedPart,
} from "@components/lib/server/partsModel";

/**
 * Switches which generalization a part is SPECIFICALLY inherited from. The
 * part's `inheritedFrom` becomes the owner resolved through the picked
 * generalization. Membership and order don't change, so the node's overall
 * inheritance is untouched. No isPartOf changes, no cascade.
 */
async function applySwitchSource(ctx: {
  nodeId: string;
  nodeData: INode;
  partId: string;
  genId: string;
  uname?: string;
  appName?: string;
}): Promise<{ ok: true; ref: string | null; parts: ICollection[] }> {
  const { nodeId, nodeData, partId, genId, uname, appName } = ctx;
  const cache: NodeCache = new Map([[nodeId, nodeData]]);

  const oldPartsCol = asPartsCollections(nodeData.properties?.parts);
  const gens = await buildGensForAttach(nodeData, cache);
  const { tagged, stored } = taggedPartsAndSource(nodeData, gens);

  const gen = gens.find((g) => g.id === genId);
  if (!gen) {
    throw new HttpError(400, "genId is not a generalization of this node");
  }
  const part = tagged.find((p) => p.id === partId);
  if (!part) throw new HttpError(400, "partId is not a part of this node");
  if (isOwnedPart(part)) {
    throw new HttpError(400, "this node owns the part; nothing to switch");
  }
  const genPart = gen.parts.find((p) => p.id === partId);
  if (!genPart) {
    throw new HttpError(400, "the generalization does not provide this part");
  }

  const owner = childSourceOf(genPart, genId);
  const edited = tagged.map((p) =>
    p.id === partId ? { ...p, inheritedFrom: owner } : p,
  );

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

    const result = await applySwitchSource({
      nodeId,
      nodeData,
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
