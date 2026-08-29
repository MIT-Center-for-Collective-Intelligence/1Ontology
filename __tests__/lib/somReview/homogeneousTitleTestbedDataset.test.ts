import fs from "fs";
import path from "path";

import { loadDataset } from "../../../src/lib/somReview/dataset";
import { toReviewerCard } from "../../../src/lib/somReview/sanitize";

const DATASET_DIR = path.join(
  process.cwd(),
  "Ontology_Title_Clarity_Testbed_2026-08-28",
  "review-datasets-v2",
);

describe("ontology-wide homogeneous title test bed", () => {
  const dataset = loadDataset(DATASET_DIR, "ontology-title-testbed");
  const records = [...dataset.recordsById.values()];
  const titleRecords = records.filter(
    (record) => record.issueType === "title-clarity",
  );
  it("loads only the streamlined title cards", () => {
    expect(dataset.recordsById.size).toBe(18);
    expect(titleRecords).toHaveLength(18);
    expect(
      titleRecords.filter((record) => record.reviewMode === "status-quo-audit"),
    ).toHaveLength(7);
    expect(dataset.manifest.issueTypes).toHaveLength(1);
    expect(dataset.manifest.issueTypes[0].id).toBe("title-clarity");
    expect(dataset.manifest.upstreamSource.resultingHomogeneousGroups).toBe(48);
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
    expect(estimate.projection.homogeneousGroups).toMatchObject({
      low: 20491,
      central: 37464,
    });
    expect(
      estimate.projection.streamlinedConditionalPipeline.centralScenario
        .modelCalls,
    ).toBe(72227);
    expect(
      estimate.projection.streamlinedConditionalPipeline.centralScenario
        .totalAccessTokensPlanningRange.central,
    ).toBeLessThan(85000000);
    expect(
      estimate.projection.streamlinedConditionalPipeline.directApiCharge
        .amountUsd,
    ).toBe(0);
    expect((dataset.manifest as any).fullRunEstimate.centralModelCalls).toBe(
      estimate.projection.streamlinedConditionalPipeline.centralScenario
        .modelCalls,
    );
  });

  it("assigns every exact source record to exactly one group", () => {
    for (const record of titleRecords) {
      const context = record.reviewerView.context;
      expect(context.type).toBe("title-split");
      const grouped = context.proposedNodes.flatMap(
        (node: any) => node.sourceTaskIndexes,
      );
      const accounted = new Set([...grouped, ...context.deferredTaskIndexes]);
      expect(grouped).toHaveLength(new Set(grouped).size);
      expect([...accounted].sort((left, right) => left - right)).toEqual(
        context.linkedTasks.map((_: string, index: number) => index + 1),
      );
      for (const node of context.proposedNodes) {
        expect(node.sourceTaskIndexes).toHaveLength(node.sourceTasks.length);
        expect(node.title.split(/\s+/)[0]).toBe(
          context.currentTitle.split(/\s+/)[0],
        );
      }
    }

    const duplicateEvidence = titleRecords.find(
      (record) => record.subject.title === "Document Alternative",
    );
    expect(duplicateEvidence.reviewerView.context.linkedTasks).toHaveLength(2);
    expect(duplicateEvidence.reviewerView.context.linkedTasks[0]).toBe(
      duplicateEvidence.reviewerView.context.linkedTasks[1],
    );
  });

  it("defers WordNet work until a title group has been accepted", () => {
    expect(dataset.manifest.reviewRelease).toMatchObject({
      strategy: "title-review-before-conditional-wordnet",
      releasedIssueTypes: ["title-clarity"],
      awaitingRegenerationIssueTypes: ["synset-alignment"],
    });
    expect(dataset.manifest.reviewRelease.message).toMatch(
      /retrieve all local candidate senses only when that check fails/i,
    );
  });

  it("discloses every recorded agent, prompt, and deterministic rule", () => {
    for (const record of records) {
      const trace = toReviewerCard(record).agentTrace;
      expect(trace?.stages).toHaveLength(3);
      expect(trace?.stages.map((stage) => stage.actorId)).toEqual([
        "access-homogeneous-title-grouping-v2",
        "homogeneous-title-grouping-validator-v2",
        "homogeneous-title-testbed-card-assembler-v2",
      ]);
      for (const stage of trace?.stages || []) {
        expect(stage.actorId).not.toMatch(/^no-/);
        expect(stage.promptLabel).not.toBe("Prompt unavailable");
        expect(stage.prompt.length).toBeGreaterThan(40);
      }
    }
  });
});
