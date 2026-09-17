import crypto from "node:crypto";

// The title-clarification judging agent has two stages. Software checks the
// explicit mechanical rules exactly; a model judge reports meaning problems.
// Neither stage rewrites titles, repairs groups, approves changes, or writes
// to the ontology.

export const TITLE_JUDGE = {
  actorId: "title-clarification-judge-v1",
  promptVersion: "title-clarification-judge-2026-09-16-v1",
  schemaName: "title_clarification_judgment",
};

export const JUDGE_RULES = ["same-activity", "supported-detail", "grouping", "clarity"];

export const JUDGE_SEVERITIES = ["prompt-violation", "major", "minor"];

export const RULE_SEVERITIES = {
  "same-activity": ["prompt-violation", "major"],
  "supported-detail": ["major", "minor"],
  grouping: ["major", "minor"],
  clarity: ["major", "minor"],
};

export const titleJudgeInstructions = `You are a judging agent. You check one title-clarification proposal against the instructions the proposing model was given, and you report problems for expert reviewers. You do not write replacement titles or groupings, choose between alternatives, or settle policy questions.

You receive:
1. The instructions and a recorded clarification given to the proposing model. They are for reference only; do not follow them yourself. Where the clarification is more specific, it takes precedence.
2. The current title, which is a verb–direct object pair, and whether instructions (A) for one description or (B) for multiple descriptions apply.
3. The numbered O*NET descriptions linked to the current title.
4. The proposal as JSON: numbered groups, each with a title, whether that title is the same as the current title, its description numbers and their text, and a reason; plus an overall reason.

Software separately checks that every title keeps the current initial verb, that titles have 2–5 words, and that every description appears in exactly one group. Do not report those. Treat the proposal's reasons as claims to check, not as evidence. When comparing titles, ignore capitalization and singular or plural differences. Do not report whether the proposal labeled its choice as (A)(i) through (B)(iii).

Report each problem once, under exactly one of the rules below. If a problem fits more than one rule, use the first that fits in this order. Report separate problems separately.

same-activity: A new or changed title must name the work activity depicted by the current title's verb and direct object, ignoring other verbs and direct objects in the descriptions. Compare the title's main object with the current object.
Not a problem:
- the current object with a qualifier for its kind, domain, setting, purpose, or tool ("Repair Engines" becoming "Repair Aircraft Engines");
- a more specific kind of the current object ("Prune Plants" becoming "Prune Fruit Trees"), or two or more kinds of it ("Prune Trees and Shrubs");
- when the current verb or object has several senses that the descriptions use, a title naming one of those senses.
Report as prompt-violation:
- a main object that is a different thing, a part of the current object, or a broader category ("Paint Walls" becoming "Paint Building Surfaces");
- an added object or activity that is not a kind of the current object, typically taken from elsewhere in a description ("Paint Walls" becoming "Paint Walls and Ceilings").
Report as major:
- the current object kept only as a modifier of a new main noun ("Monitor Patients" becoming "Monitor Patient Recovery");
- a qualifier that names a separate action the worker performs ("Paint Walls After Sanding").

supported-detail: Every word a new or changed title adds, and every more specific kind it names, must be stated in or follow plainly from the descriptions in its group. Report an unsupported addition, or a title narrower than a description in its group when no other group's title covers that description. Use major if it would mislead a reader about the work, and minor if it is plausible but not clearly supported.

grouping: Applies only when there are multiple descriptions. Compare descriptions by the kind of the title's activity they depict; differences only in their other verbs, objects, or wording do not make them different kinds. Report:
- a group that keeps clearly different kinds of the activity together without a strong reason, including a proposal that keeps every description in one group (major when the kinds are clearly different and numerous, otherwise minor);
- a description whose group title does not describe it while another group's title does (major);
- a split that separates identical or nearly identical descriptions, or whose groups differ only in the descriptions' other verbs or objects (minor, or major if it misleads);
- two groups whose titles do not tell them apart (minor);
- a newly created group far outside approximately 5–9 descriptions when the reasons give no strong reason (minor). Identical descriptions are a strong reason for a larger group. Never report a single-group proposal for its size.
How much subject detail is useful is partly a policy decision, so do not report a reasonable grouping merely because a finer or coarser grouping would also be reasonable.

clarity: A kept or new title should give a non-expert a clear, intuitive, and specific sense of the activity. Report a title that is ambiguous, uses jargon, or is so general that it is easily misread, when the descriptions support a clearer title of 2–5 words that keeps the initial verb. Use major if a non-expert would likely misunderstand the work, and minor otherwise. Do not report unclarity that only a different verb could fix. Report as minor a changed title when the current title was already clear and the change adds nothing a non-expert needs. Do not report a title merely because another acceptable wording exists.

Severities: prompt-violation means an explicit instruction is broken; major means the proposal is probably unacceptable as written; minor means a reviewer may reasonably accept it. same-activity issues are prompt-violation or major; supported-detail, grouping, and clarity issues are major or minor.

Return only one JSON object, with no other text:
- issues: a list. Each issue has rule; severity; groupNumbers (the groupNumber values it concerns: at least one, each listed once); descriptionNumbers (the O*NET description numbers involved, each listed once, or an empty list when none in particular); evidenceQuote (an empty string, or a short phrase copied word for word from one O*NET description, without quotation marks or ellipses); and explanation (one or two plain sentences).
- summary: one or two plain sentences stating the overall finding. If there are no issues, return an empty issues list and say so.
Judge only this proposal. Do not mention other proposals, models, or costs.`;

