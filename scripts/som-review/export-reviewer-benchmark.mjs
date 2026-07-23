#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
const { cert, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const DEFAULT_DATASET_DIR = path.join(
  REPO_ROOT,
  "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
  "review-datasets",
);

function parseArgs() {
  const values = {};
  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (!arg.startsWith("--")) continue;
    const [name, inlineValue] = arg.slice(2).split("=", 2);
    values[name] = inlineValue ?? process.argv[++index];
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

function credentials() {
  const privateKey = required(
    process.env.PROD_ONTOLOGY_CRED_PRIVATE_KEY,
    "PROD_ONTOLOGY_CRED_PRIVATE_KEY",
  );
  return {
    projectId: required(
      process.env.PROD_ONTOLOGY_CRED_PROJECT_ID,
      "PROD_ONTOLOGY_CRED_PROJECT_ID",
    ),
    clientEmail: required(
      process.env.PROD_ONTOLOGY_CRED_CLIENT_EMAIL,
      "PROD_ONTOLOGY_CRED_CLIENT_EMAIL",
    ),
    privateKey: privateKey.trim().replace(/\\n/g, "\n"),
  };
}

function linkedNodeIds(collections) {
  if (!Array.isArray(collections)) return [];
  return collections.flatMap((collection) =>
    Array.isArray(collection?.nodes)
      ? collection.nodes
          .map((node) => (typeof node === "string" ? node : node?.id))
          .filter(Boolean)
      : [],
  );
}

function linkedNodeTitles(collections) {
  if (!Array.isArray(collections)) return [];
  return collections.flatMap((collection) =>
    Array.isArray(collection?.nodes)
      ? collection.nodes
          .map((node) => (typeof node === "string" ? "" : node?.title || ""))
          .filter(Boolean)
      : [],
  );
}

async function main() {
  loadEnvConfig(REPO_ROOT);
  const args = parseArgs();
  const datasetDir = path.resolve(args["dataset-dir"] || DEFAULT_DATASET_DIR);
  const issueType = args["issue-type"] || "title-clarity";
  const reviewerEmail = required(args["reviewer-email"], "--reviewer-email");
  const reviewerLabel = args["reviewer-label"] || "expert-reviewer";
  const outputFile = path.resolve(required(args.out, "--out"));

  const manifest = readJson(path.join(datasetDir, "manifest.json"));
  const proposals = [
    ...readJsonl(path.join(datasetDir, "all_proposals.jsonl")),
    ...readJsonl(path.join(datasetDir, "all_controls.jsonl")),
    ...readJsonl(path.join(datasetDir, "manual_checks.jsonl")),
  ];
  const proposalsById = new Map(
    proposals
      .filter((proposal) => proposal.issueType === issueType)
      .map((proposal) => [proposal.proposalId, proposal]),
  );

  const serviceAccount = credentials();
  const app = initializeApp(
    { credential: cert(serviceAccount) },
    `som-review-export-${Date.now()}`,
  );
  const auth = getAuth(app);
  const reviewer = await auth.getUserByEmail(reviewerEmail);
  const db = getFirestore(app);
  const snapshot = await db
    .collection("somReviewResponses")
    .where("datasetVersion", "==", manifest.datasetVersion)
    .where("issueType", "==", issueType)
    .where("reviewerId", "==", reviewer.uid)
    .where("status", "==", "current")
    .get();

  const currentRecords = snapshot.docs.map((doc) => doc.data());
  const orphanedResponses = currentRecords
    .filter((record) => !proposalsById.has(record.proposalId))
    .map((record) => ({
      proposalId: record.proposalId,
      decision: record.response?.decision || "",
      disagreementReason: record.response?.disagreementReason || "",
      suggestedCorrection: record.response?.suggestedCorrection || "",
      revisionCount: record.revisionCount || 0,
    }))
    .sort((left, right) => left.proposalId.localeCompare(right.proposalId));
  const judgments = currentRecords
    .filter((record) => proposalsById.has(record.proposalId))
    .map((record) => {
      const proposal = proposalsById.get(record.proposalId);
      return {
        proposalId: proposal.proposalId,
        reviewMode: proposal.reviewMode,
        subjectNodeId: proposal.provenance?.subjectNodeId || "",
        parentNodeId: proposal.provenance?.parentNodeId || "",
        currentTitle: proposal.reviewerView?.context?.currentTitle || "",
        proposedTitle: proposal.reviewerView?.context?.proposedTitle || "",
        linkedTasks: proposal.reviewerView?.context?.linkedTasks || [],
        agentReasoning: proposal.reviewerView?.reasoning || "",
        decision: record.response?.decision || "",
        disagreementReason: record.response?.disagreementReason || "",
        suggestedCorrection: record.response?.suggestedCorrection || "",
        revisionCount: record.revisionCount || 0,
      };
    })
    .sort((left, right) =>
      left.currentTitle.localeCompare(right.currentTitle, "en"),
    );

  const expected = proposalsById.size;
  const missingProposalIds = [...proposalsById.keys()].filter(
    (proposalId) => !judgments.some((judgment) => judgment.proposalId === proposalId),
  );
  const subjectNodeIds = [...new Set(judgments.map((item) => item.subjectNodeId).filter(Boolean))];
  const subjectSnapshots = subjectNodeIds.length
    ? await db.getAll(...subjectNodeIds.map((nodeId) => db.collection("nodes").doc(nodeId)))
    : [];
  const subjectNodes = subjectSnapshots
    .filter((snapshot) => snapshot.exists)
    .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));
  const childNodeIds = [
    ...new Set(subjectNodes.flatMap((node) => linkedNodeIds(node.specializations))),
  ];
  const childSnapshots = childNodeIds.length
    ? await db.getAll(...childNodeIds.map((nodeId) => db.collection("nodes").doc(nodeId)))
    : [];
  const childrenById = new Map(
    childSnapshots
      .filter((snapshot) => snapshot.exists)
      .map((snapshot) => [snapshot.id, { id: snapshot.id, ...snapshot.data() }]),
  );
  const sourceNodeEvidence = subjectNodes
    .map((node) => ({
      nodeId: node.id,
      title: node.title || "",
      appName: node.appName || "",
      specializations: (node.specializations || []).map((collection) => ({
        collectionName: collection.collectionName || "main",
        nodes: (collection.nodes || []).map((link) => {
          const childId = typeof link === "string" ? link : link.id;
          const child = childrenById.get(childId);
          return {
            nodeId: childId,
            linkTitle: typeof link === "string" ? "" : link.title || "",
            title: child?.title || "",
            oNet: child?.oNet === true,
            generalizationTitles: linkedNodeTitles(child?.generalizations),
          };
        }),
      })),
    }))
    .sort((left, right) => left.title.localeCompare(right.title, "en"));
  const output = {
    schemaVersion: "som-reviewer-benchmark-v1",
    exportedAt: new Date().toISOString(),
    firestoreProjectId: serviceAccount.projectId,
    datasetVersion: manifest.datasetVersion,
    sourceOntology: manifest.sourceOntology,
    sourceOntologySha256: manifest.sourceOntologySha256,
    issueType,
    reviewer: { label: reviewerLabel },
    counts: {
      expected,
      reviewed: judgments.length,
      agreed: judgments.filter((judgment) => judgment.decision === "agree").length,
      disagreed: judgments.filter((judgment) => judgment.decision === "disagree").length,
      missing: missingProposalIds.length,
      orphanedHistoricalResponses: orphanedResponses.length,
    },
    missingProposalIds,
    orphanedResponses,
    sourceNodeEvidence,
    judgments,
  };

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  process.stdout.write(
    `${output.counts.reviewed}/${expected} ${issueType} judgments exported; ` +
      `${output.counts.agreed} agreed, ${output.counts.disagreed} disagreed, ` +
      `${output.counts.missing} missing, ` +
      `${output.counts.orphanedHistoricalResponses} orphaned historical responses.\n` +
      `${outputFile}\n`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
