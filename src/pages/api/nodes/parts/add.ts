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
  childSourceOf,
  derivePartsAndRef,
  isOwnedPart,
} from "@components/lib/server/partsModel";

/**
 * Adds parts to the end of a node's list. With `genId`, each part is inherited
 * specifically through that generalization; without it, derive decides — a part
 * some generalization provides comes out inherited, anything else owned (and
 * gains an isPartOf backlink). Appending never breaks overall inheritance and a
 * broken node never reattaches. No cascade.
 */
async function applyAdd(ctx: {
  nodeId: string;
  nodeData: INode;
  partIds: string[];
  genId?: string;
  uname?: string;
  appName?: string;
}): Promise<{ ok: true; ref: string | null; parts: ICollection[] }> {
  const { nodeId, nodeData, partIds, genId, uname, appName } = ctx;
  const cache: NodeCache = new Map([[nodeId, nodeData]]);

  const oldPartsCol = asPartsCollections(nodeData.properties?.parts);
  const gens = await buildGensForAttach(nodeData, cache);
  const { tagged, stored } = taggedPartsAndSource(nodeData, gens);

  const gen = genId ? gens.find((g) => g.id === genId) : undefined;
  if (genId && !gen) {
    throw new HttpError(400, "genId is not a generalization of this node");
  }

  const existing = new Set(tagged.map((p) => p.id));
  const additions: ILinkNode[] = [];
  for (const partId of partIds) {
    if (existing.has(partId)) continue;
    existing.add(partId);
    const partNode = await getNode(partId, cache);
    if (!partNode || partNode.deleted) {
      throw new HttpError(400, `part ${partId} does not exist`);
    }
    const node: ILinkNode = { id: partId, title: partNode.title ?? "" };
    if (gen) {
      const genPart = gen.parts.find((p) => p.id === partId);
      if (!genPart) {
        throw new HttpError(
          400,
          "the generalization does not provide this part",
        );
      }
      node.inheritedFrom = childSourceOf(genPart, gen.id);
    }
    additions.push(node);
  }
  if (additions.length === 0) {
    throw new HttpError(400, "all of the parts are already on this node");
  }

  const {
    parts: newParts,
    sourceId: newSource,
    ref,
  } = derivePartsAndRef([...tagged, ...additions], gens, {
    oldParts: tagged,
    sourceId: stored,
  });
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

  const addedIds = new Set(additions.map((p) => p.id));
  const addedOwn = newParts
    .filter((p) => addedIds.has(p.id) && isOwnedPart(p))
    .map((p) => p.id);
  await applyIsPartOfOwnerOnly(
    nodeId,
    nodeData.title ?? "",
    addedOwn,
    [],
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
  const { nodeId, partIds, genId, appName, user } = data as {
    nodeId?: string;
    partIds?: string[];
    genId?: string;
    appName?: string;
    user?: any;
  };
  const { uname } = user?.userData || {};

  if (!nodeId || typeof nodeId !== "string") {
    return fail(res, 400, "nodeId is required");
  }
  if (
    !Array.isArray(partIds) ||
    partIds.length === 0 ||
    partIds.some((id) => typeof id !== "string")
  ) {
    return fail(res, 400, "partIds must be a non-empty array of part ids");
  }
  if (partIds.includes(nodeId)) {
    return fail(res, 400, "a node cannot be a part of itself");
  }
  if (genId !== undefined && typeof genId !== "string") {
    return fail(res, 400, "genId must be a string");
  }

  try {
    const nodeData = (await db.collection(NODES).doc(nodeId).get()).data() as
      | INode
      | undefined;
    if (!nodeData || nodeData.deleted) return fail(res, 404, "Node not found");
    if (appName && nodeData.appName && nodeData.appName !== appName) {
      return fail(res, 403, "Node does not belong to this app");
    }

    const result = await applyAdd({
      nodeId,
      nodeData,
      partIds,
      genId,
      uname,
      appName,
    });
    return res.status(200).json(result);
  } catch (error: any) {
    if (error instanceof HttpError)
      return fail(res, error.status, error.message);
    console.error("nodes/parts/add error", error);
    recordLogs(
      {
        type: "error",
        error: JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
        at: "nodes/parts/add",
      },
      uname,
    );
    const message = error?.message || "Internal error";
    return res.status(500).json({ error: message, message });
  }
}

export default fbAuth(handler);
