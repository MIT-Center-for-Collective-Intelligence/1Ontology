#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { stableHash } from "./homogeneous-title-clarity-lib.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const artifactDir = path.join(
  repoRoot,
  "artifacts/homogeneous-title-testbed-2026-08-28",
);
const outputDir = path.join(
  repoRoot,
  "Ontology_Title_Clarity_Testbed_2026-08-28/review-datasets-v1",
);

const inputPaths = {
  sample: path.join(artifactDir, "sample-packet.json"),
  groupings: path.join(artifactDir, "validated-groupings.json"),
  bundles: path.join(artifactDir, "wordnet-candidate-bundles.json"),
  alignments: path.join(artifactDir, "validated-wordnet-alignments.json"),
  estimate: path.join(artifactDir, "full-run-estimate.json"),
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const sha256 = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");
const sha256File = (filePath) => sha256(fs.readFileSync(filePath));
const stableId = (prefix, value) =>
  `${prefix}-${stableHash(value).slice(0, 24)}`;
const sortedUnique = (values) =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right, "en"));
const writeJson = (filePath, value) =>
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
const writeJsonl = (filePath, records) =>
  fs.writeFileSync(
    filePath,
    records.map((record) => JSON.stringify(record)).join("\n") +
      (records.length ? "\n" : ""),
  );

const samplePacket = readJson(inputPaths.sample);
const validatedGroupings = readJson(inputPaths.groupings);
const wordNetBundles = readJson(inputPaths.bundles);
const validatedAlignments = readJson(inputPaths.alignments);
const fullRunEstimate = readJson(inputPaths.estimate);

const sourceHashes = new Set([
  samplePacket.sourceSha256,
  validatedGroupings.sourceSha256,
  wordNetBundles.sourceSha256,
  validatedAlignments.sourceSha256,
  fullRunEstimate.sourceSha256,
]);
if (sourceHashes.size !== 1) {
  throw new Error(
    "The title and WordNet artifacts do not share one source hash",
  );
}

const recordsByOccurrence = new Map(
  samplePacket.sample.map((record) => [record.occurrenceId, record]),
);
const groupingsByOccurrence = new Map(
  validatedGroupings.assessments.map((assessment) => [
    assessment.occurrenceId,
    assessment,
  ]),
);
const bundlesByGroup = new Map(
  wordNetBundles.bundles.map((bundle) => [bundle.groupId, bundle]),
);
const alignmentsByGroup = new Map(
  validatedAlignments.assessments.map((assessment) => [
    assessment.groupId,
    assessment,
  ]),
);

if (
  recordsByOccurrence.size !== 18 ||
  groupingsByOccurrence.size !== recordsByOccurrence.size ||
  bundlesByGroup.size !== 42 ||
  alignmentsByGroup.size !== bundlesByGroup.size
) {
  throw new Error(
    "Expected 18 sampled atomic activities and 42 validated homogeneous groups",
  );
}

const datasetVersion = "ontology-title-homogeneous-testbed-2026-08-28-v1";
const generatedAt = validatedAlignments.generatedAt;
const ontologyAppId =
  "final-hierarchy-with-onet-homogeneous-title-testbed-2026-08-28";
const ontologyName =
  "Final Hierarchy with O*NET - Ontology-wide title test bed 2026-08-28";

const titleToNodeId = new Map();
const snapshotNodes = [];
const snapshotEdges = [];
const snapshotEdgeKeys = new Set();

const ensureNode = (title, metadata = {}) => {
  if (!titleToNodeId.has(title)) {
    const id = stableId("node", title);
    titleToNodeId.set(title, id);
    snapshotNodes.push({ id, title, ...metadata });
  } else if (Object.keys(metadata).length) {
    const node = snapshotNodes.find(
      (candidate) => candidate.id === titleToNodeId.get(title),
    );
    Object.assign(node, metadata);
  }
  return titleToNodeId.get(title);
};

const addEdge = (parentTitle, childTitle) => {
  const parentId = ensureNode(parentTitle);
  const childId = ensureNode(childTitle);
  const key = `${parentId}\u001f${childId}`;
  if (snapshotEdgeKeys.has(key)) return;
  snapshotEdgeKeys.add(key);
  snapshotEdges.push({ parentId, childId, collectionName: "main" });
};

for (const record of samplePacket.sample) {
  for (let index = 0; index < record.path.length; index += 1) {
    const title = record.path[index];
    const metadata =
      title === record.ownerTitle && record.assignedSynsetIds.length
        ? { synsets: record.assignedSynsetIds.join(", ") }
        : {};
    ensureNode(title, metadata);
    if (index > 0) addEdge(record.path[index - 1], title);
  }
}

