import {
  SomAgentKind,
  SomAgentTrace,
  SomAgentTraceRole,
  SomAgentTraceStage,
  SomIssueType,
} from "../../types/ISomReview";
import {
  HISTORICAL_DETERMINISTIC_RULES_BY_ACTOR,
  HISTORICAL_EXPERT_INSTRUCTIONS_BY_ACTOR,
  HISTORICAL_MODEL_PROMPTS_BY_ACTOR,
  HISTORICAL_MODEL_PROMPTS_BY_KEY,
} from "./historicalAgentPrompts";

const clean = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const ISSUE_TITLES: Record<SomIssueType, string> = {
  "cross-branch-recall": "a missing activity from another branch",
  "evidence-specialization": "an evidence-grounded specialization",
  "title-clarity": "an unclear activity title",
  "synset-alignment": "a possibly misaligned WordNet verb sense",
  "synonym-enrichment": "a missing synonym",
  "description-enrichment": "a missing or weak description",
  "misc-facet-duplicate": "an overlapping facet entry",
  "mistaken-synonym": "an incorrect synonym",
  "duplicate-synonym": "duplicate activity nodes",
  polysemy: "multiple meanings combined in one node",
  "flat-list-grouping": "an overly flat sibling list",
  "compound-object-grouping": "a compound-object grouping opportunity",
  "collection-design": "a collection-design opportunity",
  placement: "an incorrect semantic placement",
  "wrong-verb": "an activity using the wrong leading verb",
  "node-merge": "nodes that should be merged",
  relocation: "an activity that should be relocated",
  "sense-relocation": "an activity sense that should be relocated",
  "missing-activity": "a missing activity",
  "redundant-node": "a redundant wrapper node",
  "empty-node": "an empty semantic node",
  "empty-collection": "an empty collection",
};

const MODEL_ACTORS = new Set([
  "D7",
  "D8",
  "D9",
  "D10+J7",
  "D11",
  "D12",
  "H1",
  "H2",
  "H3",
  "H6",
  "H7",
  "J1",
  "J2",
  "J3",
  "J4+J5",
  "J7",
  "W16+J7",
  "access-gpt-5.6-sol-two-pass-audit",
  "access-homogeneous-title-grouping-v1",
  "access-homogeneous-title-grouping-auditor-v1",
  "access-homogeneous-title-grouping-v2",
  "access-homogeneous-title-grouping-v3",
  "access-homogeneous-title-grouping-v4",
  "access-homogeneous-title-grouping-v5",
  "access-wordnet-alignment-v1",
  "access-wordnet-alignment-auditor-v1",
  "access-wordnet-assigned-synset-check-v2",
  "access-wordnet-conditional-selection-v2",
  "access-wordnet-all-candidate-v3",
  "cloudbank-evidence-topology-proposer-v1",
  "cloudbank-ontology-title-clarity-proposer-v1",
  "cloudbank-blind-title-clarity-critic-v1",
  "cloudbank-adversarial-title-clarity-auditor-v1",
  "cloudbank-object-coverage-proposer-v1",
  "cloudbank-object-coverage-critic-v2",
  "cloudbank-object-identity-resolver-v1",
  "cloudbank-object-identity-critic-v1",
  "cloudbank-object-identity-resolver-v2",
  "cloudbank-object-identity-critic-v2",
  "cloudbank-synonym-collision-critic-v1",
  "cloudbank-object-topology-proposer-v3",
  "cloudbank-object-topology-critic-v3",
  "cloudbank-generic-placement-proposer-v2",
  "cloudbank-final-readiness-critic-v1",
  "cloudbank-evidence-topology-critic-v1",
  "content-verification-specialist",
  "evidence-bound-specialization-generator",
  "evidence-convergence-scan",
  "identity-agent",
  "independent-critic",
  "placement-boundary-agent",
  "semantic-direction-or-evidence-specialization-judge",
  "structure-agent",
  "title-evidence-agent",
  "whole-ontology-semantic-one-step-move",
  "whole-ontology-semantic-retrieval",
]);

const DETERMINISTIC_ACTORS = new Set([
  "C6",
  "W16",
  "composition-followup-card-builder-v1",
  "composition-followup-plan-builder-v1",
  "canonical-node-reuse-proposer-v1",
  "exhaustive-onet-cue-recall-v2",
  "seller-side-evidence-recall-v2",
  "final-readiness-card-assembler-v1",
  "identity-correction-card-assembler-v1",
  "ontology-title-clarity-card-assembler-v1",
  "ontology-title-clarity-risk-screen-v1",
  "ontology-title-clarity-safety-gate-v1",
  "homogeneous-title-grouping-validator-v1",
  "homogeneous-title-testbed-card-assembler-v1",
  "homogeneous-title-grouping-validator-v2",
  "homogeneous-title-testbed-card-assembler-v2",
  "homogeneous-title-grouping-validator-v3",
  "homogeneous-title-testbed-card-assembler-v3",
  "homogeneous-title-grouping-validator-v4",
  "homogeneous-title-testbed-card-assembler-v4",
  "homogeneous-title-grouping-validator-v5",
  "homogeneous-title-testbed-card-assembler-v5",
  "local-wordnet-candidate-retrieval-v1",
  "local-wordnet-conditional-retrieval-v2",
  "wordnet-alignment-validator-v1",
  "wordnet-testbed-card-assembler-v1",
  "description-gap-scan",
  "description-synonym-parser",
  "deterministic-collection-policy-scan",
  "deterministic-empty-semantic-node-scan",
  "deterministic-facet-overlap-scan",
  "deterministic-facet-overlap-scan-exact-action",
  "deterministic-overlap-scan",
  "deterministic-policy-gates-v4",
  "deterministic-post-semantic-regeneration",
  "evidence-parent-contract-audit",
  "flat-list-coverage-control",
  "identity-agent-exact-action",
  "onet-generic-object-specialization",
  "placement-boundary-agent-exact-action",
  "proposal-card-assembler-v1",
  "review-composition-readiness-v1",
  "recorded-synonym-collision-scan-v1",
  "rob-audit-deterministic-projection",
  "rob-outline-identity-exact-action",
  "rob-outline-identity-followup",
  "rob-outline-placement-exact-action",
  "rob-outline-placement-followup",
  "single-child-wrapper-policy-check",
  "snapshot-action-audit",
  "snapshot-bound-followup-audit",
]);

const HUMAN_DERIVED_ACTORS = new Set([
  "Rob-task-5",
  "Rob-task-6",
  "Rob-task-7",
  "Rob-task-10",
  "Rob-task-13",
  "expert-correction-projection",
  "human-audit",
]);

const PLACEHOLDER_ACTORS = new Set([
  "no-issue-detector-recorded",
  "no-separate-proposer-recorded",
  "no-separate-evaluator-recorded",
  "no-proposal-assembler-recorded",
  "unrecognized-recorded-component",
]);

const KNOWN_ACTORS = new Set([
  ...MODEL_ACTORS,
  ...DETERMINISTIC_ACTORS,
  ...HUMAN_DERIVED_ACTORS,
  ...PLACEHOLDER_ACTORS,
]);

