"""Verify a GitHub-main candidate, then promote that exact revision. No database writes."""
import json
import hashlib
from pathlib import Path
import re
import subprocess
import sys
import time
import urllib.request
import urllib.error
import urllib.parse

PROJECT = "ontology-41607"
REGION = "us-central1"
REPOSITORY = "https://github.com/MIT-Center-for-Collective-Intelligence/1Ontology.git"
SERVICE = "projects/ontology-41607/locations/us-central1/services/ontology"
TITLE_PROMPT_STUDY = "Ontology_Title_Clarity_Testbed_2026-08-28/prompt-study-2026-09-13/bundle.json"
LATEST_TITLE_PROMPT_STUDY = "Ontology_Title_Clarity_Testbed_2026-08-28/prompt-study-2026-09-14/bundle.json"
TITLE_MODEL_COMPARISON = "Ontology_Title_Clarity_Testbed_2026-08-28/model-comparison-2026-09-16/comparison.json"
TITLE_MODEL_COMPARISON_JUDGE_RESULTS = "Ontology_Title_Clarity_Testbed_2026-08-28/model-comparison-2026-09-16/judge-results.json"
TITLE_MODEL_COMPARISON_VERSION = "rob-very-short-prompt-model-comparison-2026-09-16-v1"
TITLE_VALIDATION_PACKAGE = "src/lib/titleValidation/data/prepilot-v1.json"
RELATIONSHIP_REVIEW_PACKAGE = "src/lib/relationshipReview/data/top-level-v1.json"
MANIFESTS = {
    "ontology-title-testbed": ("ontology-title-two-route-testbed-2026-09-02-v6", 18, False,
        "d37949667f4efce3d7a16fec9ec04c95774aea8789cedba4d8a19d3d753f91ea"),
    "ontology-title-testbed-v7": ("ontology-title-random-round-2026-09-09-v7", 50, True,
        "d761c9729e79db44890d804c44df935a1972accb11d1870d8b90f37ba04eeded"),
}


def gcloud(*args):
    return subprocess.check_output(["gcloud", *args, "--project", PROJECT, "--region", REGION], text=True)


def read_bytes(url, open_url=None):
    # New Cloud Run routes can briefly return 404 or time out during a read.
    # Only GET reads use this helper; identity/hash checks and the conditional
    # traffic update are never relaxed or retried here.
    if not isinstance(url, str):
        raise ValueError("Read-only readiness checks require a URL string")
    opener = open_url or urllib.request.urlopen
    for attempt in range(6):
        try:
            with opener(url, timeout=60) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            if error.code not in (404, 502, 503, 504) or attempt == 5:
                raise
        except (urllib.error.URLError, TimeoutError):
            if attempt == 5:
                raise
        time.sleep(min(15, 2 ** attempt))


def read_release(origin):
    return json.loads(read_bytes(origin + "/api/deployment"))


