# Activity relationship review

The separate `/review/relationships` workflow lets Tom examine proposed specialization/generalization placements. It never applies a suggestion to the ontology. The existing title-review workflows and their saved responses are unchanged.

The first release reviews 64 activity nodes in the first four levels of `final-hierarchy-with-o*net`, plus Reason’s four immediate children. Act is level 1. Levels use minimum directed edge distance, including navigation headings; the root and four bracketed navigation headings are not treated as activity-parent judgments. This is a graph with multiple parents, not a tree.

Every case has a primary GPT-6.1 Sol analysis and a separate challenge request to that same model, both at high reasoning through ACCESS project CIS261400 on CloudBank Azure. A challenge is model evidence, not an independent human judgment. The first pass sees every non-heading candidate title in the first five levels. The challenge receives the complete source records for every referenced candidate. The search is bounded and cannot establish a globally optimal parent.

The assessment tests whether every instance of doing the specific activity is also an instance of doing the broader activity. It distinguishes that relation from being a part, prerequisite, method, cause, result, or typical associate. Existing descriptions and edges are context to examine, not validated definitions. Ambiguous meanings and proposed definition changes remain questions for expert discussion. Missing intermediate concepts can be discussed without inventing a source ID or creating a node.

## Review and persistence

Tom and Iman use their existing verified accounts. A reviewer sees the complete current and proposed parent sets, an example, reasons for caution, and optional detailed reasoning and provenance. Feedback is agree, disagree, or needs discussion, with optional corrections and notes. Saving does not advance the card automatically. Direct links identify an activity with `?activity=<source ID>`.

`relationshipReviewDatasetsV1` stores feedback independently of the title pilots. The server obtains identity from the verified Firebase token; the client cannot choose a reviewer. Each save transaction records an immutable event and updates the current-answer projection. Request IDs make retries idempotent; revision checks prevent competing tabs from overwriting one another. The first saved dataset hash is retained in Firestore, preventing a changed package from silently reusing the same version. Iman can load Tom’s feedback through a read-only overview; Tom cannot read another reviewer’s answers.

Unsaved drafts are isolated by browser tab, reviewer, dataset hash, and activity. They survive reload through session storage and in-app navigation through a memory copy. Storage failures are disclosed. A conflict shows the latest saved response and requires explicit recovery before a new save. A delayed older receipt cannot downgrade newer client state.

Local preview requires development mode, the existing explicit preview flag, and loopback host/socket checks. It writes only to `.relationship-review-preview`. Production storage QA uses a synthetic reviewer ID beginning `software-qa:`; its reviewer record and events are explicitly marked as software tests, not human judgments. No reviewer accounts are impersonated.

## Frozen evidence and release checks

`data/top-level-v1.json` holds the source context and normalized reviewer text. `data/traces/` preserves the exact requests, structured-output schemas, raw responses, usage, and attempt metadata. Short source aliases and opaque source IDs in prose are replaced with exact source titles for readability; raw outputs remain unchanged. Each trace and the dataset have SHA-256 entries in `release-lock.json`. Traces are served only through the authenticated API, never the public directory.

This repository is public. **Do not commit `data/`, meeting excerpts, or detailed model inputs.** The data directory is ignored. A private GCS archive contains the JSON evidence; `scripts/deployment/relationship-review-package.json` commits only its location and verification hashes. Cloud Build stages and verifies this exact archive before tests and image creation. The staging script rejects traversal, symlinks, duplicate members, changed hashes, oversized content, and unexpected files, and never overwrites mismatched local evidence. It uses the existing private build bucket without widening its permissions.

Tom’s recorded explanation of Reason’s fallback role is included in a second assessment of Reason and its four immediate children. The original and revised outputs are both retained. The checked ontology has no locally stored parts for the 657 candidate nodes; these proposals have not been validated against subactivity prediction. This does not imply the separate parts ontology lacks such data.

`scripts/som-review/validate-relationship-release.mjs` checks the complete case inventory, exact prompts, hashes, deployment/model/reasoning, successful outputs, source references, and complete parent assessments. Graph checks reject a self-link, a descendant parent, or a navigation heading as an activity parent. Jointly conflicting proposals are flagged separately rather than silently choosing one. These are mechanical checks, not semantic validation.

The full read-only source snapshot, funding reconciliation, append-only request journals, original/corrected outputs, run scripts, and usage accounting are retained in the task deliverable directory `top-level-relationships-2026-10-16` under the project’s local `ontology-deliverables` directory. Credentials are not included. Historical failed attempts and unknown-usage reservations are retained.

Release only through a committed GitHub-main merge and the normal Cloud Build workflow. The build runs focused tests and validates the frozen package. Production promotion checks the exact Git revision and package hash, the relationship page, all anonymous API boundaries, and the existing title-review route before moving traffic. Future changes to proposals require a new dataset version; never overwrite feedback or historical packages.
