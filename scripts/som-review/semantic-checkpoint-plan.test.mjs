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
  "rob-semantic-coverage-2026-08-04",
);

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const sha256File = (file) =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

test("semantic checkpoint is complete, snapshot-bound, and blocked pending corrections", () => {
  const plan = readJson(path.join(artifactDir, "checkpoint-plan.json"));

  assert.equal(plan.applicationAllowed, false);
  assert.equal(plan.status, "regeneration-required-before-application");
  assert.match(plan.sourceDataset.manifestSha256, /^[a-f0-9]{64}$/);
  assert.match(plan.sourceOntology.snapshotSha256, /^[a-f0-9]{64}$/);
  assert.equal(plan.acceptedWholeNodeMoves.length, 7);

  for (const benchmark of plan.benchmarks) {
    const file = path.join(artifactDir, benchmark.file);
    const payload = readJson(file);
    assert.equal(sha256File(file), benchmark.sha256);
    assert.equal(payload.counts.reviewed, benchmark.reviewed);
    assert.equal(payload.counts.agreed, benchmark.agreed);
    assert.equal(payload.counts.disagreed, benchmark.disagreed);
    assert.equal(payload.counts.missing, 0);
  }

  assert.deepEqual(plan.expertCorrections.map((item) => item.type).sort(), [
    "correct-specialization-title",
    "split-evidence-by-transaction-direction",
  ]);
  assert.ok(
    plan.expertCorrections.every((item) => item.requiresRegeneration === true),
  );
  assert.match(
    plan.pendingCollectionDesign.policy,
    /may not create activity nodes/i,
  );
});
