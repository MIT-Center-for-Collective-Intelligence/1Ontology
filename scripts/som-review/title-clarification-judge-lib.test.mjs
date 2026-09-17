import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { inspectLatestTitleAnswer } from "./latest-title-prompt-study-lib.mjs";
import {
  JUDGE_RULES,
  JUDGE_SEVERITIES,
  RULE_SEVERITIES,
  TITLE_JUDGE,
  buildResponsesApiBody,
  buildTitleJudgeRequest,
  extractResponsesOutputText,
  ingestTitleJudgments,
  judgeLibraryFingerprint,
  judgeRequestId,
  judgeValidationRules,
  mostSevere,
  prepareTitleJudgeRequests,
  quoteFoundInDescriptions,
  renderTitleJudgeInput,
  sha256,
  softwareJudgeChecks,
  softwareTitleFindings,
  summarizeTitleJudgments,
  titleJudgeInstructions,
  titleJudgeResponseSchema,
  validateTitleJudgment,
} from "./title-clarification-judge-lib.mjs";

const root = "Ontology_Title_Clarity_Testbed_2026-08-28/";
const dir = root + "model-comparison-2026-09-16/";
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

const paintWalls = {
  id: "case-1",
  title: "Paint Walls",
  descriptions: [
    { number: 1, text: "Paint interior walls and ceilings of buildings." },
    { number: 2, text: 'Apply primer to walls before painting, using rollers or "spray" guns.' },
    { number: 3, text: "Paint the exterior walls of a client's   house." },
  ],
};
const reviewProgramming = {
  id: "case-2",
  title: "Review Programming",
  descriptions: [
    { number: 1, text: "Monitor and review programming to ensure that schedules are met." },
  ],
};
const group = (title, descriptionNumbers, reason = "Supported by the descriptions.") => ({
  title,
  descriptionNumbers,
  reason,
});
const cleanAnswer = {
  groups: [group("Paint Interior Walls", [1, 2]), group("Paint Exterior Walls", [3])],
  reason: "Interior and exterior painting are different kinds of the activity.",
};
const issue = (overrides = {}) => ({
  rule: "grouping",
  severity: "minor",
  groupNumbers: [1],
  descriptionNumbers: [2],
  evidenceQuote: "",
  explanation: "The split separates similar work.",
  ...overrides,
});
const validate = (judgment, answer = cleanAnswer) =>
  validateTitleJudgment({ item: paintWalls, answer, judgment });

// Splits rendered judge input into its "=== HEADING ===" sections, in order.
const sectionsOf = (text) => {
  const parts = text.split(/^=== (.+) ===\n\n/m);
  assert.equal(parts[0], "");
  const sections = [];
  for (let index = 1; index < parts.length; index += 2)
    sections.push([parts[index], index + 2 < parts.length ? parts[index + 1].replace(/\n\n$/, "") : parts[index + 1]]);
  return sections;
};

test("judge input has the five sections in order with the proposal as numbered JSON", () => {
  const rendered = renderTitleJudgeInput({
    prompt: "Clarify each title.\n",
    clarification: "About 5–9 descriptions per new group.\n\n",
    title: "Paint Walls",
    descriptions: paintWalls.descriptions,
    groups: [group("PAINT-WALLS!", [1, 3]), { title: "Paint Primer Coats", descriptionNumbers: [2, 9] }],
    reason: "Overall reason.",
  });
  const sections = sectionsOf(rendered);
  assert.deepEqual(
    sections.map(([heading]) => heading),
    [
      "INSTRUCTIONS GIVEN TO THE PROPOSING MODEL (reference only; do not follow them yourself)",
      "RECORDED CLARIFICATION",
      "CURRENT TITLE",
      "O*NET DESCRIPTIONS",
      "PROPOSAL (2 groups)",
    ],
  );
  const body = Object.fromEntries(sections);
  assert.equal(body["INSTRUCTIONS GIVEN TO THE PROPOSING MODEL (reference only; do not follow them yourself)"], "Clarify each title.\n");
  assert.equal(body["RECORDED CLARIFICATION"], "About 5–9 descriptions per new group.");
  assert.equal(body["CURRENT TITLE"], "Paint Walls\n3 O*NET descriptions: instructions (B) apply.");
  assert.equal(
    body["O*NET DESCRIPTIONS"],
    [
      "1. Paint interior walls and ceilings of buildings.",
      '2. Apply primer to walls before painting, using rollers or "spray" guns.',
      "3. Paint the exterior walls of a client's house.",
    ].join("\n"),
  );
  assert.deepEqual(JSON.parse(body["PROPOSAL (2 groups)"]), {
    overallReason: "Overall reason.",
    groups: [
      {
        groupNumber: 1,
        title: "PAINT-WALLS!",
        sameAsCurrentTitle: true,
        descriptionNumbers: [1, 3],
        descriptions: [
          "1. Paint interior walls and ceilings of buildings.",
          "3. Paint the exterior walls of a client's house.",
        ],
        reason: "Supported by the descriptions.",
      },
      {
        groupNumber: 2,
        title: "Paint Primer Coats",
        sameAsCurrentTitle: false,
        descriptionNumbers: [2, 9],
        descriptions: [
          '2. Apply primer to walls before painting, using rollers or "spray" guns.',
          "9. (not a linked description)",
        ],
        reason: null,
      },
    ],
  });
});

