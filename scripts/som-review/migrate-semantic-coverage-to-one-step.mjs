#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const datasetDir = path.join(
  repoRoot,
  "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
  "review-datasets-rob-semantic-coverage-2026-07-29",
);
const initialSnapshotFile = path.join(
  repoRoot,
  "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
  "review-datasets",
  "ontology-snapshot.json",
);
const usageSynonymBenchmarkFile = path.join(
  repoRoot,
  "artifacts",
  "rob-content-review-wave2-2026-07-24",
  "rob-duplicate-synonym-2026-07-24.json",
);
const usageMergeBenchmarkFile = path.join(
  repoRoot,
  "artifacts",
  "rob-content-review-wave2-2026-07-24",
  "rob-node-merge-2026-07-24.json",
);
const usageMergeApplicationAuditFile = path.join(
  repoRoot,
  "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
  "review-datasets-rob-post-structure-2026-07-25",
  "diagnostics",
  "content_application_audit.json",
);
const collectionNodeRepairAuditFile = path.join(
  repoRoot,
  "artifacts",
  "rob-structure-review-2026-07-25",
  "collection-design-node-repair-2026-08-02.json",
);
const usageSynonymProposalId = "som-af5752d64f929944a380";
const usageMergeProposalId = "som-9551307c7a40c479a755";

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const readJsonl = (file) =>
  fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
const writeJson = (file, value) =>
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
const writeJsonl = (file, values) =>
  fs.writeFileSync(
    file,
    values.length
      ? `${values.map((value) => JSON.stringify(value)).join("\n")}\n`
      : "",
    "utf8",
  );
const sha256 = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");
const pathFromBranch = (titles, branchTitles) => {
  const index = titles.findIndex((title) => branchTitles.includes(title));
  return index >= 0 ? titles.slice(index) : titles;
};

const manifestFile = path.join(datasetDir, "manifest.json");
const allProposalsFile = path.join(datasetDir, "all_proposals.jsonl");
const manifest = readJson(manifestFile);
const records = readJsonl(allProposalsFile);
const diagnoses = records.filter(
  (record) => record.issueType === "cross-branch-recall",
);
const relocations = records.filter(
  (record) => record.issueType === "relocation",
);

if (diagnoses.length !== 8 || relocations.length !== 8) {
  throw new Error(
    `Expected 8 diagnoses and 8 relocations, found ${diagnoses.length} and ${relocations.length}`,
  );
}

const snapshot = readJson(path.join(datasetDir, "ontology-snapshot.json"));
const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
const parentByChild = new Map(
  snapshot.edges.map((edge) => [edge.childId, edge.parentId]),
);
const ancestorPath = (nodeId) => {
  const values = [];
  const seen = new Set();
  let current = nodesById.get(nodeId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    values.unshift(current.title);
    current = nodesById.get(parentByChild.get(current.id));
  }
  return values;
};

const movesByDiagnosisId = new Map(
  relocations.map((record) => [
    record.workflow.dependsOnProposalIds[0],
    record,
  ]),
);
const oneStepMoves = diagnoses.map((diagnosis) => {
  const relocation = movesByDiagnosisId.get(diagnosis.proposalId);
  if (!relocation) {
    throw new Error(`Missing relocation for ${diagnosis.proposalId}`);
  }
  const nodeId = diagnosis.provenance.subjectNodeId;
  const targetId = relocation.provenance.referencedNodeIds.find(
    (id) =>
      nodesById.get(id)?.title ===
      relocation.reviewerView.context.proposedParentTitle,
  );
  if (!targetId) {
    throw new Error(`Missing proposed parent for ${diagnosis.proposalId}`);
  }
  const currentPathTitles = pathFromBranch(diagnosis.subject.path, [
    "Buy",
    "Sell",
  ]);
  const proposedPathTitles = [
    ...pathFromBranch(ancestorPath(targetId), ["Sell"]),
    diagnosis.subject.title,
  ];
  const key = `semantic:${nodeId}:one-step-move`;
  const proposalId = `som-${sha256(
    `${manifest.datasetVersion}|cross-branch-recall|${key}`,
  ).slice(0, 20)}`;
  return {
    ...diagnosis,
    proposalId,
    workflow: {
      ...diagnosis.workflow,
      proposalKind: "action",
      dependsOnProposalIds: [],
    },
    subject: {
      ...diagnosis.subject,
      path: currentPathTitles,
    },
    reviewerView: {
      ...diagnosis.reviewerView,
      question: `Should "${diagnosis.subject.title}" move from "${diagnosis.subject.parentTitle}" to "${relocation.reviewerView.context.proposedParentTitle}" in the Sell sub-branch?`,
      currentState: `"${diagnosis.subject.title}" is currently under "${diagnosis.subject.parentTitle}" in the Buy sub-branch.`,
      proposedState: `Move the existing node to "${relocation.reviewerView.context.proposedParentTitle}" in the Sell sub-branch without changing its title or descendants.`,
      context: {
        ...diagnosis.reviewerView.context,
        currentPathTitles,
        proposedPathTitles,
      },
      agreeLabel: "Approve move",
      disagreeLabel: "Keep current location",
    },
    internalModelEvidence: {
      ...diagnosis.internalModelEvidence,
      detectorId: "whole-ontology-semantic-one-step-move",
    },
    provenance: {
      ...diagnosis.provenance,
      sourceRecord: key,
      referencedNodeIds: diagnosis.provenance.referencedNodeIds,
    },
  };
});

