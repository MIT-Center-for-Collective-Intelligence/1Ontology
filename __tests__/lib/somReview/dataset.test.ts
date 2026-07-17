import path from "path";

import {
  SUPPORTED_ISSUE_TYPES,
  compileResponseValidator,
  isIssueTypeEnabled,
  loadDataset,
  proposalAvailability,
} from "../../../src/lib/somReview/dataset";
import {
  loadOntologySnapshot,
  validateProposalAgainstSnapshot,
} from "../../../src/lib/somReview/ontologySnapshot";

describe("Society of Mind review dataset", () => {
  const datasetRoot = path.join(
    process.cwd(),
    "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
    "review-datasets",
  );
  const dataset = loadDataset(datasetRoot);

  it("loads and validates every proposal, control, and manual check", () => {
    expect(dataset.datasetVersion).toBe(
      "sell-final-hierarchy-onet-2026-07-15-v4",
    );
    expect(dataset.recordsById.size).toBe(154);
    expect(dataset.manifest.counts).toMatchObject({
      proposals: 143,
      controls: 11,
      manualChecks: 0,
    });
  });

  it("keeps all 13 Rob tasks distinct and exposes action queues separately", () => {
    expect(SUPPORTED_ISSUE_TYPES).toEqual([
      "title-clarity",
      "synonym-enrichment",
      "description-enrichment",
      "misc-facet-duplicate",
      "mistaken-synonym",
      "duplicate-synonym",
      "polysemy",
      "flat-list-grouping",
      "compound-object-grouping",
      "collection-design",
      "placement",
      "wrong-verb",
      "sense-relocation",
      "node-merge",
      "relocation",
      "missing-activity",
      "redundant-node",
    ]);

    const representedTasks = [
      ...new Set(
        [...dataset.recordsById.values()].flatMap(
          (record) => record.workflow.robTaskIds,
        ),
      ),
    ].sort((left, right) => left - right);
    expect(representedTasks).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
    ]);
    expect(dataset.manifest.coverage).toMatchObject({
      robTaskFamiliesRepresented: 13,
      robTaskFamiliesTotal: 13,
      semanticCompletenessGuaranteed: false,
    });
  });

  it("indexes the expected number of review items in each queue", () => {
    const expected = {
      "title-clarity": 47,
      "synonym-enrichment": 1,
      "description-enrichment": 47,
      "misc-facet-duplicate": 2,
      "mistaken-synonym": 3,
      "duplicate-synonym": 4,
      polysemy: 1,
      "flat-list-grouping": 4,
      "compound-object-grouping": 4,
      "collection-design": 1,
      placement: 7,
      "wrong-verb": 5,
      "sense-relocation": 1,
      "node-merge": 6,
      relocation: 11,
      "missing-activity": 10,
      "redundant-node": 0,
    } as const;
    for (const [issueType, count] of Object.entries(expected)) {
      expect(
        dataset.orderedIdsByIssue.get(issueType as keyof typeof expected),
      ).toHaveLength(count);
    }
  });

  it("is pinned to the current production Sell snapshot and verified destinations", () => {
    expect(dataset.manifest.sourceSnapshot).toMatchObject({
      ontologyAppId: "final-hierarchy-with-o*net",
      ontologyName: "Final Hierarchy with O*Net",
      environment: "production",
      nodeCount: 115,
      sellNodeCount: 112,
      referenceNodeCount: 3,
      edgeCount: 146,
    });
    const { snapshot } = loadOntologySnapshot(datasetRoot, dataset.manifest);
    expect(snapshot.nodes.map((node) => node.title)).toEqual(
      expect.arrayContaining(["Advertise", "Persuade", "Provide service"]),
    );
    expect(
      snapshot.nodes.some((node) => node.title === "Sell Financial Instrument"),
    ).toBe(false);
  });

  it("serves only snapshot-bound exact action proposals", () => {
    const exactTypes = new Set([
      "node-merge",
      "relocation",
      "sense-relocation",
      "missing-activity",
      "redundant-node",
    ]);
    const exactActions = [...dataset.recordsById.values()].filter((record) =>
      exactTypes.has(record.issueType),
    );
    expect(exactActions).toHaveLength(28);
    expect(
      exactActions.every(
        (record) =>
          record.workflow.proposalKind === "action" &&
          record.provenance.sourceSnapshotSha256 ===
            dataset.manifest.sourceSnapshot.sha256,
      ),
    ).toBe(true);
  });

  it("gates downstream actions on their diagnostic decision", () => {
    const gatedActions = [...dataset.recordsById.values()].filter((record) =>
      ["node-merge", "relocation", "sense-relocation"].includes(
        record.issueType,
      ),
    );
    expect(gatedActions).toHaveLength(18);
    for (const record of gatedActions) {
      expect(record.workflow.dependsOnProposalIds).toHaveLength(1);
      const dependencyId = record.workflow.dependsOnProposalIds[0];
      expect(dataset.recordsById.has(dependencyId)).toBe(true);
      expect(proposalAvailability(record, new Map())).toBe("waiting");
      expect(
        proposalAvailability(record, new Map([[dependencyId, "agree"]])),
      ).toBe("ready");
      expect(
        proposalAvailability(record, new Map([[dependencyId, "disagree"]])),
      ).toBe("not-applicable");
    }
    expect(proposalAvailability(undefined, new Map())).toBe("not-applicable");
  });

  it("does not reintroduce the contradictory Rent/Lease or whole-node polysemy actions", () => {
    const records = [...dataset.recordsById.values()];
    const rentLeaseShortcut = records.some((record) => {
      const context = record.reviewerView.context;
      return (
        (context.type === "duplicate-comparison" &&
          [context.canonicalTitle, context.candidateSynonymTitle].some(
            (title: string) => ["Rent out", "Lease out"].includes(title),
          )) ||
        (context.type === "placement-comparison" &&
          ["Rent out", "Lease out"].includes(context.nodeTitle))
      );
    });
    expect(rentLeaseShortcut).toBe(false);

    expect(
      records.some(
        (record) =>
          record.reviewerView.context.type === "merge-up-action" &&
          record.reviewerView.context.nodeTitle === "Sell (Other)",
      ),
    ).toBe(false);
    const senseAction = records.find(
      (record) => record.issueType === "sense-relocation",
    );
    expect(senseAction.reviewerView.context).toMatchObject({
      type: "sense-relocation-action",
      nodeTitle: "Sell Products or Ideas",
      retainedSenseTitle: "Sell Product",
      proposedParentTitle: "Persuade",
    });
  });

  it("separates structured synonym gaps from mistaken recorded synonyms", () => {
    const records = [...dataset.recordsById.values()];
    const enrichment = records.filter(
      (record) => record.issueType === "synonym-enrichment",
    );
    expect(enrichment).toHaveLength(1);
    expect(enrichment[0].reviewerView.context).toMatchObject({
      type: "metadata-edit",
      nodeTitle: "Lease out",
      synonymScope: "structured-field",
      proposedValues: ["Lease"],
    });

    const mistakenTitles = records
      .filter((record) => record.issueType === "mistaken-synonym")
      .map((record) => record.reviewerView.context.nodeTitle)
      .sort();
    expect(mistakenTitles).toEqual([
      "Sell",
      "Sell Accessory",
      "Sell Service (1)",
    ]);
  });

  it("uses substantive descriptions and covers synonym-only placeholders", () => {
    const descriptions = [...dataset.recordsById.values()].filter(
      (record) => record.issueType === "description-enrichment",
    );
    expect(descriptions).toHaveLength(47);
    expect(
      descriptions.every(
        (record) =>
          record.reviewerView.context.proposedText.length >= 30 &&
          !record.reviewerView.context.proposedText.startsWith(
            "The activity of",
          ),
      ),
    ).toBe(true);
    expect(
      descriptions.map((record) => record.reviewerView.context.nodeTitle),
    ).toEqual(expect.arrayContaining(["Sell Accessory", "Sell Service (1)"]));
  });

  it("rejects a proposal whose current node is not in the snapshot", () => {
    const source = loadOntologySnapshot(datasetRoot, dataset.manifest);
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

  it("rejects a merge that omits a current direct child", () => {
    const source = loadOntologySnapshot(datasetRoot, dataset.manifest);
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
    const source = loadOntologySnapshot(datasetRoot, dataset.manifest);
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

  it("rejects unbounded reviewer text", () => {
    const validate = compileResponseValidator(datasetRoot);
    const payload = {
      schemaVersion: "som-review-v1",
      datasetVersion: dataset.datasetVersion,
      proposalId: "proposal-1",
      reviewerId: "reviewer-1",
      decision: "disagree",
      disagreementReason: "x".repeat(2001),
      suggestedCorrection: "",
      reviewedAt: "2026-07-15T12:00:00.000Z",
    };

    expect(validate(payload)).toBe(false);
    expect(validate.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ keyword: "maxLength" }),
      ]),
    );
  });
});
