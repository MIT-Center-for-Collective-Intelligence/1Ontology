import { db } from "../src/lib/firestoreServer/admin";
import { NODES } from "../src/lib/firestoreClient/collections";
import { INode, ICollection } from "../src/types/INode";

interface TreeNodeDocument {
  title: string;
  nodeType: string;
  unclassified?: boolean;
  specializations: ICollection[];
}

// Load all nodes for an ontology version
async function loadAllNodes(ontologyVersion: string): Promise<{ [id: string]: INode }> {
  console.log(`[LOAD] Loading all nodes for ontology version: ${ontologyVersion}...`);
  const BATCH_SIZE = 500;
  const allNodes: { [id: string]: INode } = {};
  let lastDoc: any = null;
  let totalLoaded = 0;

  while (true) {
    let query = db
      .collection(NODES)
      .where("deleted", "==", false)
      .where("appName", "==", ontologyVersion)
      .limit(BATCH_SIZE);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const batchSnapshot = await query.get();
    if (batchSnapshot.empty) break;

    batchSnapshot.forEach((doc) => {
      allNodes[doc.id] = { id: doc.id, ...doc.data() } as INode;
      totalLoaded++;
    });

    console.log(`[LOAD] Loaded ${totalLoaded} nodes...`);

    lastDoc = batchSnapshot.docs[batchSnapshot.docs.length - 1];
    await new Promise(resolve => setTimeout(resolve, 100));

    if (batchSnapshot.size < BATCH_SIZE) break;
  }

  console.log(`[LOAD] ✅ Loaded ${totalLoaded} nodes total`);
  return allNodes;
}

// Find all paths from root to target node
function findPathsToNode(
  targetNodeId: string,
  allNodes: { [id: string]: INode }
): string[][] {
  const paths: string[][] = [];
  const visited = new Set<string>();

  const findPaths = (currentNodeId: string, currentPath: string[]) => {
    const node = allNodes[currentNodeId];
    if (!node) return;

    if (currentNodeId === targetNodeId) {
      paths.push([...currentPath]);
      return;
    }

    const pathSignature = currentPath.join("-");
    if (visited.has(pathSignature)) return;
    visited.add(pathSignature);

    for (const collection of node.specializations || []) {
      for (const child of collection.nodes || []) {
        findPaths(child.id, [...currentPath, child.id]);
      }
    }
  };

  const rootNodes = Object.values(allNodes).filter(
    node => node.category || (typeof node.root === "boolean" && !!node.root)
  );

  for (const rootNode of rootNodes) {
    findPaths(rootNode.id, [rootNode.id]);
  }

  return paths;
}

// Collect all unique nodes that should be in the tree
function collectTreeNodeIds(
  paths: string[][],
  allNodes: { [id: string]: INode }
): Set<string> {
  const nodeIds = new Set<string>();

  // Add all nodes from all paths (ancestors + target)
  for (const path of paths) {
    for (const nodeId of path) {
      nodeIds.add(nodeId);
    }
  }

  // Add siblings at each level of the paths
  for (const path of paths) {
    for (let i = 0; i < path.length - 1; i++) {
      const parentId = path[i];
      const parentNode = allNodes[parentId];
      if (!parentNode?.specializations) continue;

      for (const collection of parentNode.specializations) {
        for (const child of collection.nodes || []) {
          nodeIds.add(child.id);

          // Add children of siblings
          const siblingNode = allNodes[child.id];
          if (siblingNode?.specializations) {
            for (const siblingCollection of siblingNode.specializations) {
              for (const siblingChild of siblingCollection.nodes || []) {
                nodeIds.add(siblingChild.id);
              }
            }
          }
        }
      }
    }
  }

  // Add children of target node
  const targetNodeId = paths[0]?.[paths[0].length - 1];
  if (targetNodeId) {
    const targetNode = allNodes[targetNodeId];
    if (targetNode?.specializations) {
      for (const collection of targetNode.specializations) {
        for (const child of collection.nodes || []) {
          nodeIds.add(child.id);

          // Add grandchildren of target node
          const childNode = allNodes[child.id];
          if (childNode?.specializations) {
            for (const childCollection of childNode.specializations) {
              for (const grandchild of childCollection.nodes || []) {
                nodeIds.add(grandchild.id);
              }
            }
          }
        }
      }
    }
  }

  return nodeIds;
}

// Build tree nodes with specializations
function buildTreeNodes(
  paths: string[][],
  allNodes: { [id: string]: INode }
): { nodes: { [nodeId: string]: TreeNodeDocument }, rootIds: string[] } {
  const treeNodes: { [nodeId: string]: TreeNodeDocument } = {};
  const nodeIdsInTree = collectTreeNodeIds(paths, allNodes);

  // Build tree nodes - only include specializations that point to nodes in the tree
  for (const nodeId of nodeIdsInTree) {
    const node = allNodes[nodeId];
    if (!node) continue;

    // Filter specializations to only include children that are in the tree
    const filteredSpecializations: ICollection[] = [];

    for (const collection of node.specializations || []) {
      const filteredNodes = collection.nodes.filter(child =>
        nodeIdsInTree.has(child.id)
      );

      if (filteredNodes.length > 0) {
        filteredSpecializations.push({
          collectionName: collection.collectionName,
          nodes: filteredNodes
        });
      }
    }

    treeNodes[nodeId] = {
      title: node.title,
      nodeType: node.nodeType,
      ...(node.unclassified && { unclassified: true }),
      specializations: filteredSpecializations
    };
  }

  // Find root nodes (from paths)
  const rootIds: string[] = [];
  for (const path of paths) {
    if (path.length > 0 && !rootIds.includes(path[0])) {
      rootIds.push(path[0]);
    }
  }

  return { nodes: treeNodes, rootIds };
}

