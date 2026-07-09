import { ILinkNode } from "@components/types/INode";

/**
 * Pure model for parts inheritance (no Firestore) — unit-testable in isolation.
 *
 * Each part in `properties.parts` carries `inheritedFrom` = the id of the node
 * that OWNS it (empty ⇒ this node owns it). That per-part field drives the
 * specific source, owner-only isPartOf, and pass-through skipping.
 *
 * OVERALL inheritance is separate: the node STORES the generalization it draws
 * its arrangement from (`partsOverallSource`). It is never searched for and
 * never auto-reattaches — see {@link derivePartsAndRef}.
 */

export type Gen = { id: string; ref: string | null; parts: ILinkNode[] };

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

/** Do `sub`'s ids appear in `full`, in order (gaps allowed)? */
export function isSubsequence(sub: string[], full: string[]): boolean {
  let i = 0;
  for (const id of full) {
    if (i < sub.length && sub[i] === id) i += 1;
  }
  return i === sub.length;
}

/**
 * Is the node still overall-attached to `gen`? Its parts must appear in the
 * node's list in the gen's own relative order; parts the gen does not have are
 * skipped, so an own part inserted anywhere is harmless while reordering an
 * inherited part is a break. A gen with no parts matches trivially.
 */
export function matchesSource(nodeParts: ILinkNode[], gen: Gen): boolean {
  return isSubsequence(
    gen.parts.map((p) => p.id),
    nodeParts.map((p) => p.id),
  );
}

/**
 * Overall `ref` for a node that draws its arrangement from generalization `gen`.
 * Skip `gen` only when it's a PURE pass-through — it has a clean overall ref of
 * its own AND owns none of its parts; otherwise the node attaches directly to
 * `gen` (a real owner, or a broken/mixed node).
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
 * Re-derive a node's parts, its overall source and its `ref` from an EDITED list
 * (the user's own order preserved).
 *
 * Parts: a part the node already OWNED stays owned even if a generalization now
 * lists it; otherwise a part a generalization provides is tagged with its owner,
 * honoring an existing source choice when a provider still resolves to it, else
 * the first declared provider.
 *
 * Overall source: the STORED `sourceId` is kept iff it is still a generalization
 * and still {@link matchesSource}; otherwise it goes null and STAYS null. Nothing
 * here ever searches the generalizations for a match — a broken node only
 * reattaches when the user says so (see {@link resetOntoSource}).
 */
export function derivePartsAndRef(
  nodeParts: ILinkNode[],
  gens: Gen[],
  ctx: { oldParts?: ILinkNode[]; sourceId?: string | null } = {},
): { parts: ILinkNode[]; sourceId: string | null; ref: string | null } {
  // The owner a part would have if tracked through gen `g` (skips a pass-through).
  const ownerThroughGen = (g: Gen, partId: string): string | null => {
    const gp = g.parts.find((x) => x.id === partId);
    return gp ? childSourceOf(gp, g.id) : null;
  };
  const ownedBefore = new Set(
    (ctx.oldParts ?? []).filter(isOwnedPart).map((p) => p.id),
  );
  const parts = nodeParts.map((p) => {
    const providers = gens.filter((g) => g.parts.some((gp) => gp.id === p.id));
    const node: ILinkNode = { id: p.id };
    if (p.title !== undefined) node.title = p.title;
    if (p.optional) node.optional = true;
    if (providers.length > 0 && !ownedBefore.has(p.id)) {
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

  const stored = ctx.sourceId ?? null;
  const gen = stored ? gens.find((g) => g.id === stored) : undefined;
  const attached = !!gen && matchesSource(parts, gen);
  return {
    parts,
    sourceId: attached ? gen!.id : null,
    ref: attached ? overallRefThroughGen(gen!) : null,
  };
}

const FRONT = "__front__";

/**
 * Merge the parent's parts into the child's list: emit the parent's parts in the
 * PARENT's order, keeping the child's other parts (own, or sourced from another
 * generalization) anchored to the part that preceded them. Existing child entries
 * are reused as-is, so their `optional` and `inheritedFrom` survive; a part the
 * child gains is added bare. An anchor the parent removed falls back to the
 * nearest surviving earlier parent part, else to the front.
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
 * Reattach a node to generalization `source`: a HARD RESET of everything the node
 * does not OWN. Parts sourced from any other generalization are discarded, and
 * every adopted part is re-pointed at the source — discarding per-part switches.
 * The source's parts lead, in the source's order; the node's own parts follow, in
 * their current relative order. Also serves an overall-source SWITCH on a node
 * that isn't broken, so it is destructive by design.
 */
export function resetOntoSource(
  nodeParts: ILinkNode[],
  source: Gen,
): ILinkNode[] {
  const byId = new Map(nodeParts.map((p) => [p.id, p]));
  const ownedIds = new Set(nodeParts.filter(isOwnedPart).map((p) => p.id));

  const adopted = source.parts.map((sp) => {
    const existing = byId.get(sp.id);
    // A part the node owns stays owned, even where the source also provides it.
    if (existing && ownedIds.has(sp.id)) return existing;
    const node: ILinkNode = { id: sp.id, inheritedFrom: childSourceOf(sp, source.id) };
    const title = existing?.title ?? sp.title;
    if (title !== undefined) node.title = title;
    if (existing ? existing.optional : sp.optional) node.optional = true;
    return node;
  });
  const adoptedIds = new Set(source.parts.map((p) => p.id));
  const own = nodeParts.filter((p) => ownedIds.has(p.id) && !adoptedIds.has(p.id));
  return [...adopted, ...own];
}

/**
 * Propagate a parent's parts change into one descendant, as TWO layers:
 *
 * 1. SPECIFIC — a part removed from the parent is dropped from the child only if
 *    the child tracks that part THROUGH this parent. A part the child sources
 *    from another generalization survives. This runs even when the child is not
 *    overall-attached, so removals keep cascading after an overall break.
 * 2. OVERALL — only when the parent IS the child's stored overall source: adopt
 *    the parent's order and gain its new parts.
 *
 * Then {@link derivePartsAndRef} re-derives each part's source (honoring the
 * child's stored choices) and re-checks the child's attachment, which the
 * specific pass may have just broken.
 */
export function cascadeIntoDescendant(params: {
  childParts: ILinkNode[];
  childSourceId: string | null;
  childGens: Gen[];
  parent: Gen; // the parent, carrying its NEW parts
  parentOldParts: ILinkNode[];
}): { parts: ILinkNode[]; sourceId: string | null; ref: string | null } {
  const { childParts, childSourceId, childGens, parent, parentOldParts } = params;

  // 1. Specific pass: drop parts the parent removed, but only where the child
  //    tracked them through this parent.
  const parentNewIds = new Set(parent.parts.map((p) => p.id));
  const removedByParent = parentOldParts.filter((p) => !parentNewIds.has(p.id));
  let list = childParts.filter((cp) => {
    const removed = removedByParent.find((r) => r.id === cp.id);
    if (!removed) return true;
    return cp.inheritedFrom !== childSourceOf(removed, parent.id);
  });

  // 2. Overall pass: order + additions only flow from the child's own source.
  if (childSourceId === parent.id) {
    list = mergeAgainstParentOrder(list, parent.parts);
  }

  // 3. Re-derive sources (honors the child's switches) + re-check attachment.
  return derivePartsAndRef(list, childGens, {
    oldParts: childParts,
    sourceId: childSourceId,
  });
}
