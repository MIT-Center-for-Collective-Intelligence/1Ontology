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
      nodeCount: 144,
      edgeCount: 180,
      collectionCount: 146,
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
          record.reviewerView.context.candidateHome === "Rent out",
      ),
    ).toBe(true);
    expect(
      diagnoses.some((record) => record.subject.title === "Rent Necessity"),
    ).toBe(false);
  });

  it("keeps every exact move behind its own semantic diagnosis", () => {
    const diagnosisIds = new Set(
      records
        .filter((record) => record.issueType === "cross-branch-recall")
        .map((record) => record.proposalId),
    );
    const moves = records.filter((record) => record.issueType === "relocation");
    expect(moves).toHaveLength(8);
    for (const move of moves) {
      expect(move.workflow.dependsOnProposalIds).toHaveLength(1);
      expect(diagnosisIds.has(move.workflow.dependsOnProposalIds[0])).toBe(
        true,
      );
      expect(move.reviewerView.context.proposedParentTitle).toBe("Rent out");
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
      "Sell ownership",
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

  it("records that the usage branches came from Rob's accepted proposal", () => {
    expect(dataset.manifest.acceptedStructureProvenance).toEqual({
      proposalId: "som-f0464db076534dd0bde0",
      origin: "explicit-human-reviewed-collection-design-proposal",
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
    expect(provenance.application).toMatchObject({
      collectionName: "Sell what kind of usage?",
      targetDigestVerified: true,
      sourceUnchanged: true,
    });
  });
});
