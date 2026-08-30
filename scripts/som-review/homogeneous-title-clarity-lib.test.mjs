import assert from "node:assert/strict";
import test from "node:test";

import {
  claimGroupingPromptTemplate,
  extractAtomicActivities,
  genericActionDiagnostic,
  matchingInheritedSynsets,
  normalizeTitle,
  resolveActionPhrase,
  selectStratifiedSample,
  validateAllCandidateSynsetAssessment,
  validateClaimGroupingAssessment,
  validateGroupingAssessment,
  validateSimpleGroupingAssessment,
  validateWordNetAssessment,
} from "./homogeneous-title-clarity-lib.mjs";

const branchNames = [
  "Act on information (“Think”)",
  "Act on physical objects (“Do”)",
  "Act with other activities and actors (“Interact”)",
];

const approvedAudit = {
  verdict: "approve",
  confidence: "high",
  checks: {
    evidenceComplete: true,
    actionPreserved: true,
    groupingHomogeneous: true,
    modifierGrounded: true,
    existingLinksRespected: true,
    titlesConsolidated: true,
  },
  reason: "All independent audit checks passed.",
};

const approvedWordNetAudit = {
  verdict: "approve",
  confidence: "high",
  checks: {
    evidenceComplete: true,
    assignedCompared: true,
    candidateBound: true,
    definitionFit: true,
    noForcedChoice: true,
  },
  reason: "All WordNet audit checks passed.",
};

test("extracts only list leaves below Atomic Tasks and preserves exact evidence", () => {
  const hierarchy = {
    Act: {
      "[Act on what?]": {
        [branchNames[0]]: {
          "Write (Write.v.01)": {
            "(Atomic Tasks)": {
              "Write (Information)": {
                "Write Report": ["(O*Net) 7 - Write a report and summary."],
                "Write Summary": ["(O*Net) 7 - Write a report and summary."],
              },
            },
          },
          "Not Atomic": ["(O*Net) 8 - Ignore this list."],
        },
      },
    },
  };
  const records = extractAtomicActivities(hierarchy);
  assert.equal(records.length, 2);
  const report = records.find((record) => record.exactTitle === "Write Report");
  assert(report);
  assert.equal(report.exactTitle, "Write Report");
  assert.equal(report.ownerTitle, "Write (Write.v.01)");
  assert.deepEqual(report.assignedSynsetIds, ["write.v.01"]);
  assert.equal(report.sourceRecords[0].oNetId, "7");
  assert.equal(report.sourceRecords[0].task, "Write a report and summary.");
  assert.deepEqual(report.sourceRecords[0].otherLinkedAtomicTitles, [
    "Write Summary",
  ]);
  assert.deepEqual(report.sourceRecords[0].sameActionLinkedAtomicTitles, [
    "Write Summary",
  ]);
  assert(!report.path.includes("(Atomic Tasks)"));
});

test("retains only same-action linked titles, including recorded synonyms", () => {
  const hierarchy = {
    Act: {
      "[Act on what?]": {
        [branchNames[1]]: {
          "Apply (Apply.v.01)": {
            "(Atomic Tasks)": {
              Tools: {
                "Use Staple": [
                  "(O*Net) 1 - Use staples, tape, tacks, or glue to hold carpet in place.",
                ],
                "Use Tack": [
                  "(O*Net) 1 - Use staples, tape, tacks, or glue to hold carpet in place.",
                ],
                "Apply Glue (Synonyms: Use Glue)": [
                  "(O*Net) 1 - Use staples, tape, tacks, or glue to hold carpet in place.",
                ],
                "Hold Carpet": [
                  "(O*Net) 1 - Use staples, tape, tacks, or glue to hold carpet in place.",
                ],
              },
            },
          },
        },
      },
    },
  };
  const staple = extractAtomicActivities(hierarchy).find(
    (record) => record.exactTitle === "Use Staple",
  );
  assert(staple);
  assert.deepEqual(staple.sourceRecords[0].sameActionLinkedAtomicTitles, [
    "Apply Glue (Synonyms: Use Glue)",
    "Use Tack",
  ]);
  assert(
    staple.sourceRecords[0].otherLinkedAtomicTitles.includes("Hold Carpet"),
  );
});

