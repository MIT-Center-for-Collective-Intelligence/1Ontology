#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import {
  allChildren,
  collectDescendantIds,
  collectGenericEvidenceFacts,
  detectEmptyCollections,
  detectEmptySemanticNodes,
  findExplicitSellModifierCandidates,
  findSellerSideTemporaryUseCandidates,
  isOnetEvidence,
  linkId,
  mergeSemanticAssessments,
  normalizeCollection,
  rankSemanticCandidates,
  unionCandidatesById,
} from "./semantic-review-lib.mjs";

const require = createRequire(import.meta.url);
require("../load-env.cjs");
const { cert, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { GoogleGenAI } = require("@google/genai");
const OpenAI = require("openai").default;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const sourceDatasetDir = path.join(
  repoRoot,
  "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
  "review-datasets-rob-post-structure-2026-07-25",
);
const acceptedStructureBenchmarkFile = path.join(
  repoRoot,
  "artifacts",
  "rob-structure-review-2026-07-25",
  "rob-collection-design-2026-07-25.json",
);
const acceptedStructureApplicationAuditFile = path.join(
  sourceDatasetDir,
  "diagnostics",
  "structure_application_audit.json",
);
const collectionNodeRepairAuditFile = path.join(
  repoRoot,
  "artifacts",
  "rob-structure-review-2026-07-25",
  "collection-design-node-repair-2026-08-02.json",
);
const acceptedUsageSynonymBenchmarkFile = path.join(
  repoRoot,
  "artifacts",
  "rob-content-review-wave2-2026-07-24",
  "rob-duplicate-synonym-2026-07-24.json",
);
const acceptedUsageMergeBenchmarkFile = path.join(
  repoRoot,
  "artifacts",
  "rob-content-review-wave2-2026-07-24",
  "rob-node-merge-2026-07-24.json",
);
const acceptedUsageMergeApplicationAuditFile = path.join(
  sourceDatasetDir,
  "diagnostics",
  "content_application_audit.json",
);
const initialReviewSnapshotFile = path.join(
  repoRoot,
  "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
  "review-datasets",
  "ontology-snapshot.json",
);
const usageCollectionProposalId = "som-f0464db076534dd0bde0";
const usageSynonymProposalId = "som-af5752d64f929944a380";
const usageMergeProposalId = "som-9551307c7a40c479a755";
const defaultOutputDir = path.join(
  repoRoot,
  "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
  "review-datasets-rob-semantic-coverage-2026-07-29",
);
const defaultOntologyAppId =
  "final-hierarchy-with-o*net-rob-structure-applied-2026-07-25";
const defaultOntologyName =
  "Final Hierarchy with O*Net - Rob Structure Applied 2026-07-25";
const datasetVersion = "sell-rob-semantic-coverage-2026-07-29-v1";
const reviewSchemaVersion = "som-review-v1";
const embeddingModel = "text-embedding-3-large";
const embeddingDimensions = 1024;
const judgeModel = "gemini-3.1-pro-preview";
const detectorVersion = "sell-semantic-coverage-v1";
const usageNodeFirestoreHistory = [
  {
    title: "Lease out",
    activeNodeId: "C1jYc2PTyZIjQd2Iyt7V",
    activeDocumentCreatedAt: "2026-04-01T15:36:26.513Z",
    predecessorNodeId: "Mhu9BmPinYS1QzWJUe4e",
    predecessorDocumentCreatedAt: "2026-02-10T10:29:45.175Z",
    predecessorContributors: ["gemini"],
    predecessorFoundInPreviousId: "4lyDxFffGRPCb6QWHwie",
  },
  {
    title: "Rent out",
    activeNodeId: "jsXlKplPQ3BxIrHzSwLL",
    activeDocumentCreatedAt: "2026-04-01T15:36:26.513Z",
    predecessorNodeId: "UteAyqKbbaIS2rdJxVmc",
    predecessorDocumentCreatedAt: "2026-02-10T10:27:41.180Z",
    predecessorContributors: ["gemini"],
    predecessorFoundInPreviousId: "WCDKQUPUBl5QgjZMY1B5",
  },
];
const semanticQueries = [
  {
    label: "sale",
    text: "Sell goods, services, rights, access, or ideas to a buyer in exchange for payment.",
  },
  {
    label: "seller-side temporary use",
    text: "Rent out or lease out property, equipment, goods, or services to another party for payment.",
  },
  {
    label: "commercial transfer",
    text: "Vend, retail, auction, broker, or otherwise transfer something to a customer for payment.",
  },
  {
    label: "paid temporary access",
    text: "Provide temporary use of an asset to another person in exchange for payment while retaining ownership.",
  },
];

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

const clean = (value) => String(value || "").trim();
const sha256 = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");
const unique = (values) => [...new Set(values.filter(Boolean))];

const required = (value, label) => {
  if (!value) throw new Error(`${label} is required`);
  return value;
};

const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const writeText = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value.endsWith("\n") ? value : `${value}\n`, "utf8");
};

const writeJsonl = (file, values) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    values.length
      ? `${values.map((value) => JSON.stringify(value)).join("\n")}\n`
      : "",
    "utf8",
  );
};

