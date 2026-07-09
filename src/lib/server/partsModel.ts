import { ILinkNode } from "@components/types/INode";

/**
 * Pure model for parts inheritance (no Firestore) — unit-testable in isolation.
 *
 * Each part in `properties.parts` carries `inheritedFrom` = the id of the node
 * that OWNS it (empty ⇒ this node owns it). That single per-part field drives
 * everything: owner-only isPartOf (`inheritedFrom` empty), the specific source,
 * and the overall `inheritance.parts.ref`.
 */

/** A part is OWNED by its node iff it records no `inheritedFrom` source. */
export function isOwnedPart(part: ILinkNode): boolean {
  return !part.inheritedFrom;
}

/** Does this parts list contain at least one own (non-inherited) part? */
export function ownsAnyPart(parts: ILinkNode[]): boolean {
  return parts.some(isOwnedPart);
}

/**
 * The owner a CHILD records for a part it inherits from parent `parentId`:
 * the parent if the parent owns it, else whoever the parent inherited it from.
 * This is what skips a pass-through parent — per part.
 */
export function childSourceOf(parentPart: ILinkNode, parentId: string): string {
  return parentPart.inheritedFrom ?? parentId;
}

/**
 * Overall `ref` for a node that draws its whole arrangement from a single direct
 * generalization `gen`. Skip `gen` only when it's a PURE pass-through — it has a
 * clean overall ref of its own AND owns none of its parts; otherwise the node
 * attaches directly to `gen` (a real owner, or a broken/mixed node).
 */
export function overallRefThroughGen(gen: {
  id: string;
  ref: string | null;
  parts: ILinkNode[];
}): string {
  const purePassThrough = gen.ref !== null && !ownsAnyPart(gen.parts);
  return purePassThrough ? (gen.ref as string) : gen.id;
}

/**
 * Re-derive a node's parts + overall `ref` from an EDITED list (the user's own
 * order preserved). Each part provided by a generalization is tagged with its
 * owner — honoring an existing source choice when a provider still resolves to
 * it, else the first declared provider; a part no gen provides is own. `ref` =
 * the first generalization whose parts are ALL still present (via
 * {@link overallRefThroughGen}), so reordering or switching a source never breaks
 * it while removing an inherited part does; `null` when none matches.
 */
export function derivePartsAndRef(
  nodeParts: ILinkNode[],
  gens: { id: string; ref: string | null; parts: ILinkNode[] }[],
): { parts: ILinkNode[]; ref: string | null } {
  // The owner a part would have if tracked through gen `g` (skips a pass-through).
  const ownerThroughGen = (
    g: { id: string; parts: ILinkNode[] },
    partId: string,
  ): string | null => {
    const gp = g.parts.find((x) => x.id === partId);
    return gp ? childSourceOf(gp, g.id) : null;
  };
  const parts = nodeParts.map((p) => {
    const providers = gens.filter((g) => g.parts.some((gp) => gp.id === p.id));
    const node: ILinkNode = { id: p.id };
    if (p.title !== undefined) node.title = p.title;
    if (p.optional) node.optional = true;
    if (providers.length > 0) {
      // Honor an existing source choice when a provider still resolves to it
      // (a user switch), else fall back to the first declared provider.
      const chosen = p.inheritedFrom
        ? providers.find((g) => ownerThroughGen(g, p.id) === p.inheritedFrom)
        : undefined;
      const source = chosen ?? providers[0];
      node.inheritedFrom = ownerThroughGen(source, p.id) ?? source.id;
    }
    return node;
  });

  // Overall attachment is a LIST relationship, independent of the per-part
  // sources above: the node attaches to the first generalization (with parts)
  // whose parts are ALL still present on the node. So switching a part's source
  // or reordering never breaks it; removing an inherited part does.
  const nodeIds = new Set(nodeParts.map((p) => p.id));
  const attached = gens.find(
    (g) => g.parts.length > 0 && g.parts.every((gp) => nodeIds.has(gp.id)),
  );
  const ref = attached ? overallRefThroughGen(attached) : null;
  return { parts, ref };
}

const FRONT = "__front__";

type Gen = { id: string; ref: string | null; parts: ILinkNode[] };

/**
 * Merge the parent's parts into the child's list: emit the parent's parts in the
 * PARENT's order, keeping the child's other parts (own, or sourced from another
 * generalization) anchored to the part that preceded them. Existing child entries
 * are reused as-is, so their `optional` and `inheritedFrom` survive; a part the
 * child gains is added bare (its source is assigned by {@link derivePartsAndRef}).
 */
function mergeAgainstParentOrder(
  childList: ILinkNode[],
  parentParts: ILinkNode[],
): ILinkNode[] {
  const parentIds = new Set(parentParts.map((p) => p.id));
  const otherByAnchor = new Map<string, ILinkNode[]>();
  let anchor = FRONT;
  for (const c of childList) {
    if (parentIds.has(c.id)) {
      anchor = c.id;
      continue;
    }
    if (!otherByAnchor.has(anchor)) otherByAnchor.set(anchor, []);
    otherByAnchor.get(anchor)!.push(c);
  }
  const byId = new Map(childList.map((c) => [c.id, c]));
  const result: ILinkNode[] = [];
  for (const p of otherByAnchor.get(FRONT) ?? []) result.push(p);
  for (const g of parentParts) {
    const existing = byId.get(g.id);
    if (existing) {
      result.push(existing);
    } else {
      const gained: ILinkNode = { id: g.id };
      if (g.title !== undefined) gained.title = g.title;
      if (g.optional) gained.optional = true;
      result.push(gained);
    }
    for (const p of otherByAnchor.get(g.id) ?? []) result.push(p);
  }
  return result;
}

/**
 * Propagate a parent's parts change into one descendant, as TWO layers:
 *
 * 1. SPECIFIC — a part removed from the parent is dropped from the child only if
 *    the child tracks that part THROUGH this parent. A part the child sources
 *    from another generalization survives. This runs even when the child is not
 *    overall-attached, so removals keep cascading after an overall break.
 * 2. OVERALL — only when the child is overall-attached to this parent: adopt the
 *    parent's order and gain its new parts.
 *
 * Then {@link derivePartsAndRef} re-derives each part's source (honoring the
 * child's stored choices) and recomputes the child's overall `ref`.
 * A parent "replace" needs no special case: it is a specific-remove of the old
 * part plus an overall-add of the new one.
 */
export function cascadeIntoDescendant(params: {
  childParts: ILinkNode[];
  childRef: string | null;
  childGens: Gen[];
  parent: Gen; // the parent, carrying its NEW parts
  parentOldParts: ILinkNode[];
}): { parts: ILinkNode[]; ref: string | null } {
  const { childParts, childRef, childGens, parent, parentOldParts } = params;

  // 1. Specific pass: drop parts the parent removed, but only where the child
  //    tracked them through this parent.
  const parentNewIds = new Set(parent.parts.map((p) => p.id));
  const removedByParent = parentOldParts.filter((p) => !parentNewIds.has(p.id));
  let list = childParts.filter((cp) => {
    const removed = removedByParent.find((r) => r.id === cp.id);
    if (!removed) return true;
    return cp.inheritedFrom !== childSourceOf(removed, parent.id);
  });

  // 2. Overall pass: order + additions only flow to an attached child.
  const attached = childRef !== null && childRef === overallRefThroughGen(parent);
  if (attached) list = mergeAgainstParentOrder(list, parent.parts);

  // 3. Re-derive sources (honors the child's switches) + the child's ref.
  return derivePartsAndRef(list, childGens);
}