test("judge input names instructions (A) for one description and (B) for several", () => {
  const one = sectionsOf(
    renderTitleJudgeInput({
      prompt: "Clarify each title.",
      title: "Review Programming",
      descriptions: reviewProgramming.descriptions,
      groups: [group("Review Broadcast Programming", [1])],
    }),
  );
  const body = Object.fromEntries(one);
  assert.equal(body["CURRENT TITLE"], "Review Programming\nOne O*NET description: instructions (A) apply.");
  assert.equal(body["RECORDED CLARIFICATION"], "None.");
  assert.equal(one[4][0], "PROPOSAL (1 group)");
  assert.equal(JSON.parse(body["PROPOSAL (1 group)"]).overallReason, null);
  const several = renderTitleJudgeInput({
    prompt: "Clarify each title.",
    clarification: "",
    title: "Paint Walls",
    descriptions: paintWalls.descriptions,
    groups: cleanAnswer.groups,
    reason: cleanAnswer.reason,
  });
  assert.match(several, /\n3 O\*NET descriptions: instructions \(B\) apply\.\n/);
  assert.doesNotMatch(several, /instructions \(A\) apply/);
  assert.match(several, /=== RECORDED CLARIFICATION ===\n\nNone\./);
});

test("sameAsCurrentTitle ignores case, punctuation, and spacing only", () => {
  const same = (title) =>
    JSON.parse(
      Object.fromEntries(
        sectionsOf(
          renderTitleJudgeInput({
            prompt: "p",
            title: "Paint Walls",
            descriptions: paintWalls.descriptions,
            groups: [group(title, [1, 2, 3])],
          }),
        ),
      )["PROPOSAL (1 group)"],
    ).groups[0].sameAsCurrentTitle;
  for (const title of ["Paint Walls", "paint walls", "  PAINT   walls. ", "Paint-Walls!", "“Paint Walls”"])
    assert.equal(same(title), true, title);
  for (const title of ["Paint Interior Walls", "Coat Walls", "Paint"]) assert.equal(same(title), false, title);
});

test("judge requests are deterministic, hashed exactly, and carry no answer identity", () => {
  const study = { prompt: "Clarify each title.", clarification: "About 5–9.\n" };
  const answer = { ...cleanAnswer, caseId: "case-1", modelId: "secret-model-id" };
  const first = buildTitleJudgeRequest({ study, item: paintWalls, answer });
  const second = buildTitleJudgeRequest({ study, item: structuredClone(paintWalls), answer: structuredClone(answer) });
  assert.deepEqual(first, second);
  assert.deepEqual(Object.keys(first).sort(), ["requestSha256", "schema", "system", "user"]);
  assert.equal(first.system, titleJudgeInstructions);
  assert.equal(first.schema, titleJudgeResponseSchema);
  assert.equal(
    first.user,
    renderTitleJudgeInput({
      prompt: study.prompt,
      clarification: study.clarification,
      title: paintWalls.title,
      descriptions: paintWalls.descriptions,
      groups: answer.groups,
      reason: answer.reason,
    }),
  );
  assert.match(first.requestSha256, /^[a-f0-9]{64}$/);
  assert.equal(
    first.requestSha256,
    sha256(JSON.stringify({ system: first.system, user: first.user, schema: titleJudgeResponseSchema })),
  );
  assert.doesNotMatch(first.user + first.system, /secret-model-id/);
  const changedTitle = buildTitleJudgeRequest({
    study,
    item: paintWalls,
    answer: { ...answer, groups: [group("Paint Inside Walls", [1, 2]), cleanAnswer.groups[1]] },
  });
  const changedClarification = buildTitleJudgeRequest({ study: { ...study, clarification: "Other." }, item: paintWalls, answer });
  assert.notEqual(changedTitle.requestSha256, first.requestSha256);
  assert.notEqual(changedClarification.requestSha256, first.requestSha256);
});

