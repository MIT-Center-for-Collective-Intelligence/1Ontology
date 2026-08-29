# Ontology-wide homogeneous title test bed

This review-only dataset packages the deterministic 18-title sample discussed by Iman and Rob. It contains 18 homogeneous title decisions and 42 dependent WordNet alignment decisions.

## Review order

1. Review **Clarify titles through homogeneous evidence groups**.
2. Accepting one title decision releases only its corresponding WordNet card or cards. Rejecting it makes those dependent cards not applicable.
3. No decision writes to the ontology. New split titles remain provisional until a later placement review.

## Full-run planning estimate

The source contains 20,491 atomic occurrences and 53,608 O*NET records. The central projection produces about 35,980 homogeneous groups and 112,942 model calls. Its central planning estimate is 223 million ACCESS tokens and 33.8 hours at the stated concurrency assumptions. These are planning values, not metered usage; see `diagnostics/full-run-estimate.json` for the range and caveats.

## Reproduce

Run the local grouping and WordNet validators, regenerate `full-run-estimate.json`, then run `node scripts/som-review/build-homogeneous-title-review-dataset.mjs`. The source hierarchy hash is `f19ce789bce298b0564045fb87427eebd1193b89c133d17519c097dc3e0eb319`.
