#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import {
  extractAtomicActivities,
  groupingAuditPromptTemplate,
  groupingPromptTemplate,
  stableHash,
  wordNetAlignmentAuditPromptTemplate,
  wordNetAlignmentPromptTemplate,
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
const uniqueSorted = (values) =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right, "en"));
const withoutAudit = (assessment) => {
  const output = { ...assessment };
  delete output.audit;
  return output;
};

// English prompt packets usually fall near four characters per model token.
// The range is intentionally wider because no exact tokenizer or model meter is
// available in this offline ACCESS-only workflow.
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

const scaleRange = (range, multiplier) => ({
  low: round(range.low * multiplier),
  central: round(range.central * multiplier),
  high: round(range.high * multiplier),
});

const titlePayload = (record) =>
  JSON.stringify({
    exactCurrentAtomicTitle: record.exactTitle,
    currentSemanticParentAndPath: {
      parentTitle: record.parentTitle,
      path: record.path,
    },
    allExactONetRecordsAndExistingLinks: record.sourceRecords,
    matchingExistingTitles: uniqueSorted(
      record.sourceRecords.flatMap(
        (sourceRecord) => sourceRecord.otherLinkedAtomicTitles,
      ),
    ),
  });

const titlePromptChars = (record) =>
  groupingPromptTemplate.length + titlePayload(record).length;

const args = parseArgs();
const sourceFile = required(args.source, "--source");
const sampleFile = required(args.sample, "--sample");
const groupingsFile = required(args.groupings, "--groupings");
const bundlesFile = required(args.bundles, "--bundles");
const alignmentsFile = required(args.alignments, "--alignments");
const outputFile = required(args.out, "--out");

const sourceBuffer = fs.readFileSync(sourceFile);
const sourceSha256 = stableHash(sourceBuffer);
const samplePacket = readJson(sampleFile);
const groupingPacket = readJson(groupingsFile);
const bundlePacket = readJson(bundlesFile);
const alignmentPacket = readJson(alignmentsFile);

