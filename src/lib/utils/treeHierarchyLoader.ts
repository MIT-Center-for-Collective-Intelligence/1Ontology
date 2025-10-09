import { useState, useEffect } from "react";
import { getAuth } from "firebase/auth";
import { Post } from "./Post";

// ============================================================================
// FEATURE FLAGS
// ============================================================================

export const FEATURES = {
  USE_STATIC_NODES: process.env.NEXT_PUBLIC_USE_STATIC_NODES === "true",
  USE_FIREBASE_STORAGE: process.env.NEXT_PUBLIC_USE_FIREBASE_STORAGE === "true",
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface HierarchyNode {
  id: string;
  nodeId: string;
  title: string;
  nodeType: string | null;
  category: boolean;
  locked: boolean;
  unclassified: boolean;
  childrenIds: string[];
  collections: Array<{
    name: string;
    childIds: string[];
  }>;
  parentIds: string[];
  paths: string[][];
  metadata: {
    specializationCount: number;
    depth: number;
  };
}

export interface TreeHierarchy {
  version: number;
  generatedAt: string;
  roots: string[];
  nodes: {
    [id: string]: HierarchyNode;
  };
  stats: {
    totalNodes: number;
    rootNodes: number;
    maxDepth: number;
  };
}

export interface TreeData {
  id: string;
  nodeId?: string;
  name: string;
  children?: TreeData[];
  nodeType?: string;
  locked?: boolean;
  category?: boolean;
  unclassified?: boolean;
}

// ============================================================================
// FETCH: Load Hierarchy from Firebase Storage
// ============================================================================

/**
 * Fetch hierarchy JSON from Firebase Storage
 * @param appName - The ontology application name
 * @returns TreeHierarchy object
 */
// export const fetchHierarchyFromStorage = async (
//   appName: string
// ): Promise<TreeHierarchy> => {
//   try {
//     // Create reference to the file
//     const fileName = `ontology-hierarchies/${appName}.json`;
//     const fileRef = ref(storage, fileName);

//     // Get download URL
//     const downloadUrl = await getDownloadURL(fileRef);

//     // Fetch the file
//     const response = await fetch(downloadUrl);

//     if (!response.ok) {
//       throw new Error(`Failed to fetch hierarchy: ${response.statusText}`);
//     }

//     const hierarchy: TreeHierarchy = await response.json();
//     return hierarchy;
//   } catch (error: any) {
//     console.error(`Failed to fetch hierarchy for ${appName}:`, error);
//     throw error;
//   }
// };

// ============================================================================
// HOOK: Load Tree Hierarchy (from Storage or Static File)
// ============================================================================

export const useTreeHierarchy = (appName: string = "default") => {
  const [hierarchy, setHierarchy] = useState<TreeHierarchy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadHierarchy = async () => {
      try {
        setLoading(true);

        let data: TreeHierarchy;
        const response: any = await Post("/readTreeData", {
          appName,
        });
        console.log(response);
        if (response) {
          setHierarchy(response.data);
        }
        setError(null);
      } catch (err) {
        console.error("Error loading tree hierarchy:", err);
        setError(err instanceof Error ? err : new Error("Unknown error"));
        setHierarchy(null);
      } finally {
        setLoading(false);
      }
    };

    loadHierarchy();
  }, [appName]);

  return { hierarchy, loading, error };
};

// ============================================================================
// CONVERTER: Hierarchy to TreeData Format
// ============================================================================

export const convertHierarchyToTreeData = (
  hierarchy: TreeHierarchy | null,
): TreeData[] => {
  if (!hierarchy) return [];

  const { roots, nodes } = hierarchy;

  const buildTreeNode = (
    nodeId: string,
    parentPath: string[] = [],
  ): TreeData | null => {
    const hierarchyNode = nodes[nodeId];
    if (!hierarchyNode) return null;

    const treeNode: TreeData = {
      id: hierarchyNode.id,
      nodeId: hierarchyNode.nodeId,
      name: hierarchyNode.title,
      nodeType: hierarchyNode.nodeType ?? undefined,
      locked: hierarchyNode.locked || undefined,
      category: hierarchyNode.category || undefined,
      unclassified: hierarchyNode.unclassified || undefined,
    };

    // Build children based on collections structure
    if (hierarchyNode.collections && hierarchyNode.collections.length > 0) {
      const children: TreeData[] = [];

      for (const collection of hierarchyNode.collections) {
        // If not "main" collection, create a category node
        if (collection.name !== "main") {
          const categoryNode: TreeData = {
            id: `${hierarchyNode.id}-${collection.name}`,
            nodeId: hierarchyNode.nodeId,
            name: collection.name,
            category: true,
            nodeType: hierarchyNode.nodeType ?? undefined,
            children: [],
          };

          // Add children to category node
          for (const childId of collection.childIds) {
            const childNode = buildTreeNode(childId, [...parentPath, nodeId]);
            if (childNode) {
              categoryNode.children!.push(childNode);
            }
          }

          if (categoryNode.children!.length > 0) {
            children.push(categoryNode);
          }
        } else {
          // For "main" collection, add children directly
          for (const childId of collection.childIds) {
            const childNode = buildTreeNode(childId, [...parentPath, nodeId]);
            if (childNode) {
              children.push(childNode);
            }
          }
        }
      }

      if (children.length > 0) {
        treeNode.children = children;
      }
    }

    return treeNode;
  };

  // Build tree starting from roots
  const treeData: TreeData[] = [];

  for (const rootId of roots) {
    const rootNode = buildTreeNode(rootId, []);
    if (rootNode) {
      treeData.push(rootNode);
    }
  }

  return treeData;
};

// ============================================================================
// HELPER: Get Node by ID from Hierarchy
// ============================================================================

export const getNodeFromHierarchy = (
  hierarchy: TreeHierarchy | null,
  nodeId: string,
): HierarchyNode | null => {
  if (!hierarchy) return null;
  return hierarchy.nodes[nodeId] || null;
};

// ============================================================================
// HELPER: Get All Children IDs (recursive)
// ============================================================================

export const getAllChildrenIds = (
  hierarchy: TreeHierarchy | null,
  nodeId: string,
  visited: Set<string> = new Set(),
): string[] => {
  if (!hierarchy || visited.has(nodeId)) return [];

  visited.add(nodeId);
  const node = hierarchy.nodes[nodeId];
  if (!node) return [];

  const allChildren: string[] = [...node.childrenIds];

  for (const childId of node.childrenIds) {
    const descendantIds = getAllChildrenIds(hierarchy, childId, visited);
    allChildren.push(...descendantIds);
  }

  return allChildren;
};

// ============================================================================
// HELPER: Get Path to Node
// ============================================================================

export const getPathToNode = (
  hierarchy: TreeHierarchy | null,
  nodeId: string,
): string[] => {
  if (!hierarchy) return [];

  const node = hierarchy.nodes[nodeId];
  if (!node || !node.paths || node.paths.length === 0) return [];

  // Return the first path (primary path)
  return node.paths[0];
};

// ============================================================================
// HELPER: Search Nodes by Title
// ============================================================================

export const searchNodesByTitle = (
  hierarchy: TreeHierarchy | null,
  searchTerm: string,
): HierarchyNode[] => {
  if (!hierarchy || !searchTerm) return [];

  const lowerSearch = searchTerm.toLowerCase();
  const results: HierarchyNode[] = [];

  for (const nodeId in hierarchy.nodes) {
    const node = hierarchy.nodes[nodeId];
    if (node.title.toLowerCase().includes(lowerSearch)) {
      results.push(node);
    }
  }

  return results;
};
