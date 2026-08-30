#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import {
  claimGroupingPromptTemplate,
  claimGroupingValidationRules,
  extractAtomicActivities,
  normalizeTitle,
  stableHash,
  validateClaimGroupingAssessments,
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

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

const args = parseArgs();
const sourceFile = required(args.source, "--source");
const sampleFile = required(args.sample, "--sample");
const assessmentsFile = required(args.assessments, "--assessments");
const outputFile = required(args.out, "--out");

const sourceBuffer = fs.readFileSync(sourceFile);
const sourceSha256 = stableHash(sourceBuffer);
const samplePacket = readJson(sampleFile);
const assessmentPacket = readJson(assessmentsFile);
const groupingPromptVersion = "access-homogeneous-title-grouping-2026-08-30-v5";
const groupingPromptSha256 = stableHash(claimGroupingPromptTemplate);

if (samplePacket.schemaVersion !== "homogeneous-title-testbed-sample-v5") {
  throw new Error("The validator requires a v5 sample packet");
}
if (
  assessmentPacket.schemaVersion !==
    "homogeneous-title-grouping-assessments-v5" ||
  assessmentPacket.promptVersion !== groupingPromptVersion ||
  assessmentPacket.promptSha256 !== groupingPromptSha256
) {
  throw new Error(
    "The grouping assessments were not produced for the exact v5 prompt",
  );
}

if (samplePacket.sourceSha256 !== sourceSha256) {
  throw new Error(
    "The sample packet does not match the supplied source hierarchy",
  );
}
if (assessmentPacket.sourceSha256 !== sourceSha256) {
  throw new Error("The grouping assessments do not match the source hierarchy");
}

const fullInventory = extractAtomicActivities(JSON.parse(sourceBuffer));
const inventoryById = new Map(
  fullInventory.map((record) => [record.occurrenceId, record]),
);
for (const sampled of samplePacket.sample) {
  const source = inventoryById.get(sampled.occurrenceId);
  if (!source)
    throw new Error(`Sample occurrence is missing: ${sampled.occurrenceId}`);
  if (
    source.exactTitle !== sampled.exactTitle ||
    stableHash(JSON.stringify(source.sourceRecords)) !==
      stableHash(JSON.stringify(sampled.sourceRecords))
  ) {
    throw new Error(`Sample occurrence is stale: ${sampled.exactTitle}`);
  }
}

const existingTitles = new Set(
  fullInventory.map((record) => normalizeTitle(record.exactTitle)),
);
const existingTitleCounts = fullInventory.reduce((counts, record) => {
  counts.set(
    record.normalizedTitle,
    (counts.get(record.normalizedTitle) || 0) + 1,
  );
  return counts;
}, new Map());
const validated = validateClaimGroupingAssessments({
  occurrences: samplePacket.sample,
  assessments: assessmentPacket.assessments,
  existingTitles,
  existingTitleCounts,
});

const output = {
  schemaVersion: "homogeneous-title-testbed-validated-v5",
  generatedAt: new Date().toISOString(),
  sourceFile: path.basename(sourceFile),
  sourceSha256,
  sampleFile: path.basename(sampleFile),
  sampleSha256: stableHash(fs.readFileSync(sampleFile)),
  assessmentsFile: path.basename(assessmentsFile),
  assessmentsSha256: stableHash(fs.readFileSync(assessmentsFile)),
  promptVersions: {
    grouping: groupingPromptVersion,
    validator: "homogeneous-title-grouping-validator-2026-08-30-v5",
  },
  promptSha256: {
    grouping: groupingPromptSha256,
    validator: stableHash(claimGroupingValidationRules),
  },
  counts: {
    cases: validated.length,
    keep: validated.filter((item) => item.decision === "keep").length,
    rename: validated.filter((item) => item.decision === "rename").length,
    split: validated.filter((item) => item.decision === "split").length,
    defer: validated.filter((item) => item.decision === "defer").length,
    resultingGroups: validated.reduce(
      (total, item) => total + item.groups.length,
      0,
    ),
  },
  assessments: validated,
};

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");
process.stdout.write(
  `PASS: validated ${validated.length} claim-aware title-grouping cases\n${outputFile}\n`,
);
