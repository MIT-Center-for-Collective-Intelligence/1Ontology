#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import {
  activeNodeByTitle,
  assertActiveGraphIntegrity,
  cloneAndRemap,
  deterministicNodeId,
  digestDocument,
  digestDocuments,
  linkId,
  removeReciprocalEdge,
} from "./clone-and-apply-structure-review.mjs";

const require = createRequire(import.meta.url);
require("../load-env.cjs");
const { cert, initializeApp } = require("firebase-admin/app");
const { FieldPath, getFirestore } = require("firebase-admin/firestore");

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const DEFAULT_ARTIFACT_DIR = path.join(
  REPO_ROOT,
  "artifacts",
  "rob-final-cleanup-2026-08-05",
);

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

function required(value, label) {
  if (!value) throw new Error(`${label} is required`);
  return value;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sha256File(file) {
  return sha256(fs.readFileSync(file));
}

function normalizeCollection(value = "") {
  const unwrapped = String(value).trim().replace(/^\[/, "").replace(/\]$/, "");
  return !unwrapped || unwrapped === "default" ? "main" : unwrapped;
}

function compactCollections(collections) {
  return (collections || [])
    .map((collection) => ({
      ...collection,
      collectionName: normalizeCollection(collection.collectionName),
      nodes: (collection.nodes || []).filter((link) => linkId(link)),
    }))
    .filter((collection) => collection.nodes.length > 0);
}

function credentials(environment) {
  const prefix = environment === "development" ? "DEV" : "PROD";
  return {
    projectId: required(
      process.env[`${prefix}_ONTOLOGY_CRED_PROJECT_ID`],
      `${prefix}_ONTOLOGY_CRED_PROJECT_ID`,
    ),
    clientEmail: required(
      process.env[`${prefix}_ONTOLOGY_CRED_CLIENT_EMAIL`],
      `${prefix}_ONTOLOGY_CRED_CLIENT_EMAIL`,
    ),
    privateKey: required(
      process.env[`${prefix}_ONTOLOGY_CRED_PRIVATE_KEY`],
      `${prefix}_ONTOLOGY_CRED_PRIVATE_KEY`,
    )
      .trim()
      .replace(/\\n/g, "\n"),
  };
}

function validatePlan(plan, planFile) {
  if (plan.schemaVersion !== "som-cleanup-application-plan-v1") {
    throw new Error(`Unexpected cleanup plan schema: ${plan.schemaVersion}`);
  }
  if (
    plan.status !== "reviewed-and-ready-for-isolated-application" ||
    plan.applicationAllowed !== true
  ) {
    throw new Error("Cleanup plan is not approved for isolated application");
  }
  if (
    !plan.targetOntology?.appId ||
    plan.targetOntology.appId === plan.sourceOntology?.appId
  ) {
    throw new Error("Cleanup target must be distinct from its source");
  }

  const datasetDir = path.resolve(REPO_ROOT, plan.sourceDataset.directory);
  const manifestFile = path.join(datasetDir, "manifest.json");
  const manifest = readJson(manifestFile);
  if (manifest.datasetVersion !== plan.sourceDataset.version) {
    throw new Error("Cleanup source dataset version is stale");
  }
  if (sha256File(manifestFile) !== plan.sourceDataset.manifestSha256) {
    throw new Error("Cleanup source manifest SHA-256 is stale");
  }
  const snapshotFile = path.join(datasetDir, plan.sourceOntology.snapshotFile);
  if (sha256File(snapshotFile) !== plan.sourceOntology.snapshotSha256) {
    throw new Error("Cleanup source snapshot SHA-256 is stale");
  }
  const snapshot = readJson(snapshotFile);
  if (
    snapshot.ontologyAppId !== plan.sourceOntology.appId ||
    snapshot.ontologyName !== plan.sourceOntology.name
  ) {
    throw new Error("Cleanup source ontology does not match its snapshot");
  }

  const proposals = new Map(
    [
      ...readJsonl(path.join(datasetDir, "all_proposals.jsonl")),
      ...readJsonl(path.join(datasetDir, "manual_checks.jsonl")),
    ].map((record) => [record.proposalId, record]),
  );
  const judgments = new Map();
  const benchmarkFiles = [];
  for (const benchmark of plan.benchmarks || []) {
    const file = path.resolve(path.dirname(planFile), benchmark.file);
    if (sha256File(file) !== benchmark.sha256) {
      throw new Error(`Cleanup benchmark SHA-256 is stale: ${benchmark.file}`);
    }
    const payload = readJson(file);
    if (
      payload.datasetVersion !== plan.sourceDataset.version ||
      payload.issueType !== benchmark.issueType ||
      payload.counts?.missing !== 0
    ) {
      throw new Error(`Cleanup benchmark is incomplete: ${benchmark.file}`);
    }
    for (const judgment of payload.judgments || []) {
      judgments.set(judgment.proposalId, judgment);
    }
    benchmarkFiles.push({ ...benchmark, absolutePath: file });
  }

  const removal = plan.acceptedRemoval;
  const removalProposal = proposals.get(removal.proposalId);
  const removalContext = removalProposal?.reviewerView?.context;
  const removalJudgment = judgments.get(removal.proposalId);
  if (
    removalProposal?.issueType !== "empty-node" ||
    removalJudgment?.decision !== "agree" ||
    removalProposal?.provenance?.subjectNodeId !== removal.sourceNodeId ||
    removalProposal?.provenance?.parentNodeId !== removal.sourceParentId ||
    removalContext?.nodeTitle !== removal.nodeTitle ||
    removalContext?.parentTitle !== removal.parentTitle ||
    removalContext?.parentCollection !== removal.parentCollection
  ) {
    throw new Error("Accepted empty-node removal does not match Rob's review");
  }

  const rejected = plan.rejectedCollection;
  const rejectedProposal = proposals.get(rejected.proposalId);
  const rejectedJudgment = judgments.get(rejected.proposalId);
  if (
    rejectedProposal?.issueType !== "collection-design" ||
    rejectedJudgment?.decision !== "disagree" ||
    rejectedProposal?.reviewerView?.context?.proposedCollectionName !==
      rejected.proposedCollectionName ||
    rejectedJudgment.disagreementReason !== rejected.expertDisagreementReason ||
    rejectedJudgment.suggestedCorrection !==
      rejected.expertSuggestedCorrection ||
    rejected.applicationMode !== "do-not-apply-rejected-proposal"
  ) {
    throw new Error("Rejected collection disposition changes Rob's review");
  }

  const legacyDir = path.resolve(
    REPO_ROOT,
    plan.unsupportedLegacyAddNodes.datasetDirectory,
  );
  const legacyRecords = readJsonl(
    path.join(legacyDir, "all_proposals.jsonl"),
  ).filter(
    (record) => record.issueType === plan.unsupportedLegacyAddNodes.issueType,
  );
  const sourceTaskCount = legacyRecords.reduce(
    (count, record) =>
      count + (record.reviewerView?.context?.sourceTasks || []).length,
    0,
  );
  if (
    legacyRecords.length !==
      plan.unsupportedLegacyAddNodes.expectedProposalCount ||
    legacyRecords.some(
      (record) =>
        record.internalModelEvidence?.detectorName !==
        plan.unsupportedLegacyAddNodes.requiredDetectorName,
    ) ||
    sourceTaskCount !==
      plan.unsupportedLegacyAddNodes.requiredSourceTaskCount ||
    plan.unsupportedLegacyAddNodes.disposition !== "exclude-until-onet-grounded"
  ) {
    throw new Error(
      "Legacy Add nodes evidence audit no longer matches the plan",
    );
  }

  const snapshotById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const snapshotEdge = snapshot.edges.find(
    (edge) =>
      edge.parentId === removal.sourceParentId &&
      edge.childId === removal.sourceNodeId,
  );
  if (
    snapshotById.get(removal.sourceNodeId)?.title !== removal.nodeTitle ||
    snapshotById.get(removal.sourceParentId)?.title !== removal.parentTitle ||
    normalizeCollection(snapshotEdge?.collectionName) !==
      removal.parentCollection
  ) {
    throw new Error("Pinned snapshot does not contain the reviewed removal");
  }

  return {
    benchmarkFiles,
    legacyRecords,
    snapshot,
    sourceTaskCount,
  };
}

async function readOntology(db, appId, pageSize = 750) {
  const documents = new Map();
  let cursor = null;
  let page = 0;
  while (true) {
    let query = db
      .collection("nodes")
      .where("appName", "==", appId)
      .orderBy(FieldPath.documentId())
      .limit(pageSize);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    for (const document of snapshot.docs) {
      documents.set(document.id, { ...document.data(), id: document.id });
    }
    page += 1;
    if (snapshot.empty || snapshot.size < pageSize) break;
    cursor = snapshot.docs[snapshot.docs.length - 1];
    if (page % 10 === 0) {
      process.stderr.write(`Read ${documents.size} nodes from ${appId}\n`);
    }
  }
  return documents;
}

function cloneAndApplyCleanup(sourceDocuments, plan) {
  const targetAppId = plan.targetOntology.appId;
  const idMap = new Map(
    [...sourceDocuments.keys()].map((sourceId) => [
      sourceId,
      deterministicNodeId(targetAppId, sourceId),
    ]),
  );
  if (new Set(idMap.values()).size !== idMap.size) {
    throw new Error("Deterministic cleanup clone IDs contain a collision");
  }
  const targetDocuments = new Map();
  for (const [sourceId, source] of sourceDocuments) {
    const targetId = idMap.get(sourceId);
    targetDocuments.set(targetId, {
      ...cloneAndRemap(source, idMap),
      appName: targetAppId,
      id: targetId,
    });
  }
  const baselineDigests = new Map(
    [...targetDocuments].map(([id, document]) => [
      id,
      digestDocument(document),
    ]),
  );

  const removal = plan.acceptedRemoval;
  const node = targetDocuments.get(idMap.get(removal.sourceNodeId));
  const parent = targetDocuments.get(idMap.get(removal.sourceParentId));
  if (
    !node ||
    node.deleted === true ||
    node.title !== removal.nodeTitle ||
    !parent ||
    parent.deleted === true ||
    parent.title !== removal.parentTitle
  ) {
    throw new Error("Live cleanup source differs from the reviewed snapshot");
  }
  const activeChildren = (node.specializations || [])
    .flatMap((collection) => collection.nodes || [])
    .map(linkId)
    .filter((id) => targetDocuments.get(id)?.deleted !== true);
  if (activeChildren.length) {
    throw new Error(`${removal.nodeTitle} is no longer empty`);
  }
  const containingCollection = (parent.specializations || []).find(
    (collection) =>
      (collection.nodes || []).some((link) => linkId(link) === node.id),
  );
  if (
    normalizeCollection(containingCollection?.collectionName) !==
    removal.parentCollection
  ) {
    throw new Error("Live cleanup parent collection changed after review");
  }

  removeReciprocalEdge(parent, node);
  node.deleted = true;
  node.generalizations = [];
  node.specializations = [];
  node.parentIds = [];
  node.primaryParentId = "";
  node.pathIds = [node.id];
  node.root = false;
  parent.specializations = compactCollections(parent.specializations);
  const sellRoot = activeNodeByTitle(targetDocuments, "Sell");
  const integrity = assertActiveGraphIntegrity(targetDocuments);
  if (
    [...targetDocuments.values()].some(
      (document) =>
        document.deleted !== true && document.title === removal.nodeTitle,
    )
  ) {
    throw new Error("Accepted empty node remains active after cleanup");
  }
  if (
    (sellRoot.specializations || []).some(
      (collection) =>
        normalizeCollection(collection.collectionName) ===
        removal.parentCollection,
    )
  ) {
    throw new Error("Cleanup left an empty Sell collection behind");
  }
  const changedTargetNodeIds = [...targetDocuments]
    .filter(
      ([id, document]) => digestDocument(document) !== baselineDigests.get(id),
    )
    .map(([id]) => id)
    .sort();
  const expectedChangedTargetNodeIds = [node.id, parent.id].sort();
  if (
    JSON.stringify(changedTargetNodeIds) !==
    JSON.stringify(expectedChangedTargetNodeIds)
  ) {
    throw new Error(
      `Cleanup changed unexpected documents: ${changedTargetNodeIds.join(", ")}`,
    );
  }

  return {
    idMap,
    targetDocuments,
    report: {
      sourceNodeCount: sourceDocuments.size,
      targetNodeCount: targetDocuments.size,
      activeTargetNodeCount: [...targetDocuments.values()].filter(
        (document) => document.deleted !== true,
      ).length,
      removal: {
        proposalId: removal.proposalId,
        sourceNodeId: removal.sourceNodeId,
        targetNodeId: node.id,
        nodeTitle: node.title,
        parentTitle: parent.title,
        removedCollectionName: removal.parentCollection,
        applicationMode: "accepted-empty-node-removal",
      },
      rejectedCollection: {
        proposalId: plan.rejectedCollection.proposalId,
        proposedCollectionName: plan.rejectedCollection.proposedCollectionName,
        applicationMode: "not-applied",
      },
      changeScope: {
        changedDocumentCount: changedTargetNodeIds.length,
        changedTargetNodeIds,
        exactReviewedScope: true,
      },
      integrity,
    },
  };
}

async function writeOntology(db, documents, concurrency = 6) {
  const entries = [...documents.entries()];
  const chunks = [];
  for (let offset = 0; offset < entries.length; offset += 400) {
    chunks.push(entries.slice(offset, offset + 400));
  }
  let cursor = 0;
  let written = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, chunks.length) },
    async () => {
      while (cursor < chunks.length) {
        const chunk = chunks[cursor++];
        const batch = db.batch();
        for (const [id, data] of chunk) {
          batch.create(db.collection("nodes").doc(id), data);
        }
        await batch.commit();
        written += chunk.length;
        process.stderr.write(`Wrote ${written}/${entries.length} nodes\n`);
      }
    },
  );
  const results = await Promise.allSettled(workers);
  const failure = results.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
}

