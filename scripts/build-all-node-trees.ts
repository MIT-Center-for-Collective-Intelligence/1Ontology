import { db } from "../src/lib/firestoreServer/admin";
import { NODES } from "../src/lib/firestoreClient/collections";
import { INode, TreeViewNode, NodeTreeData } from "../src/types/INode";

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

function buildPathsMap(allNodes: { [id: string]: INode }): Map<string, string[][]> {
  console.log("[PATHS] Building paths map...");
  const pathsMap = new Map<string, string[][]>();
  const visited = new Set<string>();

  const findPaths = (currentNodeId: string, currentPath: string[]) => {
    const node = allNodes[currentNodeId];
    if (!node) return;

    // Record this path to current node
    if (!pathsMap.has(currentNodeId)) {
      pathsMap.set(currentNodeId, []);
    }
    pathsMap.get(currentNodeId)!.push([...currentPath]);

    // Avoid infinite loops
    const pathSignature = currentPath.join("-");
    if (visited.has(pathSignature)) return;
    visited.add(pathSignature);

    // Traverse children
    for (const collection of node.specializations || []) {
      for (const child of collection.nodes || []) {
        findPaths(child.id, [...currentPath, child.id]);
      }
    }
  };

  // Start from all roots
  const rootNodes = Object.values(allNodes).filter(
    node => node.category || (typeof node.root === "boolean" && !!node.root)
  );

  console.log(`[PATHS] Found ${rootNodes.length} root nodes`);

  for (const rootNode of rootNodes) {
    findPaths(rootNode.id, [rootNode.id]);
  }

  console.log(`[PATHS] ✅ Built paths for ${pathsMap.size} nodes`);
  return pathsMap;
}

// Build tree for a single node
function buildTreeForNode(
  nodeId: string,
  paths: string[][],
  allNodes: { [id: string]: INode }
): NodeTreeData {
  const flatNodes: { [id: string]: TreeViewNode } = {};
  const rootIds: string[] = [];

  // Helper to add a node and optionally its children
  const addNodeWithChildren = (
    nodeId: string,
    parentPath: string[],
    visited: Set<string>,
    recurseIntoChildren: boolean = false
  ) => {
    const node = allNodes[nodeId];
    if (!node) return;

    const currentPath = [...parentPath, nodeId];
    const pathBasedId = currentPath.join("-");

    if (currentPath.slice(0, -1).includes(nodeId)) return;
    if (visited.has(pathBasedId)) return;
    visited.add(pathBasedId);

    const childIds: string[] = [];

    // Skip adding children if this node is unclassified
    if (node.unclassified) {
      if (!flatNodes[pathBasedId]) {
        flatNodes[pathBasedId] = {
          id: pathBasedId,
          nodeId: nodeId,
          name: node.title,
          category: !!node.category,
          nodeType: node.nodeType,
          unclassified: true,
          childIds: []
        };
      }
      return;
    }

    for (const collection of node.specializations || []) {
      for (const childLink of collection.nodes || []) {
        const childNode = allNodes[childLink.id];
        if (!childNode) continue;

        const childPath = [...currentPath, childLink.id];
        const childPathBasedId = childPath.join("-");

        if (collection.collectionName !== "main") {
          const collectionId = [...currentPath, collection.collectionName].join("-");

          if (!flatNodes[collectionId]) {
            flatNodes[collectionId] = {
              id: collectionId,
              nodeId: node.id,
              name: `[${collection.collectionName}]`,
              category: true,
              nodeType: node.nodeType,
              unclassified: !!node.unclassified,
              childIds: []
            };
          }

          if (!flatNodes[collectionId].childIds.includes(childPathBasedId)) {
            flatNodes[collectionId].childIds.push(childPathBasedId);
          }

          if (!childIds.includes(collectionId)) {
            childIds.push(collectionId);
          }
        } else {
          if (!childIds.includes(childPathBasedId)) {
            childIds.push(childPathBasedId);
          }
        }

        if (!flatNodes[childPathBasedId]) {
          if (recurseIntoChildren) {
            addNodeWithChildren(childLink.id, childPath.slice(0, -1), visited, false);
          }

          if (!flatNodes[childPathBasedId]) {
            // Collect direct child IDs and create grandchild nodes
            const directChildIds: string[] = [];
            for (const childCollection of childNode.specializations || []) {
              for (const grandchildLink of childCollection.nodes || []) {
                const grandchildNode = allNodes[grandchildLink.id];
                if (!grandchildNode) continue;

                const grandchildPath = [...childPath, grandchildLink.id];
                const grandchildPathBasedId = grandchildPath.join("-");

                if (childCollection.collectionName !== "main") {
                  const childCollectionId = [...childPath, childCollection.collectionName].join("-");

                  // Create collection wrapper for grandchildren
                  if (!flatNodes[childCollectionId]) {
                    flatNodes[childCollectionId] = {
                      id: childCollectionId,
                      nodeId: childNode.id,
                      name: `[${childCollection.collectionName}]`,
                      category: true,
                      nodeType: childNode.nodeType,
                      unclassified: !!childNode.unclassified,
                      childIds: []
                    };
                  }

                  // Add grandchild to collection wrapper
                  if (!flatNodes[childCollectionId].childIds.includes(grandchildPathBasedId)) {
                    flatNodes[childCollectionId].childIds.push(grandchildPathBasedId);
                  }

                  if (!directChildIds.includes(childCollectionId)) {
                    directChildIds.push(childCollectionId);
                  }
                } else {
                  if (!directChildIds.includes(grandchildPathBasedId)) {
                    directChildIds.push(grandchildPathBasedId);
                  }
                }

                // Create the grandchild node itself
                if (!flatNodes[grandchildPathBasedId]) {
                  flatNodes[grandchildPathBasedId] = {
                    id: grandchildPathBasedId,
                    nodeId: grandchildLink.id,
                    name: grandchildNode.title,
                    category: !!grandchildNode.category,
                    nodeType: grandchildNode.nodeType,
                    unclassified: !!grandchildNode.unclassified,
                    childIds: [] // Don't populate children of grandchildren
                  };
                }
              }
            }

            flatNodes[childPathBasedId] = {
              id: childPathBasedId,
              nodeId: childLink.id,
              name: childNode.title,
              category: !!childNode.category,
              nodeType: childNode.nodeType,
              unclassified: !!childNode.unclassified,
              childIds: directChildIds
            };
          }
        }
      }
    }

    if (!flatNodes[pathBasedId]) {
      flatNodes[pathBasedId] = {
        id: pathBasedId,
        nodeId: nodeId,
        name: node.title,
        category: !!node.category,
        nodeType: node.nodeType,
        unclassified: !!node.unclassified,
        childIds
      };
    } else {
      const existingChildIds = new Set(flatNodes[pathBasedId].childIds);
      childIds.forEach(id => existingChildIds.add(id));
      flatNodes[pathBasedId].childIds = Array.from(existingChildIds);
    }
  };

  // Process each path
  for (const path of paths) {
    const pathVisited = new Set<string>();

    for (let i = 0; i < path.length; i++) {
      const nodeId = path[i];
      const node = allNodes[nodeId];
      if (!node) continue;

      const parentPath = path.slice(0, i);
      const currentFullPath = [...parentPath, nodeId];
      const pathBasedId = currentFullPath.join("-");

      if (i === 0 && !rootIds.includes(pathBasedId)) {
        rootIds.push(pathBasedId);
      }

      const nextNodeOnPath = i + 1 < path.length ? path[i + 1] : null;

      if (i > 0) {
        const parentNodeId = path[i - 1];
        const parentNode = allNodes[parentNodeId];
        if (parentNode) {
          for (const collection of parentNode.specializations || []) {
            for (const siblingLink of collection.nodes || []) {
              const isNextOnPath = siblingLink.id === nextNodeOnPath;
              addNodeWithChildren(siblingLink.id, parentPath, pathVisited, isNextOnPath);
            }
          }
        }
      } else {
        const shouldRecurse = nextNodeOnPath !== null;
        addNodeWithChildren(nodeId, [], pathVisited, shouldRecurse);

        const rootNodes = Object.values(allNodes).filter(
          n => n.category || (typeof n.root === "boolean" && !!n.root)
        );
        for (const rootNode of rootNodes) {
          if (rootNode.id !== nodeId) {
            addNodeWithChildren(rootNode.id, [], pathVisited, false);
          }
        }
      }
    }
  }

  return {
    version: "nodeTree",
    lastUpdated: Date.now(),
    rootIds,
    nodes: flatNodes
  };
}

