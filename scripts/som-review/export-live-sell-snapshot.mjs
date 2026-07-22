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

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const REFERENCE_TITLES = new Set(["Advertise", "Persuade", "Provide service"]);

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

function credentials(environment) {
  const prefix = environment === "development" ? "DEV" : "PROD";
  const privateKey = required(
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
    privateKey: privateKey.trim().replace(/\\n/g, "\n"),
  };
}

function linkId(link) {
  return typeof link === "string" ? link : link?.id || "";
}

function normalizeCollection(value = "") {
  const unwrapped = String(value).trim().replace(/^\[/, "").replace(/\]$/, "");
  return !unwrapped || unwrapped === "default" ? "main" : unwrapped;
}

function edgeKey(edge) {
  return `${edge.parentId}\u001f${edge.collectionName}\u001f${edge.childId}`;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function isOnetEvidence(node) {
  return Boolean(
    node &&
      (node.oNet === true ||
        node.oNetTask ||
        /^\(O\*Net\)\s+[^-]+\s*-\s*/i.test(String(node.title || ""))),
  );
}

async function main() {
  loadEnvConfig(REPO_ROOT);
  const args = parseArgs();
  const environment = args.environment || "production";
  const ontologyAppId = required(args["app-id"], "--app-id");
  const ontologyName = required(args["ontology-name"], "--ontology-name");
  const outputFile = path.resolve(required(args.out, "--out"));
  const capturedAt = args["captured-at"] || new Date().toISOString();
  const serviceAccount = credentials(environment);
  const app = initializeApp(
    { credential: cert(serviceAccount) },
    `som-sell-snapshot-${environment}-${Date.now()}`,
  );
  const db = getFirestore(app);
  const result = await db
    .collection("nodes")
    .where("appName", "==", ontologyAppId)
    .where("deleted", "==", false)
    .select(
      "title",
      "specializations",
      "generalizations",
      "properties.description",
      "synsets",
      "actionAlternatives",
      "oNet",
      "oNetTask",
    )
    .get();
  const allNodes = new Map(
    result.docs.map((document) => [
      document.id,
      { id: document.id, ...document.data() },
    ]),
  );
  const sellRoots = [...allNodes.values()].filter((node) => node.title === "Sell");
  if (sellRoots.length !== 1) {
    throw new Error(`Expected one active Sell root, found ${sellRoots.length}`);
  }

  const sellRoot = sellRoots[0];
  const descendantIds = new Set();
  const edges = [];
  const queue = [sellRoot.id];
  while (queue.length) {
    const parentId = queue.shift();
    if (!parentId || descendantIds.has(parentId)) continue;
    descendantIds.add(parentId);
    const parent = allNodes.get(parentId);
    for (const collection of parent?.specializations || []) {
      for (const link of collection.nodes || []) {
        const childId = linkId(link);
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

  const referenceIds = [...allNodes.values()]
    .filter((node) => REFERENCE_TITLES.has(String(node.title || "").trim()))
    .map((node) => node.id)
    .filter((id) => !descendantIds.has(id));
  const evidenceParentIds = new Set();
  for (const descendantId of descendantIds) {
    const evidence = allNodes.get(descendantId);
    if (!isOnetEvidence(evidence)) continue;
    for (const collection of evidence.generalizations || []) {
      for (const link of collection.nodes || []) {
        const parentId = linkId(link);
        if (!parentId || descendantIds.has(parentId) || !allNodes.has(parentId)) {
          continue;
        }
        evidenceParentIds.add(parentId);
        edges.push({
          parentId,
          childId: evidence.id,
          collectionName: normalizeCollection(collection.collectionName),
        });
      }
    }
  }
  const allReferenceIds = [
    ...new Set([...referenceIds, ...evidenceParentIds]),
  ];
  const nodes = [...descendantIds, ...allReferenceIds]
    .map((id) => {
      const node = allNodes.get(id);
      return {
        id,
        title: String(node?.title || "").trim(),
        description: String(node?.properties?.description || "").trim(),
        synsets: String(node?.synsets || "").trim(),
        actionAlternatives: Array.isArray(node?.actionAlternatives)
          ? node.actionAlternatives.map(String).filter(Boolean).sort()
          : [],
        oNet: node?.oNet === true,
        oNetTask: node?.oNetTask || null,
        ...(allReferenceIds.includes(id) ? { referenceOnly: true } : {}),
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
  const uniqueEdges = [
    ...new Map(edges.map((edge) => [edgeKey(edge), edge])).values(),
  ];
  const snapshot = {
    schemaVersion: "som-ontology-snapshot-v1",
    ontologyAppId,
    ontologyName,
    firestoreProjectId: serviceAccount.projectId,
    environment,
    capturedAt,
    sellRootNodeId: sellRoot.id,
    nodes,
    edges: uniqueEdges.sort((left, right) => edgeKey(left).localeCompare(edgeKey(right))),
  };
  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, serialized, "utf8");
  process.stdout.write(
    `PASS: ${nodes.length} Sell/reference nodes, ${uniqueEdges.length} edges, sha256 ${sha256(serialized)}\n${outputFile}\n`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
