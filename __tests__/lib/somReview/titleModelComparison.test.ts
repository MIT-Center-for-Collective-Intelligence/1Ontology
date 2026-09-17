import fs from "fs";
import path from "path";
import {
  buildTitleModelComparison,
  citedGroupLabels,
  citedGroupNumbers,
  countVerdicts,
  modelDisplayName,
} from "../../../src/lib/somReview/titleModelComparison";
import type {
  TitleJudgeResultsArchive,
  TitleModelComparisonArchive,
} from "../../../src/types/ITitleModelComparison";

const root = path.join(process.cwd(), "Ontology_Title_Clarity_Testbed_2026-08-28");
const readJson = (file: string) =>
  JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const archive: TitleModelComparisonArchive = readJson(
  "model-comparison-2026-09-16/comparison.json",
);
const judgeResults: TitleJudgeResultsArchive = readJson(
  "model-comparison-2026-09-16/judge-results.json",
);
const earlierStudy = readJson("prompt-study-2026-09-14/bundle.json");
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

// A valid judgment with one issue for case-5 / sol, built from the real answer
// so its group and description numbers are in range.
function withValidJudgment(results: TitleJudgeResultsArchive) {
  const copy = clone(results);
  const record = copy.judgments.find(
    (item) => item.caseId === "case-5" && item.answerId === "sol",
  )!;
  const answer = archive.answers.find(
    (item) => item.caseId === "case-5" && item.modelId === "sol",
  )!;
  expect(answer.groups.length).toBeGreaterThan(0);
  record.status = "valid";
  record.validationErrors = [];
  record.warnings = ["Issue 1 quotes words that were not found in the linked descriptions."];
  record.judgment = {
    issues: [
      {
        rule: "same-activity",
        severity: "prompt-violation",
        groupNumbers: [1],
        descriptionNumbers: [answer.groups[0].descriptionNumbers[0]],
        evidenceQuote: "calibration drift",
        explanation: "The title adds a separate activity.",
      },
    ],
    summary: "One prompt violation.",
  };
  record.modelVerdict = "prompt-violation";
  record.verdict = "prompt-violation";
  record.rawText = JSON.stringify(record.judgment);
  return { copy, answer };
}