const loadAcceptedStructureProvenance = () => {
  const benchmarkText = fs.readFileSync(acceptedStructureBenchmarkFile, "utf8");
  const applicationText = fs.readFileSync(
    acceptedStructureApplicationAuditFile,
    "utf8",
  );
  const synonymBenchmarkText = fs.readFileSync(
    acceptedUsageSynonymBenchmarkFile,
    "utf8",
  );
  const mergeBenchmarkText = fs.readFileSync(
    acceptedUsageMergeBenchmarkFile,
    "utf8",
  );
  const mergeApplicationText = fs.readFileSync(
    acceptedUsageMergeApplicationAuditFile,
    "utf8",
  );
  const correctionText = fs.readFileSync(collectionNodeRepairAuditFile, "utf8");
  const initialSnapshotText = fs.readFileSync(
    initialReviewSnapshotFile,
    "utf8",
  );
  const benchmark = JSON.parse(benchmarkText);
  const applicationAudit = JSON.parse(applicationText);
  const synonymBenchmark = JSON.parse(synonymBenchmarkText);
  const mergeBenchmark = JSON.parse(mergeBenchmarkText);
  const mergeApplicationAudit = JSON.parse(mergeApplicationText);
  const correctionAudit = JSON.parse(correctionText);
  const initialSnapshot = JSON.parse(initialSnapshotText);
  const judgment = (benchmark.judgments || []).find(
    (item) => item.proposalId === usageCollectionProposalId,
  );
  const appliedDesign = (applicationAudit.collectionDesigns || []).find(
    (item) => item.proposalId === usageCollectionProposalId,
  );
  if (judgment?.decision !== "agree" || !appliedDesign) {
    throw new Error(
      `Cannot verify accepted structure provenance for ${usageCollectionProposalId}`,
    );
  }
  const synonymJudgment = (synonymBenchmark.judgments || []).find(
    (item) => item.proposalId === usageSynonymProposalId,
  );
  const mergeJudgment = (mergeBenchmark.judgments || []).find(
    (item) => item.proposalId === usageMergeProposalId,
  );
  const appliedMerge = (mergeApplicationAudit.merges || []).find(
    (item) => item.actionProposalId === usageMergeProposalId,
  );
  if (
    synonymJudgment?.decision !== "agree" ||
    mergeJudgment?.decision !== "agree" ||
    appliedMerge?.canonicalTitle !== "Rent out" ||
    appliedMerge?.absorbedTitle !== "Lease out"
  ) {
    throw new Error("Cannot verify the Rent out / Lease out merge sequence");
  }
  if (
    correctionAudit.mode !== "apply" ||
    correctionAudit.invalidProposalId !== usageCollectionProposalId ||
    !Object.values(correctionAudit.verification || {}).every(Boolean)
  ) {
    throw new Error("Cannot verify the collection-node correction");
  }
  const initialNodesById = new Map(
    (initialSnapshot.nodes || []).map((node) => [node.id, node]),
  );
  const initialParentByChild = new Map(
    (initialSnapshot.edges || []).map((edge) => [edge.childId, edge.parentId]),
  );
  const baselineNodes = usageNodeFirestoreHistory.map((history) => {
    const node = initialNodesById.get(history.activeNodeId);
    const parent = initialNodesById.get(
      initialParentByChild.get(history.activeNodeId),
    );
    if (!node || node.title !== history.title || parent?.title !== "Sell") {
      throw new Error(`Cannot verify baseline origin for ${history.title}`);
    }
    return {
      ...history,
      parentTitleAtCapture: parent.title,
    };
  });
  return {
    schemaVersion: "som-accepted-structure-provenance-v4",
    proposalId: usageCollectionProposalId,
    origin: "invalid-collection-node-conflation-rolled-back",
    baseline: {
      capturedAt: initialSnapshot.capturedAt,
      ontologyAppId: initialSnapshot.ontologyAppId,
      sourceFile: path.relative(repoRoot, initialReviewSnapshotFile),
      sourceSha256: sha256(initialSnapshotText),
      nodes: baselineNodes,
      finding:
        "Lease out and Rent out were already direct children of Sell before the collection-design proposal was generated.",
      firestoreMetadataObservedAt: "2026-08-02T22:25:00.000Z",
    },
    contentPrerequisite: {
      occurredBeforeCollectionDesign: true,
      finding:
        'Rob accepted the synonym diagnosis and exact merge that absorbed "Lease out" into "Rent out". The subsequent collection-design proposal therefore operated on the surviving "Rent out" node.',
      review: {
        reviewerLabel:
          mergeBenchmark.reviewer?.label ||
          synonymBenchmark.reviewer?.label ||
          "",
        diagnosisProposalId: usageSynonymProposalId,
        diagnosisDecision: synonymJudgment.decision,
        actionProposalId: usageMergeProposalId,
        actionDecision: mergeJudgment.decision,
        diagnosisSourceFile: path.relative(
          repoRoot,
          acceptedUsageSynonymBenchmarkFile,
        ),
        diagnosisSourceSha256: sha256(synonymBenchmarkText),
        actionSourceFile: path.relative(
          repoRoot,
          acceptedUsageMergeBenchmarkFile,
        ),
        actionSourceSha256: sha256(mergeBenchmarkText),
      },
      application: {
        sourceOntology: mergeApplicationAudit.sourceOntology,
        targetOntology: mergeApplicationAudit.targetOntology,
        canonicalTitle: appliedMerge.canonicalTitle,
        absorbedTitle: appliedMerge.absorbedTitle,
        movedDirectChildCount: appliedMerge.movedDirectChildCount,
        sourceFile: path.relative(
          repoRoot,
          acceptedUsageMergeApplicationAuditFile,
        ),
        sourceSha256: sha256(mergeApplicationText),
        targetDigestVerified:
          mergeApplicationAudit.verification?.targetDigestMatches === true,
        sourceUnchanged:
          mergeApplicationAudit.verification?.sourceUnchanged === true,
      },
    },
    review: {
      datasetVersion: benchmark.datasetVersion,
      issueType: benchmark.issueType,
      reviewerLabel: benchmark.reviewer?.label || "",
      decision: judgment.decision,
      revisionCount: judgment.revisionCount,
      sourceFile: path.relative(repoRoot, acceptedStructureBenchmarkFile),
      sourceSha256: sha256(benchmarkText),
    },
    invalidApplication: {
      sourceOntology: applicationAudit.sourceOntology,
      targetOntology: applicationAudit.targetOntology,
      collectionName: appliedDesign.collectionName,
      branches: appliedDesign.branches,
      sourceFile: path.relative(
        repoRoot,
        acceptedStructureApplicationAuditFile,
      ),
      sourceSha256: sha256(applicationText),
      targetDigestVerified:
        applicationAudit.verification?.targetDigestMatches === true,
      sourceUnchanged: applicationAudit.verification?.sourceUnchanged === true,
    },
    correction: {
      finding:
        "The collection-design contract incorrectly allowed new activity branches, and the application path materialized them as ontology nodes.",
      policy:
        "Collection-design agents may create or reuse a collection label and assign existing direct children to it, but may not create ontology nodes or alter parent-child relations.",
      treatmentOfPriorDecision:
        "Rob's agreement remains preserved as review evidence, but it is not reinterpreted as approval for a different collection-only transformation.",
      ontologyAppId: correctionAudit.ontologyAppId,
      retiredSyntheticNodes:
        correctionAudit.correction?.retiredSyntheticNodes || [],
      restoredRelation: correctionAudit.correction?.restoredRelation,
      auditFile: path.relative(repoRoot, collectionNodeRepairAuditFile),
      auditSha256: sha256(correctionText),
      verified: true,
    },
    conclusion:
      '"Rent out" and "Lease out" were pre-existing machine-derived activities, and Rob approved merging "Lease out" into "Rent out". A later collection-design implementation incorrectly created "Sell ownership" and "Sell temporary use" as activity nodes. That application has been rolled back: the two synthetic wrappers are retired and "Rent out" is again a direct child of "Sell". No alternative collection structure has been inferred from Rob\'s prior answer.',
  };
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

const nodeDescription = (node) =>
  clean(node?.properties?.description || node?.description);

const nodeSynonyms = (node) =>
  unique([
    ...(node?.actionAlternatives || []).map(clean),
    ...clean(node?.synsets)
      .split(",")
      .map((value) =>
        value
          .trim()
          .replace(/\.[a-z]+\.\d+$/i, "")
          .replace(/_/g, " "),
      ),
  ]).sort((left, right) => left.localeCompare(right, "en"));

const nodeTextForEmbedding = (node) =>
  [
    clean(node.title),
    nodeSynonyms(node).length
      ? `Alternative wording: ${nodeSynonyms(node).join(", ")}`
      : "",
    nodeDescription(node)
      ? `Description: ${nodeDescription(node).slice(0, 500)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

const parentEdges = (nodes) => {
  const byChild = new Map();
  const edges = [];
  for (const parent of nodes) {
    for (const child of allChildren(parent)) {
      const edge = {
        parentId: parent.id,
        childId: child.id,
        collectionName: normalizeCollection(child.collectionName),
      };
      edges.push(edge);
      byChild.set(child.id, [...(byChild.get(child.id) || []), edge]);
    }
  }
  return { edges, byChild };
};

const primaryParent = (node, parentEdgesByChild, nodesById) => {
  const parentId =
    clean(node?.primaryParentId) ||
    (node?.parentIds || []).map(linkId).find(Boolean) ||
    parentEdgesByChild.get(node?.id)?.[0]?.parentId ||
    "";
  return {
    id: parentId,
    title: clean(nodesById.get(parentId)?.title),
  };
};

const ancestorPath = (node, nodesById, parentEdgesByChild) => {
  const values = [];
  const seen = new Set();
  let current = node;
  while (current && !seen.has(current.id) && values.length < 12) {
    seen.add(current.id);
    values.unshift(clean(current.title));
    const parent = primaryParent(current, parentEdgesByChild, nodesById);
    current = parent.id ? nodesById.get(parent.id) : undefined;
  }
  return values.filter(Boolean);
};

const pathFromNamedBranch = (titles, branchTitles) => {
  const index = titles.findIndex((title) => branchTitles.includes(title));
  return index >= 0 ? titles.slice(index) : titles;
};

const directContext = (node, nodesById) => {
  const children = allChildren(node)
    .map((child) => nodesById.get(child.id))
    .filter(Boolean);
  return {
    childTitles: children
      .filter((child) => !isOnetEvidence(child))
      .map((child) => clean(child.title))
      .sort((left, right) => left.localeCompare(right, "en")),
    sourceTasks: children
      .filter(isOnetEvidence)
      .map((child) => clean(child.title))
      .sort((left, right) => left.localeCompare(right, "en")),
  };
};

const embedTexts = async (openai, texts) => {
  const embeddings = [];
  for (let index = 0; index < texts.length; index += 1000) {
    const response = await openai.embeddings.create({
      model: embeddingModel,
      input: texts.slice(index, index + 1000),
      dimensions: embeddingDimensions,
    });
    embeddings.push(...response.data.map((item) => item.embedding));
    process.stderr.write(
      `Embedded ${Math.min(index + 1000, texts.length)}/${texts.length}\n`,
    );
  }
  return embeddings;
};

const callJudge = async (ai, prompt, responseJsonSchema) => {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model: judgeModel,
        contents: prompt,
        config: {
          temperature: 0,
          responseMimeType: "application/json",
          responseJsonSchema,
          maxOutputTokens: 32768,
          thinkingConfig: { thinkingLevel: "LOW" },
        },
      });
      return { text: clean(response.text), parsed: JSON.parse(response.text) };
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 4000));
      }
    }
  }
  throw new Error(
    `Judge failed after three attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
};

const semanticJudgeSchema = {
  type: "object",
  properties: {
    assessments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          candidateId: { type: "string" },
          classification: {
            type: "string",
            enum: [
              "same-sell-action",
              "seller-side-temporary-use",
              "buyer-side-temporary-use",
              "adjacent-action",
              "already-represented",
              "unrelated",
            ],
          },
          includeForExpertReview: { type: "boolean" },
          proposedParentTitle: { type: ["string", "null"] },
          reason: { type: "string" },
        },
        required: [
          "candidateId",
          "classification",
          "includeForExpertReview",
          "proposedParentTitle",
          "reason",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["assessments"],
  additionalProperties: false,
};

const specializationJudgeSchema = {
  type: "object",
  properties: {
    proposals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          genericNodeId: { type: "string" },
          taskId: { type: "string" },
          proposedTitle: { type: "string" },
          proposedTitleStatus: {
            type: "string",
            enum: ["existing", "new"],
          },
          targetParentTitle: { type: "string" },
          removedParentTitles: {
            type: "array",
            items: { type: "string" },
          },
          retainedParentTitles: {
            type: "array",
            items: { type: "string" },
          },
          reason: { type: "string" },
        },
        required: [
          "genericNodeId",
          "taskId",
          "proposedTitle",
          "proposedTitleStatus",
          "targetParentTitle",
          "removedParentTitles",
          "retainedParentTitles",
          "reason",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["proposals"],
  additionalProperties: false,
};

const proposalId = (issueType, key) =>
  `som-${sha256(`${datasetVersion}|${issueType}|${key}`).slice(0, 20)}`;

const workflowFor = (issueType, dependsOnProposalIds = []) => {
  const definitions = {
    "cross-branch-recall": {
      robTaskIds: [],
      stage: "content",
      proposalKind: "action",
    },
    relocation: {
      robTaskIds: [],
      stage: "final-action",
      proposalKind: "action",
    },
    "evidence-specialization": {
      robTaskIds: [],
      stage: "content",
      proposalKind: "action",
    },
    "empty-node": {
      robTaskIds: [],
      stage: "final-action",
      proposalKind: "action",
    },
    "empty-collection": {
      robTaskIds: [],
      stage: "final-action",
      proposalKind: "action",
    },
  };
  return { ...definitions[issueType], dependsOnProposalIds };
};

const makeRecord = ({
  key,
  issueType,
  subject,
  reviewerView,
  refs,
  snapshotHash,
  sourceOntology,
  sourceOntologyAppId,
  sourceOntologyName,
  generatedAt,
  dependsOnProposalIds = [],
  detectorId,
  detectorConfidence = "not-scored",
  reviewMode = "proposed-change",
}) => ({
  schemaVersion: reviewSchemaVersion,
  datasetVersion,
  proposalId: proposalId(issueType, key),
  branch: "Sell",
  issueType,
  reviewMode,
  rolloutStatus: "experimental",
  workflow: workflowFor(issueType, dependsOnProposalIds),
  subject: {
    title: subject.title,
    parentTitle: subject.parentTitle || "",
    path: subject.path || [],
    relatedTitles: subject.relatedTitles || [],
  },
  reviewerView: {
    question: reviewerView.question,
    currentState: reviewerView.currentState,
    proposedState: reviewerView.proposedState,
    reasoning: reviewerView.reasoning,
    context: reviewerView.context,
    agreeLabel: reviewerView.agreeLabel || "Agree",
    disagreeLabel: reviewerView.disagreeLabel || "Disagree",
    rejectionReasonRequired: true,
    autoAdvanceOnAgree: true,
    hideModelConfidence: true,
  },
  internalModelEvidence: {
    detectorId,
    detectorName: detectorId,
    detectorPromptVersion: detectorVersion,
    judgeId: "semantic-direction-or-evidence-specialization-judge",
    judgeName: judgeModel,
    judgePromptVersion: detectorVersion,
    detectorConfidence,
    judgeConfidence: "not-scored",
    reviewerVisible: false,
  },
  provenance: {
    sourceOntology,
    sourceOntologySha256: snapshotHash,
    sourceArtifact: "diagnostics/semantic-coverage-generation-audit.json",
    sourceRecord: key,
    sourceOntologyAppId,
    sourceOntologyName,
    sourceSnapshotSha256: snapshotHash,
    subjectNodeId: refs.subjectNodeId,
    parentNodeId: refs.parentNodeId,
    referencedNodeIds: unique(refs.referencedNodeIds).sort(),
  },
  createdAt: generatedAt,
});

const extendSchema = (schema) => {
  const root = schema.definitions.SocietyOfMindReviewProposal;
  root.properties.issueType.enum = unique([
    ...root.properties.issueType.enum,
    "cross-branch-recall",
    "evidence-specialization",
    "empty-node",
    "empty-collection",
  ]);
  const contexts = root.properties.reviewerView.properties.context.anyOf;
  const placementContext = contexts.find(
    (context) => context?.properties?.type?.const === "placement-comparison",
  );
  if (placementContext) {
    placementContext.properties.placementIssue.enum = unique([
      ...placementContext.properties.placementIssue.enum,
      "missing-from-branch",
    ]);
    placementContext.properties.currentPathTitles = {
      type: "array",
      items: { type: "string", minLength: 1 },
      minItems: 2,
    };
    placementContext.properties.proposedPathTitles = {
      type: "array",
      items: { type: "string", minLength: 1 },
      minItems: 2,
    };
  }
  contexts.push({
    type: "object",
    properties: {
      type: { type: "string", const: "evidence-specialization" },
      genericNodeTitle: { type: "string", minLength: 1 },
      sourceTask: { type: "string", minLength: 1 },
      currentParentTitles: {
        type: "array",
        items: { type: "string", minLength: 1 },
        minItems: 1,
        uniqueItems: true,
      },
      proposedTitle: { type: "string", minLength: 1 },
      proposedTitleStatus: {
        type: "string",
        enum: ["existing", "new"],
      },
      targetParentTitle: { type: "string", minLength: 1 },
      removedParentTitles: {
        type: "array",
        items: { type: "string", minLength: 1 },
        minItems: 1,
        uniqueItems: true,
      },
      retainedParentTitles: {
        type: "array",
        items: { type: "string", minLength: 1 },
        uniqueItems: true,
      },
    },
    required: [
      "type",
      "genericNodeTitle",
      "sourceTask",
      "currentParentTitles",
      "proposedTitle",
      "proposedTitleStatus",
      "targetParentTitle",
      "removedParentTitles",
      "retainedParentTitles",
    ],
    additionalProperties: false,
  });
  contexts.push({
    type: "object",
    properties: {
      type: { type: "string", const: "empty-node-action" },
      parentTitle: { type: "string", minLength: 1 },
      parentCollection: { type: "string", minLength: 1 },
      nodeTitle: { type: "string", minLength: 1 },
    },
    required: ["type", "parentTitle", "parentCollection", "nodeTitle"],
    additionalProperties: false,
  });
  contexts.push({
    type: "object",
    properties: {
      type: { type: "string", const: "empty-collection-action" },
      parentTitle: { type: "string", minLength: 1 },
      collectionName: { type: "string", minLength: 1 },
    },
    required: ["type", "parentTitle", "collectionName"],
    additionalProperties: false,
  });
  return schema;
};

const serializeNode = (node, referenceOnly = false) => ({
  id: node.id,
  title: clean(node.title),
  description: nodeDescription(node),
  synsets: clean(node.synsets),
  actionAlternatives: (node.actionAlternatives || [])
    .map(clean)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, "en")),
  oNet: node.oNet === true,
  oNetTask: node.oNetTask === true,
  ...(referenceOnly ? { referenceOnly: true } : {}),
});

const main = async () => {
  const args = parseArgs();
  const generatedAt = clean(args["generated-at"]);
  if (!generatedAt || Number.isNaN(Date.parse(generatedAt))) {
    throw new Error("--generated-at must be an ISO-8601 timestamp");
  }
  const environment = clean(args.environment) || "production";
  const ontologyAppId = clean(args["app-id"]) || defaultOntologyAppId;
  const ontologyName = clean(args["ontology-name"]) || defaultOntologyName;
  const outputDir = path.resolve(args.output || defaultOutputDir);
  const serviceAccount = credentials(environment);
  const firebaseApp = initializeApp(
    { credential: cert(serviceAccount) },
    `som-semantic-coverage-${environment}-${Date.now()}`,
  );
  const db = getFirestore(firebaseApp);
  const query = await db
    .collection("nodes")
    .where("appName", "==", ontologyAppId)
    .where("deleted", "==", false)
    .select(
      "title",
      "specializations",
      "generalizations",
      "parentIds",
      "primaryParentId",
      "properties.description",
      "description",
      "synsets",
      "actionAlternatives",
      "oNet",
      "oNetTask",
      "nodeType",
    )
    .get();
  const nodes = query.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const sellRoots = nodes.filter(
    (node) => clean(node.title).toLowerCase() === "sell",
  );
  if (sellRoots.length !== 1) {
    throw new Error(`Expected one active Sell root, found ${sellRoots.length}`);
  }
  const sellRoot = sellRoots[0];
  const { edges, byChild: parentEdgesByChild } = parentEdges(nodes);
  const sellDescendantIds = collectDescendantIds(sellRoot.id, nodesById);
  const sellSemanticNodes = [...sellDescendantIds]
    .map((id) => nodesById.get(id))
    .filter((node) => node && !isOnetEvidence(node));
  const sellTitles = new Set(
    sellSemanticNodes.map((node) => clean(node.title)),
  );
  const sellSynonyms = new Set(
    sellSemanticNodes.flatMap((node) =>
      nodeSynonyms(node).map((value) => value.toLowerCase()),
    ),
  );

  const candidates = nodes
    .filter(
      (node) =>
        !sellDescendantIds.has(node.id) &&
        !isOnetEvidence(node) &&
        clean(node.title) &&
        clean(node.title).toLowerCase() !== "act",
    )
    .map((node) => {
      const parent = primaryParent(node, parentEdgesByChild, nodesById);
      const context = directContext(node, nodesById);
      return {
        id: node.id,
        title: clean(node.title),
        description: nodeDescription(node),
        synonyms: nodeSynonyms(node),
        currentParentId: parent.id,
        currentParentTitle: parent.title,
        currentPathTitles: ancestorPath(node, nodesById, parentEdgesByChild),
        childTitles: context.childTitles,
        sourceTasks: context.sourceTasks,
        embeddingText: nodeTextForEmbedding(node),
      };
    });
  const openai = new OpenAI({
    apiKey: required(process.env.MIT_CCI_API_KEY, "MIT_CCI_API_KEY"),
    organization: process.env.MIT_CCI_API_ORG_ID,
  });
  const embeddingTexts = [
    ...semanticQueries.map((queryItem) => queryItem.text),
    ...candidates.map((candidate) => candidate.embeddingText),
  ];
  const embeddings = await embedTexts(openai, embeddingTexts);
  const queryEmbeddings = embeddings.slice(0, semanticQueries.length);
  const candidateEmbeddings = embeddings.slice(semanticQueries.length);
  const rankedCandidates = rankSemanticCandidates({
    candidates,
    candidateEmbeddings,
    queryEmbeddings,
    queryLabels: semanticQueries.map((queryItem) => queryItem.label),
    limitPerQuery: Number(args["limit-per-query"] || 24),
    overallLimit: Number(args["overall-limit"] || 80),
  });

  const semanticPrompt = `
You are the semantic-direction judge in a human-reviewed ontology pipeline.
An embedding detector retrieved existing activity nodes from outside the Sell
sub-branch. Assess every candidate. Include a candidate for expert review only
when its primary activity is itself selling, or the seller-side act of granting
temporary use for payment, and the meaning is not already represented by an
existing Sell title or synonym.

Do not include buyer-side acquisition of temporary use. Do not convert adjacent
activities such as advertising, arranging, negotiating, collecting payment,
delivering, analyzing, or exchanging into selling. Similar words or shared
objects are insufficient. The final expert remains the decision maker.

For an included candidate, proposedParentTitle must be one exact title from the
Sell destination list and must be the narrowest existing parent that fully
covers the candidate. For excluded candidates, proposedParentTitle must be
null. Return one assessment for every supplied candidate ID and do not invent
IDs or titles.

Existing Sell destination titles:
${JSON.stringify([...sellTitles].sort((a, b) => a.localeCompare(b, "en")))}

Existing Sell synonyms:
${JSON.stringify([...sellSynonyms].sort((a, b) => a.localeCompare(b, "en")))}

Embedding-retrieved candidates:
${JSON.stringify(
  rankedCandidates.map((candidate) => ({
    candidateId: candidate.id,
    title: candidate.title,
    description: candidate.description,
    synonyms: candidate.synonyms,
    currentParentTitle: candidate.currentParentTitle,
    currentPathTitles: candidate.currentPathTitles,
    childTitles: candidate.childTitles,
    sourceTasks: candidate.sourceTasks,
    matchedQueries: candidate.matchedQueries,
  })),
)}
`;
  const ai = new GoogleGenAI({
    apiKey: required(
      process.env.MIT_CCI_GEMINI_API_KEY || process.env.GEMINI_API_KEY,
      "MIT_CCI_GEMINI_API_KEY or GEMINI_API_KEY",
    ),
  });
  const semanticJudge = await callJudge(
    ai,
    semanticPrompt,
    semanticJudgeSchema,
  );
  const rankedById = new Map(
    rankedCandidates.map((candidate) => [candidate.id, candidate]),
  );
  const modelAssessments = [];
  const seenAssessments = new Set();
  for (const assessment of semanticJudge.parsed.assessments || []) {
    const candidate = rankedById.get(assessment.candidateId);
    if (!candidate || seenAssessments.has(candidate.id)) continue;
    seenAssessments.add(candidate.id);
    const proposedParentTitle = clean(assessment.proposedParentTitle);
    const includeForExpertReview =
      assessment.includeForExpertReview === true &&
      sellTitles.has(proposedParentTitle);
    modelAssessments.push({
      ...assessment,
      proposedParentTitle: includeForExpertReview ? proposedParentTitle : null,
      includeForExpertReview,
    });
  }
  for (const candidate of rankedCandidates) {
    if (seenAssessments.has(candidate.id)) continue;
    modelAssessments.push({
      candidateId: candidate.id,
      classification: "unrelated",
      includeForExpertReview: false,
      proposedParentTitle: null,
      reason: "The semantic judge did not return an assessment.",
    });
  }
  // Direct provider-side evidence is scanned across every candidate before
  // applying the embedding cutoff, so a lower-ranked Rent/Lease node cannot be
  // silently lost.
  const sellerSideCandidates = findSellerSideTemporaryUseCandidates({
    candidates,
    destinationTitle: "Rent out",
  });
  const allCandidatesById = new Map(
    candidates.map((candidate) => [candidate.id, candidate]),
  );
  const semanticReviewCandidates = unionCandidatesById(
    rankedCandidates,
    sellerSideCandidates
      .map((assessment) => allCandidatesById.get(assessment.candidateId))
      .filter(Boolean),
  );
  const semanticReviewCandidatesById = new Map(
    semanticReviewCandidates.map((candidate) => [candidate.id, candidate]),
  );
  const assessments = mergeSemanticAssessments({
    candidates: semanticReviewCandidates,
    modelAssessments,
    deterministicAssessments: sellerSideCandidates,
    validDestinationTitles: [...sellTitles],
  });

  const genericEvidenceFacts = collectGenericEvidenceFacts({
    rootId: sellRoot.id,
    nodesById,
    parentEdgesByChild,
  });
  const specializationPrompt = `
You are auditing O*NET evidence attached to overly generic Sell nodes. Propose a
specific activity only when the task text explicitly supplies a modifier that
narrows a generic object such as products, items, goods, supplies, services,
merchandise, equipment, or parts.

Use the task text itself as evidence. Do not infer a category from an occupation
or from outside knowledge. A bare generic phrase remains generic. A list after
"such as" can justify a stable shared category only when the category is clear
from the listed objects. When one modifier applies to coordinated generic nouns,
it may justify separate specific nodes. Prefer an exact existing Sell title.
Create a new title only when no existing title captures the explicit modifier.

Every removedParentTitle and retainedParentTitle must be one of the task's
currentParentTitles. The generic node must be removed when the task is assigned
to a more specific title; retain other parents only when they express an
independently justified meaning. targetParentTitle must be one exact existing
Sell title. Do not return unchanged generic assignments.

Existing Sell titles:
${JSON.stringify([...sellTitles].sort((a, b) => a.localeCompare(b, "en")))}

Generic evidence assignments:
${JSON.stringify(genericEvidenceFacts)}
`;
  const specializationJudge = await callJudge(
    ai,
    specializationPrompt,
    specializationJudgeSchema,
  );
  const genericFactByKey = new Map(
    genericEvidenceFacts.map((fact) => [
      `${fact.genericNodeId}\u001f${fact.taskId}`,
      fact,
    ]),
  );
  const initialSpecializationProposals = [];
  const specializationKeys = new Set();
  for (const proposal of specializationJudge.parsed.proposals || []) {
    const key = `${proposal.genericNodeId}\u001f${proposal.taskId}`;
    const fact = genericFactByKey.get(key);
    const proposedTitle = clean(proposal.proposedTitle);
    const targetParentTitle = clean(proposal.targetParentTitle);
    if (
      !fact ||
      specializationKeys.has(`${key}\u001f${proposedTitle.toLowerCase()}`) ||
      !/^Sell\b/i.test(proposedTitle) ||
      !sellTitles.has(targetParentTitle)
    ) {
      continue;
    }
    const currentParentTitles = fact.currentParents.map(
      (parent) => parent.title,
    );
    const removedParentTitles = unique(
      (proposal.removedParentTitles || [])
        .map(clean)
        .filter((title) => currentParentTitles.includes(title)),
    );
    const retainedParentTitles = unique(
      (proposal.retainedParentTitles || [])
        .map(clean)
        .filter(
          (title) =>
            currentParentTitles.includes(title) &&
            !removedParentTitles.includes(title),
        ),
    );
    const proposedTitleStatus = sellTitles.has(proposedTitle)
      ? "existing"
      : "new";
    if (
      !removedParentTitles.includes(fact.genericNodeTitle) ||
      (proposal.proposedTitleStatus === "existing" &&
        proposedTitleStatus !== "existing")
    ) {
      continue;
    }
    specializationKeys.add(`${key}\u001f${proposedTitle.toLowerCase()}`);
    initialSpecializationProposals.push({
      genericNodeId: fact.genericNodeId,
      genericNodeTitle: fact.genericNodeTitle,
      taskId: fact.taskId,
      taskTitle: fact.taskTitle,
      currentParents: fact.currentParents,
      proposedTitle,
      proposedTitleStatus,
      targetParentTitle,
      removedParentTitles,
      retainedParentTitles,
      reason: clean(proposal.reason),
    });
  }
  const deterministicModifierCandidates =
    findExplicitSellModifierCandidates(genericEvidenceFacts);
  const specializationProposals = [];
  for (const proposal of deterministicModifierCandidates) {
    const key = `${proposal.genericNodeId}\u001f${proposal.taskId}`;
    const fact = genericFactByKey.get(key);
    const proposedTitle = clean(proposal.proposedTitle);
    if (!fact || !/^Sell\b/i.test(proposedTitle)) continue;
    const currentParentTitles = fact.currentParents.map(
      (parent) => parent.title,
    );
    const proposedTitleStatus = sellTitles.has(proposedTitle)
      ? "existing"
      : "new";
    const targetParentTitle =
      proposedTitleStatus === "existing"
        ? proposedTitle
        : fact.genericNodeTitle;
    const removedParentTitles = [fact.genericNodeTitle];
    const retainedParentTitles = currentParentTitles.filter(
      (title) => title !== fact.genericNodeTitle,
    );
    specializationProposals.push({
      genericNodeId: fact.genericNodeId,
      genericNodeTitle: fact.genericNodeTitle,
      taskId: fact.taskId,
      taskTitle: fact.taskTitle,
      currentParents: fact.currentParents,
      proposedTitle,
      proposedTitleStatus,
      targetParentTitle,
      removedParentTitles,
      retainedParentTitles,
      reason: `The task explicitly says "${proposal.evidencePhrase}", so the generic ${fact.genericNodeTitle} assignment can be reviewed against a more specific activity.`,
    });
  }

  const emptyCandidates = detectEmptySemanticNodes({
    rootId: sellRoot.id,
    nodesById,
    parentEdgesByChild,
  });
  const emptyCollectionCandidates = detectEmptyCollections({
    rootId: sellRoot.id,
    nodesById,
  });
  const referencedIds = new Set();
  const records = [];

  for (const assessment of assessments.filter(
    (item) => item.includeForExpertReview,
  )) {
    const candidate = semanticReviewCandidatesById.get(assessment.candidateId);
    const target = [...sellSemanticNodes].find(
      (node) => clean(node.title) === assessment.proposedParentTitle,
    );
    if (!candidate || !target || !candidate.currentParentId) continue;
    referencedIds.add(candidate.id);
    referencedIds.add(candidate.currentParentId);
    const currentPathTitles = pathFromNamedBranch(candidate.currentPathTitles, [
      "Buy",
      "Sell",
    ]);
    const proposedPathTitles = [
      ...pathFromNamedBranch(
        ancestorPath(target, nodesById, parentEdgesByChild),
        ["Sell"],
      ),
      candidate.title,
    ];
    const moveProposal = makeRecord({
      key: `semantic:${candidate.id}:one-step-move`,
      issueType: "cross-branch-recall",
      subject: {
        title: candidate.title,
        parentTitle: candidate.currentParentTitle,
        path: currentPathTitles,
        relatedTitles: [assessment.proposedParentTitle],
      },
      reviewerView: {
        question: `Should "${candidate.title}" move from "${candidate.currentParentTitle}" to "${assessment.proposedParentTitle}" in the Sell sub-branch?`,
        currentState: `"${candidate.title}" is currently under "${candidate.currentParentTitle}" in the Buy sub-branch.`,
        proposedState: `Move the existing node to "${assessment.proposedParentTitle}" in the Sell sub-branch without changing its title or descendants.`,
        reasoning: clean(assessment.reason),
        context: {
          type: "placement-comparison",
          nodeTitle: candidate.title,
          currentParentTitle: candidate.currentParentTitle,
          candidateHome: assessment.proposedParentTitle,
          currentPathTitles,
          proposedPathTitles,
          placementIssue: "missing-from-branch",
          sourceTasks: candidate.sourceTasks,
        },
        agreeLabel: "Approve move",
        disagreeLabel: "Keep current location",
      },
      refs: {
        subjectNodeId: candidate.id,
        parentNodeId: candidate.currentParentId,
        referencedNodeIds: [candidate.id, candidate.currentParentId, target.id],
      },
      snapshotHash: "",
      sourceOntology: `firestore://ontology-41607/${ontologyAppId}`,
      sourceOntologyAppId: ontologyAppId,
      sourceOntologyName: ontologyName,
      generatedAt,
      detectorId: "whole-ontology-semantic-one-step-move",
      detectorConfidence: Number.isFinite(candidate.similarity)
        ? candidate.similarity.toFixed(6)
        : "direct-source-evidence",
    });
    records.push(moveProposal);
  }

  for (const proposal of specializationProposals) {
    const targetParent = [...sellSemanticNodes].find(
      (node) => clean(node.title) === proposal.targetParentTitle,
    );
    const proposedExistingNode = [...sellSemanticNodes].find(
      (node) => clean(node.title) === proposal.proposedTitle,
    );
    if (!targetParent) continue;
    records.push(
      makeRecord({
        key: `evidence:${proposal.genericNodeId}:${proposal.taskId}:${proposal.proposedTitle}`,
        issueType: "evidence-specialization",
        subject: {
          title: proposal.taskTitle,
          parentTitle: proposal.genericNodeTitle,
          relatedTitles: [proposal.proposedTitle, proposal.targetParentTitle],
        },
        reviewerView: {
          question:
            proposal.proposedTitleStatus === "existing"
              ? `Should this O*NET task be assigned to the more specific "${proposal.proposedTitle}" activity?`
              : `Should this O*NET task create the more specific "${proposal.proposedTitle}" activity?`,
          currentState: `The task is currently attached to ${proposal.currentParents
            .map((parent) => `"${parent.title}"`)
            .join(", ")}.`,
          proposedState:
            proposal.proposedTitleStatus === "existing"
              ? `Assign the task to existing "${proposal.proposedTitle}", remove ${proposal.removedParentTitles
                  .map((title) => `"${title}"`)
                  .join(
                    ", ",
                  )}, and retain only independently justified parents.`
              : `Create "${proposal.proposedTitle}" under "${proposal.targetParentTitle}", assign the task to it, remove ${proposal.removedParentTitles
                  .map((title) => `"${title}"`)
                  .join(
                    ", ",
                  )}, and retain only independently justified parents.`,
          reasoning: proposal.reason,
          context: {
            type: "evidence-specialization",
            genericNodeTitle: proposal.genericNodeTitle,
            sourceTask: proposal.taskTitle,
            currentParentTitles: proposal.currentParents.map(
              (parent) => parent.title,
            ),
            proposedTitle: proposal.proposedTitle,
            proposedTitleStatus: proposal.proposedTitleStatus,
            targetParentTitle: proposal.targetParentTitle,
            removedParentTitles: proposal.removedParentTitles,
            retainedParentTitles: proposal.retainedParentTitles,
          },
          agreeLabel:
            proposal.proposedTitleStatus === "existing"
              ? "Use specific activity"
              : "Create specific activity",
          disagreeLabel: "Keep or revise assignment",
        },
        refs: {
          subjectNodeId: proposal.taskId,
          parentNodeId: proposal.genericNodeId,
          referencedNodeIds: [
            proposal.taskId,
            proposal.genericNodeId,
            targetParent.id,
            proposedExistingNode?.id,
            ...proposal.currentParents.map((parent) => parent.id),
          ],
        },
        snapshotHash: "",
        sourceOntology: `firestore://ontology-41607/${ontologyAppId}`,
        sourceOntologyAppId: ontologyAppId,
        sourceOntologyName: ontologyName,
        generatedAt,
        detectorId: "onet-generic-object-specialization",
      }),
    );
  }

  for (const candidate of emptyCandidates) {
    const parent = candidate.parents[0];
    if (!parent) continue;
    records.push(
      makeRecord({
        key: `empty:${candidate.id}`,
        issueType: "empty-node",
        reviewMode: "manual-check",
        subject: {
          title: candidate.title,
          parentTitle: parent.title,
          relatedTitles: candidate.synonyms,
        },
        reviewerView: {
          question: `Should the empty node "${candidate.title}" be removed?`,
          currentState: `"${candidate.title}" has no direct semantic children or O*NET evidence in this snapshot.`,
          proposedState: `Remove the node from "${parent.title}" only if it is not an intentional organizing concept.`,
          reasoning:
            "This is a deterministic empty-node finding, not an automatic deletion. Conceptual nodes can be retained by expert judgment.",
          context: {
            type: "empty-node-action",
            parentTitle: parent.title,
            parentCollection: parent.collectionName,
            nodeTitle: candidate.title,
          },
          agreeLabel: "Remove empty node",
          disagreeLabel: "Retain concept",
        },
        refs: {
          subjectNodeId: candidate.id,
          parentNodeId: parent.id,
          referencedNodeIds: [
            candidate.id,
            ...candidate.parents.map((item) => item.id),
          ],
        },
        snapshotHash: "",
        sourceOntology: `firestore://ontology-41607/${ontologyAppId}`,
        sourceOntologyAppId: ontologyAppId,
        sourceOntologyName: ontologyName,
        generatedAt,
        detectorId: "deterministic-empty-semantic-node-scan",
      }),
    );
  }

  for (const candidate of emptyCollectionCandidates) {
    records.push(
      makeRecord({
        key: `empty-collection:${candidate.parentId}:${candidate.collectionName}`,
        issueType: "empty-collection",
        reviewMode: "manual-check",
        subject: {
          title: candidate.collectionName,
          parentTitle: candidate.parentTitle,
        },
        reviewerView: {
          question: `Should the empty collection "${candidate.collectionName}" be removed?`,
          currentState: `"${candidate.collectionName}" is a named collection under "${candidate.parentTitle}" with no member nodes in this snapshot.`,
          proposedState: `Remove only the empty collection label from "${candidate.parentTitle}".`,
          reasoning:
            "This is a deterministic empty-collection finding, not an automatic deletion. The expert can retain an intentionally reserved grouping.",
          context: {
            type: "empty-collection-action",
            parentTitle: candidate.parentTitle,
            collectionName: candidate.collectionName,
          },
          agreeLabel: "Remove empty collection",
          disagreeLabel: "Retain collection",
        },
        refs: {
          subjectNodeId: candidate.parentId,
          parentNodeId: candidate.parentId,
          referencedNodeIds: [candidate.parentId],
        },
        snapshotHash: "",
        sourceOntology: `firestore://ontology-41607/${ontologyAppId}`,
        sourceOntologyAppId: ontologyAppId,
        sourceOntologyName: ontologyName,
        generatedAt,
        detectorId: "deterministic-empty-named-collection-scan",
      }),
    );
  }

  const referenceIds = new Set(referencedIds);
  for (const record of records) {
    for (const id of record.provenance.referencedNodeIds) {
      if (!sellDescendantIds.has(id)) referenceIds.add(id);
    }
  }
  const snapshotNodeIds = new Set([...sellDescendantIds, ...referenceIds]);
  const snapshotNodes = [...snapshotNodeIds]
    .map((id) => nodesById.get(id))
    .filter(Boolean)
    .map((node) => serializeNode(node, !sellDescendantIds.has(node.id)))
    .sort((left, right) => left.id.localeCompare(right.id));
  const snapshotEdges = edges
    .filter(
      (edge) =>
        snapshotNodeIds.has(edge.parentId) && snapshotNodeIds.has(edge.childId),
    )
    .sort((left, right) =>
      `${left.parentId}\u001f${left.collectionName}\u001f${left.childId}`.localeCompare(
        `${right.parentId}\u001f${right.collectionName}\u001f${right.childId}`,
      ),
    );
  const snapshotCollections = [
    ...new Map(
      snapshotNodes
        .map((snapshotNode) => nodesById.get(snapshotNode.id))
        .filter(Boolean)
        .flatMap((node) =>
          (node.specializations || []).map((collection) => ({
            parentId: node.id,
            collectionName: normalizeCollection(collection.collectionName),
          })),
        )
        .map((collection) => [
          `${collection.parentId}\u001f${collection.collectionName}`,
          collection,
        ]),
    ).values(),
  ].sort((left, right) =>
    `${left.parentId}\u001f${left.collectionName}`.localeCompare(
      `${right.parentId}\u001f${right.collectionName}`,
    ),
  );
  const snapshot = {
    schemaVersion: "som-ontology-snapshot-v1",
    ontologyAppId,
    ontologyName,
    firestoreProjectId: serviceAccount.projectId,
    environment,
    capturedAt: generatedAt,
    sellRootNodeId: sellRoot.id,
    nodes: snapshotNodes,
    edges: snapshotEdges,
    collections: snapshotCollections,
  };
  const snapshotText = `${JSON.stringify(snapshot, null, 2)}\n`;
  const snapshotHash = sha256(snapshotText);
  for (const record of records) {
    record.provenance.sourceOntologySha256 = snapshotHash;
    record.provenance.sourceSnapshotSha256 = snapshotHash;
  }
  const acceptedStructureProvenance = loadAcceptedStructureProvenance();

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  fs.cpSync(
    path.join(sourceDatasetDir, "schema"),
    path.join(outputDir, "schema"),
    {
      recursive: true,
    },
  );
  const proposalSchemaFile = path.join(
    outputDir,
    "schema",
    "review-proposal.schema.json",
  );
  writeJson(
    proposalSchemaFile,
    extendSchema(JSON.parse(fs.readFileSync(proposalSchemaFile, "utf8"))),
  );
  fs.writeFileSync(
    path.join(outputDir, "ontology-snapshot.json"),
    snapshotText,
    "utf8",
  );

  const issueDefinitions = [
    {
      id: "cross-branch-recall",
      label: "1. Related activities outside Sell",
      taskIds: [],
      stage: "content",
      contextType: "placement-comparison",
    },
    {
      id: "evidence-specialization",
      label: "2. Specific activities from O*NET evidence",
      taskIds: [],
      stage: "content",
      contextType: "evidence-specialization",
    },
    {
      id: "empty-node",
      label: "Empty-node cleanup after propagation",
      taskIds: [],
      stage: "final-action",
      contextType: "empty-node-action",
    },
    {
      id: "empty-collection",
      label: "Empty-collection cleanup after propagation",
      taskIds: [],
      stage: "final-action",
      contextType: "empty-collection-action",
    },
  ].map((definition) => ({
    ...definition,
    proposals: records.filter(
      (record) =>
        record.issueType === definition.id &&
        record.reviewMode === "proposed-change",
    ).length,
    controls: 0,
    manualChecks: records.filter(
      (record) =>
        record.issueType === definition.id &&
        record.reviewMode === "manual-check",
    ).length,
  }));
  const proposedRecords = records
    .filter((record) => record.reviewMode === "proposed-change")
    .sort((left, right) =>
      `${left.issueType}\u001f${left.proposalId}`.localeCompare(
        `${right.issueType}\u001f${right.proposalId}`,
      ),
    );
  const manualChecks = records
    .filter((record) => record.reviewMode === "manual-check")
    .sort((left, right) =>
      `${left.issueType}\u001f${left.proposalId}`.localeCompare(
        `${right.issueType}\u001f${right.proposalId}`,
      ),
    );
  writeJsonl(path.join(outputDir, "all_proposals.jsonl"), proposedRecords);
  writeJsonl(path.join(outputDir, "all_controls.jsonl"), []);
  writeJsonl(path.join(outputDir, "manual_checks.jsonl"), manualChecks);
  for (const issue of issueDefinitions) {
    writeJsonl(
      path.join(outputDir, "proposals", `${issue.id}.jsonl`),
      proposedRecords.filter((record) => record.issueType === issue.id),
    );
    writeJsonl(path.join(outputDir, "controls", `${issue.id}.jsonl`), []);
  }
  const manifest = {
    schemaVersion: reviewSchemaVersion,
    datasetVersion,
    branch: "Sell",
    generatedAt,
    sourceOntology: `firestore://ontology-41607/${ontologyAppId}`,
    sourceOntologySha256: snapshotHash,
    counts: {
      proposals: proposedRecords.length,
      controls: 0,
      manualChecks: manualChecks.length,
      rejectedAgentCandidates: assessments.filter(
        (assessment) => !assessment.includeForExpertReview,
      ).length,
    },
    files: {
      allProposals: "all_proposals.jsonl",
      allControls: "all_controls.jsonl",
      manualChecks: "manual_checks.jsonl",
      proposalsByIssue: "proposals/<issue-type>.jsonl",
      controlsByIssue: "controls/<issue-type>.jsonl",
      rejectedAgentCandidates: "diagnostics/rejected_agent_candidates.jsonl",
      acceptedStructureProvenance:
        "diagnostics/accepted_structure_provenance.json",
      collectionDesignNodeRepair:
        "diagnostics/collection_design_node_repair.json",
      proposalSchema: "schema/review-proposal.schema.json",
      responseSchema: "schema/review-response.schema.json",
      ontologySnapshot: "ontology-snapshot.json",
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
    issueTypes: issueDefinitions,
    reviewRelease: {
      strategy: "semantic-coverage-first",
      currentWave: "semantic-recall-and-evidence-specialization",
      releasedIssueTypes: ["cross-branch-recall", "evidence-specialization"],
      awaitingRegenerationIssueTypes: ["empty-node", "empty-collection"],
      message:
        "Review semantic branch-recall and O*NET specialization first. Downstream structure and empty-node/collection cleanup will be regenerated after these decisions are propagated.",
    },
    safety: {
      reviewOnly: true,
      mutatesOntology: false,
      approvalAuthorizesAutomaticWrite: false,
      modelConfidenceVisibleToReviewer: false,
    },
    acceptedStructureProvenance: {
      proposalId: acceptedStructureProvenance.proposalId,
      origin: acceptedStructureProvenance.origin,
      file: "diagnostics/accepted_structure_provenance.json",
    },
    limitations: [
      "Embedding similarity retrieves candidates but never authorizes an ontology change.",
      "A semantic-direction judge filters embedding candidates; direct provider-side O*NET evidence is scanned across the full ontology candidate set so the embedding cutoff cannot hide it.",
      "Each whole-node move is reviewed once, with the source evidence and both complete hierarchy locations visible together.",
      "O*NET specializations are released only when a deterministic text rule verifies an explicit modifier; broader model suggestions remain diagnostic.",
      "Empty-node and empty-collection findings are deterministic and intentionally unreleased until upstream changes propagate.",
      "Descriptions and broad missing-activity generation remain deferred.",
      "Collection design is constrained to assigning existing direct children to a named bucket; new activity branches require a separate intermediate-node review.",
    ],
    sourceSnapshot: {
      file: "ontology-snapshot.json",
      sha256: snapshotHash,
      capturedAt: generatedAt,
      ontologyAppId,
      ontologyName,
      environment,
      branchRootTitle: "Sell",
      branchRootNodeId: sellRoot.id,
      sellRootNodeId: sellRoot.id,
      nodeCount: snapshotNodes.length,
      edgeCount: snapshotEdges.length,
      collectionCount: snapshotCollections.length,
    },
    detector: {
      version: detectorVersion,
      embeddingModel,
      embeddingDimensions,
      judgeModel,
      semanticQueries,
      wholeOntologySemanticCandidateCount: candidates.length,
      rankedCandidateCount: rankedCandidates.length,
      reviewedCandidateCount: semanticReviewCandidates.length,
      directEvidenceCandidateCount: sellerSideCandidates.length,
    },
  };
  writeJson(path.join(outputDir, "manifest.json"), manifest);
  fs.mkdirSync(path.join(outputDir, "diagnostics"), { recursive: true });
  writeJson(
    path.join(outputDir, "diagnostics", "accepted_structure_provenance.json"),
    acceptedStructureProvenance,
  );
  fs.copyFileSync(
    collectionNodeRepairAuditFile,
    path.join(outputDir, "diagnostics", "collection_design_node_repair.json"),
  );
  writeJsonl(
    path.join(outputDir, "diagnostics", "rejected_agent_candidates.jsonl"),
    assessments
      .filter((assessment) => !assessment.includeForExpertReview)
      .map((assessment) => ({
        ...assessment,
        candidate: semanticReviewCandidatesById.get(assessment.candidateId),
      })),
  );
  writeJson(
    path.join(
      outputDir,
      "diagnostics",
      "semantic-coverage-generation-audit.json",
    ),
    {
      schemaVersion: "som-semantic-coverage-generation-audit-v1",
      generatedAt,
      datasetVersion,
      sourceOntologyAppId: ontologyAppId,
      sourceSnapshotSha256: snapshotHash,
      detectorVersion,
      prompts: {
        semanticJudgeSha256: sha256(semanticPrompt),
        specializationJudgeSha256: sha256(specializationPrompt),
      },
      models: {
        embeddingModel,
        embeddingDimensions,
        judgeModel,
      },
      semanticQueries,
      rankedCandidates,
      semanticReviewCandidates,
      semanticAssessments: assessments,
      semanticModelAssessments: modelAssessments,
      deterministicSellerSideCandidates: sellerSideCandidates,
      semanticJudgeRaw: semanticJudge.text,
      genericEvidenceFacts,
      deterministicModifierCandidates,
      initialSpecializationProposals,
      specializationProposals,
      specializationJudgeRaw: specializationJudge.text,
      emptyCandidates,
      emptyCollectionCandidates,
      releasedIssueTypes: manifest.reviewRelease.releasedIssueTypes,
      proposalIds: proposedRecords.map((record) => record.proposalId),
      manualCheckIds: manualChecks.map((record) => record.proposalId),
      ontologyMutated: false,
    },
  );
  writeText(
    path.join(outputDir, "README.md"),
    `# Sell semantic coverage review

Snapshot-bound review of whole-ontology semantic recall and explicit
O*NET-derived Sell specializations before downstream regeneration.

- Generated: ${generatedAt}
- Dataset: \`${datasetVersion}\`
- Review: https://ontology.mit.edu/review?dataset=sell-semantic-coverage
- Safety: responses are review records only. A separately reviewed application
  plan is required before any ontology mutation.
- Provenance: \`Rent out\` and \`Lease out\` already existed in the July 15
  baseline, and Rob accepted merging \`Lease out\` into \`Rent out\`. A later
  collection-design contract incorrectly allowed new activity branches, which
  the application materialized as nodes. Those wrappers were retired, and
  \`Rent out\` is again a direct child of \`Sell\`. See
  \`diagnostics/accepted_structure_provenance.json\`.
- Cleanup: empty nodes and named empty collections are detected now but remain
  unreleased until upstream decisions are propagated and the branch is
  regenerated.
`,
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        outputDir,
        datasetVersion,
        sourceSnapshotSha256: snapshotHash,
        wholeOntologyCandidates: candidates.length,
        rankedCandidates: rankedCandidates.length,
        semanticCandidatesAssessed: semanticReviewCandidates.length,
        semanticReviewCandidates: assessments.filter(
          (assessment) => assessment.includeForExpertReview,
        ).length,
        evidenceSpecializations: specializationProposals.length,
        emptyNodesDeferred: emptyCandidates.length,
        emptyCollectionsDeferred: emptyCollectionCandidates.length,
        proposedRecords: proposedRecords.length,
        manualChecks: manualChecks.length,
      },
      null,
      2,
    )}\n`,
  );
};

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
