import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Post } from "@components/lib/utils/Post";
import type { ProposalOutcome } from "@components/types/IProposal";

/**
 * Which nodes of the current app have proposals, so the outline can mark them.
 * Loaded once per app; `refresh` is called after a decision so marks update.
 */
export type ProposalIndex = {
  /** nodeId -> status of its algorithm proposal */
  byNode: Map<string, ProposalOutcome>;
  /** parentId -> number of children with a pending proposal */
  pendingUnder: Map<string, number>;
  refresh: () => void;
};

const EMPTY: ProposalIndex = {
  byNode: new Map(),
  pendingUnder: new Map(),
  refresh: () => {},
};

export const ProposalIndexContext = createContext<ProposalIndex>(EMPTY);
export const useProposalIndex = () => useContext(ProposalIndexContext);

export const ProposalIndexProvider = ({
  appName,
  children,
}: {
  appName: string;
  children: React.ReactNode;
}) => {
  const [rows, setRows] = useState<
    { nodeId: string; parentId: string | null; status: ProposalOutcome }[]
  >([]);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    Post<{ index: typeof rows }>("/review/proposals", {
      action: "index",
      appName,
    })
      .then((res) => {
        if (!cancelled) setRows(res.index || []);
      })
      .catch((e) => console.error("proposal index", e));
    return () => {
      cancelled = true;
    };
  }, [appName, tick]);

  const value = useMemo<ProposalIndex>(() => {
    const byNode = new Map<string, ProposalOutcome>();
    const pendingUnder = new Map<string, number>();
    for (const r of rows) {
      byNode.set(r.nodeId, r.status);
      if (r.parentId && r.status === "pending")
        pendingUnder.set(r.parentId, (pendingUnder.get(r.parentId) || 0) + 1);
    }
    return { byNode, pendingUnder, refresh };
  }, [rows, refresh]);

  return (
    <ProposalIndexContext.Provider value={value}>
      {children}
    </ProposalIndexContext.Provider>
  );
};
