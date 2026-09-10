"""Verify a GitHub-main candidate, then promote that exact revision. No database writes."""
import json
import hashlib
from pathlib import Path
import re
import subprocess
import sys
import time
import urllib.request

PROJECT = "ontology-41607"
REGION = "us-central1"
REPOSITORY = "https://github.com/MIT-Center-for-Collective-Intelligence/1Ontology.git"
SERVICE = "projects/ontology-41607/locations/us-central1/services/ontology"
MANIFESTS = {
    "ontology-title-testbed": ("ontology-title-two-route-testbed-2026-09-02-v6", 18, False,
        "d37949667f4efce3d7a16fec9ec04c95774aea8789cedba4d8a19d3d753f91ea"),
    "ontology-title-testbed-v7": ("ontology-title-random-round-2026-09-09-v7", 50, True,
        "d761c9729e79db44890d804c44df935a1972accb11d1870d8b90f37ba04eeded"),
}


def gcloud(*args):
    return subprocess.check_output(["gcloud", *args, "--project", PROJECT, "--region", REGION], text=True)


def read_release(origin):
    with urllib.request.urlopen(origin + "/api/deployment", timeout=60) as response:
        return json.load(response)


def validate_release(info, commit, build_id, revision):
    if (info.get("commit"), info.get("buildId"), info.get("revision")) != (commit, build_id, revision):
        raise ValueError("Candidate identity does not match the triggering commit/build/revision")
    actual = {d["id"]: (d["version"], d["cards"], d["current"], d["manifestSha256"]) for d in info["datasets"]}
    if actual != MANIFESTS:
        raise ValueError("Packaged review datasets differ from the approved release")
    lock = Path(__file__).with_name("review-package-lock.json").read_bytes()
    if info.get("packageSha256") != hashlib.sha256(lock).hexdigest():
        raise ValueError("Runtime review package lock differs from the committed source")


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
    print(json.dumps({"productionVerified": True, "commit": commit, "revision": revision}), flush=True)


if __name__ == "__main__":
    main()
