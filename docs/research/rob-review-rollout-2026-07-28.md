# Rob Review Workflow Rollout

Date: July 28, 2026

This release adds review surfaces and snapshot-bound proposals. It does not
apply any ontology change.

## Deployment checks

1. Deploy the merged application revision.
2. Confirm the active Sell dataset is `sell-semantic-coverage` and that its
   source SHA-256 is
   `c362f9d3587dbed1303a7355b7d5feef8057684544857139f0178a1038b687b2`.
3. Open `/review?dataset=sell-semantic-coverage` and verify that semantic
   diagnoses precede their dependency-gated exact moves.
4. Open `/review/inspection?workspace=sell` with a research-team account and
   verify the completed-task dashboard, then open one task and inspect every
   saved response on one scrollable page.
5. Open `/review/calibration` with a test participant account and verify that
   only the released task set is visible.

The new server queries use the same equality-filter pattern as the existing
review-response queries. This repository does not manage Firestore composite
indexes; no new ordered or range query is introduced.

## Tom's inspection

First send Rob `/review/inspection?workspace=sell`. His own responses should be
selected by default. He can open each completed task and use **Edit my answers**
when needed. After Rob confirms that his record is ready, send the same link to
Tom.

1. Select Rob as the prior reviewer.
2. Select a completed review task.
3. Read every before state, proposed after state, selected response, rationale,
   and alternative for that task on one page.
4. Add a `Not aligned` exception only where Tom differs. His note is stored
   separately and never overwrites Rob's response.

Rob can open the same link to preview the interface. His own responses remain
read-only because a reviewer cannot add an inspection exception to themselves.
Research-team users can also open this page from **Inspect prior review** on the
expert review screen even when the separate group-deliberation feature is
disabled.

## Non-expert calibration

Send a participant `/review/calibration`.

- The participant receives one explanation page and one frozen task set.
- They cannot select branches, rounds, or task queues.
- Their answers carry the assignment and expert-consensus snapshot identifiers.
- Completion does not release another task or propagate any participant answer.
- The research team must explicitly release the next frozen assignment.

## Rob's semantic-coverage review

Send Rob `/review?dataset=sell-semantic-coverage`.

- Eight diagnoses ask whether provider-side Rent/Lease activities found outside
  Sell belong in the branch.
- Each accepted diagnosis unlocks its own exact move to `Rent out`.
- Three O\*NET proposals specialize explicit task wording currently attached to
  generic Sell nodes.
- No O\*NET specialization is released solely from model inference.
- Empty-node and empty-collection cleanup remain unreleased until upstream
  decisions are propagated and the branch is regenerated.
- Exact actions unlock only when their diagnosis is accepted.
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
