import { SomOntologyOutlineSnapshot } from "../../types/ISomReview";
import type { SomDataset } from "./dataset";

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
      })),
    edges: snapshot.edges.filter(
      (edge) => reachable.has(edge.parentId) && reachable.has(edge.childId),
    ),
  };
};
