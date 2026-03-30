"""
Build a transformed ontology JSON (`.transformed.json`) from a legacy hierarchy file
(`compare-ontology/<FILE_NAME>.json`, e.g. `0112_FINALHIERARCHY.json`).

The script parses labels, disambiguates duplicate base titles when child structure
differs, and emits each node as `{ title, description, parts, specializations }`
(same overall shape as `compare-ontology/0112-dn.json`).

---
When comparing ontology node presence and locations across two JSON formats, these
are treated as ignorable or normalized (legacy key-tree vs node-object format such as
`Final Ontology - edited 0228.json`):

- "(Synonyms: ...)" suffixes in labels
- "(Verb.v.0n ...)" style verb-sense suffixes in labels
- "(Specializations)" intermediary nodes
- "(Atomic Tasks)" intermediary nodes
- "[Verb -- miscellaneous]" intermediary nodes
- Non-structural properties in the edited format (title/description/parts/etc.)

This file performs the transform and write only; it does not diff two inputs. For
side-by-side comparison logic, see `compare-ontology/compare-hierarchy-to-transformed.py`.
"""

from __future__ import annotations

import json
import os
import re
import sys
from typing import Any, Dict, List, MutableMapping, Optional, Tuple

FILE_NAME = "0112_FINALHIERARCHY"

# Carries synonym line for `description`; stripped before traversing children.
STAGING_SYNONYM_DESC_KEY = "__stagingSynonyms"

JsonValue = Any
JsonObject = Dict[str, JsonValue]


def parse_ontology_title(raw_title: str) -> Tuple[str, List[Dict[str, Optional[str]]]]:
    title = raw_title.strip()
    if title.startswith("(O*Net)"):
        return title, []

    synonym_entries: List[Dict[str, Optional[str]]] = []
    # Parentheticals at the end of the title only; still normalized to a suffix.
    suffix_parentheses: List[str] = []

    out_parts: List[str] = []
    last_index = 0

    for match in re.finditer(r"\(([^)]+)\)", title):
        start = match.start()
        full = match.group(0)
        content = match.group(1).strip()
        end = match.end()
        after = title[end:].lstrip()
        is_middle = len(after) > 0 and not after.startswith("(")

        out_parts.append(title[last_index:start])

        synonym_match = re.match(r"^Synonyms\s*:\s*(.+)$", content, re.I)
        if synonym_match:
            synonyms = [
                s.strip() for s in synonym_match.group(1).split(",") if s.strip()
            ]
            synonym_entries.extend({"name": n} for n in synonyms)
        else:
            parts = [s.strip() for s in content.split(",")]
            kept_parts: List[str] = []
            for s in parts:
                version_match = re.search(r"\.v\.?(\d+)", s, re.I)
                if version_match:
                    clean_name = re.sub(r"\.v\.?\d+", "", s, flags=re.I).strip()
                    synonym_entries.append(
                        {
                            "name": clean_name,
                            "version": f"v.{version_match.group(1)}",
                        }
                    )
                else:
                    kept_parts.append(s)
            if kept_parts:
                segment = f"({', '.join(kept_parts)})"
                if is_middle:
                    out_parts.append(segment)
                else:
                    suffix_parentheses.append(segment)

        last_index = end

    out_parts.append(title[last_index:])
    title = "".join(out_parts)
    title = re.sub(r"\s+", " ", title).strip()
    if suffix_parentheses:
        title = f"{title} {' '.join(suffix_parentheses)}".strip()
    title = re.sub(r"\.v\.?\d+", "", title, flags=re.I).strip()

    return title, synonym_entries


def description_from_synonyms(display_title: str) -> str:
    _, synonyms = parse_ontology_title(display_title)
    if not synonyms:
        return ""
    return "Synonyms: " + ", ".join(s["name"] or "" for s in synonyms)


def synonym_line_from_names(synonyms: List[str]) -> str:
    if not synonyms:
        return ""
    return "Synonyms: " + ", ".join(synonyms)


def attach_synonym_description(
    body: JsonObject,
    synonym_description: str,
) -> JsonObject:
    if not synonym_description:
        return body
    return {**body, STAGING_SYNONYM_DESC_KEY: synonym_description}


def peel_synonym_description(obj: JsonObject) -> Tuple[str, JsonObject]:
    raw = obj.get(STAGING_SYNONYM_DESC_KEY)
    description = raw if isinstance(raw, str) else ""
    if not description:
        return "", obj
    rest = dict(obj)
    del rest[STAGING_SYNONYM_DESC_KEY]
    return description, rest


