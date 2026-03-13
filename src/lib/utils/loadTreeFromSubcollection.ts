import { collection, getDocs, getFirestore, query, where } from "firebase/firestore";
import { NODES, TREE_PENDING_CHANGES } from "@components/lib/firestoreClient/collections";
import { TreeData, ICollection } from "@components/types/INode";

interface TreeNodeDocument {
  title: string;
  nodeType: string;
  unclassified?: boolean;
  root?: boolean;
  specializations: ICollection[];
}

/**
 * Load tree nodes from subCollection and reconstruct hierarchical tree
 */
export async function loadTreeFromSubCollection(
  nodeId: string,
  appName?: string
): Promise<TreeData[]> {
  const db = getFirestore();

  // Fetch all tree nodes from subCollection
  const treeNodesRef = collection(db, NODES, nodeId, "treeNodes");
  const snapshot = await getDocs(treeNodesRef);

  if (snapshot.empty) {
    return [];
  }

  // Build a map of all nodes by their nodeId (document ID)
  const rootNodeIds: string[] = [];
  const nodesMap: { [nodeId: string]: TreeNodeDocument } = {};

  // Optimization: Single pass to extract data and identify roots
  snapshot.forEach((doc) => {
    const data = doc.data() as TreeNodeDocument; // Optimization: Call .data() once
    nodesMap[doc.id] = data;
    if (data.root === true) {
      rootNodeIds.push(doc.id);
    }
  });


  // Overlay pending changes on top of subcollection data
  if (appName) {
    try {
      const pendingChangesQuery = query(
        collection(db, TREE_PENDING_CHANGES),
        where('appName', '==', appName)
      );

      const pendingSnapshot = await getDocs(pendingChangesQuery);

      if (!pendingSnapshot.empty) {
        pendingSnapshot.forEach((doc) => {
          const pendingData = doc.data();
          const pendingNodeId = doc.id;

          // Replace subcollection data with pending change data, OR add new node if it doesn't exist
          if (nodesMap[pendingNodeId]) {
            nodesMap[pendingNodeId] = {
              title: pendingData.title,
              nodeType: pendingData.nodeType,
              specializations: pendingData.specializations || [],
              unclassified: nodesMap[pendingNodeId].unclassified,
              root: nodesMap[pendingNodeId].root
            };
          } else {
            // Node doesn't exist in subcollection yet, add it from pending changes
            nodesMap[pendingNodeId] = {
              title: pendingData.title,
              nodeType: pendingData.nodeType,
              specializations: pendingData.specializations || [],
              unclassified: pendingData.unclassified,
              root: pendingData.root
            };
          }
        });
      }
    } catch (error) {
      console.error('Error loading pending changes:', error);
    }
  }

  // Reconstruct hierarchical tree from specializations
  // Optimization: Pass mutable visited Set and path string to reduce allocations
  const buildTree = (
    currentNodeId: string,
    visited: Set<string>,
    parentPathId?: string,
  ): TreeData => {
    const node = nodesMap[currentNodeId];
    if (!node) {
      console.warn(`[LOAD-SUBCOL-TREE] Node ${currentNodeId} not found in map`);
      return {
        id: currentNodeId,
        nodeId: currentNodeId,
        name: "Unknown",
        nodeType: "activity",
        children: [],
      };
    }

    // Optimization: Construct ID string directly without array joining
    const pathBasedId = parentPathId
      ? `${parentPathId}-${currentNodeId}`
      : currentNodeId;

    // Prevent circular references
    if (visited.has(currentNodeId)) {
      return {
        id: pathBasedId,
        nodeId: currentNodeId,
        name: node.title,
        nodeType: node.nodeType,
        ...(node.unclassified && { unclassified: true }),
        children: [],
      };
    }
    visited.add(currentNodeId);

    const childrenInOrder: TreeData[] = [];

    // Process each collection in order
    if (node.specializations) {
      for (
        let collectionIndex = 0;
        collectionIndex < node.specializations.length;
        collectionIndex++
      ) {
        const collection = node.specializations[collectionIndex];

        if (collection.collectionName === "main") {
          // Main collection: add children directly with their path
          for (const child of collection.nodes || []) {
            childrenInOrder.push({
              ...buildTree(child.id, visited, pathBasedId),
              isMainItem: true,
              originalCollectionIndex: collectionIndex,
            } as any);
          }
        } else {
          // Non-main collection: create a category wrapper
          const collectionChildren: TreeData[] = [];
          // Optimization: Construct collection path string
          const collectionPathId = `${pathBasedId}-${collection.collectionName}`;

          for (const child of collection.nodes || []) {
            collectionChildren.push(
              buildTree(child.id, visited, collectionPathId),
            );
          }

          childrenInOrder.push({
            id: collectionPathId,
            nodeId: currentNodeId,
            name: `[${collection.collectionName}]`,
            nodeType: node.nodeType,
            category: true,
            children: collectionChildren,
            ...(node.unclassified && { unclassified: true }),
            originalCollectionIndex: collectionIndex,
          } as any);
        }
      }
    }

    // Backtrack
    visited.delete(currentNodeId);

    return {
      id: pathBasedId,
      nodeId: currentNodeId,
      name: node.title,
      nodeType: node.nodeType,
      ...(node.unclassified && { unclassified: true }),
      category: false,
      children: childrenInOrder.length > 0 ? childrenInOrder : undefined,
    };
  };

  // Build hierarchical tree from roots
  const hierarchicalTree: TreeData[] = rootNodeIds.map((rootId) =>
    buildTree(rootId, new Set<string>()),
  );

  console.log(
    `[LOAD-SUBCOL-TREE] Built tree with ${hierarchicalTree.length} root node(s)`,
  );
  return hierarchicalTree;
}
