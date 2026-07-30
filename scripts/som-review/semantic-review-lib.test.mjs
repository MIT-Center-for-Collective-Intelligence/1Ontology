import assert from "node:assert/strict";
import test from "node:test";

import {
  collectDescendantIds,
  collectGenericEvidenceFacts,
  cosineSimilarity,
  detectEmptyCollections,
  detectEmptySemanticNodes,
  findExplicitSellModifierCandidates,
  findSellerSideTemporaryUseCandidates,
  mergeSemanticAssessments,
  rankSemanticCandidates,
  unionCandidatesById,
} from "./semantic-review-lib.mjs";

const node = (id, title, children = [], extra = {}) => ({
  id,
  title,
  specializations: children.length
    ? [
        {
          collectionName: "main",
          nodes: children.map((childId) => ({ id: childId })),
        },
      ]
    : [],
  ...extra,
});

test("explicit Sell modifiers cover direct and coordinated generic objects", () => {
  const currentParents = [
    { id: "funeral", title: "Sell Funeral Products", collectionName: "main" },
    { id: "products", title: "Sell Products", collectionName: "main" },
    { id: "services", title: "Sell Services", collectionName: "main" },
  ];
  const candidates = findExplicitSellModifierCandidates([
    {
      genericNodeId: "products",
      genericNodeTitle: "Sell Products",
      taskId: "pharmacy",
      taskTitle:
        "(O*Net) 1 - Manage operations or buy or sell non-pharmaceutical merchandise.",
      currentParents,
    },
    {
      genericNodeId: "products",
      genericNodeTitle: "Sell Products",
      taskId: "funeral-task",
      taskTitle:
        "(O*Net) 2 - Sell funeral services, products, or merchandise to clients.",
      currentParents,
    },
    {
      genericNodeId: "services",
      genericNodeTitle: "Sell Services",
      taskId: "funeral-task",
      taskTitle:
        "(O*Net) 2 - Sell funeral services, products, or merchandise to clients.",
      currentParents,
    },
  ]);

  assert.deepEqual(
    candidates.map((candidate) => candidate.proposedTitle),
    [
      "Sell Funeral Products",
      "Sell Non-Pharmaceutical Merchandise",
      "Sell Funeral Services",
    ],
  );
});

test("explicit Sell modifiers reject objects attached to another verb", () => {
  assert.deepEqual(
    findExplicitSellModifierCandidates([
      {
        genericNodeId: "products",
        genericNodeTitle: "Sell Products",
        taskId: "contracts",
        taskTitle:
          "(O*Net) 3 - Sell or arrange for delivery, insurance, financing, or service contracts for merchandise.",
        currentParents: [],
      },
    ]),
    [],
  );
});

test("seller-side temporary-use evidence is deterministic and excludes acquisition", () => {
  const candidates = findSellerSideTemporaryUseCandidates({
    candidates: [
      {
        id: "equipment",
        title: "Rent Equipment",
        sourceTasks: [
          "(O*Net) 1 - Purchase or rent equipment for installation.",
          "(O*Net) 2 - Sell or rent equipment and supplies.",
        ],
      },
      {
        id: "necessity",
        title: "Rent Necessity",
        sourceTasks: ["(O*Net) 3 - Purchase, rent, or requisition costumes."],
      },
      {
        id: "box",
        title: "Rent Box",
        sourceTasks: ["(O*Net) 4 - Rent post office boxes to customers."],
      },
      {
        id: "wrapper",
        title: "Rent physical object",
        sourceTasks: [],
      },
    ],
  });

  assert.deepEqual(
    candidates.map((candidate) => candidate.candidateId),
    ["equipment", "box"],
  );
  assert.equal(candidates[0].proposedParentTitle, "Rent out");
});

test("semantic ranking keeps the best score and records all matched queries", () => {
  const ranked = rankSemanticCandidates({
    candidates: [
      { id: "rent", title: "Rent" },
      { id: "ideas", title: "Sell Ideas" },
    ],
    candidateEmbeddings: [
      [1, 0],
      [0, 1],
    ],
    queryEmbeddings: [
      [1, 0],
      [0, 1],
    ],
    queryLabels: ["temporary use", "ownership transfer"],
    limitPerQuery: 2,
  });
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].matchedQueries.length, 2);
  assert.equal(ranked[0].similarity, 1);
});

