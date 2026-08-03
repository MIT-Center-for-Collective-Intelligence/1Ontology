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
const repairAuditSourceFile = path.join(
  repoRoot,
  "artifacts",
  "rob-structure-review-2026-07-25",
  "collection-design-node-repair-2026-08-02.json",
);
const repairAuditFile = path.join(
  datasetDir,
  "diagnostics",
  "collection_design_node_repair.json",
);
const ids = {
  sell: "9c347b3345120c1df2554b834c13",
  ownership: "2dfe6a4a3194a23d73d3681eb844",
  temporaryUse: "bc3a0d85a3dcd1e3ea729857acc3",
  rentOut: "df319ef0372ddc12e45ccbd4b4b0",
};

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
const edgeKey = (edge) =>
  `${edge.parentId}\u001f${edge.collectionName}\u001f${edge.childId}`;
const collectionKey = (collection) =>
  `${collection.parentId}\u001f${collection.collectionName}`;

const auditText = fs.readFileSync(repairAuditSourceFile, "utf8");
const audit = JSON.parse(auditText);
if (
  audit.mode !== "apply" ||
  audit.verification?.expectedStateReached !== true ||
  audit.verification?.wrappersRetired !== true ||
  audit.verification?.rentOutRestoredDirectlyUnderSell !== true
) {
  throw new Error("The production collection-node repair is not verified");
}
fs.copyFileSync(repairAuditSourceFile, repairAuditFile);

const snapshotFile = path.join(datasetDir, "ontology-snapshot.json");
const snapshot = readJson(snapshotFile);
const retiredIds = new Set([ids.ownership, ids.temporaryUse]);
snapshot.nodes = snapshot.nodes.filter((node) => !retiredIds.has(node.id));
snapshot.edges = snapshot.edges.filter(
  (edge) =>
    !retiredIds.has(edge.parentId) &&
    !retiredIds.has(edge.childId) &&
    !(edge.parentId === ids.sell && edge.childId === ids.rentOut),
);
snapshot.edges.push({
  parentId: ids.sell,
  childId: ids.rentOut,
  collectionName: "main",
});
snapshot.edges.sort((left, right) =>
  edgeKey(left).localeCompare(edgeKey(right)),
);
snapshot.collections = (snapshot.collections || [])
  .filter(
    (collection) =>
      !retiredIds.has(collection.parentId) &&
      !(
        collection.parentId === ids.sell &&
        collection.collectionName === "Sell what kind of usage?"
      ),
  )
  .sort((left, right) =>
    collectionKey(left).localeCompare(collectionKey(right)),
  );
snapshot.capturedAt = audit.generatedAt;
const snapshotText = `${JSON.stringify(snapshot, null, 2)}\n`;
const snapshotHash = sha256(snapshotText);
fs.writeFileSync(snapshotFile, snapshotText, "utf8");

const reviseSource = (record) => {
  record.provenance.sourceOntologySha256 = snapshotHash;
  record.provenance.sourceSnapshotSha256 = snapshotHash;
  if (record.reviewerView.context.type === "placement-comparison") {
    record.reviewerView.context.proposedPathTitles = (
      record.reviewerView.context.proposedPathTitles || []
    ).filter((title) => title !== "Sell temporary use");
  }
  return record;
};

const proposalsFile = path.join(datasetDir, "all_proposals.jsonl");
const proposals = readJsonl(proposalsFile).map(reviseSource);
writeJsonl(proposalsFile, proposals);
writeJsonl(
  path.join(datasetDir, "proposals", "cross-branch-recall.jsonl"),
  proposals.filter((record) => record.issueType === "cross-branch-recall"),
);
writeJsonl(
  path.join(datasetDir, "proposals", "evidence-specialization.jsonl"),
  proposals.filter((record) => record.issueType === "evidence-specialization"),
);

const manualChecksFile = path.join(datasetDir, "manual_checks.jsonl");
const manualChecks = readJsonl(manualChecksFile)
  .filter((record) => record.provenance.subjectNodeId !== ids.ownership)
  .map((record) => {
    if (record.provenance.subjectNodeId === ids.rentOut) {
      record.subject.parentTitle = "Sell";
      record.reviewerView.proposedState =
        'Remove the node from "Sell" only if it is not an intentional organizing concept.';
      record.reviewerView.context.parentTitle = "Sell";
      record.reviewerView.context.parentCollection = "main";
      record.provenance.parentNodeId = ids.sell;
      record.provenance.referencedNodeIds = [ids.rentOut, ids.sell].sort();
    }
    return reviseSource(record);
  });
writeJsonl(manualChecksFile, manualChecks);

const manifestFile = path.join(datasetDir, "manifest.json");
const manifest = readJson(manifestFile);
manifest.contentRevision = 4;
manifest.sourceOntologySha256 = snapshotHash;
manifest.counts.manualChecks = manualChecks.length;
manifest.sourceSnapshot = {
  ...manifest.sourceSnapshot,
  sha256: snapshotHash,
  capturedAt: snapshot.capturedAt,
  nodeCount: snapshot.nodes.length,
  edgeCount: snapshot.edges.length,
  collectionCount: snapshot.collections.length,
};
manifest.files.collectionDesignNodeRepair =
  "diagnostics/collection_design_node_repair.json";
