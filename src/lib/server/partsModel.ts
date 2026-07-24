import { ILinkNode, IPartsInheritance } from "@components/types/INode";

/**
 * Pure model for REF-BASED parts inheritance (no persistence, unit-testable).
 *
 * An ATTACHED node stores no inherited parts: `partsInheritance.source` names
 * the direct generalization it follows (null = broken/root) and viewing
 * resolves the ref chain. `parts` holds only real local entries — own parts
 * (no `inheritedFrom`), other-gen parts (`inheritedFrom` = owner) and switched
 * parts — spliced into the virtual list by their `after` anchor; an entry whose
 * id the source also provides replaces that slot (sticky ownership).
 * `overrides` holds optional-toggles on virtual parts only.
 *
 * A BROKEN node (`source: null`) stores the full materialized list: array order
 * authoritative, no anchors, overrides folded into the entries.
 */

export type PartsInheritance = IPartsInheritance;

/**
 * A stored `properties.parts` entry. `after` = the resolved part id it sits
 * behind (null = front; absent = end). Meaningful only while attached; among
 * same-anchor entries the array order decides.
 */
export type PartEntry = ILinkNode;

export type PartsNode = {
  id: string;
  parts: PartEntry[];
  partsInheritance: PartsInheritance;
};

export type PartsGraph = Map<string, PartsNode>;

/**
 * Adapt a node doc to the model's shape: stored parts flattened across
 * collections, missing `partsInheritance` read as broken (post-conversion
 * every node has the field; the default just keeps this total).
 */
export function toPartsNode(node: {
  id: string;
  properties?: { parts?: { nodes: ILinkNode[] }[] };
  partsInheritance?: IPartsInheritance;
}): PartsNode {
  return {
    id: node.id,
    parts: (node.properties?.parts ?? []).flatMap((c) => c?.nodes ?? []),
    partsInheritance: node.partsInheritance ?? { source: null, overrides: {} },
  };
}

/** A part is OWNED by its node if there is no `inheritedFrom`. */
export function isOwnedPart(part: ILinkNode): boolean {
  return !part.inheritedFrom;
}

/**
 * The owner a CHILD records for a part it inherits from parent `parentId`:
 * the parent if the parent owns it, else whoever the parent inherited it from.
 * This is what skips a pass-through parent — per part.
 */
export function childSourceOf(parentPart: ILinkNode, parentId: string): string {
  return parentPart.inheritedFrom ?? parentId;
}

function toResolved(e: PartEntry): ILinkNode {
  const p: ILinkNode = { id: e.id };
  if (e.title !== undefined) p.title = e.title;
  if (e.optional) p.optional = true;
  if (e.inheritedFrom) p.inheritedFrom = e.inheritedFrom;
  return p;
}

function liftFromSource(
  p: ILinkNode,
  sourceId: string,
  override?: { optional: boolean },
): ILinkNode {
  const v: ILinkNode = { id: p.id, inheritedFrom: childSourceOf(p, sourceId) };
  if (p.title !== undefined) v.title = p.title;
  if (override ? override.optional : p.optional) v.optional = true;
  return v;
}

/**
 * The node's parts as viewed: the source chain resolved recursively (cycle
 * guarded), local entries spliced in by anchor, sticky-ownership slot
 * replacement applied, overrides applied to the virtual parts. A broken node —
 * or one whose source is missing or cyclic — resolves to its stored entries in
 * array order. Each resolved part carries `inheritedFrom` = its owner.
 */
export function resolveParts(nodeId: string, graph: PartsGraph): ILinkNode[] {
  return resolveInner(nodeId, graph, new Set());
}

function resolveInner(
  nodeId: string,
  graph: PartsGraph,
  visiting: Set<string>,
): ILinkNode[] {
  const node = graph.get(nodeId);
  if (!node) return [];
  const { source, overrides } = node.partsInheritance;
  const src = source && !visiting.has(source) ? graph.get(source) : undefined;
  if (!source || !src) return node.parts.map(toResolved);

  visiting.add(nodeId);
  const inherited = resolveInner(source, graph, visiting);

  const entryById = new Map(node.parts.map((e) => [e.id, e]));
  const slots = inherited.map((p) => {
    const e = entryById.get(p.id);
    return e ? toResolved(e) : liftFromSource(p, source, overrides[p.id]);
  });
  const slotIds = new Set(inherited.map((p) => p.id));
  const floats = node.parts.filter((e) => !slotIds.has(e.id));

  const behind = new Map<string, PartEntry[]>();
  const front: PartEntry[] = [];
  for (const f of floats) {
    if (f.after === null) front.push(f);
    else if (f.after !== undefined) {
      if (!behind.has(f.after)) behind.set(f.after, []);
      behind.get(f.after)!.push(f);
    }
  }

  const out: ILinkNode[] = [];
  const emitted = new Set<string>();
  const emit = (p: ILinkNode) => {
    out.push(p);
    emitted.add(p.id);
    for (const f of behind.get(p.id) ?? []) emit(toResolved(f));
  };
  for (const f of front) emit(toResolved(f));
  for (const s of slots) emit(s);
  // Anchor-less entries — and any whose anchor disappeared — land at the end.
  for (const f of floats) if (!emitted.has(f.id)) emit(toResolved(f));
  return out;
}