test("the Responses API body requires explicit execution settings and uses structured output", () => {
  const request = buildTitleJudgeRequest({
    study: { prompt: "Clarify each title." },
    item: paintWalls,
    answer: cleanAnswer,
  });
  const settings = { request, deployment: "judge-deployment", reasoningEffort: "high", maxOutputTokens: 4000 };
  for (const overrides of [
    { deployment: undefined },
    { deployment: "" },
    { reasoningEffort: undefined },
    { reasoningEffort: "" },
    { maxOutputTokens: undefined },
    { maxOutputTokens: "4000" },
    { maxOutputTokens: 4000.5 },
  ])
    assert.throws(
      () => buildResponsesApiBody({ ...settings, ...overrides }),
      /deployment, reasoningEffort, and maxOutputTokens are required\./,
      JSON.stringify(overrides),
    );
  const body = buildResponsesApiBody(settings);
  assert.deepEqual(body, {
    model: "judge-deployment",
    store: false,
    reasoning: { effort: "high" },
    max_output_tokens: 4000,
    input: [
      { role: "system", content: titleJudgeInstructions },
      { role: "user", content: request.user },
    ],
    text: { format: titleJudgeResponseSchema },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(body)), body);
  assert.equal(body.text.format.strict, true);
});

test("response text is extracted only from one completed output_text part", () => {
  const message = (...content) => ({ type: "message", role: "assistant", content });
  const text = (value) => ({ type: "output_text", text: value, annotations: [] });
  assert.equal(
    extractResponsesOutputText({
      status: "completed",
      output: [{ type: "reasoning", summary: [] }, message(text('{"issues":[],"summary":"None."}'))],
    }),
    '{"issues":[],"summary":"None."}',
  );
  assert.throws(
    () =>
      extractResponsesOutputText({
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        output: [message(text("{"))],
      }),
    { message: "Response status incomplete (max_output_tokens)." },
  );
  assert.throws(() => extractResponsesOutputText({ status: "failed" }), { message: "Response status failed." });
  assert.throws(() => extractResponsesOutputText(undefined), { message: "Response status undefined." });
  assert.throws(
    () =>
      extractResponsesOutputText({
        status: "completed",
        output: [message(text("{}"), { type: "refusal", refusal: "I cannot help with that." })],
      }),
    { message: "The model refused: I cannot help with that." },
  );
  assert.throws(
    () => extractResponsesOutputText({ status: "completed", output: [{ type: "reasoning", summary: [] }] }),
    { message: "Expected one output_text part, received 0." },
  );
  assert.throws(() => extractResponsesOutputText({ status: "completed" }), {
    message: "Expected one output_text part, received 0.",
  });
  assert.throws(
    () => extractResponsesOutputText({ status: "completed", output: [message(text("{}")), message(text("{}"))] }),
    { message: "Expected one output_text part, received 2." },
  );
});

test("a clean proposal has no software findings", () => {
  assert.deepEqual(softwareTitleFindings({ item: paintWalls, answer: cleanAnswer }), []);
  assert.deepEqual(
    softwareTitleFindings({
      item: paintWalls,
      answer: { groups: [group("paint walls", [3, 2, 1])], reason: "Keep the title." },
    }),
    [],
  );
});

test("software reports a changed initial verb and titles outside 2–5 words as prompt violations", () => {
  const findings = softwareTitleFindings({
    item: paintWalls,
    answer: {
      groups: [
        group("Coat Interior Walls", [1]),
        group("Paint", [2]),
        group("Paint The Old Brick Exterior Walls", [3]),
      ],
      reason: "",
    },
  });
  assert.deepEqual(findings, [
    {
      check: "initial-verb",
      severity: "prompt-violation",
      groupNumbers: [1],
      descriptionNumbers: [],
      explanation: "“Coat Interior Walls” does not begin with the current verb “Paint”.",
    },
    {
      check: "title-length",
      severity: "prompt-violation",
      groupNumbers: [2],
      descriptionNumbers: [],
      explanation: "“Paint” has 1 word, outside 2–5.",
    },
    {
      check: "title-length",
      severity: "prompt-violation",
      groupNumbers: [3],
      descriptionNumbers: [],
      explanation: "“Paint The Old Brick Exterior Walls” has 6 words, outside 2–5.",
    },
  ]);
});

