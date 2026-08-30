import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const artifactDir = path.join(
  repoRoot,
  "artifacts/homogeneous-title-testbed-2026-08-28",
);
const inventory = JSON.parse(
  fs.readFileSync(
    path.join(artifactDir, "large-onet-activity-inventory-v5.json"),
    "utf8",
  ),
);
const sample = JSON.parse(
  fs.readFileSync(path.join(artifactDir, "sample-packet-v5.json"), "utf8"),
);

test("packages the complete more-than-ten O*NET inventory", () => {
  assert.equal(inventory.sourceSha256, sample.sourceSha256);
  assert.equal(inventory.cutoff, 10);
  assert.equal(inventory.uniqueTitleCount, 564);
  assert.equal(inventory.ontologyOccurrenceCount, 786);
  assert.equal(inventory.rows.length, inventory.uniqueTitleCount);
  assert(
    inventory.rows.every(
      (row) =>
        row.title &&
        Number.isInteger(row.linkedONetDescriptionCount) &&
        row.linkedONetDescriptionCount > inventory.cutoff,
    ),
  );
  assert.equal(
    new Set(inventory.rows.map((row) => row.title.toLowerCase())).size,
    inventory.rows.length,
  );
});

test("keeps the requested CSV to exactly two columns", () => {
  const lines = fs
    .readFileSync(
      path.join(artifactDir, "large-onet-activity-inventory-v5.csv"),
      "utf8",
    )
    .trim()
    .split("\n");
  assert.equal(lines.length, inventory.rows.length + 1);
  assert.equal(
    lines[0],
    '"Current atomic activity title","Linked O*NET descriptions"',
  );
});