def title_model_comparison_release(root):
    """Mirror src/lib/somReview/titleModelComparisonRelease.ts on the committed files."""
    bundle_bytes = (root / TITLE_MODEL_COMPARISON).read_bytes()
    judge_bytes = (root / TITLE_MODEL_COMPARISON_JUDGE_RESULTS).read_bytes()
    study = json.loads(bundle_bytes)
    results = json.loads(judge_bytes)
    mismatch = ValueError("Title model comparison is incomplete or mismatched")
    if not isinstance(study, dict) or not isinstance(results, dict):
        raise mismatch
    cases, models, answers = study.get("cases"), study.get("models"), study.get("answers")
    judge, judgments = results.get("judge"), results.get("judgments")
    if (study.get("version") != TITLE_MODEL_COMPARISON_VERSION
            or not all(isinstance(v, list) for v in (cases, models, answers, judgments))
            or (len(cases), len(models), len(answers)) != (18, 4, 72)
            or not isinstance(study.get("prompt"), str)
            or hashlib.sha256(study["prompt"].encode("utf-8")).hexdigest() != study.get("promptSha256")
            or results.get("studyVersion") != study["version"]
            or not isinstance(judge, dict)
            or not isinstance(judge.get("promptVersion"), str)
            or not isinstance(judge.get("libraryFingerprint"), str)
            or len(judgments) != len(answers)):
        raise mismatch
    case_ids = {c.get("id") for c in cases}
    model_ids = {m.get("id") for m in models}
    if len(case_ids) != 18 or len(model_ids) != 4:
        raise mismatch
    answered = set()
    for answer in answers:
        key = (answer.get("caseId"), answer.get("modelId"))
        if (answer.get("status") != "completed" or key[0] not in case_ids
                or key[1] not in model_ids or key in answered):
            raise mismatch
        answered.add(key)
    judged = set()
    for judgment in judgments:
        key = (judgment.get("caseId"), judgment.get("answerId"))
        if key not in answered or key in judged:
            raise mismatch
        judged.add(key)
    return {"version": study["version"], "cases": len(cases), "answers": len(answers),
            "judgments": len(judgments),
            "validJudgments": sum(1 for j in judgments if j.get("status") == "valid"),
            "judgePromptVersion": judge["promptVersion"],
            "judgeLibraryFingerprint": judge["libraryFingerprint"],
            "bundleSha256": hashlib.sha256(bundle_bytes).hexdigest(),
            "judgeResultsSha256": hashlib.sha256(judge_bytes).hexdigest()}


def validate_release(info, commit, build_id, revision):
    if (info.get("commit"), info.get("buildId"), info.get("revision")) != (commit, build_id, revision):
        raise ValueError("Candidate identity does not match the triggering commit/build/revision")
    actual = {d["id"]: (d["version"], d["cards"], d["current"], d["manifestSha256"]) for d in info["datasets"]}
    if actual != MANIFESTS:
        raise ValueError("Packaged review datasets differ from the approved release")
    lock = Path(__file__).with_name("review-package-lock.json").read_bytes()
    if info.get("packageSha256") != hashlib.sha256(lock).hexdigest():
        raise ValueError("Runtime review package lock differs from the committed source")
    for field, source in (("titlePromptStudy", TITLE_PROMPT_STUDY), ("latestTitlePromptStudy", LATEST_TITLE_PROMPT_STUDY)):
        study_bytes = (Path(__file__).resolve().parents[2] / source).read_bytes()
        study = json.loads(study_bytes)
        if len(study["cases"]) != 18 or any(c["status"] != "completed" for c in study["cases"]):
            raise ValueError("Every development pilot must be complete before release")
        expected_study = {"version": study["version"], "cases": 18,
                          "promptSha256": study["promptSha256"],
                          "bundleSha256": hashlib.sha256(study_bytes).hexdigest()}
        if info.get(field) != expected_study:
            raise ValueError("The candidate does not contain the exact committed title prompt pilot: " + field)
    if info.get("titleModelComparison") != title_model_comparison_release(Path(__file__).resolve().parents[2]):
        raise ValueError("The candidate does not contain the exact committed title model comparison")
    staff_bytes = (Path(__file__).resolve().parents[2] / TITLE_VALIDATION_PACKAGE).read_bytes()
    staff = json.loads(staff_bytes)
    expected_staff = {"version": staff["version"], "cases": len(staff["cases"]),
        "model": staff["provenance"]["model"],
        "promptSha256": staff["provenance"]["scientificPromptSha256"],
        "bundleSha256": hashlib.sha256(staff_bytes).hexdigest(), "released": True}
    if info.get("humanTitleReview") != expected_staff:
        raise ValueError("The staff title-review pilot is missing, changed, or not enabled")
    quick_bytes = (Path(__file__).resolve().parents[2] / "src/lib/titleValidation/data/quick-v1.json").read_bytes()
    quick = json.loads(quick_bytes)
    from quick_title_selection import selection_release
    if info.get("quickTitleReview") != {"version":quick["version"],"initialRegular":25,"reservedRegular":75,"flagged":319,
            "bundleSha256":hashlib.sha256(quick_bytes).hexdigest(),"released":True, **selection_release(quick_bytes)}:
        raise ValueError("The quick title-review package is missing, changed, or not enabled")
    from stage_source_title_package import validate as validate_source_pages
    source_manifest = json.loads(Path(__file__).with_name("source-title-review-package.json").read_bytes())
    source_bytes = (Path(__file__).resolve().parents[2] / "src/lib/titleValidation/data/source-pages-v2.json").read_bytes()
    validate_source_pages(source_bytes, source_manifest)
    if info.get("sourceTitleReview") != {k:v for k,v in source_manifest.items() if k != "gcsUri"}:
        raise ValueError("The grouped title-review package is missing or changed")
    relation_manifest = json.loads(Path(__file__).with_name("relationship-review-package.json").read_bytes())
    directory = relation_manifest.get("directory", "")
    if directory and not re.fullmatch(r"[a-z0-9-]+", directory):
        raise ValueError("Unsafe relationship package directory")
    relation_root = Path(__file__).resolve().parents[2] / "src/lib/relationshipReview/data" / directory
    relation_bytes = (relation_root / ("dataset.json" if directory else "top-level-v1.json")).read_bytes()
    relation = json.loads(relation_bytes)
    expected_relation = {"version": relation["version"], "cases": len(relation["cases"]),
        "model": relation["model"], "reasoning": relation["reasoning"],
        "bundleSha256": hashlib.sha256(relation_bytes).hexdigest(), "sourceSha256": relation["sourceSha256"]}
    presentation_bytes = (relation_root / "presentation.json").read_bytes()
    presentation = json.loads(presentation_bytes)
    expected_relation.update({"presentationVersion":presentation["version"],"selectedProposals":len(presentation["selectedCaseIds"]),"presentationSha256":hashlib.sha256(presentation_bytes).hexdigest()})
    if len(relation["cases"]) != relation_manifest["cases"] or info.get("relationshipReview") != expected_relation:
        raise ValueError("The relationship review proposals are missing, incomplete, or changed")


