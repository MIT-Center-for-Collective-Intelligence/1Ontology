#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
const { cert, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const DEFAULT_ARTIFACT_DIR = path.join(
  REPO_ROOT,
  "artifacts",
  "rob-content-review-2026-07-24",
);

function parseArgs(argv = process.argv) {
  const values = {};
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const [name, inlineValue] = arg.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      values[name] = inlineValue;
    } else if (argv[index + 1] && !argv[index + 1].startsWith("--")) {
      values[name] = argv[++index];
    } else {
      values[name] = true;
    }
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

function isPlainObject(value) {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneAndRemap(value, idMap) {
  if (typeof value === "string") return idMap.get(value) || value;
  if (Array.isArray(value)) {
    return value.map((item) => cloneAndRemap(item, idMap));
  }
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      idMap.get(key) || key,
      cloneAndRemap(nested, idMap),
    ]),
  );
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  if (typeof value.toDate === "function") {
    return { $timestamp: value.toDate().toISOString() };
  }
  if (!isPlainObject(value)) return String(value);
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])]),
  );
}

function digestDocuments(documents) {
  return sha256(
    JSON.stringify(
      [...documents.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([id, data]) => [id, stableValue(data)]),
    ),
  );
}

function digestDocument(value) {
  return sha256(JSON.stringify(stableValue(value)));
}

function deterministicNodeId(targetAppId, sourceId) {
  return sha256(`${targetAppId}\u001f${sourceId}`).slice(0, 28);
}

function linkId(link) {
  return typeof link === "string" ? link : link?.id || "";
}

function linkWithIdentity(template, id, title) {
  if (typeof template === "string") return { id, title };
  return { ...template, id, title };
}

function isOnetEvidence(node) {
  const title = String(node?.title || "").trim();
  return (
    node?.oNet === true ||
    Boolean(node?.oNetTask) ||
    /^\(O\*Net\)\s+[^-]+\s*-\s*/i.test(title)
  );
}

function normalizedSynonym(value) {
  return String(value || "")
    .trim()
    .replace(/\.[a-z]+\.\d+$/i, "")
    .replace(/_/g, " ")
    .toLocaleLowerCase("en");
}

function descriptionSynonymParts(description) {
  const match = String(description || "").match(
    /(^|\s)(Synonyms?:\s*)([^.;]+)([.;]?)/i,
  );
  if (!match || match.index === undefined) return null;
  const values = match[3]
    .split(/,|\bor\b/i)
    .map((value) => value.trim())
    .filter(Boolean);
  return {
    index: match.index,
    full: match[0],
    leading: match[1],
    label: match[2],
    values,
    punctuation: match[4],
  };
}

function allRecordedSynonyms(node) {
  const values = new Set();
  for (const value of node?.actionAlternatives || []) {
    if (String(value).trim()) values.add(String(value).trim());
  }
  for (const value of String(node?.synsets || "").split(",")) {
    const raw = value.trim();
    if (!raw) continue;
    values.add(raw.replace(/\.[a-z]+\.\d+$/i, "").replace(/_/g, " "));
  }
  const description = descriptionSynonymParts(node?.properties?.description);
  for (const value of description?.values || []) values.add(value);
  return [...values].sort((left, right) => left.localeCompare(right, "en"));
}

function removeRecordedSynonyms(node, removals) {
  const removalKeys = new Set(removals.map(normalizedSynonym));
  node.actionAlternatives = (node.actionAlternatives || []).filter(
    (value) => !removalKeys.has(normalizedSynonym(value)),
  );
  node.synsets = String(node.synsets || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => !removalKeys.has(normalizedSynonym(value)))
    .join(", ");

  const description = String(node?.properties?.description || "");
  const parts = descriptionSynonymParts(description);
  if (!parts) return;
  const remaining = parts.values.filter(
    (value) => !removalKeys.has(normalizedSynonym(value)),
  );
  const replacement = remaining.length
    ? `${parts.leading}${parts.label}${remaining.join(", ")}${parts.punctuation}`
    : "";
  node.properties = {
    ...(node.properties || {}),
    description:
      `${description.slice(0, parts.index)}${replacement}${description.slice(
        parts.index + parts.full.length,
      )}`
        .replace(/\s+([.;,])/g, "$1")
        .replace(/\s{2,}/g, " ")
        .trim(),
  };
}

