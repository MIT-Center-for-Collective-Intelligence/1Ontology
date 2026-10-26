import fs from "fs";
import path from "path";
import crypto from "crypto";
import manifest from "../../../scripts/deployment/title-followup-package.json";
import type { QuickDataset } from "./quick";
import type { SourceDataset } from "./sourceReview";
import { getQuickDataset } from "./quickDataset";
import { TitleValidationError } from "./engine";

export const FOLLOWUP_PACKAGE =
  "src/lib/titleValidation/data/followup-batches-v1.json";
export type FollowupBatchNumber = 2 | 3 | 4;
export function followupBatchNumber(value: unknown): FollowupBatchNumber | undefined {
  if (value === undefined) return undefined;
  if (![2, 3, 4].includes(value as number))
    throw new TitleValidationError(400, "Unknown review batch.");
  return value as FollowupBatchNumber;
}
export function followupStudyId(batch: FollowupBatchNumber, qa = false) {
  return `${qa ? "software-qa-quick-title" : "quick-title-verification"}-20261026-batch-${batch}`;
}
interface FollowupBatch {
  number: FollowupBatchNumber;
  anchorCaseIds: string[];
  sources: SourceDataset;
}
export function getFollowupBatch(batch: FollowupBatchNumber) {
  const raw = fs.readFileSync(path.join(process.cwd(), FOLLOWUP_PACKAGE));
  if (crypto.createHash("sha256").update(raw).digest("hex") !== manifest.bundleSha256)
    throw Error("Follow-up review package changed");
  const saved = JSON.parse(raw.toString()) as {
    version: string;
    batches: FollowupBatch[];
    postProcessing: { explanation: string; exactPrompt: string; model: string };
  };
  if (saved.version !== manifest.version || saved.batches.length !== 3)
    throw Error("Follow-up review coverage changed");
  const selected = saved.batches.find((b) => b.number === batch);
  if (!selected || selected.anchorCaseIds.length !== 25 ||
      new Set(selected.anchorCaseIds).size !== 25 || selected.sources.pages.length !== 25)
    throw Error("Follow-up batch is incomplete");
  const base = getQuickDataset();
  const ids = new Set(selected.anchorCaseIds);
  const cases = base.cases.filter((c) => ids.has(c.id)).map((c) => ({
    ...c, batch: "first25" as const,
  }));
  if (cases.length !== 25 || cases.some((c) => c.batch !== "first25"))
    throw Error("Follow-up anchors changed");
  const data: QuickDataset = {
    ...base,
    version: selected.sources.version,
    cases,
    provenance: { ...base.provenance, followupBatch: batch },
  };
  return {
    data,
    sources: { ...selected.sources, bundleSha256: manifest.bundleSha256 },
    postProcessing: saved.postProcessing,
    number: batch,
  };
}
export function followupTitleReviewRelease() {
  for (const number of [2, 3, 4] as const) getFollowupBatch(number);
  const { gcsUri: _storage, ...publicIdentity } = manifest;
  return publicIdentity;
}
