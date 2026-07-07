import {
  db,
  MAX_TRANSACTION_WRITES,
} from "@components/lib/firestoreServer/admin";
import { NODES } from "@components/lib/firestoreClient/collections";
import {
  ICollection,
  IInheritance,
  ILinkNode,
  INode,
  NodeChange,
} from "@components/types/INode";
import { NodeCache, getNode, specializationIds } from "./hierarchy";

/**
 * Pure engine for "overall" parts inheritance. `properties.parts` is the full
 * list; `inheritance.parts.ref` names the ultimate owner (null when the node
 * owns its parts). A node is attached to generalization G iff G's part ids are
 * an ordered subsequence of the node's — so adding own parts keeps attachment,
 * while reorder/remove/replace of an inherited part breaks it.
 */

/** Anchor sentinel: own parts that precede every inherited part sit at the front. */
export const FRONT = "__front__";

/** Parts live in a single "main" collection; read its node list. */
export function partsNodes(parts?: ICollection[] | null): ILinkNode[] {
  if (!Array.isArray(parts) || parts.length === 0) return [];
  return parts[0]?.nodes ?? [];
}

/** Wrap a flat node list back into the single "main" collection shape. */
export function toParts(nodes: ILinkNode[]): ICollection[] {
  return [{ collectionName: "main", nodes }];
}

/**
 * Builds a COMPLETE `inheritance.parts` entry (not dotted `.ref`/`.title`) so a
 * legacy node with no entry still gets a valid one. Preserves an existing
 * `inheritanceType`, else defaults. `ref` = ultimate owner id, or null if owned.
 */
export function partsInheritanceEntry(
  ref: string | null,
  title: string,
  existingType?: string,
): IInheritance[string] {
  return {
    ref,
    title,
    inheritanceType:
      (existingType as IInheritance[string]["inheritanceType"]) ??
      "inheritUnlessAlreadyOverRidden",
  };
}

/** Just the ids, in order. */
export function idsOf(nodes: ILinkNode[]): string[] {
  return nodes.map((n) => n.id);
}

/** Is every id of `sub` present in `full` in the same relative order? */
export function isSubsequence(sub: string[], full: string[]): boolean {
  if (sub.length === 0) return false; // an empty source means "nothing to inherit"
  let i = 0;
  for (const id of full) {
    if (id === sub[i]) {
      i += 1;
      if (i === sub.length) return true;
    }
  }
  return false;
}

/** The node's own (non-inherited) part ids: node ids minus the source's ids. */
export function ownPartIds(
  nodeParts: ILinkNode[],
  sourceParts: ILinkNode[],
): string[] {
  const inherited = new Set(sourceParts.map((n) => n.id));
  return nodeParts.map((n) => n.id).filter((id) => !inherited.has(id));
}

/**
 * Rebuilds a descendant's parts when its source changes: own parts stay anchored
 * to the inherited part before them (falling back to the nearest earlier
 * survivor, else front), and the source's add/remove/reorder is spliced into the
 * inherited slots. Inherited parts keep the node's own `optional` override, else
 * take the source's.
 */
export function anchoredSplice(
  nodeParts: ILinkNode[],
  oldSource: ILinkNode[],
  newSource: ILinkNode[],
): ILinkNode[] {
  const inheritedIds = new Set(oldSource.map((n) => n.id));
  const newSourceIds = new Set(newSource.map((n) => n.id));

  // Classify: track each own part's preceding inherited ids (for anchor fallback)
  // and remember any per-node optional override on inherited parts.
  const optionalOverride = new Map<string, boolean>();
  const own: { part: ILinkNode; preceding: string[] }[] = [];
  const preceding: string[] = [];
  for (const n of nodeParts) {
    if (inheritedIds.has(n.id)) {
      preceding.push(n.id);
      if (typeof n.optional === "boolean") optionalOverride.set(n.id, n.optional);
    } else {
      own.push({ part: n, preceding: [...preceding] });
    }
  }

  // Bucket own parts by their surviving anchor.
  const ownByAnchor = new Map<string, ILinkNode[]>();
  for (const { part, preceding: prec } of own) {
    let anchor = FRONT;
    for (let i = prec.length - 1; i >= 0; i--) {
      if (newSourceIds.has(prec[i])) {
        anchor = prec[i];
        break;
      }
    }
    if (!ownByAnchor.has(anchor)) ownByAnchor.set(anchor, []);
    ownByAnchor.get(anchor)!.push(part);
  }

  const result: ILinkNode[] = [];
  for (const p of ownByAnchor.get(FRONT) ?? []) result.push(p);
  for (const s of newSource) {
    const node: ILinkNode = { id: s.id, title: s.title ?? "" };
    const optional = optionalOverride.has(s.id)
      ? optionalOverride.get(s.id)!
      : !!s.optional;
    if (optional) node.optional = true;
    result.push(node);
    for (const p of ownByAnchor.get(s.id) ?? []) result.push(p);
  }
  return result;
}