for (const packet of [
  samplePacket,
  groupingPacket,
  bundlePacket,
  alignmentPacket,
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
const alignmentsById = new Map(
  alignmentPacket.assessments.map((assessment) => [
    assessment.groupId,
    assessment,
  ]),
);

const sampleTitleChars = {
  proposerInput: 0,
  proposerOutput: 0,
  auditorInput: 0,
  auditorOutput: 0,
};
const sampleByBucket = new Map();
for (const record of samplePacket.sample) {
  const assessment = groupingsById.get(record.occurrenceId);
  if (!assessment) {
    throw new Error(`Missing grouping assessment for ${record.occurrenceId}`);
  }
  const payload = titlePayload(record);
  const proposerOutput = JSON.stringify(withoutAudit(assessment));
  sampleTitleChars.proposerInput +=
    groupingPromptTemplate.length + payload.length;
  sampleTitleChars.proposerOutput += proposerOutput.length;
  sampleTitleChars.auditorInput +=
    groupingAuditPromptTemplate.length + payload.length + proposerOutput.length;
  sampleTitleChars.auditorOutput += JSON.stringify(assessment.audit).length;

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

const sampleWordNetChars = {
  proposerInput: 0,
  proposerOutput: 0,
  auditorInput: 0,
  auditorOutput: 0,
};
for (const bundle of bundlePacket.bundles) {
  const assessment = alignmentsById.get(bundle.groupId);
  if (!assessment) {
    throw new Error(`Missing WordNet assessment for ${bundle.groupId}`);
  }
  const payload = JSON.stringify(bundle);
  const proposerOutput = JSON.stringify(withoutAudit(assessment));
  sampleWordNetChars.proposerInput +=
    wordNetAlignmentPromptTemplate.length + payload.length;
  sampleWordNetChars.proposerOutput += proposerOutput.length;
  sampleWordNetChars.auditorInput +=
    wordNetAlignmentAuditPromptTemplate.length +
    payload.length +
    proposerOutput.length;
  sampleWordNetChars.auditorOutput += JSON.stringify(assessment.audit).length;
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

const observedSingleGroupsPerCase =
  sampleByBucket.get("single").homogeneousGroups /
  sampleByBucket.get("single").cases;
const observedSmallGroupsPerCase =
  sampleByBucket.get("small-multi").homogeneousGroups /
  sampleByBucket.get("small-multi").cases;
const observedMediumGroupsPerCase =
  sampleByBucket.get("medium-multi").homogeneousGroups /
  sampleByBucket.get("medium-multi").cases;
const observedMediumGroupsPerRecord =
  sampleByBucket.get("medium-multi").homogeneousGroups /
  sampleByBucket.get("medium-multi").sourceRecords;

const centralHomogeneousGroups = round(
  inventoryByBucket.single.atomicActivityOccurrences *
    observedSingleGroupsPerCase +
    inventoryByBucket["small-multi"].atomicActivityOccurrences *
      observedSmallGroupsPerCase +
    inventoryByBucket["medium-multi"].atomicActivityOccurrences *
      observedMediumGroupsPerCase +
    inventoryByBucket.large.oNetRecords * observedMediumGroupsPerRecord,
);
const homogeneousGroupRange = {
  low: fullInventory.length,
  central: centralHomogeneousGroups,
  high: round((centralHomogeneousGroups * 4) / 3),
};

const fullTitleDynamicChars = fullInventory.reduce(
  (total, record) => total + titlePayload(record).length,
  0,
);
const fullTitleProposerInputChars =
  fullTitleDynamicChars + groupingPromptTemplate.length * fullInventory.length;
const sampleGroups = groupingPacket.counts.resultingGroups;
const titleOutputCharsPerGroup = sampleTitleChars.proposerOutput / sampleGroups;
const titleAuditOutputCharsPerCase =
  sampleTitleChars.auditorOutput / samplePacket.sample.length;

const projectTitleTokens = (groupCount) => {
  const proposerOutputChars = titleOutputCharsPerGroup * groupCount;
  return {
    proposerInput: tokenRangeForChars(fullTitleProposerInputChars),
    proposerOutput: tokenRangeForChars(proposerOutputChars),
    auditorInput: tokenRangeForChars(
      fullTitleDynamicChars +
        groupingAuditPromptTemplate.length * fullInventory.length +
        proposerOutputChars,
    ),
    auditorOutput: tokenRangeForChars(
      titleAuditOutputCharsPerCase * fullInventory.length,
    ),
  };
};

const wordNetCharsPerGroup = Object.fromEntries(
  Object.entries(sampleWordNetChars).map(([stage, characters]) => [
    stage,
    characters / bundlePacket.bundles.length,
  ]),
);
const projectWordNetTokens = (groupCount) =>
  Object.fromEntries(
    Object.entries(wordNetCharsPerGroup).map(([stage, characters]) => [
      stage,
      tokenRangeForChars(characters * groupCount),
    ]),
  );

const scenarioFor = (groupCount) => {
  const title = projectTitleTokens(groupCount);
  const wordNet = projectWordNetTokens(groupCount);
  const visibleTokens = addRanges(
    ...Object.values(title),
    ...Object.values(wordNet),
  );
  const modelCalls = fullInventory.length * 2 + groupCount * 2;
  // Reasoning tokens are not present in serialized outputs. This planning band
  // assumes 500-2,000 hidden reasoning tokens per high-reasoning semantic call.
  const reasoningTokens = {
    low: modelCalls * 500,
    central: modelCalls * 1_000,
    high: modelCalls * 2_000,
  };
  return {
    estimatedHomogeneousGroups: groupCount,
    modelCalls,
    visiblePacketTokens: visibleTokens,
    reasoningTokensPlanningAllowance: reasoningTokens,
    totalAccessTokensPlanningRange: addRanges(visibleTokens, reasoningTokens),
    stageTokens: { title, wordNet },
  };
};

const lowScenario = scenarioFor(homogeneousGroupRange.low);
const centralScenario = scenarioFor(homogeneousGroupRange.central);
const highScenario = scenarioFor(homogeneousGroupRange.high);
const concurrency = 32;
const retryFactor = 1.15;
const elapsedHours = {
  low: Number(
    ((lowScenario.modelCalls * 20 * retryFactor) / concurrency / 3600).toFixed(
      1,
    ),
  ),
  central: Number(
    (
      (centralScenario.modelCalls * 30 * retryFactor) /
      concurrency /
      3600
    ).toFixed(1),
  ),
  high: Number(
    ((highScenario.modelCalls * 45 * retryFactor) / concurrency / 3600).toFixed(
      1,
    ),
  ),
};

const output = {
  schemaVersion: "homogeneous-title-full-run-estimate-v1",
  generatedAt: new Date().toISOString(),
  sourceFile: path.basename(sourceFile),
  sourceSha256,
  inputHashes: {
    sample: stableHash(fs.readFileSync(sampleFile)),
    groupings: stableHash(fs.readFileSync(groupingsFile)),
    bundles: stableHash(fs.readFileSync(bundlesFile)),
    alignments: stableHash(fs.readFileSync(alignmentsFile)),
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
    homogeneousGroups: bundlePacket.bundles.length,
    titleDecisions: groupingPacket.counts,
    wordNetDecisions: alignmentPacket.counts,
    observedByEvidenceBucket: Object.fromEntries(sampleByBucket),
    exactSerializedPacketTokens: {
      title: Object.fromEntries(
        Object.entries(sampleTitleChars).map(([stage, characters]) => [
          stage,
          tokenRangeForChars(characters),
        ]),
      ),
      wordNet: Object.fromEntries(
        Object.entries(sampleWordNetChars).map(([stage, characters]) => [
          stage,
          tokenRangeForChars(characters),
        ]),
      ),
    },
  },
  recommendedModelPlan: [
    {
      stages: ["title grouping", "WordNet alignment"],
      model: "gpt-5.6-terra",
      reasoningEffort: "high",
      role: "primary structured proposer",
    },
    {
      stages: ["title grouping audit", "WordNet alignment audit"],
      model: "gpt-5.6-sol",
      reasoningEffort: "high",
      role: "independent semantic auditor",
    },
    {
      stages: ["source binding", "coverage", "title status", "synset binding"],
      model: null,
      reasoningEffort: null,
      role: "deterministic local validation",
    },
  ],
  projection: {
    homogeneousGroups: {
      ...homogeneousGroupRange,
      interpretation:
        "Planning range, not a statistical confidence interval. The low case is the one-group-per-occurrence floor; the central case applies observed sample rates by evidence bucket and the medium-record rate to unsampled large cases; the high case adds one third for sample and large-case uncertainty.",
    },
    fullIndependentAudit: {
      lowScenario,
      centralScenario,
      highScenario,
      elapsedWallTimeHours: {
        ...elapsedHours,
        assumptions:
          "32 concurrent calls, 20/30/45 seconds per call in the low/central/high scenarios, and 15% retry or repair overhead. Provider throughput and ACCESS concurrency limits can dominate this estimate.",
      },
      directApiCharge: {
        amountUsd: 0,
        interpretation:
          "The requested execution path uses the approved ACCESS allocation rather than a separately billed external API. This does not mean the allocation consumption is zero.",
      },
    },
  },
  cautions: [
    "Token counts are planning estimates from exact serialized sample packets at 3.5-4.5 characters per token; only the model service meter can report exact tokens.",
    "Hidden reasoning is not present in saved outputs, so the ACCESS total adds a clearly separated allowance of 500-2,000 reasoning tokens per high-reasoning call.",
    "The sample deliberately balances evidence strata and contains only six cases per observed stratum; the projected number of homogeneous groups is therefore the largest source of uncertainty.",
    "The sample contains no title with more than 20 O*NET records. Large-case group growth is extrapolated and must be checked with a dedicated large-case pilot before authorizing a full run.",
    "Human review time is excluded. No model proposal or reviewer response automatically mutates the ontology.",
  ],
};

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");
process.stdout.write(
  `PASS: estimated ${fullInventory.length} title cases and ${homogeneousGroupRange.central} central WordNet groups\n${outputFile}\n`,
);
