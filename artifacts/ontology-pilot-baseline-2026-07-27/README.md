# Ontology Pilot Baseline

- `tom-review-brief.md`: blind-first instructions and compact Sell audit for Tom.
- `study-baseline.md`: human-readable aggregate audit across all Sell and Buy rounds.
- `study-baseline.json`: machine-readable metrics and SHA-256 inventories.
- Reviewer free text is excluded from this public package.

Regenerate from the repository root:

```bash
node scripts/som-review/export-study-baseline.mjs --environment production --out-dir artifacts/ontology-pilot-baseline-2026-07-27 --focus-reviewer-email <email> --focus-reviewer-label expert-steward
```

The exporter reads review data and writes local artifacts. It does not mutate Firestore or an ontology.

To create the private disagreement appendix, rerun into a non-repository directory with `--include-focus-free-text true`. Do not publish that file without a disclosure-risk review and reviewer approval.