const TRUSTED_ACTOR_VERSIONS: Record<string, ReadonlySet<string>> = {
  D7: new Set(["wave-25-d7-sibling-cohesion-collections-2026-06"]),
  D9: new Set(["wave-17-d9-gap-scanner-2026-05"]),
  D11: new Set(["wave-28-d11-misplacement-scanner-2026-07-13"]),
  D12: new Set([
    "wave-28-d12-title-clarifier-2026-07-13",
    "wave-31-d12-expert-calibrated-title-and-sense-2026-07-22",
  ]),
  J1: new Set(["h1-three-top-categories-2026-06"]),
  J2: new Set(["wave-25-h2-collection-or-intermediate-2026-06"]),
  "J4+J5": new Set(["wave-18-h4+wave-17-h5-2026-05"]),
  J7: new Set(["wave-25-h7-verb-doctrine-gate-2026-07-13"]),
  "access-gpt-5.6-sol-two-pass-audit": new Set([
    "sell-composition-followup-v1",
  ]),
  "access-homogeneous-title-grouping-v1": new Set([
    "access-homogeneous-title-grouping-2026-08-28-v1",
  ]),
  "access-homogeneous-title-grouping-auditor-v1": new Set([
    "access-homogeneous-title-grouping-audit-2026-08-28-v1",
  ]),
  "access-homogeneous-title-grouping-v2": new Set([
    "access-homogeneous-title-grouping-2026-08-29-v2",
  ]),
  "access-homogeneous-title-grouping-v3": new Set([
    "access-homogeneous-title-grouping-2026-08-29-v3",
  ]),
  "access-homogeneous-title-grouping-v4": new Set([
    "access-homogeneous-title-grouping-2026-08-29-v4",
  ]),
  "access-homogeneous-title-grouping-v5": new Set([
    "access-homogeneous-title-grouping-2026-08-30-v5",
  ]),
  "access-wordnet-alignment-v1": new Set([
    "access-wordnet-alignment-2026-08-28-v1",
  ]),
  "access-wordnet-alignment-auditor-v1": new Set([
    "access-wordnet-alignment-audit-2026-08-28-v1",
  ]),
  "access-wordnet-assigned-synset-check-v2": new Set([
    "access-wordnet-assigned-synset-check-2026-08-29-v2",
  ]),
  "access-wordnet-conditional-selection-v2": new Set([
    "access-wordnet-conditional-selection-2026-08-29-v2",
  ]),
  "access-wordnet-all-candidate-v3": new Set([
    "access-wordnet-all-candidate-2026-08-29-v3",
  ]),
  "homogeneous-title-grouping-validator-v1": new Set([
    "homogeneous-title-grouping-validator-2026-08-28-v1",
  ]),
  "homogeneous-title-testbed-card-assembler-v1": new Set([
    "homogeneous-title-testbed-card-assembler-2026-08-28-v1",
  ]),
  "homogeneous-title-grouping-validator-v2": new Set([
    "homogeneous-title-grouping-validator-2026-08-29-v2",
  ]),
  "homogeneous-title-testbed-card-assembler-v2": new Set([
    "homogeneous-title-testbed-card-assembler-2026-08-29-v2",
  ]),
  "homogeneous-title-grouping-validator-v3": new Set([
    "homogeneous-title-grouping-validator-2026-08-29-v3",
  ]),
  "homogeneous-title-testbed-card-assembler-v3": new Set([
    "homogeneous-title-testbed-card-assembler-2026-08-29-v3",
  ]),
  "homogeneous-title-grouping-validator-v4": new Set([
    "homogeneous-title-grouping-validator-2026-08-29-v4",
  ]),
  "homogeneous-title-testbed-card-assembler-v4": new Set([
    "homogeneous-title-testbed-card-assembler-2026-08-29-v4",
  ]),
  "homogeneous-title-grouping-validator-v5": new Set([
    "homogeneous-title-grouping-validator-2026-08-30-v5",
  ]),
  "homogeneous-title-testbed-card-assembler-v5": new Set([
    "homogeneous-title-testbed-card-assembler-2026-08-30-v5",
  ]),
  "local-wordnet-candidate-retrieval-v1": new Set([
    "local-wordnet-candidate-retrieval-2026-08-28-v1",
  ]),
  "local-wordnet-conditional-retrieval-v2": new Set([
    "local-wordnet-conditional-retrieval-2026-08-29-v2",
  ]),
  "wordnet-alignment-validator-v1": new Set([
    "wordnet-alignment-validator-2026-08-28-v1",
  ]),
  "wordnet-testbed-card-assembler-v1": new Set([
    "wordnet-testbed-card-assembler-2026-08-28-v1",
  ]),
  "composition-followup-card-builder-v1": new Set([
    "sell-composition-followup-v1",
  ]),
  "composition-followup-plan-builder-v1": new Set([
    "sell-composition-followup-v1",
  ]),
  "exhaustive-onet-cue-recall-v2": new Set(["exhaustive-onet-cue-recall-v2"]),
  "seller-side-evidence-recall-v2": new Set(["seller-side-evidence-recall-v2"]),
  "cloudbank-evidence-topology-proposer-v1": new Set([
    "cloudbank-evidence-topology-proposer-v1",
  ]),
  "cloudbank-ontology-title-clarity-proposer-v1": new Set([
    "cloudbank-ontology-title-clarity-proposer-v1",
  ]),
  "cloudbank-blind-title-clarity-critic-v1": new Set([
    "cloudbank-blind-title-clarity-critic-v1",
  ]),
  "cloudbank-adversarial-title-clarity-auditor-v1": new Set([
    "cloudbank-adversarial-title-clarity-auditor-v1",
  ]),
  "cloudbank-object-coverage-proposer-v1": new Set([
    "cloudbank-object-coverage-proposer-v1",
  ]),
  "cloudbank-object-coverage-critic-v2": new Set([
    "cloudbank-object-coverage-critic-v2",
  ]),
  "cloudbank-object-identity-resolver-v1": new Set([
    "cloudbank-object-identity-resolver-v1",
  ]),
  "cloudbank-object-identity-critic-v1": new Set([
    "cloudbank-object-identity-critic-v1",
  ]),
  "cloudbank-object-identity-resolver-v2": new Set([
    "cloudbank-object-identity-resolver-v2",
  ]),
  "cloudbank-object-identity-critic-v2": new Set([
    "cloudbank-object-identity-critic-v2",
  ]),
  "cloudbank-synonym-collision-critic-v1": new Set([
    "cloudbank-synonym-collision-critic-v1",
  ]),
  "canonical-node-reuse-proposer-v1": new Set([
    "canonical-node-reuse-proposer-v1",
  ]),
  "cloudbank-object-topology-proposer-v3": new Set([
    "cloudbank-object-topology-proposer-v3",
  ]),
  "cloudbank-object-topology-critic-v3": new Set([
    "cloudbank-object-topology-critic-v3",
  ]),
  "cloudbank-generic-placement-proposer-v2": new Set([
    "cloudbank-generic-placement-proposer-v2",
  ]),
  "cloudbank-final-readiness-critic-v1": new Set([
    "cloudbank-final-readiness-critic-v1",
  ]),
  "cloudbank-evidence-topology-critic-v1": new Set([
    "cloudbank-evidence-topology-critic-v1",
  ]),
  "final-readiness-card-assembler-v1": new Set([
    "final-readiness-card-assembler-v1",
  ]),
  "identity-correction-card-assembler-v1": new Set([
    "identity-correction-card-assembler-v1",
  ]),
  "ontology-title-clarity-card-assembler-v1": new Set([
    "ontology-title-clarity-card-assembler-v1",
  ]),
  "ontology-title-clarity-risk-screen-v1": new Set([
    "ontology-title-clarity-risk-screen-v1",
  ]),
  "ontology-title-clarity-safety-gate-v1": new Set([
    "ontology-title-clarity-safety-gate-v1",
  ]),
  "recorded-synonym-collision-scan-v1": new Set([
    "recorded-synonym-collision-scan-v1",
  ]),
  "content-verification-specialist": new Set(["ontology-content-verifier-v5"]),
  "deterministic-collection-policy-scan": new Set(["ontology-audit-policy-v3"]),
  "deterministic-empty-semantic-node-scan": new Set([
    "sell-semantic-coverage-v1",
  ]),
  "deterministic-facet-overlap-scan": new Set([
    "buy-transfer-v1",
    "buy-transfer-v2",
  ]),
  "deterministic-facet-overlap-scan-exact-action": new Set([
    "buy-transfer-v1",
    "buy-transfer-v2",
  ]),
  "deterministic-policy-gates-v4": new Set(["sell-audit-followup-v1"]),
  "deterministic-post-semantic-regeneration": new Set([
    "sell-semantic-followup-v1",
  ]),
  "evidence-convergence-scan": new Set(["sell-comprehensive-audit-2026-07-15"]),
  "evidence-parent-contract-audit": new Set(["ontology-audit-policy-v3"]),
  "flat-list-coverage-control": new Set(["ontology-audit-policy-v3"]),
  "evidence-bound-specialization-generator": new Set([
    "c9f9b5ee63e7c29ed0d8460729dfda77478fee873109fa137d5e35b1abf91264",
  ]),
  "expert-correction-projection": new Set(["rob-legal-rights-followup-v1"]),
  "identity-agent": new Set([
    "ontology-review-v5",
    "buy-transfer-v1",
    "buy-transfer-v2",
  ]),
  "identity-agent-exact-action": new Set([
    "buy-transfer-v1",
    "buy-transfer-v2",
  ]),
  "independent-critic": new Set([
    "ontology-review-v5",
    "buy-transfer-v1",
    "buy-transfer-v2",
  ]),
  "onet-generic-object-specialization": new Set(["sell-semantic-coverage-v1"]),
  "placement-boundary-agent": new Set([
    "ontology-review-v5",
    "buy-transfer-v1",
    "buy-transfer-v2",
  ]),
  "placement-boundary-agent-exact-action": new Set([
    "buy-transfer-v1",
    "buy-transfer-v2",
  ]),
  "proposal-card-assembler-v1": new Set(["reviewer-proposal-contract-v1"]),
  "review-composition-readiness-v1": new Set([
    "review-composition-readiness-v1",
  ]),
  "rob-audit-deterministic-projection": new Set(["sell-audit-followup-v1"]),
  "rob-outline-identity-exact-action": new Set(["ontology-audit-policy-v3"]),
  "rob-outline-identity-followup": new Set(["ontology-audit-policy-v3"]),
  "rob-outline-placement-exact-action": new Set(["ontology-audit-policy-v3"]),
  "rob-outline-placement-followup": new Set(["ontology-audit-policy-v3"]),
  "semantic-direction-or-evidence-specialization-judge": new Set([
    "sell-semantic-coverage-v1",
  ]),
  "snapshot-bound-followup-audit": new Set(["ontology-audit-policy-v3"]),
  "single-child-wrapper-policy-check": new Set(["ontology-audit-policy-v3"]),
  "structure-agent": new Set([
    "ontology-review-v5",
    "buy-transfer-v1",
    "buy-transfer-v2",
  ]),
  "title-evidence-agent": new Set([
    "ontology-review-v5",
    "buy-transfer-v1",
    "buy-transfer-v2",
  ]),
  "whole-ontology-semantic-one-step-move": new Set([
    "sell-semantic-coverage-v1",
  ]),
};

const ACTOR_NAMES: Record<string, string> = {
  C6: "Deterministic relocation safety critic",
  "composition-followup-card-builder-v1": "Composition follow-up card builder",
  "composition-followup-plan-builder-v1":
    "Expert-decision implementation builder",
  "exhaustive-onet-cue-recall-v2": "Exhaustive O*NET example-cue scan",
  "seller-side-evidence-recall-v2": "Seller-side O*NET evidence scan",
  "cloudbank-evidence-topology-proposer-v1": "Evidence and topology proposer",
  "cloudbank-ontology-title-clarity-proposer-v1":
    "Evidence-grounded title proposer",
  "cloudbank-blind-title-clarity-critic-v1": "Blinded title comparison critic",
  "cloudbank-adversarial-title-clarity-auditor-v1": "Adversarial title auditor",
  "cloudbank-object-coverage-proposer-v1": "Seller-object coverage proposer",
  "cloudbank-object-coverage-critic-v2": "Seller-object coverage critic",
  "cloudbank-object-identity-resolver-v1": "Activity identity resolver",
  "cloudbank-object-identity-critic-v1": "Activity identity critic",
  "cloudbank-object-identity-resolver-v2":
    "Alias-aware activity identity resolver",
  "cloudbank-object-identity-critic-v2": "Alias-aware activity identity critic",
  "cloudbank-synonym-collision-critic-v1": "Recorded-synonym correction critic",
  "canonical-node-reuse-proposer-v1": "Canonical-node reuse proposer",
  "cloudbank-object-topology-proposer-v3": "Activity parent selector",
  "cloudbank-object-topology-critic-v3": "Activity parent critic",
  "cloudbank-generic-placement-proposer-v2":
    "Generic evidence placement proposer",
  "cloudbank-final-readiness-critic-v1": "Evidence completeness critic",
  "cloudbank-evidence-topology-critic-v1": "Evidence topology critic",
  "final-readiness-card-assembler-v1": "Final-readiness card assembler",
  "identity-correction-card-assembler-v1": "Identity-correction card assembler",
  "ontology-title-clarity-card-assembler-v1": "Title-review card assembler",
  "ontology-title-clarity-risk-screen-v1": "Whole-ontology title-risk screen",
  "ontology-title-clarity-safety-gate-v1": "Title-change safety gate",
  "homogeneous-title-grouping-validator-v1": "Homogeneous grouping validator",
  "homogeneous-title-testbed-card-assembler-v1":
    "Homogeneous title-review card assembler",
  "homogeneous-title-grouping-validator-v2": "One-record-one-group validator",
  "homogeneous-title-testbed-card-assembler-v2":
    "Streamlined title-review card assembler",
  "homogeneous-title-grouping-validator-v3": "Predicate-object claim validator",
  "homogeneous-title-testbed-card-assembler-v3":
    "Claim-aware title-review card assembler",
  "homogeneous-title-grouping-validator-v4":
    "Expert-regression claim validator",
  "homogeneous-title-testbed-card-assembler-v4":
    "Expert-regression title-review card assembler",
  "homogeneous-title-grouping-validator-v5": "Reader-ready claim validator",
  "homogeneous-title-testbed-card-assembler-v5":
    "Reader-ready title-review card assembler",
  "local-wordnet-candidate-retrieval-v1": "Local WordNet candidate retrieval",
  "local-wordnet-conditional-retrieval-v2":
    "Conditional local WordNet retrieval",
  "wordnet-alignment-validator-v1": "WordNet alignment validator",
  "wordnet-testbed-card-assembler-v1": "WordNet review card assembler",
  D7: "Sibling-cohesion scanner",
  D8: "Duplicate and identity scanner",
  D9: "Coverage-gap scanner",
  "D10+J7": "Verb and doctrine audit",
  D11: "Parent-placement scanner",
  D12: "Title clarifier",
  J1: "Top-level category judge",
  J2: "Activity-distinction judge",
  J3: "Canonical-title judge",
  "J4+J5": "Novelty and distinction judges",
  J7: "Verb-doctrine judge",
  W16: "Deterministic snapshot-bound relocation proposer",
  "W16+J7": "Polysemy relocation proposer",
  "access-gpt-5.6-sol-two-pass-audit": "Two-pass issue and solution auditor",
  "access-homogeneous-title-grouping-v1": "Homogeneous title-grouping agent",
  "access-homogeneous-title-grouping-auditor-v1":
    "Independent title-grouping auditor",
  "access-homogeneous-title-grouping-v2":
    "Streamlined homogeneous title-grouping agent",
  "access-homogeneous-title-grouping-v3":
    "Claim-aware homogeneous title-grouping agent",
  "access-homogeneous-title-grouping-v4":
    "Expert-calibrated claim-aware title-grouping agent",
  "access-homogeneous-title-grouping-v5":
    "Reader-ready homogeneous title-grouping agent",
  "access-wordnet-alignment-v1": "WordNet alignment agent",
  "access-wordnet-alignment-auditor-v1":
    "Independent WordNet alignment auditor",
  "access-wordnet-assigned-synset-check-v2": "Assigned-synset fit checker",
  "access-wordnet-conditional-selection-v2":
    "Conditional WordNet sense selector",
  "access-wordnet-all-candidate-v3": "All-candidate WordNet sense selector",
  "content-verification-specialist": "Content verification specialist",
  "description-gap-scan": "Evidence-grounded description scanner",
  "description-synonym-parser": "Description synonym parser",
  "deterministic-collection-policy-scan": "Collection policy scanner",
  "deterministic-empty-semantic-node-scan": "Empty semantic-node scanner",
  "deterministic-facet-overlap-scan": "Facet overlap scanner",
  "deterministic-facet-overlap-scan-exact-action":
    "Facet-overlap action builder",
  "deterministic-overlap-scan": "Sibling overlap scanner",
  "deterministic-policy-gates-v4": "Deterministic policy gates",
  "deterministic-post-semantic-regeneration": "Post-review regeneration checks",
  "evidence-bound-specialization-generator":
    "Evidence-bound specialization generator",
  "evidence-convergence-scan": "Shared-evidence grouping auditor",
  "evidence-parent-contract-audit": "Evidence-parent contract audit",
  "expert-correction-projection": "Expert correction projector",
  "flat-list-coverage-control": "Flat-list coverage control",
  "identity-agent": "Identity and synonym agent",
  "identity-agent-exact-action": "Identity action builder",
  "independent-critic": "Independent model critic",
  "human-audit": "Human evidence audit",
  "onet-generic-object-specialization": "Explicit O*NET modifier scanner",
  "placement-boundary-agent": "Placement and branch-boundary agent",
  "placement-boundary-agent-exact-action": "Placement action builder",
  "proposal-card-assembler-v1": "Snapshot-bound proposal assembler",
  "review-composition-readiness-v1": "Review-composition readiness checks",
  "recorded-synonym-collision-scan-v1": "Recorded-synonym collision scan",
  "rob-audit-deterministic-projection": "Expert-decision projector",
  "rob-outline-identity-exact-action": "Identity follow-up action builder",
  "rob-outline-identity-followup": "Identity follow-up projector",
  "rob-outline-placement-exact-action": "Placement follow-up action builder",
  "rob-outline-placement-followup": "Placement follow-up projector",
  "semantic-direction-or-evidence-specialization-judge":
    "Semantic direction and evidence judge",
  "single-child-wrapper-policy-check": "Single-child wrapper policy check",
  "snapshot-action-audit": "Snapshot action audit",
  "snapshot-bound-followup-audit": "Snapshot-bound follow-up audit",
  "structure-agent": "Grouping and collection agent",
  "title-evidence-agent": "Title-evidence agent",
  "whole-ontology-semantic-one-step-move": "Whole-ontology placement agent",
  "whole-ontology-semantic-retrieval": "Whole-ontology branch-recall agent",
  "Rob-task-5": "Rob task 5 decision",
  "Rob-task-6": "Rob task 6 decision",
  "Rob-task-7": "Rob task 7 decision",
  "Rob-task-10": "Rob task 10 collection proposal",
  "Rob-task-13": "Rob task 13 relocation decision",
};

