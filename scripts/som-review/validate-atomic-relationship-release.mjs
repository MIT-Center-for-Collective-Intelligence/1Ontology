import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {graphInventory, parentIds, descendants, inspectRecommendation, combinedProposalConflicts, combinedGeneralizationLosses} from "./relationship-graph-lib.mjs";

const hash = (value) =>
  crypto
    .createHash("sha256")
    .update(
      typeof value === "string" || Buffer.isBuffer(value)
        ? value
        : JSON.stringify(value),
    )
    .digest("hex");
const same = (a, b) =>
  JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const output = (response) =>
  JSON.parse(
    response.output
      .flatMap((o) => o.content || [])
      .filter((c) => c.type === "output_text")
      .map((c) => c.text)
      .join("\n"),
  );

export function validateAtomicReviewShape(value, author = false) {
  const strings = (v) => Array.isArray(v) && v.every((x) => typeof x === "string");
  const text = (v) => typeof v === "string" && !!v.trim();
  if (!Array.isArray(value?.cases) || !value.cases.length) throw Error("Invalid atomic review schema");
  for (const c of value.cases) {
    if (!text(c.subjectId) || !text(c.reason) || !strings(c.consideredSourceIds)) throw Error("Invalid atomic review schema");
    if (author) {
      if (!["keep","change","discuss"].includes(c.judgment) || !text(c.meaning) || !text(c.titleDependency) ||
          !strings(c.proposedParentIds) || !c.proposedParentIds.length || !strings(c.supportingSourceIds) || !strings(c.unresolvedObjections) ||
          !Array.isArray(c.currentParentAssessments) || !c.currentParentAssessments.every((p) => text(p.parentId) && text(p.reason) && ["valid-independent","valid-redundant","designated-catchall","not-kind-of","unclear"].includes(p.assessment)) ||
          !Array.isArray(c.sourceIssues) || !c.sourceIssues.every((s) => text(s.sourceId) && text(s.issue)) ||
          !Array.isArray(c.alternatives) || !c.alternatives.every((a) => text(a.parentId) && text(a.whyNotPreferred))) throw Error("Invalid atomic author schema");
    } else if (!["admit","hold","reject"].includes(c.decision) || !["none","duplicate-only","material"].includes(c.sourceIssueSeverity) ||
               !strings(c.unresolvedIssues) || !text(c.strongestObjection) || !text(c.objectionResolution)) throw Error("Invalid atomic critic schema");
  }
}

/** This pilot has a shared eight-case author request and two independent
 * critiques. It is not sibling discovery; never fabricate discovery coverage
 * or claim that the bounded candidate set proves globally best placement. */
