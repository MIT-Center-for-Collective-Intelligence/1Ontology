"""Stage the pinned private JSON evidence package, never execute archive content."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = Path(__file__).with_name("relationship-review-package.json")


def verify_directory(directory, manifest):
    lock_bytes = (directory / "release-lock.json").read_bytes()
    if hashlib.sha256(lock_bytes).hexdigest() != manifest["releaseLockSha256"]:
        raise ValueError("Private evidence lock differs from committed hash")
    lock = json.loads(lock_bytes)
    data = (directory / "top-level-v1.json").read_bytes()
    dataset = json.loads(data)
    digest = hashlib.sha256(data).hexdigest()
    if (lock.get("previewOnly") or digest != manifest["bundleSha256"]
            or digest != lock["datasetSha256"] or dataset["version"] != manifest["version"]
            or len(dataset["cases"]) != 68 or lock["caseCount"] != 68):
        raise ValueError("Private relationship package does not match committed release")
    expected = {"top-level-v1.json", "release-lock.json"}
    for filename, key in [("presentation.json", "presentationSha256"), ("presentation-trace.json", "presentationTraceSha256")]:
        if key in manifest:
            raw = (directory / filename).read_bytes()
            if hashlib.sha256(raw).hexdigest() != manifest[key]:
                raise ValueError("Selected-change evidence differs from committed hash")
            json.loads(raw)
            expected.add(filename)
    for case in dataset["cases"]:
        name = "traces/" + case["id"] + ".json"
        if not re.fullmatch(r"traces/[A-Za-z0-9_-]+\.json", name):
            raise ValueError("Invalid trace identifier")
        expected.add(name)
        raw = (directory / name).read_bytes()
        if hashlib.sha256(raw).hexdigest() != lock["traceHashes"][case["id"]]:
            raise ValueError("Private trace hash mismatch")
        json.loads(raw)
    actual = {str(p.relative_to(directory)) for p in directory.rglob("*") if p.is_file()}
    if actual != expected:
        raise ValueError("Unexpected evidence files in relationship package")


def stage_archive(archive, manifest, destination):
    if hashlib.sha256(archive.read_bytes()).hexdigest() != manifest["archiveSha256"]:
        raise ValueError("Private evidence archive hash mismatch")
    with tempfile.TemporaryDirectory(dir=destination.parent) as temporary:
        staging = Path(temporary)
        seen = set()
        total = 0
        with tarfile.open(archive, "r:gz") as package:
            members = package.getmembers()
            if len(members) != (72 if "presentationSha256" in manifest else 70):
                raise ValueError("Unexpected private evidence member count")
            for member in members:
                if (not member.isfile() or member.name in seen or
                        not re.fullmatch(r"(?:top-level-v1\.json|release-lock\.json|presentation\.json|presentation-trace\.json|traces/[A-Za-z0-9_-]+\.json)", member.name)):
                    raise ValueError("Unsafe or duplicate private archive member")
                seen.add(member.name)
                total += member.size
                if member.size > 4 * 1024 * 1024 or total > 32 * 1024 * 1024:
                    raise ValueError("Private evidence archive exceeds bounded size")
                target = staging / member.name
                target.parent.mkdir(exist_ok=True)
                content = package.extractfile(member).read()
                json.loads(content)
                target.write_bytes(content)
                target.chmod(0o600)
        verify_directory(staging, manifest)
        if destination.exists():
            verify_directory(destination, manifest)  # Never overwrite existing evidence.
        else:
            staging.rename(destination)


def main():
    manifest = json.loads(MANIFEST.read_bytes())
    if not re.fullmatch(r"gs://ontology-41607_cloudbuild/relationship-review/[a-f0-9]{64}\.tar\.gz", manifest["gcsUri"]):
        raise ValueError("Unapproved private package location")
    destination = ROOT / "src/lib/relationshipReview/data"
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        verify_directory(destination, manifest)
    else:
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary) / "evidence.tar.gz"
            subprocess.check_call(["gcloud", "storage", "cp", manifest["gcsUri"], str(archive), "--quiet"])
            stage_archive(archive, manifest, destination)
    print(json.dumps({"relationshipPackageStaged": True, "version": manifest["version"], "bundleSha256": manifest["bundleSha256"]}))


if __name__ == "__main__":
    main()