const KIND_LABELS: Record<SomAgentKind, string> = {
  model: "Model agent",
  deterministic: "Deterministic step",
  "human-derived": "Expert-derived step",
  "recorded-component": "Recorded pipeline component",
};

const humanizeId = (value: string): string =>
  value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const actorKind = (actorId: string, recordedKind: unknown): SomAgentKind => {
  if (MODEL_ACTORS.has(actorId)) return "model";
  if (DETERMINISTIC_ACTORS.has(actorId)) return "deterministic";
  if (HUMAN_DERIVED_ACTORS.has(actorId)) return "human-derived";
  void recordedKind;
  return "recorded-component";
};

const actorIdentity = ({
  actorId,
  recordedKind,
}: {
  actorId: string;
  actorName?: unknown;
  recordedKind?: unknown;
}) => {
  const recordedId = clean(actorId);
  const id = KNOWN_ACTORS.has(recordedId)
    ? recordedId
    : recordedId
      ? "unrecognized-recorded-component"
      : "no-issue-detector-recorded";
  const identitySource =
    id === "unrecognized-recorded-component"
      ? "unrecognized"
      : PLACEHOLDER_ACTORS.has(id)
        ? "missing"
        : "recorded";
  const kind = actorKind(id, recordedKind);
  return {
    id,
    name: ACTOR_NAMES[id] || humanizeId(id),
    kind,
    kindLabel: KIND_LABELS[kind],
    identitySource,
  };
};

type PromptDisclosure = Pick<
  SomAgentTraceStage,
  "promptLabel" | "prompt" | "promptDisclosureNote"
>;

const unavailableDisclosure = (
  roleLabel: string,
  actor: Pick<ReturnType<typeof actorIdentity>, "name" | "identitySource">,
): PromptDisclosure => {
  if (actor.identitySource === "missing") {
    return {
      promptLabel: "Prompt unavailable",
      prompt: `This proposal record does not identify the component responsible for ${roleLabel.toLowerCase()} or preserve its prompt or rule text. The interface does not infer or invent the missing lineage.`,
      promptDisclosureNote:
        "This row is an explicit missing-lineage placeholder; it is not an agent named by the proposal record.",
    };
  }
  if (actor.identitySource === "unrecognized") {
    return {
      promptLabel: "Prompt unavailable",
      prompt: `This proposal record contains an unrecognized component identity for ${roleLabel.toLowerCase()}. The interface withholds that untrusted value and does not infer a prompt or rule set.`,
      promptDisclosureNote:
        "The recorded identity is outside the approved component registry and is not rendered.",
    };
  }
  return {
    promptLabel: "Prompt unavailable",
    prompt: `The record identifies ${actor.name} as the component responsible for ${roleLabel.toLowerCase()}, but it did not preserve that component's prompt or rule text. The interface does not reconstruct or invent historical instructions.`,
    promptDisclosureNote:
      "The actor and version come from the proposal record; the original instructions are unavailable.",
  };
};

const exactArchivedPrompt = (prompt: string): PromptDisclosure => ({
  promptLabel: "Prompt template",
  prompt,
  promptDisclosureNote:
    "This is the exact archived runtime prompt. Its SHA-256 is the version shown below.",
});

const modelPromptTemplate = (prompt: string): PromptDisclosure => ({
  promptLabel: "Prompt template",
  prompt,
  promptDisclosureNote:
    "This concise template preserves the agent's recorded decision rules. Runtime ontology records and prior-pass outputs are omitted.",
});

const sourceBackedPromptTemplate = (
  prompt: string,
  exactArchivedTemplate = false,
): PromptDisclosure => ({
  promptLabel: "Prompt template",
  prompt,
  promptDisclosureNote: exactArchivedTemplate
    ? "This is the archived source prompt template. Bracketed placeholders replace the runtime ontology title, tasks, and context."
    : "This source-backed template preserves the component's decision question and rules. Bracketed placeholders replace runtime ontology data; historical records did not always preserve the complete rendered prompt.",
});

const decisionRules = (prompt: string): PromptDisclosure => ({
  promptLabel: "Decision rules",
  prompt,
  promptDisclosureNote:
    "This component is deterministic; the text describes the rules enforced by its code path.",
});

const expertInstructions = (prompt: string): PromptDisclosure => ({
  promptLabel: "Expert instructions",
  prompt,
  promptDisclosureNote:
    "This stage records or projects a human expert decision. It did not use a model prompt.",
});

const SPECIALIZATION_GENERATOR_PROMPT = `You audit activity-node
specializations grounded in O*NET evidence. For each supplied task, decide
whether "including" or "such as" directly expands the object being sold.

Rules:
- Preserve the main action. A list of venues, methods, customers, or tools is
  not a list of sold objects.
- An "including" list can refer back to the sold object even when a customer
  or provider phrase appears between that object and the list.
- Infer a stable domain parent only when the examples support it. For example,
  batteries, windshield wiper blades, fan belts, bulbs, and headlamps support
  Automobile Accessories.
- Return concise activity titles beginning with "Sell".
- Every child must correspond to an explicit evidence phrase. Do not invent
  missing examples.
- Insurance types listed after "including" or nested "such as" are child
  specializations of Sell Insurance; do not add the word Policies.

Tasks:
1. [taskId=10725] (O*Net) 10725 - Sell and install accessories, such as batteries, windshield wiper blades, fan belts, bulbs, or headlamps.
2. [taskId=721] (O*Net) 721 - Sell various types of insurance policies to businesses and individuals on behalf of insurance companies, including automobile, fire, life, property, medical and dental insurance, or specialized policies, such as marine, farm/crop, and medical malpractice.
3. [taskId=13028] (O*Net) 13028 - Develop a group of products or accessories, and market them through venues such as boutiques or mail-order catalogs.

Return exactly one assessment for each taskId. For task 10725, use the parent
"Sell Automobile Accessories" and emit one child for each of: batteries,
windshield wiper blades, fan belts, bulbs, and headlamps. For task 721, use the
parent "Sell Insurance", split conjunctions and slashes, and emit one child for
each of: automobile, fire, life, property, medical, dental, marine, farm, crop,
and medical malpractice. For task 13028, return no specializations because
boutiques and mail-order catalogs are marketing venues, not objects being sold.
Use each listed source phrase verbatim in evidencePhrase.`;

