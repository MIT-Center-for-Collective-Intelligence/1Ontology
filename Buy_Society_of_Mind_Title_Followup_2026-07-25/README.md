# Buy title follow-up run

This package is bound to the isolated ontology copy created after Rob approved
all ten titles in the first `Buy` review wave.

## Review boundary

Only three newly detected `title-clarity` proposals are released. Every
content, identity, merge, structure, placement, and optional proposal is
diagnostic until these title decisions are applied and the pipeline is run
again.

The generator excludes a previously approved title when its O*NET evidence is
unchanged. This prevents a stochastic model pass from reopening settled expert
decisions. The excluded candidates remain visible in
`diagnostics/rejected_agent_candidates.jsonl`.

## Safety

- The source ontology was not modified.
- The title approvals were applied to a separate full ontology copy.
- Generation is read-only and snapshot-bound.
- Review responses do not change either ontology.
- Later proposal families remain unavailable until regeneration.

## Reproduce

```sh
node scripts/som-review/generate-exploratory-subbranch-dataset.mjs \
  --branch Buy \
  --environment production \
  --ontology-app 'final-hierarchy-with-o*net-rob-buy-titles-applied-2026-07-25' \
  --ontology-name 'Final Hierarchy with O*Net - Rob Buy Titles Applied 2026-07-25' \
  --dataset-version 'buy-title-followup-after-initial-review-2026-07-25-v1' \
  --review-wave title-followup \
  --approved-title-benchmark 'artifacts/rob-buy-title-review-2026-07-25/rob-buy-title-benchmark.json' \
  --output 'Buy_Society_of_Mind_Title_Followup_2026-07-25/review-datasets-title-followup-v1' \
  --resume true
```

Each model stage is checkpointed locally under `.stage-cache`. The cache is
ignored by Git and reused only when its input hash matches.
