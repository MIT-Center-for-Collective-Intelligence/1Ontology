import fs from "fs";
import path from "path";
import { getBranchDataset } from "./branchDataset";

const SOURCE_SHA256 =
  "06daeedf3153e3f7efa00659d69d076aa0962efdd1c373642050f5831a96a703";

// Server-only public identity; never return proposals, provenance bodies or feedback.
export function relationshipBranchReviewRelease() {
  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "scripts/deployment/branch-review-package.json"),
      "utf8",
    ),
  );
  if (
    manifest.schemaVersion !== "private-generalization-branch-package-v1" ||
    manifest.version !== "generalization-branches-20261024-v1" ||
    manifest.directory !== "branches-v1" ||
    manifest.families !== 18 ||
    manifest.groups !== 82 ||
    manifest.sourceSha256 !== SOURCE_SHA256 ||
    manifest.sourceGraph?.directory !== "atomic-v1" ||
    manifest.sourceGraph?.sha256 !== SOURCE_SHA256 ||
    [manifest.bundleSha256, manifest.releaseLockSha256, manifest.archiveSha256].some(
      (hash) => typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash),
    ) ||
    manifest.gcsUri !==
      `gs://ontology-41607_cloudbuild/relationship-branches/${manifest.archiveSha256}.tar.gz`
  ) {
    throw new Error("Branch release manifest mismatch");
  }
  // The server loader verifies the complete package, including traces and shared source.
  const { dataset, sha256 } = getBranchDataset();
  const families = dataset.families.length;
  const groups = dataset.families.reduce((count, family) => count + family.groups.length, 0);
  if (
    dataset.version !== manifest.version ||
    sha256 !== manifest.bundleSha256 ||
    dataset.sourceSha256 !== manifest.sourceSha256 ||
    families !== manifest.families ||
    groups !== manifest.groups
  ) {
    throw new Error("Branch review package is incomplete or changed");
  }
  return {
    version: dataset.version,
    families,
    groups,
    bundleSha256: sha256,
    sourceSha256: dataset.sourceSha256,
  };
}