/**
 * Break = copy-on-write: the resolved view becomes the stored list (origins
 * kept, no anchors, overrides folded into the entries), source goes null.
 */
export function materializeBreak(
  nodeId: string,
  graph: PartsGraph,
): { parts: PartEntry[]; partsInheritance: PartsInheritance } {
  return {
    parts: resolveParts(nodeId, graph),
    partsInheritance: { source: null, overrides: {} },
  };
}

/**
 * Classify a reorder of the resolved view. Moving only local entries never
 * breaks: the floats are re-anchored to their nearest preceding source part
 * and attachment stands. Changing the source parts' relative order — sticky
 * slot-replacers included — breaks: the result is the materialized list in the
 * requested order. A broken node just stores the new array order.
 */
export function classifySort(
  nodeId: string,
  graph: PartsGraph,
  orderedIds: string[],
):
  | { breaks: false; parts: PartEntry[] }
  | { breaks: true; parts: PartEntry[]; partsInheritance: PartsInheritance } {
  const node = graph.get(nodeId);
  if (!node) return { breaks: false, parts: [] };
  const { source } = node.partsInheritance;
  const src = source ? graph.get(source) : undefined;
  const entryById = new Map(node.parts.map((e) => [e.id, e]));
  const mentioned = new Set(orderedIds);

  if (!source || !src) {
    const parts: PartEntry[] = [];
    for (const id of orderedIds) {
      const e = entryById.get(id);
      if (e) parts.push({ ...e });
    }
    for (const e of node.parts) if (!mentioned.has(e.id)) parts.push({ ...e });
    return { breaks: false, parts };
  }

  const arrangement = resolveParts(source, graph).map((p) => p.id);
  const slotIds = new Set(arrangement);
  const orderedSlots = orderedIds.filter((id) => slotIds.has(id));
  const preserved =
    orderedSlots.length === arrangement.length &&
    orderedSlots.every((id, i) => id === arrangement[i]);

  if (!preserved) {
    const resolved = resolveParts(nodeId, graph);
    const byId = new Map(resolved.map((p) => [p.id, p]));
    const parts: PartEntry[] = [];
    for (const id of orderedIds) {
      const p = byId.get(id);
      if (p) parts.push(p);
    }
    for (const p of resolved) if (!mentioned.has(p.id)) parts.push(p);
    return {
      breaks: true,
      parts,
      partsInheritance: { source: null, overrides: {} },
    };
  }

  const parts: PartEntry[] = [];
  let lastSlot: string | null = null;
  for (const id of orderedIds) {
    if (slotIds.has(id)) {
      lastSlot = id;
      const e = entryById.get(id);
      if (e) parts.push(withoutAnchor(e));
      continue;
    }
    const e = entryById.get(id);
    if (e) parts.push({ ...withoutAnchor(e), after: lastSlot });
  }
  for (const e of node.parts) if (!mentioned.has(e.id)) parts.push({ ...e });
  return { breaks: false, parts };
}

function withoutAnchor(e: PartEntry): PartEntry {
  const { after, ...rest } = e;
  return rest;
}

/**
 * Remove parts from the resolved view. Removing a part the source chain
 * provides — virtual, sticky-owned or switched alike — BREAKS: the view
 * materializes without those parts. Removing only floating local entries just
 * drops them, re-pointing anchors that hung off a dropped entry. `removed` =
 * the resolved entries that matched (their `inheritedFrom` is the owner a
 * descendant's recorder tracks).
 */