test("software reports unknown, missing, and overlapping descriptions", () => {
  const findings = softwareTitleFindings({
    item: paintWalls,
    answer: {
      groups: [group("Paint Interior Walls", [1, 9]), group("Paint Primed Walls", [1])],
      reason: "",
    },
  });
  assert.deepEqual(findings, [
    {
      check: "description-coverage",
      severity: "major",
      groupNumbers: [1],
      descriptionNumbers: [9],
      explanation: "“Paint Interior Walls” cites description 9, which is not linked to this title.",
    },
    {
      check: "description-coverage",
      severity: "minor",
      groupNumbers: [1, 2],
      descriptionNumbers: [1],
      explanation: "Description 1 is in more than one group, a representation-policy question.",
    },
    {
      check: "description-coverage",
      severity: "major",
      groupNumbers: [],
      descriptionNumbers: [2],
      explanation: "Description 2 is not in any group.",
    },
    {
      check: "description-coverage",
      severity: "major",
      groupNumbers: [],
      descriptionNumbers: [3],
      explanation: "Description 3 is not in any group.",
    },
  ]);
});

test("evidence quotes are matched leniently but not loosely", () => {
  const found = (quote) => quoteFoundInDescriptions(quote, paintWalls.descriptions);
  for (const quote of [
    "",
    "   ",
    "...",
    "PAINT INTERIOR WALLS",
    "walls, and ceilings",
    "paint\ninterior   walls",
    "“spray” guns",
    "‘spray’ guns",
    "a client’s house",
    "a clients house",
    "Paint interior walls ... of buildings",
    "Paint interior walls…of buildings",
    "…ceilings of buildings.",
  ])
    assert.equal(found(quote), true, quote);
  for (const quote of [
    "paint office ceilings",
    "paint interior wall",
    "Paint interior walls ... before painting",
    "rollers or brushes",
  ])
    assert.equal(found(quote), false, quote);
  assert.equal(quoteFoundInDescriptions("anything at all", []), false);
});

test("a well-formed judgment passes validation", () => {
  assert.deepEqual(validate({ issues: [], summary: "No issues found." }), { errors: [], warnings: [] });
  const issues = JUDGE_RULES.flatMap((rule) =>
    RULE_SEVERITIES[rule].map((severity) =>
      issue({ rule, severity, groupNumbers: [2, 1], descriptionNumbers: [], evidenceQuote: "Paint interior walls" }),
    ),
  );
  assert.deepEqual(validate({ issues, summary: "Several possible problems." }), { errors: [], warnings: [] });
});

test("judgments without an issues list and a summary are rejected as a whole", () => {
  for (const judgment of [
    null,
    undefined,
    "No issues.",
    [],
    { issues: [] },
    { summary: "None." },
    { issues: {}, summary: "None." },
    { issues: [], summary: 3 },
  ])
    assert.deepEqual(validate(judgment), {
      errors: ["The judgment does not have an issues list and a summary."],
      warnings: [],
    });
});

test("judgment validation reports each broken rule", () => {
  const errors = (judgment, answer) => validate(judgment, answer).errors;
  const one = (overrides) => errors({ issues: [issue(overrides)], summary: "One problem." });
  const { evidenceQuote, ...withoutQuote } = issue();
  assert.equal(evidenceQuote, "");
  for (const bad of [
    null,
    "issue",
    withoutQuote,
    issue({ rule: "verb-change" }),
    issue({ severity: "critical" }),
    issue({ groupNumbers: 1 }),
    issue({ descriptionNumbers: undefined }),
    issue({ evidenceQuote: null }),
    issue({ explanation: 5 }),
  ])
    assert.deepEqual(errors({ issues: [bad], summary: "One problem." }), ["Issue 1 is malformed."]);
  assert.deepEqual(errors({ issues: [issue({ replacementTitle: "Paint Rooms" })], summary: "s", verdict: "major" }), [
    "Unexpected field “verdict”.",
    "Issue 1 has unexpected field “replacementTitle”.",
  ]);
  for (const rule of JUDGE_RULES)
    for (const severity of JUDGE_SEVERITIES)
      assert.deepEqual(
        one({ rule, severity }),
        RULE_SEVERITIES[rule].includes(severity) ? [] : [`Issue 1 uses ${severity} with the ${rule} rule.`],
        `${rule} ${severity}`,
      );
  assert.deepEqual(RULE_SEVERITIES, {
    "same-activity": ["prompt-violation", "major"],
    "supported-detail": ["major", "minor"],
    grouping: ["major", "minor"],
    clarity: ["major", "minor"],
  });
  assert.deepEqual(one({ groupNumbers: [] }), ["Issue 1 cites no group."]);
  assert.deepEqual(one({ groupNumbers: [0, 3, 1.5] }), [
    "Issue 1 cites unknown group 0.",
    "Issue 1 cites unknown group 3.",
    "Issue 1 cites unknown group 1.5.",
  ]);
  assert.deepEqual(one({ descriptionNumbers: [4, 0, 2.5] }), [
    "Issue 1 cites unknown description 4.",
    "Issue 1 cites unknown description 0.",
    "Issue 1 cites unknown description 2.5.",
  ]);
  assert.deepEqual(one({ groupNumbers: [1, 1], descriptionNumbers: [2, 2] }), [
    "Issue 1 repeats a group number.",
    "Issue 1 repeats a description number.",
  ]);
  assert.deepEqual(one({ explanation: "  " }), ["Issue 1 has no explanation."]);
  assert.deepEqual(errors({ issues: [], summary: " \n " }), ["The summary is empty."]);
  assert.deepEqual(errors({ issues: [issue(), issue({ groupNumbers: [5] })], summary: "Two." }), [
    "Issue 2 cites unknown group 5.",
  ]);
  const singleGroup = { groups: [group("Paint Walls", [1, 2, 3])], reason: "" };
  assert.deepEqual(errors({ issues: [issue()], summary: "One." }, singleGroup), []);
  assert.deepEqual(errors({ issues: [issue({ groupNumbers: [2] })], summary: "One." }, singleGroup), [
    "Issue 1 cites unknown group 2.",
  ]);
});

