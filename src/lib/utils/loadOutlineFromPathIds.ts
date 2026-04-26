import {
  collection,
  documentId,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { NODES } from "@components/lib/firestoreClient/collections";
import { INode, TreeData } from "@components/types/INode";

const DOC_ID_IN_LIMIT = 10;

/**
 * Batched node fetch by id (Firestore `in` limit per query).
 */
export async function batchGetNodesByIds(
  db: any,
  ids: string[],
  appName?: string,
): Promise<Record<string, INode>> {
  const out: Record<string, INode> = {};
  const unique = Array.from(new Set(ids.filter(Boolean)));
  for (let i = 0; i < unique.length; i += DOC_ID_IN_LIMIT) {
    const chunk = unique.slice(i, i + DOC_ID_IN_LIMIT);
    const q = query(
      collection(db, NODES),
      where(documentId(), "in", chunk),
      where("deleted", "==", false),
    );
    const snap = await getDocs(q);
    snap.forEach((d) => {
      const node = { id: d.id, ...d.data() } as INode;
      if (appName && node.appName !== appName) return;
      out[d.id] = node;
    });
  }
  return out;
}

export function nodeHasNonEmptySpecializations(n: INode): boolean {
  for (const c of n.specializations || []) {
    if ((c.nodes || []).length > 0) return true;
  }
  return false;
}

/**
 * When walking the path root→…→focused, true means this node's outline row need only
 * the path child; false means expanding should load full specializations.
 */
export function pathAllowsOnlyPathChild(
  n: INode,
  nextOnPath: string | null,
): boolean {
  if (nextOnPath === null) {
    return !nodeHasNonEmptySpecializations(n);
  }
  const allIds: string[] = [];
  for (const c of n.specializations || []) {
    for (const link of c.nodes || []) {
      allIds.push(link.id);
    }
  }
  if (allIds.length === 0) return false;
  if (allIds.length === 1) return allIds[0] === nextOnPath;
  return false;
}

function makeShallowChild(
  childId: string,
  pathBasedId: string,
  childNode: INode | undefined,
  collectionIndex: number,
  isMain: boolean,
): TreeData {
  if (!childNode) {
    return {
      id: `${pathBasedId}-${childId}`,
      nodeId: childId,
      name: "…",
      nodeType: "group",
      // Make this an internal node so the UI shows a chevron.
      children: [],
      hasUnresolvedChildren: true,
    };
  }
  const lazy = nodeHasNonEmptySpecializations(childNode);
  const row: TreeData = {
    id: `${pathBasedId}-${childId}`,
    nodeId: childId,
    name: childNode.title,
    nodeType: childNode.nodeType,
    ...(childNode.unclassified && { unclassified: true }),
    // If the node has children, keep an empty array so react-arborist treats
    // it as an internal node and renders the chevron.
    children: lazy ? [] : undefined,
    hasUnresolvedChildren: lazy,
    outlineSpineOnly: lazy,
    category: false,
  };
  (row as any).isMainItem = isMain;
  (row as any).originalCollectionIndex = collectionIndex;
  return row;
}

/**
 * One outline level: main and category collections, children are lazy (no grand-children in tree data).
 */
export function buildOneLevelFromSpecializations(
  node: INode,
  parentPathId: string,
  childById: Record<string, INode | undefined>,
  _visited: Set<string> = new Set(),
): TreeData[] {
  const childrenInOrder: TreeData[] = [];

  if (node.specializations) {
    for (let i = 0; i < node.specializations.length; i++) {
      const collection = node.specializations[i];
      const collectionRefs = (collection.nodes || []).length;

      if (collection.collectionName === "main") {
        for (const child of collection.nodes || []) {
          const childNode = childById[child.id];
          const built = makeShallowChild(
            child.id,
            parentPathId,
            childNode,
            i,
            true,
          );
          childrenInOrder.push(built);
        }
      } else {
        const collectionPathId = `${parentPathId}-${collection.collectionName}`;
        const collectionChildren: TreeData[] = [];
        for (const child of collection.nodes || []) {
          const childNode = childById[child.id];
          const built = makeShallowChild(
            child.id,
            collectionPathId,
            childNode,
            i,
            false,
          );
          collectionChildren.push(built);
        }
        const catRow: TreeData = {
          id: collectionPathId,
          nodeId: node.id,
          name: `[${collection.collectionName}]`,
          nodeType: node.nodeType,
          category: true,
          children: collectionChildren,
          ...(node.unclassified && { unclassified: true }),
          ...(collectionRefs > 0 && collectionChildren.length === 0
            ? { hasUnresolvedChildren: true }
            : {}),
        };
        (catRow as any).originalCollectionIndex = i;
        childrenInOrder.push(catRow);
      }
    }
  }

  return childrenInOrder;
}

/**
 * Ids of all specialization targets (all collections) for batch fetch.
 */
export function collectSpecializationChildIds(n: INode): string[] {
  const ids: string[] = [];
  for (const c of n.specializations || []) {
    for (const link of c.nodes || []) {
      ids.push(link.id);
    }
  }
  return ids;
}

function buildSpineSegment(
  pathIds: string[],
  startIndex: number,
  nodesById: Record<string, INode>,
): TreeData {
  const id = pathIds[startIndex];
  const pathBasedId = pathIds.slice(0, startIndex + 1).join("-");
  const n = nodesById[id];
  const isLast = startIndex === pathIds.length - 1;

  if (isLast) {
    if (!n) {
      return {
        id: pathBasedId,
        nodeId: id,
        name: "…",
        nodeType: "group",
        hasUnresolvedChildren: true,
      };
    }
    const leafLazy = nodeHasNonEmptySpecializations(n);
    return {
      id: pathBasedId,
      nodeId: id,
      name: n.title,
      nodeType: n.nodeType,
      ...(n.unclassified && { unclassified: true }),
      children: leafLazy ? [] : undefined,
      hasUnresolvedChildren: leafLazy,
      outlineLoadChildren: leafLazy,
    };
  }

  const nextId = pathIds[startIndex + 1];
  if (!n) {
    return {
      id: pathBasedId,
      nodeId: id,
      name: "…",
      nodeType: "group",
      children: [
        buildSpineSegment(pathIds, startIndex + 1, nodesById),
      ],
      hasUnresolvedChildren: true,
      outlineSpineOnly: true,
    };
  }
  const onlyPath = pathAllowsOnlyPathChild(n, nextId);
  const child = buildSpineSegment(pathIds, startIndex + 1, nodesById);
  const hasMore = !onlyPath;
  return {
    id: pathBasedId,
    nodeId: id,
    name: n.title,
    nodeType: n.nodeType,
    ...(n.unclassified && { unclassified: true }),
    children: [child],
    hasUnresolvedChildren: hasMore,
    outlineSpineOnly: hasMore,
  };
}

export function buildPathSpineTree(
  pathIds: string[],
  nodesById: Record<string, INode>,
  focusedId: string,
): TreeData[] {
  if (pathIds.length === 0) return [];
  const p =
    pathIds[pathIds.length - 1] === focusedId
      ? pathIds
      : [...pathIds, ...(pathIds.includes(focusedId) ? [] : [focusedId])];
  return [buildSpineSegment(p, 0, nodesById)];
}

function attachChildAlongPath(
  children: TreeData[],
  nextTreeId: string,
  nextNodeId: string,
  nextNode: TreeData,
): TreeData[] {
  return children.map((c) => {
    if (c.id === nextTreeId || c.nodeId === nextNodeId) {
      return nextNode;
    }
    if (c.children) {
      return {
        ...c,
        children: attachChildAlongPath(c.children, nextTreeId, nextNodeId, nextNode),
      };
    }
    return c;
  });
}

/**
 * Build the canonical path outline, but also show siblings at each path level.
 *
 * - For every node on the `pathIds`, we render its full one-level specializations (shallow).
 * - We recursively expand only the next node in the canonical path.
 * - This still does NOT load the whole ontology: only path nodes + their direct children.
 */
export function buildPathTreeWithSiblings(
  pathIds: string[],
  nodesById: Record<string, INode>,
  childById: Record<string, INode | undefined>,
  focusedId: string,
): TreeData[] {
  if (pathIds.length === 0) return [];
  const p =
    pathIds[pathIds.length - 1] === focusedId
      ? pathIds
      : [...pathIds, ...(pathIds.includes(focusedId) ? [] : [focusedId])];

  const build = (index: number): TreeData => {
    const nodeId = p[index];
    const node = nodesById[nodeId];
    const treeId = p.slice(0, index + 1).join("-");
    const isLast = index === p.length - 1;

    if (!node) {
      return {
        id: treeId,
        nodeId,
        name: "…",
        nodeType: "group",
        hasUnresolvedChildren: true,
        children: isLast ? undefined : [build(index + 1)],
      };
    }

    const hasKids = nodeHasNonEmptySpecializations(node);
    if (isLast) {
      return {
        id: treeId,
        nodeId,
        name: node.title,
        nodeType: node.nodeType,
        ...(node.unclassified && { unclassified: true }),
        children: hasKids ? [] : undefined,
        hasUnresolvedChildren: hasKids,
        outlineLoadChildren: hasKids,
      };
    }

    const nextNodeId = p[index + 1];
    const nextTreeId = p.slice(0, index + 2).join("-");

    // Show all siblings (one-level) at this depth.
    const oneLevel = buildOneLevelFromSpecializations(node, treeId, childById);

    // Recursively expand the canonical next node in the path.
    const nextTree = build(index + 1);

    return {
      id: treeId,
      nodeId,
      name: node.title,
      nodeType: node.nodeType,
      ...(node.unclassified && { unclassified: true }),
      children: attachChildAlongPath(oneLevel, nextTreeId, nextNodeId, nextTree),
      hasUnresolvedChildren: true,
      outlineSpineOnly: false,
    };
  };

  return [build(0)];
}

/**
 * Resolve `pathIds` on the node document, or walk `primaryParentId` and fetch until null.
 */
export async function resolvePathIds(
  node: INode,
  fetchNode: (id: string) => Promise<INode | null>,
): Promise<{ pathIds: string[]; usedPrimaryParentFallback: boolean }> {
  if (node.pathIds && node.pathIds.length > 0) {
    return { pathIds: node.pathIds, usedPrimaryParentFallback: false };
  }
  const chain: string[] = [node.id];
  let cur: INode | null = node;
  const seen = new Set<string>([node.id]);
  while (cur?.primaryParentId) {
    if (seen.has(cur.primaryParentId)) break;
    seen.add(cur.primaryParentId);
    const p = await fetchNode(cur.primaryParentId);
    if (!p) break;
    chain.push(p.id);
    cur = p;
  }
  chain.reverse();
  return { pathIds: chain, usedPrimaryParentFallback: true };
}

export function mergePreservedSubtrees(
  newChildren: TreeData[],
  oldChildren: TreeData[] | undefined,
): TreeData[] {
  if (!oldChildren?.length) return newChildren;
  const byNodeId = new Map(oldChildren.map((c) => [c.nodeId, c]));
  return newChildren.map((nc) => {
    const prev = byNodeId.get(nc.nodeId);
    if (prev) {
      return {
        ...nc,
        children: prev.children,
        outlineSpineOnly: prev.outlineSpineOnly,
        outlineLoadChildren: prev.outlineLoadChildren,
        hasUnresolvedChildren: prev.hasUnresolvedChildren ?? nc.hasUnresolvedChildren,
      } as TreeData;
    }
    return nc;
  });
}

/**
 * Map and replace a node by `TreeData.id`, preserving the rest of the tree.
 */
export function mapTreeAtId(
  tree: TreeData[],
  targetId: string,
  replace: (n: TreeData) => TreeData,
): TreeData[] {
  return tree.map((n) => {
    if (n.id === targetId) return replace(n);
    if (n.children)
      return { ...n, children: mapTreeAtId(n.children, targetId, replace) };
    return n;
  });
}

/**
 * Mark spine expanded: inject full one-level specializations, merge with prior subtree on same `nodeId`.
 */
export function replaceSpineWithOneLevel(
  tree: TreeData[],
  targetTreeId: string,
  parentNode: INode,
  childById: Record<string, INode | undefined>,
): TreeData[] {
  return mapTreeAtId(tree, targetTreeId, (node) => {
    if (node.nodeId !== parentNode.id) return node;
    const next = buildOneLevelFromSpecializations(
      parentNode,
      node.id,
      childById,
    );
    return {
      ...node,
      children: mergePreservedSubtrees(
        next,
        node.children,
      ) as any,
      outlineSpineOnly: false,
      hasUnresolvedChildren: next.length > 0,
    };
  });
}

/**
 * Load focused node children (or any lazy one-level) using full specialization list.
 */
export function replaceWithOneLevel(
  tree: TreeData[],
  targetTreeId: string,
  parentNode: INode,
  childById: Record<string, INode | undefined>,
): TreeData[] {
  return mapTreeAtId(tree, targetTreeId, (node) => {
    if (node.nodeId !== parentNode.id) return node;
    const next = buildOneLevelFromSpecializations(
      parentNode,
      node.id,
      childById,
    );
    return {
      ...node,
      children: next,
      outlineLoadChildren: false,
      outlineSpineOnly: false,
      hasUnresolvedChildren: next.length > 0,
    };
  });
}

export function collectAllTreeNodeIds(
  t: TreeData[],
  into: Set<string> = new Set(),
): Set<string> {
  for (const n of t) {
    into.add(n.id);
    if (n.children) collectAllTreeNodeIds(n.children, into);
  }
  return into;
}
