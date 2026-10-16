/** Deterministic graph preparation; never changes the source ontology. */
export const isHeading = (node) => /^\[.*\]$/.test(node.title.trim());
export const childIds = (node) => [
  ...new Set(
    (node.specializations || []).flatMap((c) =>
      (c.nodes || []).map((n) => n.id),
    ),
  ),
];
export const parentIds = (node) => [
  ...new Set(
    (node.generalizations || []).flatMap((c) =>
      (c.nodes || []).map((n) => n.id),
    ),
  ),
];
export function graphInventory(nodes) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  if (byId.size !== nodes.length) throw Error("Duplicate source ID");
  const roots = nodes.filter((n) => n.root);
  if (roots.length !== 1) throw Error("Expected one explicit ontology root");
  const levels = new Map([[roots[0].id, 1]]),
    queue = [roots[0].id];
  const missing = [],
    mismatches = [];
  for (const n of nodes) {
    for (const id of childIds(n)) {
      if (!byId.has(id)) missing.push({ parentId: n.id, childId: id });
      else if (!parentIds(byId.get(id)).includes(n.id))
        mismatches.push({
          parentId: n.id,
          childId: id,
          side: "specializations-only",
        });
    }
    for (const id of parentIds(n))
      if (byId.has(id) && !childIds(byId.get(id)).includes(n.id))
        mismatches.push({
          parentId: id,
          childId: n.id,
          side: "generalizations-only",
        });
  }
  // Minimum directed edge distance; DAG nodes can occur at several visual depths.
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    for (const child of childIds(byId.get(id)))
      if (byId.has(child) && !levels.has(child)) {
        levels.set(child, levels.get(id) + 1);
        queue.push(child);
      }
  }
  return { byId, rootId: roots[0].id, levels, missing, mismatches };
}
export function descendants(id, byId) {
  const result = new Set(),
    queue = [id];
  for (let i = 0; i < queue.length; i++)
    for (const next of childIds(byId.get(queue[i]) || {}))
      if (byId.has(next) && !result.has(next)) {
        result.add(next);
        queue.push(next);
      }
  return result;
}
export function inspectRecommendation(subjectId, proposedParentIds, graph) {
  const issues = [];
  if (!graph.byId.has(subjectId)) return ["Unknown subject"];
  const below = descendants(subjectId, graph.byId);
  if (below.has(subjectId))
    issues.push("Source already contains a cycle through this activity");
  if (new Set(proposedParentIds).size !== proposedParentIds.length)
    issues.push("Repeated proposed parent");
  for (const id of proposedParentIds) {
    if (!graph.byId.has(id))
      issues.push("Proposed parent is absent from source");
    else if (id === subjectId || below.has(id))
      issues.push("Proposed link would create a cycle");
    else if (isHeading(graph.byId.get(id)))
      issues.push("Proposed parent is a navigation heading");
  }
  return issues;
}
/** A set of individually safe alternatives may conflict when combined. */
export function combinedProposalConflicts(proposals, graph) {
  const subjects = new Set(proposals.map((p) => p.subjectId));
  const children = new Map(
    [...graph.byId].map(([id, n]) => [
      id,
      new Set(childIds(n).filter((c) => !subjects.has(c))),
    ]),
  );
  for (const p of proposals)
    for (const parent of p.parentIds) children.get(parent)?.add(p.subjectId);
  const reaches = (start, target) => {
    const seen = new Set([start]),
      queue = [start];
    for (let i = 0; i < queue.length; i++)
      for (const child of children.get(queue[i]) || []) {
        if (child === target) return true;
        if (!seen.has(child)) {
          seen.add(child);
          queue.push(child);
        }
      }
    return false;
  };
  return proposals.flatMap((p) =>
    p.parentIds
      .filter((parent) => reaches(p.subjectId, parent))
      .map((parent) => ({
        subjectId: p.subjectId,
        parentId: parent,
        kind: "combined-cycle",
      })),
  );
}