const retainedRecords = records.filter(
  (record) =>
    record.issueType !== "cross-branch-recall" &&
    record.issueType !== "relocation",
);
const revisedRecords = [...oneStepMoves, ...retainedRecords];
writeJsonl(allProposalsFile, revisedRecords);
writeJsonl(
  path.join(datasetDir, "proposals", "cross-branch-recall.jsonl"),
  oneStepMoves,
);
for (const relative of [
  path.join("proposals", "relocation.jsonl"),
  path.join("controls", "relocation.jsonl"),
]) {
  fs.rmSync(path.join(datasetDir, relative), { force: true });
}

manifest.contentRevision = 2;
manifest.counts.proposals = revisedRecords.length;
manifest.issueTypes = manifest.issueTypes.filter(
  (definition) => definition.id !== "relocation",
);
const recallDefinition = manifest.issueTypes.find(
  (definition) => definition.id === "cross-branch-recall",
);
recallDefinition.label = "1. Potentially missing nodes for this sub-branch";
manifest.reviewRelease.releasedIssueTypes =
  manifest.reviewRelease.releasedIssueTypes.filter(
    (issueType) => issueType !== "relocation",
  );
manifest.reviewRelease.message =
  "Review each potentially missing node once, with its source evidence and both hierarchy locations visible, then review O*NET specializations. Downstream cleanup will be regenerated after these decisions are propagated.";
manifest.limitations = manifest.limitations.map((value) =>
  value.startsWith("Every whole-node move")
    ? "Each whole-node move is reviewed once, with the source evidence and both complete hierarchy locations visible together."
    : value,
);
manifest.acceptedStructureProvenance.origin =
  "invalid-collection-node-conflation-rolled-back";
writeJson(manifestFile, manifest);

const schemaFile = path.join(
  datasetDir,
  "schema",
  "review-proposal.schema.json",
);
const schema = readJson(schemaFile);
const contexts =
  schema.definitions.SocietyOfMindReviewProposal.properties.reviewerView
    .properties.context.anyOf;
const placementContext = contexts.find(
  (context) => context.properties?.type?.const === "placement-comparison",
);
placementContext.properties.currentPathTitles = {
  type: "array",
  items: { type: "string", minLength: 1 },
  minItems: 2,
};
placementContext.properties.proposedPathTitles = {
  type: "array",
  items: { type: "string", minLength: 1 },
  minItems: 2,
};
writeJson(schemaFile, schema);

const generationAuditFile = path.join(
  datasetDir,
  "diagnostics",
  "semantic-coverage-generation-audit.json",
);
const generationAudit = readJson(generationAuditFile);
generationAudit.contentRevision = 2;
generationAudit.proposalIds = revisedRecords.map((record) => record.proposalId);
generationAudit.releasedIssueTypes = generationAudit.releasedIssueTypes.filter(
  (issueType) => issueType !== "relocation",
);
generationAudit.postGenerationRevision = {
  script: path.relative(repoRoot, fileURLToPath(import.meta.url)),
  reason:
    "Replace diagnosis-plus-relocation pairs with one review item showing evidence and both exact hierarchy locations.",
  priorDiagnosisProposalIds: diagnoses.map((record) => record.proposalId),
  priorRelocationProposalIds: relocations.map((record) => record.proposalId),
  replacementProposalIds: oneStepMoves.map((record) => record.proposalId),
};
writeJson(generationAuditFile, generationAudit);

