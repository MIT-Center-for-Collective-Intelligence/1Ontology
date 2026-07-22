# Rob title-review follow-up

## Decision from the July 22 meeting

Title clarification is the only hard global prerequisite. A later semantic or
structural judgment can become stale when its subject title changes or when one
node is split into several nodes. The review workflow should therefore finish
and apply a title pass before relying on downstream proposals.

Rob's completed title queue is treated as an expert benchmark, not as another
model vote:

- 35 of 35 title items reviewed
- 26 agreements
- 9 disagreements with rationales
- 8 disagreements supplied actionable alternative titles or splits
- `Sell Product` supplied a title-policy correction and examples, so it was
  intentionally returned to the improved title agent

## Applied workflow

1. Export and hash Rob's complete review set.
2. Clone `Final Hierarchy with O*Net` to the isolated ontology
   `Final Hierarchy with O*Net - Rob Title Review 2026-07-22`.
3. Apply the 19 accepted renames, four exact alternative renames, and four
   expert-requested splits to the clone only.
4. Verify that the source ontology digest is unchanged and that the clone
   exactly matches the planned transformation.
5. Calibrate D12 against every disagreement rationale, then rerun it on the
   revised Sell snapshot.
6. Suppress every expert-adjudicated item and every expert-created split node
   from the new title queue. Also suppress number-only renames pending a team
   policy.
7. Rerun D7/J2 grouping, D8/J3 duplicate detection, and D11/J1/J6/J7 placement
   checks against the revised clone.
8. Bind every proposal to a fresh Firestore snapshot and reject stale or
   already-implemented structures before serving it to reviewers.

## Resulting next review pass

The improved title agent produced four genuinely new split proposals:

- `Market Product`
- `Sell Beverage`
- `Sell Product`
- `Sell Supply`

These should be reviewed before downstream queues are treated as stable. After
they are adjudicated and applied to the clone, regenerate downstream proposals
once more. The current downstream results are useful for inspection but remain
logically gated by completion of this second, much smaller title pass.

## Separate research track

The meeting also identified a distinct research opportunity: compare the
original ontology with Rob's manually restructured ontology, decompose the
expert changes into atomic operations, and test whether prompts can recover
those operations. This should remain separate from the operational title pass
so that evaluation design does not delay ontology improvement.
