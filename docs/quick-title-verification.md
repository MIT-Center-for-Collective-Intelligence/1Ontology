# Direct title verification, October 19, 2026

The main `/review/title-validation` page implements the simpler procedure
discussed by Rob, Tom, Iman, and Anushka on October 19. The earlier creation
and comparison pilot remains available at `?workflow=earlier`; its package,
study, assignments, answers, and event history are unchanged.

Reviewers rate the original title, each proposed title when changed, and the
split decision when applicable. Choices are **Acceptable**, **Not acceptable**,
and **I'm not sure**. Rejection and uncertainty require open-ended explanations.
Corrections and interruption notes are optional. There are no reason dropdowns,
confidence scores, rankings, or independent-title creation stage in this procedure.

## Assignments and source

The frozen package `src/lib/titleValidation/data/quick-v1.json` contains unchanged
historical GPT-6.1 Sol outputs. Its builder checks the October 14 source cohort
SHA256. No inference is performed by either the builder or app. The exact original
prompt, model, funding route, source hash, and sampling provenance are available
in the collapsed proposal disclosure. Prior human judgments are excluded.
The package is ignored by Git and stored in private project GCS. Cloud Build
stages it using the committed checksum before building the image; no new source
activities or proposed titles are published in the public GitHub repository.

- First 25 unflagged cases: 2 Keep, 22 Clarify, 1 Split.
- Reserved next 75: 4 Keep, 67 Clarify, 4 Split. A coordinator explicitly opens
  these after checking the initial reviews; deployment never opens them.
- All 319 keyword-flagged cases: 22 Keep, 274 Clarify, 23 Split. Only Rob and
  coordinators can access them. Adding a regular reviewer does not grant flagged access.

The regular sample excludes 12 earlier demonstration/pilot examples. All flagged
cases are retained, including one previously displayed example. Selection is a
seeded SHA256 ordering within outcomes. Review order varies reproducibly by
reviewer, with first-batch order preserved when the next batch opens. This is a
starting review assignment, not an agreed final validation size, success threshold,
or stopping rule. A keyword hit is not proof of error or calibrated uncertainty.

## Persistence and timing

The new study is `quick-title-verification-20261019-v1` inside the existing protected
`titleValidationStudiesV1` collection. It uses separate `answers`, `drafts`, and
`events` subcollections. Existing Firebase sign-in, revoked-token checking, and
coordinator checks apply. Earlier-pilot API actions reject these new study IDs.
Reviewer IDs come from verified tokens, never client-selected IDs. New UROPs are
added by a coordinator using existing ontology account emails; no accounts or
credentials are created by this app.

Drafts and cumulative active-page time checkpoint every 10 seconds, with browser
recovery between checkpoints. Revision checks reject stale-tab updates. The timer
counts visible-tab time, stops for hidden tabs, and caps a suspended tick at two
seconds. It is not a measure of continuous attention; reviewers can note interruptions.
Each immutable submission retains active-page time, server first-presentation and
submission timestamps, and elapsed time, which may include interruptions. Totals
display summed active-page time across completed and current activities. Exports
retain both time measures and interruption notes. Do not silently treat them as
equivalent or pool software tests into human results.
The coordinator's CSV download has one row per reviewer/activity, including all
title judgments and explanations. Timing is not repeated per proposed title.
Formula-like free text is protected for spreadsheet display; the audit API retains
the original strings and complete provenance.

Final deliveries freeze one payload and submission ID for retry. The server
deduplicates identical retries, rejects changed answers, and uses Firestore
transactions. Coordinator exports preserve individual ratings and source provenance;
participating coordinators finish their regular reviews before viewing others' answers.
No endpoint applies proposals to ontology nodes.

`?qa=1` selects a separate coordinator-only software test study, with every answer
marked `softwareQA`. It cannot alter the real review. Do not delete it as cleanup.

## Release

Build from committed GitHub main. Docker explicitly packages both the old and new
datasets. `/api/deployment` exposes their hashes and versions without case text or
reviewer data. The candidate promotion guard verifies both packages and checks the
regular, flagged, earlier, and software-test pages and anonymous API denial.

Run `npm run test:title-validation`, `npm run typecheck:title-validation`, the
deployment Python tests, relevant review regression tests, and a production build.
After deployment, check actual authenticated production saves and reload recovery
in the software-test study. Compare before/after hashes of existing review answers
and events. Roll back serving code to the previous committed revision if necessary;
never roll back by restoring or deleting database records.