function appendActionAlternative(node, value) {
  const alternatives = new Map(
    (node.actionAlternatives || []).map((item) => [
      normalizedSynonym(item),
      String(item).trim(),
    ]),
  );
  alternatives.set(normalizedSynonym(value), value);
  node.actionAlternatives = [...alternatives.values()].sort((left, right) =>
    left.localeCompare(right, "en"),
  );
}

function collectionKey(value) {
  return String(value || "main").trim() || "main";
}

function addLinksToCollections(collections, additions) {
  const byCollection = new Map(
    (collections || []).map((collection) => [
      collectionKey(collection.collectionName),
      {
        ...collection,
        collectionName: collectionKey(collection.collectionName),
        nodes: [...(collection.nodes || [])],
      },
    ]),
  );
  for (const addition of additions || []) {
    const key = collectionKey(addition.collectionName);
    const target = byCollection.get(key) || {
      collectionName: key,
      nodes: [],
    };
    const seen = new Set(target.nodes.map(linkId));
    for (const link of addition.nodes || []) {
      const id = linkId(link);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      target.nodes.push(link);
    }
    byCollection.set(key, target);
  }
  return [...byCollection.values()];
}

function removeLinkFromCollections(collections, removedId) {
  return (collections || []).map((collection) => ({
    ...collection,
    nodes: (collection.nodes || []).filter(
      (link) => linkId(link) !== removedId,
    ),
  }));
}

function replaceLinkInCollections(
  collections,
  removedId,
  replacementId,
  replacementTitle,
) {
  return (collections || []).map((collection) => {
    const nodes = [];
    const seen = new Set();
    for (const link of collection.nodes || []) {
      const currentId = linkId(link);
      const id = currentId === removedId ? replacementId : currentId;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      nodes.push(
        currentId === removedId
          ? linkWithIdentity(link, replacementId, replacementTitle)
          : link,
      );
    }
    return { ...collection, nodes };
  });
}

function refreshLinkTitles(value, titleById) {
  if (Array.isArray(value)) {
    return value.map((item) => refreshLinkTitles(item, titleById));
  }
  if (!isPlainObject(value)) return value;
  const next = Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      refreshLinkTitles(nested, titleById),
    ]),
  );
  if (
    typeof next.id === "string" &&
    Object.hasOwn(next, "title") &&
    titleById.has(next.id)
  ) {
    next.title = titleById.get(next.id);
  }
  return next;
}

function mergeNodes(nodes, merge, idMap) {
  const canonicalId = idMap.get(merge.canonicalNodeId);
  const absorbedId = idMap.get(merge.absorbedNodeId);
  const canonical = nodes.get(canonicalId);
  const absorbed = nodes.get(absorbedId);
  if (!canonical || !absorbed) {
    throw new Error(`Merge ${merge.actionProposalId} references missing nodes`);
  }
  if (canonical.deleted === true || absorbed.deleted === true) {
    throw new Error(`Merge ${merge.actionProposalId} references deleted nodes`);
  }
  if (
    canonical.title !== merge.canonicalTitle ||
    absorbed.title !== merge.absorbedTitle
  ) {
    throw new Error(
      `Merge ${merge.actionProposalId} title does not match its source nodes`,
    );
  }
  const movedDirectChildCount = (absorbed.specializations || []).reduce(
    (total, collection) => total + (collection.nodes || []).length,
    0,
  );

  canonical.specializations = addLinksToCollections(
    canonical.specializations,
    absorbed.specializations,
  );
  if (merge.absorbedBecomesSynonym !== false) {
    appendActionAlternative(canonical, merge.absorbedTitle);
  }

  for (const [id, node] of nodes) {
    if (id === absorbedId) continue;
    node.specializations = removeLinkFromCollections(
      node.specializations,
      absorbedId,
    );
    node.generalizations = replaceLinkInCollections(
      node.generalizations,
      absorbedId,
      canonicalId,
      canonical.title,
    );
  }

  absorbed.deleted = true;
  absorbed.generalizations = [];
  absorbed.specializations = [];

  return {
    actionProposalId: merge.actionProposalId,
    diagnosisProposalId: merge.diagnosisProposalId,
    canonicalSourceNodeId: merge.canonicalNodeId,
    canonicalTargetNodeId: canonicalId,
    canonicalTitle: canonical.title,
    absorbedSourceNodeId: merge.absorbedNodeId,
    absorbedTargetNodeId: absorbedId,
    absorbedTitle: absorbed.title,
    movedDirectChildCount,
  };
}

