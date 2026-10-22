# Checking saved title proposals

Run the offline lexical checks before preparing another review package:

```sh
python3 -m unittest discover -s scripts/som-review -p test_title_output_quality.py
python3 scripts/som-review/audit-title-output-quality.py \
  --source-pages /absolute/path/source-pages.json \
  --pins /absolute/path/input-hashes.json \
  --output-dir /absolute/path/new-audit-directory
```

The pins JSON contains `sources`, a mapping from absolute input paths to their
previously verified SHA256 hashes. Alternatively supply `--frozen-cases` and
`--saved-proposals` JSONL files to check the full saved single-description
population. Join by original node and evidence IDs. No model, network, or
database calls occur. The output files are created exclusively; older reports
are never replaced.

The report checks repeated display titles, same-verb word-order candidates,
method wording within parallel same-verb activities, and similar purpose
clauses. It records different-verb parallel titles as context, not duplicates.
In particular, Calculate and Review remain distinct actions. Different object
types and different evidence records are never merged. Lexical findings do not
establish semantic error; equipment and purpose must apply to each activity.

The source package builder now stops if one activity repeats a title. Other
findings require expert review. Existing packages, review IDs, assignments,
ratings, original model outputs, prompts, and ontology content stay unchanged.
Revised proposals must be separately versioned and explicitly approved before
replacing material in a human evaluation. Do not repair an active study's inputs
while interpreting its existing ratings.

For reported timing interruptions, retain the raw measurements and record the
reviewer, study, source-page ID, report source, and uncertainty separately in an
analysis annotation. Never subtract an invented duration. Exclude flagged times
from a clean-time estimate or show sensitivity results including and excluding
them, with timing scopes kept separate.
