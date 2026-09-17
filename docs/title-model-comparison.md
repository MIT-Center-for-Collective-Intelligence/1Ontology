# Comparing models with the title judging agent

Open `/title-model-comparison` in one of two ways: choose **Compare models and
the judging agent** on `/review`, or choose **Compare models** on
`/title-prompt-study`. The page shows four model configurations running Rob’s
very short title prompt on the same 18 examples, with the judging agent’s
findings for each proposal. The saved answers came from GPT-6 Astra (Max
reasoning) on September 15, and from GPT-5.6 Sol, GPT-5.6 Terra, and GPT-5.4
Mini (medium reasoning) on September 16. The archive, its provenance, and its
limits are described in
`Ontology_Title_Clarity_Testbed_2026-08-28/model-comparison-2026-09-16/README.md`.

## What the page shows

Two switches control the view:

- **Show model names** is off by default. Each proposal is labeled only
  “Option A” through “Option D”. The letters match the blinded comparison sent
  to Rob and were shuffled separately for each example, so a letter doesn’t
  identify the same model across examples. Turning the switch on adds the
  model and reasoning setting to each label.
- **Show judging agent findings** is on by default. It shows each option’s
  verdict and findings, and an overview that counts verdicts across all 72
  proposals. When both switches are on, the overview also has a table for each
  model: its proposed groups, verdict counts, and estimated generation cost.

Choose an example from the list, or step through with Previous and Next.
`#case-N` links and `?title=` links select the same example. A `?title=` link
can use the title or the original title with its synonym annotation. Highlight
a description to see which group in each option contains it. Desktop shows all
four options side by side. Compact screens have option buttons and show one
option at a time.

For each option, the findings list the software checks first and then the
model judge’s issues. Each finding shows:

- its severity
- its rule
- the groups it cites, by number and title
- the descriptions it cites, as buttons that highlight them
- any quoted evidence
- a short explanation

A proposal whose model judgment is missing, stale, unparseable, or failed
validation shows “Judgment unavailable” in place of the model judge’s issues
and summary; its software check findings are still listed. Collapsible sections at the bottom show
the exact title prompt, the clarification, the wording correction, the output
format, and the judge’s instructions, schema, and validation rules.

The page is read-only. It has no controls to agree, apply, save, or approve.
It never shows hashes, request identifiers, or file paths.

The page is statically generated, so everything in its props is public even
though the page requires sign-in. Don’t add expert ratings or private
evidence to the archive.

When the site is built, `buildTitleModelComparison` in
`src/lib/somReview/titleModelComparison.ts` checks the archive. If any of these
checks fails, it throws and the build fails, instead of showing a proposal
beside the wrong evidence or judgment:

- the 18 examples match the September 14 study bundle in order, by titles,
  descriptions, and input hashes
- every example’s letters are a permutation of the four models
- there is exactly one answer per example and model
- there is exactly one judgment per answer, for the same study version
- valid judgments cite only groups and descriptions that exist

## How the judging agent works

The judging agent lives in `scripts/som-review/title-clarification-judge-lib.mjs`.
It reports possible problems for expert reviewers. It doesn’t rewrite titles,
repair groups, choose between proposals, approve anything, or write to the
ontology. It has two stages.

**Software checks.** `softwareTitleFindings` runs exact checks:

- A title that doesn’t keep the current initial verb is a prompt violation.
- A title outside 2–5 words is a prompt violation.
- A missing or unknown description number is a major issue.
- A description in more than one group is a minor issue, because it is a
  representation-policy question.

**Model judge.** `buildTitleJudgeRequest` renders one proposal for a model to
judge. The model sees the instructions and clarification the proposing model
was given, for reference only. It also sees the current title, whether
instructions (A) or (B) apply, the numbered descriptions, and the proposal as
numbered JSON. It doesn’t see model names, letters, other proposals, or expert
ratings.

`titleJudgeInstructions` asks the model to report each problem once under the
first of four rules that fits:

| Rule | Page label | Allowed severities |
| --- | --- | --- |
| `same-activity` | Different or added activity | prompt violation or major |
| `supported-detail` | Unsupported detail | major or minor |
| `grouping` | Grouping | major or minor |
| `clarity` | Unclear title | major or minor |

A prompt violation breaks an explicit instruction. A major issue means the
proposal is probably unacceptable as written. A minor issue is one a reviewer
may reasonably accept.

`validateTitleJudgment` accepts a judgment only if all of these hold:

- it is one JSON object with an issues list and a non-empty summary
- every issue uses a listed rule with a severity allowed for that rule
- every issue cites at least one existing group and only existing descriptions
- no issue repeats a number
- every issue has an explanation

An evidence quote that can’t be found in any linked description, ignoring case,
punctuation, and quotation style, becomes a warning. It doesn’t reject the
judgment.

`ingestTitleJudgments` records one result for each judged proposal, with one of
these statuses:

- `valid`
- `invalid`: the judgment failed validation
- `unparseable`: the judgment isn’t JSON
- `stale`: the judgment was recorded for a different request hash
- `missing`

Software, not the model, computes the verdict: the most severe of the software
findings and the model’s issues. If no finding comes from either stage, the
verdict is “no issues”. Judgments are never repaired.

## Using it in the next generation round

