#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const DATASET_VERSION = "sell-final-hierarchy-onet-2026-07-15-v2";
const ONTOLOGY_APP_ID = "final-hierarchy-with-o*net";
const ONTOLOGY_NAME = "Final Hierarchy with O*Net";
const SOURCE_ARTIFACT =
  "society-of-mind://sell/comprehensive_candidate_audit.json";

const ISSUE_TYPES = [
  {
    id: "title-clarity",
    label: "Title clarity",
    rolloutStatus: "prototype",
    view: "title-comparison",
  },
  {
    id: "sibling-grouping",
    label: "Sibling grouping",
    rolloutStatus: "prototype",
    view: "grouping-outline",
  },
  {
    id: "duplicate-synonym",
    label: "Duplicate or synonym",
    rolloutStatus: "experimental",
    view: "duplicate-comparison",
  },
  {
    id: "placement",
    label: "Placement",
    rolloutStatus: "experimental",
    view: "placement-comparison",
  },
  {
    id: "wrong-verb",
    label: "Wrong main verb",
    rolloutStatus: "experimental",
    view: "placement-comparison",
  },
  {
    id: "structural-overlap",
    label: "Structural overlap",
    rolloutStatus: "experimental",
    view: "overlap-comparison",
  },
  {
    id: "node-merge",
    label: "Merge nodes",
    rolloutStatus: "experimental",
    view: "merge-action",
  },
  {
    id: "relocation",
    label: "Exact relocation",
    rolloutStatus: "experimental",
    view: "relocation-action",
  },
  {
    id: "missing-activity",
    label: "Missing activity",
    rolloutStatus: "experimental",
    view: "addition-action",
  },
  {
    id: "redundant-node",
    label: "Redundant node",
    rolloutStatus: "experimental",
    view: "merge-up-action",
  },
];

const EXTRA_GROUPINGS = [
  {
    title: "Sell Plants and Flowers",
    parentTitle: "Sell (Physical Object)",
    children: ["Sell Flower", "Sell Plant"],
    reasoning:
      "Sell Flower and Sell Plant have the same supporting O*NET task, and both title-clarity reviews independently converge on Sell Plants and Flowers. The proposed node preserves the narrower activities while giving their shared work a clear home.",
  },
  {
    title: "Sell Cosmetic Supplies",
    parentTitle: "Sell (Physical Object)",
    children: ["Sell Lotion", "Sell Tonic"],
    reasoning:
      "Sell Lotion and Sell Tonic share the same supporting task, which explicitly covers lotions, tonics, and other cosmetic supplies. The proposed grouping keeps the two narrower activities distinct while representing their common category.",
  },
  {
    title: "Sell Stamps and Money Orders",
    parentTitle: "Sell (Physical Object)",
    children: ["Sell Order", "Sell Stamp"],
    reasoning:
      "Sell Order and Sell Stamp share the same source task, Sell stamps and money orders. The proposed grouping represents that combined activity without incorrectly treating stamps and money orders as synonyms.",
  },
  {
    title: "Sell Travel Packages and Incentives",
    parentTitle: "Sell (Information)",
    children: ["Sell Incentive", "Sell Package"],
    reasoning:
      "The linked evidence describes arranging and selling travel packages and promotional travel incentives together. The proposed grouping retains the two narrower activities and represents their shared travel-offering context.",
  },
];

