import fs from "fs";
import path from "path";
import crypto from "crypto";

export const titleModelComparisonPath =
  "Ontology_Title_Clarity_Testbed_2026-08-28/model-comparison-2026-09-16/comparison.json";
export const titleModelComparisonJudgeResultsPath =
  "Ontology_Title_Clarity_Testbed_2026-08-28/model-comparison-2026-09-16/judge-results.json";

export const titleModelComparisonVersion =
  "rob-very-short-prompt-model-comparison-2026-09-16-v1";

const CASES = 18;
const MODELS = 4;

const sha256 = (data: string | Buffer) =>
  crypto.createHash("sha256").update(data).digest("hex");

type Answer = { caseId: string; modelId: string; status: string };
type Judgment = { caseId: string; answerId: string; status: string };

const pairKey = (caseId: unknown, modelId: unknown) =>
  JSON.stringify([caseId, modelId]);

function mismatched(): never {
  throw new Error("Title model comparison is incomplete or mismatched");
}

// Release identity for the committed four-model comparison and its judging
// agent results. Reads only the committed archive; never calls a model.
export function titleModelComparisonRelease() {
  const bundleBytes = fs.readFileSync(
    path.join(process.cwd(), titleModelComparisonPath),
  );
  const judgeBytes = fs.readFileSync(
    path.join(process.cwd(), titleModelComparisonJudgeResultsPath),
  );
  const data = JSON.parse(bundleBytes.toString("utf8"));
  const judge = JSON.parse(judgeBytes.toString("utf8"));

  if (
    data?.version !== titleModelComparisonVersion ||
    !Array.isArray(data.cases) ||
    !Array.isArray(data.models) ||
    !Array.isArray(data.answers) ||
    data.cases.length !== CASES ||
    data.models.length !== MODELS ||
    data.answers.length !== CASES * MODELS ||
    typeof data.prompt !== "string" ||
    sha256(data.prompt) !== data.promptSha256
  )
    mismatched();

  const caseIds = new Set(data.cases.map((c: { id: string }) => c.id));
  const modelIds = new Set(data.models.map((m: { id: string }) => m.id));
  if (caseIds.size !== CASES || modelIds.size !== MODELS) mismatched();

  // Exactly one completed answer for every (case, model) pair.
  const answerKeys = new Set<string>();
  for (const answer of data.answers as Answer[]) {
    const key = pairKey(answer?.caseId, answer?.modelId);
    if (
      answer?.status !== "completed" ||
      !caseIds.has(answer.caseId) ||
      !modelIds.has(answer.modelId) ||
      answerKeys.has(key)
    )
      mismatched();
    answerKeys.add(key);
  }

  // Exactly one judgment for every answer, recorded for this study version.
  if (
    judge?.studyVersion !== data.version ||
    typeof judge.judge?.promptVersion !== "string" ||
    typeof judge.judge?.libraryFingerprint !== "string" ||
    !Array.isArray(judge.judgments) ||
    judge.judgments.length !== data.answers.length
  )
    mismatched();
  const judgedKeys = new Set<string>();
  for (const judgment of judge.judgments as Judgment[]) {
    const key = pairKey(judgment?.caseId, judgment?.answerId);
    if (!answerKeys.has(key) || judgedKeys.has(key)) mismatched();
    judgedKeys.add(key);
  }

  return {
    version: data.version as string,
    cases: data.cases.length as number,
    answers: data.answers.length as number,
    judgments: judge.judgments.length as number,
    validJudgments: (judge.judgments as Judgment[]).filter(
      (judgment) => judgment.status === "valid",
    ).length,
    judgePromptVersion: judge.judge?.promptVersion as string,
    judgeLibraryFingerprint: judge.judge?.libraryFingerprint as string,
    bundleSha256: sha256(bundleBytes),
    judgeResultsSha256: sha256(judgeBytes),
  };
}