const initialSnapshotText = fs.readFileSync(initialSnapshotFile, "utf8");
const initialSnapshot = JSON.parse(initialSnapshotText);
const initialNodesById = new Map(
  initialSnapshot.nodes.map((node) => [node.id, node]),
);
const initialParentByChild = new Map(
  initialSnapshot.edges.map((edge) => [edge.childId, edge.parentId]),
);
const firestoreHistory = [
  {
    title: "Lease out",
    activeNodeId: "C1jYc2PTyZIjQd2Iyt7V",
    activeDocumentCreatedAt: "2026-04-01T15:36:26.513Z",
    predecessorNodeId: "Mhu9BmPinYS1QzWJUe4e",
    predecessorDocumentCreatedAt: "2026-02-10T10:29:45.175Z",
    predecessorContributors: ["gemini"],
    predecessorFoundInPreviousId: "4lyDxFffGRPCb6QWHwie",
  },
  {
    title: "Rent out",
    activeNodeId: "jsXlKplPQ3BxIrHzSwLL",
    activeDocumentCreatedAt: "2026-04-01T15:36:26.513Z",
    predecessorNodeId: "UteAyqKbbaIS2rdJxVmc",
    predecessorDocumentCreatedAt: "2026-02-10T10:27:41.180Z",
    predecessorContributors: ["gemini"],
    predecessorFoundInPreviousId: "WCDKQUPUBl5QgjZMY1B5",
  },
];
const baselineNodes = firestoreHistory.map((history) => ({
  ...history,
  parentTitleAtCapture: initialNodesById.get(
    initialParentByChild.get(history.activeNodeId),
  )?.title,
}));
if (baselineNodes.some((node) => node.parentTitleAtCapture !== "Sell")) {
  throw new Error(
    "The July 15 baseline no longer verifies the usage-node origin",
  );
}
const synonymBenchmarkText = fs.readFileSync(usageSynonymBenchmarkFile, "utf8");
const mergeBenchmarkText = fs.readFileSync(usageMergeBenchmarkFile, "utf8");
const mergeApplicationText = fs.readFileSync(
  usageMergeApplicationAuditFile,
  "utf8",
);
const synonymBenchmark = JSON.parse(synonymBenchmarkText);
const mergeBenchmark = JSON.parse(mergeBenchmarkText);
const mergeApplicationAudit = JSON.parse(mergeApplicationText);
const synonymJudgment = synonymBenchmark.judgments.find(
  (item) => item.proposalId === usageSynonymProposalId,
);
const mergeJudgment = mergeBenchmark.judgments.find(
  (item) => item.proposalId === usageMergeProposalId,
);
const appliedUsageMerge = mergeApplicationAudit.merges.find(
  (item) => item.actionProposalId === usageMergeProposalId,
);
if (
  synonymJudgment?.decision !== "agree" ||
  mergeJudgment?.decision !== "agree" ||
  appliedUsageMerge?.canonicalTitle !== "Rent out" ||
  appliedUsageMerge?.absorbedTitle !== "Lease out"
) {
  throw new Error("The Rent out / Lease out merge sequence is not verified");
}