test("reader-ready prompt explains the task without seeding regression answers", () => {
  assert.match(claimGroupingPromptTemplate, /ontology of work activities/i);
  assert.match(claimGroupingPromptTemplate, /non-expert/i);
  assert.match(
    claimGroupingPromptTemplate,
    /same verb or an accepted synonym/i,
  );
  assert.doesNotMatch(
    claimGroupingPromptTemplate,
    /alternatives for Web architecture|audio and video data/i,
  );
});

test("selects a deterministic sample across all twelve strata", () => {
  const occurrences = [];
  let counter = 0;
  for (const branch of branchNames) {
    for (const count of [1, 2, 7, 21]) {
      for (let item = 0; item < 4; item += 1) {
        counter += 1;
        occurrences.push({
          occurrenceId: `id-${counter}`,
          exactTitle: `Action${counter} Object`,
          normalizedTitle: `action${counter} object`,
          leadingAction: `Action${counter}`,
          exactTitleOccurrenceCount: 1,
          topLevelBranch: branch,
          evidenceCount: count,
          evidenceBucket:
            count === 1
              ? "single"
              : count <= 5
                ? "small-multi"
                : count <= 20
                  ? "medium-multi"
                  : "large",
        });
      }
    }
  }
  const first = selectStratifiedSample({ occurrences, seed: "fixed" });
  const second = selectStratifiedSample({ occurrences, seed: "fixed" });
  assert.deepEqual(first, second);
  assert.equal(first.length, 18);
  assert.equal(
    new Set(
      first.map(
        (record) => `${record.topLevelBranch}|${record.evidenceBucket}`,
      ),
    ).size,
    12,
  );

  const priorities = occurrences.filter(
    (record) =>
      record.topLevelBranch === branchNames[0] &&
      record.evidenceBucket === "small-multi",
  );
  const prioritized = selectStratifiedSample({
    occurrences,
    seed: "fixed",
    priorityExactTitles: priorities
      .slice(0, 2)
      .map((record) => record.exactTitle),
  });
  const selectedIds = new Set(prioritized.map((record) => record.occurrenceId));
  assert(selectedIds.has(priorities[0].occurrenceId));
  assert(selectedIds.has(priorities[1].occurrenceId));
});

test("flags only exact generic Act and Perform leading actions", () => {
  const diagnostic = genericActionDiagnostic([
    {
      leadingAction: "Act",
      normalizedTitle: "act task",
      exactTitle: "Act Task",
    },
    {
      leadingAction: "Perform",
      normalizedTitle: "perform task",
      exactTitle: "Perform Task",
    },
    {
      leadingAction: "Use",
      normalizedTitle: "use tool",
      exactTitle: "Use Tool",
    },
  ]);
  assert.equal(diagnostic.occurrenceCount, 2);
  assert.deepEqual(diagnostic.examples, ["Act Task", "Perform Task"]);
});

