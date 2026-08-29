#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import {
  stableHash,
  validateWordNetAssessment,
  wordNetAlignmentAuditPromptTemplate,
  wordNetAlignmentPromptTemplate,
  wordNetAlignmentValidationRules,
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
const render = (template, bundle) =>
  String(template).replaceAll("[GROUP TITLE]", bundle.groupTitle);

const oneMatchingRule = (rules, bundle, label) => {
  const matches = rules.filter(
    (rule) =>
      rule.leadingAction === bundle.leadingAction &&
      (!rule.groupTitles || rule.groupTitles.includes(bundle.groupTitle)),
  );
  if (matches.length !== 1) {
    throw new Error(
      `${bundle.groupTitle} matched ${matches.length} ${label} rules; expected exactly one`,
    );
  }
  return matches[0];
};

const args = parseArgs();
const bundlesFile = required(args.bundles, "--bundles");
const decisionsFile = required(args.decisions, "--decisions");
const auditsFile = required(args.audits, "--audits");
const outputFile = required(args.out, "--out");

const bundlePacket = readJson(bundlesFile);
const decisionPacket = readJson(decisionsFile);
const auditPacket = readJson(auditsFile);
for (const packet of [decisionPacket, auditPacket]) {
  if (packet.sourceSha256 !== bundlePacket.sourceSha256) {
    throw new Error(
      "WordNet assessment inputs use different source hierarchies",
    );
  }
}

const assessments = bundlePacket.bundles.map((bundle) => {
  const decisionRule = oneMatchingRule(
    decisionPacket.rules,
    bundle,
    "decision",
  );
  const auditRule = oneMatchingRule(auditPacket.rules, bundle, "audit");
  return validateWordNetAssessment({
    bundle,
    assessment: {
      groupId: bundle.groupId,
      decision: decisionRule.decision,
      selectedSynsetIds: decisionRule.selectedSynsetIds,
      reason: render(decisionRule.reason, bundle),
      confidence: decisionRule.confidence,
      audit: {
        verdict: auditRule.verdict,
        confidence: auditRule.confidence,
        reason: render(auditRule.reason, bundle),
        checks: {
          ...(auditPacket.defaultChecks || {}),
          ...(auditRule.checks || {}),
        },
      },
    },
  });
});

const output = {
  schemaVersion: "wordnet-alignment-assessments-validated-v1",
  generatedAt: new Date().toISOString(),
  sourceSha256: bundlePacket.sourceSha256,
  bundlesFile: path.basename(bundlesFile),
  bundlesSha256: stableHash(fs.readFileSync(bundlesFile)),
  decisionsFile: path.basename(decisionsFile),
  decisionsSha256: stableHash(fs.readFileSync(decisionsFile)),
  auditsFile: path.basename(auditsFile),
  auditsSha256: stableHash(fs.readFileSync(auditsFile)),
  promptVersions: {
    alignment: "access-wordnet-alignment-2026-08-28-v1",
    audit: "access-wordnet-alignment-audit-2026-08-28-v1",
    validator: "wordnet-alignment-validator-2026-08-28-v1",
  },
  promptSha256: {
    alignment: stableHash(wordNetAlignmentPromptTemplate),
    audit: stableHash(wordNetAlignmentAuditPromptTemplate),
    validator: stableHash(wordNetAlignmentValidationRules),
  },
  counts: {
    groups: assessments.length,
    keepAssigned: assessments.filter(
      (item) => item.decision === "keep-assigned",
    ).length,
    replace: assessments.filter((item) => item.decision === "replace").length,
    noSuitableSynset: assessments.filter(
      (item) => item.decision === "no-suitable-synset",
    ).length,
    uncertain: assessments.filter((item) => item.decision === "uncertain")
      .length,
  },
  assessments,
};

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");
process.stdout.write(
  `PASS: validated ${assessments.length} audited WordNet assessments\n${outputFile}\n`,
);