export function applyRemove(
  nodeId: string,
  graph: PartsGraph,
  removeIds: string[],
): {
  parts: PartEntry[];
  partsInheritance: PartsInheritance;
  removed: ILinkNode[];
} {
  const node = graph.get(nodeId);
  if (!node) {
    return {
      parts: [],
      partsInheritance: { source: null, overrides: {} },
      removed: [],
    };
  }
  const resolved = resolveParts(nodeId, graph);
  const toRemove = new Set(removeIds);
  const removed = resolved.filter((p) => toRemove.has(p.id));
  const removedIds = new Set(removed.map((p) => p.id));
  if (removed.length === 0) {
    return {
      parts: node.parts,
      partsInheritance: node.partsInheritance,
      removed,
    };
  }

  const { source } = node.partsInheritance;
  const sourceProvides =
    source && graph.has(source)
      ? new Set(resolveParts(source, graph).map((p) => p.id))
      : new Set<string>();

  if ([...removedIds].some((id) => sourceProvides.has(id))) {
    const broken = materializeBreak(nodeId, graph);
    return {
      parts: broken.parts.filter((p) => !removedIds.has(p.id)),
      partsInheritance: broken.partsInheritance,
      removed,
    };
  }

  const entryById = new Map(node.parts.map((e) => [e.id, e]));
  const anchorPast = (
    a: string | null | undefined,
  ): string | null | undefined => {
    let cursor = a;
    while (cursor != null && removedIds.has(cursor)) {
      cursor = entryById.get(cursor)?.after;
    }
    return cursor;
  };
  const parts = node.parts
    .filter((e) => !removedIds.has(e.id))
    .map((e) => {
      if (e.after == null || !removedIds.has(e.after)) return e;
      const next = anchorPast(e.after);
      const copy = { ...e };
      if (next === undefined) delete copy.after;
      else copy.after = next;
      return copy;
    });
  return { parts, partsInheritance: node.partsInheritance, removed };
}

/**
 * Replace one resolved part with another node in place, keeping position and
 * the optional flag; the replacement comes out OWNED. Replacing a part the
 * source chain provides — virtual, sticky or switched — BREAKS (materialize +
 * swap); replacing a floating local entry edits it in place, keeping its
 * anchor. `replaced` = the resolved entry that went away (null = no-op:
 * fromId absent or to.id already in the view).
 */
export function applyReplace(
  nodeId: string,
  graph: PartsGraph,
  fromId: string,
  to: { id: string; title: string },
): {
  parts: PartEntry[];
  partsInheritance: PartsInheritance;
  replaced: ILinkNode | null;
} {
  const node = graph.get(nodeId);
  if (!node) {
    return {
      parts: [],
      partsInheritance: { source: null, overrides: {} },
      replaced: null,
    };
  }
  const resolved = resolveParts(nodeId, graph);
  const replaced = resolved.find((p) => p.id === fromId) ?? null;
  if (!replaced || resolved.some((p) => p.id === to.id)) {
    return {
      parts: node.parts,
      partsInheritance: node.partsInheritance,
      replaced: null,
    };
  }
  const swapped: PartEntry = { id: to.id, title: to.title };
  if (replaced.optional) swapped.optional = true;

  const { source } = node.partsInheritance;
  const sourceProvides =
    source && graph.has(source)
      ? new Set(resolveParts(source, graph).map((p) => p.id))
      : new Set<string>();

  if (sourceProvides.has(fromId)) {
    const broken = materializeBreak(nodeId, graph);
    return {
      parts: broken.parts.map((p) => (p.id === fromId ? swapped : p)),
      partsInheritance: broken.partsInheritance,
      replaced,
    };
  }

  const parts = node.parts.map((e) =>
    e.id === fromId
      ? { ...(e.after !== undefined ? { after: e.after } : {}), ...swapped }
      : e,
  );
  return { parts, partsInheritance: node.partsInheritance, replaced };
}

/**
 * Reattach (or switch the overall source): a HARD RESET of everything the node
 * does not OWN. Only owned entries survive — one the source also provides
 * keeps its slot, the rest are anchored below the source's parts in their
 * current relative order. The node's optional flag on a kept virtual part is
 * preserved as an override; parts it never had take the source's flag.
 */
export function convertToOverlay(
  nodeId: string,
  graph: PartsGraph,
  sourceId: string,
): { parts: PartEntry[]; partsInheritance: PartsInheritance } {
  const node = graph.get(nodeId);
  if (!node) {
    return { parts: [], partsInheritance: { source: sourceId, overrides: {} } };
  }
  const current = resolveParts(nodeId, graph);
  const sourceResolved = resolveParts(sourceId, graph);
  const sourceIds = new Set(sourceResolved.map((p) => p.id));
  const lastSourceId = sourceResolved.length
    ? sourceResolved[sourceResolved.length - 1].id
    : null;

  const orderIndex = new Map(current.map((p, i) => [p.id, i]));
  const owned = node.parts
    .filter(isOwnedPart)
    .sort(
      (a, b) =>
        (orderIndex.get(a.id) ?? Infinity) - (orderIndex.get(b.id) ?? Infinity),
    );
  const ownedIds = new Set(owned.map((e) => e.id));
  const parts = owned.map((e) =>
    sourceIds.has(e.id)
      ? withoutAnchor(e)
      : { ...withoutAnchor(e), after: lastSourceId },
  );

  const overrides: PartsInheritance["overrides"] = {};
  const currentById = new Map(current.map((p) => [p.id, p]));
  for (const sp of sourceResolved) {
    if (ownedIds.has(sp.id)) continue;
    const cur = currentById.get(sp.id);
    if (!cur) continue;
    if (!!cur.optional !== !!sp.optional) {
      overrides[sp.id] = { optional: !!cur.optional };
    }
  }
  return { parts, partsInheritance: { source: sourceId, overrides } };
}