test("validates complete homogeneous grouping and rejects dropped evidence", () => {
  const record = {
    occurrenceId: "sell-product",
    exactTitle: "Sell Product",
    normalizedTitle: "sell product",
    leadingAction: "Sell",
    sourceRecords: [
      { index: 1, task: "Sell products or services." },
      { index: 2, task: "Sell mail products." },
      { index: 3, task: "Sell postal products." },
    ],
  };
  const assessment = validateGroupingAssessment({
    record,
    existingTitles: new Set(["sell product"]),
    assessment: {
      occurrenceId: "sell-product",
      decision: "split",
      groups: [
        {
          title: "Sell Product",
          status: "current",
          sourceTaskIndexes: [1],
          reason: "The source remains generic.",
        },
        {
          title: "Sell Mail Products",
          status: "new",
          sourceTaskIndexes: [2, 3],
          reason: "Both sources concern postal products.",
        },
      ],
      deferredTaskIndexes: [],
      reason: "Generic and postal-product evidence require separate titles.",
      confidence: "high",
      audit: approvedAudit,
    },
  });
  assert.deepEqual(assessment.groups[1].sourceTaskIndexes, [2, 3]);
  assert.throws(
    () =>
      validateGroupingAssessment({
        record,
        existingTitles: new Set(["sell product"]),
        assessment: {
          occurrenceId: "sell-product",
          decision: "keep",
          groups: [
            {
              title: "Sell Product",
              status: "current",
              sourceTaskIndexes: [1, 2],
              reason: "Incomplete on purpose.",
            },
          ],
          deferredTaskIndexes: [],
          reason: "Incomplete on purpose.",
          confidence: "high",
          audit: approvedAudit,
        },
      }),
    /accounts for 2 of 3/,
  );
});

test("blocks action changes, duplicate groups, and false new-node claims", () => {
  const record = {
    occurrenceId: "sell-product",
    exactTitle: "Sell Product",
    normalizedTitle: "sell product",
    leadingAction: "Sell",
    sourceRecords: [{ index: 1, task: "Sell mail products." }],
  };
  const base = {
    occurrenceId: "sell-product",
    decision: "rename",
    deferredTaskIndexes: [],
    reason: "Needs a restricted title.",
    confidence: "high",
    audit: approvedAudit,
  };
  assert.throws(
    () =>
      validateGroupingAssessment({
        record,
        existingTitles: new Set(["sell product"]),
        assessment: {
          ...base,
          groups: [
            {
              title: "Market Mail Products",
              status: "new",
              sourceTaskIndexes: [1],
              reason: "Wrong action.",
            },
          ],
        },
      }),
    /changes the leading action/,
  );
  assert.throws(
    () =>
      validateGroupingAssessment({
        record,
        existingTitles: new Set(["sell product", "sell mail products"]),
        assessment: {
          ...base,
          groups: [
            {
              title: "Sell Mail Products",
              status: "new",
              sourceTaskIndexes: [1],
              reason: "Already exists.",
            },
          ],
        },
      }),
    /already exists/,
  );
  assert.equal(
    normalizeTitle("Sell Mail Products (Synonyms: Sell Postal Products)"),
    "sell mail products",
  );
  assert.throws(
    () =>
      validateGroupingAssessment({
        record,
        existingTitles: new Set(["sell product", "sell mail products"]),
        assessment: {
          ...base,
          groups: [
            {
              title: "Sell Mail Products (Synonyms: Sell Postal Products)",
              status: "new",
              sourceTaskIndexes: [1],
              reason:
                "Canonical title already exists despite its synonym suffix.",
            },
          ],
        },
      }),
    /already exists/,
  );
});

test("streamlined grouping derives decisions and title status deterministically", () => {
  const record = {
    occurrenceId: "sell-product",
    exactTitle: "Sell Product",
    normalizedTitle: "sell product",
    leadingAction: "Sell",
    sourceRecords: [
      { index: 1, task: "Sell products." },
      { index: 2, task: "Sell agricultural products." },
      { index: 3, task: "Sell farm products." },
    ],
  };
  const validated = validateSimpleGroupingAssessment({
    record,
    existingTitles: new Set(["sell product", "sell agricultural product"]),
    assessment: {
      occurrenceId: "sell-product",
      groups: [
        {
          title: "Sell Product",
          sourceTaskIndexes: [1],
          reason: "The evidence is generic.",
        },
        {
          title: "Sell Agricultural Product",
          sourceTaskIndexes: [2, 3],
          reason: "Both records identify agricultural products.",
        },
      ],
      deferredTaskIndexes: [],
      reason: "The specific records need one shared modifier.",
      confidence: "high",
    },
  });
  assert.equal(validated.decision, "split");
  assert.deepEqual(
    validated.groups.map((group) => group.status),
    ["current", "existing"],
  );
});