const MISSING_ACTIVITIES = [
  {
    title: "Sell Furniture",
    parentTitle: "Sell (Physical Object)",
    description:
      "Sell movable furnishings such as tables, chairs, sofas, beds, and cabinets.",
    examples: ["a sofa", "a dining table", "a bed frame"],
    reasoning:
      "Furniture sales are a common specialization with product-fit, showroom, delivery, and assembly requirements. No current Sell node names this activity.",
  },
  {
    title: "Sell Appliance",
    parentTitle: "Sell (Physical Object)",
    description:
      "Sell household and commercial appliances such as refrigerators, washing machines, ovens, and dishwashers.",
    examples: ["a refrigerator", "a washing machine", "a dishwasher"],
    reasoning:
      "Appliance sales require sizing, installation, warranty, delivery, and safety knowledge that distinguishes them from generic equipment sales. No current Sell node names this activity.",
  },
  {
    title: "Sell Vehicle",
    parentTitle: "Sell (Physical Object)",
    description:
      "Sell transportation vehicles such as cars, motorcycles, trucks, boats, and recreational vehicles.",
    examples: ["a car", "a motorcycle", "a recreational vehicle"],
    reasoning:
      "Vehicle sales are a major specialization involving title transfer, registration, inspection, financing, and dealer regulation. No current Sell node names whole-vehicle sales.",
  },
  {
    title: "Sell Electronics",
    parentTitle: "Sell (Physical Object)",
    description:
      "Sell electronic devices such as televisions, computers, cameras, audio systems, and mobile devices.",
    examples: ["a television", "a laptop computer", "a digital camera"],
    reasoning:
      "Electronics sales require product specifications, compatibility, setup, demonstration, warranty, and support knowledge. The current Sell subtree has no electronics-specific activity.",
  },
  {
    title: "Sell Medicine",
    parentTitle: "Sell (Physical Object)",
    description:
      "Sell medicinal products such as prescription drugs, over-the-counter medications, and therapeutic supplies.",
    examples: ["prescription tablets", "cough syrup", "pain relievers"],
    reasoning:
      "Medicine sales are a common regulated specialization involving prescription validation, pharmacy licensing, controlled-substance rules, labeling, safety, and storage. No current Sell node names it.",
  },
  {
    title: "Sell Option",
    parentTitle: "Sell (Information)",
    description:
      "Sell options contracts that give the holder the right, but not the obligation, to buy or sell an underlying asset at a specified price.",
    examples: ["a call option", "a put option", "an equity option"],
    reasoning:
      "Options are a standard derivative category with strike, expiration, premium, exercise, disclosure, and approval requirements. Sell Derivative is broader, while no current node names options specifically.",
  },
  {
    title: "Sell Loan",
    parentTitle: "Sell (Information)",
    description:
      "Sell lending products or loan contracts such as mortgages, auto loans, business loans, and personal loans.",
    examples: ["a mortgage loan", "an auto loan", "a small business loan"],
    reasoning:
      "Loan sales involve borrower qualification, underwriting, disclosures, and lending-specific compliance. The current Sell subtree has no loan-product activity.",
  },
  {
    title: "Sell Deposit Account",
    parentTitle: "Sell (Information)",
    description:
      "Sell bank deposit products such as checking accounts, savings accounts, and certificates of deposit.",
    examples: [
      "a checking account",
      "a savings account",
      "a certificate of deposit",
    ],
    reasoning:
      "Deposit-account sales use account-opening, identity-verification, disclosure, and banking-compliance workflows distinct from securities, currency, checks, or insurance. No current Sell node names this activity.",
  },
  {
    title: "Sell License",
    parentTitle: "Sell (Information)",
    description:
      "Sell legal permissions or usage rights, such as software, intellectual-property, or operating licenses.",
    examples: ["a software license", "a patent license", "a broadcast license"],
    reasoning:
      "License sales involve rights scope, usage restrictions, renewal, and legal or regulatory compliance. The current Sell subtree has no license-specific activity.",
  },
  {
    title: "Sell Subscription",
    parentTitle: "Sell (Information)",
    description:
      "Sell recurring access rights to content, services, software, or publications.",
    examples: [
      "a streaming subscription",
      "a SaaS subscription",
      "a magazine subscription",
    ],
    reasoning:
      "Subscription sales involve recurring billing, provisioning, renewal, cancellation, and auto-renewal rules. The current Sell subtree has no subscription-specific activity.",
  },
];

function parseArgs() {
  const values = {};
  for (let index = 2; index < process.argv.length; index += 1) {
    const argument = process.argv[index];
    if (!argument.startsWith("--")) continue;
    const [name, inlineValue] = argument.slice(2).split("=", 2);
    values[name] = inlineValue ?? process.argv[++index];
  }
  return values;
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

function writeJsonl(file, values) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    values.map((value) => JSON.stringify(value)).join("\n") +
      (values.length ? "\n" : ""),
    "utf8",
  );
}

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function proposalId(issueType, key) {
  return `som-${hash(`${DATASET_VERSION}|${issueType}|${key}`).slice(0, 20)}`;
}

