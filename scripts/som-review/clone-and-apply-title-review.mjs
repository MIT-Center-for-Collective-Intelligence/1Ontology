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
const DEFAULT_ARTIFACT_DIR = path.join(
  REPO_ROOT,
  "artifacts",
  "rob-title-review-2026-07-22",
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
  const normalized = [...documents.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, data]) => [id, stableValue(data)]);
  return sha256(JSON.stringify(normalized));
}

function digestDocument(value) {
  return sha256(JSON.stringify(stableValue(value)));
}

function deterministicNodeId(targetAppId, source) {
  return sha256(`${targetAppId}\u001f${source}`).slice(0, 28);
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

function canonicalTaskTitle(node) {
  return String(node?.title || "")
    .trim()
    .replace(/^\(O\*Net\)\s+[^-]+\s*-\s*/i, "");
}

function replaceCollectionLinks(collections, sourceId, replacements) {
  return (collections || []).map((collection) => {
    const nodes = [];
    const seen = new Set();
    for (const link of collection.nodes || []) {
      if (linkId(link) !== sourceId) {
        const id = linkId(link);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        nodes.push(link);
        continue;
      }
      for (const replacement of replacements) {
        if (seen.has(replacement.id)) continue;
        seen.add(replacement.id);
        nodes.push(linkWithIdentity(link, replacement.id, replacement.title));
      }
    }
    return { ...collection, nodes };
  });
}

function addSiblingToParents(nodes, sourceNode, sibling) {
  let reciprocalParentLinks = 0;
  for (const generalizationCollection of sourceNode.generalizations || []) {
    for (const parentLink of generalizationCollection.nodes || []) {
      const parentId = linkId(parentLink);
      const parent = nodes.get(parentId);
      if (!parent) continue;
      let foundSource = false;
      parent.specializations = (parent.specializations || []).map(
        (collection) => {
          const nextLinks = [];
          for (const childLink of collection.nodes || []) {
            nextLinks.push(childLink);
            if (linkId(childLink) === sourceNode.id) {
              foundSource = true;
              nextLinks.push(
                linkWithIdentity(childLink, sibling.id, sibling.title),
              );
              reciprocalParentLinks += 1;
            }
          }
          return { ...collection, nodes: nextLinks };
        },
      );
      if (!foundSource) {
        throw new Error(
          `Parent ${parentId} does not reciprocally specialize ${sourceNode.id}`,
        );
      }
    }
  }
  if (!reciprocalParentLinks) {
    throw new Error(
      `Split source ${sourceNode.id} has no reciprocal parent links`,
    );
  }
}

function directSpecializationEntries(node, nodes) {
  return (node.specializations || []).flatMap((collection) =>
    (collection.nodes || []).map((link) => {
      const id = linkId(link);
      return {
        collectionName: collection.collectionName || "main",
        id,
        link,
        node: nodes.get(id),
      };
    }),
  );
}

function addDirectSpecialization(node, entry) {
  const collectionName = entry.collectionName || "main";
  let foundCollection = false;
  node.specializations = (node.specializations || []).map((collection) => {
    if ((collection.collectionName || "main") !== collectionName) {
      return collection;
    }
    foundCollection = true;
    if ((collection.nodes || []).some((link) => linkId(link) === entry.id)) {
      return collection;
    }
    return {
      ...collection,
      nodes: [
        ...(collection.nodes || []),
        cloneAndRemap(entry.link, new Map()),
      ],
    };
  });
  if (!foundCollection) {
    node.specializations.push({
      collectionName,
      nodes: [cloneAndRemap(entry.link, new Map())],
    });
  }
}

function taskAssignments(split) {
  return [
    { ...split.retainSourceAs, outputMode: "retained" },
    ...(split.create || []).map((output) => ({
      ...output,
      outputMode: "new",
    })),
    ...(split.assignToExisting || []).map((output) => ({
      ...output,
      outputMode: "existing",
    })),
  ].map((output) => ({
    ...output,
    sourceTaskTitles: new Set(output.sourceTaskTitles),
  }));
}

function applySplit(nodes, split, targetAppId) {
  const sourceNode = nodes.get(split.targetNodeId);
  if (!sourceNode)
    throw new Error(`Missing split source ${split.sourceNodeId}`);
  if (sourceNode.title !== split.from) {
    throw new Error(
      `Split source ${split.sourceNodeId} expected title "${split.from}" but found "${sourceNode.title}"`,
    );
  }

  const outputs = taskAssignments(split);
  const declaredTaskTitles = new Set(
    outputs.flatMap((output) => [...output.sourceTaskTitles]),
  );
  const directEntries = directSpecializationEntries(sourceNode, nodes);
  const onetEntries = directEntries.filter((entry) =>
    isOnetEvidence(entry.node),
  );
  const liveTaskTitles = new Set(
    onetEntries.map((entry) => canonicalTaskTitle(entry.node)),
  );
  for (const title of declaredTaskTitles) {
    if (!liveTaskTitles.has(title)) {
      throw new Error(
        `Split ${split.from} declares source task not linked to the live node: ${title}`,
      );
    }
  }
  for (const title of liveTaskTitles) {
    if (!declaredTaskTitles.has(title)) {
      throw new Error(
        `Split ${split.from} leaves an O*NET source task unassigned: ${title}`,
      );
    }
  }

  const originalSource = cloneAndRemap(sourceNode, new Map());
  const retained = outputs[0];
  sourceNode.title = retained.title;
  sourceNode.specializations = (sourceNode.specializations || [])
    .map((collection) => ({
      ...collection,
      nodes: (collection.nodes || []).filter((link) => {
        const child = nodes.get(linkId(link));
        return (
          !isOnetEvidence(child) ||
          retained.sourceTaskTitles.has(canonicalTaskTitle(child))
        );
      }),
    }))
    .filter((collection) => collection.nodes.length > 0);

  const created = [];
  const outputNodes = new Map([[retained, sourceNode]]);
  for (const output of outputs.filter(
    (candidate) => candidate.outputMode === "new",
  )) {
    const newId = deterministicNodeId(
      targetAppId,
      `${split.sourceNodeId}\u001fsplit\u001f${output.title}`,
    );
    if (nodes.has(newId))
      throw new Error(`Generated duplicate node ID ${newId}`);
    const sibling = {
      ...cloneAndRemap(originalSource, new Map()),
      id: newId,
      title: output.title,
      appName: targetAppId,
      specializations: (originalSource.specializations || [])
        .map((collection) => ({
          ...collection,
          nodes: (collection.nodes || []).filter((link) => {
            const child = nodes.get(linkId(link));
            return (
              isOnetEvidence(child) &&
              output.sourceTaskTitles.has(canonicalTaskTitle(child))
            );
          }),
        }))
        .filter((collection) => collection.nodes.length > 0),
    };
    nodes.set(newId, sibling);
    addSiblingToParents(nodes, sourceNode, sibling);
    created.push(sibling);
    outputNodes.set(output, sibling);
  }

  const assignedExisting = [];
  for (const output of outputs.filter(
    (candidate) => candidate.outputMode === "existing",
  )) {
    const existing = nodes.get(output.targetNodeId);
    if (!existing) {
      throw new Error(
        `Split ${split.from} cannot find existing output ${output.sourceNodeId}`,
      );
    }
    if (existing.id === sourceNode.id) {
      throw new Error(`Split ${split.from} cannot assign back to its source`);
    }
    if (existing.title !== output.title) {
      throw new Error(
        `Existing split output ${output.sourceNodeId} expected "${output.title}" but found "${existing.title}"`,
      );
    }
    outputNodes.set(output, existing);
    assignedExisting.push(existing);
  }

  for (const taskEntry of onetEntries) {
    const assignedOutputs = outputs.filter((output) =>
      output.sourceTaskTitles.has(canonicalTaskTitle(taskEntry.node)),
    );
    const assignedNodes = assignedOutputs.map((output) =>
      outputNodes.get(output),
    );
    if (!assignedNodes.length) {
      throw new Error(
        `No resulting node receives task ${canonicalTaskTitle(taskEntry.node)} from ${split.from}`,
      );
    }
    for (const output of assignedOutputs) {
      if (output.outputMode === "existing") {
        addDirectSpecialization(outputNodes.get(output), taskEntry);
      }
    }
    let foundReciprocal = false;
    taskEntry.node.generalizations = (taskEntry.node.generalizations || []).map(
      (collection) => {
        const hasSource = (collection.nodes || []).some(
          (link) => linkId(link) === sourceNode.id,
        );
        if (!hasSource) return collection;
        foundReciprocal = true;
        return {
          ...collection,
          nodes: replaceCollectionLinks(
            [collection],
            sourceNode.id,
            assignedNodes,
          )[0].nodes,
        };
      },
    );
    if (!foundReciprocal) {
      throw new Error(
        `O*NET task ${taskEntry.node.id} does not reciprocally generalize to ${sourceNode.id}`,
      );
    }
  }

  return {
    sourceNodeId: split.sourceNodeId,
    retainedTargetNodeId: sourceNode.id,
    retainedTitle: sourceNode.title,
    created: created.map((node) => ({ id: node.id, title: node.title })),
    assignedExisting: assignedExisting.map((node) => ({
      id: node.id,
      title: node.title,
    })),
  };
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
  if (
    typeof next.ref === "string" &&
    Object.hasOwn(next, "title") &&
    titleById.has(next.ref)
  ) {
    next.title = titleById.get(next.ref);
  }
  if (
    typeof next.inheritedFromId === "string" &&
    Object.hasOwn(next, "inheritedFromTitle") &&
    titleById.has(next.inheritedFromId)
  ) {
    next.inheritedFromTitle = titleById.get(next.inheritedFromId);
  }
  return next;
}

function normalizedProposalSplitOutputs(proposedNodes = []) {
  return proposedNodes
    .map((output) => ({
      title: output.title,
      status: output.status || "new",
      sourceTaskTitles: [...new Set(output.sourceTasks || [])].sort(),
    }))
    .sort((left, right) => left.title.localeCompare(right.title, "en"));
}

function normalizedPlanSplitOutputs(split) {
  return [
    {
      ...split.retainSourceAs,
      status: split.retainSourceAs.status || "new",
    },
    ...(split.create || []).map((output) => ({
      ...output,
      status: output.status || "new",
    })),
    ...(split.assignToExisting || []).map((output) => ({
      ...output,
      status: "existing",
    })),
  ]
    .map((output) => ({
      title: output.title,
      status: output.status,
      sourceTaskTitles: [...new Set(output.sourceTaskTitles || [])].sort(),
    }))
    .sort((left, right) => left.title.localeCompare(right.title, "en"));
}

function validatePlanAgainstBenchmark(plan, benchmark, benchmarkFile) {
  if (sha256File(benchmarkFile) !== plan.benchmark.sha256) {
    throw new Error("Benchmark SHA-256 does not match the application plan");
  }
  if (benchmark.reviewer.label !== plan.benchmark.reviewerLabel) {
    throw new Error(
      "Application plan reviewer does not match benchmark reviewer",
    );
  }
  for (const field of ["reviewed", "agreed", "disagreed"]) {
    if (benchmark.counts[field] !== plan.benchmark[field]) {
      throw new Error(`Benchmark count mismatch for ${field}`);
    }
  }
  const judgments = new Map(
    benchmark.judgments.map((judgment) => [judgment.subjectNodeId, judgment]),
  );
  for (const rename of plan.renames) {
    const judgment = judgments.get(rename.sourceNodeId);
    if (!judgment || judgment.currentTitle !== rename.from) {
      throw new Error(`Rename ${rename.sourceNodeId} does not match benchmark`);
    }
    if (rename.decisionSource === "acceptedProposal") {
      if (
        judgment.decision !== "agree" ||
        judgment.proposedTitle !== rename.to
      ) {
        throw new Error(
          `Accepted rename ${rename.sourceNodeId} is not approved`,
        );
      }
    } else if (
      judgment.decision !== "disagree" ||
      judgment.suggestedCorrection !== rename.expertSuggestedCorrection
    ) {
      throw new Error(`Alternative rename ${rename.sourceNodeId} is not exact`);
    }
  }
  for (const split of plan.splits) {
    const judgment = judgments.get(split.sourceNodeId);
    if (!judgment || judgment.currentTitle !== split.from) {
      throw new Error(
        `Split ${split.sourceNodeId} does not match expert review`,
      );
    }
    if (split.decisionSource === "acceptedProposal") {
      if (judgment.decision !== "agree") {
        throw new Error(`Split ${split.sourceNodeId} was not approved`);
      }
      const expected = normalizedProposalSplitOutputs(judgment.proposedNodes);
      const planned = normalizedPlanSplitOutputs(split);
      if (JSON.stringify(expected) !== JSON.stringify(planned)) {
        throw new Error(
          `Split ${split.sourceNodeId} does not exactly match the approved proposal`,
        );
      }
    } else if (
      judgment.decision !== "disagree" ||
      judgment.suggestedCorrection !== split.expertSuggestedCorrection
    ) {
      throw new Error(
        `Split ${split.sourceNodeId} does not match expert review`,
      );
    }
  }
  for (const pending of plan.regenerateWithoutApplying) {
    const judgment = judgments.get(pending.sourceNodeId);
    if (
      !judgment ||
      judgment.decision !== "disagree" ||
      judgment.suggestedCorrection !== pending.expertSuggestedCorrection
    ) {
      throw new Error(
        `Pending item ${pending.sourceNodeId} does not match review`,
      );
    }
  }
}

function cloneAndTransform(sourceDocuments, plan) {
  const sourceAppId = plan.sourceOntology.appId;
  const targetAppId = plan.targetOntology.appId;
  if (!targetAppId || sourceAppId === targetAppId) {
    throw new Error("Target ontology must have a distinct nonempty app ID");
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
  for (const [sourceId, sourceData] of sourceDocuments) {
    if (sourceData.appName !== sourceAppId && !isOnetEvidence(sourceData)) {
      throw new Error(
        `Source closure node ${sourceId} is neither owned by the source ontology nor O*NET evidence`,
      );
    }
    const targetId = idMap.get(sourceId);
    targetDocuments.set(targetId, {
      ...cloneAndRemap(sourceData, idMap),
      id: targetId,
      appName: targetAppId,
    });
  }

  const titleBefore = new Map(
    [...targetDocuments].map(([id, node]) => [id, node.title || ""]),
  );
  const renameResults = [];
  for (const rename of plan.renames) {
    const targetNodeId = idMap.get(rename.sourceNodeId);
    const node = targetDocuments.get(targetNodeId);
    if (!node) throw new Error(`Missing rename source ${rename.sourceNodeId}`);
    if (node.title !== rename.from) {
      throw new Error(
        `Rename ${rename.sourceNodeId} expected "${rename.from}" but found "${node.title}"`,
      );
    }
    node.title = rename.to;
    renameResults.push({
      sourceNodeId: rename.sourceNodeId,
      targetNodeId,
      from: rename.from,
      to: rename.to,
      decisionSource: rename.decisionSource,
    });
  }

  const splitResults = [];
  for (const split of plan.splits) {
    splitResults.push(
      applySplit(
        targetDocuments,
        {
          ...split,
          targetNodeId: idMap.get(split.sourceNodeId),
          assignToExisting: (split.assignToExisting || []).map((output) => ({
            ...output,
            targetNodeId: idMap.get(output.sourceNodeId),
          })),
        },
        targetAppId,
      ),
    );
  }

  const activeTitles = new Map();
  for (const [id, node] of targetDocuments) {
    if (node.deleted === true) continue;
    const title = String(node.title || "").trim();
    if (!title) continue;
    if (!activeTitles.has(title)) activeTitles.set(title, []);
    activeTitles.get(title).push(id);
  }
  const changedTargetIds = new Set([
    ...renameResults.map((result) => result.targetNodeId),
    ...splitResults.flatMap((result) => [
      result.retainedTargetNodeId,
      ...result.created.map((node) => node.id),
      ...result.assignedExisting.map((node) => node.id),
    ]),
  ]);
  const newlyAmbiguousTitles = [...activeTitles]
    .filter(
      ([, ids]) => ids.length > 1 && ids.some((id) => changedTargetIds.has(id)),
    )
    .map(([title, ids]) => ({ title, ids }));
  if (newlyAmbiguousTitles.length) {
    throw new Error(
      `Title changes introduce duplicate active titles: ${newlyAmbiguousTitles
        .map((item) => item.title)
        .join(", ")}`,
    );
  }

  const titleById = new Map(
    [...targetDocuments].map(([id, node]) => [id, node.title || ""]),
  );
  for (const [id, node] of targetDocuments) {
    targetDocuments.set(id, refreshLinkTitles(node, titleById));
  }

  const externalReferences = new Set();
  const collectExternalReferences = (value) => {
    if (Array.isArray(value)) {
      value.forEach(collectExternalReferences);
      return;
    }
    if (!isPlainObject(value)) return;
    if (
      typeof value.id === "string" &&
      Object.hasOwn(value, "title") &&
      !targetDocuments.has(value.id)
    ) {
      externalReferences.add(value.id);
    }
    Object.values(value).forEach(collectExternalReferences);
  };
  for (const node of targetDocuments.values()) collectExternalReferences(node);

  return {
    idMap,
    targetDocuments,
    report: {
      sourceNodeCount: sourceDocuments.size,
      targetNodeCount: targetDocuments.size,
      newNodeCount: targetDocuments.size - sourceDocuments.size,
      renames: renameResults,
      splits: splitResults,
      pendingRegeneration: plan.regenerateWithoutApplying,
      externalReferenceCount: externalReferences.size,
      externalReferenceSample: [...externalReferences].sort().slice(0, 25),
      originalTitlesOfChangedNodes: [...changedTargetIds]
        .filter((id) => titleBefore.has(id))
        .map((id) => ({ id, title: titleBefore.get(id) })),
    },
  };
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
  const documents = new Map([...ownedDocuments, ...evidenceDocuments]);
  return {
    documents,
    ownedNodeCount: ownedDocuments.size,
    evidenceNodeCount: evidenceDocuments.size,
    unresolvedDirectReferenceIds: [...linkedIds]
      .filter((id) => !linkedDocuments.has(id))
      .sort(),
    nonOnetExternalReferenceIds: [...linkedDocuments]
      .filter(([, node]) => !isOnetEvidence(node))
      .map(([id]) => id)
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
        process.stderr.write(
          `Wrote ${written}/${entries.length} remaining nodes\n`,
        );
      }
    },
  );
  const results = await Promise.allSettled(workers);
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length) {
    const first = failures[0];
    if (first.status === "rejected") throw first.reason;
    throw new Error("Concurrent Firestore write failed");
  }
}

