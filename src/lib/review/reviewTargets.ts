/**
 * The nodes a review opens on: each family a child's proposal names as its
 * parent, and each proposal that is the top of its own review (no parent).
 * A family's own proposal counts with its children's.
 */
export type ReviewTarget = { id: string; proposals: number; pending: number };

export function reviewTargets(
  proposals: { nodeId: string; parentId?: string | null; status?: string }[],
): ReviewTarget[] {
  const out = new Map<string, ReviewTarget>();
  for (const p of proposals) {
    const id = p.parentId || p.nodeId;
    const t = out.get(id) || { id, proposals: 0, pending: 0 };
    t.proposals += 1;
    if (p.status === "pending") t.pending += 1;
    out.set(id, t);
  }
  return [...out.values()];
}
