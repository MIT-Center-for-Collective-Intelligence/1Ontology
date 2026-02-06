import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@components/lib/firestoreServer/admin";
import { NODES } from "@components/lib/firestoreClient/collections";
import { INode, TreeViewNode,  } from "@components/types/INode";
import { TREE_QUEUES } from "@components/lib/firestoreClient/collections";

interface QueueItem {
  id: string;
  changedNodeId: string;
  appName: string;
  timestamp: number;
  processed: boolean;
}

interface ProcessingState {
  isProcessing: boolean;
  processingStartedAt: number | null;
  processedItemsCount: number;
  lastProcessedAt: number | null;
}

const PROCESSING_STATE_DOC = "processingState";

// Helper functions for building tree and finding affected nodes

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

function countDescendants(
  nodeId: string,
  allNodes: { [id: string]: INode }
): number {
  const visited = new Set<string>();

  function count(currentNodeId: string): number {
    if (visited.has(currentNodeId)) return 0;
    visited.add(currentNodeId);

    const node = allNodes[currentNodeId];
    if (!node?.specializations) return 0;

    let total = 0;
    for (const collection of node.specializations) {
      for (const child of collection.nodes || []) {
        total += 1 + count(child.id);
      }
    }
    return total;
  }

  return count(nodeId);
}

function findAncestors(
  nodeId: string,
  allNodes: { [id: string]: INode }
): string[] {
  const ancestors = new Set<string>();
  const visited = new Set<string>();

  function traverseUp(currentNodeId: string) {
    if (visited.has(currentNodeId)) return;
    visited.add(currentNodeId);

    for (const [parentId, parentNode] of Object.entries(allNodes)) {
      if (!parentNode.specializations) continue;

      for (const collection of parentNode.specializations) {
        const hasChild = collection.nodes?.some(n => n.id === currentNodeId);
        if (hasChild) {
          ancestors.add(parentId);
          traverseUp(parentId);
        }
      }
    }
  }

  traverseUp(nodeId);
  return Array.from(ancestors);
}

function findDescendants(
  nodeId: string,
  allNodes: { [id: string]: INode }
): string[] {
  const descendants = new Set<string>();
  const visited = new Set<string>();

  function traverseDown(currentNodeId: string) {
    if (visited.has(currentNodeId)) return;
    visited.add(currentNodeId);

    const node = allNodes[currentNodeId];
    if (!node?.specializations) return;

    for (const collection of node.specializations) {
      for (const child of collection.nodes || []) {
        descendants.add(child.id);
        traverseDown(child.id);
      }
    }
  }

  traverseDown(nodeId);
  return Array.from(descendants);
}

function findSiblings(
  nodeId: string,
  allNodes: { [id: string]: INode }
): string[] {
  const siblings = new Set<string>();

  const parents: string[] = [];
  for (const [parentId, parentNode] of Object.entries(allNodes)) {
    if (!parentNode.specializations) continue;

    for (const collection of parentNode.specializations) {
      const hasChild = collection.nodes?.some(n => n.id === nodeId);
      if (hasChild) {
        parents.push(parentId);
      }
    }
  }

  for (const parentId of parents) {
    const parentNode = allNodes[parentId];
    if (!parentNode.specializations) continue;

    for (const collection of parentNode.specializations) {
      for (const child of collection.nodes || []) {
        if (child.id !== nodeId) {
          siblings.add(child.id);
        }
      }
    }
  }

  return Array.from(siblings);
}

function calculateAffectedNodesMetadata(
  nodeId: string,
  allNodes: { [id: string]: INode }
): { affectedNodeIds: string[] | null; isHighImpact: boolean } {
  const node = allNodes[nodeId];

  const isRoot = node.category || (typeof node.root === "boolean" && !!node.root);
  const descendantCount = countDescendants(nodeId, allNodes);
  const isHighImpact = isRoot || descendantCount > 100;

  if (isHighImpact) {
    console.log(`[AFFECTED NODES] High-impact node (${descendantCount} descendants) - not caching affected nodes`);
    return { affectedNodeIds: null, isHighImpact: true };
  }

  const affected = new Set<string>();
  affected.add(nodeId);

  const ancestors = findAncestors(nodeId, allNodes);
  ancestors.forEach(id => affected.add(id));

  const descendants = findDescendants(nodeId, allNodes);
  descendants.forEach(id => affected.add(id));

  const siblings = findSiblings(nodeId, allNodes);
  siblings.forEach(id => affected.add(id));

  const affectedNodeIds = Array.from(affected);

  console.log(`[AFFECTED NODES] Found ${affectedNodeIds.length} affected nodes (ancestors: ${ancestors.length}, descendants: ${descendants.length}, siblings: ${siblings.length})`);

  return { affectedNodeIds, isHighImpact: false };
}