describe("four-model title comparison with judging agent results", () => {
  it("builds the committed archive in A–D option order for all 18 examples", () => {
    const original = JSON.stringify([archive, judgeResults, earlierStudy]);
    const data = buildTitleModelComparison(archive, judgeResults, earlierStudy);
    expect(data.cases).toHaveLength(18);
    expect(data.cases.map((item) => item.id)).toEqual(
      earlierStudy.cases.map((item: { id: string }) => item.id),
    );
    data.cases.forEach((item, index) => {
      const source = archive.cases[index];
      expect(item.options.map((option) => option.letter)).toEqual(["A", "B", "C", "D"]);
      for (const option of item.options) {
        expect(option.modelId).toBe(source.letters[option.letter]);
        const answer = archive.answers.find(
          (candidate) =>
            candidate.caseId === item.id && candidate.modelId === option.modelId,
        )!;
        expect(option.groups).toEqual(answer.groups);
        expect(option.observations).toEqual(answer.observations);
      }
      expect(new Set(item.options.map((option) => option.modelId)).size).toBe(4);
    });
    expect(data.models.map((model) => modelDisplayName(model))).toEqual([
      "GPT-6 Astra (Max reasoning)",
      "GPT-5.6 Sol (medium reasoning)",
      "GPT-5.6 Terra (medium reasoning)",
      "GPT-5.4 Mini (medium reasoning)",
    ]);
    expect(
      countVerdicts(data.cases.flatMap((item) => item.options)),
    ).toEqual(
      expect.objectContaining({
        "prompt-violation": expect.any(Number),
        unavailable: expect.any(Number),
      }),
    );
    expect(JSON.stringify([archive, judgeResults, earlierStudy])).toBe(original);
  });

  it("keeps hashes, request identifiers, raw text and fingerprints out of page props", () => {
    const { copy } = withValidJudgment(judgeResults);
    const props = JSON.stringify(buildTitleModelComparison(archive, copy, earlierStudy));
    for (const field of [
      "rawOutput",
      "outputSha256",
      "inputSha256",
      "requestSha256",
      "requestId",
      "rawText",
      "instructionsSha256",
      "libraryFingerprint",
      "promptSha256",
      "clarificationSha256",
      "sourceSha256",
    ])
      expect(props).not.toContain(`"${field}"`);
    expect(props).not.toContain('"input"');
    expect(props).not.toMatch(/[a-f0-9]{64}/);
    expect(props).not.toContain(judgeResults.judgments[0].requestId as string);
    expect(Buffer.byteLength(props)).toBeLessThan(200_000);
  });

  it("carries a valid judgment with its issues and resolves cited group titles", () => {
    const { copy, answer } = withValidJudgment(judgeResults);
    const data = buildTitleModelComparison(archive, copy, earlierStudy);
    const option = data.cases[4].options.find((item) => item.modelId === "sol")!;
    expect(option.judgment.status).toBe("valid");
    expect(option.judgment.verdict).toBe("prompt-violation");
    expect(option.judgment.summary).toBe("One prompt violation.");
    expect(option.judgment.issues[0]).toEqual(
      expect.objectContaining({ rule: "same-activity", quoteUnmatched: true }),
    );
    expect(option.judgment.otherQuoteWarning).toBe(false);
    expect(citedGroupLabels(option.groups, option.judgment.issues[0].groupNumbers)).toEqual([
      `Group 1: ${answer.groups[0].title}`,
    ]);
    expect(citedGroupNumbers(option.judgment).has(1)).toBe(true);
    expect(citedGroupLabels([{ title: "Only", descriptionNumbers: [1], reason: "" }], [1, 3])).toEqual([
      "Group 1: Only",
      "Group 3",
    ]);
  });

  it.each([
    [
      "an altered description",
      () => {
        const copy = clone(archive);
        copy.cases[3].descriptions[0].text += " (edited)";
        return [copy, judgeResults, earlierStudy] as const;
      },
    ],
    [
      "letters that are not a permutation of the four models",
      () => {
        const copy = clone(archive);
        copy.cases[0].letters.B = copy.cases[0].letters.A;
        return [copy, judgeResults, earlierStudy] as const;
      },
    ],
    [
      "a missing letter",
      () => {
        const copy = clone(archive);
        delete (copy.cases[0].letters as Partial<Record<string, string>>).D;
        return [copy, judgeResults, earlierStudy] as const;
      },
    ],
    [
      "a missing judgment",
      () => {
        const copy = clone(judgeResults);
        copy.judgments.pop();
        return [archive, copy, earlierStudy] as const;
      },
    ],
    [
      "a duplicated judgment",
      () => {
        const copy = clone(judgeResults);
        copy.judgments[1] = clone(copy.judgments[0]);
        return [archive, copy, earlierStudy] as const;
      },
    ],
    [
      "a judgment recorded for a different comparison",
      () => {
        const copy = clone(judgeResults);
        copy.studyVersion = "another-study";
        return [archive, copy, earlierStudy] as const;
      },
    ],
    [
      "a duplicated answer",
      () => {
        const copy = clone(archive);
        copy.answers[1] = clone(copy.answers[0]);
        return [copy, judgeResults, earlierStudy] as const;
      },
    ],
    [
      "examples in a different order from the September 14 study",
      () => {
        const copy = clone(earlierStudy);
        copy.cases.reverse();
        return [archive, judgeResults, copy] as const;
      },
    ],
    [
      "a changed original title",
      () => {
        const copy = clone(archive);
        copy.cases[4].originalTitle = "Measure Equipment";
        return [copy, judgeResults, earlierStudy] as const;
      },
    ],
    [
      "a valid judgment citing a group outside the proposal",
      () => {
        const { copy } = withValidJudgment(judgeResults);
        const record = copy.judgments.find(
          (item) => item.caseId === "case-5" && item.answerId === "sol",
        )!;
        record.judgment!.issues[0].groupNumbers = [99];
        return [archive, copy, earlierStudy] as const;
      },
    ],
    [
      "a valid judgment citing an unknown description",
      () => {
        const { copy } = withValidJudgment(judgeResults);
        const record = copy.judgments.find(
          (item) => item.caseId === "case-5" && item.answerId === "sol",
        )!;
        record.judgment!.issues[0].descriptionNumbers = [999];
        return [archive, copy, earlierStudy] as const;
      },
    ],
    [
      "a verdict that does not follow from the findings",
      () => {
        const { copy } = withValidJudgment(judgeResults);
        const record = copy.judgments.find(
          (item) => item.caseId === "case-5" && item.answerId === "sol",
        )!;
        record.verdict = "no-issues";
        return [archive, copy, earlierStudy] as const;
      },
    ],
    [
      "a judgment for an answer that does not exist",
      () => {
        const copy = clone(judgeResults);
        copy.judgments[0].answerId = "unknown-model";
        return [archive, copy, earlierStudy] as const;
      },
    ],
  ])("refuses to build with %s", (_label, inputs) => {
    const [a, j, e] = inputs();
    expect(() => buildTitleModelComparison(a, j, e)).toThrow(
      /model comparison cannot be shown/,
    );
  });
});
