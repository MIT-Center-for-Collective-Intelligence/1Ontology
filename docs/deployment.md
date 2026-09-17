# Production deployment

Production is built from the GitHub `main` branch by the existing `ontology`
Cloud Build trigger (`5b289016-4c22-4bce-a4aa-a89bb921f8d8`, global,
project `ontology-41607`). Commit all runtime code and required dataset files,
push a pull request, run the focused checks, and merge. Do not deploy local
standalone output, a dirty checkout, or an unpushed commit.

The build tests the review UI and datasets, builds an image tagged with the
full commit and unique build ID, and records both on the Cloud Run revision.
It deploys a candidate without traffic, verifies `/api/deployment` against
the expected source and v6/v7 manifest hashes, verifies all 36 preserved package
files against the committed SHA256 lock, checks that GitHub main has
not advanced, and promotes that exact revision using a conditional Cloud Run
update. Its service fingerprint is read before checking main; an intervening
deployment or promotion invalidates that write. A stale build fails closed
without retrying the update. See [Cloud Run's etag contract](https://cloud.google.com/run/docs/reference/rest/v2/projects.locations.services#Service).
The public endpoint exposes only release identity and dataset metadata.

`/api/deployment` also identifies the committed title archives, and
`scripts/deployment/promote.py` recomputes each value from the committed files
before and after promotion:

- `titlePromptStudy` and `latestTitlePromptStudy`: the September 13 and
  September 14 prompt studies (version, 18 completed cases, prompt hash, and
  bundle hash).
- `titleModelComparison`: the four-model comparison of Rob’s very short prompt
  and its judging agent results in
  `Ontology_Title_Clarity_Testbed_2026-08-28/model-comparison-2026-09-16/`.
  It reports `version`, `cases` (18), `answers` (72, all completed, one per
  example and model), `judgments` (72, one per answer), `validJudgments` (the
  number of judgments with status “valid”), `judgePromptVersion`,
  `judgeLibraryFingerprint`, and the SHA256 of `comparison.json`
  (`bundleSha256`) and `judge-results.json` (`judgeResultsSha256`). The
  endpoint returns 503 if either file is missing, the versions or prompt hash
  differ, an answer is not completed, absent, or duplicated, or a judgment
  entry is absent, duplicated, or tied to no answer. Judgment entries with
  status missing, stale, unparseable, or invalid do not block a release; they
  lower `validJudgments` and show as “Judgment unavailable”, so confirm
  `validJudgments` is 72 before merging a new judge run. Replacing
  `judge-results.json` changes `validJudgments` and `judgeResultsSha256`; no
  constant needs updating.

These archives are read at request time from the runner image, which copies
the whole `Ontology_Title_Clarity_Testbed_2026-08-28` directory and checks
that both comparison files are present.

After a release, verify `https://ontology.mit.edu/api/deployment` reports the
merged commit. While signed in, check the deep links below, a proposal's
“Agents and prompts used for this proposal” disclosure, and saved response
history:

- `/review?dataset=ontology-title-testbed` selects the preserved 18-card v6 round.
- `/review?dataset=ontology-title-testbed-v7` selects the existing random 50-card v7 round.
- `/title-model-comparison` shows the four models’ proposals for the 18
  examples with the judging agent’s findings. Check that model names are
  hidden until “Show model names” is turned on, and that a deep link such as
  `/title-model-comparison#case-2` opens the second example.

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