test("claim grouping permits distinct direct objects from one O*NET record", () => {
  const record = {
    occurrenceId: "sell-product",
    exactTitle: "Sell Product",
    normalizedTitle: "sell product",
    leadingAction: "Sell",
    sourceRecords: [
      {
        index: 1,
        task: "Sell funeral services, products, or merchandise.",
      },
    ],
  };
  const validated = validateClaimGroupingAssessment({
    record,
    existingTitles: new Set(["sell product"]),
    assessment: {
      occurrenceId: "sell-product",
      groups: [
        {
          title: "Sell Funeral Services",
          canonicalDirectObject: "funeral services",
          sourceClaims: [
            {
              sourceTaskIndex: 1,
              directObject: "services",
              evidenceQuote: "Sell funeral services, products, or merchandise",
            },
          ],
          reason: "Services are one explicit sold object.",
        },
        {
          title: "Sell Funeral Merchandise",
          canonicalDirectObject: "funeral merchandise",
          sourceClaims: [
            {
              sourceTaskIndex: 1,
              directObject: "merchandise",
              evidenceQuote: "Sell funeral services, products, or merchandise",
            },
          ],
          reason: "Merchandise is a different explicit sold object.",
        },
      ],
      deferredTaskIndexes: [],
      reason: "The one sentence contains two distinct sold objects.",
      confidence: "high",
    },
  });
  assert.equal(validated.decision, "split");
  assert.deepEqual(
    validated.groups.map((group) => group.sourceTaskIndexes),
    [[1], [1]],
  );
  assert.equal(validated.groups[0].sourceClaims[0].sourceTaskIndex, 1);
});

test("claim grouping preserves a meaning restriction stated after the object", () => {
  const source =
    "Research, document, rate, or select alternatives for Web architecture or technologies.";
  const validated = validateClaimGroupingAssessment({
    record: {
      occurrenceId: "document-alternative",
      exactTitle: "Document Alternative",
      normalizedTitle: "document alternative",
      leadingAction: "Document",
      sourceRecords: [{ index: 1, task: source }],
    },
    existingTitles: new Set(["document alternative"]),
    assessment: {
      occurrenceId: "document-alternative",
      groups: [
        {
          title: "Document Web Alternative",
          canonicalDirectObject: "Web Alternative",
          sourceClaims: [
            {
              sourceTaskIndex: 1,
              directObject: "alternatives",
              evidenceQuote:
                "document, rate, or select alternatives for Web architecture or technologies",
            },
          ],
          reason:
            "The trailing phrase restricts the alternatives to the Web domain.",
        },
      ],
      deferredTaskIndexes: [],
      reason: "The generic title drops a meaning-defining domain restriction.",
      confidence: "high",
    },
  });

  assert.equal(validated.decision, "rename");
  assert.equal(validated.groups[0].title, "Document Web Alternative");
});

test("claim grouping separates coordinated audio and video data subtypes", () => {
  const generic =
    "Store, retrieve, and manipulate data for analysis of system capabilities and requirements.";
  const validated = validateClaimGroupingAssessment({
    record: {
      occurrenceId: "store-datum",
      exactTitle: "Store Datum",
      normalizedTitle: "store datum",
      leadingAction: "Store",
      sourceRecords: [
        {
          index: 1,
          task: "Compress, digitize, duplicate, and store audio and video data.",
        },
        { index: 2, task: generic },
        { index: 3, task: generic },
        { index: 4, task: generic },
      ],
    },
    existingTitles: new Set(["store datum"]),
    assessment: {
      occurrenceId: "store-datum",
      groups: [
        {
          title: "Store Audio Data",
          canonicalDirectObject: "Audio Data",
          sourceClaims: [
            {
              sourceTaskIndex: 1,
              directObject: "audio",
              evidenceQuote: "store audio and video data",
            },
          ],
          reason: "Audio data is one explicitly coordinated data subtype.",
        },
        {
          title: "Store Video Data",
          canonicalDirectObject: "Video Data",
          sourceClaims: [
            {
              sourceTaskIndex: 1,
              directObject: "video data",
              evidenceQuote: "store audio and video data",
            },
          ],
          reason:
            "Video data is a distinct explicitly coordinated data subtype.",
        },
        {
          title: "Store Data",
          canonicalDirectObject: "Data",
          sourceClaims: [2, 3, 4].map((sourceTaskIndex) => ({
            sourceTaskIndex,
            directObject: "data",
            evidenceQuote: "Store, retrieve, and manipulate data",
          })),
          reason: "The other records support only the generic data title.",
        },
      ],
      deferredTaskIndexes: [],
      reason: "The specific and generic data evidence requires three groups.",
      confidence: "high",
    },
  });

  assert.equal(validated.decision, "split");
  assert.deepEqual(
    validated.groups.map((group) => group.title),
    ["Store Audio Data", "Store Video Data", "Store Data"],
  );
});