manifest.acceptedStructureProvenance.origin =
  "invalid-collection-node-conflation-rolled-back";
manifest.limitations = [
  ...manifest.limitations.filter(
    (value) => !value.startsWith("Collection design is constrained"),
  ),
  "Collection design is constrained to assigning existing direct children to a named bucket; new activity branches require a separate intermediate-node review.",
];
writeJson(manifestFile, manifest);

const generationAuditFile = path.join(
  datasetDir,
  "diagnostics",
  "semantic-coverage-generation-audit.json",
);
const generationAudit = readJson(generationAuditFile);
generationAudit.contentRevision = 4;
generationAudit.originalSourceSnapshotSha256 ??=
  generationAudit.sourceSnapshotSha256;
generationAudit.sourceSnapshotSha256 = snapshotHash;
generationAudit.emptyCandidates = (
  generationAudit.emptyCandidates || []
).filter((candidate) => candidate.id !== ids.ownership);
generationAudit.manualCheckIds = manualChecks.map(
  (record) => record.proposalId,
);
generationAudit.postGenerationRepairs = [
  ...(generationAudit.postGenerationRepairs || []).filter(
    (repair) => repair.type !== "collection-node-conflation",
  ),
  {
    type: "collection-node-conflation",
    auditFile: path.relative(repoRoot, repairAuditFile),
    auditSha256: sha256(auditText),
    retiredSyntheticNodeIds: [ids.ownership, ids.temporaryUse],
    restoredParentId: ids.sell,
    restoredChildId: ids.rentOut,
    sourceSnapshotSha256: snapshotHash,
  },
];
writeJson(generationAuditFile, generationAudit);

const provenanceFile = path.join(
  datasetDir,
  "diagnostics",
  "accepted_structure_provenance.json",
);
const provenance = readJson(provenanceFile);
provenance.schemaVersion = "som-accepted-structure-provenance-v4";
provenance.origin = "invalid-collection-node-conflation-rolled-back";
if (!provenance.invalidApplication) {
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
  ontologyAppId: audit.ontologyAppId,
  retiredSyntheticNodes: audit.correction.retiredSyntheticNodes,
  restoredRelation: audit.correction.restoredRelation,
  auditFile: path.relative(repoRoot, repairAuditFile),
  auditSha256: sha256(auditText),
  verified: Object.values(audit.verification).every(Boolean),
};
provenance.conclusion =
  '"Rent out" and "Lease out" were pre-existing machine-derived activities, and Rob approved merging "Lease out" into "Rent out". A later collection-design implementation incorrectly created "Sell ownership" and "Sell temporary use" as activity nodes. That application has been rolled back: the two synthetic wrappers are retired and "Rent out" is again a direct child of "Sell". No alternative collection structure has been inferred from Rob\'s prior answer.';
writeJson(provenanceFile, provenance);

const revisionFile = path.join(
  datasetDir,
  "diagnostics",
  "one_step_review_revision.json",
);
const revision = readJson(revisionFile);
revision.contentRevision = 4;
revision.changes = [
  ...revision.changes.filter(
    (change) => !change.startsWith("Removed the invalid collection-generated"),
  ),
  "Removed the invalid collection-generated activity wrappers from the current snapshot and restored Rent out directly under Sell.",
];
revision.collectionNodeRepair = {
  auditFile: path.relative(repoRoot, repairAuditFile),
  auditSha256: sha256(auditText),
  sourceSnapshotSha256: snapshotHash,
};
writeJson(revisionFile, revision);

fs.writeFileSync(
  path.join(datasetDir, "README.md"),
  `# Sell semantic coverage review

Snapshot-bound review of whole-ontology semantic recall and explicit
O*NET-derived Sell specializations before downstream regeneration.

- Dataset: \`${manifest.datasetVersion}\`
- Content revision: \`${manifest.contentRevision}\`
- Review: https://ontology.mit.edu/review?dataset=sell-semantic-coverage
- Safety: responses are review records only. A separately reviewed application
  plan is required before any ontology mutation.
- Provenance: \`Rent out\` and \`Lease out\` already existed in the July 15
  baseline, and Rob accepted merging \`Lease out\` into \`Rent out\`. A later
  collection-design contract incorrectly allowed new activity branches, which
  the application materialized as two nodes. Those wrappers have been retired
  and \`Rent out\` is again directly under \`Sell\`. See
  \`diagnostics/accepted_structure_provenance.json\` and
  \`diagnostics/collection_design_node_repair.json\`.
- Collection invariant: collection design may assign existing direct children
  to a named bucket; a new activity or intermediate node requires a separate
  proposal and review.
- Cleanup: empty nodes and named empty collections are detected now but remain
  unreleased until upstream decisions are propagated and the branch is
  regenerated.
`,
  "utf8",
);

process.stdout.write(
  `${JSON.stringify(
    {
      datasetDir,
      sourceSnapshotSha256: snapshotHash,
      nodeCount: snapshot.nodes.length,
      edgeCount: snapshot.edges.length,
      collectionCount: snapshot.collections.length,
      proposals: proposals.length,
      manualChecks: manualChecks.length,
    },
    null,
    2,
  )}\n`,
);
