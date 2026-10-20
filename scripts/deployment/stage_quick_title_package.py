"""Stage unchanged private review proposals, checking the committed release hash."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile
from quick_title_selection import selection_release

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = Path(__file__).with_name("quick-title-review-package.json")


def validate(raw, manifest):
    if len(raw) > 8 * 1024 * 1024 or hashlib.sha256(raw).hexdigest() != manifest["bundleSha256"]:
        raise ValueError("Private title-review package hash or size mismatch")
    data = json.loads(raw)
    cases = data["cases"]
    if (data["version"] != manifest["version"] or len(cases) != manifest["cases"]
            or len({c["id"] for c in cases}) != len(cases)):
        raise ValueError("Private title-review package version or coverage mismatch")
    for batch, key in [("first25", "initialRegular"), ("next75", "reservedRegular"), ("flagged", "flagged")]:
        if sum(c["batch"] == batch for c in cases) != manifest[key]:
            raise ValueError("Private title-review batch mismatch")
    selection_release(raw)


def main():
    manifest = json.loads(MANIFEST.read_bytes())
    if not re.fullmatch(r"gs://ontology-41607_cloudbuild/quick-title-review/[a-f0-9]{64}\.json", manifest["gcsUri"]):
        raise ValueError("Unapproved title-review storage location")
    target = ROOT / "src/lib/titleValidation/data/quick-v1.json"
    if target.exists():
        validate(target.read_bytes(), manifest)  # Never overwrite existing evidence.
    else:
        with tempfile.TemporaryDirectory() as directory:
            downloaded = Path(directory) / "package.json"
            subprocess.check_call(["gcloud", "storage", "cp", manifest["gcsUri"], str(downloaded), "--quiet"])
            raw = downloaded.read_bytes()
            validate(raw, manifest)
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open("xb") as output:
                output.write(raw)
            target.chmod(0o600)
    print(json.dumps({"quickTitlePackageStaged": True, "version": manifest["version"],
                      "bundleSha256": manifest["bundleSha256"], **selection_release(target.read_bytes())}))


if __name__ == "__main__":
    main()