snapshotNodes.sort((left, right) =>
  left.title.localeCompare(right.title, "en"),
);
snapshotEdges.sort((left, right) =>
  `${left.parentId}|${left.childId}`.localeCompare(
    `${right.parentId}|${right.childId}`,
    "en",
  ),
);

const rootTitle = "Act";
const rootNodeId = titleToNodeId.get(rootTitle);
if (!rootNodeId) throw new Error("The test bed snapshot is missing Act");

const snapshot = {
  schemaVersion: "som-ontology-snapshot-v1",
  ontologyAppId,
  ontologyName,
  firestoreProjectId: "ontology-41607",
  environment: "production",
  capturedAt: generatedAt,
  branchRootNodeId: rootNodeId,
  branchRootTitle: rootTitle,
  nodes: snapshotNodes,
  edges: snapshotEdges,
};

fs.mkdirSync(path.join(outputDir, "proposals"), { recursive: true });
fs.mkdirSync(path.join(outputDir, "controls"), { recursive: true });
fs.mkdirSync(path.join(outputDir, "schema"), { recursive: true });
fs.mkdirSync(path.join(outputDir, "diagnostics"), { recursive: true });
fs.copyFileSync(
  inputPaths.estimate,
  path.join(outputDir, "diagnostics/full-run-estimate.json"),
);

const snapshotPath = path.join(outputDir, "ontology-snapshot.json");
writeJson(snapshotPath, snapshot);
const snapshotSha256 = sha256File(snapshotPath);

const sourceUri = `artifact://${samplePacket.sourceFile}`;
const sourceArtifact =
  "access://homogeneous-title-testbed-2026-08-28/validated-results";

const pipelineStage = (role, actorId, actorKind, promptVersion) => ({
  role,
  actorId,
  actorKind,
  model:
    actorKind === "model"
      ? "OpenAI Codex using the approved ACCESS allocation"
      : "deterministic local computation",
  promptVersion,
});

const titlePipeline = [
  pipelineStage(
    "detector",
    "access-homogeneous-title-grouping-v1",
    "model",
    validatedGroupings.promptVersions.grouping,
  ),
  pipelineStage(
    "critic",
    "access-homogeneous-title-grouping-auditor-v1",
    "model",
    validatedGroupings.promptVersions.audit,
  ),
  pipelineStage(
    "verifier",
    "homogeneous-title-grouping-validator-v1",
    "deterministic",
    validatedGroupings.promptVersions.validator,
  ),
  pipelineStage(
    "assembler",
    "homogeneous-title-testbed-card-assembler-v1",
    "deterministic",
    "homogeneous-title-testbed-card-assembler-2026-08-28-v1",
  ),
];

const wordNetPipeline = [
  pipelineStage(
    "detector",
    "access-wordnet-alignment-v1",
    "model",
    validatedAlignments.promptVersions.alignment,
  ),
  pipelineStage(
    "verifier",
    "local-wordnet-candidate-retrieval-v1",
    "deterministic",
    "local-wordnet-candidate-retrieval-2026-08-28-v1",
  ),
  pipelineStage(
    "critic",
    "access-wordnet-alignment-auditor-v1",
    "model",
    validatedAlignments.promptVersions.audit,
  ),
  pipelineStage(
    "verifier",
    "wordnet-alignment-validator-v1",
    "deterministic",
    validatedAlignments.promptVersions.validator,
  ),
  pipelineStage(
    "assembler",
    "wordnet-testbed-card-assembler-v1",
    "deterministic",
    "wordnet-testbed-card-assembler-2026-08-28-v1",
  ),
];

const sourceRefs = (record) => {
  const subjectNodeId = titleToNodeId.get(record.exactTitle);
  const parentNodeId = titleToNodeId.get(record.parentTitle);
  if (!subjectNodeId || !parentNodeId) {
    throw new Error(`Snapshot nodes are missing for ${record.exactTitle}`);
  }
  return {
    subjectNodeId,
    parentNodeId,
    referencedNodeIds: sortedUnique([subjectNodeId, parentNodeId]),
  };
};

const provenanceFor = (record, sourceRecord) => ({
  sourceOntology: sourceUri,
  sourceOntologySha256: snapshotSha256,
  upstreamSourceSha256: samplePacket.sourceSha256,
  sourceArtifact,
  sourceRecord,
  sourceOntologyAppId: ontologyAppId,
  sourceOntologyName: ontologyName,
  sourceSnapshotSha256: snapshotSha256,
  ...sourceRefs(record),
});