export type GenForAttach = {
  id: string;
  parts: ILinkNode[];
  /** The generalization's own parts.ref (so we can resolve to the ultimate owner). */
  ref: string | null;
};

/**
 * Picks the generalization the node is attached to and the ultimate owner id.
 * Keeps the current owner if it still matches, else the first generalization
 * whose parts are an ordered subsequence of the node's. `ref: null` = owned.
 */
export function detectAttachment(
  nodeParts: ILinkNode[],
  generalizations: GenForAttach[],
  currentRef: string | null,
): { ref: string | null; sourceGenId: string | null } {
  const nodeIds = idsOf(nodeParts);
  const ownerOf = (g: GenForAttach) => g.ref ?? g.id;
  const matches = generalizations.filter((g) =>
    isSubsequence(idsOf(g.parts), nodeIds),
  );
  if (matches.length === 0) return { ref: null, sourceGenId: null };

  if (currentRef) {
    const keep = matches.find((g) => ownerOf(g) === currentRef);
    if (keep) return { ref: currentRef, sourceGenId: keep.id };
  }
  const first = matches[0];
  return { ref: ownerOf(first), sourceGenId: first.id };
}

/**
 * Refresh/backfill variant of {@link detectAttachment} that picks a source even
 * when the node's parts don't currently match, to bootstrap legacy nodes. Keeps
 * the current owner if a gen resolves to it, else the first gen with parts;
 * `ref: null` when no generalization has parts.
 */
export function chooseRefreshSource(
  gens: GenForAttach[],
  currentRef: string | null,
): { ref: string | null; sourceGenId: string | null } {
  const ownerOf = (g: GenForAttach) => g.ref ?? g.id;
  const withParts = gens.filter((g) => g.parts.length > 0);
  if (withParts.length === 0) return { ref: null, sourceGenId: null };
  if (currentRef) {
    const keep = withParts.find((g) => ownerOf(g) === currentRef);
    if (keep) return { ref: currentRef, sourceGenId: keep.id };
  }
  const first = withParts[0];
  return { ref: ownerOf(first), sourceGenId: first.id };
}

/** Reads a stored parts value, defaulting to an empty `main` collection. */
export function asPartsCollections(value: any): ICollection[] {
  if (Array.isArray(value) && value.length > 0) {
    return JSON.parse(JSON.stringify(value));
  }
  return [{ collectionName: "main", nodes: [] }];
}

/**
 * Validates incoming parts collections, keeping the `optional` flag (the
 * hierarchy sanitizer drops it). Drops self-links and duplicates; null if malformed.
 */
export function sanitizeParts(value: any, selfId: string): ICollection[] | null {
  if (!Array.isArray(value)) return null;
  const seen = new Set<string>();
  const out: ICollection[] = [];
  for (const c of value) {
    if (!c || typeof c.collectionName !== "string" || !Array.isArray(c.nodes)) {
      return null;
    }
    const nodes: ILinkNode[] = [];
    for (const n of c.nodes) {
      if (!n || typeof n.id !== "string") return null;
      if (n.id === selfId || seen.has(n.id)) continue;
      seen.add(n.id);
      const node: ILinkNode = {
        id: n.id,
        title: typeof n.title === "string" ? n.title : "",
      };
      if (n.optional === true) node.optional = true;
      nodes.push(node);
    }
    out.push({ collectionName: c.collectionName, nodes });
  }
  return out;
}

/** Builds the attachment candidates from a node's generalizations, in order. */
export async function buildGensForAttach(
  nodeData: INode,
  cache: NodeCache,
): Promise<GenForAttach[]> {
  const genIds = (nodeData.generalizations || []).flatMap((c) =>
    (c.nodes || []).map((n) => n.id),
  );
  const gens: GenForAttach[] = [];
  for (const id of genIds) {
    const g = await getNode(id, cache);
    if (!g || g.deleted) continue;
    gens.push({
      id,
      parts: partsNodes(g.properties?.parts),
      ref: g.inheritance?.parts?.ref ?? null,
    });
  }
  return gens;
}

/**
 * Owner-only isPartOf reciprocity: `addedOwn` parts gain `nodeId`, `removedOwn`
 * lose it. Inheriting descendants never touch a part's isPartOf, so the cascade
 * skips this.
 */