/**
 * Update a node when its generalizations change. Call with the graph still
 * containing the node's PRE-change state and every gen involved. Stored
 * entries tracked through a removed gen are dropped unless a remaining gen
 * still resolves (or re-provides) them. When the SOURCE itself is removed the
 * node re-attaches to the first remaining gen by MERGE: stored entries stay,
 * the old source's parts survive only where a remaining gen provides them
 * (minted as stored entries when it isn't the new source), the rest disappear
 * (5.4). No remaining gens — or an already-broken node — means broken stays.
 */
export function applyGenChange(
  nodeId: string,
  graph: PartsGraph,
  removedGenIds: string[],
  remainingGenIds: string[],
): { parts: PartEntry[]; partsInheritance: PartsInheritance } {
  const node = graph.get(nodeId);
  if (!node) {
    return { parts: [], partsInheritance: { source: null, overrides: {} } };
  }
  const before = resolveParts(nodeId, graph);
  const asGen = (id: string) => ({ id, parts: resolveParts(id, graph) });
  const removed = removedGenIds.map(asGen);
  const remaining = remainingGenIds.map(asGen);
  const ownerThrough = (
    g: { id: string; parts: ILinkNode[] },
    partId: string,
  ) => {
    const p = g.parts.find((x) => x.id === partId);
    return p ? childSourceOf(p, g.id) : null;
  };

  const kept: PartEntry[] = [];
  for (const e of node.parts) {
    if (isOwnedPart(e)) {
      kept.push({ ...e });
      continue;
    }
    const tracked = removed.some(
      (g) => ownerThrough(g, e.id) === e.inheritedFrom,
    );
    if (!tracked) {
      kept.push({ ...e });
      continue;
    }
    if (remaining.some((g) => ownerThrough(g, e.id) === e.inheritedFrom)) {
      kept.push({ ...e });
      continue;
    }
    const provider = remaining.find((g) => g.parts.some((p) => p.id === e.id));
    if (provider) {
      kept.push({
        ...e,
        inheritedFrom: ownerThrough(provider, e.id) as string,
      });
    }
  }

  const pi = node.partsInheritance;
  const sourceRemoved = !!pi.source && removedGenIds.includes(pi.source);
  if (!sourceRemoved) {
    return {
      parts: kept,
      partsInheritance: { source: pi.source, overrides: { ...pi.overrides } },
    };
  }

  const next = remaining[0];
  if (!next) {
    const idx = new Map(before.map((p, i) => [p.id, i]));
    const parts = kept
      .sort((a, b) => (idx.get(a.id) ?? Infinity) - (idx.get(b.id) ?? Infinity))
      .map(withoutAnchor);
    return { parts, partsInheritance: { source: null, overrides: {} } };
  }

  const storedIds = new Set(node.parts.map((e) => e.id));
  const nextIds = new Set(next.parts.map((p) => p.id));
  const parts = [...kept];
  for (const p of before) {
    if (storedIds.has(p.id) || nextIds.has(p.id)) continue;
    const provider = remaining.find((g) => g.parts.some((x) => x.id === p.id));
    if (!provider) continue;
    const minted: PartEntry = {
      id: p.id,
      inheritedFrom: ownerThrough(provider, p.id) as string,
    };
    if (p.title !== undefined) minted.title = p.title;
    if (p.optional) minted.optional = true;
    parts.push(minted);
  }
  const overrides: PartsInheritance["overrides"] = {};
  for (const [pid, o] of Object.entries(pi.overrides)) {
    if (nextIds.has(pid) && !parts.some((e) => e.id === pid)) {
      overrides[pid] = { ...o };
    }
  }
  return { parts, partsInheritance: { source: next.id, overrides } };
}

/*
 * Legacy materialize-model API below — still imported by the pre-rebuild
 * endpoints and seeding paths; each export dies with its caller in the
 * remaining rebuild slices. No new code should use it.
 */

export type Gen = { id: string; ref: string | null; parts: ILinkNode[] };

/** Does this parts list contain at least one own (non-inherited) part? */
export function ownsAnyPart(parts: ILinkNode[]): boolean {
  return parts.some(isOwnedPart);
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