function assertActiveGraphIntegrity(nodes) {
  const active = new Map(
    [...nodes].filter(([, node]) => node.deleted !== true),
  );
  const deletedIds = new Set(
    [...nodes].filter(([, node]) => node.deleted === true).map(([id]) => id),
  );
  const titleOwners = new Map();
  for (const [id, node] of active) {
    const title = String(node.title || "").trim();
    if (!title) throw new Error(`Active node ${id} has no title`);
    const owners = titleOwners.get(title) || [];
    owners.push(id);
    titleOwners.set(title, owners);
  }
  const duplicates = [...titleOwners].filter(([, ids]) => ids.length > 1);
  if (duplicates.length) {
    throw new Error(
      `Active clone has duplicate titles: ${duplicates
        .map(([title]) => title)
        .join(", ")}`,
    );
  }

  let checkedEdges = 0;
  for (const [parentId, parent] of active) {
    for (const collection of parent.specializations || []) {
      for (const childLink of collection.nodes || []) {
        const childId = linkId(childLink);
        if (deletedIds.has(childId)) {
          throw new Error(`${parent.title} still references a deleted child`);
        }
        const child = active.get(childId);
        if (!child) continue;
        const reciprocal = (child.generalizations || []).some((group) =>
          (group.nodes || []).some((link) => linkId(link) === parentId),
        );
        if (!reciprocal) {
          throw new Error(
            `Missing reciprocal generalization for ${parent.title} -> ${child.title}`,
          );
        }
        checkedEdges += 1;
      }
    }
  }
  for (const [childId, child] of active) {
    for (const collection of child.generalizations || []) {
      for (const parentLink of collection.nodes || []) {
        const parentId = linkId(parentLink);
        if (deletedIds.has(parentId)) {
          throw new Error(`${child.title} still references a deleted parent`);
        }
        const parent = active.get(parentId);
        if (!parent) continue;
        const reciprocal = (parent.specializations || []).some((group) =>
          (group.nodes || []).some((link) => linkId(link) === childId),
        );
        if (!reciprocal) {
          throw new Error(
            `Missing reciprocal specialization for ${parent.title} -> ${child.title}`,
          );
        }
      }
    }
  }
  return {
    activeNodeCount: active.size,
    deletedNodeCount: deletedIds.size,
    checkedReciprocalEdgeCount: checkedEdges,
  };
}

