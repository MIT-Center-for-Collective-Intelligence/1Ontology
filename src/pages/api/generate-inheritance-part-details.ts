import { NextApiRequest, NextApiResponse } from "next";
import { db } from "@components/lib/firestoreServer/admin";
import { NODES } from "@components/lib/firestoreClient/collections";
import fbAuth from "@components/middlewares/fbAuth";
import { INode } from "@components/types/INode";
import {
  computeInheritedPartsDetails,
  fetchPartsContext,
} from "@components/lib/server/partsAnnotation";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { nodeId, appName } = req.body;

    if (!nodeId || typeof nodeId !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "nodeId is required" });
    }

    if (!appName || typeof appName !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "appName is required" });
    }

    const currentNodeDoc = await db.collection(NODES).doc(nodeId).get();
    if (!currentNodeDoc.exists) {
      return res.status(404).json({ success: false, error: "Node not found" });
    }

    const currentNode = {
      id: currentNodeDoc.id,
      ...currentNodeDoc.data(),
    } as INode;

    const { relatedNodes, resolvedOf } = await fetchPartsContext(currentNode);

    const calculations = computeInheritedPartsDetails({
      currentNode,
      relatedNodes,
      resolvedOf,
    });

    // The annotation and the materialized copy of the resolved view are
    // written together — the copy is what viewers compare against to decide
    // the annotation is still fresh.
    await db
      .collection(NODES)
      .doc(nodeId)
      .update({
        inheritedPartsDetails: calculations,
        resolvedParts: resolvedOf(nodeId),
      });

    return res.status(200).json({
      success: true,
      data: calculations,
    });
  } catch (error: any) {
    console.error("Error generating inheritance part details:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
}

export default fbAuth(handler);
