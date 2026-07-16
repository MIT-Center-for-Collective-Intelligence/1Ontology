#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const DATASET_VERSION = "sell-final-hierarchy-onet-2026-07-15-v3";
const ONTOLOGY_APP_ID = "final-hierarchy-with-o*net";
const ONTOLOGY_NAME = "Final Hierarchy with O*Net";
const SOURCE_ARTIFACT =
  "society-of-mind://sell/comprehensive_candidate_audit.json";

const ISSUE_TYPES = [
  {
    id: "title-clarity",
    label: "1. Clarify unclear titles",
    stage: "content",
    robTaskIds: [1],
    rolloutStatus: "prototype",
    view: "title-comparison",
  },
  {
    id: "synonym-enrichment",
    label: "2. Add missing synonyms",
    stage: "content",
    robTaskIds: [2],
    rolloutStatus: "experimental",
    view: "metadata-edit",
  },
  {
    id: "description-enrichment",
    label: "3. Add missing descriptions",
    stage: "content",
    robTaskIds: [3],
    rolloutStatus: "experimental",
    view: "metadata-edit",
  },
  {
    id: "misc-facet-duplicate",
    label: "4. Repeated miscellaneous/facet nodes",
    stage: "within-branch",
    robTaskIds: [4],
    rolloutStatus: "experimental",
    view: "overlap-comparison",
  },
  {
    id: "mistaken-synonym",
    label: "5. Mistaken synonyms",
    stage: "content",
    robTaskIds: [5],
    rolloutStatus: "experimental",
    view: "metadata-edit",
  },
  {
    id: "duplicate-synonym",
    label: "6. Undetected synonyms",
    stage: "content",
    robTaskIds: [6],
    rolloutStatus: "experimental",
    view: "duplicate-comparison",
  },
  {
    id: "polysemy",
    label: "7. Undetected double meanings",
    stage: "content",
    robTaskIds: [7],
    rolloutStatus: "experimental",
    view: "polysemy-review",
  },
  {
    id: "flat-list-grouping",
    label: "8. Group long flat lists",
    stage: "within-branch",
    robTaskIds: [8],
    rolloutStatus: "prototype",
    view: "grouping-outline",
  },
  {
    id: "compound-object-grouping",
    label: "9. Group compound objects",
    stage: "within-branch",
    robTaskIds: [9],
    rolloutStatus: "prototype",
    view: "grouping-outline",
  },
  {
    id: "collection-design",
    label: "10. Create warranted collections",
    stage: "within-branch",
    robTaskIds: [10],
    rolloutStatus: "experimental",
    view: "collection-design",
  },
  {
    id: "placement",
    label: "11. Wrong place within Sell",
    stage: "within-branch",
    robTaskIds: [11],
    rolloutStatus: "experimental",
    view: "placement-comparison",
  },
  {
    id: "wrong-verb",
    label: "12. Misjudged synonyms outside Sell",
    stage: "outside-branch",
    robTaskIds: [12],
    rolloutStatus: "experimental",
    view: "placement-comparison",
  },
  {
    id: "sense-relocation",
    label: "13. Move non-selling senses",
    stage: "outside-branch",
    robTaskIds: [13],
    rolloutStatus: "experimental",
    view: "sense-relocation-action",
  },
  {
    id: "node-merge",
    label: "Apply approved node merges",
    stage: "final-action",
    robTaskIds: [4, 6],
    rolloutStatus: "experimental",
    view: "merge-action",
  },
  {
    id: "relocation",
    label: "Apply approved relocations",
    stage: "final-action",
    robTaskIds: [11, 12],
    rolloutStatus: "experimental",
    view: "relocation-action",
  },
  {
    id: "missing-activity",
    label: "Missing activity",
    stage: "additional-quality",
    robTaskIds: [],
    rolloutStatus: "experimental",
    view: "addition-action",
  },
  {
    id: "redundant-node",
    label: "Redundant node",
    stage: "additional-quality",
    robTaskIds: [],
    rolloutStatus: "experimental",
    view: "merge-up-action",
  },
];

const ISSUE_BY_ID = new Map(ISSUE_TYPES.map((issue) => [issue.id, issue]));

const PRODUCT_SYNONYM_PAIRS = [
  ["Sell Product", "Sell Merchandise"],
  ["Sell Product", "Sell Good"],
  ["Sell Product", "Sell Item"],
  ["Sell Product", "Sell Supply"],
];

const SERVICE_RELOCATIONS = [
  {
    title: "Sell Contract",
    reasoning:
      "A contract is an ongoing legal or service arrangement rather than a standalone information object. The current ontology already has Sell service as the verified home for selling services and arrangements.",
  },
  {
    title: "Sell Membership",
    reasoning:
      "A membership grants continuing access or participation. It is therefore a service or ongoing arrangement rather than a standalone information object.",
  },
  {
    title: "Sell Pass",
    reasoning:
      "A pass grants admission or continuing access to an event, facility, or service. The access arrangement is more central than the physical or digital credential that records it.",
  },
  {
    title: "Sell Ticket",
    reasoning:
      "A ticket primarily grants access to transportation, an event, a facility, or another service. Its physical or digital carrier is incidental to the right being sold.",
  },
  {
    title: "Sell Incentive",
    reasoning:
      "The linked activity concerns a travel incentive or arrangement, so the service being arranged is more central than a standalone information object.",
  },
  {
    title: "Sell Package",
    reasoning:
      "The linked activity concerns a travel package that bundles transportation, lodging, or related services. The package is an arrangement rather than a standalone information object.",
  },
];

