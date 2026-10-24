"""Stage pinned branch JSON only; never execute content or replace existing evidence.

Archive names are branches-v1/{dataset.json,release-lock.json,traces/<familyId>.json}.
The frozen source graph remains in the separately staged legacy data directory.
"""
import ctypes
import errno
import gzip
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tarfile
import tempfile
import zlib

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = Path(__file__).with_name("branch-review-package.json")
PACKAGE_SCHEMA = "private-generalization-branch-package-v1"
DATASET_SCHEMA = "generalization-branch-review-v1"
TRACE_SCHEMA = "private-generalization-branch-trace-v1"
VERSION = "generalization-branches-20261024-v1"
DIRECTORY = "branches-v1"
SOURCE_GRAPH_DIRECTORY = "atomic-v1"
SOURCE_SHA256 = "06daeedf3153e3f7efa00659d69d076aa0962efdd1c373642050f5831a96a703"
GCS_PREFIX = "gs://ontology-41607_cloudbuild/relationship-branches/"
FAMILY_COUNT, GROUP_COUNT = 18, 82
MAX_FILE_BYTES = 4 * 1024 * 1024
MAX_TOTAL_BYTES = 32 * 1024 * 1024
MAX_ARCHIVE_BYTES = 64 * 1024 * 1024
MAX_TAR_BYTES = MAX_TOTAL_BYTES + 1024 * 1024
MAX_SOURCE_BYTES = 32 * 1024 * 1024
MANIFEST_KEYS = set("schemaVersion version directory families groups bundleSha256 releaseLockSha256 sourceSha256 sourceGraph archiveSha256 gcsUri".split())
LOCK_KEYS = set("datasetSha256 familyCount groupCount sourceSha256 traceHashes".split())
SOURCE_FIELDS = ("sourceApp", "sourceCapturedAt", "sourceRecheckedAt", "sourceSha256", "priorDatasetVersion", "priorDatasetSha256")
HASH = re.compile(r"[a-f0-9]{64}")
ID = re.compile(r"[A-Za-z0-9_-]{1,128}")
MEMBER = re.compile(r"branches-v1/(?:dataset\.json|release-lock\.json|traces/[A-Za-z0-9_-]{1,128}\.json)")
DIRECTORIES = {DIRECTORY, DIRECTORY + "/traces"}


def _pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def _nonfinite(_):
    raise ValueError("Non-finite JSON number")


def _float(value):
    number = float(value)
    if not math.isfinite(number):
        _nonfinite(value)
    return number


def strict_json(raw):
    try:
        return json.loads(raw.decode("utf-8"), object_pairs_hook=_pairs,
                          parse_constant=_nonfinite, parse_float=_float)
    except (UnicodeError, RecursionError) as error:
        raise ValueError("Invalid bounded UTF-8 JSON") from error


def _is_hash(value):
    return isinstance(value, str) and HASH.fullmatch(value) is not None


def validate_manifest(manifest):
    if not isinstance(manifest, dict) or set(manifest) != MANIFEST_KEYS:
        raise ValueError("Unexpected branch manifest fields")
    if (manifest["schemaVersion"] != PACKAGE_SCHEMA or manifest["version"] != VERSION
            or manifest["directory"] != DIRECTORY
            or type(manifest["families"]) is not int or manifest["families"] != FAMILY_COUNT
            or type(manifest["groups"]) is not int or manifest["groups"] != GROUP_COUNT):
        raise ValueError("Branch manifest version or counts mismatch")
    if not all(_is_hash(manifest[key]) for key in
               ("bundleSha256", "releaseLockSha256", "sourceSha256", "archiveSha256")):
        raise ValueError("Invalid branch manifest hash")
    if (manifest["sourceSha256"] != SOURCE_SHA256 or manifest["sourceGraph"] !=
            {"directory": SOURCE_GRAPH_DIRECTORY, "sha256": SOURCE_SHA256}):
        raise ValueError("Branch manifest does not pin the shared source graph")
    if manifest["gcsUri"] != GCS_PREFIX + manifest["archiveSha256"] + ".tar.gz":
        raise ValueError("Unapproved or unpinned branch package location")
    return manifest


def release_identity(manifest):
    validate_manifest(manifest)
    return {key: manifest[key] for key in
            ("version", "families", "groups", "bundleSha256", "sourceSha256")}


