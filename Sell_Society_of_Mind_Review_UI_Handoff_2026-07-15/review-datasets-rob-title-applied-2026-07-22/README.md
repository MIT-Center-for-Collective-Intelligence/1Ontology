# Sell Society of Mind review datasets

Dataset version: `sell-rob-title-applied-title-pass-2026-07-22-v1`

This package contains atomic, review-only proposals for the Sell sub-ontology. Only the new **Title clarity** pass is served. Regenerated downstream candidates are retained in diagnostics until the title decisions are applied and those agents are rerun.

## Reviewer interaction

- Let the reviewer choose one issue type, then serve 10-15 items of that type.
- Show one item at a time. Agree advances immediately without a page reload.
- Disagree opens a required reason field; submit advances after validation.
- Do not display `internalModelEvidence` or model confidence to reviewers.
- Keep optional context collapsed by default; grouping uses a compact before/after outline.
- Save decisions separately. No decision in this package authorizes an ontology write.

See `manifest.json` for counts, file locations, and the full UI contract.
