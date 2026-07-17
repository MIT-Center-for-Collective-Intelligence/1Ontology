import {
  numberReviewIssues,
  SOM_REVIEW_STAGES,
} from "../../../src/lib/somReview/reviewTaxonomy";

describe("Society of Mind review taxonomy", () => {
  it("derives issue numbers from visible stage order", () => {
    const numbered = numberReviewIssues([
      {
        id: "description-enrichment" as const,
        label: "3. Add missing descriptions",
        stage: "additional-quality" as const,
      },
      {
        id: "placement" as const,
        label: "11. Wrong place within Sub-branch",
        stage: "within-branch" as const,
      },
      {
        id: "title-clarity" as const,
        label: "1. Clarify unclear titles",
        stage: "content" as const,
      },
    ]);

    expect(numbered.map((issue) => issue.label)).toEqual([
      "1. Clarify unclear titles",
      "2. Wrong place within Sub-branch",
      "3. Add missing descriptions",
    ]);
  });

  it("uses generalized stage labels", () => {
    expect(SOM_REVIEW_STAGES.map((stage) => stage.title)).toEqual([
      "Content of nodes",
      "Structure within Sub-branch",
      "Movement beyond Sub-branch",
      "Follow-up change proposals",
      "Additional optional quality checks",
    ]);
  });
});
