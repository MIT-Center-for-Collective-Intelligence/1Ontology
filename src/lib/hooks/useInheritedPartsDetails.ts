import { useState, useEffect, useRef, useCallback } from "react";
import { InheritedPartsDetail, INode } from "@components/types/INode";
import { Post } from "@components/lib/utils/Post";
import { getFirestore, doc, onSnapshot } from "firebase/firestore";
import { NODES } from "@components/lib/firestoreClient/collections";

interface UseInheritedPartsDetailsReturn {
  data: InheritedPartsDetail[] | null;
  loading: boolean;
  error: Error | null;
  mutateData: (newData: InheritedPartsDetail[] | null) => void;
  debouncedRefetch: () => void;
  refetchNow: () => void;
}

export const useInheritedPartsDetails = (
  currentVisibleNode?: INode | null,
): UseInheritedPartsDetailsReturn => {
  const [data, setData] = useState<InheritedPartsDetail[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Track which generalization IDs have fired their initial snapshot
  const initialSnapshotFired = useRef<Set<string>>(new Set());
  // Track the current node ID to discard stale API responses (prevent bugs while navigating nodes)
  const activeNodeIdRef = useRef<string | null>(null);
  // Hold the debounce timer for refetch
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Hold a reference to fetchFromApi so debouncedRefetch can call it
  const fetchFromApiRef = useRef<(() => void) | null>(null);

  const mutateData = useCallback((newData: InheritedPartsDetail[] | null) => {
    setData(newData);
  }, []);

  const debouncedRefetch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchFromApiRef.current?.();
    }, 3000);
  }, []);

  const refetchNow = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    fetchFromApiRef.current?.();
  }, []);

  useEffect(() => {
    setData(null);

    if (
      !currentVisibleNode?.id ||
      !currentVisibleNode.generalizations?.length
    ) {
      activeNodeIdRef.current = null;
      return;
    }

    const db = getFirestore();
    const nodeId = currentVisibleNode.id;
    const appName = currentVisibleNode.appName;
    activeNodeIdRef.current = nodeId;
    initialSnapshotFired.current = new Set();

    const fetchFromApi = () => {
      if (activeNodeIdRef.current !== nodeId) return;
      setLoading(true);
      setError(null);
      Post<{ success: boolean; data: InheritedPartsDetail[] }>(
        "/generate-inheritance-part-details",
        { nodeId, appName },
      )
        .then((result) => {
          // Discard if user navigated away
          if (activeNodeIdRef.current !== nodeId) return;

          if (result.success && result.data) {
            setData(result.data);
          } else {
            console.error("API returned unsuccessful response");
            setData([]);
          }
        })
        .catch((err) => {
          if (activeNodeIdRef.current !== nodeId) return;
          console.error("Error fetching inherited parts:", err);
          setError(err as Error);
          setData([]);
        })
        .finally(() => {
          if (activeNodeIdRef.current !== nodeId) return;
          setLoading(false);
        });
    };

    // Store fetchFromApi so debouncedRefetch can call it
    fetchFromApiRef.current = fetchFromApi;

    // Check if cached data on the node document is fresh
    const cachedData = currentVisibleNode.inheritedPartsDetails;
    const FIFTEEN_MINUTES = 15 * 60 * 1000;

    const currentGenIds = currentVisibleNode.generalizations
      .flatMap((c) => c.nodes)
      .map((n) => n.id);

    const cachedGenIds =
      cachedData && Array.isArray(cachedData)
        ? cachedData.map((calc: any) => calc.generalizationId)
        : [];
    const generalizationsMatch =
      cachedData &&
      Array.isArray(cachedData) &&
      cachedData.length > 0 &&
      currentGenIds.length === cachedGenIds.length &&
      currentGenIds.every((id) => cachedGenIds.includes(id));

    const isCacheFresh =
      generalizationsMatch &&
      cachedData.every(
        (calc: any) =>
          calc.createdAt &&
          Date.now() - calc.createdAt.toMillis() < FIFTEEN_MINUTES,
      );

    if (isCacheFresh) {
      setData(cachedData);
    } else {
      fetchFromApi();
    }

    // Set up listeners on generalization nodes
    const genIds = currentVisibleNode.generalizations
      .flatMap((c) => c.nodes)
      .map((n) => n.id);

    const unsubscribes = genIds.map((genId) =>
      onSnapshot(doc(db, NODES, genId), () => {
        // Skip the first snapshot (initial load)
        if (!initialSnapshotFired.current.has(genId)) {
          initialSnapshotFired.current.add(genId);
          return;
        }

        // Any subsequent change — refetch
        fetchFromApi();
      }),
    );

    return () => {
      unsubscribes.forEach((unsub) => unsub());
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [currentVisibleNode?.id, currentVisibleNode?.generalizations?.length]);

  // Detect parts changes on the current node (e.g, adding new part)
  // and trigger a debounced refetch without wiping the current data
  const partsSignature = currentVisibleNode?.properties?.parts?.[0]?.nodes
    ?.map((n: any) => n.id)
    .join(",") ?? "";
  const prevPartsSignatureRef = useRef(partsSignature);

  useEffect(() => {
    // Skip on first render or when node changes
    if (prevPartsSignatureRef.current === partsSignature) return;
    prevPartsSignatureRef.current = partsSignature;

    // Parts changed -> refetch
    if (fetchFromApiRef.current) {
      debouncedRefetch();
    }
  }, [partsSignature, debouncedRefetch]);

  return { data, loading, error, mutateData, debouncedRefetch, refetchNow };
};
