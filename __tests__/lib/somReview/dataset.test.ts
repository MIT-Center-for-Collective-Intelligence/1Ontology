import {
  DEFAULT_SESSION_SIZE,
  MAX_SESSION_SIZE,
  SUPPORTED_ISSUE_TYPES,
  isIssueTypeEnabled,
  loadDataset,
} from "../../../src/lib/somReview/dataset";

describe("Society of Mind review dataset", () => {
  const dataset = loadDataset();

  it("loads and validates every proposal, control, and manual check", () => {
    expect(dataset.datasetVersion).toBe("sell-review-2026-07-14-v1");
    expect(dataset.recordsById.size).toBe(68);
  });

  it("indexes all five supported issue types", () => {
    expect(SUPPORTED_ISSUE_TYPES).toEqual([
      "title-clarity",
      "sibling-grouping",
      "duplicate-synonym",
      "placement",
      "structural-overlap",
    ]);
    expect(dataset.orderedIdsByIssue.get("title-clarity")).toHaveLength(47);
    expect(dataset.orderedIdsByIssue.get("sibling-grouping")).toHaveLength(3);
    expect(dataset.orderedIdsByIssue.get("duplicate-synonym")).toHaveLength(0);
    expect(dataset.orderedIdsByIssue.get("placement")).toHaveLength(16);
    expect(dataset.orderedIdsByIssue.get("structural-overlap")).toHaveLength(2);
  });

  it("enables supported types by default and honors the disable list", () => {
    const previous = process.env.SOM_REVIEW_DISABLED_ISSUE_TYPES;
    delete process.env.SOM_REVIEW_DISABLED_ISSUE_TYPES;
    expect(SUPPORTED_ISSUE_TYPES.every(isIssueTypeEnabled)).toBe(true);
    process.env.SOM_REVIEW_DISABLED_ISSUE_TYPES = "placement";
    expect(isIssueTypeEnabled("placement")).toBe(false);
    expect(isIssueTypeEnabled("title-clarity")).toBe(true);
    if (previous === undefined) {
      delete process.env.SOM_REVIEW_DISABLED_ISSUE_TYPES;
    } else {
      process.env.SOM_REVIEW_DISABLED_ISSUE_TYPES = previous;
    }
  });

  it("keeps review sessions small", () => {
    expect(DEFAULT_SESSION_SIZE).toBe(10);
    expect(MAX_SESSION_SIZE).toBe(15);
  });
});