def _directory_path(path):
    path = Path(path)
    if ".." in path.parts:
        raise ValueError("Package path traversal")
    path = path.absolute()
    current = Path(path.anchor)
    try:
        for part in path.parts[1:]:
            current = current / part
            if not stat.S_ISDIR(current.lstat().st_mode):
                raise ValueError("Package path contains a symlink or nondirectory")
    except OSError as error:
        raise ValueError("Missing or unsafe package directory") from error
    return path


def _private_directory(path):
    info = _directory_path(path).lstat()
    if info.st_uid != os.geteuid() or stat.S_IMODE(info.st_mode) not in (0o500, 0o700):
        raise ValueError("Branch evidence directory is not private or owned")


def _check_file(info, private):
    if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
        raise ValueError("Release file is nonregular or has links")
    if private and (info.st_uid != os.geteuid() or stat.S_IMODE(info.st_mode) not in (0o400, 0o600)):
        raise ValueError("Branch evidence file is not private or owned")


def _read_file(path, limit, private=True):
    path = Path(path)
    _directory_path(path.parent)
    try:
        flags = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC
        with os.fdopen(os.open(path, flags), "rb") as source:
            info = os.fstat(source.fileno())
            _check_file(info, private)
            if info.st_size < 0 or info.st_size > limit:
                raise ValueError("Release file exceeds bounded size")
            raw = source.read(limit + 1)
            after = os.fstat(source.fileno())
            _check_file(after, private)
            if (len(raw) != info.st_size or len(raw) > limit or
                    (after.st_size, after.st_mtime_ns, after.st_ctime_ns) !=
                    (info.st_size, info.st_mtime_ns, info.st_ctime_ns)):
                raise ValueError("Release file changed during verification")
            return raw
    except OSError as error:
        raise ValueError("Missing or unsafe release file") from error


def read_manifest(filename=None):
    raw = _read_file(MANIFEST if filename is None else filename, 64 * 1024, private=False)
    return validate_manifest(strict_json(raw))


def private_tree_inventory(directory):
    directory = _directory_path(directory)
    files, directories = set(), set()
    total = 0

    def visit(target):
        nonlocal total
        info = target.lstat()
        name = str(target.relative_to(directory))
        if stat.S_ISDIR(info.st_mode):
            if info.st_uid != os.geteuid() or stat.S_IMODE(info.st_mode) not in (0o500, 0o700):
                raise ValueError("Branch evidence directory is not private or owned")
            if target != directory:
                if name not in DIRECTORIES:
                    raise ValueError("Unexpected branch evidence directory")
                directories.add(name)
            for child in target.iterdir():
                visit(child)
        elif stat.S_ISREG(info.st_mode):
            _check_file(info, True)
            if not MEMBER.fullmatch(name):
                raise ValueError("Unexpected branch evidence file")
            files.add(name)
            total += info.st_size
            if (info.st_size < 0 or info.st_size > MAX_FILE_BYTES
                    or total > MAX_TOTAL_BYTES or len(files) > FAMILY_COUNT + 2):
                raise ValueError("Branch evidence exceeds bounded size or inventory")
        else:
            raise ValueError("Branch evidence contains a symlink or nonregular object")

    try:
        visit(directory)
    except OSError as error:
        raise ValueError("Unsafe branch evidence tree") from error
    return files, directories


def verify_source_graph(source_directory, manifest):
    validate_manifest(manifest)
    source_directory = Path(source_directory)
    _private_directory(source_directory)
    graph_directory = source_directory / SOURCE_GRAPH_DIRECTORY
    _private_directory(graph_directory)
    raw = _read_file(graph_directory / "source-graph.json", MAX_SOURCE_BYTES)
    if hashlib.sha256(raw).hexdigest() != manifest["sourceGraph"]["sha256"]:
        raise ValueError("Shared source graph hash mismatch")
    strict_json(raw)  # No collection/link shape assumptions here.