function normalizeCollection(value = "") {
  const unwrapped = String(value).trim().replace(/^\[/, "").replace(/\]$/, "");
  return !unwrapped || unwrapped === "default" ? "main" : unwrapped;
}

function edgeKey(parentId, childId, collectionName = "main") {
  return `${parentId}\u001f${normalizeCollection(collectionName)}\u001f${childId}`;
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
    childrenByParent.set(edge.parentId, [
      ...(childrenByParent.get(edge.parentId) || []),
      edge,
    ]);
  }
  return { nodesById, idByTitle, edgeKeys, edgePairs, childrenByParent };
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

function directChildren(index, title, { evidence = true } = {}) {
  const parentId = resolveTitle(index, title);
  return (index.childrenByParent.get(parentId) || [])
    .map((edge) => index.nodesById.get(edge.childId)?.title || "")
    .filter(
      (childTitle) =>
        childTitle && (evidence || !childTitle.startsWith("(O*Net)")),
    )
    .sort((left, right) => left.localeCompare(right, "en"));
}

function collectionFor(index, parentTitle, childTitle) {
  const parentId = resolveTitle(index, parentTitle);
  const childId = resolveTitle(index, childTitle);
  const edge = (index.childrenByParent.get(parentId) || []).find(
    (candidate) => candidate.childId === childId,
  );
  if (!edge)
    throw new Error(`Missing relation: ${parentTitle} -> ${childTitle}`);
  return normalizeCollection(edge.collectionName);
}

function deriveRefs(context, index) {
  const referenced = new Set();
  const addTitle = (title) => {
    const id = resolveTitle(index, title);
    referenced.add(id);
    return id;
  };
  let subjectNodeId = "";
  let parentNodeId = "";

  switch (context.type) {
    case "grouping-outline": {
      if (index.idByTitle.has(context.proposedGroupTitle)) {
        throw new Error(
          `Proposed grouping already exists: ${context.proposedGroupTitle}`,
        );
      }
      parentNodeId = addTitle(context.parentTitle);
      for (const title of [
        ...context.proposedChildren,
        ...context.unaffectedChildren,
      ]) {
        const childId = addTitle(title);
        requireAnyEdge(index, parentNodeId, childId);
      }
      break;
    }
    case "merge-action": {
      parentNodeId = addTitle(context.parentTitle);
      const canonicalId = addTitle(context.canonicalTitle);
      subjectNodeId = addTitle(context.absorbedTitle);
      requireEdge(
        index,
        parentNodeId,
        canonicalId,
        context.canonicalCollection,
      );
      requireEdge(
        index,
        parentNodeId,
        subjectNodeId,
        context.absorbedCollection,
      );
      for (const title of context.canonicalChildren) {
        requireAnyEdge(index, canonicalId, addTitle(title));
      }
      for (const title of context.absorbedChildren) {
        requireAnyEdge(index, subjectNodeId, addTitle(title));
      }
      break;
    }
    case "addition-action": {
      if (index.idByTitle.has(context.proposedTitle)) {
        throw new Error(
          `Proposed missing activity already exists: ${context.proposedTitle}`,
        );
      }
      parentNodeId = addTitle(context.parentTitle);
      break;
    }
    case "merge-up-action": {
      parentNodeId = addTitle(context.parentTitle);
      subjectNodeId = addTitle(context.nodeTitle);
      requireEdge(index, parentNodeId, subjectNodeId, context.parentCollection);
      for (const title of context.childTitles) {
        requireAnyEdge(index, subjectNodeId, addTitle(title));
      }
      break;
    }
    default:
      throw new Error(`Unsupported generated context: ${context.type}`);
  }

  return {
    subjectNodeId,
    parentNodeId,
    referencedNodeIds: [...referenced].sort(),
  };
}

