import {
  DEFAULT_SESSION_SIZE,
  MAX_SESSION_SIZE,
  SUPPORTED_ISSUE_TYPES,
  isIssueTypeEnabled,
  loadDataset,
} from "../../../src/lib/somReview/dataset";
import {
  loadOntologySnapshot,
  validateProposalAgainstSnapshot,
} from "../../../src/lib/somReview/ontologySnapshot";
import path from "path";

describe("Society of Mind review dataset", () => {
  const dataset = loadDataset();

  it("loads and validates every proposal, control, and manual check", () => {
    expect(dataset.datasetVersion).toBe(
      "sell-final-hierarchy-onet-2026-07-15-v1",
    );
    expect(dataset.recordsById.size).toBe(64);
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
    expect(dataset.orderedIdsByIssue.get("sibling-grouping")).toHaveLength(4);
    expect(dataset.orderedIdsByIssue.get("duplicate-synonym")).toHaveLength(1);
    expect(dataset.orderedIdsByIssue.get("placement")).toHaveLength(10);
    expect(dataset.orderedIdsByIssue.get("structural-overlap")).toHaveLength(2);
  });

  it("is pinned to a validated production Firestore snapshot", () => {
    expect(dataset.manifest.sourceSnapshot).toMatchObject({
      ontologyAppId: "final-hierarchy-with-o*net",
      ontologyName: "Final Hierarchy with O*Net",
      environment: "production",
      nodeCount: 112,
      edgeCount: 146,
    });
    const snapshotPath = path.join(
      process.cwd(),
      "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
      "review-datasets",
    );
    const source = loadOntologySnapshot(snapshotPath, dataset.manifest);
    expect(
      source.snapshot.nodes.some(
        (node) => node.title === "Sell Financial Instrument",
      ),
    ).toBe(false);
  });

  it("rejects a proposal whose current node is not in the snapshot", () => {
    const snapshotPath = path.join(
      process.cwd(),
      "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
      "review-datasets",
    );
    const source = loadOntologySnapshot(snapshotPath, dataset.manifest);
    const record = JSON.parse(
      JSON.stringify(
        [...dataset.recordsById.values()].find(
          (candidate) => candidate.issueType === "placement",
        ),
      ),
    );
    record.reviewerView.context.nodeTitle = "Sell Financial Instrument";
    expect(() =>
      validateProposalAgainstSnapshot(record, source.index, source.sha256),
    ).toThrow(
      "Current ontology node does not exist: Sell Financial Instrument",
    );
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
