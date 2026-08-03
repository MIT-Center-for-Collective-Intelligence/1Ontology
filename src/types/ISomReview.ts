export type SomIssueType =
  | "cross-branch-recall"
  | "evidence-specialization"
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
  | "redundant-node"
  | "empty-node"
  | "empty-collection";

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
      type: "title-split";
      currentTitle: string;
      linkedTasks: string[];
      proposedNodes: Array<{
        title: string;
        status: "current" | "existing" | "new";
        sourceTaskIndexes: number[];
        sourceTasks: string[];
        reason: string;
      }>;
      deferredTaskIndexes: number[];
      deferredTasks: string[];
    }
  | {
      type: "grouping-outline";
      parentTitle: string;
      structure: "intermediate" | "facet-collection";
      proposedGroupTitle: string;
      proposedChildren: string[];
      unaffectedChildren?: string[];
      sourceTasks?: string[];
    }
  | {
      type: "flat-list";
      parentTitle: string;
      currentChildren: string[];
    }
  | {
      type: "duplicate-comparison";
      parentTitle: string;
      canonicalParentTitle?: string;
      candidateParentTitle?: string;
      canonicalTitle: string;
      candidateSynonymTitle: string;
      sourceTasks?: string[];
    }
  | {
      type: "placement-comparison";
      nodeTitle: string;
      currentParentTitle: string;
      currentBucket?: string;
      candidateHome?: string;
      currentPathTitles?: string[];
      proposedPathTitles?: string[];
      sharedAction?: string;
      affectedNodes?: Array<{
        nodeTitle: string;
        currentParentTitle: string;
        currentBucket?: string;
        sourceTasks?: string[];
      }>;
      placementIssue:
        | "wrong-bucket"
        | "wrong-parent"
        | "wrong-verb"
        | "missing-from-branch";
      sourceTasks?: string[];
    }
  | {
      type: "evidence-parent-allocation";
      taskTitle: string;
      currentParentTitles: string[];
      assignedOutputTitles: string[];
      retainedParentTitles: string[];
      removedParentTitles: string[];
    }
  | {
      type: "evidence-specialization";
      genericNodeTitle: string;
      sourceTask: string;
      currentParentTitles: string[];
      proposedTitle: string;
      proposedTitleStatus: "existing" | "new";
      targetParentTitle: string;
      removedParentTitles: string[];
      retainedParentTitles: string[];
    }
  | {
      type: "empty-node-action";
      parentTitle: string;
      parentCollection: string;
      nodeTitle: string;
    }
  | {
      type: "empty-collection-action";
      parentTitle: string;
      collectionName: string;
    }
  | {
      type: "overlap-comparison";
      parentTitle: string;
      firstCollection: string;
      firstTitle: string;
      secondCollection: string;
      secondTitle: string;
      sourceTasks?: string[];
    }
  | {
      type: "merge-action";
      parentTitle: string;
      canonicalParentTitle?: string;
      absorbedParentTitle?: string;
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
      /** Human-readable name for the proposed collection organization. */
      proposedCollectionName: string;
      /**
       * Activity branches shown in historical records. New collection-only
       * proposals must reference existing direct children with no descendants.
       */
      proposedBranches: Array<{
        title: string;
        status: "existing" | "new";
        children: string[];
      }>;
      sourceTasks?: string[];
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
  branch: string;
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
  released: boolean;
  releaseMessage?: string;
  optional?: boolean;
  prerequisiteIssueTypes: SomIssueType[];
  blockedBy: SomIssuePrerequisite[];
  activeSession?: {
    cursor: number;
    total: number;
  };
}

