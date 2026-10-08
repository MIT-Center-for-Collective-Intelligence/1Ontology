import type { NextApiRequest, NextApiResponse } from "next";
import fbAuth from "@components/middlewares/fbAuth";
import { db, MAX_TRANSACTION_WRITES } from "@components/lib/firestoreServer/admin";
import { NODES } from "@components/lib/firestoreClient/collections";
import { ICollection, ILinkNode, INode } from "@components/types/INode";
import { HttpError, recordLogs } from "@components/lib/server/hierarchy";
import {
  asPartsCollections,
  partsNodes,
  toParts,
} from "@components/lib/server/parts";
import { partSourcesOf } from "@components/lib/server/partsModel";
import { InheritanceMode } from "@components/components/Common/PartInheritanceModeButton";

/**
 * Cascades a "Never Inherit" decision for a specific part down the descendant
 * tree of `nodeId`.
 *
 * For every descendant:
 *  - If the descendant has the part stored with the same true owner (`partOwner`),
 *    the entry is dropped and recursion continues into its children.
 *  - If the descendant has the part stored with a DIFFERENT owner (independently
 *    added or inherited via another generalization), that subtree is left alone —
 *    we stop recursing into it for this part.
 *  - If the descendant does not have the part at all, the inheritance chain is broken
 *    at that node, so we do NOT recurse into its children (e.g. Node B under Node A).
 */
async function cascadeNeverInherit(ctx: {
  nodeId: string;
  partId: string;
  partOwner: string;
  appName?: string;
}): Promise<{ removedFrom: string[] }> {
  const { nodeId, partId, partOwner } = ctx;

  const rootSnap = await db.collection(NODES).doc(nodeId).get();
  const rootData = rootSnap.data() as INode | undefined;
  if (!rootData || rootData.deleted) return { removedFrom: [] };

  const removedFrom: string[] = [];
  const visited = new Set<string>([nodeId]);
  let batch = db.batch();
  let pending = 0;

  async function recurse(
    currentNodeId: string,
    nodeData: INode,
  ): Promise<void> {
    const childIds = (nodeData.specializations ?? []).flatMap(
      (c: ICollection) => (c.nodes ?? []).map((n: ILinkNode) => n.id),
    );

    for (const childId of childIds) {
      if (visited.has(childId)) continue;
      visited.add(childId);

      const childSnap = await db.collection(NODES).doc(childId).get();
      const childData = childSnap.data() as INode | undefined;
      if (!childData || childData.deleted) continue;

      const parts = partsNodes(asPartsCollections(childData.properties?.parts));
      const partEntry = parts.find((e) => e.id === partId);

      if (!partEntry) {
        // Descendant does not have the part. The inheritance chain is broken at this node.
        // If descendant node A doesn't have the part, do not remove the part from node A's children.
        continue;
      }

      const entryOwner = partEntry.inheritedFrom;

      if (entryOwner === partOwner) {
        // The part was inherited through the same chain — remove it.
        const next = parts.filter((e) => e.id !== partId);
        const side = toParts(next);

        if ((pending + 1) >= MAX_TRANSACTION_WRITES) {
          await batch.commit();
          batch = db.batch();
          pending = 0;
        }

        batch.update(db.collection(NODES).doc(childId), {
          "properties.parts": side,
          partSources: partSourcesOf(
            next,
            Object.keys(childData.partsInheritance?.overrides ?? {}),
          ),
        });
        pending += 1;
        removedFrom.push(childId);

        // Continue recursing — grandchildren may also need cleanup.
        await recurse(childId, {
          ...childData,
          properties: { ...childData.properties, parts: side },
        } as INode);
      } else {
        // Part exists with a different owner: leave this node and its entire subtree alone.
        continue;
      }
    }
  }

  await recurse(nodeId, rootData);

  if (pending > 0) await batch.commit();

  return { removedFrom };
}

/**
 * Cascades an "Always Inherit" or "Inherit Unless Overridden" decision
 * by adding the part back to all descendants in `nodeId`'s specialization tree
 * that do not already have it.
 */
