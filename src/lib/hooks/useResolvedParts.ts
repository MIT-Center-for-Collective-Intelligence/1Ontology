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

  const { resolvedParts, missingId } = useMemo(() => {
    if (!currentVisibleNode?.id) {
      return { resolvedParts: [] as ILinkNode[], missingId: null };
    }
    // The visible node is the freshest copy — it wins over the caches.
    const docOf = (id: string): INode | undefined =>
      id === currentVisibleNode.id
        ? currentVisibleNode
        : (nodes?.[id] ?? fetchedChain[id]);
    const graph: PartsGraph = new Map();
    let missingId: string | null = null;
    let cursor: string | null = currentVisibleNode.id;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      const doc = docOf(cursor);
      if (!doc) {
        missingId = cursor;
        break;
      }
      const partsNode = toPartsNode(doc);
      graph.set(cursor, partsNode);
      cursor = partsNode.partsInheritance.source;
    }
    return {
      resolvedParts: resolveParts(currentVisibleNode.id, graph),
      missingId,
    };
  }, [currentVisibleNode, nodes, fetchedChain]);

  // Fetch a missing ancestor once; drop the result on navigation.
  useEffect(() => {
    if (!fetchNode || !missingId || requestedIdsRef.current.has(missingId)) {
      return;
    }
    requestedIdsRef.current.add(missingId);
    const forNodeId = activeNodeIdRef.current;
    fetchNode(missingId).then((node) => {
      if (!node || activeNodeIdRef.current !== forNodeId) return;
      setFetchedChain((prev) =>
        prev[node.id] ? prev : { ...prev, [node.id]: node },
      );
    });
  }, [missingId, fetchNode]);

  // While a chain ancestor is in flight the resolution is PARTIAL — callers
  // must not treat it as the definitive view (e.g. for freshness comparison).
  return { resolvedParts, loading: missingId !== null };
};
