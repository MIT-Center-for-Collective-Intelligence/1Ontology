import fs from "fs";
import path from "path";
import { compareTitlePromptResults } from "../../../src/lib/somReview/titlePromptComparison";
import type { TitlePromptStudyData } from "../../../src/types/ITitlePromptStudy";

const root = path.join(
  process.cwd(),
  "Ontology_Title_Clarity_Testbed_2026-08-28",
);
const study: TitlePromptStudyData = JSON.parse(
  fs.readFileSync(
    path.join(root, "prompt-study-2026-09-13/bundle.json"),
    "utf8",
  ),
);
const records = ["all_proposals.jsonl", "all_controls.jsonl"].flatMap((file) =>
  fs
    .readFileSync(path.join(root, "review-datasets-v6", file), "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line)),
);

describe("archived prompt result comparison", () => {
  it("matches all 18 cases including the keep control without changing either archive", () => {
    const before = JSON.stringify({ study, records });
    const result = compareTitlePromptResults(study, records);
    expect(result.cases).toHaveLength(18);
    expect(
      result.cases.every((item) => item.previous && !item.comparisonIssue),
    ).toBe(true);
    expect(
      result.cases.reduce((n, item) => n + item.previous!.groups.length, 0),
    ).toBe(61);
    expect(result.cases.reduce((n, item) => n + item.groups.length, 0)).toBe(
      72,
    );
    const research = result.cases.find(
      (item) => item.title === "Conduct Research",
    )!;
    expect(research.descriptions).toHaveLength(133);
    expect(research.previous!.groups).toHaveLength(20);
    expect(research.groups).toHaveLength(50);
    expect(
      research.previous!.trace.stages.some((stage) =>
        stage.prompt.includes("O*NET"),
      ),
    ).toBe(true);
    expect(JSON.stringify({ study, records })).toBe(before);
  });
  it("refuses misleading comparisons when any source text or source identity differs", () => {
    const changedText = JSON.parse(JSON.stringify(records));
    changedText[0].reviewerView.context.linkedTasks[0] += " Changed source.";
    expect(
      compareTitlePromptResults(study, changedText).cases[0].previous,
    ).toBeUndefined();
    const changedIdentity = JSON.parse(JSON.stringify(records));
    changedIdentity[0].provenance.sourceRecord = "unrelated-occurrence";
    expect(
      compareTitlePromptResults(study, changedIdentity).cases[0]
        .comparisonIssue,
    ).toMatch(/matching source evidence/);
    expect(
      compareTitlePromptResults(study, [...records, records[0]]).cases[0]
        .previous,
    ).toBeUndefined();
  });
  it("rejects broken number-to-description mappings rather than inventing a grouping", () => {
    const changed = JSON.parse(JSON.stringify(records));
    changed[0].reviewerView.context.proposedNodes[0].sourceTaskIndexes = [999];
    expect(
      compareTitlePromptResults(study, changed).cases[0].previous,
    ).toBeUndefined();
  });
});