const titleProposalIdByOccurrence = new Map();
const titleCards = [];
for (const record of samplePacket.sample) {
  const assessment = groupingsByOccurrence.get(record.occurrenceId);
  if (!assessment) {
    throw new Error(`Missing grouping for ${record.occurrenceId}`);
  }
  const proposalId = stableId(
    "som",
    `${datasetVersion}|title|${record.occurrenceId}`,
  );
  titleProposalIdByOccurrence.set(record.occurrenceId, proposalId);
  const proposedTitles = assessment.groups.map((group) => group.title);
  const currentState = `${record.exactTitle} currently contains ${record.sourceRecords.length} exact O*NET ${record.sourceRecords.length === 1 ? "record" : "records"}.`;
  const proposedState =
    assessment.decision === "keep"
      ? `Keep all evidence together under ${record.exactTitle}.`
      : assessment.decision === "rename"
        ? `Replace the title with ${proposedTitles[0]}.`
        : `Represent the evidence with ${proposedTitles.length} homogeneous activity groups: ${proposedTitles.join(", ")}.`;
  titleCards.push({
    schemaVersion: "som-review-v1",
    datasetVersion,
    proposalId,
    branch: "Ontology-wide title test bed",
    issueType: "title-clarity",
    reviewMode:
      assessment.decision === "keep"
        ? "status-quo-audit"
        : assessment.decision === "defer"
          ? "manual-check"
          : "proposed-change",
    rolloutStatus: "experimental",
    workflow: {
      robTaskIds: [1],
      stage: "content",
      proposalKind: "diagnosis",
      dependsOnProposalIds: [],
    },
    subject: {
      title: record.exactTitle,
      parentTitle: record.parentTitle,
      path: record.path,
      relatedTitles: sortedUnique(
        record.sourceRecords.flatMap(
          (sourceRecord) => sourceRecord.otherLinkedAtomicTitles,
        ),
      ),
    },
    reviewerView: {
      question: "Review the proposed homogeneous title grouping.",
      currentState,
      proposedState,
      reasoning: assessment.reason,
      context: {
        type: "title-split",
        currentTitle: record.exactTitle,
        decision: assessment.decision,
        linkedTasks: record.sourceRecords.map(
          (sourceRecord) => sourceRecord.task,
        ),
        proposedNodes: assessment.groups,
        deferredTaskIndexes: assessment.deferredTaskIndexes,
        deferredTasks: assessment.deferredTasks,
      },
      agreeLabel: "Agree",
      disagreeLabel: "Disagree",
      rejectionReasonRequired: true,
      autoAdvanceOnAgree: true,
      hideModelConfidence: true,
    },
    internalModelEvidence: {
      detectorId: "access-homogeneous-title-grouping-v1",
      detectorName: "Homogeneous title-grouping agent",
      detectorPromptVersion: validatedGroupings.promptVersions.grouping,
      judgeId: "access-homogeneous-title-grouping-auditor-v1",
      judgeName: "Independent title-grouping auditor",
      judgePromptVersion: validatedGroupings.promptVersions.audit,
      detectorConfidence: assessment.confidence,
      judgeConfidence: assessment.audit.confidence,
      reviewerVisible: false,
      pipelineStages: titlePipeline,
    },
    provenance: provenanceFor(record, record.occurrenceId),
    createdAt: generatedAt,
  });
}

const synsetDetails = (ids, candidateSynsets) => {
  const byId = new Map(candidateSynsets.map((synset) => [synset.id, synset]));
  return ids.map((id) => {
    const synset = byId.get(id);
    if (!synset) throw new Error(`Selected synset ${id} is not a candidate`);
    return synset;
  });
};

