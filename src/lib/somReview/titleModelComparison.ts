import type {
  TitleJudgeExecution,
  TitleJudgeIssue,
  TitleJudgeResultsArchive,
  TitleJudgeRule,
  TitleJudgeSeverity,
  TitleJudgeSoftwareFinding,
  TitleJudgeVerdict,
  TitleJudgmentStatus,
  TitleModelComparisonArchive,
  TitleModelComparisonData,
  TitleModelComparisonJudgment,
  TitleModelComparisonModel,
  TitleModelComparisonOption,
  TitleOptionLetter,
  TitleSoftwareCheck,
} from "../../types/ITitleModelComparison";
import type { TitlePromptGroup } from "../../types/ITitlePromptStudy";

export const OPTION_LETTERS: TitleOptionLetter[] = ["A", "B", "C", "D"];
const EXPECTED_CASES = 18;
const SEVERITY_ORDER: TitleJudgeSeverity[] = ["prompt-violation", "major", "minor"];
const RULES: TitleJudgeRule[] = ["same-activity", "supported-detail", "grouping", "clarity"];
const CHECKS: TitleSoftwareCheck[] = ["initial-verb", "title-length", "description-coverage"];
const STATUSES: TitleJudgmentStatus[] = ["valid", "invalid", "missing", "stale", "unparseable"];

export const VERDICT_LABELS: Record<TitleJudgeVerdict | "unavailable", string> = {
  "prompt-violation": "Prompt violation",
  major: "Major issue",
  minor: "Minor issue",
  "no-issues": "No issues found",
  unavailable: "Judgment unavailable",
};

export const VERDICT_COLORS: Record<
  TitleJudgeVerdict | "unavailable",
  "error" | "warning" | "info" | "success" | "default"
> = {
  "prompt-violation": "error",
  major: "warning",
  minor: "info",
  "no-issues": "success",
  unavailable: "default",
};

export const RULE_LABELS: Record<TitleJudgeRule, string> = {
  "same-activity": "Different or added activity",
  "supported-detail": "Unsupported detail",
  grouping: "Grouping",
  clarity: "Unclear title",
};

export const CHECK_LABELS: Record<TitleSoftwareCheck, string> = {
  "initial-verb": "Initial verb changed",
  "title-length": "Title length",
  "description-coverage": "Description coverage",
};

export type TitleVerdictKey = TitleJudgeVerdict | "unavailable";
export const VERDICT_KEYS: TitleVerdictKey[] = [
  "prompt-violation",
  "major",
  "minor",
  "no-issues",
  "unavailable",
];

export const verdictKey = (verdict: TitleJudgeVerdict | null): TitleVerdictKey =>
  verdict || "unavailable";

export function countVerdicts(
  options: Array<Pick<TitleModelComparisonOption, "judgment">>,
): Record<TitleVerdictKey, number> {
  const counts = Object.fromEntries(VERDICT_KEYS.map((key) => [key, 0])) as Record<
    TitleVerdictKey,
    number
  >;
  for (const option of options) counts[verdictKey(option.judgment.verdict)] += 1;
  return counts;
}

export function reasoningLabel(reasoning: string): string {
  return reasoning === "max" ? "Max reasoning" : `${reasoning} reasoning`;
}

export function modelDisplayName(model: Pick<TitleModelComparisonModel, "label" | "reasoning">) {
  return `${model.label} (${reasoningLabel(model.reasoning)})`;
}

// "Group 2: Inspect Workplace Safety"; a number outside the proposal keeps only its number.
export function citedGroupLabels(groups: TitlePromptGroup[], groupNumbers: number[]): string[] {
  return groupNumbers.map((number) => {
    const group = Number.isInteger(number) && number >= 1 ? groups[number - 1] : undefined;
    return group ? `Group ${number}: ${group.title}` : `Group ${number}`;
  });
}