export function validateAtomicRelationshipRelease(root, committed) {
  const dir = path.join(
    root,
    "src/lib/relationshipReview/data",
    committed.directory,
  );
  const bytes = (file) => fs.readFileSync(path.join(dir, file));
  const read = (file) => JSON.parse(bytes(file));
  const fail = (message) => {
    throw Error("Atomic relationship release: " + message);
  };
  for (const [file, key] of [
    ["dataset.json", "bundleSha256"],
    ["release-lock.json", "releaseLockSha256"],
    ["presentation.json", "presentationSha256"],
    ["presentation-trace.json", "presentationTraceSha256"],
  ])
    if (hash(bytes(file)) !== committed[key]) fail("unpinned " + file);
  const dataset = read("dataset.json"),
    lock = read("release-lock.json"),
    presentation = read("presentation.json"),
    trace = read("presentation-trace.json");
  if (
    dataset.methodology !== "atomic-generalization-pilot-v1" ||
    dataset.version !== committed.version ||
    dataset.model !== "GPT-6.1 Sol" ||
    dataset.modelVersion !== "2026-09-29" ||
    dataset.reasoning !== "high" ||
    dataset.fundingRoute !== "ACCESS CIS261400 · CloudBank Azure" ||
    lock.previewOnly ||
    lock.ontologyWrites !== 0 ||
    lock.datasetSha256 !== committed.bundleSha256 ||
    lock.caseCount !== committed.cases ||
    dataset.cases.length !== committed.cases ||
    presentation.datasetVersion !== dataset.version ||
    presentation.datasetSha256 !== committed.bundleSha256 ||
    trace.methodology !== dataset.methodology ||
    trace.authors?.length !== 1 ||
    trace.critiques?.length !== 2
  )
    fail("invalid dataset identity, scope or review roles");
  const reviews = [...trace.authors, ...trace.critiques];
  validateAtomicReviewShape(trace.authors[0].value, true);
  for (const c of trace.critiques) validateAtomicReviewShape(c.value);
  if (trace.discovery || committed.inferenceLineage?.length !== 3 ||
      !same(committed.inferenceLineage.map((r) => r.role), ["author","first-critic","second-critic"])) fail("invalid atomic inference lineage");
  const allAttempts = [...(trace.supersededSemanticEvidence || []).flatMap((r) => r.result.attempts), ...reviews.flatMap((r) => r.attempts)];
  if (hash(trace.allInferenceAttempts) !== committed.semanticAttemptsSha256 ||
      JSON.stringify(allAttempts) !== JSON.stringify(trace.allInferenceAttempts) ||
      new Set(allAttempts.map((a) => a.attemptId)).size !== allAttempts.length) fail("unreconciled semantic attempts");
  if (
    new Set(reviews.map((r) => r.responseId)).size !== 3 ||
    trace.exactRequests?.length !== 3 ||
    trace.rawResponses?.length !== 3
  )
    fail("missing or repeated independent review");
  const requests = new Map();
  for (const role of reviews) {
    const matching = trace.exactRequests.filter((r) => r.jobId === role.jobId);
    const raw = trace.rawResponses.filter((r) => r.jobId === role.jobId);
    if (matching.length !== 1 || raw.length !== 1)
      fail("missing exact request or response");
    const request = matching[0],
      body = request.body,
      response = raw[0].response;
    const pinned = committed.inferenceLineage[reviews.indexOf(role)];
    if (pinned.requestSha256 !== hash(body) || pinned.responseSha256 !== hash(response)) fail("reused inference differs from pinned baseline");
    if (
      hash(body) !== role.requestSha256 ||
      request.requestSha256 !== role.requestSha256 ||
      body.model !== "gpt-6-1-sol-society-of-mind" ||
      body.reasoning?.effort !== "high" ||
      typeof body.instructions !== "string" ||
      !body.instructions.trim() ||
      typeof body.input !== "string" ||
      response.status !== "completed" ||
      response.id !== role.responseId ||
      response.model !== body.model ||
      JSON.stringify(output(response)) !== JSON.stringify(role.value)
    )
      fail("exact inference provenance mismatch");
    requests.set(role.jobId, body);
  }
  const author = trace.authors[0],
    authorBody = requests.get(author.jobId),
    source = JSON.parse(authorBody.input);
  if (
    dataset.prompt !== authorBody.instructions ||
    dataset.challengePrompt !==
      requests.get(trace.critiques[0].jobId).instructions ||
    source.sourceSha256 !== dataset.sourceSha256 ||
    source.sourceSha256 !== committed.sourceSha256
  )
    fail("prompt or source version mismatch");
  const records = new Map(source.records.map((n) => [n.id, n]));
  if (records.size !== source.records.length) fail("duplicate source record");
  const graphBytes = bytes("source-graph.json");
  if (hash(graphBytes) !== committed.sourceGraphSha256 || hash(graphBytes) !== dataset.sourceSha256) fail("source graph hash mismatch");
  const graph = graphInventory(JSON.parse(graphBytes));
  if (graph.byId.size !== committed.sourceNodes) fail("source graph node count mismatch");
  const projection = (n) => ({id:n.id,title:n.title,description:n.properties?.description || "",oNetTask:n.oNetTask === true,currentGeneralizationIds:parentIds(n)});
  const ancestorIds = (starting) => {
    const result = new Set(), queue = [...starting];
    for (let i=0;i<queue.length;i++) for (const id of parentIds(graph.byId.get(queue[i]) || {})) if (!result.has(id)) {result.add(id);queue.push(id);}
    return [...result];
  };
  for (const n of records.values()) {
    const original = graph.byId.get(n.id);
    if (!original || JSON.stringify(n) !== JSON.stringify(projection(original))) fail("request record differs from authoritative graph");
  }
  for (const c of source.cases) {
    const subject = graph.byId.get(c.subjectId), below = [...descendants(c.subjectId, graph.byId)];
    if (!subject || !same(c.currentParentIds, parentIds(subject)) || !same(c.allDescendantIds, below) ||
        !same(c.supportingSourceIds, below.filter((id) => graph.byId.get(id)?.oNetTask === true)) ||
        c.coverage?.complete !== true || c.coverage.total !== below.length) fail("request coverage differs from authoritative graph");
    const required = new Set([c.subjectId,...c.currentParentIds,...c.candidateParentIds,...below]);
    const queue = [...c.currentParentIds,...c.candidateParentIds];
    for (let i=0;i<queue.length;i++) for (const id of parentIds(graph.byId.get(queue[i]) || {})) if (!required.has(id)) {required.add(id);queue.push(id);}
    if ([...required].some((id) => !records.has(id))) fail("request omits required ancestor or source context");
  }
  const sourceIds = source.cases.map((c) => c.subjectId);
  if (
    new Set(sourceIds).size !== sourceIds.length ||
    sourceIds.length !== trace.sample.sourceCases
  )
    fail("source sample coverage mismatch");
  for (const critic of trace.critiques) {
    const input = JSON.parse(requests.get(critic.jobId).input);
    if (
      JSON.stringify(input.source) !== JSON.stringify(source) ||
      input.exactAuthorPrompt !== authorBody.instructions ||
      JSON.stringify(input.proposals) !== JSON.stringify(author.value)
    )
      fail("critic did not review the same proposal and evidence");
  }
  for (const role of reviews)
    if (
      role.value.cases.length !== sourceIds.length ||
      new Set(role.value.cases.map((c) => c.subjectId)).size !==
        sourceIds.length ||
      !same(
        role.value.cases.map((c) => c.subjectId),
        sourceIds,
      )
    )
      fail("review case coverage mismatch");
  const admitted = [];
  for (const c of source.cases) {
    const a = author.value.cases.find((x) => x.subjectId === c.subjectId);
    if (
      !same(a.consideredSourceIds, c.supportingSourceIds) ||
      new Set(a.consideredSourceIds).size !== c.supportingSourceIds.length ||
      !same(
        a.currentParentAssessments.map((p) => p.parentId),
        c.currentParentIds,
      ) ||
      a.currentParentAssessments.length !== c.currentParentIds.length ||
      !a.supportingSourceIds.every((id) =>
        c.supportingSourceIds.includes(id),
      ) ||
      !a.proposedParentIds.every(
        (id) =>
          c.candidateParentIds.includes(id) || c.currentParentIds.includes(id),
      )
    )
      fail("author source or current-Generalization coverage mismatch");
    const critiques = trace.critiques.map((r) =>
      r.value.cases.find((x) => x.subjectId === c.subjectId),
    );
    for (const r of critiques)
      if (
        !same(r.consideredSourceIds, c.supportingSourceIds) ||
        new Set(r.consideredSourceIds).size !== c.supportingSourceIds.length
      )
        fail("critic source coverage mismatch");
    if (
      a.judgment === "change" &&
      !a.unresolvedObjections.length &&
      critiques.every(
        (r) =>
          r.decision === "admit" &&
          !r.unresolvedIssues.length &&
          r.sourceIssueSeverity !== "material",
      )
    )
      admitted.push(c.subjectId);
  }
  const caseIds = dataset.cases.map((c) => c.id);
  if (
    !same(caseIds, admitted) ||
    new Set(caseIds).size !== caseIds.length ||
    !same(presentation.selectedCaseIds, admitted) ||
    new Set(presentation.selectedCaseIds).size !== admitted.length ||
    !same(
      trace.sample.held,
      sourceIds.filter((id) => !admitted.includes(id)),
    )
  )
    fail("unresolved or omitted selected proposal");
  const candidates = new Map(dataset.candidates.map((n) => [n.id, n]));
  if (candidates.size !== records.size)
    fail("candidate/source inventory mismatch");
  const equalRecord = (actual, expected) =>
    !!actual &&
    !!expected &&
    actual.id === expected.id &&
    actual.title === expected.title &&
    (actual.description || "") === (expected.description || "") &&
    actual.oNetTask === expected.oNetTask &&
    same(actual.currentGeneralizationIds, expected.currentGeneralizationIds);
  for (const [id, n] of records)
    if (!equalRecord(candidates.get(id), n))
      fail("source wording or Generalizations changed");
  const graphProposals = dataset.cases.map((c) => ({subjectId:c.id,parentIds:c.analysis.proposedParents.map((p) => p.nodeId),requiredGeneralizationIds:parentIds(graph.byId.get(c.id))}));
  if (combinedProposalConflicts(graphProposals,graph).length || combinedGeneralizationLosses(graphProposals,graph).length) fail("joint cycle or lost current Generalization");
  for (const c of dataset.cases) {
    const s = source.cases.find((x) => x.subjectId === c.id),
      a = author.value.cases.find((x) => x.subjectId === c.id);
    const raw = bytes("traces/" + c.id + ".json");
    if (hash(raw) !== lock.traceHashes[c.id]) fail("case trace hash mismatch");
    const t = JSON.parse(raw),
      covered = t.sourceContext.descendantCoverage;
    if (
      t.cardIdentifierNormalization ||
      t.normalization?.caseId !== c.id ||
      t.normalization.authorSubjectId !== c.id ||
      t.normalization.kind !== "field-name mapping only" ||
      t.normalization.semanticTextRewritten !== false ||
      t.normalization.exampleAdded !== false
    )
      fail("unverified display card identifier normalization");
    if (
      hash(t.proposalRequest) !== author.requestSha256 ||
      hash(t.challengeRequest) !== trace.critiques[0].requestSha256 ||
      hash(t.additionalChallenge.request) !==
        trace.critiques[1].requestSha256 ||
      t.proposalResponse.id !== author.responseId ||
      t.challengeResponse.id !== trace.critiques[0].responseId ||
      t.additionalChallenge.response.id !== trace.critiques[1].responseId ||
      JSON.stringify(t.proposalResponse) !==
        JSON.stringify(
          trace.rawResponses.find((r) => r.jobId === author.jobId).response,
        ) ||
      JSON.stringify(t.challengeResponse) !==
        JSON.stringify(
          trace.rawResponses.find((r) => r.jobId === trace.critiques[0].jobId)
            .response,
        ) ||
      JSON.stringify(t.additionalChallenge.response) !==
        JSON.stringify(
          trace.rawResponses.find((r) => r.jobId === trace.critiques[1].jobId)
            .response,
        ) ||
      t.sourceSnapshotSha256 !== dataset.sourceSha256 ||
      t.deployment.model.name !== "gpt-6.1-sol" ||
      t.deployment.model.version !== "2026-09-29" ||
      t.deployment.provisioningState !== "Succeeded"
    )
      fail("case inference trace mismatch");
    const contextIds = [...new Set([...s.currentParentIds,...s.candidateParentIds,...ancestorIds([...s.currentParentIds,...s.candidateParentIds])])];
    const actualAncestors = ancestorIds([c.id]);
    if (
      !equalRecord(t.sourceContext.subject, records.get(c.id)) ||
      !same(t.sourceContext.records.map((n) => n.id), contextIds) ||
      !same(t.sourceContext.ancestors.map((n) => n.id), actualAncestors) ||
      !same(c.ancestors.map((n) => n.id), actualAncestors) || !c.ancestors.every((n) => equalRecord(n, records.get(n.id))) ||
      !t.sourceContext.records.every((n) =>
        equalRecord(n, records.get(n.id)),
      ) ||
      !t.sourceContext.ancestors.every((n) =>
        equalRecord(n, records.get(n.id)),
      ) ||
      !covered.complete ||
      covered.total !== s.allDescendantIds.length ||
      !same(
        covered.fullDescendantRecords.map((n) => n.id),
        s.allDescendantIds,
      ) ||
      new Set(covered.fullDescendantRecords.map((n) => n.id)).size !==
        covered.total ||
      !covered.fullDescendantRecords.every((n) =>
        equalRecord(n, records.get(n.id)),
      ) ||
      !same(
        c.children.map((n) => n.id),
        s.allDescendantIds,
      ) ||
      !c.children.every((n) => equalRecord(n, records.get(n.id)))
    )
      fail("case source coverage mismatch");
    if (
      !equalRecord(c, records.get(c.id)) ||
      c.analysis.nodeId !== c.id ||
      c.analysis.judgment !== "change" ||
      c.scope !== "atomic-activity-review" ||
      !same(
        c.currentParents.map((n) => n.id),
        s.currentParentIds,
      ) ||
      !c.currentParents.every((n) => equalRecord(n, records.get(n.id))) ||
      !same(
        c.analysis.currentLinks.map((p) => p.parentId),
        s.currentParentIds,
      ) ||
      !same(
        c.analysis.proposedParents.map((p) => p.nodeId),
        a.proposedParentIds,
      ) ||
      c.analysis.summary !== a.reason ||
      c.analysis.meaning !== a.meaning ||
      c.analysis.caution !== a.titleDependency ||
      c.analysis.proposedParents.some(
        (p) => p.reason !== a.reason || p.whyCloser !== a.reason,
      ) ||
      JSON.stringify(c.analysis.currentLinks) !==
        JSON.stringify(
          a.currentParentAssessments.map((p) => ({
            parentId: p.parentId,
            assessment:
              p.assessment === "unclear"
                ? "unclear"
                : p.assessment === "not-kind-of"
                  ? "not-kind-of"
                  : "valid",
            reason: p.reason,
            counterexample: "",
          })),
        ) ||
      JSON.stringify(c.analysis.alternatives) !==
        JSON.stringify(
          a.alternatives.map((p) => ({
            nodeId: p.parentId,
            whyNotPreferred: p.whyNotPreferred,
          })),
        ) ||
      c.mechanicalIssues.length ||
      c.interProposalIssues?.length
    )
      fail("normalized proposal differs from evidence");
    const proposed = c.analysis.proposedParents.map((p) => p.nodeId);
    if (
      new Set(proposed).size !== proposed.length ||
      same(proposed, s.currentParentIds) ||
      proposed.some(
        (id) =>
          id === c.id ||
          s.allDescendantIds.includes(id) ||
          records.get(id)?.oNetTask !== false ||
          /^\[.*\]$/.test(records.get(id)?.title || ""),
      )
    )
      fail("invalid or non-actionable Generalization");
    if (inspectRecommendation(c.id, proposed, graph).length)
      fail("joint cycle or lost current Generalization");
    const card = presentation.cards.find((x) => x.caseId === c.id);
    if (
      !card?.eligible ||
      card.remainingMaterialObjections.length ||
      card.whyChange !== a.reason ||
      card.example ||
      c.analysis.example ||
      card.quotes.some(
        (q) =>
          !records.get(q.nodeId)?.description?.includes(q.quote) &&
          !records.get(q.nodeId)?.title?.includes(q.quote),
      )
    )
      fail("unsupported presentation");
  }
  return {
    version: dataset.version,
    cases: dataset.cases.length,
    model: dataset.model,
    reasoning: dataset.reasoning,
    bundleSha256: committed.bundleSha256,
    sourceSha256: dataset.sourceSha256,
  };
}