function selfTest() {
  const makeNode = (id, title) => ({
    appName: "source",
    deleted: false,
    generalizations: [],
    id,
    parentIds: [],
    pathIds: [id],
    primaryParentId: "",
    properties: { description: "" },
    root: false,
    specializations: [],
    title,
  });
  const source = new Map([
    ["sell", makeNode("sell", "Sell")],
    ["other", makeNode("other", "Sell (Other)")],
  ]);
  source.get("sell").specializations = [
    {
      collectionName: "Sell -- miscellaneous",
      nodes: [{ id: "other", title: "Sell (Other)" }],
    },
  ];
  source.get("other").generalizations = [
    { collectionName: "main", nodes: [{ id: "sell", title: "Sell" }] },
  ];
  const transformed = cloneAndApplyCleanup(source, {
    sourceOntology: { appId: "source" },
    targetOntology: { appId: "target" },
    acceptedRemoval: {
      proposalId: "remove",
      sourceNodeId: "other",
      nodeTitle: "Sell (Other)",
      sourceParentId: "sell",
      parentTitle: "Sell",
      parentCollection: "Sell -- miscellaneous",
    },
    rejectedCollection: {
      proposalId: "reject",
      proposedCollectionName: "Rejected",
    },
  });
  const other = transformed.targetDocuments.get(transformed.idMap.get("other"));
  const sell = transformed.targetDocuments.get(transformed.idMap.get("sell"));
  if (
    other?.deleted !== true ||
    (sell?.specializations || []).length !== 0 ||
    transformed.report.integrity.activeNodeCount !== 1
  ) {
    throw new Error("Cleanup checkpoint self-test failed");
  }
  process.stdout.write("PASS: cleanup checkpoint clone self-test\n");
}

