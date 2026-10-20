import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { validateRelationshipRelease } from "./validate-relationship-release.mjs";

function changedTrace(mutate, check) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "relationship-release-provenance-"),
  );
  try {
    const data = path.join(root, "src/lib/relationshipReview/data");
    const scripts = path.join(root, "scripts/deployment");
    fs.mkdirSync(path.dirname(data), { recursive: true });
    fs.mkdirSync(scripts, { recursive: true });
    fs.cpSync(
      path.join(process.cwd(), "src/lib/relationshipReview/data"),
      data,
      { recursive: true },
    );
    const manifest = JSON.parse(
      fs.readFileSync(
        "scripts/deployment/relationship-review-package.json",
        "utf8",
      ),
    );
    const filename = path.join(data, "presentation-trace.json");
    const trace = JSON.parse(fs.readFileSync(filename, "utf8"));
    mutate(trace);
    const raw = JSON.stringify(trace);
    fs.writeFileSync(filename, raw);
    const entry = manifest.history?.find((e) => !e.directory) || manifest;
    entry.presentationTraceSha256 = crypto
      .createHash("sha256")
      .update(raw)
      .digest("hex");
    fs.writeFileSync(
      path.join(scripts, "relationship-review-package.json"),
      JSON.stringify(manifest),
    );
    check(() => validateRelationshipRelease(root));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
test("rejects a repinned presentation trace that omits its exact review requests", () => {
  changedTrace(
    (trace) => delete trace.exactRequests,
    (validate) =>
      assert.throws(validate, /missing exact selection review requests/),
  );
});
test("rejects repinned evidence when the exact request differs from its recorded request hash", () => {
  changedTrace(
    (trace) => {
      trace.exactRequests[0].body.instructions += " altered";
    },
    (validate) =>
      assert.throws(validate, /selection review request provenance mismatch/),
  );
});
test("rejects a repinned display-card binding that disagrees with the raw response", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "relationship-card-binding-"));
  try {
    const data = path.join(root, "src/lib/relationshipReview/data");
    const scripts = path.join(root, "scripts/deployment");
    fs.mkdirSync(path.dirname(data), { recursive: true });
    fs.mkdirSync(scripts, { recursive: true });
    fs.cpSync("src/lib/relationshipReview/data", data, { recursive: true });
    const manifest = JSON.parse(fs.readFileSync("scripts/deployment/relationship-review-package.json"));
    // Legacy cardIdentifierNormalization belongs to the pinned root release,
    // not to an active atomic batch with its own frozen trace hashes.
    const entry = manifest.history?.find(
      (e) => !e.directory && e.version === "top-level-relationships-20261016-v1",
    );
    assert.ok(entry, "missing pinned historical top-level-v1 entry");
    const directory = data;
    const dataset = JSON.parse(fs.readFileSync(path.join(directory, "top-level-v1.json")));
    const id = dataset.cases[0].id;
    const file = path.join(directory, "traces", id + ".json");
    const trace = JSON.parse(fs.readFileSync(file));
    trace.cardIdentifierNormalization = { caseId: "wrong-activity", originalCardId: "wrong-card", requestSha256: dataset.cases[0].requestSha256 };
    fs.writeFileSync(file, JSON.stringify(trace));
    const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
    const lockFile = path.join(directory, "release-lock.json");
    const lock = JSON.parse(fs.readFileSync(lockFile));
    lock.traceHashes[id] = hash(fs.readFileSync(file));
    fs.writeFileSync(lockFile, JSON.stringify(lock));
    entry.releaseLockSha256 = hash(fs.readFileSync(lockFile));
    fs.writeFileSync(path.join(scripts, "relationship-review-package.json"), JSON.stringify(manifest));
    assert.throws(() => validateRelationshipRelease(root), /unverified display card identifier normalization/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