// Save tree to subcollection for a single node
async function saveTreeToSubcollection(
  targetNodeId: string,
  allNodes: { [id: string]: INode }
): Promise<{ success: boolean; nodeCount: number; error?: string }> {
  try {
    const targetNode = allNodes[targetNodeId];
    if (!targetNode) {
      return { success: false, nodeCount: 0, error: `Node ${targetNodeId} not found` };
    }

    // Find paths
    const paths = findPathsToNode(targetNodeId, allNodes);

    if (paths.length === 0) {
      return { success: false, nodeCount: 0, error: `No path found to node` };
    }

    // Build tree nodes
    const { nodes } = buildTreeNodes(paths, allNodes);

    // Save each node to subcollection using nodeId as document ID
    const batch = db.batch();
    let batchCount = 0;
    const batches: any[] = [batch];

    for (const [treeNodeId, nodeData] of Object.entries(nodes)) {
      if (batchCount >= 500) {
        // Firestore batch limit is 500 operations
        const newBatch = db.batch();
        batches.push(newBatch);
        batchCount = 0;
      }

      // Save to: nodes/{targetNodeId}/treeNodes/{treeNodeId}
      const treeNodeRef = db
        .collection(NODES)
        .doc(targetNodeId)  // Target node
        .collection("treeNodes")
        .doc(treeNodeId);  // The actual node in the tree

      batches[batches.length - 1].set(treeNodeRef, nodeData);
      batchCount++;
    }

    // Commit all batches
    await Promise.all(batches.map(b => b.commit()));

    return {
      success: true,
      nodeCount: Object.keys(nodes).length
    };

  } catch (error: any) {
    return {
      success: false,
      nodeCount: 0,
      error: error?.message || "Unknown error"
    };
  }
}

// Build subcollection trees for all nodes in an ontology
async function buildAllSubcollectionTrees(ontologyVersion: string) {
  console.log(`\n[START] Building subcollection trees for ontology: ${ontologyVersion}\n`);

  const allNodes = await loadAllNodes(ontologyVersion);
  const totalNodes = Object.keys(allNodes).length;

  if (totalNodes === 0) {
    console.log("No nodes found");
    return;
  }

  console.log(`\n[PROCESS] Processing ${totalNodes} nodes...\n`);

  let processed = 0;
  let skipped = 0;
  let successful = 0;
  let failed = 0;

  for (const [nodeId, node] of Object.entries(allNodes)) {
    // Skip root/category nodes
    if (node.category || node.root) {
      skipped++;
      continue;
    }

    processed++;

    const result = await saveTreeToSubcollection(nodeId, allNodes);

    if (result.success) {
      successful++;
      if (processed % 50 === 0) {
        console.log(`[PROGRESS] ${processed}/${totalNodes - skipped} | Success: ${successful} | Failed: ${failed}`);
      }
    } else {
      failed++;
      console.log(`[FAILED] ${node.title} - ${result.error}`);
    }

    // Rate limiting to avoid overwhelming Firestore
    if (processed % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`\nComplete!`);
  console.log(`Total nodes in ontology: ${totalNodes}`);
  console.log(`Nodes skipped: ${skipped} (root/category nodes)`);
  console.log(`Nodes processed: ${processed}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);
}

const ONTOLOGY_VERSIONS = [
  'final-hierarchy-with-o*net',
];

// Main function to process all ontology versions
async function main() {
  console.log(`Building subcollection trees for ALL ontology versions`);

  let completedOntologies = 0;
  let failedOntologies = 0;

  for (const ontologyVersion of ONTOLOGY_VERSIONS) {
    try {
      await buildAllSubcollectionTrees(ontologyVersion);
      completedOntologies++;
    } catch (error: any) {
      console.error(`\nFailed to process "${ontologyVersion}": ${error.message}\n`);
      failedOntologies++;
    }

    // Add delay between ontologies to avoid overwhelming Firestore
    if (completedOntologies + failedOntologies < ONTOLOGY_VERSIONS.length) {
      console.log(`\nWaiting 5 seconds before next ontology...\n`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log(`\nCompleted: ${completedOntologies}/${ONTOLOGY_VERSIONS.length}`);
  console.log(`Failed: ${failedOntologies}/${ONTOLOGY_VERSIONS.length}`);
}

// Run the script
console.log(`\nStarting bulk subcollection tree generation for ALL ontologies...\n`);

main()
  .then(() => {
    console.log("\nScript completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nScript failed:", error);
    console.error("\nStack trace:", error.stack);
    process.exit(1);
  });
