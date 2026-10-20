"""Focused contract tests for the standalone deployment selection attestation."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]


class QuickSelectionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Deployment helpers are standalone scripts, not an importable package.
        sources = [
            p for p in (ROOT / "scripts").rglob("*.py")
            if not p.name.startswith("test_")
            and "def selection_release(raw):" in p.read_text()
        ]
        if len(sources) != 1:
            raise AssertionError("Expected exactly one deployment selection attestor")
        spec = importlib.util.spec_from_file_location("selection_attestor", sources[0])
        cls.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.module)
        cls.raw = (ROOT / "src/lib/titleValidation/data/quick-v1.json").read_bytes()
        cls.manifest = json.loads(
            (ROOT / "src/lib/titleValidation/data/quick-selection-v1.json").read_bytes()
        )

    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.path = Path(temporary.name) / "selection.json"
        self.write(self.manifest)
        patch = mock.patch.object(self.module, "SELECTION", self.path)
        patch.start()
        self.addCleanup(patch.stop)

    def write(self, manifest):
        self.path.write_text(json.dumps(manifest))

    def test_committed_selection_attests_new_mix_without_relabelling_evidence(self):
        before = json.loads(self.raw)
        release = self.module.selection_release(self.raw)
        self.assertEqual(release["initialOutcomes"], {"Keep": 5, "Clarify": 15, "Split": 5})
        self.assertEqual(release["reservedOutcomes"], {"Keep": 1, "Clarify": 74, "Split": 0})
        self.assertEqual(release["selectionCoverage"], {
            "initial": 25, "reserve": 75, "regular": 100, "flagged": 319, "cases": 419,
        })
        self.assertEqual(json.loads(self.raw), before)
        self.assertEqual((ROOT / "src/lib/titleValidation/data/quick-v1.json").read_bytes(), self.raw)
        reordered = dict(self.manifest, initialCaseIds=list(reversed(self.manifest["initialCaseIds"])))
        self.write(reordered)
        other = self.module.selection_release(self.raw)
        self.assertEqual(other["initialOutcomes"], release["initialOutcomes"])
        self.assertNotEqual(other["selectionSha256"], release["selectionSha256"])

    def test_wrong_metadata_or_changed_private_bytes_cannot_be_attested(self):
        for field, value in [
            ("version", "other"), ("datasetVersion", "other"),
            ("bundleSha256", "0" * 64), ("protectedCaseIds", []),
        ]:
            with self.subTest(field=field):
                self.write(dict(self.manifest, **{field: value}))
                with self.assertRaisesRegex(ValueError, "evidence binding"):
                    self.module.selection_release(self.raw)
        self.write(self.manifest)
        with self.assertRaisesRegex(ValueError, "evidence binding"):
            self.module.selection_release(self.raw + b"\n")

    def test_twenty_five_ids_are_not_sufficient_without_uniqueness_pool_and_mix(self):
        cases = json.loads(self.raw)["cases"]
        ids = list(self.manifest["initialCaseIds"])
        keep = next(c["id"] for c in cases if c["id"] in ids and c["outcome"] == "Keep")
        reserve = next(c["id"] for c in cases if c["id"] not in ids and c["batch"] != "flagged" and c["outcome"] == "Clarify")
        flagged = next(c["id"] for c in cases if c["batch"] == "flagged")
        for replacement in [next(i for i in ids if i != keep), flagged, reserve]:
            with self.subTest(replacement=replacement):
                changed = [replacement if i == keep else i for i in ids]
                self.assertEqual(len(changed), 25)
                self.write(dict(self.manifest, initialCaseIds=changed))
                with self.assertRaisesRegex(ValueError, "coverage"):
                    self.module.selection_release(self.raw)


if __name__ == "__main__":
    unittest.main()
