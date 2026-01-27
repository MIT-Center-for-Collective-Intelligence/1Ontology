import { collection, getDocs, getFirestore } from "firebase/firestore";
import { NODES } from "@components/lib/firestoreClient/collections";
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
): Promise<TreeData[]> {
  const db = getFirestore();

  console.log(`[LOAD-SUBCOL-TREE] Loading tree for node: ${nodeId}`);

  // Fetch all tree nodes from subCollection
  const treeNodesRef = collection(db, NODES, nodeId, "treeNodes");
  const snapshot = await getDocs(treeNodesRef);

  if (snapshot.empty) {
    console.log(`[LOAD-SUBCOL-TREE] No tree data found in subCollection`);
    return [];
  }

  console.log(
    `[LOAD-SUBCOL-TREE] Loaded ${snapshot.size} nodes from subCollection`,
  );

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

  console.log(`[LOAD-SUBCOL-TREE] Found ${rootNodeIds.length} root node(s)`);

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

          if (collectionChildren.length > 0) {
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