test("an unmatched evidence quote is a warning, not a rejection", () => {
  assert.deepEqual(validate({ issues: [issue({ evidenceQuote: "paint office ceilings" })], summary: "One." }), {
    errors: [],
    warnings: ["Issue 1 quotes words that were not found in the linked descriptions."],
  });
  assert.deepEqual(
    validate({ issues: [issue({ evidenceQuote: "“Spray” guns" }), issue({ evidenceQuote: "Paint the ... house" })], summary: "Two." }),
    { errors: [], warnings: [] },
  );
  assert.deepEqual(
    validate({
      issues: [issue({ evidenceQuote: "rollers" }), issue({ evidenceQuote: "brushes", groupNumbers: [3] })],
      summary: "Two.",
    }),
    {
      errors: ["Issue 2 cites unknown group 3."],
      warnings: ["Issue 2 quotes words that were not found in the linked descriptions."],
    },
  );
});

test("the most severe finding orders prompt violation, major, minor, then no issues", () => {
  const of = (...severities) => mostSevere(severities.map((severity) => ({ severity })));
  assert.equal(mostSevere([]), "no-issues");
  assert.equal(of("minor"), "minor");
  assert.equal(of("minor", "major", "minor"), "major");
  assert.equal(of("major", "minor", "prompt-violation"), "prompt-violation");
  assert.equal(of("prompt-violation", "major"), "prompt-violation");
  assert.equal(of("note"), "no-issues");
});

test("request ids are stable short hashes that do not reveal the answer id", () => {
  const id = judgeRequestId("case-3", "sol");
  assert.match(id, /^[a-f0-9]{16}$/);
  // The case id and answer id are joined with a NUL character.
  assert.equal(id, sha256("case-3\u0000sol").slice(0, 16));
  assert.equal(judgeRequestId("case-3", "sol"), id);
  assert.notEqual(judgeRequestId("case-3", "terra"), id);
  assert.notEqual(judgeRequestId("case-4", "sol"), id);
  assert.doesNotMatch(id, /sol|case/);
});

const answerFor = (caseId, modelId, groups, status = "completed") => ({
  caseId,
  modelId,
  status,
  groups,
  reason: groups.length ? "Overall reason." : "",
  observations: [],
});
const syntheticStudy = () => ({
  version: "synthetic-study-v1",
  prompt: "Clarify each title.",
  clarification: "About 5–9 descriptions per new group.\n",
  cases: [paintWalls, reviewProgramming],
  answers: [
    answerFor("case-1", "one", cleanAnswer.groups),
    answerFor("case-1", "two", [group("Coat Walls", [1, 2, 3])]),
    answerFor("case-1", "three", [group("Paint Interior Walls", [1, 2]), group("Paint Exterior Walls", [2, 3])]),
    answerFor("case-1", "four", [], "format-invalid"),
    answerFor("case-2", "one", [group("Review Broadcast Programming", [1])]),
    answerFor("case-2", "two", [group("Review Programming", [1])]),
    answerFor("case-2", "three", [group("Review Programming", [1])]),
    answerFor("case-2", "four", [group("Review Programming", [1])]),
    answerFor("case-2", "five", [group("Review Programming", [1])], "failed"),
    answerFor("case-2", "six", [], "completed"),
  ],
});

