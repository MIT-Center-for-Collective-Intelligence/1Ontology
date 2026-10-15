export type TitleAdequacy = "adequate" | "needs_work" | "unsure";
export type TitleCreationDecision = "keep" | "clarify" | "split";
export interface TitleValidationOption {
  id: string;
  titles: string[];
}
export interface TitleValidationTask {
  caseId: string;
  currentTitle: string;
  description: string;
  stage: "create" | "evaluate";
  options?: TitleValidationOption[];
}
export interface TitleValidationSession {
  studyId: string;
  datasetVersion: string;
  studyStatus: "draft" | "active" | "paused" | "closed";
  reviewerLabel: string;
  reviewerKey: string;
  phase: "create" | "evaluate" | "waiting" | "complete" | "unassigned";
  progress: {
    creationDone: number;
    creationTotal: number;
    evaluationDone: number;
    evaluationTotal: number;
  };
  task?: TitleValidationTask;
  canManage: boolean;
  preview: boolean;
  message?: string;
  disclosure?: {
    model: string;
    fundingRoute: string;
    prompt: string;
    promptSha256: string;
    sourceSnapshotSha256: string;
    selection: string;
  };
}
export interface TitleValidationCreationInput {
  kind: "create";
  caseId: string;
  decision: TitleCreationDecision;
  titles: string[];
  confidence: number;
  notes: string;
  activeTimeMs: number;
  submissionId: string;
}
export interface TitleValidationEvaluationInput {
  kind: "evaluate";
  caseId: string;
  ratings: { optionId: string; adequacy: TitleAdequacy; rank: number | null }[];
  cannotRank: boolean;
  confidence: number;
  notes: string;
  activeTimeMs: number;
  submissionId: string;
}
export type TitleValidationSubmission =
  | TitleValidationCreationInput
  | TitleValidationEvaluationInput;
export interface TitleValidationDashboard {
  studyId: string;
  status: "draft" | "active" | "paused" | "closed";
  caseCount: number;
  reviewerCount: number;
  completedCreations: number;
  completedEvaluations: number;
  expectedEvaluations: number;
  byReviewer: {
    label: string;
    creationDone: number;
    creationTotal: number;
    evaluationDone: number;
    evaluationTotal: number;
  }[];
  byOutcome: { outcome: string; cases: number; completedEvaluations: number }[];
  comparisons: {
    source: string;
    judgments: number;
    adequate: number;
    needsWork: number;
    unsure: number;
    preferredOrTied: number;
  }[];
  medianCreationActiveSeconds: number | null;
  medianEvaluationActiveSeconds: number | null;
  disagreementCases: number;
  activityDetails: {
    caseId: string;
    currentTitle: string;
    description: string;
    modelTitles: string[];
    human: {
      reviewerLabel: string;
      titles: string[];
      confidence: number;
    } | null;
    evaluations: {
      reviewerLabel: string;
      confidence: number;
      activeSeconds: number;
      alternatives: {
        titles: string[];
        sources: string[];
        adequacy: TitleAdequacy;
        rank: number | null;
      }[];
    }[];
  }[];
  notes: {
    caseId: string;
    currentTitle: string;
    reviewerLabel: string;
    stage: string;
    text: string;
  }[];
  caution: string;
}
