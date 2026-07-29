#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { AUDIT_POLICY_VERSION } from "./audit-policy.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const sourceDatasetDir = path.join(
  repoRoot,
  "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
  "review-datasets-rob-post-structure-2026-07-25",
);
const outputDir = path.join(
  repoRoot,
  "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
  "review-datasets-rob-outline-followup-2026-07-28",
);
const datasetVersion = "sell-rob-outline-followup-2026-07-28-v1";
const generatedAt = "2026-07-29T01:05:17.000Z";
const sourceOntology =
  "firestore://ontology-41607/final-hierarchy-with-o*net-rob-structure-applied-2026-07-25";
const sourceArtifact =
  "artifacts/rob-sell-followup-2026-07-28/followup-audit.json";

const sha256 = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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

const snapshotFile = path.join(sourceDatasetDir, "ontology-snapshot.json");
const snapshotText = fs.readFileSync(snapshotFile, "utf8");
const snapshot = JSON.parse(snapshotText);
const snapshotSha256 = sha256(snapshotText);
const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
const idsByTitle = new Map();
for (const node of snapshot.nodes) {
  idsByTitle.set(node.title, [...(idsByTitle.get(node.title) || []), node.id]);
}
const childEdgesByParent = new Map();
const parentEdgesByChild = new Map();
for (const edge of snapshot.edges) {
  childEdgesByParent.set(edge.parentId, [
    ...(childEdgesByParent.get(edge.parentId) || []),
    edge,
  ]);
  parentEdgesByChild.set(edge.childId, [
    ...(parentEdgesByChild.get(edge.childId) || []),
    edge,
  ]);
}

const node = (title) => {
  const ids = idsByTitle.get(title) || [];
  if (ids.length !== 1) {
    throw new Error(`Expected one node titled "${title}", found ${ids.length}`);
  }
  return nodesById.get(ids[0]);
};