test("judge requests cover only completed answers with groups and reject duplicates", () => {
  const study = syntheticStudy();
  const requests = prepareTitleJudgeRequests(study);
  assert.deepEqual(
    requests.map((r) => [r.caseId, r.answerId]),
    [
      ["case-1", "one"],
      ["case-1", "two"],
      ["case-1", "three"],
      ["case-2", "one"],
      ["case-2", "two"],
      ["case-2", "three"],
      ["case-2", "four"],
    ],
  );
  for (const request of requests) {
    const answer = study.answers.find((a) => a.caseId === request.caseId && a.modelId === request.answerId);
    assert.equal(request.requestId, judgeRequestId(request.caseId, request.answerId));
    assert.equal(request.answer, answer);
    assert.equal(request.item, study.cases.find((c) => c.id === request.caseId));
    const built = buildTitleJudgeRequest({ study, item: request.item, answer });
    for (const field of ["system", "user", "schema", "requestSha256"]) assert.deepEqual(request[field], built[field]);
  }
  assert.equal(new Set(requests.map((r) => r.requestId)).size, requests.length);
  const duplicated = syntheticStudy();
  duplicated.answers.push(answerFor("case-2", "four", [group("Review Programming Quality", [1])]));
  assert.throws(() => prepareTitleJudgeRequests(duplicated), { message: "Duplicate judge request for case-2 four." });
  const unknownCase = syntheticStudy();
  unknownCase.answers.push(answerFor("case-9", "one", [group("Review Programming", [1])]));
  assert.throws(() => prepareTitleJudgeRequests(unknownCase), { message: "Unknown case case-9." });
});

