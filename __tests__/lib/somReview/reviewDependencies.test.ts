import {
  blockingIssuePrerequisites,
  issuePrerequisiteTypes,
  issueReviewIsComplete,
} from "../../../src/lib/somReview/reviewDependencies";
import {
  SomIssueType,
  SomIssueTypeOption,
  SomReviewStage,
} from "../../../src/types/ISomReview";

const option = (
  id: SomIssueType,
  overrides: Partial<SomIssueTypeOption> = {},
): SomIssueTypeOption => ({
  id,
  label: id,
  stage: "content" as SomReviewStage,
  robTaskIds: [],
  reviewed: 0,
  pending: 1,
  waiting: 0,
  notApplicable: 0,
  total: 1,
  enabled: true,
  prerequisiteIssueTypes: issuePrerequisiteTypes(id),
  blockedBy: [],
  ...overrides,
});

describe("review queue dependencies", () => {
  it("requires title review before meaning review", () => {
    expect(issuePrerequisiteTypes("duplicate-synonym")).toEqual([
      "title-clarity",
    ]);
  });

  it("requires meaning and identity review before structural review", () => {
    expect(issuePrerequisiteTypes("flat-list-grouping")).toEqual([
      "title-clarity",
      "synonym-enrichment",
      "mistaken-synonym",
      "duplicate-synonym",
      "polysemy",
      "misc-facet-duplicate",
    ]);
  });

  it("does not add queue-level gates to exact follow-up actions", () => {
    expect(issuePrerequisiteTypes("node-merge")).toEqual([]);
    expect(issuePrerequisiteTypes("relocation")).toEqual([]);
    expect(issuePrerequisiteTypes("sense-relocation")).toEqual([]);
  });

  it("treats empty, disabled, and fully answered queues as complete", () => {
    expect(issueReviewIsComplete(option("title-clarity", { total: 0 }))).toBe(
      true,
    );
    expect(
      issueReviewIsComplete(option("title-clarity", { enabled: false })),
    ).toBe(true);
    expect(
      issueReviewIsComplete(
        option("title-clarity", { reviewed: 1, pending: 0 }),
      ),
    ).toBe(true);
  });

  it("reports each unfinished prerequisite with a remaining count", () => {
    const issues = new Map<SomIssueType, SomIssueTypeOption>([
      ["title-clarity", option("title-clarity", { pending: 2 })],
      [
        "synonym-enrichment",
        option("synonym-enrichment", { pending: 0, reviewed: 1 }),
      ],
      [
        "mistaken-synonym",
        option("mistaken-synonym", { pending: 0, reviewed: 1 }),
      ],
      ["duplicate-synonym", option("duplicate-synonym", { pending: 1 })],
      ["polysemy", option("polysemy", { pending: 0, reviewed: 1 })],
      [
        "misc-facet-duplicate",
        option("misc-facet-duplicate", { pending: 0, reviewed: 1 }),
      ],
    ]);

    expect(blockingIssuePrerequisites("flat-list-grouping", issues)).toEqual([
      { id: "title-clarity", label: "title-clarity", remaining: 2 },
      {
        id: "duplicate-synonym",
        label: "duplicate-synonym",
        remaining: 1,
      },
    ]);
  });
});
