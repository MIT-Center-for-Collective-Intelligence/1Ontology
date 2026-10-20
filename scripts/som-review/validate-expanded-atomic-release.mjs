import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { validateExecutionProof } from "./execution-cost-proof.mjs";
import { validateAtomicRelationshipEvidence } from "./validate-atomic-relationship-release.mjs";
import {
  validateMeteredRole,
  validateInferenceIdentities,
  historicalResponseIdentities,
} from "./inference-evidence-lib.mjs";
import {
  graphInventory,
  parentIds,
  childIds,
  descendants,
  combinedProposalConflicts,
  combinedGeneralizationLosses,
} from "./relationship-graph-lib.mjs";

const hash = (x) =>
  crypto
    .createHash("sha256")
    .update(typeof x === "string" || Buffer.isBuffer(x) ? x : JSON.stringify(x))
    .digest("hex");
export const atomicProofBytes = (x) =>
  Buffer.from(JSON.stringify(x, null, 2) + "\n");
const same = (a, b) =>
  JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fail = (message) => {
  throw Error("Expanded atomic release: " + message);
};
/** Reconstruct an exact standalone proof from shared immutable role records.
 * Original request/response bodies are stored once in the release disclosure. */
export function atomicBatchTrace(full, batch) {
  const roles = batch.reviewJobIds.map((id) =>
    [...full.authors, ...full.critiques].find((r) => r.jobId === id),
  );
  if (roles.length !== 3 || roles.some((r) => !r)) fail("missing batch roles");
  return {
    schemaVersion: "atomic-generalization-presentation-v1",
    methodology: "atomic-generalization-pilot-v1",
    authors: [roles[0]],
    critiques: roles.slice(1),
    exactRequests: roles.map((r) =>
      full.exactRequests.find((x) => x.jobId === r.jobId),
    ),
    rawResponses: roles.map((r) =>
      full.rawResponses.find((x) => x.jobId === r.jobId),
    ),
    allInferenceAttempts: roles.flatMap((r) => r.attempts),
    supersededSemanticEvidence: [],
    sample: batch.sample,
    selectionRule: full.selectionRule,
  };
}