test("cosine similarity rejects zero-length vectors", () => {
  assert.throws(() => cosineSimilarity([0, 0], [1, 0]), /non-zero norms/);
});

test("descendants, generic evidence, and empty nodes are deterministic", () => {
  const nodes = [
    node("sell", "Sell", ["products", "empty", "task"]),
    node("products", "Sell Products", ["task"]),
    node("empty", "Sell Ownership"),
    node("task", "(O*Net) 1 - Sell funeral products to clients.", [], {
      oNetTask: true,
    }),
  ];
  const nodesById = new Map(nodes.map((item) => [item.id, item]));
  const parentEdgesByChild = new Map([
    [
      "products",
      [{ parentId: "sell", childId: "products", collectionName: "Sell what?" }],
    ],
    ["empty", [{ parentId: "sell", childId: "empty", collectionName: "main" }]],
    [
      "task",
      [
        { parentId: "sell", childId: "task", collectionName: "main" },
        { parentId: "products", childId: "task", collectionName: "main" },
      ],
    ],
  ]);

  assert.deepEqual([...collectDescendantIds("sell", nodesById)].sort(), [
    "empty",
    "products",
    "sell",
    "task",
  ]);
  assert.deepEqual(
    detectEmptySemanticNodes({
      rootId: "sell",
      nodesById,
      parentEdgesByChild,
    }).map((item) => item.title),
    ["Sell Ownership"],
  );
  assert.deepEqual(
    collectGenericEvidenceFacts({
      rootId: "sell",
      nodesById,
      parentEdgesByChild,
    }).map((item) => [item.genericNodeTitle, item.taskTitle]),
    [["Sell Products", "(O*Net) 1 - Sell funeral products to clients."]],
  );
});

test("empty collection scan reports only named collections with no children", () => {
  const nodesById = new Map([
    [
      "sell",
      {
        id: "sell",
        title: "Sell",
        specializations: [
          { collectionName: "default", nodes: [] },
          { collectionName: "Sell How?", nodes: [] },
          { collectionName: "[Sell What?]", nodes: [{ id: "products" }] },
        ],
      },
    ],
    ["products", { id: "products", title: "Sell Products" }],
  ]);

  assert.deepEqual(detectEmptyCollections({ rootId: "sell", nodesById }), [
    {
      parentId: "sell",
      parentTitle: "Sell",
      collectionName: "Sell How?",
    },
  ]);
});

test("candidate union keeps ranked order and adds direct-evidence candidates", () => {
  assert.deepEqual(
    unionCandidatesById(
      [
        { id: "a", title: "A" },
        { id: "b", title: "B" },
      ],
      [
        { id: "b", title: "Duplicate B" },
        { id: "c", title: "C" },
      ],
    ).map((candidate) => candidate.title),
    ["A", "B", "C"],
  );
});

test("semantic assessment merge accepts guarded model proposals and direct evidence wins", () => {
  const candidates = [
    { id: "model", title: "Auction Asset" },
    { id: "direct", title: "Rent Equipment" },
    { id: "unsafe", title: "Advertise Product" },
  ];
  const merged = mergeSemanticAssessments({
    candidates,
    validDestinationTitles: ["Sell", "Rent out"],
    modelAssessments: [
      {
        candidateId: "model",
        classification: "same-sell-action",
        includeForExpertReview: true,
        proposedParentTitle: "Sell",
        reason: "The activity itself is a sale.",
      },
      {
        candidateId: "direct",
        classification: "buyer-side-temporary-use",
        includeForExpertReview: false,
        proposedParentTitle: null,
        reason: "Model rejected it.",
      },
      {
        candidateId: "unsafe",
        classification: "adjacent-action",
        includeForExpertReview: true,
        proposedParentTitle: "Sell",
        reason: "Invalid positive.",
      },
    ],
    deterministicAssessments: [
      {
        candidateId: "direct",
        classification: "seller-side-temporary-use",
        includeForExpertReview: true,
        proposedParentTitle: "Rent out",
        reason: "Direct provider-side task evidence.",
      },
    ],
  });

  assert.deepEqual(
    merged.map((assessment) => [
      assessment.candidateId,
      assessment.includeForExpertReview,
      assessment.proposedParentTitle,
      assessment.assessmentSource,
    ]),
    [
      ["model", true, "Sell", "semantic-judge"],
      ["direct", true, "Rent out", "direct-source-evidence"],
      ["unsafe", false, null, "semantic-judge"],
    ],
  );
});
