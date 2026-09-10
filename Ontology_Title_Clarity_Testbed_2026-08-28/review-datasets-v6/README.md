# Two-route ontology-wide title test bed

This read-only reviewer-interface pilot contains 18 title-evidence cases: 17 retained from the prior pilot for comparison and Rob's 133-description Conduct Research case. It contains 1 keep, 6 rename, 11 split, and 0 defer proposals, producing 61 homogeneous groups. These are model-generated proposals, not accuracy results or gold labels.

## Procedure

1. A concise one-description prompt checks whether one title clearly and accurately describes its one linked activity.
2. A separate multi-description prompt groups like activities into the smallest useful set of homogeneous categories. Every description is assigned exactly once.
3. Deterministic code checks exact coverage, title length, preserved leading verb, reasons, and confidence, then derives title status and keep/rename/split/defer. It does not make a semantic judgment.
4. An independent ACCESS-funded release audit checks the complete pilot for material semantic defects. The packaged audit found 0; this does not replace Rob's expert review.
5. Rob reviews the proposal. No review action mutates the ontology.
6. Only after title acceptance, retrieve every local WordNet candidate for the exact action phrase and compare all candidates, the inherited assignment, and accepted evidence in one call.

Identical title-evidence cases are modeled once: 15,994 calls cover 20,491 ontology occurrences, avoiding 4,497 duplicate calls.

## Full-run planning scenarios

The branch-by-evidence-bucket extrapolation yields 24,647 groups and 40,641 total title-plus-WordNet calls. Its central ACCESS planning allowance is about 57 million tokens, with 7.3 modeled hours at 32-way concurrency. These are fragile sensitivity scenarios, not measured cost or duration.