export async function applyIsPartOfOwnerOnly(
  nodeId: string,
  nodeTitle: string,
  addedOwn: string[],
  removedOwn: string[],
  cache: NodeCache,
  parentLog: NodeChange["triggeredBy"],
  uname: string | undefined,
  appName: string | undefined,
  childLogs: NodeChange[],
): Promise<void> {
  for (const id of addedOwn) {
    const linked = await getNode(id, cache);
    if (!linked || linked.deleted) continue;
    const before = asPartsCollections(linked.properties?.isPartOf);
    const after: ICollection[] = JSON.parse(JSON.stringify(before));
    let main = after.find((c) => c.collectionName === "main");
    if (!main) {
      main = { collectionName: "main", nodes: [] };
      after.unshift(main);
    }
    if (main.nodes.some((n) => n.id === nodeId)) continue;
    main.nodes.push({ id: nodeId, title: nodeTitle });
    await db
      .collection(NODES)
      .doc(id)
      .update({ "properties.isPartOf": after });
    cache.set(id, {
      ...linked,
      properties: { ...linked.properties, isPartOf: after },
    } as INode);
    if (uname) {
      childLogs.push({
        nodeId: id,
        modifiedBy: uname,
        modifiedProperty: "isPartOf",
        previousValue: before,
        newValue: after,
        modifiedAt: new Date(),
        changeType: "add element",
        fullNode: linked,
        triggeredBy: parentLog,
        ...(appName ? { appName } : {}),
      } as NodeChange);
    }
  }
  for (const id of removedOwn) {
    const linked = await getNode(id, cache);
    if (!linked) continue;
    const raw = linked.properties?.isPartOf;
    if (!Array.isArray(raw)) continue;
    const before: ICollection[] = JSON.parse(JSON.stringify(raw));
    const after: ICollection[] = JSON.parse(JSON.stringify(raw));
    for (const c of after) {
      c.nodes = (c.nodes || []).filter((n) => n.id !== nodeId);
    }
    await db
      .collection(NODES)
      .doc(id)
      .update({ "properties.isPartOf": after });
    cache.set(id, {
      ...linked,
      properties: { ...linked.properties, isPartOf: after },
    } as INode);
    if (uname) {
      childLogs.push({
        nodeId: id,
        modifiedBy: uname,
        modifiedProperty: "isPartOf",
        previousValue: before,
        newValue: after,
        modifiedAt: new Date(),
        changeType: "remove element",
        fullNode: linked,
        triggeredBy: parentLog,
        ...(appName ? { appName } : {}),
      } as NodeChange);
    }
  }
}

/**
 * Propagates a parts change down the attached subtree. A descendant counts as
 * attached "through" the edited chain when it points at the same owner and still
 * carries the source's old parts as a subsequence; those get re-spliced against
 * the new source and repointed to the new owner. Others are skipped, shielding
 * their subtree.
 */
export async function cascadeParts(params: {
  startId: string;
  startOldParts: ILinkNode[];
  startNewParts: ILinkNode[];
  oldOwner: string;
  newOwner: string;
  newOwnerTitle: string;
  cache: NodeCache;
}): Promise<void> {
  const {
    startId,
    startOldParts,
    startNewParts,
    oldOwner,
    newOwner,
    newOwnerTitle,
    cache,
  } = params;

  const queue: { parentId: string; oldParts: ILinkNode[]; newParts: ILinkNode[] }[] =
    [{ parentId: startId, oldParts: startOldParts, newParts: startNewParts }];
  const visited = new Set<string>([startId]);
  let batch = db.batch();
  let pending = 0;

  while (queue.length > 0) {
    const { parentId, oldParts, newParts } = queue.shift()!;
    const parent = await getNode(parentId, cache);
    if (!parent) continue;

    for (const childId of specializationIds(parent)) {
      if (visited.has(childId)) continue;
      visited.add(childId);
      const child = await getNode(childId, cache);
      if (!child || child.deleted) continue;

      const childRef = child.inheritance?.parts?.ref ?? null;
      const childParts = partsNodes(child.properties?.parts);
      const attachedThrough =
        childRef === oldOwner &&
        isSubsequence(idsOf(oldParts), idsOf(childParts));
      if (!attachedThrough) continue; // owns / attaches elsewhere → shields subtree

      const childNew = anchoredSplice(childParts, oldParts, newParts);
      const childPartsEntry = partsInheritanceEntry(
        newOwner,
        newOwnerTitle,
        child.inheritance?.parts?.inheritanceType,
      );
      batch.update(db.collection(NODES).doc(childId), {
        "properties.parts": toParts(childNew),
        "inheritance.parts": childPartsEntry,
      });
      cache.set(childId, {
        ...child,
        properties: { ...child.properties, parts: toParts(childNew) },
        inheritance: { ...child.inheritance, parts: childPartsEntry },
      } as INode);
      pending += 1;
      if (pending >= MAX_TRANSACTION_WRITES) {
        await batch.commit();
        batch = db.batch();
        pending = 0;
      }
      queue.push({ parentId: childId, oldParts: childParts, newParts: childNew });
    }
  }

  if (pending > 0) await batch.commit();
}
