import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  AUDIT_POLICY_RULE_IDS,
  AUDIT_POLICY_RULES,
  AUDIT_POLICY_VERSION,
  CRITIC_GROUPING_GUIDANCE,
  detectRedundantCollectionPolicy,
  renderAuditPolicy,
} from "./audit-policy.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  fs.readFileSync(
    path.join(
      scriptDir,
      "fixtures",
      "rob-sell-policy-regressions-2026-07-28.json",
    ),
    "utf8",
  ),
);

test("policy version and rule IDs are unique", () => {
  assert.equal(AUDIT_POLICY_VERSION, "ontology-audit-policy-v3");
  assert.equal(
    new Set(AUDIT_POLICY_RULE_IDS).size,
    AUDIT_POLICY_RULE_IDS.length,
  );
  assert.ok(AUDIT_POLICY_RULES.every((rule) => rule.text.trim().length > 80));
});

test("every Rob Sell regression is covered by production policy rules", () => {
  const known = new Set(AUDIT_POLICY_RULE_IDS);
  assert.equal(fixture.cases.length, 13);
  for (const regression of fixture.cases) {
    assert.ok(regression.expectedIssue);
    assert.ok(regression.expectedOutcome);
    assert.ok(regression.requiredRuleIds.length > 0);
    for (const ruleId of regression.requiredRuleIds) {
      assert.ok(known.has(ruleId), `${regression.id} references ${ruleId}`);
    }
  }
});

test("production prompt is branch-independent and does not leak Sell answers", () => {
  const prompt = renderAuditPolicy("Buy");
  for (const ruleId of AUDIT_POLICY_RULE_IDS) {
    assert.match(prompt, new RegExp(`\\[${ruleId}\\]`));
  }
  for (const leakedExample of [
    "Sell Funeral Products",
    "Sell flower",
    "Sell food specialties",
    "Gambling Chips",
    "Admission pass",
    "Postal Products",
  ]) {
    assert.doesNotMatch(prompt, new RegExp(leakedExample, "i"));
  }
});

test("critic permits evidence-supported two-member groups", () => {
  assert.match(CRITIC_GROUPING_GUIDANCE, /at least two members/i);
  assert.match(CRITIC_GROUPING_GUIDANCE, /must not be rejected solely/i);
  assert.match(CRITIC_GROUPING_GUIDANCE, /aesthetic/i);
});

test("redundant miscellaneous structure becomes an explicit policy proposal", () => {
  const policy = detectRedundantCollectionPolicy({
    branch: "Sell",
    children: [
      { collectionName: "main", title: "Sell Products" },
      { collectionName: "Sell -- miscellaneous", title: "Sell (Other)" },
      { collectionName: "Sell what?", title: "Sell information" },
      { collectionName: "Sell what?", title: "Sell service" },
      { collectionName: "Sell what?", title: "Sell physical objects" },
    ],
  });
  assert.deepEqual(policy, {
    proposedCollectionName: "Sell what?",
    proposedBranchTitles: [
      "Sell information",
      "Sell physical objects",
      "Sell service",
    ],
    retiredCollectionNames: ["Sell -- miscellaneous"],
    retiredPlaceholderTitles: ["Sell (Other)"],
  });
  assert.equal(
    detectRedundantCollectionPolicy({
      branch: "Buy",
      children: [
        { collectionName: "What?", title: "Buy services" },
        { collectionName: "What?", title: "Buy physical objects" },
      ],
    }),
    null,
  );
});
