import fs from "fs";
import path from "path";
import crypto from "crypto";
import manifest from "../../../scripts/deployment/source-title-review-package.json";
import type { SourceDataset } from "./sourceReview";
import { getQuickDataset, QUICK_PACKAGE_SHA256 } from "./quickDataset";

export const SOURCE_PACKAGE =
  "src/lib/titleValidation/data/source-pages-v2.json";
export function getSourceDataset(): SourceDataset {
  const raw = fs.readFileSync(path.join(process.cwd(), SOURCE_PACKAGE));
  if (
    crypto.createHash("sha256").update(raw).digest("hex") !==
    manifest.bundleSha256
  )
    throw Error("Source title-review package changed");
  const data = JSON.parse(raw.toString("utf8")) as SourceDataset;
  const quick = getQuickDataset();
  const anchors = data.pages.flatMap((p) => p.anchorCaseIds);
  if (
    data.version !== manifest.version ||
    data.pages.length !== manifest.pages ||
    new Set(data.pages.map((p) => p.id)).size !== data.pages.length ||
    data.pages.reduce((n, p) => n + p.activities.length, 0) !==
      manifest.activities ||
    data.pages.reduce(
      (n, p) => n + p.activities.filter((a) => !a.proposals.length).length,
      0,
    ) !== manifest.missingProposals ||
    data.provenance.quickBundleSha256 !== QUICK_PACKAGE_SHA256 ||
    anchors.length !== quick.cases.length ||
    new Set(anchors).size !== anchors.length ||
    quick.cases.some((c) => !anchors.includes(c.id)) ||
    data.pages.some(
      (p) =>
        !p.description ||
        !p.activities.length ||
        new Set(p.activities.map((a) => a.id)).size !== p.activities.length ||
        p.anchorCaseIds.some((id) => !p.activities.some((a) => a.id === id)),
    )
  )
    throw Error("Source title-review coverage changed");
  return { ...data, bundleSha256: manifest.bundleSha256 };
}
export function sourceTitleReviewRelease() {
  getSourceDataset();
  const { gcsUri: _privateStorage, ...release } = manifest;
  return release;
}
