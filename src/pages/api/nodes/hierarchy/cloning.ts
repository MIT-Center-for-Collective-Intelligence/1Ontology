import type { NextApiRequest, NextApiResponse } from "next";
import fbAuth from "@components/middlewares/fbAuth";
import { db } from "@components/lib/firestoreServer/admin";
import { NODES, NODES_LOGS } from "@components/lib/firestoreClient/collections";
import { ICollection, INode, NodeChange } from "@components/types/INode";
import { updateDerivedPaths } from "@components/lib/server/updateDerivedPaths";
import {
  HttpError,
  Side,
  NodeCache,
  asCollections,
  addToMain,
  addToCollection,
  buildSpecializationNode,
  removeFromUnclassified,
  recomputeInheritance,
  writeChangeLog,
  recordLogs,
} from "@components/lib/server/hierarchy";

/**
 * Creates a new node as a child of `source`, then links that new node into the
 * current node's chosen section. Only handles the specializations and
 * generalizations sections for now; parts and other properties stay on the old
 * client path.
 */
async function applyClone(ctx: {
  newNodeId: string;
  title: string;
  source: INode; // the node being cloned
  currentNode: INode; // the node being edited
  targetProperty: Side;
  collectionName: string;
  uname?: string;
  appName?: string;
}): Promise<{ ok: true; nodeId: string }> {
  const {
    newNodeId,
    title,
    source,
    currentNode,
    targetProperty,
    collectionName,
    uname,
    appName,
  } = ctx;
  const sourceId = source.id;
  const currentNodeId = currentNode.id;

  // Build the new node and add the current node to its links first, so it can
  // be written once with everything already in place.
  const newNode = buildSpecializationNode(
    source,
    newNodeId,
    title,
    uname ?? "",
    appName,
  );
  if (targetProperty === "generalizations") {
    newNode.specializations[0].nodes.push({
      id: currentNodeId,
      title: currentNode.title ?? "",
    });
  } else {
    newNode.generalizations[0].nodes.push({
      id: currentNodeId,
      title: currentNode.title ?? "",
    });
  }

  const cache: NodeCache = new Map([
    [newNodeId, newNode],
    [sourceId, source],
    [currentNodeId, currentNode],
  ]);

  const parentLogId = db.collection(NODES_LOGS).doc().id;
  const parentLog = {
    logId: parentLogId,
    nodeId: currentNodeId,
    nodeTitle: currentNode.title ?? "",
    changeType: "modify elements" as const,
  };
  const childLogs: NodeChange[] = [];

  // Write the new node.
  await db
    .collection(NODES)
    .doc(newNodeId)
    .set({ ...newNode, createdAt: new Date() });

  // Link the new node under the node it was cloned from.
  const sourceSpecsBefore = asCollections(source.specializations);
  const sourceSpecs: ICollection[] = JSON.parse(
    JSON.stringify(sourceSpecsBefore),
  );
  addToMain(sourceSpecs, { id: newNodeId, title });
  await db
    .collection(NODES)
    .doc(sourceId)
    .update({ specializations: sourceSpecs });
  cache.set(sourceId, { ...source, specializations: sourceSpecs });
  if (uname) {
    childLogs.push({
      nodeId: sourceId,
      modifiedBy: uname,
      modifiedProperty: "specializations",
      previousValue: sourceSpecsBefore,
      newValue: sourceSpecs,
      modifiedAt: new Date(),
      changeType: "add element",
      fullNode: source,
      triggeredBy: parentLog,
      ...(appName ? { appName } : {}),
    } as NodeChange);
  }

  // Add the new node to the section the user edited on the current node.
  const sideBefore = asCollections(currentNode[targetProperty]);
  const side: ICollection[] = JSON.parse(JSON.stringify(sideBefore));
  if (collectionName && collectionName !== "main") {
    addToCollection(side, collectionName, { id: newNodeId, title });
  } else {
    addToMain(side, { id: newNodeId, title });
  }
  await db
    .collection(NODES)
    .doc(currentNodeId)
    .update({ [targetProperty]: side });
  cache.set(currentNodeId, { ...currentNode, [targetProperty]: side });

  // Log the creation of the new node.
  if (uname) {
    childLogs.push({
      nodeId: newNodeId,
      modifiedBy: uname,
      modifiedProperty: "",
      previousValue: null,
      newValue: null,
      modifiedAt: new Date(),
      changeType: "add node",
      fullNode: newNode,
      triggeredBy: parentLog,
      ...(appName ? { appName } : {}),
    } as NodeChange);
  }

  // A generalizations-side add can pull the current node out of unclassified;
  // a specializations-side add gives the new node a second generalization.
  if (targetProperty === "generalizations") {
    await removeFromUnclassified(
      currentNodeId,
      cache,
      parentLog,
      uname,
      appName,
      childLogs,
    );
    cache.delete(currentNodeId);
    await recomputeInheritance(currentNodeId, cache);
  } else {
    cache.delete(newNodeId);
    await recomputeInheritance(newNodeId, cache);
  }

  await updateDerivedPaths({
    db,
    changedNodeIds:
      targetProperty === "generalizations"
        ? [newNodeId, currentNodeId]
        : [newNodeId],
  });

  if (uname) {
    await writeChangeLog(
      {
        nodeId: currentNodeId,
        modifiedBy: uname,
        modifiedProperty: targetProperty,
        previousValue: sideBefore,
        newValue: side,
        modifiedAt: new Date(),
        changeType: "modify elements",
        fullNode: currentNode,
        ...(appName ? { appName } : {}),
      } as NodeChange,
      parentLogId,
    );
  }
  for (const log of childLogs) await writeChangeLog(log);

  return { ok: true, nodeId: newNodeId };
}

