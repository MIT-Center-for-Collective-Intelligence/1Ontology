import {
  allCreationsDone,
  answerKey,
  creatorFor,
  dashboardFor,
  privateOptions,
  presentTask,
  progressFor,
  sessionFor,
  submitAnswer,
  validateStudy,
  ValidationDataset,
  ValidationState,
} from "../../../src/lib/titleValidation/engine";

const data: ValidationDataset = {
  version: "test-v1",
  scientificPrompt: "PRIVATE_PROMPT",
  provenance: {},
  cases: [1, 2, 3].map((i) => ({
    id: `c${i}`,
    nodeId: `n${i}`,
    currentTitle: `Original ${i}`,
    description: `Full source ${i}`,
    sourceId: String(i),
    outcome: i === 1 ? "Keep" : i === 2 ? "Clarify" : "Split",
    modelTitles: [`MODEL_SECRET_${i}`],
    modelReason: "PRIVATE_REASON",
  })),
};
const initial = (): ValidationState => ({
  study: {
    id: "study",
    datasetVersion: data.version,
    seed: "fixed-seed",
    status: "active",
    roster: ["a", "b", "c"].map((reviewerId) => ({
      reviewerId,
      label: reviewerId,
    })),
    caseIds: data.cases.map((c) => c.id),
    createdAt: 0,
  },
  answers: {},
  presentations: {},
});
const creation = (
  caseId: string,
  decision: "keep" | "clarify" | "split" = "clarify",
) => ({
  kind: "create",
  caseId,
  decision,
  titles:
    decision === "keep"
      ? []
      : decision === "split"
        ? ["Human first", "Human second"]
        : [`Human ${caseId}`],
  confidence: 3,
  notes: "",
  activeTimeMs: 100,
  submissionId: "submission-" + caseId,
});
function createdAll(keep = false) {
  let state = initial();
  for (const c of data.cases) {
    const uid = creatorFor(state.study, c.id);
    state = presentTask(state, data, uid, 1000);
    state = submitAnswer(
      state,
      data,
      uid,
      creation(c.id, keep ? "keep" : "clarify"),
      2000,
    ).state;
  }
  return state;
}
function evalPayload(state: ValidationState, caseId = "c2", uid = "a") {
  return {
    kind: "evaluate",
    caseId,
    ratings: privateOptions(state, data, caseId, uid).map((o) => ({
      optionId: o.id,
      adequacy: "adequate",
      rank: 1,
    })),
    cannotRank: false,
    confidence: 4,
    notes: "",
    activeTimeMs: 100,
    submissionId: "evaluation-" + caseId,
  };
}
test("creation delivery has no model output, outcome, reasons, sources or other reviewers", () => {
  const session = sessionFor(initial(), data, "a"),
    text = JSON.stringify(session);
  expect(session.task?.stage).toBe("create");
  expect(session.task?.currentTitle).toBe("Original 1");
  for (const secret of [
    "MODEL_SECRET",
    "PRIVATE_REASON",
    "PRIVATE_PROMPT",
    "modelTitles",
    "outcome",
    "sources",
    "roster",
  ])
    expect(text).not.toContain(secret);
});
test("unassigned users see no task and cannot submit", () => {
  const state = initial();
  expect(sessionFor(state, data, "outsider").phase).toBe("unassigned");
  expect(() =>
    submitAnswer(state, data, "outsider", creation("c1"), 2000),
  ).toThrow("not assigned");
});
test("three reviewers get exactly 33 creations and 66 evaluations in a 99-case configuration", () => {
  const d = {
    ...data,
    cases: Array.from({ length: 99 }, (_, i) => ({
      ...data.cases[0],
      id: `c${i}`,
    })),
  };
  const state = initial();
  state.study.caseIds = d.cases.map((c) => c.id);
  validateStudy(state.study, d);
  for (const uid of ["a", "b", "c"])
    expect(progressFor(state, uid)).toMatchObject({
      creationTotal: 33,
      evaluationTotal: 66,
    });
});
test("all independent creations finish before any comparison is disclosed", () => {
  let state = initial();
  state = presentTask(state, data, "a", 1000);
  state = submitAnswer(state, data, "a", creation("c1"), 2000).state;
  expect(sessionFor(state, data, "a").phase).toBe("waiting");
  expect(allCreationsDone(state)).toBe(false);
  expect(() => privateOptions(state, data, "c2", "a")).toThrow(
    "creation must finish",
  );
});
test("creators can never evaluate their own case", () => {
  const state = createdAll();
  expect(() => privateOptions(state, data, "c1", "a")).toThrow(
    "cannot evaluate",
  );
  expect(sessionFor(state, data, "a").task?.caseId).toBe("c2");
});
test("evaluation payload conceals source mapping and creator identity", () => {
  const session = sessionFor(createdAll(), data, "a"),
    text = JSON.stringify(session);
  expect(session.phase).toBe("evaluate");
  expect(session.task?.options).toHaveLength(3);
  for (const secret of [
    "sources",
    "modelReason",
    "outcome",
    "PRIVATE_REASON",
    "creatorId",
  ])
    expect(text).not.toContain(secret);
  expect(session.task?.options?.every((o) => /^[0-9a-f]{24}$/.test(o.id))).toBe(
    true,
  );
});
test("identical alternatives merge without losing their private provenance", () => {
  const d = {
    ...data,
    cases: data.cases.map((c) => ({ ...c, modelTitles: [c.currentTitle] })),
  };
  const state = createdAll(true);
  const options = privateOptions(state, d, "c2", "a");
  expect(options).toHaveLength(1);
  expect(options[0].sources).toEqual(["original", "model", "human"]);
});
test("the same split-title set in a different order is shown once", () => {
  const state = createdAll(),
    human = state.answers[answerKey("create", "c2", "b")];
  if (human.payload.kind !== "create") throw Error("fixture");
  human.payload.titles = ["Second", "First"];
  const d = {
    ...data,
    cases: data.cases.map((c) =>
      c.id === "c2" ? { ...c, modelTitles: ["First", "Second"] } : c,
    ),
  };
  const options = privateOptions(state, d, "c2", "a");
  expect(options).toHaveLength(2);
  expect(
    options.some(
      (o) => o.sources.includes("human") && o.sources.includes("model"),
    ),
  ).toBe(true);
});
test("option order is repeatable and differs between evaluators", () => {
  const state = createdAll();
  expect(privateOptions(state, data, "c1", "b")).toEqual(
    privateOptions(state, data, "c1", "b"),
  );
  expect(privateOptions(state, data, "c1", "b").map((o) => o.id)).not.toEqual(
    privateOptions(state, data, "c1", "c").map((o) => o.id),
  );
});
test("saving is idempotent and never overwrites an earlier submission", () => {
  const state = presentTask(initial(), data, "a", 1000),
    payload = creation("c1"),
    first = submitAnswer(state, data, "a", payload, 2000);
  const second = submitAnswer(first.state, data, "a", payload, 3000);
  expect(second.duplicate).toBe(true);
  expect(Object.values(second.state.answers)).toHaveLength(1);
  expect(() =>
    submitAnswer(
      first.state,
      data,
      "a",
      { ...payload, titles: ["Changed later"] },
      3000,
    ),
  ).toThrow("already submitted");
});
test("saving an unseen or non-current activity is rejected", () => {
  expect(() =>
    submitAnswer(initial(), data, "a", creation("c1"), 2000),
  ).toThrow("Open the assigned");
  expect(() =>
    submitAnswer(initial(), data, "a", creation("c2"), 2000),
  ).toThrow("not assigned");
});
test("invalid, blank, duplicated and excessive split titles are rejected", () => {
  const state = presentTask(initial(), data, "a", 1000),
    payload = creation("c1", "split");
  for (const titles of [
    ["Only one"],
    ["Same", "Same"],
    ["", "Second"],
    Array.from({ length: 21 }, (_, i) => String(i)),
  ])
    expect(() =>
      submitAnswer(state, data, "a", { ...payload, titles }, 2000),
    ).toThrow();
});
test("confidence and timing are validated without a preselected answer", () => {
  const state = presentTask(initial(), data, "a", 1000),
    payload = creation("c1");
  for (const confidence of [0, null, 6])
    expect(() =>
      submitAnswer(state, data, "a", { ...payload, confidence }, 2000),
    ).toThrow();
  expect(() =>
    submitAnswer(state, data, "a", { ...payload, activeTimeMs: 50000 }, 2000),
  ).toThrow("timing");
});
test("equal rankings remain separate from inability to rank", () => {
  let state = presentTask(createdAll(), data, "a", 3000);
  const p = evalPayload(state);
  const result = submitAnswer(state, data, "a", p, 4000);
  expect(result.answer.payload).toMatchObject({ cannotRank: false });
  expect(() =>
    submitAnswer(state, data, "a", { ...p, cannotRank: true }, 4000),
  ).toThrow();
  const abstain = {
    ...p,
    cannotRank: true,
    notes: "I cannot interpret this terminology",
    ratings: p.ratings.map((r) => ({ ...r, rank: null })),
  };
  expect(
    submitAnswer(state, data, "a", abstain, 4000).answer.payload,
  ).toMatchObject({ cannotRank: true });
});
test("a problem or uncertainty requires a brief explanation", () => {
  const state = presentTask(createdAll(), data, "a", 3000),
    p = evalPayload(state);
  p.ratings[0].adequacy = "unsure";
  expect(() => submitAnswer(state, data, "a", p, 4000)).toThrow(
    "Briefly explain",
  );
  expect(
    submitAnswer(
      state,
      data,
      "a",
      { ...p, notes: "The description is ambiguous" },
      4000,
    ).duplicate,
  ).toBe(false);
});
test("invented, duplicated or missing comparison options cannot be submitted", () => {
  const state = presentTask(createdAll(), data, "a", 3000),
    p = evalPayload(state);
  for (const ratings of [
    p.ratings.slice(1),
    [...p.ratings.slice(1), p.ratings[1]],
    p.ratings.map((r, i) => (i ? r : { ...r, optionId: "invented" })),
  ])
    expect(() =>
      submitAnswer(state, data, "a", { ...p, ratings }, 4000),
    ).toThrow();
});
test("a rank cannot exceed the actual number of displayed alternatives", () => {
  const d = {
    ...data,
    cases: data.cases.map((c) => ({ ...c, modelTitles: [c.currentTitle] })),
  };
  const state = presentTask(createdAll(), d, "a", 3000);
  const options = privateOptions(state, d, "c2", "a");
  expect(options).toHaveLength(2);
  const p = {
    ...evalPayload(state),
    ratings: options.map((o, i) => ({
      optionId: o.id,
      adequacy: "adequate",
      rank: i ? 3 : 1,
    })),
  };
  expect(() => submitAnswer(state, d, "a", p, 4000)).toThrow("rank exceeds");
});
test("paused pilots accept no new answers and preserve stored responses", () => {
  const state = createdAll();
  state.study.status = "paused";
  expect(sessionFor(state, data, "a").task).toBeUndefined();
  expect(() =>
    submitAnswer(state, data, "a", evalPayload(state), 4000),
  ).toThrow("not open");
  expect(Object.keys(state.answers)).toHaveLength(3);
});
test("dashboard counts one review per matching source without inventing accuracy or significance", () => {
  const d = {
    ...data,
    cases: data.cases.map((c) => ({ ...c, modelTitles: [c.currentTitle] })),
  };
  let state = createdAll(true);
  state = presentTask(state, d, "a", 3000);
  const p = {
    ...evalPayload(state, "c2", "a"),
    ratings: privateOptions(state, d, "c2", "a").map((o) => ({
      optionId: o.id,
      adequacy: "adequate",
      rank: 1,
    })),
  };
  state = submitAnswer(state, d, "a", p, 4000).state;
  const stats = dashboardFor(state, d);
  expect(stats.completedEvaluations).toBe(1);
  expect(stats.comparisons.every((r) => r.judgments === 1)).toBe(true);
  expect(stats.caution).toContain("not accuracy");
  expect((stats as unknown as Record<string, unknown>).pValue).toBeUndefined();
});
test("duplicate reviewer IDs, missing cases and changed dataset versions are rejected", () => {
  const state = initial();
  expect(() =>
    validateStudy(
      {
        ...state.study,
        roster: [
          state.study.roster[0],
          state.study.roster[0],
          state.study.roster[2],
        ],
      },
      data,
    ),
  ).toThrow();
  expect(() =>
    validateStudy({ ...state.study, caseIds: ["unknown"] }, data),
  ).toThrow();
  expect(() =>
    validateStudy({ ...state.study, datasetVersion: "other" }, data),
  ).toThrow();
});
