#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import {
  AUDIT_POLICY_VERSION,
  CRITIC_GROUPING_GUIDANCE,
  IDENTITY_AGENT_GUIDANCE,
  PLACEMENT_AGENT_GUIDANCE,
  STRUCTURE_AGENT_GUIDANCE,
  detectRedundantCollectionPolicy,
  renderAuditPolicy,
} from "./audit-policy.mjs";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
const { GoogleGenAI } = require("@google/genai");
const { cert, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const BASE_DATASET_DIR = path.join(
  REPO_ROOT,
  "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
  "review-datasets-rob-post-structure-2026-07-25",
);
const SNAPSHOT_SCHEMA_VERSION = "som-ontology-snapshot-v1";
const REVIEW_SCHEMA_VERSION = "som-review-v1";
const MODEL = "gemini-3.1-pro-preview";
const PIPELINE_PROMPT_VERSION = "buy-transfer-v3";
const CONTENT_VERIFIER_PROMPT_VERSION = "buy-content-verifier-v3";
const DETECTOR_PASSES = 2;
const CONTENT_VERIFICATION_ISSUE_TYPES = new Set([
  "title-clarity",
  "synonym-enrichment",
  "mistaken-synonym",
  "duplicate-synonym",
]);

const ISSUE_DEFINITIONS = [
  [
    "title-clarity",
    "Clarify unclear titles",
    "content",
    [1],
    "title-comparison",
  ],
  [
    "synonym-enrichment",
    "Add missing synonyms",
    "content",
    [2],
    "metadata-edit",
  ],
  [
    "description-enrichment",
    "Add missing descriptions",
    "additional-quality",
    [3],
    "metadata-edit",
    true,
  ],
  [
    "misc-facet-duplicate",
    "Repeated miscellaneous/facet nodes",
    "within-branch",
    [4],
    "overlap-comparison",
  ],
  ["mistaken-synonym", "Mistaken synonyms", "content", [5], "metadata-edit"],
  [
    "duplicate-synonym",
    "Possible duplicate activities",
    "content",
    [6],
    "duplicate-comparison",
  ],
  ["polysemy", "Undetected double meanings", "content", [7], "polysemy-review"],
  [
    "flat-list-grouping",
    "Group long flat lists",
    "within-branch",
    [8],
    "grouping-outline",
  ],
  [
    "compound-object-grouping",
    "Group compound objects",
    "within-branch",
    [9],
    "grouping-outline",
  ],
  [
    "collection-design",
    "Create warranted collections",
    "within-branch",
    [10],
    "collection-design",
  ],
  [
    "placement",
    "Activities under an incorrect parent",
    "within-branch",
    [11],
    "placement-comparison",
  ],
  [
    "wrong-verb",
    "Activities using a different main action",
    "outside-branch",
    [12],
    "placement-comparison",
  ],
  [
    "sense-relocation",
    "Move a separated sense outside the Sub-branch",
    "outside-branch",
    [13],
    "sense-relocation-action",
  ],
  [
    "node-merge",
    "Review approved node merges",
    "final-action",
    [4, 6],
    "merge-action",
  ],
  [
    "relocation",
    "Review approved relocations",
    "final-action",
    [11, 12],
    "relocation-action",
  ],
  [
    "missing-activity",
    "Missing activity",
    "additional-quality",
    [],
    "addition-action",
    true,
  ],
  [
    "redundant-node",
    "Redundant node",
    "additional-quality",
    [],
    "merge-up-action",
  ],
].map(([id, label, stage, robTaskIds, view, optional = false]) => ({
  id,
  label,
  stage,
  robTaskIds,
  rolloutStatus: "experimental",
  view,
  ...(optional ? { optional: true } : {}),
}));

const REVIEW_WAVES = {
  "title-clarity": {
    currentWave: "title-clarity",
    releasedIssueTypes: ["title-clarity"],
    message: (branch) =>
      `${branch} is an exploratory transfer run. Complete title review first; then apply those decisions and regenerate content and identity proposals from the revised snapshot.`,
  },
  "title-followup": {
    currentWave: "title-clarity-followup",
    releasedIssueTypes: ["title-clarity"],
    message: (branch) =>
      `${branch}'s initial title decisions have been applied. Complete this short follow-up of newly detected title items; then apply those decisions and regenerate content and identity proposals from the revised snapshot.`,
  },
  "content-identity": {
    currentWave: "content-and-identity",
    releasedIssueTypes: [
      "title-clarity",
      "synonym-enrichment",
      "mistaken-synonym",
      "duplicate-synonym",
      "polysemy",
      "misc-facet-duplicate",
      "node-merge",
    ],
    message: (branch) =>
      `${branch} title decisions have been applied. Complete any newly detected title items, then review content and identity proposals and their exact merge follow-ups. Apply those decisions before regenerating structure and placement proposals.`,
  },
};

function reviewReleaseForWave(reviewWave, branch) {
  const wave = REVIEW_WAVES[reviewWave];
  if (!wave) {
    throw new Error(
      `Unknown review wave "${reviewWave}". Expected one of: ${Object.keys(
        REVIEW_WAVES,
      ).join(", ")}`,
    );
  }
  const releasedIssueTypes = [...wave.releasedIssueTypes];
  return {
    strategy: "dependency-gated-exploratory-wave",
    currentWave: wave.currentWave,
    releasedIssueTypes,
    awaitingRegenerationIssueTypes: ISSUE_DEFINITIONS.map(
      (issue) => issue.id,
    ).filter((issueType) => !releasedIssueTypes.includes(issueType)),
    message: wave.message(branch),
  };
}

const ASSESSMENT_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["assessments"],
  properties: {
    assessments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["candidateId", "decision", "rationale"],
        properties: {
          candidateId: { type: "string" },
          decision: {
            type: "string",
            enum: ["accept", "reject", "revise"],
          },
          rationale: { type: "string" },
          confidence: {
            type: "string",
            enum: ["high", "medium", "low"],
          },
          revisedFields: {
            type: "object",
            additionalProperties: true,
          },
        },
      },
    },
  },
};

const DETECTORS = [
  {
    id: "title-evidence-agent",
    role: "Systematically inspect every non-evidence title against its description and source tasks. Return every plausible title-clarity candidate across high, medium, and low confidence while preserving every meaning expressed by the evidence.",
    schema: `
title-clarity: {nodeTitle,currentParentTitle,proposedTitle,rationale}`,
  },
  {
    id: "identity-agent",
    role: `${IDENTITY_AGENT_GUIDANCE}
Inspect structured synonyms, identity, and polysemy. A synonym is useful when it
provides an alternative lexicalization of the same activity, so never remove
one merely because it is a close or trivial wording variation. Propose
mistaken-synonym only when the term changes the activity's meaning and is not
substitutable in the evidence context. Pay special attention to whether a root
synonym has introduced descendants that perform a related but different
action. Return only synonym-enrichment, mistaken-synonym, duplicate-synonym, or
polysemy candidates.`,
    schema: `
synonym-enrichment: {nodeTitle,proposedSynonyms:[...],rationale}
mistaken-synonym: {nodeTitle,removeSynonyms:[...],rationale}
duplicate-synonym: {canonicalTitle,canonicalParentTitle,candidateTitle,candidateParentTitle,rationale}
polysemy: {nodeTitle,currentParentTitle,proposedSenses:[{title,meaning}],rationale}`,
  },
  {
    id: "structure-agent",
    role: `${STRUCTURE_AGENT_GUIDANCE}
Inspect sibling structure, compound objects, and genuinely distinct
specialization dimensions. Return only flat-list-grouping,
compound-object-grouping, or collection-design candidates.

A collection is a named display bucket on a parent's existing child links; it
is not an ontology activity node. A collection-design candidate may create or
reuse one collection label and assign existing direct activity children to it,
but it must never invent a new activity, insert an intermediate node, or change
a parent-child relation. proposedCollectionName is the collection label. Every
proposedBranches item identifies one exact existing direct child activity: use
status "existing" and an empty children array.`,
    schema: `
flat-list-grouping or compound-object-grouping:
  {parentTitle,proposedGroupTitle,proposedChildren:[at least 2 exact direct child titles],rationale}
collection-design:
  {parentTitle,proposedCollectionName,proposedBranches:[{title:exact existing direct child title,status:"existing",children:[]}],rationale}`,
  },
  {
    id: "placement-boundary-agent",
    role: `${PLACEMENT_AGENT_GUIDANCE}
Inspect whether nodes sit under an overly broad or semantically wrong current
parent, and whether a node actually expresses a different main action. Return
only placement or wrong-verb candidates.`,
    schema: `
placement or wrong-verb:
  {nodeTitle,currentParentTitle,candidateHome,rationale}`,
  },
];

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

function clean(value) {
  return String(value ?? "").trim();
}

function normalizeCollection(value = "") {
  const unwrapped = clean(value).replace(/^\[/, "").replace(/\]$/, "");
  return !unwrapped || unwrapped === "default" ? "main" : unwrapped;
}

function edgeKey(parentId, childId, collectionName = "main") {
  return `${parentId}\u001f${normalizeCollection(collectionName)}\u001f${childId}`;
}

function edgePair(parentId, childId) {
  return `${parentId}\u001f${childId}`;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function runCachedStage({
  cacheFile,
  inputSha256,
  resume,
  validate,
  run,
}) {
  if (resume && fs.existsSync(cacheFile)) {
    const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    if (
      cached.schemaVersion === "som-exploratory-stage-cache-v1" &&
      cached.inputSha256 === inputSha256
    ) {
      if (validate) validate(cached.output);
      return cached.output;
    }
  }

  const output = await run();
  if (validate) validate(output);
  writeJson(cacheFile, {
    schemaVersion: "som-exploratory-stage-cache-v1",
    createdAt: new Date().toISOString(),
    inputSha256,
    output,
  });
  return output;
}

function approvedTitleLocksFromBenchmark(benchmarkFile) {
  if (!benchmarkFile) {
    return {
      benchmarkFile: "",
      benchmarkSha256: "",
      byTitle: new Map(),
    };
  }
  const resolvedFile = path.resolve(benchmarkFile);
  const benchmark = JSON.parse(fs.readFileSync(resolvedFile, "utf8"));
  const byTitle = new Map();
  for (const judgment of benchmark.judgments || []) {
    if (judgment.decision !== "agree" || !clean(judgment.proposedTitle)) {
      continue;
    }
    byTitle.set(clean(judgment.proposedTitle), {
      proposalId: clean(judgment.proposalId),
      evidence: [...new Set((judgment.linkedTasks || []).map(clean))]
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right, "en")),
    });
  }
  return {
    benchmarkFile: path.basename(resolvedFile),
    benchmarkSha256: sha256(fs.readFileSync(resolvedFile)),
    byTitle,
  };
}

