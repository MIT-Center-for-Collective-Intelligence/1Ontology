#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import {
  allCandidateSynsetPromptTemplate,
  claimGroupingPromptTemplate,
  extractAtomicActivities,
  stableHash,
} from "./homogeneous-title-clarity-lib.mjs";

const parseArgs = () => {
  const values = {};
  for (let index = 2; index < process.argv.length; index += 1) {
    const argument = process.argv[index];
    if (!argument.startsWith("--")) continue;
    const [name, inlineValue] = argument.slice(2).split("=", 2);
    values[name] = inlineValue ?? process.argv[++index];
  }
  return values;
};
const required = (value, label) => {
  if (!value) throw new Error(`${label} is required`);
  return path.resolve(value);
};
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const round = (value) => Math.round(value);
const ceil = (value) => Math.ceil(value);
const average = (values) =>
  values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : 0;

// Planning scenarios only. The provider meter remains authoritative.
const tokensForChars = (characters, charsPerToken = 4) =>
  ceil(characters / charsPerToken);
const tokenRangeForChars = (characters) => ({
  low: tokensForChars(characters, 4.5),
  central: tokensForChars(characters, 4),
  high: tokensForChars(characters, 3.5),
});
const addRanges = (...ranges) => ({
  low: ranges.reduce((total, range) => total + range.low, 0),
  central: ranges.reduce((total, range) => total + range.central, 0),
  high: ranges.reduce((total, range) => total + range.high, 0),
});
const stratumKey = (record) =>
  `${record.topLevelBranch}\u001f${record.evidenceBucket}`;
const titlePayload = (record) =>
  JSON.stringify({
    currentAtomicTitle: record.exactTitle,
    recordedActionAliases: record.recordedActionAliases,
    numberedONetRecords: record.sourceRecords.map((sourceRecord) => ({
      index: sourceRecord.index,
      exactRecord: sourceRecord.exactRecord,
      sameActionLinkedAtomicTitles: sourceRecord.sameActionLinkedAtomicTitles,
    })),
  });
const wordNetPayload = (bundle) =>
  JSON.stringify({
    groupTitle: bundle.groupTitle,
    canonicalDirectObject: bundle.canonicalDirectObject,
    actionPhrase: bundle.actionPhrase,
    sourceClaims: bundle.sourceClaims,
    inheritedSynsets: bundle.inheritedSynsets,
    candidateSynsets: bundle.candidateSynsets,
  });

const args = parseArgs();
const sourceFile = required(args.source, "--source");
const sampleFile = required(args.sample, "--sample");
const groupingsFile = required(args.groupings, "--groupings");
const pilotBundlesFile = required(args.bundles, "--bundles");
const outputFile = required(args.out, "--out");

const sourceBuffer = fs.readFileSync(sourceFile);
const sourceSha256 = stableHash(sourceBuffer);
const samplePacket = readJson(sampleFile);
const groupingPacket = readJson(groupingsFile);
const pilotBundlePacket = readJson(pilotBundlesFile);
if (
  pilotBundlePacket.schemaVersion !== "wordnet-all-candidate-bundles-v4" ||
  pilotBundlePacket.mode !== "planning-preview"
) {
  throw new Error(
    "The estimate requires a v4 all-candidate planning-preview bundle",
  );
}
for (const packet of [samplePacket, groupingPacket, pilotBundlePacket]) {
  if (packet.sourceSha256 !== sourceSha256) {
    throw new Error("An estimate input does not match the source hierarchy");
  }
}

