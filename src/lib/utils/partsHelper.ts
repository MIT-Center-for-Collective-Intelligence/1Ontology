import { ILinkNode, INode } from "@components/types/INode";
import {
  PartsGraph,
  resolveParts,
  toPartsNode,
} from "@components/lib/server/partsModel";
import { getTitle } from "./string.utils";

// One resolver per nodes-cache object, so per-part calls in a render share
// it. Converts only each queried node's ref chain — never the whole cache.
const partsResolvers = new WeakMap<object, (id: string) => ILinkNode[]>();
const resolvedPartsOf = (
  nodeId: string,
  nodes: { [id: string]: INode },
): ILinkNode[] => {
  let resolver = partsResolvers.get(nodes);
  if (!resolver) {
    const graph: PartsGraph = new Map();
    const memo = new Map<string, ILinkNode[]>();
    resolver = (id: string) => {
      if (!memo.has(id)) {
        let cursor: string | null = id;
        const seen = new Set<string>();
        while (cursor && !seen.has(cursor)) {
          seen.add(cursor);
          if (!graph.has(cursor) && nodes[cursor]?.id) {
            graph.set(cursor, toPartsNode(nodes[cursor]));
          }
          cursor = graph.get(cursor)?.partsInheritance.source ?? null;
        }
        memo.set(id, resolveParts(id, graph));
      }
      return memo.get(id)!;
    };
    partsResolvers.set(nodes, resolver);
  }
  return resolver(nodeId);
};

/**
 * Get all parts from a generalization — its RESOLVED view (ref chain).
 */
export const getGeneralizationParts = (
  generalizationId: string,
  nodes: { [nodeId: string]: INode },
): { id: string; title: string; isInherited: boolean; optional: boolean }[] => {
  if (!nodes[generalizationId]) return [];

  return resolvedPartsOf(generalizationId, nodes)
    .filter((part) => nodes[part.id])
    .map((part) => ({
      id: part.id,
      title: getTitle(nodes, part.id),
      isInherited: !!part.inheritedFrom,
      optional: !!part.optional,
    }));
};

/**
 * Which generalizations provide a given part — i.e. have `partId` in their own
 * parts list. Supplies the options for the specific-inheritance picker; the
 * CURRENT selection is read from the part's persisted `inheritedFrom`.
 */
export const getPartGeneralizationSources = (
  partId: string,
  generalizations: { id: string; title: string }[],
  nodes: { [id: string]: INode },
): { generalizationId: string; generalizationTitle: string }[] => {
  if (!partId || !Array.isArray(generalizations)) return [];
  const sources: { generalizationId: string; generalizationTitle: string }[] =
    [];
  for (const gen of generalizations) {
    const genNode = nodes[gen.id];
    const genParts = genNode ? resolvedPartsOf(gen.id, nodes) : [];
    if (genParts.some((p) => p.id === partId)) {
      sources.push({
        generalizationId: gen.id,
        generalizationTitle: gen.title || genNode?.title || "",
      });
    }
  }
  return sources;
};

/**
 * Get all generalizations for a node
 */
export const getAllGeneralizations = (
  currentVisibleNode: INode,
  nodes: { [nodeId: string]: INode },
): { id: string; title: string }[] => {
  if (!currentVisibleNode?.generalizations) return [];

  return currentVisibleNode.generalizations.flatMap((collection: any) =>
    collection.nodes.map((node: any) => ({
      id: node.id,
      title: node.title || getTitle(nodes, node.id) || "Unknown",
    })),
  );
};
