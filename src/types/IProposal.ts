import type { Timestamp } from "firebase/firestore";
import type { IAlgorithm } from "./INode";

export type ProposalOutcome = "pending" | "accepted" | "edited" | "rejected";

export type FlowKind = "sequence" | "loop" | "parallel" | "conditional";

export type ProposalStep = { id: string; title: string; role?: string };

export type ProposalFlag = { t: string; k: "ok" | "warn" | "info" | "bad" };

/** One generated algorithm for one activity: its steps (bound to activity
 * nodes) and the control construct over them. */
export type AlgorithmProposal = {
  id: string;
  kind: "algorithm";
  appName: string;
  nodeId: string;
  nodeTitle: string;
  parentId: string | null;
  steps: ProposalStep[];
  flowKind: FlowKind;
  flowNote?: string;
  rationale: string;
  source: string;
  flags: ProposalFlag[];
  mock?: boolean;
  status: ProposalOutcome;
  /** The full editor tree, when the proposal was generated or edited as one. */
  algorithm?: IAlgorithm;
  /** Set when the flow was built from the accepted flows of these
   * specializations (a parent's proposal). */
  derived?: { from: string[]; at?: Timestamp | Date | null };
  decision: {
    outcome: ProposalOutcome;
    steps?: ProposalStep[];
    kind?: FlowKind;
    algorithm?: IAlgorithm;
    reason?: string;
    /** The reviewer said the activity is not a specialization of its parent. */
    doesNotBelong?: boolean;
    /** Where the reviewer sent it; recorded here, the hierarchy is not changed. */
    movedTo?: { id: string; title: string } | null;
    by?: string;
    at?: Timestamp | Date | null;
  } | null;
};

export type ReviewDoc = AlgorithmProposal;