function makeRecord({
  manifest,
  index,
  snapshotHash,
  generatedAt,
  issueType,
  key,
  subject,
  reviewerView,
  evidence,
}) {
  const refs = deriveRefs(reviewerView.context, index);
  return {
    schemaVersion: "som-review-v1",
    datasetVersion: DATASET_VERSION,
    proposalId: proposalId(issueType, key),
    branch: "Sell",
    issueType,
    reviewMode: "proposed-change",
    rolloutStatus: "experimental",
    subject: {
      title: subject.title,
      parentTitle: subject.parentTitle || "",
      path: subject.path || [],
      relatedTitles: subject.relatedTitles || [],
    },
    reviewerView: {
      ...reviewerView,
      agreeLabel: reviewerView.agreeLabel || "Agree",
      disagreeLabel: reviewerView.disagreeLabel || "Disagree",
      rejectionReasonRequired: true,
      autoAdvanceOnAgree: true,
      hideModelConfidence: true,
    },
    internalModelEvidence: {
      detectorId: evidence.detectorId,
      detectorName: evidence.detectorName,
      detectorPromptVersion: evidence.detectorPromptVersion || "",
      judgeId: evidence.judgeId || "",
      judgeName: evidence.judgeName || "",
      judgePromptVersion: evidence.judgePromptVersion || "",
      detectorConfidence: evidence.detectorConfidence || "",
      judgeConfidence: evidence.judgeConfidence || "",
      reviewerVisible: false,
    },
    provenance: {
      sourceOntology: manifest.sourceOntology,
      sourceOntologySha256: snapshotHash,
      sourceArtifact: SOURCE_ARTIFACT,
      sourceRecord: key,
      sourceOntologyAppId: ONTOLOGY_APP_ID,
      sourceOntologyName: ONTOLOGY_NAME,
      sourceSnapshotSha256: snapshotHash,
      ...refs,
    },
    createdAt: generatedAt,
  };
}

function groupingRecords({ manifest, index, snapshotHash, generatedAt }) {
  return EXTRA_GROUPINGS.map((candidate) => {
    const unaffectedChildren = directChildren(index, candidate.parentTitle, {
      evidence: false,
    }).filter((title) => !candidate.children.includes(title));
    return makeRecord({
      manifest,
      index,
      snapshotHash,
      generatedAt,
      issueType: "sibling-grouping",
      key: `evidence-grouping:${candidate.title}`,
      subject: {
        title: candidate.title,
        parentTitle: candidate.parentTitle,
        relatedTitles: candidate.children,
      },
      reviewerView: {
        question: `Should the new grouping "${candidate.title}" be created under "${candidate.parentTitle}" with the highlighted children under it?`,
        currentState: `${candidate.children.join(", ")} are direct children of ${candidate.parentTitle}.`,
        proposedState: `Create ${candidate.title} and move the highlighted children beneath it.`,
        reasoning: candidate.reasoning,
        context: {
          type: "grouping-outline",
          parentTitle: candidate.parentTitle,
          structure: "intermediate",
          proposedGroupTitle: candidate.title,
          proposedChildren: candidate.children,
          unaffectedChildren,
        },
      },
      evidence: {
        detectorId: "evidence-convergence-scan",
        detectorName: "SharedEvidenceGroupingAuditor",
        detectorPromptVersion: "sell-comprehensive-audit-2026-07-15",
        judgeId: "human-audit",
        judgeName: "SnapshotBoundActionAuditor",
        detectorConfidence: "high",
        judgeConfidence: "high",
      },
    });
  });
}