def verify_title_review_route(origin):
    """Smoke-test the team page, legacy link redirect, and anonymous boundary."""
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, request, fp, code, message, headers, url):
            return None

    legacy = origin + "/review/title-validation?workspace=practice"
    try:
        read_bytes(legacy, urllib.request.build_opener(NoRedirect()).open)
    except urllib.error.HTTPError as error:
        if (error.code != 307 or urllib.parse.urljoin(legacy, error.headers.get("Location", ""))
                != origin + "/review/title-validation"):
            raise ValueError("The earlier review link does not redirect to the team review") from error
    else:
        raise ValueError("The earlier review link must redirect to the team review")
    for suffix in ("", "?workspace=practice", "?workflow=earlier", "?set=flagged", "?qa=1"):
        html = read_bytes(origin + "/review/title-validation" + suffix).decode("utf-8")
        if ("Human title review" not in html or '"preview":false' not in html
                or '"practice":false' not in html):
            raise ValueError("Title review workspace is missing, mismatched, or exposes development mode")
    for payload in (b'{"previewReviewer":"preview-a"}',
                    b'{"workspace":"practice"}',
                    b'{"workspace":"practice","practiceReviewer":"practice-a"}'):
        request = urllib.request.Request(origin + "/api/som-review/title-validation/session",
            data=payload, method="POST", headers={"Content-Type": "application/json"})
        try:
            urllib.request.urlopen(request, timeout=60)
        except urllib.error.HTTPError as error:
            if error.code == 401:
                continue
            raise ValueError("Unexpected anonymous title review response") from error
        raise ValueError("Anonymous title review access was accepted")
    for action in ("quick-session", "quick-checkpoint", "quick-respond", "quick-manage", "quick-export",
                   "quick-source-session", "quick-source-status", "quick-source-checkpoint", "quick-source-respond", "quick-source-export"):
        request = urllib.request.Request(origin + "/api/som-review/title-validation/" + action,
            data=b'{"previewReviewer":"preview-a","qa":true}', method="POST", headers={"Content-Type":"application/json"})
        try:
            urllib.request.urlopen(request, timeout=60)
        except urllib.error.HTTPError as error:
            if error.code == 401:
                continue
            raise ValueError("Unexpected anonymous quick title review response") from error
        raise ValueError("Anonymous quick title review access was accepted")


