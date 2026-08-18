#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import {
  activeNodeByTitle,
  addReciprocalEdge,
  assertActiveGraphIntegrity,
  cloneAndRemap,
  deterministicNodeId,
  digestDocument,
  digestDocuments,
  hasDirectLink,
  isOnetEvidence,
  linkId,
  newActivityNode,
  refreshLinkTitles,
  removeReciprocalEdge,
  synchronizeHierarchyFields,
} from "./clone-and-apply-structure-review.mjs";

const require = createRequire(import.meta.url);
require("../load-env.cjs");
const { cert, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const DEFAULT_ARTIFACT_DIR = path.join(
  REPO_ROOT,
  "artifacts",
  "rob-semantic-coverage-2026-08-04",
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

function normalizedCollection(value = "") {
  const name = String(value).trim().replace(/^\[/, "").replace(/\]$/, "");
  return !name || name === "default" ? "main" : name;
}

function edgeKey(parentId, childId, collectionName = "main") {
  return `${parentId}\u001f${normalizedCollection(collectionName)}\u001f${childId}`;
}

function directEdges(documents, allowedIds) {
  const edges = new Set();
  for (const [parentId, parent] of documents) {
    if (!allowedIds.has(parentId)) continue;
    for (const collection of parent.specializations || []) {
      for (const link of collection.nodes || []) {
        const childId = linkId(link);
        if (allowedIds.has(childId)) {
          edges.add(edgeKey(parentId, childId, collection.collectionName));
        }
      }
    }
  }
  return edges;
}

function normalizedSnapshotNode(node) {
  return {
    id: node.id,
    title: String(node.title || "").trim(),
    description: String(
      node?.properties?.description ?? node.description ?? "",
    ).trim(),
    synsets: String(node.synsets || "").trim(),
    actionAlternatives: Array.isArray(node.actionAlternatives)
      ? node.actionAlternatives.map(String).filter(Boolean).sort()
      : [],
    oNet: node.oNet === true,
    oNetTask: Boolean(node.oNetTask),
  };
}

function sameStringSet(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function validateStaticPlan(plan, planFile) {
  if (plan.schemaVersion !== "som-semantic-application-plan-v1") {
    throw new Error(`Unexpected plan schema: ${plan.schemaVersion}`);
  }
  if (
    plan.status !== "reviewed-and-ready-for-isolated-application" ||
    plan.applicationAllowed !== true
  ) {
    throw new Error("The semantic application plan is not approved for use");
  }
  if (
    !plan.targetOntology?.appId ||
    plan.targetOntology.appId === plan.sourceOntology?.appId
  ) {
    throw new Error("The target ontology must have a distinct app ID");
  }

  const datasetDir = path.resolve(REPO_ROOT, plan.sourceDataset.directory);
  const manifestFile = path.join(datasetDir, "manifest.json");
  const manifest = readJson(manifestFile);
  if (manifest.datasetVersion !== plan.sourceDataset.version) {
    throw new Error("Semantic plan source dataset version is stale");
  }
  if (sha256File(manifestFile) !== plan.sourceDataset.manifestSha256) {
    throw new Error("Semantic plan source manifest SHA-256 is stale");
  }
  const snapshotFile = path.join(datasetDir, plan.sourceOntology.snapshotFile);
  if (sha256File(snapshotFile) !== plan.sourceOntology.snapshotSha256) {
    throw new Error("Semantic plan source snapshot SHA-256 is stale");
  }
  const snapshot = readJson(snapshotFile);
  if (
    snapshot.ontologyAppId !== plan.sourceOntology.appId ||
    snapshot.ontologyName !== plan.sourceOntology.name
  ) {
    throw new Error(
      "Semantic plan source ontology does not match its snapshot",
    );
  }

  const proposals = new Map(
    readJsonl(path.join(datasetDir, "all_proposals.jsonl")).map((record) => [
      record.proposalId,
      record,
    ]),
  );
  const judgments = new Map();
  const benchmarkFiles = [];
  for (const benchmark of plan.benchmarks || []) {
    const file = path.resolve(path.dirname(planFile), benchmark.file);
    if (sha256File(file) !== benchmark.sha256) {
      throw new Error(`Benchmark SHA-256 is stale: ${benchmark.file}`);
    }
    const payload = readJson(file);
    if (
      payload.datasetVersion !== plan.sourceDataset.version ||
      payload.issueType !== benchmark.issueType
    ) {
      throw new Error(`Benchmark identity mismatch: ${benchmark.file}`);
    }
    if (payload.counts?.missing !== 0) {
      throw new Error(`Benchmark is incomplete: ${benchmark.file}`);
    }
    for (const judgment of payload.judgments || []) {
      if (judgments.has(judgment.proposalId)) {
        throw new Error(`Duplicate benchmark judgment: ${judgment.proposalId}`);
      }
      judgments.set(judgment.proposalId, judgment);
    }
    benchmarkFiles.push({ ...benchmark, absolutePath: file });
  }

  const requireDecision = (proposalId, decision) => {
    const judgment = judgments.get(proposalId);
    if (judgment?.decision !== decision) {
      throw new Error(`${proposalId} is not recorded as ${decision}`);
    }
    return judgment;
  };
  const snapshotById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const snapshotEdges = new Set(
    snapshot.edges.map((edge) =>
      edgeKey(edge.parentId, edge.childId, edge.collectionName),
    ),
  );
  const requireSnapshotNode = (id, title) => {
    const node = snapshotById.get(id);
    if (!node || node.title !== title) {
      throw new Error(`Pinned snapshot does not contain ${title} (${id})`);
    }
    return node;
  };
  const requireSnapshotEdge = (parentId, childId) => {
    const match = [...snapshotEdges].some(
      (key) =>
        key.startsWith(`${parentId}\u001f`) && key.endsWith(`\u001f${childId}`),
    );
    if (!match) {
      throw new Error(`Pinned snapshot lacks edge ${parentId} -> ${childId}`);
    }
  };

  for (const move of plan.acceptedWholeNodeMoves || []) {
    const decision = requireDecision(move.proposalId, "agree");
    const proposal = proposals.get(move.proposalId);
    const context = proposal?.reviewerView?.context;
    if (
      proposal?.issueType !== "cross-branch-recall" ||
      proposal?.provenance?.subjectNodeId !== move.sourceNodeId ||
      decision.subjectNodeId !== move.sourceNodeId ||
      context?.nodeTitle !== move.nodeTitle ||
      context?.currentParentTitle !== move.currentParentTitle ||
      context?.candidateHome !== move.targetParentTitle
    ) {
      throw new Error(`Move ${move.proposalId} does not match its proposal`);
    }
    requireSnapshotNode(move.sourceNodeId, move.nodeTitle);
    requireSnapshotNode(move.currentParentId, move.currentParentTitle);
    requireSnapshotNode(move.targetParentId, move.targetParentTitle);
    requireSnapshotEdge(move.currentParentId, move.sourceNodeId);
  }

  const split = plan.splitEvidenceMove;
  const splitDecision = requireDecision(split.proposalId, "disagree");
  const splitProposal = proposals.get(split.proposalId);
  const splitContext = splitProposal?.reviewerView?.context;
  if (
    splitProposal?.issueType !== "cross-branch-recall" ||
    splitProposal?.provenance?.subjectNodeId !== split.sourceNodeId ||
    splitContext?.nodeTitle !== split.nodeTitle ||
    splitContext?.currentParentTitle !== split.currentParentTitle ||
    splitContext?.candidateHome !== split.targetParentTitle ||
    splitDecision.disagreementReason !== split.disagreementReason ||
    splitDecision.suggestedCorrection !== split.suggestedCorrection
  ) {
    throw new Error("The Rent Equipment split does not match Rob's judgment");
  }
  requireSnapshotNode(split.sourceNodeId, split.nodeTitle);
  requireSnapshotEdge(split.currentParentId, split.sourceNodeId);
  for (const evidenceId of [
    ...split.providerEvidenceIds,
    ...split.buyerEvidenceIdsKeptInOriginalBranch,
  ]) {
    requireSnapshotEdge(split.sourceNodeId, evidenceId);
  }

  const plannedCrossBranchIds = new Set([
    ...(plan.acceptedWholeNodeMoves || []).map((move) => move.proposalId),
    split.proposalId,
  ]);
  const reviewedCrossBranchIds = new Set(
    [...judgments.values()]
      .filter(
        (judgment) =>
          proposals.get(judgment.proposalId)?.issueType ===
          "cross-branch-recall",
      )
      .map((judgment) => judgment.proposalId),
  );
  if (!sameStringSet(plannedCrossBranchIds, reviewedCrossBranchIds)) {
    throw new Error("Plan does not account for every cross-branch judgment");
  }

  for (const specialization of plan.evidenceSpecializations || []) {
    const expectedDecision =
      specialization.decision === "expert-correction" ? "disagree" : "agree";
    const decision = requireDecision(
      specialization.proposalId,
      expectedDecision,
    );
    const proposal = proposals.get(specialization.proposalId);
    const context = proposal?.reviewerView?.context;
    if (
      proposal?.issueType !== "evidence-specialization" ||
      proposal?.provenance?.subjectNodeId !== specialization.sourceTaskId ||
      proposal?.provenance?.parentNodeId !== specialization.genericParentId ||
      context?.genericNodeTitle !== specialization.genericParentTitle ||
      context?.proposedTitleStatus !== specialization.targetStatus
    ) {
      throw new Error(
        `Specialization ${specialization.proposalId} does not match its proposal`,
      );
    }
    if (
      specialization.decision === "expert-correction" &&
      decision.suggestedCorrection !== specialization.suggestedCorrection
    ) {
      throw new Error(
        `Specialization ${specialization.proposalId} changes Rob's correction`,
      );
    }
    if (
      specialization.decision === "agree" &&
      context.proposedTitle !== specialization.targetTitle
    ) {
      throw new Error(
        `Accepted specialization ${specialization.proposalId} changes the proposal`,
      );
    }
    requireSnapshotEdge(
      specialization.genericParentId,
      specialization.sourceTaskId,
    );
  }
  const plannedSpecializationIds = new Set(
    (plan.evidenceSpecializations || []).map((item) => item.proposalId),
  );
  const reviewedSpecializationIds = new Set(
    [...judgments.values()]
      .filter(
        (judgment) =>
          proposals.get(judgment.proposalId)?.issueType ===
          "evidence-specialization",
      )
      .map((judgment) => judgment.proposalId),
  );
  if (!sameStringSet(plannedSpecializationIds, reviewedSpecializationIds)) {
    throw new Error(
      "Plan does not account for every evidence-specialization judgment",
    );
  }

  for (const title of plan.forbiddenActivityTitles || []) {
    if (snapshot.nodes.some((node) => node.title === title)) {
      throw new Error(`Pinned source still contains forbidden node: ${title}`);
    }
  }
  return {
    benchmarkFiles,
    datasetDir,
    judgments,
    manifest,
    proposals,
    snapshot,
    snapshotFile,
  };
}

function validateLiveSnapshot(snapshot, documents, sourceAppId) {
  const expectedIds = new Set(snapshot.nodes.map((node) => node.id));
  for (const expected of snapshot.nodes) {
    const actual = documents.get(expected.id);
    if (!actual || actual.deleted === true) {
      throw new Error(
        `Reviewed source node is missing or deleted: ${expected.id}`,
      );
    }
    if (
      JSON.stringify(normalizedSnapshotNode(expected)) !==
      JSON.stringify(normalizedSnapshotNode(actual))
    ) {
      throw new Error(`Reviewed source node changed: ${expected.title}`);
    }
  }
  const expectedEdges = new Set(
    snapshot.edges.map((edge) =>
      edgeKey(edge.parentId, edge.childId, edge.collectionName),
    ),
  );
  const actualEdges = directEdges(documents, expectedIds);
  if (!sameStringSet(expectedEdges, actualEdges)) {
    const removed = [...expectedEdges].filter((key) => !actualEdges.has(key));
    const added = [...actualEdges].filter((key) => !expectedEdges.has(key));
    throw new Error(
      `Reviewed source edges changed (removed ${removed.length}, added ${added.length})`,
    );
  }
  const expectedSellOwned = snapshot.nodes.filter(
    (node) => !node.referenceOnly,
  );
  for (const expected of expectedSellOwned) {
    if (documents.get(expected.id)?.appName !== sourceAppId) {
      throw new Error(
        `Reviewed Sell node is not owned by the source ontology: ${expected.title}`,
      );
    }
  }
  return {
    reviewedNodeCount: expectedIds.size,
    reviewedEdgeCount: expectedEdges.size,
    reviewedSellOwnedNodeCount: expectedSellOwned.length,
  };
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

async function readOntology(db, appId) {
  const snapshot = await db
    .collection("nodes")
    .where("appName", "==", appId)
    .get();
  return new Map(
    snapshot.docs.map((document) => [
      document.id,
      { ...document.data(), id: document.id },
    ]),
  );
}

async function readDocumentsByIds(db, ids) {
  const documents = new Map();
  const uniqueIds = [...new Set(ids)].filter(Boolean);
  for (let offset = 0; offset < uniqueIds.length; offset += 250) {
    const references = uniqueIds
      .slice(offset, offset + 250)
      .map((id) => db.collection("nodes").doc(id));
    const snapshots = await db.getAll(...references);
    for (const snapshot of snapshots) {
      if (snapshot.exists) {
        documents.set(snapshot.id, { ...snapshot.data(), id: snapshot.id });
      }
    }
  }
  return documents;
}

function filterCollections(collections, allowedIds) {
  return (collections || [])
    .map((collection) => ({
      ...collection,
      nodes: (collection.nodes || []).filter((link) =>
        allowedIds.has(linkId(link)),
      ),
    }))
    .filter((collection) => collection.nodes.length > 0);
}

function cloneAndApplySemantic(sourceDocuments, plan) {
  const targetAppId = plan.targetOntology.appId;
  const sourceAppId = plan.sourceOntology.appId;
  const idMap = new Map(
    [...sourceDocuments.keys()].map((sourceId) => [
      sourceId,
      deterministicNodeId(targetAppId, sourceId),
    ]),
  );
  if (new Set(idMap.values()).size !== idMap.size) {
    throw new Error("Deterministic semantic clone IDs contain a collision");
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

  const acceptedMoves = [
    ...(plan.acceptedWholeNodeMoves || []),
    plan.splitEvidenceMove,
  ];
  const moveResults = [];
  for (const move of acceptedMoves) {
    const targetNode = targetDocuments.get(idMap.get(move.sourceNodeId));
    const currentParent = targetDocuments.get(idMap.get(move.currentParentId));
    const targetParent = targetDocuments.get(idMap.get(move.targetParentId));
    if (!targetNode || !currentParent || !targetParent) {
      throw new Error(
        `Semantic move references a missing clone: ${move.nodeTitle}`,
      );
    }
    removeReciprocalEdge(currentParent, targetNode);
    addReciprocalEdge(targetDocuments, targetParent, targetNode, "main");
    const includedEvidenceIds = (
      sourceDocuments.get(move.sourceNodeId)?.specializations || []
    )
      .flatMap((collection) => collection.nodes || [])
      .map(linkId)
      .filter((id) => sourceDocuments.has(id));
    if (move === plan.splitEvidenceMove) {
      const expectedEvidenceIds = new Set([
        ...move.providerEvidenceIds,
        ...move.buyerEvidenceIdsKeptInOriginalBranch,
      ]);
      if (!sameStringSet(expectedEvidenceIds, new Set(includedEvidenceIds))) {
        throw new Error(
          "Rent Equipment evidence changed since the reviewed correction",
        );
      }
      for (const buyerEvidenceId of move.buyerEvidenceIdsKeptInOriginalBranch) {
        const buyerEvidence = targetDocuments.get(idMap.get(buyerEvidenceId));
        if (!buyerEvidence) {
          throw new Error(`Buyer-side evidence is missing: ${buyerEvidenceId}`);
        }
        removeReciprocalEdge(targetNode, buyerEvidence);
        addReciprocalEdge(
          targetDocuments,
          currentParent,
          buyerEvidence,
          "main",
        );
      }
    }
    moveResults.push({
      proposalId: move.proposalId,
      sourceNodeId: move.sourceNodeId,
      targetNodeId: targetNode.id,
      nodeTitle: targetNode.title,
      targetParentId: targetParent.id,
      targetParentTitle: targetParent.title,
      evidenceIdsIncludedUnderMovedNode:
        move === plan.splitEvidenceMove
          ? move.providerEvidenceIds
          : includedEvidenceIds,
      evidenceIdsRetainedInOriginalBranch:
        move === plan.splitEvidenceMove
          ? move.buyerEvidenceIdsKeptInOriginalBranch
          : [],
      applicationMode:
        move === plan.splitEvidenceMove
          ? "move-node-and-retain-buyer-evidence-under-original-parent"
          : "move-whole-reviewed-node",
    });
  }

  const specializationResults = [];
  for (const specialization of plan.evidenceSpecializations || []) {
    const task = targetDocuments.get(idMap.get(specialization.sourceTaskId));
    const genericParent = targetDocuments.get(
      idMap.get(specialization.genericParentId),
    );
    if (!task || !genericParent) {
      throw new Error(
        `Specialization ${specialization.proposalId} references a missing clone`,
      );
    }
    let target;
    if (specialization.targetStatus === "existing") {
      target = activeNodeByTitle(targetDocuments, specialization.targetTitle);
    } else {
      const targetParent = activeNodeByTitle(
        targetDocuments,
        specialization.targetParentTitle,
      );
      target = newActivityNode({
        nodes: targetDocuments,
        targetAppId,
        title: specialization.targetTitle,
        description: specialization.description,
        seed: specialization.proposalId,
      });
      addReciprocalEdge(targetDocuments, targetParent, target, "main");
    }
    if (!hasDirectLink(target.specializations, task.id)) {
      addReciprocalEdge(targetDocuments, target, task, "main");
    }
    if (hasDirectLink(genericParent.specializations, task.id)) {
      removeReciprocalEdge(genericParent, task);
    }
    specializationResults.push({
      proposalId: specialization.proposalId,
      sourceTaskId: specialization.sourceTaskId,
      targetTaskId: task.id,
      genericParentTitle: genericParent.title,
      targetNodeId: target.id,
      targetTitle: target.title,
      targetStatus: specialization.targetStatus,
    });
  }

  for (const title of plan.forbiddenActivityTitles || []) {
    if (
      [...targetDocuments.values()].some(
        (node) => node.deleted !== true && node.title === title,
      )
    ) {
      throw new Error(`Semantic application created forbidden node: ${title}`);
    }
  }
  const titleById = new Map(
    [...targetDocuments].map(([id, node]) => [id, node.title || ""]),
  );
  for (const [id, node] of targetDocuments) {
    targetDocuments.set(id, refreshLinkTitles(node, titleById));
  }
  const sellRoot = activeNodeByTitle(targetDocuments, "Sell");
  const leaseParent = targetDocuments.get(
    idMap.get(plan.splitEvidenceMove.currentParentId),
  );
  const hierarchy = synchronizeHierarchyFields(targetDocuments, [
    sellRoot.id,
    leaseParent.id,
  ]);
  const integrity = assertActiveGraphIntegrity(targetDocuments);
  const sourceOwnedCount = [...sourceDocuments.values()].filter(
    (node) => node.appName === sourceAppId,
  ).length;
  return {
    idMap,
    targetDocuments,
    report: {
      sourceNodeCount: sourceDocuments.size,
      sourceOwnedNodeCount: sourceOwnedCount,
      copiedCrossBranchNodeCount: acceptedMoves.length,
      targetNodeCount: targetDocuments.size,
      moves: moveResults,
      evidenceSpecializations: specializationResults,
      hierarchy,
      integrity,
    },
  };
}

function buildSellOutline(documents) {
  const root = activeNodeByTitle(documents, "Sell");
  const lines = [];
  const records = [];
  const visit = (node, depth, pathIds) => {
    if (pathIds.has(node.id)) {
      throw new Error(`Cycle while rendering Sell outline at ${node.title}`);
    }
    const nextPath = new Set(pathIds);
    nextPath.add(node.id);
    const evidenceCount = (node.specializations || [])
      .flatMap((collection) => collection.nodes || [])
      .map((link) => documents.get(linkId(link)))
      .filter(isOnetEvidence).length;
    lines.push(
      `${"  ".repeat(depth)}- ${node.title}${
        evidenceCount ? ` [${evidenceCount} O*NET]` : ""
      }`,
    );
    const children = [];
    for (const collection of node.specializations || []) {
      for (const link of collection.nodes || []) {
        const child = documents.get(linkId(link));
        if (!child || child.deleted === true || isOnetEvidence(child)) continue;
        children.push({
          collectionName: normalizedCollection(collection.collectionName),
          child,
        });
      }
    }
    children.sort((left, right) =>
      `${left.collectionName}\u001f${left.child.title}`.localeCompare(
        `${right.collectionName}\u001f${right.child.title}`,
        "en",
      ),
    );
    records.push({
      nodeId: node.id,
      title: node.title,
      depth,
      evidenceCount,
      children: children.map(({ collectionName, child }) => ({
        nodeId: child.id,
        title: child.title,
        collectionName,
      })),
    });
    for (const { child } of children) visit(child, depth + 1, nextPath);
  };
  visit(root, 0, new Set());
  return { lines, records, text: `${lines.join("\n")}\n` };
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

function runSelfTest() {
  const node = (id, title, appName = "source") => ({
    actionAlternatives: [],
    appName,
    deleted: false,
    generalizations: [],
    id,
    nodeType: "activity",
    oNetTask: false,
    parentIds: [],
    pathIds: [id],
    primaryParentId: "",
    properties: { description: "" },
    root: false,
    specializations: [],
    title,
  });
  const source = new Map(
    [
      node("sell", "Sell"),
      node("rent-out", "Rent out"),
      node("products", "Sell Products"),
      node("services", "Sell Services"),
      node("funeral-products", "Sell Funeral Products"),
      node("lease", "Lease (Physical Object)"),
      node("rent-equipment", "Rent Equipment"),
      { ...node("provider", "(O*Net) 1 - Rent equipment."), oNetTask: true },
      {
        ...node("buyer", "(O*Net) 4 - Purchase or rent equipment."),
        oNetTask: true,
      },
      {
        ...node("pharmacy", "(O*Net) 2 - Sell non-pharmaceutical products."),
        oNetTask: true,
      },
      {
        ...node("funeral", "(O*Net) 3 - Sell funeral products or services."),
        oNetTask: true,
      },
    ].map((item) => [item.id, item]),
  );
  addReciprocalEdge(source, source.get("sell"), source.get("rent-out"));
  addReciprocalEdge(source, source.get("sell"), source.get("products"));
  addReciprocalEdge(source, source.get("sell"), source.get("services"));
  addReciprocalEdge(
    source,
    source.get("products"),
    source.get("funeral-products"),
  );
  addReciprocalEdge(source, source.get("lease"), source.get("rent-equipment"));
  addReciprocalEdge(
    source,
    source.get("rent-equipment"),
    source.get("provider"),
  );
  addReciprocalEdge(source, source.get("rent-equipment"), source.get("buyer"));
  addReciprocalEdge(source, source.get("products"), source.get("pharmacy"));
  addReciprocalEdge(source, source.get("products"), source.get("funeral"));
  addReciprocalEdge(source, source.get("services"), source.get("funeral"));
  const plan = {
    sourceOntology: { appId: "source" },
    targetOntology: { appId: "target" },
    acceptedWholeNodeMoves: [],
    splitEvidenceMove: {
      proposalId: "split",
      sourceNodeId: "rent-equipment",
      currentParentId: "lease",
      targetParentId: "rent-out",
      providerEvidenceIds: ["provider"],
      buyerEvidenceIdsKeptInOriginalBranch: ["buyer"],
    },
    evidenceSpecializations: [
      {
        proposalId: "pharmacy",
        sourceTaskId: "pharmacy",
        genericParentId: "products",
        genericParentTitle: "Sell Products",
        targetTitle: "Sell Non-Pharmaceutical Products",
        targetStatus: "new",
        targetParentTitle: "Sell Products",
        description: "Sell products that are not pharmaceuticals.",
      },
      {
        proposalId: "funeral-products",
        sourceTaskId: "funeral",
        genericParentId: "products",
        genericParentTitle: "Sell Products",
        targetTitle: "Sell Funeral Products",
        targetStatus: "existing",
      },
      {
        proposalId: "funeral-services",
        sourceTaskId: "funeral",
        genericParentId: "services",
        genericParentTitle: "Sell Services",
        targetTitle: "Sell Funeral Services",
        targetStatus: "new",
        targetParentTitle: "Sell Services",
        description: "Sell funeral services.",
      },
    ],
    forbiddenActivityTitles: ["Sell ownership", "Sell temporary use"],
  };
  const transformed = cloneAndApplySemantic(source, plan);
  const rentEquipment = activeNodeByTitle(
    transformed.targetDocuments,
    "Rent Equipment",
  );
  const provider = activeNodeByTitle(
    transformed.targetDocuments,
    "(O*Net) 1 - Rent equipment.",
  );
  const funeral = activeNodeByTitle(
    transformed.targetDocuments,
    "(O*Net) 3 - Sell funeral products or services.",
  );
  const buyer = activeNodeByTitle(
    transformed.targetDocuments,
    "(O*Net) 4 - Purchase or rent equipment.",
  );
  const lease = activeNodeByTitle(
    transformed.targetDocuments,
    "Lease (Physical Object)",
  );
  if (
    !hasDirectLink(rentEquipment.specializations, provider.id) ||
    hasDirectLink(rentEquipment.specializations, buyer.id) ||
    !hasDirectLink(lease.specializations, buyer.id) ||
    hasDirectLink(
      activeNodeByTitle(transformed.targetDocuments, "Sell Products")
        .specializations,
      funeral.id,
    ) ||
    !hasDirectLink(
      activeNodeByTitle(transformed.targetDocuments, "Sell Funeral Services")
        .specializations,
      funeral.id,
    )
  ) {
    throw new Error("Semantic checkpoint self-test failed");
  }
  process.stdout.write("PASS: semantic checkpoint clone self-test\n");
}

async function main() {
  const args = parseArgs();
  if (args["self-test"]) {
    runSelfTest();
    return;
  }
  const planFile = path.resolve(
    args.plan ||
      path.join(DEFAULT_ARTIFACT_DIR, "semantic-application-plan.json"),
  );
  const outputFile = path.resolve(
    args.out ||
      path.join(DEFAULT_ARTIFACT_DIR, "semantic-application-audit.json"),
  );
  const outlineFile = path.resolve(
    args.outline || path.join(DEFAULT_ARTIFACT_DIR, "revised-sell-outline.txt"),
  );
  const environment = args.environment || "production";
  const apply = args.apply === true || args.apply === "true";
  const resume = args.resume === true || args.resume === "true";
  const plan = readJson(planFile);
  const validated = validateStaticPlan(plan, planFile);
  const serviceAccount = credentials(environment);
  const app = initializeApp(
    { credential: cert(serviceAccount) },
    `som-semantic-checkpoint-${environment}-${Date.now()}`,
  );
  const db = getFirestore(app);

  const ownedDocuments = await readOntology(db, plan.sourceOntology.appId);
  const reviewedDocuments = await readDocumentsByIds(
    db,
    validated.snapshot.nodes.map((node) => node.id),
  );
  const sourceGuard = new Map([...ownedDocuments, ...reviewedDocuments]);
  const liveValidation = validateLiveSnapshot(
    validated.snapshot,
    sourceGuard,
    plan.sourceOntology.appId,
  );

  const sourceDocuments = ownedDocuments;
  const sourceDigestBefore = digestDocuments(sourceGuard);
  const transformed = cloneAndApplySemantic(sourceDocuments, plan);
  const outline = buildSellOutline(transformed.targetDocuments);
  fs.mkdirSync(path.dirname(outlineFile), { recursive: true });
  fs.writeFileSync(outlineFile, outline.text, "utf8");

  const existingTarget = await readOntology(db, plan.targetOntology.appId);
  if (existingTarget.size && !resume) {
    throw new Error(
      `Target ontology already contains ${existingTarget.size} nodes; use --resume only for an exact partial write`,
    );
  }
  for (const [id, existing] of existingTarget) {
    const expected = transformed.targetDocuments.get(id);
    if (!expected || digestDocument(existing) !== digestDocument(expected)) {
      throw new Error(`Existing target node ${id} differs from this plan`);
    }
  }
  const documentsToWrite = new Map(
    [...transformed.targetDocuments].filter(([id]) => !existingTarget.has(id)),
  );
  const audit = {
    schemaVersion: "som-semantic-application-audit-v1",
    generatedAt: new Date().toISOString(),
    mode: apply ? "apply" : "dry-run",
    environment,
    firestoreProjectId: serviceAccount.projectId,
    sourceOntology: plan.sourceOntology,
    targetOntology: plan.targetOntology,
    sourceDataset: plan.sourceDataset,
    planSha256: sha256File(planFile),
    benchmarkFiles: validated.benchmarkFiles.map((benchmark) => ({
      file: benchmark.file,
      issueType: benchmark.issueType,
      sha256: benchmark.sha256,
    })),
    liveValidation,
    sourceDigestBefore,
    expectedTargetDigest: digestDocuments(transformed.targetDocuments),
    existingTargetNodeCount: existingTarget.size,
    nodesRemainingToWrite: documentsToWrite.size,
    resume,
    buyerEvidenceIdsRetainedInOriginalBranch:
      plan.splitEvidenceMove.buyerEvidenceIdsKeptInOriginalBranch,
    outlineFile: path.relative(REPO_ROOT, outlineFile),
    outlineNodeCount: outline.records.length,
    ...transformed.report,
  };

  if (apply) {
    await writeOntology(db, documentsToWrite);
    const [sourceAfter, targetAfter] = await Promise.all([
      readDocumentsByIds(db, [...sourceGuard.keys()]),
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
      buyerEvidenceRetainedInTarget:
        plan.splitEvidenceMove.buyerEvidenceIdsKeptInOriginalBranch.every(
          (id) => targetAfter.has(idMapTarget(plan.targetOntology.appId, id)),
        ),
    };
    if (!Object.values(audit.verification).every(Boolean)) {
      writeJson(outputFile, audit);
      throw new Error(`Post-write verification failed; inspect ${outputFile}`);
    }
  }
  writeJson(outputFile, audit);
  process.stdout.write(
    `${apply ? "Applied" : "Dry-run validated"}: ` +
      `${audit.moves.length} cross-branch moves and ` +
      `${audit.evidenceSpecializations.length} evidence specializations; ` +
      `${audit.sourceNodeCount} source nodes -> ${audit.targetNodeCount} target nodes.\n` +
      `${outputFile}\n${outlineFile}\n`,
  );
}

function idMapTarget(targetAppId, sourceId) {
  return deterministicNodeId(targetAppId, sourceId);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_FILE) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.stack || error.message : error,
    );
    process.exitCode = 1;
  });
}

export {
  buildSellOutline,
  cloneAndApplySemantic,
  validateLiveSnapshot,
  validateStaticPlan,
};
