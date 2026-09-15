import type { SomAgentTrace } from "./ISomReview";

export interface TitlePromptGroup {
  title: string;
  descriptionNumbers: number[];
  reason: string;
}

export interface TitlePromptCase {
  id: string;
  title: string;
  semanticCaseId?: string;
  originalTitle?: string;
  occurrenceIds?: string[];
  input: string;
  descriptions: Array<{ number: number; text: string; oNetId?: string }>;
  groups: TitlePromptGroup[];
  reason: string;
  observations: string[];
  rawOutput: string;
  status: string;
  requestedAt: string;
  attemptId: string;
  inputSha256: string;
  outputSha256: string;
  previous?: {
    groups: TitlePromptGroup[];
    reason: string;
    trace: SomAgentTrace;
  };
  comparisonIssue?: string;
}

export interface TitlePromptStudyData {
  version: string;
  label: string;
  explanation: string;
  prompt: string;
  clarification?: string;
  outputFormat: string;
  outputSchema?: object;
  softwareChecks: string;
  promptSha256: string;
  sourceSha256: string;
  sourceFile?: string;
  collaborationUrl: string;
  model: string;
  modelVersion: string;
  reasoning: string;
  deployment: string;
  funding: string;
  costs: {
    knownUsd: number;
    unknownReservedUsd: number;
    attempts: number;
    totalTokens: number;
    asOf?: string;
  };
  cases: TitlePromptCase[];
}
