import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { completeDiscoveryPrefix } from "./relationship-discovery-lib.mjs";
import { assertFreeRelationshipExplanations } from "./relationship-schema-lib.mjs";
function validateEntry(root, committed) {
  const dir = path.join(
    root,
    "src/lib/relationshipReview/data",
    committed.directory || "",
  );
  const read = (file) => fs.readFileSync(path.join(dir, file));
  const sha = (x) => crypto.createHash("sha256").update(x).digest("hex");
  const bytes = read(
      committed.directory ? "dataset.json" : "top-level-v1.json",
    ),
    dataset = JSON.parse(bytes),
    lock = JSON.parse(read("release-lock.json"));
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
    lock.caseCount !== committed.cases ||
    dataset.cases.length !== committed.cases ||
    new Set(dataset.cases.map((c) => c.id)).size !== committed.cases ||
    sha(bytes) !== lock.datasetSha256
  )
    fail("incomplete or unpinned dataset");
  if (
    dataset.version !== committed.version ||
    dataset.model !== "GPT-6.1 Sol" ||
    dataset.reasoning !== "high" ||
    dataset.modelVersion !== "2026-09-29" ||
    dataset.fundingRoute !== "ACCESS CIS261400 · CloudBank Azure"
  )
    fail("wrong model, version or funding route");
  if (
    !committed.directory &&
    (dataset.cases.filter((c) => c.scope === "top-four-levels").length !== 64 ||
      dataset.cases.filter((c) => c.scope === "Reason immediate child")
        .length !== 4)
  )
    fail("wrong scope");
  const sourceIds = new Set(dataset.candidates.map((n) => n.id));
  const caseIds = new Set(dataset.cases.map((c) => c.id));
  for (const map of [dataset.promptByCase, dataset.challengePromptByCase])
    if (map && Object.entries(map).some(([id, prompt]) => !caseIds.has(id) || typeof prompt !== "string" || !prompt.trim()))
      fail("invalid per-case prompt provenance");
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
    assertFreeRelationshipExplanations(body.text?.format?.schema);
    assertFreeRelationshipExplanations(challenge.text?.format?.schema);
    if (
      sha(JSON.stringify(body)) !== c.requestSha256 ||
      body.instructions !== (dataset.promptByCase?.[c.id] ?? dataset.prompt) ||
      challenge.instructions !== (dataset.challengePromptByCase?.[c.id] ?? dataset.challengePrompt)
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
    if (trace.cardIdentifierNormalization) {
      const normalization = trace.cardIdentifierNormalization;
      const text = trace.proposalResponse.output
        .flatMap((o) => o.content || [])
        .filter((part) => part.type === "output_text")
        .map((part) => part.text).join("\n");
      const rawCases = JSON.parse(text).cases;
      if (rawCases.length !== 1 || rawCases[0].analysis.nodeId !== c.id ||
          normalization.caseId !== c.id ||
          normalization.originalCardId !== rawCases[0].card.caseId ||
          normalization.requestSha256 !== c.requestSha256)
        fail("unverified display card identifier normalization");
    }
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
    if ([c.analysis.summary, c.analysis.meaning, c.analysis.example].some((text) => sourceIds.has(String(text).trim())))
      fail("reviewer explanation contains only a source identifier");
  }
  if (committed.presentationSha256) {
    const presentationBytes = read("presentation.json"),
      traceBytes = read("presentation-trace.json");
    if (
      sha(presentationBytes) !== committed.presentationSha256 ||
      sha(traceBytes) !== committed.presentationTraceSha256
    )
      fail("selection evidence hash mismatch");
    const presentation = JSON.parse(presentationBytes),
      trace = JSON.parse(traceBytes);
    if (committed.directory) {
      const discovery = trace.discovery;
      const families = discovery.plan.packets.flatMap((p) => p.families);
      if (
        new Set(families.map((f) => f.parent.id)).size !==
          discovery.plan.families ||
        new Set(families.flatMap((f) => f.siblings.map((n) => n.id))).size !==
          discovery.plan.distinctChildren ||
        discovery.results.length !== discovery.plan.packets.length ||
        discovery.plan.sourceSha256 !== dataset.sourceSha256
      )
        fail("sibling discovery coverage mismatch");
      for (const r of discovery.results) {
        const packet = discovery.plan.packets.find((p) => p.id === r.packetId);
        const exact = discovery.exactRequests.find(
          (x) => x.jobId === r.result.jobId,
        );
        const raw = discovery.responses.find(
          (x) => x.jobId === r.result.jobId,
        )?.payload;
        if (
          !packet ||
          !exact ||
          !raw ||
          JSON.stringify(JSON.parse(exact.body.input).families) !==
            JSON.stringify(packet.families) ||
          sha(JSON.stringify(exact.body)) !== r.result.requestSha256 ||
          JSON.stringify(
            r.result.value.familyAssessments.map((f) => f.parentId).sort(),
          ) !== JSON.stringify(packet.families.map((f) => f.parent.id).sort())
        )
          fail("sibling discovery provenance mismatch");
        const text = raw.output
          .flatMap((o) => o.content || [])
          .filter((c) => c.type === "output_text")
          .map((c) => c.text)
          .join("\n");
        const parsed =
          raw.status === "completed"
            ? JSON.parse(text)
            : completeDiscoveryPrefix(text);
        if (
          JSON.stringify(parsed) !== JSON.stringify(r.result.value) ||
          (raw.status !== "completed" &&
            (raw.status !== "incomplete" ||
              r.result.recovery?.kind !== "fully-emitted-prefix-only"))
        )
          fail("invalid partial discovery recovery");
      }
    }
    const reviews = [...(trace.authors || [trace.editor]), ...trace.critiques];
    if (
      !Array.isArray(trace.exactRequests) ||
      trace.exactRequests.length !== reviews.length
    )
      fail("missing exact selection review requests");
    for (const review of reviews) {
      const requests = trace.exactRequests.filter(
        (r) => r.jobId === review.jobId,
      );
      if (
        requests.length !== 1 ||
        requests[0].body.model !== "gpt-6-1-sol-society-of-mind" ||
        requests[0].body.reasoning?.effort !== "high" ||
        requests[0].requestSha256 !== review.requestSha256 ||
        sha(JSON.stringify(requests[0].body)) !== review.requestSha256 ||
        typeof requests[0].body.instructions !== "string" ||
        !requests[0].body.instructions ||
        typeof requests[0].body.input !== "string" ||
        !requests[0].body.input
      )
        fail("selection review request provenance mismatch");
      assertFreeRelationshipExplanations(requests[0].body.text?.format?.schema);
      if (review.value.assessments?.some((a) => sourceIds.has(String(a.reason).trim())))
        fail("critical explanation contains only a source identifier");
    }
    if (
      presentation.datasetSha256 !== sha(bytes) ||
      presentation.datasetVersion !== dataset.version ||
      new Set(presentation.selectedCaseIds).size !==
        presentation.selectedCaseIds.length ||
      (committed.directory
        ? trace.critiques.length < 2
        : trace.critiques.length !== 2)
    )
      fail("invalid selected review set");
    const sources = new Map(
      [
        ...dataset.candidates,
        ...dataset.cases.flatMap((c) => c.currentParents),
      ].map((n) => [n.id, n]),
    );
    for (const id of presentation.selectedCaseIds) {
      const c = dataset.cases.find((c) => c.id === id),
        card = presentation.cards.find((c) => c.caseId === id);
      if (
        !c ||
        !card?.eligible ||
        card.remainingMaterialObjections.length ||
        c.mechanicalIssues.length ||
        c.interProposalIssues?.length ||
        JSON.stringify(c.currentParents.map((n) => n.id).sort()) ===
          JSON.stringify(c.analysis.proposedParents.map((n) => n.nodeId).sort())
      )
        fail("non-actionable selected proposal");
      const applicableCritiques = trace.critiques.filter((r) =>
        r.value.assessments.some((a) => a.caseId === id),
      );
      if (
        applicableCritiques.length !== 2 ||
        !applicableCritiques.every((r) =>
          r.value.assessments.some(
            (a) =>
              a.caseId === id &&
              a.acceptForOpeningQueue &&
              !a.materialObjections.length,
          ),
        )
      )
        fail("unresolved selected proposal");
      for (const q of card.quotes)
        if (!q.quote || !(
          sources.get(q.nodeId)?.description?.includes(q.quote) ||
          sources.get(q.nodeId)?.oNetTask === true && sources.get(q.nodeId)?.title?.includes(q.quote)
        ))
          fail("unverified displayed quote");
    }
  }
  return {
    version: dataset.version,
    cases: dataset.cases.length,
    model: dataset.model,
    reasoning: dataset.reasoning,
    bundleSha256: sha(bytes),
    sourceSha256: dataset.sourceSha256,
  };
}
export function validateRelationshipRelease(root = process.cwd()) {
  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(root, "scripts/deployment/relationship-review-package.json"),
    ),
  );
  const entries = [manifest, ...(manifest.history || [])];
  if (new Set(entries.map((e) => e.version)).size !== entries.length)
    throw Error("Duplicate relationship version");
  for (const e of entries)
    if (e.directory && !/^[a-z0-9-]+$/.test(e.directory))
      throw Error("Unsafe relationship directory");
  const results = entries.map((e) => validateEntry(root, e));
  return results[0];
}
if (process.argv[1] === new URL(import.meta.url).pathname)
  console.log(JSON.stringify(validateRelationshipRelease()));
