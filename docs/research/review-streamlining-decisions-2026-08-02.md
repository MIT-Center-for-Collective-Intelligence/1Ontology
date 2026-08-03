# Review streamlining decisions (2026-08-02)

## Implemented now

- The prior-review inspection groups saved responses by issue type across review
  rounds. Historical responses and proposal IDs remain unchanged, and each round
  remains visible as a separate section inside the combined task.
- Related issue types are grouped under the existing review-path phases. Task
  labels describe the reviewer decision rather than exposing detector names.
- Opening an inspection task adds a browser-history entry, so the browser Back
  button returns to the inspection task list instead of leaving inspection mode.
- Possible-synonym cards ask whether two titles name the same activity. The
  choices are `Same activity` and `Different activities`, with an explicit rule
  that broader, narrower, subtype, and merely related activities are not
  synonyms.
- A placement proposal with a named destination is one complete move decision.
  Future exploratory dataset generation marks that card as the action and no
  longer generates a second relocation card for the same move. Historical
  diagnosis-only records remain inspectable but cannot authorize a move.
- When a one-step card exactly preserves an earlier relocation card's subject,
  current parent, proposed parent, and move scope, the earlier relocation answer
  is carried forward at read time. The stored source response and audit history
  are unchanged, broader diagnosis answers are not reinterpreted, and a response
  saved directly on the new card takes precedence.

## Deferred until the Sell sequence is complete

Repeated moves with the same source and destination should eventually use a
single batch surface. The batch must still preserve one independent answer per
activity; an all-or-none group answer would hide meaningful exceptions.

A future batch is eligible only when every row has the same issue type, current
parent, proposed parent, collection treatment, snapshot, and governing rationale,
and when none of the rows has a conflicting dependency. The proposed surface is
a compact table with current parent, proposed parent, evidence disclosure, and a
per-row `Approve move` / `Reject move` choice. The stored response remains one
auditable response per proposal ID.

This batching work should begin only after the complete Sell branch has been
reviewed, propagated to a snapshot-bound copy, and inspected for recurring cases.
That evidence will determine which repeated patterns are safe and useful to batch
before running Buy through the same sequence.