// Group numbers cited by any software finding, and by model-judge issues when the judgment is valid.
export function citedGroupNumbers(judgment: TitleModelComparisonJudgment): Set<number> {
  return new Set(
    [...judgment.softwareFindings, ...judgment.issues].flatMap((finding) => finding.groupNumbers),
  );
}

function misaligned(message: string): never {
  throw new Error(`The model comparison cannot be shown: ${message}`);
}

const pairKey = (caseId: string, modelId: string) => JSON.stringify([caseId, modelId]);

const mostSevere = (findings: Array<{ severity: TitleJudgeSeverity }>): TitleJudgeVerdict => {
  const present = new Set(findings.map((finding) => finding.severity));
  return SEVERITY_ORDER.find((severity) => present.has(severity)) || "no-issues";
};

const numbersWithin = (numbers: unknown, valid: (number: number) => boolean) =>
  Array.isArray(numbers) &&
  new Set(numbers).size === numbers.length &&
  numbers.every((number) => Number.isInteger(number) && valid(number));

type EarlierStudy = {
  cases: Array<{
    id: string;
    title: string;
    originalTitle?: string;
    inputSha256: string;
    descriptions: Array<{ number: number; text: string; oNetId?: string }>;
  }>;
};

function pickExecution(execution: TitleJudgeResultsArchive["execution"]): TitleJudgeExecution | null {
  if (!execution || typeof execution !== "object") return null;
  const picked: TitleJudgeExecution = {};
  for (const field of ["runner", "model", "runDate", "method", "stability"] as const) {
    const value = execution[field];
    if (typeof value === "string" && value.trim()) picked[field] = value;
  }
  if (Array.isArray(execution.limitations)) {
    const limitations = execution.limitations.filter(
      (item): item is string => typeof item === "string" && Boolean(item.trim()),
    );
    if (limitations.length) picked.limitations = limitations;
  }
  return Object.keys(picked).length ? picked : null;
}

/**
 * Joins the committed four-model archive, the judging-agent results, and the
 * September 14 study inputs into trimmed page props. Any mismatch throws so a
 * build fails rather than showing a proposal next to the wrong evidence or
 * the wrong judgment.
 */
