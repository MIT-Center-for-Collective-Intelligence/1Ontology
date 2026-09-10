import copy
import hashlib
from pathlib import Path
import unittest
from promote import MANIFESTS, SERVICE, validate_release, promote_if_current


class ReleaseVerificationTests(unittest.TestCase):
    def setUp(self):
        self.info = {"commit": "a" * 40, "buildId": "build-1", "revision": "revision-1",
                     "packageSha256": hashlib.sha256(Path(__file__).with_name("review-package-lock.json").read_bytes()).hexdigest(),
                     "datasets": [{"id": key, "version": value[0], "cards": value[1],
                                   "current": value[2], "manifestSha256": value[3]}
                                  for key, value in MANIFESTS.items()]}

    def test_accepts_exact_release(self):
        validate_release(self.info, "a" * 40, "build-1", "revision-1")

    def test_rejects_stale_or_mispackaged_release(self):
        for field in ("commit", "buildId", "revision", "packageSha256"):
            with self.subTest(field=field):
                broken = copy.deepcopy(self.info)
                broken[field] = "stale"
                with self.assertRaises(ValueError):
                    validate_release(broken, "a" * 40, "build-1", "revision-1")
        for field in ("version", "cards", "current", "manifestSha256"):
            with self.subTest(field=field):
                broken = copy.deepcopy(self.info)
                broken["datasets"][0][field] = "changed"
                with self.assertRaises(ValueError):
                    validate_release(broken, "a" * 40, "build-1", "revision-1")


class ConcurrentPromotionTests(unittest.TestCase):
    def setUp(self):
        self.state = {"etag": "v1", "traffic": [
            {"type": "TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION", "revision": "old", "percent": 100},
            {"type": "TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION", "revision": "candidate-a", "tag": "git-candidate"},
            {"type": "TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION", "revision": "old", "tag": "rollback"}]}
        self.writes = 0

    def api(self, resource, method="GET", body=None):
        if method == "GET":
            return copy.deepcopy(self.state)
        self.assertEqual(resource, SERVICE + "?updateMask=traffic")
        if body["etag"] != self.state["etag"]:
            raise ValueError("Concurrent update rejected by Cloud Run")
        self.writes += 1
        self.state = copy.deepcopy(body)
        return {"done": True}

    def test_promotes_exact_revision_and_preserves_tags(self):
        promote_if_current("commit-a", "candidate-a", self.api, lambda: "commit-a")
        self.assertEqual(self.writes, 1)
        self.assertEqual(sum(t["percent"] for t in self.state["traffic"]), 100)
        self.assertEqual(self.state["traffic"][0]["revision"], "candidate-a")
        self.assertIn("rollback", [t.get("tag") for t in self.state["traffic"]])

    def test_older_build_cannot_overwrite_newer_promotion(self):
        def advancing_head():
            # A observed main=A, but B promotes before A's conditional write.
            self.state["etag"] = "v2-after-b"
            self.state["traffic"][0]["revision"] = "candidate-b"
            return "commit-a"
        with self.assertRaises(ValueError):
            promote_if_current("commit-a", "candidate-a", self.api, advancing_head)
        self.assertEqual(self.writes, 0)
        self.assertEqual(self.state["traffic"][0]["revision"], "candidate-b")

    def test_stale_main_or_replaced_candidate_never_writes(self):
        with self.assertRaises(ValueError):
            promote_if_current("commit-a", "candidate-a", self.api, lambda: "commit-b")
        self.state["traffic"][1]["revision"] = "candidate-b"
        with self.assertRaises(ValueError):
            promote_if_current("commit-a", "candidate-a", self.api, lambda: "commit-a")
        self.assertEqual(self.writes, 0)


if __name__ == "__main__":
    unittest.main()
