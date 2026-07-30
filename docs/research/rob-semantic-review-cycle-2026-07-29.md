# Rob Semantic Review Cycle

Date: July 29, 2026

Sources:

- July 28 meeting between Iman YeckehZaare and Rob Laubacher
- Rob's pre-meeting Slack requirements
- `Society of Mind's transcript (1).txt`
- `SellOutlineInput2026-07-28.docx`

## Implemented decisions

| Meeting decision                                                   | Implementation                                                                                                 | Verification                                                                                                |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Search the complete ontology for activities missing from Sell      | OpenAI embeddings rank 18,616 outside-branch semantic nodes; Gemini judges the bounded retrieval set           | Generation audit records all candidates, prompts, models, and judgments                                     |
| Do not miss direct seller-side evidence below the embedding cutoff | Deterministic provider-side Rent/Lease patterns scan all 18,616 candidates before union with ranked candidates | Unit test proves direct-evidence candidates are added after ranking                                         |
| Keep buyer-side renting out of Sell                                | Only direct provider-side evidence or an allowlisted model classification/destination can enter expert review  | `Rent Necessity` remains excluded; 8 provider-side candidates are released                                  |
| Let the expert decide                                              | All detections create review-only records; confidence never authorizes mutation                                | Manifest sets `mutatesOntology: false`; exact changes require reviewed IDs and a later application plan     |
| Make each exact move a separate decision                           | Each semantic diagnosis has one dependency-gated relocation to `Rent out`                                      | Dataset test checks all 8 diagnosis/action links                                                            |
| Create specific nodes from explicit O\*NET wording early           | Deterministic text rules release 3 explicit-modifier specializations                                           | Broader model-only proposals remain in diagnostics                                                          |
| Check empty nodes and collections last                             | Separate snapshot-bound empty-node and empty-collection issue types are generated as deferred manual checks    | Current snapshot has 3 empty nodes and 0 empty named collections                                            |
| Let Rob inspect his own prior work by task                         | Inspection opens a completed-task dashboard; each task opens all responses on one scrollable page              | Self-review defaults to Rob when available; annotations are disabled; source-task editing remains available |
| Let Tom inspect Rob without repeating the review                   | Tom reads Rob's selected response, rationale, and alternative and records only exceptions                      | Exception records are separate and cannot overwrite Rob's responses                                         |
| Keep non-expert review simple and comparable                       | Calibration exposes one frozen expert-consensus task set and one item at a time                                | Participant answers use separate collections and never propagate                                            |

## Released review wave

- Dataset: `sell-rob-semantic-coverage-2026-07-29-v1`
- Production ontology copy:
  `final-hierarchy-with-o*net-rob-structure-applied-2026-07-25`
- Snapshot SHA-256:
  `c362f9d3587dbed1303a7355b7d5feef8057684544857139f0178a1038b687b2`
- Released diagnoses: 8
- Released exact relocations: 8
- Released O\*NET specializations: 3
- Deferred empty-node checks: 3
- Deferred empty-collection checks: 0

## Provenance resolution

`Sell ownership` and `Sell temporary use` were not hidden model mutations.
Collection-design proposal `som-f0464db076534dd0bde0` was presented to Rob in
the July 24 structure wave. Rob agreed, and the separately audited application
created those nodes in a new ontology copy and moved `Rent out` under
`Sell temporary use`. The released dataset includes the source hashes and
verified target digest in
`diagnostics/accepted_structure_provenance.json`.

## Deferred until current review propagates

1. Apply only reviewed and resolved semantic/evidence decisions to a new copy.
2. Regenerate identity, grouping, collection, and placement proposals.
3. Rerun the branch-independent grouping policy over every long flat list.
4. Regenerate empty-node and empty-collection cleanup from the resulting
   hierarchy.
5. Review the application plan and dry run before any production write.
