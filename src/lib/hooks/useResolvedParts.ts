import { useEffect, useMemo, useRef, useState } from "react";
import { ILinkNode, INode } from "@components/types/INode";
import {
  PartsGraph,
  resolveParts,
  toPartsNode,
} from "@components/lib/server/partsModel";

/**
 * Memoized resolved-parts accessor over a plain node cache. Converts only the
 * queried node's ref chain — never the whole cache. A chain node missing from
 * the cache degrades resolution to the stored entries.
 */
export const makeResolvedOf = (nodes: { [id: string]: any }) => {
  const graph: PartsGraph = new Map();
  const memo = new Map<string, ILinkNode[]>();
  return (id: string): ILinkNode[] => {
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
};

/**
 * The visible node's parts as viewed (ref chain resolved, overlay spliced in).
 * Walks `partsInheritance.source` upward through the caches, fetching a
 * missing ancestor once; until it arrives resolution degrades to the entries
 * already at hand.
 */
export const useResolvedParts = (
  currentVisibleNode?: INode | null,
  nodes?: { [id: string]: INode },
  fetchNode?: (nodeId: string) => Promise<INode | null>,
): { resolvedParts: ILinkNode[]; loading: boolean } => {
  const [fetchedChain, setFetchedChain] = useState<{ [id: string]: INode }>({});
  const activeNodeIdRef = useRef<string | null>(null);
  const requestedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    activeNodeIdRef.current = currentVisibleNode?.id ?? null;
    requestedIdsRef.current = new Set();
    setFetchedChain({});
  }, [currentVisibleNode?.id]);

  const { resolvedParts, missingIds, ownChainIncomplete } = useMemo(() => {
    if (!currentVisibleNode?.id) {
      return {
        resolvedParts: [] as ILinkNode[],
        missingIds: [] as string[],
        ownChainIncomplete: false,
      };
    }
    // The visible node is the freshest copy — it wins over the caches.
    const docOf = (id: string): INode | undefined =>
      id === currentVisibleNode.id
        ? currentVisibleNode
        : (nodes?.[id] ?? fetchedChain[id]);
    const graph: PartsGraph = new Map();
    const missing: string[] = [];
    const walk = (start: string | null | undefined): boolean => {
      let cursor = start;
      while (cursor && !graph.has(cursor)) {
        const doc = docOf(cursor);
        if (!doc) {
          missing.push(cursor);
          return false;
        }
        const partsNode = toPartsNode(doc);
        graph.set(cursor, partsNode);
        cursor = partsNode.partsInheritance.source;
      }
      return true;
    };
    const ownComplete = walk(currentVisibleNode.id);
    // The gens' chains feed the provider pickers and captions — a gen that
    // inherits a part virtually must resolve too.
    for (const c of currentVisibleNode.generalizations ?? []) {
      for (const n of c.nodes ?? []) walk(n.id);
    }
    return {
      resolvedParts: resolveParts(currentVisibleNode.id, graph),
      missingIds: missing,
      ownChainIncomplete: !ownComplete,
    };
  }, [currentVisibleNode, nodes, fetchedChain]);

  // Fetch missing chain nodes once, prefetching the pathIds spine alongside
  // as a hint (primary-parent path only — the chain can leave it, so the
  // per-hop walk stays authoritative). Drop results on navigation.
  useEffect(() => {
    if (!fetchNode || missingIds.length === 0 || !currentVisibleNode) return;
    const hinted = (currentVisibleNode.pathIds ?? []).filter(
      (id) => id !== currentVisibleNode.id && !nodes?.[id] && !fetchedChain[id],
    );
    const wanted = [...missingIds, ...hinted].filter(
      (id) => !requestedIdsRef.current.has(id),
    );
    if (wanted.length === 0) return;
    wanted.forEach((id) => requestedIdsRef.current.add(id));
    const forNodeId = activeNodeIdRef.current;
    for (const id of wanted) {
      fetchNode(id).then((node) => {
        if (!node || activeNodeIdRef.current !== forNodeId) return;
        setFetchedChain((prev) =>
          prev[node.id] ? prev : { ...prev, [node.id]: node },
        );
      });
    }
  }, [missingIds, fetchNode, currentVisibleNode, nodes, fetchedChain]);

  // While one of the node's OWN chain ancestors is in flight the resolution is
  // PARTIAL — callers must not treat it as the definitive view (e.g. for the
  // freshness comparison). A gen's incomplete chain doesn't block it.
  return { resolvedParts, loading: ownChainIncomplete };
};
