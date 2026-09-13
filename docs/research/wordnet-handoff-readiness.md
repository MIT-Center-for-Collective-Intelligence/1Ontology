# WordNet handoff readiness

Status: offline preparation for the later WordNet stage. This change adds no
alignment runner, model calls, review dataset, application route, or ontology
writes. The September 13 title examples remain development proposals awaiting
expert discussion. Title grouping comes first; WordNet review still requires
accepted final groups and explicit authorization to begin the stage.

## Exact local retrieval

`scripts/som-review/pinned_wordnet.py` supplies two separate operations:

1. `resolve_inherited_verbs(ids)` preserves every supplied inherited verb sense,
   including a sense whose lemma differs from the activity's verb. It retains
   each requested ID alongside the resolved canonical ID. Invalid references
   fail explicitly; the helper never drops or substitutes them.
2. `lookup_exact_verb(verb)` reads every offset listed for that exact English
   lemma in `index.verb`. It normalizes case and word separators, preserving
   multiword verbs, but does not stem, infer synonyms, or infer a verb by
   subtracting a direct object from the activity title. An unknown lemma returns
   an empty candidate list, not a judgment that WordNet has no suitable sense.

This avoids the default NLTK lookup's word-form expansion. In the existing local
corpus, `synsets('saw', pos='v')` returns 25 senses, including senses of `see`;
the exact `saw` verb index contains only `saw.v.01`. This is a lexical software
regression test, not an ontology alignment proposal.

The helper requires an explicitly supplied local archive. It checks the complete
archive hash, WordNet version, and NLTK version against
`scripts/som-review/wordnet-corpus-lock.json`. The lock records the existing local
WordNet 3.0 archive and NLTK 3.9.2. It reads the archive into memory once and uses
those same verified bytes, preventing a later file replacement from changing the
open reader. Output records the archive, verb-index and lock hashes. It neither
downloads a corpus nor consults a global NLTK corpus search path.
The English-only reader disables NLTK's automatic multilingual cross-version
mapping, which would otherwise consult a second corpus despite the explicit root.

The corpus is not included in this repository. Keep its license with the local
archive. Changing the lock is an explicit dependency change that requires the
same completeness checks and an assessment of compatibility with inherited IDs.

## Verification

Portable tests (four tests, with the eleven corpus integration tests explicitly
skipped when the archive is not supplied):

```sh
python3 -m unittest discover -s scripts/som-review -p 'test_pinned_wordnet.py' -v
```

Full offline verification, using an existing local archive:

```sh
WORDNET_ARCHIVE=/absolute/path/to/wordnet.zip python3 -m unittest discover -s scripts/som-review -p 'test_pinned_wordnet.py' -v
```

All 15 tests passed against the pinned archive on September 13. The integration
check independently reads every index entry and compares all 11,529 exact verb
lemmas and 25,047 indexed sense memberships with the returned offsets. It also
checks multiword verbs, original lemma capitalization, missing words, inherited
references, version/hash mismatches, and replacement of the archive after it has
been verified. A further regression test makes global corpus lookups and
downloads fail, while verifying that both helper operations still work.
Completeness against a dictionary is not semantic correctness.

## Legacy scripts are not the current handoff

The older scripts are preserved for historical reproduction. Do not treat them
as approved runners for the September 13 title examples:

- `build-wordnet-alignment-bundles.py` consumes mechanically validated groupings
  without an expert-acceptance record, extracts only the first word of the title,
  and uses the morphology-expanding NLTK lookup.
- `build-all-candidate-wordnet-bundles.py` accepts manually listed occurrence IDs
  and requires the older `canonicalDirectObject` and `sourceClaims` fields. The
  current title proposals intentionally do not use that representation. It also
  filters inherited senses by lemma before the suitability judgment and does not
  pin the corpus bytes.
- The historical WordNet prompt receives inherited senses and all alternatives
  together. The current intended procedure first evaluates the inherited sense
  using the accepted title and all homogeneous evidence, then retrieves exact-verb
  alternatives only when replacement is needed.

This helper is deliberately not wired into those historical scripts. Updating
their outputs in place would change the meaning of the archived provenance.

## Remaining stage requirements

Before an alignment run, the orchestrator must bind each accepted final group to
its exact title, every full source description, ontology snapshot, proposal
version/hash, relevant review history, and explicit expert acceptance. A typed
occurrence ID or a model's `completed` status is not proof of acceptance. Rob's
earlier v6 votes must not be transferred to the new Astra proposals.

Stock Area's overlapping-membership question remains an expert policy decision.
Preserve that decision with any resulting group memberships. Leading-verb cleanup,
including Conduct-to-Research and Act/Perform cases, remains deferred. Preserve
each occurrence's inherited senses: repeated title/evidence groups can occur under
different owners, so reuse must also match the inherited-sense context.

After acceptance and stage authorization, compare each group's final title and
all its homogeneous evidence with all inherited senses. If replacement is needed,
retrieve every exact-verb candidate from the pinned corpus and constrain the model
to those candidates. Unresolved IDs, no candidates, or ambiguity require explicit
handling; they must not trigger web search or invented senses. The model's choice
then remains an expert-review proposal. Final placement and ontology mutation are
separate, explicitly authorized operations.

Each paid stage must use the approved ACCESS Azure GPT-6 Astra deployment with
Max reasoning and a new bounded ledger after funding, capacity, prior usage and
prices are reconciled. Preserve the award reserve and account for failures,
retries, cached input, cache writes, output and unknown-usage reservations.

A later two-stage call forecast depends on both the accepted group count and the
number needing replacement: one inherited-sense assessment per eligible context,
plus one candidate-selection request per unsuitable inherited context, plus any
separately approved audits. Those counts and full request sizes are not yet
measured for an accepted title release. The earlier one-call-per-group scenarios
must not be presented as measured Astra costs or authorization for this stage.
