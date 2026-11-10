# Title verb preservation — prepared amendment

Add this instruction to the next title-clarification prompt:

> Keep the current title’s verb unchanged in every proposed title, including titles for split groups. Leave verb cleanup for a separate later step.

This wording was prepared through the approved ACCESS-funded Azure GPT-6 Astra
deployment, version 2026-09-03, with Max reasoning, in response to expert feedback.
The exact request, response, funding check, usage and source hashes are retained
in the private project audit records. It has not yet been used for a grouping run.

The [shared prompt document](https://docs.google.com/document/d/1ZUDNSY4ttNasTRVLPWwSl7jQcymWzLyeRiOk4LOOjmU/edit)
records this requested addition separately from the original, unchanged prompt.
The original development outputs and saved reviews remain historical evidence.

## Mechanical check

`scripts/som-review/title-verb-preservation.mjs` checks every proposed title
against an explicitly supplied original verb. The caller must supply the full
verb, including any particles; the helper does not infer it. Comparison permits
capitalization and whitespace differences, but not changed words, inflections,
or string prefixes such as `Conducted` in place of `Conduct`. Failed, incomplete,
unreadable and empty answers never pass. The check reports violations without
repairing or replacing the source answer.

Passing this check proves only that the supplied verb words are retained. It
does not prove semantic quality, approve grouping, or authorize ontology changes.
The helper is preparation for a later candidate run and is not wired into the
frozen study page or an inference runner.

Run the focused offline checks with:

```sh
node --test scripts/som-review/title-verb-preservation.test.mjs scripts/som-review/title-prompt-study-lib.test.mjs
```

All 14 checks passed. The frozen-case regression identifies the previously
observed 22 changed-verb groups across six of the 18 development cases, while
preserving the artifact bytes. The other twelve pass the verb check only.

## Group-size clarification remains open

The requested 5–9 target for titles with many descriptions could refer to
descriptions per group or groups per title. The user asked to put that question
to the expert in the unsent response draft. A strong rationale for exceptions
is part of the requested guidance, but no unit or target has been chosen in code
or a new grouping prompt. No regrouping run, semantic dataset deployment,
WordNet stage or ontology mutation follows from this change.
