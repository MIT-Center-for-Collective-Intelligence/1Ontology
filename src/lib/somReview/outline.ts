import { SomOntologyOutlineSnapshot } from "../../types/ISomReview";
import type { SomDataset } from "./dataset";
import { nodeSynonyms } from "./ontologyNodeMetadata";

export const toOutlineSnapshot = (
  dataset: SomDataset,
): SomOntologyOutlineSnapshot => {
  const snapshot = dataset.snapshot;
  const rootNodeId = snapshot.branchRootNodeId || snapshot.sellRootNodeId || "";
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const childrenByParent = new Map<string, string[]>();

  for (const edge of snapshot.edges) {
    childrenByParent.set(edge.parentId, [
      ...(childrenByParent.get(edge.parentId) || []),
      edge.childId,
    ]);
  }

  const reachable = new Set<string>();
  const pending = [rootNodeId];
  while (pending.length > 0) {
    const nodeId = pending.shift() || "";
    if (!nodeId || reachable.has(nodeId) || !nodesById.has(nodeId)) continue;
    reachable.add(nodeId);
    pending.push(...(childrenByParent.get(nodeId) || []));
  }

  return {
    ontologyName: snapshot.ontologyName,
    capturedAt: snapshot.capturedAt,
    rootNodeId,
    rootTitle:
      snapshot.branchRootTitle || nodesById.get(rootNodeId)?.title || "",
    nodes: snapshot.nodes
      .filter((node) => reachable.has(node.id))
      .map((node) => ({
        id: node.id,
        title: node.title,
        evidence: node.title.startsWith("(O*Net)"),
        synonyms: nodeSynonyms(node),
      })),
    edges: snapshot.edges.filter(
      (edge) => reachable.has(edge.parentId) && reachable.has(edge.childId),
    ),
  };
};

export const formatOutlineText = (
  snapshot: SomOntologyOutlineSnapshot,
  includeEvidence = false,
): string => {
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const childrenByParent = new Map<
    string,
    Array<{ childId: string; collectionName: string }>
  >();
  for (const edge of snapshot.edges) {
    childrenByParent.set(edge.parentId, [
      ...(childrenByParent.get(edge.parentId) || []),
      { childId: edge.childId, collectionName: edge.collectionName },
    ]);
  }
  const lines = [
    snapshot.rootTitle,
    `Ontology: ${snapshot.ontologyName}`,
    `Captured: ${snapshot.capturedAt}`,
    "",
  ];
  const ancestors = new Set<string>();
  const writeNode = (nodeId: string, depth: number): void => {
    const node = nodesById.get(nodeId);
    if (!node || (!includeEvidence && node.evidence)) return;
    const indent = "  ".repeat(depth);
    lines.push(`${indent}- ${node.title}`);
    if (node.synonyms.length > 0) {
      lines.push(`${indent}  Synonyms: ${node.synonyms.join("; ")}`);
    }
    if (ancestors.has(nodeId)) {
      lines.push(`${indent}  [circular reference]`);
      return;
    }
    ancestors.add(nodeId);
    const children = (childrenByParent.get(nodeId) || [])
      .filter((child) => {
        const childNode = nodesById.get(child.childId);
        return childNode && (includeEvidence || !childNode.evidence);
      })
      .sort((left, right) => {
        const collectionOrder = left.collectionName.localeCompare(
          right.collectionName,
          "en",
        );
        if (collectionOrder !== 0) return collectionOrder;
        return (nodesById.get(left.childId)?.title || "").localeCompare(
          nodesById.get(right.childId)?.title || "",
          "en",
        );
      });
    let previousCollection = "";
    for (const child of children) {
      const normalizedCollection = child.collectionName
        .trim()
        .replace(/^\[/, "")
        .replace(/\]$/, "");
      const isMain =
        !normalizedCollection ||
        normalizedCollection.toLowerCase() === "main" ||
        normalizedCollection.toLowerCase() === "default";
      if (!isMain && normalizedCollection !== previousCollection) {
        lines.push(`${"  ".repeat(depth + 1)}[${normalizedCollection}]`);
      }
      writeNode(child.childId, depth + (isMain ? 1 : 2));
      previousCollection = isMain ? "" : normalizedCollection;
    }
    ancestors.delete(nodeId);
  };
  writeNode(snapshot.rootNodeId, 0);
  return `${lines.join("\n").trimEnd()}\n`;
};
