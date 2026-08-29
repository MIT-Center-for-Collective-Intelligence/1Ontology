#!/usr/bin/env python3
"""Build gated local WordNet packets for accepted homogeneous title groups."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from nltk.corpus import wordnet as wn


SYNONYM_SUFFIX = re.compile(r"\s*\(Synonyms?:[^)]*\)\s*$", re.IGNORECASE)
GENERIC_ACTIONS = {"act", "perform"}


def stable_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def normalize(value: str) -> str:
    return " ".join(SYNONYM_SUFFIX.sub("", value).strip().lower().split())


def action_phrase(title: str, canonical_direct_object: str) -> str:
    normalized_title = normalize(title)
    normalized_object = normalize(canonical_direct_object)
    suffix = f" {normalized_object}"
    if not normalized_object or not normalized_title.endswith(suffix):
        raise ValueError(
            f'"{title}" does not end with canonical object '
            f'"{canonical_direct_object}"'
        )
    action = normalized_title[: -len(suffix)].strip()
    if not action:
        raise ValueError(f'"{title}" has no action phrase')
    return action


def synset_detail(synset: Any) -> dict[str, Any]:
    return {
        "id": synset.name(),
        "definition": synset.definition(),
        "lemmas": sorted(
            {lemma.name().replace("_", " ") for lemma in synset.lemmas()}
        ),
        "examples": list(synset.examples()),
    }


def contains_action_lemma(synset: Any, action: str) -> bool:
    return any(
        normalize(lemma.name().replace("_", " ")) == action
        for lemma in synset.lemmas()
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sample", required=True, type=Path)
    parser.add_argument("--groupings", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--accepted-occurrence-id", action="append", default=[])
    parser.add_argument("--include-all-for-planning", action="store_true")
    args = parser.parse_args()

    if args.include_all_for_planning and args.accepted_occurrence_id:
        raise ValueError(
            "Use accepted occurrence IDs for a review run or the planning flag, not both"
        )
    if not args.include_all_for_planning and not args.accepted_occurrence_id:
        raise ValueError(
            "WordNet retrieval is gated on accepted title proposals. Supply at least "
            "one --accepted-occurrence-id, or use --include-all-for-planning only "
            "for a non-review cost preview."
        )

    sample_path = args.sample.resolve()
    grouping_path = args.groupings.resolve()
    sample_packet = read_json(sample_path)
    grouping_packet = read_json(grouping_path)
    if sample_packet["sourceSha256"] != grouping_packet["sourceSha256"]:
        raise ValueError("Sample and validated groupings use different source hierarchies")

    accepted_ids = set(args.accepted_occurrence_id)
    sample_by_id = {
        record["occurrenceId"]: record for record in sample_packet["sample"]
    }
    unknown_ids = accepted_ids - set(sample_by_id)
    if unknown_ids:
        raise ValueError(f"Unknown accepted occurrence IDs: {sorted(unknown_ids)}")

    bundles: list[dict[str, Any]] = []
    for assessment in grouping_packet["assessments"]:
        occurrence_id = assessment["occurrenceId"]
        if not args.include_all_for_planning and occurrence_id not in accepted_ids:
            continue
        record = sample_by_id[occurrence_id]
        all_inherited = [
            wn.synset(synset_id) for synset_id in record.get("assignedSynsetIds", [])
        ]
        for group in assessment["groups"]:
            action = action_phrase(group["title"], group["canonicalDirectObject"])
            candidates = wn.synsets(action.replace(" ", "_"), pos=wn.VERB)
            matching_inherited = [
                synset
                for synset in all_inherited
                if contains_action_lemma(synset, action)
            ]
            group_id = "wordnet-" + stable_hash(
                f"{occurrence_id}\x1f{group['title']}"
            )[:20]
            bundles.append(
                {
                    "groupId": group_id,
                    "occurrenceId": occurrence_id,
                    "currentAtomicTitle": record["exactTitle"],
                    "groupTitle": group["title"],
                    "canonicalDirectObject": group["canonicalDirectObject"],
                    "groupStatus": group["status"],
                    "actionPhrase": action,
                    "sourceClaims": group["sourceClaims"],
                    "ownerTitle": record["ownerTitle"],
                    "allInheritedSynsets": [
                        synset_detail(item) for item in all_inherited
                    ],
                    "inheritedSynsets": [
                        synset_detail(item) for item in matching_inherited
                    ],
                    "candidateSynsets": [
                        synset_detail(item) for item in candidates
                    ],
                    "genericActionFlag": action in GENERIC_ACTIONS,
                }
            )

    output = {
        "schemaVersion": "wordnet-all-candidate-bundles-v3",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sourceSha256": grouping_packet["sourceSha256"],
        "sampleSha256": stable_hash(sample_path.read_text(encoding="utf-8")),
        "groupingsSha256": stable_hash(
            grouping_path.read_text(encoding="utf-8")
        ),
        "mode": (
            "planning-preview"
            if args.include_all_for_planning
            else "accepted-title-groups"
        ),
        "retrievalRule": (
            "Derive the complete action phrase from the accepted title minus its "
            "declared canonical direct object. Retrieve every verb synset for that "
            "exact local WordNet lemma and retain inherited synsets only when they "
            "contain the same exact action lemma. No web or model lookup is used."
        ),
        "acceptanceGate": (
            "Review bundles require explicit accepted occurrence IDs. Planning preview "
            "bundles are estimation inputs only and must not be published as proposals."
        ),
        "counts": {
            "groups": len(bundles),
            "groupsWithCandidates": sum(
                bool(item["candidateSynsets"]) for item in bundles
            ),
            "groupsWithoutCandidates": sum(
                not item["candidateSynsets"] for item in bundles
            ),
            "groupsWithMatchingInheritedSynsets": sum(
                bool(item["inheritedSynsets"]) for item in bundles
            ),
            "genericActionFlags": sum(item["genericActionFlag"] for item in bundles),
        },
        "bundles": bundles,
    }
    output_path = args.out.resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(f"PASS: built {len(bundles)} gated all-candidate WordNet bundles")
    print(output_path)


if __name__ == "__main__":
    main()