const MODEL_PROMPTS: Record<string, string> = {
  "access-homogeneous-title-grouping-v1@access-homogeneous-title-grouping-2026-08-28-v1": `You are reviewing one exact atomic activity from a work-activity ontology. The ontology title was compressed to one leading verb and one direct object from longer O*NET work descriptions. Compression sometimes omitted modifiers needed to distinguish genuinely different activities.

Inputs:
- Exact current atomic title: [CURRENT TITLE]
- Current semantic parent and path: [PARENT AND PATH]
- Every exact O*NET record currently attached to this title, numbered, including any other atomic titles already linked to that exact record: [ALL SOURCE RECORDS AND EXISTING LINKS]
- Exact existing ontology titles that could be reused: [MATCHING EXISTING TITLES]

Task:
Partition the numbered O*NET records into the smallest set of homogeneous activity groups whose titles accurately convey the work. A group is homogeneous only when one stand-alone title covers the same leading action and the relevant direct-object meaning of every record assigned to it at the same useful level of specificity.

Rules:
1. Preserve the exact leading action in this title stage. Defer evidence that primarily expresses another action; WordNet alignment and placement are checked later.
2. Keep the current generic title only for records that genuinely use the object generically. When a modifier makes the object meaningfully more specific, add the smallest evidence-supported modifier to the title.
3. Records that require the same resulting title belong in one group. Never create duplicate nodes for the same proposed title.
4. Reuse an exact existing activity when it has the same action and meaning. Pay particular attention to the other atomic titles already linked to each exact source record: do not manufacture a duplicate activity for a clause that one of those links already captures. Otherwise mark the proposed title as new. A new title is provisionally a child of the current title; final placement is a later operation.
5. Keep products, services, actors, information, and other distinct direct-object types separate. Do not join distinct activities with "and" or "or" merely because one O*NET sentence mentions both.
6. Focus on the clause that instantiates the current action. Do not add audience, venue, method, purpose, or incidental actions unless they define the direct-object activity itself.
7. A source record may support more than one group only when it explicitly contains multiple separable direct-object activities governed by the current action. Every source index must be assigned to at least one group or explicitly deferred.
8. For one source record, keep the current title if it already captures the activity; otherwise propose one clearer title. For multiple records, allow: all remain together; some remain generic while others become specializations; or all move into two or more specific groups.
9. Use concise, natural activity titles. Do not infer facts absent from the supplied O*NET text.
10. Return structured data only: decision keep, rename, split, or defer; groups with title, status current/existing/new, sourceTaskIndexes, and reason; deferredTaskIndexes; one overall reason; and confidence.`,
  "access-homogeneous-title-grouping-auditor-v1@access-homogeneous-title-grouping-audit-2026-08-28-v1": `Independently audit a proposed homogeneous grouping for one atomic activity using the exact current title and all numbered O*NET records.

Reject or correct the proposal if it drops evidence, changes the leading action, uses incidental context as a modifier, combines different direct-object activities, splits records that one accurate title covers, creates duplicate titles, fails to reuse an exact existing activity, or labels a specific record as generic. Confirm that every evidence index is grouped or explicitly deferred and that repeated proposed titles have been consolidated. New nodes are only provisional children of the current title; this pass does not decide final placement.`,
  "access-homogeneous-title-grouping-v2@access-homogeneous-title-grouping-2026-08-29-v2": `You are checking one atomic activity title against every O*NET record linked to it. The title was originally reduced to a leading verb and direct object, so a meaning-defining modifier may have been omitted.

Inputs:
- Current atomic title: [CURRENT TITLE]
- Numbered exact O*NET records. Each record also lists any other atomic titles linked to that same sentence: [NUMBERED O*NET RECORDS]

For each numbered record, consider only the clause represented by the current title's leading verb and direct object. Assign that record exactly once:
- to the current title when the title already describes the activity at a useful level of generality; or
- to one clearer title made by adding only the smallest source-supported modifier needed to distinguish a more specific activity.

Put records requiring the same title in one group. Preserve the current leading verb. Do not divide one O*NET record among multiple groups. Other actions or objects in the sentence are handled by their other linked atomic titles or a later coverage review. Do not evaluate WordNet senses, replace the leading verb, decide final ontology placement, or add audience, method, purpose, venue, or other incidental context. A new title is only a provisional child of the current title until later placement review.

If any record cannot be classified without guessing, defer the whole case. Return structured data only: groups with title, sourceTaskIndexes, and a short evidence-grounded reason; deferredTaskIndexes; one overall reason; and confidence. Do not return a keep/rename/split label or title status; deterministic code derives them.`,
  "access-homogeneous-title-grouping-v3@access-homogeneous-title-grouping-2026-08-29-v3": `You are checking one atomic activity title against every exact O*NET record linked to it. The title was originally reduced to a leading verb and one direct object, so a meaning-defining modifier or an additional direct object may have been omitted.

Inputs:
- Current atomic title: [CURRENT TITLE]
- Canonical action and any action synonyms recorded in that title: [RECORDED ACTION ALIASES]
- Numbered exact O*NET records. Each record also lists every other atomic title already linked to that same sentence: [NUMBERED O*NET RECORDS]

For each record, identify every distinct direct-object claim governed by the current title's action that is not already represented by another linked atomic title. A sentence may supply more than one claim when the same action explicitly governs different objects, such as selling funeral services and selling funeral merchandise. Do not split examples of one stated category, incidental context, or different actions into extra claims.

Group claims that can share one accurate activity title. Use the current title when it is already informative enough; otherwise add only the smallest source-supported modifier needed to identify the activity. Every proposed title must:
- contain 2-5 words;
- preserve the current leading action;
- name exactly one canonical direct object; and
- avoid audience, method, purpose, venue, or other incidental context.

Consolidate claims requiring the same title. A new title is provisional until a later placement review. Do not evaluate WordNet, change the action, or decide final ontology placement. If the evidence cannot be classified without guessing, defer the whole case.

Return structured data only: groups with title, canonicalDirectObject, sourceClaims, and a short reason. Each sourceClaim must contain sourceTaskIndex, a concise directObject phrase copied from the record, and an exact evidenceQuote copied from the record that includes the canonical action or one recorded action synonym. Also return deferredTaskIndexes, one overall reason, and confidence. Do not return title status or a keep/rename/split label; deterministic code derives them.`,
  "access-homogeneous-title-grouping-v4@access-homogeneous-title-grouping-2026-08-29-v4": `You are checking one atomic activity title against every exact O*NET record linked to it. The title was originally reduced to a leading verb and one direct object, so a meaning-defining modifier or an additional direct object may have been omitted.

Inputs:
- Current atomic title: [CURRENT TITLE]
- Canonical action and any action synonyms recorded in that title: [RECORDED ACTION ALIASES]
- Numbered exact O*NET records. Each record also lists every other atomic title already linked to that same sentence: [NUMBERED O*NET RECORDS]

For each record, identify every distinct direct-object claim governed by the current title's action that is not already represented by another linked atomic title. Read the complete clause: a meaning-defining restriction can appear before the object head or after it in a complement or trailing phrase, such as "alternatives for Web architecture or technologies." Carry that restriction into the proposed title when omitting it would make the activity materially broader than the evidence.

A sentence may supply more than one claim when the same action explicitly governs different objects, such as selling funeral services and selling funeral merchandise. Coordinated named subtypes that share a head noun can also require separate claims when the distinction is material, such as storing audio data and storing video data. Do not collapse them merely because they share the word "data." Do not split ordinary examples of one category, incidental audience, method, purpose, or different actions into extra claims.

Group claims that can share one accurate activity title. Use the current title when it is already informative enough; otherwise add only the smallest source-supported modifier needed to identify the activity. Every proposed title must:
- contain 2-5 words;
- preserve the current leading action;
- name exactly one canonical direct object; and
- avoid audience, method, purpose, venue, or other incidental context.

Consolidate claims requiring the same title. A new title is provisional until a later placement review. Do not evaluate WordNet, change the action, or decide final ontology placement. If the evidence cannot be classified without guessing, defer the whole case.

Return structured data only: groups with title, canonicalDirectObject, sourceClaims, and a short reason. Each sourceClaim must contain sourceTaskIndex, a concise directObject phrase copied from the record, and an exact evidenceQuote copied from the record that includes the canonical action or one recorded action synonym. Also return deferredTaskIndexes, one overall reason, and confidence. Do not return title status or a keep/rename/split label; deterministic code derives them.`,
  "access-homogeneous-title-grouping-v5@access-homogeneous-title-grouping-2026-08-30-v5": `We are building an ontology of work activities from O*NET task descriptions. In an earlier step, each activity was given a short verb-object title and linked to the O*NET descriptions that support it. We later found two possible problems: some titles may be too vague for a non-expert reader, and some titles may combine descriptions that differ enough to need separate titles.

Review one current title and all of its linked O*NET descriptions. Decide whether the descriptions can stay together under one clear title or should be divided into groups with different titles.

Inputs:
- Current title: [CURRENT TITLE]
- Main verb and any accepted synonyms recorded in the title: [RECORDED ACTION ALIASES]
- Numbered exact O*NET descriptions: [NUMBERED O*NET RECORDS]

When relevant, a description also lists activities using the same verb or an accepted synonym that are already represented elsewhere. Do not propose work already covered by one of those listed activities.

Instructions:
1. Read each complete description. Focus on the work expressed by the current title's verb (or an accepted synonym) and the thing that verb acts on.
2. Ask whether the current title would be intuitively understandable to a non-expert and accurately describe the essential work in the linked descriptions.
3. Keep descriptions together when one short, accurate title fits them all. Separate them only when they describe materially different things acted on by the same verb.
4. One description may support more than one group only when it explicitly names more than one materially different object for the current verb and those objects are not already represented by the listed same-verb activities.
5. If a title needs clarification, add only the shortest wording supported by the source that identifies the essential kind of object. Read the full clause because that wording may appear before or after the object. Do not add an audience, method, purpose, location, or an ordinary example that does not change the activity's meaning.
6. Put claims requiring the same title in one group. Every proposed title must:
- contain 2-5 words;
- preserve the current main verb;
- name exactly one thing acted on by that verb; and
- be no broader than the source evidence.

Do not use WordNet, change the main verb, or decide where a new title belongs in the ontology. A new title is provisional until a later placement review. If the evidence cannot be classified without guessing, defer the whole case.

Return structured data only: groups with title, canonicalDirectObject, sourceClaims, and a short reason. Each sourceClaim must contain sourceTaskIndex, a concise directObject phrase copied from the description, and an exact evidenceQuote copied from the description that includes the main verb or one accepted synonym. Also return deferredTaskIndexes, one overall reason, and confidence. Do not return title status or a keep/rename/split label; deterministic code derives them.`,
  "access-wordnet-assigned-synset-check-v2@access-wordnet-assigned-synset-check-2026-08-29-v2": `You are checking the WordNet verb sense currently assigned to one accepted homogeneous activity group.

Inputs:
- Accepted activity title: [GROUP TITLE]
- Every exact O*NET record in this accepted group: [GROUP O*NET RECORDS]
- Current assigned WordNet synset ID, definition, lemmas, and examples: [ASSIGNED SYNSET]

Judge whether the assigned synset accurately represents the leading verb as used in every supplied record. Use the complete title and evidence, not the verb string alone. Return correct-for-all, incorrect-for-all, mixed, or uncertain. For mixed, list the exact record indexes for which the synset is incorrect. Do not search WordNet, suggest a replacement, change the title, or decide placement.`,
  "access-wordnet-conditional-selection-v2@access-wordnet-conditional-selection-2026-08-29-v2": `The assigned WordNet sense was not correct for every record in one accepted homogeneous activity group.

Inputs:
- Accepted activity title: [GROUP TITLE]
- The exact O*NET records needing a different sense: [FLAGGED O*NET RECORDS]
- Every WordNet verb synset retrieved locally for the title's exact leading verb, with IDs, definitions, lemmas, and examples: [LOCAL CANDIDATE SYNSETS]

Select the one candidate synset that best represents the leading verb across all supplied records. Use no source outside the supplied candidates and never invent an ID. Return replace with one selectedSynsetId, no-suitable-synset, or uncertain, plus a short evidence-grounded reason and confidence. Do not change the title or ontology placement.`,
  "access-wordnet-all-candidate-v3@access-wordnet-all-candidate-2026-08-29-v3": `You are aligning one human-accepted homogeneous activity group with WordNet.

Inputs:
- Accepted activity title: [GROUP TITLE]
- Every exact O*NET record and accepted predicate-object claim in the group: [GROUP EVIDENCE]
- The inherited WordNet synset or synsets whose lemmas match the title's exact action phrase: [MATCHING INHERITED SYNSETS]
- Every WordNet verb synset retrieved locally for that exact action phrase, with ID, definition, lemmas, and examples: [ALL LOCAL CANDIDATE SYNSETS]

Compare all supplied candidates before judging the inherited assignment. Select the one synset whose definition best represents the action as used across every evidence claim. Do not accept a sense merely because its lemma matches the title. If different evidence claims require different senses, return mixed-evidence so title grouping can be reopened. If no supplied sense fits, return no-suitable-synset. If the evidence cannot distinguish candidates, return uncertain.

Use only the supplied local candidates and never invent an ID. Return structured data only: outcome selected, mixed-evidence, no-suitable-synset, or uncertain; selectedSynsetId only for selected; one short evidence-grounded reason; and confidence. Do not change the title or ontology placement.`,
  "access-wordnet-alignment-v1@access-wordnet-alignment-2026-08-28-v1": `You are checking the WordNet verb sense assigned to one homogeneous atomic activity group after title clarification.

Inputs:
- Resulting homogeneous activity title: [GROUP TITLE]
- Every exact O*NET source record assigned to this group: [GROUP SOURCE RECORDS]
- Current owning ontology verb and inherited assigned synset or synsets, with definitions, lemmas, and examples: [ASSIGNED SYNSETS]
- Every WordNet verb synset returned locally for the title's exact leading action, with definitions, lemmas, and examples: [CANDIDATE SYNSETS]

Task:
Decide whether the inherited assigned synset set accurately represents the leading action as it is used across every source record in this homogeneous group.

Rules:
1. Interpret the action from the complete activity title and all assigned O*NET evidence, not from the verb string alone.
2. Keep an assigned synset only if its definition fits every source record in the group. Do not accept a sense merely because its lemma matches the leading word.
3. If the assigned set is wrong or needlessly contains unrelated senses, select the best matching candidate synset or smallest justified candidate set for the exact leading action.
4. Candidate retrieval is deterministic and local. Do not browse, invent a synset ID, or use definitions outside the supplied WordNet candidates.
5. If none of the supplied candidates fits, return no-suitable-synset. If the evidence does not distinguish candidates, return uncertain rather than forcing a choice.
6. This pass does not change the title, move the activity, merge verbs, or edit the ontology. It creates an expert-review proposal only.

Return structured data only: decision keep-assigned, replace, no-suitable-synset, or uncertain; selectedSynsetIds; one evidence-grounded reason; and confidence.`,
  "access-wordnet-alignment-auditor-v1@access-wordnet-alignment-audit-2026-08-28-v1": `Independently audit one proposed WordNet alignment using the homogeneous activity title, all of its assigned O*NET records, every inherited synset definition, and every locally retrieved candidate definition. Reject or correct any proposal that relies on the verb string alone, overlooks a source record, keeps an unrelated inherited sense, invents a synset, selects a sense whose definition does not cover the evidence, or forces a choice where WordNet has no suitable or distinguishable candidate. This audit cannot change titles or ontology placement.`,
  "cloudbank-ontology-title-clarity-proposer-v1@cloudbank-ontology-title-clarity-proposer-v1": `Audit the clarity of each work-activity title against all O*NET tasks directly linked to that activity. This pass changes titles only; it must not split, merge, move, or regroup activities.

For every record choose exactly one decision:
- keep: the current title is already a concise stand-alone summary of every linked task, even if it is broad.
- rename: one clearer 2-4 word title can represent every linked task without changing the action or narrowing away a supported meaning.
- structural-review: the linked tasks express distinct activities or another structural problem that a title-only edit cannot solve.
- uncertain: the supplied evidence does not support a confident decision.

Rename rules:
1. Preserve the current title's first action word exactly.
2. Use 2-4 words total and natural singular or plural wording.
3. Add only modifiers supported by every linked task. A specific example in one task cannot narrow a title that also covers broader tasks.
4. Do not merely replace a word with a synonym. The new title must make the activity materially clearer to a reader who sees no hierarchy context.
5. Return an empty proposedTitle unless decision is rename.
6. Parent titles supply context but do not authorize a narrower meaning.

Return exactly one assessment for every index and no others.

Records:
[RUNTIME TITLE, PARENT, AND COMPLETE LINKED O*NET TASK RECORDS]`,
  "cloudbank-blind-title-clarity-critic-v1@cloudbank-blind-title-clarity-critic-v1": `Independently compare title A with title B for each work activity. You are not told which title is current or model-proposed. Judge only the supplied titles, parent context, and the complete set of directly linked O*NET tasks.

For clearerTitle, choose A or B only when that title more clearly conveys the shared activity to a reader who cannot see the hierarchy. Choose equal when neither has a meaningful clarity advantage, neither when both are misleading, or uncertain when the evidence does not resolve the comparison.

For evidenceCoverage, choose A, B, both, neither, or uncertain according to which title preserves the action and covers every linked task without adding unsupported specificity. A title can be clearer but still fail coverage.

Return exactly one high/medium/low-confidence evaluation for every index and no others. Do not infer which title another agent preferred.

Records:
[RUNTIME BLINDED TITLE PAIRS, PARENT CONTEXT, AND COMPLETE LINKED O*NET TASKS]`,
  "cloudbank-adversarial-title-clarity-auditor-v1@cloudbank-adversarial-title-clarity-auditor-v1": `Act as an adversarial final auditor for proposed work-activity title changes. Every proposal below already passed a title proposer, a blinded pairwise comparison, and deterministic checks. Do not defer to those prior stages.

Approve only when the proposed title is a durable canonical activity name:
1. It preserves the current action and every linked O*NET task.
2. Its added words express the shared activity meaning, not merely an audience, setting, purpose, method, temporary status, or one illustrative example.
3. It does not combine distinct activities or object types that should instead be split or reviewed structurally.
4. It produces a material clarity gain, not just a stylistic preference.
5. It reads naturally as a 2-4 word activity title outside this local branch.

Use structural-review when the evidence reveals conflation or another issue a rename cannot safely solve. Use reject for an avoidable failure mode and uncertain only when the complete supplied evidence is genuinely insufficient. Return failureMode none only for an approval. Return exactly one audit per index and no others.

Records:
[RUNTIME SURVIVING TITLE PROPOSALS AND COMPLETE LINKED EVIDENCE]`,
  "cloudbank-evidence-topology-proposer-v1@cloudbank-evidence-topology-proposer-v1": `Part 1: inspect every O*NET task supplied by the exhaustive cue scan and assess every numbered “including,” “such as,” “for example,” “for instance,” or “e.g.” cue.

1. Decide whether the list contains objects being sold, rented out, both, or adjuncts such as venues, methods, customers, tools, or purposes.
2. Extract every explicit object in a positive list without inventing examples. Preserve both actions when Sell and Rent out govern the same list.
3. Reuse an exact existing activity title when it preserves the source meaning; otherwise create the narrowest stand-alone title supported by the phrase.
4. Assign nested-list examples only to their nearest cue. Defer an outer category expanded by a nested cue to the later grouping pass.

Part 2: for each genuinely missing activity, choose only from the snapshot-derived parent candidates. Use the narrowest parent that preserves the action and source meaning. Reuse exact existing nodes and add only missing evidence links.`,
  "cloudbank-generic-placement-proposer-v2@cloudbank-generic-placement-proposer-v2": `Assess every O*NET task supplied by the seller-side recall scan.

1. Link a seller-side clause directly to Sell ownership when its object is a bare or catch-all category that cannot support a stable specialization.
2. Link a temporary-use clause directly to Rent out under the same condition.
3. Keep a specific parent when a stable modifier such as agricultural, technical, funeral, postal, sporting, insurance, or service contract narrows the object.
4. Preserve every unrelated or non-transaction evidence link.
5. Quote the exact generic clause, list every current parent to remove or retain, and make no activity-node changes. Return ambiguous with no mutation when uncertain.`,
  "cloudbank-final-readiness-critic-v1@cloudbank-final-readiness-critic-v1": `Independently audit the complete candidate inventory and proposed judgments.

Verify that every supplied task and cue was assessed, every explicit sold or rented object was extracted once in the correct cue scope, coordinated actions were preserved, adjuncts were excluded, cited phrases occur in the source, and generic high-level links are limited to genuinely broad clauses. Fail the complete run when any concrete error remains.`,
  "cloudbank-evidence-topology-critic-v1@cloudbank-evidence-topology-critic-v1": `Audit every assembled evidence-topology plan.

Verify that each new activity preserves its source meaning and action, uses the narrowest defensible supplied parent, reuses existing activities instead of duplicating them, leaves already-satisfied evidence links unchanged, and marks every missing link explicitly. Do not perform grouping or list-length cleanup in this pass.`,
  "cloudbank-object-coverage-proposer-v1@cloudbank-object-coverage-proposer-v1": `Assess every supplied seller-side O*NET task; do not limit recall to phrases introduced by “such as” or “including.”

1. Identify every stable object explicitly governed by Sell, Rent out, or Lease out, including coordinated lists written without an example cue.
2. Quote each exact source phrase and preserve the governing action.
3. Do not turn customers, venues, methods, purposes, expertise, environmental conditions, or other circumstances into activities.
4. Do not propose a bare generic object such as products, services, information, items, merchandise, goods, or securities as a specialization.
5. Return exactly one complete assessment for every supplied task.`,
  "cloudbank-object-coverage-critic-v2@cloudbank-object-coverage-critic-v2": `Independently audit the complete seller-side task inventory and all proposed object assessments.

Fail the run if a task is missing, a stable sold or rented object is omitted, an evidence phrase is not exact source text, an action changes, a generic catch-all becomes a specialization, or a circumstance is mistaken for an object. Report only concrete, source-checkable findings.`,
  "cloudbank-object-identity-resolver-v1@cloudbank-object-identity-resolver-v1": `Resolve each source-supported activity against the current ontology snapshot.

Choose create-new when the activity is distinct and no equivalent title exists. Choose reuse-existing only for an exact synonym or semantically equivalent activity, not merely a broader parent or related activity. Choose exclude only when the candidate is a residual umbrella, unsupported, or not a stable seller-side activity. Preserve the Sell, Rent out, or Lease out action and every identity-defining modifier.`,
  "cloudbank-object-identity-critic-v1@cloudbank-object-identity-critic-v1": `Independently audit every create-new, reuse-existing, and exclude decision.

Check the exact current title inventory, semantic equivalence, action, and identity-defining modifiers. Reject duplicate creation, reuse of a merely broader or related node, exclusion of a supported distinct activity, and claims that an exact title exists when it does not.`,
  "cloudbank-object-identity-resolver-v2@cloudbank-object-identity-resolver-v2": `Resolve each source-supported activity against current activity titles and recorded synonyms.

1. Reuse the canonical activity when the proposed title matches one of its recorded synonyms, including a singular or plural variant.
2. Create a new activity only when no current title or recorded synonym represents the same activity.
3. Preserve the transaction action and every meaning-defining source modifier.
4. Exclude only unsupported, incidental, or unstable objects.
5. Stop rather than guess when one phrase maps to more than one canonical activity.`,
  "cloudbank-object-identity-critic-v2@cloudbank-object-identity-critic-v2": `Independently audit every create-new, reuse-existing, and exclude decision against current titles and recorded synonyms.

Reject a new activity that recreates a recorded synonym, reuse of a merely broader or related activity, exclusion of a supported distinct activity, a changed transaction action, or loss of a meaning-defining modifier. Require the exact canonical title for every recorded-synonym match.`,
  "cloudbank-synonym-collision-critic-v1@cloudbank-synonym-collision-critic-v1": `Independently audit each recorded-synonym correction.

Confirm that the canonical node records the duplicate wording as a synonym; both nodes express the same action and activity; the duplicate contains no independent metadata or semantic children; every duplicate evidence task already appears under the canonical node; and the plan retires only the duplicate while preserving the canonical node, parents, synonym, and evidence. Do not assess parent quality, sibling grouping, or list length.`,
  "cloudbank-object-topology-proposer-v3@cloudbank-object-topology-proposer-v3": `For each activity whose identity has already been resolved, choose one parent only from its snapshot-derived candidate parents.

Select the narrowest parent that preserves the activity's action and source meaning. Treat the resolved activity title as fixed: do not rename, merge, exclude, or reassess it. Do not perform sibling grouping or list-length cleanup in this pass.`,
  "cloudbank-object-topology-critic-v3@cloudbank-object-topology-critic-v3": `Independently audit only the proposed parent for each resolved activity.

Confirm that the parent is among the supplied candidates, preserves the Sell or Rent out action, and is the narrowest defensible choice. Do not reopen the resolved title, identity decision, evidence extraction, or deferred sibling grouping.`,
};

