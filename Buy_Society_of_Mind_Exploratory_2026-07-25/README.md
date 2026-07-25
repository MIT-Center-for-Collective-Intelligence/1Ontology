# Buy exploratory transfer run

This package tests whether the review workflow learned on `Sell` transfers to
the `Buy` sub-branch without giving the detector agents Sell examples or Rob's
Sell answers.

## Review boundary

Only the ten `title-clarity` proposals are released for review. Every other
proposal is provisional and marked as awaiting regeneration. After the title
decisions are applied to a new ontology copy, rerun the pipeline before opening
content, identity, structure, placement, or exact-action queues.

The packaged downstream candidates remain useful as diagnostics, but they are
not the next expert-review workload.

## Safety

- The generator reads the selected Firestore ontology and writes a local
  snapshot-bound dataset.
- Generation does not modify Firestore.
- Reviewing or approving a proposal does not authorize an ontology write.
- Exact merges and relocations remain separately gated by their diagnoses.
- Agent outputs are hypotheses for expert review, not validated corrections.

## Reproduce

The generator loads credentials from the repository environment:

```sh
node scripts/som-review/generate-exploratory-subbranch-dataset.mjs \
  --branch Buy \
  --environment production \
  --ontology-app 'final-hierarchy-with-o*net-rob-structure-applied-2026-07-25' \
  --ontology-name 'Final Hierarchy with O*Net - Rob Structure Applied 2026-07-25' \
  --dataset-version 'buy-exploratory-transfer-2026-07-25-v1' \
  --output 'Buy_Society_of_Mind_Exploratory_2026-07-25/review-datasets-exploratory-v1'
```

To inspect the package locally:

```sh
SOM_REVIEW_DATASET_DIR="$PWD/Buy_Society_of_Mind_Exploratory_2026-07-25/review-datasets-exploratory-v1" \
  npm run dev -- -p 3011
```

The complete candidate and rejection trail is in `diagnostics/`.
