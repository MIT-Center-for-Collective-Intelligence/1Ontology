import fs from "fs";
import path from "path";

import { loadDataset } from "../../../src/lib/somReview/dataset";
import { toReviewerCard } from "../../../src/lib/somReview/sanitize";

const DATASET_DIR = path.join(
  process.cwd(),
  "Ontology_Title_Clarity_Testbed_2026-08-28",
  "review-datasets-v3",
);

describe("ontology-wide homogeneous title test bed", () => {
  const dataset = loadDataset(DATASET_DIR, "ontology-title-testbed");
  const records = [...dataset.recordsById.values()];
  const titleRecords = records.filter(
    (record) => record.issueType === "title-clarity",
  );
  it("loads only the claim-aware title cards", () => {
    expect(dataset.recordsById.size).toBe(18);
    expect(titleRecords).toHaveLength(18);
    expect(
      titleRecords.filter((record) => record.reviewMode === "status-quo-audit"),
    ).toHaveLength(6);
    expect(dataset.manifest.issueTypes).toHaveLength(1);
    expect(dataset.manifest.issueTypes[0].id).toBe("title-clarity");
    expect(dataset.manifest.upstreamSource.resultingHomogeneousGroups).toBe(28);
    expect(dataset.manifest.safety).toMatchObject({
      reviewOnly: true,
      mutatesOntology: false,
      approvalAuthorizesAutomaticWrite: false,
    });
  });

  it("packages a source-bound full-run ACCESS estimate", () => {
    const estimate = JSON.parse(
      fs.readFileSync(
        path.join(DATASET_DIR, "diagnostics", "full-run-estimate.json"),
        "utf8",
      ),
    );

    expect(estimate.inventory).toMatchObject({
      atomicActivityOccurrences: 20491,
      uniqueExactTitles: 15994,
      oNetRecords: 53608,
    });
    expect(estimate.projection.homogeneousGroupScenarios).toMatchObject({
      noSplit: 20491,
      stratifiedPilot: 24713,
      oneGroupPerSourceRecord: 53608,
    });
    expect(
      estimate.projection.claimAwareAllCandidatePipeline.stratifiedPilotScenario
        .modelCalls,
    ).toBe(45204);
    expect(
      estimate.projection.claimAwareAllCandidatePipeline.stratifiedPilotScenario
        .totalAccessTokensPlanningRange.central,
    ).toBeLessThan(110000000);
    expect(
      estimate.projection.claimAwareAllCandidatePipeline.directApiCharge
        .amountUsd,
    ).toBe(0);
    expect(
      (dataset.manifest as any).fullRunEstimate.stratifiedPilotModelCalls,
    ).toBe(
      estimate.projection.claimAwareAllCandidatePipeline.stratifiedPilotScenario
        .modelCalls,
    );
  });

  it("binds every source record to at least one distinct direct-object claim", () => {
    for (const record of titleRecords) {
      const context = record.reviewerView.context;
      expect(context.type).toBe("title-split");
      const claims = context.proposedNodes.flatMap(
        (node: any) => node.sourceClaims,
      );
      const groupedIndexes = claims.map((claim: any) => claim.sourceTaskIndex);
      const accounted = new Set([
        ...groupedIndexes,
        ...context.deferredTaskIndexes,
      ]);
      expect([...accounted].sort((left, right) => left - right)).toEqual(
        context.linkedTasks.map((_: string, index: number) => index + 1),
      );
      const claimKeys = claims.map(
        (claim: any) =>
          `${claim.sourceTaskIndex}|${claim.directObject.toLowerCase()}`,
      );
      expect(claimKeys).toHaveLength(new Set(claimKeys).size);
      for (const node of context.proposedNodes) {
        expect(node.sourceTaskIndexes).toHaveLength(node.sourceTasks.length);
        expect(node.title.split(/\s+/).length).toBeGreaterThanOrEqual(2);
        expect(node.title.split(/\s+/).length).toBeLessThanOrEqual(5);
        expect(node.title.split(/\s+/)[0]).toBe(
          context.currentTitle.split(/\s+/)[0],
        );
        for (const claim of node.sourceClaims) {
          expect(claim.sourceTask.toLowerCase()).toContain(
            claim.evidenceQuote.toLowerCase(),
          );
          expect(claim.evidenceQuote.toLowerCase()).toContain(
            claim.directObject.toLowerCase(),
          );
        }
      }
    }

    const duplicateEvidence = titleRecords.find(
      (record) => record.subject.title === "Document Alternative",
    );
    expect(duplicateEvidence.reviewerView.context.linkedTasks).toHaveLength(2);
    expect(duplicateEvidence.reviewerView.context.linkedTasks[0]).toBe(
      duplicateEvidence.reviewerView.context.linkedTasks[1],
    );

    const multiClaimEvidence = titleRecords.find(
      (record) => record.subject.title === "Coordinate Care",
    );
    const sourceTwoClaims =
      multiClaimEvidence.reviewerView.context.proposedNodes
        .flatMap((node: any) => node.sourceClaims)
        .filter((claim: any) => claim.sourceTaskIndex === 2);
    expect(sourceTwoClaims.map((claim: any) => claim.directObject)).toEqual([
      "client or patient care",
      "rehabilitation",
    ]);
  });

  it("defers WordNet work until a title group has been accepted", () => {
    expect(dataset.manifest.reviewRelease).toMatchObject({
      strategy: "title-review-before-all-candidate-wordnet",
      releasedIssueTypes: ["title-clarity"],
      awaitingRegenerationIssueTypes: ["synset-alignment"],
    });
    expect(dataset.manifest.reviewRelease.message).toMatch(
      /retrieve every local candidate sense and compare them together/i,
    );
  });

  it("discloses every recorded agent, prompt, and deterministic rule", () => {
    for (const record of records) {
      const trace = toReviewerCard(record).agentTrace;
      expect(trace?.stages).toHaveLength(3);
      expect(trace?.stages.map((stage) => stage.actorId)).toEqual([
        "access-homogeneous-title-grouping-v3",
        "homogeneous-title-grouping-validator-v3",
        "homogeneous-title-testbed-card-assembler-v3",
      ]);
      for (const stage of trace?.stages || []) {
        expect(stage.actorId).not.toMatch(/^no-/);
        expect(stage.promptLabel).not.toBe("Prompt unavailable");
        expect(stage.prompt.length).toBeGreaterThan(40);
      }
    }
  });
});
