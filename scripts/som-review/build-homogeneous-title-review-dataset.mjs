#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  normalizeTitle,
  stableHash,
} from "./homogeneous-title-clarity-lib.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const artifactDir = path.join(
  repoRoot,
  "artifacts/homogeneous-title-testbed-2026-08-28",
);
const outputDir = path.join(
  repoRoot,
  "Ontology_Title_Clarity_Testbed_2026-08-28/review-datasets-v3",
);
const inputPaths = {
  sample: path.join(artifactDir, "sample-packet-v3.json"),
  groupings: path.join(artifactDir, "validated-groupings-v3.json"),
  estimate: path.join(artifactDir, "full-run-estimate-v3.json"),
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
const fullRunEstimate = readJson(inputPaths.estimate);
if (
  new Set([
    samplePacket.sourceSha256,
    validatedGroupings.sourceSha256,
    fullRunEstimate.sourceSha256,
  ]).size !== 1
) {
  throw new Error("The title artifacts do not share one source hash");
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
if (
  recordsByOccurrence.size !== 18 ||
  groupingsByOccurrence.size !== recordsByOccurrence.size
) {
  throw new Error("Expected 18 sampled activities and 18 validated results");
}

const datasetVersion = "ontology-title-homogeneous-testbed-2026-08-29-v3";
const generatedAt = validatedGroupings.generatedAt;
const ontologyAppId =
  "final-hierarchy-with-onet-homogeneous-title-testbed-2026-08-29";
const ontologyName =
  "Final Hierarchy with O*NET - Claim-aware title test bed 2026-08-29";

const nodeIdByPath = new Map();
const snapshotNodes = [];
const snapshotEdges = [];
const snapshotEdgeKeys = new Set();
const keyForPath = (parts) => parts.join("\u001f");
const ensureNode = (parts, metadata = {}) => {
  const key = keyForPath(parts);
  const title = parts.at(-1);
  if (!nodeIdByPath.has(key)) {
    const id = stableId("node", key);
    nodeIdByPath.set(key, id);
    snapshotNodes.push({ id, title, ...metadata });
  } else if (Object.keys(metadata).length) {
    Object.assign(
      snapshotNodes.find((candidate) => candidate.id === nodeIdByPath.get(key)),
      metadata,
    );
  }
  return nodeIdByPath.get(key);
};
const addEdge = (parentPath, childPath) => {
  const parentId = ensureNode(parentPath);
  const childId = ensureNode(childPath);
  const key = `${parentId}\u001f${childId}`;
  if (snapshotEdgeKeys.has(key)) return;
  snapshotEdgeKeys.add(key);
  snapshotEdges.push({ parentId, childId, collectionName: "main" });
};
for (const record of samplePacket.sample) {
  for (let index = 0; index < record.path.length; index += 1) {
    const nodePath = record.path.slice(0, index + 1);
    const title = nodePath.at(-1);
    ensureNode(
      nodePath,
      title === record.ownerTitle && record.assignedSynsetIds.length
        ? { synsets: record.assignedSynsetIds.join(", ") }
        : {},
    );
    if (index > 0) addEdge(nodePath.slice(0, -1), nodePath);
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
const rootNodeId = nodeIdByPath.get("Act");
if (!rootNodeId) throw new Error("The test bed snapshot is missing Act");
const normalizedTitleOccurrenceCounts = {};
for (const assessment of validatedGroupings.assessments) {
  for (const group of assessment.groups) {
    if (group.status !== "existing") continue;
    if (!Number.isInteger(group.existingOccurrenceCount)) {
      throw new Error(
        `Existing title is missing its full-inventory occurrence count: ${group.title}`,
      );
    }
    normalizedTitleOccurrenceCounts[normalizeTitle(group.title)] =
      group.existingOccurrenceCount;
  }
}
const snapshot = {
  schemaVersion: "som-ontology-snapshot-v1",
  ontologyAppId,
  ontologyName,
  firestoreProjectId: "ontology-41607",
  environment: "production",
  capturedAt: generatedAt,
  branchRootNodeId: rootNodeId,
  branchRootTitle: "Act",
  normalizedTitleOccurrenceCounts,
  nodes: snapshotNodes,
  edges: snapshotEdges,
};

for (const dir of ["proposals", "controls", "schema", "diagnostics"]) {
  fs.mkdirSync(path.join(outputDir, dir), { recursive: true });
}
fs.copyFileSync(
  inputPaths.estimate,
  path.join(outputDir, "diagnostics/full-run-estimate.json"),
);
const snapshotPath = path.join(outputDir, "ontology-snapshot.json");
writeJson(snapshotPath, snapshot);
const snapshotSha256 = sha256File(snapshotPath);
const sourceUri = `artifact://${samplePacket.sourceFile}`;
const sourceArtifact =
  "access://homogeneous-title-testbed-2026-08-29/claim-aware-results";

const pipelineStage = (role, actorId, actorKind, promptVersion) => ({
  role,
  actorId,
  actorKind,
  model:
    actorKind === "model"
      ? validatedGroupings.model ||
        "OpenAI Codex model using the approved ACCESS allocation"
      : "deterministic local computation",
  promptVersion,
});
const titlePipeline = [
  pipelineStage(
    "detector",
    "access-homogeneous-title-grouping-v3",
    "model",
    validatedGroupings.promptVersions.grouping,
  ),
  pipelineStage(
    "verifier",
    "homogeneous-title-grouping-validator-v3",
    "deterministic",
    validatedGroupings.promptVersions.validator,
  ),
  pipelineStage(
    "assembler",
    "homogeneous-title-testbed-card-assembler-v3",
    "deterministic",
    "homogeneous-title-testbed-card-assembler-2026-08-29-v3",
  ),
];

const sourceRefs = (record) => {
  const subjectNodeId = nodeIdByPath.get(keyForPath(record.path));
  const parentNodeId = nodeIdByPath.get(keyForPath(record.path.slice(0, -1)));
  if (!subjectNodeId || !parentNodeId) {
    throw new Error(`Snapshot nodes are missing for ${record.exactTitle}`);
  }
  return {
    subjectNodeId,
    parentNodeId,
    referencedNodeIds: sortedUnique([subjectNodeId, parentNodeId]),
  };
};
const provenanceFor = (record) => ({
  sourceOntology: sourceUri,
  sourceOntologySha256: snapshotSha256,
  upstreamSourceSha256: samplePacket.sourceSha256,
  sourceArtifact,
  sourceRecord: record.occurrenceId,
  sourceOntologyAppId: ontologyAppId,
  sourceOntologyName: ontologyName,
  sourceSnapshotSha256: snapshotSha256,
  ...sourceRefs(record),
});

const titleCards = samplePacket.sample.map((record) => {
  const assessment = groupingsByOccurrence.get(record.occurrenceId);
  if (!assessment) throw new Error(`Missing grouping for ${record.exactTitle}`);
  const proposedTitles = assessment.groups.map((group) => group.title);
  const proposedState =
    assessment.decision === "keep"
      ? `Keep all evidence together under ${record.exactTitle}.`
      : assessment.decision === "rename"
        ? `Use ${proposedTitles[0]} as the proposed evidence-aligned title; final placement remains pending.`
        : assessment.decision === "split"
          ? `Represent the evidence with ${proposedTitles.length} homogeneous activity groups: ${proposedTitles.join(", ")}.`
          : "Defer this complete case for expert clarification.";
  return {
    schemaVersion: "som-review-v1",
    datasetVersion,
    proposalId: stableId(
      "som",
      `${datasetVersion}|title|${record.occurrenceId}`,
    ),
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
      currentState: `${record.exactTitle} currently contains ${record.sourceRecords.length} exact O*NET ${record.sourceRecords.length === 1 ? "record" : "records"}.`,
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
      detectorId: "access-homogeneous-title-grouping-v3",
      detectorName: "Claim-aware homogeneous title-grouping agent",
      detectorPromptVersion: validatedGroupings.promptVersions.grouping,
      detectorConfidence: assessment.confidence,
      reviewerVisible: false,
      pipelineStages: titlePipeline,
    },
    provenance: provenanceFor(record),
    createdAt: generatedAt,
  };
});

const proposals = titleCards.filter(
  (record) => record.reviewMode === "proposed-change",
);
const controls = titleCards.filter(
  (record) => record.reviewMode === "status-quo-audit",
);
const manualChecks = titleCards.filter(
  (record) => record.reviewMode === "manual-check",
);
writeJsonl(path.join(outputDir, "all_proposals.jsonl"), proposals);
writeJsonl(path.join(outputDir, "all_controls.jsonl"), controls);
writeJsonl(path.join(outputDir, "manual_checks.jsonl"), manualChecks);
writeJsonl(path.join(outputDir, "proposals/title-clarity.jsonl"), proposals);
writeJsonl(path.join(outputDir, "controls/title-clarity.jsonl"), controls);
writeJsonl(
  path.join(outputDir, "diagnostics/rejected_agent_candidates.jsonl"),
  [],
);

const projectedPipeline =
  fullRunEstimate.projection.claimAwareAllCandidatePipeline;
const stratifiedScenario = projectedPipeline.stratifiedPilotScenario;
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
    resultingHomogeneousGroups: validatedGroupings.counts.resultingGroups,
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
      proposals: proposals.length,
      controls: controls.length,
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
    "This deterministic 18-title sample is a reviewer-interface pilot, not ground truth, an accuracy evaluation, or a claim that the full ontology has been corrected.",
    "Every O*NET record contributes at least one source-supported predicate-object claim. One record may support multiple groups only when the current action explicitly governs distinct direct objects not already represented by another linked title.",
    "The pilot includes repeated titles and a 21+-record case in every top-level branch, but one medium and one large case per branch cannot establish reliability.",
    "New specific titles remain provisional children until a later placement review.",
    "Title grouping preserves the leading action; WordNet sense alignment and wrong-main-verb checks are deliberately deferred.",
    `The separate generic-action diagnostic found ${samplePacket.genericActionDiagnostic.occurrenceCount} Act/Perform occurrences (${samplePacket.genericActionDiagnostic.uniqueTitleCount} unique titles); none is silently rewritten here.`,
    "No generated proposal or expert agreement writes to the ontology automatically.",
  ],
  sourceSnapshot: {
    file: "ontology-snapshot.json",
    sha256: snapshotSha256,
    ontologyAppId,
    ontologyName,
    environment: "production",
    capturedAt: generatedAt,
    branchRootNodeId: rootNodeId,
    branchRootTitle: "Act",
    nodeCount: snapshot.nodes.length,
    branchNodeCount: snapshot.nodes.length,
    referenceNodeCount: 0,
    edgeCount: snapshot.edges.length,
  },
  coverage: {
    snapshotBound: true,
    exhaustiveWithinPackagedDetectorOutputs: true,
    semanticCompletenessGuaranteed: false,
    detectorAgents: ["access-homogeneous-title-grouping-v3"],
    criticAgents: [],
    note: "Each packaged card passed exact source and claim binding, 2-5-word title, leading-action, title-status, and cardinality validation. These checks do not establish semantic correctness; the expert reviewer remains the evaluator.",
  },
  fullRunEstimate: {
    modelPlan: fullRunEstimate.recommendedModelPlan,
    atomicActivityOccurrences:
      fullRunEstimate.inventory.atomicActivityOccurrences,
    homogeneousGroupScenarios:
      fullRunEstimate.projection.homogeneousGroupScenarios,
    stratifiedPilotModelCalls: stratifiedScenario.modelCalls,
    stratifiedPilotVisiblePacketTokens: stratifiedScenario.visiblePacketTokens,
    stratifiedPilotTotalAccessTokensPlanningRange:
      stratifiedScenario.totalAccessTokensPlanningRange,
    elapsedWallTimeHours: projectedPipeline.elapsedWallTimeHours,
    directApiCharge: projectedPipeline.directApiCharge,
    note: "These are sensitivity scenarios, not a validated forecast. They use one claim-aware title call per activity and, only after title acceptance, one all-candidate WordNet call per accepted group.",
  },
  reviewRelease: {
    strategy: "title-review-before-all-candidate-wordnet",
    currentWave: "homogeneous-title-grouping",
    releasedIssueTypes: ["title-clarity"],
    awaitingRegenerationIssueTypes: ["synset-alignment"],
    message:
      "Review title groups first. After a group is accepted, retrieve every local candidate sense and compare them together with the inherited assignment, accepted title, and exact evidence in one call.",
  },
};
writeJson(path.join(outputDir, "manifest.json"), manifest);

const nonEmptyString = { type: "string", minLength: 1 };
const stringArray = { type: "array", items: nonEmptyString };
const pipelineStageSchema = {
  type: "object",
  properties: {
    role: {
      enum: ["detector", "verifier", "assembler", "proposal-assembler"],
    },
    actorId: nonEmptyString,
    actorKind: { enum: ["model", "deterministic", "human-derived"] },
    model: nonEmptyString,
    promptVersion: nonEmptyString,
  },
  required: ["role", "actorId", "actorKind", "model", "promptVersion"],
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
    issueType: { const: "title-clarity" },
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
              items: {
                type: "object",
                properties: {
                  title: nonEmptyString,
                  canonicalDirectObject: nonEmptyString,
                  status: { enum: ["current", "existing", "new"] },
                  existingOccurrenceCount: {
                    type: "integer",
                    minimum: 1,
                  },
                  sourceClaims: {
                    type: "array",
                    minItems: 1,
                    items: {
                      type: "object",
                      properties: {
                        claimId: nonEmptyString,
                        sourceTaskIndex: {
                          type: "integer",
                          minimum: 1,
                        },
                        directObject: nonEmptyString,
                        evidenceQuote: nonEmptyString,
                        sourceTask: nonEmptyString,
                      },
                      required: [
                        "claimId",
                        "sourceTaskIndex",
                        "directObject",
                        "evidenceQuote",
                        "sourceTask",
                      ],
                      additionalProperties: false,
                    },
                  },
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
                  "canonicalDirectObject",
                  "status",
                  "sourceClaims",
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
        detectorConfidence: { enum: ["high", "medium", "low"] },
        reviewerVisible: { const: false },
        pipelineStages: {
          type: "array",
          minItems: 3,
          items: pipelineStageSchema,
        },
      },
      required: [
        "detectorId",
        "detectorName",
        "detectorPromptVersion",
        "detectorConfidence",
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
fs.copyFileSync(
  path.join(
    repoRoot,
    "Buy_Society_of_Mind_Title_Followup_2026-07-25/review-datasets-title-followup-v1/schema/review-response.schema.json",
  ),
  path.join(outputDir, "schema/review-response.schema.json"),
);

writeJson(path.join(outputDir, "diagnostics/quality-report.json"), {
  schemaVersion: "homogeneous-title-testbed-quality-report-v3",
  generatedAt,
  sourceHierarchySha256: samplePacket.sourceSha256,
  packagedSnapshotSha256: snapshotSha256,
  counts: {
    sampledAtomicActivities: titleCards.length,
    titleKeep: validatedGroupings.counts.keep,
    titleRename: validatedGroupings.counts.rename,
    titleSplit: validatedGroupings.counts.split,
    titleDefer: validatedGroupings.counts.defer,
    homogeneousGroups: validatedGroupings.counts.resultingGroups,
    reviewCards: titleCards.length,
    projectedFullRunHomogeneousGroupScenarios:
      fullRunEstimate.projection.homogeneousGroupScenarios,
    projectedFullRunStratifiedModelCalls: stratifiedScenario.modelCalls,
    projectedFullRunStratifiedAccessTokens:
      stratifiedScenario.totalAccessTokensPlanningRange,
  },
  safeguards: {
    everySourceRecordRepresented: true,
    repeatedRecordRequiresDistinctDirectObjectClaim: true,
    exactEvidenceQuotesBoundToSource: true,
    evidenceQuotesIncludeRecordedAction: true,
    titleWordCountBetweenTwoAndFive: true,
    leadingActionPreserved: true,
    duplicateResultingTitlesRejected: true,
    titleStatusDerivedFromFullOntologyInventory: true,
    newNodesMarkedProvisional: true,
    allCandidateWordNetDeferredUntilTitleAcceptance: true,
    ontologyMutationDisabled: true,
  },
  evaluationStatus: {
    semanticAccuracyMeasured: false,
    independentGoldLabels: false,
    blindHoldout: false,
    repeatedRuns: false,
    note: "This is a source-bound review pilot. Keep cards are not independent controls, and deterministic safeguards do not validate semantic judgments.",
  },
});

fs.writeFileSync(
  path.join(outputDir, "README.md"),
  `# Claim-aware ontology-wide title test bed\n\nThis read-only reviewer-interface pilot contains 18 title occurrences, including repeated-title and 21+-record cases in every top-level branch. It contains ${validatedGroupings.counts.keep} keep, ${validatedGroupings.counts.rename} rename, ${validatedGroupings.counts.split} split, and ${validatedGroupings.counts.defer} defer proposals, producing ${validatedGroupings.counts.resultingGroups} homogeneous groups. These are model-generated proposals, not accuracy results or gold labels.\n\n## Procedure\n\n1. One semantic call extracts source-supported predicate-object claims and groups claims under 2-5-word titles. A record may support multiple titles only through distinct direct objects governed by the current action.\n2. Deterministic validation binds every claim to an exact quote and source record, checks title form and action preservation, and derives title status and keep/rename/split/defer.\n3. Rob reviews the title proposal. No review action mutates the ontology.\n4. Only after title acceptance, retrieve every local WordNet candidate for the exact action phrase and compare all candidates, the inherited assignment, and accepted evidence in one call.\n\n## Full-run planning scenarios\n\nThe branch-by-evidence-bucket extrapolation yields ${fullRunEstimate.projection.homogeneousGroupScenarios.stratifiedPilot.toLocaleString("en-US")} groups and ${stratifiedScenario.modelCalls.toLocaleString("en-US")} model calls. Its central ACCESS planning allowance is about ${Math.round(stratifiedScenario.totalAccessTokensPlanningRange.central / 1_000_000)} million tokens, with ${projectedPipeline.elapsedWallTimeHours.stratifiedPilot} modeled hours at 32-way concurrency. These are fragile sensitivity scenarios, not measured cost or duration.\n`,
);

console.log(
  JSON.stringify(
    {
      outputDir,
      datasetVersion,
      snapshotSha256,
      titleCards: titleCards.length,
      resultingGroups: validatedGroupings.counts.resultingGroups,
      proposals: proposals.length,
      controls: controls.length,
      manualChecks: manualChecks.length,
    },
    null,
    2,
  ),
);
