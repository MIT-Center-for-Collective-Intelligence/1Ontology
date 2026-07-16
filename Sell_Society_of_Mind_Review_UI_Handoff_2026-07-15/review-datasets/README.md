# Sell Society of Mind review datasets

Dataset version: `sell-final-hierarchy-onet-2026-07-15-v2`

This package contains 71 atomic, review-only proposals and 11 controls for the
Sell sub-ontology. It separates diagnostic judgments from exact structural
actions:

- **Title clarity**: 36 proposed renames and 11 status-quo controls.
- **Sibling grouping**: 8 proposed intermediate nodes.
- **Duplicate or synonym**: 1 same-activity judgment.
- **Placement**: 3 current-parent judgments.
- **Wrong main verb**: 7 activities whose action may not be Sell.
- **Structural overlap**: 2 cross-collection overlap judgments.
- **Merge nodes**: 3 exact consolidation plans with named survivors.
- **Exact relocation**: 0 proposals because no advisory destination was both
  precise and verified as the intended current target.
- **Missing activity**: 10 high-confidence additions revalidated against the
  current snapshot.
- **Redundant node**: 1 exact wrapper-removal plan.

These are all accepted candidates found by the packaged detector outputs and
the snapshot-bound action audit. This is not a claim that a semantic scan can
prove the absence of every other possible ontology issue.

Optional description and synonym enrichment is not treated as an issue queue
in this package. The current source snapshot has no structured synonym field,
and the older enrichment suggestions predate this snapshot. They need a fresh
metadata export and a separate atomic review contract before they can be shown
without presenting stale current state or combining several judgments.

## Reviewer interaction

- Let the reviewer choose one issue type, then serve up to 10 items of that
  type per session. The selector count is the full remaining queue, not the
  session size.
- Show one item at a time. Agree advances immediately without a page reload.
- Disagree opens a required reason field; submit advances after validation.
- Do not display `internalModelEvidence` or model confidence to reviewers.
- Keep optional context collapsed by default; grouping uses a compact before/after outline.
- Save decisions separately. No decision in this package authorizes an ontology write.

See `manifest.json` for counts, file locations, and the full UI contract.

## Regeneration

After refreshing the Firestore snapshot, rebuild the comprehensive candidate
inventory with:

```bash
node scripts/som-review/expand-comprehensive-sell-dataset.mjs
```

The generator fails if an exact proposal references a missing node or current
relationship. It intentionally leaves exact relocation empty when only a
free-text destination hint exists.