def wrap_dn_subtree(value: JsonValue, display_title: str) -> JsonObject:
    parts: List[Any] = []
    peeled_description = ""
    node_value = value

    if (
        value is not None
        and isinstance(value, dict)
        and STAGING_SYNONYM_DESC_KEY in value
    ):
        peeled_description, rest = peel_synonym_description(value)
        node_value = rest

    description = peeled_description or description_from_synonyms(display_title)

    if isinstance(node_value, list):
        specializations: JsonObject = {}
        for item in node_value:
            s = str(item)
            specializations[s] = {
                "title": s,
                "description": description_from_synonyms(s),
                "parts": [],
                "specializations": {},
            }
        return {
            "title": display_title,
            "description": description,
            "parts": parts,
            "specializations": specializations,
        }

    if node_value is None or not isinstance(node_value, dict):
        return {
            "title": display_title,
            "description": description,
            "parts": parts,
            "specializations": {},
        }

    specializations = {}
    obj = node_value

    for key in list(obj.keys()):
        k = key.strip().lower()

        if k == "(specializations)":
            inner = obj[key]
            if (
                inner is not None
                and isinstance(inner, dict)
                and not isinstance(inner, list)
            ):
                for child_key in inner:
                    specializations[child_key] = wrap_dn_subtree(
                        inner[child_key], child_key
                    )
            continue

        if k == "(atomic tasks)":
            inner = obj[key]
            bracket_name = (
                f"[{parse_ontology_title(display_title)[0]} -- miscellaneous]"
            )
            children: JsonObject = {}
            if (
                inner is not None
                and isinstance(inner, dict)
                and not isinstance(inner, list)
            ):
                for child_key in inner:
                    children[child_key] = wrap_dn_subtree(inner[child_key], child_key)
            specializations[bracket_name] = {
                "title": bracket_name,
                "description": description_from_synonyms(bracket_name),
                "parts": [],
                "specializations": children,
            }
            continue

        specializations[key] = wrap_dn_subtree(obj[key], key)

    return {
        "title": display_title,
        "description": description,
        "parts": parts,
        "specializations": specializations,
    }


def wrap_dn_root(input_val: JsonValue) -> JsonObject:
    if (
        input_val is None
        or not isinstance(input_val, dict)
        or isinstance(input_val, list)
    ):
        return {}
    out: JsonObject = {}
    for key in input_val:
        out[key] = wrap_dn_subtree(input_val[key], key)
    return out


def get_base_title(title: str) -> Tuple[str, List[str]]:
    if not title:
        return "", []
    nt, se = parse_ontology_title(title)
    return nt, [s["name"] or "" for s in se]


def is_collection_key(key: str) -> bool:
    if not key:
        return False
    k = key.strip().lower()
    return (
        k == "(atomic tasks)"
        or k == "(specializations)"
        or (key.startswith("[") and key.endswith("]"))
    )


def are_children_same(a: List[str], b: List[str]) -> bool:
    return len(a) == len(b) and all(a[i] == b[i] for i in range(len(a)))


def canonicalize_for_signature(value: JsonValue) -> JsonValue:
    if value is None:
        return None
    if isinstance(value, list):
        out = []
        for item in value:
            if item is None:
                out.append(None)
            elif isinstance(item, dict):
                out.append(canonicalize_for_signature(item))
            elif isinstance(item, str):
                out.append(item)
            else:
                out.append(str(item))
        return out
    if not isinstance(value, dict):
        return value

    result: JsonObject = {}
    keys = sorted(value.keys(), key=lambda x: x)
    for key in keys:
        normalized_key = (
            f"collection:{key.strip().lower()}"
            if is_collection_key(key)
            else f"title:{get_base_title(key)[0].lower()}"
        )
        result[normalized_key] = canonicalize_for_signature(value[key])
    return result


def build_structure_signature(value: JsonValue) -> str:
    try:
        return json.dumps(
            canonicalize_for_signature(value), sort_keys=True, separators=(",", ":")
        )
    except (TypeError, ValueError):
        return ""


def collect_child_structure_signatures(obj: JsonValue) -> List[str]:
    signatures: List[str] = []

    if isinstance(obj, list):
        signatures.append(f"list::{build_structure_signature(obj)}")
        signatures.sort()
        return signatures
    if obj is not None and isinstance(obj, dict) and not isinstance(obj, list):
        for key in obj:
            if is_collection_key(key):
                col = obj[key]
                if col is not None and isinstance(col, dict):
                    for sub_key in col:
                        base = get_base_title(sub_key)[0].lower()
                        signatures.append(
                            f"{base}::{build_structure_signature(col[sub_key])}"
                        )
                else:
                    signatures.append(f"collection:{key.strip().lower()}::primitive")
            else:
                base = get_base_title(key)[0].lower()
                signatures.append(f"{base}::{build_structure_signature(obj[key])}")
    signatures.sort()
    return signatures