const fullInventory = extractAtomicActivities(JSON.parse(sourceBuffer));
const groupingsById = new Map(
  groupingPacket.assessments.map((assessment) => [
    assessment.occurrenceId,
    assessment,
  ]),
);
const observedByStratum = new Map();
let sampleTitleInputChars = 0;
let sampleTitleOutputChars = 0;
for (const record of samplePacket.sample) {
  const assessment = groupingsById.get(record.occurrenceId);
  if (!assessment) {
    throw new Error(`Missing grouping assessment for ${record.occurrenceId}`);
  }
  sampleTitleInputChars +=
    claimGroupingPromptTemplate.length + titlePayload(record).length;
  sampleTitleOutputChars += JSON.stringify({
    groups: assessment.groups.map(
      ({ title, canonicalDirectObject, sourceClaims, reason }) => ({
        title,
        canonicalDirectObject,
        sourceClaims: sourceClaims.map(
          ({ sourceTaskIndex, directObject, evidenceQuote }) => ({
            sourceTaskIndex,
            directObject,
            evidenceQuote,
          }),
        ),
        reason,
      }),
    ),
    deferredTaskIndexes: assessment.deferredTaskIndexes,
    reason: assessment.reason,
    confidence: assessment.confidence,
  }).length;
  const key = stratumKey(record);
  const observed = observedByStratum.get(key) || {
    branch: record.topLevelBranch,
    evidenceBucket: record.evidenceBucket,
    cases: 0,
    sourceRecords: 0,
    predicateObjectClaims: 0,
    homogeneousGroups: 0,
  };
  observed.cases += 1;
  observed.sourceRecords += record.evidenceCount;
  observed.predicateObjectClaims += assessment.groups.reduce(
    (total, group) => total + group.sourceClaims.length,
    0,
  );
  observed.homogeneousGroups += assessment.groups.length;
  observedByStratum.set(key, observed);
}

const inventoryByStratum = new Map();
for (const record of fullInventory) {
  const key = stratumKey(record);
  const inventory = inventoryByStratum.get(key) || {
    branch: record.topLevelBranch,
    evidenceBucket: record.evidenceBucket,
    atomicActivityOccurrences: 0,
    oNetRecords: 0,
  };
  inventory.atomicActivityOccurrences += 1;
  inventory.oNetRecords += record.evidenceCount;
  inventoryByStratum.set(key, inventory);
}

let centralHomogeneousGroups = 0;
for (const [key, inventory] of inventoryByStratum) {
  const observed = observedByStratum.get(key);
  if (!observed?.cases) {
    throw new Error(
      `No sample observation for ${key.replace("\u001f", " / ")}`,
    );
  }
  centralHomogeneousGroups +=
    inventory.atomicActivityOccurrences *
    (observed.homogeneousGroups / observed.cases);
}
centralHomogeneousGroups = round(centralHomogeneousGroups);
const totalONetRecords = fullInventory.reduce(
  (total, record) => total + record.evidenceCount,
  0,
);
const linkedTitleInputCharacters = fullInventory.reduce(
  (totals, record) => {
    for (const sourceRecord of record.sourceRecords) {
      const allTitles = sourceRecord.otherLinkedAtomicTitles || [];
      const sameActionTitles = sourceRecord.sameActionLinkedAtomicTitles || [];
      totals.allText += allTitles.reduce(
        (total, title) => total + title.length,
        0,
      );
      totals.sameActionText += sameActionTitles.reduce(
        (total, title) => total + title.length,
        0,
      );
      totals.allSerialized += JSON.stringify(allTitles).length;
      totals.sameActionSerialized += JSON.stringify(sameActionTitles).length;
    }
    return totals;
  },
  {
    allText: 0,
    sameActionText: 0,
    allSerialized: 0,
    sameActionSerialized: 0,
  },
);
const linkedTitleTextReductionPercent = Number(
  (
    (1 -
      linkedTitleInputCharacters.sameActionText /
        linkedTitleInputCharacters.allText) *
    100
  ).toFixed(1),
);
const linkedTitleSerializedReductionPercent = Number(
  (
    (1 -
      linkedTitleInputCharacters.sameActionSerialized /
        linkedTitleInputCharacters.allSerialized) *
    100
  ).toFixed(1),
);
const homogeneousGroupScenarios = {
  noSplit: fullInventory.length,
  stratifiedPilot: centralHomogeneousGroups,
  oneGroupPerSourceRecord: totalONetRecords,
  interpretation:
    "Sensitivity scenarios, not a confidence interval. The middle scenario preserves branch-by-evidence-bucket weights; the upper scenario assumes one resulting group per O*NET record and is not an absolute bound because a multi-object record can yield multiple claims.",
};

const fullTitleInputChars = fullInventory.reduce(
  (total, record) =>
    total + claimGroupingPromptTemplate.length + titlePayload(record).length,
  0,
);
const titleOutputCharsPerGroup =
  sampleTitleOutputChars / groupingPacket.counts.resultingGroups;
