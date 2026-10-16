import hashlib
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from stage_relationship_package import stage_archive, verify_directory


class PrivateRelationshipPackageTests(unittest.TestCase):
    def package(self, root, extra=None):
        cases = [{"id":"case"+str(i)} for i in range(68)]
        data = json.dumps({"version":"v1","cases":cases}).encode()
        hashes = {c["id"]: hashlib.sha256(b'{}').hexdigest() for c in cases}
        lock = json.dumps({"previewOnly":False,"caseCount":68,"datasetSha256":hashlib.sha256(data).hexdigest(),"traceHashes":hashes}).encode()
        files = [("top-level-v1.json",data),("release-lock.json",lock)] + [("traces/"+c["id"]+".json",b'{}') for c in cases]
        if extra:
            files[-1] = extra
        archive = root / "test.tar.gz"
        with tarfile.open(archive,"w:gz") as out:
            for name, content in files:
                item = tarfile.TarInfo(name)
                if content is None:
                    item.type = tarfile.SYMTYPE
                    item.linkname = "/tmp/unsafe-target"
                    out.addfile(item)
                else:
                    item.size = len(content)
                    out.addfile(item,io.BytesIO(content))
        return archive,{"version":"v1","bundleSha256":hashlib.sha256(data).hexdigest(),"releaseLockSha256":hashlib.sha256(lock).hexdigest(),"archiveSha256":hashlib.sha256(archive.read_bytes()).hexdigest()}

    def test_exact_package_stages_idempotently(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary)
            archive,manifest=self.package(root)
            stage_archive(archive,manifest,root/'data')
            verify_directory(root/'data',manifest)
            stage_archive(archive,manifest,root/'data')

    def test_rejects_unpinned_unsafe_and_duplicate_content(self):
        for entry in [("../escape.json",b'{}'),("traces/link.json",None),("release-lock.json",b'{}'),("script.py",b'{}')]:
            with self.subTest(entry=entry),tempfile.TemporaryDirectory() as temporary:
                root=Path(temporary)
                archive,manifest=self.package(root,entry)
                with self.assertRaises(ValueError):stage_archive(archive,manifest,root/'data')
                self.assertFalse((root/'data').exists())
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary)
            archive,manifest=self.package(root)
            manifest['archiveSha256']='0'*64
            with self.assertRaises(ValueError):stage_archive(archive,manifest,root/'data')

    def test_never_overwrites_existing_mismatched_evidence(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary)
            archive,manifest=self.package(root)
            stage_archive(archive,manifest,root/'data')
            evidence=root/'data/traces/case0.json'
            evidence.write_text('{"preserve":"me"}')
            with self.assertRaises(ValueError):stage_archive(archive,manifest,root/'data')
            self.assertEqual(evidence.read_text(),'{"preserve":"me"}')

    def test_rejects_a_trace_and_matching_local_lock_tampered_together(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary)
            archive,manifest=self.package(root)
            stage_archive(archive,manifest,root/'data')
            evidence=root/'data/traces/case0.json'
            evidence.write_text('{"changed":"trace"}')
            lock_path=root/'data/release-lock.json'
            lock=json.loads(lock_path.read_text())
            lock['traceHashes']['case0']=hashlib.sha256(evidence.read_bytes()).hexdigest()
            lock_path.write_text(json.dumps(lock))
            with self.assertRaises(ValueError):verify_directory(root/'data',manifest)


if __name__=='__main__':unittest.main()
