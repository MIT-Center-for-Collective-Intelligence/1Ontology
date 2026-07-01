import type { NextApiRequest, NextApiResponse } from "next";
import fbAuth from "@components/middlewares/fbAuth";
import { db } from "@components/lib/firestoreServer/admin";
import { NODES, NODES_LOGS } from "@components/lib/firestoreClient/collections";
import { ICollection, INode, NodeChange } from "@components/types/INode";
import { updateDerivedPaths } from "@components/lib/server/updateDerivedPaths";
import {
  HttpError,
  NodeCache,
  hasOwn,
  asCollections,
  addToMain,
  addToCollection,
  walkSpecializations,
  buildSpecializationNode,
  removeFromUnclassified,
  recomputeInheritance,
  writeChangeLog,
  recordLogs,
} from "@components/lib/server/hierarchy";

const SCALAR_TYPES = new Set([
  "string",
  "numeric",
  "string-select",
  "string-array",
]);

/** Adds a node to a side, into `main` or a named collection. */
function addToSide(
  side: ICollection[],
  collectionName: string,
  linkNode: { id: string; title?: string },
) {
  if (collectionName && collectionName !== "main") {
    addToCollection(side, collectionName, linkNode);
  } else {
    addToMain(side, linkNode);
  }
}

/**
 * Re-points descendants that still inherit `propertyName` through `nodeId` back
 * at `nodeId`, after it became an override. Port of the same helper in
 * nodes/properties/update.ts.
 */
async function rewireInheritingDescendants(
  nodeId: string,
  nodeTitle: string,
  propertyName: string,
): Promise<void> {
  await walkSpecializations(
    nodeId,
    (node) => {
      const inh = node.inheritance?.[propertyName];
      if (!inh || inh.inheritanceType === "neverInherit") return null;
      const stillInherits = inh.ref !== null;
      const rewire =
        inh.inheritanceType === "alwaysInherit" ||
        (inh.inheritanceType === "inheritUnlessAlreadyOverRidden" &&
          stillInherits);
      if (!rewire) return null;
      return {
        [`inheritance.${propertyName}.ref`]: nodeId,
        [`inheritance.${propertyName}.title`]: nodeTitle,
      };
    },
    { descendPastSkipped: false },
  );
}

/**
 * Creates a new node as a child of `source`, then links that new node into the
 * current node's `targetProperty`. The link is built differently per target:
 * hierarchy (spec/gen), parts (own value + reciprocal isPartOf), or a generic
 * link property (propertyOf + inheritance override).
 */
async function applyClone(ctx: {
  newNodeId: string;
  title: string;
  source: INode;
  currentNode: INode;
  targetProperty: string;
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
  const isHierarchy =
    targetProperty === "specializations" ||
    targetProperty === "generalizations";
  const isParts = targetProperty === "parts";

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
    // when the clone source is the current node, buildSpecializationNode
    // already seeded the opposite side with it.
    addToMain(newNode.specializations, {
      id: currentNodeId,
      title: currentNode.title ?? "",
    });
  } else if (targetProperty === "specializations") {
    addToMain(newNode.generalizations, {
      id: currentNodeId,
      title: currentNode.title ?? "",
    });
  } else if (isParts) {
    addToMain((newNode.properties as any).isPartOf, {
      id: currentNodeId,
      title: currentNode.title ?? "",
    });
  } else {
    (newNode as any).propertyOf = {
      ...(newNode.propertyOf || {}),
      [targetProperty]: [
        { collectionName: "main", nodes: [{ id: currentNodeId }] },
      ],
    };
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

  // Section link on the current node. `sideBefore`/`side` feed the parent log.
  let sideBefore: ICollection[];
  let side: ICollection[];
  if (isHierarchy) {
    sideBefore = asCollections((currentNode as any)[targetProperty]);
    side = JSON.parse(JSON.stringify(sideBefore));
    addToSide(side, collectionName, { id: newNodeId, title });
    await db
      .collection(NODES)
      .doc(currentNodeId)
      .update({ [targetProperty]: side });
    cache.set(currentNodeId, {
      ...currentNode,
      [targetProperty]: side,
    } as INode);
  } else if (isParts) {
    // Parts are a plain own value; inheritance is recomputed by a separate
    // endpoint, so this just stores the value and the reciprocal isPartOf.
    sideBefore = asCollections(currentNode.properties?.parts);
    side = JSON.parse(JSON.stringify(sideBefore));
    addToSide(side, collectionName, { id: newNodeId, title });
    await db
      .collection(NODES)
      .doc(currentNodeId)
      .update({ [`properties.parts`]: side });
    cache.set(currentNodeId, {
      ...currentNode,
      properties: { ...currentNode.properties, parts: side },
    });
  } else {
    // Generic link property: resolve the value the user saw (through the
    // inheritance ref while inheriting), add the new node, and override if it was
    // inherited.
    const inheritedRef = currentNode.inheritance?.[targetProperty]?.ref;
    let refData: INode | undefined;
    if (inheritedRef) {
      refData = (
        await db.collection(NODES).doc(inheritedRef).get()
      ).data() as INode | undefined;
    }
    const base =
      refData && hasOwn(refData.properties, targetProperty)
        ? refData.properties[targetProperty]
        : (currentNode.properties as any)?.[targetProperty];
    sideBefore = asCollections(base);
    side = JSON.parse(JSON.stringify(sideBefore));
    addToSide(side, collectionName, { id: newNodeId, title });
    const updates: Record<string, any> = {
      [`properties.${targetProperty}`]: side,
    };
    if (inheritedRef) {
      updates[`inheritance.${targetProperty}.ref`] = null;
      updates[`inheritance.${targetProperty}.title`] = "";
      if (refData?.textValue && hasOwn(refData.textValue, targetProperty)) {
        updates[`textValue.${targetProperty}`] = refData.textValue[targetProperty];
      }
    }
    await db.collection(NODES).doc(currentNodeId).update(updates);
    if (inheritedRef) {
      await rewireInheritingDescendants(
        currentNodeId,
        currentNode.title ?? "",
        targetProperty,
      );
    }
  }

  // "add node" creation log.
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

  // Inheritance recompute (hierarchy only). A generalizations add can pull the
  // current node out of unclassified; a specializations add gives the new node
  // a second generalization.
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
  } else if (targetProperty === "specializations") {
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
  if (!targetProperty || typeof targetProperty !== "string") {
    return fail(res, 400, "targetProperty is required");
  }
  if (targetProperty === "isPartOf") {
    return fail(res, 400, "cannot clone into isPartOf");
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

    // A generic property target must exist on the node and be link-typed.
    const isHierarchy =
      targetProperty === "specializations" ||
      targetProperty === "generalizations";
    if (!isHierarchy && targetProperty !== "parts") {
      if (!hasOwn(currentNode.properties, targetProperty)) {
        return fail(res, 404, `Property "${targetProperty}" not found`);
      }
      const propertyType = (currentNode.propertyType as any)?.[targetProperty];
      if (!propertyType || SCALAR_TYPES.has(propertyType)) {
        return fail(res, 400, `Property "${targetProperty}" is not link-typed`);
      }
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
