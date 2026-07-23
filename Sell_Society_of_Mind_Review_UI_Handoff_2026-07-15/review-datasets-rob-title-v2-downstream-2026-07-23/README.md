# Sell review cycle after Rob's title decisions

Dataset version: `sell-rob-title-v2-downstream-2026-07-23-v2`

Source ontology:
`Final Hierarchy with O*Net - Rob Title Review v2 2026-07-23`
(`final-hierarchy-with-o*net-rob-title-review-v2-2026-07-23`)

This package contains 137 atomic, review-only proposals generated after Rob
approved all four title-split follow-ups. Those decisions reassigned their
O\*NET evidence in a separate ontology copy: four source nodes were retained
and renamed, 13 new nodes were created, and generic evidence was reassigned to
the existing `Sell Products` node. The original ontology was not modified.

The title queue is empty because its decisions have already been applied.
Current unresolved work includes:

- 1 missing-synonym enrichment and 7 meaning/identity diagnoses;
- 9 grouping designs and 1 collection design;
- 20 placement diagnoses;
- 24 exact merge or relocation actions, each gated by its diagnosis;
- 65 optional descriptions; and
- 10 optional missing-activity checks.

Three issue families currently have no live item: title clarification is
complete, the combined `Sell Products or Ideas` polysemy has already been
split, and no redundant wrapper passes the current detector.

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

## Regeneration

First export and rebind the previous proposal package to the current ontology,
dropping stale and completed title records:

```bash
node scripts/som-review/sync-live-sell-dataset.mjs \
  --input-dir Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15/review-datasets \
  --output-dir Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15/review-datasets-rob-title-v2-downstream-2026-07-23 \
  --ontology-app-id final-hierarchy-with-o*net-rob-title-review-v2-2026-07-23 \
  --dataset-version sell-rob-title-v2-downstream-2026-07-23-v1 \
  --exclude-issue-types title-clarity \
  --drop-stale true \
  --environment production
```

Then regenerate the supported detectors and their dependent actions:

```bash
node scripts/som-review/expand-comprehensive-sell-dataset.mjs \
  --directory Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15/review-datasets-rob-title-v2-downstream-2026-07-23 \
  --dataset-version sell-rob-title-v2-downstream-2026-07-23-v2
```

`diagnostics/stale_records.jsonl` explains each discarded pre-split proposal.
`diagnostics/comprehensive_candidate_audit.json` records the regenerated
candidate inventory and methodological limits. Rejected candidates inherited
from the superseded pre-split run are retained only as explicitly historical
diagnostics and are not counted as candidates for this cycle.

## Scope boundary

The app retains contracts for all 13 issue families in Rob's design document,
but this package does not prove that every possible semantic defect has been
found. It is exhaustive only for its documented deterministic scans and
packaged candidate generators.
