import type { NextApiRequest, NextApiResponse } from "next";
import fbAuth from "@components/middlewares/fbAuth";
import { db } from "@components/lib/firestoreServer/admin";
import { NODES } from "@components/lib/firestoreClient/collections";
import { ICollection, INode, NodeChange } from "@components/types/INode";
import {
  HttpError,
  Side,
  asCollections,
  sanitizeCollections,
  isSameMembership,
  writeSideOrder,
  writeChangeLog,
  recordLogs,
} from "@components/lib/server/hierarchy";

/**
 * Reorders a node's specializations or generalizations: moving nodes within or
 * between collections, or reordering the collections themselves. The same nodes
 * stay linked, so it only saves the new order and logs it (no reciprocity,
 * inheritance, cycle, or derived-paths work).
 */

type SortType = "elements" | "collections";

/** Builds a string of the current order, used to skip when nothing changed. */
const orderSignature = (collections: ICollection[]): string =>
  collections
    .map((c) => `${c.collectionName}:${c.nodes.map((n) => n.id).join(",")}`)
    .join("|");

async function applySort(ctx: {
  nodeId: string;
  nodeData: INode;
  side: Side;
  value: ICollection[];
  sortType: SortType;
  changeDetails?: Record<string, any>;
  uname?: string;
  appName?: string;
}): Promise<{ ok: true }> {
  const { nodeId, nodeData, side, value, sortType, changeDetails, uname, appName } =
    ctx;

  const previousValue = asCollections(nodeData[side]);
  if (!isSameMembership(previousValue, value)) {
    throw new HttpError(400, "Sort can only reorder links, not add or remove them");
  }
  if (orderSignature(previousValue) === orderSignature(value)) return { ok: true };

  await writeSideOrder(nodeId, side, value);

  if (uname) {
    await writeChangeLog({
      nodeId,
      modifiedBy: uname,
      modifiedProperty: side,
      previousValue,
      newValue: value,
      modifiedAt: new Date(),
      changeType: sortType === "collections" ? "sort collections" : "sort elements",
      ...(changeDetails ? { changeDetails } : {}),
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
  const { nodeId, side, sortType, appName, user } = data as {
    nodeId?: string;
    side?: Side;
    sortType?: SortType;
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
  const value = sanitizeCollections(data.value, nodeId);
  if (!value) return fail(res, 400, "value must be an array of collections");

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
      side,
      value,
      sortType: sortType === "collections" ? "collections" : "elements",
      changeDetails:
        data.changeDetails && typeof data.changeDetails === "object"
          ? data.changeDetails
          : undefined,
      uname,
      appName,
    });
    return res.status(200).json(result);
  } catch (error: any) {
    if (error instanceof HttpError) return fail(res, error.status, error.message);
    console.error("nodes/hierarchy/sort error", error);
    recordLogs(
      {
        type: "error",
        error: JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
        at: "nodes/hierarchy/sort",
      },
      uname,
    );
    const message = error?.message || "Internal error";
    return res.status(500).json({ error: message, message });
  }
};

export default fbAuth(handler);
