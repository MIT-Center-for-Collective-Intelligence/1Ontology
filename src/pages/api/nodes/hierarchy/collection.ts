import type { NextApiRequest, NextApiResponse } from "next";
import fbAuth from "@components/middlewares/fbAuth";
import { db } from "@components/lib/firestoreServer/admin";
import { NODES } from "@components/lib/firestoreClient/collections";
import { ICollection, INode, NodeChange } from "@components/types/INode";
import {
  HttpError,
  Side,
  asCollections,
  writeSideOrder,
  writeChangeLog,
  recordLogs,
} from "@components/lib/server/hierarchy";

/**
 * Adds, renames, or deletes a named collection on a node's specializations or
 * generalizations. The nodes themselves don't move between parents, so there's
 * no reciprocity, inheritance, cycle, or derived-paths work — just rewrite the
 * side and log it. Deleting a collection merges its nodes back into `main`.
 */

type CollectionAction = "add" | "rename" | "delete";

async function applyCollection(ctx: {
  nodeId: string;
  nodeData: INode;
  side: Side;
  action: CollectionAction;
  collectionName: string;
  newName?: string;
  uname?: string;
  appName?: string;
}): Promise<{ ok: true }> {
  const { nodeId, nodeData, side, action, collectionName, newName, uname, appName } =
    ctx;

  const previousValue = asCollections(nodeData[side]);
  const collections: ICollection[] = JSON.parse(JSON.stringify(previousValue));

  let changeType: NodeChange["changeType"];
  let changeDetails: Record<string, any>;

  if (action === "add") {
    if (collectionName === "main") {
      throw new HttpError(400, '"main" is a reserved collection');
    }
    if (collections.some((c) => c.collectionName === collectionName)) {
      throw new HttpError(409, `Collection "${collectionName}" already exists`);
    }
    collections.unshift({ collectionName, nodes: [] });
    changeType = "add collection";
    changeDetails = { addedCollection: collectionName };
  } else if (action === "rename") {
    if (!newName) throw new HttpError(400, "newName is required");
    if (collectionName === "main" || newName === "main") {
      throw new HttpError(400, '"main" is a reserved collection');
    }
    if (collections.some((c) => c.collectionName === newName)) {
      throw new HttpError(409, `Collection "${newName}" already exists`);
    }
    const target = collections.find((c) => c.collectionName === collectionName);
    if (!target) {
      throw new HttpError(404, `Collection "${collectionName}" not found`);
    }
    target.collectionName = newName;
    changeType = "edit collection";
    changeDetails = { modifiedCollection: collectionName, newValue: newName };
  } else {
    if (collectionName === "main") {
      throw new HttpError(400, '"main" cannot be deleted');
    }
    const target = collections.find((c) => c.collectionName === collectionName);
    if (!target) {
      throw new HttpError(404, `Collection "${collectionName}" not found`);
    }
    let main = collections.find((c) => c.collectionName === "main");
    if (!main) {
      main = { collectionName: "main", nodes: [] };
      collections.unshift(main);
    }
    const existing = new Set(main.nodes.map((n) => n.id));
    for (const node of target.nodes) {
      if (existing.has(node.id)) continue;
      main.nodes.push(node);
      existing.add(node.id);
    }
    collections.splice(
      collections.findIndex((c) => c.collectionName === collectionName),
      1,
    );
    changeType = "delete collection";
    changeDetails = { deletedCollection: collectionName };
  }

  await writeSideOrder(nodeId, side, collections);

  if (uname) {
    await writeChangeLog({
      nodeId,
      modifiedBy: uname,
      modifiedProperty: side,
      previousValue,
      newValue: collections,
      modifiedAt: new Date(),
      changeType,
      changeDetails,
      fullNode: nodeData,
      ...(appName ? { appName } : {}),
    } as NodeChange);
  }

  return { ok: true };
}

function fail(res: NextApiResponse, status: number, msg: string) {
  return res.status(status).json({ error: msg, message: msg });
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") return fail(res, 405, "Method not allowed");
  const data = req.body.data;
  const { nodeId, side, action, collectionName, newName, appName, user } = data as {
    nodeId?: string;
    side?: Side;
    action?: CollectionAction;
    collectionName?: string;
    newName?: string;
    appName?: string;
    user?: any;
  };
  const { uname } = user?.userData || {};

  if (!nodeId || typeof nodeId !== "string") {
    return fail(res, 400, "nodeId is required");
  }
  if (side !== "specializations" && side !== "generalizations") {
    return fail(res, 400, "side must be 'specializations' or 'generalizations'");
  }
  if (action !== "add" && action !== "rename" && action !== "delete") {
    return fail(res, 400, "action must be 'add', 'rename' or 'delete'");
  }
  if (!collectionName || typeof collectionName !== "string") {
    return fail(res, 400, "collectionName is required");
  }
  if (action === "rename" && (!newName || typeof newName !== "string")) {
    return fail(res, 400, "newName is required");
  }

  try {
    const nodeData = (await db.collection(NODES).doc(nodeId).get()).data() as
      | INode
      | undefined;
    if (!nodeData || nodeData.deleted) return fail(res, 404, "Node not found");
    if (appName && nodeData.appName && nodeData.appName !== appName) {
      return fail(res, 403, "Node does not belong to this app");
    }

    const result = await applyCollection({
      nodeId,
      nodeData,
      side,
      action,
      collectionName,
      newName,
      uname,
      appName,
    });
    return res.status(200).json(result);
  } catch (error: any) {
    if (error instanceof HttpError) return fail(res, error.status, error.message);
    console.error("nodes/hierarchy/collection error", error);
    recordLogs(
      {
        type: "error",
        error: JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
        at: "nodes/hierarchy/collection",
      },
      uname,
    );
    const message = error?.message || "Internal error";
    return res.status(500).json({ error: message, message });
  }
};

export default fbAuth(handler);
