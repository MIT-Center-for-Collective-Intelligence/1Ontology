import crypto from "node:crypto";

const hash = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const text = (value) => typeof value === "string" && !!value.trim();
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const fail = (message) => { throw Error("Expanded atomic release: " + message); };

export function validateTokenUsage(usage) {
  if (!usage || typeof usage !== "object" || Array.isArray(usage) ||
      ![usage.input_tokens, usage.output_tokens, usage.total_tokens].every(integer) ||
      !Number.isSafeInteger(usage.input_tokens + usage.output_tokens) ||
      usage.total_tokens !== usage.input_tokens + usage.output_tokens)
    fail("metered attempt has invalid token totals");
  for (const [key, value] of Object.entries(usage)) {
    if (key.endsWith("_tokens") && !integer(value))
      fail("metered attempt has invalid token count");
    if (!key.endsWith("_tokens_details")) continue;
    const subtotal = usage[key.slice(0, -"_details".length)];
    if (!integer(subtotal) || !value || typeof value !== "object" || Array.isArray(value))
      fail("metered attempt has invalid token details");
    let sum = 0;
    for (const count of Object.values(value)) {
      if (!integer(count)) fail("metered attempt has invalid token details");
      sum += count;
      if (!integer(sum) || sum > subtotal)
        fail("metered attempt token detail subtotal exceeds total");
    }
  }
}

function validateAttempts(result, body) {
  if (!text(result?.jobId) || !Array.isArray(result.attempts) || !result.attempts.length ||
      hash(body) !== result.requestSha256)
    fail("metered attempt has invalid request lineage");
  for (const attempt of result.attempts) {
    if (!text(attempt?.attemptId) || attempt.jobId !== result.jobId ||
        attempt.requestSha256 !== result.requestSha256)
      fail("metered attempt has invalid request lineage");
    if (attempt.usage != null) validateTokenUsage(attempt.usage);
    if (attempt.responseStatus === "completed" &&
        (!text(attempt.responseId) || attempt.usage == null))
      fail("metered attempt omits completed response identity or usage");
  }
}

export function validateMeteredRole(result, body, response) {
  validateAttempts(result, body);
  const final = result.attempts.at(-1);
  validateTokenUsage(response?.usage);
  if (!text(response.id) || response.status !== "completed" ||
      result.responseId !== response.id || final.responseId !== response.id ||
      final.httpStatus !== 200 || final.responseStatus !== "completed" ||
      !equal(final.usage, response.usage))
    fail("metered attempt does not match the exact completed response");
}

/** Read identities from heterogeneous historical traces, not graph node IDs.
 * Missing legacy fields do not imply that a historical call did not occur. */
export function historicalResponseIdentities(value) {
  const identities = [];
  function visit(node, key = "") {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { for (const child of node) visit(child, key); return; }
    if (text(node.responseId)) {
      const identity = { responseId: node.responseId };
      if (/^[a-f0-9]{64}$/.test(node.responseSha256 || ""))
        identity.responseSha256 = node.responseSha256;
      identities.push(identity);
    }
    if (text(node.id) && (key === "response" || key.endsWith("Response") ||
        Array.isArray(node.output) || Array.isArray(node.choices) ||
        node.object === "response" || node.object === "chat.completion"))
      identities.push({ responseId: node.id, responseSha256: hash(node) });
    for (const [name, child] of Object.entries(node)) visit(child, name);
  }
  visit(value);
  return identities;
}

/** One issuance identity per attempt. Role/raw/final-attempt aliases belong to
 * that same issuance; a second attempt may never reuse its provider ID. */
export function validateInferenceIdentities(records, historical = []) {
  const historicalIds = new Set(), historicalHashes = new Set(), historicalPayloads = new Map();
  for (const identity of historical) {
    if (!text(identity.responseId)) fail("invalid historical provider response identity");
    historicalIds.add(identity.responseId);
    if (!identity.responseSha256) continue;
    const previous = historicalPayloads.get(identity.responseId);
    if (previous && previous !== identity.responseSha256)
      fail("conflicting historical provider response identity");
    historicalPayloads.set(identity.responseId, identity.responseSha256);
    historicalHashes.add(identity.responseSha256);
  }
  const jobs = new Set(), attempts = new Set(), responses = new Set();
  for (const { result, body, response } of records) {
    validateAttempts(result, body);
    if (jobs.has(result.jobId)) fail("repeated semantic job identity");
    jobs.add(result.jobId);
    if (response != null) validateMeteredRole(result, body, response);
    else if (result.responseId != null || result.attempts.at(-1).responseStatus === "completed")
      fail("missing raw completed response");
    if (response != null && historicalHashes.has(hash(response)))
      fail("historical provider response payload reused");
    for (const attempt of result.attempts) {
      if (attempts.has(attempt.attemptId)) fail("repeated semantic attempt identity");
      attempts.add(attempt.attemptId);
      if (attempt.responseId == null) continue;
      if (!text(attempt.responseId)) fail("invalid provider response identity");
      if (historicalIds.has(attempt.responseId)) fail("historical provider response identity reused");
      if (responses.has(attempt.responseId)) fail("repeated provider response identity");
      responses.add(attempt.responseId);
    }
  }
}
