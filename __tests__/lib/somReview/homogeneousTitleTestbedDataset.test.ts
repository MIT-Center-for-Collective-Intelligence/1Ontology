import fs from "fs";
import path from "path";

import {
  loadDataset,
  proposalAvailability,
} from "../../../src/lib/somReview/dataset";
import { toReviewerCard } from "../../../src/lib/somReview/sanitize";

const DATASET_DIR = path.join(
  process.cwd(),
  "Ontology_Title_Clarity_Testbed_2026-08-28",
  "review-datasets-v1",
);

describe("ontology-wide homogeneous title test bed", () => {
  const dataset = loadDataset(DATASET_DIR, "ontology-title-testbed");
  const records = [...dataset.recordsById.values()];
  const titleRecords = records.filter(
    (record) => record.issueType === "title-clarity",
  );
  const wordNetRecords = records.filter(
    (record) => record.issueType === "synset-alignment",
  );

  it("loads all review-only title and dependent WordNet cards", () => {
    expect(dataset.recordsById.size).toBe(60);
    expect(titleRecords).toHaveLength(18);
    expect(wordNetRecords).toHaveLength(42);
    expect(
      titleRecords.filter((record) => record.reviewMode === "status-quo-audit"),
    ).toHaveLength(9);
    expect(
      wordNetRecords.filter(
        (record) => record.reviewMode === "status-quo-audit",
      ),
    ).toHaveLength(26);
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
      central: 35980,
    });
    expect(
      estimate.projection.fullIndependentAudit.centralScenario.modelCalls,
    ).toBeGreaterThan(100000);
    expect(
      estimate.projection.fullIndependentAudit.centralScenario
        .totalAccessTokensPlanningRange.central,
    ).toBeGreaterThan(200000000);
    expect(
      estimate.projection.fullIndependentAudit.directApiCharge.amountUsd,
    ).toBe(0);
    expect((dataset.manifest as any).fullRunEstimate.centralModelCalls).toBe(
      estimate.projection.fullIndependentAudit.centralScenario.modelCalls,
    );
  });

  it("accounts for every exact source record without deduplicating evidence", () => {
    for (const record of titleRecords) {
      const context = record.reviewerView.context;
      expect(context.type).toBe("title-split");
      const grouped = context.proposedNodes.flatMap(
        (node: any) => node.sourceTaskIndexes,
      );
      const accounted = new Set([...grouped, ...context.deferredTaskIndexes]);
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

  it("gates every WordNet card on its exact title decision", () => {
    for (const record of wordNetRecords) {
      expect(record.workflow.dependsOnProposalIds).toHaveLength(1);
      const titleRecord = dataset.recordsById.get(
        record.workflow.dependsOnProposalIds[0],
      );
      expect(titleRecord?.issueType).toBe("title-clarity");
      expect(titleRecord?.subject.title).toBe(record.subject.title);
      expect(proposalAvailability(record, new Map())).toBe("waiting");
      expect(
        proposalAvailability(
          record,
          new Map([[titleRecord.proposalId, "agree"]]),
        ),
      ).toBe("ready");
      expect(
        proposalAvailability(
          record,
          new Map([[titleRecord.proposalId, "disagree"]]),
        ),
      ).toBe("not-applicable");
    }
  });

  it("binds every selected synset to the displayed local candidate set", () => {
    for (const record of wordNetRecords) {
      const context = record.reviewerView.context;
      expect(context.type).toBe("synset-alignment");
      const candidateIds = new Set(
        context.candidateSynsets.map((synset: any) => synset.id),
      );
      for (const selected of context.selectedSynsets) {
        expect(candidateIds.has(selected.id)).toBe(true);
      }
      if (context.decision === "keep-assigned") {
        expect(context.selectedSynsets.map((synset: any) => synset.id)).toEqual(
          context.assignedSynsets.map((synset: any) => synset.id),
        );
      }
      if (["no-suitable-synset", "uncertain"].includes(context.decision)) {
        expect(context.selectedSynsets).toEqual([]);
      }
    }
  });

  it("discloses every recorded agent, prompt, and deterministic rule", () => {
    for (const record of records) {
      const trace = toReviewerCard(record).agentTrace;
      expect(trace?.stages.length).toBeGreaterThanOrEqual(5);
      for (const stage of trace?.stages || []) {
        expect(stage.actorId).not.toMatch(/^no-/);
        expect(stage.promptLabel).not.toBe("Prompt unavailable");
        expect(stage.prompt.length).toBeGreaterThan(40);
      }
    }
  });
});
