# Sell semantic coverage review

Snapshot-bound review of whole-ontology semantic recall and explicit
O*NET-derived Sell specializations before downstream regeneration.

- Dataset: `sell-rob-semantic-coverage-2026-07-29-v1`
- Content revision: `3`
- Review: https://ontology.mit.edu/review?dataset=sell-semantic-coverage
- Safety: responses are review records only. A separately reviewed application
  plan is required before any ontology mutation.
- Provenance: `Rent out` and `Lease out` already existed in the July 15
  baseline, and Rob accepted merging `Lease out` into `Rent out`. A later
  collection-design contract incorrectly allowed new activity branches, which
  the application materialized as two nodes. Those wrappers have been retired
  and `Rent out` is again directly under `Sell`. See
  `diagnostics/accepted_structure_provenance.json` and
  `diagnostics/collection_design_node_repair.json`.
- Collection invariant: collection design may assign existing direct children
  to a named bucket; a new activity or intermediate node requires a separate
  proposal and review.
- Cleanup: empty nodes and named empty collections are detected now but remain
  unreleased until upstream decisions are propagated and the branch is
  regenerated.
