# Quick-title assignment selection

The frozen 419-case evidence package remains byte-for-byte unchanged, including
its original batch labels, scientific prompt, descriptions, titles and reasons.
Its original first 25 contain 2 Keep / 22 Clarify / 1 Split; those labels remain
historical evidence, not the active assignment overlay.

The committed `quick-title-selection-5-15-5-v1` overlay assigns an initial
25 unflagged cases containing 5 Keep / 15 Clarify / 5 Split. Its 75-case reserve
contains 1 Keep / 74 Clarify / 0 Split. Expanding to 100 preserves each reviewer's
initial ordered prefix. All 319 flagged cases remain separate, with the existing
flagged-reviewer access rules. The 103 Generalization proposals are unchanged.

Before authorized production activation, the lead verifies that 100% of traffic
serves the compatible main revision and waits for old mutating requests to drain.
The coordinator's existing `quick-manage` / `activate-selection` endpoint checks
the exact manifest version, SHA-256, outcome counts, coverage, matching
`K_REVISION`, explicit `drainedOldRevisions: true`, and the protected draft hash.
No additional environment gate or Cloud Run configuration change is required.

Activation writes only `study.selection` and one append-only activation event.
It does not rewrite answers, drafts, timers, presentation timestamps or earlier
events. Registered pre-cutover drafts remain resumable by their authenticated,
roster-assigned owners; ordinary reserved cases remain unavailable at limit 25.
Exact old-answer retries still deduplicate, and changed answers remain conflicts.
Exports are read-only and distinguish frozen batch labels, current assignments,
legacy answer provenance and each newer answer's recorded selection/access.

`qa: "selection"` uses a separate software-only study with the overlay active.
Existing browser `qa=1` continues to select the old `qa: true` software study.
That old QA study can be explicitly activated through the same endpoint before
HTTP checks, preserving its existing 26 answers and all drafts. Production's
existing zero answers and one protected draft likewise remain unchanged.
