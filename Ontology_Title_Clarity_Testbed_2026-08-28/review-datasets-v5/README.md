# Claim-aware ontology-wide title test bed

This read-only reviewer-interface pilot contains 18 title occurrences, including repeated-title and 21+-record cases in every top-level branch. It contains 5 keep, 3 rename, 8 split, and 2 defer proposals, producing 30 homogeneous groups. These are model-generated proposals, not accuracy results or gold labels.

## Procedure

1. One semantic call extracts source-supported predicate-object claims and groups claims under 2-5-word titles. A record may support multiple titles only through distinct direct objects governed by the current action.
2. Deterministic validation binds every claim to an exact quote and source record, checks title form and action preservation, and derives title status and keep/rename/split/defer.
3. Rob reviews the title proposal. No review action mutates the ontology.
4. Only after title acceptance, retrieve every local WordNet candidate for the exact action phrase and compare all candidates, the inherited assignment, and accepted evidence in one call.

## Full-run planning scenarios

The branch-by-evidence-bucket extrapolation yields 26,765 groups and 47,256 model calls. Its central ACCESS planning allowance is about 77 million tokens, with 8.5 modeled hours at 32-way concurrency. These are fragile sensitivity scenarios, not measured cost or duration.
