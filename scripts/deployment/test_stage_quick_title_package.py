import hashlib
import json
from pathlib import Path
import unittest
from stage_quick_title_package import validate


class PrivateTitlePackageTests(unittest.TestCase):
    def setUp(self):
        self.raw = (Path(__file__).resolve().parents[2] / "src/lib/titleValidation/data/quick-v1.json").read_bytes()
        self.manifest = json.loads(Path(__file__).with_name("quick-title-review-package.json").read_bytes())

    def test_exact_private_package_is_accepted(self):
        validate(self.raw, self.manifest)

    def test_modified_source_proposal_is_rejected(self):
        with self.assertRaises(ValueError):
            validate(self.raw + b" ", self.manifest)

    def test_wrong_batch_counts_fail_even_with_matching_file_hash(self):
        changed = json.loads(self.raw)
        changed["cases"][0]["batch"] = "flagged"
        raw = json.dumps(changed).encode()
        with self.assertRaises(ValueError):
            validate(raw, {**self.manifest, "bundleSha256": hashlib.sha256(raw).hexdigest()})
