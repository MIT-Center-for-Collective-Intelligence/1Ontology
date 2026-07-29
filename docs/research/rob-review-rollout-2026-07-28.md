# Rob Review Workflow Rollout

Date: July 28, 2026

This release adds review surfaces and snapshot-bound proposals. It does not
apply any ontology change.

## Deployment checks

1. Deploy the merged application revision.
2. Confirm the active Sell dataset is `sell-outline-followup` and that its
   source SHA-256 is
   `ec34b54cd9a8a3230f31af8f5efc95997eb5f70e5ff15fc7986a8cf67aa55809`.
3. Open `/review?dataset=sell-outline-followup` and verify that diagnostics
   precede their dependency-gated merge or move actions.
4. Open `/review/inspection?workspace=sell` with a research-team account and
   verify that prior responses are hidden until an independent scan is locked.
5. Open `/review/calibration` with a test participant account and verify that
   only the released task set is visible.

The new server queries use the same equality-filter pattern as the existing
review-response queries. This repository does not manage Firestore composite
indexes; no new ordered or range query is introduced.

## Tom's inspection

Send Tom `/review/inspection?workspace=sell`.

1. Compare the original and current Sell hierarchies.
2. Record observations or explicitly record that no issues were found.
3. Lock the scan. It is bound to the active dataset version and ontology
   snapshot, so a later hierarchy requires a new blind scan.
4. Select Rob as the prior reviewer.
5. Read the scrollable before, proposed after, selected response, rationale, and
   alternative record.
6. Add a `Not aligned` exception only where Tom differs. His note is stored
   separately and never overwrites Rob's response.

## Non-expert calibration

Send a participant `/review/calibration`.

- The participant receives one explanation page and one frozen task set.
- They cannot select branches, rounds, or task queues.
- Their answers carry the assignment and expert-consensus snapshot identifiers.
- Completion does not release another task or propagate any participant answer.
- The research team must explicitly release the next frozen assignment.

## Rob's next review

Send Rob `/review?dataset=sell-outline-followup`.

- The 26 items encode the July 28 outline observations as atomic questions.
- Identity and placement diagnoses appear before exact merge and move actions.
- Exact actions unlock only when their diagnosis is accepted.
- Boundary cases remain manual checks.
- Model confidence is hidden and cannot authorize an ontology write.

## Applying reviewed decisions

Do not apply approvals directly from the review UI. After the required reviews:

1. Export current responses.
2. Resolve Rob/Tom exceptions explicitly.
3. Generate an application plan tied to reviewed proposal IDs and the frozen
   source SHA-256.
4. Inspect the dry run.
5. Run a separate script with an explicit `--apply` flag.
6. Export a new ontology snapshot and regenerate downstream proposals from it.
