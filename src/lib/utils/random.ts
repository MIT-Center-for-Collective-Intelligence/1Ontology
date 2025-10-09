import { INode } from "@components/types/INode";
import { query, collection, where, getDocs } from "firebase/firestore";
import { NODES } from "../firestoreClient/collections";

// OLD VERSION - Exports nested tree with descriptions, parts, etc.
// This creates a deeply nested structure that's not optimal for tree rendering
// Kept for reference but commented out
/*
export const handleDownload = async ({ nodes }: { nodes: any }) => {
  const spreadNodes: any = Object.values(nodes);
  const mainCategories = spreadNodes.filter(
    (node: INode) =>
      node.category || (typeof node.root === "boolean" && !!node.root),
  );

  mainCategories.sort((nodeA: any, nodeB: any) => {
    const order = [
      "WHAT: Activities and Objects",
      "WHO: Actors",
      "WHY: Evaluation",
      "Where: Context",
      "ONet",
    ];
    const nodeATitle = nodeA.title;
    const nodeBTitle = nodeB.title;
    return order.indexOf(nodeATitle) - order.indexOf(nodeBTitle);
  });

  const buildTree = (
    _nodes: INode[],
    path: string[],
    visited: Set<string> = new Set(),
  ) => {
    let newSpecializationsTree: any = {};

    if (_nodes.length === 0) return {};

    for (let node of _nodes) {
      if (!node) {
        continue;
      }
      visited.add(node.id);
      const nodeTitle = node.title.trim();

      const inheritancePartRef = node.inheritance["parts"].ref;
      let parts = node.properties.parts;
      if (inheritancePartRef && nodes[inheritancePartRef]) {
        parts = nodes[inheritancePartRef].properties["parts"];
      }
      parts = Array.isArray(parts)
        ? parts
            .flatMap((c) => c.nodes)
            .filter((c) => !!nodes[c.id])
            .map((c) => nodes[c.id].title.trim())
        : [];
      const inheritanceDescriptionRef = node.inheritance["description"].ref;
      const description = inheritanceDescriptionRef
        ? nodes[inheritanceDescriptionRef].properties["description"] || ""
        : node.properties["description"];

      newSpecializationsTree[nodeTitle] = {
        title: nodeTitle,
        description,
        parts,
        specializations: {},
        generalizations: {},
      };

      for (let collection of node.specializations) {
        const specializations: INode[] = [];
        collection.nodes.forEach((nodeLink: { id: string }) => {
          specializations.push(nodes[nodeLink.id]);
        });
        const generalizationsNames = node.generalizations[0].nodes
          .filter((c) => !!nodes[c.id])
          .map((c: { id: string }) => nodes[c.id].title.trim());

        if (collection.collectionName === "main") {
          newSpecializationsTree[nodeTitle].specializations = {
            ...(newSpecializationsTree[nodeTitle]?.specializations || {}),
            ...buildTree(specializations, [...path, node.id], visited),
          };
          newSpecializationsTree[nodeTitle].generalizations =
            generalizationsNames;
        } else {
          newSpecializationsTree[nodeTitle].specializations[
            `[${collection.collectionName}]`
          ] = {
            title: `[${collection.collectionName}]`,
            specializations: buildTree(
              specializations,
              [...path, node.id],
              visited,
            ),
            generalizations: generalizationsNames,
          };
        }
      }
    }

    return newSpecializationsTree;
  };

  let treeOfSpecializations = buildTree(mainCategories, []);

  const blob = new Blob([JSON.stringify(treeOfSpecializations, null, 2)], {
    type: "application/json",
  });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "nodes-data.json";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
*/

// Exports flat hierarchy optimized for tree rendering
// Only includes: id, title, nodeType, category, children relationships, paths
// Much smaller file size and faster to parse
export const handleDownload = async ({ nodes }: { nodes: any }) => {
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
      const parentIds = node.generalizations[0]?.nodes
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
};

/**
 * Download hierarchy as JSON file (client-side download)
 */
export const downloadHierarchyFile = (hierarchy: any, appName: string) => {
  const blob = new Blob([JSON.stringify(hierarchy, null, 2)], {
    type: "application/json",
  });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${appName}-hierarchy-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Upload hierarchy to Firebase Storage via API
 * Overwrites existing file if it exists
 */
export const uploadHierarchyToStorage = async (
  hierarchy: any,
  appName: string,
  user: any
) => {
  try {
    // Get user's ID token
    const token = await user.getIdToken();

    console.log("Uploading to:", "/api/admin/upload-hierarchy");
    console.log("AppName:", appName);

    // Call upload API
    const response = await fetch("/api/admin/upload-hierarchy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        appName,
        hierarchy,
      }),
    });

    console.log("Response status:", response.status);
    console.log("Response headers:", response.headers);

    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      } else {
        const text = await response.text();
        console.error("Non-JSON response:", text.substring(0, 500));
        throw new Error(`Upload failed: Server returned ${response.status}`);
      }
    }

    const result = await response.json();
    console.log(`✅ Hierarchy uploaded: ${result.fileName}`);
    return result;
  } catch (error: any) {
    console.error("Failed to upload hierarchy:", error);
    throw error;
  }
};

const getStructureForJSON = (data: INode) => {
  const getTitles = (property: any) => {
    return Object.values(property)
      .flat()
      .map((prop: any) => prop.title);
  };

  const { properties } = data;
  for (let property in properties) {
    if (typeof properties[property] !== "string") {
      properties[property] = getTitles(properties[property]);
    }
  }
  return {
    title: data.title,
    generalizations: getTitles(data.generalizations),
    specializations: getTitles(data.specializations),
    parts: [],
    isPartOf: [],
    // ...properties,
  };
};