function runSelfTest() {
  const sourceAppId = "source";
  const targetAppId = "target";
  const parentId = "parent";
  const sourceId = "bicycle";
  const taskId = "task";
  const existingId = "existing";
  const existingTaskId = "existing-task";
  const sourceDocuments = new Map([
    [
      parentId,
      {
        id: parentId,
        appName: sourceAppId,
        title: "Sell",
        deleted: false,
        specializations: [
          {
            collectionName: "main",
            nodes: [
              { id: sourceId, title: "Sell Bicycle" },
              { id: existingId, title: "Sell Products" },
            ],
          },
        ],
        generalizations: [],
      },
    ],
    [
      sourceId,
      {
        id: sourceId,
        appName: sourceAppId,
        title: "Sell Bicycle",
        deleted: false,
        specializations: [
          {
            collectionName: "O*NET",
            nodes: [
              { id: taskId, title: "Sell bicycles and accessories." },
              { id: existingTaskId, title: "Sell products." },
            ],
          },
        ],
        generalizations: [
          { collectionName: "main", nodes: [{ id: parentId, title: "Sell" }] },
        ],
      },
    ],
    [
      existingId,
      {
        id: existingId,
        appName: sourceAppId,
        title: "Sell Products",
        deleted: false,
        specializations: [],
        generalizations: [
          { collectionName: "main", nodes: [{ id: parentId, title: "Sell" }] },
        ],
      },
    ],
    [
      taskId,
      {
        id: taskId,
        appName: sourceAppId,
        title: "Sell bicycles and accessories.",
        deleted: false,
        oNet: true,
        specializations: [],
        generalizations: [
          {
            collectionName: "O*NET",
            nodes: [{ id: sourceId, title: "Sell Bicycle" }],
          },
        ],
      },
    ],
    [
      existingTaskId,
      {
        id: existingTaskId,
        appName: sourceAppId,
        title: "Sell products.",
        deleted: false,
        oNet: true,
        specializations: [],
        generalizations: [
          {
            collectionName: "O*NET",
            nodes: [{ id: sourceId, title: "Sell Bicycle" }],
          },
        ],
      },
    ],
  ]);
  const plan = {
    sourceOntology: { appId: sourceAppId },
    targetOntology: { appId: targetAppId },
    renames: [],
    splits: [
      {
        sourceNodeId: sourceId,
        from: "Sell Bicycle",
        retainSourceAs: {
          title: "Sell Bicycles",
          sourceTaskTitles: ["Sell bicycles and accessories."],
        },
        create: [
          {
            title: "Sell Bicycle Accessories",
            sourceTaskTitles: ["Sell bicycles and accessories."],
          },
        ],
        assignToExisting: [
          {
            sourceNodeId: existingId,
            title: "Sell Products",
            sourceTaskTitles: ["Sell products."],
          },
        ],
      },
    ],
    regenerateWithoutApplying: [],
  };
  const result = cloneAndTransform(sourceDocuments, plan);
  if (result.targetDocuments.size !== 6 || result.report.newNodeCount !== 1) {
    throw new Error("Self-test did not create exactly one split node");
  }
  const targetSourceId = result.idMap.get(sourceId);
  const targetTaskId = result.idMap.get(taskId);
  const targetExistingId = result.idMap.get(existingId);
  const targetExistingTaskId = result.idMap.get(existingTaskId);
  const targetParentId = result.idMap.get(parentId);
  const targetSource = result.targetDocuments.get(targetSourceId);
  const targetTask = result.targetDocuments.get(targetTaskId);
  const targetExisting = result.targetDocuments.get(targetExistingId);
  const targetExistingTask = result.targetDocuments.get(targetExistingTaskId);
  const targetParent = result.targetDocuments.get(targetParentId);
  const created = result.report.splits[0].created[0];
  if (
    targetSource.title !== "Sell Bicycles" ||
    !targetSource.specializations[0].nodes.some(
      (link) => linkId(link) === targetTaskId,
    ) ||
    !targetParent.specializations[0].nodes.some(
      (link) => linkId(link) === created.id,
    ) ||
    !targetTask.generalizations[0].nodes.some(
      (link) => linkId(link) === created.id,
    ) ||
    !targetExisting.specializations[0].nodes.some(
      (link) => linkId(link) === targetExistingTaskId,
    ) ||
    !targetExistingTask.generalizations[0].nodes.some(
      (link) => linkId(link) === targetExistingId,
    ) ||
    targetExistingTask.generalizations[0].nodes.some(
      (link) => linkId(link) === targetSourceId,
    ) ||
    sourceDocuments.get(sourceId).title !== "Sell Bicycle"
  ) {
    throw new Error(
      "Self-test failed reciprocal split or source-isolation checks",
    );
  }
  process.stdout.write(
    "PASS: isolated ontology clone and split transformation\n",
  );
}

