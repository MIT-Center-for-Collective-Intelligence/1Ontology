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
  buildSnapshotIndex,
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
      "cross-branch-recall",
      "evidence-specialization",
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
      "empty-node",
      "empty-collection",
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

  it("validates an empty collection only when the snapshot declares it without members", () => {
    const snapshot = {
      schemaVersion: "som-ontology-snapshot-v1" as const,
      ontologyAppId: "ontology",
      ontologyName: "Ontology",
      firestoreProjectId: "project",
      environment: "production" as const,
      capturedAt: "2026-07-29T00:00:00.000Z",
      branchRootNodeId: "sell",
      branchRootTitle: "Sell",
      nodes: [{ id: "sell", title: "Sell" }],
      edges: [],
      collections: [{ parentId: "sell", collectionName: "Sell by channel" }],
    };
    const record = {
      proposalId: "empty-collection",
      subject: { path: [] },
      reviewerView: {
        context: {
          type: "empty-collection-action",
          parentTitle: "Sell",
          collectionName: "Sell by channel",
        },
      },
      provenance: {
        sourceOntologyAppId: "ontology",
        sourceOntologyName: "Ontology",
        sourceSnapshotSha256: "snapshot",
        subjectNodeId: "sell",
        parentNodeId: "sell",
        referencedNodeIds: ["sell"],
      },
    };

    expect(
      validateProposalAgainstSnapshot(
        record,
        buildSnapshotIndex(snapshot),
        "snapshot",
      ),
    ).toMatchObject({ subjectNodeId: "sell", parentNodeId: "sell" });
  });

  it("validates existing collection members without requiring a node for the label", () => {
    const snapshot = {
      schemaVersion: "som-ontology-snapshot-v1" as const,
      ontologyAppId: "ontology",
      ontologyName: "Ontology",
      firestoreProjectId: "project",
      environment: "production" as const,
      capturedAt: "2026-08-02T00:00:00.000Z",
      branchRootNodeId: "sell",
      branchRootTitle: "Sell",
      nodes: [
        { id: "sell", title: "Sell" },
        { id: "rent", title: "Rent out" },
        { id: "products", title: "Sell Products" },
      ],
      edges: [
        { parentId: "sell", childId: "rent", collectionName: "main" },
        { parentId: "sell", childId: "products", collectionName: "main" },
      ],
      collections: [{ parentId: "sell", collectionName: "main" }],
    };
    const record = {
      proposalId: "collection-design",
      subject: { path: [] },
      reviewerView: {
        context: {
          type: "collection-design",
          parentTitle: "Sell",
          currentChildren: ["Rent out"],
          proposedCollectionName: "Sell by duration",
          proposedBranches: [
            {
              title: "Rent out",
              status: "existing",
              children: [],
            },
            {
              title: "Sell Products",
              status: "existing",
              children: [],
            },
          ],
        },
      },
      provenance: {
        sourceOntologyAppId: "ontology",
        sourceOntologyName: "Ontology",
        sourceSnapshotSha256: "snapshot",
        subjectNodeId: "",
        parentNodeId: "sell",
        referencedNodeIds: ["products", "rent", "sell"],
      },
    };

    expect(
      validateProposalAgainstSnapshot(
        record,
        buildSnapshotIndex(snapshot),
        "snapshot",
      ),
    ).toMatchObject({ subjectNodeId: "", parentNodeId: "sell" });
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

describe("Rob structure-review wave", () => {
  const datasetRoot = path.join(
    process.cwd(),
    "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
    "review-datasets-rob-structure-wave-2026-07-24",
  );
  const dataset = loadDataset(datasetRoot);
  const source = loadOntologySnapshot(datasetRoot, dataset.manifest);

  it("is pinned to the isolated ontology with both approved merges applied", () => {
    expect(dataset.datasetVersion).toBe(
      "sell-rob-structure-wave-2026-07-24-v1",
    );
    expect(dataset.recordsById.size).toBe(123);
    expect(dataset.manifest.sourceSnapshot).toMatchObject({
      ontologyAppId:
        "final-hierarchy-with-o*net-rob-structure-review-2026-07-24",
      ontologyName:
        "Final Hierarchy with O*Net - Rob Structure Review 2026-07-24",
      environment: "production",
      nodeCount: 128,
      sellNodeCount: 125,
      referenceNodeCount: 3,
      edgeCount: 163,
    });
    expect(dataset.manifest.appliedReviewCycle).toMatchObject({
      auditFile: "diagnostics/content_application_audit.json",
    });

    expect(source.index.idsByTitle.has("Lease out")).toBe(false);
    expect(source.index.idsByTitle.has("Sell Merchandise")).toBe(false);
    const rentOut = source.index.nodesById.get(
      source.index.idsByTitle.get("Rent out")?.[0] || "",
    );
    const sellProducts = source.index.nodesById.get(
      source.index.idsByTitle.get("Sell Products")?.[0] || "",
    );
    expect(rentOut?.actionAlternatives).toContain("Lease out");
    expect(sellProducts?.actionAlternatives).toContain("Sell Merchandise");
  });

  it("releases structure diagnoses and their gated exact relocations", () => {
    expect(isIssueTypeReleased(dataset, "flat-list-grouping")).toBe(true);
    expect(isIssueTypeReleased(dataset, "compound-object-grouping")).toBe(true);
    expect(isIssueTypeReleased(dataset, "collection-design")).toBe(true);
    expect(isIssueTypeReleased(dataset, "placement")).toBe(true);
    expect(isIssueTypeReleased(dataset, "wrong-verb")).toBe(true);
    expect(isIssueTypeReleased(dataset, "relocation")).toBe(true);
    expect(isIssueTypeReleased(dataset, "description-enrichment")).toBe(false);
    expect(isIssueTypeReleased(dataset, "missing-activity")).toBe(false);
    expect(
      [...dataset.recordsById.values()].map(
        (record) => record.reviewerView.context.type,
      ),
    ).toEqual(
      expect.arrayContaining([
        "grouping-outline",
        "collection-design",
        "placement-comparison",
        "relocation-action",
      ]),
    );
  });

  it("removes completed identity proposals and all active absorbed-node references", () => {
    const duplicateRecords = [...dataset.recordsById.values()].filter(
      (record) => record.issueType === "duplicate-synonym",
    );
    expect(duplicateRecords).toHaveLength(0);
    expect(
      [...dataset.recordsById.values()].every(
        (record) =>
          !["Lease out", "Sell Merchandise"].some((title) =>
            JSON.stringify(record.reviewerView.context).includes(title),
          ),
      ),
    ).toBe(true);

    const mergeActions = [...dataset.recordsById.values()].filter(
      (record) => record.issueType === "node-merge",
    );
    expect(mergeActions).toHaveLength(0);
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

  it("regenerates the collection design around the canonical Rent out node", () => {
    const collection = [...dataset.recordsById.values()].find(
      (record) => record.issueType === "collection-design",
    );
    expect(collection.reviewerView.context).toMatchObject({
      currentChildren: ["Rent out"],
      proposedBranches: [
        { title: "Sell ownership", status: "new", children: [] },
        {
          title: "Sell temporary use",
          status: "new",
          children: ["Rent out"],
        },
      ],
    });
  });
});

describe("Rob post-structure review wave", () => {
  const datasetRoot = path.join(
    process.cwd(),
    "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
    "review-datasets-rob-post-structure-2026-07-25",
  );
  const dataset = loadDataset(datasetRoot);
  const source = loadOntologySnapshot(datasetRoot, dataset.manifest);
  const oneId = (title: string): string => {
    const ids = source.index.idsByTitle.get(title) || [];
    expect(ids).toHaveLength(1);
    return ids[0];
  };
  const hasEdge = (parentTitle: string, childTitle: string): boolean =>
    source.index.edgePairs.has(
      `${oneId(parentTitle)}\u001f${oneId(childTitle)}`,
    );

  it("is pinned to the verified isolated post-structure ontology", () => {
    expect(dataset.datasetVersion).toBe(
      "sell-rob-post-structure-2026-07-25-v1",
    );
    expect(dataset.recordsById.size).toBe(65);
    expect(dataset.manifest.sourceSnapshot).toMatchObject({
      ontologyAppId:
        "final-hierarchy-with-o*net-rob-structure-applied-2026-07-25",
      ontologyName:
        "Final Hierarchy with O*Net - Rob Structure Applied 2026-07-25",
      environment: "production",
      nodeCount: 127,
      sellNodeCount: 123,
      referenceNodeCount: 4,
      edgeCount: 156,
    });
    expect(dataset.manifest.appliedReviewCycle).toMatchObject({
      auditFile: "diagnostics/structure_application_audit.json",
    });
  });

  it("contains Rob's accepted groupings and corrected destinations", () => {
    expect(hasEdge("Sell physical objects", "Sell Food and Beverages")).toBe(
      true,
    );
    expect(hasEdge("Sell Food and Beverages", "Sell Beverages")).toBe(true);
    expect(hasEdge("Sell service", "Sell Travel Services")).toBe(true);
    expect(hasEdge("Sell Travel Services", "Sell Travel Packages")).toBe(true);
    expect(hasEdge("Sell Travel Services", "Sell Travel Incentives")).toBe(
      true,
    );
    expect(hasEdge("Sell service", "Sell Financial Products")).toBe(true);
    expect(hasEdge("Sell", "Sell Products")).toBe(true);
  });

  it("does not repeat resolved or rejected structure proposals", () => {
    const issueCounts = new Map<string, number>();
    for (const record of dataset.recordsById.values()) {
      issueCounts.set(
        record.issueType,
        (issueCounts.get(record.issueType) || 0) + 1,
      );
    }
    expect(issueCounts).toEqual(
      new Map([
        ["description-enrichment", 55],
        ["missing-activity", 10],
      ]),
    );
    expect(
      [...dataset.recordsById.values()].some((record) =>
        JSON.stringify(record.reviewerView.context).includes(
          "Sell Agricultural Products and Supplies",
        ),
      ),
    ).toBe(false);
  });
});
