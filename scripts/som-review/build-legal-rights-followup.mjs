#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const HANDOFF_ROOT = path.join(
  REPO_ROOT,
  "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
);
const SOURCE_SCHEMA_DIR = path.join(
  HANDOFF_ROOT,
  "review-datasets-rob-semantic-followup-2026-08-04",
  "schema",
);
const DEFAULT_ARTIFACT_DIR = path.join(
  REPO_ROOT,
  "artifacts",
  "rob-final-cleanup-2026-08-05",
);
const DEFAULT_OUTPUT_DIR = path.join(
  HANDOFF_ROOT,
  "review-datasets-rob-legal-rights-followup-2026-08-05",
);
const DATASET_VERSION = "sell-rob-legal-rights-followup-2026-08-05-v1";
const SOURCE_APP_ID =
  "final-hierarchy-with-o*net-rob-cleanup-applied-2026-08-05-v2";
const SOURCE_ONTOLOGY_NAME =
  "Final Hierarchy with O*Net - Rob Cleanup Applied 2026-08-05 v2";

function parseArgs(argv = process.argv) {
  const values = {};
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const [name, inlineValue] = arg.slice(2).split("=", 2);
    values[name] = inlineValue ?? process.argv[++index];
  }
  return values;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeJsonl(file, records) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    records.length
      ? `${records.map((record) => JSON.stringify(record)).join("\n")}\n`
      : "",
    "utf8",
  );
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sha256File(file) {
  return sha256(fs.readFileSync(file));
}

function proposalId(key) {
  return `som-${sha256(`${DATASET_VERSION}\u001f${key}`).slice(0, 20)}`;
}

function directChildren(snapshot, parentId) {
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  return snapshot.edges
    .filter((edge) => edge.parentId === parentId)
    .map((edge) => ({
      id: edge.childId,
      title: nodesById.get(edge.childId)?.title || "",
      collectionName: edge.collectionName,
    }))
    .filter((child) => child.title)
    .sort((left, right) =>
      `${left.collectionName}\u001f${left.title}`.localeCompare(
        `${right.collectionName}\u001f${right.title}`,
        "en",
      ),
    );
}