export function validateExpandedAtomicEvidence(
  committed,
  read,
  readSharedGraph,
  previousSubjectIds = new Set(),
  previousResponseIdentities = [],
) {
  for (const [file, key] of [
    ["dataset.json", "bundleSha256"],
    ["release-lock.json", "releaseLockSha256"],
    ["presentation.json", "presentationSha256"],
    ["presentation-trace.json", "presentationTraceSha256"],
  ])
    if (hash(read(file)) !== committed[key]) fail("unpinned " + file);
  const data = JSON.parse(read("dataset.json")),
    lock = JSON.parse(read("release-lock.json")),
    presentation = JSON.parse(read("presentation.json")),
    trace = JSON.parse(read("presentation-trace.json"));
  if (
    data.methodology !== "atomic-generalization-expansion-v1" ||
    trace.methodology !== data.methodology ||
    data.version !== committed.version ||
    data.cases.length !== committed.cases ||
    !data.cases.length ||
    data.cases.length > 120 ||
    lock.previewOnly ||
    lock.ontologyWrites !== 0 ||
    lock.caseCount !== committed.cases ||
    lock.datasetSha256 !== committed.bundleSha256 ||
    presentation.datasetVersion !== data.version ||
    presentation.datasetSha256 !== committed.bundleSha256
  )
    fail("release identity or scope mismatch");
  const graphBytes = readSharedGraph(committed.sharedSourceGraph),
    graph = graphInventory(JSON.parse(graphBytes));
  if (
    hash(graphBytes) !== committed.sourceSha256 ||
    hash(graphBytes) !== committed.sharedSourceGraph.sha256 ||
    graph.byId.size !== committed.sourceNodes
  )
    fail("unverified shared source graph");
  if (
    !Array.isArray(trace.batches) ||
    !trace.batches.length ||
    trace.batches.length > 120
  )
    fail("invalid batch inventory");
  const admitted = [],
    cards = [],
    allSubjects = [],
    records = new Map(),
    allRoles = [];
  if (![trace.authors, trace.critiques, trace.exactRequests, trace.rawResponses,
        trace.supersededSemanticEvidence || []].every(Array.isArray))
    fail("invalid semantic role inventory");
  const semanticRecords = [...trace.authors, ...trace.critiques].map((result) => {
    const requests = trace.exactRequests.filter((r) => r.jobId === result.jobId),
      responses = trace.rawResponses.filter((r) => r.jobId === result.jobId);
    if (requests.length !== 1 || responses.length !== 1)
      fail("missing exact request or response");
    return { result, body: requests[0].body, response: responses[0].response };
  });
  for (const { result, body, response } of trace.supersededSemanticEvidence || [])
    validateMeteredRole(result, body, response);
  if (committed.version === "atomic-generalizations-20261019-v3" || committed.executionProofSha256)
    validateExecutionProof(committed, lock, trace, read);
  validateInferenceIdentities([
    ...semanticRecords,
    ...(Array.isArray(trace.discovery?.roles) ? trace.discovery.roles : []),
    ...(trace.supersededSemanticEvidence || []),
  ], previousResponseIdentities);
  for (const batch of trace.batches) {
    if (
      !/^batch-[0-9]{2,3}$/.test(batch.id) ||
      batch.reviewJobIds.length !== 3 ||
      new Set(batch.reviewJobIds).size !== 3
    )
      fail("invalid batch identity");
    const batchTrace = atomicBatchTrace(trace, batch),
      files = {
        "dataset.json": atomicProofBytes(batch.dataset),
        "presentation.json": atomicProofBytes(batch.presentation),
        "release-lock.json": atomicProofBytes(batch.lock),
        "presentation-trace.json": atomicProofBytes(batchTrace),
        "source-graph.json": graphBytes,
      };
    validateAtomicRelationshipEvidence(
      batch.manifest,
      (file) => (file.startsWith("traces/") ? read(file) : files[file]),
      { completeCandidateEvidence: true },
    );
    if (
      batch.manifest.sourceSha256 !== committed.sourceSha256 ||
      batch.manifest.sourceGraphSha256 !== committed.sourceSha256 ||
      batch.manifest.sourceNodes !== committed.sourceNodes ||
      batch.dataset.prompt !== data.prompt ||
      batch.dataset.challengePrompt !== data.challengePrompt
    )
      fail("batch source or prompt changed");
    const authorBody = batchTrace.exactRequests[0].body,
      source = JSON.parse(authorBody.input);
    for (const role of [...batchTrace.authors, ...batchTrace.critiques])
      validateMeteredRole(
        role,
        batchTrace.exactRequests.find((r) => r.jobId === role.jobId).body,
        batchTrace.rawResponses.find((r) => r.jobId === role.jobId).response,
      );
    allSubjects.push(...source.cases.map((c) => c.subjectId));
    allRoles.push(...batch.reviewJobIds);
    for (const record of source.records) {
      if (records.has(record.id) && !equal(records.get(record.id), record))
        fail("conflicting batch source records");
      records.set(record.id, record);
    }
    for (const c of source.cases) {
      if (
        !Array.isArray(c.candidateEvidence) ||
        !same(
          c.candidateEvidence.map((e) => e.parentId),
          c.candidateParentIds,
        )
      )
        fail("missing candidate evidence");
      for (const e of c.candidateEvidence) {
        const below = [...descendants(e.parentId, graph.byId)];
        if (
          !e.coverage?.complete ||
          e.coverage.total !== below.length ||
          !same(e.allDescendantIds, below) ||
          !same(
            e.supportingSourceIds,
            below.filter((id) => graph.byId.get(id)?.oNetTask),
          ) ||
          below.some((id) => !source.records.some((r) => r.id === id))
        )
          fail("candidate evidence coverage differs from graph");
      }
      const displayed = batch.dataset.cases.find((x) => x.id === c.subjectId);
      if (displayed) {
        const author = batchTrace.authors[0].value.cases.find(
          (x) => x.subjectId === c.subjectId,
        );
        const considered = new Set([
          ...c.supportingSourceIds,
          ...c.candidateEvidence.flatMap((e) => e.supportingSourceIds),
        ]);
        const checks = batchTrace.critiques.map((r) =>
          r.value.cases.find((x) => x.subjectId === c.subjectId),
        );
        const card = batch.presentation.cards.find(
          (x) => x.caseId === c.subjectId,
        );
        if (
          !equal(displayed.sourceIssues, author.sourceIssues) ||
          author.sourceIssues.some((s) => !considered.has(s.sourceId)) ||
          !equal(displayed.challenge, {
            verdict: "supported",
            reason: checks.map((x) => x.reason).join("\n\n"),
            issues: [],
          }) ||
          card.alternativeAssessment !==
            checks
              .map((x) => x.strongestObjection + "\n" + x.objectionResolution)
              .join("\n\n")
        )
          fail(
            "displayed review explanation differs from the original assessments",
          );
        const expected = displayed.analysis.proposedParents
          .map((p) => p.nodeId)
          .filter((id) => !c.currentParentIds.includes(id))
          .map((parentId) => ({
            parentId,
            sourceIds: c.candidateEvidence.find((e) => e.parentId === parentId)
              .supportingSourceIds,
          }));
        if (!equal(displayed.generalizationEvidence, expected))
          fail(
            "displayed Generalization evidence differs from complete candidate sources",
          );
      }
    }
    for (const critic of batchTrace.critiques)
      for (const c of critic.value.cases)
        if (
          !["strong-opening", "standard"].includes(c.reviewPriority) ||
          typeof c.priorityExplanation !== "string" ||
          !c.priorityExplanation.trim()
        )
          fail("invalid review ordering evidence");
    admitted.push(...batch.dataset.cases);
    cards.push(...batch.presentation.cards);
  }
  if (
    new Set(trace.batches.map((b) => b.id)).size !== trace.batches.length ||
    new Set(allSubjects).size !== allSubjects.length ||
    allSubjects.length > 120 ||
    new Set(allRoles).size !== allRoles.length
  )
    fail("duplicated or excessive source coverage");
  if (
    !same(
      allRoles,
      [...trace.authors, ...trace.critiques].map((r) => r.jobId),
    ) ||
    trace.exactRequests.length !== allRoles.length ||
    trace.rawResponses.length !== allRoles.length
  )
    fail("extra or omitted paid review roles");
  if (
    !same(
      data.cases.map((c) => c.id),
      admitted.map((c) => c.id),
    ) ||
    new Set(data.cases.map((c) => c.id)).size !== admitted.length ||
    !data.cases.every((c) =>
      equal(
        c,
        admitted.find((x) => x.id === c.id),
      ),
    ) ||
    !same(
      presentation.selectedCaseIds,
      admitted.map((c) => c.id),
    ) ||
    !same(
      presentation.cards.map((c) => c.caseId),
      admitted.map((c) => c.id),
    ) ||
    !presentation.cards.every((c) =>
      equal(
        c,
        cards.find((x) => x.caseId === c.caseId),
      ),
    )
  )
    fail("combined release differs from validated batches");
  if (
    data.model !== "GPT-6.1 Sol" ||
    data.modelVersion !== "2026-09-29" ||
    data.reasoning !== "high" ||
    data.fundingRoute !== "ACCESS CIS261400 · CloudBank Azure" ||
    data.sourceSha256 !== committed.sourceSha256 ||
    data.candidates.length !== records.size ||
    new Set(data.candidates.map((n) => n.id)).size !== records.size ||
    !data.candidates.every((n) => {
      const r = records.get(n.id);
      return (
        r &&
        n.title === r.title &&
        n.description === r.description &&
        n.oNetTask === r.oNetTask &&
        same(n.currentGeneralizationIds, r.currentGeneralizationIds)
      );
    })
  )
    fail("combined source/model mismatch");
  for (const c of data.cases)
    if (hash(read("traces/" + c.id + ".json")) !== lock.traceHashes[c.id])
      fail("combined case trace mismatch");
  if (Object.keys(lock.traceHashes).length !== data.cases.length)
    fail("extra combined trace identity");
  const proposals = data.cases.map((c) => ({
    subjectId: c.id,
    parentIds: c.analysis.proposedParents.map((p) => p.nodeId),
    requiredGeneralizationIds: parentIds(graph.byId.get(c.id)),
  }));
  if (
    combinedProposalConflicts(proposals, graph).length ||
    combinedGeneralizationLosses(proposals, graph).length
  )
    fail("joint cycle or lost independent Generalization");
  const discovery = trace.discovery;
  if (
    !discovery ||
    !Array.isArray(discovery.roles) ||
    !discovery.roles.length ||
    discovery.roles.length > 17
  )
    fail("missing bounded discovery provenance");
  const discovered = new Map(),
    discoveryAttempts = [];
  for (const role of discovery.roles) {
    const { body, response, result } = role;
    validateMeteredRole(result, body, response);
    const text = response.output
      ?.flatMap((o) => o.content || [])
      .filter((c) => c.type === "output_text")
      .map((c) => c.text)
      .join("\n");
    if (
      hash(body) !== result.requestSha256 ||
      response.id !== result.responseId ||
      response.status !== "completed" ||
      response.model !== body.model ||
      body.model !== "gpt-6-1-sol-society-of-mind" ||
      body.reasoning?.effort !== "high" ||
      !equal(JSON.parse(text), result.value)
    )
      fail("discovery inference lineage mismatch");
    const input = JSON.parse(body.input);
    if (input.sourceSha256 !== committed.sourceSha256)
      fail("discovery used another graph");
    const listed = new Map();
    for (const family of input.families) {
      if (graph.byId.get(family.parentId)?.title !== family.parentTitle)
        fail("discovery family mismatch");
      for (const n of family.activities) {
        const original = graph.byId.get(n.id);
        if (
          !original ||
          n.title !== original.title ||
          n.sourceCount !== childIds(original).length ||
          !parentIds(original).includes(family.parentId) ||
          n.alreadyReviewed !== previousSubjectIds.has(n.id)
        )
          fail(
            "discovery activity differs from source graph or review history",
          );
        listed.set(n.id, n);
      }
    }
    if (
      !Array.isArray(result.value.suggestions) ||
      result.value.suggestions.length > 18
    )
      fail("invalid discovery output");
    for (const s of result.value.suggestions) {
      if (
        !listed.has(s.subjectId) ||
        listed.get(s.subjectId).alreadyReviewed ||
        !Array.isArray(s.candidateParentIds) ||
        !s.candidateParentIds.length ||
        s.candidateParentIds.some((id) => !listed.has(id))
      )
        fail("discovery suggestion is unbound");
      if (!discovered.has(s.subjectId)) discovered.set(s.subjectId, new Set());
      for (const id of s.candidateParentIds)
        discovered.get(s.subjectId).add(id);
    }
    discoveryAttempts.push(...result.attempts);
  }
  for (const batch of trace.batches) {
    const body = trace.exactRequests.find(
      (x) => x.jobId === batch.reviewJobIds[0],
    ).body;
    for (const c of JSON.parse(body.input).cases)
      if (
        previousSubjectIds.has(c.subjectId) ||
        !discovered.has(c.subjectId) ||
        c.candidateParentIds.some((id) => !discovered.get(c.subjectId).has(id))
      )
        fail("review not derived from disclosed discovery");
  }
  const attempts = [
    ...(trace.supersededSemanticEvidence || []).flatMap((r) => r.result.attempts),
    ...discoveryAttempts,
    ...[...trace.authors, ...trace.critiques].flatMap((r) => r.attempts),
  ];
  if (
    hash(trace.allInferenceAttempts) !== committed.semanticAttemptsSha256 ||
    !equal(attempts, trace.allInferenceAttempts) ||
    new Set(attempts.map((a) => a.attemptId)).size !== attempts.length
  )
    fail("unreconciled paid inference attempts");
  if (
    trace.sample.sourceCases !== allSubjects.length ||
    trace.sample.admitted !== data.cases.length ||
    !same(
      trace.sample.held,
      allSubjects.filter((id) => !data.cases.some((c) => c.id === id)),
    )
  )
    fail("misreported selection totals");
  const strong = (id) =>
    trace.critiques
      .filter((r) => r.value.cases.some((c) => c.subjectId === id))
      .every(
        (r) =>
          r.value.cases.find((c) => c.subjectId === id).reviewPriority ===
          "strong-opening",
      );
  let sawStandard = false;
  for (const id of presentation.selectedCaseIds) {
    if (!strong(id)) sawStandard = true;
    else if (sawStandard) fail("opening order differs from critical reviews");
  }
  return {
    version: data.version,
    cases: data.cases.length,
    sourceCases: allSubjects.length,
    batches: trace.batches.length,
    model: data.model,
    reasoning: data.reasoning,
    bundleSha256: committed.bundleSha256,
    sourceSha256: data.sourceSha256,
  };
}

