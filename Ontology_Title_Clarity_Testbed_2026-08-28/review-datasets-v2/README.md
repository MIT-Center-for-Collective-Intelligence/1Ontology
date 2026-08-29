# Streamlined ontology-wide title test bed

This review-only dataset packages the deterministic 18-title sample discussed by Iman and Rob. It contains 7 keep, 4 rename, 7 split, and 0 defer decisions, producing 48 homogeneous groups.

## Procedure

1. One concise model call groups each title's O*NET records. Each record is assigned exactly once.
2. Deterministic validation derives title status and the keep/rename/split/defer decision.
3. Rob reviews the title proposal. No review action mutates the ontology.
4. Only after title acceptance, compare the accepted group with its assigned synset. Retrieve all local candidates and make a second model call only when the assigned sense fails.

## Full-run estimate

The central projection is 37,464 groups, 72,227 model calls, about 83 million ACCESS tokens, and 11.8 hours at 32-way concurrency. These are planning values, not metered usage.
