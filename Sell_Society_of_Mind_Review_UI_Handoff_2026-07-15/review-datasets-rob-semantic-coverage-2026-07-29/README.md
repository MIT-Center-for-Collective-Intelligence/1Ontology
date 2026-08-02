# Sell semantic coverage review

Snapshot-bound review of whole-ontology semantic recall and explicit
O\*NET-derived Sell specializations before downstream regeneration.

- Generated: 2026-07-30T01:01:43.000Z
- Dataset: `sell-rob-semantic-coverage-2026-07-29-v1`
- Review: https://ontology.mit.edu/review?dataset=sell-semantic-coverage
- Safety: responses are review records only. A separately reviewed application
  plan is required before any ontology mutation.
- Review flow: each potentially missing node is one decision showing its source
  evidence, current hierarchy path, and proposed hierarchy path together.
- Provenance: `Rent out` and `Lease out` already existed in the July 15
  baseline. Rob accepted merging `Lease out` into `Rent out`; afterward he
  accepted proposal `som-f0464db076534dd0bde0`, which created the
  `Sell temporary use` wrapper and moved `Rent out` beneath it. See
  `diagnostics/accepted_structure_provenance.json`.
- Cleanup: empty nodes and named empty collections are detected now but remain
  unreleased until upstream decisions are propagated and the branch is
  regenerated.
