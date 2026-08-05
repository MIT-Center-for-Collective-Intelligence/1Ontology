import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const artifactDir = path.join(
  repoRoot,
  "artifacts",
  "rob-final-cleanup-2026-08-05",
);

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const readJsonl = (file) =>
  fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
const sha256File = (file) =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

test("cleanup checkpoint applies only the accepted empty-node decision", () => {
  const plan = readJson(
    path.join(artifactDir, "cleanup-application-plan.json"),
  );
  assert.equal(plan.applicationAllowed, true);
  assert.equal(plan.status, "reviewed-and-ready-for-isolated-application");
  assert.notEqual(plan.sourceOntology.appId, plan.targetOntology.appId);
  assert.match(plan.targetOntology.appId, /-v2$/);
  assert.notEqual(
    plan.supersededTargetOntology.appId,
    plan.targetOntology.appId,
  );
  assert.equal(plan.acceptedRemoval.nodeTitle, "Sell (Other)");
  assert.equal(
    plan.rejectedCollection.applicationMode,
    "do-not-apply-rejected-proposal",
  );
  assert.equal(
    plan.unsupportedLegacyAddNodes.disposition,
    "exclude-until-onet-grounded",
  );

  for (const benchmark of plan.benchmarks) {
    const file = path.join(artifactDir, benchmark.file);
    const payload = readJson(file);
    assert.equal(sha256File(file), benchmark.sha256);
    assert.equal(payload.counts.missing, 0);
  }

  const legacyDir = path.join(
    repoRoot,
    plan.unsupportedLegacyAddNodes.datasetDirectory,
  );
  const legacyRecords = readJsonl(
    path.join(legacyDir, "all_proposals.jsonl"),
  ).filter(
    (record) => record.issueType === plan.unsupportedLegacyAddNodes.issueType,
  );
  assert.equal(
    legacyRecords.length,
    plan.unsupportedLegacyAddNodes.expectedProposalCount,
  );
  assert.ok(
    legacyRecords.every(
      (record) =>
        record.internalModelEvidence.detectorName === "GapScanner" &&
        (record.reviewerView.context.sourceTasks || []).length === 0,
    ),
  );
});
