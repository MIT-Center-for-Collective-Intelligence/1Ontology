import { useState, useEffect } from "react";
import { InheritedPartsDetail, INode } from "@components/types/INode";
import { Post } from "@components/lib/utils/Post";

interface UseInheritedPartsDetailsReturn {
  data: InheritedPartsDetail[] | null;
  loading: boolean;
  error: Error | null;
}

export const useInheritedPartsDetails = (
  currentVisibleNode?: INode | null,
): UseInheritedPartsDetailsReturn => {
  const [data, setData] = useState<InheritedPartsDetail[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchInheritedPartsDetails = async () => {
      setData(null);

      if (
        !currentVisibleNode?.id ||
        !currentVisibleNode.generalizations?.length
      ) {
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Check if data exists in the node document
        const cachedData = currentVisibleNode.inheritedPartsDetails;

        // Check if data is fresh (less than 15 minutes old)
        const FIFTEEN_MINUTES = 15 * 60 * 1000;

        // Get current generalization IDs
        const currentGenIds = currentVisibleNode.generalizations
          .flatMap((c) => c.nodes)
          .map((n) => n.id);

        // Check if cached data matches current generalizations
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

        // Check if any inheritance details is stale
        const isCacheFresh =
          generalizationsMatch &&
          cachedData.every(
            (calc: any) =>
              calc.createdAt &&
              Date.now() - calc.createdAt.toMillis() < FIFTEEN_MINUTES,
          );

        if (isCacheFresh) {
          setData(cachedData);
          setLoading(false);
          return;
        }

        // Cache is stale or doesn't exist, call API
        const result = await Post<{
          success: boolean;
          data: InheritedPartsDetail[];
        }>("/generate-inheritance-part-details", {
          nodeId: currentVisibleNode.id,
          appName: currentVisibleNode.appName,
        });

        if (result.success && result.data) {
          console.log("Successfully fetched fresh data from API");
          setData(result.data);
        } else {
          console.error("API returned unsuccessful response");
          setData([]);
        }
      } catch (err) {
        console.error("Error fetching inherited parts:", err);
        setError(err as Error);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchInheritedPartsDetails();
  }, [currentVisibleNode?.id, currentVisibleNode?.generalizations?.length]);

  return { data, loading, error };
};
