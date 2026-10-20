import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  atomicProofBytes,
  atomicBatchTrace,
  validateExpandedAtomicEvidence,
} from "./validate-expanded-atomic-release.mjs";

const root = process.cwd(),
  manifest = JSON.parse(
    fs.readFileSync(
      path.join(root, "scripts/deployment/relationship-review-package.json"),
    ),
  );
const active = manifest.methodology === "atomic-generalization-expansion-v1";
const hash = (x) => crypto.createHash("sha256").update(x).digest("hex");
function fixture() {
  const m = structuredClone(manifest),
    base = path.join(root, "src/lib/relationshipReview/data"),
    dir = path.join(base, m.directory),
    files = new Map();
  for (const name of [
    "dataset.json",
    "release-lock.json",
    "presentation.json",
    "presentation-trace.json",
  ])
    files.set(name, fs.readFileSync(path.join(dir, name)));
  const proofBytes = fs.readFileSync(path.join(dir, "execution-proof.json"));
  files.set("execution-proof.json", proofBytes);
  const proof = JSON.parse(proofBytes);
  const proofFiles = Array.isArray(proof.files)
    ? proof.files.map((file) => file.path ?? file.file ?? file.name)
    : Object.keys(proof.files);
  for (const name of proofFiles)
    files.set(name, fs.readFileSync(path.join(dir, name)));
  for (const c of JSON.parse(files.get("dataset.json")).cases)
    files.set(
      "traces/" + c.id + ".json",
      fs.readFileSync(path.join(dir, "traces", c.id + ".json")),
    );
  const graph = fs.readFileSync(
      path.join(base, m.sharedSourceGraph.directory, "source-graph.json"),
    ),
    previous = new Set();
  for (const e of m.history)
    for (const c of JSON.parse(
      fs.readFileSync(
        path.join(
          base,
          e.directory ? e.directory + "/dataset.json" : "top-level-v1.json",
        ),
      ),
    ).cases)
      previous.add(c.id);
  return { m, files, graph, previous };
}
function verify(f) {
  return validateExpandedAtomicEvidence(
    f.m,
    (name) => f.files.get(name),
    () => f.graph,
    f.previous,
  );
}
function trace(f) {
  return JSON.parse(f.files.get("presentation-trace.json"));
}
function setTrace(f, t) {
  const b = atomicProofBytes(t);
  f.files.set("presentation-trace.json", b);
  f.m.presentationTraceSha256 = hash(b);
  // Repin only local lock metadata; the independent execution proof and
  // all of its privately pinned artifacts remain unchanged.
  const lock = JSON.parse(f.files.get("release-lock.json"));
  let changed = false;
  for (const key of ["presentationTraceSha256", "semanticAttemptsSha256"])
    if (Object.hasOwn(lock, key) && lock[key] !== f.m[key]) {
      lock[key] = f.m[key];
      changed = true;
    }
  if (changed) {
    const bytes = atomicProofBytes(lock);
    f.files.set("release-lock.json", bytes);
    f.m.releaseLockSha256 = hash(bytes);
  }
}
function repinBatchData(batch) {
  batch.manifest.bundleSha256 = hash(atomicProofBytes(batch.dataset));
  batch.lock.datasetSha256 = batch.manifest.bundleSha256;
  batch.manifest.releaseLockSha256 = hash(atomicProofBytes(batch.lock));
  batch.presentation.datasetSha256 = batch.manifest.bundleSha256;
  batch.manifest.presentationSha256 = hash(
    atomicProofBytes(batch.presentation),
  );
}
test(
  "current expanded release retains every independently checked batch",
  { skip: !active },
  () => {
    const f = fixture(),
      r = verify(f);
    assert.equal(r.cases, f.m.cases);
    assert.ok(r.batches > 1);
    assert.ok(r.sourceCases >= r.cases);
  },
);
test(
  "the displayed Generalization sources cannot omit a difficult record",
  { skip: !active },
  () => {
    const f = fixture(),
      t = trace(f),
      b = t.batches.find((b) =>
        b.dataset.cases.some((c) => c.generalizationEvidence?.length),
      );
    b.dataset.cases
      .find((c) => c.generalizationEvidence?.length)
      .generalizationEvidence[0].sourceIds.pop();
    repinBatchData(b);
    setTrace(f, t);
    assert.throws(() => verify(f), /Generalization evidence/);
  },
);
test(
  "a nicer counterargument cannot replace the exact critical review",
  { skip: !active },
  () => {
    const f = fixture(),
      t = trace(f),
      b = t.batches.find((b) => b.presentation.cards.length);
    b.presentation.cards[0].alternativeAssessment = "An invented assurance";
    b.manifest.presentationSha256 = hash(atomicProofBytes(b.presentation));
    setTrace(f, t);
    assert.throws(() => verify(f), /review explanation/);
  },
);
test(
  "independent execution proof rejects role usage after coordinated local repinning",
  { skip: !active },
  () => {
    const f = fixture(),
      t = trace(f),
      b = t.batches[0],
      role = t.critiques.find((r) => r.jobId === b.reviewJobIds[1]);
    role.attempts.at(-1).usage.output_tokens++;
    const p = atomicBatchTrace(t, b);
    b.manifest.presentationTraceSha256 = hash(atomicProofBytes(p));
    b.manifest.semanticAttemptsSha256 = hash(
      Buffer.from(JSON.stringify(p.allInferenceAttempts)),
    );
    setTrace(f, t);
    assert.throws(() => verify(f), /semantic lineage mismatch/);
  },
);
test(
  "an omitted batch role is rejected even with a new local trace pin",
  { skip: !active },
  () => {
    const f = fixture(),
      t = trace(f);
    t.batches[0].reviewJobIds.pop();
    setTrace(f, t);
    assert.throws(() => verify(f), /batch/);
  },
);
test(
  "reusing a critique across batches cannot manufacture two checks",
  { skip: !active },
  () => {
    const f = fixture(),
      t = trace(f);
    t.batches[1].reviewJobIds[1] = t.batches[0].reviewJobIds[1];
    setTrace(f, t);
    assert.throws(() => verify(f));
  },
);
test(
  "a frozen batch proof cannot silently rewrite its displayed reason",
  { skip: !active },
  () => {
    const f = fixture(),
      t = trace(f),
      b = t.batches.find((b) => b.dataset.cases.length);
    b.dataset.cases[0].analysis.summary = "Changed after inference";
    b.manifest.bundleSha256 = hash(atomicProofBytes(b.dataset));
    b.lock.datasetSha256 = b.manifest.bundleSha256;
    b.manifest.releaseLockSha256 = hash(atomicProofBytes(b.lock));
    b.presentation.datasetSha256 = b.manifest.bundleSha256;
    b.manifest.presentationSha256 = hash(atomicProofBytes(b.presentation));
    setTrace(f, t);
    assert.throws(
      () => verify(f),
      /normalized proposal differs|unsupported presentation/,
    );
  },
);
test(
  "the common graph remains an authority rather than a self-reported list",
  { skip: !active },
  () => {
    const f = fixture();
    const g = JSON.parse(f.graph);
    g[0].title += " altered";
    f.graph = Buffer.from(JSON.stringify(g));
    assert.throws(() => verify(f), /shared source graph/);
  },
);
test(
  "discovery requests cannot be omitted while retaining admitted cases",
  { skip: !active },
  () => {
    const f = fixture(),
      t = trace(f);
    t.discovery.roles = [];
    setTrace(f, t);
    assert.throws(() => verify(f), /discovery|^Error: Execution proof: semantic lineage mismatch$/);
  },
);
test(
  "dropping a metered attempt cannot change the cost/provenance total",
  { skip: !active },
  () => {
    const f = fixture(),
      t = trace(f);
    t.allInferenceAttempts.pop();
    f.m.semanticAttemptsSha256 = hash(
      Buffer.from(JSON.stringify(t.allInferenceAttempts)),
    );
    setTrace(f, t);
    assert.throws(() => verify(f), /semantic lineage mismatch/);
  },
);
test(
  "combined trace pins are required independently of the batch locks",
  { skip: !active },
  () => {
    const f = fixture(),
      c = JSON.parse(f.files.get("dataset.json")).cases[0];
    f.files.set("traces/" + c.id + ".json", Buffer.from("{}"));
    assert.throws(() => verify(f), /trace hash|trace mismatch/);
  },
);
test(
  "review ordering follows both critiques rather than an invented confidence",
  { skip: !active },
  () => {
    const f = fixture(),
      t = trace(f),
      role = t.critiques[0];
    role.value.cases[0].reviewPriority = "guaranteed-correct";
    setTrace(f, t);
    assert.throws(() => verify(f));
  },
);
test("a standalone proof has exactly its own three role requests", () => {
  const full = {
    authors: [{ jobId: "a", attempts: [] }],
    critiques: [
      { jobId: "b", attempts: [] },
      { jobId: "c", attempts: [] },
    ],
    exactRequests: [
      { jobId: "a" },
      { jobId: "b" },
      { jobId: "c" },
      { jobId: "other" },
    ],
    rawResponses: [{ jobId: "a" }, { jobId: "b" }, { jobId: "c" }],
    selectionRule: "rule",
  };
  const p = atomicBatchTrace(full, {
    reviewJobIds: ["a", "b", "c"],
    sample: {},
  });
  assert.deepEqual(
    p.exactRequests.map((r) => r.jobId),
    ["a", "b", "c"],
  );
  assert.throws(
    () => atomicBatchTrace(full, { reviewJobIds: ["a", "b", "missing"] }),
    /missing/,
  );
});
