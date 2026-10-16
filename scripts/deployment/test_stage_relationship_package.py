import hashlib
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from stage_relationship_package import stage_archive, verify_directory


class PrivateRelationshipPackageTests(unittest.TestCase):
    def test_new_version_keeps_the_complete_original_package(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary)
            archive,old=self.package(root,presentation=True)
            with tarfile.open(archive,"r:gz") as source:
                files=[(m.name,source.extractfile(m).read()) for m in source.getmembers()]
            new_data=json.dumps({"version":"v2","cases":[{"id":"new"}]}).encode()
            new_lock=json.dumps({"caseCount":1,"datasetSha256":hashlib.sha256(new_data).hexdigest(),"traceHashes":{"new":hashlib.sha256(b'{}').hexdigest()}}).encode()
            files += [("sibling-v2/dataset.json",new_data),("sibling-v2/release-lock.json",new_lock),("sibling-v2/traces/new.json",b'{}')]
            manifest={"version":"v2","directory":"sibling-v2","cases":1,"bundleSha256":hashlib.sha256(new_data).hexdigest(),"releaseLockSha256":hashlib.sha256(new_lock).hexdigest(),"history":[old]}
            with tarfile.open(archive,"w:gz") as out:
                for name,content in files:
                    item=tarfile.TarInfo(name);item.size=len(content);out.addfile(item,io.BytesIO(content))
            manifest["archiveSha256"]=hashlib.sha256(archive.read_bytes()).hexdigest()
            stage_archive(archive,manifest,root/'data')
            self.assertEqual((root/'data/top-level-v1.json').read_bytes(),files[0][1])
            verify_directory(root/'data',manifest)
            (root/'data/traces/case0.json').write_text('{"changed":true}')
            with self.assertRaises(ValueError):verify_directory(root/'data',manifest)

    def package(self, root, extra=None, presentation=False):
        cases = [{"id":"case"+str(i)} for i in range(68)]
        data = json.dumps({"version":"v1","cases":cases}).encode()
        hashes = {c["id"]: hashlib.sha256(b'{}').hexdigest() for c in cases}
        lock = json.dumps({"previewOnly":False,"caseCount":68,"datasetSha256":hashlib.sha256(data).hexdigest(),"traceHashes":hashes}).encode()
        files = [("top-level-v1.json",data),("release-lock.json",lock)] + [("traces/"+c["id"]+".json",b'{}') for c in cases]
        if extra:
            files[-1] = extra
        if presentation:
            files += [("presentation.json",b'{"selectedCaseIds":[]}'),("presentation-trace.json",b'{"audits":[]}')]
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
        manifest={"version":"v1","cases":68,"bundleSha256":hashlib.sha256(data).hexdigest(),"releaseLockSha256":hashlib.sha256(lock).hexdigest(),"archiveSha256":hashlib.sha256(archive.read_bytes()).hexdigest()}
        if presentation:
            manifest.update({"presentationSha256":hashlib.sha256(files[-2][1]).hexdigest(),"presentationTraceSha256":hashlib.sha256(files[-1][1]).hexdigest()})
        return archive,manifest

    def test_additive_presentation_is_pinned_without_changing_original_data(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary)
            archive,manifest=self.package(root,presentation=True)
            stage_archive(archive,manifest,root/'data')
            verify_directory(root/'data',manifest)
            (root/'data/presentation.json').write_text('{"changed":true}')
            with self.assertRaises(ValueError):verify_directory(root/'data',manifest)

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
