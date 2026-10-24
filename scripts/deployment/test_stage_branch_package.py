import hashlib
import io
import json
import os
from pathlib import Path
import stat
import tarfile
import tempfile
import unittest
from unittest import mock

import stage_branch_package as stage


def encode(value):
    return json.dumps(value, sort_keys=True).encode("utf-8")


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


class PrivateBranchPackageTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.source = self.root / "src/lib/relationshipReview/data"
        self.source.mkdir(mode=0o700, parents=True)
        (self.source / "atomic-v1").mkdir(mode=0o700)
        self.graph = self.source / "atomic-v1/source-graph.json"
        self.graph_raw = b'{"synthetic":true}'
        self.graph.write_bytes(self.graph_raw)
        self.graph.chmod(0o600)
        self.destination = self.source.parent / "branch-data"
        for name, value in (("ROOT", self.root), ("SOURCE_SHA256", digest(self.graph_raw)),
                            ("MANIFEST", self.root / "branch-review-package.json")):
            patcher = mock.patch.object(stage, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def write_archive(self, files, manifest):
        archive = self.root / "synthetic.tar.gz"
        with tarfile.open(archive, "w:gz") as package:
            for name, content in files:
                if isinstance(content, tarfile.TarInfo):
                    package.addfile(content)
                else:
                    info = tarfile.TarInfo(name)
                    info.size = len(content)
                    info.mode = 0o777  # Archive modes/ownership must never be adopted.
                    info.uid = os.geteuid() + 1000
                    package.addfile(info, io.BytesIO(content))
        archive.chmod(0o600)
        manifest["archiveSha256"] = digest(archive.read_bytes())
        manifest["gcsUri"] = stage.GCS_PREFIX + manifest["archiveSha256"] + ".tar.gz"
        return archive

    def package(self, dataset_change=None, lock_change=None, trace_change=None):
        # Synthetic integrity envelopes only; no private graph, proposals or provider bodies.
        families = [{"id": "family" + str(i), "sourceCaseIds": ["prior" + str(i)],
                     "groups": [{"id": "group%d_%d" % (i, j)}
                                for j in range(5 if i < 10 else 4)]}
                    for i in range(stage.FAMILY_COUNT)]
        dataset = {"schemaVersion": stage.DATASET_SCHEMA, "version": stage.VERSION,
                   "sourceApp": "synthetic", "sourceCapturedAt": "2026-10-23T00:00:00Z",
                   "sourceRecheckedAt": "2026-10-24T00:00:00Z",
                   "sourceSha256": stage.SOURCE_SHA256, "priorDatasetVersion": "synthetic-prior",
                   "priorDatasetSha256": digest(b"synthetic prior"), "families": families}
        if dataset_change:
            dataset_change(dataset)
        traces = {}
        for family in dataset["families"]:
            source = {key: dataset[key] for key in stage.SOURCE_FIELDS}
            source["sourceCaseIds"] = family["sourceCaseIds"]
            run = {"status": "completed", "request": {}, "result": {}, "aliasMap": {}, "coverage": []}
            trace = {"schemaVersion": stage.TRACE_SCHEMA, "familyId": family["id"],
                     "datasetVersion": stage.VERSION, "fundingRoute": "ACCESS", "source": source,
                     "promptProvenance": {}, "author": run, "critics": [run, run]}
            if trace_change:
                trace_change(trace)
            traces[family["id"]] = encode(trace)
        data_raw = encode(dataset)
        lock = {"datasetSha256": digest(data_raw), "familyCount": len(dataset["families"]),
                "groupCount": sum(len(f["groups"]) for f in dataset["families"]),
                "sourceSha256": stage.SOURCE_SHA256,
                "traceHashes": {key: digest(raw) for key, raw in traces.items()}}
        if lock_change:
            lock_change(lock)
        lock_raw = encode(lock)
        manifest = {"schemaVersion": stage.PACKAGE_SCHEMA, "version": stage.VERSION,
                    "directory": stage.DIRECTORY, "families": stage.FAMILY_COUNT,
                    "groups": stage.GROUP_COUNT, "bundleSha256": digest(data_raw),
                    "releaseLockSha256": digest(lock_raw), "sourceSha256": stage.SOURCE_SHA256,
                    "sourceGraph": {"directory": "atomic-v1", "sha256": stage.SOURCE_SHA256}}
        files = [("branches-v1/dataset.json", data_raw), ("branches-v1/release-lock.json", lock_raw)]
        files += [("branches-v1/traces/" + key + ".json", raw) for key, raw in traces.items()]
        return self.write_archive(files, manifest), manifest, files

    def test_success_is_private_and_public_identity_only(self):
        archive, manifest, files = self.package()
        stage.stage_archive(archive, manifest, self.destination)
        self.assertEqual(stage.verify_directory(self.destination, manifest), stage.release_identity(manifest))
        self.assertEqual(set(stage.release_identity(manifest)),
                         {"version", "families", "groups", "bundleSha256", "sourceSha256"})
        self.assertEqual(stage.private_tree_inventory(self.destination)[0], {name for name, _ in files})
        for path in [self.destination, *self.destination.rglob("*")]:
            info = path.lstat()
            self.assertEqual(info.st_uid, os.geteuid())
            self.assertEqual(stat.S_IMODE(info.st_mode), 0o700 if path.is_dir() else 0o600)
            if path.is_file():
                self.assertEqual(info.st_nlink, 1)
        self.assertEqual(self.graph.read_bytes(), self.graph_raw)

    def test_manifest_pins_counts_source_and_exact_read_only_object(self):
        _, manifest, _ = self.package()
        changes = [{"schemaVersion": "wrong"}, {"version": "wrong"}, {"directory": "../branches-v1"},
                   {"families": 17}, {"families": True}, {"groups": 81}, {"groups": 82.0},
                   {"bundleSha256": "A" * 64}, {"sourceSha256": "f" * 64},
                   {"sourceGraph": {"directory": "atomic-v2", "sha256": stage.SOURCE_SHA256}},
                   {"sourceGraph": {"directory": "atomic-v1", "sha256": "f" * 64}},
                   {"gcsUri": "gs://another-bucket/object.tar.gz"},
                   {"gcsUri": manifest["gcsUri"] + "?generation=1"},
                   {"gcsUri": stage.GCS_PREFIX + "0" * 64 + ".tar.gz"}, {"history": []}]
        for change in changes:
            with self.subTest(change=change), self.assertRaises(ValueError):
                stage.validate_manifest({**manifest, **change})

    def test_duplicate_json_keys_at_every_package_level_and_in_manifest(self):
        for index in (0, 1, 2):
            archive, manifest, files = self.package()
            name, raw = files[index]
            files[index] = (name, b'{"duplicate":0,"duplicate":1,' + raw[1:])
            self.write_archive(files, manifest)
            with self.subTest(index=index), self.assertRaisesRegex(ValueError, "Duplicate JSON key"):
                stage.stage_archive(archive, manifest, self.destination)
        stage.MANIFEST.write_bytes(b'{"duplicate":0,"duplicate":1}')
        with self.assertRaisesRegex(ValueError, "Duplicate JSON key"):
            stage.read_manifest()
        for raw in (b'{"nested":{"x":0,"x":1}}', b'{"x":NaN}', b'{"x":1e999}'):
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                stage.strict_json(raw)

    def test_archive_paths_and_links_are_rejected(self):
        archive, manifest, original = self.package()
        paths = ["../escape.json", "/escape.json", "branches-v1/traces/../../escape.json",
                 "branches-v1//traces/family17.json", "./branches-v1/traces/family17.json",
                 "other-v1/traces/family17.json", "branches-v1/traces/..\\escape.json"]
        for name in paths:
            files = original[:-1] + [(name, original[-1][1])]
            self.write_archive(files, manifest)
            with self.subTest(name=name), self.assertRaises(ValueError):
                stage.stage_archive(archive, manifest, self.destination)
        for kind in (tarfile.SYMTYPE, tarfile.LNKTYPE, tarfile.DIRTYPE, tarfile.CHRTYPE, tarfile.FIFOTYPE):
            info = tarfile.TarInfo(original[-1][0])
            info.type = kind
            if kind in (tarfile.SYMTYPE, tarfile.LNKTYPE):
                info.linkname = "../../escape.json"
            self.write_archive(original[:-1] + [(info.name, info)], manifest)
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                stage.stage_archive(archive, manifest, self.destination)
        self.assertFalse(self.destination.exists())

    def test_duplicate_members_and_unexpected_inventory(self):
        archive, manifest, files = self.package()
        variants = [files[:-1] + [files[2]],
                    files + [("branches-v1/traces/ghost.json", b'{}')],
                    files[:-1] + [("branches-v1/traces/ghost.json", files[-1][1])],
                    files[:-1] + [("branches-v1/feedback.json", b'{}')],
                    files[:-1] + [("branches-v1/source-graph.json", self.graph_raw)]]
        for members in variants:
            self.write_archive(members, manifest)
            with self.subTest(names=[name for name, _ in members]), self.assertRaises(ValueError):
                stage.stage_archive(archive, manifest, self.destination)

    def test_all_archive_dataset_lock_and_trace_hashes_are_checked(self):
        for index in (0, 1, 2):
            archive, manifest, files = self.package()
            name, raw = files[index]
            files[index] = (name, raw + b" ")
            self.write_archive(files, manifest)  # Repin archive only, not the altered evidence.
            with self.subTest(index=index), self.assertRaises(ValueError):
                stage.stage_archive(archive, manifest, self.destination)
        archive, manifest, _ = self.package()
        archive.write_bytes(archive.read_bytes() + b"changed")
        with self.assertRaisesRegex(ValueError, "archive hash"):
            stage.stage_archive(archive, manifest, self.destination)

    def test_rehashed_version_counts_lock_and_trace_sources_still_fail(self):
        changes = [("dataset", lambda d: d.update(version="wrong")),
                   ("dataset", lambda d: d.update(schemaVersion="wrong")),
                   ("dataset", lambda d: d.update(sourceSha256="f" * 64)),
                   ("dataset", lambda d: d["families"][0]["groups"].pop()),
                   ("dataset", lambda d: d["families"].pop()),
                   ("dataset", lambda d: d["families"][1].update(id="family0")),
                   ("lock", lambda lock: lock.update(familyCount=True)),
                   ("lock", lambda lock: lock.update(groupCount=81)),
                   ("lock", lambda lock: lock.update(datasetSha256="f" * 64)),
                   ("lock", lambda lock: lock.update(sourceSha256="f" * 64)),
                   ("lock", lambda lock: lock["traceHashes"].pop("family0")),
                   ("lock", lambda lock: lock["traceHashes"].update(ghost="f" * 64)),
                   ("trace", lambda t: t.update(schemaVersion="wrong")),
                   ("trace", lambda t: t.update(familyId="wrong")),
                   ("trace", lambda t: t.update(datasetVersion="wrong")),
                   ("trace", lambda t: t.update(fundingRoute="wrong")),
                   ("trace", lambda t: t["source"].update(sourceCapturedAt="different")),
                   ("trace", lambda t: t["source"].update(sourceCaseIds=[]))]
        for kind, change in changes:
            archive, manifest, _ = self.package(**{kind + "_change": change})
            with self.subTest(kind=kind, change=change), self.assertRaises(ValueError):
                stage.stage_archive(archive, manifest, self.destination)

    def test_compressed_expanded_per_file_and_total_bounds(self):
        archive, manifest, files = self.package()
        limits = [("MAX_ARCHIVE_BYTES", archive.stat().st_size - 1), ("MAX_TAR_BYTES", 512),
                  ("MAX_FILE_BYTES", max(len(raw) for _, raw in files) - 1),
                  ("MAX_TOTAL_BYTES", sum(len(raw) for _, raw in files) - 1)]
        for name, limit in limits:
            with self.subTest(name=name), mock.patch.object(stage, name, limit), self.assertRaises(ValueError):
                stage.stage_archive(archive, manifest, self.destination)
        archive.chmod(0o644)
        with self.assertRaises(ValueError):
            stage.stage_archive(archive, manifest, self.destination)

    def test_existing_package_is_verified_and_never_overwritten(self):
        archive, manifest, _ = self.package()
        stage.stage_archive(archive, manifest, self.destination)
        data = self.destination / "branches-v1/dataset.json"
        inode, original = data.stat().st_ino, data.read_bytes()
        stage.stage_archive(archive, manifest, self.destination)
        self.assertEqual((data.stat().st_ino, data.read_bytes()), (inode, original))
        data.write_bytes(original + b" ")
        with self.assertRaises(ValueError):
            stage.stage_archive(archive, manifest, self.destination)
        self.assertEqual((data.stat().st_ino, data.read_bytes()), (inode, original + b" "))

    def test_empty_destination_created_during_install_is_not_replaced(self):
        archive, manifest, _ = self.package()
        install = stage._rename_no_replace
        inodes = []
        def race(source, destination):
            destination.mkdir(mode=0o700)
            inodes.append(destination.stat().st_ino)
            return install(source, destination)
        with mock.patch.object(stage, "_rename_no_replace", side_effect=race), self.assertRaises(ValueError):
            stage.stage_archive(archive, manifest, self.destination)
        self.assertEqual(self.destination.stat().st_ino, inodes[0])
        self.assertEqual(list(self.destination.iterdir()), [])

    def test_existing_modes_ownership_links_and_unexpected_objects(self):
        archive, manifest, _ = self.package()
        stage.stage_archive(archive, manifest, self.destination)
        data = self.destination / "branches-v1/dataset.json"
        data.chmod(0o644)
        with self.assertRaises(ValueError):
            stage.verify_directory(self.destination, manifest)
        data.chmod(0o600)
        uid = os.geteuid()
        with mock.patch.object(stage.os, "geteuid", return_value=uid + 1), self.assertRaises(ValueError):
            stage.verify_directory(self.destination, manifest)
        hardlink = self.root / "hardlink"
        os.link(data, hardlink)
        with self.assertRaises(ValueError):
            stage.verify_directory(self.destination, manifest)
        hardlink.unlink()
        raw = data.read_bytes()
        data.unlink()
        data.symlink_to(self.graph)
        with self.assertRaises(ValueError):
            stage.verify_directory(self.destination, manifest)
        data.unlink()
        data.write_bytes(raw)
        data.chmod(0o600)
        extra = data.with_name("extra.json")
        extra.write_bytes(b'{}')
        extra.chmod(0o600)
        with self.assertRaises(ValueError):
            stage.verify_directory(self.destination, manifest)
        extra.unlink()
        extra.mkdir(mode=0o700)
        with self.assertRaises(ValueError):
            stage.verify_directory(self.destination, manifest)
        extra.rmdir()
        self.destination.chmod(0o755)
        with self.assertRaises(ValueError):
            stage.verify_directory(self.destination, manifest)
        self.destination.chmod(0o700)
        alias = self.root / "alias"
        alias.symlink_to(self.root, target_is_directory=True)
        with self.assertRaises(ValueError):
            stage.stage_archive(archive, manifest, alias / "new-package")

    def test_shared_source_hash_privacy_and_links_are_checked_without_rewriting(self):
        archive, manifest, _ = self.package()
        stage.stage_archive(archive, manifest, self.destination)
        self.graph.write_bytes(b'{}')
        with self.assertRaises(ValueError):
            stage.stage_archive(archive, manifest, self.destination)
        self.assertEqual(self.graph.read_bytes(), b'{}')
        self.graph.write_bytes(self.graph_raw)
        self.graph.chmod(0o644)
        with self.assertRaises(ValueError):
            stage.verify_directory(self.destination, manifest)
        self.graph.chmod(0o600)
        hardlink = self.root / "source-hardlink"
        os.link(self.graph, hardlink)
        with self.assertRaises(ValueError):
            stage.verify_directory(self.destination, manifest)
        hardlink.unlink()
        self.source.chmod(0o755)
        with self.assertRaises(ValueError):
            stage.verify_directory(self.destination, manifest)
        self.source.chmod(0o700)

    def test_main_only_downloads_the_pinned_object_and_rechecks_existing(self):
        archive, manifest, _ = self.package()
        stage.MANIFEST.write_bytes(encode(manifest))
        def download(command):
            self.assertEqual(command[:4], ["gcloud", "storage", "cp", manifest["gcsUri"]])
            self.assertEqual(command[5:], ["--quiet"])
            Path(command[4]).write_bytes(archive.read_bytes())
        with mock.patch.object(stage.subprocess, "check_call", side_effect=download) as copy, \
                mock.patch("builtins.print") as output:
            stage.main()
            stage.main()
            self.assertEqual(copy.call_count, 1)
            expected = {"relationshipBranchPackageStaged": True, **stage.release_identity(manifest)}
            self.assertEqual([json.loads(call.args[0]) for call in output.call_args_list], [expected, expected])
            (self.destination / "branches-v1/dataset.json").write_bytes(b'{}')
            with self.assertRaises(ValueError):
                stage.main()
            self.assertEqual(copy.call_count, 1)

    def test_missing_manifest_fails_before_any_download(self):
        with mock.patch.object(stage.subprocess, "check_call") as copy, self.assertRaises(ValueError):
            stage.main()
        copy.assert_not_called()

    def test_atomic_no_replace_installs_new_directory(self):
        source = self.root / "rename-source"
        destination = self.root / "rename-destination"
        source.mkdir(mode=0o700)
        (source / "payload").write_bytes(b"staged")
        inode = source.stat().st_ino
        self.assertIs(stage._rename_no_replace(source, destination), True)
        self.assertFalse(source.exists())
        self.assertEqual(destination.stat().st_ino, inode)
        self.assertEqual((destination / "payload").read_bytes(), b"staged")

    def test_atomic_no_replace_preserves_existing_directories(self):
        for nonempty in (False, True):
            with self.subTest(nonempty=nonempty):
                source = self.root / f"rename-source-{nonempty}"
                destination = self.root / f"rename-destination-{nonempty}"
                source.mkdir(mode=0o700)
                destination.mkdir(mode=0o700)
                (source / "payload").write_bytes(b"new")
                if nonempty:
                    (destination / "payload").write_bytes(b"existing")
                source_inode = source.stat().st_ino
                destination_inode = destination.stat().st_ino
                self.assertIs(stage._rename_no_replace(source, destination), False)
                self.assertEqual(source.stat().st_ino, source_inode)
                self.assertEqual((source / "payload").read_bytes(), b"new")
                self.assertEqual(destination.stat().st_ino, destination_inode)
                self.assertEqual(sorted(path.name for path in destination.iterdir()),
                                 ["payload"] if nonempty else [])
                if nonempty:
                    self.assertEqual((destination / "payload").read_bytes(), b"existing")

    def test_atomic_no_replace_fails_closed_without_capability(self):
        source = self.root / "rename-source"
        destination = self.root / "rename-destination"
        source.mkdir(mode=0o700)
        (source / "payload").write_bytes(b"staged")
        inode = source.stat().st_ino
        for platform in ("linux", "darwin", "unsupported"):
            with self.subTest(platform=platform):
                with mock.patch.object(stage.sys, "platform", platform), \
                        mock.patch.object(stage.ctypes, "CDLL", return_value=object()) as load, \
                        self.assertRaisesRegex(ValueError, "Atomic no-overwrite staging is unavailable"):
                    stage._rename_no_replace(source, destination)
                if platform == "unsupported":
                    load.assert_not_called()
                else:
                    load.assert_called_once_with(None, use_errno=True)
                self.assertEqual(source.stat().st_ino, inode)
                self.assertEqual((source / "payload").read_bytes(), b"staged")
                self.assertFalse(destination.exists())
        for platform, symbol in (("linux", "renameat2"), ("darwin", "renameatx_np")):
            with self.subTest(platform=platform, error=stage.errno.ENOSYS):
                rename = mock.Mock(return_value=-1)
                libc = mock.Mock(spec=[symbol])
                setattr(libc, symbol, rename)
                with mock.patch.object(stage.sys, "platform", platform), \
                        mock.patch.object(stage.ctypes, "CDLL", return_value=libc), \
                        mock.patch.object(stage.ctypes, "get_errno", return_value=stage.errno.ENOSYS), \
                        self.assertRaises(OSError) as failure:
                    stage._rename_no_replace(source, destination)
                rename.assert_called_once()
                self.assertEqual(failure.exception.errno, stage.errno.ENOSYS)
                self.assertEqual(source.stat().st_ino, inode)
                self.assertEqual((source / "payload").read_bytes(), b"staged")
                self.assertFalse(destination.exists())


if __name__ == "__main__":
    unittest.main()