function mergeRecord({
  manifest,
  index,
  snapshotHash,
  generatedAt,
  canonicalTitle,
  absorbedTitle,
  reasoning,
  evidence,
}) {
  const parentTitle = "Sell";
  const canonicalCollection = collectionFor(index, parentTitle, canonicalTitle);
  const absorbedCollection = collectionFor(index, parentTitle, absorbedTitle);
  const canonicalChildren = directChildren(index, canonicalTitle);
  const absorbedChildren = directChildren(index, absorbedTitle);
  const resultingChildren = [
    ...new Set([...canonicalChildren, ...absorbedChildren]),
  ].sort((left, right) => left.localeCompare(right, "en"));
  const moveSummary = absorbedChildren.length
    ? `move its ${absorbedChildren.length} direct ${
        absorbedChildren.length === 1 ? "child" : "children"
      }, `
    : "";
  const context = {
    type: "merge-action",
    parentTitle,
    canonicalTitle,
    canonicalCollection,
    canonicalChildren,
    absorbedTitle,
    absorbedCollection,
    absorbedChildren,
    resultingChildren,
    absorbedBecomesSynonym: true,
  };
  return makeRecord({
    manifest,
    index,
    snapshotHash,
    generatedAt,
    issueType: "node-merge",
    key: `merge:${absorbedTitle}->${canonicalTitle}`,
    subject: {
      title: absorbedTitle,
      parentTitle,
      relatedTitles: [canonicalTitle],
    },
    reviewerView: {
      question: `Should "${absorbedTitle}" be merged into "${canonicalTitle}"?`,
      currentState: `"${canonicalTitle}" and "${absorbedTitle}" are separate nodes under "${parentTitle}".`,
      proposedState: `Keep "${canonicalTitle}", ${moveSummary}record "${absorbedTitle}" as a synonym, and remove the separate "${absorbedTitle}" node.`,
      reasoning,
      context,
    },
    evidence,
  });
}

function mergeRecords(args) {
  return [
    mergeRecord({
      ...args,
      canonicalTitle: "Rent out",
      absorbedTitle: "Lease out",
      reasoning:
        "The semantic review concluded that both titles name granting temporary paid use of an asset. Rent out is the broader everyday title; Lease out is a formal near-synonym. Both nodes currently have no direct children.",
      evidence: {
        detectorId: "D8",
        detectorName: "DuplicateScanner",
        detectorPromptVersion: "wave-13-d8-duplicate-scanner-2026-05",
        judgeId: "H3",
        judgeName: "CanonicalTitleChooser",
        judgePromptVersion: "wave-13-h3-canonical-title-chooser-2026-05",
        detectorConfidence: "high",
        judgeConfidence: "high",
      },
    }),
    mergeRecord({
      ...args,
      canonicalTitle: "Sell information",
      absorbedTitle: "Sell (Information)",
      reasoning:
        "The two titles normalize to the same concept. The surviving node is already in the explicit Sell what? collection; consolidation moves the populated wrapper's current children into that facet and retires the duplicate miscellaneous wrapper.",
      evidence: {
        detectorId: "deterministic-overlap-scan",
        detectorName: "SiblingMiscFacetOverlapScanner",
        judgeId: "snapshot-action-audit",
        judgeName: "StructuralConsolidationAuditor",
        detectorConfidence: "high",
        judgeConfidence: "high",
      },
    }),
    mergeRecord({
      ...args,
      canonicalTitle: "Sell physical objects",
      absorbedTitle: "Sell (Physical Object)",
      reasoning:
        "The two titles normalize to the same concept. The surviving node is already in the explicit Sell what? collection; consolidation moves the populated wrapper's current children into that facet and retires the duplicate miscellaneous wrapper.",
      evidence: {
        detectorId: "deterministic-overlap-scan",
        detectorName: "SiblingMiscFacetOverlapScanner",
        judgeId: "snapshot-action-audit",
        judgeName: "StructuralConsolidationAuditor",
        detectorConfidence: "high",
        judgeConfidence: "high",
      },
    }),
  ];
}

