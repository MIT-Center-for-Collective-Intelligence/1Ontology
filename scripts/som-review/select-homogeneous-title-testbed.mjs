#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import {
  extractAtomicActivities,
  genericActionDiagnostic,
  selectStratifiedSample,
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
  return value;
};

const args = parseArgs();
const sourceFile = path.resolve(required(args.source, "--source"));
const outputFile = path.resolve(required(args.out, "--out"));
const sourceBuffer = fs.readFileSync(sourceFile);
const sourceSha256 = stableHash(sourceBuffer);
const occurrences = extractAtomicActivities(JSON.parse(sourceBuffer));
const seed = args.seed || sourceSha256;
const sample = selectStratifiedSample({
  occurrences,
  seed,
});
const packet = {
  schemaVersion: "homogeneous-title-testbed-sample-v3",
  generatedAt: new Date().toISOString(),
  sourceFile: path.basename(sourceFile),
  sourceSha256,
  seed,
  selectionRule:
    "Deterministic hash order within every top-level branch and evidence-count bucket: two single-record, two 2-5-record, one 6-20-record, and one 21+-record occurrence per branch. At most one repeated-title occurrence is prioritized in each stratum so the pilot covers repeated as well as unique titles.",
  inventoryCounts: {
    atomicActivityOccurrences: occurrences.length,
    uniqueTitleCount: new Set(
      occurrences.map((record) => record.normalizedTitle),
    ).size,
    singleOccurrenceTitleCount: occurrences.filter(
      (record) => record.exactTitleOccurrenceCount === 1,
    ).length,
    repeatedTitleOccurrenceCount: occurrences.filter(
      (record) => record.exactTitleOccurrenceCount > 1,
    ).length,
  },
  genericActionDiagnostic: genericActionDiagnostic(occurrences),
  sample,
};
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
process.stdout.write(
  `PASS: selected ${sample.length} records from ${occurrences.length} atomic occurrences\n${outputFile}\n`,
);
