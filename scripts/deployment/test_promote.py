import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import io
import urllib.error
from promote import (MANIFESTS, SERVICE, TITLE_PROMPT_STUDY, LATEST_TITLE_PROMPT_STUDY, TITLE_MODEL_COMPARISON,
                     TITLE_MODEL_COMPARISON_JUDGE_RESULTS, title_model_comparison_release, validate_release,
                     promote_if_current, verify_title_review_route, verify_relationship_review_route, read_release)

ROOT = Path(__file__).resolve().parents[2]


class CandidateReadinessTests(unittest.TestCase):
    def test_tag_propagation_retries_the_same_read_without_changing_validation(self):
        errors=[urllib.error.HTTPError('https://candidate/api/deployment',status,'not ready',None,None) for status in [404,503]]
        with patch('promote.urllib.request.urlopen',side_effect=[*errors,io.BytesIO(b'{"commit":"expected"}')]) as get,patch('promote.time.sleep') as sleep:
            self.assertEqual(read_release('https://candidate'),{'commit':'expected'})
            self.assertEqual(get.call_count,3)
            self.assertTrue(all(c.args[0]=='https://candidate/api/deployment' for c in get.call_args_list))
            self.assertEqual([c.args[0] for c in sleep.call_args_list],[1,2])

    def test_permanent_or_security_errors_are_not_retried(self):
        for status in [400,401,403,429,500]:
            with self.subTest(status=status),patch('promote.urllib.request.urlopen',side_effect=urllib.error.HTTPError('url',status,'stop',None,None)) as get,patch('promote.time.sleep') as sleep:
                with self.assertRaises(urllib.error.HTTPError):read_release('https://candidate')
                self.assertEqual(get.call_count,1);sleep.assert_not_called()

    def test_readiness_retries_are_bounded(self):
        with patch('promote.urllib.request.urlopen',side_effect=urllib.error.HTTPError('url',404,'not ready',None,None)) as get,patch('promote.time.sleep') as sleep:
            with self.assertRaises(urllib.error.HTTPError):read_release('https://candidate')
            self.assertEqual(get.call_count,6);self.assertEqual(sleep.call_count,5)

    def test_transport_errors_retry_but_invalid_json_does_not(self):
        with patch('promote.urllib.request.urlopen',side_effect=[urllib.error.URLError('temporary'),io.BytesIO(b'{"ok":true}')]),patch('promote.time.sleep'):
            self.assertEqual(read_release('https://candidate'),{'ok':True})
        with patch('promote.urllib.request.urlopen',return_value=io.BytesIO(b'not JSON')) as get,patch('promote.time.sleep') as sleep:
            with self.assertRaises(json.JSONDecodeError):read_release('https://candidate')
            self.assertEqual(get.call_count,1);sleep.assert_not_called()


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
        staff_bytes = (ROOT / "src/lib/titleValidation/data/prepilot-v1.json").read_bytes()
        staff = json.loads(staff_bytes)
        self.info["humanTitleReview"] = {"version":staff["version"],"cases":len(staff["cases"]),
            "model":staff["provenance"]["model"],"promptSha256":staff["provenance"]["scientificPromptSha256"],
            "bundleSha256":hashlib.sha256(staff_bytes).hexdigest(),"released":True}
        relationship_manifest=json.loads((ROOT / "scripts/deployment/relationship-review-package.json").read_bytes())
        relationship_root=ROOT / "src/lib/relationshipReview/data" / relationship_manifest.get("directory", "")
        relation_bytes = (relationship_root / ("dataset.json" if relationship_manifest.get("directory") else "top-level-v1.json")).read_bytes()
        relation = json.loads(relation_bytes)
        self.info["relationshipReview"] = {"version":relation["version"],"cases":len(relation["cases"]),
            "model":relation["model"],"reasoning":relation["reasoning"],
            "bundleSha256":hashlib.sha256(relation_bytes).hexdigest(),"sourceSha256":relation["sourceSha256"]}
        presentation_path=relationship_root / "presentation.json"
        if presentation_path.exists():
            presentation_bytes=presentation_path.read_bytes()
            presentation=json.loads(presentation_bytes)
            self.info["relationshipReview"].update({"presentationVersion":presentation["version"],"selectedProposals":len(presentation["selectedCaseIds"]),"presentationSha256":hashlib.sha256(presentation_bytes).hexdigest()})

    def test_accepts_exact_release(self):
        validate_release(self.info, "a" * 40, "build-1", "revision-1")

    def test_rejects_stale_or_mispackaged_release(self):
        for field in ("commit", "buildId", "revision", "packageSha256", "titlePromptStudy", "latestTitlePromptStudy",
                      "titleModelComparison", "humanTitleReview", "relationshipReview"):
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

    def test_rejects_unreleased_or_changed_staff_pilot(self):
        for field in self.info["humanTitleReview"]:
            with self.subTest(field=field):
                broken = copy.deepcopy(self.info)
                broken["humanTitleReview"][field] = False if field == "released" else "changed"
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


