export interface RelationshipNode {
  id: string;
  title: string;
  description?: string;
  level?: number | null;
  oNetTask?: boolean | null;
  descriptionSource?: string | null;
}
export interface RelationshipAnalysis {
  nodeId: string;
  judgment: "keep" | "change" | "discuss";
  summary: string;
  meaning: string;
  currentLinks: {
    parentId: string;
    assessment: "valid" | "questionable" | "not-kind-of" | "unclear";
    reason: string;
    counterexample: string;
  }[];
  proposedParents: { nodeId: string; reason: string; whyCloser: string }[];
  alternatives: { nodeId: string; whyNotPreferred: string }[];
  example: string;
  caution: string;
  definitionConflict: string;
  referenceNodeIds: string[];
}
export interface RelationshipCase extends RelationshipNode {
  scope: string;
  currentParents: RelationshipNode[];
  children: RelationshipNode[];
  ancestors: RelationshipNode[];
  sourceIssues: unknown[];
  analysis: RelationshipAnalysis;
  challenge: {
    verdict: "supported" | "needs-discussion";
    reason: string;
    issues: string[];
  };
  mechanicalIssues: string[];
  interProposalIssues?: string[];
  responseId: string;
  requestSha256: string;
  challengeResponseId: string;
  meetingEvidence?: {
    sourceFile: string;
    sourceFileSha256: string;
    location: string;
    verbatimExcerpt: string;
    interpretationLimit: string;
  };
}
export interface RelationshipDataset {
  methodology?: "atomic-generalization-pilot-v1";
  version: string;
  createdAt: string;
  title: string;
  model: string;
  modelVersion: string;
  reasoning: string;
  fundingRoute: string;
  sourceApp: string;
  sourceCapturedAt: string;
  sourceSha256: string;
  scopeExplanation: string;
  candidateLimit: string;
  prompt: string;
  challengePrompt: string;
  promptByCase?: Record<string, string>;
  challengePromptByCase?: Record<string, string>;
  cases: RelationshipCase[];
  candidates: RelationshipNode[];
  usefulnessNote?: string;
}
export type RelationshipDecision = "agree" | "disagree" | "discuss";
export interface RelationshipFeedback {
  caseId: string;
  datasetVersion: string;
  decision: RelationshipDecision;
  note: string;
  correction: string;
  revision: number;
  savedAt: string;
  presentationSha256?: string;
  presentationVersion?: string;
}
export interface RelationshipSession {
  availableVersions?: { version: string; current: boolean; label?: string }[];
  dataset: RelationshipDataset;
  datasetSha256: string;
  reviewerKey: string;
  reviewerLabel: string;
  feedback: Record<string, RelationshipFeedback>;
  preview: boolean;
  canViewTomFeedback?: boolean;
  presentation?: RelationshipPresentation;
  presentationSha256?: string;
}
export interface RelationshipSourceEvidence {
  caseId: string;
  datasetVersion: string;
  records: {
    id: string;
    title: string;
    description: string;
    descriptionSource: string;
    alternateTitle?: string;
    alternateDescription?: string;
  }[];
  complete: boolean;
  limitation: string;
  issues: string[];
  datasetSha256?: string;
  evidenceSha256?: string;
  disclosureVersion?: string;
}
export interface RelationshipPresentation {
  version: string;
  datasetVersion: string;
  datasetSha256: string;
  selectedCaseIds: string[];
  cards: {
    caseId: string;
    eligible: boolean;
    reason: string;
    headline: string;
    whyChange: string;
    example: string;
    exampleIsIllustrative: boolean;
    quotes: { nodeId: string; quote: string }[];
    alternativeAssessment: string;
    remainingMaterialObjections: string[];
  }[];
  selectionRule: string;
  model: string;
  reasoning: string;
  fundingRoute: string;
}
