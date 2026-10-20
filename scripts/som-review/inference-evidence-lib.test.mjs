import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { validateTokenUsage, validateInferenceIdentities, historicalResponseIdentities } from "./inference-evidence-lib.mjs";
import { atomicConsideredSourceIds, matchesAtomicSourceCoverage, validateAtomicExpansionBindings } from "./validate-atomic-relationship-release.mjs";

const hash = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const usage = () => ({ input_tokens: 10, output_tokens: 5, total_tokens: 15,
  input_tokens_details: { cached_tokens: 2, cache_write_tokens: 1 },
  output_tokens_details: { reasoning_tokens: 3 } });
function record(job, id) {
  const body = { model: "synthetic", input: job };
  const response = { id, status: "completed", output: [], usage: usage() };
  const result = { jobId: job, requestSha256: hash(body), responseId: id, attempts: [
    { attemptId: job + "-1", jobId: job, requestSha256: hash(body), responseId: id,
      httpStatus: 200, responseStatus: "completed", usage: usage() },
  ] };
  return { body, response, result };
}

test("every detail count, including unknown detail names, is a nonnegative safe integer", () => {
  validateTokenUsage(usage());
  for (const invalid of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, "0", null]) {
    const u = usage();
    u.input_tokens_details.new_token_kind = invalid;
    assert.throws(() => validateTokenUsage(u), /token detail/);
  }
  for (const change of [
    (u) => { u.input_tokens_details.cache_write_tokens = 9; },
    (u) => { u.output_tokens_details.audio_tokens = 3; },
    (u) => { u.input_tokens_details = null; },
    (u) => { u.total_tokens++; },
  ]) {
    const u = usage(); change(u);
    assert.throws(() => validateTokenUsage(u), /token/);
  }
});

test("earlier attempts are checked, not just the completed final attempt", () => {
  const r = record("author", "response-a");
  r.result.attempts.unshift({ ...structuredClone(r.result.attempts[0]),
    attemptId: "author-0", responseId: "response-old" });
  r.result.attempts[0].usage.output_tokens_details.reasoning_tokens = -1;
  assert.throws(() => validateInferenceIdentities([r]), /token detail/);
});

test("discovery, separate batches, superseded calls and retries share one identity namespace", () => {
  const records = [record("discovery", "d"), record("batch-1-author", "a"),
    record("batch-2-critic", "c"), record("superseded", "s")];
  validateInferenceIdentities(records);
  for (let i = 1; i < records.length; i++) {
    const altered = structuredClone(records);
    altered[i].response.id = altered[i].result.responseId = "d";
    altered[i].result.attempts[0].responseId = "d";
    altered[i].response.output = [{ content: [{ type: "output_text", text: "different payload" }] }];
    assert.throws(() => validateInferenceIdentities(altered), /provider response identity/);
  }
  const retry = record("retry", "r");
  retry.result.attempts.unshift({ ...structuredClone(retry.result.attempts[0]), attemptId: "retry-0" });
  assert.throws(() => validateInferenceIdentities([retry]), /provider response identity/);
});

test("historical raw and ID-only formats exclude reuse without requiring a common schema", () => {
  const current = record("new", "old-id");
  const historical = historicalResponseIdentities({
    proposalResponse: current.response,
    supersededSemanticEvidence: [{ result: { responseId: "other-old" } }],
    legacy: { cases: [{ id: "graph-node", title: "not a response" }] },
  });
  assert.ok(!historical.some((r) => r.responseId === "graph-node"));
  assert.throws(() => validateInferenceIdentities([current], historical), /historical provider/);
  assert.throws(() => validateInferenceIdentities([record("another", "other-old")], historical), /historical provider/);
  validateInferenceIdentities([record("fresh", "fresh-id")], historicalResponseIdentities({ cases: [] }));
});

test("expansion coverage is exactly the per-case union, never a batch-wide superset", () => {
  const c = { supportingSourceIds: ["focal"], candidateEvidence: [
    { supportingSourceIds: ["focal", "candidate"] },
  ] };
  const required = atomicConsideredSourceIds(c, true);
  assert.deepEqual(required, ["focal", "candidate"]);
  assert.ok(matchesAtomicSourceCoverage(["candidate", "focal"], required));
  for (const reported of [["focal"], ["focal", "candidate", "another-case-source"],
    ["focal", "candidate", "candidate"]])
    assert.equal(matchesAtomicSourceCoverage(reported, required), false);
  assert.deepEqual(atomicConsideredSourceIds(c), ["focal"]);
});

test("all supplied expansion card and attribution mappings are bound", () => {
  const author = { responseId: "a", requestSha256: "ha", value: { cases: [{ subjectId: "case", reason: "exact reason" }] } };
  const critics = [{ responseId: "b", requestSha256: "hb" }, { responseId: "c", requestSha256: "hc" }];
  const c = { id: "case", responseId: "a", requestSha256: "ha", challengeResponseId: "b",
    challengeRequestSha256: "hb", additionalChallengeResponseId: "c", additionalChallengeRequestSha256: "hc" };
  const card = { caseId: "case", eligible: true, headline: "Source title", reason: "exact reason" };
  const subject = { title: "Source title" };
  validateAtomicExpansionBindings(c, card, author, critics, subject);
  for (const key of Object.keys(c).filter((key) => key !== "id")) {
    const altered = { ...c, [key]: "invented" };
    assert.throws(() => validateAtomicExpansionBindings(altered, card, author, critics, subject), /unbound/);
  }
  for (const key of ["headline", "reason", "caseId", "eligible"]) {
    assert.throws(() => validateAtomicExpansionBindings(c, { ...card, [key]: "invented" }, author, critics, subject), /unbound/);
  }
  assert.throws(() => validateAtomicExpansionBindings({ ...c, unverifiedResponseId: "x" }, card, author, critics, subject), /unbound/);
});