test("claim grouping reports repeated existing titles without choosing a target occurrence", () => {
  const record = {
    occurrenceId: "negotiate-contract",
    exactTitle: "Negotiate Contract",
    normalizedTitle: "negotiate contract",
    leadingAction: "Negotiate",
    sourceRecords: [
      {
        index: 1,
        task: "Negotiate prices for contracts.",
      },
    ],
  };
  const validated = validateClaimGroupingAssessment({
    record,
    existingTitles: new Set(["negotiate contract", "negotiate price"]),
    existingTitleCounts: new Map([
      ["negotiate contract", 1],
      ["negotiate price", 2],
    ]),
    assessment: {
      occurrenceId: "negotiate-contract",
      groups: [
        {
          title: "Negotiate Price",
          canonicalDirectObject: "Price",
          sourceClaims: [
            {
              sourceTaskIndex: 1,
              directObject: "prices",
              evidenceQuote: "Negotiate prices",
            },
          ],
          reason: "Price is the explicit object.",
        },
      ],
      deferredTaskIndexes: [],
      reason: "The source supports the more precise existing title string.",
      confidence: "high",
    },
  });

  assert.equal(validated.groups[0].status, "existing");
  assert.equal(validated.groups[0].existingOccurrenceCount, 2);
});

test("claim grouping rejects duplicate claims and titles outside 2-5 words", () => {
  const record = {
    occurrenceId: "sell-product",
    exactTitle: "Sell Product",
    normalizedTitle: "sell product",
    leadingAction: "Sell",
    recordedActionAliases: ["sell"],
    sourceRecords: [
      { index: 1, task: "Sell funeral services and merchandise." },
    ],
  };
  const base = {
    occurrenceId: "sell-product",
    deferredTaskIndexes: [],
    reason: "Test proposal.",
    confidence: "high",
  };
  assert.throws(
    () =>
      validateClaimGroupingAssessment({
        record,
        existingTitles: new Set(["sell product"]),
        assessment: {
          ...base,
          groups: [
            {
              title: "Sell Funeral Merchandise",
              canonicalDirectObject: "funeral merchandise",
              sourceClaims: [
                {
                  sourceTaskIndex: 1,
                  directObject: "merchandise",
                  evidenceQuote: "Sell funeral services and merchandise",
                },
              ],
              reason: "First copy.",
            },
            {
              title: "Sell Burial Merchandise",
              canonicalDirectObject: "burial merchandise",
              sourceClaims: [
                {
                  sourceTaskIndex: 1,
                  directObject: "merchandise",
                  evidenceQuote: "Sell funeral services and merchandise",
                },
              ],
              reason: "Duplicate source claim.",
            },
          ],
        },
      }),
    /appears more than once/,
  );
  assert.throws(
    () =>
      validateClaimGroupingAssessment({
        record,
        existingTitles: new Set(["sell product"]),
        assessment: {
          ...base,
          groups: [
            {
              title: "Sell Very Specific Funeral Service Products",
              canonicalDirectObject: "funeral service products",
              sourceClaims: [
                {
                  sourceTaskIndex: 1,
                  directObject: "services",
                  evidenceQuote: "Sell funeral services and merchandise",
                },
              ],
              reason: "Too long.",
            },
          ],
        },
      }),
    /must contain 2-5 words/,
  );
  assert.throws(
    () =>
      validateClaimGroupingAssessment({
        record,
        existingTitles: new Set(["sell product"]),
        assessment: {
          ...base,
          groups: [
            {
              title: "Sell Funeral Merchandise",
              canonicalDirectObject: "funeral merchandise",
              sourceClaims: [
                {
                  sourceTaskIndex: 1,
                  directObject: "merchandise",
                  evidenceQuote: "merchandise",
                },
              ],
              reason: "The quote omits the governing action.",
            },
          ],
        },
      }),
    /does not contain the canonical action/,
  );
});

