import path from "path";

import {
  SUPPORTED_ISSUE_TYPES,
  compileResponseValidator,
  isIssueTypeEnabled,
  isIssueTypeReleased,
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
    expect(dataset.recordsById.size).toBe(142);
    expect(dataset.manifest.counts).toMatchObject({
      proposals: 131,
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
      "title-clarity": 35,
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

  it("defers pure singular-to-plural changes and marks optional queues", () => {
    const titleChanges = [...dataset.recordsById.values()]
      .filter(
        (record) =>
          record.issueType === "title-clarity" &&
          record.reviewMode === "proposed-change",
      )
      .map((record) => record.reviewerView.context.currentTitle);
    expect(titleChanges).not.toEqual(
      expect.arrayContaining(["Sell Bond", "Sell Flower", "Sell Stock"]),
    );
    expect(
      dataset.manifest.issueTypes
        .filter((issue: any) => issue.optional)
        .map((issue: any) => issue.id),
    ).toEqual(["description-enrichment", "missing-activity"]);
    expect(
      dataset.manifest.issueTypes.find(
        (issue: any) => issue.id === "description-enrichment",
      ).stage,
    ).toBe("additional-quality");
  });

  it("includes collapsed O*NET evidence for semantic review cards", () => {
    for (const issueType of ["duplicate-synonym", "placement"]) {
      const records = [...dataset.recordsById.values()].filter(
        (record) => record.issueType === issueType,
      );
      expect(records.length).toBeGreaterThan(0);
      expect(
        records.every(
          (record) => record.reviewerView.context.sourceTasks.length > 0,
        ),
      ).toBe(true);
    }
    const collection = [...dataset.recordsById.values()].find(
      (record) => record.issueType === "collection-design",
    );
    expect(collection.reviewerView.context.sourceTasks).toEqual([]);
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

describe("Rob post-content-review wave", () => {
  const dataset = loadDataset();

  it("is pinned to the isolated ontology with Rob's approved content changes", () => {
    expect(dataset.datasetVersion).toBe("sell-rob-content-wave-2026-07-24-v1");
    expect(dataset.recordsById.size).toBe(128);
    expect(dataset.manifest.sourceSnapshot).toMatchObject({
      ontologyAppId: "final-hierarchy-with-o*net-rob-content-review-2026-07-24",
      ontologyName:
        "Final Hierarchy with O*Net - Rob Content Review 2026-07-24",
      environment: "production",
      nodeCount: 130,
      sellNodeCount: 127,
      referenceNodeCount: 3,
      edgeCount: 165,
    });
    expect(dataset.manifest.appliedReviewCycle).toMatchObject({
      auditFile: "diagnostics/content_application_audit.json",
    });
  });

  it("releases only the remaining content corrections", () => {
    expect(isIssueTypeReleased(dataset, "duplicate-synonym")).toBe(true);
    expect(isIssueTypeReleased(dataset, "node-merge")).toBe(true);
    expect(isIssueTypeReleased(dataset, "flat-list-grouping")).toBe(false);
    expect(isIssueTypeReleased(dataset, "placement")).toBe(false);
    expect(
      [...dataset.recordsById.values()].map(
        (record) => record.reviewerView.context.type,
      ),
    ).toEqual(expect.arrayContaining(["duplicate-comparison", "merge-action"]));
  });

  it("turns Rob's two corrections into focused diagnoses and exact actions", () => {
    const duplicateRecords = [...dataset.recordsById.values()].filter(
      (record) => record.issueType === "duplicate-synonym",
    );
    expect(duplicateRecords).toHaveLength(2);
    expect(
      duplicateRecords.map((record) => [
        record.reviewerView.context.canonicalTitle,
        record.reviewerView.context.candidateSynonymTitle,
      ]),
    ).toEqual(
      expect.arrayContaining([
        ["Rent out", "Lease out"],
        ["Sell Products", "Sell Merchandise"],
      ]),
    );

    const merchandise = duplicateRecords.find(
      (record) =>
        record.reviewerView.context.candidateSynonymTitle ===
        "Sell Merchandise",
    );
    expect(merchandise.reviewerView.context).toMatchObject({
      canonicalParentTitle: "Sell (Other)",
      candidateParentTitle: "Sell physical objects",
    });
    expect(
      [...dataset.recordsById.values()].every(
        (record) =>
          !["Sell Makeup", "Sell (Physical Object)", "Sell (Information)"].some(
            (title) =>
              JSON.stringify(record.reviewerView.context).includes(title),
          ),
      ),
    ).toBe(true);

    const mergeActions = [...dataset.recordsById.values()].filter(
      (record) => record.issueType === "node-merge",
    );
    expect(mergeActions).toHaveLength(2);
    expect(
      mergeActions.every(
        (record) => record.workflow.dependsOnProposalIds.length === 1,
      ),
    ).toBe(true);
  });

  it("regenerates grouping inputs after the approved Makeup merge", () => {
    const personalCare = [...dataset.recordsById.values()].find(
      (record) =>
        record.reviewerView.context.type === "grouping-outline" &&
        record.reviewerView.context.proposedGroupTitle ===
          "Sell Personal Care Products",
    );
    expect(personalCare.reviewerView.context.proposedChildren).toEqual([
      "Sell Cosmetics",
      "Sell Hair Care Products",
      "Sell Nail Care Products",
    ]);
  });
});