The library makes no network calls. Run the judge only under a separately
authorized and budgeted runner, and keep any model execution out of the site
and the build.

1. Put the new round in the same shape as `comparison.json`: the prompt and
   clarification, cases with numbered descriptions, and answers with `caseId`,
   `modelId`, `status`, `groups`, and `reason`.
2. Call `prepareTitleJudgeRequests(study)`. It returns one request for each
   completed answer that has groups. Each request has a `requestId`, a
   `requestSha256`, and `system`, `user`, and `schema` fields. The function
   throws on duplicate answers or unknown cases. Answers it skips appear later
   as `unjudgedAnswers`.
3. In the runner, send one request per call:
   - Build the body with `buildResponsesApiBody({ request, deployment,
     reasoningEffort, maxOutputTokens })`. It uses structured output and
     `store: false`, and all three settings are required.
   - Read the reply with `extractResponsesOutputText(payload)`. It throws on an
     incomplete response, a refusal, or anything other than exactly one text
     output. Record failures in the runner instead of retrying silently.
   - Save each reply as `responses[requestId] = { requestSha256, rawText }`.
4. Call `ingestTitleJudgments({ study, responses, execution })`. In
   `execution`, record `runner`, `model`, `runDate`, `method`, `stability`, and
   `limitations`; the page displays these fields. Review the counts from
   `summarizeTitleJudgments(results)`, and check `unjudgedAnswers`,
   `unmatchedResponses`, and every result that isn’t `valid`.
5. Commit the results as JSON beside the study. Don’t edit judgments, verdicts,
   or raw text by hand. The Node test re-runs ingestion from the raw text and
   fails if the committed file differs.

If you change the judge instructions, schema, validation, or software checks,
also update `TITLE_JUDGE.promptVersion`. `judgeLibraryFingerprint` covers:

- the judge identity, instructions, and schema
- the validation and software-check descriptions
- the source of the rendering, software-check, quote-matching, validation, and
  verdict functions

Changing any of these makes existing committed results fail the Node test until
the judge is run again. A change that alters a rendered request or a recorded
result fails the test’s re-ingestion check too. Results are development
evidence on the examples they were run on. They don’t measure accuracy.

## Release checks

`/api/deployment` reports a `titleModelComparison` field with these values:

- `version`
- `cases` (18)
- `answers` (72)
- `judgments` (72)
- `validJudgments`
- `judgePromptVersion`
- `judgeLibraryFingerprint`
- `bundleSha256` and `judgeResultsSha256`, the hashes of `comparison.json` and
  `judge-results.json`

The field comes from `src/lib/somReview/titleModelComparisonRelease.ts`. The
endpoint returns 503 in any of these cases:

- either file is missing
- the versions differ
- the prompt hash differs
- an answer is not completed, is absent, or is duplicated
- a judgment entry is absent, duplicated, or refers to an unknown answer

Judgment entries whose status is missing, stale, unparseable, or invalid do
not block a release. They lower `validJudgments` and appear as “Judgment
unavailable” on the page, so check that `validJudgments` is 72 before merging a
new run.

`scripts/deployment/promote.py` recomputes the same values from the committed
files, and checks the candidate before promotion and production after it.
`scripts/deployment/test_promote.py` covers that check.

Replacing `judge-results.json` with a new run of the same study needs no
constant change. A new study version must be updated in two constants:
`titleModelComparisonVersion` in `titleModelComparisonRelease.ts` and
`TITLE_MODEL_COMPARISON_VERSION` in `promote.py`. A new study version or judge
prompt version must also be updated in
`__tests__/lib/somReview/titleModelComparisonRelease.test.ts`,
`__tests__/pages/api/deployment.test.ts`, and
`scripts/deployment/test_promote.py`. See
[the deployment procedure](deployment.md).

## Known limitations

- The software verb check compares the first whitespace-separated word, as the
  earlier title checks do. A title whose verb is written with an underscore,
  such as “Lay_Out”, will be reported as a changed verb if a proposal writes
  “Lay Out”. Normalize phrasal verbs before using the judge on titles like
  these.
- `judgeLibraryFingerprint` covers the instructions, schema, validation rules,
  and the main rendering, checking, and validation functions, but not every
  helper. The re-ingestion test is what detects any change that alters a
  recorded request or result.
- Version 1 of the judge was written with knowledge of these 18 development
  examples, so any revision should be evaluated on new examples.

## Tests

Run these with Node 18 from the repository root:

```
NODE_ENV=test npx jest --runInBand --watch=false --coverage=false __tests__/lib/somReview __tests__/components/SomReview __tests__/pages/api/deployment.test.ts
node --test scripts/som-review/title-prompt-study-lib.test.mjs scripts/som-review/latest-title-prompt-study-lib.test.mjs scripts/som-review/title-clarification-judge-lib.test.mjs
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s scripts/deployment -p 'test_*.py'
npm run build
```

The Jest suites cover:

- the archive alignment checks
- the switches and verdict labels
- highlighting and navigation
- the absence of hidden identifiers and of approval controls
- the release field

The Node test covers:

- every judging agent function
- exact reproduction of the archive’s inputs, answers, and software
  observations
- the requirement that committed judge results match what ingestion produces
  from their raw text

The container runs the Jest and Node commands during the build. After a release,
check `/title-model-comparison` at desktop and compact widths while signed in.
