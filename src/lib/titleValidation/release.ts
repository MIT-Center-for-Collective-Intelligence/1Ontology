import fs from "fs";
import path from "path";
import crypto from "crypto";

export const TITLE_VALIDATION_PACKAGE =
  "src/lib/titleValidation/data/prepilot-v1.json";
export const TITLE_VALIDATION_PACKAGE_SHA256 =
  "a759be0d165c2bca67c7729f518cf0f14b325cf9c1604442659d378dae3677ee";

/** Public release identity only: no case text, reviewer information, or answers. */
export function titleValidationRelease() {
  const raw = fs.readFileSync(
    path.join(process.cwd(), TITLE_VALIDATION_PACKAGE),
  );
  const bundleSha256 = crypto.createHash("sha256").update(raw).digest("hex");
  if (bundleSha256 !== TITLE_VALIDATION_PACKAGE_SHA256)
    throw Error("Staff pilot package changed");
  const data = JSON.parse(raw.toString("utf8"));
  return {
    version: data.version as string,
    cases: data.cases.length as number,
    model: data.provenance.model as string,
    promptSha256: data.provenance.scientificPromptSha256 as string,
    bundleSha256,
    released: process.env.TITLE_VALIDATION_RELEASED === "1",
  };
}