const EXACT_SOURCE_MODEL_PROMPT_KEYS = new Set([
  "access-homogeneous-title-grouping-v1@access-homogeneous-title-grouping-2026-08-28-v1",
  "access-homogeneous-title-grouping-auditor-v1@access-homogeneous-title-grouping-audit-2026-08-28-v1",
  "access-homogeneous-title-grouping-v2@access-homogeneous-title-grouping-2026-08-29-v2",
  "access-homogeneous-title-grouping-v3@access-homogeneous-title-grouping-2026-08-29-v3",
  "access-homogeneous-title-grouping-v4@access-homogeneous-title-grouping-2026-08-29-v4",
  "access-homogeneous-title-grouping-v5@access-homogeneous-title-grouping-2026-08-30-v5",
  "access-wordnet-alignment-v1@access-wordnet-alignment-2026-08-28-v1",
  "access-wordnet-alignment-auditor-v1@access-wordnet-alignment-audit-2026-08-28-v1",
  "access-wordnet-assigned-synset-check-v2@access-wordnet-assigned-synset-check-2026-08-29-v2",
  "access-wordnet-conditional-selection-v2@access-wordnet-conditional-selection-2026-08-29-v2",
  "access-wordnet-all-candidate-v3@access-wordnet-all-candidate-2026-08-29-v3",
  "cloudbank-ontology-title-clarity-proposer-v1@cloudbank-ontology-title-clarity-proposer-v1",
  "cloudbank-blind-title-clarity-critic-v1@cloudbank-blind-title-clarity-critic-v1",
  "cloudbank-adversarial-title-clarity-auditor-v1@cloudbank-adversarial-title-clarity-auditor-v1",
]);

