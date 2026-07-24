# Sell content-correction review wave

Dataset version: `sell-rob-content-wave-2026-07-24-v1`

Source ontology:
`Final Hierarchy with O*Net - Rob Content Review 2026-07-24`
(`final-hierarchy-with-o*net-rob-content-review-2026-07-24`)

This package was generated after validating Rob's completed content decisions
against the prior frozen dataset and applying only the approved changes to a
separate ontology copy. The original ontology and the preceding title-review
copy were not modified.

Applied changes:

- removed three mistaken `Market...` synonym annotations;
- merged `Sell Makeup` into `Sell Cosmetics`;
- merged `Sell (Physical Object)` into `Sell physical objects`; and
- merged `Sell (Information)` into `Sell information`.

The active review wave contains two corrected identity diagnoses and their
separately gated exact merge actions:

- compare `Lease out` with `Rent out`; and
- compare `Sell Merchandise` with the existing `Sell Products` node.

Rob's rejected `Sell Merchandise` to `Sell Items` proposal is not reused.
Downstream grouping, collection, placement, relocation, description, and
missing-activity queues are packaged for audit but intentionally unreleased
until the two remaining identity decisions are resolved, applied to another
snapshot, and regenerated.

## Reviewer interaction

- Present source O\*NET evidence expanded by default, while allowing the
  reviewer to collapse it.
- Collect the diagnosis before showing its exact merge or relocation action.
- Make an action available only after that reviewer agrees with its linked
  diagnosis. A disagreement makes the action unnecessary for that reviewer.
- Show one proposal at a time. Agree advances immediately; disagree requires a
  rationale.
- Preserve saved judgments and allow reviewers to return to any completed item.
- Do not expose model identity or confidence.
- Store review decisions separately. No review decision writes to Firestore.
- Revalidate every accepted exact action against a fresh ontology snapshot
  before implementation.
- Treat “review complete” and “changes propagated” as separate states.

## Regeneration

First export and rebind the previous package to the post-content-review ontology
copy, dropping stale records:

```bash
node scripts/som-review/sync-live-sell-dataset.mjs \
  --input-dir Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15/review-datasets \
  --output-dir Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15/review-datasets-rob-content-wave-2026-07-24 \
  --ontology-app-id 'final-hierarchy-with-o*net-rob-content-review-2026-07-24' \
  --ontology-name 'Final Hierarchy with O*Net - Rob Content Review 2026-07-24' \
  --dataset-version sell-rob-content-wave-2026-07-24-v1 \
  --exclude-issue-types title-clarity \
  --drop-stale true \
  --environment production
```

Then regenerate the supported detectors and their dependent actions:

```bash
node scripts/som-review/expand-comprehensive-sell-dataset.mjs \
  --directory Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15/review-datasets-rob-content-wave-2026-07-24 \
  --dataset-version sell-rob-content-wave-2026-07-24-v1 \
  --review-wave content-corrections \
  --application-audit artifacts/rob-content-review-2026-07-24/content-application-audit.json
```

`diagnostics/stale_records.jsonl` explains each discarded pre-split proposal.
`diagnostics/comprehensive_candidate_audit.json` records the regenerated
candidate inventory and methodological limits. Rejected candidates inherited
from the superseded pre-split run are retained only as explicitly historical
diagnostics and are not counted as candidates for this cycle.
`diagnostics/content_application_audit.json` records the benchmark hashes,
approved operations, source and target digests, and graph-integrity checks.

## Scope boundary

The app retains contracts for all 13 issue families in Rob's design document,
but this package does not prove that every possible semantic defect has been
found. It is exhaustive only for its documented deterministic scans and
packaged candidate generators.