export function buildTitleModelComparison(
  archive: TitleModelComparisonArchive,
  judgeResults: TitleJudgeResultsArchive,
  earlierStudy: EarlierStudy,
): TitleModelComparisonData {
  if (
    !archive ||
    !Array.isArray(archive.cases) ||
    !Array.isArray(archive.answers) ||
    !Array.isArray(archive.models)
  )
    misaligned("the comparison archive is incomplete.");
  if (!judgeResults || !Array.isArray(judgeResults.judgments) || !judgeResults.judge)
    misaligned("the judging agent results are incomplete.");
  if (judgeResults.studyVersion !== archive.version)
    misaligned("the judging agent results belong to a different comparison.");

  const modelIds = archive.models.map((model) => model.id);
  if (modelIds.length !== OPTION_LETTERS.length || new Set(modelIds).size !== modelIds.length)
    misaligned("four distinct model configurations are required.");
  const sortedModelIds = JSON.stringify([...modelIds].sort());

  if (archive.cases.length !== EXPECTED_CASES)
    misaligned(`expected ${EXPECTED_CASES} examples, found ${archive.cases.length}.`);
  if (!earlierStudy || !Array.isArray(earlierStudy.cases) || earlierStudy.cases.length !== archive.cases.length)
    misaligned("the examples differ from the September 14 study.");
  if (new Set(archive.cases.map((item) => item.id)).size !== archive.cases.length)
    misaligned("example identifiers repeat.");

  archive.cases.forEach((item, index) => {
    const earlier = earlierStudy.cases[index];
    for (const field of ["id", "title", "originalTitle", "inputSha256"] as const)
      if (item[field] !== earlier[field])
        misaligned(`example ${index + 1} has a different ${field} from the September 14 study.`);
    if (JSON.stringify(item.descriptions) !== JSON.stringify(earlier.descriptions))
      misaligned(`example ${index + 1} has different descriptions from the September 14 study.`);
    const letters = item.letters || ({} as Record<string, string>);
    if (
      JSON.stringify(Object.keys(letters).sort()) !== JSON.stringify(OPTION_LETTERS) ||
      JSON.stringify(Object.values(letters).sort()) !== sortedModelIds
    )
      misaligned(`the option letters for ${item.id} do not match the four models.`);
  });

  const caseIds = new Set(archive.cases.map((item) => item.id));
  const answers = new Map<string, TitleModelComparisonArchive["answers"][number]>();
  for (const answer of archive.answers) {
    if (!caseIds.has(answer?.caseId) || !modelIds.includes(answer?.modelId))
      misaligned("an answer belongs to an unknown example or model.");
    const key = pairKey(answer.caseId, answer.modelId);
    if (answers.has(key)) misaligned(`${answer.caseId} has more than one ${answer.modelId} answer.`);
    if (!Array.isArray(answer.groups) || !Array.isArray(answer.observations))
      misaligned(`${answer.caseId} has an unreadable ${answer.modelId} answer.`);
    answers.set(key, answer);
  }
  if (answers.size !== archive.cases.length * modelIds.length)
    misaligned("each example needs exactly one answer from each model.");
  for (const model of archive.models) {
    const groupCount = archive.answers
      .filter((answer) => answer.modelId === model.id)
      .reduce((total, answer) => total + answer.groups.length, 0);
    if (model.groupCount !== groupCount)
      misaligned(`the proposed group count for ${model.label} does not match its answers.`);
  }

  const judgments = new Map<string, TitleJudgeResultsArchive["judgments"][number]>();
  for (const record of judgeResults.judgments) {
    const key = pairKey(record?.caseId, record?.answerId);
    if (!answers.has(key)) misaligned("a judgment does not match any answer.");
    if (judgments.has(key))
      misaligned(`${record.caseId} has more than one judgment for the same answer.`);
    judgments.set(key, record);
  }
  if (judgments.size !== answers.size) misaligned("every answer needs exactly one judgment.");

  const trimJudgment = (
    record: TitleJudgeResultsArchive["judgments"][number],
    answer: TitleModelComparisonArchive["answers"][number],
    descriptionNumbers: Set<number>,
  ): TitleModelComparisonJudgment => {
    const where = `the judgment for ${record.caseId}`;
    const groupCount = answer.groups.length;
    const inGroups = (number: number) => number >= 1 && number <= groupCount;
    if (!STATUSES.includes(record.status)) misaligned(`${where} has an unknown status.`);
    if (!Array.isArray(record.softwareFindings)) misaligned(`${where} has no software findings list.`);
    const softwareFindings = record.softwareFindings.map((finding): TitleJudgeSoftwareFinding => {
      if (
        !CHECKS.includes(finding?.check) ||
        !SEVERITY_ORDER.includes(finding?.severity) ||
        !numbersWithin(finding.groupNumbers, inGroups) ||
        !numbersWithin(finding.descriptionNumbers, () => true) ||
        typeof finding.explanation !== "string"
      )
        misaligned(`${where} has a software finding outside this proposal.`);
      return {
        check: finding.check,
        severity: finding.severity,
        groupNumbers: [...finding.groupNumbers],
        descriptionNumbers: [...finding.descriptionNumbers],
        explanation: finding.explanation,
      };
    });
    if (record.status !== "valid") {
      if (record.verdict !== null) misaligned(`${where} has a verdict without a valid judgment.`);
      return {
        status: record.status,
        verdict: null,
        softwareFindings,
        issues: [],
        summary: "",
        otherQuoteWarning: false,
      };
    }
    const judgment = record.judgment;
    if (!judgment || !Array.isArray(judgment.issues) || typeof judgment.summary !== "string")
      misaligned(`${where} is marked valid but has no judgment.`);
    const warnings = Array.isArray(record.warnings) ? record.warnings : [];
    const placedWarnings = new Set<string>();
    const issues = judgment.issues.map((issue: TitleJudgeIssue, index) => {
      if (
        !RULES.includes(issue?.rule) ||
        !SEVERITY_ORDER.includes(issue?.severity) ||
        !Array.isArray(issue.groupNumbers) ||
        !issue.groupNumbers.length ||
        !numbersWithin(issue.groupNumbers, inGroups) ||
        !numbersWithin(issue.descriptionNumbers, (number) => descriptionNumbers.has(number)) ||
        typeof issue.evidenceQuote !== "string" ||
        typeof issue.explanation !== "string"
      )
        misaligned(`${where} cites a group or description outside this proposal.`);
      const warning = warnings.find((text) => text.startsWith(`Issue ${index + 1} quotes`));
      if (warning) placedWarnings.add(warning);
      return {
        rule: issue.rule,
        severity: issue.severity,
        groupNumbers: [...issue.groupNumbers],
        descriptionNumbers: [...issue.descriptionNumbers],
        evidenceQuote: issue.evidenceQuote,
        explanation: issue.explanation,
        quoteUnmatched: Boolean(warning),
      };
    });
    const verdict = mostSevere([...softwareFindings, ...issues]);
    if (record.verdict !== verdict) misaligned(`${where} has a verdict that does not match its findings.`);
    return {
      status: "valid",
      verdict,
      softwareFindings,
      issues,
      summary: judgment.summary,
      otherQuoteWarning: warnings.some((text) => !placedWarnings.has(text)),
    };
  };

  const cases = archive.cases.map((item) => {
    const descriptionNumbers = new Set(item.descriptions.map((description) => description.number));
    return {
      id: item.id,
      title: item.title,
      ...(typeof item.originalTitle === "string" ? { originalTitle: item.originalTitle } : {}),
      descriptions: item.descriptions.map(({ number, text }) => ({ number, text })),
      options: OPTION_LETTERS.map((letter): TitleModelComparisonOption => {
        const modelId = item.letters[letter];
        const key = pairKey(item.id, modelId);
        const answer = answers.get(key)!;
        return {
          letter,
          modelId,
          status: answer.status,
          groups: answer.groups.map((group) => ({
            title: group.title,
            descriptionNumbers: [...group.descriptionNumbers],
            reason: group.reason,
          })),
          reason: answer.reason || "",
          observations: [...answer.observations],
          judgment: trimJudgment(judgments.get(key)!, answer, descriptionNumbers),
        };
      }),
    };
  });

  const { judge } = judgeResults;
  return {
    version: archive.version,
    label: archive.label,
    explanation: archive.explanation,
    prompt: archive.prompt,
    ...(archive.wordingCorrection
      ? {
          wordingCorrection: {
            original: archive.wordingCorrection.original,
            replacement: archive.wordingCorrection.replacement,
            reason: archive.wordingCorrection.reason,
          },
        }
      : {}),
    clarification: archive.clarification,
    outputFormat: archive.outputFormat,
    softwareChecks: archive.softwareChecks,
    funding: archive.funding,
    lettersNote: archive.lettersNote,
    models: archive.models.map((model) => ({
      id: model.id,
      label: model.label,
      model: model.model,
      modelVersion: model.modelVersion,
      reasoning: model.reasoning,
      runDate: model.runDate,
      completed: model.completed,
      groupCount: model.groupCount,
      generationCostUsd: model.generationCostUsd,
    })),
    cases,
    judge: {
      promptVersion: judge.promptVersion,
      instructions: judge.instructions,
      schema: judge.schema,
      validationRules: judge.validationRules,
      softwareChecks: judge.softwareChecks,
    },
    execution: pickExecution(judgeResults.execution),
  };
}