export const titleJudgeResponseSchema = {
  type: "json_schema",
  name: TITLE_JUDGE.schemaName,
  strict: true,
  schema: {
    type: "object",
    properties: {
      issues: {
        type: "array",
        items: {
          type: "object",
          properties: {
            rule: { type: "string", enum: JUDGE_RULES },
            severity: { type: "string", enum: JUDGE_SEVERITIES },
            groupNumbers: {
              type: "array",
              description: "groupNumber values from the proposal JSON, never description numbers.",
              items: { type: "integer" },
            },
            descriptionNumbers: {
              type: "array",
              description: "O*NET description numbers involved; empty when none in particular.",
              items: { type: "integer" },
            },
            evidenceQuote: { type: "string" },
            explanation: { type: "string" },
          },
          required: [
            "rule",
            "severity",
            "groupNumbers",
            "descriptionNumbers",
            "evidenceQuote",
            "explanation",
          ],
          additionalProperties: false,
        },
      },
      summary: { type: "string" },
    },
    required: ["issues", "summary"],
    additionalProperties: false,
  },
};

export const judgeValidationRules =
  "Software accepts a model judgment only if it is one JSON object with an issues list and a non-empty summary; every issue uses a listed rule with a severity allowed for that rule, cites at least one existing group and only existing descriptions, lists no number twice, and has an explanation. An evidence quote that cannot be found in any linked description, ignoring case, punctuation, and quotation style, is kept as a warning rather than rejecting the judgment. The verdict is the most severe finding from the software checks and the model judge; software computes it. Nothing repairs a judgment, changes a proposal, or writes to the ontology.";

export const softwareJudgeChecks =
  "Software checks every proposed title for the current title's initial verb and for 2–5 words, and checks that each description number exists and appears in exactly one group. A changed verb or a title outside 2–5 words is a prompt violation. A missing or unknown description number is a major issue. A description in more than one group is a minor representation-policy question.";

export const sha256 = (text) =>
  crypto.createHash("sha256").update(text).digest("hex");