async function main() {
  const args = parseArgs();
  if (args["self-test"]) {
    runSelfTest();
    return;
  }
  loadEnvConfig(REPO_ROOT);
  const planFile = path.resolve(
    args.plan || path.join(DEFAULT_ARTIFACT_DIR, "title-application-plan.json"),
  );
  const benchmarkFile = path.resolve(
    args.benchmark ||
      path.join(DEFAULT_ARTIFACT_DIR, "rob-title-benchmark.json"),
  );
  const outputFile = path.resolve(
    args.out || path.join(DEFAULT_ARTIFACT_DIR, "title-application-audit.json"),
  );
  const environment = args.environment || "production";
  const apply = args.apply === true || args.apply === "true";
  const resume = args.resume === true || args.resume === "true";
  const plan = readJson(planFile);
  const benchmark = readJson(benchmarkFile);
  validatePlanAgainstBenchmark(plan, benchmark, benchmarkFile);

  const serviceAccount = credentials(environment);
  const app = initializeApp(
    { credential: cert(serviceAccount) },
    `som-title-clone-${environment}-${Date.now()}`,
  );
  const db = getFirestore(app);
  const sourceClosure = await readSourceClosure(db, plan.sourceOntology.appId);
  const sourceDocuments = sourceClosure.documents;
  if (!sourceDocuments.size)
    throw new Error("Source ontology contains no nodes");
  const sourceDigestBefore = digestDocuments(sourceDocuments);
  const existingTarget = await readOntology(db, plan.targetOntology.appId);
  const transformed = cloneAndTransform(sourceDocuments, plan);
  if (existingTarget.size && !resume) {
    throw new Error(
      `Target ontology already contains ${existingTarget.size} nodes; refusing to overwrite. Use --resume only for an exact partial clone from this plan.`,
    );
  }
  for (const [id, existing] of existingTarget) {
    const expected = transformed.targetDocuments.get(id);
    if (!expected) {
      throw new Error(`Existing target contains unexpected node ${id}`);
    }
    if (digestDocument(existing) !== digestDocument(expected)) {
      throw new Error(
        `Existing target node ${id} differs from this clone plan`,
      );
    }
  }
  const documentsToWrite = new Map(
    [...transformed.targetDocuments].filter(([id]) => !existingTarget.has(id)),
  );
  const audit = {
    schemaVersion: "som-title-application-audit-v1",
    generatedAt: new Date().toISOString(),
    mode: apply ? "apply" : "dry-run",
    environment,
    firestoreProjectId: serviceAccount.projectId,
    sourceOntology: plan.sourceOntology,
    targetOntology: plan.targetOntology,
    planSha256: sha256File(planFile),
    benchmarkSha256: sha256File(benchmarkFile),
    resume,
    existingTargetNodeCount: existingTarget.size,
    nodesRemainingToWrite: documentsToWrite.size,
    sourceDigestBefore,
    expectedTargetDigest: digestDocuments(transformed.targetDocuments),
    ownedSourceNodeCount: sourceClosure.ownedNodeCount,
    clonedOnetEvidenceNodeCount: sourceClosure.evidenceNodeCount,
    unresolvedDirectReferenceCount:
      sourceClosure.unresolvedDirectReferenceIds.length,
    unresolvedDirectReferenceSample:
      sourceClosure.unresolvedDirectReferenceIds.slice(0, 25),
    nonOnetExternalReferenceCount:
      sourceClosure.nonOnetExternalReferenceIds.length,
    nonOnetExternalReferenceSample:
      sourceClosure.nonOnetExternalReferenceIds.slice(0, 25),
    ...transformed.report,
  };

  if (apply) {
    await writeOntology(db, documentsToWrite);
    const [sourceAfter, targetAfter] = await Promise.all([
      readDocumentsByIds(db, [...sourceDocuments.keys()]),
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
      `${audit.sourceNodeCount} source nodes -> ${audit.targetNodeCount} target nodes ` +
      `(${audit.newNodeCount} new split nodes).\n${outputFile}\n`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});

export {
  cloneAndRemap,
  cloneAndTransform,
  deterministicNodeId,
  digestDocuments,
  validatePlanAgainstBenchmark,
};
