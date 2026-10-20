"""Stage the pinned private JSON evidence package, never execute archive content."""
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = Path(__file__).with_name("relationship-review-package.json")


def package_entries(manifest):
    entries = [manifest, *manifest.get("history", [])]
    if len({e["version"] for e in entries}) != len(entries):
        raise ValueError("Duplicate evidence version")
    for entry in entries:
        if "executionProofSha256" in entry:
            count = entry.get("executionProofFileCount")
            if type(count) is not int or not 1 <= count <= 512:
                raise ValueError("Invalid execution proof inventory bound")
        if entry.get("directory") and not re.fullmatch(r"[a-z0-9-]+", entry["directory"]):
            raise ValueError("Unsafe evidence directory")
    return entries


def verify_entry(directory, manifest):
    lock_bytes = (directory / "release-lock.json").read_bytes()
    if hashlib.sha256(lock_bytes).hexdigest() != manifest["releaseLockSha256"]:
        raise ValueError("Private evidence lock differs from committed hash")
    lock = json.loads(lock_bytes)
    filename = "dataset.json" if manifest.get("directory") else "top-level-v1.json"
    data = (directory / filename).read_bytes()
    dataset = json.loads(data)
    digest = hashlib.sha256(data).hexdigest()
    if (lock.get("previewOnly") or digest != manifest["bundleSha256"]
            or digest != lock["datasetSha256"] or dataset["version"] != manifest["version"]
            or len(dataset["cases"]) != manifest["cases"] or lock["caseCount"] != manifest["cases"]):
        raise ValueError("Private relationship package does not match committed release")
    expected = {filename, "release-lock.json"}
    for filename, key in [("presentation.json", "presentationSha256"), ("presentation-trace.json", "presentationTraceSha256"), ("source-graph.json", "sourceGraphSha256")]:
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
    if "executionProofSha256" in manifest:
        raw = (directory / "execution-proof.json").read_bytes()
        if hashlib.sha256(raw).hexdigest() != manifest["executionProofSha256"] or lock.get("executionProofSha256") != manifest["executionProofSha256"]:
            raise ValueError("Unpinned execution proof")
        proof = json.loads(raw)
        inventory = proof.get("files", [])
        if len(inventory) != manifest["executionProofFileCount"]:
            raise ValueError("Execution proof inventory count mismatch")
        expected.add("execution-proof.json")
        for item in inventory:
            name = item["name"]
            if not re.fullmatch(r"execution/[A-Za-z0-9_-]+\.json(?:l)?", name) or name in expected:
                raise ValueError("Unsafe or duplicate execution proof file")
            content = (directory / name).read_bytes()
            if len(content) != item["bytes"] or len(content) > 4 * 1024 * 1024 or hashlib.sha256(content).hexdigest() != item["sha256"]:
                raise ValueError("Execution proof file mismatch")
            expected.add(name)
        subprocess.run(["node", str(ROOT / "scripts/som-review/execution-cost-proof.mjs"), str(directory)], input=json.dumps(manifest), text=True, check=True, stdout=subprocess.PIPE)
    return expected


def expected_members(manifest):
    result = set()
    for entry in package_entries(manifest):
        prefix = entry.get("directory", "")
        names = {"dataset.json" if prefix else "top-level-v1.json", "release-lock.json"}
        if "presentationSha256" in entry:
            names.update({"presentation.json", "presentation-trace.json"})
        if "sourceGraphSha256" in entry:
            names.add("source-graph.json")
        if "executionProofSha256" in entry:
            names.add("execution-proof.json")
        # Case identifiers are checked after extraction; count remains bounded.
        result.update(str(Path(prefix) / name) for name in names)
    return result


def member_limits(name, entries):
    source_graph = name.endswith("source-graph.json")
    if source_graph and not any("sourceGraphSha256" in e and str(Path(e.get("directory", "")) / "source-graph.json") == name for e in entries):
        raise ValueError("Unpinned source graph")
    expanded = [e for e in entries if e.get("methodology") == "atomic-generalization-expansion-v1"]
    if any(not 1 <= e["cases"] <= 120 for e in expanded):
        raise ValueError("Expanded evidence case bound exceeded")
    expanded_trace = any("presentationTraceSha256" in e and str(Path(e.get("directory", "")) / "presentation-trace.json") == name for e in expanded)
    # Shared batch proofs retain exact requests once in this pinned JSON file.
    # Trace/data files and every older package retain their previous limits.
    member_mb = 32 if source_graph else 16 if expanded_trace else 4
    total_mb = 192 if any("executionProofSha256" in e for e in entries) else 96 if expanded else 64 if any("sourceGraphSha256" in e for e in entries) else 32
    return member_mb * 1024 * 1024, total_mb * 1024 * 1024


