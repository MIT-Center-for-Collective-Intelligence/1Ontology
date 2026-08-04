#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const DATASET_VERSION = "sell-rob-semantic-followup-2026-08-04-v1";
const DEFAULT_SNAPSHOT = path.join(
  REPO_ROOT,
  "artifacts",
  "rob-semantic-coverage-2026-08-04",
  "target-ontology-snapshot.json",
);
const DEFAULT_OUTPUT = path.join(
  REPO_ROOT,
  "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
  "review-datasets-rob-semantic-followup-2026-08-04",
);
const SOURCE_AUDIT =
  "artifacts/rob-semantic-coverage-2026-08-04/semantic-application-audit.json";

function parseArgs(argv = process.argv) {
  const values = {};
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const [name, inlineValue] = arg.slice(2).split("=", 2);
    if (inlineValue !== undefined) values[name] = inlineValue;
    else if (argv[index + 1] && !argv[index + 1].startsWith("--")) {
      values[name] = argv[++index];
    } else values[name] = true;
  }
  return values;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sha256File(file) {
  return sha256(fs.readFileSync(file));
}

function proposalId(issueType, key) {
  return `som-${sha256(`${DATASET_VERSION}|${issueType}|${key}`).slice(0, 20)}`;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeJsonl(file, values) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    values.length
      ? `${values.map((value) => JSON.stringify(value)).join("\n")}\n`
      : "",
    "utf8",
  );
}

function isOnetEvidence(node) {
  return Boolean(
    node &&
    (node.oNet === true ||
      node.oNetTask ||
      /^\(O\*Net\)\s+[^-]+\s*-\s*/i.test(String(node.title || ""))),
  );
}

function normalizedCollection(value = "") {
  const name = String(value).trim().replace(/^\[/, "").replace(/\]$/, "");
  return !name || name === "default" ? "main" : name;
}

function edgeKey(edge) {
  return `${edge.parentId}\u001f${normalizedCollection(edge.collectionName)}\u001f${edge.childId}`;
}

function commonRecord({
  issueType,
  key,
  generatedAt,
  snapshot,
  snapshotSha256,
}) {
  return {
    schemaVersion: "som-review-v1",
    datasetVersion: DATASET_VERSION,
    proposalId: proposalId(issueType, key),
    branch: "Sell",
    issueType,
    rolloutStatus: "experimental",
    workflow: {
      robTaskIds: [],
      stage: "final-action",
      proposalKind: issueType === "collection-design" ? "design" : "action",
      dependsOnProposalIds: [],
    },
    internalModelEvidence: {
      detectorId: "deterministic-post-semantic-regeneration",
      detectorName: "deterministic-post-semantic-regeneration",
      detectorPromptVersion: "sell-semantic-followup-v1",
      judgeId: "",
      judgeName: "",
      judgePromptVersion: "",
      detectorConfidence: "not-scored",
      judgeConfidence: "not-scored",
      reviewerVisible: false,
    },
    createdAt: generatedAt,
    provenance: {
      sourceOntology: `firestore://${snapshot.firestoreProjectId}/${snapshot.ontologyAppId}`,
      sourceOntologySha256: snapshotSha256,
      sourceArtifact: SOURCE_AUDIT,
      sourceRecord: "",
      sourceOntologyAppId: snapshot.ontologyAppId,
      sourceOntologyName: snapshot.ontologyName,
      sourceSnapshotSha256: snapshotSha256,
      subjectNodeId: "",
      parentNodeId: "",
      referencedNodeIds: [],
    },
  };
}

