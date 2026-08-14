#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { digestDocuments } from "./clone-and-apply-structure-review.mjs";

const require = createRequire(import.meta.url);
require("../load-env.cjs");
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const defaultAppId =
  "final-hierarchy-with-o*net-rob-structure-applied-2026-07-25";
const defaultAuditFile = path.join(
  repoRoot,
  "artifacts",
  "rob-structure-review-2026-07-25",
  "collection-design-node-repair-2026-08-02.json",
);
const expectedIds = {
  sell: "9c347b3345120c1df2554b834c13",
  ownership: "2dfe6a4a3194a23d73d3681eb844",
  temporaryUse: "bc3a0d85a3dcd1e3ea729857acc3",
  rentOut: "df319ef0372ddc12e45ccbd4b4b0",
};

const parseArgs = () => {
  const args = {};
  for (let index = 2; index < process.argv.length; index += 1) {
    const raw = process.argv[index];
    if (!raw.startsWith("--")) continue;
    const [key, inline] = raw.slice(2).split("=", 2);
    args[key] =
      inline ??
      (process.argv[index + 1] && !process.argv[index + 1].startsWith("--")
        ? process.argv[++index]
        : true);
  }
  return args;
};

const required = (value, label) => {
  if (!value) throw new Error(`${label} is required`);
  return value;
};

const linkId = (link) => (typeof link === "string" ? link : link?.id || "");
const clone = (value) => structuredClone(value);
const collectionName = (collection) =>
  String(collection?.collectionName || "main").trim() || "main";
const directIds = (collections) =>
  (collections || []).flatMap((collection) =>
    (collection.nodes || []).map(linkId).filter(Boolean),
  );
const hasDirectLink = (collections, nodeId) =>
  directIds(collections).includes(nodeId);
const removeLinks = (collections, removedIds) =>
  (collections || []).map((collection) => ({
    ...collection,
    nodes: (collection.nodes || []).filter(
      (link) => !removedIds.has(linkId(link)),
    ),
  }));
const addLink = (collections, name, link) => {
  const result = clone(collections || []);
  let target = result.find((collection) => collectionName(collection) === name);
  if (!target) {
    target = { collectionName: name, nodes: [] };
    result.push(target);
  }
  if (!target.nodes.some((candidate) => linkId(candidate) === link.id)) {
    target.nodes.push(link);
  }
  return result;
};

const describeStructure = (documents) => {
  const sell = documents.get(expectedIds.sell);
  const ownership = documents.get(expectedIds.ownership);
  const temporaryUse = documents.get(expectedIds.temporaryUse);
  const rentOut = documents.get(expectedIds.rentOut);
  return {
    sellChildren: (sell.specializations || []).map((collection) => ({
      collectionName: collectionName(collection),
      nodeIds: (collection.nodes || []).map(linkId),
    })),
    ownershipDeleted: ownership.deleted === true,
    ownershipChildren: directIds(ownership.specializations),
    temporaryUseDeleted: temporaryUse.deleted === true,
    temporaryUseChildren: directIds(temporaryUse.specializations),
    rentOutParents: directIds(rentOut.generalizations),
  };
};

const assertIdentity = (documents, appId) => {
  const expected = [
    [expectedIds.sell, "Sell"],
    [expectedIds.ownership, "Sell ownership"],
    [expectedIds.temporaryUse, "Sell temporary use"],
    [expectedIds.rentOut, "Rent out"],
  ];
  for (const [id, title] of expected) {
    const node = documents.get(id);
    if (
      !node ||
      node.id !== id ||
      node.title !== title ||
      node.appName !== appId
    ) {
      throw new Error(`Unexpected repair target for ${title} (${id})`);
    }
  }
};

const isCorrected = (documents) => {
  const sell = documents.get(expectedIds.sell);
  const ownership = documents.get(expectedIds.ownership);
  const temporaryUse = documents.get(expectedIds.temporaryUse);
  const rentOut = documents.get(expectedIds.rentOut);
  return (
    ownership.deleted === true &&
    temporaryUse.deleted === true &&
    hasDirectLink(sell.specializations, rentOut.id) &&
    !hasDirectLink(sell.specializations, ownership.id) &&
    !hasDirectLink(sell.specializations, temporaryUse.id) &&
    hasDirectLink(rentOut.generalizations, sell.id) &&
    !hasDirectLink(rentOut.generalizations, temporaryUse.id)
  );
};

