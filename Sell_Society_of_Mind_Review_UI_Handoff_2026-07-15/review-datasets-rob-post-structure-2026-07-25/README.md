# Sell post-structure review wave

Dataset version: `sell-rob-post-structure-2026-07-25-v1`

Source ontology:
`Final Hierarchy with O*Net - Rob Structure Applied 2026-07-25`
(`final-hierarchy-with-o*net-rob-structure-applied-2026-07-25`)

This package was regenerated after validating and applying Rob's completed
grouping, collection, placement, wrong-verb, and exact-relocation reviews to a
separate ontology copy. The preceding ontology copies were not modified.

Applied decisions include:

- eight accepted or expert-corrected intermediate groupings;
- one rejected grouping retained in the audit and suppressed from later waves;
- the ownership-versus-temporary-use collection under `Sell`;
- 20 exact relocation decisions, including two moves satisfied through the
  corrected `Sell Travel Services` grouping; and
- a new `Promote` activity under `Persuade` for the seven corrected `Market`
  activities.

The source and target graph digests, benchmark hashes, reciprocal-edge checks,
and every applied operation are recorded in
`diagnostics/structure_application_audit.json`.

## Current review scope

All resolved content, grouping, collection, placement, wrong-verb, merge, and
relocation queues contain zero proposals. The only remaining generated work is
explicitly optional:

- 55 description proposals; and
- 10 missing-activity proposals.

The application keeps these checks at the bottom of the task list and labels
them optional. They do not block discussion or use of the applied Sell
structure.

## Regeneration

Rebind the previous wave to the applied ontology and remove stale records:

```bash
node scripts/som-review/sync-live-sell-dataset.mjs \
  --input-dir Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15/review-datasets-rob-structure-wave-2026-07-24 \
  --output-dir Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15/review-datasets-rob-post-structure-2026-07-25 \
  --ontology-app-id 'final-hierarchy-with-o*net-rob-structure-applied-2026-07-25' \
  --ontology-name 'Final Hierarchy with O*Net - Rob Structure Applied 2026-07-25' \
  --dataset-version sell-rob-post-structure-2026-07-25-v1 \
  --drop-stale true \
  --environment production
```

Then regenerate snapshot-bound candidates:

```bash
node scripts/som-review/expand-comprehensive-sell-dataset.mjs \
  --directory Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15/review-datasets-rob-post-structure-2026-07-25 \
  --dataset-version sell-rob-post-structure-2026-07-25-v1 \
  --review-wave quality \
  --application-audit artifacts/rob-structure-review-2026-07-25/structure-application-audit.json
```

Seeded Sell placement cases are documented as expert-derived development cases,
not independent LLM detections. Applied cases and explicitly rejected
groupings are suppressed during regeneration.
