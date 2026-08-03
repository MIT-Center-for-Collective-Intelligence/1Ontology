import fs from "fs";
import path from "path";

import { loadDataset } from "../../../src/lib/somReview/dataset";

describe("Sell semantic coverage review wave", () => {
  const datasetRoot = path.join(
    process.cwd(),
    "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
    "review-datasets-rob-semantic-coverage-2026-07-29",
  );
  const dataset = loadDataset(datasetRoot, "sell-semantic-coverage");
  const records = [...dataset.recordsById.values()];

  it("is pinned to the post-structure production ontology", () => {
    expect(dataset.datasetVersion).toBe(
      "sell-rob-semantic-coverage-2026-07-29-v1",
    );
    expect(dataset.manifest.sourceSnapshot).toMatchObject({
      ontologyAppId:
        "final-hierarchy-with-o*net-rob-structure-applied-2026-07-25",
      environment: "production",
      nodeCount: 142,
      edgeCount: 178,
      collectionCount: 144,
    });
    expect(dataset.manifest.safety).toMatchObject({
      reviewOnly: true,
      mutatesOntology: false,
      approvalAuthorizesAutomaticWrite: false,
    });
  });

  it("surfaces only direct seller-side temporary-use evidence", () => {
    const diagnoses = records.filter(
      (record) => record.issueType === "cross-branch-recall",
    );
    expect(diagnoses.map((record) => record.subject.title).sort()).toEqual([
      "Lease Property",
      "Rent Accommodation",
      "Rent Box",
      "Rent Clothing",
      "Rent Equipment",
      "Rent Item",
      "Rent Merchandise",
      "Rent Supply",
    ]);
    expect(
      diagnoses.every(
        (record) =>
          record.reviewerView.context.type === "placement-comparison" &&
          record.reviewerView.context.placementIssue ===
            "missing-from-branch" &&
          record.reviewerView.context.candidateHome === "Rent out" &&
          record.reviewerView.context.currentPathTitles?.[0] === "Buy" &&
          record.reviewerView.context.proposedPathTitles?.[0] === "Sell" &&
          !record.reviewerView.context.proposedPathTitles?.includes(
            "Sell temporary use",
          ) &&
          record.reviewerView.context.proposedPathTitles?.[1] === "Rent out" &&
          record.reviewerView.context.proposedPathTitles?.at(-1) ===
            record.subject.title,
      ),
    ).toBe(true);
    expect(
      diagnoses.some((record) => record.subject.title === "Rent Necessity"),
    ).toBe(false);
  });

  it("uses one exact move decision per potentially missing node", () => {
    const moves = records.filter(
      (record) => record.issueType === "cross-branch-recall",
    );
    expect(moves).toHaveLength(8);
    expect(
      records.filter((record) => record.issueType === "relocation"),
    ).toHaveLength(0);
    for (const move of moves) {
      expect(move.workflow).toMatchObject({
        proposalKind: "action",
        dependsOnProposalIds: [],
      });
      expect(move.reviewerView.question).toContain('to "Rent out"');
      expect(move.reviewerView.reasoning).not.toMatch(
        /available only after|diagnosis is approved/i,
      );
    }
  });

  it("limits evidence specialization to explicit modifiers", () => {
    const proposals = records.filter(
      (record) => record.issueType === "evidence-specialization",
    );
    expect(
      proposals
        .map((record) => record.reviewerView.context.proposedTitle)
        .sort(),
    ).toEqual([
      "Sell Funeral Products",
      "Sell Funeral Services",
      "Sell Non-Pharmaceutical Merchandise",
    ]);
    expect(
      proposals.some((record) =>
        record.reviewerView.context.proposedTitle.includes("Service Contracts"),
      ),
    ).toBe(false);
  });

  it("detects but does not release empty-node cleanup prematurely", () => {
    const emptyNodes = records.filter(
      (record) => record.issueType === "empty-node",
    );
    expect(emptyNodes.map((record) => record.subject.title).sort()).toEqual([
      "Rent out",
      "Sell (Other)",
    ]);
    expect(
      emptyNodes.every(
        (record) =>
          record.reviewMode === "manual-check" &&
          record.reviewerView.context.type === "empty-node-action",
      ),
    ).toBe(true);
    expect(
      dataset.manifest.reviewRelease.awaitingRegenerationIssueTypes,
    ).toContain("empty-node");
  });

  it("supports deferred empty-collection cleanup even when none are present", () => {
    const definition = dataset.manifest.issueTypes.find(
      (issue: any) => issue.id === "empty-collection",
    );
    expect(definition).toMatchObject({
      contextType: "empty-collection-action",
      manualChecks: 0,
    });
    expect(
      dataset.manifest.reviewRelease.awaitingRegenerationIssueTypes,
    ).toContain("empty-collection");
  });

  it("records and corrects the invalid collection-node application", () => {
    const snapshot = JSON.parse(
      fs.readFileSync(path.join(datasetRoot, "ontology-snapshot.json"), "utf8"),
    );
    expect(snapshot.nodes.map((node: any) => node.title)).not.toEqual(
      expect.arrayContaining(["Sell ownership", "Sell temporary use"]),
    );
    expect(
      snapshot.edges.some(
        (edge: any) =>
          edge.parentId === "9c347b3345120c1df2554b834c13" &&
          edge.childId === "df319ef0372ddc12e45ccbd4b4b0" &&
          edge.collectionName === "main",
      ),
    ).toBe(true);
    expect(dataset.manifest.acceptedStructureProvenance).toEqual({
      proposalId: "som-f0464db076534dd0bde0",
      origin: "invalid-collection-node-conflation-rolled-back",
      file: "diagnostics/accepted_structure_provenance.json",
    });
    const provenance = JSON.parse(
      fs.readFileSync(
        path.join(
          datasetRoot,
          dataset.manifest.acceptedStructureProvenance.file,
        ),
        "utf8",
      ),
    );
    expect(provenance.review).toMatchObject({
      decision: "agree",
      reviewerLabel: "Rob Laubacher",
    });
    expect(provenance.invalidApplication).toMatchObject({
      collectionName: "Sell what kind of usage?",
      targetDigestVerified: true,
      sourceUnchanged: true,
    });
    expect(provenance.correction).toMatchObject({
      verified: true,
      treatmentOfPriorDecision:
        "Rob's agreement remains preserved as review evidence, but it is not reinterpreted as approval for a different collection-only transformation.",
      restoredRelation: {
        parentTitle: "Sell",
        childTitle: "Rent out",
        collectionName: "main",
      },
    });
    expect(provenance.baseline).toMatchObject({
      ontologyAppId: "final-hierarchy-with-o*net",
      finding:
        "Lease out and Rent out were already direct children of Sell before the collection-design proposal was generated.",
    });
    expect(provenance.baseline.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Lease out",
          parentTitleAtCapture: "Sell",
          predecessorContributors: ["gemini"],
        }),
        expect.objectContaining({
          title: "Rent out",
          parentTitleAtCapture: "Sell",
          predecessorContributors: ["gemini"],
        }),
      ]),
    );
    expect(provenance.contentPrerequisite).toMatchObject({
      occurredBeforeCollectionDesign: true,
      review: {
        diagnosisProposalId: "som-af5752d64f929944a380",
        diagnosisDecision: "agree",
        actionProposalId: "som-9551307c7a40c479a755",
        actionDecision: "agree",
      },
      application: {
        canonicalTitle: "Rent out",
        absorbedTitle: "Lease out",
        targetDigestVerified: true,
        sourceUnchanged: true,
      },
    });
    expect(provenance.conclusion).toContain(
      'approved merging "Lease out" into "Rent out"',
    );
    expect(provenance.conclusion).toContain(
      '"Rent out" is again a direct child of "Sell"',
    );
  });
});
