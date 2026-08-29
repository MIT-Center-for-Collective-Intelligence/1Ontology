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
  "Ontology_Title_Clarity_Testbed_2026-08-28/review-datasets-v2",
);
const inputPaths = {
  sample: path.join(artifactDir, "sample-packet.json"),
  groupings: path.join(artifactDir, "validated-groupings-v2.json"),
  estimate: path.join(artifactDir, "full-run-estimate-v2.json"),
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
  groupingsByOccurrence.size !== recordsByOccurrence.size ||
  validatedGroupings.counts.resultingGroups !== 48
) {
  throw new Error(
    "Expected 18 sampled activities and 48 validated one-record-one-group results",
  );
}

const datasetVersion = "ontology-title-homogeneous-testbed-2026-08-29-v2";
const generatedAt = validatedGroupings.generatedAt;
const ontologyAppId =
  "final-hierarchy-with-onet-homogeneous-title-testbed-2026-08-29";
const ontologyName =
  "Final Hierarchy with O*NET - Streamlined title test bed 2026-08-29";

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
    Object.assign(
      snapshotNodes.find(
        (candidate) => candidate.id === titleToNodeId.get(title),
      ),
      metadata,
    );
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
    ensureNode(
      title,
      title === record.ownerTitle && record.assignedSynsetIds.length
        ? { synsets: record.assignedSynsetIds.join(", ") }
        : {},
    );
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
const rootNodeId = titleToNodeId.get("Act");
if (!rootNodeId) throw new Error("The test bed snapshot is missing Act");
const snapshot = {
  schemaVersion: "som-ontology-snapshot-v1",
  ontologyAppId,
  ontologyName,
  firestoreProjectId: "ontology-41607",
  environment: "production",
  capturedAt: generatedAt,
  branchRootNodeId: rootNodeId,
  branchRootTitle: "Act",
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
  "access://homogeneous-title-testbed-2026-08-29/streamlined-results";

const pipelineStage = (role, actorId, actorKind, promptVersion) => ({
  role,
  actorId,
  actorKind,
  model:
    actorKind === "model"
      ? "gpt-5.6-terra with high reasoning using the approved ACCESS allocation"
      : "deterministic local computation",
  promptVersion,
});
const titlePipeline = [
  pipelineStage(
    "detector",
    "access-homogeneous-title-grouping-v2",
    "model",
    validatedGroupings.promptVersions.grouping,
  ),
  pipelineStage(
    "verifier",
    "homogeneous-title-grouping-validator-v2",
    "deterministic",
    validatedGroupings.promptVersions.validator,
  ),
  pipelineStage(
    "assembler",
    "homogeneous-title-testbed-card-assembler-v2",
    "deterministic",
    "homogeneous-title-testbed-card-assembler-2026-08-29-v2",
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
        ? `Replace the title with ${proposedTitles[0]}.`
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
      detectorId: "access-homogeneous-title-grouping-v2",
      detectorName: "Streamlined homogeneous title-grouping agent",
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

const streamlined = fullRunEstimate.projection.streamlinedConditionalPipeline;
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
    "This deterministic 18-title sample is a test bed, not ground truth or a claim that the full ontology has been corrected.",
    "Each O*NET record is assigned exactly once; clauses outside the current atomic title remain for their linked activity or a later coverage review.",
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
    detectorAgents: ["access-homogeneous-title-grouping-v2"],
    criticAgents: [],
    note: "Each packaged title card passed exact source binding and deterministic one-record-one-group, leading-action, title-status, and cardinality validation. The expert reviewer is the semantic evaluator.",
  },
  fullRunEstimate: {
    modelPlan: fullRunEstimate.recommendedModelPlan,
    atomicActivityOccurrences:
      fullRunEstimate.inventory.atomicActivityOccurrences,
    homogeneousGroupPlanningRange: fullRunEstimate.projection.homogeneousGroups,
    centralModelCalls: streamlined.centralScenario.modelCalls,
    centralVisiblePacketTokens: streamlined.centralScenario.visiblePacketTokens,
    centralTotalAccessTokensPlanningRange:
      streamlined.centralScenario.totalAccessTokensPlanningRange,
    elapsedWallTimeHours: streamlined.elapsedWallTimeHours,
    directApiCharge: streamlined.directApiCharge,
    note: "This planning estimate uses one title call per activity, one assigned-synset check per accepted group, and conditional candidate selection only when the assigned sense fails. It is not metered usage.",
  },
  reviewRelease: {
    strategy: "title-review-before-conditional-wordnet",
    currentWave: "homogeneous-title-grouping",
    releasedIssueTypes: ["title-clarity"],
    awaitingRegenerationIssueTypes: ["synset-alignment"],
    message:
      "Review title groups first. After a group is accepted, compare only its assigned synset with the accepted title and evidence; retrieve all local candidate senses only when that check fails.",
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
  schemaVersion: "homogeneous-title-testbed-quality-report-v2",
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
    projectedFullRunHomogeneousGroups:
      fullRunEstimate.projection.homogeneousGroups,
    projectedFullRunCentralModelCalls: streamlined.centralScenario.modelCalls,
    projectedFullRunCentralAccessTokens:
      streamlined.centralScenario.totalAccessTokensPlanningRange,
  },
  safeguards: {
    everySourceRecordAssignedExactlyOnce: true,
    leadingActionPreserved: true,
    duplicateResultingTitlesRejected: true,
    titleStatusDerivedFromSnapshot: true,
    newNodesMarkedProvisional: true,
    wordNetDeferredUntilTitleAcceptance: true,
    ontologyMutationDisabled: true,
  },
});

fs.writeFileSync(
  path.join(outputDir, "README.md"),
  `# Streamlined ontology-wide title test bed\n\nThis review-only dataset packages the deterministic 18-title sample discussed by Iman and Rob. It contains ${validatedGroupings.counts.keep} keep, ${validatedGroupings.counts.rename} rename, ${validatedGroupings.counts.split} split, and ${validatedGroupings.counts.defer} defer decisions, producing ${validatedGroupings.counts.resultingGroups} homogeneous groups.\n\n## Procedure\n\n1. One concise model call groups each title's O*NET records. Each record is assigned exactly once.\n2. Deterministic validation derives title status and the keep/rename/split/defer decision.\n3. Rob reviews the title proposal. No review action mutates the ontology.\n4. Only after title acceptance, compare the accepted group with its assigned synset. Retrieve all local candidates and make a second model call only when the assigned sense fails.\n\n## Full-run estimate\n\nThe central projection is ${fullRunEstimate.projection.homogeneousGroups.central.toLocaleString("en-US")} groups, ${streamlined.centralScenario.modelCalls.toLocaleString("en-US")} model calls, about ${Math.round(streamlined.centralScenario.totalAccessTokensPlanningRange.central / 1_000_000)} million ACCESS tokens, and ${streamlined.elapsedWallTimeHours.central} hours at 32-way concurrency. These are planning values, not metered usage.\n`,
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