def verify_directory(directory, manifest, source_directory=None):
    validate_manifest(manifest)
    directory = _directory_path(directory)
    actual, actual_directories = private_tree_inventory(directory)
    package = directory / DIRECTORY
    lock_raw = _read_file(package / "release-lock.json", MAX_FILE_BYTES)
    if hashlib.sha256(lock_raw).hexdigest() != manifest["releaseLockSha256"]:
        raise ValueError("Branch release lock hash mismatch")
    lock = strict_json(lock_raw)
    if not isinstance(lock, dict) or set(lock) != LOCK_KEYS:
        raise ValueError("Unexpected branch lock fields")
    data_raw = _read_file(package / "dataset.json", MAX_FILE_BYTES)
    dataset = strict_json(data_raw)
    digest = hashlib.sha256(data_raw).hexdigest()
    if (not isinstance(dataset, dict) or dataset.get("schemaVersion") != DATASET_SCHEMA
            or dataset.get("version") != manifest["version"]
            or dataset.get("sourceSha256") != manifest["sourceSha256"]
            or digest != manifest["bundleSha256"] or digest != lock["datasetSha256"]
            or lock["sourceSha256"] != manifest["sourceSha256"]):
        raise ValueError("Branch dataset identity or hash mismatch")
    if (any(not isinstance(dataset.get(key), str) or not dataset[key] for key in SOURCE_FIELDS)
            or not _is_hash(dataset["priorDatasetSha256"])):
        raise ValueError("Invalid branch source provenance")
    families = dataset.get("families")
    if not isinstance(families, list):
        raise ValueError("Invalid branch family inventory")
    ids, group_count = set(), 0
    for family in families:
        if not isinstance(family, dict):
            raise ValueError("Invalid branch family")
        family_id, groups = family.get("id"), family.get("groups")
        source_cases = family.get("sourceCaseIds")
        if (not isinstance(family_id, str) or not ID.fullmatch(family_id) or family_id in ids
                or not isinstance(groups, list)
                or any(not isinstance(group, dict) or not isinstance(group.get("id"), str)
                       or not group["id"] for group in groups)
                or not isinstance(source_cases, list)
                or any(not isinstance(case_id, str) or not case_id for case_id in source_cases)):
            raise ValueError("Unsafe or duplicate branch family inventory")
        ids.add(family_id)
        group_count += len(groups)  # Includes every group, without semantic filtering.
    if (len(families) != manifest["families"] or group_count != manifest["groups"]
            or type(lock["familyCount"]) is not int or lock["familyCount"] != len(families)
            or type(lock["groupCount"]) is not int or lock["groupCount"] != group_count):
        raise ValueError("Branch dataset or lock counts mismatch")
    hashes = lock["traceHashes"]
    if not isinstance(hashes, dict) or set(hashes) != ids or not all(_is_hash(h) for h in hashes.values()):
        raise ValueError("Branch trace hash inventory mismatch")
    expected = {DIRECTORY + "/dataset.json", DIRECTORY + "/release-lock.json"}
    expected.update(DIRECTORY + "/traces/" + family_id + ".json" for family_id in ids)
    if actual != expected or actual_directories != DIRECTORIES:
        raise ValueError("Unexpected or missing branch package inventory")
    for family in families:
        family_id = family["id"]
        raw = _read_file(package / "traces" / (family_id + ".json"), MAX_FILE_BYTES)
        if hashlib.sha256(raw).hexdigest() != hashes[family_id]:
            raise ValueError("Branch trace hash mismatch")
        trace = strict_json(raw)
        provenance = {key: dataset[key] for key in SOURCE_FIELDS}
        provenance["sourceCaseIds"] = family["sourceCaseIds"]
        if (not isinstance(trace, dict) or trace.get("schemaVersion") != TRACE_SCHEMA
                or trace.get("familyId") != family_id or trace.get("datasetVersion") != VERSION
                or trace.get("fundingRoute") != "ACCESS" or trace.get("source") != provenance):
            raise ValueError("Branch trace identity or source mismatch")
    verify_source_graph(ROOT / "src/lib/relationshipReview/data" if source_directory is None
                        else source_directory, manifest)
    return release_identity(manifest)