function fail(res: NextApiResponse, status: number, msg: string) {
  return res.status(status).json({ error: msg, message: msg });
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") return fail(res, 405, "Method not allowed");
  const data = req.body.data;
  const {
    newNodeId,
    title,
    generalizationId,
    targetNodeId,
    targetProperty,
    collectionName,
    appName,
    user,
  } = data as {
    newNodeId?: string;
    title?: string;
    generalizationId?: string;
    targetNodeId?: string;
    targetProperty?: string;
    collectionName?: string;
    appName?: string;
    user?: any;
  };
  const { uname } = user?.userData || {};

  if (!newNodeId || typeof newNodeId !== "string") {
    return fail(res, 400, "newNodeId is required");
  }
  if (!title || typeof title !== "string") {
    return fail(res, 400, "title is required");
  }
  if (!generalizationId || typeof generalizationId !== "string") {
    return fail(res, 400, "generalizationId is required");
  }
  if (!targetNodeId || typeof targetNodeId !== "string") {
    return fail(res, 400, "targetNodeId is required");
  }
  if (
    targetProperty !== "specializations" &&
    targetProperty !== "generalizations"
  ) {
    return fail(
      res,
      400,
      `cloning into "${targetProperty}" is not supported yet`,
    );
  }

  try {
    const [sourceSnap, currentSnap, newSnap] = await Promise.all([
      db.collection(NODES).doc(generalizationId).get(),
      db.collection(NODES).doc(targetNodeId).get(),
      db.collection(NODES).doc(newNodeId).get(),
    ]);
    if (newSnap.exists) return fail(res, 409, "newNodeId already exists");
    const source = sourceSnap.data() as INode | undefined;
    const currentNode = currentSnap.data() as INode | undefined;
    if (!source || source.deleted) return fail(res, 404, "Source node not found");
    if (!currentNode || currentNode.deleted) {
      return fail(res, 404, "Target node not found");
    }
    if (appName && source.appName && source.appName !== appName) {
      return fail(res, 403, "Source node does not belong to this app");
    }

    const result = await applyClone({
      newNodeId,
      title,
      source: { ...source, id: generalizationId },
      currentNode: { ...currentNode, id: targetNodeId },
      targetProperty,
      collectionName: collectionName || "main",
      uname,
      appName,
    });
    return res.status(200).json(result);
  } catch (error: any) {
    if (error instanceof HttpError) return fail(res, error.status, error.message);
    console.error("nodes/hierarchy/cloning error", error);
    recordLogs(
      {
        type: "error",
        error: JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
        at: "nodes/hierarchy/cloning",
      },
      uname,
    );
    const message = error?.message || "Internal error";
    return res.status(500).json({ error: message, message });
  }
};

export default fbAuth(handler);