const wordNetCards = [];
for (const bundle of wordNetBundles.bundles) {
  const assessment = alignmentsByGroup.get(bundle.groupId);
  const record = recordsByOccurrence.get(bundle.occurrenceId);
  const titleProposalId = titleProposalIdByOccurrence.get(bundle.occurrenceId);
  if (!assessment || !record || !titleProposalId) {
    throw new Error(`Incomplete WordNet lineage for ${bundle.groupId}`);
  }
  const selectedSynsets = synsetDetails(
    assessment.selectedSynsetIds,
    bundle.candidateSynsets,
  );
  const proposalId = stableId(
    "som",
    `${datasetVersion}|wordnet|${bundle.groupId}`,
  );
  const inheritedIds = bundle.assignedSynsets.map((synset) => synset.id);
  const selectedIds = selectedSynsets.map((synset) => synset.id);
  const proposedState =
    assessment.decision === "keep-assigned"
      ? `Keep the inherited assignment: ${inheritedIds.join(", ")}.`
      : assessment.decision === "replace"
        ? `Use ${selectedIds.join(", ")} instead of ${inheritedIds.join(", ") || "the empty inherited assignment"}.`
        : assessment.decision === "no-suitable-synset"
          ? "Record that no retrieved WordNet sense adequately fits this homogeneous activity."
          : "Leave the WordNet assignment unresolved for expert follow-up.";
  wordNetCards.push({
    schemaVersion: "som-review-v1",
    datasetVersion,
    proposalId,
    branch: "Ontology-wide title test bed",
    issueType: "synset-alignment",
    reviewMode:
      assessment.decision === "keep-assigned"
        ? "status-quo-audit"
        : assessment.decision === "uncertain"
          ? "manual-check"
          : "proposed-change",
    rolloutStatus: "experimental",
    workflow: {
      robTaskIds: [],
      stage: "content",
      proposalKind: "diagnosis",
      dependsOnProposalIds: [titleProposalId],
    },
    subject: {
      title: record.exactTitle,
      parentTitle: record.parentTitle,
      path: record.path,
      relatedTitles: [bundle.groupTitle],
    },
    reviewerView: {
      question: "Review the proposed WordNet alignment.",
      currentState: inheritedIds.length
        ? `${bundle.groupTitle} inherits ${inheritedIds.join(", ")} from ${bundle.ownerTitle}.`
        : `${bundle.groupTitle} has no inherited WordNet assignment.`,
      proposedState,
      reasoning: assessment.reason,
      context: {
        type: "synset-alignment",
        currentAtomicTitle: bundle.currentAtomicTitle,
        groupTitle: bundle.groupTitle,
        groupStatus: bundle.groupStatus,
        ownerTitle: bundle.ownerTitle,
        decision: assessment.decision,
        sourceTasks: bundle.sourceRecords.map(
          (sourceRecord) => sourceRecord.task,
        ),
        assignedSynsets: bundle.assignedSynsets,
        selectedSynsets,
        candidateSynsets: bundle.candidateSynsets,
      },
      agreeLabel: "Agree",
      disagreeLabel: "Disagree",
      rejectionReasonRequired: true,
      autoAdvanceOnAgree: true,
      hideModelConfidence: true,
    },
    internalModelEvidence: {
      detectorId: "access-wordnet-alignment-v1",
      detectorName: "WordNet alignment agent",
      detectorPromptVersion: validatedAlignments.promptVersions.alignment,
      judgeId: "access-wordnet-alignment-auditor-v1",
      judgeName: "Independent WordNet alignment auditor",
      judgePromptVersion: validatedAlignments.promptVersions.audit,
      detectorConfidence: assessment.confidence,
      judgeConfidence: assessment.audit.confidence,
      reviewerVisible: false,
      pipelineStages: wordNetPipeline,
    },
    provenance: provenanceFor(record, bundle.groupId),
    createdAt: generatedAt,
  });
}

const allCards = [...titleCards, ...wordNetCards];
const proposals = allCards.filter(
  (record) => record.reviewMode === "proposed-change",
);
const controls = allCards.filter(
  (record) => record.reviewMode === "status-quo-audit",
);
const manualChecks = allCards.filter(
  (record) => record.reviewMode === "manual-check",
);

writeJsonl(path.join(outputDir, "all_proposals.jsonl"), proposals);
writeJsonl(path.join(outputDir, "all_controls.jsonl"), controls);
writeJsonl(path.join(outputDir, "manual_checks.jsonl"), manualChecks);
for (const issueType of ["title-clarity", "synset-alignment"]) {
  writeJsonl(
    path.join(outputDir, "proposals", `${issueType}.jsonl`),
    proposals.filter((record) => record.issueType === issueType),
  );
  writeJsonl(
    path.join(outputDir, "controls", `${issueType}.jsonl`),
    controls.filter((record) => record.issueType === issueType),
  );
}
writeJsonl(
  path.join(outputDir, "diagnostics/rejected_agent_candidates.jsonl"),
  [],
);

