#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import {
  assignedSynsetCheckPromptTemplate,
  conditionalSynsetSelectionPromptTemplate,
  extractAtomicActivities,
  simpleGroupingPromptTemplate,
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

// Planning estimate only. The provider meter remains authoritative.
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

const titlePayload = (record) =>
  JSON.stringify({
    currentAtomicTitle: record.exactTitle,
    numberedONetRecords: record.sourceRecords.map((sourceRecord) => ({
      index: sourceRecord.index,
      exactRecord: sourceRecord.exactRecord,
      otherLinkedAtomicTitles: sourceRecord.otherLinkedAtomicTitles,
    })),
  });
const assignedCheckPayload = (bundle) =>
  JSON.stringify({
    groupTitle: bundle.groupTitle,
    sourceRecords: bundle.sourceRecords,
    assignedSynsets: bundle.assignedSynsets,
  });
const selectionPayload = (bundle) =>
  JSON.stringify({
    groupTitle: bundle.groupTitle,
    sourceRecords: bundle.sourceRecords,
    candidateSynsets: bundle.candidateSynsets,
  });

const args = parseArgs();
const sourceFile = required(args.source, "--source");
const sampleFile = required(args.sample, "--sample");
const groupingsFile = required(args.groupings, "--groupings");
const pilotBundlesFile = required(args.bundles, "--bundles");
const pilotAlignmentsFile = required(args.alignments, "--alignments");
const outputFile = required(args.out, "--out");

