# Buy content and identity review

This package is bound to the isolated ontology copy created after Rob approved
the three titles in the Buy title follow-up.

## Review boundary

The released review path is dependency gated:

1. Review 14 newly detected title clarifications.
2. Review one proposed mistaken-synonym removal, one duplicate-activity
   diagnosis, and two repeated-facet diagnoses.
3. If a duplicate diagnosis is approved, review its separate exact merge
   action while the decision is still fresh.

Structure and placement candidates are retained as diagnostics only. They must
be regenerated after the content and identity decisions are applied.

All 13 titles approved in the first two Buy title waves are locked while their
linked O\*NET evidence remains unchanged.

## Agent safeguards

- A close lexical or morphological variant is treated as evidence for keeping
  a synonym, not removing it.
- A synonym removal must identify a meaningfully different activity.
- Terms coordinated by "and", "or", or "other" are not treated as synonyms
  without separate evidence of substitutability.
- Broader, narrower, preparatory, and adjacent activities are rejected as
  duplicate synonyms.
- Every exact merge remains gated by its related diagnosis.

## Safety

- The source ontology was not modified.
- The three approvals were applied to a separate full ontology copy.
- Generation is read-only and snapshot-bound.
- Review responses do not change either ontology.
- Later proposal families remain unavailable until regeneration.

## Reproduce

```sh
node scripts/som-review/generate-exploratory-subbranch-dataset.mjs \
  --branch Buy \
  --environment production \
  --ontology-app 'final-hierarchy-with-o*net-rob-buy-title-followup-applied-2026-07-26' \
  --ontology-name 'Final Hierarchy with O*Net - Rob Buy Title Follow-up Applied 2026-07-26' \
  --dataset-version 'buy-content-identity-after-title-followup-2026-07-26-v1' \
  --review-wave content-identity \
  --approved-title-benchmark 'artifacts/rob-buy-title-followup-review-2026-07-26/rob-buy-approved-title-locks.json' \
  --output 'Buy_Society_of_Mind_Content_Identity_2026-07-26/review-datasets-content-identity-v1' \
  --resume true
```

Each model stage is checkpointed locally under `.stage-cache`. The cache is
ignored by Git and reused only when its input hash, including the relevant
prompt version, matches.
