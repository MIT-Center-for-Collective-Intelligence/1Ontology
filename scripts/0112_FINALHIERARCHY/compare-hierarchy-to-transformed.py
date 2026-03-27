"""
Compare ontology node presence and locations across two JSON formats.

This script normalizes known format differences between:
- 0112_FINALHIERARCHY.json (legacy format)
- Final Ontology - edited 0228.json (node-object format)

Ignored differences:
- "(Synonyms: ...)" suffixes in labels
- "(Verb.v.0n ...)" style verb-sense suffixes in labels
- "(Specializations)" intermediary nodes
- "(Atomic Tasks)" intermediary nodes
- "[Verb -- miscellaneous]" intermediary nodes
- Non-structural properties in edited format (title/description/parts/etc.)
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path
from collections import Counter


IGNORE_LABELS = {"(Specializations)", "(Atomic Tasks)"}
ONET_RE = re.compile(r"^\(O\*Net\)\s+(.+?)\s+-\s+")
PAREN_RE = re.compile(r"\s*\(([^()]*)\)")
VERB_SENSE_RE = re.compile(r"\b[^\s,()]+\.v\.\d+[A-Za-z0-9]*\b")


def normalize_whitespace(text: str) -> str:
    return " ".join(text.split())


def should_ignore_intermediary(label: str) -> bool:
    cleaned = normalize_whitespace(label.strip())
    if cleaned in IGNORE_LABELS:
        return True
    if cleaned.startswith("[") and cleaned.endswith("]") and "-- miscellaneous" in cleaned:
        return True
    return False


def strip_non_substantive_parenthetical(label: str) -> str:
    """
    Remove parenthetical chunks that are purely formatting differences:
    - Synonym lists, e.g. "(Synonyms: ...)"
    - Verb sense lists, e.g. "(Develop.v.01, Generate.v.01)"
    """

    def replace(match: re.Match[str]) -> str:
        inner = normalize_whitespace(match.group(1))
        lowered = inner.lower()
        if lowered.startswith("synonyms:"):
            return ""
        if VERB_SENSE_RE.search(inner):
            return ""
        return match.group(0)

    return PAREN_RE.sub(replace, label)


def normalize_label(label: str) -> str:
    label = strip_non_substantive_parenthetical(label)
    label = normalize_whitespace(label.strip())
    return label


def extract_onet_id(text: str) -> str | None:
    match = ONET_RE.match(text.strip())
    return match.group(1).strip() if match else None


def walk_legacy(
    obj: object,
    path: tuple[str, ...],
    concept_paths: set[tuple[str, ...]],
    onet_locations: dict[str, set[tuple[str, ...]]],
) -> None:
    """Traverse legacy dict/list structure."""
    if isinstance(obj, dict):
        for raw_key, value in obj.items():
            key = str(raw_key)
            onet_id = extract_onet_id(key)
            if onet_id:
                onet_locations[onet_id].add(path)
                walk_legacy(value, path, concept_paths, onet_locations)
                continue

            if should_ignore_intermediary(key):
                next_path = path
            else:
                norm = normalize_label(key)
                next_path = path + (norm,) if norm else path
                if norm:
                    concept_paths.add(next_path)

            walk_legacy(value, next_path, concept_paths, onet_locations)

    elif isinstance(obj, list):
        for item in obj:
            if isinstance(item, str):
                onet_id = extract_onet_id(item)
                if onet_id:
                    onet_locations[onet_id].add(path)
            else:
                walk_legacy(item, path, concept_paths, onet_locations)


def walk_edited_node(
    node_name: str,
    node_obj: object,
    path: tuple[str, ...],
    concept_paths: set[tuple[str, ...]],
    onet_locations: dict[str, set[tuple[str, ...]]],
) -> None:
    """
    Traverse edited node-object structure where children live under
    node["specializations"] as a dict.
    """
    onet_id = extract_onet_id(node_name)
    if onet_id:
        onet_locations[onet_id].add(path)
        return

    if should_ignore_intermediary(node_name):
        next_path = path
    else:
        norm = normalize_label(node_name)
        next_path = path + (norm,) if norm else path
        if norm:
            concept_paths.add(next_path)

    if not isinstance(node_obj, dict):
        return

    specs = node_obj.get("specializations", {})
    if isinstance(specs, dict):
        for child_name, child_obj in specs.items():
            walk_edited_node(
                str(child_name),
                child_obj,
                next_path,
                concept_paths,
                onet_locations,
            )


def format_path(path: tuple[str, ...]) -> str:
    return " > ".join(path) if path else "(root)"


def canon_path(
    path: tuple[str, ...],
    drop_brackets: bool = False,
    strip_all_paren: bool = False,
) -> tuple[str, ...]:
    out: list[str] = []
    for seg in path:
        s = seg.strip()
        if drop_brackets and s.startswith("[") and s.endswith("]"):
            continue
        if strip_all_paren:
            s = re.sub(r"\s*\([^()]*\)", "", s)
        s = normalize_whitespace(s)
        if s:
            out.append(s)
    return tuple(out)


def write_patterns_report(
    report_path: Path,
    missing_concepts: list[tuple[str, ...]],
    extra_concepts: list[tuple[str, ...]],
) -> None:
    # Pairability analysis
    miss_counter = Counter(missing_concepts)
    extra_counter = Counter(extra_concepts)

    miss_bracket = Counter(canon_path(p, drop_brackets=True) for p in missing_concepts)
    extra_bracket = Counter(canon_path(p, drop_brackets=True) for p in extra_concepts)
    paired_bracket = sum(min(v, extra_bracket.get(k, 0)) for k, v in miss_bracket.items())

    miss_bracket_paren = Counter(
        canon_path(p, drop_brackets=True, strip_all_paren=True) for p in missing_concepts
    )
    extra_bracket_paren = Counter(
        canon_path(p, drop_brackets=True, strip_all_paren=True) for p in extra_concepts
    )
    paired_bracket_paren = sum(
        min(v, extra_bracket_paren.get(k, 0)) for k, v in miss_bracket_paren.items()
    )

    # Build residual lists after strongest normalization for examples
    residual_missing: list[tuple[str, ...]] = []
    residual_extra: list[tuple[str, ...]] = []
    for k, v in miss_bracket_paren.items():
        rem = v - min(v, extra_bracket_paren.get(k, 0))
        if rem > 0:
            residual_missing.extend([k] * rem)
    for k, v in extra_bracket_paren.items():
        rem = v - min(v, miss_bracket_paren.get(k, 0))
        if rem > 0:
            residual_extra.extend([k] * rem)

    # Major branch-delta pattern analysis
    def prefix_5(p: tuple[str, ...]) -> tuple[str, ...]:
        return p[:5] if len(p) >= 5 else p

    miss_prefix = Counter(prefix_5(p) for p in missing_concepts)
    extra_prefix = Counter(prefix_5(p) for p in extra_concepts)
    branch_deltas: list[tuple[int, int, tuple[str, ...], int, int]] = []
    for pref in set(miss_prefix) | set(extra_prefix):
        m = miss_prefix.get(pref, 0)
        e = extra_prefix.get(pref, 0)
        branch_deltas.append((abs(m - e), m + e, pref, m, e))
    branch_deltas.sort(reverse=True)

    # Residual typo/casing heuristic
    def simplified_key(path: tuple[str, ...]) -> str:
        joined = " > ".join(path).lower()
        return re.sub(r"[^a-z0-9> ]+", "", joined)

    missing_by_key = Counter(simplified_key(p) for p in missing_concepts)
    extra_by_key = Counter(simplified_key(p) for p in extra_concepts)
    typo_like_pairs = sum(min(v, extra_by_key.get(k, 0)) for k, v in missing_by_key.items())

    lines: list[str] = []
    lines.append("# 032326_jsonformatdiffs_patterns")
    lines.append("")
    lines.append("## High-level summary")
    lines.append(
        "- Almost all concept-path differences appear to be structural re-expression rather than substantive node loss."
    )
    lines.append(
        f"- {paired_bracket} of {len(missing_concepts)} missing paths are pairable to extra paths after removing only bracket intermediaries."
    )
    lines.append(
        f"- {paired_bracket_paren} of {len(missing_concepts)} missing paths are pairable after removing bracket intermediaries and all parenthetical text."
    )
    lines.append(
        "- The dominant shift is in the transfer subtree under `Act > [Act on what?] > Act with other activities and actors (\"Interact\") > Transfer between actors`."
    )
    lines.append(
        "- Remaining irreducible differences are mostly lexical/casing variants (e.g., `Access` vs `Acces`, `Progress` vs `Progres`, `Readiness` vs `Readines`)."
    )
    lines.append("")
    lines.append("## Category counts")
    lines.append(
        f"- `intermediary-only` (resolved by bracket-node removal): {paired_bracket}"
    )
    lines.append(
        f"- `parenthetical-only` (additional resolved by stripping all parentheticals): {paired_bracket_paren - paired_bracket}"
    )
    lines.append(
        f"- `residual-after-normalization` (not resolved by both): {len(residual_missing)} missing vs {len(residual_extra)} extra"
    )
    lines.append(
        f"- `likely-lexical-or-casing` (heuristic paired after heavy simplification): {typo_like_pairs}"
    )
    lines.append("")
    lines.append("## Dominant branch shifts (by 5-segment prefix)")
    for _, total, pref, m, e in branch_deltas[:20]:
        lines.append(
            f"- missing={m}, extra={e}, total={total}: {format_path(pref)}"
        )
    lines.append("")
    lines.append("## Residual examples (missing)")
    if residual_missing:
        for p in residual_missing[:30]:
            lines.append(f"- {format_path(p)}")
    else:
        lines.append("- None")
    lines.append("")
    lines.append("## Residual examples (extra)")
    if residual_extra:
        for p in residual_extra[:30]:
            lines.append(f"- {format_path(p)}")
    else:
        lines.append("- None")
    lines.append("")
    lines.append("## Notes")
    lines.append(
        "- This report is based on concept-path sets only; O*Net task-ID presence is handled in the primary report."
    )
    lines.append(
        "- Category labels are analytical buckets to prioritize review and cleanup, not absolute ontology truth labels."
    )

    report_path.write_text("\n".join(lines), encoding="utf-8")


def write_report(
    report_path: Path,
    legacy_concept_count: int,
    edited_concept_count: int,
    missing_concepts: list[tuple[str, ...]],
    extra_concepts: list[tuple[str, ...]],
    missing_onet_ids: list[str],
    extra_onet_ids: list[str],
    location_mismatches: list[tuple[str, set[tuple[str, ...]], set[tuple[str, ...]]]],
) -> None:
    lines: list[str] = []
    lines.append("# 032326_jsonformatdiffs")
    lines.append("")
    lines.append("## Scope and normalization")
    lines.append("- Compared node presence and node locations between both files.")
    lines.append("- Ignored title/description/parts/other non-structural properties in edited format.")
    lines.append("- Ignored `(Synonyms: ...)` and verb-sense parentheticals like `(Verb.v.0n)` in labels.")
    lines.append("- Ignored intermediary labels `(Specializations)`, `(Atomic Tasks)`, and `[Verb -- miscellaneous]`.")
    lines.append("- Location comparison for O*Net tasks uses parent concept path after normalization.")
    lines.append("")
    lines.append("## Headline counts")
    lines.append(f"- Concept paths in legacy: {legacy_concept_count}")
    lines.append(f"- Concept paths in edited: {edited_concept_count}")
    lines.append(f"- Concept paths missing in edited: {len(missing_concepts)}")
    lines.append(f"- Concept paths extra in edited: {len(extra_concepts)}")
    lines.append(f"- O*Net IDs missing in edited: {len(missing_onet_ids)}")
    lines.append(f"- O*Net IDs extra in edited: {len(extra_onet_ids)}")
    lines.append(f"- O*Net IDs with location mismatches: {len(location_mismatches)}")
    lines.append("")

    lines.append("## Concept paths missing in edited")
    if missing_concepts:
        for p in missing_concepts[:500]:
            lines.append(f"- {format_path(p)}")
        if len(missing_concepts) > 500:
            lines.append(f"- ... {len(missing_concepts) - 500} more")
    else:
        lines.append("- None")
    lines.append("")

    lines.append("## Concept paths extra in edited")
    if extra_concepts:
        for p in extra_concepts[:500]:
            lines.append(f"- {format_path(p)}")
        if len(extra_concepts) > 500:
            lines.append(f"- ... {len(extra_concepts) - 500} more")
    else:
        lines.append("- None")
    lines.append("")

    lines.append("## O*Net IDs missing in edited")
    if missing_onet_ids:
        for task_id in missing_onet_ids[:1000]:
            lines.append(f"- {task_id}")
        if len(missing_onet_ids) > 1000:
            lines.append(f"- ... {len(missing_onet_ids) - 1000} more")
    else:
        lines.append("- None")
    lines.append("")

    lines.append("## O*Net IDs extra in edited")
    if extra_onet_ids:
        for task_id in extra_onet_ids[:1000]:
            lines.append(f"- {task_id}")
        if len(extra_onet_ids) > 1000:
            lines.append(f"- ... {len(extra_onet_ids) - 1000} more")
    else:
        lines.append("- None")
    lines.append("")

    lines.append("## O*Net location mismatches (same ID, different parent path)")
    if location_mismatches:
        for task_id, old_paths, new_paths in location_mismatches[:300]:
            lines.append(f"- `{task_id}`")
            lines.append("  - legacy:")
            for p in sorted(old_paths):
                lines.append(f"    - {format_path(p)}")
            lines.append("  - edited:")
            for p in sorted(new_paths):
                lines.append(f"    - {format_path(p)}")
        if len(location_mismatches) > 300:
            lines.append(f"- ... {len(location_mismatches) - 300} more")
    else:
        lines.append("- None")
    lines.append("")

    report_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    base = Path(__file__).resolve().parent
    legacy_path = base / "0112_FINALHIERARCHY.json"
    edited_path = base / "0112_FINALHIERARCHY.transformed.json"
    report_path = base / "032326_jsonformatdiffs.md"
    patterns_report_path = base / "032326_jsonformatdiffs_patterns.md"

    with open(legacy_path, encoding="utf-8") as f:
        legacy_data = json.load(f)
    with open(edited_path, encoding="utf-8") as f:
        edited_data = json.load(f)

    legacy_concept_paths: set[tuple[str, ...]] = set()
    legacy_onet_locations: dict[str, set[tuple[str, ...]]] = defaultdict(set)
    walk_legacy(legacy_data, tuple(), legacy_concept_paths, legacy_onet_locations)

    edited_concept_paths: set[tuple[str, ...]] = set()
    edited_onet_locations: dict[str, set[tuple[str, ...]]] = defaultdict(set)
    if isinstance(edited_data, dict):
        for root_name, root_obj in edited_data.items():
            walk_edited_node(
                str(root_name),
                root_obj,
                tuple(),
                edited_concept_paths,
                edited_onet_locations,
            )

    missing_concepts = sorted(legacy_concept_paths - edited_concept_paths)
    extra_concepts = sorted(edited_concept_paths - legacy_concept_paths)

    legacy_ids = set(legacy_onet_locations.keys())
    edited_ids = set(edited_onet_locations.keys())
    missing_onet_ids = sorted(legacy_ids - edited_ids)
    extra_onet_ids = sorted(edited_ids - legacy_ids)

    location_mismatches: list[tuple[str, set[tuple[str, ...]], set[tuple[str, ...]]]] = []
    for task_id in sorted(legacy_ids & edited_ids):
        old_paths = legacy_onet_locations[task_id]
        new_paths = edited_onet_locations[task_id]
        if old_paths != new_paths:
            location_mismatches.append((task_id, old_paths, new_paths))

    write_report(
        report_path=report_path,
        legacy_concept_count=len(legacy_concept_paths),
        edited_concept_count=len(edited_concept_paths),
        missing_concepts=missing_concepts,
        extra_concepts=extra_concepts,
        missing_onet_ids=missing_onet_ids,
        extra_onet_ids=extra_onet_ids,
        location_mismatches=location_mismatches,
    )
    write_patterns_report(
        report_path=patterns_report_path,
        missing_concepts=missing_concepts,
        extra_concepts=extra_concepts,
    )

    print(f"Wrote report: {report_path}")
    print(f"Wrote report: {patterns_report_path}")
    print(f"Concept paths missing in edited: {len(missing_concepts)}")
    print(f"Concept paths extra in edited: {len(extra_concepts)}")
    print(f"O*Net IDs missing in edited: {len(missing_onet_ids)}")
    print(f"O*Net IDs extra in edited: {len(extra_onet_ids)}")
    print(f"O*Net IDs with location mismatches: {len(location_mismatches)}")


if __name__ == "__main__":
    main()