test("all-candidate WordNet alignment resolves phrasal verbs and derives decisions", () => {
  const candidates = [
    { id: "set.v.01", lemmas: ["set"] },
    { id: "set_up.v.01", lemmas: ["set_up"] },
  ];
  assert.equal(
    resolveActionPhrase({
      title: "Set Up Equipment",
      canonicalDirectObject: "Equipment",
      candidateSynsets: candidates,
    }),
    "set up",
  );
  assert.deepEqual(
    matchingInheritedSynsets({
      title: "Set Up Equipment",
      canonicalDirectObject: "Equipment",
      inheritedSynsets: candidates,
      candidateSynsets: candidates,
    }).map((item) => item.id),
    ["set_up.v.01"],
  );
  const validated = validateAllCandidateSynsetAssessment({
    bundle: {
      groupId: "set-up-equipment",
      groupTitle: "Set Up Equipment",
      canonicalDirectObject: "Equipment",
      inheritedSynsets: candidates,
      candidateSynsets: candidates,
    },
    assessment: {
      groupId: "set-up-equipment",
      outcome: "selected",
      selectedSynsetId: "set_up.v.01",
      reason:
        "The evidence uses the phrasal verb meaning arrange or establish.",
      confidence: "high",
    },
  });
  assert.equal(validated.actionPhrase, "set up");
  assert.equal(validated.decision, "keep-assigned");
});

test("validates WordNet replacements and blocks invented synsets", () => {
  const bundle = {
    groupId: "wordnet-use-staple",
    groupTitle: "Use Staple",
    assignedSynsets: [{ id: "put_on.v.07" }],
    candidateSynsets: [{ id: "use.v.01" }, { id: "use.v.02" }],
  };
  const valid = validateWordNetAssessment({
    bundle,
    assessment: {
      groupId: bundle.groupId,
      decision: "replace",
      selectedSynsetIds: ["use.v.01"],
      reason: "The evidence means employing staples for their normal purpose.",
      confidence: "high",
      audit: approvedWordNetAudit,
    },
  });
  assert.deepEqual(valid.selectedSynsetIds, ["use.v.01"]);
  assert.throws(
    () =>
      validateWordNetAssessment({
        bundle,
        assessment: {
          ...valid,
          selectedSynsetIds: ["invented.v.99"],
        },
      }),
    /outside the local candidates/,
  );
});

test("permits an audited no-suitable-synset result without a selection", () => {
  const bundle = {
    groupId: "wordnet-unknown",
    groupTitle: "Perform Unknown",
    assignedSynsets: [{ id: "perform.v.01" }],
    candidateSynsets: [{ id: "perform.v.01" }],
  };
  const valid = validateWordNetAssessment({
    bundle,
    assessment: {
      groupId: bundle.groupId,
      decision: "no-suitable-synset",
      selectedSynsetIds: [],
      reason: "The supplied sense does not cover the evidence.",
      confidence: "medium",
      audit: approvedWordNetAudit,
    },
  });
  assert.equal(valid.decision, "no-suitable-synset");
});