function validatePlan(plan, planFile) {
  const datasetDir = path.resolve(REPO_ROOT, plan.sourceDataset.directory);
  const manifestFile = path.join(datasetDir, "manifest.json");
  const manifest = readJson(manifestFile);
  if (manifest.datasetVersion !== plan.sourceDataset.version) {
    throw new Error("Application plan source dataset version is stale");
  }
  if (sha256File(manifestFile) !== plan.sourceDataset.manifestSha256) {
    throw new Error("Application plan source manifest SHA-256 is stale");
  }
  const proposals = new Map(
    readJsonl(path.join(datasetDir, "all_proposals.jsonl")).map((proposal) => [
      proposal.proposalId,
      proposal,
    ]),
  );
  const judgments = new Map();
  const benchmarkFiles = [];
  for (const benchmark of plan.benchmarks) {
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
    for (const judgment of payload.judgments || []) {
      judgments.set(judgment.proposalId, judgment);
    }
    benchmarkFiles.push({ ...benchmark, absolutePath: file });
  }

  const requireDecision = (proposalId, decision) => {
    const judgment = judgments.get(proposalId);
    if (!judgment || judgment.decision !== decision) {
      throw new Error(`${proposalId} is not recorded as ${decision}`);
    }
    return judgment;
  };
  for (const edit of plan.metadataEdits) {
    requireDecision(edit.diagnosisProposalId, "agree");
    const proposal = proposals.get(edit.diagnosisProposalId);
    const context = proposal?.reviewerView?.context;
    if (
      context?.type !== "metadata-edit" ||
      proposal.provenance?.subjectNodeId !== edit.sourceNodeId ||
      context.nodeTitle !== edit.nodeTitle
    ) {
      throw new Error(
        `Metadata edit ${edit.diagnosisProposalId} does not match its proposal`,
      );
    }
    const proposed = new Set(
      (context.proposedValues || []).map(normalizedSynonym),
    );
    if (edit.remove.some((value) => proposed.has(normalizedSynonym(value)))) {
      throw new Error(
        `Metadata edit ${edit.diagnosisProposalId} retains a planned removal`,
      );
    }
  }
  for (const merge of plan.merges) {
    requireDecision(merge.diagnosisProposalId, "agree");
    requireDecision(merge.actionProposalId, "agree");
    const action = proposals.get(merge.actionProposalId);
    const context = action?.reviewerView?.context;
    if (
      context?.type !== "merge-action" ||
      action.workflow?.dependsOnProposalIds?.[0] !==
        merge.diagnosisProposalId ||
      context.canonicalTitle !== merge.canonicalTitle ||
      context.absorbedTitle !== merge.absorbedTitle ||
      action.provenance?.subjectNodeId !== merge.absorbedNodeId
    ) {
      throw new Error(
        `Merge ${merge.actionProposalId} does not match its approved proposal`,
      );
    }
    if (
      !(action.provenance?.referencedNodeIds || []).includes(
        merge.canonicalNodeId,
      )
    ) {
      throw new Error(
        `Merge ${merge.actionProposalId} omits the planned canonical node`,
      );
    }
  }
  for (const correction of plan.regenerateFromExpertCorrection) {
    const judgment = requireDecision(correction.proposalId, "disagree");
    if (judgment.suggestedCorrection !== correction.suggestedCorrection) {
      throw new Error(
        `Correction ${correction.proposalId} does not match Rob's text`,
      );
    }
  }
  return { datasetDir, manifest, proposals, judgments, benchmarkFiles };
}

