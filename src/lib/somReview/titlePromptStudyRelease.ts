import fs from "fs";
import path from "path";
import crypto from "crypto";

export const titlePromptStudyPath = "Ontology_Title_Clarity_Testbed_2026-08-28/prompt-study-2026-09-13/bundle.json";

export function titlePromptStudyRelease() {
  const bytes = fs.readFileSync(path.join(process.cwd(), titlePromptStudyPath));
  const data = JSON.parse(bytes.toString("utf8"));
  if (data.version !== "rob-simple-title-prompt-2026-09-13-development-v1" ||
      data.cases.length !== 18 || data.cases.some((c: { status: string }) => c.status !== "completed") ||
      data.model !== "gpt-6-astra" || data.modelVersion !== "2026-09-03" || data.reasoning !== "max") {
    throw new Error("Title prompt development pilot is incomplete or mismatched");
  }
  return { version: data.version, cases: data.cases.length, promptSha256: data.promptSha256,
    bundleSha256: crypto.createHash("sha256").update(bytes).digest("hex") };
}