function expertTitleLockReason(candidate, index, approvedTitleLocks) {
  if (candidate.issueType !== "title-clarity") return "";
  const lock = approvedTitleLocks.byTitle.get(clean(candidate.nodeTitle));
  if (!lock) return "";
  const currentEvidence = sourceTasksForNode(index, candidate.nodeTitle)
    .map(clean)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, "en"));
  if (JSON.stringify(currentEvidence) !== JSON.stringify(lock.evidence)) {
    return "";
  }
  return `The current title was approved in proposal ${lock.proposalId}, and its source evidence is unchanged.`;
}

function validateCompleteAssessments(label, candidates, output) {
  const expectedIds = candidates.map((candidate) => candidate.candidateId);
  const assessments = Array.isArray(output?.assessments)
    ? output.assessments
    : [];
  const returnedIds = assessments.map((assessment) =>
    clean(assessment.candidateId),
  );
  const duplicateIds = returnedIds.filter(
    (candidateId, index) => returnedIds.indexOf(candidateId) !== index,
  );
  const missingIds = expectedIds.filter(
    (candidateId) => !returnedIds.includes(candidateId),
  );
  const unexpectedIds = returnedIds.filter(
    (candidateId) => !expectedIds.includes(candidateId),
  );
  if (duplicateIds.length || missingIds.length || unexpectedIds.length) {
    throw new Error(
      `${label} returned an invalid assessment set: ` +
        `${missingIds.length} missing, ${duplicateIds.length} duplicate, ` +
        `${unexpectedIds.length} unexpected candidate IDs`,
    );
  }
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

function proposalId(datasetVersion, issueType, key) {
  return `som-${sha256(`${datasetVersion}|${issueType}|${key}`).slice(0, 20)}`;
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

function isEvidence(node) {
  return /^\(O\*Net\)/i.test(clean(node?.title));
}

function evidenceText(title) {
  return clean(title).replace(/^\(O\*Net\)\s*[^-]*-\s*/i, "");
}

function structuredSynonyms(node) {
  const values = new Set();
  for (const value of node?.actionAlternatives || []) {
    if (clean(value)) values.add(clean(value));
  }
  for (const value of clean(node?.synsets).split(",")) {
    const lemma = value.trim().replace(/\.[a-z]+\.\d+$/i, "");
    if (lemma) values.add(lemma.replace(/_/g, " "));
  }
  return [...values].sort((left, right) => left.localeCompare(right, "en"));
}

function allRecordedSynonyms(node) {
  const values = new Set(structuredSynonyms(node));
  const match = clean(node?.description || node?.properties?.description).match(
    /Synonyms?:\s*([^.;]+)/i,
  );
  if (match) {
    for (const value of match[1].split(/,|\bor\b/i)) {
      if (clean(value)) values.add(clean(value));
    }
  }
  return [...values].sort((left, right) => left.localeCompare(right, "en"));
}

async function readOntology({ environment, ontologyAppId, branch }) {
  const serviceAccount = credentials(environment);
  const app = initializeApp(
    { credential: cert(serviceAccount) },
    `som-${branch.toLowerCase()}-${Date.now()}`,
  );
  const db = getFirestore(app);
  const result = await db
    .collection("nodes")
    .where("appName", "==", ontologyAppId)
    .where("deleted", "==", false)
    .select(
      "title",
      "specializations",
      "properties.description",
      "synsets",
      "actionAlternatives",
    )
    .get();
  const allNodes = new Map(
    result.docs.map((doc) => [doc.id, { id: doc.id, ...doc.data() }]),
  );
  const roots = [...allNodes.values()].filter(
    (node) => clean(node.title) === branch,
  );
  if (roots.length !== 1) {
    throw new Error(`Expected one ${branch} root, found ${roots.length}`);
  }

  const root = roots[0];
  const descendants = new Set();
  const edges = [];
  const queue = [root.id];
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
  return {
    allNodes,
    root,
    descendants,
    edges,
    projectId: serviceAccount.projectId,
  };
}

function buildWorkingIndex(rootId, allNodes, descendantIds, edges) {
  const nodesById = new Map(
    [...descendantIds].map((id) => [id, allNodes.get(id)]),
  );
  const idsByTitle = new Map();
  for (const node of nodesById.values()) {
    const title = clean(node?.title);
    idsByTitle.set(title, [...(idsByTitle.get(title) || []), node.id]);
  }
  const edgesByParent = new Map();
  const parentEdgesByChild = new Map();
  for (const edge of edges) {
    edgesByParent.set(edge.parentId, [
      ...(edgesByParent.get(edge.parentId) || []),
      edge,
    ]);
    parentEdgesByChild.set(edge.childId, [
      ...(parentEdgesByChild.get(edge.childId) || []),
      edge,
    ]);
  }

  const pathsById = new Map([[rootId, [clean(nodesById.get(rootId)?.title)]]]);
  const queue = [rootId];
  while (queue.length) {
    const parentId = queue.shift();
    const parentPath = pathsById.get(parentId) || [];
    for (const edge of edgesByParent.get(parentId) || []) {
      if (pathsById.has(edge.childId)) continue;
      const pathParts = [
        ...parentPath,
        ...(edge.collectionName === "main" ? [] : [`[${edge.collectionName}]`]),
        clean(nodesById.get(edge.childId)?.title),
      ];
      pathsById.set(edge.childId, pathParts);
      queue.push(edge.childId);
    }
  }

  return {
    rootId,
    nodesById,
    idsByTitle,
    edges,
    edgesByParent,
    parentEdgesByChild,
    pathsById,
    edgeKeys: new Set(
      edges.map((edge) =>
        edgeKey(edge.parentId, edge.childId, edge.collectionName),
      ),
    ),
    edgePairs: new Set(
      edges.map((edge) => edgePair(edge.parentId, edge.childId)),
    ),
  };
}

function uniqueIdForTitle(index, title) {
  const ids = index.idsByTitle.get(clean(title)) || [];
  if (ids.length !== 1) {
    throw new Error(
      ids.length
        ? `Ambiguous ontology title: ${title}`
        : `Missing ontology title: ${title}`,
    );
  }
  return ids[0];
}

function titleFor(index, nodeId) {
  return clean(index.nodesById.get(nodeId)?.title);
}

function directChildEdges(index, parentTitle, { semanticOnly = false } = {}) {
  const parentId = uniqueIdForTitle(index, parentTitle);
  return (index.edgesByParent.get(parentId) || []).filter(
    (edge) => !semanticOnly || !isEvidence(index.nodesById.get(edge.childId)),
  );
}

function currentChildren(index, nodeTitle) {
  return directChildEdges(index, nodeTitle, { semanticOnly: true })
    .map((edge) => titleFor(index, edge.childId))
    .sort((left, right) => left.localeCompare(right, "en"));
}

function allCurrentChildren(index, nodeTitle) {
  return directChildEdges(index, nodeTitle)
    .map((edge) => titleFor(index, edge.childId))
    .sort((left, right) => left.localeCompare(right, "en"));
}

function sourceTasksForNode(index, nodeTitle) {
  const nodeId = uniqueIdForTitle(index, nodeTitle);
  return (index.edgesByParent.get(nodeId) || [])
    .filter((edge) => isEvidence(index.nodesById.get(edge.childId)))
    .map((edge) => evidenceText(titleFor(index, edge.childId)));
}

function sourceTasksForNodes(index, nodeTitles) {
  return [
    ...new Set(
      nodeTitles
        .flatMap((nodeTitle) => sourceTasksForNode(index, nodeTitle))
        .map(clean)
        .filter(Boolean),
    ),
  ];
}

function sourceEdge(index, parentTitle, childTitle) {
  const parentId = uniqueIdForTitle(index, parentTitle);
  const childId = uniqueIdForTitle(index, childTitle);
  const matches = (index.edgesByParent.get(parentId) || []).filter(
    (edge) => edge.childId === childId,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected one source edge ${parentTitle} -> ${childTitle}, found ${matches.length}`,
    );
  }
  return matches[0];
}

function firstParentTitle(index, nodeTitle) {
  const nodeId = uniqueIdForTitle(index, nodeTitle);
  const edge = (index.parentEdgesByChild.get(nodeId) || [])[0];
  return edge ? titleFor(index, edge.parentId) : "";
}

function branchFacts(index) {
  return [...index.nodesById.values()]
    .filter((node) => !isEvidence(node))
    .map((node) => {
      const parentLinks = (index.parentEdgesByChild.get(node.id) || []).map(
        (edge) => ({
          parent: titleFor(index, edge.parentId),
          collection: edge.collectionName,
        }),
      );
      const childEdges = index.edgesByParent.get(node.id) || [];
      return {
        title: clean(node.title),
        path: index.pathsById.get(node.id) || [],
        parents: parentLinks,
        children: childEdges
          .filter((edge) => !isEvidence(index.nodesById.get(edge.childId)))
          .map((edge) => ({
            title: titleFor(index, edge.childId),
            collection: edge.collectionName,
          })),
        sourceTasks: childEdges
          .filter((edge) => isEvidence(index.nodesById.get(edge.childId)))
          .map((edge) => evidenceText(titleFor(index, edge.childId))),
        description: clean(node.properties?.description),
        structuredSynonyms: structuredSynonyms(node),
      };
    })
    .sort((left, right) => left.title.localeCompare(right.title, "en"));
}

function commonPrompt(branch, facts, externalDestinations = []) {
  return `
You are one specialist in a Society-of-Mind ontology audit. The ontology
sub-branch is "${branch}". Every ordinary node represents an activity.
O*NET source tasks are evidence, not candidate ontology nodes.

Learned process constraints:
1. Content and identity decisions precede structural decisions.
2. Do not propose singular/plural normalization by itself.
3. A title change must clarify what the source evidence actually means.
4. Related activities are not synonyms merely because they share an object.
5. Do not infer a wrong action solely from the leading verb. Acquisition modes
   such as ordering, renting, hiring, recruiting, leasing, or subcontracting
   may legitimately specialize ${branch}.
6. A placement proposal must name an exact existing destination category.
7. Prefer no candidate to a weak, aesthetic, or speculative candidate.
8. Use only exact titles from the supplied branch for current nodes and parents.
9. Do not use named examples or answers from another ontology branch.
10. Synonym fields intentionally preserve alternative verbs and wording for
    the same activity. A close lexical or morphological variation is evidence
    for keeping a synonym, not removing it. Remove a synonym only when it names
    a meaningfully different activity.

${renderAuditPolicy(branch)}

Existing external destination categories that may be used only when a node
truly expresses a different main action:
${JSON.stringify(externalDestinations)}

Branch data:
${JSON.stringify(facts)}
`;
}

async function callAgent(ai, label, prompt, responseJsonSchema) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          temperature: 0,
          responseMimeType: "application/json",
          ...(responseJsonSchema
            ? { maxOutputTokens: 16384, responseJsonSchema }
            : {}),
          thinkingConfig: { thinkingLevel: "LOW" },
        },
      });
      const text = clean(response.text);
      const parsed = JSON.parse(text);
      return { text, parsed };
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 4000));
      }
    }
  }
  throw new Error(
    `${label} failed after three attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

function candidateKey(candidate) {
  const sorted = (values) =>
    [...new Set((values || []).map(clean))].sort((left, right) =>
      left.localeCompare(right, "en"),
    );
  switch (candidate.issueType) {
    case "title-clarity":
      return JSON.stringify([
        candidate.issueType,
        clean(candidate.nodeTitle),
        clean(candidate.proposedTitle),
      ]);
    case "synonym-enrichment":
      return JSON.stringify([
        candidate.issueType,
        clean(candidate.nodeTitle),
        sorted(candidate.proposedSynonyms),
      ]);
    case "mistaken-synonym":
      return JSON.stringify([
        candidate.issueType,
        clean(candidate.nodeTitle),
        sorted(candidate.removeSynonyms),
      ]);
    case "duplicate-synonym":
      return JSON.stringify([
        candidate.issueType,
        sorted([candidate.canonicalTitle, candidate.candidateTitle]),
      ]);
    case "polysemy":
      return JSON.stringify([
        candidate.issueType,
        clean(candidate.nodeTitle),
        sorted((candidate.proposedSenses || []).map((sense) => sense.title)),
      ]);
    case "flat-list-grouping":
    case "compound-object-grouping":
      return JSON.stringify([
        candidate.issueType,
        clean(candidate.parentTitle),
        clean(candidate.proposedGroupTitle),
        sorted(candidate.proposedChildren),
      ]);
    case "collection-design":
      return JSON.stringify([
        candidate.issueType,
        clean(candidate.parentTitle),
        clean(candidate.proposedCollectionName),
      ]);
    case "placement":
    case "wrong-verb":
      return JSON.stringify([
        candidate.issueType,
        clean(candidate.nodeTitle),
        clean(candidate.currentParentTitle),
        clean(candidate.candidateHome),
      ]);
    case "misc-facet-duplicate":
      return JSON.stringify([
        candidate.issueType,
        clean(candidate.parentTitle),
        sorted([candidate.firstTitle, candidate.secondTitle]),
      ]);
    default:
      return JSON.stringify(candidate);
  }
}

function stableCandidateId(detectorId, candidate) {
  return `${detectorId}-${sha256(candidateKey(candidate)).slice(0, 12)}`;
}

async function runDetectors(
  ai,
  branch,
  facts,
  externalDestinations,
  { cacheDir, resume },
) {
  const outputs = [];
  for (const detector of DETECTORS) {
    let successfulPasses = 0;
    for (let pass = 1; pass <= DETECTOR_PASSES; pass += 1) {
      const prompt = `${commonPrompt(
        branch,
        facts,
        detector.id === "placement-boundary-agent" ? externalDestinations : [],
      )}

Your role:
${detector.role}

Return one JSON object with a "candidates" array. Each candidate must include
"issueType", "detectorConfidence" ("high", "medium", or "low"), and the fields
specified below:
${detector.schema}

Return at most 40 plausible candidates across confidence levels. Confidence is
descriptive metadata only: do not suppress a plausible issue because confidence
is low, and do not assume a high-confidence candidate will be applied. Do not
include commentary outside the JSON object.`;
      try {
        const output = await runCachedStage({
          cacheFile: path.join(cacheDir, `${detector.id}-pass-${pass}.json`),
          inputSha256: sha256(
            JSON.stringify({
              stage: detector.id,
              pass,
              model: MODEL,
              prompt,
            }),
          ),
          resume,
          run: async () => {
            const response = await callAgent(
              ai,
              `${detector.id}-pass-${pass}`,
              prompt,
            );
            const candidates = Array.isArray(response.parsed?.candidates)
              ? response.parsed.candidates
              : [];
            return {
              detectorId: detector.id,
              pass,
              raw: response.text,
              candidates: candidates.map((candidate) => ({
                ...candidate,
                candidateId: stableCandidateId(detector.id, candidate),
                detectorId: detector.id,
              })),
            };
          },
        });
        successfulPasses += 1;
        outputs.push(output);
      } catch (error) {
        outputs.push({
          detectorId: detector.id,
          pass,
          raw: "",
          error: error instanceof Error ? error.message : String(error),
          candidates: [],
        });
      }
    }
    if (successfulPasses === 0) {
      const failures = outputs
        .filter((output) => output.detectorId === detector.id && output.error)
        .map((output) => `pass ${output.pass}: ${output.error}`);
      throw new Error(
        `Every ${detector.id} pass failed. ${failures.join(" | ")}`,
      );
    }
  }
  return outputs;
}

function deterministicOverlapCandidates(index, branch) {
  const candidates = [];
  for (const edge of directChildEdges(index, branch, { semanticOnly: true })) {
    const title = titleFor(index, edge.childId);
    const match = title.match(new RegExp(`^${branch} \\(([^)]+)\\)$`, "i"));
    if (!match) continue;
    const normalized = `${branch} ${match[1].toLowerCase()}`;
    const counterpartIds = index.idsByTitle.get(normalized) || [];
    if (counterpartIds.length !== 1 || counterpartIds[0] === edge.childId) {
      continue;
    }
    const counterpartEdge = (
      index.parentEdgesByChild.get(counterpartIds[0]) || []
    ).find((candidate) => candidate.parentId === index.rootId);
    if (!counterpartEdge) continue;
    const candidate = {
      issueType: "misc-facet-duplicate",
      parentTitle: branch,
      firstTitle: title,
      firstCollection: edge.collectionName,
      secondTitle: normalized,
      secondCollection: counterpartEdge.collectionName,
      rationale: `"${title}" and "${normalized}" differ only in facet notation and appear under separate specialization collections of the same parent.`,
      detectorId: "deterministic-facet-overlap-scan",
    };
    candidates.push({
      ...candidate,
      candidateId: stableCandidateId(candidate.detectorId, candidate),
    });
  }
  return candidates;
}

function deterministicCollectionPolicyCandidates(index, branch) {
  const directEdges = directChildEdges(index, branch, {
    semanticOnly: true,
  });
  const policy = detectRedundantCollectionPolicy({
    branch,
    children: directEdges.map((edge) => ({
      collectionName: edge.collectionName,
      title: titleFor(index, edge.childId),
    })),
  });
  if (!policy) return [];
  const {
    proposedCollectionName,
    proposedBranchTitles,
    retiredCollectionNames,
    retiredPlaceholderTitles,
  } = policy;
  const candidate = {
    issueType: "collection-design",
    parentTitle: branch,
    proposedCollectionName,
    proposedBranches: proposedBranchTitles
      .map((title) => ({
        title,
        status: "existing",
        children: [],
      }))
      .sort((left, right) => left.title.localeCompare(right.title, "en")),
    collectionPolicy: {
      retiredCollectionNames,
      retiredPlaceholderTitles,
    },
    rationale: `The generic ${retiredCollectionNames
      .map((name) => `"${name}"`)
      .join(
        " and ",
      )} structure duplicates the explicit "${proposedCollectionName}" specialization dimension. Review whether every current child can be accounted for under the explicit dimension before retiring the generic collection or placeholder; this proposal does not delete anything automatically.`,
    detectorId: "deterministic-collection-policy-scan",
    requiresPolicyReview: true,
  };
  return [
    {
      ...candidate,
      candidateId: stableCandidateId(candidate.detectorId, candidate),
    },
  ];
}

function hasOnlyNumberChange(currentTitle, proposedTitle) {
  const normalize = (value) =>
    clean(value)
      .toLowerCase()
      .replace(/\b(ies)\b/g, "y")
      .replace(/\b(s)\b/g, "")
      .replace(/\s+/g, " ");
  return normalize(currentTitle) === normalize(proposedTitle);
}

function candidateTitles(candidate) {
  return [
    candidate.nodeTitle,
    candidate.currentParentTitle,
    candidate.candidateHome,
    candidate.canonicalTitle,
    candidate.canonicalParentTitle,
    candidate.candidateTitle,
    candidate.candidateParentTitle,
    candidate.parentTitle,
    candidate.firstTitle,
    candidate.secondTitle,
    ...(candidate.proposedChildren || []),
    ...(candidate.proposedBranches || []).flatMap((branch) => [
      ...(branch.status === "existing" ? [branch.title] : []),
      ...(branch.children || []),
    ]),
  ]
    .map(clean)
    .filter(Boolean);
}

function preflightCandidate(candidate, index) {
  const issueType = clean(candidate.issueType);
  const allowed = new Set([
    "title-clarity",
    "synonym-enrichment",
    "mistaken-synonym",
    "duplicate-synonym",
    "polysemy",
    "misc-facet-duplicate",
    "flat-list-grouping",
    "compound-object-grouping",
    "collection-design",
    "placement",
    "wrong-verb",
  ]);
  if (!allowed.has(issueType)) return "unsupported issue type";
  for (const title of candidateTitles(candidate)) {
    if ((index.idsByTitle.get(title) || []).length !== 1) {
      return `title is missing or ambiguous: ${title}`;
    }
  }

  try {
    if (issueType === "title-clarity") {
      if (
        !clean(candidate.proposedTitle) ||
        clean(candidate.proposedTitle) === clean(candidate.nodeTitle)
      ) {
        return "title proposal has no change";
      }
      if (hasOnlyNumberChange(candidate.nodeTitle, candidate.proposedTitle)) {
        return "title proposal only changes grammatical number";
      }
      if (candidate.currentParentTitle) {
        sourceEdge(index, candidate.currentParentTitle, candidate.nodeTitle);
      }
    }
    if (issueType === "synonym-enrichment") {
      if (
        !Array.isArray(candidate.proposedSynonyms) ||
        !candidate.proposedSynonyms.length
      ) {
        return "no proposed synonyms";
      }
    }
    if (issueType === "mistaken-synonym") {
      const node = index.nodesById.get(
        uniqueIdForTitle(index, candidate.nodeTitle),
      );
      const recorded = new Set(allRecordedSynonyms(node));
      if (
        !Array.isArray(candidate.removeSynonyms) ||
        !candidate.removeSynonyms.length ||
        candidate.removeSynonyms.some((value) => !recorded.has(clean(value)))
      ) {
        return "proposed removal is not currently recorded";
      }
    }
    if (issueType === "duplicate-synonym") {
      if (candidate.canonicalTitle === candidate.candidateTitle) {
        return "duplicate candidate compares a node with itself";
      }
      sourceEdge(
        index,
        candidate.canonicalParentTitle,
        candidate.canonicalTitle,
      );
      sourceEdge(
        index,
        candidate.candidateParentTitle,
        candidate.candidateTitle,
      );
    }
    if (issueType === "polysemy") {
      sourceEdge(index, candidate.currentParentTitle, candidate.nodeTitle);
      if (
        !Array.isArray(candidate.proposedSenses) ||
        candidate.proposedSenses.length < 2 ||
        candidate.proposedSenses.some(
          (sense) => !clean(sense.title) || !clean(sense.meaning),
        )
      ) {
        return "polysemy candidate lacks two explicit senses";
      }
    }
    if (issueType === "misc-facet-duplicate") {
      sourceEdge(index, candidate.parentTitle, candidate.firstTitle);
      sourceEdge(index, candidate.parentTitle, candidate.secondTitle);
    }
    if (
      issueType === "flat-list-grouping" ||
      issueType === "compound-object-grouping"
    ) {
      const direct = new Set(currentChildren(index, candidate.parentTitle));
      if (
        !clean(candidate.proposedGroupTitle) ||
        (index.idsByTitle.get(clean(candidate.proposedGroupTitle)) || [])
          .length ||
        !Array.isArray(candidate.proposedChildren) ||
        new Set(candidate.proposedChildren).size < 2 ||
        candidate.proposedChildren.some((title) => !direct.has(clean(title)))
      ) {
        return "grouping does not contain at least two exact direct children";
      }
    }
    if (issueType === "collection-design") {
      const direct = new Set(currentChildren(index, candidate.parentTitle));
      const assignedTitles = (candidate.proposedBranches || []).map((branch) =>
        clean(branch.title),
      );
      if (
        !clean(candidate.proposedCollectionName) ||
        clean(candidate.proposedCollectionName) === "main" ||
        !Array.isArray(candidate.proposedBranches) ||
        candidate.proposedBranches.length < 2 ||
        new Set(assignedTitles).size !== assignedTitles.length ||
        candidate.proposedBranches.some(
          (branch) =>
            branch.status !== "existing" ||
            (branch.children || []).length > 0 ||
            !direct.has(clean(branch.title)),
        )
      ) {
        return "collection design must assign existing direct activity children to one named collection without creating nodes";
      }
    }
    if (issueType === "placement" || issueType === "wrong-verb") {
      sourceEdge(index, candidate.currentParentTitle, candidate.nodeTitle);
      if (
        !clean(candidate.candidateHome) ||
        candidate.candidateHome === candidate.currentParentTitle
      ) {
        return "placement lacks a distinct exact destination";
      }
    }
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return "";
}

async function runCritic(ai, branch, facts, externalDestinations, candidates) {
  if (!candidates.length) return { raw: "", assessments: [] };
  const prompt = `${commonPrompt(branch, facts, externalDestinations)}

You are the independent conservative critic. The detector candidates below are
untrusted. Accept a candidate only when the supplied hierarchy and source tasks
provide clear evidence, the distinction is operationally useful, and the
proposal obeys every learned process constraint. Reject aesthetic regrouping,
mere word similarity, unsupported destinations, and duplicate proposals.

For synonym changes, remember that the synonym field exists to retain
alternative wording for the same activity. Reject a mistaken-synonym candidate
whose only rationale is that the synonym is a trivial, close, or morphological
variation of the title. Accept removal only when the candidate term denotes a
different action or meaning in the supplied context.

For grouping proposals:
${CRITIC_GROUPING_GUIDANCE}
Do not reject a coherent grouping merely because the current nodes are
technically usable without it. Reject a grouping when its proposed members are
near-synonyms that should instead receive an identity judgment, when one member
already subsumes the others, or when the group mixes distinct objects.

If a candidate identifies a real issue but contains a fixable wording or field
error, use "revise" and return only the corrected fields in "revisedFields".
In particular, make proposed activity titles concise and idiomatic while
preserving the exact meaning of the source task. Prefer standard contemporary
compound-word spelling.

Candidates:
${JSON.stringify(candidates)}

Return JSON:
{"assessments":[{"candidateId":"exact id","decision":"accept"|"reject"|"revise","confidence":"high"|"medium"|"low","rationale":"brief evidence-based reason","revisedFields":{}}]}
Include exactly one assessment for every candidateId and no other text.`;
  const response = await callAgent(
    ai,
    "independent-critic",
    prompt,
    ASSESSMENT_RESPONSE_SCHEMA,
  );
  return {
    raw: response.text,
    assessments: Array.isArray(response.parsed?.assessments)
      ? response.parsed.assessments
      : [],
  };
}

async function runContentVerifier(ai, branch, index, candidates) {
  const relevant = candidates.filter((candidate) =>
    CONTENT_VERIFICATION_ISSUE_TYPES.has(candidate.issueType),
  );
  if (!relevant.length) return { raw: "", assessments: [] };
  const packets = relevant.map((candidate) => {
    if (candidate.issueType === "title-clarity") {
      const node = index.nodesById.get(
        uniqueIdForTitle(index, candidate.nodeTitle),
      );
      return {
        candidateId: candidate.candidateId,
        issueType: candidate.issueType,
        currentTitle: candidate.nodeTitle,
        proposedTitle: candidate.proposedTitle,
        description: clean(node?.properties?.description),
        sourceTasks: sourceTasksForNode(index, candidate.nodeTitle),
      };
    }
    if (candidate.issueType === "duplicate-synonym") {
      const canonicalNode = index.nodesById.get(
        uniqueIdForTitle(index, candidate.canonicalTitle),
      );
      const candidateNode = index.nodesById.get(
        uniqueIdForTitle(index, candidate.candidateTitle),
      );
      return {
        candidateId: candidate.candidateId,
        issueType: candidate.issueType,
        canonical: {
          title: candidate.canonicalTitle,
          description: clean(canonicalNode?.properties?.description),
          sourceTasks: sourceTasksForNode(index, candidate.canonicalTitle),
        },
        candidate: {
          title: candidate.candidateTitle,
          description: clean(candidateNode?.properties?.description),
          sourceTasks: sourceTasksForNode(index, candidate.candidateTitle),
        },
      };
    }
    const node = index.nodesById.get(
      uniqueIdForTitle(index, candidate.nodeTitle),
    );
    return {
      candidateId: candidate.candidateId,
      issueType: candidate.issueType,
      node: {
        title: candidate.nodeTitle,
        description: clean(node?.properties?.description),
        sourceTasks: sourceTasksForNode(index, candidate.nodeTitle),
        structuredSynonyms: structuredSynonyms(node),
      },
      proposedSynonyms: candidate.proposedSynonyms || [],
      removeSynonyms: candidate.removeSynonyms || [],
    };
  });
  const prompt = `
You are the final content-verification specialist for the "${branch}"
ontology sub-branch.

For title-clarity candidates:
- Accept only if the proposed title is idiomatic and preserves every meaning
  expressed by the supplied evidence.
- Reject a title that narrows away one of multiple objects or actions.
- Use "revise" when a standard spelling or concise wording fixes the proposal.
- Do not add unsupported specificity.

For duplicate-synonym candidates:
- Accept only if the nodes name the same activity and are substitutable in
  every supplied evidence context.
- A prerequisite, search step, planning step, broader category, narrower
  category, or adjacent action is not a synonym of completing a transaction.
- Treat terms coordinated by "and", "or", or "other" in one source task as
  evidence that the source distinguishes them, unless separate evidence clearly
  establishes substitutability.
- Reject pairs where one is a subtype, component, input, outcome, or
  preparatory shopping/search activity relative to the other.

For synonym-enrichment candidates:
- Accept only additions that name the same activity and are not already
  represented in the structured synonym field.
- Reject related activities, broader or narrower activities, and no-op edits.

For mistaken-synonym candidates:
- Accept removal only when the recorded synonym names a meaningfully different
  activity and is not substitutable for the node title in the evidence context.
- Reject removal based merely on a close lexical, morphological, or verb
  variation. Such alternatives are the purpose of the synonym field.
- A rationale that calls a term a "trivial variation" supports keeping it.

Candidates with evidence:
${JSON.stringify(packets)}

Return JSON:
{"assessments":[{"candidateId":"exact id","decision":"accept"|"reject"|"revise","rationale":"brief reason","revisedFields":{}}]}
For a revised title, revisedFields may contain only {"proposedTitle":"..."}.
For a revised synonym change, revisedFields may contain only
{"proposedSynonyms":[...]} or {"removeSynonyms":[...]}.
Include exactly one assessment per candidate and no other text.`;
  const response = await callAgent(
    ai,
    "content-verification-specialist",
    prompt,
    ASSESSMENT_RESPONSE_SCHEMA,
  );
  return {
    raw: response.text,
    assessments: Array.isArray(response.parsed?.assessments)
      ? response.parsed.assessments
      : [],
  };
}

function normalizePlacementCandidates(candidates, index, branch) {
  const root = index.nodesById.get(index.rootId);
  const removedRootActions = new Set(
    candidates
      .filter(
        (candidate) =>
          candidate.issueType === "mistaken-synonym" &&
          candidate.nodeTitle === branch,
      )
      .flatMap((candidate) => candidate.removeSynonyms || [])
      .map((value) => clean(value).toLowerCase()),
  );
  const allowedRootActions = new Set(
    [branch, ...allRecordedSynonyms(root)]
      .map((value) => clean(value).toLowerCase())
      .filter((value) => !removedRootActions.has(value)),
  );
  const overlapPairs = new Set(
    candidates
      .filter((candidate) => candidate.issueType === "misc-facet-duplicate")
      .flatMap((candidate) => [
        `${candidate.firstTitle}\u001f${candidate.secondTitle}`,
        `${candidate.secondTitle}\u001f${candidate.firstTitle}`,
      ]),
  );
  const rejected = [];
  const normalized = candidates.flatMap((candidate) => {
    if (
      candidate.issueType !== "placement" &&
      candidate.issueType !== "wrong-verb"
    ) {
      return [candidate];
    }
    if (
      overlapPairs.has(
        `${candidate.currentParentTitle}\u001f${candidate.candidateHome}`,
      )
    ) {
      rejected.push({
        candidateId: candidate.candidateId,
        detectorId: candidate.detectorId,
        decision: "reject",
        stage: "placement-normalization",
        reason:
          "The proposed destination is the counterpart in a pending facet-overlap merge, so a separate move would be redundant.",
        candidate,
      });
      return [];
    }
    const targetIsExternal = !index.pathsById.has(
      (index.idsByTitle.get(candidate.candidateHome) || [])[0],
    );
    if (
      targetIsExternal &&
      /(?:^|\s)perform\b|\(action\)|^provide service(?:\s*\(\d+\))?$/i.test(
        candidate.candidateHome,
      )
    ) {
      rejected.push({
        candidateId: candidate.candidateId,
        detectorId: candidate.detectorId,
        decision: "reject",
        stage: "placement-normalization",
        reason:
          "The proposed external destination is a generic framework category rather than a sufficiently specific action.",
        candidate,
      });
      return [];
    }
    if (candidate.issueType !== "wrong-verb") return [candidate];

    const leadingAction = clean(candidate.nodeTitle)
      .split(/\s+/)[0]
      .toLowerCase();
    const nodeId = uniqueIdForTitle(index, candidate.nodeTitle);
    const ancestorActions = new Set(
      (index.pathsById.get(nodeId) || [])
        .slice(0, -1)
        .filter((part) => !String(part).startsWith("["))
        .map((part) => clean(part).split(/\s+/)[0].toLowerCase()),
    );
    if (
      allowedRootActions.has(leadingAction) ||
      ancestorActions.has(leadingAction)
    ) {
      return [
        {
          ...candidate,
          issueType: "placement",
          criticRationale:
            candidate.criticRationale ||
            "The activity remains within the branch but appears under the wrong internal parent.",
        },
      ];
    }
    return [candidate];
  });
  return { normalized, rejected };
}

function externalDestinationFacts(allNodes, descendants, facts) {
  const matches = new Map();
  for (const node of allNodes.values()) {
    const title = clean(node.title);
    const words = title.split(/\s+/);
    const semanticChildCount = (node.specializations || []).reduce(
      (count, collection) => count + (collection.nodes || []).length,
      0,
    );
    if (
      descendants.has(node.id) ||
      isEvidence(node) ||
      /^\[/.test(title) ||
      words.length > 3 ||
      (words.length > 1 && semanticChildCount < 3)
    ) {
      continue;
    }
    matches.set(title, [
      ...(matches.get(title) || []),
      { ...node, semanticChildCount },
    ]);
  }
  return [...matches.entries()]
    .filter(([, nodes]) => nodes.length === 1)
    .map(([title, [node]]) => ({
      title,
      description: clean(node.properties?.description),
      childCount: node.semanticChildCount,
    }))
    .sort(
      (left, right) =>
        right.childCount - left.childCount ||
        left.title.localeCompare(right.title, "en"),
    )
    .slice(0, 600);
}

function addReferenceTargets({ candidates, allNodes, descendants, index }) {
  const targets = new Set(
    candidates
      .filter((candidate) =>
        ["placement", "wrong-verb"].includes(candidate.issueType),
      )
      .map((candidate) => clean(candidate.candidateHome))
      .filter(Boolean),
  );
  for (const target of targets) {
    if ((index.idsByTitle.get(target) || []).length === 1) continue;
    const globalMatches = [...allNodes.values()].filter(
      (node) => clean(node.title) === target,
    );
    if (globalMatches.length !== 1 || descendants.has(globalMatches[0].id)) {
      continue;
    }
    const node = globalMatches[0];
    index.nodesById.set(node.id, node);
    index.idsByTitle.set(target, [node.id]);
  }
}

function deriveRefs(context, index, subject) {
  const referenced = new Set();
  const addTitle = (title) => {
    const id = uniqueIdForTitle(index, title);
    referenced.add(id);
    return id;
  };
  let subjectNodeId = "";
  let parentNodeId = "";

  switch (context.type) {
    case "title-comparison": {
      subjectNodeId = addTitle(context.currentTitle);
      const parentLabel = clean(subject?.parentTitle);
      if (parentLabel) {
        if (/^\[[^\]]+\]$/.test(parentLabel)) {
          const sourcePath = Array.isArray(subject?.path) ? subject.path : [];
          const collectionIndex = sourcePath.lastIndexOf(parentLabel);
          const actualParentTitle = sourcePath
            .slice(0, collectionIndex)
            .reverse()
            .find(
              (part) => typeof part === "string" && !/^\[[^\]]+\]$/.test(part),
            );
          if (!actualParentTitle) {
            throw new Error(
              `Cannot resolve title parent from path: ${parentLabel}`,
            );
          }
          parentNodeId = addTitle(actualParentTitle);
          if (
            !index.edgeKeys.has(
              edgeKey(
                parentNodeId,
                subjectNodeId,
                normalizeCollection(parentLabel),
              ),
            )
          ) {
            throw new Error("title proposal is not bound to its collection");
          }
        } else {
          parentNodeId = addTitle(parentLabel);
          if (
            !index.edgeKeys.has(edgeKey(parentNodeId, subjectNodeId, "main"))
          ) {
            throw new Error("title proposal is not bound to its parent");
          }
        }
      }
      break;
    }
    case "metadata-edit":
      subjectNodeId = addTitle(context.nodeTitle);
      break;
    case "duplicate-comparison": {
      const canonicalParentId = addTitle(
        context.canonicalParentTitle || context.parentTitle,
      );
      parentNodeId = addTitle(
        context.candidateParentTitle || context.parentTitle,
      );
      addTitle(context.canonicalTitle);
      subjectNodeId = addTitle(context.candidateSynonymTitle);
      if (
        !index.edgePairs.has(
          edgePair(
            canonicalParentId,
            uniqueIdForTitle(index, context.canonicalTitle),
          ),
        ) ||
        !index.edgePairs.has(edgePair(parentNodeId, subjectNodeId))
      ) {
        throw new Error("duplicate comparison is not bound to current edges");
      }
      break;
    }
    case "polysemy-review":
      parentNodeId = addTitle(context.currentParentTitle);
      subjectNodeId = addTitle(context.nodeTitle);
      if (!index.edgePairs.has(edgePair(parentNodeId, subjectNodeId))) {
        throw new Error("polysemy proposal is not bound to a current edge");
      }
      for (const sense of context.proposedSenses || []) {
        if ((index.idsByTitle.get(sense.title) || []).length === 1) {
          addTitle(sense.title);
        }
      }
      break;
    case "overlap-comparison": {
      parentNodeId = addTitle(context.parentTitle);
      subjectNodeId = addTitle(context.firstTitle);
      addTitle(context.secondTitle);
      break;
    }
    case "grouping-outline":
      parentNodeId = addTitle(context.parentTitle);
      for (const title of [
        ...(context.proposedChildren || []),
        ...(context.unaffectedChildren || []),
      ]) {
        addTitle(title);
      }
      break;
    case "collection-design":
      parentNodeId = addTitle(context.parentTitle);
      for (const title of context.currentChildren || []) addTitle(title);
      for (const branch of context.proposedBranches || []) {
        if (branch.status !== "existing" || (branch.children || []).length) {
          throw new Error(
            "collection design cannot create activities or alter their descendants",
          );
        }
        const childId = addTitle(branch.title);
        if (!index.edgePairs.has(edgePair(parentNodeId, childId))) {
          throw new Error(
            "collection design is not bound to an existing direct child",
          );
        }
      }
      break;
    case "placement-comparison":
      parentNodeId = addTitle(context.currentParentTitle);
      subjectNodeId = addTitle(context.nodeTitle);
      if (!index.edgePairs.has(edgePair(parentNodeId, subjectNodeId))) {
        throw new Error("placement proposal is not bound to a current edge");
      }
      if ((index.idsByTitle.get(context.candidateHome) || []).length === 1) {
        addTitle(context.candidateHome);
      }
      break;
    case "merge-action": {
      addTitle(context.canonicalParentTitle || context.parentTitle);
      parentNodeId = addTitle(
        context.absorbedParentTitle || context.parentTitle,
      );
      addTitle(context.canonicalTitle);
      subjectNodeId = addTitle(context.absorbedTitle);
      for (const title of [
        ...(context.canonicalChildren || []),
        ...(context.absorbedChildren || []),
      ]) {
        addTitle(title);
      }
      break;
    }
    case "relocation-action":
      parentNodeId = addTitle(context.currentParentTitle);
      subjectNodeId = addTitle(context.nodeTitle);
      addTitle(context.proposedParentTitle);
      for (const title of context.childTitles || []) addTitle(title);
      break;
    default:
      throw new Error(`Unsupported generated context: ${context.type}`);
  }
  return {
    subjectNodeId,
    parentNodeId,
    referencedNodeIds: [...referenced].sort(),
  };
}

function issueDefinition(issueType) {
  const issue = ISSUE_DEFINITIONS.find(
    (candidate) => candidate.id === issueType,
  );
  if (!issue) throw new Error(`Unknown issue type: ${issueType}`);
  return issue;
}

function makeRecord({
  candidate,
  context,
  subject,
  reviewerView,
  datasetVersion,
  branch,
  generatedAt,
  ontologyAppId,
  ontologyName,
  sourceOntology,
  snapshotHash,
  index,
  workflow = {},
  key,
}) {
  const issue = issueDefinition(candidate.issueType);
  const actionTypes = new Set(["node-merge", "relocation", "sense-relocation"]);
  const oneStepMove =
    ["placement", "wrong-verb"].includes(candidate.issueType) &&
    context.type === "placement-comparison" &&
    Boolean(context.candidateHome);
  const refs = deriveRefs(context, index, subject);
  return {
    schemaVersion: REVIEW_SCHEMA_VERSION,
    datasetVersion,
    proposalId: proposalId(datasetVersion, candidate.issueType, key),
    branch,
    issueType: candidate.issueType,
    reviewMode: candidate.reviewMode || "proposed-change",
    rolloutStatus: "experimental",
    workflow: {
      robTaskIds: issue.robTaskIds,
      stage: issue.stage,
      proposalKind:
        actionTypes.has(candidate.issueType) || oneStepMove
          ? "action"
          : candidate.issueType === "collection-design"
            ? "design"
            : "diagnosis",
      dependsOnProposalIds: [],
      ...workflow,
    },
    subject: {
      title: subject.title,
      parentTitle: subject.parentTitle || "",
      path: subject.path || [],
      relatedTitles: subject.relatedTitles || [],
    },
    reviewerView: {
      ...reviewerView,
      context,
      agreeLabel: reviewerView.agreeLabel || "Agree",
      disagreeLabel: reviewerView.disagreeLabel || "Disagree",
      rejectionReasonRequired: true,
      autoAdvanceOnAgree: true,
      hideModelConfidence: true,
    },
    internalModelEvidence: {
      detectorId: candidate.detectorId,
      detectorName: candidate.detectorId,
      detectorPromptVersion: PIPELINE_PROMPT_VERSION,
      judgeId: "independent-critic",
      judgeName: "IndependentConservativeCritic",
      judgePromptVersion: PIPELINE_PROMPT_VERSION,
      detectorConfidence: clean(candidate.detectorConfidence) || "unknown",
      judgeConfidence: clean(candidate.judgeConfidence) || "unknown",
      reviewerVisible: false,
    },
    provenance: {
      sourceOntology,
      sourceOntologySha256: snapshotHash,
      sourceArtifact: `society-of-mind://${branch.toLowerCase()}/exploratory-candidate-audit.json`,
      sourceRecord: key,
      sourceOntologyAppId: ontologyAppId,
      sourceOntologyName: ontologyName,
      sourceSnapshotSha256: snapshotHash,
      ...refs,
    },
    createdAt: generatedAt,
  };
}

function nodeSubject(index, nodeTitle, parentTitle = "") {
  const nodeId = uniqueIdForTitle(index, nodeTitle);
  const edge = parentTitle ? sourceEdge(index, parentTitle, nodeTitle) : null;
  return {
    title: nodeTitle,
    parentTitle:
      edge && edge.collectionName !== "main"
        ? `[${edge.collectionName}]`
        : parentTitle,
    path: index.pathsById.get(nodeId) || [],
    relatedTitles: [],
  };
}

function recordForCandidate(candidate, config) {
  const { index, branch } = config;
  const rationale = clean(candidate.criticRationale || candidate.rationale);
  const issueType = candidate.issueType;
  let context;
  let subject;
  let reviewerView;

  if (issueType === "title-clarity") {
    context = {
      type: "title-comparison",
      currentTitle: candidate.nodeTitle,
      proposedTitle: candidate.proposedTitle,
      linkedTasks: sourceTasksForNode(index, candidate.nodeTitle),
    };
    subject = nodeSubject(
      index,
      candidate.nodeTitle,
      candidate.currentParentTitle,
    );
    reviewerView = {
      question: `Is "${candidate.proposedTitle}" clearer than "${candidate.nodeTitle}"?`,
      currentState: candidate.nodeTitle,
      proposedState: candidate.proposedTitle,
      reasoning: rationale,
    };
  } else if (
    issueType === "synonym-enrichment" ||
    issueType === "mistaken-synonym"
  ) {
    const node = index.nodesById.get(
      uniqueIdForTitle(index, candidate.nodeTitle),
    );
    const currentValues =
      issueType === "mistaken-synonym"
        ? allRecordedSynonyms(node)
        : structuredSynonyms(node);
    const proposedValues =
      issueType === "mistaken-synonym"
        ? currentValues.filter(
            (value) =>
              !(candidate.removeSynonyms || [])
                .map(clean)
                .includes(clean(value)),
          )
        : [
            ...new Set([
              ...currentValues,
              ...(candidate.proposedSynonyms || []).map(clean),
            ]),
          ].sort((left, right) => left.localeCompare(right, "en"));
    context = {
      type: "metadata-edit",
      nodeTitle: candidate.nodeTitle,
      field: "synonyms",
      currentValues,
      proposedValues,
      synonymScope:
        issueType === "mistaken-synonym" ? "all-recorded" : "structured-field",
      sourceTasks: sourceTasksForNode(index, candidate.nodeTitle),
    };
    subject = nodeSubject(index, candidate.nodeTitle);
    reviewerView = {
      question: "Should this structured synonym change be made?",
      currentState: currentValues.length
        ? currentValues.join(", ")
        : "No structured synonyms are recorded.",
      proposedState: proposedValues.join(", "),
      reasoning: rationale,
    };
  } else if (issueType === "duplicate-synonym") {
    context = {
      type: "duplicate-comparison",
      parentTitle: candidate.candidateParentTitle,
      canonicalParentTitle: candidate.canonicalParentTitle,
      candidateParentTitle: candidate.candidateParentTitle,
      canonicalTitle: candidate.canonicalTitle,
      candidateSynonymTitle: candidate.candidateTitle,
      sourceTasks: sourceTasksForNodes(index, [
        candidate.canonicalTitle,
        candidate.candidateTitle,
      ]),
    };
    subject = nodeSubject(
      index,
      candidate.candidateTitle,
      candidate.candidateParentTitle,
    );
    subject.relatedTitles = [candidate.canonicalTitle];
    reviewerView = {
      question: "Do these two titles name the same activity?",
      currentState: `"${candidate.canonicalTitle}" and "${candidate.candidateTitle}" are separate nodes.`,
      proposedState: `Record "${candidate.candidateTitle}" as a synonym of "${candidate.canonicalTitle}".`,
      reasoning: rationale,
    };
  } else if (issueType === "polysemy") {
    context = {
      type: "polysemy-review",
      nodeTitle: candidate.nodeTitle,
      currentParentTitle: candidate.currentParentTitle,
      sourceTasks: sourceTasksForNode(index, candidate.nodeTitle),
      proposedSenses: candidate.proposedSenses.map((sense) => ({
        title: clean(sense.title),
        meaning: clean(sense.meaning),
      })),
    };
    subject = nodeSubject(
      index,
      candidate.nodeTitle,
      candidate.currentParentTitle,
    );
    reviewerView = {
      question: `Does "${candidate.nodeTitle}" combine meanings that should be represented separately?`,
      currentState: `"${candidate.nodeTitle}" currently represents one node.`,
      proposedState:
        "Represent the distinct meanings as separate activity nodes.",
      reasoning: rationale,
    };
  } else if (issueType === "misc-facet-duplicate") {
    context = {
      type: "overlap-comparison",
      parentTitle: candidate.parentTitle,
      firstCollection: candidate.firstCollection,
      firstTitle: candidate.firstTitle,
      secondCollection: candidate.secondCollection,
      secondTitle: candidate.secondTitle,
      sourceTasks: sourceTasksForNodes(index, [
        candidate.firstTitle,
        candidate.secondTitle,
      ]),
    };
    subject = {
      title: candidate.firstTitle,
      parentTitle: candidate.parentTitle,
      path:
        index.pathsById.get(uniqueIdForTitle(index, candidate.firstTitle)) ||
        [],
      relatedTitles: [candidate.secondTitle],
    };
    reviewerView = {
      question: `Could "${candidate.firstTitle}" and "${candidate.secondTitle}" represent the same concept?`,
      currentState:
        "The concepts appear in separate specialization collections.",
      proposedState:
        "Treat them as a possible overlap; review any exact merge separately.",
      reasoning: rationale,
    };
  } else if (
    issueType === "flat-list-grouping" ||
    issueType === "compound-object-grouping"
  ) {
    const direct = currentChildren(index, candidate.parentTitle);
    context = {
      type: "grouping-outline",
      parentTitle: candidate.parentTitle,
      structure: "intermediate",
      proposedGroupTitle: candidate.proposedGroupTitle,
      proposedChildren: [...new Set(candidate.proposedChildren.map(clean))],
      unaffectedChildren: direct.filter(
        (title) => !candidate.proposedChildren.map(clean).includes(title),
      ),
      sourceTasks: sourceTasksForNodes(index, candidate.proposedChildren),
    };
    subject = {
      title: candidate.proposedGroupTitle,
      parentTitle: candidate.parentTitle,
      path:
        index.pathsById.get(uniqueIdForTitle(index, candidate.parentTitle)) ||
        [],
      relatedTitles: context.proposedChildren,
    };
    reviewerView = {
      question: `Should "${candidate.proposedGroupTitle}" be created under "${candidate.parentTitle}"?`,
      currentState: `${context.proposedChildren.join(", ")} are direct children of "${candidate.parentTitle}".`,
      proposedState: `Create "${candidate.proposedGroupTitle}" and move the highlighted children beneath it.`,
      reasoning: rationale,
    };
  } else if (issueType === "collection-design") {
    context = {
      type: "collection-design",
      parentTitle: candidate.parentTitle,
      currentChildren: currentChildren(index, candidate.parentTitle),
      proposedCollectionName: candidate.proposedCollectionName,
      proposedBranches: candidate.proposedBranches.map((branch) => ({
        title: clean(branch.title),
        status: branch.status,
        children: [...new Set((branch.children || []).map(clean))],
      })),
      sourceTasks: sourceTasksForNodes(
        index,
        candidate.proposedBranches.map((item) => item.title),
      ),
    };
    subject = {
      title: candidate.proposedCollectionName,
      parentTitle: candidate.parentTitle,
      path:
        index.pathsById.get(uniqueIdForTitle(index, candidate.parentTitle)) ||
        [],
      relatedTitles: context.proposedBranches.map((item) => item.title),
    };
    reviewerView = {
      question: candidate.collectionPolicy
        ? `Should "${candidate.proposedCollectionName}" replace the redundant generic collection structure under "${candidate.parentTitle}"?`
        : `Should "${candidate.parentTitle}" use the proposed "${candidate.proposedCollectionName}" collection?`,
      currentState: candidate.collectionPolicy
        ? `The explicit "${candidate.proposedCollectionName}" dimension coexists with ${candidate.collectionPolicy.retiredCollectionNames
            .map((name) => `"${name}"`)
            .join(" and ")}${
            candidate.collectionPolicy.retiredPlaceholderTitles.length
              ? ` and ${candidate.collectionPolicy.retiredPlaceholderTitles
                  .map((title) => `"${title}"`)
                  .join(" and ")}`
              : ""
          }.`
        : "The current direct children are not organized along this dimension.",
      proposedState: candidate.collectionPolicy
        ? `Account for every current child under "${candidate.proposedCollectionName}", then retire the redundant generic collection or placeholder in a separately reviewed application plan.`
        : `Place the listed existing direct children in the "${candidate.proposedCollectionName}" collection without changing the hierarchy.`,
      reasoning: rationale,
    };
  } else if (issueType === "placement" || issueType === "wrong-verb") {
    context = {
      type: "placement-comparison",
      nodeTitle: candidate.nodeTitle,
      currentParentTitle: candidate.currentParentTitle,
      currentBucket: sourceEdge(
        index,
        candidate.currentParentTitle,
        candidate.nodeTitle,
      ).collectionName,
      candidateHome: candidate.candidateHome,
      placementIssue:
        issueType === "wrong-verb" ? "wrong-verb" : "wrong-parent",
      sourceTasks: sourceTasksForNode(index, candidate.nodeTitle),
    };
    subject = nodeSubject(
      index,
      candidate.nodeTitle,
      candidate.currentParentTitle,
    );
    subject.relatedTitles = [candidate.candidateHome];
    reviewerView = {
      question: `Should "${candidate.nodeTitle}" move from "${candidate.currentParentTitle}" to "${candidate.candidateHome}"?`,
      currentState: `"${candidate.nodeTitle}" is currently under "${candidate.currentParentTitle}".`,
      proposedState: `Move the existing activity and its descendants to "${candidate.candidateHome}".`,
      reasoning: rationale,
      agreeLabel: "Approve move",
      disagreeLabel: "Reject proposed move",
    };
  } else {
    throw new Error(`Cannot build record for ${issueType}`);
  }

  return makeRecord({
    candidate,
    context,
    subject,
    reviewerView,
    ...config,
    key: candidate.recordKey || candidate.candidateId,
  });
}

function manualCheckRecordsForRejected(rejections, config) {
  const records = [];
  const seen = new Set();
  for (const rejection of rejections) {
    const candidate = rejection.candidate;
    if (
      !candidate ||
      seen.has(candidate.candidateId) ||
      preflightCandidate(candidate, config.index)
    ) {
      continue;
    }
    seen.add(candidate.candidateId);
    records.push(
      recordForCandidate(
        {
          ...candidate,
          reviewMode: "manual-check",
          recordKey: `manual-check:${candidate.candidateId}`,
          criticRationale: `The detector raised this possible issue, but an independent verification step did not confirm it: ${clean(
            rejection.reason,
          )} Review the supplied evidence directly. This question cannot authorize an ontology change without a separate accepted application plan.`,
        },
        config,
      ),
    );
  }
  return records;
}

function ancestorOf(index, ancestorTitle, descendantTitle) {
  const ancestorId = uniqueIdForTitle(index, ancestorTitle);
  const targetId = uniqueIdForTitle(index, descendantTitle);
  const visited = new Set();
  const queue = [ancestorId];
  while (queue.length) {
    const id = queue.shift();
    if (!id || visited.has(id)) continue;
    visited.add(id);
    if (id === targetId) return true;
    for (const edge of index.edgesByParent.get(id) || [])
      queue.push(edge.childId);
  }
  return false;
}

function exactActionRecords(diagnosisRecords, candidates, config) {
  const records = [];
  const diagnosisByCandidate = new Map(
    candidates.map((candidate, index) => [
      candidate.candidateId,
      diagnosisRecords[index],
    ]),
  );
  for (const candidate of candidates) {
    const diagnosis = diagnosisByCandidate.get(candidate.candidateId);
    if (!diagnosis) continue;
    if (
      candidate.issueType === "misc-facet-duplicate" ||
      candidate.issueType === "duplicate-synonym"
    ) {
      const canonicalTitle =
        candidate.issueType === "misc-facet-duplicate"
          ? candidate.secondTitle
          : candidate.canonicalTitle;
      const absorbedTitle =
        candidate.issueType === "misc-facet-duplicate"
          ? candidate.firstTitle
          : candidate.candidateTitle;
      if (
        ancestorOf(config.index, canonicalTitle, absorbedTitle) ||
        ancestorOf(config.index, absorbedTitle, canonicalTitle)
      ) {
        continue;
      }
      const canonicalParentTitle =
        candidate.issueType === "misc-facet-duplicate"
          ? candidate.parentTitle
          : candidate.canonicalParentTitle;
      const absorbedParentTitle =
        candidate.issueType === "misc-facet-duplicate"
          ? candidate.parentTitle
          : candidate.candidateParentTitle;
      const canonicalEdge = sourceEdge(
        config.index,
        canonicalParentTitle,
        canonicalTitle,
      );
      const absorbedEdge = sourceEdge(
        config.index,
        absorbedParentTitle,
        absorbedTitle,
      );
      const canonicalChildren = allCurrentChildren(
        config.index,
        canonicalTitle,
      );
      const absorbedChildren = allCurrentChildren(config.index, absorbedTitle);
      const context = {
        type: "merge-action",
        parentTitle: absorbedParentTitle,
        canonicalParentTitle,
        absorbedParentTitle,
        canonicalTitle,
        canonicalCollection: canonicalEdge.collectionName,
        canonicalChildren,
        absorbedTitle,
        absorbedCollection: absorbedEdge.collectionName,
        absorbedChildren,
        resultingChildren: [
          ...new Set([...canonicalChildren, ...absorbedChildren]),
        ].sort((left, right) => left.localeCompare(right, "en")),
        absorbedBecomesSynonym: true,
      };
      records.push(
        makeRecord({
          ...config,
          candidate: {
            ...candidate,
            issueType: "node-merge",
            detectorId: `${candidate.detectorId}-exact-action`,
          },
          context,
          subject: {
            title: absorbedTitle,
            parentTitle: absorbedParentTitle,
            path:
              config.index.pathsById.get(
                uniqueIdForTitle(config.index, absorbedTitle),
              ) || [],
            relatedTitles: [canonicalTitle],
          },
          reviewerView: {
            question: `Should "${absorbedTitle}" be merged into "${canonicalTitle}"?`,
            currentState:
              "The two nodes and their current direct children remain separate.",
            proposedState: `Keep "${canonicalTitle}", record "${absorbedTitle}" as a synonym, and move every direct child from the absorbed node.`,
            reasoning:
              "This exact action is available only after the reviewer agrees with the related identity diagnosis.",
          },
          workflow: {
            dependsOnProposalIds: [diagnosis.proposalId],
            conflictGroupId: `merge-${sha256(
              [canonicalTitle, absorbedTitle].sort().join("|"),
            ).slice(0, 12)}`,
          },
          key: `merge:${candidate.candidateId}`,
        }),
      );
    }
  }
  return records;
}

function snapshotFromIndex({
  index,
  descendants,
  ontologyAppId,
  ontologyName,
  projectId,
  environment,
  generatedAt,
  branch,
}) {
  const nodes = [...index.nodesById.values()]
    .map((node) => ({
      id: node.id,
      title: clean(node.title),
      description: clean(node.properties?.description),
      synsets: clean(node.synsets),
      actionAlternatives: Array.isArray(node.actionAlternatives)
        ? node.actionAlternatives.map(clean).filter(Boolean).sort()
        : [],
      ...(!descendants.has(node.id) ? { referenceOnly: true } : {}),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    ontologyAppId,
    ontologyName,
    firestoreProjectId: projectId,
    environment,
    capturedAt: generatedAt,
    branchRootNodeId: index.rootId,
    branchRootTitle: branch,
    nodes,
    edges: [...index.edges].sort((left, right) =>
      edgeKey(left.parentId, left.childId, left.collectionName).localeCompare(
        edgeKey(right.parentId, right.childId, right.collectionName),
      ),
    ),
  };
}

function writeDataset({
  outputDir,
  records,
  manualChecks,
  snapshot,
  snapshotHash,
  generatedAt,
  datasetVersion,
  branch,
  ontologyAppId,
  ontologyName,
  sourceOntology,
  reviewRelease,
  audit,
  rejected,
}) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.cpSync(
    path.join(BASE_DATASET_DIR, "schema"),
    path.join(outputDir, "schema"),
    {
      recursive: true,
    },
  );
  writeJson(path.join(outputDir, "ontology-snapshot.json"), snapshot);
  writeJsonl(path.join(outputDir, "all_proposals.jsonl"), records);
  writeJsonl(path.join(outputDir, "all_controls.jsonl"), []);
  writeJsonl(path.join(outputDir, "manual_checks.jsonl"), manualChecks);
  writeJsonl(
    path.join(outputDir, "diagnostics", "rejected_agent_candidates.jsonl"),
    rejected,
  );
  writeJson(
    path.join(outputDir, "diagnostics", "exploratory_candidate_audit.json"),
    audit,
  );
  for (const issue of ISSUE_DEFINITIONS) {
    writeJsonl(
      path.join(outputDir, "proposals", `${issue.id}.jsonl`),
      records.filter((record) => record.issueType === issue.id),
    );
    writeJsonl(path.join(outputDir, "controls", `${issue.id}.jsonl`), []);
  }

  const issueTypes = ISSUE_DEFINITIONS.map((issue) => ({
    ...issue,
    proposals: records.filter((record) => record.issueType === issue.id).length,
    controls: 0,
    manualChecks: manualChecks.filter((record) => record.issueType === issue.id)
      .length,
  }));
  const manifest = {
    schemaVersion: REVIEW_SCHEMA_VERSION,
    datasetVersion,
    branch,
    generatedAt,
    sourceOntology,
    sourceOntologySha256: snapshotHash,
    safety: {
      reviewOnly: true,
      mutatesOntology: false,
      approvalAuthorizesAutomaticWrite: false,
      modelConfidenceVisibleToReviewer: false,
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
    issueTypes,
    files: {
      allProposals: "all_proposals.jsonl",
      allControls: "all_controls.jsonl",
      manualChecks: "manual_checks.jsonl",
      proposalsByIssue: "proposals/<issue-type>.jsonl",
      controlsByIssue: "controls/<issue-type>.jsonl",
      rejectedAgentCandidates: "diagnostics/rejected_agent_candidates.jsonl",
      proposalSchema: "schema/review-proposal.schema.json",
      responseSchema: "schema/review-response.schema.json",
      schemaSource: "src/agents/review-proposal-contract.ts",
      ontologySnapshot: "ontology-snapshot.json",
    },
    counts: {
      proposals: records.length,
      controls: 0,
      manualChecks: manualChecks.length,
      rejectedAgentCandidates: rejected.length,
    },
    limitations: [
      `This is a provisional transfer run on ${branch}; it must be regenerated if the source ontology or learned process constraints change.`,
      "The independent critic is conservative, but accepted candidates remain hypotheses for expert review rather than validated ontology changes.",
      "Valid detector candidates rejected by a verification stage remain available as blinded manual checks; confidence never removes or applies an item.",
      "No Sell-specific examples or expert answers were supplied to the detector agents.",
      ...(audit.priorExpertTitleLocks?.count
        ? [
            `${audit.priorExpertTitleLocks.count} previously approved titles are locked while their source evidence remains unchanged.`,
          ]
        : []),
      "Deterministic facet-overlap checks identify structural equivalence candidates, not automatic merges.",
      "A target-known placement move is reviewed as one complete decision. Exact node consolidations and separated-sense relocations remain gated by their corresponding meaning diagnosis.",
      "This dataset is review-only and neither generation nor review acceptance writes to Firestore.",
    ],
    sourceSnapshot: {
      file: "ontology-snapshot.json",
      sha256: snapshotHash,
      ontologyAppId,
      ontologyName,
      environment: snapshot.environment,
      capturedAt: generatedAt,
      branchRootNodeId: snapshot.branchRootNodeId,
      branchRootTitle: branch,
      nodeCount: snapshot.nodes.length,
      branchNodeCount: snapshot.nodes.filter((node) => !node.referenceOnly)
        .length,
      referenceNodeCount: snapshot.nodes.filter((node) => node.referenceOnly)
        .length,
      edgeCount: snapshot.edges.length,
    },
    coverage: {
      snapshotBound: true,
      exhaustiveWithinPackagedDetectorOutputs: true,
      semanticCompletenessGuaranteed: false,
      detectorAgents: DETECTORS.map((detector) => detector.id),
      criticAgents: ["independent-critic"],
      note: "The run combines deterministic structural checks with four independent detector roles and one conservative critic. Zero candidates in an issue family means no surviving candidate was found, not that the branch is proven error-free.",
    },
    reviewRelease,
  };
  writeJson(path.join(outputDir, "manifest.json"), manifest);
}

async function main() {
  loadEnvConfig(REPO_ROOT);
  const args = parseArgs();
  const branch = clean(args.branch || "Buy");
  const environment = clean(args.environment || "production");
  const ontologyAppId = clean(
    args["ontology-app"] ||
      "final-hierarchy-with-o*net-rob-structure-applied-2026-07-25",
  );
  const ontologyName = clean(
    args["ontology-name"] ||
      "Final Hierarchy with O*Net - Rob Structure Applied 2026-07-25",
  );
  const datasetVersion = clean(
    args["dataset-version"] ||
      `${branch.toLowerCase()}-exploratory-transfer-2026-07-25-v1`,
  );
  const reviewWave = clean(args["review-wave"] || "title-clarity");
  const reviewRelease = reviewReleaseForWave(reviewWave, branch);
  const outputDir = path.resolve(
    args.output ||
      path.join(
        REPO_ROOT,
        `${branch}_Society_of_Mind_Exploratory_2026-07-25`,
        "review-datasets-exploratory-v1",
      ),
  );
  const resume = ["1", "true", "yes"].includes(
    clean(args.resume).toLowerCase(),
  );
  const approvedTitleLocks = approvedTitleLocksFromBenchmark(
    clean(args["approved-title-benchmark"]),
  );
  const stageCacheDir = path.join(outputDir, ".stage-cache");
  const generatedAt = new Date().toISOString();
  const apiKey = required(
    process.env.MIT_CCI_GEMINI_API_KEY || process.env.GEMINI_API_KEY,
    "MIT_CCI_GEMINI_API_KEY or GEMINI_API_KEY",
  );

  const live = await readOntology({
    environment,
    ontologyAppId,
    branch,
  });
  const index = buildWorkingIndex(
    live.root.id,
    live.allNodes,
    live.descendants,
    live.edges,
  );
  const duplicateBranchTitles = [...index.idsByTitle.entries()].filter(
    ([, ids]) => ids.length > 1,
  );
  if (duplicateBranchTitles.length) {
    throw new Error(
      `Branch contains ambiguous titles: ${duplicateBranchTitles
        .map(([title]) => title)
        .join(", ")}`,
    );
  }
  const facts = branchFacts(index);
  const externalDestinations = externalDestinationFacts(
    live.allNodes,
    live.descendants,
    facts,
  );
  const ai = new GoogleGenAI({ apiKey });
  const detectorOutputs = await runDetectors(
    ai,
    branch,
    facts,
    externalDestinations,
    {
      cacheDir: path.join(stageCacheDir, "detectors"),
      resume,
    },
  );
  const detectedByKey = new Map();
  for (const candidate of detectorOutputs.flatMap(
    (output) => output.candidates,
  )) {
    if (!detectedByKey.has(candidateKey(candidate))) {
      detectedByKey.set(candidateKey(candidate), candidate);
    }
  }
  const detected = [...detectedByKey.values()];
  const deterministic = [
    ...deterministicOverlapCandidates(index, branch),
    ...deterministicCollectionPolicyCandidates(index, branch),
  ];
  const allCandidates = [...deterministic, ...detected];

  addReferenceTargets({
    candidates: allCandidates,
    allNodes: live.allNodes,
    descendants: live.descendants,
    index,
  });
  const preflightRejected = [];
  const preflightReady = allCandidates.filter((candidate) => {
    const expertLockReason = expertTitleLockReason(
      candidate,
      index,
      approvedTitleLocks,
    );
    const reason = expertLockReason || preflightCandidate(candidate, index);
    if (!reason) return true;
    preflightRejected.push({
      candidateId: candidate.candidateId,
      detectorId: candidate.detectorId,
      decision: "reject",
      stage: expertLockReason
        ? "prior-expert-title-lock"
        : "deterministic-preflight",
      reason,
      candidate,
    });
    return false;
  });
  const critic = await runCachedStage({
    cacheFile: path.join(stageCacheDir, "critic.json"),
    inputSha256: sha256(
      JSON.stringify({
        stage: "independent-critic",
        model: MODEL,
        promptVersion: PIPELINE_PROMPT_VERSION,
        branch,
        facts,
        externalDestinations,
        candidates: preflightReady,
      }),
    ),
    resume,
    validate: (output) =>
      validateCompleteAssessments("independent-critic", preflightReady, output),
    run: () =>
      runCritic(ai, branch, facts, externalDestinations, preflightReady),
  });
  const assessmentById = new Map(
    critic.assessments.map((assessment) => [
      clean(assessment.candidateId),
      assessment,
    ]),
  );
  const criticRejected = [];
  const criticAccepted = preflightReady.flatMap((candidate) => {
    const assessment = assessmentById.get(candidate.candidateId);
    if (candidate.requiresPolicyReview) {
      return [
        {
          ...candidate,
          judgeConfidence: clean(assessment?.confidence) || "unknown",
          criticRationale:
            clean(assessment?.rationale) || clean(candidate.rationale),
        },
      ];
    }
    if (
      assessment?.decision !== "accept" &&
      assessment?.decision !== "revise"
    ) {
      criticRejected.push({
        candidateId: candidate.candidateId,
        detectorId: candidate.detectorId,
        decision: "reject",
        stage: "independent-critic",
        reason: clean(
          assessment?.rationale || "The critic did not return an acceptance.",
        ),
        candidate: {
          ...candidate,
          judgeConfidence: clean(assessment?.confidence) || "unknown",
        },
      });
      return [];
    }
    const revisedCandidate =
      assessment.decision === "revise" &&
      assessment.revisedFields &&
      typeof assessment.revisedFields === "object"
        ? {
            ...candidate,
            ...assessment.revisedFields,
            candidateId: candidate.candidateId,
            detectorId: candidate.detectorId,
          }
        : candidate;
    const revisedPreflightReason = preflightCandidate(revisedCandidate, index);
    if (revisedPreflightReason) {
      criticRejected.push({
        candidateId: candidate.candidateId,
        detectorId: candidate.detectorId,
        decision: "reject",
        stage: "post-critic-preflight",
        reason: revisedPreflightReason,
        candidate: revisedCandidate,
      });
      return [];
    }
    return [
      {
        ...revisedCandidate,
        judgeConfidence: clean(assessment?.confidence) || "unknown",
        criticRationale: clean(assessment.rationale),
      },
    ];
  });
  const placementNormalization = normalizePlacementCandidates(
    criticAccepted,
    index,
    branch,
  );
  const contentVerificationCandidates =
    placementNormalization.normalized.filter((candidate) =>
      CONTENT_VERIFICATION_ISSUE_TYPES.has(candidate.issueType),
    );
  const contentVerifier = await runCachedStage({
    cacheFile: path.join(stageCacheDir, "content-verifier.json"),
    inputSha256: sha256(
      JSON.stringify({
        stage: "content-verification-specialist",
        model: MODEL,
        promptVersion: CONTENT_VERIFIER_PROMPT_VERSION,
        branch,
        sourceFactsSha256: sha256(JSON.stringify(facts)),
        candidates: contentVerificationCandidates,
      }),
    ),
    resume,
    validate: (output) =>
      validateCompleteAssessments(
        "content-verification-specialist",
        contentVerificationCandidates,
        output,
      ),
    run: () =>
      runContentVerifier(ai, branch, index, placementNormalization.normalized),
  });
  const contentAssessmentById = new Map(
    contentVerifier.assessments.map((assessment) => [
      clean(assessment.candidateId),
      assessment,
    ]),
  );
  const contentRejected = [];
  const accepted = placementNormalization.normalized.flatMap((candidate) => {
    if (!CONTENT_VERIFICATION_ISSUE_TYPES.has(candidate.issueType)) {
      return [candidate];
    }
    const assessment = contentAssessmentById.get(candidate.candidateId);
    if (
      assessment?.decision !== "accept" &&
      assessment?.decision !== "revise"
    ) {
      contentRejected.push({
        candidateId: candidate.candidateId,
        detectorId: candidate.detectorId,
        decision: "reject",
        stage: "content-verification-specialist",
        reason: clean(
          assessment?.rationale ||
            "The content verifier did not return an acceptance.",
        ),
        candidate: {
          ...candidate,
          judgeConfidence:
            clean(assessment?.confidence) ||
            clean(candidate.judgeConfidence) ||
            "unknown",
        },
      });
      return [];
    }
    const verifiedCandidate =
      assessment.decision === "revise" &&
      assessment.revisedFields &&
      typeof assessment.revisedFields === "object"
        ? {
            ...candidate,
            ...assessment.revisedFields,
            candidateId: candidate.candidateId,
            detectorId: candidate.detectorId,
          }
        : candidate;
    const reason = preflightCandidate(verifiedCandidate, index);
    if (reason) {
      contentRejected.push({
        candidateId: candidate.candidateId,
        detectorId: candidate.detectorId,
        decision: "reject",
        stage: "post-content-verifier-preflight",
        reason,
        candidate: {
          ...verifiedCandidate,
          judgeConfidence:
            clean(assessment?.confidence) ||
            clean(candidate.judgeConfidence) ||
            "unknown",
        },
      });
      return [];
    }
    return [
      {
        ...verifiedCandidate,
        judgeConfidence:
          clean(assessment?.confidence) ||
          clean(candidate.judgeConfidence) ||
          "unknown",
        criticRationale: clean(assessment.rationale),
      },
    ];
  });

  const snapshot = snapshotFromIndex({
    index,
    descendants: live.descendants,
    ontologyAppId,
    ontologyName,
    projectId: live.projectId,
    environment,
    generatedAt,
    branch,
  });
  const snapshotText = `${JSON.stringify(snapshot, null, 2)}\n`;
  const snapshotHash = sha256(snapshotText);
  const sourceOntology = `firestore://${live.projectId}/${ontologyAppId}`;
  const config = {
    index,
    branch,
    datasetVersion,
    generatedAt,
    ontologyAppId,
    ontologyName,
    sourceOntology,
    snapshotHash,
  };
  const diagnosisRecords = accepted.map((candidate) =>
    recordForCandidate(candidate, config),
  );
  const actionRecords = exactActionRecords(diagnosisRecords, accepted, config);
  const records = [...diagnosisRecords, ...actionRecords].sort((left, right) =>
    `${left.issueType}|${left.proposalId}`.localeCompare(
      `${right.issueType}|${right.proposalId}`,
    ),
  );
  const rejected = [
    ...preflightRejected,
    ...criticRejected,
    ...placementNormalization.rejected,
    ...contentRejected,
  ];
  const manualChecks = manualCheckRecordsForRejected(
    [...criticRejected, ...contentRejected],
    config,
  ).sort((left, right) =>
    `${left.issueType}|${left.proposalId}`.localeCompare(
      `${right.issueType}|${right.proposalId}`,
    ),
  );
  const audit = {
    datasetVersion,
    branch,
    generatedAt,
    ontologyAppId,
    model: MODEL,
    auditPolicyVersion: AUDIT_POLICY_VERSION,
    learnedConstraints:
      "Content and identity precede structure; target-known placement moves are reviewed in one step; exact identity and sense actions remain diagnosis-gated; no Sell examples were supplied.",
    priorExpertTitleLocks: {
      benchmarkFile: approvedTitleLocks.benchmarkFile,
      benchmarkSha256: approvedTitleLocks.benchmarkSha256,
      count: approvedTitleLocks.byTitle.size,
    },
    detectorOutputs,
    externalDestinations,
    deterministicCandidates: deterministic,
    criticRaw: critic.raw,
    contentVerifierRaw: contentVerifier.raw,
    acceptedCandidates: accepted,
    rejectedCandidateCount: rejected.length,
    generatedProposalIds: records.map((record) => record.proposalId),
    generatedManualCheckIds: manualChecks.map((record) => record.proposalId),
  };
  writeDataset({
    outputDir,
    records,
    manualChecks,
    snapshot,
    snapshotHash,
    generatedAt,
    datasetVersion,
    branch,
    ontologyAppId,
    ontologyName,
    sourceOntology,
    reviewRelease,
    audit,
    rejected,
  });
  process.stdout.write(
    `${JSON.stringify(
      {
        outputDir,
        branchNodes: live.descendants.size,
        detectorCandidates: detected.length,
        deterministicCandidates: deterministic.length,
        acceptedCandidates: accepted.length,
        rejectedCandidates: rejected.length,
        proposals: records.length,
        manualChecks: manualChecks.length,
        byIssue: Object.fromEntries(
          ISSUE_DEFINITIONS.map((issue) => [
            issue.id,
            records.filter((record) => record.issueType === issue.id).length,
          ]),
        ),
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