function cloneAndApply(sourceDocuments, plan) {
  const sourceAppId = plan.sourceOntology.appId;
  const targetAppId = plan.targetOntology.appId;
  if (!targetAppId || targetAppId === sourceAppId) {
    throw new Error("Target ontology must use a distinct app ID");
  }
  const idMap = new Map(
    [...sourceDocuments.keys()].map((sourceId) => [
      sourceId,
      deterministicNodeId(targetAppId, sourceId),
    ]),
  );
  if (new Set(idMap.values()).size !== idMap.size) {
    throw new Error("Deterministic clone IDs contain a collision");
  }
  const targetDocuments = new Map();
  for (const [sourceId, source] of sourceDocuments) {
    if (source.appName !== sourceAppId && !isOnetEvidence(source)) {
      throw new Error(
        `Source closure node ${sourceId} is not owned or O*NET evidence`,
      );
    }
    const targetId = idMap.get(sourceId);
    targetDocuments.set(targetId, {
      ...cloneAndRemap(source, idMap),
      id: targetId,
      appName: targetAppId,
    });
  }

  const metadataResults = [];
  for (const edit of plan.metadataEdits) {
    const targetNodeId = idMap.get(edit.sourceNodeId);
    const node = targetDocuments.get(targetNodeId);
    if (!node || node.deleted === true) {
      throw new Error(`Missing metadata source ${edit.sourceNodeId}`);
    }
    if (node.title !== edit.nodeTitle) {
      throw new Error(
        `Metadata source ${edit.sourceNodeId} expected ${edit.nodeTitle}`,
      );
    }
    const before = allRecordedSynonyms(node);
    removeRecordedSynonyms(node, edit.remove);
    const after = allRecordedSynonyms(node);
    for (const value of edit.remove) {
      if (
        after.some(
          (item) => normalizedSynonym(item) === normalizedSynonym(value),
        )
      ) {
        throw new Error(`Failed to remove ${value} from ${edit.nodeTitle}`);
      }
    }
    metadataResults.push({
      diagnosisProposalId: edit.diagnosisProposalId,
      sourceNodeId: edit.sourceNodeId,
      targetNodeId,
      nodeTitle: edit.nodeTitle,
      removed: edit.remove,
      before,
      after,
    });
  }

  const mergeResults = plan.merges.map((merge) =>
    mergeNodes(targetDocuments, merge, idMap),
  );
  const titleById = new Map(
    [...targetDocuments].map(([id, node]) => [id, node.title || ""]),
  );
  for (const [id, node] of targetDocuments) {
    targetDocuments.set(id, refreshLinkTitles(node, titleById));
  }
  const integrity = assertActiveGraphIntegrity(targetDocuments);

  return {
    idMap,
    targetDocuments,
    report: {
      sourceNodeCount: sourceDocuments.size,
      targetNodeCount: targetDocuments.size,
      metadataEdits: metadataResults,
      merges: mergeResults,
      pendingExpertCorrections: plan.regenerateFromExpertCorrection,
      integrity,
    },
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
  for (let offset = 0; offset < ids.length; offset += 250) {
    const references = ids
      .slice(offset, offset + 250)
      .map((id) => db.collection("nodes").doc(id));
    if (!references.length) continue;
    const snapshots = await db.getAll(...references);
    for (const snapshot of snapshots) {
      if (snapshot.exists) {
        documents.set(snapshot.id, { ...snapshot.data(), id: snapshot.id });
      }
    }
  }
  return documents;
}

async function readSourceClosure(db, appId) {
  const ownedDocuments = await readOntology(db, appId);
  const linkedIds = new Set();
  for (const node of ownedDocuments.values()) {
    for (const collection of node.specializations || []) {
      for (const link of collection.nodes || []) {
        const id = linkId(link);
        if (id && !ownedDocuments.has(id)) linkedIds.add(id);
      }
    }
  }
  const linkedDocuments = await readDocumentsByIds(db, [...linkedIds]);
  const evidenceDocuments = new Map(
    [...linkedDocuments].filter(([, node]) => isOnetEvidence(node)),
  );
  return {
    documents: new Map([...ownedDocuments, ...evidenceDocuments]),
    ownedNodeCount: ownedDocuments.size,
    evidenceNodeCount: evidenceDocuments.size,
    unresolvedDirectReferenceIds: [...linkedIds]
      .filter((id) => !linkedDocuments.has(id))
      .sort(),
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

function runSelfTest() {
  const source = new Map([
    [
      "parent",
      {
        id: "parent",
        appName: "source",
        title: "Sell",
        deleted: false,
        generalizations: [],
        specializations: [
          {
            collectionName: "main",
            nodes: [
              { id: "canonical", title: "Sell Cosmetics" },
              { id: "absorbed", title: "Sell Makeup" },
            ],
          },
        ],
      },
    ],
    [
      "canonical",
      {
        id: "canonical",
        appName: "source",
        title: "Sell Cosmetics",
        deleted: false,
        actionAlternatives: [],
        generalizations: [
          {
            collectionName: "main",
            nodes: [{ id: "parent", title: "Sell" }],
          },
        ],
        specializations: [
          {
            collectionName: "main",
            nodes: [{ id: "task-a", title: "(O*Net) A - Cosmetics" }],
          },
        ],
      },
    ],
    [
      "absorbed",
      {
        id: "absorbed",
        appName: "source",
        title: "Sell Makeup",
        deleted: false,
        generalizations: [
          {
            collectionName: "main",
            nodes: [{ id: "parent", title: "Sell" }],
          },
        ],
        specializations: [
          {
            collectionName: "main",
            nodes: [{ id: "task-b", title: "(O*Net) B - Makeup" }],
          },
        ],
      },
    ],
    ...["task-a", "task-b"].map((id) => [
      id,
      {
        id,
        appName: "source",
        title: id === "task-a" ? "(O*Net) A - Cosmetics" : "(O*Net) B - Makeup",
        deleted: false,
        generalizations: [
          {
            collectionName: "main",
            nodes: [
              {
                id: id === "task-a" ? "canonical" : "absorbed",
                title: id === "task-a" ? "Sell Cosmetics" : "Sell Makeup",
              },
            ],
          },
        ],
        specializations: [],
      },
    ]),
    [
      "sell",
      {
        id: "sell",
        appName: "source",
        title: "Metadata Sell",
        deleted: false,
        actionAlternatives: [],
        synsets: "Market.v.01, Sell.v.01",
        properties: { description: "Definition. Synonyms: Market, Sell" },
        generalizations: [],
        specializations: [],
      },
    ],
  ]);
  const plan = {
    sourceOntology: { appId: "source" },
    targetOntology: { appId: "target" },
    metadataEdits: [
      {
        diagnosisProposalId: "metadata",
        sourceNodeId: "sell",
        nodeTitle: "Metadata Sell",
        remove: ["Market"],
      },
    ],
    merges: [
      {
        diagnosisProposalId: "diagnosis",
        actionProposalId: "action",
        canonicalNodeId: "canonical",
        canonicalTitle: "Sell Cosmetics",
        absorbedNodeId: "absorbed",
        absorbedTitle: "Sell Makeup",
        absorbedBecomesSynonym: true,
      },
    ],
    regenerateFromExpertCorrection: [],
  };
  const result = cloneAndApply(source, plan);
  const canonicalId = result.idMap.get("canonical");
  const absorbedId = result.idMap.get("absorbed");
  const sellId = result.idMap.get("sell");
  const canonical = result.targetDocuments.get(canonicalId);
  const absorbed = result.targetDocuments.get(absorbedId);
  const sell = result.targetDocuments.get(sellId);
  if (
    absorbed.deleted !== true ||
    !canonical.actionAlternatives.includes("Sell Makeup") ||
    canonical.specializations[0].nodes.length !== 2 ||
    allRecordedSynonyms(sell).some(
      (value) => normalizedSynonym(value) === "market",
    )
  ) {
    throw new Error("Content application self-test failed");
  }
  process.stdout.write("PASS: content clone and application self-test\n");
}

async function main() {
  const args = parseArgs();
  if (args["self-test"]) {
    runSelfTest();
    return;
  }
  loadEnvConfig(REPO_ROOT);
  const planFile = path.resolve(
    args.plan ||
      path.join(DEFAULT_ARTIFACT_DIR, "content-application-plan.json"),
  );
  const outputFile = path.resolve(
    args.out ||
      path.join(DEFAULT_ARTIFACT_DIR, "content-application-audit.json"),
  );
  const environment = args.environment || "production";
  const apply = args.apply === true || args.apply === "true";
  const resume = args.resume === true || args.resume === "true";
  const plan = readJson(planFile);
  const validated = validatePlan(plan, planFile);

  const serviceAccount = credentials(environment);
  const app = initializeApp(
    { credential: cert(serviceAccount) },
    `som-content-clone-${environment}-${Date.now()}`,
  );
  const db = getFirestore(app);
  const sourceClosure = await readSourceClosure(db, plan.sourceOntology.appId);
  if (!sourceClosure.documents.size) {
    throw new Error("Source ontology contains no nodes");
  }
  const sourceDigestBefore = digestDocuments(sourceClosure.documents);
  const transformed = cloneAndApply(sourceClosure.documents, plan);
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
    schemaVersion: "som-content-application-audit-v1",
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
    sourceDigestBefore,
    expectedTargetDigest: digestDocuments(transformed.targetDocuments),
    ownedSourceNodeCount: sourceClosure.ownedNodeCount,
    clonedOnetEvidenceNodeCount: sourceClosure.evidenceNodeCount,
    unresolvedDirectReferenceCount:
      sourceClosure.unresolvedDirectReferenceIds.length,
    unresolvedDirectReferenceSample:
      sourceClosure.unresolvedDirectReferenceIds.slice(0, 25),
    existingTargetNodeCount: existingTarget.size,
    nodesRemainingToWrite: documentsToWrite.size,
    resume,
    ...transformed.report,
  };

  if (apply) {
    await writeOntology(db, documentsToWrite);
    const [sourceAfter, targetAfter] = await Promise.all([
      readDocumentsByIds(db, [...sourceClosure.documents.keys()]),
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
      throw new Error(`Post-write verification failed; inspect ${outputFile}`);
    }
  }
  writeJson(outputFile, audit);
  process.stdout.write(
    `${apply ? "Applied" : "Dry-run validated"}: ` +
      `${audit.metadataEdits.length} metadata edits and ${audit.merges.length} merges; ` +
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

export {
  allRecordedSynonyms,
  cloneAndApply,
  deterministicNodeId,
  digestDocuments,
  removeRecordedSynonyms,
};