function main() {
  const args = parseArgs();
  const snapshotFile = path.resolve(args.snapshot || DEFAULT_SNAPSHOT);
  const outputDir = path.resolve(args.output || DEFAULT_OUTPUT);
  const snapshot = JSON.parse(fs.readFileSync(snapshotFile, "utf8"));
  const generatedAt = args["generated-at"] || snapshot.capturedAt;
  if (!generatedAt) {
    throw new Error("--generated-at or snapshot.capturedAt is required");
  }
  const snapshotSha = sha256File(snapshotFile);
  const byId = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const idsByTitle = new Map();
  for (const node of snapshot.nodes) {
    idsByTitle.set(node.title, [
      ...(idsByTitle.get(node.title) || []),
      node.id,
    ]);
  }
  const uniqueId = (title) => {
    const ids = idsByTitle.get(title) || [];
    if (ids.length !== 1) {
      throw new Error(
        `Expected one snapshot node titled ${title}, found ${ids.length}`,
      );
    }
    return ids[0];
  };
  const sellRootId = snapshot.sellRootNodeId || snapshot.branchRootNodeId;
  if (byId.get(sellRootId)?.title !== "Sell") {
    throw new Error("Target snapshot does not identify the Sell root");
  }
  const edgesByParent = new Map();
  const parentEdgesByChild = new Map();
  for (const edge of snapshot.edges) {
    edgesByParent.set(edge.parentId, [
      ...(edgesByParent.get(edge.parentId) || []),
      edge,
    ]);
    parentEdgesByChild.set(edge.childId, [
      ...(parentEdgesByChild.get(edge.childId) || []),
      edge,
    ]);
  }

  const emptyNodes = snapshot.nodes
    .filter(
      (node) =>
        !node.referenceOnly &&
        node.id !== sellRootId &&
        !isOnetEvidence(node) &&
        (edgesByParent.get(node.id) || []).length === 0,
    )
    .sort((left, right) => left.title.localeCompare(right.title, "en"));
  const emptyNodeRecords = emptyNodes.map((node) => {
    const parentEdges = parentEdgesByChild.get(node.id) || [];
    if (parentEdges.length !== 1) {
      throw new Error(
        `Empty node ${node.title} has ${parentEdges.length} direct parents`,
      );
    }
    const parentEdge = parentEdges[0];
    const parent = byId.get(parentEdge.parentId);
    const record = commonRecord({
      issueType: "empty-node",
      key: node.id,
      generatedAt,
      snapshot,
      snapshotSha256: snapshotSha,
    });
    return {
      ...record,
      reviewMode: "manual-check",
      subject: {
        title: node.title,
        parentTitle: parent.title,
        path: ["Sell", node.title],
        relatedTitles: [],
      },
      reviewerView: {
        question: `Do you agree that the empty node "${node.title}" should be removed?`,
        currentState: `"${node.title}" is a direct child of "${parent.title}" but has no activity children or O*NET evidence in the revised snapshot.`,
        proposedState: `Remove "${node.title}" if it is not an intentional organizing concept.`,
        reasoning:
          "This is a deterministic empty-node finding after the accepted semantic changes were applied. It is not an automatic deletion.",
        context: {
          type: "empty-node-action",
          parentTitle: parent.title,
          parentCollection: normalizedCollection(parentEdge.collectionName),
          nodeTitle: node.title,
        },
        agreeLabel: "Agree",
        disagreeLabel: "Disagree",
        rejectionReasonRequired: true,
        autoAdvanceOnAgree: true,
        hideModelConfidence: true,
      },
      provenance: {
        ...record.provenance,
        sourceRecord: `empty-node:${node.id}`,
        subjectNodeId: node.id,
        parentNodeId: parent.id,
        referencedNodeIds: [parent.id, node.id].sort(),
      },
    };
  });

  const populatedCollectionKeys = new Set(
    snapshot.edges.map(
      (edge) =>
        `${edge.parentId}\u001f${normalizedCollection(edge.collectionName)}`,
    ),
  );
  const emptyCollections = (snapshot.collections || [])
    .filter((collection) => {
      const parent = byId.get(collection.parentId);
      return (
        parent &&
        !parent.referenceOnly &&
        !isOnetEvidence(parent) &&
        normalizedCollection(collection.collectionName) !== "main" &&
        !populatedCollectionKeys.has(
          `${collection.parentId}\u001f${normalizedCollection(
            collection.collectionName,
          )}`,
        )
      );
    })
    .sort((left, right) =>
      `${byId.get(left.parentId)?.title}\u001f${left.collectionName}`.localeCompare(
        `${byId.get(right.parentId)?.title}\u001f${right.collectionName}`,
        "en",
      ),
    );
  const emptyCollectionRecords = emptyCollections.map((collection) => {
    const parent = byId.get(collection.parentId);
    const collectionName = normalizedCollection(collection.collectionName);
    const record = commonRecord({
      issueType: "empty-collection",
      key: `${collection.parentId}:${collectionName}`,
      generatedAt,
      snapshot,
      snapshotSha256: snapshotSha,
    });
    return {
      ...record,
      reviewMode: "manual-check",
      subject: {
        title: collectionName,
        parentTitle: parent.title,
        path: ["Sell", parent.title],
        relatedTitles: [],
      },
      reviewerView: {
        question: `Do you agree that the empty collection "${collectionName}" should be removed from "${parent.title}"?`,
        currentState: `"${collectionName}" exists under "${parent.title}" but has no members in the revised snapshot.`,
        proposedState: `Remove the empty collection label from "${parent.title}".`,
        reasoning:
          "This is a deterministic empty-collection finding after the accepted semantic changes were applied.",
        context: {
          type: "empty-collection-action",
          parentTitle: parent.title,
          collectionName,
        },
        agreeLabel: "Agree",
        disagreeLabel: "Disagree",
        rejectionReasonRequired: true,
        autoAdvanceOnAgree: true,
        hideModelConfidence: true,
      },
      provenance: {
        ...record.provenance,
        sourceRecord: `empty-collection:${collection.parentId}:${collectionName}`,
        subjectNodeId: parent.id,
        parentNodeId: parent.id,
        referencedNodeIds: [parent.id],
      },
    };
  });

  const directSellEdges = (edgesByParent.get(sellRootId) || []).filter(
    (edge) => !isOnetEvidence(byId.get(edge.childId)),
  );
  const allDirectChildren = directSellEdges
    .map((edge) => byId.get(edge.childId)?.title)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, "en"));
  const collectionBranchTitles = allDirectChildren.filter(
    (title) => title !== "Sell (Other)",
  );
  if (
    !collectionBranchTitles.includes("Rent out") ||
    collectionBranchTitles.length < 2
  ) {
    throw new Error("Revised Sell root cannot support the collection proposal");
  }
  const ownershipTitles = collectionBranchTitles.filter(
    (title) => title !== "Rent out",
  );
  const collectionRecordBase = commonRecord({
    issueType: "collection-design",
    key: "Sell:ownership-or-temporary-use:existing-children-only",
    generatedAt,
    snapshot,
    snapshotSha256: snapshotSha,
  });
  const proposedCollectionName = "Sell ownership or temporary use?";
  const collectionRecord = {
    ...collectionRecordBase,
    reviewMode: "proposed-change",
    subject: {
      title: proposedCollectionName,
      parentTitle: "Sell",
      path: ["Sell"],
      relatedTitles: collectionBranchTitles,
    },
    reviewerView: {
      question:
        "Do you agree that Sell's existing direct branches should be organized in a collection that distinguishes ownership from temporary use?",
      currentState: `Sell currently has these substantive direct children across several collections: ${collectionBranchTitles.join(
        ", ",
      )}. The separate empty-node item determines whether to retain or remove "Sell (Other)".`,
      proposedState: `Place the existing substantive direct children in a collection named "${proposedCollectionName}". "Rent out" represents temporary use; ${ownershipTitles.join(
        ", ",
      )} are treated as ownership by default. This changes only collection membership and creates no activity nodes or hierarchy edges.`,
      reasoning:
        "The revised hierarchy now contains an explicit seller-side temporary-use branch. A collection can expose that distinction without recreating Sell ownership or Sell temporary use as activity nodes.",
      context: {
        type: "collection-design",
        parentTitle: "Sell",
        currentChildren: collectionBranchTitles,
        proposedCollectionName,
        proposedBranches: collectionBranchTitles.map((title) => ({
          title,
          status: "existing",
          children: [],
        })),
        sourceTasks: [],
      },
      agreeLabel: "Agree",
      disagreeLabel: "Disagree",
      rejectionReasonRequired: true,
      autoAdvanceOnAgree: true,
      hideModelConfidence: true,
    },
    provenance: {
      ...collectionRecordBase.provenance,
      sourceRecord: "collection-design:Sell:ownership-or-temporary-use",
      subjectNodeId: "",
      parentNodeId: sellRootId,
      referencedNodeIds: [
        sellRootId,
        ...collectionBranchTitles.map(uniqueId),
      ].sort(),
    },
  };

  const proposals = [collectionRecord];
  const controls = [];
  const manualChecks = [...emptyNodeRecords, ...emptyCollectionRecords];
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  fs.copyFileSync(snapshotFile, path.join(outputDir, "ontology-snapshot.json"));
  const priorSchemaDir = path.join(
    REPO_ROOT,
    "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
    "review-datasets-rob-semantic-coverage-2026-07-29",
    "schema",
  );
  fs.mkdirSync(path.join(outputDir, "schema"), { recursive: true });
  for (const file of [
    "review-proposal.schema.json",
    "review-response.schema.json",
  ]) {
    fs.copyFileSync(
      path.join(priorSchemaDir, file),
      path.join(outputDir, "schema", file),
    );
  }

  writeJsonl(path.join(outputDir, "all_proposals.jsonl"), proposals);
  writeJsonl(path.join(outputDir, "all_controls.jsonl"), controls);
  writeJsonl(path.join(outputDir, "manual_checks.jsonl"), manualChecks);
  const issueTypes = ["empty-node", "empty-collection", "collection-design"];
  for (const issueType of issueTypes) {
    writeJsonl(
      path.join(outputDir, "proposals", `${issueType}.jsonl`),
      proposals.filter((record) => record.issueType === issueType),
    );
    writeJsonl(
      path.join(outputDir, "controls", `${issueType}.jsonl`),
      controls.filter((record) => record.issueType === issueType),
    );
  }

  const applicationAuditFile = path.join(REPO_ROOT, SOURCE_AUDIT);
  const applicationAuditSha256 = sha256File(applicationAuditFile);
  const scanAudit = {
    schemaVersion: "som-semantic-followup-generation-audit-v1",
    generatedAt,
    sourceSnapshotSha256: snapshotSha,
    sourceApplicationAudit: {
      file: SOURCE_AUDIT,
      sha256: applicationAuditSha256,
    },
    counts: {
      emptyNodes: emptyNodes.length,
      emptyNamedCollections: emptyCollections.length,
      collectionDesigns: proposals.length,
    },
    emptyNodes: emptyNodes.map((node) => ({ id: node.id, title: node.title })),
    emptyNamedCollections: emptyCollections.map((collection) => ({
      parentId: collection.parentId,
      parentTitle: byId.get(collection.parentId)?.title,
      collectionName: normalizedCollection(collection.collectionName),
    })),
    collectionInvariant: {
      createsActivityNodes: false,
      createsHierarchyEdges: false,
      proposedBranches: collectionBranchTitles,
      temporaryUseBranch: "Rent out",
      ownershipDefaultBranches: ownershipTitles,
      deferredEmptyBranch: "Sell (Other)",
    },
  };
  writeJson(
    path.join(outputDir, "diagnostics", "regeneration-audit.json"),
    scanAudit,
  );

  const manifest = {
    schemaVersion: "som-review-v1",
    datasetVersion: DATASET_VERSION,
    branch: "Sell",
    generatedAt,
    sourceOntology: `firestore://${snapshot.firestoreProjectId}/${snapshot.ontologyAppId}`,
    sourceOntologySha256: snapshotSha,
    counts: {
      proposals: proposals.length,
      controls: controls.length,
      manualChecks: manualChecks.length,
    },
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
        id: "empty-node",
        label: "1. Remove empty nodes",
        taskIds: [],
        stage: "final-action",
        contextType: "empty-node-action",
        proposals: 0,
        controls: 0,
        manualChecks: emptyNodeRecords.length,
      },
      {
        id: "empty-collection",
        label: "2. Remove empty collections",
        taskIds: [],
        stage: "final-action",
        contextType: "empty-collection-action",
        proposals: 0,
        controls: 0,
        manualChecks: emptyCollectionRecords.length,
      },
      {
        id: "collection-design",
        label: "3. Organize ownership and temporary use",
        taskIds: [],
        stage: "final-action",
        contextType: "collection-design",
        proposals: 1,
        controls: 0,
        manualChecks: 0,
      },
    ],
    reviewRelease: {
      strategy: "post-semantic-checkpoint",
      currentWave: "cleanup-and-collection-design",
      releasedIssueTypes: issueTypes,
      awaitingRegenerationIssueTypes: [],
      message:
        "The accepted semantic decisions have been applied to an isolated, verified ontology copy. Review the remaining deterministic cleanup and collection-only organization items.",
    },
    safety: {
      reviewOnly: true,
      mutatesOntology: false,
      approvalAuthorizesAutomaticWrite: false,
      modelConfidenceVisibleToReviewer: false,
    },
    sourceSnapshot: {
      file: "ontology-snapshot.json",
      sha256: snapshotSha,
      capturedAt: snapshot.capturedAt,
      ontologyAppId: snapshot.ontologyAppId,
      ontologyName: snapshot.ontologyName,
      environment: snapshot.environment,
      branchRootTitle: "Sell",
      branchRootNodeId: sellRootId,
      sellRootNodeId: sellRootId,
      nodeCount: snapshot.nodes.length,
      edgeCount: snapshot.edges.length,
      collectionCount: (snapshot.collections || []).length,
    },
    propagationCheckpoint: {
      priorDatasetVersion: "sell-rob-semantic-coverage-2026-07-29-v1",
      applicationAuditFile: SOURCE_AUDIT,
      applicationAuditSha256,
      sourceUnchanged: true,
      targetDigestVerified: true,
      buyerEvidenceRetainedInOriginalBranch: true,
    },
    limitations: [
      "This round contains only deterministic cleanup and a collection-only design proposal.",
      "The collection proposal can reorganize existing direct Sell children but cannot create activity nodes or hierarchy edges.",
      "Sell ownership and Sell temporary use must not be recreated as activity nodes.",
      "The empty-collection scan excludes default main placeholders and reference-only nodes outside the Sell branch.",
    ],
    contentRevision: 1,
  };
  writeJson(path.join(outputDir, "manifest.json"), manifest);
  fs.writeFileSync(
    path.join(outputDir, "README.md"),
    `# Sell post-semantic follow-up review\n\n` +
      `This dataset is pinned to the verified ontology produced from Rob's completed semantic review.\n\n` +
      `- Dataset: \`${DATASET_VERSION}\`\n` +
      `- Review: https://ontology.mit.edu/review?dataset=sell-semantic-coverage\n` +
      `- Remaining items: ${emptyNodeRecords.length} empty-node decision, ${emptyCollectionRecords.length} empty named collections, and 1 collection-only design decision.\n` +
      `- Safety: responses are review records only. No response writes to the ontology.\n` +
      `- Collection invariant: existing direct children may be assigned to a named collection; activity nodes and hierarchy edges cannot be created.\n`,
    "utf8",
  );
  process.stdout.write(
    `PASS: wrote ${proposals.length} proposal, ${manualChecks.length} manual checks, and ${controls.length} controls\n${outputDir}\n`,
  );
}

main();
