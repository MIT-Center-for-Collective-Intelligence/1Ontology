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

export type OrderInheritanceSummary = {
  /** Gen-part ids in the child's resolved order (inherited slots only). */
  childGenSequence: string[];
  /** First index in the gen-part sequence where order diverges. */
  breakIndex: number;
};

type OrderInheritanceDetail = {
  from: string;
  to: string;
  symbol: string;
};

export const ORDER_INHERITANCE_LINE_COLOR = "#2ecc71";

export const genPartIdFromDetail = (
  entry: OrderInheritanceDetail,
): string | undefined => {
  if (entry.symbol === "=" || entry.symbol === ">") return entry.from || undefined;
  return undefined;
};

/** Dotted separator between two list rows: green only when both rows are
 *  consecutive inherited slots still inside the unbroken order prefix. */
export const separatorInheritsOrder = (
  prevEntry: OrderInheritanceDetail | null | undefined,
  entry: OrderInheritanceDetail,
  summary: OrderInheritanceSummary,
): boolean => {
  if (!prevEntry) return false;
  const prevId = genPartIdFromDetail(prevEntry);
  const currId = genPartIdFromDetail(entry);
  if (!prevId || !currId) return false;
  const { childGenSequence, breakIndex } = summary;
  const prevIdx = childGenSequence.indexOf(prevId);
  const currIdx = childGenSequence.indexOf(currId);
  if (prevIdx === -1 || currIdx !== prevIdx + 1) return false;
  return currIdx < breakIndex;
};

export const orderSeparatorBackground = (lineColor: string): string =>
  `repeating-linear-gradient(to right, ${lineColor} 0, ${lineColor} 1px, transparent 1px, transparent 6px)`;

/**
 * Rule 2 — reordering parts causes a partial break: the longest prefix of
 * source-provided parts whose relative order still matches the generalization
 * keeps order inheritance; everything from the first mismatch onward does not.
 */
export const computeOrderInheritanceForGen = (
  resolvedParts: ILinkNode[],
  genId: string,
  _genTitle: string,
  resolvedOf: (id: string) => ILinkNode[],
  detailEntries: OrderInheritanceDetail[],
): OrderInheritanceSummary => {
  const parentOrder = resolvedOf(genId).map((p) => p.id);
  const parentSet = new Set(parentOrder);

  const childToGenPart = new Map<string, string>();
  for (const entry of detailEntries) {
    if (entry.symbol !== "=" && entry.symbol !== ">") continue;
    childToGenPart.set(entry.to, entry.from);
  }

  const childGenSequence: string[] = [];
  for (const part of resolvedParts) {
    if (parentSet.has(part.id)) {
      childGenSequence.push(part.id);
    } else {
      const genPartId = childToGenPart.get(part.id);
      if (genPartId) childGenSequence.push(genPartId);
    }
  }

  let breakIndex = childGenSequence.length;
  for (let i = 0; i < childGenSequence.length; i++) {
    if (i >= parentOrder.length || childGenSequence[i] !== parentOrder[i]) {
      breakIndex = i;
      break;
    }
  }

  return { childGenSequence, breakIndex };
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
