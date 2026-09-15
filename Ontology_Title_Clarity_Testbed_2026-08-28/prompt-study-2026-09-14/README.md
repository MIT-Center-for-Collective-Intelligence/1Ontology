# Rob’s latest title prompt: third comparison version

This is a separate, read-only run of Rob’s revised prompt supplied by Iman on
September 14, 2026. The prompt file matches that supplied text, including its
wording and whitespace. The separately recorded clarification carries forward
Rob’s explanation that the approximate 5–9 target concerns descriptions per
new group. Both are shown in the exact-prompt disclosure.

The same 18 examples and all 240 numbered descriptions from the September 13
study are reused without modification. The earlier v6 and September 13
archives, ontology, and saved reviews are unchanged. This development sample
is not held-out evaluation data or a set of correct answers.

All 18 requests completed using GPT-6 Astra, version 2026-09-03, Max reasoning,
through MIT CloudBank Azure CIS261400. The run proposed 39 groups, compared
with 61 in v6 and 72 in the September 13 run. Group counts alone do not measure
quality. In particular, a broader category may lose a distinction reviewers
want. The original v6 run used a different model, GPT-5.6 Sol.

Every description is assigned once in this run, and all leading verbs are
preserved. Ordinary software checks also identify split groups outside the
approximate 5–9 target for review of the exception rationale. These are
observations, not semantic approval. A homogeneous group is not forced to
split to meet the target. Raw answers are never repaired or silently replaced.

`bundle.json` preserves each input, raw answer, numbered grouping, rationale,
model and request provenance, exact prompt, clarification, formatting
instructions, and software observations. Reproduce the mechanical display
with `node --test scripts/som-review/latest-title-prompt-study-lib.test.mjs`.
Model outputs are stochastic; replaying inference need not reproduce them.

There were 20 direct attempts: 18 completed and two were rejected because the
initial request wrapped the output schema incorrectly. Both rejections remain
in the private append-only journal, with $1.339399 in unknown-usage reserves.
The completed calls used 56,326 metered tokens, estimated at $1.989048 before
the conservative cache-write/1% allowance ($2.038218 with that allowance).
The direct all-in upper estimate is therefore $3.377617, below the $8 cap.
These are telemetry estimates, not invoices. Lead engineering and review
inference is included separately in the $20 incremental milestone ledger.

Private requests, live deployment checks, budgets, failed attempts, and raw
stream events are in the local `three-prompt-comparison-2026-09-14`
deliverables directory. Credentials are not present in this package.