const sourceBuffer = fs.readFileSync(sourceFile);
const sourceSha256 = stableHash(sourceBuffer);
const samplePacket = readJson(sampleFile);
const groupingPacket = readJson(groupingsFile);
const pilotBundlePacket = readJson(pilotBundlesFile);
const pilotAlignmentPacket = readJson(pilotAlignmentsFile);
for (const packet of [
  samplePacket,
  groupingPacket,
  pilotBundlePacket,
  pilotAlignmentPacket,
]) {
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
const sampleByBucket = new Map();
let sampleTitleInputChars = 0;
let sampleTitleOutputChars = 0;
for (const record of samplePacket.sample) {
  const assessment = groupingsById.get(record.occurrenceId);
  if (!assessment) {
    throw new Error(`Missing grouping assessment for ${record.occurrenceId}`);
  }
  sampleTitleInputChars +=
    simpleGroupingPromptTemplate.length + titlePayload(record).length;
  sampleTitleOutputChars += JSON.stringify({
    groups: assessment.groups.map(({ title, sourceTaskIndexes, reason }) => ({
      title,
      sourceTaskIndexes,
      reason,
    })),
    deferredTaskIndexes: assessment.deferredTaskIndexes,
    reason: assessment.reason,
    confidence: assessment.confidence,
  }).length;
  const bucket = sampleByBucket.get(record.evidenceBucket) || {
    cases: 0,
    sourceRecords: 0,
    homogeneousGroups: 0,
  };
  bucket.cases += 1;
  bucket.sourceRecords += record.evidenceCount;
  bucket.homogeneousGroups += assessment.groups.length;
  sampleByBucket.set(record.evidenceBucket, bucket);
}

const inventoryByBucket = Object.fromEntries(
  ["single", "small-multi", "medium-multi", "large"].map((bucket) => {
    const records = fullInventory.filter(
      (record) => record.evidenceBucket === bucket,
    );
    return [
      bucket,
      {
        atomicActivityOccurrences: records.length,
        oNetRecords: records.reduce(
          (total, record) => total + record.evidenceCount,
          0,
        ),
      },
    ];
  }),
);
const groupsPerCase = (bucket) =>
  sampleByBucket.get(bucket).homogeneousGroups /
  sampleByBucket.get(bucket).cases;
const mediumGroupsPerRecord =
  sampleByBucket.get("medium-multi").homogeneousGroups /
  sampleByBucket.get("medium-multi").sourceRecords;
const centralHomogeneousGroups = round(
  inventoryByBucket.single.atomicActivityOccurrences * groupsPerCase("single") +
    inventoryByBucket["small-multi"].atomicActivityOccurrences *
      groupsPerCase("small-multi") +
    inventoryByBucket["medium-multi"].atomicActivityOccurrences *
      groupsPerCase("medium-multi") +
    inventoryByBucket.large.oNetRecords * mediumGroupsPerRecord,
);
const homogeneousGroupRange = {
  low: fullInventory.length,
  central: centralHomogeneousGroups,
  high: round((centralHomogeneousGroups * 4) / 3),
};

const fullTitleInputChars = fullInventory.reduce(
  (total, record) =>
    total + simpleGroupingPromptTemplate.length + titlePayload(record).length,
  0,
);
const titleOutputCharsPerGroup =
  sampleTitleOutputChars / groupingPacket.counts.resultingGroups;
const pilotNonKeep = pilotAlignmentPacket.assessments.filter(
  (assessment) => assessment.decision !== "keep-assigned",
);
const conditionalSelectionRate =
  pilotNonKeep.length / pilotAlignmentPacket.assessments.length;
const assignedCheckInputCharsPerGroup = average(
  pilotBundlePacket.bundles.map(
    (bundle) =>
      assignedSynsetCheckPromptTemplate.length +
      assignedCheckPayload(bundle).length,
  ),
);
const assignedCheckOutputCharsPerGroup = average(
  pilotAlignmentPacket.assessments.map(
    (assessment) =>
      JSON.stringify({
        decision:
          assessment.decision === "keep-assigned"
            ? "correct-for-all"
            : "incorrect-for-all",
        incorrectRecordIndexes:
          assessment.decision === "keep-assigned" ? [] : [1],
        reason: assessment.reason,
        confidence: assessment.confidence,
      }).length,
  ),
);
const conditionalPilotBundles = pilotBundlePacket.bundles.filter((bundle) =>
  pilotNonKeep.some((assessment) => assessment.groupId === bundle.groupId),
);
const conditionalSelectionInputCharsPerCall = average(
  conditionalPilotBundles.map(
    (bundle) =>
      conditionalSynsetSelectionPromptTemplate.length +
      selectionPayload(bundle).length,
  ),
);
const conditionalSelectionOutputCharsPerCall = average(
  pilotNonKeep.map((assessment) => {
    const { audit, ...withoutAudit } = assessment;
    return JSON.stringify(withoutAudit).length;
  }),
);

const scenarioFor = (groupCount) => {
  const titleGroupingCalls = fullInventory.length;
  const assignedSynsetCheckCalls = groupCount;
  const conditionalSynsetSelectionCalls = round(
    groupCount * conditionalSelectionRate,
  );
  const modelCalls =
    titleGroupingCalls +
    assignedSynsetCheckCalls +
    conditionalSynsetSelectionCalls;
  const stageTokens = {
    titleGroupingInput: tokenRangeForChars(fullTitleInputChars),
    titleGroupingOutput: tokenRangeForChars(
      titleOutputCharsPerGroup * groupCount,
    ),
    assignedSynsetCheckInput: tokenRangeForChars(
      assignedCheckInputCharsPerGroup * groupCount,
    ),
    assignedSynsetCheckOutput: tokenRangeForChars(
      assignedCheckOutputCharsPerGroup * groupCount,
    ),
    conditionalSynsetSelectionInput: tokenRangeForChars(
      conditionalSelectionInputCharsPerCall * conditionalSynsetSelectionCalls,
    ),
    conditionalSynsetSelectionOutput: tokenRangeForChars(
      conditionalSelectionOutputCharsPerCall * conditionalSynsetSelectionCalls,
    ),
  };
  const visiblePacketTokens = addRanges(...Object.values(stageTokens));
  const reasoningTokensPlanningAllowance = {
    low:
      titleGroupingCalls * 300 +
      assignedSynsetCheckCalls * 200 +
      conditionalSynsetSelectionCalls * 300,
    central:
      titleGroupingCalls * 700 +
      assignedSynsetCheckCalls * 450 +
      conditionalSynsetSelectionCalls * 700,
    high:
      titleGroupingCalls * 1400 +
      assignedSynsetCheckCalls * 900 +
      conditionalSynsetSelectionCalls * 1400,
  };
  return {
    estimatedHomogeneousGroups: groupCount,
    calls: {
      titleGrouping: titleGroupingCalls,
      assignedSynsetCheck: assignedSynsetCheckCalls,
      conditionalSynsetSelection: conditionalSynsetSelectionCalls,
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

const lowScenario = scenarioFor(homogeneousGroupRange.low);
const centralScenario = scenarioFor(homogeneousGroupRange.central);
const highScenario = scenarioFor(homogeneousGroupRange.high);
const concurrency = 32;
const retryFactor = 1.15;
const elapsedFor = (scenario, seconds) =>
  Number(
    (
      ((scenario.calls.titleGrouping * seconds.title +
        scenario.calls.assignedSynsetCheck * seconds.check +
        scenario.calls.conditionalSynsetSelection * seconds.selection) *
        retryFactor) /
      concurrency /
      3600
    ).toFixed(1),
  );
const elapsedWallTimeHours = {
  low: elapsedFor(lowScenario, { title: 12, check: 10, selection: 14 }),
  central: elapsedFor(centralScenario, {
    title: 18,
    check: 14,
    selection: 20,
  }),
  high: elapsedFor(highScenario, { title: 30, check: 24, selection: 35 }),
  assumptions:
    "32 concurrent calls with stage-specific low/central/high latency assumptions and 15% retry or repair overhead. Provider throughput and ACCESS concurrency limits can dominate this estimate.",
};

const output = {
  schemaVersion: "homogeneous-title-full-run-estimate-v2",
  generatedAt: new Date().toISOString(),
  sourceFile: path.basename(sourceFile),
  sourceSha256,
  inputHashes: {
    sample: stableHash(fs.readFileSync(sampleFile)),
    groupings: stableHash(fs.readFileSync(groupingsFile)),
    priorWordNetPilotBundles: stableHash(fs.readFileSync(pilotBundlesFile)),
    priorWordNetPilotAlignments: stableHash(
      fs.readFileSync(pilotAlignmentsFile),
    ),
  },
  inventory: {
    atomicActivityOccurrences: fullInventory.length,
    uniqueExactTitles: new Set(
      fullInventory.map((record) => record.normalizedTitle),
    ).size,
    oNetRecords: fullInventory.reduce(
      (total, record) => total + record.evidenceCount,
      0,
    ),
    byEvidenceBucket: inventoryByBucket,
  },
  sampleBasis: {
    atomicActivityOccurrences: samplePacket.sample.length,
    homogeneousGroups: groupingPacket.counts.resultingGroups,
    titleDecisions: groupingPacket.counts,
    observedByEvidenceBucket: Object.fromEntries(sampleByBucket),
    priorWordNetPilot: {
      groups: pilotAlignmentPacket.assessments.length,
      groupsNeedingConditionalSelection: pilotNonKeep.length,
      observedConditionalSelectionRate: conditionalSelectionRate,
      interpretation:
        "The conditional rate comes from the prior 42-group pilot and is used only for planning. The accepted v2 groups have not been sent through WordNet alignment.",
    },
    exactSerializedTitlePacketTokens: {
      input: tokenRangeForChars(sampleTitleInputChars),
      output: tokenRangeForChars(sampleTitleOutputChars),
    },
  },
  recommendedModelPlan: [
    {
      stages: ["homogeneous title grouping", "conditional synset selection"],
      model: "gpt-5.6-terra",
      reasoningEffort: "high",
      role: "single structured semantic call followed by expert review",
    },
    {
      stages: ["assigned synset fit check"],
      model: "gpt-5.6-terra",
      reasoningEffort: "medium",
      role: "bounded definition-to-evidence check",
    },
    {
      stages: [
        "source binding",
        "one-record-one-group coverage",
        "title status",
        "local WordNet retrieval",
      ],
      model: null,
      reasoningEffort: null,
      role: "deterministic local validation",
    },
  ],
  projection: {
    homogeneousGroups: {
      ...homogeneousGroupRange,
      interpretation:
        "Planning range, not a statistical confidence interval. The central case applies observed v2 sample rates by evidence bucket and the medium-record rate to unsampled large cases; the high case adds one third for sample and large-case uncertainty.",
    },
    streamlinedConditionalPipeline: {
      lowScenario,
      centralScenario,
      highScenario,
      elapsedWallTimeHours,
      conditionalSelectionRate,
      directApiCharge: {
        amountUsd: 0,
        interpretation:
          "The requested execution path uses the approved ACCESS allocation rather than a separately billed external API. This does not mean allocation consumption is zero.",
      },
    },
  },
  cautions: [
    "Token counts are planning estimates from exact serialized packets at 3.5-4.5 characters per token; only the model service meter can report exact tokens.",
    "Reasoning tokens are not present in saved outputs, so the ACCESS total includes a separate stage-specific planning allowance.",
    "The title sample balances evidence strata and contains only six cases per observed stratum; projected group growth is the largest uncertainty.",
    "The sample contains no title with more than 20 O*NET records. A dedicated large-case pilot remains necessary before a full run.",
    "WordNet work starts only after expert acceptance of each title grouping. The conditional-selection estimate comes from the prior pilot, not accepted v2 title groups.",
    "Human review time is excluded. No model proposal or reviewer response automatically mutates the ontology.",
  ],
};

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");
process.stdout.write(
  `PASS: estimated ${fullInventory.length} title cases, ${centralHomogeneousGroups} central groups, and ${centralScenario.modelCalls} central model calls\n${outputFile}\n`,
);