const DETERMINISTIC_RULES: Record<string, string> = {
  "homogeneous-title-grouping-validator-v1@homogeneous-title-grouping-validator-2026-08-28-v1": `Mechanically validate every grouping before it enters expert review: the source hierarchy hash and occurrence ID must match; every source index must be valid and accounted for; no index may be both grouped and deferred; group titles must be unique; every group must preserve the current leading action; current/existing/new status must match the snapshot title inventory; keep and rename must have exactly one group; split must have at least two groups; defer must defer all evidence; and every group and assessment must include a rationale. The validator never changes a semantic judgment.`,
  "homogeneous-title-testbed-card-assembler-v1@homogeneous-title-testbed-card-assembler-2026-08-28-v1": `1. Build one read-only title card for every validated sampled atomic activity, including keep controls.
2. Bind the current atomic title and its semantic parent to the exact source snapshot.
3. Preserve every numbered O*NET record, including duplicate records, and show the exact records assigned to each resulting group.
4. Mark new titles as provisional children of the current title; do not claim final ontology placement.
5. Preserve the grouping agent, independent audit, deterministic validation, source hashes, and dependent WordNet-card IDs.
6. Never mutate the ontology from a generated or expert-reviewed card.`,
  "homogeneous-title-grouping-validator-v2@homogeneous-title-grouping-validator-2026-08-29-v2": `Mechanically bind the result to the sampled source occurrence and exact source hierarchy hash. Require every O*NET record index to appear exactly once across the proposed groups or, when the case is unresolved, require every index to be deferred. Reject duplicate group titles, changed leading verbs, missing or repeated indexes, partial deferrals, and unsupported record indexes. Derive current/existing/new status from the exact ontology title inventory and derive keep, rename, split, or defer from the validated groups. Require concise reasons and confidence. This validator performs no semantic correction and no independent model audit.`,
  "homogeneous-title-testbed-card-assembler-v2@homogeneous-title-testbed-card-assembler-2026-08-29-v2": `1. Build one read-only title card for every validated sampled atomic activity, including keep controls.
2. Bind the current atomic title and parent to the exact source snapshot.
3. Show every numbered O*NET record exactly once in its resulting group.
4. Mark new titles as provisional children and defer final placement and WordNet alignment.
5. Preserve the single model call, deterministic validation, and source hashes.
6. Never mutate the ontology from a generated or expert-reviewed card.`,
  "homogeneous-title-grouping-validator-v3@homogeneous-title-grouping-validator-2026-08-29-v3": `Bind the result to the exact sampled occurrence and source hierarchy hash. Require every O*NET record to contribute at least one validated predicate-object claim or, if unresolved, require the complete case to be deferred. Permit one record in multiple groups only through distinct direct-object claims for the preserved action. Require each direct-object phrase to occur in an exact evidence quote, each quote to occur in its exact source record, and each quote to include the canonical action or an action synonym recorded in the current title. Reject duplicate claims, duplicate group titles, unsupported source indexes, changed leading actions, titles outside 2-5 words, titles that do not end in their one declared canonical direct object, and partial deferrals. Derive source indexes, exact source tasks, title status, existing-title occurrence count, and keep/rename/split/defer deterministically. An existing title string does not choose a merge or placement target; placement remains a later review. This stage performs no semantic correction or independent model audit.`,
  "homogeneous-title-testbed-card-assembler-v3@homogeneous-title-testbed-card-assembler-2026-08-29-v3": `1. Build one read-only title card for every validated sampled atomic-title occurrence.
2. Bind repeated titles by exact hierarchy path rather than collapsing same-text nodes.
3. Show every predicate-object claim with its exact quote and full O*NET source record; one record may appear under multiple titles only through distinct claims.
4. Report repeated existing-title occurrences without choosing a merge target; mark every new title as provisional and defer final placement and WordNet alignment.
5. Preserve the single semantic call, deterministic validation, model provenance note, and source hashes.
6. Describe keep cards as status-quo proposals, not independent controls or accuracy results.
7. Never mutate the ontology from a generated or expert-reviewed card.`,
  "homogeneous-title-grouping-validator-v4@homogeneous-title-grouping-validator-2026-08-29-v4": `Bind the result to the exact sampled occurrence and source hierarchy hash. Require every O*NET record to contribute at least one validated predicate-object claim or, if unresolved, require the complete case to be deferred. Permit one record in multiple groups only through distinct direct-object claims for the preserved action, including material coordinated subtypes. Require each direct-object phrase to occur in an exact evidence quote, each quote to occur in its exact source record, and each quote to include the canonical action or an action synonym recorded in the current title. Preserve meaning-defining restrictions wherever they occur in the complete clause, including complements and trailing phrases. Reject duplicate claims, duplicate group titles, unsupported source indexes, changed leading actions, titles outside 2-5 words, titles that do not end in their one declared canonical direct object, and partial deferrals. Derive source indexes, exact source tasks, title status, existing-title occurrence count, and keep/rename/split/defer deterministically. An existing title string does not choose a merge or placement target; placement remains a later review. This stage performs no semantic correction or independent model audit.`,
  "homogeneous-title-testbed-card-assembler-v4@homogeneous-title-testbed-card-assembler-2026-08-29-v4": `1. Build one read-only title card for every validated sampled atomic-title occurrence, including the expert-feedback regression cases.
2. Bind repeated titles by exact hierarchy path rather than collapsing same-text nodes.
3. Show every predicate-object claim with its exact quote and full O*NET source record; one record may appear under multiple titles only through distinct claims.
4. Report repeated existing-title occurrences without choosing a merge target; mark every new title as provisional and defer final placement and WordNet alignment.
5. Preserve the single semantic call, deterministic validation, model provenance note, source hashes, and the expert-feedback sampling rationale.
6. Describe keep cards as status-quo proposals, not controls or accuracy results.
7. Never mutate the ontology from a generated or expert-reviewed card.`,
  "homogeneous-title-grouping-validator-v5@homogeneous-title-grouping-validator-2026-08-30-v5": `Bind the result to the exact sampled occurrence and source hierarchy hash. Require every O*NET description to contribute at least one validated verb-object claim or, if unresolved, require the complete case to be deferred. Permit one description in multiple groups only through distinct objects for the preserved verb. Require each object phrase to occur in an exact evidence quote, each quote to occur in its exact source description, and each quote to include the main verb or a recorded synonym. Reject duplicate claims, duplicate group titles, unsupported source indexes, changed leading verbs, titles outside 2-5 words, titles that do not end in their one declared object, and partial deferrals. Derive source indexes, exact source descriptions, title status, existing-title occurrence count, and keep/rename/split/defer deterministically. A matching title does not choose a merge or placement target; placement remains a later review. This stage performs no semantic correction or independent model audit.`,
  "homogeneous-title-testbed-card-assembler-v5@homogeneous-title-testbed-card-assembler-2026-08-30-v5": `1. Build one read-only title card for every validated sampled title occurrence, including the two expert-feedback regression cases.
2. Bind repeated titles by exact hierarchy path rather than collapsing same-text nodes.
3. Show every source-supported verb-object claim with its exact quote and full O*NET description; one description may appear under multiple titles only through distinct claims.
4. Display only already-represented linked activities that use the same verb or a recorded synonym; unrelated actions remain available in source provenance but are excluded from the model prompt.
5. Report repeated existing-title occurrences without choosing a merge target; mark every new title as provisional and defer final placement and WordNet alignment.
6. Preserve the single semantic call, deterministic validation, ACCESS provenance note, source hashes, and sampling rationale.
7. Describe keep cards as status-quo proposals, not controls or accuracy results, and never mutate the ontology from a generated or reviewed card.`,
  "local-wordnet-conditional-retrieval-v2@local-wordnet-conditional-retrieval-2026-08-29-v2": `1. Run only after an accepted title group fails its assigned-synset check.
2. Take the exact leading action from that accepted group.
3. Retrieve every verb synset for that exact lemma from the pinned local WordNet corpus.
4. Preserve each synset ID, definition, lemmas, and examples without model or web lookup.
5. Return an empty candidate list when WordNet has no exact leading-action lemma; never invent an ID.`,
  "local-wordnet-candidate-retrieval-v1@local-wordnet-candidate-retrieval-2026-08-28-v1": `1. Take the exact leading action from one validated homogeneous group.
2. Retrieve every local NLTK WordNet verb synset for that exact lemma.
3. Resolve every inherited owner synset locally.
4. Preserve each synset ID, definition, lemma set, and example set without model or web lookup.
5. Return an empty candidate list when WordNet has no exact leading-action lemma; never invent an ID.`,
  "wordnet-alignment-validator-v1@wordnet-alignment-validator-2026-08-28-v1": `Mechanically validate each WordNet assessment before expert review: bind it to one validated homogeneous group; require the source hierarchy and title-proposal IDs to match; require every displayed O*NET record to be exactly the records assigned to that group; resolve every inherited and selected synset in the local WordNet corpus; require selected IDs to come from the locally retrieved candidate set; keep-assigned must select exactly the inherited set; replace must select a nonempty different set; no-suitable-synset and uncertain must select none; require a rationale, confidence, and an approved audit. The validator never substitutes its own semantic judgment.`,
  "wordnet-testbed-card-assembler-v1@wordnet-testbed-card-assembler-2026-08-28-v1": `1. Build one read-only WordNet card for every validated homogeneous title group.
2. Make the card depend on the exact title-grouping proposal that created or retained the group.
3. Show the current atomic title, resulting group title, every exact assigned O*NET record, inherited synsets, selected synsets, and all locally retrieved candidates.
4. Bind provenance to the original atomic node because provisional new title nodes do not yet exist in the source snapshot.
5. If the title proposal is rejected, mark its dependent WordNet cards not applicable.
6. Never change a title, placement, or ontology record from the alignment card.`,
  "ontology-title-clarity-risk-screen-v1@ontology-title-clarity-risk-screen-v1": `1. Start from the independently audited grammatical-role map.
2. Inspect every directly evidence-linked verb-object activity with a 2-4 word title.
3. Score reproducible signals: a generic or highly vague object head, title-object wording absent from the linked evidence, multiple linked tasks, explicit vagueness markers, and unnatural singular “datum.”
4. Keep only records meeting the prespecified risk threshold.
5. Defer activities with more than eight linked tasks so a bounded title pass cannot silently ignore evidence.
6. Select a deterministic pilot stratified by level-three branch and ontology depth.`,
  "ontology-title-clarity-safety-gate-v1@ontology-title-clarity-safety-gate-v1": `1. Require a natural 2-4 word proposed title.
2. Require the proposed title to differ materially from the current title.
3. Preserve the current title's first action word.
4. Reject brackets, parentheses, and terminal punctuation in the proposed title.
5. Reject any proposed title already owned by another activity in the source snapshot.
6. Pass only proposals that the blinded critic selected with high confidence while preserving complete evidence coverage.`,
  "ontology-title-clarity-card-assembler-v1@ontology-title-clarity-card-assembler-v1": `1. Build one comparison card per title change that passed every prior gate.
2. Bind the subject and parent to the exact ontology snapshot.
3. Show the current title, proposed title, and every directly linked O*NET task.
4. Preserve the complete detector, proposer, critic, safety-gate, adversarial-auditor, and assembler lineage.
5. Keep the proposal read-only; expert agreement does not itself mutate the ontology.`,
  "exhaustive-onet-cue-recall-v2@exhaustive-onet-cue-recall-v2": `1. Parse every O*NET evidence node in the snapshot.
2. Select every task containing “including,” “including but not limited to,” “such as,” “for example,” “for instance,” or “e.g.”
3. Number every cue and retain its full source text and current parents.
4. Do not semantically filter candidates during recall.
5. Fail if the model omits a task or numbered cue.`,
  "seller-side-evidence-recall-v2@seller-side-evidence-recall-v2": `1. Parse every O*NET evidence node in the snapshot.
2. Select every task containing any Sell, Sold, Selling, Rent, Rented, Renting, Lease, Leased, or Leasing form.
3. Retain the full source text and every current parent.
4. Require exactly one placement assessment per selected task.
5. Reject proposed removals or retentions that do not account for every current parent.`,
  "final-readiness-card-assembler-v1@final-readiness-card-assembler-v1": `1. Build one atomic review card per O*NET task.
2. Bind all existing nodes and edges to the exact source snapshot.
3. Declare every new node key and every added, retained, or removed edge explicitly.
4. Keep the plan read-only and require expert agreement before composition.
5. Show the current and proposed evidence topology and preserve the source task verbatim.`,
  "recorded-synonym-collision-scan-v1@recorded-synonym-collision-scan-v1": `1. Normalize activity titles and recorded action alternatives for case and singular/plural inflection.
2. Compare only activities with the same transaction action.
3. Report a collision when one activity title matches an action alternative recorded on another activity.
4. Record every parent, child, collection, metadata field, and O*NET evidence link on both nodes.
5. Fail closed when a title maps to more than one canonical activity.`,
  "canonical-node-reuse-proposer-v1@canonical-node-reuse-proposer-v1": `1. Require exactly one canonical activity that records the duplicate wording as a synonym.
2. Require the duplicate to contain no description, synsets, action alternatives, or semantic children.
3. Require every duplicate O*NET evidence task to already appear under the canonical activity.
4. Retire only the duplicate node, its incident edges, and its collection.
5. Retain the canonical node, parents, synonym, evidence, and every unrelated structure.
6. Keep the plan read-only until an expert approves it.`,
  "identity-correction-card-assembler-v1@identity-correction-card-assembler-v1": `1. Build one review card per safe recorded-synonym collision.
2. Show the duplicate, canonical activity, recorded synonym, and shared O*NET evidence.
3. List the exact duplicate-only removals and the canonical structure that remains.
4. Bind the mutation plan to the exact source snapshot.
5. Explain that the proposal changes identity only and does not reopen placement or grouping.
6. Never authorize a production mutation.`,
  "composition-followup-plan-builder-v1@sell-composition-followup-v1": `Input: one saved expert decision, its prior proposal, and the exact ontology snapshot reviewed by the expert.

1. Preserve the expert's accepted semantic decision or requested correction.
2. Express the implementation as explicit node, edge, collection, metadata, and evidence-link operations.
3. Preserve every unaffected child, source task, synonym, description, and action alternative.
4. Bind every operation to an exact existing node ID or an explicitly declared new-node key.
5. Mark the plan as read-only; it cannot mutate the production ontology.
6. Use a clarification-only record when the expert's intended structure is incomplete.`,
  "composition-followup-card-builder-v1@sell-composition-followup-v1": `Build one reviewer card from the snapshot-bound implementation plan.

1. Show current and proposed topology separately.
2. State whether this is an implementation confirmation, corrected proposal, or non-mutating clarification.
3. Preserve the source proposal ID and prior expert decision.
4. Include the exact affected structure and source tasks.
5. Require another explicit expert answer before the plan can enter composition.`,
  "proposal-card-assembler-v1@reviewer-proposal-contract-v1": `Convert the stored proposal into a reviewer-facing card.

1. Bind referenced nodes and edges to the recorded ontology snapshot.
2. Show current state, proposed state, evidence, and affected structure separately.
3. Preserve component and prompt-version lineage.
4. Do not expose confidence as a recommendation or infer human approval from an agent decision.
5. Keep clarification requests non-mutating and actionable plans read-only until expert approval.
6. Reject stale references, unsupported destinations, implicit deletion, and evidence loss.`,
  "review-composition-readiness-v1@review-composition-readiness-v1": `1. Require every proposal and expert directive to use the same dataset version and ontology snapshot.
2. Select only the latest trusted decision for each proposal.
3. Fail closed on pending, unmatched, duplicated, stale, or conflicting decisions.
4. Partition proposals into accepted, rejected, and pending sets.
5. Authorize only an isolated composition draft; never authorize a production mutation.`,
  "rob-audit-deterministic-projection@sell-audit-followup-v1": `1. Read a saved expert audit decision and its requested correction.
2. Project only that recorded decision into a follow-up item; do not infer a new expert judgment.
3. Bind the follow-up to the exact ontology snapshot and referenced nodes.
4. Keep unresolved structure as a clarification request rather than inventing an answer.`,
  "deterministic-policy-gates-v4@sell-audit-followup-v1": `1. Require exact source-evidence and snapshot bindings.
2. Reject unsupported titles, destinations, groupings, or identity claims.
3. Preserve all evidence and unaffected structure.
4. Require each change to improve an applicable quality measure without reducing another.
5. Keep all outputs as proposals pending explicit expert review.`,
};

