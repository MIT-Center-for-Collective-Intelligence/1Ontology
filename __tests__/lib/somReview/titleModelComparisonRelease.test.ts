import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  titleModelComparisonJudgeResultsPath,
  titleModelComparisonPath,
  titleModelComparisonRelease,
} from "../../../src/lib/somReview/titleModelComparisonRelease";

const sha256 = (data: string | Buffer) =>
  crypto.createHash("sha256").update(data).digest("hex");
const bundleBytes = fs.readFileSync(
  path.join(process.cwd(), titleModelComparisonPath),
);
const judgeBytes = fs.readFileSync(
  path.join(process.cwd(), titleModelComparisonJudgeResultsPath),
);
const bundle = JSON.parse(bundleBytes.toString("utf8"));
const judge = JSON.parse(judgeBytes.toString("utf8"));
const clone = (value: any) => JSON.parse(JSON.stringify(value));

function serve(bundleData: any, judgeData: any) {
  const realRead = fs.readFileSync;
  jest.spyOn(fs, "readFileSync").mockImplementation(((file: any, ...rest: any[]) => {
    const name = String(file);
    if (name.endsWith(titleModelComparisonPath))
      return Buffer.from(JSON.stringify(bundleData));
    if (name.endsWith(titleModelComparisonJudgeResultsPath))
      return Buffer.from(JSON.stringify(judgeData));
    return (realRead as any)(file, ...rest);
  }) as any);
}

afterEach(() => jest.restoreAllMocks());

it("identifies the exact committed four-model comparison and judge results", () => {
  expect(titleModelComparisonRelease()).toEqual({
    version: "rob-very-short-prompt-model-comparison-2026-09-16-v1",
    cases: 18,
    answers: 72,
    judgments: 72,
    validJudgments: judge.judgments.filter(
      (j: { status: string }) => j.status === "valid",
    ).length,
    judgePromptVersion: "title-clarification-judge-2026-09-16-v1",
    judgeLibraryFingerprint: judge.judge.libraryFingerprint,
    bundleSha256: sha256(bundleBytes),
    judgeResultsSha256: sha256(judgeBytes),
  });
  expect(titleModelComparisonRelease().judgeLibraryFingerprint).toMatch(
    /^[a-f0-9]{64}$/,
  );
});

it("counts valid judgments and hashes the exact served bytes", () => {
  const judged = clone(judge);
  for (const judgment of judged.judgments) judgment.status = "missing";
  judged.judgments[0].status = "valid";
  judged.judgments[5].status = "valid";
  judged.judgments[6].status = "invalid";
  serve(bundle, judged);
  expect(titleModelComparisonRelease()).toEqual(
    expect.objectContaining({
      validJudgments: 2,
      bundleSha256: sha256(Buffer.from(JSON.stringify(bundle))),
      judgeResultsSha256: sha256(Buffer.from(JSON.stringify(judged))),
    }),
  );
});

const broken: Array<[string, (b: any, j: any) => void]> = [
  ["a different version", (b) => (b.version = "another-comparison-v2")],
  ["17 cases", (b) => b.cases.pop()],
  ["3 models", (b) => b.models.pop()],
  ["a duplicated case id", (b) => (b.cases[1].id = b.cases[0].id)],
  ["a pending answer", (b) => (b.answers[10].status = "pending")],
  ["a missing answer", (b) => b.answers.pop()],
  [
    "a duplicated answer",
    (b) => (b.answers[1] = { ...b.answers[0] }),
  ],
  ["a changed prompt", (b) => (b.prompt = `${b.prompt} Changed.`)],
  ["a missing judgment", (_b, j) => j.judgments.pop()],
  [
    "a duplicated judgment",
    (_b, j) => (j.judgments[1] = { ...j.judgments[0] }),
  ],
  [
    "a judgment for an unknown answer",
    (_b, j) => (j.judgments[3].answerId = "another-model"),
  ],
  ["a studyVersion mismatch", (_b, j) => (j.studyVersion = "another-study")],
  ["no judge prompt version", (_b, j) => delete j.judge.promptVersion],
];

it.each(broken)("rejects %s", (_label, mutate) => {
  const b = clone(bundle);
  const j = clone(judge);
  mutate(b, j);
  serve(b, j);
  expect(() => titleModelComparisonRelease()).toThrow(
    "Title model comparison is incomplete or mismatched",
  );
});