export function validateExpandedAtomicRelease(root, committed) {
  const base = path.join(root, "src/lib/relationshipReview/data"),
    dir = path.join(base, committed.directory);
  const entries = JSON.parse(
    fs.readFileSync(
      path.join(root, "scripts/deployment/relationship-review-package.json"),
    ),
  );
  const shared = committed.sharedSourceGraph;
  if (
    !shared ||
    !/^[a-z0-9-]+$/.test(shared.directory) ||
    !(entries.history || []).some(
      (e) =>
        e.directory === shared.directory &&
        e.sourceGraphSha256 === shared.sha256,
    )
  )
    fail("shared graph is not a pinned historical source");
  const previousSubjectIds = new Set(), previousResponseIdentities = [];
  for (const e of entries.history || []) {
    const name = e.directory
      ? path.join(e.directory, "dataset.json")
      : "top-level-v1.json";
    const datasetBytes = fs.readFileSync(path.join(base, name));
    if (hash(datasetBytes) !== e.bundleSha256) fail("unpinned historical dataset");
    for (const c of JSON.parse(datasetBytes).cases)
      previousSubjectIds.add(c.id);
    const historicalDir = e.directory ? path.join(base, e.directory) : base;
    const collect = (file, pin) => {
      const bytes = fs.readFileSync(file);
      if (pin && hash(bytes) !== pin) fail("unpinned historical inference evidence");
      previousResponseIdentities.push(...historicalResponseIdentities(JSON.parse(bytes)));
    };
    const presentationTrace = path.join(historicalDir, "presentation-trace.json");
    if (e.presentationTraceSha256 || fs.existsSync(presentationTrace))
      collect(presentationTrace, e.presentationTraceSha256);
    const traces = path.join(historicalDir, "traces");
    if (fs.existsSync(traces))
      for (const file of fs.readdirSync(traces, { withFileTypes: true }))
        if (file.isFile() && file.name.endsWith(".json"))
          collect(path.join(traces, file.name));
  }
  return validateExpandedAtomicEvidence(
    committed,
    (file) => fs.readFileSync(path.join(dir, file)),
    (s) => fs.readFileSync(path.join(base, s.directory, "source-graph.json")),
    previousSubjectIds,
    previousResponseIdentities,
  );
}
