import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("all application scripts require explicit apply and reviewed decisions", () => {
  for (const file of [
    "scripts/som-review/clone-and-apply-title-review.mjs",
    "scripts/som-review/clone-and-apply-content-review.mjs",
    "scripts/som-review/clone-and-apply-structure-review.mjs",
  ]) {
    const source = read(file);
    assert.match(source, /args\.apply === true \|\| args\.apply === "true"/);
    assert.match(source, /benchmark/i);
    assert.match(source, /decision/i);
    assert.doesNotMatch(source, /detectorConfidence|judgeConfidence/);
  }
});

test("dataset loading includes proposals, controls, and manual checks", () => {
  const source = read("src/lib/somReview/dataset.ts");
  assert.match(source, /all_proposals\.jsonl/);
  assert.match(source, /all_controls\.jsonl/);
  assert.match(source, /manual_checks\.jsonl/);
});

test("exploratory candidates retain confidence without using it as a gate", () => {
  const source = read(
    "scripts/som-review/generate-exploratory-subbranch-dataset.mjs",
  );
  assert.match(source, /detectorConfidence/);
  assert.match(source, /judgeConfidence/);
  assert.match(source, /reviewMode: "manual-check"/);
  assert.match(source, /Confidence is\s+descriptive metadata only/i);
  assert.doesNotMatch(
    source,
    /if\s*\([^)]*(?:detectorConfidence|judgeConfidence)[^)]*\)\s*\{[^}]*apply/is,
  );
});
