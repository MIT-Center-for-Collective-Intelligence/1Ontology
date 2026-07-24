# Sell structure-and-placement review wave

Dataset version: `sell-rob-structure-wave-2026-07-24-v1`

Source ontology:
`Final Hierarchy with O*Net - Rob Structure Review 2026-07-24`
(`final-hierarchy-with-o*net-rob-structure-review-2026-07-24`)

This package was generated after validating Rob's completed identity diagnoses
and exact merge decisions against the preceding content-review dataset. The
approved changes were applied to a separate ontology copy; neither the original
ontology nor the preceding review copies were modified.

Newly applied changes:

- merged `Lease out` into `Rent out`, retaining `Lease out` as a synonym; and
- merged `Sell Merchandise` into `Sell Products`, retaining
  `Sell Merchandise` as a synonym and transferring four direct O\*NET children.

The active wave contains regenerated structure and placement work:

- 3 long-flat-list grouping proposals;
- 6 compound-object grouping proposals;
- 1 collection-design proposal;
- 12 within-sub-branch placement diagnoses;
- 8 wrong-verb diagnoses; and
- 20 exact relocations, each gated by its corresponding diagnosis.

Completed content diagnoses and merge actions are absent from this cycle.
Descriptions, missing activities, and redundant-node checks remain packaged
but intentionally unreleased as optional work while structure is reviewed.

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

First export and rebind the content-wave package to the post-merge ontology
copy, dropping stale records:

```bash
node scripts/som-review/sync-live-sell-dataset.mjs \
  --input-dir Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15/review-datasets-rob-content-wave-2026-07-24 \
  --output-dir Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15/review-datasets-rob-structure-wave-2026-07-24 \
  --ontology-app-id 'final-hierarchy-with-o*net-rob-structure-review-2026-07-24' \
  --ontology-name 'Final Hierarchy with O*Net - Rob Structure Review 2026-07-24' \
  --dataset-version sell-rob-structure-wave-2026-07-24-v1 \
  --exclude-issue-types title-clarity \
  --drop-stale true \
  --environment production
```

Then regenerate the supported detectors and their dependent actions:

```bash
node scripts/som-review/expand-comprehensive-sell-dataset.mjs \
  --directory Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15/review-datasets-rob-structure-wave-2026-07-24 \
  --dataset-version sell-rob-structure-wave-2026-07-24-v1 \
  --review-wave structure \
  --application-audit artifacts/rob-content-review-wave2-2026-07-24/content-application-audit.json
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