const edge = (parentTitle, childTitle) => {
  const parent = node(parentTitle);
  const child = node(childTitle);
  const matches = (childEdgesByParent.get(parent.id) || []).filter(
    (candidate) => candidate.childId === child.id,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected one edge ${parentTitle} -> ${childTitle}, found ${matches.length}`,
    );
  }
  return matches[0];
};

const childTitles = (title, { evidenceOnly = false } = {}) =>
  (childEdgesByParent.get(node(title).id) || [])
    .map((candidate) => nodesById.get(candidate.childId))
    .filter(Boolean)
    .filter((candidate) => {
      const evidence =
        candidate.oNetTask || /^\(O\*Net\)/i.test(candidate.title || "");
      return !evidenceOnly || evidence;
    })
    .map((candidate) => candidate.title)
    .sort((left, right) => left.localeCompare(right, "en"));

const semanticChildTitles = (title) =>
  (childEdgesByParent.get(node(title).id) || [])
    .map((candidate) => nodesById.get(candidate.childId))
    .filter(
      (candidate) =>
        candidate &&
        !candidate.oNetTask &&
        !/^\(O\*Net\)/i.test(candidate.title || ""),
    )
    .map((candidate) => candidate.title)
    .sort((left, right) => left.localeCompare(right, "en"));

const collectionFor = (parentTitle, childTitle) =>
  edge(parentTitle, childTitle).collectionName || "main";

const proposalId = (issueType, key) =>
  `som-${sha256(`${datasetVersion}|${issueType}|${key}`).slice(0, 20)}`;

const referencedIds = (...titles) =>
  [
    ...new Set(
      titles
        .flat(Infinity)
        .filter(Boolean)
        .map((title) => node(title).id),
    ),
  ].sort();

const workflowFor = (issueType, dependsOnProposalIds = []) => {
  const definitions = {
    "duplicate-synonym": {
      robTaskIds: [6],
      stage: "content",
      proposalKind: "diagnosis",
    },
    "flat-list-grouping": {
      robTaskIds: [8],
      stage: "within-branch",
      proposalKind: "diagnosis",
    },
    "collection-design": {
      robTaskIds: [10],
      stage: "within-branch",
      proposalKind: "design",
    },
    placement: {
      robTaskIds: [11],
      stage: "within-branch",
      proposalKind: "diagnosis",
    },
    "node-merge": {
      robTaskIds: [6],
      stage: "final-action",
      proposalKind: "action",
    },
    relocation: {
      robTaskIds: [11],
      stage: "final-action",
      proposalKind: "action",
    },
    "redundant-node": {
      robTaskIds: [],
      stage: "additional-quality",
      proposalKind: "action",
    },
  };
  return { ...definitions[issueType], dependsOnProposalIds };
};

const makeRecord = ({
  key,
  issueType,
  reviewMode = "proposed-change",
  subject,
  reviewerView,
  refs,
  dependsOnProposalIds = [],
  detectorId,
}) => ({
  schemaVersion: "som-review-v1",
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
    path: [],
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
    detectorPromptVersion: AUDIT_POLICY_VERSION,
    judgeId: "snapshot-bound-followup-audit",
    judgeName: "SnapshotBoundFollowupAuditor",
    judgePromptVersion: AUDIT_POLICY_VERSION,
    detectorConfidence: "not-scored",
    judgeConfidence: "not-scored",
    reviewerVisible: false,
  },
  provenance: {
    sourceOntology,
    sourceOntologySha256: snapshotSha256,
    sourceArtifact,
    sourceRecord: key,
    sourceOntologyAppId: snapshot.ontologyAppId,
    sourceOntologyName: snapshot.ontologyName,
    sourceSnapshotSha256: snapshotSha256,
    subjectNodeId: refs.subjectNodeId,
    parentNodeId: refs.parentNodeId,
    referencedNodeIds: refs.referencedNodeIds,
  },
  createdAt: generatedAt,
});

const placementDiagnosis = ({
  key,
  nodeTitle,
  currentParentTitle,
  proposedParentTitle,
  reasoning,
}) => {
  const diagnosis = makeRecord({
    key,
    issueType: "placement",
    subject: {
      title: nodeTitle,
      parentTitle: currentParentTitle,
      relatedTitles: [proposedParentTitle],
    },
    reviewerView: {
      question: `Is "${nodeTitle}" better placed under "${proposedParentTitle}"?`,
      currentState: `"${nodeTitle}" is currently under "${currentParentTitle}".`,
      proposedState: `Move it to "${proposedParentTitle}" while retaining all current direct children.`,
      reasoning,
      context: {
        type: "placement-comparison",
        nodeTitle,
        currentParentTitle,
        currentBucket: collectionFor(currentParentTitle, nodeTitle),
        candidateHome: proposedParentTitle,
        placementIssue: "wrong-parent",
        sourceTasks: childTitles(nodeTitle, { evidenceOnly: true }),
      },
    },
    refs: {
      subjectNodeId: node(nodeTitle).id,
      parentNodeId: node(currentParentTitle).id,
      referencedNodeIds: referencedIds(
        nodeTitle,
        currentParentTitle,
        proposedParentTitle,
      ),
    },
    detectorId: "rob-outline-placement-followup",
  });
  const relocation = makeRecord({
    key: `${key}-exact`,
    issueType: "relocation",
    subject: {
      title: nodeTitle,
      parentTitle: currentParentTitle,
      relatedTitles: [proposedParentTitle],
    },
    reviewerView: {
      question: `Should "${nodeTitle}" move from "${currentParentTitle}" to "${proposedParentTitle}"?`,
      currentState: `"${nodeTitle}" remains under "${currentParentTitle}".`,
      proposedState: `Move it to "${proposedParentTitle}" with all current direct children.`,
      reasoning:
        "This exact move is available only after the related placement diagnosis is approved.",
      context: {
        type: "relocation-action",
        nodeTitle,
        currentParentTitle,
        currentCollection: collectionFor(currentParentTitle, nodeTitle),
        proposedParentTitle,
        proposedCollection: "main",
        childTitles: childTitles(nodeTitle),
      },
    },
    refs: {
      subjectNodeId: node(nodeTitle).id,
      parentNodeId: node(currentParentTitle).id,
      referencedNodeIds: referencedIds(
        nodeTitle,
        currentParentTitle,
        proposedParentTitle,
        childTitles(nodeTitle),
      ),
    },
    dependsOnProposalIds: [diagnosis.proposalId],
    detectorId: "rob-outline-placement-exact-action",
  });
  return [diagnosis, relocation];
};

const duplicateDiagnosis = ({
  key,
  canonicalTitle,
  canonicalParentTitle,
  candidateTitle,
  candidateParentTitle,
  reasoning,
  reviewMode = "proposed-change",
  includeAction = true,
}) => {
  const sourceTasks = [
    ...new Set([
      ...childTitles(canonicalTitle, { evidenceOnly: true }),
      ...childTitles(candidateTitle, { evidenceOnly: true }),
    ]),
  ].sort((left, right) => left.localeCompare(right, "en"));
  const diagnosis = makeRecord({
    key,
    issueType: "duplicate-synonym",
    reviewMode,
    subject: {
      title: candidateTitle,
      parentTitle: candidateParentTitle,
      relatedTitles: [canonicalTitle],
    },
    reviewerView: {
      question: `Do "${canonicalTitle}" and "${candidateTitle}" name the same activity?`,
      currentState: "The titles remain separate activities.",
      proposedState: `Keep "${canonicalTitle}" and preserve "${candidateTitle}" as a synonym if the evidence is substitutable.`,
      reasoning,
      context: {
        type: "duplicate-comparison",
        parentTitle: candidateParentTitle,
        canonicalParentTitle,
        candidateParentTitle,
        canonicalTitle,
        candidateSynonymTitle: candidateTitle,
        sourceTasks,
      },
    },
    refs: {
      subjectNodeId: node(candidateTitle).id,
      parentNodeId: node(candidateParentTitle).id,
      referencedNodeIds: referencedIds(
        canonicalTitle,
        canonicalParentTitle,
        candidateTitle,
        candidateParentTitle,
      ),
    },
    detectorId: "rob-outline-identity-followup",
  });
  if (!includeAction) return [diagnosis];

  const canonicalChildren = childTitles(canonicalTitle);
  const absorbedChildren = childTitles(candidateTitle);
  const resultingChildren = [
    ...new Set([...canonicalChildren, ...absorbedChildren]),
  ].sort((left, right) => left.localeCompare(right, "en"));
  const action = makeRecord({
    key: `${key}-exact`,
    issueType: "node-merge",
    subject: {
      title: candidateTitle,
      parentTitle: candidateParentTitle,
      relatedTitles: [canonicalTitle],
    },
    reviewerView: {
      question: `Should "${candidateTitle}" be merged into "${canonicalTitle}"?`,
      currentState: "The two nodes and their direct children remain separate.",
      proposedState: `Keep "${canonicalTitle}", preserve "${candidateTitle}" as a synonym, and move every direct child from the absorbed node.`,
      reasoning:
        "This exact consolidation is available only after the identity diagnosis is approved.",
      context: {
        type: "merge-action",
        parentTitle: candidateParentTitle,
        canonicalParentTitle,
        absorbedParentTitle: candidateParentTitle,
        canonicalTitle,
        canonicalCollection: collectionFor(
          canonicalParentTitle,
          canonicalTitle,
        ),
        canonicalChildren,
        absorbedTitle: candidateTitle,
        absorbedCollection: collectionFor(candidateParentTitle, candidateTitle),
        absorbedChildren,
        resultingChildren,
        absorbedBecomesSynonym: true,
      },
    },
    refs: {
      subjectNodeId: node(candidateTitle).id,
      parentNodeId: node(candidateParentTitle).id,
      referencedNodeIds: referencedIds(
        canonicalTitle,
        canonicalParentTitle,
        candidateTitle,
        candidateParentTitle,
        canonicalChildren,
        absorbedChildren,
      ),
    },
    dependsOnProposalIds: [diagnosis.proposalId],
    detectorId: "rob-outline-identity-exact-action",
  });
  return [diagnosis, action];
};

const records = [];

const funeralTask =
  "(O*Net) 18843 - Sell funeral services, products, or merchandise to clients.";
const funeralCurrentParents = [
  "Sell Funeral Products",
  "Sell Products",
  "Sell Services",
];
records.push(
  makeRecord({
    key: "funeral-evidence-lineage",
    issueType: "placement",
    subject: {
      title: funeralTask,
      parentTitle: "Sell Products",
      relatedTitles: ["Sell Funeral Products", "Sell Services"],
    },
    reviewerView: {
      question:
        "Should this task keep its specific product and service parents while dropping the stale broad product parent?",
      currentState: `The task is linked to ${funeralCurrentParents.join(", ")}.`,
      proposedState:
        "Keep Sell Funeral Products and Sell Services; remove only Sell Products.",
      reasoning:
        "The task-specific product output and the service parent preserve both meanings in the evidence. The broad product link became redundant after the title split.",
      context: {
        type: "evidence-parent-allocation",
        taskTitle: funeralTask,
        currentParentTitles: funeralCurrentParents,
        assignedOutputTitles: ["Sell Funeral Products"],
        retainedParentTitles: ["Sell Services"],
        removedParentTitles: ["Sell Products"],
      },
      agreeLabel: "Keep specific parents",
      disagreeLabel: "Use different parents",
    },
    refs: {
      subjectNodeId: node(funeralTask).id,
      parentNodeId: node("Sell Products").id,
      referencedNodeIds: referencedIds(funeralTask, funeralCurrentParents),
    },
    detectorId: "evidence-parent-contract-audit",
  }),
);

records.push(
  ...placementDiagnosis({
    key: "insurance-to-service",
    nodeTitle: "Sell Insurance Policies",
    currentParentTitle: "Sell information",
    proposedParentTitle: "Sell service",
    reasoning:
      "An insurance policy documents an entitlement and continuing obligation. The service, rather than the document alone, is the value being sold.",
  }),
  ...placementDiagnosis({
    key: "investment-instruments-to-service",
    nodeTitle: "Sell Investment Instruments",
    currentParentTitle: "Sell information",
    proposedParentTitle: "Sell service",
    reasoning:
      "The transaction provides financial-service access and obligations; classifying by the instrument's informational form misses the sold value.",
  }),
  ...placementDiagnosis({
    key: "bicycles-to-sporting-equipment",
    nodeTitle: "Sell Bicycles",
    currentParentTitle: "Sell physical objects",
    proposedParentTitle: "Sell Sporting Equipment",
    reasoning:
      "The existing sporting-equipment parent is a more specific stable domain category and preserves the full bicycle-selling meaning.",
  }),
  ...placementDiagnosis({
    key: "bicycle-accessories-to-sporting-equipment",
    nodeTitle: "Sell Bicycle Accessories",
    currentParentTitle: "Sell physical objects",
    proposedParentTitle: "Sell Sporting Equipment",
    reasoning:
      "The existing sporting-equipment parent is more specific and jointly organizes the bicycle evidence without creating a parallel category.",
  }),
  ...placementDiagnosis({
    key: "flower-to-agricultural-products",
    nodeTitle: "Sell Flower",
    currentParentTitle: "Sell physical objects",
    proposedParentTitle: "Sell Agricultural Products",
    reasoning:
      "Flowers are agricultural products, and the current ontology already has that more specific parent.",
  }),
  ...placementDiagnosis({
    key: "food-specialties-to-food-and-beverages",
    nodeTitle: "Sell Food Specialties",
    currentParentTitle: "Sell physical objects",
    proposedParentTitle: "Sell Food and Beverages",
    reasoning:
      "The source task explicitly names sandwiches and beverages, which fit the existing food-and-beverage parent.",
  }),
);

records.push(
  ...duplicateDiagnosis({
    key: "gambling-chip-token",
    canonicalTitle: "Sell Gambling Chips",
    canonicalParentTitle: "Sell physical objects",
    candidateTitle: "Sell Gambling Tokens",
    candidateParentTitle: "Sell physical objects",
    reasoning:
      "Both nodes have the same two O*NET tasks, each of which coordinates chips and tokens as alternatives in the same selling activity.",
  }),
  ...duplicateDiagnosis({
    key: "service-number-variant",
    canonicalTitle: "Sell service",
    canonicalParentTitle: "Sell",
    candidateTitle: "Sell Services",
    candidateParentTitle: "Sell service",
    reasoning:
      "The plural node is a generic service-selling activity directly below the singular high-level activity. Review whether it adds any distinct meaning before consolidation.",
  }),
  ...duplicateDiagnosis({
    key: "admission-pass-ticket",
    canonicalTitle: "Sell Ticket",
    canonicalParentTitle: "Sell service",
    candidateTitle: "Sell Admission Passes",
    candidateParentTitle: "Sell service",
    reviewMode: "manual-check",
    reasoning:
      "The admission-pass evidence is a subset of the ticket evidence, so this may be synonymy or a useful subtype. Decide the semantic boundary before any merge.",
  }),
  ...duplicateDiagnosis({
    key: "postal-product-supply",
    canonicalTitle: "Sell Postal Products",
    canonicalParentTitle: "Sell physical objects",
    candidateTitle: "Sell Postal Supplies",
    candidateParentTitle: "Sell physical objects",
    reviewMode: "manual-check",
    reasoning:
      "The product node has O*NET tasks while the supplies node has Stamp and Money Orders descendants. Compare their scopes before deciding identity versus grouping.",
  }),
  ...duplicateDiagnosis({
    key: "equipment-items",
    canonicalTitle: "Sell Equipment",
    canonicalParentTitle: "Sell physical objects",
    candidateTitle: "Sell Items",
    candidateParentTitle: "Sell physical objects",
    reviewMode: "manual-check",
    reasoning:
      "The broad labels overlap lexically, but their O*NET tasks do not establish identity. Merge only if the source-task scopes are substitutable.",
  }),
);

const rootChildren = semanticChildTitles("Sell");
const whatChildren = (childEdgesByParent.get(node("Sell").id) || [])
  .filter((candidate) => /\bwhat\b/i.test(candidate.collectionName || ""))
  .map((candidate) => nodesById.get(candidate.childId)?.title)
  .filter(Boolean)
  .sort((left, right) => left.localeCompare(right, "en"));
records.push(
  makeRecord({
    key: "miscellaneous-versus-what",
    issueType: "collection-design",
    subject: {
      title: "Sell what?",
      parentTitle: "Sell",
      relatedTitles: ["Sell (Other)"],
    },
    reviewerView: {
      question:
        'Should "Sell what?" become the single object-type collection after every current child is accounted for?',
      currentState:
        'The root has both "Sell what?" and "Sell -- miscellaneous", including the placeholder "Sell (Other)".',
      proposedState:
        'Use "Sell what?" for the object-type dimension and retire the redundant miscellaneous collection and placeholder only after all children are accounted for.',
      reasoning:
        "The generic collection duplicates an explicit specialization dimension. This is a policy proposal and performs no deletion.",
      context: {
        type: "collection-design",
        parentTitle: "Sell",
        currentChildren: rootChildren,
        proposedCollectionName: "Sell what?",
        proposedBranches: whatChildren.map((title) => ({
          title,
          status: "existing",
          children: [],
        })),
        sourceTasks: [],
      },
    },
    refs: {
      subjectNodeId: "",
      parentNodeId: node("Sell").id,
      referencedNodeIds: referencedIds("Sell", rootChildren, whatChildren),
    },
    detectorId: "deterministic-collection-policy-scan",
  }),
);

records.push(
  makeRecord({
    key: "temporary-use-wrapper",
    issueType: "redundant-node",
    reviewMode: "manual-check",
    subject: {
      title: "Sell temporary use",
      parentTitle: "Sell",
      relatedTitles: ["Rent out"],
    },
    reviewerView: {
      question:
        'Is "Sell temporary use" a redundant wrapper for its only child, "Rent out"?',
      currentState:
        '"Sell temporary use" has one semantic child, "Rent out"; "Lease out" is recorded as that child\'s synonym.',
      proposedState:
        "Remove the wrapper only if no additional temporary-use specialization is needed, and preserve its useful wording as metadata.",
      reasoning:
        "The current parent-child relation may be coextensive, but this is a policy decision rather than an automatic singular-child collapse.",
      context: {
        type: "merge-up-action",
        parentTitle: "Sell",
        parentCollection: collectionFor("Sell", "Sell temporary use"),
        nodeTitle: "Sell temporary use",
        childTitles: ["Rent out"],
      },
    },
    refs: {
      subjectNodeId: node("Sell temporary use").id,
      parentNodeId: node("Sell").id,
      referencedNodeIds: referencedIds(
        "Sell",
        "Sell temporary use",
        "Rent out",
      ),
    },
    detectorId: "single-child-wrapper-policy-check",
  }),
);

records.push(
  makeRecord({
    key: "physical-object-flat-list",
    issueType: "flat-list-grouping",
    reviewMode: "manual-check",
    subject: {
      title: "Sell physical objects",
      parentTitle: "Sell",
      relatedTitles: semanticChildTitles("Sell physical objects"),
    },
    reviewerView: {
      question:
        'Is it reasonable to leave all of these activities directly under "Sell physical objects"?',
      currentState: "The physical-object branch remains a long flat list.",
      proposedState:
        "Keep the list unchanged only if no stable, evidence-supported intermediate categories improve retrieval.",
      reasoning:
        "The updated structure policy will separately propose existing-parent moves and coherent groups of two or more. This card records the expert's whole-list judgment.",
      context: {
        type: "flat-list",
        parentTitle: "Sell physical objects",
        currentChildren: semanticChildTitles("Sell physical objects"),
      },
      agreeLabel: "Leave flat",
      disagreeLabel: "Needs grouping",
    },
    refs: {
      subjectNodeId: "",
      parentNodeId: node("Sell physical objects").id,
      referencedNodeIds: referencedIds(
        "Sell physical objects",
        semanticChildTitles("Sell physical objects"),
      ),
    },
    detectorId: "flat-list-coverage-control",
  }),
);

const proposedRecords = records
  .filter((record) => record.reviewMode === "proposed-change")
  .sort((left, right) =>
    `${left.issueType}|${left.proposalId}`.localeCompare(
      `${right.issueType}|${right.proposalId}`,
    ),
  );
const manualChecks = records
  .filter((record) => record.reviewMode === "manual-check")
  .sort((left, right) =>
    `${left.issueType}|${left.proposalId}`.localeCompare(
      `${right.issueType}|${right.proposalId}`,
    ),
  );

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });
fs.cpSync(
  path.join(sourceDatasetDir, "schema"),
  path.join(outputDir, "schema"),
  {
    recursive: true,
  },
);
fs.copyFileSync(snapshotFile, path.join(outputDir, "ontology-snapshot.json"));

const proposalSchemaFile = path.join(
  outputDir,
  "schema",
  "review-proposal.schema.json",
);
const proposalSchema = JSON.parse(fs.readFileSync(proposalSchemaFile, "utf8"));
const contextVariants =
  proposalSchema.definitions.SocietyOfMindReviewProposal.properties.reviewerView
    .properties.context.anyOf;
contextVariants.push({
  type: "object",
  properties: {
    type: { type: "string", const: "evidence-parent-allocation" },
    taskTitle: { type: "string", minLength: 1 },
    currentParentTitles: {
      type: "array",
      items: { type: "string", minLength: 1 },
      minItems: 1,
      uniqueItems: true,
    },
    assignedOutputTitles: {
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
    removedParentTitles: {
      type: "array",
      items: { type: "string", minLength: 1 },
      minItems: 1,
      uniqueItems: true,
    },
  },
  required: [
    "type",
    "taskTitle",
    "currentParentTitles",
    "assignedOutputTitles",
    "retainedParentTitles",
    "removedParentTitles",
  ],
  additionalProperties: false,
});
writeJson(proposalSchemaFile, proposalSchema);

writeJsonl(path.join(outputDir, "all_proposals.jsonl"), proposedRecords);
writeJsonl(path.join(outputDir, "all_controls.jsonl"), []);
writeJsonl(path.join(outputDir, "manual_checks.jsonl"), manualChecks);
fs.mkdirSync(path.join(outputDir, "diagnostics"), { recursive: true });
writeJsonl(
  path.join(outputDir, "diagnostics", "rejected_agent_candidates.jsonl"),
  [],
);

const sourceManifest = JSON.parse(
  fs.readFileSync(path.join(sourceDatasetDir, "manifest.json"), "utf8"),
);
const issueTypes = sourceManifest.issueTypes.map((issue) => ({
  ...issue,
  proposals: proposedRecords.filter((record) => record.issueType === issue.id)
    .length,
  controls: 0,
  manualChecks: manualChecks.filter((record) => record.issueType === issue.id)
    .length,
}));
for (const issue of issueTypes) {
  writeJsonl(
    path.join(outputDir, "proposals", `${issue.id}.jsonl`),
    proposedRecords.filter((record) => record.issueType === issue.id),
  );
  writeJsonl(path.join(outputDir, "controls", `${issue.id}.jsonl`), []);
}

const releasedIssueTypes = [
  ...new Set(records.map((record) => record.issueType)),
];
const manifest = {
  ...sourceManifest,
  datasetVersion,
  generatedAt,
  sourceOntology,
  sourceOntologySha256: snapshotSha256,
  counts: {
    proposals: proposedRecords.length,
    controls: 0,
    manualChecks: manualChecks.length,
    rejectedAgentCandidates: 0,
  },
  issueTypes,
  reviewRelease: {
    strategy: "snapshot-bound-expert-followup",
    currentWave: "rob-outline-followup",
    releasedIssueTypes,
    awaitingRegenerationIssueTypes: [],
    message:
      "Review the snapshot-bound issues identified in the July 28 Sell outline inspection. Exact merges and moves remain dependency-gated, and no response writes to the ontology.",
  },
  safety: {
    reviewOnly: true,
    mutatesOntology: false,
    approvalAuthorizesAutomaticWrite: false,
    modelConfidenceVisibleToReviewer: false,
  },
  limitations: [
    "The records encode Rob's July 28 outline observations as atomic review questions; they are not pre-approved ontology changes.",
    "Admission-pass, postal, equipment/items, and temporary-use cases remain explicit boundary checks.",
    "The collection-policy item cannot delete or reorganize the ontology.",
    "Every application requires a separate snapshot-bound plan tied to reviewed proposal IDs.",
  ],
  sourceSnapshot: {
    ...sourceManifest.sourceSnapshot,
    file: "ontology-snapshot.json",
    sha256: snapshotSha256,
    branchRootTitle: "Sell",
  },
};
writeJson(path.join(outputDir, "manifest.json"), manifest);

writeJson(path.join(outputDir, "diagnostics", "generation-audit.json"), {
  schemaVersion: "som-outline-followup-generation-audit-v1",
  generatedAt,
  datasetVersion,
  auditPolicyVersion: AUDIT_POLICY_VERSION,
  sourceSnapshotSha256: snapshotSha256,
  proposalIds: proposedRecords.map((record) => record.proposalId),
  manualCheckIds: manualChecks.map((record) => record.proposalId),
  ontologyMutated: false,
});

process.stdout.write(
  `${JSON.stringify(
    {
      outputDir,
      datasetVersion,
      sourceSnapshotSha256: snapshotSha256,
      proposals: proposedRecords.length,
      manualChecks: manualChecks.length,
      total: records.length,
    },
    null,
    2,
  )}\n`,
);
