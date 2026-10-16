import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
export function validateRelationshipRelease(root = process.cwd()) {
  const dir = path.join(root, "src/lib/relationshipReview/data");
  const read = (file) => fs.readFileSync(path.join(dir, file));
  const sha = (x) => crypto.createHash("sha256").update(x).digest("hex");
  const bytes = read("top-level-v1.json"),
    dataset = JSON.parse(bytes),
    lock = JSON.parse(read("release-lock.json"));
  const committed = JSON.parse(
    fs.readFileSync(
      path.join(root, "scripts/deployment/relationship-review-package.json"),
    ),
  );
  if (
    sha(read("release-lock.json")) !== committed.releaseLockSha256 ||
    sha(bytes) !== committed.bundleSha256
  )
    throw Error("Relationship evidence differs from committed package");
  const fail = (message) => {
    throw Error("Relationship review release: " + message);
  };
  if (
    lock.previewOnly ||
    lock.caseCount !== 68 ||
    dataset.cases.length !== 68 ||
    new Set(dataset.cases.map((c) => c.id)).size !== 68 ||
    sha(bytes) !== lock.datasetSha256
  )
    fail("incomplete or unpinned dataset");
  if (
    dataset.version !== "top-level-relationships-20261016-v1" ||
    dataset.model !== "GPT-6.1 Sol" ||
    dataset.reasoning !== "high" ||
    dataset.modelVersion !== "2026-09-29" ||
    dataset.fundingRoute !== "ACCESS CIS261400 · CloudBank Azure"
  )
    fail("wrong model, version or funding route");
  if (
    dataset.cases.filter((c) => c.scope === "top-four-levels").length !== 64 ||
    dataset.cases.filter((c) => c.scope === "Reason immediate child").length !==
      4
  )
    fail("wrong scope");
  const sourceIds = new Set(dataset.candidates.map((n) => n.id));
  for (const c of dataset.cases) {
    const traceBytes = read("traces/" + c.id + ".json");
    if (sha(traceBytes) !== lock.traceHashes[c.id]) fail("trace hash mismatch");
    const trace = JSON.parse(traceBytes),
      body = trace.proposalRequest,
      challenge = trace.challengeRequest;
    if (
      body.model !== "gpt-6-1-sol-society-of-mind" ||
      body.reasoning.effort !== "high" ||
      challenge.model !== body.model ||
      challenge.reasoning.effort !== "high"
    )
      fail("trace model mismatch");
    if (
      sha(JSON.stringify(body)) !== c.requestSha256 ||
      body.instructions !== dataset.prompt ||
      challenge.instructions !== dataset.challengePrompt
    )
      fail("exact prompt provenance mismatch");
    if (
      trace.deployment.model.name !== "gpt-6.1-sol" ||
      trace.deployment.model.version !== "2026-09-29" ||
      trace.deployment.provisioningState !== "Succeeded" ||
      trace.proposalResponse.model !== body.model ||
      trace.challengeResponse.model !== body.model ||
      trace.proposalResponse.status !== "completed" ||
      trace.challengeResponse.status !== "completed"
    )
      fail("incomplete response or wrong Azure deployment");
    if (c.analysis.nodeId !== c.id || !c.analysis.proposedParents.length)
      fail("missing subject or full parent set");
    const parents = c.analysis.proposedParents.map((n) => n.nodeId);
    if (
      new Set(parents).size !== parents.length ||
      parents.some((id) => id === c.id || !sourceIds.has(id))
    )
      fail("invalid parent reference");
    if (
      JSON.stringify(c.currentParents.map((n) => n.id).sort()) !==
      JSON.stringify(c.analysis.currentLinks.map((n) => n.parentId).sort())
    )
      fail("parent assessment coverage mismatch");
    if (c.mechanicalIssues.length) fail("unresolved mechanical proposal issue");
    if (!["supported", "needs-discussion"].includes(c.challenge.verdict))
      fail("missing challenge");
    const prose = [
      c.analysis.summary,
      c.analysis.meaning,
      c.analysis.caution,
      c.analysis.example,
      ...c.analysis.proposedParents.map((p) => p.reason + " " + p.whyCloser),
    ].join(" ");
    if (/\bn\d{3}\b/.test(prose))
      fail("unresolved source alias in reviewer prose");
  }
  return {
    version: dataset.version,
    cases: 68,
    model: dataset.model,
    reasoning: dataset.reasoning,
    bundleSha256: sha(bytes),
    sourceSha256: dataset.sourceSha256,
  };
}
if (process.argv[1] === new URL(import.meta.url).pathname)
  console.log(JSON.stringify(validateRelationshipRelease()));