const provenanceFile = path.join(
  datasetDir,
  "diagnostics",
  "accepted_structure_provenance.json",
);
const provenance = readJson(provenanceFile);
const correctionText = fs.readFileSync(collectionNodeRepairAuditFile, "utf8");
const correctionAudit = JSON.parse(correctionText);
if (
  correctionAudit.mode !== "apply" ||
  !Object.values(correctionAudit.verification || {}).every(Boolean)
) {
  throw new Error("The collection-node correction is not verified");
}
provenance.schemaVersion = "som-accepted-structure-provenance-v4";
provenance.origin = "invalid-collection-node-conflation-rolled-back";
provenance.baseline = {
  capturedAt: initialSnapshot.capturedAt,
  ontologyAppId: initialSnapshot.ontologyAppId,
  sourceFile: path.relative(repoRoot, initialSnapshotFile),
  sourceSha256: sha256(initialSnapshotText),
  nodes: baselineNodes,
  finding:
    "Lease out and Rent out were already direct children of Sell before the collection-design proposal was generated.",
  firestoreMetadataObservedAt: "2026-08-02T22:25:00.000Z",
};
provenance.contentPrerequisite = {
  occurredBeforeCollectionDesign: true,
  finding:
    'Rob accepted the synonym diagnosis and exact merge that absorbed "Lease out" into "Rent out". The subsequent collection-design proposal therefore operated on the surviving "Rent out" node.',
  review: {
    reviewerLabel:
      mergeBenchmark.reviewer?.label || synonymBenchmark.reviewer?.label || "",
    diagnosisProposalId: usageSynonymProposalId,
    diagnosisDecision: synonymJudgment.decision,
    actionProposalId: usageMergeProposalId,
    actionDecision: mergeJudgment.decision,
    diagnosisSourceFile: path.relative(repoRoot, usageSynonymBenchmarkFile),
    diagnosisSourceSha256: sha256(synonymBenchmarkText),
    actionSourceFile: path.relative(repoRoot, usageMergeBenchmarkFile),
    actionSourceSha256: sha256(mergeBenchmarkText),
  },
  application: {
    sourceOntology: mergeApplicationAudit.sourceOntology,
    targetOntology: mergeApplicationAudit.targetOntology,
    canonicalTitle: appliedUsageMerge.canonicalTitle,
    absorbedTitle: appliedUsageMerge.absorbedTitle,
    movedDirectChildCount: appliedUsageMerge.movedDirectChildCount,
    sourceFile: path.relative(repoRoot, usageMergeApplicationAuditFile),
    sourceSha256: sha256(mergeApplicationText),
    targetDigestVerified:
      mergeApplicationAudit.verification?.targetDigestMatches === true,
    sourceUnchanged:
      mergeApplicationAudit.verification?.sourceUnchanged === true,
  },
};
if (!provenance.invalidApplication && provenance.application) {
  provenance.invalidApplication = provenance.application;
}
delete provenance.application;
provenance.correction = {
  finding:
    "The collection-design contract incorrectly allowed new activity branches, and the application path materialized them as ontology nodes.",
  policy:
    "Collection-design agents may create or reuse a collection label and assign existing direct children to it, but may not create ontology nodes or alter parent-child relations.",
  treatmentOfPriorDecision:
    "Rob's agreement remains preserved as review evidence, but it is not reinterpreted as approval for a different collection-only transformation.",
  ontologyAppId: correctionAudit.ontologyAppId,
  retiredSyntheticNodes:
    correctionAudit.correction?.retiredSyntheticNodes || [],
  restoredRelation: correctionAudit.correction?.restoredRelation,
  auditFile: path.relative(repoRoot, collectionNodeRepairAuditFile),
  auditSha256: sha256(correctionText),
  verified: true,
};
provenance.conclusion =
  '"Rent out" and "Lease out" were pre-existing machine-derived activities, and Rob approved merging "Lease out" into "Rent out". A later collection-design implementation incorrectly created "Sell ownership" and "Sell temporary use" as activity nodes. That application has been rolled back: the two synthetic wrappers are retired and "Rent out" is again a direct child of "Sell". No alternative collection structure has been inferred from Rob\'s prior answer.';
writeJson(provenanceFile, provenance);
fs.copyFileSync(
  collectionNodeRepairAuditFile,
  path.join(datasetDir, "diagnostics", "collection_design_node_repair.json"),
);

writeJson(
  path.join(datasetDir, "diagnostics", "one_step_review_revision.json"),
  {
    schemaVersion: "som-review-revision-v1",
    contentRevision: 2,
    sourceDatasetVersion: manifest.datasetVersion,
    reason:
      "Rob requested one review decision with the proposed alternative visible immediately and enough ancestor context to interpret the current placement.",
    changes: [
      "Replaced 8 diagnosis-plus-relocation pairs with 8 one-step move proposals.",
      "Added current and proposed hierarchy paths to every move proposal.",
      "Preserved prior responses under their original proposal IDs rather than reinterpret them as approvals of a newly expanded question.",
      "Recorded that the invalid collection-generated activity wrappers were rolled back without reinterpreting the prior review answer.",
    ],
    retiredProposalIds: [
      ...diagnoses.map((record) => record.proposalId),
      ...relocations.map((record) => record.proposalId),
    ],
    replacementProposalIds: oneStepMoves.map((record) => record.proposalId),
  },
);
