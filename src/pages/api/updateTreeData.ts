import { NextApiRequest, NextApiResponse } from "next";

import { LOGS } from "@components/lib/firestoreClient/collections";
import { INode } from "@components/types/INode";
import fbAuth from "@components/middlewares/fbAuth";
import { extractJSON, getDoerCreate } from "@components/lib/utils/helpers";
import { db, storage } from "@components/lib/firestoreServer/admin";
import { development } from "@components/lib/CONSTANTS";

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  const { nodeId, user, appName } = req.body.data;

  const nodesSnapshot = await db
    .collection("nodes")
    .where("appName", "==", appName)
    .where("deleted", "==", false)
    .get();

  const generatedTree = generateTree(nodesSnapshot);

  await uploadToStorage(generatedTree, appName);

  try {
    return res.status(200).send({});
  } catch (error: any) {
    console.error("error", error);
    return res.status(500).json({ error: error.message });
  }
}

function generateTree(nodes: any) {
  const spreadNodes: any = Object.values(nodes);

  // Find root nodes (categories or nodes marked as root)
  const mainCategories = spreadNodes.filter(
    (node: INode) =>
      node.category || (typeof node.root === "boolean" && !!node.root),
  );

  // Sort roots in predefined order
  mainCategories.sort((nodeA: any, nodeB: any) => {
    const order = [
      "WHAT: Activities and Objects",
      "WHO: Actors",
      "WHY: Evaluation",
      "Where: Context",
      "ONet",
    ];
    return order.indexOf(nodeA.title) - order.indexOf(nodeB.title);
  });

  // Build flat node map with tree metadata
  const hierarchyNodes: { [id: string]: any } = {};
  const rootIds: string[] = [];

  // Helper to compute all paths to a node
  const computePaths = (
    nodeId: string,
    currentPath: string[],
    visited: Set<string> = new Set(),
  ): string[][] => {
    if (visited.has(nodeId)) return [];
    visited.add(nodeId);

    const node = nodes[nodeId];
    if (!node) return [];

    const newPath = [...currentPath, nodeId];
    const paths: string[][] = [newPath];

    return paths;
  };

  // Build hierarchy recursively
  const buildHierarchy = (
    nodeList: INode[],
    parentPath: string[],
    visited: Set<string> = new Set(),
  ) => {
    for (let node of nodeList) {
      if (!node || visited.has(node.id)) continue;
      visited.add(node.id);

      const childrenIds: string[] = [];
      const collections: { name: string; childIds: string[] }[] = [];

      // Process specializations (children)
      for (let collection of node.specializations) {
        const collectionChildIds = collection.nodes
          .map((n: { id: string }) => n.id)
          .filter((id: string) => !!nodes[id]);

        childrenIds.push(...collectionChildIds);

        collections.push({
          name: collection.collectionName,
          childIds: collectionChildIds,
        });
      }

      // Get parent IDs from generalizations
      const parentIds =
        node.generalizations[0]?.nodes
          .map((n: { id: string }) => n.id)
          .filter((id: string) => !!nodes[id]) || [];

      // Compute paths (for now, single path from current traversal)
      const nodePath = [...parentPath, node.id];

      // Store node in flat structure
      hierarchyNodes[node.id] = {
        id: node.id,
        nodeId: node.id, // Firestore ID
        title: node.title.trim(),
        nodeType: node.nodeType || null,
        category: !!node.category,
        locked: !!node.locked,
        unclassified: !!node.unclassified,
        childrenIds,
        collections,
        parentIds,
        paths: [nodePath], // Will be enriched with multiple paths later
        metadata: {
          specializationCount: childrenIds.length,
          depth: nodePath.length - 1,
        },
      };

      // Recursively process children
      for (let collection of node.specializations) {
        const childNodes = collection.nodes
          .map((n: { id: string }) => nodes[n.id])
          .filter(Boolean);

        buildHierarchy(childNodes, nodePath, visited);
      }
    }
  };

  // Build from roots
  for (let root of mainCategories) {
    rootIds.push(root.id);
    buildHierarchy([root], [], new Set());
  }

  // Create final structure
  const treeHierarchy = {
    version: Date.now(),
    generatedAt: new Date().toISOString(),
    roots: rootIds,
    nodes: hierarchyNodes,
    stats: {
      totalNodes: Object.keys(hierarchyNodes).length,
      rootNodes: rootIds.length,
      maxDepth: Math.max(
        ...Object.values(hierarchyNodes).map((n: any) => n.metadata.depth),
        0,
      ),
    },
  };

  // Return the hierarchy (for upload or download)
  return treeHierarchy;
}

async function uploadToStorage(newData: any, appName: string) {
  const bucket = storage.bucket(
    `gs://${development ? process.env.NEXT_PUBLIC_STORAGE_BUCKET : process.env.NEXT_PUBLIC_DEV_STORAGE_BUCKET}`,
  );
  const fileName = `ontology-hierarchies/${appName === "default" ? "original" : appName}/tree-hierarchy.json`;

  await bucket.file(fileName).save(JSON.stringify(newData));
}

export default fbAuth(handler);
