import { ILinkNode } from "@components/types/INode";

/**
 * Pure model for parts inheritance (no persistence) which is unit-testable.
 *
 * Each part in `properties.parts` carries `inheritedFrom` = the id of the node
 * that OWNS it (empty ⇒ this node owns it). That per-part field drives the
 * specific source, owner-only isPartOf, and pass-through skipping.
 *
 * OVERALL inheritance is separate: the node stores the generalization it draws
 * its arrangement from (`partsOverallSource`). It is never searched for and
 * never auto-reattaches — see {@link derivePartsAndRef}.
 */

export type Gen = { id: string; ref: string | null; parts: ILinkNode[] };

/** A part is OWNED by its node if there is no `inheritedFrom`. */
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
 * honoring an existing source choice when a provider still resolves to it. An
 * untagged part defaults through the STORED overall source when it provides the
 * part, else the first declared provider.
 *
 * Overall source: the STORED `sourceId` is kept if it is still a generalization
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
      // (a user switch); else default through the stored overall source (5.2),
      // else the first declared provider.
      const chosen = p.inheritedFrom
        ? providers.find((g) => ownerThroughGen(g, p.id) === p.inheritedFrom)
        : undefined;
      const source =
        chosen ??
        (ctx.sourceId
          ? providers.find((g) => g.id === ctx.sourceId)
          : undefined) ??
        providers[0];
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
 * Put the parent's parts first, in the parent's order. The child's extra parts
 * (its own, or inherited from another gen) go back under the same part they sat
 * under before — or the nearest earlier parent part if that one is gone, else the
 * top. Parts the child already has are reused (keeping optional/inheritedFrom); a
 * part new from the parent is added plain.
 */
export function mergeAgainstParentOrder(
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
 * Update a node's parts when its generalizations change. A part inherited through
 * a removed gen is dropped, unless another remaining gen still provides it. 
 * If the gen the node was attached to is the one removed, 
 * the node re-attaches to the first remaining gen with its  parts merged in;
 * this is the only time attachment happens on its own, and an already-broken node
 * stays broken. Adding a gen only re-derives, nothing else.
 */
export function partsAfterGenChange(params: {
  tagged: ILinkNode[];
  stored: string | null;
  removedGens: Gen[];
  remainingGens: Gen[];
}): { parts: ILinkNode[]; sourceId: string | null; ref: string | null } {
  const { tagged, stored, removedGens, remainingGens } = params;

  const providedByRemaining = (partId: string) =>
    remainingGens.some((g) => g.parts.some((p) => p.id === partId));
  let list = tagged.filter((p) => {
    if (isOwnedPart(p)) return true;
    const trackedThroughRemoved = removedGens.some((g) => {
      const gp = g.parts.find((x) => x.id === p.id);
      return gp ? childSourceOf(gp, g.id) === p.inheritedFrom : false;
    });
    return !trackedThroughRemoved || providedByRemaining(p.id);
  });

  let sourceId = stored;
  const sourceRemains = !!stored && remainingGens.some((g) => g.id === stored);
  if (stored && !sourceRemains) {
    const next = remainingGens[0];
    if (next) {
      list = mergeAgainstParentOrder(list, next.parts);
      sourceId = next.id;
    } else {
      sourceId = null;
    }
  }

  return derivePartsAndRef(list, remainingGens, {
    oldParts: tagged,
    sourceId,
  });
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
    const node: ILinkNode = {
      id: sp.id,
      inheritedFrom: childSourceOf(sp, source.id),
    };
    const title = existing?.title ?? sp.title;
    if (title !== undefined) node.title = title;
    if (existing ? existing.optional : sp.optional) node.optional = true;
    return node;
  });
  const adoptedIds = new Set(source.parts.map((p) => p.id));
  const own = nodeParts.filter(
    (p) => ownedIds.has(p.id) && !adoptedIds.has(p.id),
  );
  return [...adopted, ...own];
}
