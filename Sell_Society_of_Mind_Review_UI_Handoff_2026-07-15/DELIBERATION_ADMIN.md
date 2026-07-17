# Society of Mind deliberation administration

The individual review page remains blind: it never returns other reviewers'
positions, identities, roles, weights, comments, or aggregate results. The
deliberation data is available only through `/review/admin` and the
`/api/som-review/admin/*` endpoints, all of which enforce access server-side.

All individual and deliberation records share the validated production
Firestore source boundary described in `FIRESTORE_SOURCE.md`. Deliberation can
record judgments and resolutions, but it cannot bypass source validation or
write ontology changes.

## Reviewer tiers

The server resolves roles in this order:

1. Firebase Auth custom claim `somReviewRole`, when set to `steward`,
   `researcher`, or `contributor`.
2. Server environment UID/email allowlists.
3. The current built-in CCI team allowlist.
4. `contributor` as the fail-closed default.

Email allowlists are honored only for Firebase-verified email addresses. The
server loads participant emails and custom claims from Firebase Auth rather
than trusting editable profile fields.

For new team members, prefer the `somReviewRole` custom claim or one of these
server environment variables:

- `SOM_REVIEW_STEWARD_EMAILS`
- `SOM_REVIEW_STEWARD_UIDS`
- `SOM_REVIEW_RESEARCHER_EMAILS`
- `SOM_REVIEW_RESEARCHER_UIDS`

Values are comma-separated. A user must refresh their Firebase ID token after
a custom-claim change.

The default weights are steward `4`, researcher `2`, and contributor `1`.
They can be changed with the corresponding `SOM_REVIEW_*_WEIGHT` variables.
The server enforces `steward > researcher > contributor` even if configuration
is invalid.

## Deliberation rules

- At least two core-team judgments are required before a proposal can be ready.
- A team member cannot see a proposal's group result, reviewer identities,
  comments, or weights until they have recorded their own independent judgment.
  The admin overview omits unreviewed proposals rather than sending hidden data
  to the browser.
- Accept/reject resolutions are rejected server-side until that quorum exists;
  a finalizer can still defer the proposal.
- A ready recommendation requires the core-team and all-reviewer weighted
  results to point in the same direction.
- Contributor volume can force discussion but cannot override the core team.
- A split between senior stewards, or senior-steward dissent from an emerging
  direction, forces deliberation.
- Research-team members can add structured arguments and revise their own
  judgment after completing the independent review.
- Only senior stewards and designated finalizers can record a final resolution.
- Comments, revised positions, and resolutions are stored separately with
  append-only revision history. Identical retries are idempotent.
- A resolution records a governance outcome only. It never changes the
  ontology automatically.

Custom claim `somReviewFinalizer: true` grants finalization to a user who
already has a steward or researcher role. It does not change the reviewer's
weighting tier. Neither a general application `admin` claim nor any other admin
flag admits a contributor to deliberation; the trusted review role is required.

## Calibration path from human review to audited automation

The weighted deliberation result is a governance mechanism, not a substitute
for an adjudicated validation set. Use the following staged process separately
for each issue type:

1. **Set policy first.** Resolve ontology-wide policy questions, such as
   singular versus plural titles, before evaluating a prompt that implements
   that policy.
2. **Build an expert reference set.** Start with two independent core-team
   reviewers per routine proposal and three for destructive or cross-branch
   actions. A senior steward adjudicates disagreements. Stratify the set across
   sub-branches, easy/hard cases, and proposed-change/status-quo controls.
3. **Freeze a holdout set.** Keep at least 30% of adjudicated cases unavailable
   to prompt authors and prompt-improvement agents. Never tune on this set.
4. **Improve prompts from error classes.** An LLM may cluster disagreements and
   propose prompt edits, but a researcher must approve and version every prompt
   change before it runs. Do not allow a production prompt to rewrite itself.
5. **Validate in two independent batches.** Require observed agreement of at
   least 95% with the adjudicated reference and a 95% Wilson lower bound of at
   least 90% for routine proposals. For merges, deletions, and cross-branch
   moves, require at least 99% observed agreement, no critical error in at least
   100 held-out cases, and agreement across two different sub-branches.
6. **Move to shadow mode, not zero oversight.** Once thresholds hold, let the
   LLM run without changing the ontology while humans review a risk-stratified
   audit: 100% of low-confidence, novel, destructive, or policy-sensitive
   cases, plus a random sentinel sample of at least 10% of routine cases.
7. **Revert when quality drifts.** Return an issue type to full review after any
   critical error, threshold failure, ontology-policy change, material prompt
   change, or distribution shift.

For operational decisions, retain the current steward/researcher/contributor
weights and escalation rules. For scientific claims about model quality,
report performance against the adjudicated reference set and unweighted
reviewer agreement separately; contributor volume or role weights must not be
presented as ground truth.