const MARKET_TITLES = [
  "Market Artwork",
  "Market Casino",
  "Market Event",
  "Market Product",
  "Market Space",
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

const DESCRIPTION_PROPOSALS = {
  "Sell Service (1)":
    "Sell services to customers or organizations in exchange for payment.",
  "Sell Jewelry":
    "Sell jewelry to customers or broker jewelry transactions between buyers and sellers.",
  "Sell Package":
    "Sell travel packages that combine transportation, lodging, tours, or related services.",
  "Sell Souvenir": "Sell souvenirs to tourists and other customers.",
  "Sell Lotion":
    "Recommend and sell cosmetic lotions and related skin-care supplies.",
  "Sell Order": "Sell money orders and related payment products to customers.",
  "Sell Good": "Sell goods to customers in exchange for payment.",
  "Sell Supply":
    "Sell supplies needed for agriculture, expeditions, pet care, cosmetics, or other activities.",
  "Sell Product":
    "Sell products to customers or organizations in exchange for payment.",
  "Sell Specialty":
    "Sell prepared food specialties, such as sandwiches and beverages, at workplaces or events.",
  "Sell Future":
    "Sell commodity futures or other futures contracts on behalf of customers or investment firms.",
  "Sell Flower": "Sell and deliver flowers and related plants to customers.",
  "Sell Accessory":
    "Sell accessories that complement or modify another product, such as vehicle or bicycle accessories.",
  "Sell Food": "Sell food products to customers.",
  "Sell Policy": "Sell insurance policies to individuals or organizations.",
  "Sell Beverage": "Sell alcoholic or nonalcoholic beverages to customers.",
  "Sell Membership":
    "Sell memberships that grant continuing access to an organization, facility, event, or service.",
  "Sell Derivative": "Sell financial derivative contracts for customers.",
  "Sell Estate":
    "Sell real estate owned by another party in exchange for a fee or commission.",
  "Sell Part": "Sell replacement parts and related components.",
  "Sell Contract":
    "Sell service contracts for technical, scientific, or other products.",
  "Sell Stock":
    "Sell shares of stock on behalf of customers or investment firms.",
  "Sell Pass":
    "Sell passes that grant admission or access to an event, facility, or service.",
  "Sell Equipment": "Sell equipment and related products to customers.",
  "Sell Clothing": "Sell clothing and related apparel to customers.",
  "Sell Currency":
    "Sell foreign currency on behalf of customers or investment firms.",
  "Market Artwork":
    "Promote artwork to potential buyers through brochures, mailings, websites, or other channels.",
  "Market Space":
    "Promote vacant real estate space to prospective tenants through leasing agents, advertising, or other methods.",
  "Sell Makeup": "Recommend and sell makeup to clients.",
  "Sell Stamp": "Sell postage stamps to customers.",
  "Sell Check":
    "Sell traveler's checks and related payment instruments to customers.",
  "Sell Products or Ideas":
    "Influence others by selling products or persuading them to accept ideas.",
  "Sell Token":
    "Sell casino or gambling tokens to patrons or other workers for resale.",
  "Sell Item": "Sell tickets and other items to customers.",
  "Sell Tobacco": "Sell tobacco products to customers.",
  "Sell Tonic": "Recommend and sell cosmetic tonics and related supplies.",
  "Sell Plant": "Sell and deliver plants and flowers to customers.",
  "Sell Bicycle": "Sell bicycles and related accessories.",
  "Sell Incentive":
    "Sell promotional travel incentives as part of a travel arrangement.",
  "Sell Bond": "Sell bonds on behalf of customers or investment firms.",
  "Sell Chip":
    "Sell casino or gambling chips to patrons or other workers for resale.",
  "Market Casino":
    "Promote a casino to attract customers and increase business.",
  "Market Product":
    "Promote products to potential customers through retail, direct-mail, banking, or other channels.",
  "Market Event": "Promote events to potential attendees or customers.",
  "Sell Ticket":
    "Sell tickets that grant admission or access to events, transportation, or services.",
  "Sell Refreshment": "Sell and serve refreshments to customers.",
  "Sell Merchandise":
    "Sell merchandise to customers and arrange related delivery, financing, insurance, or service contracts.",
};

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

function directParent(index, childTitle) {
  const childId = resolveTitle(index, childTitle);
  const matches = [];
  for (const [parentId, edges] of index.childrenByParent) {
    for (const edge of edges) {
      if (edge.childId === childId) matches.push({ parentId, edge });
    }
  }
  if (matches.length !== 1) {
    throw new Error(
      `Expected one direct parent for ${childTitle}, found ${matches.length}`,
    );
  }
  return {
    parentTitle: index.nodesById.get(matches[0].parentId)?.title || "",
    collectionName: normalizeCollection(matches[0].edge.collectionName),
  };
}

function semanticChildren(index, title) {
  return directChildren(index, title).filter(
    (childTitle) => !childTitle.startsWith("(O*Net)"),
  );
}

function sourceTasks(index, title) {
  return directChildren(index, title)
    .filter((childTitle) => childTitle.startsWith("(O*Net)"))
    .map((childTitle) =>
      childTitle.replace(/^\(O\*Net\)\s*(?:[^-]+\s+-\s+)?/, "").trim(),
    );
}

function synonymsFromNode(node) {
  const values = new Set();
  for (const value of node?.actionAlternatives || []) {
    if (String(value).trim()) values.add(String(value).trim());
  }
  for (const value of String(node?.synsets || "").split(",")) {
    const lemma = value.trim().replace(/\.[a-z]+\.\d+$/i, "");
    if (lemma) values.add(lemma.replace(/_/g, " "));
  }
  const match = String(node?.description || "").match(/Synonyms?:\s*([^.;]+)/i);
  if (match) {
    for (const value of match[1].split(/,|\bor\b/i)) {
      if (value.trim()) values.add(value.trim());
    }
  }
  return [...values].sort((left, right) => left.localeCompare(right, "en"));
}

function explicitDescriptionSynonyms(node) {
  const match = String(node?.description || "").match(/Synonyms?:\s*([^.;]+)/i);
  if (!match) return [];
  return match[1]
    .split(/,|\bor\b/i)
    .map((value) => value.trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, "en"));
}