test("ingestion records every status and computes the verdict in software", () => {
  const study = syntheticStudy();
  const requests = prepareTitleJudgeRequests(study);
  const request = (caseId, answerId) => requests.find((r) => r.caseId === caseId && r.answerId === answerId);
  const response = (caseId, answerId, rawText, requestSha256 = request(caseId, answerId).requestSha256) => [
    request(caseId, answerId).requestId,
    { requestSha256, rawText },
  ];
  const noIssues = JSON.stringify({ issues: [], summary: "No issues found." });
  const minorClarity = JSON.stringify({
    issues: [issue({ rule: "clarity", severity: "minor", groupNumbers: [1], descriptionNumbers: [] })],
    summary: "The title is broad.",
  });
  const majorGrouping = JSON.stringify({
    issues: [
      issue({ severity: "major", groupNumbers: [1, 2], descriptionNumbers: [2], evidenceQuote: "paint office ceilings" }),
    ],
    summary: "The groups overlap.",
  });
  const wrongSeverity = JSON.stringify({
    issues: [issue({ rule: "same-activity", severity: "minor", descriptionNumbers: [1] })],
    summary: "Mislabelled.",
  });
  const execution = { runner: "Synthetic runner", model: "judge-model", runDate: "2026-09-16" };
  const responses = Object.fromEntries([
    response("case-1", "one", noIssues),
    response("case-1", "two", minorClarity),
    response("case-1", "three", majorGrouping),
    response("case-2", "two", noIssues, "0".repeat(64)),
    response("case-2", "three", "Issues: none"),
    response("case-2", "four", wrongSeverity),
    ["unmatched-request", { requestSha256: "1".repeat(64), rawText: noIssues }],
  ]);
  const results = ingestTitleJudgments({ study, responses, execution });

  assert.equal(results.schemaVersion, "title-clarification-judge-results-v1");
  assert.deepEqual(results.judge, {
    ...TITLE_JUDGE,
    instructions: titleJudgeInstructions,
    instructionsSha256: sha256(titleJudgeInstructions),
    schema: titleJudgeResponseSchema,
    validationRules: judgeValidationRules,
    softwareChecks: softwareJudgeChecks,
    libraryFingerprint: judgeLibraryFingerprint,
  });
  assert.equal(results.studyVersion, "synthetic-study-v1");
  assert.equal(results.execution, execution);
  assert.deepEqual(results.unjudgedAnswers, [
    { caseId: "case-1", answerId: "four", status: "format-invalid" },
    { caseId: "case-2", answerId: "five", status: "failed" },
    { caseId: "case-2", answerId: "six", status: "completed" },
  ]);
  assert.deepEqual(results.unmatchedResponses, ["unmatched-request"]);
  assert.deepEqual(
    results.judgments.map((j) => [j.caseId, j.answerId, j.status, j.modelVerdict, j.verdict]),
    [
      ["case-1", "one", "valid", "no-issues", "no-issues"],
      ["case-1", "two", "valid", "minor", "prompt-violation"],
      ["case-1", "three", "valid", "major", "major"],
      ["case-2", "one", "missing", null, null],
      ["case-2", "two", "stale", null, null],
      ["case-2", "three", "unparseable", null, null],
      ["case-2", "four", "invalid", null, null],
    ],
  );
  for (const [index, judgment] of results.judgments.entries()) {
    assert.equal(judgment.requestId, requests[index].requestId);
    assert.equal(judgment.requestSha256, requests[index].requestSha256);
    assert.deepEqual(
      judgment.softwareFindings,
      softwareTitleFindings({ item: requests[index].item, answer: requests[index].answer }),
    );
    assert.equal("judgment" in judgment, judgment.status === "valid");
    assert.equal("rawText" in judgment, judgment.status !== "missing");
    if (judgment.status !== "missing") assert.equal(judgment.rawText, responses[judgment.requestId].rawText);
  }
  const [clean, verbChange, overlap, missing, stale, unparseable, invalid] = results.judgments;
  assert.deepEqual(clean.softwareFindings, []);
  assert.deepEqual(clean.judgment, JSON.parse(noIssues));
  assert.deepEqual([clean.validationErrors, clean.warnings], [[], []]);
  assert.deepEqual(verbChange.softwareFindings.map((f) => [f.check, f.severity]), [["initial-verb", "prompt-violation"]]);
  assert.deepEqual(verbChange.judgment, JSON.parse(minorClarity));
  assert.deepEqual(overlap.softwareFindings.map((f) => [f.check, f.severity]), [["description-coverage", "minor"]]);
  assert.deepEqual(overlap.warnings, ["Issue 1 quotes words that were not found in the linked descriptions."]);
  assert.deepEqual(overlap.validationErrors, []);
  assert.deepEqual(missing.validationErrors, ["No judgment was recorded for this request."]);
  assert.deepEqual(stale.validationErrors, ["The judgment was produced for a different request."]);
  assert.deepEqual(unparseable.validationErrors, ["The judgment is not valid JSON."]);
  assert.deepEqual(invalid.validationErrors, ["Issue 1 uses minor with the same-activity rule."]);
  for (const unavailable of [missing, stale, unparseable, invalid]) assert.deepEqual(unavailable.warnings, []);
  assert.deepEqual(JSON.parse(JSON.stringify(results)), results);

  const empty = () => ({
    valid: 0,
    missing: 0,
    stale: 0,
    unparseable: 0,
    invalid: 0,
    warnings: 0,
    "prompt-violation": 0,
    major: 0,
    minor: 0,
    "no-issues": 0,
    byRule: { "same-activity": 0, "supported-detail": 0, grouping: 0, clarity: 0 },
  });
  const summary = summarizeTitleJudgments(results);
  assert.deepEqual(summary, {
    one: { ...empty(), valid: 1, missing: 1, "no-issues": 1 },
    two: { ...empty(), valid: 1, stale: 1, "prompt-violation": 1, byRule: { ...empty().byRule, clarity: 1 } },
    three: { ...empty(), valid: 1, unparseable: 1, warnings: 1, major: 1, byRule: { ...empty().byRule, grouping: 1 } },
    four: { ...empty(), invalid: 1 },
  });
});

test("the model-comparison archive preserves the prompt, clarification, and September 14 inputs", () => {
  const comparison = readJson(dir + "comparison.json");
  const earlier = readJson(root + "prompt-study-2026-09-14/bundle.json");
  assert.equal(comparison.prompt, fs.readFileSync(dir + "prompt.txt", "utf8"));
  assert.equal(comparison.clarification, fs.readFileSync(dir + "clarification.txt", "utf8"));
  assert.equal(sha256(comparison.prompt), comparison.promptSha256);
  assert.equal(sha256(comparison.clarification), comparison.clarificationSha256);
  assert.equal(comparison.inputsFrom, earlier.version);
  assert.equal(comparison.sourceSha256, earlier.sourceSha256);
  assert.equal(comparison.cases.length, 18);
  assert.equal(earlier.cases.length, 18);
  for (const [index, item] of comparison.cases.entries()) {
    const source = earlier.cases[index];
    for (const field of ["id", "title", "originalTitle", "input", "inputSha256"])
      assert.equal(item[field], source[field], `${item.id} ${field}`);
    assert.deepEqual(item.descriptions, source.descriptions);
    assert.equal(sha256(item.input), item.inputSha256);
  }
});

