# Four models on Rob’s very short title prompt, with a judging agent

This folder is a read-only record of four model configurations running Rob’s
very short title-clarification prompt on the same 18 development examples,
together with a judging agent’s findings on each of the 72 proposals. The
`/title-model-comparison` page displays it. Nothing here registers a review
round, collects judgments, or changes the ontology, saved reviews, or earlier
archives.

## Contents

- `comparison.json` has the exact prompt and recorded clarification, the
  wording correction, the output format and schema, the software checks, and
  the four model configurations. It also has the 18 examples with their
  numbered O*NET descriptions and option letters. For each of the 72 answers
  it keeps the raw output, parsed groups and reasons, software observations,
  and estimated generation cost.
- `prompt.txt` and `clarification.txt` hold the exact prompt and clarification
  given to every model. `.gitattributes` keeps their bytes unchanged so their
  hashes stay stable.
- `judge-results.json` holds the judging agent’s results for all 72 proposals.
  It includes the judge’s instructions, output schema, and validation rules,
  plus the software findings, each raw judgment, and a record of how the judge
  was run. The page shows this run.
- `judge-results-run-2.json` is a second, identical judging run, used only to
  check stability.

`comparison.json` was built without model calls by
`scripts/som-review/build-title-model-comparison-archive.mjs`. Both judge
results files were produced by `ingestTitleJudgments` in
`scripts/som-review/title-clarification-judge-lib.mjs`.

## Prompt, models, and inputs

The prompt is Rob’s very short prompt of September 15, 2026. As received, its
B(ii) said the title is “adequate … and thus should be changed”. That
contradicts its own instruction and B(i), so “adequate” was corrected to
“inadequate” before any of these runs. `asReceivedPrompt` keeps the text as
received, and `wordingCorrection` records the change and why it was made. The
recorded clarification carries forward Rob’s explanation that the approximate
5–9 target means descriptions per new group.

All four configurations received identical messages, evidence, and output
format:

| Model | Version | Reasoning | Answers from | Proposed groups | Estimated generation cost, 18 examples |
| --- | --- | --- | --- | ---: | ---: |
| GPT-6 Astra | 2026-09-03 | Max | September 15 (saved answers reused) | 40 | $2.02 |
| GPT-5.6 Sol | 2026-07-09 | Medium | September 16 | 38 | $0.40 |
| GPT-5.6 Terra | 2026-07-09 | Medium | September 16 | 57 | $0.11 |
| GPT-5.4 Mini | 2026-03-17 | Medium | September 16 | 26 | $0.06 |

The generation requests were funded by ACCESS project CIS261400 through MIT
CloudBank Azure. Costs are telemetry estimates, not invoices. The model and the
reasoning setting changed together, so a difference in answers can’t be
attributed to either one alone. Group counts alone don’t measure quality.

The inputs are identical to those of the September 14 study in
`prompt-study-2026-09-14`: the same 18 examples in the same order, all 240
numbered descriptions, and every input text and its hash. `inputsFrom` names
that study. Each model received only the current primary title and its
numbered descriptions, along with the prompt, the recorded clarification, and
the output format. This development sample is not held-out evaluation data or
a set of correct answers.

Option letters match the blinded comparison sent to Rob on September 16.
Letters were shuffled separately for each example, so the same letter doesn’t
identify the same model across examples. The page hides model names until a
reader turns them on.

## Software checks

All 72 answers could be read in the requested output format. Ordinary code
records observations about each answer:

- description numbers that are missing, unknown, or in more than one group
- identical descriptions placed in different groups
- repeated or empty titles
- titles outside 2–5 words
- changed leading verbs
- split groups outside the approximate 5–9 target

These are observations, not semantic approval. Raw answers are never repaired
or replaced.

## The judging agent

After his review of the blinded comparison, Rob asked whether a judging agent
could catch errors like a changed verb or an added direct object. The judging
agent reports possible problems for expert reviewers. It doesn’t write
replacement titles, choose between proposals, or approve, repair, or apply
anything. It has two stages.