function buildTreeWithSiblings(
  paths: string[][],
  allNodes: { [id: string]: INode }
): NodeTreeData {
  const flatNodes: { [id: string]: TreeViewNode } = {};
  const rootIds: string[] = [];

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
      // Add the current node without children
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
            // Collect direct child IDs and create grandchild nodes (one level deeper)
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

                // Create the grandchild node itself (with empty childIds - don't go deeper)
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

// Queue processing logic
async function findAllAffectedNodes(
  changedNodeIds: string[],
  appName: string,
  allNodes: { [id: string]: INode }
): Promise<Set<string>> {
  const allAffected = new Set<string>();

  for (const changedNodeId of changedNodeIds) {
    const changedNode = allNodes[changedNodeId];
    if (!changedNode) continue;

    // Forward lookup: Read the changed node's affectedNodeIds
    const forwardAffected = changedNode.nodeTreeData?.affectedNodeIds;

    if (forwardAffected === null || changedNode.nodeTreeData?.isHighImpact) {
      // High-impact node - all nodes are affected
      console.log(`[QUEUE] High-impact node ${changedNodeId} - affecting all nodes`);
      Object.keys(allNodes).forEach(id => allAffected.add(id));
      continue;
    }

    if (Array.isArray(forwardAffected)) {
      forwardAffected.forEach(id => allAffected.add(id));
    } else {
      allAffected.add(changedNodeId);
    }

    // Reverse lookup: Query for nodes that have changedNodeId in their affectedNodeIds
    const reverseQuery = await db.collection(NODES)
      .where('nodeTreeData.affectedNodeIds', 'array-contains', changedNodeId)
      .where('appName', '==', appName)
      .get();

    reverseQuery.forEach(doc => allAffected.add(doc.id));

    // Delay between reverse lookups to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return allAffected;
}

async function buildNodeTreeData(
  nodeId: string,
  allNodes: { [id: string]: INode }
): Promise<NodeTreeData> {
  const targetNode = allNodes[nodeId];
  if (!targetNode) {
    throw new Error(`Node ${nodeId} not found`);
  }

  const paths = findPathsToNode(nodeId, allNodes);
  if (paths.length === 0) {
    throw new Error(`No path found to node ${nodeId}`);
  }

  const treeData = buildTreeWithSiblings(paths, allNodes);
  const { affectedNodeIds, isHighImpact } = calculateAffectedNodesMetadata(nodeId, allNodes);

  return {
    ...treeData,
    affectedNodeIds,
    isHighImpact
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const stateRef = db.collection(TREE_QUEUES).doc(PROCESSING_STATE_DOC);
  const now = Date.now();

  try {
    console.log("[QUEUE] Tree queue processor started");

    // Check if already processing
    const stateDoc = await stateRef.get();
    const state = stateDoc.exists ? stateDoc.data() as ProcessingState : null;

    if (state?.isProcessing) {
      const processingDuration = state.processingStartedAt
        ? Math.round((now - state.processingStartedAt) / 1000)
        : 0;

      console.log(`[QUEUE] Processing already ongoing (${processingDuration}s elapsed)`);

      // Return 200 so scheduler doesn't retry
      return res.status(200).json({
        success: true,
        message: "Processing is already ongoing",
        skipped: true,
        isProcessing: true,
        processingDurationSeconds: processingDuration
      });
    }

    // Read pending queue items
    const queueSnapshot = await db.collection(TREE_QUEUES)
      .where('processed', '==', false)
      .orderBy('timestamp', 'asc')
      .limit(50)
      .get();

    if (queueSnapshot.empty) {
      console.log("[QUEUE] No pending items in queue");
      return res.status(200).json({
        success: true,
        message: "No pending items to process",
        itemsProcessed: 0
      });
    }

    console.log(`[QUEUE] Found ${queueSnapshot.size} pending items`);

    // Set processing lock
    await stateRef.set({
      isProcessing: true,
      processingStartedAt: now,
      processedItemsCount: 0,
      lastProcessedAt: state?.lastProcessedAt || null
    });

    console.log("[QUEUE] Processing lock acquired");

    const queueItems: QueueItem[] = [];
    queueSnapshot.forEach(doc => {
      queueItems.push({ id: doc.id, ...doc.data() } as QueueItem);
    });

    // Group by appName and deduplicate changedNodeIds
    const appGroups: { [appName: string]: Set<string> } = {};
    for (const item of queueItems) {
      if (!appGroups[item.appName]) {
        appGroups[item.appName] = new Set();
      }
      appGroups[item.appName].add(item.changedNodeId);
    }

    let totalAffectedNodes = 0;
    let totalWrites = 0;

    // Process each app group separately
    for (const [appName, changedNodeIds] of Object.entries(appGroups)) {
      const changedNodeIdsArray = Array.from(changedNodeIds);
      console.log(`[QUEUE] Processing ${changedNodeIdsArray.length} unique changed nodes for app: ${appName}`);

      // Read all nodes for this app
      const BATCH_SIZE = 100;
      const allNodes: { [id: string]: INode } = {};
      let lastDoc: any = null;
      let batchCount = 0;

      while (true) {
        let query = db
          .collection(NODES)
          .where("deleted", "==", false)
          .where("appName", "==", appName)
          .limit(BATCH_SIZE);

        if (lastDoc) {
          query = query.startAfter(lastDoc);
        }

        const batchSnapshot = await query.get();
        if (batchSnapshot.empty) break;

        batchSnapshot.forEach((doc) => {
          allNodes[doc.id] = { id: doc.id, ...doc.data() } as INode;
        });

        batchCount++;
        console.log(`[QUEUE] Read batch ${batchCount}: ${batchSnapshot.size} nodes (total: ${Object.keys(allNodes).length})`);

        lastDoc = batchSnapshot.docs[batchSnapshot.docs.length - 1];

        // Delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));

        if (batchSnapshot.size < BATCH_SIZE) break;
      }

      console.log(`[QUEUE] Loaded ${Object.keys(allNodes).length} nodes for app: ${appName}`);

      // Find all affected nodes (forward + reverse lookup)
      const affectedNodeIds = await findAllAffectedNodes(changedNodeIdsArray, appName, allNodes);
      console.log(`[QUEUE] Found ${affectedNodeIds.size} affected nodes for app: ${appName}`);
      totalAffectedNodes += affectedNodeIds.size;

      // Rebuild trees for affected nodes
      const updates: { [nodeId: string]: NodeTreeData } = {};
      for (const affectedNodeId of affectedNodeIds) {
        try {
          const newTreeData = await buildNodeTreeData(affectedNodeId, allNodes);
          updates[affectedNodeId] = newTreeData;
        } catch (error: any) {
          console.error(`[QUEUE] Error building tree for node ${affectedNodeId}:`, error.message);
          // Continue
        }
      }

      // Write updates (tree data is too large for batching and may timeout)
      const updateEntries = Object.entries(updates);
      let writeCount = 0;

      for (const [nodeId, treeData] of updateEntries) {
        try {
          const nodeRef = db.collection(NODES).doc(nodeId);
          await nodeRef.update({ nodeTreeData: treeData });

          writeCount++;
          totalWrites++;

          if (writeCount % 10 === 0) {
            console.log(`[QUEUE] Wrote ${writeCount}/${updateEntries.length} nodes...`);
          }

          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error: any) {
          console.error(`[QUEUE] Error writing node ${nodeId}:`, error.message);
          // Continue
        }
      }

      console.log(`[QUEUE] Completed writing ${writeCount} nodes for app: ${appName}`);
    }

    // Mark queue items as processed
    const MARK_BATCH_SIZE = 50;
    for (let i = 0; i < queueItems.length; i += MARK_BATCH_SIZE) {
      const batch = db.batch();
      const chunk = queueItems.slice(i, i + MARK_BATCH_SIZE);

      for (const item of chunk) {
        const queueItemRef = db.collection(TREE_QUEUES).doc(item.id);
        batch.update(queueItemRef, {
          processed: true,
          processedAt: Date.now()
        });
      }

      await batch.commit();
      console.log(`[QUEUE] Marked batch ${Math.floor(i / MARK_BATCH_SIZE) + 1} as processed (${chunk.length} items)`);

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log("[QUEUE] Processing complete!");

    // Release processing lock and update final count
    await stateRef.set({
      isProcessing: false,
      processingStartedAt: null,
      processedItemsCount: queueItems.length,
      lastProcessedAt: Date.now()
    });

    console.log("[QUEUE] Released processing lock");

    return res.status(200).json({
      success: true,
      message: "Queue processed successfully",
      itemsProcessed: queueItems.length,
      uniqueChangedNodes: Object.values(appGroups).reduce((sum, set) => sum + set.size, 0),
      affectedNodes: totalAffectedNodes,
      nodesWritten: totalWrites
    });

  } catch (error: any) {
    console.error("[QUEUE] Error processing queue:", error);

    // Release processing lock on error
    try {
      await stateRef.set({
        isProcessing: false,
        processingStartedAt: null,
        processedItemsCount: 0,
        lastProcessedAt: Date.now()
      });
      console.log("[QUEUE] Released processing lock after error");
    } catch (cleanupError: any) {
      console.error("[QUEUE] Failed to release processing lock:", cleanupError.message);
    }

    return res.status(500).json({
      error: "Internal server error",
      details: error.message
    });
  }
}