// Function to build all node trees in one ontology version
async function buildAllNodeTrees(ontologyVersion: string) {
  console.log(`Building node trees for ontology: ${ontologyVersion}`);

  const allNodes = await loadAllNodes(ontologyVersion);
  const totalNodes = Object.keys(allNodes).length;

  if (totalNodes === 0) {
    console.log("No nodes found");
    return;
  }

  const pathsMap = buildPathsMap(allNodes);

  console.log(`\n[PROCESS] Building tree data for ${pathsMap.size} nodes...\n`);

  const updates: any[] = [];
  let processed = 0;
  let skipped = 0;

  for (const [nodeId, paths] of pathsMap.entries()) {
    const node = allNodes[nodeId];

    // Skip root/category nodes
    if (node.category || node.root) {
      skipped++;
      continue;
    }

    if (paths.length === 0) {
      console.log(`[SKIP] ${node.title} - no paths found`);
      skipped++;
      continue;
    }

    // Build tree for this node
    const treeData = buildTreeForNode(nodeId, paths, allNodes);

    updates.push({
      nodeId,
      title: node.title,
      treeData
    });

    processed++;

    if (processed % 100 === 0) {
      console.log(`[PROCESS] Processed ${processed}/${pathsMap.size - skipped} nodes...`);
    }
  }

  // Batch write to Firestore
  console.log(`\n[WRITE] Writing ${updates.length} updates to Firestore...\n`);

  const BATCH_SIZE = 500;
  let written = 0;

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = updates.slice(i, i + BATCH_SIZE);

    for (const update of chunk) {
      const nodeRef = db.collection(NODES).doc(update.nodeId);
      batch.update(nodeRef, { nodeTreeData: update.treeData });
    }

    await batch.commit();
    written += chunk.length;

    console.log(`[WRITE] Written ${written}/${updates.length} nodes...`);

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`Total nodes in ontology: ${totalNodes}`);
  console.log(`Nodes processed: ${processed}`);
  console.log(`Nodes skipped: ${skipped} (root/category nodes)`);
  console.log(`Nodes updated: ${written}`);
}

const ONTOLOGY_VERSIONS = [
  'ontology-development-version',
];

// Main function to process all ontology versions
async function main() {
  console.log(`Building trees for ALL ontology versions`);

  let completedOntologies = 0;
  let failedOntologies = 0;

  for (const ontologyVersion of ONTOLOGY_VERSIONS) {
    try {
      await buildAllNodeTrees(ontologyVersion);
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

  console.log(`Completed: ${completedOntologies}/${ONTOLOGY_VERSIONS.length}`);
  console.log(`Failed: ${failedOntologies}/${ONTOLOGY_VERSIONS.length}`);
}

// Run the script
console.log(`\nStarting bulk tree generation for ALL ontologies...\n`);

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
