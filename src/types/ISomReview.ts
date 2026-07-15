export type SomIssueType =
  | "title-clarity"
  | "sibling-grouping"
  | "duplicate-synonym"
  | "placement"
  | "structural-overlap";

export type SomReviewContext =
  | {
      type: "title-comparison";
      currentTitle: string;
      proposedTitle?: string;
      linkedTasks?: string[];
    }
  | {
      type: "grouping-outline";
      parentTitle: string;
      structure: "intermediate" | "facet-collection";
      proposedGroupTitle: string;
      proposedChildren: string[];
      unaffectedChildren?: string[];
    }
  | {
      type: "flat-list";
      parentTitle: string;
      currentChildren: string[];
    }
  | {
      type: "duplicate-comparison";
      parentTitle: string;
      canonicalTitle: string;
      candidateSynonymTitle: string;
    }
  | {
      type: "placement-comparison";
      nodeTitle: string;
      currentParentTitle: string;
      currentBucket?: string;
      candidateHome?: string;
      placementIssue: "wrong-bucket" | "wrong-parent" | "wrong-verb";
    }
  | {
      type: "overlap-comparison";
      parentTitle: string;
      firstCollection: string;
      firstTitle: string;
      secondCollection: string;
      secondTitle: string;
    };

/** The blinded card served to the reviewer. Allowlisted fields only. */
export interface SomReviewCard {
  proposalId: string;
  datasetVersion: string;
  issueType: SomIssueType;
  reviewerView: {
    question: string;
    currentState: string;
    proposedState: string;
    reasoning: string;
    context: SomReviewContext;
    agreeLabel: string;
    disagreeLabel: string;
  };
}

export interface SomIssueTypeOption {
  id: SomIssueType;
  label: string;
  pending: number;
  enabled: boolean;
}

export interface SomSessionState {
  issueType: SomIssueType;
  datasetVersion: string;
  cursor: number;
  total: number;
}

export interface SomSessionResponse {
  done?: boolean;
  session?: SomSessionState;
  cards?: SomReviewCard[];
}

export interface SomOverviewResponse {
  datasetVersion: string;
  issueTypes: SomIssueTypeOption[];
}

export interface SomRespondResult {
  ok: boolean;
  cursor: number;
  completed: boolean;
}

export interface SomUndoResult {
  ok: boolean;
  cursor: number;
}
