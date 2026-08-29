#!/usr/bin/env python3
"""Build local WordNet candidate bundles for validated title groups."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any

from nltk.corpus import wordnet as wn


SYNONYM_SUFFIX = re.compile(r"\s*\(Synonyms?:[^)]*\)\s*$", re.IGNORECASE)
GENERIC_ACTIONS = {"act", "perform"}


def stable_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def leading_action(title: str) -> str:
    canonical = SYNONYM_SUFFIX.sub("", title).strip()
    return canonical.split(maxsplit=1)[0] if canonical else ""


def synset_detail(synset: Any) -> dict[str, Any]:
    return {
        "id": synset.name(),
        "definition": synset.definition(),
        "lemmas": sorted({lemma.name().replace("_", " ") for lemma in synset.lemmas()}),
        "examples": list(synset.examples()),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sample", required=True, type=Path)
    parser.add_argument("--groupings", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()

    sample_packet = read_json(args.sample.resolve())
    grouping_packet = read_json(args.groupings.resolve())
    if sample_packet["sourceSha256"] != grouping_packet["sourceSha256"]:
        raise ValueError("Sample and validated groupings use different source hierarchies")

    sample_by_id = {
        record["occurrenceId"]: record for record in sample_packet["sample"]
    }
    bundles: list[dict[str, Any]] = []
    for assessment in grouping_packet["assessments"]:
        record = sample_by_id[assessment["occurrenceId"]]
        assigned = []
        for synset_id in record.get("assignedSynsetIds", []):
            assigned.append(synset_detail(wn.synset(synset_id)))
        for group in assessment["groups"]:
            action = leading_action(group["title"])
            candidates = [
                synset_detail(synset)
                for synset in wn.synsets(action.lower(), pos=wn.VERB)
            ]
            source_indexes = group["sourceTaskIndexes"]
            source_records = [
                record["sourceRecords"][index - 1] for index in source_indexes
            ]
            group_id = "wordnet-" + stable_hash(
                f"{record['occurrenceId']}\x1f{group['title']}"
            )[:20]
            bundles.append(
                {
                    "groupId": group_id,
                    "occurrenceId": record["occurrenceId"],
                    "currentAtomicTitle": record["exactTitle"],
                    "groupTitle": group["title"],
                    "groupStatus": group["status"],
                    "leadingAction": action,
                    "sourceTaskIndexes": source_indexes,
                    "sourceRecords": source_records,
                    "ownerTitle": record["ownerTitle"],
                    "assignedSynsets": assigned,
                    "candidateSynsets": candidates,
                    "genericActionFlag": action.lower() in GENERIC_ACTIONS,
                }
            )

    output = {
        "schemaVersion": "wordnet-alignment-candidate-bundles-v1",
        "generatedAt": __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ).isoformat(),
        "sourceSha256": grouping_packet["sourceSha256"],
        "sampleSha256": stable_hash(args.sample.resolve().read_text(encoding="utf-8")),
        "groupingsSha256": stable_hash(
            args.groupings.resolve().read_text(encoding="utf-8")
        ),
        "retrievalRule": (
            "For each validated homogeneous title group, retrieve every local NLTK "
            "WordNet verb synset for the exact leading action and resolve every "
            "inherited owner synset. No web search or model call is used for retrieval."
        ),
        "genericActionRule": "Flag exact leading actions Act and Perform for a later generic-verb review.",
        "counts": {
            "groups": len(bundles),
            "groupsWithCandidates": sum(bool(item["candidateSynsets"]) for item in bundles),
            "groupsWithoutCandidates": sum(not item["candidateSynsets"] for item in bundles),
            "genericActionFlags": sum(item["genericActionFlag"] for item in bundles),
        },
        "bundles": bundles,
    }
    output_path = args.out.resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(f"PASS: built {len(bundles)} local WordNet candidate bundles")
    print(output_path)


if __name__ == "__main__":
    main()
