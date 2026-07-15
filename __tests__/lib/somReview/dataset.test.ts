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
      "sell-final-hierarchy-onet-2026-07-15-v2",
    );
    expect(dataset.recordsById.size).toBe(82);
  });

  it("indexes the complete detector and action taxonomy", () => {
    expect(SUPPORTED_ISSUE_TYPES).toEqual([
      "title-clarity",
      "sibling-grouping",
      "duplicate-synonym",
      "placement",
      "wrong-verb",
      "structural-overlap",
      "node-merge",
      "relocation",
      "missing-activity",
      "redundant-node",
    ]);
    expect(dataset.orderedIdsByIssue.get("title-clarity")).toHaveLength(47);
    expect(dataset.orderedIdsByIssue.get("sibling-grouping")).toHaveLength(8);
    expect(dataset.orderedIdsByIssue.get("duplicate-synonym")).toHaveLength(1);
    expect(dataset.orderedIdsByIssue.get("placement")).toHaveLength(3);
    expect(dataset.orderedIdsByIssue.get("wrong-verb")).toHaveLength(7);
    expect(dataset.orderedIdsByIssue.get("structural-overlap")).toHaveLength(2);
    expect(dataset.orderedIdsByIssue.get("node-merge")).toHaveLength(3);
    expect(dataset.orderedIdsByIssue.get("relocation")).toHaveLength(0);
    expect(dataset.orderedIdsByIssue.get("missing-activity")).toHaveLength(10);
    expect(dataset.orderedIdsByIssue.get("redundant-node")).toHaveLength(1);
  });

  it("serves only snapshot-valid exact action proposals", () => {
    const exactTypes = new Set([
      "node-merge",
      "relocation",
      "missing-activity",
      "redundant-node",
    ]);
    const exactActions = [...dataset.recordsById.values()].filter((record) =>
      exactTypes.has(record.issueType),
    );
    expect(exactActions).toHaveLength(14);
    expect(
      exactActions.every(
        (record) =>
          record.provenance.sourceSnapshotSha256 ===
          dataset.manifest.sourceSnapshot.sha256,
      ),
    ).toBe(true);
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

  it("covers every deterministic duplicate pair and redundant wrapper in the snapshot", () => {
    const snapshotPath = path.join(
      process.cwd(),
      "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
      "review-datasets",
    );
    const { snapshot } = loadOntologySnapshot(snapshotPath, dataset.manifest);
    const titleById = new Map(
      snapshot.nodes.map((node) => [node.id, node.title]),
    );
    const childrenByParent = new Map<string, string[]>();
    for (const edge of snapshot.edges) {
      childrenByParent.set(edge.parentId, [
        ...(childrenByParent.get(edge.parentId) || []),
        edge.childId,
      ]);
    }

    const normalizeTitle = (title: string) =>
      title
        .toLowerCase()
        .replace(/[()]/g, "")
        .replace(/\b(objects|activities|informations)\b/g, (word) =>
          word.slice(0, -1),
        )
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    const semanticNodes = snapshot.nodes.filter(
      (node) => !node.title.startsWith("(O*Net)"),
    );
    const titlesByNormalizedForm = new Map<string, string[]>();
    for (const node of semanticNodes) {
      const key = normalizeTitle(node.title);
      titlesByNormalizedForm.set(key, [
        ...(titlesByNormalizedForm.get(key) || []),
        node.title,
      ]);
    }
    const duplicatePairs = [...titlesByNormalizedForm.values()]
      .filter((titles) => titles.length > 1)
      .map((titles) => [...titles].sort().join(" -> "))
      .sort();
    expect(duplicatePairs).toEqual([
      "Sell (Information) -> Sell information",
      "Sell (Physical Object) -> Sell physical objects",
    ]);

    const exactMergePairs = [...dataset.recordsById.values()]
      .filter((record) => record.reviewerView.context.type === "merge-action")
      .map((record) => {
        const context = record.reviewerView.context;
        if (context.type !== "merge-action") return "";
        return [context.canonicalTitle, context.absorbedTitle]
          .sort()
          .join(" -> ");
      });
    for (const pair of duplicatePairs) {
      expect(exactMergePairs).toContain(pair);
    }

    const redundantWrappers = semanticNodes
      .filter((node) => {
        const semanticChildren = (childrenByParent.get(node.id) || [])
          .map((childId) => titleById.get(childId) || "")
          .filter((title) => title && !title.startsWith("(O*Net)"));
        return semanticChildren.length === 1;
      })
      .map((node) => node.title)
      .sort();
    expect(redundantWrappers).toEqual(["Sell (Other)"]);

    const reviewedWrappers = [...dataset.recordsById.values()]
      .filter(
        (record) => record.reviewerView.context.type === "merge-up-action",
      )
      .map((record) => {
        const context = record.reviewerView.context;
        return context.type === "merge-up-action" ? context.nodeTitle : "";
      });
    expect(reviewedWrappers).toEqual(redundantWrappers);
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

  it("rejects an exact merge that omits a current direct child", () => {
    const snapshotPath = path.join(
      process.cwd(),
      "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
      "review-datasets",
    );
    const source = loadOntologySnapshot(snapshotPath, dataset.manifest);
    const record = JSON.parse(
      JSON.stringify(
        [...dataset.recordsById.values()].find(
          (candidate) =>
            candidate.reviewerView.context.type === "merge-action" &&
            candidate.reviewerView.context.absorbedChildren.length > 0,
        ),
      ),
    );
    record.reviewerView.context.absorbedChildren.pop();
    expect(() =>
      validateProposalAgainstSnapshot(record, source.index, source.sha256),
    ).toThrow("does not list every current direct child");
  });

  it("rejects an exact relocation when the proposed relation already exists", () => {
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
    const current = record.reviewerView.context;
    record.reviewerView.context = {
      type: "relocation-action",
      nodeTitle: current.nodeTitle,
      currentParentTitle: current.currentParentTitle,
      currentCollection: "main",
      proposedParentTitle: current.currentParentTitle,
      proposedCollection: "main",
      childTitles: [],
    };
    expect(() =>
      validateProposalAgainstSnapshot(record, source.index, source.sha256),
    ).toThrow("Proposed relocation already exists");
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
