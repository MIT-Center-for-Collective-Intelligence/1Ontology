import assert from "node:assert/strict";
import test from "node:test";

import { currentRecordsForIssue } from "./export-reviewer-benchmark.mjs";

const manifest = {
  responseCarryForward: {
    schemaVersion: "som-response-carry-forward-v1",
    mappings: [
      {
        sourceProposalId: "old-relocation",
        sourceIssueType: "relocation",
        targetProposalId: "new-one-step-move",
        targetIssueType: "cross-branch-recall",
      },
    ],
  },
};

test("projects an exact prior decision onto its replacement proposal", () => {
  const records = currentRecordsForIssue(
    [
      {
        proposalId: "old-relocation",
        issueType: "relocation",
        response: { proposalId: "old-relocation", decision: "agree" },
      },
      {
        proposalId: "retired-diagnosis",
        issueType: "cross-branch-recall",
        response: { proposalId: "retired-diagnosis", decision: "agree" },
      },
    ],
    manifest,
    "cross-branch-recall",
  );

  assert.deepEqual(records.map((record) => record.proposalId).sort(), [
    "new-one-step-move",
    "retired-diagnosis",
  ]);
  const projected = records.find(
    (record) => record.proposalId === "new-one-step-move",
  );
  assert.equal(projected.response.proposalId, "new-one-step-move");
  assert.equal(projected.carriedForwardFromProposalId, "old-relocation");
});

test("a response saved on the current proposal overrides inherited history", () => {
  const records = currentRecordsForIssue(
    [
      {
        proposalId: "old-relocation",
        issueType: "relocation",
        response: { proposalId: "old-relocation", decision: "agree" },
      },
      {
        proposalId: "new-one-step-move",
        issueType: "cross-branch-recall",
        response: {
          proposalId: "new-one-step-move",
          decision: "disagree",
        },
      },
    ],
    manifest,
    "cross-branch-recall",
  );

  assert.equal(records.length, 1);
  assert.equal(records[0].response.decision, "disagree");
  assert.equal(records[0].carriedForwardFromProposalId, undefined);
});
