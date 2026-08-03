# Trusted-reviewer propagation fast path

## Decision addressed

Rob asked whether answers from a reviewer judged to be reliable could propagate
automatically to reduce review overhead. The first implementation treats this
as a faster route from an individual judgment to a propagation draft. It does
not copy an answer to a different proposal and does not write to the ontology.

## Policy

- Reliable-reviewer status is explicit and narrower than the reviewer role.
  It is assigned through a verified-email/UID allowlist or the Firebase custom
  claim `somReviewTrustedPropagator`.
- The reviewer must opt in. The default remains review only.
- Only proposed changes in a current review round are eligible. Status-quo
  controls, manual checks, past rounds, and non-expert calibration responses are
  excluded.
- Every authorization is bound to the proposal ID, dataset version, source
  ontology snapshot hash, response revision, reviewer, decision, rationale,
  policy version, and timestamp.
- An edit updates the authorization. Undo retracts it. Both operations append
  immutable audit revisions.
- A trusted answer becomes `ready` in a separate propagation draft. It does not
  mutate the ontology. Application still requires a separately generated and
  inspected snapshot-bound batch plan.
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

Before enabling the fast path for anyone beyond the initial expert pilot, the
team should define the evidence required to classify a reviewer as reliable,
the review period for that classification, periodic spot-check rates, and the
error threshold that suspends fast-track access. Those thresholds are research
parameters, not assumptions embedded in the application.
