import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("stage_relationship_package", Path(__file__).with_name("stage_relationship_package.py"))
stage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stage)


class PrivateStagingTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        self.tree = self.base / "data"
        self.tree.mkdir(mode=0o700)
        (self.tree / "traces").mkdir(mode=0o700)
        data = json.dumps({"version": "synthetic", "cases": [{"id": "a"}]}).encode()
        trace = b"{}"
        digest = lambda b: hashlib.sha256(b).hexdigest()
        lock = json.dumps({"datasetSha256": digest(data), "caseCount": 1,
                           "traceHashes": {"a": digest(trace)}}).encode()
        self.contents = {"top-level-v1.json": data, "release-lock.json": lock, "traces/a.json": trace}
        self.manifest = {"version": "synthetic", "cases": 1, "bundleSha256": digest(data),
                         "releaseLockSha256": digest(lock)}
        for name, content in self.contents.items():
            target = self.tree / name
            target.write_bytes(content)
            target.chmod(0o600)

    def archive(self):
        archive = self.base / "synthetic.tar.gz"
        with tarfile.open(archive, "w:gz") as package:
            for name, content in self.contents.items():
                member = tarfile.TarInfo(name)
                member.size = len(content)
                member.mode = 0o777  # Archive permissions must not be applied.
                package.addfile(member, io.BytesIO(content))
        self.manifest["archiveSha256"] = hashlib.sha256(archive.read_bytes()).hexdigest()
        return archive

    def test_private_existing_tree_and_readonly_evidence(self):
        stage.verify_directory(self.tree, self.manifest)
        (self.tree / "top-level-v1.json").chmod(0o400)
        stage.verify_directory(self.tree, self.manifest)

    def test_readable_historical_files_fail_without_chmod(self):
        target = self.tree / "top-level-v1.json"
        target.chmod(0o644)
        with self.assertRaises(ValueError):
            stage.stage_archive(self.archive(), self.manifest, self.tree)
        self.assertEqual(stat.S_IMODE(target.lstat().st_mode), 0o644)

    def test_root_and_nested_directory_permissions(self):
        for directory in [self.tree, self.tree / "traces"]:
            with self.subTest(directory=directory):
                directory.chmod(0o755)
                with self.assertRaises(ValueError):
                    stage.verify_directory(self.tree, self.manifest)
                directory.chmod(0o700)

    def test_symlink_hardlink_and_nonregular_objects(self):
        target = self.tree / "traces/a.json"
        outside = self.base / "outside.json"
        target.rename(outside)
        target.symlink_to(outside)
        with self.assertRaises(ValueError):
            stage.verify_directory(self.tree, self.manifest)
        target.unlink()
        os.link(outside, target)
        with self.assertRaises(ValueError):
            stage.verify_directory(self.tree, self.manifest)
        target.unlink()
        os.mkfifo(target, 0o600)
        with self.assertRaises(ValueError):
            stage.verify_directory(self.tree, self.manifest)

    def test_wrong_owner(self):
        with patch.object(stage.os, "geteuid", return_value=os.geteuid() + 1):
            with self.assertRaises(ValueError):
                stage.verify_directory(self.tree, self.manifest)

    def test_new_extraction_is_private_from_creation(self):
        destination = self.base / "extracted"
        stage.stage_archive(self.archive(), self.manifest, destination)
        stage.verify_directory(destination, self.manifest)
        for target in [destination, *destination.rglob("*")]:
            info = target.lstat()
            self.assertEqual(stat.S_IMODE(info.st_mode), 0o700 if stat.S_ISDIR(info.st_mode) else 0o600)
            if stat.S_ISREG(info.st_mode):
                self.assertEqual(info.st_nlink, 1)


if __name__ == "__main__":
    unittest.main()
