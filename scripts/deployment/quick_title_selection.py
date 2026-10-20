"""Attest the committed assignment overlay without changing private evidence."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SELECTION = ROOT / "src/lib/titleValidation/data/quick-selection-v1.json"
EVIDENCE_SHA256 = "683ccb70248e96813fca2d0b862584d7cd7a61518b9acab6d3d5fbdcd1492857"


def selection_release(raw):
    manifest = json.loads(SELECTION.read_bytes())
    if (hashlib.sha256(raw).hexdigest() != EVIDENCE_SHA256
            or manifest["bundleSha256"] != EVIDENCE_SHA256
            or manifest["version"] != "quick-title-selection-5-15-5-v1"
            or manifest["datasetVersion"] != "quick-title-verification-20261019-v1"
            or manifest["protectedCaseIds"] != ["g7R8Of6VGrYeRc7pfmDv"]):
        raise ValueError("Quick selection evidence binding changed")
    data = json.loads(raw)
    cases = data["cases"]
    selected_ids = set(manifest["initialCaseIds"])
    regular = [c for c in cases if c["batch"] != "flagged"]
    selected = [c for c in regular if c["id"] in selected_ids]
    reserve = [c for c in regular if c["id"] not in selected_ids]

    def counts(items):
        return {outcome: sum(c["outcome"] == outcome for c in items)
                for outcome in ("Keep", "Clarify", "Split")}

    if (data["version"] != manifest["datasetVersion"] or len(cases) != 419
            or len({c["id"] for c in cases}) != 419
            or len(selected_ids) != 25 or len(manifest["initialCaseIds"]) != 25
            or len(selected) != 25 or len(reserve) != 75 or len(regular) != 100
            or sum(c["batch"] == "flagged" for c in cases) != 319
            or not set(manifest["protectedCaseIds"]) <= selected_ids
            or counts(selected) != {"Keep": 5, "Clarify": 15, "Split": 5}
            or counts(reserve) != {"Keep": 1, "Clarify": 74, "Split": 0}
            or counts([c for c in regular if c["batch"] == "first25"]) !=
                {"Keep": 2, "Clarify": 22, "Split": 1}
            or counts([c for c in regular if c["batch"] == "next75"]) !=
                {"Keep": 4, "Clarify": 67, "Split": 4}):
        raise ValueError("Quick selection coverage changed")
    return {
        "selectionVersion": manifest["version"],
        "selectionSha256": hashlib.sha256(
            json.dumps(manifest, separators=(",", ":"), ensure_ascii=False).encode()
        ).hexdigest(),
        "initialOutcomes": counts(selected),
        "reservedOutcomes": counts(reserve),
        "selectionCoverage": {"initial": 25, "reserve": 75, "regular": 100, "flagged": 319, "cases": 419},
    }
