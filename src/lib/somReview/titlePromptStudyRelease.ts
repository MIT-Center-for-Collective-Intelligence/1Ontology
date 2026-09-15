import fs from "fs";
import path from "path";
import crypto from "crypto";

export const titlePromptStudyPath =
  "Ontology_Title_Clarity_Testbed_2026-08-28/prompt-study-2026-09-13/bundle.json";
export const latestTitlePromptStudyPath =
  "Ontology_Title_Clarity_Testbed_2026-08-28/prompt-study-2026-09-14/bundle.json";

function studyRelease(relativePath: string, version: string) {
  const bytes = fs.readFileSync(path.join(process.cwd(), relativePath));
  const data = JSON.parse(bytes.toString("utf8"));
  if (
    data.version !== version ||
    data.cases.length !== 18 ||
    data.cases.some((c: { status: string }) => c.status !== "completed") ||
    data.model !== "gpt-6-astra" ||
    data.modelVersion !== "2026-09-03" ||
    data.reasoning !== "max" ||
    crypto.createHash("sha256").update(data.prompt).digest("hex") !==
      data.promptSha256
  ) {
    throw new Error(
      "Title prompt development pilot is incomplete or mismatched",
    );
  }
  return {
    version: data.version,
    cases: data.cases.length,
    promptSha256: data.promptSha256,
    bundleSha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  };
}

export const titlePromptStudyRelease = () =>
  studyRelease(
    titlePromptStudyPath,
    "rob-simple-title-prompt-2026-09-13-development-v1",
  );
export const latestTitlePromptStudyRelease = () =>
  studyRelease(
    latestTitlePromptStudyPath,
    "rob-revised-title-prompt-2026-09-14-v3",
  );