class TitleReviewRouteTests(unittest.TestCase):
    def setUp(self):
        self.redirect_patch = patch("promote.urllib.request.build_opener")
        self.no_redirect = self.redirect_patch.start().return_value
        self.addCleanup(self.redirect_patch.stop)
        self.no_redirect.open.side_effect = urllib.error.HTTPError(
            "https://example.org/review/title-validation?workspace=practice", 307,
            "Temporary redirect", {"Location": "/review/title-validation"}, None)

    def opener(self, bad_practice=None, accept_practice=False):
        def open_url(request, timeout):
            if isinstance(request, str):
                practice = "?workspace=practice" in request
                html = 'Human title review {"preview":false,"practice":false}'
                if practice and bad_practice is not None:
                    html = bad_practice
                return io.BytesIO(html.encode())
            if accept_practice and b'"workspace":"practice"' in request.data:
                return io.BytesIO(b'{}')
            raise urllib.error.HTTPError(request.full_url, 401, "Sign in", {}, None)
        return open_url

    def test_checks_both_workspaces_and_denies_anonymous(self):
        with patch("promote.urllib.request.urlopen", side_effect=self.opener()) as open_url:
            verify_title_review_route("https://example.org")
            self.assertEqual(open_url.call_count, 5)

    def test_rejects_missing_mismatched_or_development_practice_page(self):
        for html in ("missing", 'Human title review {"preview":true,"practice":true}',
                     'Human title review {"preview":false,"practice":true}'):
            with self.subTest(html=html), patch("promote.urllib.request.urlopen", side_effect=self.opener(bad_practice=html)):
                with self.assertRaises(ValueError):
                    verify_title_review_route("https://example.org")

    def test_rejects_anonymous_practice_access(self):
        with patch("promote.urllib.request.urlopen", side_effect=self.opener(accept_practice=True)):
            with self.assertRaises(ValueError):
                verify_title_review_route("https://example.org")

    def test_requires_actual_redirect_rather_than_direct_team_html(self):
        self.no_redirect.open.side_effect = None
        self.no_redirect.open.return_value = io.BytesIO(b'Human title review {"preview":false,"practice":false}')
        with self.assertRaises(ValueError):
            verify_title_review_route("https://example.org")

    def test_rejects_wrong_redirect_status_or_destination(self):
        for code, location in [(302, "/review/title-validation"), (307, "/other"), (307, "https://elsewhere.org/review/title-validation")]:
            self.no_redirect.open.side_effect = urllib.error.HTTPError(
                "https://example.org/review/title-validation?workspace=practice", code,
                "Redirect", {"Location": location}, None)
            with self.subTest(code=code, location=location), self.assertRaises(ValueError):
                verify_title_review_route("https://example.org")


class RelationshipReviewRouteTests(unittest.TestCase):
    def opener(self, preview=False, accepted=None):
        def open_url(request, timeout):
            if isinstance(request, str):
                return io.BytesIO(('Activity relationship review {"preview":' + ('true' if preview else 'false') + '}').encode())
            if request.full_url.endswith('/' + str(accepted)):
                return io.BytesIO(b'{}')
            raise urllib.error.HTTPError(request.full_url,401,"Sign in",{},None)
        return open_url

    def test_page_and_all_anonymous_boundaries(self):
        with patch("promote.urllib.request.urlopen",side_effect=self.opener()) as call:
            verify_relationship_review_route("https://example.org")
            self.assertEqual(call.call_count,5)
            for request in call.call_args_list[1:]:
                self.assertEqual(request.args[0].get_header("Origin"), "https://ontology.mit.edu")

    def test_no_preview_or_anonymous_data_in_production(self):
        for accepted in ('session','save','trace','tom-feedback'):
            with self.subTest(action=accepted), patch("promote.urllib.request.urlopen",side_effect=self.opener(accepted=accepted)):
                with self.assertRaises(ValueError): verify_relationship_review_route("https://example.org")
        with patch("promote.urllib.request.urlopen",side_effect=self.opener(preview=True)):
            with self.assertRaises(ValueError): verify_relationship_review_route("https://example.org")


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
