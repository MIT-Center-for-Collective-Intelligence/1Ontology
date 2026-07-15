export type SomIssueType =
  | "title-clarity"
  | "sibling-grouping"
  | "duplicate-synonym"
  | "placement"
  | "structural-overlap";

export type SomReviewDecision = "agree" | "disagree";

export type SomReviewerRole = "steward" | "researcher" | "contributor";

export type SomDeliberationRecommendation =
  | "awaiting-core-review"
  | "ready-to-accept"
  | "ready-to-reject"
  | "needs-deliberation";

export type SomDeliberationResolutionDecision = "accept" | "reject" | "defer";

export type SomDeliberationCommentStance =
  | "support"
  | "oppose"
  | "question"
  | "synthesis";

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
  total: number;
  enabled: boolean;
  activeSession?: {
    cursor: number;
    total: number;
  };
}

export interface SomSessionState {
  id: string;
  issueType: SomIssueType;
  datasetVersion: string;
  cursor: number;
  total: number;
}

export interface SomSessionResponse {
  done?: boolean;
  session?: SomSessionState;
  cards?: SomReviewCard[];
  history?: SomReviewHistoryItem[];
}

export interface SomReviewHistoryItem {
  proposalId: string;
  proposalIndex: number;
  question: string;
  decision: SomReviewDecision;
  disagreementReason: string;
  suggestedCorrection: string;
  reviewedAt: string;
}

export interface SomOverviewResponse {
  datasetVersion: string;
  issueTypes: SomIssueTypeOption[];
  canDeliberate: boolean;
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

export interface SomReviseResult {
  ok: boolean;
  changed: boolean;
}

export interface SomDeliberationRoleSummary {
  role: SomReviewerRole;
  label: string;
  weight: number;
  responses: number;
  agree: number;
  disagree: number;
}

export interface SomDeliberationAggregate {
  recommendation: SomDeliberationRecommendation;
  quorumMet: boolean;
  totalResponses: number;
  coreResponses: number;
  allWeightedSupport: number | null;
  coreWeightedSupport: number | null;
  stewardSplit: boolean;
  stewardDissent: boolean;
  roleSummaries: SomDeliberationRoleSummary[];
}

export interface SomDeliberationResolution {
  decision: SomDeliberationResolutionDecision;
  rationale: string;
  resolvedBy: string;
  resolvedByName: string;
  resolvedAt: string;
}

export interface SomDeliberationProposalSummary {
  proposalId: string;
  issueType: SomIssueType;
  question: string;
  currentState: string;
  proposedState: string;
  aggregate: SomDeliberationAggregate;
  commentCount: number;
  resolution?: SomDeliberationResolution;
}

export interface SomDeliberationAccess {
  role: SomReviewerRole;
  roleLabel: string;
  canFinalize: boolean;
}

export interface SomDeliberationOverviewResponse {
  datasetVersion: string;
  access: SomDeliberationAccess;
  remainingIndependentReviews: number;
  roleWeights: Array<{
    role: SomReviewerRole;
    label: string;
    weight: number;
  }>;
  proposals: SomDeliberationProposalSummary[];
}

export interface SomDeliberationParticipant {
  reviewerId: string;
  displayName: string;
  role: SomReviewerRole;
  roleLabel: string;
  weight: number;
  originalDecision: SomReviewDecision;
  effectiveDecision: SomReviewDecision;
  revised: boolean;
  rationale: string;
  reviewedAt: string;
}

export interface SomDeliberationComment {
  id: string;
  authorId: string;
  authorName: string;
  stance: SomDeliberationCommentStance;
  body: string;
  createdAt: string;
}

export interface SomDeliberationProposalResponse {
  datasetVersion: string;
  access: SomDeliberationAccess;
  card: SomReviewCard;
  aggregate: SomDeliberationAggregate;
  participants: SomDeliberationParticipant[];
  comments: SomDeliberationComment[];
  resolution?: SomDeliberationResolution;
  myOriginalDecision?: SomReviewDecision;
  myEffectiveDecision?: SomReviewDecision;
}

export interface SomDeliberationMutationResult {
  ok: boolean;
}
