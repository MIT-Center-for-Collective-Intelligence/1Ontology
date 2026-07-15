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
 * Sets or clears a part's `optional` flag.
 */
async function applyToggleOptional(ctx: {
  nodeId: string;
  nodeData: INode;
  partId: string;
  optional: boolean;
  uname?: string;
  appName?: string;
}): Promise<{ ok: true; ref: string | null; parts: ICollection[] }> {
  const { nodeId, nodeData, partId, optional, uname, appName } = ctx;
  const cache: NodeCache = new Map([[nodeId, nodeData]]);

  const oldPartsCol = asPartsCollections(nodeData.properties?.parts);
  const gens = await buildGensForAttach(nodeData, cache);
  const { tagged, stored } = taggedPartsAndSource(nodeData, gens);

  const part = tagged.find((p) => p.id === partId);
  if (!part) throw new HttpError(400, "partId is not a part of this node");

  const edited = tagged.map((p) => {
    if (p.id !== partId) return p;
    const node = { ...p };
    if (optional) node.optional = true;
    else delete node.optional;
    return node;
  });

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

    const result = await applyToggleOptional({
      nodeId,
      nodeData,
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