async function main() {
  const args = parseArgs();
  if (args["self-test"]) {
    selfTest();
    return;
  }
  const planFile = path.resolve(
    args.plan ||
      path.join(DEFAULT_ARTIFACT_DIR, "cleanup-application-plan.json"),
  );
  const outputFile = path.resolve(
    args.out ||
      path.join(DEFAULT_ARTIFACT_DIR, "cleanup-application-audit.json"),
  );
  const environment = args.environment || "production";
  const apply = args.apply === true || args.apply === "true";
  const resume = args.resume === true || args.resume === "true";
  const plan = readJson(planFile);
  const validation = validatePlan(plan, planFile);
  const serviceAccount = credentials(environment);
  const app = initializeApp(
    { credential: cert(serviceAccount) },
    `som-cleanup-checkpoint-${environment}-${Date.now()}`,
  );
  const db = getFirestore(app);
  const sourceDocuments = await readOntology(db, plan.sourceOntology.appId);
  const sourceDigestBefore = digestDocuments(sourceDocuments);
  const transformed = cloneAndApplyCleanup(sourceDocuments, plan);

  const existingTarget = await readOntology(db, plan.targetOntology.appId);
  if (existingTarget.size && !resume) {
    throw new Error(
      `Cleanup target already has ${existingTarget.size} nodes; use --resume only for an exact partial write`,
    );
  }
  for (const [id, existing] of existingTarget) {
    const expected = transformed.targetDocuments.get(id);
    if (!expected || digestDocument(existing) !== digestDocument(expected)) {
      throw new Error(`Existing cleanup target node ${id} differs from plan`);
    }
  }
  const documentsToWrite = new Map(
    [...transformed.targetDocuments].filter(([id]) => !existingTarget.has(id)),
  );
  const audit = {
    schemaVersion: "som-cleanup-application-audit-v1",
    generatedAt: new Date().toISOString(),
    mode: apply ? "apply" : "dry-run",
    environment,
    firestoreProjectId: serviceAccount.projectId,
    sourceOntology: plan.sourceOntology,
    targetOntology: plan.targetOntology,
    sourceDataset: plan.sourceDataset,
    planSha256: sha256File(planFile),
    benchmarkFiles: validation.benchmarkFiles.map((benchmark) => ({
      file: benchmark.file,
      issueType: benchmark.issueType,
      sha256: benchmark.sha256,
    })),
    sourceDigestBefore,
    expectedTargetDigest: digestDocuments(transformed.targetDocuments),
    existingTargetNodeCount: existingTarget.size,
    nodesRemainingToWrite: documentsToWrite.size,
    resume,
    unsupportedLegacyAddNodes: {
      proposalCount: validation.legacyRecords.length,
      sourceTaskCount: validation.sourceTaskCount,
      detectorNames: [
        ...new Set(
          validation.legacyRecords.map(
            (record) => record.internalModelEvidence?.detectorName || "",
          ),
        ),
      ],
      disposition: plan.unsupportedLegacyAddNodes.disposition,
    },
    ...transformed.report,
  };

  if (apply) {
    await writeOntology(db, documentsToWrite);
    const [sourceAfter, targetAfter] = await Promise.all([
      readOntology(db, plan.sourceOntology.appId),
      readOntology(db, plan.targetOntology.appId),
    ]);
    audit.sourceDigestAfter = digestDocuments(sourceAfter);
    audit.targetDigestAfter = digestDocuments(targetAfter);
    audit.targetNodeCountAfter = targetAfter.size;
    audit.verification = {
      sourceUnchanged: audit.sourceDigestAfter === sourceDigestBefore,
      targetCountMatches: targetAfter.size === transformed.targetDocuments.size,
      targetDigestMatches:
        audit.targetDigestAfter === audit.expectedTargetDigest,
    };
    if (!Object.values(audit.verification).every(Boolean)) {
      writeJson(outputFile, audit);
      throw new Error(`Cleanup post-write verification failed: ${outputFile}`);
    }
  }
  writeJson(outputFile, audit);
  process.stdout.write(
    `${apply ? "Applied" : "Dry-run validated"}: removed ${audit.removal.nodeTitle}; ` +
      `${audit.unsupportedLegacyAddNodes.proposalCount} unsupported legacy additions excluded; ` +
      `${audit.sourceNodeCount} source nodes -> ${audit.targetNodeCount} target nodes.\n` +
      `${outputFile}\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_FILE) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.stack || error.message : error,
    );
    process.exitCode = 1;
  });
}

export { cloneAndApplyCleanup, compactCollections, validatePlan };
