#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import {
  extractAtomicActivities,
  groupingAuditPromptTemplate,
  groupingPromptTemplate,
  groupingValidationRules,
  normalizeTitle,
  stableHash,
  validateGroupingAssessments,
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
const auditsFile = required(args.audits, "--audits");
const outputFile = required(args.out, "--out");

const sourceBuffer = fs.readFileSync(sourceFile);
const sourceSha256 = stableHash(sourceBuffer);
const samplePacket = readJson(sampleFile);
const assessmentPacket = readJson(assessmentsFile);
const auditPacket = readJson(auditsFile);

if (samplePacket.sourceSha256 !== sourceSha256) {
  throw new Error(
    "The sample packet does not match the supplied source hierarchy",
  );
}
if (assessmentPacket.sourceSha256 !== sourceSha256) {
  throw new Error("The grouping assessments do not match the source hierarchy");
}
if (auditPacket.sourceSha256 !== sourceSha256) {
  throw new Error("The grouping audits do not match the source hierarchy");
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

const auditsById = new Map(
  auditPacket.audits.map((audit) => [
    audit.occurrenceId,
    {
      ...audit,
      checks: {
        ...(auditPacket.defaultChecks || {}),
        ...(audit.checks || {}),
      },
    },
  ]),
);
const mergedAssessments = assessmentPacket.assessments.map((assessment) => ({
  ...assessment,
  audit: auditsById.get(assessment.occurrenceId),
}));
const existingTitles = new Set(
  fullInventory.map((record) => normalizeTitle(record.exactTitle)),
);
const validated = validateGroupingAssessments({
  occurrences: samplePacket.sample,
  assessments: mergedAssessments,
  existingTitles,
});

if (auditsById.size !== validated.length) {
  throw new Error(
    `Expected ${validated.length} audits; received ${auditsById.size}`,
  );
}

const output = {
  schemaVersion: "homogeneous-title-testbed-validated-v1",
  generatedAt: new Date().toISOString(),
  sourceFile: path.basename(sourceFile),
  sourceSha256,
  sampleFile: path.basename(sampleFile),
  sampleSha256: stableHash(fs.readFileSync(sampleFile)),
  assessmentsFile: path.basename(assessmentsFile),
  assessmentsSha256: stableHash(fs.readFileSync(assessmentsFile)),
  auditsFile: path.basename(auditsFile),
  auditsSha256: stableHash(fs.readFileSync(auditsFile)),
  promptVersions: {
    grouping: "access-homogeneous-title-grouping-2026-08-28-v1",
    audit: "access-homogeneous-title-grouping-audit-2026-08-28-v1",
    validator: "homogeneous-title-grouping-validator-2026-08-28-v1",
  },
  promptSha256: {
    grouping: stableHash(groupingPromptTemplate),
    audit: stableHash(groupingAuditPromptTemplate),
    validator: stableHash(groupingValidationRules),
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
  `PASS: validated ${validated.length} audited title-grouping cases\n${outputFile}\n`,
);