const disclosureFor = ({
  actor,
  roleLabel,
  promptVersion,
}: {
  actor: ReturnType<typeof actorIdentity>;
  roleLabel: string;
  promptVersion: string;
}): PromptDisclosure => {
  if (
    actor.id === "evidence-bound-specialization-generator" &&
    promptVersion ===
      "c9f9b5ee63e7c29ed0d8460729dfda77478fee873109fa137d5e35b1abf91264"
  ) {
    return exactArchivedPrompt(SPECIALIZATION_GENERATOR_PROMPT);
  }
  const historicalPrompt =
    HISTORICAL_MODEL_PROMPTS_BY_KEY[`${actor.id}@${promptVersion}`];
  if (historicalPrompt) {
    return sourceBackedPromptTemplate(historicalPrompt, actor.id === "D12");
  }
  const modelPromptKey = `${actor.id}@${promptVersion}`;
  const modelPrompt = MODEL_PROMPTS[modelPromptKey];
  if (modelPrompt) {
    return EXACT_SOURCE_MODEL_PROMPT_KEYS.has(modelPromptKey)
      ? sourceBackedPromptTemplate(modelPrompt, true)
      : modelPromptTemplate(modelPrompt);
  }
  const deterministicRule = DETERMINISTIC_RULES[`${actor.id}@${promptVersion}`];
  if (deterministicRule) {
    return decisionRules(deterministicRule);
  }
  const recognizedOrUnversioned =
    promptVersion !== "Recorded version not recognized";
  if (recognizedOrUnversioned) {
    const humanInstruction = HISTORICAL_EXPERT_INSTRUCTIONS_BY_ACTOR[actor.id];
    if (humanInstruction) return expertInstructions(humanInstruction);
    const historicalModelPrompt = HISTORICAL_MODEL_PROMPTS_BY_ACTOR[actor.id];
    if (historicalModelPrompt) {
      return sourceBackedPromptTemplate(historicalModelPrompt);
    }
    const historicalRules = HISTORICAL_DETERMINISTIC_RULES_BY_ACTOR[actor.id];
    if (historicalRules) return decisionRules(historicalRules);
  }
  return unavailableDisclosure(roleLabel, actor);
};

type RecordedPipelineStage = {
  role?: unknown;
  actorId?: unknown;
  actorKind?: unknown;
  model?: unknown;
  promptVersion?: unknown;
};

const stage = ({
  id,
  sequence,
  role,
  roleLabel,
  actorId,
  actorName,
  actorKind: kind,
  summary,
  promptVersion,
  promptLabel,
  prompt,
  promptDisclosureNote,
  sharedExecutionId,
  sharedExecutionNote,
}: Omit<SomAgentTraceStage, "actorKindLabel">): SomAgentTraceStage => ({
  id,
  sequence,
  role,
  roleLabel,
  actorId,
  actorName,
  actorKind: kind,
  actorKindLabel: KIND_LABELS[kind],
  summary,
  promptVersion,
  promptLabel,
  prompt,
  ...(promptDisclosureNote ? { promptDisclosureNote } : {}),
  ...(sharedExecutionId ? { sharedExecutionId } : {}),
  ...(sharedExecutionNote ? { sharedExecutionNote } : {}),
});

const COMBINED_ISSUE_AND_SOLUTION_ACTORS = new Set([
  "D7",
  "D8",
  "D9",
  "D10+J7",
  "D11",
  "D12",
  "J7",
  "Rob-task-10",
  "W16",
  "W16+J7",
  "access-homogeneous-title-grouping-v1",
  "access-wordnet-alignment-v1",
  "description-gap-scan",
  "description-synonym-parser",
  "deterministic-collection-policy-scan",
  "deterministic-empty-semantic-node-scan",
  "deterministic-facet-overlap-scan",
  "deterministic-facet-overlap-scan-exact-action",
  "deterministic-overlap-scan",
  "deterministic-post-semantic-regeneration",
  "evidence-bound-specialization-generator",
  "evidence-convergence-scan",
  "evidence-parent-contract-audit",
  "expert-correction-projection",
  "flat-list-coverage-control",
  "identity-agent",
  "identity-agent-exact-action",
  "onet-generic-object-specialization",
  "placement-boundary-agent",
  "placement-boundary-agent-exact-action",
  "rob-audit-deterministic-projection",
  "rob-outline-identity-exact-action",
  "rob-outline-identity-followup",
  "rob-outline-placement-exact-action",
  "rob-outline-placement-followup",
  "single-child-wrapper-policy-check",
  "structure-agent",
  "title-evidence-agent",
  "whole-ontology-semantic-one-step-move",
  "whole-ontology-semantic-retrieval",
]);

const SINGLE_PASS_CANDIDATE_ACTORS = new Set([
  "access-homogeneous-title-grouping-v2",
  "access-homogeneous-title-grouping-v3",
  "access-homogeneous-title-grouping-v4",
  "access-homogeneous-title-grouping-v5",
]);

const recordedVersion = (
  actorId: string,
  value: unknown,
  missingFallback: string,
): string => {
  const token = clean(value);
  if (!token) return missingFallback;
  return TRUSTED_ACTOR_VERSIONS[actorId]?.has(token)
    ? token
    : "Recorded version not recognized";
};

const PROPOSER_STAGE_COPY: Record<
  string,
  { roleLabel: string; summary: string }
> = {
  "cloudbank-object-coverage-proposer-v1": {
    roleLabel: "Extract every sold or rented object",
    summary:
      "Checks every seller-side source task for stable objects, including coordinated lists without an example cue.",
  },
  "cloudbank-object-identity-resolver-v1": {
    roleLabel: "Resolve activity identity",
    summary:
      "Decides whether to create a distinct activity, reuse an equivalent activity, or exclude an unsupported candidate.",
  },
  "cloudbank-object-identity-resolver-v2": {
    roleLabel: "Resolve activity identity",
    summary:
      "Checks current titles and recorded synonyms before deciding whether to create, reuse, or exclude an activity.",
  },
  "canonical-node-reuse-proposer-v1": {
    roleLabel: "Build a lossless canonicalization",
    summary:
      "Retires only an empty duplicate after verifying that the canonical activity already preserves its wording and evidence.",
  },
  "cloudbank-object-topology-proposer-v3": {
    roleLabel: "Choose the activity parent",
    summary:
      "Chooses the narrowest defensible snapshot-derived parent without reopening the resolved activity identity.",
  },
};

const EVALUATOR_STAGE_COPY: Record<
  string,
  { roleLabel: string; summary: string }