const manifest = {
  schemaVersion: "som-review-v1",
  datasetVersion,
  branch: "Ontology-wide title test bed",
  generatedAt,
  sourceOntology: sourceUri,
  sourceOntologySha256: snapshotSha256,
  upstreamSource: {
    file: samplePacket.sourceFile,
    sha256: samplePacket.sourceSha256,
    atomicActivityOccurrences:
      samplePacket.inventoryCounts.atomicActivityOccurrences,
    uniqueExactTitles: samplePacket.inventoryCounts.uniqueTitleCount,
    singleOccurrenceTitles:
      samplePacket.inventoryCounts.singleOccurrenceTitleCount,
    sampledAtomicActivities: titleCards.length,
    resultingHomogeneousGroups: wordNetCards.length,
  },
  safety: {
    reviewOnly: true,
    mutatesOntology: false,
    approvalAuthorizesAutomaticWrite: false,
    modelConfidenceVisibleToReviewer: false,
  },
  uiContract: {
    issueHomogeneousSessions: true,
    defaultSessionSize: 10,
    maximumSessionSize: 15,
    oneAtomicItemAtATime: true,
    agreeAutoAdvancesWithoutPageReload: true,
    disagreeRequiresReason: true,
    optionalContextCollapsedByDefault: true,
    allowSaveAndExit: true,
  },
  issueTypes: [
    {
      id: "title-clarity",
      label: "Clarify titles through homogeneous evidence groups",
      stage: "content",
      robTaskIds: [1],
      rolloutStatus: "experimental",
      view: "title-split",
      proposals: proposals.filter(
        (record) => record.issueType === "title-clarity",
      ).length,
      controls: controls.filter(
        (record) => record.issueType === "title-clarity",
      ).length,
    },
    {
      id: "synset-alignment",
      label: "Align homogeneous activities with WordNet",
      stage: "content",
      robTaskIds: [],
      rolloutStatus: "experimental",
      view: "synset-alignment",
      proposals: proposals.filter(
        (record) => record.issueType === "synset-alignment",
      ).length,
      controls: controls.filter(
        (record) => record.issueType === "synset-alignment",
      ).length,
    },
  ],
  files: {
    allProposals: "all_proposals.jsonl",
    allControls: "all_controls.jsonl",
    manualChecks: "manual_checks.jsonl",
    proposalsByIssue: "proposals/<issue-type>.jsonl",
    controlsByIssue: "controls/<issue-type>.jsonl",
    rejectedAgentCandidates: "diagnostics/rejected_agent_candidates.jsonl",
    fullRunEstimate: "diagnostics/full-run-estimate.json",
    proposalSchema: "schema/review-proposal.schema.json",
    responseSchema: "schema/review-response.schema.json",
    schemaSource:
      "scripts/som-review/build-homogeneous-title-review-dataset.mjs",
    ontologySnapshot: "ontology-snapshot.json",
  },
  counts: {
    proposals: proposals.length,
    controls: controls.length,
    manualChecks: manualChecks.length,
    rejectedAgentCandidates: 0,
  },
  limitations: [
    "This deterministic 18-title sample is a test bed, not ground truth or a claim that the full ontology has been corrected.",
    "New specific titles remain provisional children until a later placement review.",
    "Title grouping preserves the leading action; wrong-main-verb and ontology-wide placement checks are deliberately deferred.",
    `The separate generic-action diagnostic found ${samplePacket.genericActionDiagnostic.occurrenceCount} Act/Perform occurrences (${samplePacket.genericActionDiagnostic.uniqueTitleCount} unique titles); none is silently rewritten here.`,
    "WordNet decisions are limited to locally retrieved senses for the exact leading action and explicitly allow no-suitable-synset or uncertain outcomes.",
    "No generated proposal, expert agreement, or test-bed action writes to the ontology automatically.",
  ],
  sourceSnapshot: {
    file: "ontology-snapshot.json",
    sha256: snapshotSha256,
    ontologyAppId,
    ontologyName,
    environment: "production",
    capturedAt: generatedAt,
    branchRootNodeId: rootNodeId,
    branchRootTitle: rootTitle,
    nodeCount: snapshot.nodes.length,
    branchNodeCount: snapshot.nodes.length,
    referenceNodeCount: 0,
    edgeCount: snapshot.edges.length,
  },
  coverage: {
    snapshotBound: true,
    exhaustiveWithinPackagedDetectorOutputs: true,
    semanticCompletenessGuaranteed: false,
    detectorAgents: [
      "access-homogeneous-title-grouping-v1",
      "access-wordnet-alignment-v1",
    ],
    criticAgents: [
      "access-homogeneous-title-grouping-auditor-v1",
      "access-wordnet-alignment-auditor-v1",
    ],
    note: "Every packaged title and WordNet card passed an independent semantic audit plus deterministic source, evidence, title, action, and candidate-set safeguards.",
  },
  fullRunEstimate: {
    modelPlan: fullRunEstimate.recommendedModelPlan,
    atomicActivityOccurrences:
      fullRunEstimate.inventory.atomicActivityOccurrences,
    homogeneousGroupPlanningRange: fullRunEstimate.projection.homogeneousGroups,
    centralModelCalls:
      fullRunEstimate.projection.fullIndependentAudit.centralScenario
        .modelCalls,
    centralVisiblePacketTokens:
      fullRunEstimate.projection.fullIndependentAudit.centralScenario
        .visiblePacketTokens,
    centralTotalAccessTokensPlanningRange:
      fullRunEstimate.projection.fullIndependentAudit.centralScenario
        .totalAccessTokensPlanningRange,
    elapsedWallTimeHours:
      fullRunEstimate.projection.fullIndependentAudit.elapsedWallTimeHours,
    directApiCharge:
      fullRunEstimate.projection.fullIndependentAudit.directApiCharge,
    note: "This is a planning estimate from exact serialized sample packets, not metered model usage. The packaged diagnostic contains assumptions and caveats.",
  },
  reviewRelease: {
    strategy: "dependency-gated-title-then-wordnet-testbed",
    currentWave: "homogeneous-title-grouping",
    releasedIssueTypes: ["title-clarity", "synset-alignment"],
    awaitingRegenerationIssueTypes: [],
    message:
      "Review each homogeneous title decision first. Its WordNet cards remain waiting until that exact title decision is accepted and become not applicable if it is rejected.",
  },
};
writeJson(path.join(outputDir, "manifest.json"), manifest);

