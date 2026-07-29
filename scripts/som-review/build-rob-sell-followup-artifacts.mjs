#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  AUDIT_POLICY_VERSION,
  detectRedundantCollectionPolicy,
} from "./audit-policy.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const defaultSnapshot = path.join(
  repoRoot,
  "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
  "review-datasets-rob-post-structure-2026-07-25",
  "ontology-snapshot.json",
);
const defaultOutput = path.join(
  repoRoot,
  "artifacts",
  "rob-sell-followup-2026-07-28",
);

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

const sha256 = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const args = parseArgs();
const snapshotFile = path.resolve(args.snapshot || defaultSnapshot);
const outputDir = path.resolve(args.output || defaultOutput);
const generatedAt = String(args["generated-at"] || "").trim();
if (!generatedAt || Number.isNaN(Date.parse(generatedAt))) {
  throw new Error("--generated-at must be an ISO-8601 timestamp");
}

const snapshotText = fs.readFileSync(snapshotFile, "utf8");
const snapshot = JSON.parse(snapshotText);
const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
const idsByTitle = new Map();
for (const node of snapshot.nodes) {
  idsByTitle.set(node.title, [...(idsByTitle.get(node.title) || []), node.id]);
}
const parentEdgesByChild = new Map();
const childEdgesByParent = new Map();
for (const edge of snapshot.edges) {
  parentEdgesByChild.set(edge.childId, [
    ...(parentEdgesByChild.get(edge.childId) || []),
    edge,
  ]);
  childEdgesByParent.set(edge.parentId, [
    ...(childEdgesByParent.get(edge.parentId) || []),
    edge,
  ]);
}

const requireNode = (title) => {
  const ids = idsByTitle.get(title) || [];
  if (ids.length !== 1) {
    throw new Error(`Expected one node titled "${title}", found ${ids.length}`);
  }
  return nodesById.get(ids[0]);
};

const parentTitles = (title) =>
  (parentEdgesByChild.get(requireNode(title).id) || [])
    .map((edge) => nodesById.get(edge.parentId)?.title)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, "en"));

const childEvidence = (title) =>
  (childEdgesByParent.get(requireNode(title).id) || [])
    .map((edge) => nodesById.get(edge.childId))
    .filter((node) => node?.oNetTask || /^\(O\*Net\)/i.test(node?.title || ""))
    .map((node) => ({ id: node.id, title: node.title }))
    .sort((left, right) => left.title.localeCompare(right.title, "en"));

const semanticChildren = (title) =>
  (childEdgesByParent.get(requireNode(title).id) || [])
    .map((edge) => ({
      id: edge.childId,
      title: nodesById.get(edge.childId)?.title || "",
      collectionName: edge.collectionName || "main",
    }))
    .filter(
      (child) =>
        child.title &&
        !nodesById.get(child.id)?.oNetTask &&
        !/^\(O\*Net\)/i.test(child.title),
    )
    .sort((left, right) => left.title.localeCompare(right.title, "en"));