function main() {
  const args = parseArgs();
  const artifactDir = path.resolve(
    args["artifact-dir"] || DEFAULT_ARTIFACT_DIR,
  );
  const outputDir = path.resolve(args.out || DEFAULT_OUTPUT_DIR);
  const snapshotFile = path.join(artifactDir, "target-ontology-snapshot.json");
  const applicationAuditFile = path.join(
    artifactDir,
    "cleanup-application-audit.json",
  );
  const planFile = path.join(artifactDir, "cleanup-application-plan.json");
  const collectionReviewFile = path.join(
    artifactDir,
    "rob-collection-design.json",
  );
  const snapshot = readJson(snapshotFile);
  const audit = readJson(applicationAuditFile);
  const plan = readJson(planFile);
  const collectionReview = readJson(collectionReviewFile);

  if (
    snapshot.ontologyAppId !== SOURCE_APP_ID ||
    snapshot.ontologyName !== SOURCE_ONTOLOGY_NAME ||
    audit.mode !== "apply" ||
    !Object.values(audit.verification || {}).every(Boolean) ||
    audit.changeScope?.changedDocumentCount !== 2 ||
    audit.changeScope?.exactReviewedScope !== true
  ) {
    throw new Error(
      "The cleaned ontology has not passed application verification",
    );
  }
  if (
    snapshot.nodes.some((node) => node.title === "Sell (Other)") ||
    plan.unsupportedLegacyAddNodes.disposition !==
      "exclude-until-onet-grounded" ||
    audit.unsupportedLegacyAddNodes.sourceTaskCount !== 0
  ) {
    throw new Error("Cleanup or legacy-addition evidence guard failed");
  }
  const priorJudgment = collectionReview.judgments?.[0];
  if (
    collectionReview.counts?.missing !== 0 ||
    priorJudgment?.proposalId !== plan.rejectedCollection.proposalId ||
    priorJudgment?.decision !== "disagree" ||
    priorJudgment?.suggestedCorrection !==
      plan.rejectedCollection.expertSuggestedCorrection
  ) {
    throw new Error(
      "Rob's collection correction changed after the cleanup plan",
    );
  }

  const sellRoot = snapshot.nodes.find(
    (node) => node.id === snapshot.sellRootNodeId && node.title === "Sell",
  );
  if (!sellRoot) throw new Error("Cleaned snapshot has no unique Sell root");
  const children = directChildren(snapshot, sellRoot.id);
  const currentTitles = children.map((child) => child.title);
  const expectedTitles = [
    "Rent out",
    "Sell Products",
    "Sell information",
    "Sell physical objects",
    "Sell service",
  ];
  if (
    JSON.stringify([...currentTitles].sort()) !==
    JSON.stringify([...expectedTitles].sort())
  ) {
    throw new Error(
      `Unexpected direct Sell children: ${currentTitles.join(", ")}`,
    );
  }
  for (const forbidden of ["Sell ownership", "Sell temporary use"]) {
    if (snapshot.nodes.some((node) => node.title === forbidden)) {
      throw new Error(`Human-proposed node already exists: ${forbidden}`);
    }
  }

  const generatedAt = snapshot.capturedAt;
  const snapshotSha256 = sha256File(snapshotFile);
  const record = {
    schemaVersion: "som-review-v1",
    datasetVersion: DATASET_VERSION,
    proposalId: proposalId("expert-correction:legal-rights-conveyed-in-sale"),
    branch: "Sell",
    issueType: "collection-design",
    rolloutStatus: "experimental",
    workflow: {
      robTaskIds: [],
      stage: "final-action",
      proposalKind: "design",
      dependsOnProposalIds: [],
    },
    internalModelEvidence: {
      detectorId: "expert-correction-projection",
      detectorName: "expert-correction-projection",
      detectorPromptVersion: "rob-legal-rights-followup-v1",
      judgeId: "",
      judgeName: "",
      judgePromptVersion: "",
      detectorConfidence: "not-scored",
      judgeConfidence: "not-scored",
      reviewerVisible: false,
    },
    createdAt: generatedAt,
    provenance: {
      sourceOntology: `firestore://ontology-41607/${SOURCE_APP_ID}`,
      sourceOntologySha256: snapshotSha256,
      sourceArtifact:
        "artifacts/rob-final-cleanup-2026-08-05/cleanup-application-audit.json",
      sourceRecord: `expert-correction:${plan.rejectedCollection.proposalId}`,
      sourceOntologyAppId: SOURCE_APP_ID,
      sourceOntologyName: SOURCE_ONTOLOGY_NAME,
      sourceSnapshotSha256: snapshotSha256,
      subjectNodeId: "",
      parentNodeId: sellRoot.id,
      referencedNodeIds: [
        sellRoot.id,
        ...children.map((child) => child.id),
      ].sort(),
    },
    reviewMode: "proposed-change",
    subject: {
      title: "Legal rights conveyed in sale",
      parentTitle: "Sell",
      path: ["Sell"],
      relatedTitles: currentTitles,
    },
    reviewerView: {
      question:
        "Do you agree with this exact implementation of your proposed legal-rights collection?",
      currentState: `Sell currently has five direct activity branches: ${currentTitles.join(", ")}. They are split between the main and Sell what? collections.`,
      proposedState:
        'Create a collection named "Legal rights conveyed in sale" with two new activity branches: "Sell ownership" and "Sell temporary use". Move Sell Products, Sell information, Sell physical objects, and Sell service under Sell ownership; move Rent out under Sell temporary use.',
      reasoning:
        "This is a precise projection of Rob's human-authored correction, including the resulting hierarchy. It is not an LLM-generated collection and it will not be written automatically from this review response.",
      context: {
        type: "collection-design",
        parentTitle: "Sell",
        currentChildren: currentTitles,
        proposedCollectionName: "Legal rights conveyed in sale",
        proposedBranches: [
          {
            title: "Sell ownership",
            status: "new",
            children: [
              "Sell Products",
              "Sell information",
              "Sell physical objects",
              "Sell service",
            ],
          },
          {
            title: "Sell temporary use",
            status: "new",
            children: ["Rent out"],
          },
        ],
        sourceTasks: [],
      },
      agreeLabel: "Agree",
      disagreeLabel: "Disagree",
      rejectionReasonRequired: true,
      autoAdvanceOnAgree: true,
      hideModelConfidence: true,
    },
  };

  const manifest = {
    schemaVersion: "som-review-v1",
    datasetVersion: DATASET_VERSION,
    branch: "Sell",
    generatedAt,
    sourceOntology: `firestore://ontology-41607/${SOURCE_APP_ID}`,
    sourceOntologySha256: snapshotSha256,
    counts: { proposals: 1, controls: 0, manualChecks: 0 },
    files: {
      allProposals: "all_proposals.jsonl",
      allControls: "all_controls.jsonl",
      manualChecks: "manual_checks.jsonl",
      proposalsByIssue: "proposals/<issue-type>.jsonl",
      controlsByIssue: "controls/<issue-type>.jsonl",
      proposalSchema: "schema/review-proposal.schema.json",
      responseSchema: "schema/review-response.schema.json",
      ontologySnapshot: "ontology-snapshot.json",
      regenerationAudit: "diagnostics/regeneration-audit.json",
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
        id: "collection-design",
        label: "Confirm the legal-rights structure",
        taskIds: [],
        stage: "final-action",
        contextType: "collection-design",
        proposals: 1,
        controls: 0,
        manualChecks: 0,
      },
    ],
    reviewRelease: {
      strategy: "expert-correction-followup",
      currentWave: "legal-rights-exact-implementation",
      releasedIssueTypes: ["collection-design"],
      awaitingRegenerationIssueTypes: [],
      message:
        "The accepted empty-node cleanup is applied. Confirm the exact hierarchy implied by the expert's replacement collection before any further ontology write.",
    },
    safety: {
      reviewOnly: true,
      mutatesOntology: false,
      approvalAuthorizesAutomaticWrite: false,
      modelConfidenceVisibleToReviewer: false,
    },
    sourceSnapshot: {
      file: "ontology-snapshot.json",
      sha256: snapshotSha256,
      capturedAt: snapshot.capturedAt,
      ontologyAppId: snapshot.ontologyAppId,
      ontologyName: snapshot.ontologyName,
      environment: snapshot.environment,
      branchRootTitle: "Sell",
      branchRootNodeId: sellRoot.id,
      sellRootNodeId: sellRoot.id,
      nodeCount: snapshot.nodes.length,
      edgeCount: snapshot.edges.length,
      collectionCount: snapshot.collections.length,
    },
    propagationCheckpoint: {
      priorDatasetVersion: plan.sourceDataset.version,
      applicationAuditFile:
        "artifacts/rob-final-cleanup-2026-08-05/cleanup-application-audit.json",
      applicationAuditSha256: sha256File(applicationAuditFile),
      sourceUnchanged: audit.verification.sourceUnchanged,
      targetDigestVerified: audit.verification.targetDigestMatches,
      changedDocumentCount: audit.changeScope.changedDocumentCount,
      exactReviewedScope: audit.changeScope.exactReviewedScope,
      acceptedEmptyNodeRemovalApplied: true,
      rejectedCollectionApplied: false,
    },
    excludedLegacyAddNodes: {
      sourceDatasetVersion: "sell-final-hierarchy-onet-2026-07-15-v4",
      proposalCount: audit.unsupportedLegacyAddNodes.proposalCount,
      sourceTaskCount: audit.unsupportedLegacyAddNodes.sourceTaskCount,
      detectorNames: audit.unsupportedLegacyAddNodes.detectorNames,
      disposition: audit.unsupportedLegacyAddNodes.disposition,
    },
    limitations: [
      "This round contains one exact projection of a human expert's correction.",
      "The proposed collection includes new activity nodes and hierarchy changes, so it requires a separate reviewed application after agreement.",
      "The ten historical Add nodes proposals are excluded because they came from the GapScanner and cite no O*NET source tasks.",
      "No LLM call generated this follow-up proposal.",
    ],
    contentRevision: 1,
  };

  const generationAudit = {
    schemaVersion: "som-legal-rights-followup-generation-audit-v1",
    generatedAt,
    datasetVersion: DATASET_VERSION,
    sourceOntologyAppId: SOURCE_APP_ID,
    sourceSnapshotSha256: snapshotSha256,
    cleanupApplicationAuditSha256: sha256File(applicationAuditFile),
    cleanupApplicationPlanSha256: sha256File(planFile),
    priorCollectionReviewSha256: sha256File(collectionReviewFile),
    acceptedEmptyNodeRemovalApplied: true,
    rejectedCollectionApplied: false,
    expertCorrectionProjected: true,
    llmCalls: 0,
    legacyAddNodes: manifest.excludedLegacyAddNodes,
    proposalIds: [record.proposalId],
    ontologyMutatedByGeneration: false,
  };

  fs.mkdirSync(outputDir, { recursive: true });
  fs.cpSync(SOURCE_SCHEMA_DIR, path.join(outputDir, "schema"), {
    recursive: true,
  });
  fs.copyFileSync(snapshotFile, path.join(outputDir, "ontology-snapshot.json"));
  writeJsonl(path.join(outputDir, "all_proposals.jsonl"), [record]);
  writeJsonl(path.join(outputDir, "all_controls.jsonl"), []);
  writeJsonl(path.join(outputDir, "manual_checks.jsonl"), []);
  writeJsonl(path.join(outputDir, "proposals", "collection-design.jsonl"), [
    record,
  ]);
  writeJsonl(path.join(outputDir, "controls", "collection-design.jsonl"), []);
  writeJson(path.join(outputDir, "manifest.json"), manifest);
  writeJson(
    path.join(outputDir, "diagnostics", "regeneration-audit.json"),
    generationAudit,
  );
  fs.writeFileSync(
    path.join(outputDir, "README.md"),
    `# Sell legal-rights follow-up\n\n` +
      `- Dataset: ${DATASET_VERSION}\n` +
      `- Source: ${SOURCE_ONTOLOGY_NAME}\n` +
      `- Review: https://ontology.mit.edu/review?dataset=sell-semantic-coverage\n` +
      `- Remaining item: one exact, human-authored collection and hierarchy proposal.\n` +
      `- Excluded: 10 legacy Add nodes proposals with zero O*NET source tasks.\n` +
      `- Safety: review responses do not mutate the ontology.\n`,
    "utf8",
  );

  process.stdout.write(
    `PASS: built ${DATASET_VERSION} with 1 expert-correction proposal; ` +
      `${audit.unsupportedLegacyAddNodes.proposalCount} unsupported additions excluded.\n` +
      `${outputDir}\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_FILE) {
  try {
    main();
  } catch (error) {
    console.error(
      error instanceof Error ? error.stack || error.message : error,
    );
    process.exitCode = 1;
  }
}
