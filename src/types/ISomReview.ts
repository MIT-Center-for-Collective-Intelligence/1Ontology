export type SomIssueType =
  | "title-clarity"
  | "synonym-enrichment"
  | "description-enrichment"
  | "misc-facet-duplicate"
  | "mistaken-synonym"
  | "duplicate-synonym"
  | "polysemy"
  | "flat-list-grouping"
  | "compound-object-grouping"
  | "collection-design"
  | "placement"
  | "wrong-verb"
  | "node-merge"
  | "relocation"
  | "sense-relocation"
  | "missing-activity"
  | "redundant-node";

export type SomReviewStage =
  | "content"
  | "within-branch"
  | "outside-branch"
  | "final-action"
  | "additional-quality";

export type SomProposalKind = "diagnosis" | "design" | "action";

export interface SomReviewWorkflow {
  robTaskIds: number[];
  stage: SomReviewStage;
  proposalKind: SomProposalKind;
  dependsOnProposalIds: string[];
  conflictGroupId?: string;
}

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
    }
  | {
      type: "merge-action";
      parentTitle: string;
      canonicalTitle: string;
      canonicalCollection: string;
      canonicalChildren: string[];
      absorbedTitle: string;
      absorbedCollection: string;
      absorbedChildren: string[];
      resultingChildren: string[];
      absorbedBecomesSynonym: boolean;
    }
  | {
      type: "relocation-action";
      nodeTitle: string;
      currentParentTitle: string;
      currentCollection: string;
      proposedParentTitle: string;
      proposedCollection: string;
      childTitles: string[];
    }
  | {
      type: "addition-action";
      parentTitle: string;
      proposedTitle: string;
      description: string;
      examples: string[];
    }
  | {
      type: "merge-up-action";
      parentTitle: string;
      parentCollection: string;
      nodeTitle: string;
      childTitles: string[];
    }
  | {
      type: "metadata-edit";
      nodeTitle: string;
      field: "synonyms" | "description";
      currentText?: string;
      proposedText?: string;
      currentValues?: string[];
      proposedValues?: string[];
      synonymScope?: "structured-field" | "all-recorded";
      sourceTasks?: string[];
    }
  | {
      type: "polysemy-review";
      nodeTitle: string;
      currentParentTitle: string;
      sourceTasks: string[];
      proposedSenses: Array<{
        title: string;
        meaning: string;
        destination?: string;
      }>;
    }
  | {
      type: "collection-design";
      parentTitle: string;
      currentChildren: string[];
      proposedCollectionName: string;
      proposedBranches: Array<{
        title: string;
        status: "existing" | "new";
        children: string[];
      }>;
    }
  | {
      type: "sense-relocation-action";
      nodeTitle: string;
      currentParentTitle: string;
      currentCollection: string;
      sourceTasks: string[];
      retainedSenseTitle: string;
      retainedParentTitle: string;
      movedSenseTitle: string;
      proposedParentTitle: string;
    };

/** The blinded card served to the reviewer. Allowlisted fields only. */
export interface SomReviewCard {
  proposalId: string;
  datasetVersion: string;
  issueType: SomIssueType;
  /** Zero-based position within the complete issue-type queue. */
  proposalIndex?: number;
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
  stage: SomReviewStage;
  robTaskIds: number[];
  reviewed: number;
  pending: number;
  waiting: number;
  notApplicable: number;
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
  historyCards?: SomReviewCard[];
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
