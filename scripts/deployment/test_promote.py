import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from promote import (MANIFESTS, SERVICE, TITLE_PROMPT_STUDY, LATEST_TITLE_PROMPT_STUDY, TITLE_MODEL_COMPARISON,
                     TITLE_MODEL_COMPARISON_JUDGE_RESULTS, title_model_comparison_release, validate_release,
                     promote_if_current)

ROOT = Path(__file__).resolve().parents[2]


class ReleaseVerificationTests(unittest.TestCase):
    def setUp(self):
        study_bytes = (Path(__file__).resolve().parents[2] / TITLE_PROMPT_STUDY).read_bytes()
        study = json.loads(study_bytes)
        self.info = {"commit": "a" * 40, "buildId": "build-1", "revision": "revision-1",
                     "packageSha256": hashlib.sha256(Path(__file__).with_name("review-package-lock.json").read_bytes()).hexdigest(),
                     "datasets": [{"id": key, "version": value[0], "cards": value[1],
                                   "current": value[2], "manifestSha256": value[3]}
                                  for key, value in MANIFESTS.items()]}
        self.info["titlePromptStudy"] = {"version": study["version"], "cases": 18,
            "promptSha256": study["promptSha256"], "bundleSha256": hashlib.sha256(study_bytes).hexdigest()}
        latest_bytes = (Path(__file__).resolve().parents[2] / LATEST_TITLE_PROMPT_STUDY).read_bytes()
        latest = json.loads(latest_bytes)
        self.info["latestTitlePromptStudy"] = {"version": latest["version"], "cases": 18,
            "promptSha256": latest["promptSha256"], "bundleSha256": hashlib.sha256(latest_bytes).hexdigest()}
        comparison_bytes = (ROOT / TITLE_MODEL_COMPARISON).read_bytes()
        judge_bytes = (ROOT / TITLE_MODEL_COMPARISON_JUDGE_RESULTS).read_bytes()
        comparison = json.loads(comparison_bytes)
        judge = json.loads(judge_bytes)
        self.info["titleModelComparison"] = {
            "version": "rob-very-short-prompt-model-comparison-2026-09-16-v1", "cases": 18, "answers": 72,
            "judgments": 72, "validJudgments": [j["status"] for j in judge["judgments"]].count("valid"),
            "judgePromptVersion": "title-clarification-judge-2026-09-16-v1",
            "judgeLibraryFingerprint": judge["judge"]["libraryFingerprint"],
            "bundleSha256": hashlib.sha256(comparison_bytes).hexdigest(),
            "judgeResultsSha256": hashlib.sha256(judge_bytes).hexdigest()}
        self.assertEqual(comparison["version"], judge["studyVersion"])

    def test_accepts_exact_release(self):
        validate_release(self.info, "a" * 40, "build-1", "revision-1")

    def test_rejects_stale_or_mispackaged_release(self):
        for field in ("commit", "buildId", "revision", "packageSha256", "titlePromptStudy", "latestTitlePromptStudy",
                      "titleModelComparison"):
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
        for field in self.info["titleModelComparison"]:
            with self.subTest(titleModelComparison=field):
                broken = copy.deepcopy(self.info)
                value = broken["titleModelComparison"][field]
                broken["titleModelComparison"][field] = value + 1 if isinstance(value, int) else value + "-changed"
                with self.assertRaises(ValueError):
                    validate_release(broken, "a" * 40, "build-1", "revision-1")
        broken = copy.deepcopy(self.info)
        del broken["titleModelComparison"]
        with self.assertRaises(ValueError):
            validate_release(broken, "a" * 40, "build-1", "revision-1")


class TitleModelComparisonReleaseTests(unittest.TestCase):
    def setUp(self):
        self.comparison = json.loads((ROOT / TITLE_MODEL_COMPARISON).read_bytes())
        self.judge = json.loads((ROOT / TITLE_MODEL_COMPARISON_JUDGE_RESULTS).read_bytes())

    def release(self, comparison, judge):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for relative, data in ((TITLE_MODEL_COMPARISON, comparison), (TITLE_MODEL_COMPARISON_JUDGE_RESULTS, judge)):
                (root / relative).parent.mkdir(parents=True, exist_ok=True)
                (root / relative).write_text(json.dumps(data), encoding="utf-8")
            return title_model_comparison_release(root)

    def test_counts_valid_judgments(self):
        judge = copy.deepcopy(self.judge)
        for judgment in judge["judgments"]:
            judgment["status"] = "missing"
        judge["judgments"][0]["status"] = "valid"
        judge["judgments"][1]["status"] = "invalid"
        judge["judgments"][2]["status"] = "valid"
        self.assertEqual(self.release(self.comparison, judge)["validJudgments"], 2)

    def test_rejects_incomplete_or_mismatched_archives(self):
        def duplicate_answer(c, j):
            c["answers"][1] = dict(c["answers"][0])
        def duplicate_judgment(c, j):
            j["judgments"][1] = dict(j["judgments"][0])
        mutations = {
            "version": lambda c, j: c.update(version="another-comparison-v2"),
            "17 cases": lambda c, j: c["cases"].pop(),
            "3 models": lambda c, j: c["models"].pop(),
            "pending answer": lambda c, j: c["answers"][10].update(status="pending"),
            "duplicate answer": duplicate_answer,
            "changed prompt": lambda c, j: c.update(prompt=c["prompt"] + " Changed."),
            "missing judgment": lambda c, j: j["judgments"].pop(),
            "duplicate judgment": duplicate_judgment,
            "unknown answer": lambda c, j: j["judgments"][3].update(answerId="another-model"),
            "study version": lambda c, j: j.update(studyVersion="another-study"),
        }
        for label, mutate in mutations.items():
            with self.subTest(label):
                comparison, judge = copy.deepcopy(self.comparison), copy.deepcopy(self.judge)
                mutate(comparison, judge)
                with self.assertRaises(ValueError):
                    self.release(comparison, judge)


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