const repairDocuments = (source, appId) => {
  const documents = new Map(
    [...source].map(([id, value]) => [id, clone(value)]),
  );
  assertIdentity(documents, appId);
  if (isCorrected(documents)) return documents;

  const sell = documents.get(expectedIds.sell);
  const ownership = documents.get(expectedIds.ownership);
  const temporaryUse = documents.get(expectedIds.temporaryUse);
  const rentOut = documents.get(expectedIds.rentOut);
  if (
    ownership.deleted === true ||
    temporaryUse.deleted === true ||
    !hasDirectLink(sell.specializations, ownership.id) ||
    !hasDirectLink(sell.specializations, temporaryUse.id) ||
    hasDirectLink(sell.specializations, rentOut.id) ||
    directIds(ownership.specializations).length !== 0 ||
    JSON.stringify(directIds(temporaryUse.specializations)) !==
      JSON.stringify([rentOut.id]) ||
    !hasDirectLink(rentOut.generalizations, temporaryUse.id)
  ) {
    throw new Error(
      "Live structure no longer matches the narrowly audited collection-node defect",
    );
  }

  const wrapperIds = new Set([ownership.id, temporaryUse.id]);
  sell.specializations = removeLinks(sell.specializations, wrapperIds).filter(
    (collection) =>
      !(
        collectionName(collection) === "Sell what kind of usage?" &&
        (collection.nodes || []).length === 0
      ),
  );
  sell.specializations = addLink(sell.specializations, "main", {
    id: rentOut.id,
    title: rentOut.title,
  });

  rentOut.generalizations = removeLinks(
    rentOut.generalizations,
    new Set([temporaryUse.id]),
  );
  rentOut.generalizations = addLink(rentOut.generalizations, "main", {
    id: sell.id,
    title: sell.title,
  });
  rentOut.parentIds = [sell.id];
  rentOut.primaryParentId = sell.id;
  rentOut.pathIds = [...(sell.pathIds || [sell.id]), rentOut.id];
  rentOut.root = false;
  rentOut.inheritedPartsDetails = [];

  for (const wrapper of [ownership, temporaryUse]) {
    wrapper.deleted = true;
    wrapper.generalizations = [];
    wrapper.specializations = [];
    wrapper.parentIds = [];
    wrapper.primaryParentId = "";
    wrapper.pathIds = [wrapper.id];
    wrapper.inheritedPartsDetails = [];
    wrapper.root = false;
  }
  return documents;
};

const credentials = (environment) => {
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
};

const readDocuments = async (db) => {
  const references = Object.values(expectedIds).map((id) =>
    db.collection("nodes").doc(id),
  );
  const snapshots = await db.getAll(...references);
  return new Map(
    snapshots.map((snapshot) => [
      snapshot.id,
      { ...snapshot.data(), id: snapshot.id },
    ]),
  );
};

const writeAudit = (file, audit) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
};

const main = async () => {
  const args = parseArgs();
  const environment = String(args.environment || "production");
  const appId = String(args["app-id"] || defaultAppId);
  if (appId !== defaultAppId) {
    throw new Error(
      `This one-time repair is pinned to ${defaultAppId}; received ${appId}`,
    );
  }
  const apply = args.apply === true || args.apply === "true";
  const outputFile = path.resolve(args.output || defaultAuditFile);
  const serviceAccount = credentials(environment);
  const firebaseApp = initializeApp(
    { credential: cert(serviceAccount) },
    `som-collection-node-repair-${environment}-${Date.now()}`,
  );
  const db = getFirestore(firebaseApp);
  const before = await readDocuments(db);
  assertIdentity(before, appId);
  const alreadyCorrected = isCorrected(before);
  const expected = repairDocuments(before, appId);
  const audit = {
    schemaVersion: "som-collection-node-repair-v1",
    generatedAt: new Date().toISOString(),
    mode: apply ? "apply" : "dry-run",
    environment,
    firestoreProjectId: serviceAccount.projectId,
    ontologyAppId: appId,
    invalidProposalId: "som-f0464db076534dd0bde0",
    reason:
      "The collection-design contract incorrectly allowed new activity branches, and the application materialized them as ontology nodes.",
    alreadyCorrected,
    beforeDigest: digestDocuments(before),
    expectedAfterDigest: digestDocuments(expected),
    before: describeStructure(before),
    expectedAfter: describeStructure(expected),
    correction: {
      retiredSyntheticNodes: [
        { id: expectedIds.ownership, title: "Sell ownership" },
        { id: expectedIds.temporaryUse, title: "Sell temporary use" },
      ],
      restoredRelation: {
        parentId: expectedIds.sell,
        parentTitle: "Sell",
        childId: expectedIds.rentOut,
        childTitle: "Rent out",
        collectionName: "main",
      },
      removedCollectionLabel: "Sell what kind of usage?",
    },
  };

  if (apply && !alreadyCorrected) {
    const batch = db.batch();
    for (const [id, node] of expected) {
      const { id: _id, ...data } = node;
      batch.set(db.collection("nodes").doc(id), data);
    }
    await batch.commit();
  }

  const after = apply ? await readDocuments(db) : before;
  audit.actualAfterDigest = digestDocuments(after);
  audit.after = describeStructure(after);
  audit.verification = {
    expectedStateReached: apply
      ? audit.actualAfterDigest === audit.expectedAfterDigest
      : true,
    wrappersRetired: apply
      ? after.get(expectedIds.ownership).deleted === true &&
        after.get(expectedIds.temporaryUse).deleted === true
      : true,
    rentOutRestoredDirectlyUnderSell: apply
      ? hasDirectLink(
          after.get(expectedIds.sell).specializations,
          expectedIds.rentOut,
        ) &&
        hasDirectLink(
          after.get(expectedIds.rentOut).generalizations,
          expectedIds.sell,
        )
      : true,
  };
  writeAudit(outputFile, audit);
  if (!Object.values(audit.verification).every(Boolean)) {
    throw new Error(`Post-repair verification failed; inspect ${outputFile}`);
  }
  process.stdout.write(
    `${apply ? "Applied" : "Dry-run validated"} collection-node repair: ${outputFile}\n`,
  );
};

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.stack || error.message : error,
    );
    process.exitCode = 1;
  });
}

export { repairDocuments };
