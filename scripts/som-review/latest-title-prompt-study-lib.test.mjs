import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { inspectLatestTitleAnswer } from "./latest-title-prompt-study-lib.mjs";

const sha = (text) => crypto.createHash("sha256").update(text).digest("hex");
const root = "Ontology_Title_Clarity_Testbed_2026-08-28/";

test("the latest archive preserves the exact prompt and all 18 original inputs", () => {
  const old = JSON.parse(
    fs.readFileSync(root + "prompt-study-2026-09-13/bundle.json"),
  );
  const latest = JSON.parse(
    fs.readFileSync(root + "prompt-study-2026-09-14/bundle.json"),
  );
  assert.equal(
    latest.prompt,
    fs.readFileSync(root + "prompt-study-2026-09-14/rob-prompt.txt", "utf8"),
  );
  assert.equal(
    latest.clarification,
    fs.readFileSync(root + "prompt-study-2026-09-14/clarification.txt", "utf8"),
  );
  assert.equal(sha(latest.prompt), latest.promptSha256);
  assert.equal(sha(latest.clarification), latest.clarificationSha256);
  assert.deepEqual(latest.outputSchema, old.outputSchema);
  assert.equal(latest.cases.length, 18);
  for (const [index, item] of latest.cases.entries()) {
    assert.equal(item.input, old.cases[index].input);
    assert.deepEqual(item.descriptions, old.cases[index].descriptions);
    assert.equal(sha(item.input), item.inputSha256);
    assert.equal(sha(item.rawOutput), item.outputSha256);
    const checked = inspectLatestTitleAnswer(
      { title: item.title, descriptions: item.descriptions },
      item.rawOutput,
      "completed",
    );
    for (const field of ["groups", "reason", "observations", "status"])
      assert.deepEqual(checked[field], item[field]);
  }
});

test("a homogeneous group is not forced to split to meet the approximate target", () => {
  const descriptions = Array.from({ length: 22 }, (_, i) => ({
    number: i + 1,
    text: "Negotiate a contract.",
  }));
  const raw = JSON.stringify({
    groups: [
      {
        title: "Negotiate Contract",
        descriptionNumbers: descriptions.map((d) => d.number),
        reason: "The same meaningful activity.",
      },
    ],
    reason: "Keep the homogeneous group.",
  });
  assert.deepEqual(
    inspectLatestTitleAnswer(
      { title: "Negotiate Contract", descriptions },
      raw,
      "completed",
    ).observations,
    [],
  );
});

test("out-of-range split groups are flagged for review without changing their assignments", () => {
  const descriptions = Array.from({ length: 12 }, (_, i) => ({
    number: i + 1,
    text: `Activity ${i + 1}`,
  }));
  const groups = [
    {
      title: "Conduct Field Research",
      descriptionNumbers: [1, 2],
      reason: "Different work.",
    },
    {
      title: "Conduct Laboratory Research",
      descriptionNumbers: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      reason: "A homogeneous activity.",
    },
  ];
  const result = inspectLatestTitleAnswer(
    { title: "Conduct Research", descriptions },
    JSON.stringify({ groups, reason: "Two kinds of work." }),
    "completed",
  );
  assert.deepEqual(result.groups, groups);
  assert.equal(
    result.observations.filter((x) => x.includes("5–9 target")).length,
    2,
  );
  assert.equal(result.status, "completed");
});