const wordNetInputCharsPerGroup = average(
  pilotBundlePacket.bundles.map(
    (bundle) =>
      allCandidateSynsetPromptTemplate.length + wordNetPayload(bundle).length,
  ),
);
const wordNetOutputCharsPerGroup = JSON.stringify({
  outcome: "selected",
  selectedSynsetId: "example.v.01",
  reason: "One concise evidence-grounded explanation.",
  confidence: "high",
}).length;

const scenarioFor = (groupCount) => {
  const titleGroupingCalls = fullInventory.length;
  const allCandidateWordNetCalls = groupCount;
  const modelCalls = titleGroupingCalls + allCandidateWordNetCalls;
  const stageTokens = {
    titleGroupingInput: tokenRangeForChars(fullTitleInputChars),
    titleGroupingOutput: tokenRangeForChars(
      titleOutputCharsPerGroup * groupCount,
    ),
    allCandidateWordNetInput: tokenRangeForChars(
      wordNetInputCharsPerGroup * groupCount,
    ),
    allCandidateWordNetOutput: tokenRangeForChars(
      wordNetOutputCharsPerGroup * groupCount,
    ),
  };
  const visiblePacketTokens = addRanges(...Object.values(stageTokens));
  const reasoningTokensPlanningAllowance = {
    low: titleGroupingCalls * 300 + allCandidateWordNetCalls * 250,
    central: titleGroupingCalls * 700 + allCandidateWordNetCalls * 600,
    high: titleGroupingCalls * 1400 + allCandidateWordNetCalls * 1200,
  };
  return {
    estimatedHomogeneousGroups: groupCount,
    calls: {
      titleGrouping: titleGroupingCalls,
      allCandidateWordNet: allCandidateWordNetCalls,
      total: modelCalls,
    },
    modelCalls,
    visiblePacketTokens,
    reasoningTokensPlanningAllowance,
    totalAccessTokensPlanningRange: addRanges(
      visiblePacketTokens,
      reasoningTokensPlanningAllowance,
    ),
    stageTokens,
  };
};

const noSplitScenario = scenarioFor(homogeneousGroupScenarios.noSplit);
const stratifiedPilotScenario = scenarioFor(
  homogeneousGroupScenarios.stratifiedPilot,
);
const oneGroupPerSourceRecordScenario = scenarioFor(
  homogeneousGroupScenarios.oneGroupPerSourceRecord,
);
const concurrency = 32;
const retryFactor = 1.15;
const elapsedFor = (scenario, seconds) =>
  Number(
    (
      ((scenario.calls.titleGrouping * seconds.title +
        scenario.calls.allCandidateWordNet * seconds.wordNet) *
        retryFactor) /
      concurrency /
      3600
    ).toFixed(1),
  );
const elapsedWallTimeHours = {
  noSplit: elapsedFor(noSplitScenario, { title: 12, wordNet: 12 }),
  stratifiedPilot: elapsedFor(stratifiedPilotScenario, {
    title: 18,
    wordNet: 18,
  }),
  oneGroupPerSourceRecord: elapsedFor(oneGroupPerSourceRecordScenario, {
    title: 30,
    wordNet: 30,
  }),
  assumptions:
    "32 concurrent calls, stage-specific latency scenarios, and 15% retry or repair overhead. Provider throughput and ACCESS concurrency limits can dominate elapsed time.",
};