const edge = (parentTitle, childTitle) => {
  const parent = requireNode(parentTitle);
  const child = requireNode(childTitle);
  const matches = (childEdgesByParent.get(parent.id) || []).filter(
    (candidate) => candidate.childId === child.id,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected one edge ${parentTitle} -> ${childTitle}, found ${matches.length}`,
    );
  }
  return {
    parentNodeId: parent.id,
    parentTitle,
    childNodeId: child.id,
    childTitle,
    collectionName: matches[0].collectionName || "main",
  };
};

const sellRoot = requireNode("Sell");
const collectionPolicy = detectRedundantCollectionPolicy({
  branch: "Sell",
  children: semanticChildren("Sell"),
});
if (!collectionPolicy) {
  throw new Error("Expected the Sell miscellaneous/What? policy conflict");
}

const funeralTask = requireNode(
  "(O*Net) 18843 - Sell funeral services, products, or merchandise to clients.",
);
const funeralParents = parentTitles(funeralTask.title);
for (const expected of [
  "Sell Funeral Products",
  "Sell Products",
  "Sell Services",
]) {
  if (!funeralParents.includes(expected)) {
    throw new Error(`Funeral evidence is no longer linked to ${expected}`);
  }
}

const identicalEvidence = (leftTitle, rightTitle) => {
  const left = childEvidence(leftTitle).map((item) => item.id);
  const right = childEvidence(rightTitle).map((item) => item.id);
  return (
    left.length > 0 &&
    JSON.stringify(left.sort()) === JSON.stringify(right.sort())
  );
};

const cases = [
  {
    id: "miscellaneous-versus-what",
    failureClass: "prompt-policy-gap",
    disposition: "explicit-policy-review",
    current: collectionPolicy,
    proposed:
      "Account for every root child under the explicit What? dimension before retiring the redundant miscellaneous collection and Other placeholder.",
    automaticApplicationAllowed: false,
  },
  {
    id: "funeral-evidence-lineage",
    failureClass: "dependency-failure",
    disposition: "ready-for-expert-confirmation",
    current: {
      taskNodeId: funeralTask.id,
      taskTitle: funeralTask.title,
      parentTitles: funeralParents,
    },
    proposed: {
      assignedOutputTitles: ["Sell Funeral Products"],
      retainedExistingParentTitles: ["Sell Services"],
      removedExistingParentTitles: ["Sell Products"],
    },
    automaticApplicationAllowed: false,
  },
  {
    id: "insurance-and-investment-semantic-type",
    failureClass: "detector-prompt-policy-gap",
    disposition: "ready-for-expert-confirmation",
    current: [
      edge("Sell information", "Sell Insurance Policies"),
      edge("Sell information", "Sell Investment Instruments"),
    ],
    proposedParent: {
      id: requireNode("Sell service").id,
      title: "Sell service",
    },
    rationale:
      "The sold value is an entitlement and continuing service obligation, not merely the document or data that records it.",
    automaticApplicationAllowed: false,
  },
  {
    id: "bicycle-domain-grouping",
    failureClass: "placement-or-grouping",
    disposition: "ready-for-expert-confirmation",
    current: [
      edge("Sell physical objects", "Sell Bicycles"),
      edge("Sell physical objects", "Sell Bicycle Accessories"),
    ],
    proposedParent: {
      id: requireNode("Sell Sporting Equipment").id,
      title: "Sell Sporting Equipment",
    },
    evidence: [
      ...childEvidence("Sell Bicycles"),
      ...childEvidence("Sell Bicycle Accessories"),
    ],
    automaticApplicationAllowed: false,
  },
  {
    id: "flower-placement",
    failureClass: "placement",
    disposition: "ready-for-expert-confirmation",
    current: edge("Sell physical objects", "Sell Flower"),
    proposedParent: {
      id: requireNode("Sell Agricultural Products").id,
      title: "Sell Agricultural Products",
    },
    evidence: childEvidence("Sell Flower"),
    automaticApplicationAllowed: false,
  },
  {
    id: "food-specialty-placement",
    failureClass: "placement",
    disposition: "ready-for-expert-confirmation",
    current: edge("Sell physical objects", "Sell Food Specialties"),
    proposedParent: {
      id: requireNode("Sell Food and Beverages").id,
      title: "Sell Food and Beverages",
    },
    evidence: childEvidence("Sell Food Specialties"),
    automaticApplicationAllowed: false,
  },
  {
    id: "gambling-chip-token-identity",
    failureClass: "missed-identity",
    disposition: "ready-for-expert-confirmation",
    current: {
      canonical: requireNode("Sell Gambling Chips"),
      candidateSynonym: requireNode("Sell Gambling Tokens"),
      evidenceIsIdentical: identicalEvidence(
        "Sell Gambling Chips",
        "Sell Gambling Tokens",
      ),
      evidence: childEvidence("Sell Gambling Chips"),
    },
    proposed:
      "Keep one activity and preserve the absorbed title as a synonym; move all reciprocal evidence links.",
    automaticApplicationAllowed: false,
  },
  {
    id: "service-number-identity",
    failureClass: "missed-identity",
    disposition: "ready-for-expert-confirmation",
    current: edge("Sell service", "Sell Services"),
    proposed:
      "Merge the generic plural node into the high-level singular activity while preserving its O*NET evidence and the plural form as a synonym.",
    evidence: childEvidence("Sell Services"),
    automaticApplicationAllowed: false,
  },
  {
    id: "admission-pass-ticket-boundary",
    failureClass: "identity-boundary",
    disposition: "needs-explicit-boundary-review",
    current: {
      ticket: requireNode("Sell Ticket"),
      admissionPasses: requireNode("Sell Admission Passes"),
      ticketEvidence: childEvidence("Sell Ticket"),
      admissionPassEvidence: childEvidence("Sell Admission Passes"),
    },
    proposed:
      "Review whether Admission Passes is a synonym or a narrower subtype of Ticket; the evidence is a subset rather than identical, so do not merge automatically.",
    automaticApplicationAllowed: false,
  },
  {
    id: "postal-product-supply-boundary",
    failureClass: "identity-or-grouping-boundary",
    disposition: "needs-source-evidence-review",
    current: {
      products: requireNode("Sell Postal Products"),
      supplies: requireNode("Sell Postal Supplies"),
      productEvidence: childEvidence("Sell Postal Products"),
      supplyChildren: semanticChildren("Sell Postal Supplies"),
    },
    proposed:
      "Compare the O*NET tasks with the Stamp and Money Orders descendants before deciding between merge, parent-child grouping, or separate nodes.",
    automaticApplicationAllowed: false,
  },
  {
    id: "equipment-items-boundary",
    failureClass: "identity-or-grouping-boundary",
    disposition: "needs-source-evidence-review",
    current: {
      equipment: requireNode("Sell Equipment"),
      items: requireNode("Sell Items"),
      equipmentEvidence: childEvidence("Sell Equipment"),
      itemsEvidence: childEvidence("Sell Items"),
    },
    proposed:
      "Do not merge broad related object categories from labels alone; inspect source-task scope first.",
    automaticApplicationAllowed: false,
  },
  {
    id: "temporary-use-wrapper",
    failureClass: "identity-policy-question",
    disposition: "needs-policy-decision",
    current: {
      wrapper: requireNode("Sell temporary use"),
      onlySemanticChild: semanticChildren("Sell temporary use"),
      childSynonyms: requireNode("Rent out").actionAlternatives || [],
    },
    proposed:
      "Review whether the wrapper is coextensive with Rent out. Preserve Lease out as a synonym and retain the wrapper only if another temporary-use specialization is identified.",
    automaticApplicationAllowed: false,
  },
  {
    id: "long-physical-object-list",
    failureClass: "detector-miss-or-judge-threshold",
    disposition: "regenerate-with-policy-v3",
    current: {
      parentNodeId: requireNode("Sell physical objects").id,
      semanticChildCount: semanticChildren("Sell physical objects").length,
    },
    proposed:
      "Rerun the structure detector with existing-parent-first placement and evidence-supported groups of two or more; continue rejecting aesthetic grouping.",
    automaticApplicationAllowed: false,
  },
];

const readyOperations = cases
  .filter((item) => item.disposition === "ready-for-expert-confirmation")
  .map((item) => ({
    caseId: item.id,
    authorized: false,
    requiresReviewedProposalId: true,
    proposedChange: item.proposed || {
      current: item.current,
      proposedParent: item.proposedParent,
    },
  }));

const sourceFiles = [
  "scripts/som-review/build-rob-sell-followup-artifacts.mjs",
  "docs/research/rob-review-workflow-decisions-2026-07-28.md",
  "scripts/som-review/audit-policy.mjs",
  "scripts/som-review/fixtures/rob-sell-policy-regressions-2026-07-28.json",
  "scripts/som-review/clone-and-apply-title-review.mjs",
].map((relativePath) => {
  const absolutePath = path.join(repoRoot, relativePath);
  return {
    path: relativePath,
    sha256: sha256(fs.readFileSync(absolutePath)),
  };
});

const audit = {
  schemaVersion: "som-sell-followup-audit-v1",
  generatedAt,
  auditPolicyVersion: AUDIT_POLICY_VERSION,
  sourceSnapshot: {
    path: path.relative(repoRoot, snapshotFile),
    sha256: sha256(snapshotText),
    ontologyAppId: snapshot.ontologyAppId,
    ontologyName: snapshot.ontologyName,
    capturedAt: snapshot.capturedAt,
    rootNodeId: sellRoot.id,
    nodeCount: snapshot.nodes.length,
    edgeCount: snapshot.edges.length,
  },
  safety: {
    dryRunOnly: true,
    ontologyMutated: false,
    confidenceAuthorizesMutation: false,
    everyOperationRequiresReviewedProposalId: true,
  },
  summary: {
    cases: cases.length,
    readyForExpertConfirmation: readyOperations.length,
    needsBoundaryOrEvidenceReview: cases.filter((item) =>
      item.disposition.startsWith("needs-"),
    ).length,
    regenerationCases: cases.filter(
      (item) => item.disposition === "regenerate-with-policy-v3",
    ).length,
  },
  cases,
};

const plan = {
  schemaVersion: "som-sell-followup-dry-run-plan-v1",
  generatedAt,
  sourceSnapshotSha256: audit.sourceSnapshot.sha256,
  auditPolicyVersion: AUDIT_POLICY_VERSION,
  executable: false,
  reason:
    "These observations occurred during an outline discussion, not as atomic review responses tied to proposal IDs. Generate and review snapshot-bound proposals before application.",
  proposedOperations: readyOperations,
};

const provenance = {
  schemaVersion: "som-research-provenance-v1",
  generatedAt,
  artifactBuilder: "scripts/som-review/build-rob-sell-followup-artifacts.mjs",
  command: `node scripts/som-review/build-rob-sell-followup-artifacts.mjs --generated-at ${generatedAt}`,
  sourceFiles,
  outputs: [
    "artifacts/rob-sell-followup-2026-07-28/followup-audit.json",
    "artifacts/rob-sell-followup-2026-07-28/dry-run-application-plan.json",
    "artifacts/rob-sell-followup-2026-07-28/provenance.json",
  ],
};

writeJson(path.join(outputDir, "followup-audit.json"), audit);
writeJson(path.join(outputDir, "dry-run-application-plan.json"), plan);
writeJson(path.join(outputDir, "provenance.json"), provenance);

process.stdout.write(
  `${JSON.stringify(
    {
      outputDir,
      sourceSnapshotSha256: audit.sourceSnapshot.sha256,
      cases: audit.summary,
      executable: plan.executable,
    },
    null,
    2,
  )}\n`,
);
