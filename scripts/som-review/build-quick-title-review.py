"""Select unchanged saved proposals; no model calls and no database writes."""
import argparse
import hashlib
import json
import re
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument("--source", required=True)
p.add_argument("--previous-sample", required=True)
args = p.parse_args()
root = Path(__file__).resolve().parents[2]
raw = Path(args.source).read_bytes()
source_hash = hashlib.sha256(raw).hexdigest()
assert source_hash == "bd06d1dcb000b2ff36b93fde5f960180d36ccfbaa93c487ef0fd12eb5227579e"
rows = json.loads(raw)
usable = [r for r in rows if r["status"] in ("Keep", "Clarify", "Split")]
assert len(usable) == 10820
previous = json.loads(Path(args.previous_sample).read_text())
exclusions = set(previous["demonstrationExclusions"]["ids"])
seed = "quick-title-verification-20261019-proportional-v1"
order = lambda r: hashlib.sha256((seed + ":" + r["nodeId"]).encode()).hexdigest()
flag = lambda r: bool(re.search(r"human review|tentative", "\n".join([r["overallReason"], *r["groupReasons"]]), re.I))
selected = []
strata = []
for outcome, first, total in [("Keep", 2, 6), ("Clarify", 22, 89), ("Split", 1, 5)]:
    pool = [r for r in usable if r["status"] == outcome and not flag(r)]
    eligible = sorted([r for r in pool if r["nodeId"] not in exclusions], key=order)
    strata.append(dict(outcome=outcome, regularPopulation=len(pool), eligible=len(eligible), first25=first, cumulative100=total))
    selected.extend((r, "first25" if i < first else "next75") for i, r in enumerate(eligible[:total]))
flagged = sorted([r for r in usable if flag(r)], key=order)
assert len(flagged) == 319
selected.extend((r, "flagged") for r in flagged)
old = json.loads((root / "src/lib/titleValidation/data/prepilot-v1.json").read_text())
bundle = dict(version="quick-title-verification-20261019-v1", scientificPrompt=old["scientificPrompt"],
    provenance={**old["provenance"], "sourceCohortSha256": source_hash,
        "selectionSeed": seed, "selection": "Proportional stratified starting batch: 2 Keep, 22 Clarify, 1 Split. Reserved next 75: 4 Keep, 67 Clarify, 4 Split. All 319 keyword-flagged cases reserved for Rob/coordinators, including previously displayed examples. Regular pools exclude 12 previously displayed examples. Reviewer order is independently hashed. These are review proposals, not accepted ontology changes.",
        "flagRule": "Case-insensitive human review|tentative in overallReason or any groupReasons; keyword hits are not confirmed errors or calibrated confidence.",
        "strata": strata, "regularExampleExclusions": sorted(exclusions), "usable":10820, "flagged":319},
    cases=[dict(id=r["nodeId"], currentTitle=r["originalTitle"], description=r["description"], modelTitles=r["proposedTitles"],
        modelReason="\n".join([r["overallReason"], *r["groupReasons"]]), sourceId=str(r["oNetId"]), outcome=r["status"], batch=batch) for r, batch in selected])
assert len(bundle["cases"]) == len({c["id"] for c in bundle["cases"]}) == 419
output=root / "src/lib/titleValidation/data/quick-v1.json"
with output.open("x") as f:
    f.write(json.dumps(bundle, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({"path":str(output),"sha256":hashlib.sha256(output.read_bytes()).hexdigest(),"cases":419,"strata":strata}))
