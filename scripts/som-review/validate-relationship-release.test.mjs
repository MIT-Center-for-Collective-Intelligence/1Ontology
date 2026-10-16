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
    manifest.presentationTraceSha256 = crypto
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