function missingActivityRecords({
  manifest,
  index,
  snapshotHash,
  generatedAt,
}) {
  return MISSING_ACTIVITIES.map((candidate) =>
    makeRecord({
      manifest,
      index,
      snapshotHash,
      generatedAt,
      issueType: "missing-activity",
      key: `missing:${candidate.title}`,
      subject: {
        title: candidate.title,
        parentTitle: candidate.parentTitle,
      },
      reviewerView: {
        question: `Should the missing activity "${candidate.title}" be added under "${candidate.parentTitle}"?`,
        currentState: `"${candidate.parentTitle}" has no direct child named "${candidate.title}".`,
        proposedState: `Add "${candidate.title}" as a direct child of "${candidate.parentTitle}".`,
        reasoning: candidate.reasoning,
        context: {
          type: "addition-action",
          parentTitle: candidate.parentTitle,
          proposedTitle: candidate.title,
          description: candidate.description,
          examples: candidate.examples,
        },
      },
      evidence: {
        detectorId: "D9",
        detectorName: "GapScanner",
        detectorPromptVersion: "wave-17-d9-gap-scanner-2026-05",
        judgeId: "H4+H5",
        judgeName: "NoveltyAndDistinctionGates",
        judgePromptVersion: "wave-18-h4+wave-17-h5-2026-05",
        detectorConfidence: "high",
        judgeConfidence: "high",
      },
    }),
  );
}

function redundantNodeRecord(args) {
  const { manifest, index, snapshotHash, generatedAt } = args;
  const parentTitle = "Sell";
  const nodeTitle = "Sell (Other)";
  const parentCollection = collectionFor(index, parentTitle, nodeTitle);
  const childTitles = directChildren(index, nodeTitle);
  return makeRecord({
    manifest,
    index,
    snapshotHash,
    generatedAt,
    issueType: "redundant-node",
    key: `merge-up:${nodeTitle}->${parentTitle}`,
    subject: { title: nodeTitle, parentTitle, relatedTitles: childTitles },
    reviewerView: {
      question: `Should the redundant wrapper "${nodeTitle}" be removed and its children moved directly under "${parentTitle}"?`,
      currentState: `"${nodeTitle}" is a one-child wrapper under "${parentTitle}".`,
      proposedState: `Move ${childTitles.join(", ")} directly under "${parentTitle}" and remove "${nodeTitle}".`,
      reasoning:
        "Sell (Other) is a miscellaneous wrapper with only one direct child, so it adds a navigation step without distinguishing among multiple kinds of selling. The child remains a valid direct kind of Sell.",
      context: {
        type: "merge-up-action",
        parentTitle,
        parentCollection,
        nodeTitle,
        childTitles,
      },
    },
    evidence: {
      detectorId: "deterministic-single-child-scan",
      detectorName: "RedundantWrapperScanner",
      judgeId: "snapshot-action-audit",
      judgeName: "MergeUpAuditor",
      detectorConfidence: "high",
      judgeConfidence: "medium",
    },
  });
}

function extendSchema(schema) {
  const proposal = schema.definitions.SocietyOfMindReviewProposal;
  proposal.properties.issueType.enum = ISSUE_TYPES.map((issue) => issue.id);
  const nonEmpty = {
    $ref: "#/definitions/SocietyOfMindReviewProposal/properties/datasetVersion",
  };
  const stringArray = (minimum = 0) => ({
    type: "array",
    items: nonEmpty,
    ...(minimum ? { minItems: minimum } : {}),
  });
  const contextOptions =
    proposal.properties.reviewerView.properties.context.anyOf;
  const existingTypes = new Set(
    contextOptions.map((option) => option.properties?.type?.const),
  );
  const additions = [
    {
      type: "object",
      properties: {
        type: { type: "string", const: "merge-action" },
        parentTitle: nonEmpty,
        canonicalTitle: nonEmpty,
        canonicalCollection: nonEmpty,
        canonicalChildren: stringArray(),
        absorbedTitle: nonEmpty,
        absorbedCollection: nonEmpty,
        absorbedChildren: stringArray(),
        resultingChildren: stringArray(),
        absorbedBecomesSynonym: { type: "boolean" },
      },
      required: [
        "type",
        "parentTitle",
        "canonicalTitle",
        "canonicalCollection",
        "canonicalChildren",
        "absorbedTitle",
        "absorbedCollection",
        "absorbedChildren",
        "resultingChildren",
        "absorbedBecomesSynonym",
      ],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        type: { type: "string", const: "relocation-action" },
        nodeTitle: nonEmpty,
        currentParentTitle: nonEmpty,
        currentCollection: nonEmpty,
        proposedParentTitle: nonEmpty,
        proposedCollection: nonEmpty,
        childTitles: stringArray(),
      },
      required: [
        "type",
        "nodeTitle",
        "currentParentTitle",
        "currentCollection",
        "proposedParentTitle",
        "proposedCollection",
        "childTitles",
      ],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        type: { type: "string", const: "addition-action" },
        parentTitle: nonEmpty,
        proposedTitle: nonEmpty,
        description: nonEmpty,
        examples: stringArray(),
      },
      required: [
        "type",
        "parentTitle",
        "proposedTitle",
        "description",
        "examples",
      ],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        type: { type: "string", const: "merge-up-action" },
        parentTitle: nonEmpty,
        parentCollection: nonEmpty,
        nodeTitle: nonEmpty,
        childTitles: stringArray(1),
      },
      required: [
        "type",
        "parentTitle",
        "parentCollection",
        "nodeTitle",
        "childTitles",
      ],
      additionalProperties: false,
    },
  ];
  for (const addition of additions) {
    if (!existingTypes.has(addition.properties.type.const)) {
      contextOptions.push(addition);
    }
  }
  return schema;
}

