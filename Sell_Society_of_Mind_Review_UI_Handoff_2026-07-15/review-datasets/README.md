# Sell Society of Mind review datasets

Dataset version: `sell-final-hierarchy-onet-2026-07-15-v4`

This package contains 131 atomic, review-only proposals and 11 title-clarity
controls for the Sell sub-ontology. It covers every task in Rob's July 9
document. Queue numbers are assigned from the current vertical order in the
review application, so they remain correct when tasks are reordered or added.
The issue families are therefore listed without fixed numbers here:

- Clarify unclear titles.
- Add missing structured synonyms.
- Remove mistaken synonyms.
- Find undetected synonyms.
- Separate polysemous nodes.
- Find repeated miscellaneous/facet nodes.
- Group long flat lists.
- Group compound objects found in O\*NET evidence.
- Create warranted collections.
- Correct placement within the current sub-branch.
- Identify misjudged synonyms that may belong beyond the current sub-branch.
- Move only the separated non-selling sense of a polysemous node.
- Review exact node merges and relocations after their diagnoses are approved.
- Add missing or non-substantive descriptions and find missing activities as
  optional checks during initial restructuring.

Separate follow-up queues show specific node merges and relocations. These
items remain unavailable to a reviewer until that reviewer agrees with the
corresponding diagnosis. A rejected prerequisite marks the action as not
applicable. Missing descriptions and missing-activity checks are optional
during the initial restructuring review. The unsafe `Sell (Other)` wrapper
removal is not served because its only child is polysemous.

Twelve title proposals that only changed grammatical number are deferred until
the team adopts an ontology-wide singular/plural title policy. The original
title pilot supplied 11 unchanged controls, all of which remain in the review
pack; they are 23.4% of the original 47 title-review cards.

The package represents every documented issue family, but it does not claim
that a finite semantic scan can prove every possible Sell defect has been
found. `manifest.json` records this boundary explicitly.

## Reviewer interaction

- Present queues in their current vertical order within five stages: node
  content, structure within the sub-branch, movement beyond the sub-branch,
  follow-up change proposals, and additional optional checks. Derive displayed
  numbers from that order rather than storing them in queue labels.
- Serve up to 10 items of one type per session. The selector count is the full
  remaining queue, not the session size.
- Show one item at a time. Agree advances immediately; disagree requires a
  reason before advancing.
- Keep source O\*NET evidence collapsed by default so reviewers can inspect it
  without making every card longer or anchoring every initial judgment.
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