def designate_title(
    base_display: str,
    children_signatures: List[str],
    seen: MutableMapping[str, List[Dict[str, List[str]]]],
) -> str:
    key = base_display.lower()
    existing = seen.get(key) or []
    match_idx = -1
    for i, ev in enumerate(existing):
        if are_children_same(ev["childrenSignatures"], children_signatures):
            match_idx = i
            break

    if match_idx == -1:
        existing.append({"childrenSignatures": list(children_signatures)})
        seen[key] = existing
        idx = len(existing) - 1
        return base_display if idx == 0 else f"{base_display} ({idx})"
    return base_display if match_idx == 0 else f"{base_display} ({match_idx})"


def deep_equal_json(a: JsonValue, b: JsonValue) -> bool:
    if a is b:
        return True
    if a is None or b is None:
        return a is b
    # Match TS order: arrays, then objects; typeof mismatch before object branch.
    if isinstance(a, list):
        if not isinstance(b, list) or len(a) != len(b):
            return False
        return all(deep_equal_json(a[i], b[i]) for i in range(len(a)))
    if isinstance(b, list):
        return False

    if isinstance(a, dict):
        if not isinstance(b, dict):
            return False
        keys = list(a.keys())
        if len(b) != len(keys):
            return False
        for k in keys:
            if k not in b:
                return False
            if not deep_equal_json(a[k], b[k]):
                return False
        return True
    if isinstance(b, dict):
        return False

    if type(a) != type(b):
        return False
    return a == b


def put_transformed_sibling(
    output: JsonObject,
    title: str,
    next_value: JsonObject,
    source_key: str,
    first_source_by_title: MutableMapping[str, str],
) -> None:
    if title in output:
        existing = output[title]
        if deep_equal_json(existing, next_value):
            return
        first_key = first_source_by_title.get(title, "(unknown)")
        raise RuntimeError(
            "transformOntology: duplicate output title "
            f"{json.dumps(title)} from input keys {json.dumps(first_key)} "
            f"and {json.dumps(source_key)} (subtrees differ)."
        )
    first_source_by_title[title] = source_key
    output[title] = next_value


def transform_ontology(
    input_val: JsonValue,
    seen: MutableMapping[str, List[Dict[str, List[str]]]],
) -> JsonObject:
    if input_val is None:
        return {}
    if isinstance(input_val, list):
        return {}
    if not isinstance(input_val, dict):
        return {}

    output: JsonObject = {}
    first_source_by_title: Dict[str, str] = {}

    for key in input_val:
        if is_collection_key(key):
            collection_value = input_val[key]
            key_lower = key.strip().lower()
            if collection_value is not None and isinstance(collection_value, dict):
                output[key] = transform_ontology(collection_value, seen)
            elif key_lower in ("(atomic tasks)", "(specializations)"):
                output[key] = {}
            continue

        value = input_val[key]
        base_display, synonyms = get_base_title(key)
        children_signatures = collect_child_structure_signatures(value)
        title = designate_title(base_display, children_signatures, seen)
        meta_line = synonym_line_from_names(synonyms)

        if isinstance(value, list):
            converted: JsonObject = {}
            for item in value:
                converted[str(item)] = {}
            put_transformed_sibling(
                output,
                title,
                attach_synonym_description(converted, meta_line),
                key,
                first_source_by_title,
            )
        elif value is not None and isinstance(value, dict):
            put_transformed_sibling(
                output,
                title,
                attach_synonym_description(transform_ontology(value, seen), meta_line),
                key,
                first_source_by_title,
            )
        else:
            put_transformed_sibling(
                output,
                title,
                attach_synonym_description({}, meta_line),
                key,
                first_source_by_title,
            )

    return output


def main() -> None:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(script_dir, f"{FILE_NAME}.json")
    try:
        with open(json_path, encoding="utf-8") as f:
            ontology_object = json.load(f)
    except FileNotFoundError:
        print(f"Missing input file: {json_path}", file=sys.stderr)
        sys.exit(1)

    try:
        seen_map: Dict[str, List[Dict[str, List[str]]]] = {}
        normalized_tree = transform_ontology(ontology_object, seen_map)
        transformed = wrap_dn_root(normalized_tree)

        out_path = os.path.join(script_dir, f"{FILE_NAME}.transformed.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(transformed, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print("Wrote:", out_path)
    except Exception as err:
        print(err, file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
