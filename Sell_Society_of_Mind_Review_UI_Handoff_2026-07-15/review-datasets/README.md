# Sell Society of Mind review datasets

Dataset version: `sell-final-hierarchy-onet-2026-07-15-v3`

This package contains 143 atomic, review-only proposals and 11 title-clarity
controls for the Sell sub-ontology. Its first 13 queues correspond one-to-one
with the tasks in Rob's July 9 document:

1. Clarify unclear titles.
2. Add missing structured synonyms.
3. Add missing or non-substantive descriptions.
4. Find repeated miscellaneous/facet nodes.
5. Remove mistaken synonyms.
6. Find undetected synonyms.
7. Separate polysemous nodes.
8. Group long flat lists.
9. Group compound objects found in O*NET evidence.
10. Create warranted collections.
11. Correct placement within Sell.
12. Identify activities whose main verb is not Sell.
13. Move only the non-selling sense of a polysemous node.

Separate final-action queues show exact node merges and relocations. These
items remain unavailable to a reviewer until that reviewer agrees with the
corresponding diagnosis. A rejected prerequisite marks the action as not
applicable. Missing-activity checks remain an additional pipeline quality
queue; the unsafe `Sell (Other)` wrapper removal is not served because its
only child is polysemous.

The package represents every documented issue family, but it does not claim
that a finite semantic scan can prove every possible Sell defect has been
found. `manifest.json` records this boundary explicitly.

## Reviewer interaction

- Present queues in task order within five stages: node content, structure
  within Sell, movement outside Sell, exact actions, and additional checks.
- Serve up to 10 items of one type per session. The selector count is the full
  remaining queue, not the session size.
- Show one item at a time. Agree advances immediately; disagree requires a
  reason before advancing.
- Keep source O*NET tasks collapsed by default.
- Do not expose `internalModelEvidence`, model identity, or confidence.
- Store decisions separately. No review decision writes to the ontology.
- Revalidate every accepted exact action against a fresh Firestore snapshot
  before implementation.

## Regeneration

Refresh the read-only Firestore snapshot, then rebuild the complete inventory:

```bash
node scripts/som-review/sync-live-sell-dataset.mjs \
  --input-dir Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15/review-datasets \
  --output-dir Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15/review-datasets \
  --environment production

node scripts/som-review/expand-comprehensive-sell-dataset.mjs \
  --directory Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15/review-datasets
```

Both scripts fail closed on missing nodes, stale relations, invalid metadata,
or dependency errors. Regeneration also removes obsolete per-queue files.