const output = {
  schemaVersion: "homogeneous-title-full-run-estimate-v5",
  generatedAt: new Date().toISOString(),
  sourceFile: path.basename(sourceFile),
  sourceSha256,
  inputHashes: {
    sample: stableHash(fs.readFileSync(sampleFile)),
    groupings: stableHash(fs.readFileSync(groupingsFile)),
    priorWordNetPilotBundles: stableHash(fs.readFileSync(pilotBundlesFile)),
  },
  inventory: {
    atomicActivityOccurrences: fullInventory.length,
    uniqueExactTitles: new Set(
      fullInventory.map((record) => record.normalizedTitle),
    ).size,
    repeatedTitleOccurrences: fullInventory.filter(
      (record) => record.exactTitleOccurrenceCount > 1,
    ).length,
    oNetRecords: totalONetRecords,
    linkedTitleInputPolicy: {
      allLinkedTitleTextCharacters: linkedTitleInputCharacters.allText,
      sameActionLinkedTitleTextCharacters:
        linkedTitleInputCharacters.sameActionText,
      titleTextCharacterReductionPercent: linkedTitleTextReductionPercent,
      allSerializedArrayCharacters: linkedTitleInputCharacters.allSerialized,
      sameActionSerializedArrayCharacters:
        linkedTitleInputCharacters.sameActionSerialized,
      serializedArrayCharacterReductionPercent:
        linkedTitleSerializedReductionPercent,
      interpretation:
        "The model sees only previously represented activities using the current verb or a recorded synonym. All linked titles remain in source provenance.",
    },
    byStratum: Object.fromEntries(inventoryByStratum),
  },
  sampleBasis: {
    interpretation:
      "A review-interface pilot, not an accuracy or reliability evaluation. Keep cards are model-generated status-quo proposals, not independent controls or gold labels.",
    atomicActivityOccurrences: samplePacket.sample.length,
    homogeneousGroups: groupingPacket.counts.resultingGroups,
    titleDecisions: groupingPacket.counts,
    observedByStratum: Object.fromEntries(observedByStratum),
    exactSerializedTitlePacketTokens: {
      input: tokenRangeForChars(sampleTitleInputChars),
      output: tokenRangeForChars(sampleTitleOutputChars),
    },
    wordNetPacketSizingBasis: {
      priorPilotGroups: pilotBundlePacket.bundles.length,
      use: "Only serialized candidate-set size is reused. Prior semantic decisions and fallback rates are not extrapolated.",
    },
  },
  conservativePlanningModelPlan: [
    {
      stages: ["reader-ready homogeneous title grouping"],
      model: "gpt-5.6-terra",
      reasoningEffort: "high",
      role: "conservative sizing baseline for one structured semantic call per atomic-title occurrence; final model awaits the post-prompt-convergence benchmark",
    },
    {
      stages: ["all-candidate WordNet alignment after title acceptance"],
      model: "gpt-5.6-terra",
      reasoningEffort: "high",
      role: "conservative sizing baseline for one comparison call per accepted homogeneous group after deterministic local candidate retrieval; final model awaits benchmarking",
    },
    {
      stages: [
        "source and claim binding",
        "2-5-word title validation",
        "title status",
        "local WordNet retrieval",
      ],
      model: null,
      reasoningEffort: null,
      role: "deterministic local validation",
    },
  ],
  projection: {
    homogeneousGroupScenarios,
    claimAwareAllCandidatePipeline: {
      noSplitScenario,
      stratifiedPilotScenario,
      oneGroupPerSourceRecordScenario,
      elapsedWallTimeHours,
      directApiCharge: {
        amountUsd: 0,
        interpretation:
          "The requested execution path uses the approved ACCESS allocation rather than a separately billed external API. Allocation consumption is not zero.",
      },
    },
  },
  cautions: [
    "Token counts are planning scenarios from serialized packets at 3.5-4.5 characters per token; only the model service meter can report exact usage.",
    "Reasoning tokens are unavailable in saved outputs, so stage-specific allowances are shown separately.",
    "The 18-case pilot includes repeated and 21+-record occurrences in every top-level branch, but only one medium and one large case per branch; its extrapolation remains fragile.",
    "The pilot has no independent human gold labels, blind holdout, repeated model runs, or measured latency. It cannot establish semantic accuracy, reliability, or production duration.",
    "WordNet work begins only after expert acceptance. All candidates are shown in one call to avoid anchoring on the inherited sense demonstrated in Rob's shared Claude dialogue.",
    "Human review time is excluded. No proposal or reviewer response automatically mutates the ontology.",
    "The named model is a conservative planning baseline, not a production recommendation. In keeping with the reviewer request, lower-cost model benchmarking begins only after the prompt has converged.",
  ],
};

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");
process.stdout.write(
  `PASS: projected ${fullInventory.length} title cases and ${centralHomogeneousGroups} stratified-pilot groups\n${outputFile}\n`,
);
