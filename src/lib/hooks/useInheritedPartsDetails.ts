import { useState, useEffect, useRef, useCallback } from "react";
import {
  ILinkNode,
  InheritedPartsDetail,
  INode,
} from "@components/types/INode";
import { Post } from "@components/lib/utils/Post";
import { getFirestore, doc, onSnapshot } from "firebase/firestore";
import { NODES } from "@components/lib/firestoreClient/collections";
import { pendingWrites } from "@components/lib/utils/pendingWrites";

/**
 * Read-repair for the parts annotation: the stored pair (inheritedPartsDetails
 * + resolvedParts) renders immediately; when the fresh resolution disagrees
 * with the stored copy, ONE silent endpoint call repairs both on the doc.
 */

// The copy matches the fresh view when ids, order, sources and optional flags
// all agree. Title drift is an accepted blind spot.
const sameResolvedView = (
  fresh: ILinkNode[],
  stored?: ILinkNode[],
): boolean => {
  if (!stored || stored.length !== fresh.length) return false;
  return fresh.every((p, i) => {
    const s = stored[i];
    return (
      s.id === p.id &&
      (s.inheritedFrom ?? null) === (p.inheritedFrom ?? null) &&
      !!s.optional === !!p.optional
    );
  });
};

export const useInheritedPartsDetails = (
  currentVisibleNode?: INode | null,
  resolvedParts?: ILinkNode[],
  resolvedPartsLoading?: boolean,
): {
  data: InheritedPartsDetail[] | null;
  repairing: boolean;
  mutateData: (newData: InheritedPartsDetail[] | null) => void;
} => {
  const [data, setData] = useState<InheritedPartsDetail[] | null>(null);
  // True while a silent repair call is in flight — UI may hint (arrow spinner)
  // but rows keep rendering from the resolved view.
  const [repairing, setRepairing] = useState(false);
  // Discard stale API responses while navigating nodes.
  const activeNodeIdRef = useRef<string | null>(null);
  const initialSnapshotFired = useRef<Set<string>>(new Set());
  const inFlightRef = useRef(false);
  // One repair attempt per fresh-view state, so a disagreement the endpoint
  // cannot settle (e.g. a stale chain node in the client cache) never loops.
  const lastRepairKeyRef = useRef<string | null>(null);
  const repairRef = useRef<() => void>(() => {});

  const mutateData = useCallback((newData: InheritedPartsDetail[] | null) => {
    setData(newData);
  }, []);

  useEffect(() => {
    if (
      !currentVisibleNode?.id ||
      !currentVisibleNode.generalizations?.length
    ) {
      activeNodeIdRef.current = null;
      setData(null);
      return;
    }

    const db = getFirestore();
    const nodeId = currentVisibleNode.id;
    const appName = currentVisibleNode.appName;
    activeNodeIdRef.current = nodeId;
    initialSnapshotFired.current = new Set();
    lastRepairKeyRef.current = null;
    setRepairing(false);
    // Render the stored annotation at once; the comparison below decides
    // whether it is fresh.
    setData(currentVisibleNode.inheritedPartsDetails ?? null);

    const repair = () => {
      if (activeNodeIdRef.current !== nodeId || inFlightRef.current) return;
      inFlightRef.current = true;
      setRepairing(true);
      Post<{ success: boolean; data: InheritedPartsDetail[] }>(
        "/generate-inheritance-part-details",
        { nodeId, appName },
      )
        .then((result) => {
          if (activeNodeIdRef.current !== nodeId) return;
          if (result.success && result.data) setData(result.data);
        })
        .catch((err) => {
          if (activeNodeIdRef.current !== nodeId) return;
          console.error("Error repairing inherited parts:", err);
        })
        .finally(() => {
          inFlightRef.current = false;
          setRepairing(false);
        });
    };
    repairRef.current = repair;

    // A gen edit can change the annotation without changing the resolved view
    // (x rows, titles) — any later snapshot triggers a silent repair.
    const genIds = currentVisibleNode.generalizations
      .flatMap((c) => c.nodes)
      .map((n) => n.id);
    const unsubscribes = genIds.map((genId) =>
      onSnapshot(doc(db, NODES, genId), () => {
        if (!initialSnapshotFired.current.has(genId)) {
          initialSnapshotFired.current.add(genId);
          return;
        }
        lastRepairKeyRef.current = null;
        repairRef.current();
      }),
    );

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [currentVisibleNode?.id, currentVisibleNode?.generalizations?.length]);

  // Freshness check: only when the chain is fully resolved and no parts write
  // is in flight (the instant patch legitimately diverges from the doc).
  useEffect(() => {
    const nodeId = currentVisibleNode?.id;
    if (!nodeId || !currentVisibleNode?.generalizations?.length) return;
    if (resolvedPartsLoading) return;
    const pending = pendingWrites.fields(nodeId);
    if (
      pending.includes("properties.parts") ||
      pending.includes("partsInheritance")
    ) {
      return;
    }

    const fresh = resolvedParts ?? [];
    if (sameResolvedView(fresh, currentVisibleNode.resolvedParts)) {
      setData(currentVisibleNode.inheritedPartsDetails ?? []);
      return;
    }
    const key = `${nodeId}::${fresh
      .map((p) => `${p.id}|${p.inheritedFrom ?? ""}|${p.optional ? 1 : 0}`)
      .join(",")}`;
    if (lastRepairKeyRef.current === key) return;
    lastRepairKeyRef.current = key;
    repairRef.current();
  }, [currentVisibleNode, resolvedParts, resolvedPartsLoading]);

  return { data, repairing, mutateData };
};
