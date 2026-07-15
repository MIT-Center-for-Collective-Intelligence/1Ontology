# Society of Mind deliberation administration

The individual review page remains blind: it never returns other reviewers'
positions, identities, roles, weights, comments, or aggregate results. The
deliberation data is available only through `/review/admin` and the
`/api/som-review/admin/*` endpoints, all of which enforce access server-side.

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