def _rename_no_replace(source, destination):
    # Native atomic exclusion only; never emulate this with check-then-rename.
    if source.parent != destination.parent:
        raise ValueError("Atomic branch staging requires the same parent directory")
    if sys.platform == "linux":
        symbol, flags = "renameat2", 1  # RENAME_NOREPLACE
    elif sys.platform == "darwin":
        symbol, flags = "renameatx_np", 0x00000004  # Apple SDK RENAME_EXCL
    else:
        raise ValueError("Atomic no-overwrite staging is unavailable")
    rename = getattr(ctypes.CDLL(None, use_errno=True), symbol, None)
    if rename is None:
        raise ValueError("Atomic no-overwrite staging is unavailable")
    rename.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
    rename.restype = ctypes.c_int
    parent = os.open(source.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC)
    try:
        if rename(parent, os.fsencode(source.name), parent, os.fsencode(destination.name), flags) == 0:
            return True
        error = ctypes.get_errno()
        if error in (errno.EEXIST, errno.ENOTEMPTY):
            return False
        raise OSError(error, "Atomic branch package installation failed")
    finally:
        os.close(parent)


def stage_archive(archive, manifest, destination, source_directory=None):
    validate_manifest(manifest)
    destination = Path(destination)
    if ".." in destination.parts or not destination.name:
        raise ValueError("Unsafe branch package destination")
    _directory_path(destination.parent)
    destination = destination.absolute()
    raw = _read_file(archive, MAX_ARCHIVE_BYTES)
    if hashlib.sha256(raw).hexdigest() != manifest["archiveSha256"]:
        raise ValueError("Branch archive hash mismatch")
    try:
        with gzip.GzipFile(fileobj=io.BytesIO(raw)) as compressed:
            unpacked = compressed.read(MAX_TAR_BYTES + 1)
    except (OSError, EOFError, zlib.error) as error:
        raise ValueError("Invalid branch gzip archive") from error
    if len(unpacked) > MAX_TAR_BYTES:
        raise ValueError("Branch tar archive exceeds bounded size")
    with tempfile.TemporaryDirectory(dir=destination.parent) as temporary:
        staging = Path(temporary)
        seen, total = set(), 0
        try:
            with tarfile.open(fileobj=io.BytesIO(unpacked), mode="r:") as package:
                for member in package:
                    if (member.type not in (tarfile.REGTYPE, tarfile.AREGTYPE)
                            or member.sparse is not None or member.pax_headers or member.linkname
                            or member.name in seen or not MEMBER.fullmatch(member.name)):
                        raise ValueError("Unsafe or duplicate branch archive member")
                    seen.add(member.name)
                    total += member.size
                    if (len(seen) > FAMILY_COUNT + 2 or member.size < 0
                            or member.size > MAX_FILE_BYTES or total > MAX_TOTAL_BYTES):
                        raise ValueError("Branch archive exceeds bounded size or inventory")
                    with package.extractfile(member) as source:
                        content = source.read(member.size + 1)
                    if len(content) != member.size:
                        raise ValueError("Truncated branch archive member")
                    strict_json(content)
                    parent = staging
                    for part in Path(member.name).parts[:-1]:
                        parent = parent / part
                        parent.mkdir(mode=0o700, exist_ok=True)
                        _private_directory(parent)
                    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC
                    with os.fdopen(os.open(staging / member.name, flags, 0o600), "wb") as output:
                        os.fchmod(output.fileno(), 0o600)
                        output.write(content)
                        output.flush()
                        os.fsync(output.fileno())
                if len(seen) != FAMILY_COUNT + 2 or any(unpacked[package.offset:]):
                    raise ValueError("Unexpected branch archive inventory or trailing content")
        except (tarfile.TarError, EOFError) as error:
            raise ValueError("Invalid branch tar archive") from error
        verify_directory(staging, manifest, source_directory)
        if not _rename_no_replace(staging, destination):
            verify_directory(destination, manifest, source_directory)


def main():
    manifest = read_manifest()
    destination = ROOT / "src/lib/relationshipReview/branch-data"
    _directory_path(destination.parent)
    if os.path.lexists(destination):
        verify_directory(destination, manifest)
    else:
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary).resolve() / "branches.tar.gz"
            previous_umask = os.umask(0o077)
            try:
                subprocess.check_call(["gcloud", "storage", "cp", manifest["gcsUri"], str(archive), "--quiet"])
            finally:
                os.umask(previous_umask)
            stage_archive(archive, manifest, destination)
    print(json.dumps({"relationshipBranchPackageStaged": True, **release_identity(manifest)}))


if __name__ == "__main__":
    main()