> = {
  "access-homogeneous-title-grouping-auditor-v1": {
    roleLabel: "Audit the homogeneous groups",
    summary:
      "Independently checks evidence coverage, direct-object homogeneity, grounded modifiers, existing links, and consolidated titles.",
  },
  "homogeneous-title-grouping-validator-v1": {
    roleLabel: "Validate grouping invariants",
    summary:
      "Mechanically checks source indexes, action preservation, title status, group cardinality, and the approved audit.",
  },
  "homogeneous-title-grouping-validator-v2": {
    roleLabel: "Validate one-record-one-group invariants",
    summary:
      "Mechanically checks exact source coverage, unique record assignment, action preservation, derived title status, and derived decision type.",
  },
  "homogeneous-title-grouping-validator-v3": {
    roleLabel: "Validate predicate-object claim invariants",
    summary:
      "Mechanically binds direct-object claims to exact quotes and source records, permits repeated records only for distinct claims, enforces 2-5-word titles, and derives title status and decision type.",
  },
  "homogeneous-title-grouping-validator-v4": {
    roleLabel: "Validate expert-calibrated claim invariants",
    summary:
      "Mechanically binds claims to exact clauses, preserves trailing restrictions, permits material coordinated subtypes, and derives title status and decision type without making a semantic judgment.",
  },
  "homogeneous-title-grouping-validator-v5": {
    roleLabel: "Validate reader-ready claim invariants",
    summary:
      "Mechanically binds each claimed object to an exact source quote, preserves the main verb, enforces concise titles, and derives title status and decision type without making a semantic judgment.",
  },
  "local-wordnet-candidate-retrieval-v1": {
    roleLabel: "Retrieve local WordNet candidates",
    summary:
      "Deterministically resolves inherited senses and every local WordNet verb sense for the exact leading action.",
  },
  "local-wordnet-conditional-retrieval-v2": {
    roleLabel: "Retrieve WordNet candidates only after failure",
    summary:
      "Deterministically retrieves every local verb sense only when an accepted group's assigned synset fails its first check.",
  },
  "access-wordnet-alignment-auditor-v1": {
    roleLabel: "Audit the WordNet alignment",
    summary:
      "Independently checks the proposed sense against every grouped source record and every locally supplied candidate definition.",
  },
  "wordnet-alignment-validator-v1": {
    roleLabel: "Validate WordNet invariants",
    summary:
      "Mechanically binds the decision to the title group, source evidence, local candidate set, and approved audit.",
  },
  "cloudbank-object-coverage-critic-v2": {
    roleLabel: "Check object coverage",
    summary:
      "Independently checks task completeness, exact evidence phrases, preserved actions, and excluded circumstances.",
  },
  "cloudbank-object-identity-critic-v1": {
    roleLabel: "Check the identity decision",
    summary:
      "Independently checks that create, reuse, and exclude decisions match the current ontology and source meaning.",
  },
  "cloudbank-object-identity-critic-v2": {
    roleLabel: "Check the identity decision",
    summary:
      "Independently checks identity decisions against current titles, recorded synonyms, source meaning, and action.",
  },
  "cloudbank-synonym-collision-critic-v1": {
    roleLabel: "Check the canonicalization",
    summary:
      "Independently verifies semantic equivalence and confirms that retiring the duplicate loses no metadata, structure, or evidence.",
  },
  "cloudbank-object-topology-critic-v3": {
    roleLabel: "Check the activity parent",
    summary:
      "Independently checks that the selected parent is allowed, action-preserving, and appropriately specific.",
  },
};

export const agentTraceForRecord = (record: any): SomAgentTrace => {
  const issueType = record.issueType as SomIssueType;
  const issueTitle = ISSUE_TITLES[issueType] || "the recorded issue";
  const evidence = record.internalModelEvidence || {};
  const lineage: RecordedPipelineStage[] = Array.isArray(
    evidence.pipelineStages,
  )
    ? evidence.pipelineStages
    : [];
  const detectorLineage = lineage.find(
    (item) => clean(item.role) === "detector",
  );
  const detectorId =
    clean(detectorLineage?.actorId) || clean(evidence.detectorId);
  const detector = actorIdentity({
    actorId: detectorId || "no-issue-detector-recorded",
    actorName: evidence.detectorName,
    recordedKind: detectorLineage?.actorKind || evidence.detectorKind,
  });
  const detectorVersion = recordedVersion(
    detector.id,
    detectorLineage?.promptVersion || evidence.detectorPromptVersion,
    "Prompt version not captured",
  );
  const detectorExecutionId = `detector:${detector.id}:${detectorVersion}`;
  const singlePassCandidateCall = SINGLE_PASS_CANDIDATE_ACTORS.has(detector.id);
  const detectorRoleLabel = singlePassCandidateCall
    ? "Group the evidence and propose titles"
    : "Detect the issue";
  const detectorDisclosure = disclosureFor({
    actor: detector,
    roleLabel: detectorRoleLabel,
    promptVersion: detectorVersion,
  });

  const explicitProposers = lineage.filter((item) =>
    ["proposer", "solution-proposer"].includes(clean(item.role)),
  );
  const combinedDetectorCall =
    !explicitProposers.length &&
    COMBINED_ISSUE_AND_SOLUTION_ACTORS.has(detector.id);

  const evaluatorLineage = lineage.filter((item) =>
    ["critic", "judge", "verifier"].includes(clean(item.role)),
  );
  if (!evaluatorLineage.length && clean(evidence.judgeId)) {
    evaluatorLineage.push({
      role: "critic",
      actorId: evidence.judgeId,
      actorKind: evidence.judgeKind,
      promptVersion: evidence.judgePromptVersion,
    });
  }

  const stages: SomAgentTraceStage[] = [
    stage({
      id: "issue-detection",
      sequence: 1,
      role: "issue-detection",
      roleLabel: detectorRoleLabel,
      actorId: detector.id,
      actorName: detector.name,
      actorKind: detector.kind,
      summary: singlePassCandidateCall
        ? [
            "access-homogeneous-title-grouping-v3",
            "access-homogeneous-title-grouping-v4",
            "access-homogeneous-title-grouping-v5",
          ].includes(detector.id)
          ? "Uses one structured semantic call to extract source-bound predicate-object claims, group compatible claims, and propose only the smallest title distinctions the evidence requires."
          : "Uses one structured semantic call to assign every O*NET record exactly once and propose only the smallest title modifiers the evidence requires."
        : `Checks whether this proposal presents a real instance of ${issueTitle}.`,
      promptVersion: detectorVersion,
      ...detectorDisclosure,
      ...(combinedDetectorCall
        ? { sharedExecutionId: detectorExecutionId }
        : {}),
    }),
  ];

  if (!explicitProposers.length && !singlePassCandidateCall) {
    const proposer = combinedDetectorCall
      ? detector
      : actorIdentity({ actorId: "no-separate-proposer-recorded" });
    const proposerVersion = combinedDetectorCall
      ? detectorVersion
      : "No proposer prompt version recorded";
    const proposerDisclosure = combinedDetectorCall
      ? detectorDisclosure
      : disclosureFor({
          actor: proposer,
          roleLabel: "Develop a possible solution",
          promptVersion: proposerVersion,
        });
    stages.push(
      stage({
        id: "solution-generation",
        sequence: stages.length + 1,
        role: "solution-generation",
        roleLabel: "Develop a possible solution",
        actorId: proposer.id,
        actorName: proposer.name,
        actorKind: proposer.kind,
        summary:
          "Produces the smallest evidence-grounded change for the detected issue; it does not approve that change.",
        promptVersion: proposerVersion,
        ...proposerDisclosure,
        ...(combinedDetectorCall
          ? {
              sharedExecutionId: detectorExecutionId,
              sharedExecutionNote:
                "The architecture registry records one candidate-producing call or deterministic pass for both responsibilities. The two rows explain that shared execution; they are not separate agents.",
            }
          : {}),
      }),
    );
  }

  const orderedReasoningStages = lineage.filter((item) =>
    ["proposer", "solution-proposer", "critic", "judge", "verifier"].includes(
      clean(item.role),
    ),
  );
  if (
    !orderedReasoningStages.some((item) =>
      ["critic", "judge", "verifier"].includes(clean(item.role)),
    ) &&
    evaluatorLineage.length
  ) {
    orderedReasoningStages.push(evaluatorLineage[0]);
  }

  for (const recordedStage of orderedReasoningStages) {
    const recordedRole = clean(recordedStage.role);
    const actor = actorIdentity({
      actorId: clean(recordedStage.actorId),
      actorName:
        clean(recordedStage.actorId) === clean(evidence.judgeId)
          ? evidence.judgeName
          : undefined,
      recordedKind: recordedStage.actorKind,
    });
    const isProposer = ["proposer", "solution-proposer"].includes(recordedRole);
    const verifier = recordedRole === "verifier";
    const copy = isProposer
      ? PROPOSER_STAGE_COPY[actor.id] || {
          roleLabel: "Develop a possible solution",
          summary:
            "Produces the smallest evidence-grounded change for the detected issue; it does not approve that change.",
        }
      : EVALUATOR_STAGE_COPY[actor.id] || {
          roleLabel: verifier
            ? "Verify evidence fidelity"
            : "Evaluate the issue and solution",
          summary: verifier
            ? "Checks that the critic-reviewed candidate still preserves every supported activity meaning."
            : "Judges the diagnosis and proposed solution separately before expert review.",
        };
    const promptVersion = recordedVersion(
      actor.id,
      recordedStage.promptVersion ||
        (!isProposer ? evidence.judgePromptVersion : undefined),
      isProposer
        ? "Proposer prompt version not captured"
        : "Evaluator prompt version not captured",
    );
    const disclosure = disclosureFor({
      actor,
      roleLabel: copy.roleLabel,
      promptVersion,
    });
    stages.push(
      stage({
        id: `${
          isProposer
            ? "solution-generation"
            : verifier
              ? "content-verification"
              : "issue-solution-evaluation"
        }:${actor.id}:${stages.length + 1}`,
        sequence: stages.length + 1,
        role: isProposer
          ? "solution-generation"
          : verifier
            ? "content-verification"
            : "issue-solution-evaluation",
        roleLabel: copy.roleLabel,
        actorId: actor.id,
        actorName: actor.name,
        actorKind: actor.kind,
        summary: copy.summary,
        promptVersion,
        ...disclosure,
      }),
    );
  }

  if (!evaluatorLineage.length) {
    stages.push(
      stage({
        id: "issue-solution-evaluation:not-recorded",
        sequence: stages.length + 1,
        role: "issue-solution-evaluation",
        roleLabel: "Evaluate the issue and solution",
        actorId: "no-separate-evaluator-recorded",
        actorName: "No separate evaluator recorded",
        actorKind: "recorded-component",
        summary:
          "This historical record does not identify a separate critic or judge.",
        promptVersion: "No evaluator prompt version recorded",
        ...unavailableDisclosure("Evaluate the issue and solution", {
          name: "No separate evaluator recorded",
          identitySource: "missing",
        }),
      }),
    );
  }

  const explicitAssembler = lineage.find((item) =>
    ["assembler", "proposal-assembler"].includes(clean(item.role)),
  );
  const assembler = explicitAssembler
    ? actorIdentity({
        actorId: clean(explicitAssembler.actorId),
        recordedKind: explicitAssembler.actorKind,
      })
    : actorIdentity({ actorId: "no-proposal-assembler-recorded" });
  const assemblerVersion = explicitAssembler
    ? recordedVersion(
        assembler.id,
        explicitAssembler.promptVersion,
        "Assembler rules version not captured",
      )
    : "No assembler rules version recorded";
  const assemblerDisclosure = disclosureFor({
    actor: assembler,
    roleLabel: "Generate the review proposal",
    promptVersion: assemblerVersion,
  });
  stages.push(
    stage({
      id: "proposal-generation",
      sequence: stages.length + 1,
      role: "proposal-generation",
      roleLabel: "Generate the review proposal",
      actorId: assembler.id,
      actorName: assembler.name,
      actorKind: assembler.kind,
      summary:
        "Converts the accepted or corrected candidate into a snapshot-bound, human-reviewable card.",
      promptVersion: assemblerVersion,
      ...assemblerDisclosure,
    }),
  );

  return {
    title: "Agents and prompts used for this proposal",
    summary:
      "Inspect every recorded model agent, deterministic check, human-expert step, and its source-backed prompt template or decision rules.",
    runtimeInputNote:
      "This panel shows recorded prompt templates or deterministic rules when the source preserves them. Bracketed placeholders replace runtime ontology data and policy inserts. Confidence scores and raw model outputs are outside this panel; historical gaps are labeled explicitly.",
    stages,
  };
};
