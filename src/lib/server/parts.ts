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
import { cascadeIntoDescendant } from "./partsModel";

/**
 * Server-side (Firestore) helpers for parts inheritance, over the pure per-part
 * model in `./partsModel`. A part's `inheritedFrom` names the node that owns it;
 * `inheritance.parts.ref` names the generalization a node draws its arrangement
 * from, or null when the node owns its parts.
 */

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

export type GenForAttach = {
  id: string;
  parts: ILinkNode[];
  /** The generalization's own parts.ref (used to resolve part owners). */
  ref: string | null;
};

/** Reads a stored parts value, defaulting to an empty `main` collection. */
export function asPartsCollections(value: any): ICollection[] {
  if (Array.isArray(value) && value.length > 0) {
    return JSON.parse(JSON.stringify(value));
  }
  return [{ collectionName: "main", nodes: [] }];
}

/**
 * Validates incoming parts collections, keeping the `optional` and
 * `inheritedFrom` flags (the hierarchy sanitizer drops them). Drops self-links
 * and duplicates; null if malformed.
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
      if (typeof n.inheritedFrom === "string") node.inheritedFrom = n.inheritedFrom;
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
 * Owner-only isPartOf: `addedOwn` parts gain `nodeId` in their isPartOf list,
 * `removedOwn` lose it. Inheriting descendants never list a part they inherit,
 * so the cascade skips this.
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

/** The generalization a node draws its parts arrangement from (a stored choice). */
export function overallSourceOf(node: INode): string | null {
  return node.partsOverallSource ?? null;
}

/** Did a descendant's parts actually change (ids, order, source or optional)? */
function samePartsList(a: ILinkNode[], b: ILinkNode[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((x, i) => {
    const y = b[i];
    return (
      x.id === y.id &&
      (x.inheritedFrom ?? null) === (y.inheritedFrom ?? null) &&
      !!x.optional === !!y.optional
    );
  });
}

/**
 * Propagates a parts change down the subtree in TWO layers (see
 * {@link cascadeIntoDescendant}): a part removed from the parent is dropped only
 * from descendants that track it THROUGH this parent, while order and new parts
 * flow only to descendants still overall-attached. The walk therefore does NOT
 * shield unattached descendants — removals must keep reaching them after an
 * overall break — but it prunes wherever a descendant came out unchanged.
 */
export async function cascadeParts(params: {
  startId: string;
  startOldParts: ILinkNode[];
  startNewParts: ILinkNode[];
  cache: NodeCache;
}): Promise<void> {
  const { startId, startOldParts, startNewParts, cache } = params;

  const queue: { parentId: string; oldParts: ILinkNode[]; newParts: ILinkNode[] }[] =
    [{ parentId: startId, oldParts: startOldParts, newParts: startNewParts }];
  const visited = new Set<string>([startId]);
  let batch = db.batch();
  let pending = 0;

  while (queue.length > 0) {
    const { parentId, oldParts, newParts } = queue.shift()!;
    const parent = await getNode(parentId, cache);
    if (!parent) continue;
    const parentGen: GenForAttach = {
      id: parentId,
      ref: parent.inheritance?.parts?.ref ?? null,
      parts: newParts,
    };

    for (const childId of specializationIds(parent)) {
      if (visited.has(childId)) continue;
      visited.add(childId);
      const child = await getNode(childId, cache);
      if (!child || child.deleted) continue;

      const childParts = partsNodes(child.properties?.parts);
      const childSourceId = overallSourceOf(child);
      // The descendant's own generalizations, so its stored source choices are
      // honored and its attachment is re-checked against all of them.
      const childGens = await buildGensForAttach(child, cache);

      const {
        parts: childNew,
        sourceId: childNewSource,
        ref: childNewRef,
      } = cascadeIntoDescendant({
        childParts,
        childSourceId,
        childGens,
        parent: parentGen,
        parentOldParts: oldParts,
      });

      // Unchanged descendant → its own subtree can't be affected either.
      if (samePartsList(childParts, childNew) && childSourceId === childNewSource) {
        continue;
      }

      const ownerTitle = childNewRef
        ? (await getNode(childNewRef, cache))?.title ?? ""
        : "";
      const childPartsEntry = partsInheritanceEntry(
        childNewRef,
        ownerTitle,
        child.inheritance?.parts?.inheritanceType,
      );
      batch.update(db.collection(NODES).doc(childId), {
        "properties.parts": toParts(childNew),
        "inheritance.parts": childPartsEntry,
        partsOverallSource: childNewSource,
      });
      cache.set(childId, {
        ...child,
        properties: { ...child.properties, parts: toParts(childNew) },
        inheritance: { ...child.inheritance, parts: childPartsEntry },
        partsOverallSource: childNewSource,
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
