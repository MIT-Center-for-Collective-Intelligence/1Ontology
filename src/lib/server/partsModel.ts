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
 * Produce a child's copy of the parent's parts, each part's `inheritedFrom`
 * rewritten to its owner as seen from the child (via {@link childSourceOf}).
 * Preserves title + optional. This is the content a pure relay inherits.
 */
export function inheritFrom(
  parentParts: ILinkNode[],
  parentId: string,
): ILinkNode[] {
  return parentParts.map((p) => {
    const child: ILinkNode = {
      id: p.id,
      inheritedFrom: childSourceOf(p, parentId),
    };
    if (p.title !== undefined) child.title = p.title;
    if (p.optional) child.optional = true;
    return child;
  });
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
 * order preserved). Each part provided by a generalization is tagged with that
 * owner (first declared gen wins — the default specific source); a part no gen
 * provides is own. `ref` = the single gen the inherited parts come from (via
 * {@link overallRefThroughGen}); `null` when they span more than one gen (a
 * mixer/break) or the node owns everything.
 */
export function derivePartsAndRef(
  nodeParts: ILinkNode[],
  gens: { id: string; ref: string | null; parts: ILinkNode[] }[],
): { parts: ILinkNode[]; ref: string | null } {
  const sourceGenIds = new Set<string>();
  const parts = nodeParts.map((p) => {
    const providing = gens.find((g) => g.parts.some((gp) => gp.id === p.id));
    const node: ILinkNode = { id: p.id };
    if (p.title !== undefined) node.title = p.title;
    if (p.optional) node.optional = true;
    if (providing) {
      const genPart = providing.parts.find((gp) => gp.id === p.id)!;
      node.inheritedFrom = childSourceOf(genPart, providing.id);
      sourceGenIds.add(providing.id);
    }
    return node;
  });
  let ref: string | null = null;
  if (sourceGenIds.size === 1) {
    const g = gens.find((gen) => gen.id === [...sourceGenIds][0])!;
    ref = overallRefThroughGen(g);
  }
  return { parts, ref };
}

const FRONT = "__front__";

/**
 * Re-materialize a node's parts against a single source generalization `gen`:
 * emit `gen`'s parts in order (each tagged with its owner via {@link childSourceOf}),
 * keep the node's OWN parts (ids not in `gen`) anchored to the inherited part
 * that precedes them, and carry the node's own `optional` override on inherited
 * parts. Returns the new parts + the node's overall `ref`.
 */
export function materializeAgainstGen(
  currentParts: ILinkNode[],
  gen: { id: string; ref: string | null; parts: ILinkNode[] },
): { parts: ILinkNode[]; ref: string } {
  const genIds = new Set(gen.parts.map((p) => p.id));

  // Bucket the node's own parts under the inherited part that precedes them.
  const ownByAnchor = new Map<string, ILinkNode[]>();
  let anchor = FRONT;
  for (const p of currentParts) {
    if (genIds.has(p.id)) {
      anchor = p.id;
      continue;
    }
    const own: ILinkNode = { id: p.id };
    if (p.title !== undefined) own.title = p.title;
    if (p.optional) own.optional = true;
    if (!ownByAnchor.has(anchor)) ownByAnchor.set(anchor, []);
    ownByAnchor.get(anchor)!.push(own);
  }

  const result: ILinkNode[] = [];
  for (const p of ownByAnchor.get(FRONT) ?? []) result.push(p);
  for (const g of gen.parts) {
    const node: ILinkNode = { id: g.id, inheritedFrom: childSourceOf(g, gen.id) };
    if (g.title !== undefined) node.title = g.title;
    const override = currentParts.find((c) => c.id === g.id);
    const optional =
      override && typeof override.optional === "boolean"
        ? override.optional
        : !!g.optional;
    if (optional) node.optional = true;
    result.push(node);
    for (const p of ownByAnchor.get(g.id) ?? []) result.push(p);
  }
  return { parts: result, ref: overallRefThroughGen(gen) };
}
