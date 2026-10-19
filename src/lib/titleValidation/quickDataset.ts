import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { QuickDataset } from "./quick";
export const QUICK_PACKAGE = "src/lib/titleValidation/data/quick-v1.json";
export const QUICK_PACKAGE_SHA256 =
  "683ccb70248e96813fca2d0b862584d7cd7a61518b9acab6d3d5fbdcd1492857";
export function getQuickDataset(): QuickDataset {
  const raw = fs.readFileSync(path.join(process.cwd(), QUICK_PACKAGE));
  if (
    crypto.createHash("sha256").update(raw).digest("hex") !==
    QUICK_PACKAGE_SHA256
  )
    throw Error("Quick title-review package changed");
  const data = JSON.parse(raw.toString("utf8")) as QuickDataset;
  if (
    data.cases.length !== 419 ||
    new Set(data.cases.map((c) => c.id)).size !== 419
  )
    throw Error("Quick title-review package incomplete");
  return data;
}
export function quickTitleReviewRelease() {
  const data = getQuickDataset();
  return {
    version: data.version,
    initialRegular: 25,
    reservedRegular: 75,
    flagged: 319,
    bundleSha256: QUICK_PACKAGE_SHA256,
    released: process.env.TITLE_VALIDATION_RELEASED === "1",
  };
}
