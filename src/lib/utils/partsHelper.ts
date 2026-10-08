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

type OrderInheritanceDetail = {
  from: string;
  to: string;
  symbol: string;
};

const genPartIdFromDetail = (
  entry: OrderInheritanceDetail,
): string | undefined => {
  if (entry.symbol === "=" || entry.symbol === ">")
    return entry.from || undefined;
  return undefined;
};

/** A set of parts still in the generalization's order, spanning first member
 *  to last. Non-members inside the span are pass-throughs. Rails can overlap,
 *  so each carries the column it draws in. */
type OrderBracket = {
  from: number;
  to: number;
  depth: number;
  members: number[];
};

export type OrderRuns = {
  brackets: OrderBracket[];
};

/** The number of maximal increasing subsequences is exponential worst case. */
const MAX_RAILS = 6;

/**
 * Every maximal increasing subsequence of `pos`. A step i→j is allowed only
 * when nothing could be inserted between them — no k with i<k<j and
 * pos[i]<pos[k]<pos[j] — which is what makes the results maximal.
 */
function maximalIncreasingRuns(pos: number[]): number[][] {
  const n = pos.length;
  const canStart = (i: number) => !pos.some((p, k) => k < i && p < pos[i]);
  const successors = (i: number) => {
    const out: number[] = [];
    for (let j = i + 1; j < n; j++) {
      if (pos[j] <= pos[i]) continue;
      let insertable = false;
      for (let k = i + 1; k < j; k++) {
        if (pos[k] > pos[i] && pos[k] < pos[j]) {
          insertable = true;
          break;
        }
      }
      if (!insertable) out.push(j);
    }
    return out;
  };

  const runs: number[][] = [];
  const walk = (path: number[]) => {
    if (runs.length >= MAX_RAILS) return;
    const next = successors(path[path.length - 1]);
    if (next.length === 0) {
      runs.push([...path]);
      return;
    }
    for (const j of next) {
      walk([...path, j]);
      if (runs.length >= MAX_RAILS) return;
    }
  };
  for (let i = 0; i < n; i++) if (canStart(i)) walk([i]);
  return runs;
}

/** The rails a row list forms against its generalization's order. */
export const computeOrderRuns = (
  detailEntries: OrderInheritanceDetail[],
  genPartOrder: string[],
): OrderRuns => {
  const posInGen = new Map(genPartOrder.map((id, i) => [id, i]));
  // Only parts the generalization provides can be in its order.
  const seq: { row: number; pos: number }[] = [];
  detailEntries.forEach((entry, row) => {
    if (entry.symbol === "x") return;
    const genPartId = genPartIdFromDetail(entry);
    const pos = genPartId === undefined ? undefined : posInGen.get(genPartId);
    if (pos !== undefined) seq.push({ row, pos });
  });

  const runs = seq.length
    ? maximalIncreasingRuns(seq.map((s) => s.pos)).filter((r) => r.length >= 2)
    : [];

  // Overlapping rails get separate columns: lowest depth that does not clash.
  const brackets: OrderBracket[] = runs
    .map((run) => {
      const rows = run.map((i) => seq[i].row);
      return {
        from: rows[0],
        to: rows[rows.length - 1],
        depth: 0,
        members: rows,
      };
    })
    .sort((a, b) => b.to - b.from - (a.to - a.from));

  for (let i = 0; i < brackets.length; i++) {
    let depth = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const clash = brackets
        .slice(0, i)
        .some(
          (o) =>
            o.depth === depth &&
            o.from <= brackets[i].to &&
            o.to >= brackets[i].from,
        );
      if (!clash) break;
      depth += 1;
    }
    brackets[i].depth = depth;
  }

  return { brackets };
};

/** Keyed by the pair, so it survives reordering. */
export const orderLinkKey = (upperId: string, lowerId: string): string =>
  `${upperId}|${lowerId}`;

/** The rail segments crossing a row, innermost column first. */
export const orderBracketsAt = (runs: OrderRuns, index: number) =>
  runs.brackets
    .filter((b) => index >= b.from && index <= b.to)
    .sort((a, b) => a.depth - b.depth)
    .map((b) => ({
      depth: b.depth,
      isFirst: index === b.from,
      isLast: index === b.to,
      // A row a rail only spans is a pass-through.
      isMember: b.members.includes(index),
    }));

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