def promote_if_current(commit, revision, api, main_head):
    # Read the fingerprint BEFORE checking main. Any intervening deployment or
    # promotion invalidates the conditional update, including another build's.
    service = api(SERVICE)
    if not service.get("etag"):
        raise ValueError("Cloud Run omitted the concurrency fingerprint")
    if not any(t.get("tag") == "git-candidate" and t.get("revision") == revision
               for t in service["traffic"]):
        raise ValueError("Candidate changed; leave traffic unchanged")
    if main_head() != commit:
        raise ValueError("Main has advanced; leave traffic unchanged for the newer build")
    traffic = [{"type": "TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION", "revision": revision, "percent": 100}]
    traffic += [{**t, "percent": 0} for t in service["traffic"] if t.get("tag")]
    # Never retry a failed conditional write with a refreshed fingerprint.
    return api(SERVICE + "?updateMask=traffic", method="PATCH",
               body={"name": SERVICE, "etag": service["etag"], "traffic": traffic})


def verify_relationship_review_route(origin):
    html = read_bytes(origin + "/review/relationships").decode("utf-8")
    if "Activity relationship review" not in html or '"preview":false' not in html:
        raise ValueError("Relationship review page is missing or exposes preview mode")
    for action in ("session", "save", "trace", "evidence", "tom-feedback"):
        request = urllib.request.Request(origin + "/api/som-review/relationships/" + action,
            data=b'{"previewReviewer":"tom"}', method="POST", headers={"Content-Type":"application/json", "Origin":"https://ontology.mit.edu"})
        try:
            urllib.request.urlopen(request, timeout=60)
        except urllib.error.HTTPError as error:
            if error.code == 401:
                continue
            raise ValueError("Unexpected anonymous relationship review response") from error
        raise ValueError("Anonymous relationship review access was accepted")


def main():
    commit, build_id, revision = sys.argv[1:]
    if not re.fullmatch(r"[a-f0-9]{40}", commit):
        raise ValueError("A full source commit is required")
    service = json.loads(gcloud("run", "services", "describe", "ontology", "--format=json"))
    candidates = [t for t in service["status"]["traffic"]
                  if t.get("tag") == "git-candidate" and t.get("revisionName") == revision]
    if len(candidates) != 1:
        raise ValueError("The candidate tag no longer targets this build; do not promote")
    validate_release(read_release(candidates[0]["url"]), commit, build_id, revision)
    verify_title_review_route(candidates[0]["url"])
    verify_relationship_review_route(candidates[0]["url"])
    token = subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()
    def api(resource, method="GET", body=None):
        request = urllib.request.Request("https://run.googleapis.com/v2/" + resource,
            data=json.dumps(body).encode() if body is not None else None, method=method,
            headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.load(response)
    def main_head():
        return subprocess.check_output(["git", "ls-remote", REPOSITORY, "refs/heads/main"], text=True).split()[0]
    print(json.dumps({"candidateVerified": True, "commit": commit, "buildId": build_id,
                      "revision": revision, "previousTraffic": service["status"]["traffic"]}), flush=True)
    operation = promote_if_current(commit, revision, api, main_head)
    deadline = time.monotonic() + 300
    while not operation.get("done"):
        if time.monotonic() >= deadline:
            raise TimeoutError("Promotion status is uncertain; inspect the operation before taking further action")
        time.sleep(3)
        operation = api(operation["name"])
    if operation.get("error"):
        raise RuntimeError("Conditional traffic promotion failed: " + str(operation["error"].get("code")))
    validate_release(read_release(service["status"]["url"]), commit, build_id, revision)
    verify_title_review_route(service["status"]["url"])
    verify_relationship_review_route(service["status"]["url"])
    print(json.dumps({"productionVerified": True, "commit": commit, "revision": revision}), flush=True)


if __name__ == "__main__":
    main()
