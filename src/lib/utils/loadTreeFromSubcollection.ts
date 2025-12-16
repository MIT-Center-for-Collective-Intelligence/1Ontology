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
 * Load tree nodes from subcollection and reconstruct hierarchical tree
 */
export async function loadTreeFromSubcollection(
  nodeId: string
): Promise<TreeData[]> {
  const db = getFirestore();

  console.log(`[LOAD-SUBCOL-TREE] Loading tree for node: ${nodeId}`);

  // Fetch all tree nodes from subcollection
  const treeNodesRef = collection(db, NODES, nodeId, "treeNodes");
  const snapshot = await getDocs(treeNodesRef);

  if (snapshot.empty) {
    console.log(`[LOAD-SUBCOL-TREE] No tree data found in subcollection`);
    return [];
  }

  console.log(`[LOAD-SUBCOL-TREE] Loaded ${snapshot.size} nodes from subcollection`);

  // Build a map of all nodes by their nodeId (document ID)
  const nodesMap: { [nodeId: string]: TreeNodeDocument } = {};
  snapshot.forEach(doc => {
    nodesMap[doc.id] = doc.data() as TreeNodeDocument;
  });

  // Find root nodes
  const rootNodeIds: string[] = [];
  for (const [nodeId, node] of Object.entries(nodesMap)) {
    if (node.root === true) {
      rootNodeIds.push(nodeId);
    }
  }

  console.log(`[LOAD-SUBCOL-TREE] Found ${rootNodeIds.length} root node(s)`);

  // Reconstruct hierarchical tree from specializations
  const buildTree = (nodeId: string, path: string[] = []): TreeData => {
    const node = nodesMap[nodeId];
    if (!node) {
      console.warn(`[LOAD-SUBCOL-TREE] Node ${nodeId} not found in map`);
      return {
        id: nodeId,
        nodeId: nodeId,
        name: "Unknown",
        nodeType: "activity",
        children: []
      };
    }

    const currentPath = [...path, nodeId];
    const pathBasedId = currentPath.join("-");

    // Prevent circular references
    if (path.includes(nodeId)) {
      return {
        id: pathBasedId,
        nodeId: nodeId,
        name: node.title,
        nodeType: node.nodeType,
        ...(node.unclassified && { unclassified: true }),
        children: []
      };
    }

    const childrenInOrder: TreeData[] = [];

    // Process each collection in order
    for (let collectionIndex = 0; collectionIndex < node.specializations.length; collectionIndex++) {
      const collection = node.specializations[collectionIndex];

      if (collection.collectionName === "main") {
        // Main collection: add children directly with their path
        for (const child of collection.nodes || []) {
          const childTree = buildTree(child.id, currentPath);
          childrenInOrder.push({
            ...childTree,
            isMainItem: true,
            originalCollectionIndex: collectionIndex
          } as any);
        }
      } else {
        // Non-main collection: create a category wrapper
        const collectionChildren: TreeData[] = [];
        const collectionPath = [...currentPath, collection.collectionName];

        for (const child of collection.nodes || []) {
          collectionChildren.push(buildTree(child.id, collectionPath));
        }

        if (collectionChildren.length > 0) {
          childrenInOrder.push({
            id: `${pathBasedId}-${collection.collectionName}`,
            nodeId: nodeId,
            name: `[${collection.collectionName}]`,
            nodeType: node.nodeType,
            category: true,
            children: collectionChildren,
            ...(node.unclassified && { unclassified: true }),
            originalCollectionIndex: collectionIndex
          } as any);
        }
      }
    }

    return {
      id: pathBasedId,
      nodeId: nodeId,
      name: node.title,
      nodeType: node.nodeType,
      ...(node.unclassified && { unclassified: true }),
      category: false,
      children: childrenInOrder.length > 0 ? childrenInOrder : undefined
    };
  };

  // Build hierarchical tree from roots
  const hierarchicalTree: TreeData[] = rootNodeIds.map(rootId => buildTree(rootId));

  console.log(`[LOAD-SUBCOL-TREE] Built tree with ${hierarchicalTree.length} root node(s)`);
  return hierarchicalTree;
}
