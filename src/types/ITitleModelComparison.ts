import type { TitlePromptGroup } from "./ITitlePromptStudy";

export type TitleModelId = "astra" | "sol" | "terra" | "mini";
export type TitleOptionLetter = "A" | "B" | "C" | "D";

export type TitleJudgeSeverity = "prompt-violation" | "major" | "minor";
export type TitleJudgeVerdict = TitleJudgeSeverity | "no-issues";
export type TitleJudgeRule =
  | "same-activity"
  | "supported-detail"
  | "grouping"
  | "clarity";
export type TitleSoftwareCheck =
  | "initial-verb"
  | "title-length"
  | "description-coverage";
export type TitleJudgmentStatus =
  | "valid"
  | "invalid"
  | "missing"
  | "stale"
  | "unparseable";

export interface TitleModelComparisonDescription {
  number: number;
  text: string;
}

export interface TitleModelComparisonModel {
  id: TitleModelId;
  label: string;
  model: string;
  modelVersion: string;
  reasoning: string;
  runDate: string;
  completed: number;
  groupCount: number;
  generationCostUsd: number;
}

// Committed archive: Ontology_Title_Clarity_Testbed_2026-08-28/model-comparison-2026-09-16/comparison.json
export interface TitleModelComparisonArchive {
  version: string;
  label: string;
  explanation: string;
  prompt: string;
  promptSha256: string;
  asReceivedPrompt?: string;
  wordingCorrection?: { original: string; replacement: string; reason: string };
  clarification: string;
  clarificationSha256?: string;
  outputFormat: string;
  outputSchema?: object;
  softwareChecks: string;
  sourceSha256?: string;
  sourceFile?: string;
  inputsFrom?: string;
  funding: string;
  lettersNote: string;
  models: TitleModelComparisonModel[];
  cases: Array<{
    id: string;
    title: string;
    originalTitle?: string;
    input: string;
    inputSha256: string;
    descriptions: Array<{ number: number; text: string; oNetId?: string }>;
    letters: Record<TitleOptionLetter, TitleModelId>;
  }>;
  answers: Array<{
    caseId: string;
    modelId: TitleModelId;
    status: string;
    rawOutput: string;
    outputSha256: string;
    groups: TitlePromptGroup[];
    reason: string;
    observations: string[];
    generationCostUsd?: number;
  }>;
}

export interface TitleJudgeSoftwareFinding {
  check: TitleSoftwareCheck;
  severity: TitleJudgeSeverity;
  groupNumbers: number[];
  descriptionNumbers: number[];
  explanation: string;
}

export interface TitleJudgeIssue {
  rule: TitleJudgeRule;
  severity: TitleJudgeSeverity;
  groupNumbers: number[];
  descriptionNumbers: number[];
  evidenceQuote: string;
  explanation: string;
}

export interface TitleJudgeExecution {
  runner?: string;
  model?: string;
  runDate?: string;
  method?: string;
  limitations?: string[];
  stability?: string;
}

// Committed output of ingestTitleJudgments:
// Ontology_Title_Clarity_Testbed_2026-08-28/model-comparison-2026-09-16/judge-results.json
export interface TitleJudgeResultsArchive {
  schemaVersion: string;
  judge: {
    actorId: string;
    promptVersion: string;
    schemaName: string;
    instructions: string;
    instructionsSha256?: string;
    schema: object;
    validationRules: string;
    softwareChecks: string;
    libraryFingerprint?: string;
  };
  studyVersion: string;
  execution?: (TitleJudgeExecution & Record<string, unknown>) | null;
  unjudgedAnswers: Array<{ caseId: string; answerId: string; status: string }>;
  unmatchedResponses: string[];
  judgments: Array<{
    requestId?: string;
    caseId: string;
    answerId: string;
    requestSha256?: string;
    softwareFindings: TitleJudgeSoftwareFinding[];
    status: TitleJudgmentStatus;
    validationErrors: string[];
    warnings: string[];
    modelVerdict: TitleJudgeVerdict | null;
    verdict: TitleJudgeVerdict | null;
    judgment?: { issues: TitleJudgeIssue[]; summary: string };
    rawText?: string;
  }>;
}

// Page props. Hashes, request identifiers, raw model text, and the library
// fingerprint are removed because statically generated props are public.
export interface TitleModelComparisonIssue extends TitleJudgeIssue {
  quoteUnmatched: boolean;
}

export interface TitleModelComparisonJudgment {
  status: TitleJudgmentStatus;
  verdict: TitleJudgeVerdict | null;
  softwareFindings: TitleJudgeSoftwareFinding[];
  issues: TitleModelComparisonIssue[];
  summary: string;
  // A quote warning that could not be attached to a specific issue.
  otherQuoteWarning: boolean;
}

export interface TitleModelComparisonOption {
  letter: TitleOptionLetter;
  modelId: TitleModelId;
  status: string;
  groups: TitlePromptGroup[];
  reason: string;
  observations: string[];
  judgment: TitleModelComparisonJudgment;
}

export interface TitleModelComparisonCase {
  id: string;
  title: string;
  originalTitle?: string;
  descriptions: TitleModelComparisonDescription[];
  options: TitleModelComparisonOption[];
}

export interface TitleModelComparisonData {
  version: string;
  label: string;
  explanation: string;
  prompt: string;
  wordingCorrection?: { original: string; replacement: string; reason: string };
  clarification: string;
  outputFormat: string;
  softwareChecks: string;
  funding: string;
  lettersNote: string;
  models: TitleModelComparisonModel[];
  cases: TitleModelComparisonCase[];
  judge: {
    promptVersion: string;
    instructions: string;
    schema: object;
    validationRules: string;
    softwareChecks: string;
  };
  execution: TitleJudgeExecution | null;
}
