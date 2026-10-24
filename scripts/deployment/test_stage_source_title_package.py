import hashlib,json,unittest
from pathlib import Path
from stage_source_title_package import validate
class SourcePackageTests(unittest.TestCase):
    def test_exact_package_and_tamper_rejection(self):
        root=Path(__file__).resolve().parents[2]
        raw=(root/'src/lib/titleValidation/data/source-pages-v2.json').read_bytes()
        manifest=json.loads(Path(__file__).with_name('source-title-review-package.json').read_bytes())
        validate(raw,manifest)
        with self.assertRaises(ValueError):validate(raw+b' ',manifest)
        changed={**manifest,'activities':manifest['activities']-1}
        with self.assertRaises(ValueError):validate(raw,changed)
        data=json.loads(raw);data['pages'][0]['activities'].pop();broken=json.dumps(data).encode()
        changed={**manifest,'bundleSha256':hashlib.sha256(broken).hexdigest()}
        with self.assertRaises(ValueError):validate(broken,changed)