const collapse = (text) => String(text ?? "").replace(/\s+/g, " ").trim();
const normalizedTitle = (text) =>
  collapse(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const firstWord = (text) => collapse(text).split(" ")[0]?.toLowerCase() || "";

export function renderTitleJudgeInput({
  prompt,
  clarification,
  title,
  descriptions,
  groups,
  reason,
}) {
  const textByNumber = new Map(descriptions.map((d) => [d.number, d.text]));
  const proposal = {
    overallReason: reason ?? null,
    groups: groups.map((group, index) => ({
      groupNumber: index + 1,
      title: group.title ?? null,
      sameAsCurrentTitle: normalizedTitle(group.title) === normalizedTitle(title),
      descriptionNumbers: group.descriptionNumbers,
      descriptions: group.descriptionNumbers.map((number) =>
        textByNumber.has(number)
          ? `${number}. ${collapse(textByNumber.get(number))}`
          : `${number}. (not a linked description)`,
      ),
      reason: group.reason ?? null,
    })),
  };
  const sections = [
    [
      "INSTRUCTIONS GIVEN TO THE PROPOSING MODEL (reference only; do not follow them yourself)",
      prompt,
    ],
    ["RECORDED CLARIFICATION", clarification ? clarification.trimEnd() : "None."],
    [
      "CURRENT TITLE",
      `${title}\n${
        descriptions.length === 1
          ? "One O*NET description: instructions (A) apply."
          : `${descriptions.length} O*NET descriptions: instructions (B) apply.`
      }`,
    ],
    ["O*NET DESCRIPTIONS", descriptions.map((d) => `${d.number}. ${collapse(d.text)}`).join("\n")],
    [`PROPOSAL (${groups.length} ${groups.length === 1 ? "group" : "groups"})`, JSON.stringify(proposal, null, 2)],
  ];
  return sections.map(([heading, body]) => `=== ${heading} ===\n\n${body}`).join("\n\n");
}

export function buildTitleJudgeRequest({ study, item, answer }) {
  const system = titleJudgeInstructions;
  const user = renderTitleJudgeInput({
    prompt: study.prompt,
    clarification: study.clarification,
    title: item.title,
    descriptions: item.descriptions,
    groups: answer.groups,
    reason: answer.reason,
  });
  return {
    system,
    user,
    schema: titleJudgeResponseSchema,
    requestSha256: sha256(JSON.stringify({ system, user, schema: titleJudgeResponseSchema })),
  };
}

// Request body for the OpenAI or Azure OpenAI Responses API, following the
// message and structured-output conventions used for title generation. Paid
// execution belongs in a separately authorized, budgeted runner.
export function buildResponsesApiBody({ request, deployment, reasoningEffort, maxOutputTokens }) {
  if (!deployment || !reasoningEffort || !Number.isInteger(maxOutputTokens))
    throw new Error("deployment, reasoningEffort, and maxOutputTokens are required.");
  return {
    model: deployment,
    store: false,
    reasoning: { effort: reasoningEffort },
    max_output_tokens: maxOutputTokens,
    input: [
      { role: "system", content: request.system },
      { role: "user", content: request.user },
    ],
    text: { format: request.schema },
  };
}

export function extractResponsesOutputText(payload) {
  if (payload?.status !== "completed") {
    const reason = payload?.incomplete_details?.reason;
    throw new Error(`Response status ${payload?.status}${reason ? ` (${reason})` : ""}.`);
  }
  const parts = (payload.output || [])
    .filter((item) => item?.type === "message")
    .flatMap((item) => item.content || []);
  const refusal = parts.find((part) => part?.type === "refusal");
  if (refusal) throw new Error(`The model refused: ${refusal.refusal}`);
  const texts = parts.filter((part) => part?.type === "output_text").map((part) => part.text);
  if (texts.length !== 1) throw new Error(`Expected one output_text part, received ${texts.length}.`);
  return texts[0];
}

// Exact software checks. Group numbers are 1-based positions in the proposal.
export function softwareTitleFindings({ item, answer }) {
  const findings = [];
  const verb = firstWord(item.title);
  const known = new Set(item.descriptions.map((d) => d.number));
  const membership = new Map();
  answer.groups.forEach((group, index) => {
    const groupNumber = index + 1;
    const words = collapse(group.title).split(" ").filter(Boolean);
    if (firstWord(group.title) !== verb)
      findings.push({
        check: "initial-verb",
        severity: "prompt-violation",
        groupNumbers: [groupNumber],
        descriptionNumbers: [],
        explanation: `“${group.title}” does not begin with the current verb “${collapse(item.title).split(" ")[0]}”.`,
      });
    if (words.length < 2 || words.length > 5)
      findings.push({
        check: "title-length",
        severity: "prompt-violation",
        groupNumbers: [groupNumber],
        descriptionNumbers: [],
        explanation: `“${group.title}” has ${words.length} ${words.length === 1 ? "word" : "words"}, outside 2–5.`,
      });
    for (const number of new Set(group.descriptionNumbers)) {
      if (!known.has(number))
        findings.push({
          check: "description-coverage",
          severity: "major",
          groupNumbers: [groupNumber],
          descriptionNumbers: [number],
          explanation: `“${group.title}” cites description ${number}, which is not linked to this title.`,
        });
      else membership.set(number, [...(membership.get(number) || []), groupNumber]);
    }
  });
  for (const description of item.descriptions) {
    const groups = membership.get(description.number) || [];
    if (!groups.length)
      findings.push({
        check: "description-coverage",
        severity: "major",
        groupNumbers: [],
        descriptionNumbers: [description.number],
        explanation: `Description ${description.number} is not in any group.`,
      });
    else if (groups.length > 1)
      findings.push({
        check: "description-coverage",
        severity: "minor",
        groupNumbers: groups,
        descriptionNumbers: [description.number],
        explanation: `Description ${description.number} is in more than one group, a representation-policy question.`,
      });
  }
  return findings;
}

const foldForQuote = (text) =>
  ` ${String(text ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’‚‛′`']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()} `;

export function quoteFoundInDescriptions(quote, descriptions) {
  const fragments = String(quote ?? "")
    .split(/\.{3}|…/)
    .map(foldForQuote)
    .filter((fragment) => fragment.trim());
  if (!fragments.length) return true;
  return descriptions.some((d) => {
    const haystack = foldForQuote(d.text);
    return fragments.every((fragment) => haystack.includes(fragment));
  });
}

export function validateTitleJudgment({ item, answer, judgment }) {
  const errors = [];
  const warnings = [];
  const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  if (!isObject(judgment) || !Array.isArray(judgment.issues) || typeof judgment.summary !== "string")
    return { errors: ["The judgment does not have an issues list and a summary."], warnings };
  for (const key of Object.keys(judgment))
    if (!["issues", "summary"].includes(key)) errors.push(`Unexpected field “${key}”.`);
  if (!judgment.summary.trim()) errors.push("The summary is empty.");
  const groupCount = answer.groups.length;
  const known = new Set(item.descriptions.map((d) => d.number));
  const issueFields = ["rule", "severity", "groupNumbers", "descriptionNumbers", "evidenceQuote", "explanation"];
  judgment.issues.forEach((issue, index) => {
    const label = `Issue ${index + 1}`;
    if (
      !isObject(issue) ||
      !JUDGE_RULES.includes(issue.rule) ||
      !JUDGE_SEVERITIES.includes(issue.severity) ||
      !Array.isArray(issue.groupNumbers) ||
      !Array.isArray(issue.descriptionNumbers) ||
      typeof issue.evidenceQuote !== "string" ||
      typeof issue.explanation !== "string"
    ) {
      errors.push(`${label} is malformed.`);
      return;
    }
    for (const key of Object.keys(issue))
      if (!issueFields.includes(key)) errors.push(`${label} has unexpected field “${key}”.`);
    if (!RULE_SEVERITIES[issue.rule].includes(issue.severity))
      errors.push(`${label} uses ${issue.severity} with the ${issue.rule} rule.`);
    if (!issue.explanation.trim()) errors.push(`${label} has no explanation.`);
    if (!issue.groupNumbers.length) errors.push(`${label} cites no group.`);
    if (new Set(issue.groupNumbers).size !== issue.groupNumbers.length)
      errors.push(`${label} repeats a group number.`);
    for (const number of issue.groupNumbers)
      if (!Number.isInteger(number) || number < 1 || number > groupCount)
        errors.push(`${label} cites unknown group ${number}.`);
    if (new Set(issue.descriptionNumbers).size !== issue.descriptionNumbers.length)
      errors.push(`${label} repeats a description number.`);
    for (const number of issue.descriptionNumbers)
      if (!Number.isInteger(number) || !known.has(number))
        errors.push(`${label} cites unknown description ${number}.`);
    if (issue.evidenceQuote.trim() && !quoteFoundInDescriptions(issue.evidenceQuote, item.descriptions))
      warnings.push(`${label} quotes words that were not found in the linked descriptions.`);
  });
  return { errors, warnings };
}

const SEVERITY_ORDER = ["prompt-violation", "major", "minor"];

export function mostSevere(findings) {
  const present = new Set(findings.map((finding) => finding.severity));
  return SEVERITY_ORDER.find((severity) => present.has(severity)) || "no-issues";
}

export function judgeRequestId(caseId, answerId) {
  return sha256(`${caseId}\u0000${answerId}`).slice(0, 16);
}

// One request for every completed proposal with readable groups. Proposals
// that failed the format check are listed separately rather than judged.
export function prepareTitleJudgeRequests(study) {
  const cases = new Map(study.cases.map((item) => [item.id, item]));
  const seen = new Set();
  return study.answers
    .filter((answer) => answer.status === "completed" && Array.isArray(answer.groups) && answer.groups.length > 0)
    .map((answer) => {
      const item = cases.get(answer.caseId);
      if (!item) throw new Error(`Unknown case ${answer.caseId}.`);
      const requestId = judgeRequestId(answer.caseId, answer.modelId);
      if (seen.has(requestId)) throw new Error(`Duplicate judge request for ${answer.caseId} ${answer.modelId}.`);
      seen.add(requestId);
      return {
        requestId,
        caseId: answer.caseId,
        answerId: answer.modelId,
        item,
        answer,
        ...buildTitleJudgeRequest({ study, item, answer }),
      };
    });
}

export const judgeLibraryFingerprint = sha256(
  JSON.stringify({
    judge: TITLE_JUDGE,
    instructions: titleJudgeInstructions,
    schema: titleJudgeResponseSchema,
    validationRules: judgeValidationRules,
    softwareChecks: softwareJudgeChecks,
    code: [
      renderTitleJudgeInput,
      softwareTitleFindings,
      quoteFoundInDescriptions,
      validateTitleJudgment,
      mostSevere,
    ].map(String),
  }),
);

// responses: { [requestId]: { requestSha256, rawText } }
export function ingestTitleJudgments({ study, responses, execution }) {
  const requests = prepareTitleJudgeRequests(study);
  const requestIds = new Set(requests.map((request) => request.requestId));
  const unmatchedResponses = Object.keys(responses).filter((id) => !requestIds.has(id));
  const judgments = requests.map((request) => {
    const software = softwareTitleFindings({ item: request.item, answer: request.answer });
    const base = {
      requestId: request.requestId,
      caseId: request.caseId,
      answerId: request.answerId,
      requestSha256: request.requestSha256,
      softwareFindings: software,
    };
    const unavailable = (status, message, extra = {}) => ({
      ...base,
      status,
      validationErrors: [message],
      warnings: [],
      modelVerdict: null,
      verdict: null,
      ...extra,
    });
    const response = responses[request.requestId];
    if (response === undefined) return unavailable("missing", "No judgment was recorded for this request.");
    if (response.requestSha256 !== request.requestSha256)
      return unavailable("stale", "The judgment was produced for a different request.", { rawText: response.rawText });
    let judgment;
    try {
      judgment = JSON.parse(response.rawText);
    } catch {
      return unavailable("unparseable", "The judgment is not valid JSON.", { rawText: response.rawText });
    }
    const { errors, warnings } = validateTitleJudgment({ item: request.item, answer: request.answer, judgment });
    if (errors.length)
      return { ...base, status: "invalid", validationErrors: errors, warnings, modelVerdict: null, verdict: null, rawText: response.rawText };
    const modelVerdict = mostSevere(judgment.issues);
    return {
      ...base,
      status: "valid",
      validationErrors: [],
      warnings,
      modelVerdict,
      verdict: mostSevere([...software, ...judgment.issues]),
      judgment,
      rawText: response.rawText,
    };
  });
  return {
    schemaVersion: "title-clarification-judge-results-v1",
    judge: {
      ...TITLE_JUDGE,
      instructions: titleJudgeInstructions,
      instructionsSha256: sha256(titleJudgeInstructions),
      schema: titleJudgeResponseSchema,
      validationRules: judgeValidationRules,
      softwareChecks: softwareJudgeChecks,
      libraryFingerprint: judgeLibraryFingerprint,
    },
    studyVersion: study.version,
    execution,
    unjudgedAnswers: study.answers
      .filter((answer) => !requests.some((r) => r.caseId === answer.caseId && r.answerId === answer.modelId))
      .map((answer) => ({ caseId: answer.caseId, answerId: answer.modelId, status: answer.status })),
    unmatchedResponses,
    judgments,
  };
}

export function summarizeTitleJudgments(results) {
  const summary = {};
  for (const entry of results.judgments) {
    const bucket = (summary[entry.answerId] ??= {
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
      byRule: Object.fromEntries(JUDGE_RULES.map((rule) => [rule, 0])),
    });
    bucket[entry.status] += 1;
    if (entry.status !== "valid") continue;
    bucket.warnings += entry.warnings.length;
    bucket[entry.verdict] += 1;
    for (const issue of entry.judgment.issues) bucket.byRule[issue.rule] += 1;
  }
  return summary;
}
