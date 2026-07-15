#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
const { cert, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const ONTOLOGY_APP_ID = "final-hierarchy-with-o*net";
const ONTOLOGY_NAME = "Final Hierarchy with O*Net";
const SNAPSHOT_SCHEMA_VERSION = "som-ontology-snapshot-v1";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");

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
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSON at ${file}:${index + 1}`);
      }
    });
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeJsonl(file, values) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    values.map((value) => JSON.stringify(value)).join("\n") +
      (values.length ? "\n" : ""),
    "utf8",
  );
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeCollection(value = "") {
  const unwrapped = String(value).trim().replace(/^\[/, "").replace(/\]$/, "");
  return !unwrapped || unwrapped === "default" ? "main" : unwrapped;
}

function isCollectionLabel(value) {
  return /^\[[^\]]+\]$/.test(String(value).trim());
}

function edgeKey(parentId, childId, collectionName = "main") {
  return `${parentId}\u001f${normalizeCollection(collectionName)}\u001f${childId}`;
}

function credentials(environment) {
  const prefix = environment === "development" ? "DEV" : "PROD";
  const key = required(
    process.env[`${prefix}_ONTOLOGY_CRED_PRIVATE_KEY`],
    `${prefix}_ONTOLOGY_CRED_PRIVATE_KEY`,
  );
  return {
    projectId: required(
      process.env[`${prefix}_ONTOLOGY_CRED_PROJECT_ID`],
      `${prefix}_ONTOLOGY_CRED_PROJECT_ID`,
    ),
    clientEmail: required(
      process.env[`${prefix}_ONTOLOGY_CRED_CLIENT_EMAIL`],
      `${prefix}_ONTOLOGY_CRED_CLIENT_EMAIL`,
    ),
    privateKey: key.trim().replace(/\\n/g, "\n"),
  };
}

async function loadLiveSnapshot(environment, capturedAt) {
  const serviceAccount = credentials(environment);
  const app = initializeApp(
    { credential: cert(serviceAccount) },
    `som-sell-sync-${environment}-${Date.now()}`,
  );
  const db = getFirestore(app);
  const result = await db
    .collection("nodes")
    .where("appName", "==", ONTOLOGY_APP_ID)
    .where("deleted", "==", false)
    .select("title", "specializations")
    .get();
  const allNodes = new Map(
    result.docs.map((doc) => [doc.id, { id: doc.id, ...doc.data() }]),
  );
  const sellNodes = [...allNodes.values()].filter(
    (node) => node.title === "Sell",
  );
  if (sellNodes.length !== 1) {
    throw new Error(`Expected one live Sell node, found ${sellNodes.length}`);
  }

  const sellRoot = sellNodes[0];
  const descendants = new Set();
  const edges = [];
  const queue = [sellRoot.id];
  while (queue.length) {
    const parentId = queue.shift();
    if (!parentId || descendants.has(parentId)) continue;
    descendants.add(parentId);
    const parent = allNodes.get(parentId);
    for (const collection of parent?.specializations || []) {
      for (const reference of collection.nodes || []) {
        const childId =
          typeof reference === "string" ? reference : reference.id;
        if (!childId || !allNodes.has(childId)) continue;
        edges.push({
          parentId,
          childId,
          collectionName: normalizeCollection(collection.collectionName),
        });
        queue.push(childId);
      }
    }
  }

  const nodes = [...descendants]
    .map((id) => ({ id, title: String(allNodes.get(id)?.title || "").trim() }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const duplicateTitles = nodes
    .filter(
      (node, index) =>
        nodes.findIndex((candidate) => candidate.title === node.title) !==
        index,
    )
    .map((node) => node.title);
  if (duplicateTitles.length) {
    throw new Error(
      `Sell subtree has ambiguous titles: ${[...new Set(duplicateTitles)].join(", ")}`,
    );
  }

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    ontologyAppId: ONTOLOGY_APP_ID,
    ontologyName: ONTOLOGY_NAME,
    firestoreProjectId: serviceAccount.projectId,
    environment,
    capturedAt,
    sellRootNodeId: sellRoot.id,
    nodes,
    edges: edges.sort((left, right) =>
      edgeKey(left.parentId, left.childId, left.collectionName).localeCompare(
        edgeKey(right.parentId, right.childId, right.collectionName),
      ),
    ),
  };
}

function buildIndex(snapshot) {
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const idByTitle = new Map(
    snapshot.nodes.map((node) => [node.title, node.id]),
  );
  const edgeKeys = new Set(
    snapshot.edges.map((edge) =>
      edgeKey(edge.parentId, edge.childId, edge.collectionName),
    ),
  );
  const edgePairs = new Set(
    snapshot.edges.map((edge) => `${edge.parentId}\u001f${edge.childId}`),
  );
  const childrenByParent = new Map();
  for (const edge of snapshot.edges) {
    const children = childrenByParent.get(edge.parentId) || new Set();
    children.add(edge.childId);
    childrenByParent.set(edge.parentId, children);
  }
  return { nodesById, idByTitle, edgeKeys, edgePairs, childrenByParent };
}

function currentChildTitles(index, parentId) {
  return [...(index.childrenByParent.get(parentId) || [])]
    .map((childId) => index.nodesById.get(childId)?.title || "")
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, "en"));
}

function resolveTitle(index, title) {
  const id = index.idByTitle.get(title);
  if (!id) throw new Error(`Current ontology node does not exist: ${title}`);
  return id;
}

function requireEdge(index, parentId, childId, collectionName = "main") {
  if (!index.edgeKeys.has(edgeKey(parentId, childId, collectionName))) {
    const parent = index.nodesById.get(parentId)?.title || parentId;
    const child = index.nodesById.get(childId)?.title || childId;
    throw new Error(
      `Current ontology relation does not exist: ${parent} [${normalizeCollection(
        collectionName,
      )}] -> ${child}`,
    );
  }
}

function requireAnyEdge(index, parentId, childId) {
  if (!index.edgePairs.has(`${parentId}\u001f${childId}`)) {
    const parent = index.nodesById.get(parentId)?.title || parentId;
    const child = index.nodesById.get(childId)?.title || childId;
    throw new Error(
      `Current ontology relation does not exist: ${parent} -> ${child}`,
    );
  }
}

function validatePath(index, sourcePath) {
  if (!Array.isArray(sourcePath)) return;
  const sellIndex = sourcePath.findIndex((part) => part === "Sell");
  const parts = sourcePath.slice(Math.max(0, sellIndex));
  let parentId = "";
  let collectionName = "main";
  for (const part of parts) {
    if (typeof part !== "string" || !part.trim()) continue;
    if (isCollectionLabel(part)) {
      collectionName = normalizeCollection(part);
      continue;
    }
    const nodeId = index.idByTitle.get(part);
    if (!nodeId) continue;
    if (parentId && parentId !== nodeId) {
      requireEdge(index, parentId, nodeId, collectionName);
    }
    parentId = nodeId;
    collectionName = "main";
  }
}

function sourceParent(index, record) {
  const parentTitle = String(record?.subject?.parentTitle || "");
  if (!parentTitle) return { id: "", collectionName: "main" };
  if (!isCollectionLabel(parentTitle)) {
    return { id: resolveTitle(index, parentTitle), collectionName: "main" };
  }
  const sourcePath = Array.isArray(record?.subject?.path)
    ? record.subject.path
    : [];
  const collectionIndex = sourcePath.lastIndexOf(parentTitle);
  for (
    let indexOfPart = collectionIndex - 1;
    indexOfPart >= 0;
    indexOfPart -= 1
  ) {
    const candidate = sourcePath[indexOfPart];
    if (typeof candidate === "string" && !isCollectionLabel(candidate)) {
      return {
        id: resolveTitle(index, candidate),
        collectionName: normalizeCollection(parentTitle),
      };
    }
  }
  throw new Error(`Cannot resolve collection parent from path: ${parentTitle}`);
}

function deriveSourceRefs(record, index, snapshotHash) {
  const context = record?.reviewerView?.context;
  if (!context?.type) throw new Error("Proposal is missing reviewer context");
  validatePath(index, record?.subject?.path);
  const referenced = new Set();
  const addTitle = (title) => {
    const id = resolveTitle(index, title);
    referenced.add(id);
    return id;
  };
  const addDirectChild = (parentTitle, childTitle, collectionName = "main") => {
    const parentId = addTitle(parentTitle);
    const childId = addTitle(childTitle);
    requireEdge(index, parentId, childId, collectionName);
    return { parentId, childId };
  };
  let subjectNodeId = "";
  let parentNodeId = "";

  switch (context.type) {
    case "title-comparison": {
      subjectNodeId = addTitle(context.currentTitle);
      const parent = sourceParent(index, record);
      parentNodeId = parent.id;
      if (parentNodeId) {
        referenced.add(parentNodeId);
        requireEdge(index, parentNodeId, subjectNodeId, parent.collectionName);
      }
      break;
    }
    case "grouping-outline": {
      if (index.idByTitle.has(context.proposedGroupTitle)) {
        throw new Error(
          `Proposed grouping already exists: ${context.proposedGroupTitle}`,
        );
      }
      parentNodeId = addTitle(context.parentTitle);
      for (const title of [
        ...(context.proposedChildren || []),
        ...(context.unaffectedChildren || []),
      ]) {
        const childId = addTitle(title);
        requireEdge(index, parentNodeId, childId);
      }
      break;
    }
    case "flat-list": {
      parentNodeId = addTitle(context.parentTitle);
      for (const title of context.currentChildren || []) {
        const childId = addTitle(title);
        requireEdge(index, parentNodeId, childId);
      }
      break;
    }
    case "duplicate-comparison": {
      const first = addDirectChild(context.parentTitle, context.canonicalTitle);
      addDirectChild(context.parentTitle, context.candidateSynonymTitle);
      parentNodeId = first.parentId;
      subjectNodeId = first.childId;
      break;
    }
    case "placement-comparison": {
      parentNodeId = addTitle(context.currentParentTitle);
      subjectNodeId = addTitle(context.nodeTitle);
      requireAnyEdge(index, parentNodeId, subjectNodeId);
      if (context.candidateHome && index.idByTitle.has(context.candidateHome)) {
        addTitle(context.candidateHome);
      }
      break;
    }
    case "overlap-comparison": {
      const first = addDirectChild(
        context.parentTitle,
        context.firstTitle,
        context.firstCollection,
      );
      addDirectChild(
        context.parentTitle,
        context.secondTitle,
        context.secondCollection,
      );
      parentNodeId = first.parentId;
      subjectNodeId = first.childId;
      break;
    }
    case "merge-action": {
      parentNodeId = addTitle(context.parentTitle);
      const canonicalId = addTitle(context.canonicalTitle);
      const absorbedId = addTitle(context.absorbedTitle);
      requireEdge(
        index,
        parentNodeId,
        canonicalId,
        context.canonicalCollection,
      );
      requireEdge(index, parentNodeId, absorbedId, context.absorbedCollection);
      const canonicalChildren = [...(context.canonicalChildren || [])].sort(
        (left, right) => left.localeCompare(right, "en"),
      );
      const absorbedChildren = [...(context.absorbedChildren || [])].sort(
        (left, right) => left.localeCompare(right, "en"),
      );
      if (
        JSON.stringify(canonicalChildren) !==
        JSON.stringify(currentChildTitles(index, canonicalId))
      ) {
        throw new Error(
          `Merge proposal for ${context.canonicalTitle} does not list every current direct child`,
        );
      }
      if (
        JSON.stringify(absorbedChildren) !==
        JSON.stringify(currentChildTitles(index, absorbedId))
      ) {
        throw new Error(
          `Merge proposal for ${context.absorbedTitle} does not list every current direct child`,
        );
      }
      for (const title of context.canonicalChildren || []) {
        const childId = addTitle(title);
        requireAnyEdge(index, canonicalId, childId);
      }
      for (const title of context.absorbedChildren || []) {
        const childId = addTitle(title);
        requireAnyEdge(index, absorbedId, childId);
      }
      const expectedChildren = [
        ...new Set([...canonicalChildren, ...absorbedChildren]),
      ].sort((left, right) => left.localeCompare(right, "en"));
      const resultingChildren = [...(context.resultingChildren || [])].sort(
        (left, right) => left.localeCompare(right, "en"),
      );
      if (
        JSON.stringify(resultingChildren) !== JSON.stringify(expectedChildren)
      ) {
        throw new Error(
          `Merge result for ${context.canonicalTitle} does not match the current child union`,
        );
      }
      subjectNodeId = absorbedId;
      break;
    }
    case "relocation-action": {
      parentNodeId = addTitle(context.currentParentTitle);
      const proposedParentId = addTitle(context.proposedParentTitle);
      subjectNodeId = addTitle(context.nodeTitle);
      requireEdge(
        index,
        parentNodeId,
        subjectNodeId,
        context.currentCollection,
      );
      if (
        index.edgeKeys.has(
          edgeKey(proposedParentId, subjectNodeId, context.proposedCollection),
        )
      ) {
        throw new Error(
          `Proposed relocation already exists: ${context.proposedParentTitle} -> ${context.nodeTitle}`,
        );
      }
      for (const title of context.childTitles || []) {
        const childId = addTitle(title);
        requireAnyEdge(index, subjectNodeId, childId);
      }
      break;
    }
    case "addition-action": {
      parentNodeId = addTitle(context.parentTitle);
      if (index.idByTitle.has(context.proposedTitle)) {
        throw new Error(
          `Proposed missing activity already exists: ${context.proposedTitle}`,
        );
      }
      break;
    }
    case "merge-up-action": {
      parentNodeId = addTitle(context.parentTitle);
      subjectNodeId = addTitle(context.nodeTitle);
      requireEdge(index, parentNodeId, subjectNodeId, context.parentCollection);
      for (const title of context.childTitles || []) {
        const childId = addTitle(title);
        requireAnyEdge(index, subjectNodeId, childId);
      }
      break;
    }
    default:
      throw new Error(`Unsupported proposal context type: ${context.type}`);
  }

  return {
    sourceOntologyAppId: ONTOLOGY_APP_ID,
    sourceOntologyName: ONTOLOGY_NAME,
    sourceSnapshotSha256: snapshotHash,
    subjectNodeId,
    parentNodeId,
    referencedNodeIds: [...referenced].sort(),
  };
}

function canonicalizeKnownTitleAnnotations(record, index) {
  const aliases = new Map();
  const inspect = (value) => {
    if (typeof value === "string") {
      const match = value.match(/^(.+?)\s+[—-]\s+Synonyms?:\s+.+$/i);
      if (match && index.idByTitle.has(match[1].trim())) {
        aliases.set(value, match[1].trim());
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(inspect);
      return;
    }
    if (value && typeof value === "object") {
      Object.values(value).forEach(inspect);
    }
  };
  inspect(record);
  if (!aliases.size) return { record, aliases: [] };

  const rewrite = (value) => {
    if (typeof value === "string") {
      let next = value;
      for (const [alias, canonical] of aliases) {
        next = next.split(alias).join(canonical);
      }
      return next;
    }
    if (Array.isArray(value)) return value.map(rewrite);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, rewrite(child)]),
      );
    }
    return value;
  };
  return { record: rewrite(record), aliases: [...aliases.entries()] };
}

function clarifyReviewerView(record) {
  const context = record?.reviewerView?.context;
  if (context?.type === "grouping-outline") {
    return {
      ...record,
      reviewerView: {
        ...record.reviewerView,
        question: `Should the new grouping "${context.proposedGroupTitle}" be created under "${context.parentTitle}" with the highlighted children under it?`,
      },
    };
  }
  if (context?.type === "duplicate-comparison") {
    const canonicalTitle = String(context.canonicalTitle || "").trim();
    const candidateSynonymTitle = String(
      context.candidateSynonymTitle || "",
    ).trim();
    return {
      ...record,
      reviewerView: {
        ...record.reviewerView,
        question:
          'Do "' +
          canonicalTitle +
          '" and "' +
          candidateSynonymTitle +
          '" name the same activity?',
        proposedState:
          'Record "' +
          candidateSynonymTitle +
          '" as a synonym of "' +
          canonicalTitle +
          '".',
      },
    };
  }
  if (context?.type !== "placement-comparison") return record;

  const nodeTitle = String(context.nodeTitle || "").trim();
  const currentParentTitle = String(context.currentParentTitle || "").trim();
  const currentBucket = String(context.currentBucket || "").trim();
  return {
    ...record,
    reviewerView: {
      ...record.reviewerView,
      question: `Is "${nodeTitle}" misplaced under "${currentParentTitle}"?`,
      currentState: `"${nodeTitle}" is currently under "${currentParentTitle}"${
        currentBucket ? ` in the "${currentBucket}" category` : ""
      }.`,
      proposedState:
        context.placementIssue === "wrong-verb"
          ? `"${nodeTitle}" is not a kind of selling and does not belong under "${currentParentTitle}".`
          : `"${nodeTitle}" does not belong under "${currentParentTitle}".`,
      agreeLabel:
        context.placementIssue === "wrong-verb"
          ? "Yes, different action"
          : "Yes, misplaced",
      disagreeLabel:
        context.placementIssue === "wrong-verb"
          ? "No, it belongs under Sell"
          : "No, keep here",
    },
  };
}

function extendProposalSchema(directory) {
  const file = path.join(directory, "schema", "review-proposal.schema.json");
  const schema = readJson(file);
  const proposal = schema.definitions.SocietyOfMindReviewProposal;
  const provenance = proposal.properties.provenance;
  const nonEmptyString = {
    $ref: "#/definitions/SocietyOfMindReviewProposal/properties/datasetVersion",
  };
  Object.assign(provenance.properties, {
    sourceOntologyAppId: nonEmptyString,
    sourceOntologyName: nonEmptyString,
    sourceSnapshotSha256: nonEmptyString,
    subjectNodeId: { type: "string" },
    parentNodeId: { type: "string" },
    referencedNodeIds: {
      type: "array",
      items: nonEmptyString,
      uniqueItems: true,
    },
  });
  for (const field of [
    "sourceOntologyAppId",
    "sourceOntologyName",
    "sourceSnapshotSha256",
    "subjectNodeId",
    "parentNodeId",
    "referencedNodeIds",
  ]) {
    if (!provenance.required.includes(field)) provenance.required.push(field);
  }
  writeJson(file, schema);
}

async function main() {
  loadEnvConfig(REPO_ROOT);
  const args = parseArgs();
  const inputDir = path.resolve(required(args["input-dir"], "--input-dir"));
  const outputDir = path.resolve(required(args["output-dir"], "--output-dir"));
  const environment = args.environment || "production";
  if (!new Set(["development", "production"]).has(environment)) {
    throw new Error("--environment must be development or production");
  }
  const capturedAt = args["captured-at"] || new Date().toISOString();
  if (!fs.existsSync(path.join(inputDir, "manifest.json"))) {
    throw new Error(`Input dataset is missing manifest.json: ${inputDir}`);
  }
  if (inputDir !== outputDir) {
    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.cpSync(inputDir, outputDir, { recursive: true });
  }

  const snapshot = await loadLiveSnapshot(environment, capturedAt);
  const snapshotText = `${JSON.stringify(snapshot, null, 2)}\n`;
  const snapshotHash = sha256(snapshotText);
  fs.writeFileSync(
    path.join(outputDir, "ontology-snapshot.json"),
    snapshotText,
    "utf8",
  );
  const index = buildIndex(snapshot);
  const manifest = readJson(path.join(outputDir, "manifest.json"));
  const canonicalizedAliases = [];
  const transform = (record) => {
    const canonicalized = canonicalizeKnownTitleAnnotations(record, index);
    record = clarifyReviewerView(canonicalized.record);
    canonicalizedAliases.push(...canonicalized.aliases);
    let refs;
    try {
      refs = deriveSourceRefs(record, index, snapshotHash);
    } catch (error) {
      throw new Error(
        `${record.proposalId || "<unknown>"}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return {
      ...record,
      provenance: {
        ...record.provenance,
        sourceOntology: `firestore://${snapshot.firestoreProjectId}/${ONTOLOGY_APP_ID}`,
        sourceOntologySha256: snapshotHash,
        sourceArtifact: `society-of-mind://sell/${path.basename(
          record.provenance.sourceArtifact,
        )}`,
        ...refs,
      },
    };
  };

  const proposals = readJsonl(path.join(outputDir, "all_proposals.jsonl")).map(
    transform,
  );
  const controls = readJsonl(path.join(outputDir, "all_controls.jsonl")).map(
    transform,
  );
  const manualChecks = readJsonl(
    path.join(outputDir, "manual_checks.jsonl"),
  ).map(transform);
  writeJsonl(path.join(outputDir, "all_proposals.jsonl"), proposals);
  writeJsonl(path.join(outputDir, "all_controls.jsonl"), controls);
  writeJsonl(path.join(outputDir, "manual_checks.jsonl"), manualChecks);

  for (const issue of manifest.issueTypes || []) {
    const issueProposals = proposals.filter(
      (record) => record.issueType === issue.id,
    );
    const issueControls = controls.filter(
      (record) => record.issueType === issue.id,
    );
    writeJsonl(
      path.join(outputDir, "proposals", `${issue.id}.jsonl`),
      issueProposals,
    );
    writeJsonl(
      path.join(outputDir, "controls", `${issue.id}.jsonl`),
      issueControls,
    );
    issue.proposals = issueProposals.length;
    issue.controls = issueControls.length;
  }

  manifest.generatedAt = capturedAt;
  manifest.sourceOntology = `firestore://${snapshot.firestoreProjectId}/${ONTOLOGY_APP_ID}`;
  manifest.sourceOntologySha256 = snapshotHash;
  manifest.sourceSnapshot = {
    file: "ontology-snapshot.json",
    sha256: snapshotHash,
    ontologyAppId: ONTOLOGY_APP_ID,
    ontologyName: ONTOLOGY_NAME,
    environment,
    capturedAt,
    sellRootNodeId: snapshot.sellRootNodeId,
    nodeCount: snapshot.nodes.length,
    edgeCount: snapshot.edges.length,
  };
  manifest.files.ontologySnapshot = "ontology-snapshot.json";
  manifest.counts.proposals = proposals.length;
  manifest.counts.controls = controls.length;
  manifest.counts.manualChecks = manualChecks.length;
  writeJson(path.join(outputDir, "manifest.json"), manifest);
  extendProposalSchema(outputDir);

  process.stdout.write(
    `PASS: ${proposals.length + controls.length + manualChecks.length} records validated against ` +
      `${snapshot.nodes.length} live Sell nodes and ${snapshot.edges.length} relations; ` +
      `${new Set(canonicalizedAliases.map(([alias]) => alias)).size} annotated title alias(es) canonicalized; ` +
      `${snapshotHash}\n`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