export interface SomIssuePrerequisite {
  id: SomIssueType;
  label: string;
  remaining: number;
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
  /** Present only when an exact linked proposal was requested and focused. */
  focusedProposalId?: string;
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

export interface SomFollowUpSource {
  proposalId: string;
  issueType: SomIssueType;
  issueLabel: string;
  question: string;
}

/** A ready action proposal connected to one or more completed diagnoses. */
export interface SomLinkedFollowUp {
  proposalId: string;
  issueType: SomIssueType;
  issueLabel: string;
  question: string;
  sources: SomFollowUpSource[];
}

export interface SomOverviewResponse {
  datasetId: string;
  datasetVersion: string;
  workspaceId: string;
  roundLabel: string;
  currentRound: boolean;
  workspaces: SomReviewWorkspaceOption[];
  branch: string;
  ontologyName: string;
  issueTypes: SomIssueTypeOption[];
  readyFollowUps: SomLinkedFollowUp[];
  canDeliberate: boolean;
  canInspectPriorReview: boolean;
}

export interface SomReviewRoundOption {
  id: string;
  datasetVersion: string;
  label: string;
  current: boolean;
}

export interface SomReviewWorkspaceOption {
  id: string;
  label: string;
  activeDatasetId: string;
  rounds: SomReviewRoundOption[];
}

export interface SomOntologyOutlineNode {
  id: string;
  title: string;
  evidence: boolean;
  synonyms: string[];
}

export interface SomOntologyOutlineEdge {
  parentId: string;
  childId: string;
  collectionName: string;
}

export interface SomOntologyOutlineSnapshot {
  ontologyName: string;
  capturedAt: string;
  rootNodeId: string;
  rootTitle: string;
  nodes: SomOntologyOutlineNode[];
  edges: SomOntologyOutlineEdge[];
}

export interface SomOntologyOutlineResponse {
  datasetId: string;
  workspaceId: string;
  branch: string;
  currentRound: boolean;
  selected: SomOntologyOutlineSnapshot;
  original: SomOntologyOutlineSnapshot;
}

export interface SomRespondResult {
  ok: boolean;
  cursor: number;
  completed: boolean;
  followUps: SomLinkedFollowUp[];
}

export interface SomUndoResult {
  ok: boolean;
  cursor: number;
}

export interface SomReviseResult {
  ok: boolean;
  changed: boolean;
  followUps: SomLinkedFollowUp[];
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
  branch: string;
  ontologyName: string;
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

export type SomInspectionRecordSource =
  | "proposed-change"
  | "status-quo-audit"
  | "manual-check";

export interface SomInspectionReviewer {
  reviewerId: string;
  displayName: string;
  responseCount: number;
}

export interface SomInspectionException {
  datasetVersion: string;
  proposalId: string;
  subjectReviewerId: string;
  inspectorId: string;
  rationale: string;
  suggestedAlternative: string;
  updatedAt: string;
}

export interface SomInspectionSubjectResponse {
  decision: SomReviewDecision;
  disagreementReason: string;
  suggestedCorrection: string;
  reviewedAt: string;
}

export interface SomInspectionItem {
  datasetId: string;
  datasetLabel: string;
  currentRound: boolean;
  issueLabel: string;
  proposalIndex: number;
  recordSource: SomInspectionRecordSource;
  currentlyApplicable: boolean;
  card: SomReviewCard;
  subjectResponse: SomInspectionSubjectResponse;
  exception?: SomInspectionException;
}

export interface SomInspectionTask {
  key: string;
  datasetId: string;
  datasetLabel: string;
  currentRound: boolean;
  issueType: SomIssueType;
  issueLabel: string;
  responseCount: number;
  agreeCount: number;
  disagreeCount: number;
  exceptionCount: number;
  currentlyApplicableCount: number;
}

export interface SomInspectionOverviewResponse {
  workspaceId: string;
  workspaceLabel: string;
  activeDatasetId: string;
  reviewers: SomInspectionReviewer[];
  selectedReviewerId?: string;
  tasks: SomInspectionTask[];
  selectedTaskKey?: string;
  items: SomInspectionItem[];
}

export interface SomInspectionMutationResult {
  ok: boolean;
  changed: boolean;
}

export interface SomCalibrationAssignmentOption {
  id: string;
  title: string;
  branch: string;
  taskLabel: string;
  status: "available" | "completed";
}

export interface SomCalibrationAssignment {
  id: string;
  title: string;
  branch: string;
  taskLabel: string;
  introduction: string;
  datasetId: string;
  datasetVersion: string;
  issueType: SomIssueType;
  consensusSnapshotId: string;
  releasedAt: string;
  cards: SomReviewCard[];
  cursor: number;
  total: number;
  responses: SomReviewHistoryItem[];
}

export interface SomCalibrationOverviewResponse {
  assignments: SomCalibrationAssignmentOption[];
  active?: SomCalibrationAssignment;
}

export interface SomCalibrationRespondResult {
  ok: boolean;
  cursor: number;
  completed: boolean;
}