test("each example assigns the four letters to the four models", () => {
  const comparison = readJson(dir + "comparison.json");
  const modelIds = comparison.models.map((model) => model.id);
  assert.deepEqual([...modelIds].sort(), ["astra", "mini", "sol", "terra"]);
  for (const item of comparison.cases) {
    assert.deepEqual(Object.keys(item.letters).sort(), ["A", "B", "C", "D"], item.id);
    assert.deepEqual(Object.values(item.letters).sort(), [...modelIds].sort(), item.id);
  }
});

test("the archive keeps one raw answer per example and model and reproduces its software checks", () => {
  const comparison = readJson(dir + "comparison.json");
  const modelIds = comparison.models.map((model) => model.id);
  assert.equal(comparison.answers.length, 72);
  const keys = comparison.answers.map((answer) => `${answer.caseId} ${answer.modelId}`);
  assert.equal(new Set(keys).size, 72);
  for (const item of comparison.cases)
    for (const modelId of modelIds) assert.ok(keys.includes(`${item.id} ${modelId}`), `${item.id} ${modelId}`);
  const cases = new Map(comparison.cases.map((item) => [item.id, item]));
  for (const answer of comparison.answers) {
    const label = `${answer.caseId} ${answer.modelId}`;
    assert.equal(sha256(answer.rawOutput), answer.outputSha256, label);
    const item = cases.get(answer.caseId);
    const checked = inspectLatestTitleAnswer(
      { title: item.title, descriptions: item.descriptions },
      answer.rawOutput,
      "completed",
    );
    for (const field of ["groups", "reason", "observations", "status"])
      assert.deepEqual(checked[field], answer[field], `${label} ${field}`);
  }
  for (const model of comparison.models) {
    const answers = comparison.answers.filter((answer) => answer.modelId === model.id);
    assert.equal(model.completed, answers.filter((answer) => answer.status === "completed").length, model.id);
    assert.equal(model.groupCount, answers.reduce((sum, answer) => sum + answer.groups.length, 0), model.id);
  }
});

test("the prepared judge requests for the archive do not reveal models, letters, or options", () => {
  const comparison = readJson(dir + "comparison.json");
  const requests = prepareTitleJudgeRequests(comparison);
  assert.equal(requests.length, 72);
  assert.equal(new Set(requests.map((request) => request.requestId)).size, 72);
  const names = comparison.models.flatMap((model) => [model.label, model.model]).map((name) => name.toLowerCase());
  for (const request of requests) {
    const text = `${request.system}\n${request.user}`;
    assert.doesNotMatch(text, /\b(astra|sol|terra|mini)\b|\bgpt\b|\boption [a-d]\b/i, request.requestId);
    for (const name of names) assert.ok(!text.toLowerCase().includes(name), `${request.requestId} ${name}`);
    assert.ok(!request.requestId.includes(request.answerId));
  }
});

test("committed judge results are exactly what ingestion produces from their recorded responses", () => {
  const comparison = readJson(dir + "comparison.json");
  // judge-results.json is shown on the page; any additional committed run
  // (for example judge-results-run-2.json) must meet the same standard.
  const files = fs.readdirSync(dir).filter((file) => /^judge-results.*\.json$/.test(file));
  assert.ok(files.includes("judge-results.json"));
  for (const file of files) {
    const results = readJson(dir + file);
    assert.equal(results.judge.libraryFingerprint, judgeLibraryFingerprint, file);
    assert.equal(results.judge.instructions, titleJudgeInstructions, file);
    assert.equal(results.studyVersion, comparison.version, file);
    // Responses are rebuilt from the recorded raw text. A stale response was,
    // by definition, recorded for a different request hash, and unmatched
    // response ids have no judgment entry; both are carried through so that
    // they reproduce too.
    const responses = Object.fromEntries([
      ...results.judgments
        .filter((judgment) => judgment.rawText !== undefined)
        .map((judgment) => [
          judgment.requestId,
          {
            requestSha256: judgment.status === "stale" ? `stale:${judgment.requestSha256}` : judgment.requestSha256,
            rawText: judgment.rawText,
          },
        ]),
      ...results.unmatchedResponses.map((id) => [id, { requestSha256: "", rawText: "" }]),
    ]);
    assert.deepEqual(
      ingestTitleJudgments({ study: comparison, responses, execution: results.execution }),
      results,
      file,
    );
  }
});