async function cascadeAddPart(ctx: {
  nodeId: string;
  partId: string;
  partOwner: string;
  partTitle?: string;
  optional?: boolean;
  appName?: string;
}): Promise<{ addedTo: string[] }> {
  const { nodeId, partId, partOwner, partTitle, optional } = ctx;

  const rootSnap = await db.collection(NODES).doc(nodeId).get();
  const rootData = rootSnap.data() as INode | undefined;
  if (!rootData || rootData.deleted) return { addedTo: [] };

  // Resolve title
  let title = partTitle;
  if (!title) {
    const rootParts = partsNodes(asPartsCollections(rootData.properties?.parts));
    const entry = rootParts.find((e) => e.id === partId);
    title = entry?.title;
  }
  if (!title) {
    const partSnap = await db.collection(NODES).doc(partId).get();
    title = (partSnap.data() as INode | undefined)?.title ?? "";
  }

  const isOptional = Boolean(optional);
  const addedTo: string[] = [];
  const visited = new Set<string>([nodeId]);
  let batch = db.batch();
  let pending = 0;

  async function recurse(
    currentNodeId: string,
    nodeData: INode,
  ): Promise<void> {
    const childIds = (nodeData.specializations ?? []).flatMap(
      (c: ICollection) => (c.nodes ?? []).map((n: ILinkNode) => n.id),
    );

    for (const childId of childIds) {
      if (visited.has(childId)) continue;
      visited.add(childId);

      const childSnap = await db.collection(NODES).doc(childId).get();
      const childData = childSnap.data() as INode | undefined;
      if (!childData || childData.deleted) continue;

      const parts = partsNodes(asPartsCollections(childData.properties?.parts));
      const existing = parts.find((e) => e.id === partId);

      let nextNodeData = childData;

      if (!existing) {
        // Part does not exist on this descendant: add it back as inherited from partOwner
        const newEntry: ILinkNode = {
          id: partId,
          title: title || "",
          inheritedFrom: partOwner,
        };
        if (isOptional) newEntry.optional = true;

        const next = [...parts, newEntry];
        const side = toParts(next);

        if ((pending + 1) >= MAX_TRANSACTION_WRITES) {
          await batch.commit();
          batch = db.batch();
          pending = 0;
        }

        batch.update(db.collection(NODES).doc(childId), {
          "properties.parts": side,
          partSources: partSourcesOf(
            next,
            Object.keys(childData.partsInheritance?.overrides ?? {}),
          ),
        });
        pending += 1;
        addedTo.push(childId);

        nextNodeData = {
          ...childData,
          properties: { ...childData.properties, parts: side },
        } as INode;
      }

      // Continue recursing so all descendants down the tree receive the part
      await recurse(childId, nextNodeData);
    }
  }

  await recurse(nodeId, rootData);

  if (pending > 0) await batch.commit();

  return { addedTo };
}

function fail(res: NextApiResponse, status: number, msg: string) {
  return res.status(status).json({ error: msg, message: msg });
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return fail(res, 405, "Method not allowed");
  const data = req.body.data;
  const {
    nodeId,
    partId,
    partOwner,
    mode = "neverInherit",
    partTitle,
    optional,
    appName,
    user,
  } = data as {
    nodeId?: string;
    partId?: string;
    partOwner?: string;
    mode?: InheritanceMode;
    partTitle?: string;
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
  if (!partOwner || typeof partOwner !== "string") {
    return fail(res, 400, "partOwner is required");
  }

  try {
    const nodeSnap = await db.collection(NODES).doc(nodeId).get();
    const nodeData = nodeSnap.data() as INode | undefined;
    if (!nodeData || nodeData.deleted) return fail(res, 404, "Node not found");
    if (appName && nodeData.appName && nodeData.appName !== appName) {
      return fail(res, 403, "Node does not belong to this app");
    }

    // Persist the part's inheritance mode on the target node
    await db.collection(NODES).doc(nodeId).update({
      [`partInheritanceModes.${partId}`]: mode,
    });

    if (mode === "neverInherit") {
      const result = await cascadeNeverInherit({
        nodeId,
        partId,
        partOwner,
        appName,
      });
      return res.status(200).json({ ok: true, mode, ...result });
    } else {
      // "alwaysInherit" or "inheritUnlessAlreadyOverRidden": add part back to descendants
      const result = await cascadeAddPart({
        nodeId,
        partId,
        partOwner,
        partTitle,
        optional,
        appName,
      });
      return res.status(200).json({ ok: true, mode, ...result });
    }
  } catch (error: any) {
    if (error instanceof HttpError)
      return fail(res, error.status, error.message);
    console.error("nodes/parts/set-inheritance-mode error", error);
    recordLogs(
      {
        type: "error",
        error: JSON.stringify({
          name: error?.name,
          message: error?.message,
          stack: error?.stack,
        }),
        at: "nodes/parts/set-inheritance-mode",
      },
      uname,
    );
    const message = error?.message || "Internal error";
    return res.status(500).json({ error: message, message });
  }
}

export default fbAuth(handler);