function structuredSynonyms(node) {
  return synonymsFromNode({
    ...node,
    description: "",
  });
}

function workflowFor(issueType, overrides = {}) {
  const issue = ISSUE_BY_ID.get(issueType);
  if (!issue) throw new Error(`Unknown issue type: ${issueType}`);
  const actionTypes = new Set([
    "node-merge",
    "relocation",
    "sense-relocation",
    "missing-activity",
    "redundant-node",
  ]);
  return {
    robTaskIds: issue.robTaskIds,
    stage: issue.stage,
    proposalKind: actionTypes.has(issue.id)
      ? "action"
      : issue.id === "collection-design"
        ? "design"
        : "diagnosis",
    dependsOnProposalIds: [],
    ...overrides,
  };
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
    case "duplicate-comparison": {
      parentNodeId = addTitle(context.parentTitle);
      const canonicalId = addTitle(context.canonicalTitle);
      subjectNodeId = addTitle(context.candidateSynonymTitle);
      requireAnyEdge(index, parentNodeId, canonicalId);
      requireAnyEdge(index, parentNodeId, subjectNodeId);
      break;
    }
    case "placement-comparison": {
      parentNodeId = addTitle(context.currentParentTitle);
      subjectNodeId = addTitle(context.nodeTitle);
      requireAnyEdge(index, parentNodeId, subjectNodeId);
      if (context.candidateHome && index.idByTitle.has(context.candidateHome)) {
        addTitle(context.candidateHome);
      }
      break;
    }
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
    case "relocation-action": {
      parentNodeId = addTitle(context.currentParentTitle);
      subjectNodeId = addTitle(context.nodeTitle);
      requireEdge(
        index,
        parentNodeId,
        subjectNodeId,
        context.currentCollection,
      );
      const proposedParentId = addTitle(context.proposedParentTitle);
      if (index.edgePairs.has(`${proposedParentId}\u001f${subjectNodeId}`)) {
        throw new Error(
          `Proposed relocation already exists: ${context.proposedParentTitle} -> ${context.nodeTitle}`,
        );
      }
      for (const title of context.childTitles) {
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
    case "metadata-edit": {
      subjectNodeId = addTitle(context.nodeTitle);
      break;
    }
    case "polysemy-review": {
      parentNodeId = addTitle(context.currentParentTitle);
      subjectNodeId = addTitle(context.nodeTitle);
      requireAnyEdge(index, parentNodeId, subjectNodeId);
      for (const sense of context.proposedSenses) {
        if (index.idByTitle.has(sense.title)) addTitle(sense.title);
        if (index.idByTitle.has(sense.destination)) addTitle(sense.destination);
      }
      break;
    }
    case "collection-design": {
      parentNodeId = addTitle(context.parentTitle);
      for (const title of context.currentChildren) {
        requireAnyEdge(index, parentNodeId, addTitle(title));
      }
      for (const branch of context.proposedBranches) {
        if (branch.status === "existing") addTitle(branch.title);
        if (branch.status === "new" && index.idByTitle.has(branch.title)) {
          throw new Error(
            `Proposed collection branch already exists: ${branch.title}`,
          );
        }
        for (const childTitle of branch.children) addTitle(childTitle);
      }
      break;
    }
    case "sense-relocation-action": {
      parentNodeId = addTitle(context.currentParentTitle);
      subjectNodeId = addTitle(context.nodeTitle);
      requireEdge(
        index,
        parentNodeId,
        subjectNodeId,
        context.currentCollection,
      );
      addTitle(context.retainedSenseTitle);
      addTitle(context.retainedParentTitle);
      addTitle(context.proposedParentTitle);
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
  workflow,
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
    workflow: workflowFor(issueType, workflow),
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
      issueType: "compound-object-grouping",
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

function activityDescription(title, tasks) {
  const normalizedTitle = String(title).trim();
  if (DESCRIPTION_PROPOSALS[normalizedTitle]) {
    return DESCRIPTION_PROPOSALS[normalizedTitle];
  }
  if (/^sell\s+/i.test(normalizedTitle)) {
    return `Sell ${normalizedTitle
      .replace(/^sell\s+/i, "")
      .toLowerCase()} to customers or other buyers in exchange for payment.`;
  }
  if (/^market\s+/i.test(normalizedTitle)) {
    return `Promote ${normalizedTitle
      .replace(/^market\s+/i, "")
      .toLowerCase()} to potential customers or users.`;
  }
  const firstTask = tasks[0]?.replace(/\s+/g, " ").trim();
  return firstTask || `Describe the work activity named ${normalizedTitle}.`;
}

function metadataRecords({
  manifest,
  index,
  snapshot,
  snapshotHash,
  generatedAt,
}) {
  const records = [];
  for (const node of snapshot.nodes) {
    if (node.referenceOnly || node.title.startsWith("(O*Net)")) continue;
    const tasks = sourceTasks(index, node.title);
    const proposedSynonyms = explicitDescriptionSynonyms(node).filter(
      (synonym) =>
        !/^market(?:\s|$)/i.test(synonym) &&
        !structuredSynonyms(node).some(
          (current) => current.toLowerCase() === synonym.toLowerCase(),
        ),
    );
    if (proposedSynonyms.length) {
      const currentValues = structuredSynonyms(node);
      records.push(
        makeRecord({
          manifest,
          index,
          snapshotHash,
          generatedAt,
          issueType: "synonym-enrichment",
          key: `synonyms:${node.title}:${proposedSynonyms.join("|")}`,
          subject: { title: node.title },
          reviewerView: {
            question: `Should the listed synonyms be added to the synonym field for "${node.title}"?`,
            currentState: currentValues.length
              ? `Current synonym field: ${currentValues.join(", ")}`
              : "The structured synonym field is empty.",
            proposedState: `Add ${proposedSynonyms.join(", ")} to the synonym field.`,
            reasoning:
              "These terms are already identified as synonyms in the current human-readable description but are absent from the structured synonym field.",
            context: {
              type: "metadata-edit",
              nodeTitle: node.title,
              field: "synonyms",
              synonymScope: "structured-field",
              currentValues,
              proposedValues: [
                ...new Set([...currentValues, ...proposedSynonyms]),
              ],
              sourceTasks: tasks,
            },
          },
          evidence: {
            detectorId: "description-synonym-parser",
            detectorName: "StructuredSynonymGapScanner",
            detectorConfidence: "high",
          },
        }),
      );
    }

    const currentDescription = String(node.description || "").trim();
    const substantiveDescription = currentDescription
      .replace(/Synonyms?:\s*([^.;]+)/gi, "")
      .replace(/[.;\s]+/g, " ")
      .trim();
    if (!substantiveDescription && tasks.length) {
      const proposedText = activityDescription(node.title, tasks);
      records.push(
        makeRecord({
          manifest,
          index,
          snapshotHash,
          generatedAt,
          issueType: "description-enrichment",
          key: `description:${node.title}`,
          subject: { title: node.title },
          reviewerView: {
            question: `Is this a useful description for "${node.title}"?`,
            currentState: currentDescription
              ? "This node currently lists synonyms but has no explanatory description."
              : "This node currently has no description.",
            proposedState: proposedText,
            reasoning:
              "The proposed description states the activity named by the node and preserves the linked O*NET evidence instead of introducing unsupported details.",
            context: {
              type: "metadata-edit",
              nodeTitle: node.title,
              field: "description",
              currentText: currentDescription,
              proposedText,
              sourceTasks: tasks,
            },
          },
          evidence: {
            detectorId: "description-gap-scan",
            detectorName: "EvidenceGroundedDescriptionProposer",
            detectorConfidence: "high",
          },
        }),
      );
    }
  }
  return records;
}

function mistakenSynonymRecords(args) {
  const { manifest, index, snapshot, snapshotHash, generatedAt } = args;
  return snapshot.nodes
    .filter(
      (node) =>
        !node.referenceOnly &&
        /^sell(?:\s|$)/i.test(node.title) &&
        synonymsFromNode(node).some((value) => /^market(?:\s|$)/i.test(value)),
    )
    .map((node) => {
      const currentValues = synonymsFromNode(node);
      const mistakenValues = currentValues.filter((value) =>
        /^market(?:\s|$)/i.test(value),
      );
      const proposedValues = currentValues.filter(
        (value) => !/^market(?:\s|$)/i.test(value),
      );
      return makeRecord({
        manifest,
        index,
        snapshotHash,
        generatedAt,
        issueType: "mistaken-synonym",
        key: `mistaken-synonym:${node.title}:${mistakenValues.join("|")}`,
        subject: { title: node.title },
        reviewerView: {
          question: `Should ${mistakenValues
            .map((value) => `"${value}"`)
            .join(" and ")} be removed as ${
            mistakenValues.length === 1 ? "a synonym" : "synonyms"
          } of "${node.title}"?`,
          currentState: `Current recorded synonyms: ${currentValues.join(", ")}.`,
          proposedState: proposedValues.length
            ? `Keep ${proposedValues.join(", ")} and remove ${mistakenValues.join(", ")} wherever recorded as synonyms.`
            : `Remove ${mistakenValues.join(", ")} wherever recorded as synonyms.`,
          reasoning:
            "Marketing promotes or creates demand, while selling completes or arranges an exchange for payment. Treating a Market activity as a direct synonym of a Sell activity collapses distinct work.",
          context: {
            type: "metadata-edit",
            nodeTitle: node.title,
            field: "synonyms",
            synonymScope: "all-recorded",
            currentValues,
            proposedValues,
            sourceTasks: sourceTasks(index, node.title),
          },
        },
        evidence: {
          detectorId: "D10+J7",
          detectorName: "VerbSynsetAndDoctrineAudit",
          detectorConfidence: "high",
          judgeId: "Rob-task-5",
          judgeName: "MistakenSynonymExample",
          judgeConfidence: "high",
        },
      });
    });
}

function duplicateDiagnosticRecords(args) {
  const { manifest, index, snapshotHash, generatedAt } = args;
  const parentTitle = "Sell (Physical Object)";
  return PRODUCT_SYNONYM_PAIRS.map(([canonicalTitle, candidateSynonymTitle]) =>
    makeRecord({
      manifest,
      index,
      snapshotHash,
      generatedAt,
      issueType: "duplicate-synonym",
      key: `duplicate:${canonicalTitle}~${candidateSynonymTitle}`,
      subject: {
        title: candidateSynonymTitle,
        parentTitle,
        relatedTitles: [canonicalTitle],
      },
      reviewerView: {
        question: `Do "${canonicalTitle}" and "${candidateSynonymTitle}" name the same selling activity?`,
        currentState: `They are separate sibling nodes under ${parentTitle}.`,
        proposedState: `Treat "${candidateSynonymTitle}" as a synonym of "${canonicalTitle}".`,
        reasoning:
          "Both titles are generic names for an item offered for sale. This pairwise review deliberately avoids bundling several uncertain equivalences into one decision.",
        context: {
          type: "duplicate-comparison",
          parentTitle,
          canonicalTitle,
          candidateSynonymTitle,
        },
      },
      evidence: {
        detectorId: "D8",
        detectorName: "DuplicateScanner",
        detectorConfidence: "medium",
        judgeId: "Rob-task-6",
        judgeName: "GenericItemDuplicateExample",
      },
    }),
  );
}

function polysemyRecord(args) {
  const { manifest, index, snapshotHash, generatedAt } = args;
  const nodeTitle = "Sell Products or Ideas";
  return makeRecord({
    manifest,
    index,
    snapshotHash,
    generatedAt,
    issueType: "polysemy",
    key: `polysemy:${nodeTitle}`,
    subject: {
      title: nodeTitle,
      parentTitle: "Sell (Other)",
      relatedTitles: ["Sell Product", "Persuade"],
    },
    reviewerView: {
      question: `Does "${nodeTitle}" combine two activities that should be represented separately?`,
      currentState: `One node combines selling products for payment with influencing people about ideas.`,
      proposedState: `Separate the paid product-sale sense from the idea-persuasion sense.`,
      reasoning:
        "Selling requires an exchange for payment, while influencing someone to accept an idea does not. The linked O*NET element explicitly combines selling and influencing, which is evidence of two senses rather than one Sell activity.",
      context: {
        type: "polysemy-review",
        nodeTitle,
        currentParentTitle: "Sell (Other)",
        sourceTasks: sourceTasks(index, nodeTitle),
        proposedSenses: [
          {
            title: "Sell Product",
            meaning: "Transfer a product or its ownership for payment.",
            destination: "Sell (Physical Object)",
          },
          {
            title: "Persuade",
            meaning: "Influence another person to accept an idea or position.",
            destination: "Persuade",
          },
        ],
      },
    },
    evidence: {
      detectorId: "J7",
      detectorName: "VerbDoctrineGate",
      detectorConfidence: "high",
      judgeId: "Rob-task-7",
      judgeName: "PolysemyExample",
      judgeConfidence: "high",
    },
  });
}

function collectionDesignRecord(args) {
  const { manifest, index, snapshotHash, generatedAt } = args;
  return makeRecord({
    manifest,
    index,
    snapshotHash,
    generatedAt,
    issueType: "collection-design",
    key: "collection:Sell:right-duration",
    subject: {
      title: "Sell what kind of usage?",
      parentTitle: "Sell",
      relatedTitles: ["Lease out", "Rent out"],
    },
    reviewerView: {
      question: `Should Sell distinguish permanent ownership from temporary use in a new collection?`,
      currentState: `Lease out and Rent out are ungrouped direct children of Sell, while ownership-oriented selling is organized separately.`,
      proposedState: `Create a collection named "Sell what kind of usage?" with branches for selling ownership (ongoing usage) and selling temporary usage; place Lease out and Rent out under temporary usage.`,
      reasoning:
        "Ownership transfer and temporary-use rights are both exchanges for payment but differ systematically. A dedicated collection captures that dimension without declaring Rent out and Lease out to be the same activity.",
      context: {
        type: "collection-design",
        parentTitle: "Sell",
        currentChildren: ["Lease out", "Rent out"],
        proposedCollectionName: "Sell what kind of usage?",
        proposedBranches: [
          { title: "Sell ownership", status: "new", children: [] },
          {
            title: "Sell temporary use",
            status: "new",
            children: ["Lease out", "Rent out"],
          },
        ],
      },
    },
    evidence: {
      detectorId: "Rob-task-10",
      detectorName: "CollectionDimensionProposal",
      detectorConfidence: "high",
    },
  });
}

function servicePlacementRecords(args) {
  const { manifest, index, snapshotHash, generatedAt } = args;
  return SERVICE_RELOCATIONS.map((candidate) => {
    const current = directParent(index, candidate.title);
    return makeRecord({
      manifest,
      index,
      snapshotHash,
      generatedAt,
      issueType: "placement",
      key: `placement:${candidate.title}->Sell service`,
      subject: {
        title: candidate.title,
        parentTitle: current.parentTitle,
        relatedTitles: ["Sell service"],
      },
      reviewerView: {
        question: `Is "${candidate.title}" currently in the wrong part of the Sell branch?`,
        currentState: `"${candidate.title}" is currently under "${current.parentTitle}".`,
        proposedState: `Mark it as a service or ongoing arrangement rather than a physical or information object.`,
        reasoning: candidate.reasoning,
        context: {
          type: "placement-comparison",
          nodeTitle: candidate.title,
          currentParentTitle: current.parentTitle,
          currentBucket: current.collectionName,
          candidateHome: "Sell service",
          placementIssue: "wrong-bucket",
        },
      },
      evidence: {
        detectorId: "D11",
        detectorName: "MisplacementScanner",
        detectorConfidence: "high",
        judgeId: "J1",
        judgeName: "BucketClassifier",
        judgeConfidence: "high",
      },
    });
  });
}

function relocationRecord({
  manifest,
  index,
  snapshotHash,
  generatedAt,
  nodeTitle,
  proposedParentTitle,
  reasoning,
  dependencyId,
  robTaskId,
}) {
  const current = directParent(index, nodeTitle);
  const childTitles = semanticChildren(index, nodeTitle);
  return makeRecord({
    manifest,
    index,
    snapshotHash,
    generatedAt,
    issueType: "relocation",
    key: `relocation:${nodeTitle}->${proposedParentTitle}`,
    subject: {
      title: nodeTitle,
      parentTitle: current.parentTitle,
      relatedTitles: [proposedParentTitle, ...childTitles],
    },
    reviewerView: {
      question: `Should "${nodeTitle}" be moved from "${current.parentTitle}" to "${proposedParentTitle}"?`,
      currentState: `"${nodeTitle}" is under "${current.parentTitle}" in the "${current.collectionName}" collection.`,
      proposedState: `Move the node, together with its direct children, under "${proposedParentTitle}".`,
      reasoning,
      context: {
        type: "relocation-action",
        nodeTitle,
        currentParentTitle: current.parentTitle,
        currentCollection: current.collectionName,
        proposedParentTitle,
        proposedCollection: "main",
        childTitles,
      },
    },
    workflow: {
      robTaskIds: [robTaskId],
      dependsOnProposalIds: dependencyId ? [dependencyId] : [],
    },
    evidence: {
      detectorId: "W16",
      detectorName: "SnapshotBoundRelocationProposer",
      detectorConfidence: "high",
      judgeId: "C6",
      judgeName: "RelocationCritic",
      judgeConfidence: "high",
    },
  });
}

function relocationRecords(args, diagnostics) {
  const records = [];
  for (const candidate of SERVICE_RELOCATIONS) {
    records.push(
      relocationRecord({
        ...args,
        nodeTitle: candidate.title,
        proposedParentTitle: "Sell service",
        reasoning: candidate.reasoning,
        dependencyId: diagnostics.placement.get(candidate.title) || "",
        robTaskId: 11,
      }),
    );
  }
  for (const nodeTitle of MARKET_TITLES) {
    records.push(
      relocationRecord({
        ...args,
        nodeTitle,
        proposedParentTitle: "Advertise",
        reasoning:
          "The activity uses Market in the promotional sense: attracting attention or demand rather than completing an exchange for payment. Advertise is a verified current ontology node outside the Sell branch.",
        dependencyId: diagnostics.wrongVerb.get(nodeTitle) || "",
        robTaskId: 12,
      }),
    );
  }
  return records;
}

function senseRelocationRecord(args, dependencyId) {
  const { manifest, index, snapshotHash, generatedAt } = args;
  const nodeTitle = "Sell Products or Ideas";
  const current = directParent(index, nodeTitle);
  return makeRecord({
    manifest,
    index,
    snapshotHash,
    generatedAt,
    issueType: "sense-relocation",
    key: `sense-relocation:${nodeTitle}->Persuade`,
    subject: {
      title: nodeTitle,
      parentTitle: current.parentTitle,
      relatedTitles: ["Sell Product", "Persuade"],
    },
    reviewerView: {
      question: `After separating its meanings, should the idea-influencing sense of "${nodeTitle}" move to "Persuade"?`,
      currentState: `The combined node is under "${current.parentTitle}" in Sell.`,
      proposedState: `Represent product selling through the existing "Sell Product" node and represent the non-sale idea-influencing sense under "Persuade". Retire the combined node after its evidence is reassigned.`,
      reasoning:
        "This action implements the boundary already tested by the polysemy review: paid product sales remain in Sell, while influencing another person about an idea follows Persuade.",
      context: {
        type: "sense-relocation-action",
        nodeTitle,
        currentParentTitle: current.parentTitle,
        currentCollection: current.collectionName,
        sourceTasks: sourceTasks(index, nodeTitle),
        retainedSenseTitle: "Sell Product",
        retainedParentTitle: "Sell (Physical Object)",
        movedSenseTitle: "Persuade about an idea",
        proposedParentTitle: "Persuade",
      },
    },
    workflow: { dependsOnProposalIds: dependencyId ? [dependencyId] : [] },
    evidence: {
      detectorId: "W16+J7",
      detectorName: "PolysemyRelocationProposer",
      detectorConfidence: "high",
      judgeId: "Rob-task-13",
      judgeName: "SenseDestinationReview",
      judgeConfidence: "high",
    },
  });
}

function mergeRecord({
  manifest,
  index,
  snapshotHash,
  generatedAt,
  canonicalTitle,
  absorbedTitle,
  parentTitle = "Sell",
  reasoning,
  evidence,
  dependencyId,
}) {
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
    workflow: {
      dependsOnProposalIds: dependencyId ? [dependencyId] : [],
    },
    evidence,
  });
}

function mergeRecords(args, diagnostics) {
  const records = [
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
      dependencyId:
        diagnostics.overlap.get("Sell (Information)|Sell information") || "",
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
      dependencyId:
        diagnostics.overlap.get(
          "Sell (Physical Object)|Sell physical objects",
        ) || "",
    }),
  ];
  for (const [canonicalTitle, absorbedTitle] of PRODUCT_SYNONYM_PAIRS) {
    records.push(
      mergeRecord({
        ...args,
        canonicalTitle,
        absorbedTitle,
        parentTitle: "Sell (Physical Object)",
        reasoning:
          "The preceding pairwise synonym review determines whether these generic item-selling titles denote the same activity. This separate action review shows the exact node and child consolidation before any write is prepared.",
        dependencyId:
          diagnostics.duplicate.get(`${canonicalTitle}|${absorbedTitle}`) || "",
        evidence: {
          detectorId: "D8",
          detectorName: "DuplicateScanner",
          detectorConfidence: "medium",
          judgeId: "H3",
          judgeName: "CanonicalTitleChooser",
          judgeConfidence: "medium",
        },
      }),
    );
  }
  return records;
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
  proposal.properties.workflow = {
    type: "object",
    properties: {
      robTaskIds: {
        type: "array",
        items: { type: "integer", minimum: 1, maximum: 13 },
        uniqueItems: true,
      },
      stage: {
        type: "string",
        enum: [
          "content",
          "within-branch",
          "outside-branch",
          "final-action",
          "additional-quality",
        ],
      },
      proposalKind: {
        type: "string",
        enum: ["diagnosis", "design", "action"],
      },
      dependsOnProposalIds: {
        type: "array",
        items: nonEmpty,
        uniqueItems: true,
      },
      conflictGroupId: { type: "string" },
    },
    required: ["robTaskIds", "stage", "proposalKind", "dependsOnProposalIds"],
    additionalProperties: false,
  };
  if (!proposal.required.includes("workflow"))
    proposal.required.push("workflow");
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
    {
      type: "object",
      properties: {
        type: { type: "string", const: "metadata-edit" },
        nodeTitle: nonEmpty,
        field: { type: "string", enum: ["synonyms", "description"] },
        currentText: { type: "string" },
        proposedText: { type: "string" },
        currentValues: stringArray(),
        proposedValues: stringArray(),
        synonymScope: {
          type: "string",
          enum: ["structured-field", "all-recorded"],
        },
        sourceTasks: stringArray(),
      },
      required: ["type", "nodeTitle", "field"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        type: { type: "string", const: "polysemy-review" },
        nodeTitle: nonEmpty,
        currentParentTitle: nonEmpty,
        sourceTasks: stringArray(),
        proposedSenses: {
          type: "array",
          minItems: 2,
          items: {
            type: "object",
            properties: {
              title: nonEmpty,
              meaning: nonEmpty,
              destination: nonEmpty,
            },
            required: ["title", "meaning", "destination"],
            additionalProperties: false,
          },
        },
      },
      required: [
        "type",
        "nodeTitle",
        "currentParentTitle",
        "sourceTasks",
        "proposedSenses",
      ],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        type: { type: "string", const: "collection-design" },
        parentTitle: nonEmpty,
        currentChildren: stringArray(1),
        proposedCollectionName: nonEmpty,
        proposedBranches: {
          type: "array",
          minItems: 2,
          items: {
            type: "object",
            properties: {
              title: nonEmpty,
              status: { type: "string", enum: ["existing", "new"] },
              children: stringArray(),
            },
            required: ["title", "status", "children"],
            additionalProperties: false,
          },
        },
      },
      required: [
        "type",
        "parentTitle",
        "currentChildren",
        "proposedCollectionName",
        "proposedBranches",
      ],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        type: { type: "string", const: "sense-relocation-action" },
        nodeTitle: nonEmpty,
        currentParentTitle: nonEmpty,
        currentCollection: nonEmpty,
        sourceTasks: stringArray(),
        retainedSenseTitle: nonEmpty,
        retainedParentTitle: nonEmpty,
        movedSenseTitle: nonEmpty,
        proposedParentTitle: nonEmpty,
      },
      required: [
        "type",
        "nodeTitle",
        "currentParentTitle",
        "currentCollection",
        "sourceTasks",
        "retainedSenseTitle",
        "retainedParentTitle",
        "movedSenseTitle",
        "proposedParentTitle",
      ],
      additionalProperties: false,
    },
  ];
  for (const addition of additions) {
    if (!existingTypes.has(addition.properties.type.const)) {
      contextOptions.push(addition);
    }
  }
  const metadataOption = contextOptions.find(
    (option) => option.properties?.type?.const === "metadata-edit",
  );
  if (metadataOption) {
    metadataOption.properties.synonymScope = {
      type: "string",
      enum: ["structured-field", "all-recorded"],
    };
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

  const normalizeExistingRecord = (record) => {
    const context = record.reviewerView?.context;
    let issueType = record.issueType;
    if (context?.placementIssue === "wrong-verb") issueType = "wrong-verb";
    if (issueType === "structural-overlap") issueType = "misc-facet-duplicate";
    if (issueType === "sibling-grouping") issueType = "flat-list-grouping";
    const normalizedContext =
      context?.type === "placement-comparison" &&
      context.nodeTitle === "Sell Service (1)"
        ? { ...context, candidateHome: "Actors and Activities" }
        : context;
    return {
      ...record,
      datasetVersion: DATASET_VERSION,
      issueType,
      workflow: workflowFor(issueType),
      reviewerView:
        context?.type === "placement-comparison"
          ? {
              ...record.reviewerView,
              context: normalizedContext,
              proposedState:
                context.placementIssue === "wrong-verb"
                  ? `"${context.nodeTitle}" uses a different main action and does not belong under "${context.currentParentTitle}".`
                  : `"${context.nodeTitle}" does not belong under "${context.currentParentTitle}".`,
            }
          : record.reviewerView,
    };
  };

  const keepExistingRecord = (record) => {
    const context = record.reviewerView?.context;
    if (
      context?.type === "duplicate-comparison" &&
      new Set([context.canonicalTitle, context.candidateSynonymTitle]).has(
        "Rent out",
      )
    ) {
      return false;
    }
    if (
      context?.type === "placement-comparison" &&
      ["Rent out", "Lease out"].includes(context.nodeTitle)
    ) {
      return false;
    }
    if (
      context?.type === "placement-comparison" &&
      ["Sell Ticket", "Sell Specialty"].includes(context.nodeTitle)
    ) {
      return false;
    }
    return ISSUE_BY_ID.has(record.issueType);
  };

  const existingProposals = readJsonl(
    path.join(directory, "all_proposals.jsonl"),
  )
    .filter((record) => record.provenance?.sourceArtifact !== SOURCE_ARTIFACT)
    .map(normalizeExistingRecord)
    .filter(keepExistingRecord);
  const existingControls = readJsonl(path.join(directory, "all_controls.jsonl"))
    .map(normalizeExistingRecord)
    .filter(keepExistingRecord);
  const manualChecks = readJsonl(path.join(directory, "manual_checks.jsonl"))
    .map(normalizeExistingRecord)
    .filter(keepExistingRecord);

  const generationArgs = {
    manifest,
    index,
    snapshot,
    snapshotHash,
    generatedAt,
  };
  const generatedDiagnostics = [
    ...metadataRecords(generationArgs),
    ...mistakenSynonymRecords(generationArgs),
    ...duplicateDiagnosticRecords(generationArgs),
    polysemyRecord(generationArgs),
    ...groupingRecords(generationArgs),
    collectionDesignRecord(generationArgs),
    ...servicePlacementRecords(generationArgs),
    ...missingActivityRecords(generationArgs),
  ];

  const diagnosticRecords = [...existingProposals, ...generatedDiagnostics];
  const diagnostics = {
    overlap: new Map(),
    duplicate: new Map(),
    placement: new Map(),
    wrongVerb: new Map(),
    polysemy: new Map(),
  };
  for (const record of diagnosticRecords) {
    const context = record.reviewerView?.context;
    if (context?.type === "overlap-comparison") {
      diagnostics.overlap.set(
        `${context.firstTitle}|${context.secondTitle}`,
        record.proposalId,
      );
    } else if (context?.type === "duplicate-comparison") {
      diagnostics.duplicate.set(
        `${context.canonicalTitle}|${context.candidateSynonymTitle}`,
        record.proposalId,
      );
    } else if (context?.type === "placement-comparison") {
      const target =
        record.issueType === "wrong-verb"
          ? diagnostics.wrongVerb
          : diagnostics.placement;
      target.set(context.nodeTitle, record.proposalId);
    } else if (context?.type === "polysemy-review") {
      diagnostics.polysemy.set(context.nodeTitle, record.proposalId);
    }
  }

  const generatedActions = [
    ...mergeRecords(generationArgs, diagnostics),
    ...relocationRecords(generationArgs, diagnostics),
    senseRelocationRecord(
      generationArgs,
      diagnostics.polysemy.get("Sell Products or Ideas") || "",
    ),
  ];
  const generatedProposals = [...generatedDiagnostics, ...generatedActions];
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

  const everyRecordId = new Set(
    [...proposals, ...existingControls, ...manualChecks].map(
      (record) => record.proposalId,
    ),
  );
  for (const record of proposals) {
    for (const dependencyId of record.workflow.dependsOnProposalIds) {
      if (!everyRecordId.has(dependencyId)) {
        throw new Error(
          `${record.proposalId} depends on missing proposal ${dependencyId}`,
        );
      }
    }
  }

  writeJsonl(path.join(directory, "all_proposals.jsonl"), proposals);
  writeJsonl(path.join(directory, "all_controls.jsonl"), existingControls);
  writeJsonl(path.join(directory, "manual_checks.jsonl"), manualChecks);

  const activeIssueFiles = new Set(
    ISSUE_TYPES.map((issue) => `${issue.id}.jsonl`),
  );
  for (const folderName of ["proposals", "controls"]) {
    const folder = path.join(directory, folderName);
    for (const fileName of fs.readdirSync(folder)) {
      if (fileName.endsWith(".jsonl") && !activeIssueFiles.has(fileName)) {
        fs.unlinkSync(path.join(folder, fileName));
      }
    }
  }

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
    robTaskFamiliesRepresented: 13,
    robTaskFamiliesTotal: 13,
    exactRelocationsWithVerifiedCurrentTargets: generatedActions.filter(
      (record) => record.issueType === "relocation",
    ).length,
    note: "Every issue family in Rob's July 9 document has an atomic review contract and at least one snapshot-bound Sell item. Candidate generation is exhaustive only for the packaged scans and deterministic metadata checks; no finite semantic scan can prove that every possible defect has been found.",
  };
  manifest.limitations = [
    "The dataset covers all 13 documented issue families, but it is not proof that every semantic issue in Sell has been discovered.",
    "Description proposals are deliberately conservative and preserve linked O*NET wording; human reviewers should improve awkward phrasing rather than accepting unsupported detail.",
    "Exact merge and relocation actions remain unavailable to an individual reviewer until that reviewer agrees with the prerequisite diagnosis.",
    "Rent out and Lease out are handled by collection design; the earlier contradictory wrong-verb and immediate-merge actions have been removed.",
    "Sell Products or Ideas is handled first as a polysemy diagnosis and then as a gated sense-relocation action; it is not moved intact out of Sell.",
    "Every decision is review-only. Acceptance never writes to Firestore, and accepted actions must be revalidated against a fresh snapshot before implementation.",
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
        synonymEnrichment: generatedDiagnostics.filter(
          (record) => record.issueType === "synonym-enrichment",
        ).length,
        descriptionEnrichment: generatedDiagnostics.filter(
          (record) => record.issueType === "description-enrichment",
        ).length,
        mistakenSynonyms: generatedDiagnostics.filter(
          (record) => record.issueType === "mistaken-synonym",
        ).length,
        duplicatePairs: PRODUCT_SYNONYM_PAIRS.length,
        polysemyDiagnoses: 1,
        evidenceConvergenceGroupings: EXTRA_GROUPINGS.length,
        collectionDesigns: 1,
        exactMerges: generatedActions.filter(
          (record) => record.issueType === "node-merge",
        ).length,
        exactRelocations: generatedActions.filter(
          (record) => record.issueType === "relocation",
        ).length,
        senseRelocations: 1,
        missingActivities: MISSING_ACTIVITIES.length,
        redundantNodes: 0,
      },
      evidenceConvergenceGroupings: EXTRA_GROUPINGS,
      missingActivities: MISSING_ACTIVITIES,
      decisions: [
        "The 13 tasks in Rob's document are first-class issue queues rather than aliases for ten broader queues.",
        "Flat-list grouping and O*NET compound-object grouping are separate review criteria.",
        "Rent out and Lease out are no longer simultaneously treated as wrong verbs and an immediate merge; collection design is reviewed first.",
        "Sell Products or Ideas is no longer moved intact when its idea sense is the actual problem.",
        "Exact merges and relocations include prerequisite proposal IDs and are served only after an agreeing diagnosis.",
        "All proposed current nodes and current relations are checked against the pinned Firestore snapshot.",
      ],
    },
  );

  process.stdout.write(
    `${DATASET_VERSION}: ${proposals.length} proposals, ${existingControls.length} controls\n`,
  );
}

main();