The first stage is software checks. Code checks that every proposed title keeps
the current initial verb and has 2–5 words. A failure is a prompt violation.
Code also checks that every description number exists and appears in a group.
A missing or unknown number is a major issue. A description placed in more than
one group is a minor issue, because it is a representation-policy question.

The second stage is a model judge, which receives:

- the instructions and clarification the proposing model was given, for
  reference only
- the current title, and whether instructions (A) or (B) apply
- the numbered descriptions
- one proposal, as numbered JSON

The model judge reports problems under four rules:

- different or added activity (`same-activity`)
- unsupported detail (`supported-detail`)
- grouping
- clarity

Each problem gets a severity allowed for its rule: prompt violation, major, or
minor.

Software accepts a judgment only if it has the required fields, cites groups
and descriptions that exist, and uses a severity allowed for its rule. An
evidence quote that can’t be matched to a linked description is kept as a
warning. Software, not the model, sets each proposal’s verdict: the most severe
finding from either stage. The exact instructions, output schema, and
validation rules are in `judge-results.json` and on the page.

## How the model judge was run

Claude Code subagents ran the model judge on September 16, 2026, using Claude
Opus 5 (`claude-opus-5`). Each call judged one proposal in a fresh subagent.
Each subagent saw only the judging instructions and that one rendered proposal.
It didn’t see model names, option letters, other proposals, or expert ratings.
The judge instructions were frozen before the first judgment was produced. No
ontology project model account or cloud credits were used. A hash ties each
judgment to its exact request, and software validated every judgment without
repairing it.

The second run in `judge-results-run-2.json` used the same instructions and
inputs. The `stability` field of `execution` describes how the verdicts
differed between the two runs. The judge was run by a Claude model, not by the
OpenAI models that would run it in the production title pipeline.

These results are in-sample development evidence, not a measure of accuracy.
The judge instructions were written after reading Rob’s description of the two
errors and notes on these 18 examples, so agreement with expert review is
likely optimistic. The findings are possible problems for experts to review.
They are not ground truth or expert judgments.

## Results summary

In both runs, all 72 judgments passed software validation without quote
warnings, and all 144 subagents used no tool other than reading the
instructions file and their own proposal file. First-run verdicts:

| Model | Prompt violation | Major issue | Minor issue | No issues found |
| --- | ---: | ---: | ---: | ---: |
| GPT-6 Astra | 0 | 1 | 7 | 10 |
| GPT-5.6 Sol | 1 | 2 | 7 | 8 |
| GPT-5.6 Terra | 1 | 4 | 9 | 4 |
| GPT-5.4 Mini | 2 | 4 | 7 | 5 |
| All 72 proposals | 4 | 11 | 30 | 27 |

Software found the two changed verbs in Terra’s Measure Equipment proposal;
every other finding came from the model judge. In the second run, 8 of the 72
verdicts differed, and 2 of those crossed between minor-or-none and
major-or-worse. Counts of findings are not measures of proposal quality or of
the judge’s accuracy.

## Reproduction

From the repository root, run:

```
node --test scripts/som-review/title-clarification-judge-lib.test.mjs
```

This test makes no model calls. It checks that:

- the prompt, clarification, and hashes are exact
- every input equals the September 14 study
- each example’s letters cover all four models
- every raw answer is kept, and re-parsing it reproduces the stored groups,
  reasons, and software observations

The test also re-validates every recorded judgment. It re-runs ingestion from
the raw judgment text, and the result must reproduce each judge results file
exactly, including statuses, software findings, and verdicts. Model outputs are
stochastic, so running a model again need not reproduce its answers or
judgments.

## Not included

This folder doesn’t include private request files, provider request or attempt
identifiers, cost ledgers or journals, capacity or account records, or
credentials. It also doesn’t include communications with reviewers or any
expert’s ratings. Nothing in this folder changes the ontology.
