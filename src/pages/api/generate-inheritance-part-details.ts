import { NextApiRequest, NextApiResponse } from "next";
import { db } from "@components/lib/firestoreServer/admin";
import { NODES } from "@components/lib/firestoreClient/collections";
import fbAuth from "@components/middlewares/fbAuth";
import { INode, ICollection } from "@components/types/INode";
import {
  computeInheritedPartsDetails,
  makeResolvedOf,
} from "@components/lib/server/partsAnnotation";

async function fetchNodes(nodeIds: string[]): Promise<{ [id: string]: INode }> {
  if (nodeIds.length === 0) return {};

  const nodesMap: { [id: string]: INode } = {};
  const uniqueIds = [...new Set(nodeIds)];

  // One BatchGet RPC per chunk instead of one RPC per document.
  const CHUNK = 300;
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += CHUNK) {
    chunks.push(uniqueIds.slice(i, i + CHUNK));
  }
  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const snaps = await db.getAll(
          ...chunk.map((id) => db.collection(NODES).doc(id)),
        );
        for (const snap of snaps) {
          if (!snap.exists) continue;
          const data = snap.data();
          if (data && !data.deleted) {
            nodesMap[snap.id] = { id: snap.id, ...data } as INode;
          }
        }
      } catch (error) {
        console.error(`Error fetching nodes batch:`, error);
      }
    }),
  );
  return nodesMap;
}

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

    const generalizations =
      currentNode.generalizations?.flatMap((c) => c.nodes) || [];

    const relatedNodes = await fetchNodes(generalizations.map((g) => g.id));
    relatedNodes[nodeId] = currentNode;

    // Close the ref chains: parts resolve through partsInheritance.source.
    const missingSources = () => [
      ...new Set(
        Object.values(relatedNodes)
          .map((n) => n.partsInheritance?.source)
          .filter((s): s is string => !!s && !relatedNodes[s]),
      ),
    ];
    let frontier = missingSources();
    while (frontier.length > 0) {
      const fetched = await fetchNodes(frontier);
      Object.assign(relatedNodes, fetched);
      if (Object.keys(fetched).length === 0) break;
      frontier = missingSources();
    }

    const chainResolvedOf = makeResolvedOf(relatedNodes);
    const partIds = chainResolvedOf(nodeId).map((p) => p.id);

    const generalizationPartIds = new Set<string>();
    for (const gen of generalizations) {
      if (!relatedNodes[gen.id]) continue;
      chainResolvedOf(gen.id).forEach((p) => generalizationPartIds.add(p.id));
    }

    const partNodes = await fetchNodes([
      ...new Set([...partIds, ...generalizationPartIds]),
    ]);
    Object.assign(relatedNodes, partNodes);

    const specializationIds = new Set<string>();
    for (const partId of generalizationPartIds) {
      const partNode = relatedNodes[partId];
      if (partNode?.specializations) {
        partNode.specializations.forEach((collection: ICollection) => {
          collection.nodes?.forEach((n: any) => {
            specializationIds.add(n.id);
          });
        });
      }
    }

    const specNodes = await fetchNodes([...specializationIds]);
    Object.assign(relatedNodes, specNodes);

    // Rebuild over the full fetched set (part nodes resolve too, for hops).
    const resolvedOf = makeResolvedOf(relatedNodes);

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