const nonEmptyString = { type: "string", minLength: 1 };
const stringArray = { type: "array", items: nonEmptyString };
const synsetSchema = {
  type: "object",
  properties: {
    id: nonEmptyString,
    definition: nonEmptyString,
    lemmas: stringArray,
    examples: stringArray,
  },
  required: ["id", "definition", "lemmas", "examples"],
  additionalProperties: false,
};
const proposalSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    schemaVersion: { const: "som-review-v1" },
    datasetVersion: nonEmptyString,
    proposalId: nonEmptyString,
    branch: nonEmptyString,
    issueType: { enum: ["title-clarity", "synset-alignment"] },
    reviewMode: {
      enum: ["proposed-change", "status-quo-audit", "manual-check"],
    },
    rolloutStatus: { enum: ["prototype", "experimental", "control"] },
    workflow: {
      type: "object",
      properties: {
        robTaskIds: { type: "array", items: { type: "integer" } },
        stage: { const: "content" },
        proposalKind: { const: "diagnosis" },
        dependsOnProposalIds: stringArray,
      },
      required: ["robTaskIds", "stage", "proposalKind", "dependsOnProposalIds"],
      additionalProperties: false,
    },
    subject: {
      type: "object",
      properties: {
        title: nonEmptyString,
        parentTitle: nonEmptyString,
        path: { type: "array", items: nonEmptyString, minItems: 2 },
        relatedTitles: stringArray,
      },
      required: ["title", "parentTitle", "path", "relatedTitles"],
      additionalProperties: false,
    },
    reviewerView: {
      type: "object",
      properties: {
        question: nonEmptyString,
        currentState: nonEmptyString,
        proposedState: nonEmptyString,
        reasoning: nonEmptyString,
        context: {
          oneOf: [
            {
              type: "object",
              properties: {
                type: { const: "title-split" },
                currentTitle: nonEmptyString,
                decision: { enum: ["keep", "rename", "split", "defer"] },
                linkedTasks: {
                  type: "array",
                  items: nonEmptyString,
                  minItems: 1,
                },
                proposedNodes: {
                  type: "array",
                  minItems: 1,
                  items: {
                    type: "object",
                    properties: {
                      title: nonEmptyString,
                      status: { enum: ["current", "existing", "new"] },
                      sourceTaskIndexes: {
                        type: "array",
                        minItems: 1,
                        items: { type: "integer", minimum: 1 },
                      },
                      sourceTasks: {
                        type: "array",
                        minItems: 1,
                        items: nonEmptyString,
                      },
                      reason: nonEmptyString,
                    },
                    required: [
                      "title",
                      "status",
                      "sourceTaskIndexes",
                      "sourceTasks",
                      "reason",
                    ],
                    additionalProperties: false,
                  },
                },
                deferredTaskIndexes: {
                  type: "array",
                  items: { type: "integer", minimum: 1 },
                },
                deferredTasks: stringArray,
              },
              required: [
                "type",
                "currentTitle",
                "decision",
                "linkedTasks",
                "proposedNodes",
                "deferredTaskIndexes",
                "deferredTasks",
              ],
              additionalProperties: false,
            },
            {
              type: "object",
              properties: {
                type: { const: "synset-alignment" },
                currentAtomicTitle: nonEmptyString,
                groupTitle: nonEmptyString,
                groupStatus: { enum: ["current", "existing", "new"] },
                ownerTitle: nonEmptyString,
                decision: {
                  enum: [
                    "keep-assigned",
                    "replace",
                    "no-suitable-synset",
                    "uncertain",
                  ],
                },
                sourceTasks: {
                  type: "array",
                  items: nonEmptyString,
                  minItems: 1,
                },
                assignedSynsets: { type: "array", items: synsetSchema },
                selectedSynsets: { type: "array", items: synsetSchema },
                candidateSynsets: {
                  type: "array",
                  items: synsetSchema,
                  minItems: 1,
                },
              },
              required: [
                "type",
                "currentAtomicTitle",
                "groupTitle",
                "groupStatus",
                "ownerTitle",
                "decision",
                "sourceTasks",
                "assignedSynsets",
                "selectedSynsets",
                "candidateSynsets",
              ],
              additionalProperties: false,
            },
          ],
        },
        agreeLabel: nonEmptyString,
        disagreeLabel: nonEmptyString,
        rejectionReasonRequired: { type: "boolean" },
        autoAdvanceOnAgree: { type: "boolean" },
        hideModelConfidence: { const: true },
      },
      required: [
        "question",
        "currentState",
        "proposedState",
        "reasoning",
        "context",
        "agreeLabel",
        "disagreeLabel",
        "rejectionReasonRequired",
        "autoAdvanceOnAgree",
        "hideModelConfidence",
      ],
      additionalProperties: false,
    },
    internalModelEvidence: {
      type: "object",
      properties: {
        detectorId: nonEmptyString,
        detectorName: nonEmptyString,
        detectorPromptVersion: nonEmptyString,
        judgeId: nonEmptyString,
        judgeName: nonEmptyString,
        judgePromptVersion: nonEmptyString,
        detectorConfidence: { enum: ["high", "medium", "low"] },
        judgeConfidence: { enum: ["high", "medium", "low"] },
        reviewerVisible: { const: false },
        pipelineStages: {
          type: "array",
          minItems: 4,
          items: {
            type: "object",
            properties: {
              role: {
                enum: [
                  "detector",
                  "proposer",
                  "solution-proposer",
                  "critic",
                  "judge",
                  "verifier",
                  "assembler",
                  "proposal-assembler",
                ],
              },
              actorId: nonEmptyString,
              actorKind: { enum: ["model", "deterministic", "human-derived"] },
              model: nonEmptyString,
              promptVersion: nonEmptyString,
            },
            required: [
              "role",
              "actorId",
              "actorKind",
              "model",
              "promptVersion",
            ],
            additionalProperties: false,
          },
        },
      },
      required: [
        "detectorId",
        "detectorName",
        "detectorPromptVersion",
        "judgeId",
        "judgeName",
        "judgePromptVersion",
        "detectorConfidence",
        "judgeConfidence",
        "reviewerVisible",
        "pipelineStages",
      ],
      additionalProperties: false,
    },
    provenance: {
      type: "object",
      properties: {
        sourceOntology: nonEmptyString,
        sourceOntologySha256: { type: "string", pattern: "^[a-f0-9]{64}$" },
        upstreamSourceSha256: { type: "string", pattern: "^[a-f0-9]{64}$" },
        sourceArtifact: nonEmptyString,
        sourceRecord: nonEmptyString,
        sourceOntologyAppId: nonEmptyString,
        sourceOntologyName: nonEmptyString,
        sourceSnapshotSha256: { type: "string", pattern: "^[a-f0-9]{64}$" },
        subjectNodeId: nonEmptyString,
        parentNodeId: nonEmptyString,
        referencedNodeIds: {
          type: "array",
          minItems: 2,
          items: nonEmptyString,
        },
      },
      required: [
        "sourceOntology",
        "sourceOntologySha256",
        "upstreamSourceSha256",
        "sourceArtifact",
        "sourceRecord",
        "sourceOntologyAppId",
        "sourceOntologyName",
        "sourceSnapshotSha256",
        "subjectNodeId",
        "parentNodeId",
        "referencedNodeIds",
      ],
      additionalProperties: false,
    },
    createdAt: { type: "string", format: "date-time" },
  },
  required: [
    "schemaVersion",
    "datasetVersion",
    "proposalId",
    "branch",
    "issueType",
    "reviewMode",
    "rolloutStatus",
    "workflow",
    "subject",
    "reviewerView",
    "internalModelEvidence",
    "provenance",
    "createdAt",
  ],
  additionalProperties: false,
};
writeJson(
  path.join(outputDir, "schema/review-proposal.schema.json"),
  proposalSchema,
);

