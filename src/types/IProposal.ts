import type { Timestamp } from "firebase/firestore";
import type { IAlgorithm } from "./INode";

export type ProposalOutcome = "pending" | "accepted" | "edited" | "rejected";

export type FlowKind = "sequence" | "loop" | "parallel" | "conditional";

export type ProposalStep = {
  id: string;
  title: string;
  role?: string;
  /** A part that is not a node yet: created when the review is applied,
   * under `parent` when one was picked. */
  isNew?: boolean;
  parent?: { id: string; title: string } | null;
};

export type ProposalFlag = { t: string; k: "ok" | "warn" | "info" | "bad" };

export type PartRelation = "same" | "specialized" | "added" | "notInherited";

/** How a specialization's parts stand to a generalization's: the same part,
 * a specialized version of it, one of its own, or one of the generalization's
 * it does not have. Several ids on a side when parts merge or split. */
export type PartMapping = {
  generalizedPartIds: string[];
  specializationPartIds: string[];
  relation: PartRelation;
};

/** Per specialization (by node id), how it inherits from the generalization. */
export type PartsInheritance = { [specializationId: string]: PartMapping[] };

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
  /** "parts": the proposal lists the activity's parts and has no flow yet;
   * the review then shows parts, not flows. Unset means a flow. */
  stage?: "parts" | "flow";
  /** A generalization's proposal: how each accepted specialization inherits
   * its parts as proposed; written again with the decision. */
  inheritance?: PartsInheritance;
  decision: {
    outcome: ProposalOutcome;
    steps?: ProposalStep[];
    kind?: FlowKind;
    algorithm?: IAlgorithm;
    inheritance?: PartsInheritance;
    reason?: string;
    /** The reviewer said the activity is not a specialization of its parent. */
    doesNotBelong?: boolean;
    /** The generalizations the reviewer wants it under; recorded here, the
     * hierarchy is not changed. Unset until the reviewer adds or removes one. */
    under?:
      | {
          id: string;
          title: string;
          /** A node to create when the review is applied, under `parent`. */
          isNew?: boolean;
          parent?: { id: string; title: string } | null;
        }[]
      | null;
    /** Older records: a single destination, read as `under` with one entry. */
    movedTo?: { id: string; title: string } | null;
    by?: string;
    at?: Timestamp | Date | null;
  } | null;
};

export type ReviewDoc = AlgorithmProposal;
