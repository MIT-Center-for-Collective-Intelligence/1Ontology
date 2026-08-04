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
  "rob-structure-review-2026-07-25",
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

function activeNodeByTitle(nodes, title) {
  const matches = [...nodes.values()].filter(
    (node) => node.deleted !== true && node.title === title,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected one active node titled "${title}", found ${matches.length}`,
    );
  }
  return matches[0];
}

function hasDirectLink(collections, nodeId) {
  return (collections || []).some((collection) =>
    (collection.nodes || []).some((link) => linkId(link) === nodeId),
  );
}

function addReciprocalEdge(nodes, parent, child, collectionName = "main") {
  if (parent.id === child.id) {
    throw new Error(`Cannot make "${parent.title}" its own parent`);
  }
  if (hasDirectLink(parent.specializations, child.id)) {
    throw new Error(
      `Direct relation already exists: ${parent.title} -> ${child.title}`,
    );
  }
  const reachesParent = (startId, visited = new Set()) => {
    if (startId === parent.id) return true;
    if (visited.has(startId)) return false;
    visited.add(startId);
    const start = nodes.get(startId);
    return (start?.specializations || []).some((collection) =>
      (collection.nodes || []).some((link) =>
        reachesParent(linkId(link), visited),
      ),
    );
  };
  if (reachesParent(child.id)) {
    throw new Error(
      `Adding ${parent.title} -> ${child.title} would create a cycle`,
    );
  }
  parent.specializations = addLinksToCollections(parent.specializations, [
    {
      collectionName,
      nodes: [{ id: child.id, title: child.title }],
    },
  ]);
  child.generalizations = addLinksToCollections(child.generalizations, [
    {
      collectionName: "main",
      nodes: [{ id: parent.id, title: parent.title }],
    },
  ]);
}

function removeReciprocalEdge(parent, child) {
  if (!hasDirectLink(parent.specializations, child.id)) {
    throw new Error(
      `Missing current relation: ${parent.title} -> ${child.title}`,
    );
  }
  if (!hasDirectLink(child.generalizations, parent.id)) {
    throw new Error(
      `Missing reciprocal relation: ${child.title} -> ${parent.title}`,
    );
  }
  parent.specializations = removeLinkFromCollections(
    parent.specializations,
    child.id,
  );
  child.generalizations = removeLinkFromCollections(
    child.generalizations,
    parent.id,
  );
}

function newActivityNode({ nodes, targetAppId, title, description, seed }) {
  const activeMatch = [...nodes.values()].find(
    (node) => node.deleted !== true && node.title === title,
  );
  if (activeMatch) {
    throw new Error(`Cannot create duplicate active title "${title}"`);
  }
  const id = deterministicNodeId(
    targetAppId,
    `structure\u001f${seed}\u001f${title}`,
  );
  if (nodes.has(id)) throw new Error(`Generated duplicate node ID ${id}`);
  const node = {
    actionAlternatives: [],
    appName: targetAppId,
    deleted: false,
    foundInPrevious: false,
    generalizations: [],
    id,
    inheritance: {
      parts: {
        ref: null,
        inheritanceType: "inheritUnlessAlreadyOverRidden",
        title: "",
      },
      description: {
        ref: null,
        inheritanceType: "inheritUnlessAlreadyOverRidden",
        title: "",
      },
    },
    inheritedPartsDetails: [],
    isAtomic: false,
    keepHirarky: true,
    nodeType: "activity",
    oNetTask: false,
    parentIds: [],
    pathIds: [id],
    primaryParentId: "",
    properties: {
      parts: [{ collectionName: "main", nodes: [] }],
      isPartOf: [{ collectionName: "main", nodes: [] }],
      description: description || "",
    },
    propertyType: { description: "string" },
    reasoningDescription: "",
    root: false,
    skillsFuture: true,
    specializations: [],
    synonyms: [],
    textValue: {},
    title,
  };
  nodes.set(id, node);
  return node;
}

function moveNode(
  nodes,
  {
    nodeTitle,
    currentParentTitle,
    proposedParentTitle,
    proposedCollection = "main",
  },
) {
  const node = activeNodeByTitle(nodes, nodeTitle);
  const currentParent = activeNodeByTitle(nodes, currentParentTitle);
  const proposedParent = activeNodeByTitle(nodes, proposedParentTitle);
  removeReciprocalEdge(currentParent, node);
  addReciprocalEdge(nodes, proposedParent, node, proposedCollection);
  node.inheritedPartsDetails = [];
  return {
    nodeId: node.id,
    nodeTitle,
    fromParentId: currentParent.id,
    fromParentTitle: currentParentTitle,
    toParentId: proposedParent.id,
    toParentTitle: proposedParentTitle,
    proposedCollection,
  };
}

function createIntermediateGrouping(nodes, targetAppId, grouping) {
  const parent = activeNodeByTitle(nodes, grouping.parentTitle);
  const group = newActivityNode({
    nodes,
    targetAppId,
    title: grouping.appliedGroupTitle,
    description: grouping.description,
    seed: grouping.diagnosisProposalId,
  });
  addReciprocalEdge(nodes, parent, group, grouping.parentCollection || "main");
  const movedChildren = grouping.children.map((childTitle) =>
    moveNode(nodes, {
      nodeTitle: childTitle,
      currentParentTitle: grouping.currentChildrenParentTitle,
      proposedParentTitle: grouping.appliedGroupTitle,
    }),
  );
  return {
    diagnosisProposalId: grouping.diagnosisProposalId,
    decisionSource: grouping.decisionSource,
    proposedGroupTitle: grouping.proposedGroupTitle,
    appliedGroupTitle: grouping.appliedGroupTitle,
    groupNodeId: group.id,
    parentTitle: grouping.parentTitle,
    movedChildren,
  };
}

function applyCollectionDesign(nodes, design) {
  const parent = activeNodeByTitle(nodes, design.parentTitle);
  const proposedCollectionName = collectionKey(design.collectionName);
  if (proposedCollectionName === "main") {
    throw new Error(
      "A collection design must use an explicit, non-main collection name",
    );
  }
  if (!Array.isArray(design.branches) || design.branches.length === 0) {
    throw new Error("A collection design must assign at least one child");
  }
  const assignedChildren = new Set();
  const children = [];
  for (const branch of design.branches) {
    if (branch.status !== "existing") {
      throw new Error(
        `Collection design cannot create activity nodes: ${branch.title}`,
      );
    }
    if ((branch.children || []).length > 0) {
      throw new Error(
        `Collection design cannot alter hierarchy beneath ${branch.title}`,
      );
    }
    const child = activeNodeByTitle(nodes, branch.title);
    if (!hasDirectLink(parent.specializations, child.id)) {
      throw new Error(
        `Collection design child is not directly under ${parent.title}: ${branch.title}`,
      );
    }
    if (assignedChildren.has(child.id)) {
      throw new Error(
        `Collection design assigns a child more than once: ${branch.title}`,
      );
    }
    assignedChildren.add(child.id);
    children.push(child);
  }

  for (const child of children) {
    parent.specializations = removeLinkFromCollections(
      parent.specializations,
      child.id,
    );
  }
  parent.specializations = addLinksToCollections(parent.specializations, [
    {
      collectionName: proposedCollectionName,
      nodes: children.map((child) => ({ id: child.id, title: child.title })),
    },
  ]);

  return {
    proposalId: design.proposalId,
    parentTitle: design.parentTitle,
    collectionName: proposedCollectionName,
    applicationMode: "collections-only",
    assignedChildren: children.map((child) => ({
      nodeId: child.id,
      title: child.title,
    })),
  };
}

function synchronizeHierarchyFields(nodes, changedRootIds) {
  const active = new Map(
    [...nodes].filter(([, node]) => node.deleted !== true),
  );
  const affected = new Set();
  const collect = (id) => {
    if (!id || affected.has(id) || !active.has(id)) return;
    affected.add(id);
    const node = active.get(id);
    for (const collection of node.specializations || []) {
      for (const link of collection.nodes || []) collect(linkId(link));
    }
  };
  for (const id of changedRootIds) collect(id);

  for (const id of affected) {
    const node = active.get(id);
    const parentIds = [
      ...new Set(
        (node.generalizations || [])
          .flatMap((collection) => collection.nodes || [])
          .map(linkId)
          .filter((parentId) => active.has(parentId)),
      ),
    ];
    node.parentIds = parentIds;
    node.primaryParentId = parentIds.includes(node.primaryParentId)
      ? node.primaryParentId
      : parentIds[0] || "";
    node.root = parentIds.length === 0;
  }

  const pathCache = new Map();
  const pathFor = (id, visiting = new Set()) => {
    if (pathCache.has(id)) return pathCache.get(id);
    const node = active.get(id);
    if (!node) return [];
    if (visiting.has(id)) {
      throw new Error(
        `Cycle encountered while rebuilding path for ${node.title}`,
      );
    }
    if (
      !affected.has(id) &&
      Array.isArray(node.pathIds) &&
      node.pathIds.length
    ) {
      return node.pathIds;
    }
    visiting.add(id);
    const parentPath = node.primaryParentId
      ? pathFor(node.primaryParentId, visiting)
      : [];
    visiting.delete(id);
    const pathIds = [...parentPath, id];
    pathCache.set(id, pathIds);
    return pathIds;
  };
  for (const id of affected) active.get(id).pathIds = pathFor(id);
  return { affectedNodeCount: affected.size };
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

  const exactCorrection = (proposalId, expected) => {
    const judgment = requireDecision(proposalId, "disagree");
    if (judgment.suggestedCorrection !== expected) {
      throw new Error(
        `Correction ${proposalId} does not match the recorded expert text`,
      );
    }
    return judgment;
  };
  const sameStringSet = (left, right) =>
    JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
  const assertGroupingProposal = (grouping) => {
    const proposal = proposals.get(grouping.proposalId);
    const context = proposal?.reviewerView?.context;
    if (
      !proposal ||
      !["flat-list-grouping", "compound-object-grouping"].includes(
        proposal.issueType,
      ) ||
      context?.type !== "grouping-outline" ||
      context.proposedGroupTitle !== grouping.proposedGroupTitle ||
      context.parentTitle !== grouping.currentChildrenParentTitle ||
      !sameStringSet(context.proposedChildren || [], grouping.children || [])
    ) {
      throw new Error(
        `Grouping ${grouping.proposalId} does not match its proposal`,
      );
    }
    if (grouping.decisionSource === "accepted-proposal") {
      requireDecision(grouping.proposalId, "agree");
      if (
        grouping.appliedGroupTitle !== grouping.proposedGroupTitle ||
        grouping.parentTitle !== context.parentTitle
      ) {
        throw new Error(
          `Accepted grouping ${grouping.proposalId} changes the proposal`,
        );
      }
    } else {
      exactCorrection(grouping.proposalId, grouping.expertSuggestedCorrection);
    }
  };

  for (const grouping of plan.groupings || []) {
    assertGroupingProposal(grouping);
  }
  for (const rejected of plan.rejectedGroupings || []) {
    const proposal = proposals.get(rejected.proposalId);
    const context = proposal?.reviewerView?.context;
    exactCorrection(rejected.proposalId, rejected.expertSuggestedCorrection);
    if (
      context?.type !== "grouping-outline" ||
      context.proposedGroupTitle !== rejected.proposedGroupTitle
    ) {
      throw new Error(
        `Rejected grouping ${rejected.proposalId} does not match its proposal`,
      );
    }
  }

  for (const design of plan.collectionDesigns || []) {
    requireDecision(design.proposalId, "agree");
    const proposal = proposals.get(design.proposalId);
    const context = proposal?.reviewerView?.context;
    const plannedBranches = (design.branches || []).map((branch) => ({
      title: branch.title,
      status: branch.status,
      children: branch.children || [],
    }));
    const proposedBranches = (context?.proposedBranches || []).map(
      (branch) => ({
        title: branch.title,
        status: branch.status,
        children: branch.children || [],
      }),
    );
    if (
      proposal?.issueType !== "collection-design" ||
      context?.type !== "collection-design" ||
      context.parentTitle !== design.parentTitle ||
      context.proposedCollectionName !== design.collectionName ||
      JSON.stringify(proposedBranches) !== JSON.stringify(plannedBranches)
    ) {
      throw new Error(
        `Collection design ${design.proposalId} does not match its proposal`,
      );
    }
  }

  for (const relocation of plan.relocations || []) {
    const action = proposals.get(relocation.proposalId);
    const context = action?.reviewerView?.context;
    const diagnosisProposalId =
      action?.workflow?.dependsOnProposalIds?.[0] || "";
    if (
      action?.issueType !== "relocation" ||
      context?.type !== "relocation-action" ||
      diagnosisProposalId !== relocation.diagnosisProposalId ||
      action.provenance?.subjectNodeId !== relocation.sourceNodeId ||
      context.nodeTitle !== relocation.nodeTitle ||
      context.currentParentTitle !== relocation.currentParentTitle ||
      context.proposedParentTitle !== relocation.proposedParentTitle
    ) {
      throw new Error(
        `Relocation ${relocation.proposalId} does not match its proposal`,
      );
    }
    requireDecision(diagnosisProposalId, "agree");
    if (relocation.decisionSource === "accepted-proposal") {
      requireDecision(relocation.proposalId, "agree");
      if (
        !relocation.satisfiedByGrouping &&
        relocation.finalParentTitle !== relocation.proposedParentTitle
      ) {
        throw new Error(
          `Accepted relocation ${relocation.proposalId} changes its destination`,
        );
      }
    } else {
      exactCorrection(
        relocation.proposalId,
        relocation.expertSuggestedCorrection,
      );
    }
    if (relocation.satisfiedByGrouping) {
      const grouping = (plan.groupings || []).find(
        (candidate) =>
          candidate.appliedGroupTitle === relocation.satisfiedByGrouping &&
          candidate.children.includes(relocation.nodeTitle),
      );
      if (
        !grouping ||
        grouping.parentTitle !== relocation.proposedParentTitle ||
        relocation.finalParentTitle !== grouping.appliedGroupTitle
      ) {
        throw new Error(
          `Relocation ${relocation.proposalId} is not satisfied by its planned grouping`,
        );
      }
    }
  }

  for (const created of plan.createdNodes || []) {
    if (created.decisionSource !== "expert-correction") continue;
    for (const correction of created.expertCorrections || []) {
      exactCorrection(correction.proposalId, correction.suggestedCorrection);
    }
  }

  const groupingDecisionIds = new Set([
    ...(plan.groupings || []).map((item) => item.proposalId),
    ...(plan.rejectedGroupings || []).map((item) => item.proposalId),
  ]);
  const expectedGroupingIds = new Set(
    [...judgments.values()]
      .filter((judgment) =>
        ["flat-list-grouping", "compound-object-grouping"].includes(
          proposals.get(judgment.proposalId)?.issueType,
        ),
      )
      .map((judgment) => judgment.proposalId),
  );
  if (!sameStringSet(groupingDecisionIds, expectedGroupingIds)) {
    throw new Error(
      "Structure plan does not account for every grouping decision",
    );
  }
  const relocationDecisionIds = new Set(
    (plan.relocations || []).map((item) => item.proposalId),
  );
  const expectedRelocationIds = new Set(
    [...judgments.values()]
      .filter(
        (judgment) =>
          proposals.get(judgment.proposalId)?.issueType === "relocation",
      )
      .map((judgment) => judgment.proposalId),
  );
  if (!sameStringSet(relocationDecisionIds, expectedRelocationIds)) {
    throw new Error(
      "Structure plan does not account for every relocation decision",
    );
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

  const changedTitles = new Set();
  const createdNodeResults = [];
  for (const created of plan.createdNodes || []) {
    const parent = activeNodeByTitle(targetDocuments, created.parentTitle);
    const node = newActivityNode({
      nodes: targetDocuments,
      targetAppId,
      title: created.title,
      description: created.description,
      seed: created.seed,
    });
    addReciprocalEdge(
      targetDocuments,
      parent,
      node,
      created.parentCollection || "main",
    );
    changedTitles.add(parent.title);
    changedTitles.add(node.title);
    createdNodeResults.push({
      title: node.title,
      nodeId: node.id,
      parentTitle: parent.title,
      parentId: parent.id,
      decisionSource: created.decisionSource,
      expertCorrections: created.expertCorrections || [],
    });
  }

  const groupingResults = [];
  for (const grouping of plan.groupings || []) {
    const result = createIntermediateGrouping(
      targetDocuments,
      targetAppId,
      grouping,
    );
    groupingResults.push(result);
    changedTitles.add(grouping.parentTitle);
    changedTitles.add(grouping.currentChildrenParentTitle);
    changedTitles.add(grouping.appliedGroupTitle);
  }

  const collectionResults = [];
  for (const design of plan.collectionDesigns || []) {
    const result = applyCollectionDesign(targetDocuments, design);
    collectionResults.push(result);
    changedTitles.add(design.parentTitle);
    for (const branch of design.branches) {
      for (const childTitle of branch.children || []) {
        changedTitles.add(childTitle);
      }
    }
  }

  const relocationResults = [];
  for (const relocation of plan.relocations || []) {
    if (relocation.satisfiedByGrouping) {
      const node = activeNodeByTitle(targetDocuments, relocation.nodeTitle);
      const parent = activeNodeByTitle(
        targetDocuments,
        relocation.finalParentTitle,
      );
      if (!hasDirectLink(parent.specializations, node.id)) {
        throw new Error(
          `${relocation.nodeTitle} was not moved by ${relocation.satisfiedByGrouping}`,
        );
      }
      relocationResults.push({
        ...relocation,
        nodeId: node.id,
        finalParentId: parent.id,
        applicationMode: "satisfied-by-grouping",
      });
      continue;
    }
    const result = moveNode(targetDocuments, {
      nodeTitle: relocation.nodeTitle,
      currentParentTitle: relocation.currentParentTitle,
      proposedParentTitle: relocation.finalParentTitle,
      proposedCollection: relocation.proposedCollection || "main",
    });
    changedTitles.add(relocation.currentParentTitle);
    changedTitles.add(relocation.finalParentTitle);
    relocationResults.push({
      ...relocation,
      ...result,
      applicationMode: "direct-relocation",
    });
  }

  const titleById = new Map(
    [...targetDocuments].map(([id, node]) => [id, node.title || ""]),
  );
  for (const [id, node] of targetDocuments) {
    targetDocuments.set(id, refreshLinkTitles(node, titleById));
  }
  const changedRootIds = [...changedTitles].map(
    (title) => activeNodeByTitle(targetDocuments, title).id,
  );
  const hierarchy = synchronizeHierarchyFields(targetDocuments, changedRootIds);
  const integrity = assertActiveGraphIntegrity(targetDocuments);

  return {
    idMap,
    targetDocuments,
    report: {
      sourceNodeCount: sourceDocuments.size,
      targetNodeCount: targetDocuments.size,
      createdNodes: createdNodeResults,
      groupings: groupingResults,
      rejectedGroupings: plan.rejectedGroupings || [],
      collectionDesigns: collectionResults,
      relocations: relocationResults,
      hierarchy,
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
  const node = (id, title) => ({
    id,
    appName: "source",
    title,
    deleted: false,
    generalizations: [],
    specializations: [],
    parentIds: [],
    pathIds: [id],
    primaryParentId: "",
    properties: { description: "" },
  });
  const source = new Map(
    [
      ["sell", "Sell"],
      ["physical", "Sell physical objects"],
      ["a", "Sell A"],
      ["b", "Sell B"],
      ["c", "Sell C"],
      ["rent", "Rent out"],
      ["persuade", "Persuade"],
    ].map(([id, title]) => [id, node(id, title)]),
  );
  addReciprocalEdge(source, source.get("sell"), source.get("physical"));
  addReciprocalEdge(source, source.get("sell"), source.get("rent"));
  addReciprocalEdge(source, source.get("physical"), source.get("a"));
  addReciprocalEdge(source, source.get("physical"), source.get("b"));
  addReciprocalEdge(source, source.get("physical"), source.get("c"));
  const plan = {
    sourceOntology: { appId: "source" },
    targetOntology: { appId: "target" },
    createdNodes: [
      {
        title: "Promote",
        parentTitle: "Persuade",
        description: "Make something better known.",
        seed: "promote",
        decisionSource: "expert-correction",
        expertCorrections: [],
      },
    ],
    groupings: [
      {
        proposalId: "group",
        diagnosisProposalId: "group",
        decisionSource: "accepted-proposal",
        proposedGroupTitle: "Sell AB",
        appliedGroupTitle: "Sell AB",
        parentTitle: "Sell physical objects",
        currentChildrenParentTitle: "Sell physical objects",
        children: ["Sell A", "Sell B"],
        description: "Sell A or B.",
      },
    ],
    rejectedGroupings: [],
    collectionDesigns: [
      {
        proposalId: "collection",
        parentTitle: "Sell",
        collectionName: "Sell what kind of usage?",
        branches: [
          { title: "Sell physical objects", status: "existing", children: [] },
          { title: "Rent out", status: "existing", children: [] },
        ],
      },
    ],
    relocations: [
      {
        proposalId: "relocation",
        diagnosisProposalId: "placement",
        decisionSource: "expert-correction",
        sourceNodeId: "c",
        nodeTitle: "Sell C",
        currentParentTitle: "Sell physical objects",
        proposedParentTitle: "Advertise",
        finalParentTitle: "Promote",
      },
    ],
  };
  const result = cloneAndApply(source, plan);
  const group = activeNodeByTitle(result.targetDocuments, "Sell AB");
  const promote = activeNodeByTitle(result.targetDocuments, "Promote");
  const sellC = activeNodeByTitle(result.targetDocuments, "Sell C");
  const sell = activeNodeByTitle(result.targetDocuments, "Sell");
  const rentOut = activeNodeByTitle(result.targetDocuments, "Rent out");
  const usageCollection = (sell.specializations || []).find(
    (collection) => collection.collectionName === "Sell what kind of usage?",
  );
  if (
    !hasDirectLink(
      group.specializations,
      activeNodeByTitle(result.targetDocuments, "Sell A").id,
    ) ||
    !hasDirectLink(
      group.specializations,
      activeNodeByTitle(result.targetDocuments, "Sell B").id,
    ) ||
    !hasDirectLink(promote.specializations, sellC.id) ||
    !(usageCollection?.nodes || []).some((link) => linkId(link) === rentOut.id)
  ) {
    throw new Error("Structure application self-test failed");
  }

  const invalidPlan = {
    sourceOntology: { appId: "source" },
    targetOntology: { appId: "target-invalid" },
    createdNodes: [],
    groupings: [],
    rejectedGroupings: [],
    collectionDesigns: [
      {
        proposalId: "invalid-collection",
        parentTitle: "Sell",
        collectionName: "Sell what kind of usage?",
        branches: [
          {
            title: "Sell temporary use",
            status: "new",
            children: ["Rent out"],
          },
        ],
      },
    ],
    relocations: [],
  };
  let rejectedNodeCreation = false;
  try {
    cloneAndApply(source, invalidPlan);
  } catch (error) {
    rejectedNodeCreation = /cannot create activity nodes/i.test(
      String(error?.message || error),
    );
  }
  if (!rejectedNodeCreation) {
    throw new Error("Collection design node-creation guard self-test failed");
  }
  process.stdout.write("PASS: structure clone and application self-test\n");
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
      path.join(DEFAULT_ARTIFACT_DIR, "structure-application-plan.json"),
  );
  const outputFile = path.resolve(
    args.out ||
      path.join(DEFAULT_ARTIFACT_DIR, "structure-application-audit.json"),
  );
  const environment = args.environment || "production";
  const apply = args.apply === true || args.apply === "true";
  const resume = args.resume === true || args.resume === "true";
  const plan = readJson(planFile);
  const validated = validatePlan(plan, planFile);

  const serviceAccount = credentials(environment);
  const app = initializeApp(
    { credential: cert(serviceAccount) },
    `som-structure-clone-${environment}-${Date.now()}`,
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
    schemaVersion: "som-structure-application-audit-v1",
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
      `${audit.groupings.length} groupings, ` +
      `${audit.collectionDesigns.length} collection designs, and ` +
      `${audit.relocations.length} relocations; ` +
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
  activeNodeByTitle,
  addReciprocalEdge,
  assertActiveGraphIntegrity,
  allRecordedSynonyms,
  cloneAndRemap,
  cloneAndApply,
  deterministicNodeId,
  digestDocument,
  digestDocuments,
  hasDirectLink,
  isOnetEvidence,
  linkId,
  newActivityNode,
  refreshLinkTitles,
  removeReciprocalEdge,
  removeRecordedSynonyms,
  synchronizeHierarchyFields,
};