const responseSchemaSource = path.join(
  repoRoot,
  "Buy_Society_of_Mind_Title_Followup_2026-07-25/review-datasets-title-followup-v1/schema/review-response.schema.json",
);
fs.copyFileSync(
  responseSchemaSource,
  path.join(outputDir, "schema/review-response.schema.json"),
);

const qualityReport = {
  schemaVersion: "homogeneous-title-testbed-quality-report-v1",
  generatedAt,
  sourceHierarchySha256: samplePacket.sourceSha256,
  packagedSnapshotSha256: snapshotSha256,
  counts: {
    sampledAtomicActivities: titleCards.length,
    titleKeep: validatedGroupings.counts.keep,
    titleRename: validatedGroupings.counts.rename,
    titleSplit: validatedGroupings.counts.split,
    homogeneousGroups: wordNetCards.length,
    wordNetKeepAssigned: validatedAlignments.counts.keepAssigned,
    wordNetReplace: validatedAlignments.counts.replace,
    wordNetNoSuitable: validatedAlignments.counts.noSuitableSynset,
    wordNetUncertain: validatedAlignments.counts.uncertain,
    reviewCards: allCards.length,
    projectedFullRunHomogeneousGroups:
      fullRunEstimate.projection.homogeneousGroups,
    projectedFullRunCentralModelCalls:
      fullRunEstimate.projection.fullIndependentAudit.centralScenario
        .modelCalls,
    projectedFullRunCentralAccessTokens:
      fullRunEstimate.projection.fullIndependentAudit.centralScenario
        .totalAccessTokensPlanningRange,
  },
  safeguards: {
    everySourceRecordAccountedFor: true,
    duplicateSourceRecordsPreserved: true,
    leadingActionPreserved: true,
    existingExactLinksAudited: true,
    duplicateResultingTitlesRejected: true,
    newNodesMarkedProvisional: true,
    selectedSynsetsBoundToLocalCandidates: true,
    noSuitableAndUncertainPathsSupported: true,
    titleDependenciesEnforced: true,
    ontologyMutationDisabled: true,
  },
};
writeJson(
  path.join(outputDir, "diagnostics/quality-report.json"),
  qualityReport,
);

