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
 * Query index for stored entries' provenance: one "partId:ownerId" key per
 * non-owned entry, plus one "partId@genId" key when the entry follows a
 * picked gen (`via`). Every write of `properties.parts` MUST write this
 * alongside; a missing field means empty.
 */
export function partSourcesOf(parts: PartEntry[]): string[] {
  const keys: string[] = [];
  for (const e of parts) {
    if (!e.inheritedFrom) continue;
    keys.push(`${e.id}:${e.inheritedFrom}`);
    if (e.via) keys.push(`${e.id}@${e.via}`);
  }
  return keys;
}

/**
 * Re-point entries tracking `fromOwner`'s copy of `partId` to `toOwner`
 * (ownership moved). Exact matches only; owned entries never change.
 */
export function repointTracked(
  parts: PartEntry[],
  partId: string,
  fromOwner: string,
  toOwner: string,
): { parts: PartEntry[]; changed: boolean } {
  let changed = false;
  const next = parts.map((e) => {
    if (e.id !== partId || e.inheritedFrom !== fromOwner) return e;
    changed = true;
    return { ...e, inheritedFrom: toOwner };
  });
  return { parts: changed ? next : parts, changed };
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
 * The generalizations (in the given order) whose resolved view provides
 * `partId`, each with the owner a part inherited through that gen would record.
 */
export function providersOf(
  partId: string,
  resolvedOf: (id: string) => ILinkNode[],
  genIds: string[],
): { genId: string; owner: string }[] {
  const out: { genId: string; owner: string }[] = [];
  for (const genId of genIds) {
    const p = resolvedOf(genId).find((x) => x.id === partId);
    if (p) out.push({ genId, owner: childSourceOf(p, genId) });
  }
  return out;
}

function toResolved(e: PartEntry): ILinkNode {
  const p: ILinkNode = { id: e.id };
  if (e.title !== undefined) p.title = e.title;
  if (e.optional) p.optional = true;
  if (e.inheritedFrom) p.inheritedFrom = e.inheritedFrom;
  if (e.via) p.via = e.via;
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
 * Stamp each inherited entry with the gen it resolves through (`via`), so a
 * broken node's parts keep following their gens. Source-first order breaks
 * ties; an owner gen needs no via; existing picks are kept.
 */
function stampVia(
  parts: PartEntry[],
  graph: PartsGraph,
  genIds: string[],
): PartEntry[] {
  if (genIds.length === 0) return parts;
  const memo = new Map<string, ILinkNode[]>();
  const resolutionOf = (gid: string) => {
    if (!memo.has(gid)) memo.set(gid, resolveParts(gid, graph));
    return memo.get(gid)!;
  };
  return parts.map((e) => {
    if (!e.inheritedFrom || e.via) return e;
    const gen = genIds.find((gid) => {
      if (gid === e.inheritedFrom) return false;
      const p = resolutionOf(gid).find((x) => x.id === e.id);
      return !!p && childSourceOf(p, gid) === e.inheritedFrom;
    });
    return gen ? { ...e, via: gen } : e;
  });
}

/**
 * Break = copy-on-write: the resolved view becomes the stored list (origins
 * kept, no anchors, overrides folded in), source goes null. With `genIds`,
 * inherited parts get `via` stamps so they keep following their gens.
 */
export function materializeBreak(
  nodeId: string,
  graph: PartsGraph,
  genIds: string[] = [],
): { parts: PartEntry[]; partsInheritance: PartsInheritance } {
  const source = graph.get(nodeId)?.partsInheritance.source ?? null;
  const ordered = source
    ? [source, ...genIds.filter((g) => g !== source)]
    : genIds;
  return {
    parts: stampVia(resolveParts(nodeId, graph), graph, ordered),
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
  genIds: string[] = [],
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
    const resolved = stampVia(resolveParts(nodeId, graph), graph, [
      source,
      ...genIds.filter((g) => g !== source),
    ]);
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
  genIds: string[] = [],
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
    const broken = materializeBreak(nodeId, graph, genIds);
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
 * Set a part's optional flag as this node sees it. A stored entry — own,
 * other-gen, switched or sticky — flips its own flag; a VIRTUAL part records
 * an override in partsInheritance instead (never auto-cleaned: the node's
 * flag is authoritative once set). Never breaks attachment.
 */
export function applyToggleOptional(
  nodeId: string,
  graph: PartsGraph,
  partId: string,
  optional: boolean,
): {
  parts: PartEntry[];
  partsInheritance: PartsInheritance;
  changed: boolean;
} {
  const node = graph.get(nodeId);
  if (!node) {
    return {
      parts: [],
      partsInheritance: { source: null, overrides: {} },
      changed: false,
    };
  }
  if (node.parts.some((e) => e.id === partId)) {
    const parts = node.parts.map((e) => {
      if (e.id !== partId) return e;
      const copy = { ...e };
      if (optional) copy.optional = true;
      else delete copy.optional;
      return copy;
    });
    return { parts, partsInheritance: node.partsInheritance, changed: true };
  }
  if (!resolveParts(nodeId, graph).some((p) => p.id === partId)) {
    return {
      parts: node.parts,
      partsInheritance: node.partsInheritance,
      changed: false,
    };
  }
  return {
    parts: node.parts,
    partsInheritance: {
      source: node.partsInheritance.source,
      overrides: { ...node.partsInheritance.overrides, [partId]: { optional } },
    },
    changed: true,
  };
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
  genIds: string[] = [],
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
  // A replacement some generalization provides is INHERITED from the first
  // providing gen instead of owned — same rule as a plain add.
  const provider = providersOf(
    to.id,
    (id) => resolveParts(id, graph),
    genIds,
  )[0];
  if (provider) {
    swapped.inheritedFrom = provider.owner;
    if (provider.owner !== provider.genId) swapped.via = provider.genId;
  }

  const { source } = node.partsInheritance;
  const sourceProvides =
    source && graph.has(source)
      ? new Set(resolveParts(source, graph).map((p) => p.id))
      : new Set<string>();

  if (sourceProvides.has(fromId)) {
    const broken = materializeBreak(nodeId, graph, genIds);
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
 * Switch a part's specific inheritance to the owner resolved through `genId`
 * (`via` recorded when the gen is a relay). Switching a SOURCE-PROVIDED part
 * to another gen — even a same-owner relay — BREAKS overall inheritance:
 * materialize with via stamps, then repoint the entry. Floats/broken just repoint.
 */
export function applySwitchSource(
  nodeId: string,
  graph: PartsGraph,
  partId: string,
  genId: string,
  genIds: string[] = [],
): {
  parts: PartEntry[];
  partsInheritance: PartsInheritance;
  changed: boolean;
} {
  const node = graph.get(nodeId);
  if (!node) {
    return {
      parts: [],
      partsInheritance: { source: null, overrides: {} },
      changed: false,
    };
  }
  const genPart = resolveParts(genId, graph).find((p) => p.id === partId);
  const viewed = resolveParts(nodeId, graph).find((p) => p.id === partId);
  if (!genPart || !viewed || isOwnedPart(viewed)) {
    return {
      parts: node.parts,
      partsInheritance: node.partsInheritance,
      changed: false,
    };
  }
  const owner = childSourceOf(genPart, genId);
  const via = owner === genId ? undefined : genId;

  const existing = node.parts.find((e) => e.id === partId);
  if (
    existing &&
    existing.inheritedFrom === owner &&
    (existing.via ?? undefined) === via
  ) {
    return {
      parts: node.parts,
      partsInheritance: node.partsInheritance,
      changed: false,
    };
  }

  const { source } = node.partsInheritance;
  const sourceProvides =
    source && graph.has(source)
      ? resolveParts(source, graph).some((p) => p.id === partId)
      : false;

  // Picking another gen for a source-provided part diverges from the source's
  // arrangement: the node breaks and every part mirrors its specific gen.
  if (source && sourceProvides && genId !== source) {
    const broken = materializeBreak(nodeId, graph, genIds);
    const parts = broken.parts.map((e) => {
      if (e.id !== partId) return e;
      const copy = { ...e, inheritedFrom: owner };
      if (via) copy.via = via;
      else delete copy.via;
      return copy;
    });
    return { parts, partsInheritance: broken.partsInheritance, changed: true };
  }

  if (existing) {
    const parts = node.parts.map((e) => {
      if (e.id !== partId) return e;
      const copy = { ...e, inheritedFrom: owner };
      if (via) copy.via = via;
      else delete copy.via;
      return copy;
    });
    return { parts, partsInheritance: node.partsInheritance, changed: true };
  }

  // Virtual part + genId === source: the canonical pick — nothing to record.
  if (source && sourceProvides && genId === source) {
    return {
      parts: node.parts,
      partsInheritance: node.partsInheritance,
      changed: false,
    };
  }

  const minted: PartEntry = { id: partId, inheritedFrom: owner };
  if (via) minted.via = via;
  if (viewed.title !== undefined) minted.title = viewed.title;
  if (viewed.optional) minted.optional = true;
  const overrides = { ...node.partsInheritance.overrides };
  delete overrides[partId];
  return {
    parts: [...node.parts, minted],
    partsInheritance: { source: node.partsInheritance.source, overrides },
    changed: true,
  };
}

/**
 * Hard reset onto `sourceId`. Owned parts the source also provides are ABSORBED:
 * dropped here and returned in `absorbed` with the owner resolved through the source.
 * Other owned parts keep their order below the source's; optional diffs become overrides.
 */
export function convertToOverlay(
  nodeId: string,
  graph: PartsGraph,
  sourceId: string,
): {
  parts: PartEntry[];
  partsInheritance: PartsInheritance;
  absorbed: { partId: string; owner: string }[];
} {
  const node = graph.get(nodeId);
  if (!node) {
    return {
      parts: [],
      partsInheritance: { source: sourceId, overrides: {} },
      absorbed: [],
    };
  }
  const current = resolveParts(nodeId, graph);
  const sourceResolved = resolveParts(sourceId, graph);
  const sourceById = new Map(sourceResolved.map((p) => [p.id, p]));
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

  const absorbed: { partId: string; owner: string }[] = [];
  const parts: PartEntry[] = [];
  const overrides: PartsInheritance["overrides"] = {};
  for (const e of owned) {
    const sp = sourceById.get(e.id);
    if (sp) {
      // The source provides it — ownership lifts to the source's line.
      absorbed.push({ partId: e.id, owner: childSourceOf(sp, sourceId) });
      if (!!e.optional !== !!sp.optional) {
        overrides[e.id] = { optional: !!e.optional };
      }
      continue;
    }
    parts.push({ ...withoutAnchor(e), after: lastSourceId });
  }

  const currentById = new Map(current.map((p) => [p.id, p]));
  for (const sp of sourceResolved) {
    if (overrides[sp.id]) continue;
    const cur = currentById.get(sp.id);
    if (!cur || !isOwnedPart(cur)) {
      if (cur && !!cur.optional !== !!sp.optional) {
        overrides[sp.id] = { optional: !!cur.optional };
      }
    }
  }
  return { parts, partsInheritance: { source: sourceId, overrides }, absorbed };
}

/**
 * Update parts after a generalization change; the graph must hold the node's
 * pre-change state. Parts from a removed gen survive only if another gen still
 * provides them. If the source itself was removed, the node merge-attaches to
 * the first remaining gen, or stays broken.
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

  // A pick through a removed gen loses its path — fall back to owner-only.
  const keepEntry = (e: PartEntry): PartEntry => {
    const copy = { ...e };
    if (copy.via && removedGenIds.includes(copy.via)) delete copy.via;
    return copy;
  };

  const kept: PartEntry[] = [];
  for (const e of node.parts) {
    if (isOwnedPart(e)) {
      kept.push(keepEntry(e));
      continue;
    }
    const tracked = removed.some(
      (g) => ownerThrough(g, e.id) === e.inheritedFrom,
    );
    if (!tracked) {
      kept.push(keepEntry(e));
      continue;
    }
    if (remaining.some((g) => ownerThrough(g, e.id) === e.inheritedFrom)) {
      kept.push(keepEntry(e));
      continue;
    }
    const provider = remaining.find((g) => g.parts.some((p) => p.id === e.id));
    if (provider) {
      kept.push({
        ...keepEntry(e),
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

/**
 * `genId` removed/replaced parts in its own view; entries that FOLLOW it
 * (`via: genId`) mirror that: drop, or morph onto the replacement (which the
 * gen now owns, so `via` clears). Morph collisions drop; anchors re-point.
 */
export function applyViaFollowerChange(
  parts: PartEntry[],
  genId: string,
  changes: {
    fromId: string;
    to?: { id: string; title: string; owner?: string };
  }[],
): { parts: PartEntry[]; changed: boolean } {
  const presentIds = new Set(parts.map((e) => e.id));
  const droppedIds = new Set<string>();
  let changed = false;
  const next: PartEntry[] = [];
  for (const e of parts) {
    const change = changes.find((c) => c.fromId === e.id && e.via === genId);
    if (!change) {
      next.push(e);
      continue;
    }
    changed = true;
    if (change.to && !presentIds.has(change.to.id)) {
      // The gen owns its replacement unless it inherited it (`owner`); a
      // relayed replacement keeps the pick — the gen still provides it.
      const owner = change.to.owner ?? genId;
      const morphed = {
        ...e,
        id: change.to.id,
        title: change.to.title,
        inheritedFrom: owner,
      };
      if (owner === genId) delete morphed.via;
      next.push(morphed);
    } else {
      droppedIds.add(e.id);
    }
  }
  if (!changed) return { parts, changed };
  const byId = new Map(parts.map((e) => [e.id, e]));
  const rePointed = next.map((e) => {
    if (e.after == null || !droppedIds.has(e.after)) return e;
    let cursor: string | null | undefined = e.after;
    while (cursor != null && droppedIds.has(cursor)) {
      cursor = byId.get(cursor)?.after;
    }
    const copy = { ...e };
    if (cursor === undefined) delete copy.after;
    else copy.after = cursor;
    return copy;
  });
  return { parts: rePointed, changed };
}

/**
 * An ancestor (`owner`) now provides `partId`, so this node stops owning its
 * copy. If the source chain provides it, the entry is deleted (an optional
 * difference becomes an override); otherwise it's re-tagged as inherited.
 */
export function absorbOwnedPart(
  nodeId: string,
  graph: PartsGraph,
  partId: string,
  owner: string,
): {
  parts: PartEntry[];
  partsInheritance: PartsInheritance;
  changed: boolean;
} {
  const node = graph.get(nodeId);
  const entry = node?.parts.find((e) => e.id === partId && isOwnedPart(e));
  if (!node || !entry) {
    return {
      parts: node?.parts ?? [],
      partsInheritance: node?.partsInheritance ?? {
        source: null,
        overrides: {},
      },
      changed: false,
    };
  }
  const { source, overrides } = node.partsInheritance;
  const provided =
    source && graph.has(source)
      ? resolveParts(source, graph).find((p) => p.id === partId)
      : undefined;

  if (!provided) {
    const parts = node.parts.map((e) =>
      e.id === partId ? { ...e, inheritedFrom: owner } : e,
    );
    return { parts, partsInheritance: node.partsInheritance, changed: true };
  }

  const parts = node.parts.filter((e) => e.id !== partId);
  const nextOverrides = { ...overrides };
  delete nextOverrides[partId];
  if (!!entry.optional !== !!provided.optional) {
    nextOverrides[partId] = { optional: !!entry.optional };
  }
  return {
    parts,
    partsInheritance: { source, overrides: nextOverrides },
    changed: true,
  };
}

/**
 * Absorb every owned entry that a newly linked gen provides. `converted`
 * lists the absorbed parts so the caller can repeat this on descendants.
 */
export function absorbOwnedForGens(
  nodeId: string,
  graph: PartsGraph,
  genIds: string[],
): {
  parts: PartEntry[];
  partsInheritance: PartsInheritance;
  converted: { partId: string; owner: string }[];
} {
  const node = graph.get(nodeId);
  if (!node) {
    return {
      parts: [],
      partsInheritance: { source: null, overrides: {} },
      converted: [],
    };
  }
  let current = node;
  const converted: { partId: string; owner: string }[] = [];
  for (const genId of genIds) {
    for (const p of resolveParts(genId, graph)) {
      if (!current.parts.some((e) => e.id === p.id && isOwnedPart(e))) {
        continue;
      }
      const owner = childSourceOf(p, genId);
      const scratch: PartsGraph = new Map(graph);
      scratch.set(nodeId, current);
      const result = absorbOwnedPart(nodeId, scratch, p.id, owner);
      if (!result.changed) continue;
      current = {
        id: nodeId,
        parts: result.parts,
        partsInheritance: result.partsInheritance,
      };
      converted.push({ partId: p.id, owner });
    }
  }
  return {
    parts: current.parts,
    partsInheritance: current.partsInheritance,
    converted,
  };
}
