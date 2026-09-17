// Builds the public, read-only model-comparison archive from the private
// September 16 comparison folder. It copies prompts, inputs, raw answers, and
// software observations; it excludes request files, provider identifiers,
// account details, ledgers, and reviewer communications. It makes no model calls.
//
// node scripts/som-review/build-title-model-comparison-archive.mjs \
//   --source <private comparison folder> \
//   --out Ontology_Title_Clarity_Testbed_2026-08-28/model-comparison-2026-09-16
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  inspectLatestTitleAnswer,
  latestSoftwareChecks,
} from "./latest-title-prompt-study-lib.mjs";

const sha = (text) => crypto.createHash("sha256").update(text).digest("hex");
const argument = (name) => {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`Missing ${name}`);
  return process.argv[index + 1];
};

const source = argument("--source");
const out = argument("--out");
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(source, file), "utf8"));

const baseline = readJson("astra-baseline.json");
const comparison = readJson("comparison.json");
const key = readJson("private-model-key.json");
const previous = JSON.parse(
  fs.readFileSync(
    "Ontology_Title_Clarity_Testbed_2026-08-28/prompt-study-2026-09-14/bundle.json",
    "utf8",
  ),
);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
assert(sha(baseline.prompt) === baseline.promptSha256, "Prompt hash mismatch");
assert(comparison.promptSha256 === baseline.promptSha256, "Comparison prompt differs");
assert(sha(baseline.clarification) === baseline.clarificationSha256, "Clarification hash mismatch");
assert(baseline.sourceSha256 === previous.sourceSha256, "Source ontology differs");
assert(baseline.cases.length === 18 && comparison.rows.length === 72, "Unexpected size");

const modelOrder = ["astra", "sol", "terra", "mini"];
const summaries = new Map(comparison.summaries.map((s) => [s.id, s]));
assert(modelOrder.every((id) => summaries.has(id)), "Missing model summary");

const cases = baseline.cases.map((item, index) => {
  const earlier = previous.cases[index];
  for (const field of ["id", "title", "originalTitle", "input", "inputSha256"])
    assert(item[field] === earlier[field], `${item.id} ${field} differs from the September 14 study`);
  assert(
    JSON.stringify(item.descriptions) === JSON.stringify(earlier.descriptions),
    `${item.id} descriptions differ from the September 14 study`,
  );
  const letters = key.cases[item.id];
  assert(
    letters && JSON.stringify(Object.values(letters).sort()) === JSON.stringify([...modelOrder].sort()),
    `${item.id} letters are not a permutation of the four models`,
  );
  return {
    id: item.id,
    title: item.title,
    originalTitle: item.originalTitle,
    input: item.input,
    inputSha256: item.inputSha256,
    descriptions: item.descriptions,
    letters,
  };
});

const answers = [];
for (const item of cases) {
  for (const modelId of modelOrder) {
    const row = comparison.rows.find((r) => r.caseId === item.id && r.modelId === modelId);
    assert(row, `Missing ${modelId} answer for ${item.id}`);
    assert(row.sourceInputSha256 === item.inputSha256, `${item.id} ${modelId} input differs`);
    assert(sha(row.rawOutput) === row.rawOutputSha256, `${item.id} ${modelId} output hash differs`);
    const checked = inspectLatestTitleAnswer(
      { title: item.title, descriptions: item.descriptions },
      row.rawOutput,
      row.status,
    );
    assert(
      JSON.stringify(checked.groups) === JSON.stringify(row.groups) &&
        checked.observations.length === row.hardIssues.length + row.groupSizeReviewFlags.length,
      `${item.id} ${modelId} software checks differ from the private analysis`,
    );
    answers.push({
      caseId: item.id,
      modelId,
      status: checked.status,
      rawOutput: row.rawOutput,
      outputSha256: row.rawOutputSha256,
      groups: checked.groups,
      reason: checked.reason,
      observations: checked.observations,
      generationCostUsd: row.estimatedCostUsd,
    });
  }
}

const archive = {
  version: "rob-very-short-prompt-model-comparison-2026-09-16-v1",
  label: "Four models on Rob’s very short title prompt",
  explanation:
    "The September 15 very short prompt, with B(ii) corrected to “inadequate”, run on the same 18 development examples by four model configurations. GPT-6 Astra’s saved September 15 answers were reused; GPT-5.6 Sol, GPT-5.6 Terra, and GPT-5.4 Mini were run on September 16 with identical messages, evidence, and output format.",
  prompt: baseline.prompt,
  promptSha256: baseline.promptSha256,
  asReceivedPrompt: baseline.asReceivedPrompt,
  wordingCorrection: baseline.wordingCorrection,
  clarification: baseline.clarification,
  clarificationSha256: baseline.clarificationSha256,
  outputFormat: baseline.outputFormat,
  outputSchema: baseline.outputSchema,
  softwareChecks: latestSoftwareChecks,
  sourceSha256: baseline.sourceSha256,
  sourceFile: baseline.sourceFile,
  inputsFrom: previous.version,
  funding: baseline.funding,
  lettersNote:
    "Option letters match the blinded comparison sent to Rob on September 16. Letters were shuffled separately for each example, so the same letter does not identify the same model across examples.",
  models: modelOrder.map((id) => {
    const s = summaries.get(id);
    return {
      id,
      label: s.label,
      model: s.model,
      modelVersion: s.modelVersion,
      reasoning: s.reasoningEffort,
      runDate: id === "astra" ? "2026-09-15" : "2026-09-16",
      completed: s.completed,
      groupCount: s.groupCount,
      generationCostUsd: Number(s.generationCostUsd.toFixed(6)),
    };
  }),
  cases,
  answers,
};

fs.mkdirSync(out, { recursive: true });
const target = path.join(out, "comparison.json");
if (fs.existsSync(target) && !process.argv.includes("--replace"))
  throw new Error(`${target} exists; pass --replace to rebuild it deliberately`);
fs.writeFileSync(target, JSON.stringify(archive, null, 1) + "\n");
fs.writeFileSync(path.join(out, "prompt.txt"), baseline.prompt);
fs.writeFileSync(path.join(out, "clarification.txt"), baseline.clarification);
fs.writeFileSync(path.join(out, ".gitattributes"), "prompt.txt -text\nclarification.txt -text\n");
console.log(JSON.stringify({ target, cases: cases.length, answers: answers.length, sha256: sha(fs.readFileSync(target)) }));
