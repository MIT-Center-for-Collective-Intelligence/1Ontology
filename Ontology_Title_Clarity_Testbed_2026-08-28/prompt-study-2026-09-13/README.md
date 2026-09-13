# Rob’s simple title prompt — development pilot

This is a separate read-only discussion view at `/title-prompt-study`. It does not register a replacement review round, collect judgments, or write ontology or review records. The v6 and v7 datasets and response history are preserved.

The starting instructions are Rob’s [Title Clarification Parley Prompt](https://docs.google.com/document/d/1dCmUdGegw8E0jq-wFuG1Wnu4LOytlMSl9AdTBN9UmNw/edit), retrieved September 13, 2026 after its 18:22:34 UTC modification. `rob-prompt.txt` preserves the exact retrieved text, including its wording and line endings. `bundle.json` records the exact same prompt, the separate formatting instructions and JSON schema, and every case input and model answer. The input to each model request consists only of the current primary title and its numbered O*NET descriptions. A trailing synonym annotation is excluded from the primary title; the original title remains in provenance. Other activities, aliases, branch context, and calibration examples are not model inputs.

The 18 cases and 240 descriptions reuse the original v6 development sample. They are not held-out evaluation data or gold labels. The model is GPT-6 Astra, version 2026-09-03, with Max reasoning, through deployment `gpt-6-astra-society-of-mind` on the MIT CloudBank Azure route for ACCESS project CIS261400. Both prompt and model differ from deployed v6, so a difference in answers cannot be attributed to either change alone. This pilot does not evaluate a middle-tier model or establish readiness for a full ontology run.

The shared [prompt review document](https://docs.google.com/document/d/1ZUDNSY4ttNasTRVLPWwSl7jQcymWzLyeRiOk4LOOjmU/edit) places Rob’s source first and preserves the prior title prompts and software descriptions section by section. Suggestions there do not run a model or modify the ontology.

## Mechanical reproduction

From the repository root, run `node --test scripts/som-review/title-prompt-study-lib.test.mjs`. This re-parses frozen answers and verifies the source-to-input mapping, exact prompt, hashes, and software observations without paid inference. Model generation is stochastic; replaying a prompt is not expected to reproduce its exact answer.

Software checks are observations, not semantic approval. They flag missing or unknown description numbers, overlap, repeated titles, empty groups, title length, and changed leading verbs. They never repair or discard a model answer silently. Every original description and raw output remains available. Overlapping membership is a representation-policy question; changing the leading verb remains a later editorial decision. There are no automatic ontology edits.

Private research records retain the source transcript, original document retrieval, numbered source packet, pre-request funding/capacity checks, exact request bodies, every attempt and recovery, append-only journals, and aggregate reservations. Those records are in the project’s `artifacts/rob-simple-prompt-2026-09-13/` evidence directory; private conversations and credentials are not published here.

## Release and cost accounting

`/api/deployment` reports the committed experiment version and bundle hash alongside the unchanged v6/v7 identifiers. Promotion requires all 18 requests to have completed, the exact committed bundle, and the main-branch commit identity. A source commit and passing build are required for deployment.

The bundle contains a timestamped usage snapshot including failed and recovered methodology requests. Unknown usage remains reserved at the full pre-request bound; cached input, cache writes, and output are metered separately in the private ledger. The snapshot is an estimate, not an invoice. The final milestone report accounts for any audit requests made after the bundle snapshot. A task-specific inference cap and the protected award reserve are recorded in the private funding plan. No full ontology batch, WordNet inference, noun integration, or model-tier comparison is authorized by this pilot.
