import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDatasetSummary,
  compareSnapshots,
  percentile,
  reviewerAlias,
  summarizeElapsed,
} from "./study-baseline-lib.mjs";

test("percentile interpolates deterministically", () => {
  assert.equal(percentile([], 0.5), null);
  assert.equal(percentile([10], 0.9), 10);
  assert.equal(percentile([0, 10, 20, 30], 0.5), 15);
  assert.equal(percentile([0, 10, 20, 30], 0.9), 27);
});

test("reviewer aliases are stable and exclude the raw identifier", () => {
  const rawId = "private-reviewer-uid";
  const first = reviewerAlias(rawId, "steward");
  assert.equal(first, reviewerAlias(rawId, "steward"));
  assert.match(first, /^steward-[a-f0-9]{8}$/);
  assert.equal(first.includes(rawId), false);
});

test("elapsed summaries retain missing values and flag long wall-clock spans", () => {
  const summary = summarizeElapsed([
    { response: { elapsedMs: 10_000 } },
    { response: { elapsedMs: 20_000 } },
    { response: { elapsedMs: 3_600_000 } },
    { response: {} },
  ]);
  assert.equal(summary.recorded, 3);
  assert.equal(summary.missing, 1);
  assert.equal(summary.medianSeconds, 20);
  assert.equal(summary.over30Minutes, 1);
});

test("dataset summary aggregates decisions, revisions, agents, and orphans", () => {
  const records = [
    {
      proposalId: "p1",
      issueType: "title-clarity",
      _recordSource: "proposal",
      workflow: { dependsOnProposalIds: [] },
      internalModelEvidence: {
        detectorId: "D1",
        detectorPromptVersion: "prompt-v1",
        judgeId: "J1",
        judgePromptVersion: "judge-v1",
        judgeConfidence: "high",
      },
      provenance: { sourceSnapshotSha256: "abc" },
    },
    {
      proposalId: "p2",
      issueType: "placement",
      _recordSource: "control",
      workflow: { dependsOnProposalIds: ["p1"] },
      internalModelEvidence: {
        detectorId: "D2",
        detectorPromptVersion: "prompt-v2",
        judgeId: "",
        judgePromptVersion: "",
        judgeConfidence: "",
      },
      provenance: { sourceSnapshotSha256: "abc" },
    },
  ];
  const responses = [
    {
      proposalId: "p1",
      issueType: "title-clarity",
      reviewerId: "r1",
      status: "current",
      response: { decision: "agree", elapsedMs: 12_000 },
    },
    {
      proposalId: "p2",
      issueType: "placement",
      reviewerId: "r1",
      status: "current",
      response: { decision: "disagree", elapsedMs: 20_000 },
    },
    {
      proposalId: "old",
      issueType: "placement",
      reviewerId: "r1",
      status: "current",
      response: { decision: "agree" },
    },
  ];
  const revisions = [
    { reviewerId: "r1", issueType: "title-clarity", action: "save" },
    { reviewerId: "r1", issueType: "title-clarity", action: "edit" },
    { reviewerId: "r1", issueType: "placement", action: "undo" },
  ];
  const summary = buildDatasetSummary({
    descriptor: {
      relativeDir: "dataset",
      manifest: {
        datasetVersion: "dataset-v1",
        branch: "Sell",
        generatedAt: "2026-07-27T00:00:00.000Z",
        sourceOntology: "source",
        sourceOntologySha256: "abc",
      },
      fileHashes: [],
    },
    records,
    responses,
    revisions,
    sessions: [{ status: "completed" }],
    aliases: new Map([["r1", "steward-test"]]),
    roles: new Map([["r1", "steward"]]),
    focusReviewerId: "r1",
  });

  assert.equal(summary.inventory.proposals, 1);
  assert.equal(summary.inventory.controls, 1);
  assert.equal(summary.inventory.dependencyLinks, 1);
  assert.equal(summary.reviewTrace.matchedCurrentResponses, 2);
  assert.equal(summary.reviewTrace.orphanedCurrentResponses, 1);
  assert.equal(summary.reviewTrace.agree, 2);
  assert.equal(summary.reviewTrace.disagree, 1);
  assert.equal(summary.reviewTrace.matchedDecisions.agree, 1);
  assert.equal(summary.reviewTrace.orphanedDecisions.agree, 1);
  assert.equal(summary.reviewTrace.revisions.edits, 1);
  assert.equal(summary.reviewTrace.revisions.undos, 1);
  assert.equal(summary.byDetector[0].judgments, 1);
  assert.equal(summary.focusReviewer.label, "steward-test");
  assert.equal(summary.focusReviewer.matchedJudgments, 2);
  assert.equal(summary.focusReviewer.orphanedJudgments, 1);
  assert.equal(JSON.stringify(summary).includes("r1"), false);
});

test("snapshot comparison survives cloned node IDs", () => {
  const original = {
    ontologyName: "Original",
    capturedAt: "2026-01-01T00:00:00.000Z",
    nodes: [
      { id: "old-root", title: "Sell" },
      { id: "old-child", title: "Sell Goods" },
    ],
    edges: [
      {
        parentId: "old-root",
        childId: "old-child",
        collectionName: "main",
      },
    ],
  };
  const current = {
    ontologyName: "Current",
    capturedAt: "2026-01-02T00:00:00.000Z",
    nodes: [
      { id: "new-root", title: "Sell" },
      { id: "new-child", title: "Sell Goods" },
    ],
    edges: [
      {
        parentId: "new-root",
        childId: "new-child",
        collectionName: "main",
      },
    ],
  };
  const comparison = compareSnapshots(original, current);
  assert.deepEqual(comparison.addedTitles, []);
  assert.deepEqual(comparison.removedTitles, []);
  assert.deepEqual(comparison.addedEdges, []);
  assert.deepEqual(comparison.removedEdges, []);
});
