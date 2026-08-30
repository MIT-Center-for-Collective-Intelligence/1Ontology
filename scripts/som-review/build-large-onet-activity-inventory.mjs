#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import {
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

const csvCell = (value) => `"${String(value).replaceAll('"', '""')}"`;

const args = parseArgs();
const sourceFile = required(args.source, "--source");
const outputFile = required(args.out, "--out");
const csvFile = required(args.csv, "--csv");
const cutoff = Number(args.cutoff || 10);
if (!Number.isInteger(cutoff) || cutoff < 1) {
  throw new Error("--cutoff must be a positive integer");
}

const sourceBuffer = fs.readFileSync(sourceFile);
const occurrences = extractAtomicActivities(JSON.parse(sourceBuffer));
const qualifying = occurrences.filter(
  (record) => record.evidenceCount > cutoff,
);
const byTitle = new Map();
for (const occurrence of qualifying) {
  const existing = byTitle.get(occurrence.normalizedTitle);
  if (
    existing &&
    existing.linkedONetDescriptionCount !== occurrence.evidenceCount
  ) {
    throw new Error(
      `Repeated title ${occurrence.exactTitle} has conflicting O*NET counts`,
    );
  }
  byTitle.set(occurrence.normalizedTitle, {
    title: existing?.title || occurrence.exactTitle,
    linkedONetDescriptionCount: occurrence.evidenceCount,
    ontologyOccurrenceCount: (existing?.ontologyOccurrenceCount || 0) + 1,
  });
}

const rows = [...byTitle.values()].sort(
  (left, right) =>
    right.linkedONetDescriptionCount - left.linkedONetDescriptionCount ||
    left.title.localeCompare(right.title, "en"),
);
const output = {
  schemaVersion: "large-onet-activity-inventory-v1",
  generatedAt: new Date().toISOString(),
  sourceFile: path.basename(sourceFile),
  sourceSha256: stableHash(sourceBuffer),
  cutoffRule: `Include exact activity titles linked to more than ${cutoff} O*NET descriptions. Repeated ontology occurrences with the same title are shown once because their linked-description counts are identical.`,
  cutoff,
  uniqueTitleCount: rows.length,
  ontologyOccurrenceCount: qualifying.length,
  repeatedOccurrenceCount: qualifying.length - rows.length,
  maximumLinkedDescriptionCount: Math.max(
    0,
    ...rows.map((row) => row.linkedONetDescriptionCount),
  ),
  rows,
};

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.mkdirSync(path.dirname(csvFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");
fs.writeFileSync(
  csvFile,
  [
    ["Current atomic activity title", "Linked O*NET descriptions"],
    ...rows.map((row) => [row.title, row.linkedONetDescriptionCount]),
  ]
    .map((row) => row.map(csvCell).join(","))
    .join("\n") + "\n",
  "utf8",
);
process.stdout.write(
  `PASS: found ${rows.length} unique titles across ${qualifying.length} ontology occurrences with more than ${cutoff} O*NET descriptions\n${outputFile}\n${csvFile}\n`,
);