def private_tree_inventory(directory):
    files, directories = set(), set()

    def visit(target):
        info = target.lstat()  # Never follow evidence symlinks.
        mode = stat.S_IMODE(info.st_mode)
        if info.st_uid != os.geteuid():
            raise ValueError("Evidence is not owned by the staging user")
        if stat.S_ISDIR(info.st_mode):
            if mode not in (0o500, 0o700):
                raise ValueError("Evidence directory is not private")
            if target != directory:
                directories.add(str(target.relative_to(directory)))
            for child in target.iterdir():
                visit(child)
        elif stat.S_ISREG(info.st_mode):
            if mode not in (0o400, 0o600) or info.st_nlink != 1:
                raise ValueError("Evidence file is not private or has hard links")
            files.add(str(target.relative_to(directory)))
        else:
            raise ValueError("Evidence contains a symlink or nonregular object")

    if not stat.S_ISDIR(directory.lstat().st_mode):
        raise ValueError("Evidence root is not a directory")
    visit(directory)
    return files, directories


def verify_directory(directory, manifest):
    actual, actual_directories = private_tree_inventory(directory)
    expected = set()
    for entry in package_entries(manifest):
        prefix = entry.get("directory", "")
        expected.update(str(Path(prefix) / p) for p in verify_entry(directory / prefix, entry))
    expected_directories = {str(parent) for name in expected for parent in Path(name).parents if str(parent) != "."}
    if actual != expected or actual_directories != expected_directories:
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
            entries = package_entries(manifest)
            expected_count = sum(e["cases"] + (4 if "presentationSha256" in e else 2) + (1 if "sourceGraphSha256" in e else 0) + (1 + e["executionProofFileCount"] if "executionProofSha256" in e else 0) for e in entries)
            if len(members) != expected_count:
                raise ValueError("Unexpected private evidence member count")
            for member in members:
                if (member.type not in (tarfile.REGTYPE, tarfile.AREGTYPE) or member.sparse or member.name in seen or
                        not re.fullmatch(r"(?:[a-z0-9-]+/)?(?:dataset\.json|top-level-v1\.json|release-lock\.json|presentation\.json|presentation-trace\.json|source-graph\.json|execution-proof\.json|execution/[A-Za-z0-9_-]+\.json(?:l)?|traces/[A-Za-z0-9_-]+\.json)", member.name)):
                    raise ValueError("Unsafe or duplicate private archive member")
                seen.add(member.name)
                total += member.size
                member_limit, total_limit = member_limits(member.name, entries)
                if member.size < 0 or member.size > member_limit or total > total_limit:
                    raise ValueError("Private evidence archive exceeds bounded size")
                target = staging / member.name
                parent = staging
                for part in target.relative_to(staging).parts[:-1]:
                    parent = parent / part
                    parent.mkdir(mode=0o700, exist_ok=True)
                content = package.extractfile(member).read()
                if len(content) != member.size:
                    raise ValueError("Truncated private evidence member")
                if member.name.endswith(".jsonl"):
                    for line in content.splitlines():
                        if line.strip():
                            json.loads(line)
                else:
                    json.loads(content)
                with os.fdopen(os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "wb") as output:
                    output.write(content)
        verify_directory(staging, manifest)
        if os.path.lexists(destination):
            verify_directory(destination, manifest)  # Never overwrite existing evidence.
        else:
            staging.rename(destination)


def main():
    manifest = json.loads(MANIFEST.read_bytes())
    if not re.fullmatch(r"gs://ontology-41607_cloudbuild/relationship-review/[a-f0-9]{64}\.tar\.gz", manifest["gcsUri"]):
        raise ValueError("Unapproved private package location")
    destination = ROOT / "src/lib/relationshipReview/data"
    destination.parent.mkdir(parents=True, exist_ok=True)
    if os.path.lexists(destination):
        verify_directory(destination, manifest)
    else:
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary) / "evidence.tar.gz"
            subprocess.check_call(["gcloud", "storage", "cp", manifest["gcsUri"], str(archive), "--quiet"])
            stage_archive(archive, manifest, destination)
    print(json.dumps({"relationshipPackageStaged": True, "version": manifest["version"], "bundleSha256": manifest["bundleSha256"]}))


if __name__ == "__main__":
    main()