function main() {
  const args = parseArgs();
  const directory = path.resolve(
    args.directory ||
      "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15/review-datasets",
  );
  const manifestPath = path.join(directory, "manifest.json");
  const manifest = readJson(manifestPath);
  const generatedAt =
    args["generated-at"] ||
    (manifest.datasetVersion === DATASET_VERSION && manifest.generatedAt) ||
    new Date().toISOString();
  const snapshotPath = path.join(directory, "ontology-snapshot.json");
  const snapshotText = fs.readFileSync(snapshotPath, "utf8");
  const snapshotHash = hash(snapshotText);
  if (snapshotHash !== manifest.sourceSnapshot.sha256) {
    throw new Error(
      "Ontology snapshot hash does not match the current manifest",
    );
  }
  const snapshot = JSON.parse(snapshotText);
  const index = buildIndex(snapshot);

  const existingProposals = readJsonl(
    path.join(directory, "all_proposals.jsonl"),
  )
    .filter((record) => record.provenance?.sourceArtifact !== SOURCE_ARTIFACT)
    .map((record) => ({
      ...record,
      datasetVersion: DATASET_VERSION,
      issueType:
        record.reviewerView?.context?.placementIssue === "wrong-verb"
          ? "wrong-verb"
          : record.issueType,
      reviewerView:
        record.reviewerView?.context?.type === "placement-comparison"
          ? {
              ...record.reviewerView,
              proposedState:
                record.reviewerView.context.placementIssue === "wrong-verb"
                  ? `"${record.reviewerView.context.nodeTitle}" is not a kind of selling and does not belong under "${record.reviewerView.context.currentParentTitle}".`
                  : `"${record.reviewerView.context.nodeTitle}" does not belong under "${record.reviewerView.context.currentParentTitle}".`,
            }
          : record.reviewerView,
    }));
  const existingControls = readJsonl(
    path.join(directory, "all_controls.jsonl"),
  ).map((record) => ({ ...record, datasetVersion: DATASET_VERSION }));
  const manualChecks = readJsonl(
    path.join(directory, "manual_checks.jsonl"),
  ).map((record) => ({ ...record, datasetVersion: DATASET_VERSION }));

  const generationArgs = {
    manifest,
    index,
    snapshotHash,
    generatedAt,
  };
  const generatedProposals = [
    ...groupingRecords(generationArgs),
    ...mergeRecords(generationArgs),
    ...missingActivityRecords(generationArgs),
    redundantNodeRecord(generationArgs),
  ];
  const existingKeys = new Set(
    existingProposals.map((record) => record.proposalId),
  );
  for (const proposal of generatedProposals) {
    if (existingKeys.has(proposal.proposalId)) {
      throw new Error(
        `Duplicate generated proposal id: ${proposal.proposalId}`,
      );
    }
  }
  const proposals = [...existingProposals, ...generatedProposals];

  writeJsonl(path.join(directory, "all_proposals.jsonl"), proposals);
  writeJsonl(path.join(directory, "all_controls.jsonl"), existingControls);
  writeJsonl(path.join(directory, "manual_checks.jsonl"), manualChecks);

  for (const issue of ISSUE_TYPES) {
    const issueProposals = proposals.filter(
      (record) => record.issueType === issue.id,
    );
    const issueControls = existingControls.filter(
      (record) => record.issueType === issue.id,
    );
    writeJsonl(
      path.join(directory, "proposals", `${issue.id}.jsonl`),
      issueProposals,
    );
    writeJsonl(
      path.join(directory, "controls", `${issue.id}.jsonl`),
      issueControls,
    );
  }

  manifest.datasetVersion = DATASET_VERSION;
  manifest.generatedAt = generatedAt;
  manifest.issueTypes = ISSUE_TYPES.map((issue) => ({
    ...issue,
    proposals: proposals.filter((record) => record.issueType === issue.id)
      .length,
    controls: existingControls.filter((record) => record.issueType === issue.id)
      .length,
  }));
  manifest.counts.proposals = proposals.length;
  manifest.counts.controls = existingControls.length;
  manifest.counts.manualChecks = manualChecks.length;
  manifest.coverage = {
    snapshotBound: true,
    exhaustiveWithinPackagedDetectorOutputs: true,
    semanticCompletenessGuaranteed: false,
    exactRelocationsWithVerifiedCurrentTargets: 0,
    note: "All accepted candidates found by the packaged Sell scans and the revalidated action audit are included. No finite semantic scan can prove that every possible ontology defect has been found.",
  };
  manifest.limitations = [
    "The dataset is exhaustive for the packaged detector outputs and the snapshot-bound action audit, not a proof that no other semantic issue exists.",
    "Optional description and synonym enrichment is not counted as an ontology issue in this package. The current source snapshot has no structured synonym field, so the older enrichment suggestions must be refreshed and given a separate atomic review contract before they can be served safely.",
    "Placement and wrong-verb approvals only confirm the diagnosis. An exact relocation is offered only when a current target node and relation are verified.",
    "The exact-relocation queue is intentionally empty because the current evidence names only advisory destinations, not safe current target nodes.",
    "Merge, grouping, and redundant-node decisions are review-only. Acceptance does not write to Firestore.",
    "Some proposals conflict or depend on one another; accepted actions must be sequenced and revalidated against a fresh snapshot before implementation.",
  ];
  writeJson(manifestPath, manifest);

  const schemaPath = path.join(
    directory,
    "schema",
    "review-proposal.schema.json",
  );
  writeJson(schemaPath, extendSchema(readJson(schemaPath)));
  writeJson(
    path.join(directory, "diagnostics", "comprehensive_candidate_audit.json"),
    {
      schemaVersion: "sell-comprehensive-candidate-audit-v1",
      datasetVersion: DATASET_VERSION,
      generatedAt,
      sourceSnapshotSha256: snapshotHash,
      taxonomy: ISSUE_TYPES,
      generatedCounts: {
        evidenceConvergenceGroupings: EXTRA_GROUPINGS.length,
        exactMerges: 3,
        exactRelocations: 0,
        missingActivities: MISSING_ACTIVITIES.length,
        redundantNodes: 1,
      },
      evidenceConvergenceGroupings: EXTRA_GROUPINGS,
      missingActivities: MISSING_ACTIVITIES,
      decisions: [
        "Wrong-verb findings were separated from ordinary placement findings.",
        "Rent out and Lease out received an exact merge proposal after D8/H3 confirmation.",
        "The two normalized cross-collection overlaps received exact structural-consolidation proposals.",
        "No exact relocation was generated because no advisory destination was both precise and validated as the intended current target.",
        "Rejected duplicate and grouping candidates remain in rejected_agent_candidates.jsonl and were not promoted.",
      ],
    },
  );

  process.stdout.write(
    `${DATASET_VERSION}: ${proposals.length} proposals, ${existingControls.length} controls\n`,
  );
}

main();