const readme = `# Ontology-wide homogeneous title test bed\n\nThis review-only dataset packages the deterministic 18-title sample discussed by Iman and Rob. It contains 18 homogeneous title decisions and 42 dependent WordNet alignment decisions.\n\n## Review order\n\n1. Review **Clarify titles through homogeneous evidence groups**.\n2. Accepting one title decision releases only its corresponding WordNet card or cards. Rejecting it makes those dependent cards not applicable.\n3. No decision writes to the ontology. New split titles remain provisional until a later placement review.\n\n## Full-run planning estimate\n\nThe source contains ${fullRunEstimate.inventory.atomicActivityOccurrences.toLocaleString("en-US")} atomic occurrences and ${fullRunEstimate.inventory.oNetRecords.toLocaleString("en-US")} O*NET records. The central projection produces about ${fullRunEstimate.projection.homogeneousGroups.central.toLocaleString("en-US")} homogeneous groups and ${fullRunEstimate.projection.fullIndependentAudit.centralScenario.modelCalls.toLocaleString("en-US")} model calls. Its central planning estimate is ${Math.round(fullRunEstimate.projection.fullIndependentAudit.centralScenario.totalAccessTokensPlanningRange.central / 1_000_000)} million ACCESS tokens and ${fullRunEstimate.projection.fullIndependentAudit.elapsedWallTimeHours.central} hours at the stated concurrency assumptions. These are planning values, not metered usage; see \`diagnostics/full-run-estimate.json\` for the range and caveats.\n\n## Reproduce\n\nRun the local grouping and WordNet validators, regenerate \`full-run-estimate.json\`, then run \`node scripts/som-review/build-homogeneous-title-review-dataset.mjs\`. The source hierarchy hash is \`${samplePacket.sourceSha256}\`.\n`;
fs.writeFileSync(path.join(outputDir, "README.md"), readme);

console.log(
  JSON.stringify(
    {
      outputDir,
      datasetVersion,
      snapshotSha256,
      titleCards: titleCards.length,
      wordNetCards: wordNetCards.length,
      proposals: proposals.length,
      controls: controls.length,
      manualChecks: manualChecks.length,
    },
    null,
    2,
  ),
);
