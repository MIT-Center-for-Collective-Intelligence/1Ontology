import { useState, useEffect } from "react";
import { getFirestore, doc, collection, onSnapshot, getDocs, query, where, documentId } from "firebase/firestore";
import { INode, ICollection, ILinkNode } from "@components/types/INode";
import { NODES } from "../firestoreClient/collections";
import { FEATURES } from "./treeHierarchyLoader";

/**
 * Extract all linked node IDs from a node's properties
 */
const extractLinkedNodeIds = (nodeData: INode): string[] => {
  const linkedIds = new Set<string>();

  // Extract from generalizations
  if (nodeData.generalizations) {
    nodeData.generalizations.forEach((collection: ICollection) => {
      collection.nodes?.forEach((node) => {
        if (node.id) linkedIds.add(node.id);
      });
    });
  }

  // Extract from specializations
  if (nodeData.specializations) {
    nodeData.specializations.forEach((collection: ICollection) => {
      collection.nodes?.forEach((node) => {
        if (node.id) linkedIds.add(node.id);
      });
    });
  }

  // Extract from parts
  if (nodeData.properties?.parts) {
    nodeData.properties.parts.forEach((collection: ICollection) => {
      collection.nodes?.forEach((node) => {
        if (node.id) linkedIds.add(node.id);
      });
    });
  }

  // Extract from isPartOf
  if (nodeData.properties?.isPartOf) {
    nodeData.properties.isPartOf.forEach((collection: ICollection) => {
      collection.nodes?.forEach((node) => {
        if (node.id) linkedIds.add(node.id);
      });
    });
  }

  // Extract from other structured properties
  for (const key in nodeData.properties) {
    const property = nodeData.properties[key];
    if (Array.isArray(property) && property.length > 0 && property[0].nodes) {
      property.forEach((collection: ICollection) => {
        collection.nodes?.forEach((node) => {
          if (node.id) linkedIds.add(node.id);
        });
      });
    }
  }

  return Array.from(linkedIds);
};

/**
 * Fetch titles for linked nodes in batches
 */
const fetchLinkedNodeTitles = async (
  db: any,
  nodeIds: string[]
): Promise<Map<string, string>> => {
  const titles = new Map<string, string>();

  if (nodeIds.length === 0) return titles;

  // Firestore 'in' queries support max 10 items, so batch the requests
  const batchSize = 10;
  const batches = [];

  for (let i = 0; i < nodeIds.length; i += batchSize) {
    batches.push(nodeIds.slice(i, i + batchSize));
  }

  try {
    await Promise.all(
      batches.map(async (batch) => {
        const q = query(
          collection(db, NODES),
          where(documentId(), "in", batch)
        );
        const snapshot = await getDocs(q);
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.title) {
            titles.set(doc.id, data.title);
          }
        });
      })
    );
  } catch (error) {
    console.error("Error fetching linked node titles:", error);
  }

  return titles;
};

/**
 * Enrich node data with titles for all linked nodes
 */
const enrichNodeWithTitles = (
  nodeData: INode,
  titles: Map<string, string>
): INode => {
  const enrichedNode = { ...nodeData };

  // Enrich generalizations
  if (enrichedNode.generalizations) {
    enrichedNode.generalizations = enrichedNode.generalizations.map(
      (collection: ICollection) => ({
        ...collection,
        nodes: collection.nodes.map((node: ILinkNode) => ({
          ...node,
          title: titles.get(node.id) || node.title,
        })),
      })
    );
  }

  // Enrich specializations
  if (enrichedNode.specializations) {
    enrichedNode.specializations = enrichedNode.specializations.map(
      (collection: ICollection) => ({
        ...collection,
        nodes: collection.nodes.map((node: ILinkNode) => ({
          ...node,
          title: titles.get(node.id) || node.title,
        })),
      })
    );
  }

  // Enrich parts
  if (enrichedNode.properties?.parts) {
    enrichedNode.properties.parts = enrichedNode.properties.parts.map(
      (collection: ICollection) => ({
        ...collection,
        nodes: collection.nodes.map((node: ILinkNode) => ({
          ...node,
          title: titles.get(node.id) || node.title,
        })),
      })
    );
  }

  // Enrich isPartOf
  if (enrichedNode.properties?.isPartOf) {
    enrichedNode.properties.isPartOf = enrichedNode.properties.isPartOf.map(
      (collection: ICollection) => ({
        ...collection,
        nodes: collection.nodes.map((node: ILinkNode) => ({
          ...node,
          title: titles.get(node.id) || node.title,
        })),
      })
    );
  }

  // Enrich other structured properties
  for (const key in enrichedNode.properties) {
    const property = enrichedNode.properties[key];
    if (Array.isArray(property) && property.length > 0 && property[0].nodes) {
      enrichedNode.properties[key] = property.map((collection: ICollection) => ({
        ...collection,
        nodes: collection.nodes.map((node: ILinkNode) => ({
          ...node,
          title: titles.get(node.id) || node.title,
        })),
      }));
    }
  }

  return enrichedNode;
};

/**
 * Hook to fetch and subscribe to a single node's data from Firestore
 * Used when USE_STATIC_NODES is enabled to load only the currently viewed node
 * instead of loading all nodes at once
 *
 * This hook also fetches titles for all linked nodes (generalizations, specializations, parts, isPartOf)
 * to ensure proper display in the UI components
 */
export const useNodeSnapshot = (nodeId: string | null) => {
  const [node, setNode] = useState<INode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Only use snapshot when static nodes feature is enabled and nodeId exists
    if (!nodeId || !FEATURES.USE_STATIC_NODES) {
      setNode(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const db = getFirestore();
    const nodeRef = doc(collection(db, NODES), nodeId);

    // Set up real-time listener for this specific node
    const unsubscribe = onSnapshot(
      nodeRef,
      async (snapshot) => {
        if (snapshot.exists()) {
          const nodeData = {
            id: snapshot.id,
            ...snapshot.data(),
          } as INode;

          // Set node immediately for instant UI response
          setNode(nodeData);
          setLoading(false);
          setError(null);

          // Then enrich with titles in the background (non-blocking)
          const linkedNodeIds = extractLinkedNodeIds(nodeData);
          if (linkedNodeIds.length > 0) {
            const titles = await fetchLinkedNodeTitles(db, linkedNodeIds);
            const enrichedNode = enrichNodeWithTitles(nodeData, titles);
            setNode(enrichedNode);
          }
        } else {
          setNode(null);
          setError(new Error(`Node ${nodeId} not found`));
          setLoading(false);
        }
      },
      (err) => {
        console.error("Error fetching node:", err);
        setError(err as Error);
        setLoading(false);
      }
    );

    // Cleanup: unsubscribe when nodeId changes or component unmounts
    return () => unsubscribe();
  }, [nodeId]);

  return { node, loading, error };
};
