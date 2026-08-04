# Continuous expert review and propagation checkpoints

## Decision addressed

Rob asked whether answers from a reviewer judged to be reliable could be
propagated quickly enough to review a sub-branch in one near-continuous session.
The implementation now separates two operations: continuous traversal of work
that has already been generated, and explicit regeneration checkpoints when an
accepted answer changes the ontology or the downstream proposal set.

## Policy

- Reliable-reviewer status is explicit and narrower than the reviewer role.
  It is assigned through a verified-email/UID allowlist or the Firebase custom
  claim `somReviewTrustedPropagator`.
- Continuous expert review is enabled by default for an authorized reviewer in
  the current round, and the reviewer can switch to manual queue navigation.
- A saved answer advances directly to an already-generated dependent question.
  When a queue ends, the next available queue starts without a handoff screen.
- Only proposed changes in a current review round are eligible. Status-quo
  controls, manual checks, past rounds, and non-expert calibration responses are
  excluded.
- Every authorization is bound to the proposal ID, dataset version, source
  ontology snapshot hash, response revision, reviewer, decision, rationale,
  policy version, and timestamp.
- An edit updates the authorization. Undo retracts it. Both operations append
  immutable audit revisions.
- A trusted answer becomes `ready` in a separate propagation draft. It does not
  mutate the ontology by itself.
- When accepted changes alter the ontology or require new model work, the
  continuous session stops at a regeneration checkpoint. The checkpoint must
  produce a new snapshot-bound application plan, revised ontology outline, and
  downstream proposal set before review resumes.
- A dependency means that one proposal unlocks another; it never means that the
  first answer can be copied to the second proposal.
- Model confidence cannot grant reviewer reliability or propagation authority.

## Firestore records

- `somReviewTrustedPropagations`: current authorization state, with one stable
  document per dataset/proposal/reviewer.
- `somReviewTrustedPropagationRevisions`: append-only authorization, update,
  and retraction history.
- Expert responses remain in `somReviewResponses`. Non-expert calibration
  remains isolated in `somReviewCalibrationResponses` and cannot enter the
  trusted propagation collections.

## Open study decisions

Before enabling continuous propagation for anyone beyond the initial expert
pilot, the team should define the evidence required to classify a reviewer as
reliable, the review period for that classification, periodic spot-check rates,
and the error threshold that suspends fast-track access. Those thresholds are
research parameters, not assumptions embedded in the application.
