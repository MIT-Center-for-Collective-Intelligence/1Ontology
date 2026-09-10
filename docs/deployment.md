# Production deployment

Production is built from the GitHub `main` branch by the existing `ontology`
Cloud Build trigger (`5b289016-4c22-4bce-a4aa-a89bb921f8d8`, global,
project `ontology-41607`). Commit all runtime code and required dataset files,
push a pull request, run the focused checks, and merge. Do not deploy local
standalone output, a dirty checkout, or an unpushed commit.

The build tests the review UI and datasets, builds an image tagged with the
full commit and unique build ID, and records both on the Cloud Run revision.
It deploys a candidate without traffic, verifies `/api/deployment` against
the expected source and v6/v7 manifest hashes, verifies all 33 preserved package
files against the committed SHA256 lock, checks that GitHub main has
not advanced, and promotes that exact revision using a conditional Cloud Run
update. Its service fingerprint is read before checking main; an intervening
deployment or promotion invalidates that write. A stale build fails closed
without retrying the update. See [Cloud Run's etag contract](https://cloud.google.com/run/docs/reference/rest/v2/projects.locations.services#Service).
The public endpoint exposes only release identity and dataset metadata.

After a release, verify `https://ontology.mit.edu/api/deployment` reports the
merged commit. Check both deep links, a proposal's “Agents and prompts used
for this proposal” disclosure, and saved response history:

- `/review?dataset=ontology-title-testbed` selects the preserved 18-card v6 round.
- `/review?dataset=ontology-title-testbed-v7` selects the existing random 50-card v7 round.

Dataset changes require their own scientific authorization. Updating the
release's expected manifest hashes is part of that reviewed change; never
relax the check merely to get a build through. These files contain proposals,
not instructions to apply changes to the ontology. Deployment does not write
to the ontology or review collections.

Cloud Build logs record the prior traffic allocation before promotion. To
roll back, use `gcloud run services update-traffic ontology --project
ontology-41607 --region us-central1 --to-revisions=PREVIOUS_REVISION=100` with
the verified previous revision. Keep its image; do not delete old revisions
or images as part of deployment. Rollback changes serving code only and must
not restore or overwrite database records.

The September 10 reconciliation preserved the already deployed v6 and v7
packages and prompt-transparency fixes, and incorporated main's ontology
export fix. Historical development work remains in its original worktree;
private audit records and conversations are not deployment inputs.
