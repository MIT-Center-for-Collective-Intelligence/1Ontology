import type {
  PeerFeedback,
  PeerFeedbackQuery,
  PeerFeedbackResponse,
  PeerReviewer,
  RelationshipDecision,
  RelationshipFeedback,
  RelationshipNode,
  SavePeerFeedbackRequest,
} from './IRelationshipReview';

export const GENERALIZATION_BRANCH_VERSION =
  'generalization-branches-20261024-v1' as const;

export type BranchAction =
  | 'branch-session'
  | 'branch-save'
  | 'branch-trace'
  | 'branch-context'
  | 'branch-peer-feedback'
  | 'branch-save-peer';

export type BranchMemberDecision = 'include' | 'hold' | 'exclude';
export type BranchTitleDependency =
  | 'none-observed'
  | 'recheck-after-title-change'
  | 'requires-title-clarification';

export interface BranchMember {
  node: RelationshipNode;
  decision: BranchMemberDecision;
  reason: string;
  titleDependency: BranchTitleDependency;
  /** Complete frozen direct Generalizations, including independent parents. */
  currentGeneralizations: RelationshipNode[];
  nounEvidenceNote: string;
  sourceRecords: RelationshipNode[];
}

export interface BranchGroup {
  id: string;
  node: RelationshipNode;
  summary: string;
  coherence: string;
  eligible: boolean;
  /** Includes held and excluded raw candidates; never filtered by the loader. */
  members: BranchMember[];
  remainingQuestions: string[];
}

export interface BranchFamily {
  /** The frozen graph ID of the higher-level family root; also the review caseId. */
  id: string;
  title: string;
  description: string;
  generalizations: RelationshipNode[];
  currentSpecializations: RelationshipNode[];
  currentSourceRecords: RelationshipNode[];
  summary: string;
  scopeNote: string;
  groups: BranchGroup[];
  sourceCaseIds: string[];
  remainingQuestions: string[];
}

export interface BranchDataset {
  schemaVersion: 'generalization-branch-review-v1';
  version: string;
  title: string;
  createdAt: string;
  model: string;
  modelVersion: string;
  reasoning: string;
  fundingRoute: string;
  sourceApp: string;
  sourceCapturedAt: string;
  sourceRecheckedAt: string;
  sourceSha256: string;
  priorDatasetVersion: string;
  priorDatasetSha256: string;
  scopeNote: string;
  titleStatusNote: string;
  nounNote: string;
  /** Prompt templates only. Expanded private review inputs belong in traces. */
  prompt: string;
  criticPrompts: string[];
  families: BranchFamily[];
}

export interface BranchSession {
  dataset: BranchDataset;
  datasetSha256: string;
  reviewerKey: string;
  reviewerLabel: string;
  /** A vote judges the entire family arrangement, not an earlier child case. */
  feedback: Record<string, RelationshipFeedback>;
  preview: boolean;
  peerReviewer: PeerReviewer | null;
  canViewPeerFeedback: boolean;
  legacy: { version: string; sha256: string };
}

export interface BranchSessionRequest {
  datasetVersion?: string;
  datasetSha256?: string;
}

export interface BranchSaveRequest {
  caseId: string;
  datasetVersion: string;
  datasetSha256: string;
  reviewerKey: string;
  decision: RelationshipDecision;
  revisitLater?: boolean;
  note: string;
  correction: string;
  revision: number;
  requestId: string;
}

export interface BranchSaveResponse {
  answer: RelationshipFeedback;
}

export type BranchPeerFeedbackQuery = PeerFeedbackQuery;
export type BranchSavePeerRequest = SavePeerFeedbackRequest;
export type BranchPeerFeedbackResponse = PeerFeedbackResponse;
export interface BranchSavePeerResponse { answer: PeerFeedback }

export interface BranchContextRequest extends PeerFeedbackQuery {
  focusId?: string;
  activityOffset?: number;
  sourceOffset?: number;
  limit?: number;
}

export interface BranchPage<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
  nextOffset: number | null;
}

export interface BranchContext {
  caseId: string;
  datasetVersion: string;
  datasetSha256: string;
  sourceSha256: string;
  focus: RelationshipNode;
  generalizations: RelationshipNode[];
  specializations: BranchPage<RelationshipNode>;
  sources: BranchPage<RelationshipNode>;
  siblings: BranchPage<RelationshipNode>;
  limitations: string[];
}

export interface BranchContextResponse { context: BranchContext }

export type BranchJsonValue =
  | null | boolean | number | string | BranchJsonValue[] | BranchJsonObject;
export interface BranchJsonObject { [key: string]: BranchJsonValue }

/** Private release-derived coverage receipts, not additional model-output fields.
 * Requests/results remain untouched provider JSON bodies. The release producer
 * is responsible for extracting these receipts faithfully, not this loader. */
export interface BranchTraceCoverage {
  groupId: string;
  memberIds: string[];
  unresolvedMaterialObjections: string[];
}

export interface BranchTraceRun {
  status: 'completed' | 'pending' | 'failed';
  request: BranchJsonObject | null;
  result: BranchJsonObject | null;
  /** Original request aliases -> frozen graph IDs; never reconstructed. */
  aliasMap: Record<string, string>;
  coverage: BranchTraceCoverage[];
}

export interface BranchTraceProvenance {
  sourceApp: string;
  sourceCapturedAt: string;
  sourceRecheckedAt: string;
  sourceSha256: string;
  priorDatasetVersion: string;
  priorDatasetSha256: string;
  sourceCaseIds: string[];
}

export interface BranchFamilyTrace {
  schemaVersion: 'private-generalization-branch-trace-v1';
  familyId: string;
  datasetVersion: string;
  fundingRoute: 'ACCESS';
  source: BranchTraceProvenance;
  /** Private provenance may include prior review inputs; never in BranchDataset. */
  promptProvenance: BranchJsonObject;
  author: BranchTraceRun;
  critics: [BranchTraceRun, BranchTraceRun];
}

export interface BranchTraceResponse {
  trace: BranchFamilyTrace;
  caseId: string;
  datasetVersion: string;
  datasetSha256: string;
}
