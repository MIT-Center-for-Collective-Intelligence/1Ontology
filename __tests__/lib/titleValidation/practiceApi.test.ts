import { randomUUID } from "crypto";
import { titleValidationHandler } from "../../../src/lib/titleValidation/api";
import {
  newPracticeState,
  practiceStudyId,
} from "../../../src/lib/titleValidation/practice";
import {
  answerKey,
  creatorFor,
  presentTask,
  sessionFor,
  submitAnswer,
  ValidationState,
} from "../../../src/lib/titleValidation/engine";
import { getTitleValidationDataset } from "../../../src/lib/titleValidation/dataset";

const states = new Map<string, ValidationState>();
const journals = new Map<string, unknown[]>();
const verifyIdToken = jest.fn();
jest.mock("../../../src/lib/firestoreServer/admin", () => ({
  admin: { auth: () => ({ verifyIdToken }) },
}));
jest.mock("../../../src/lib/titleValidation/repository", () => ({
  localPreviewEnabled: () => false,
  withStudy: async (id: string, preview: boolean, fn: any) => {
    expect(preview).toBe(false);
    const change = fn(states.get(id) || null);
    if (change.state) states.set(id, change.state);
    if (change.event)
      journals.set(id, [...(journals.get(id) || []), change.event]);
    return change.result;
  },
}));
const owner = { uid: "owner", email: "oneweb@umich.edu", email_verified: true };
async function call(
  action: string,
  body: Record<string, unknown> = {},
  user = owner,
  authorization = "Bearer test",
) {
  verifyIdToken.mockResolvedValue(user);
  let code = 200,
    data: any;
  await titleValidationHandler(
    {
      method: "POST",
      query: { action },
      body,
      headers: { host: "ontology.mit.edu", authorization },
    } as any,
    {
      setHeader: jest.fn(),
      status(n: number) {
        code = n;
        return this;
      },
      json(value: any) {
        data = value;
        return this;
      },
    } as any,
  );
  return { code, data };
}
const context = (role?: string) => ({
  workspace: "practice",
  ...(role ? { practiceReviewer: role } : {}),
});
const creation = (caseId: string) => ({
  kind: "create" as const,
  caseId,
  decision: "keep" as const,
  titles: [],
  confidence: 3,
  notes: "Software test",
  activeTimeMs: 0,
  submissionId: randomUUID(),
});
const evaluation = (task: any) => ({
  kind: "evaluate" as const,
  caseId: task.caseId,
  ratings: task.options.map((option: any) => ({
    optionId: option.id,
    adequacy: "unsure" as const,
    rank: null,
  })),
  cannotRank: true,
  confidence: 3,
  notes: "Software test",
  activeTimeMs: 0,
  submissionId: randomUUID(),
});
beforeEach(() => {
  states.clear();
  journals.clear();
  verifyIdToken.mockReset();
  process.env.TITLE_VALIDATION_RELEASED = "1";
});
afterAll(() => {
  delete process.env.TITLE_VALIDATION_RELEASED;
});

test("practice verifies login and coordinator authority before touching storage", async () => {
  expect((await call("session", context(), owner, "")).code).toBe(401);
  expect(
    (
      await call("session", context(), {
        uid: "rob",
        email: "rjl@mit.edu",
        email_verified: true,
      })
    ).code,
  ).toBe(403);
  expect(
    (await call("session", context(), { ...owner, email_verified: false }))
      .code,
  ).toBe(403);
  verifyIdToken.mockRejectedValueOnce(Error("revoked"));
  expect((await call("session", context())).code).toBe(401);
  expect(verifyIdToken).toHaveBeenCalledWith("test", true);
  expect(states.size).toBe(0);
});

test("practice derives ownership from login and ignores forged study and owner fields", async () => {
  const first = await call("session", {
    ...context(),
    studyId: "human-title-review-prepilot-20261015-v1",
    ownerUid: "rob",
    reviewerId: "rob",
  });
  expect(first.code).toBe(200);
  expect(first.data).toMatchObject({
    studyId: practiceStudyId("owner"),
    practice: true,
    preview: false,
    canManage: false,
    phase: "create",
    reviewerLabel: "Your review",
    progress: {
      creationDone: 0,
      creationTotal: 5,
      evaluationDone: 0,
      evaluationTotal: 5,
    },
  });
  expect(first.data.task.options).toBeUndefined();
  expect(first.data.disclosure).toBeUndefined();
  const study = states.get(first.data.studyId)!.study;
  expect(study.practice).toEqual({
    ownerUid: "owner",
    purpose: "interface-practice",
  });
  expect(study.roster.map((r) => r.reviewerId)).toEqual([
    "practice-a",
    "practice-b",
    "practice-c",
  ]);
  expect(journals.get(study.id)![0]).toMatchObject({
    kind: "practice-created",
    actorId: "owner",
    practiceReviewer: "practice-a",
  });
  expect((await call("session", context("rob"))).code).toBe(400);
  expect((await call("session", context("practice-c"))).data.task).toEqual(
    first.data.task,
  );
  expect(states.size).toBe(1);
});

test("different authenticated owners get different copies and cannot select another owner's copy", async () => {
  const first = (await call("session", context())).data;
  const second = (
    await call(
      "session",
      { ...context(), studyId: first.studyId },
      { ...owner, uid: "owner-2" },
    )
  ).data;
  expect(second.studyId).toBe(practiceStudyId("owner-2"));
  expect(second.studyId).not.toBe(first.studyId);
  expect(states.size).toBe(2);
  expect((await call("session", { studyId: first.studyId })).code).toBe(403);
  states.get(first.studyId)!.study.practice!.ownerUid = "other";
  expect((await call("session", context())).code).toBe(403);
});

test("practice cannot be managed or exported as a team study", async () => {
  await call("session", context());
  const before = JSON.stringify([...states]);
  for (const action of ["manage", "dashboard", "export"]) {
    expect(
      (await call(action, { ...context(), operation: "close" })).code,
    ).toBe(403);
  }
  expect(JSON.stringify([...states])).toBe(before);
});

test("repeated and concurrent session requests retain one frozen copy", async () => {
  const results = await Promise.all([
    call("session", context()),
    call("session", context("practice-b")),
  ]);
  const id = results[0].data.studyId;
  expect(results.every((r) => r.code === 200 && r.data.studyId === id)).toBe(
    true,
  );
  const seed = states.get(id)!.study.seed;
  await call("session", context("practice-c"));
  expect(states.get(id)!.study.seed).toBe(seed);
  expect(
    journals.get(id)!.filter((event: any) => event.kind === "practice-created"),
  ).toHaveLength(1);
});

test("one owner completes five creations then five distinct comparisons without changing the real pilot", async () => {
  const data = getTitleValidationDataset();
  const real = newPracticeState("unused-fixture", data);
  real.study.id = "human-title-review-prepilot-20261015-v1";
  delete real.study.practice;
  real.study.roster = ["rob", "xinru", "anushka"].map((reviewerId) => ({
    reviewerId,
    label: reviewerId,
  }));
  real.presentations = { retained: 123 };
  states.set(real.study.id, real);
  journals.set(real.study.id, [{ kind: "retained-real-event" }]);
  const before = JSON.stringify({
    state: real,
    events: journals.get(real.study.id),
  });
  let session = (await call("session", context())).data;
  for (let i = 0; i < data.cases.length; i++) {
    expect(session.phase).toBe("create");
    expect(session.task.caseId).toBe(data.cases[i].id);
    expect(session.task.options).toBeUndefined();
    const body = {
      ...context(),
      studyId: real.study.id,
      submission: creation(session.task.caseId),
    };
    const next = await call("respond", body);
    expect(next.code).toBe(200);
    expect((await call("respond", body)).code).toBe(200);
    session = next.data;
    expect(session.progress.creationDone).toBe(i + 1);
  }
  const id = practiceStudyId("owner");
  expect(Object.keys(states.get(id)!.answers)).toHaveLength(5);
  const seen = new Set<string>();
  for (let i = 0; i < data.cases.length; i++) {
    expect(session.phase).toBe("evaluate");
    expect(session.task.caseId).toBe(data.cases[i].id);
    expect(seen.has(session.task.caseId)).toBe(false);
    seen.add(session.task.caseId);
    expect((await call("session", context())).data.task).toEqual(session.task);
    expect(session.task.options.every((option: any) => !option.sources)).toBe(
      true,
    );
    const body = {
      ...context(),
      studyId: real.study.id,
      submission: evaluation(session.task),
    };
    const next = await call("respond", body);
    expect(next.code).toBe(200);
    const count = Object.keys(states.get(id)!.answers).length;
    expect((await call("respond", body)).code).toBe(200);
    expect(Object.keys(states.get(id)!.answers)).toHaveLength(count);
    session = next.data;
    expect(session.progress.evaluationDone).toBe(i + 1);
  }
  expect(session.phase).toBe("complete");
  expect(session.task).toBeUndefined();
  expect(Object.keys(states.get(id)!.answers)).toHaveLength(10);
  for (const answer of Object.values(states.get(id)!.answers)) {
    if (answer.kind === "evaluate")
      expect(answer.reviewerId).not.toBe(
        creatorFor(states.get(id)!.study, answer.caseId),
      );
  }
  expect(
    JSON.stringify({
      state: states.get(real.study.id),
      events: journals.get(real.study.id),
    }),
  ).toBe(before);
});

test("forged roles cannot select tasks, skip ahead, reveal alternatives early, or change saved answers", async () => {
  const first = (await call("session", context())).data;
  const id = first.studyId;
  const secondId = getTitleValidationDataset().cases[1].id;
  expect(
    (
      await call("respond", {
        ...context("practice-c"),
        submission: creation(secondId),
      })
    ).code,
  ).toBe(409);
  expect(
    (
      await call("respond", {
        ...context(),
        submission: { ...creation(first.task.caseId), kind: "evaluate" },
      })
    ).code,
  ).toBe(400);
  expect(
    (await call("respond", { ...context(), submission: creation("unknown") }))
      .code,
  ).toBe(400);
  expect(Object.keys(states.get(id)!.answers)).toHaveLength(0);
  const input = creation(first.task.caseId);
  expect(
    (await call("respond", { ...context(), submission: input })).code,
  ).toBe(200);
  const before = JSON.stringify(states.get(id));
  expect(
    (
      await call("respond", {
        ...context(),
        submission: { ...input, notes: "Changed" },
      })
    ).code,
  ).toBe(409);
  expect(JSON.stringify(states.get(id))).toBe(before);
});

function seedLegacyCreations() {
  const data = getTitleValidationDataset();
  let state = newPracticeState("owner", data);
  for (const role of state.study.roster.map((row) => row.reviewerId)) {
    let task = sessionFor(state, data, role).task;
    while (task?.stage === "create") {
      state = presentTask(state, data, role, Date.now());
      state = submitAnswer(
        state,
        data,
        role,
        creation(task.caseId),
        Date.now(),
      ).state;
      task = sessionFor(state, data, role).task;
    }
  }
  return { data, state };
}

test("existing work across old roles is retained and multiple comparisons count once per activity", async () => {
  let { data, state } = seedLegacyCreations();
  const originalStudy = JSON.stringify(state.study);
  const firstId = data.cases[0].id;
  let retry: any;
  for (const role of ["practice-b", "practice-c"]) {
    state = presentTask(state, data, role, Date.now());
    const task = sessionFor(state, data, role).task!;
    expect(task.caseId).toBe(firstId);
    retry = { ...evaluation(task), submissionId: ` ${randomUUID()} ` };
    state = submitAnswer(state, data, role, retry, Date.now()).state;
  }
  const oldAnswers = JSON.parse(JSON.stringify(state.answers));
  states.set(state.study.id, state);
  journals.set(state.study.id, [{ kind: "retained-legacy-event" }]);
  let session = (await call("session", context())).data;
  expect(session.progress).toEqual({
    creationDone: 5,
    creationTotal: 5,
    evaluationDone: 1,
    evaluationTotal: 5,
  });
  expect(session.task.caseId).toBe(data.cases[1].id);
  expect(
    (await call("respond", { ...context("practice-c"), submission: retry }))
      .code,
  ).toBe(200);
  expect(
    (
      await call("respond", {
        ...context(),
        submission: { ...retry, notes: "Changed" },
      })
    ).code,
  ).toBe(409);
  while (session.phase === "evaluate") {
    const next = await call("respond", {
      ...context(),
      submission: evaluation(session.task),
    });
    expect(next.code).toBe(200);
    session = next.data;
  }
  expect(session.phase).toBe("complete");
  const stored = states.get(state.study.id)!;
  expect(JSON.stringify(stored.study)).toBe(originalStudy);
  expect(Object.keys(stored.answers)).toHaveLength(11);
  for (const [key, answer] of Object.entries(oldAnswers))
    expect(stored.answers[key]).toEqual(answer);
  expect(journals.get(state.study.id)![0]).toEqual({
    kind: "retained-legacy-event",
  });
});

test("a partially completed old role resumes at the first unfinished activity and retains its draft identity", async () => {
  const data = getTitleValidationDataset();
  let state = newPracticeState("owner", data);
  const role = "practice-b";
  state = presentTask(state, data, role, Date.now());
  const oldSession = sessionFor(state, data, role);
  const submitted = creation(oldSession.task!.caseId);
  state = submitAnswer(state, data, role, submitted, Date.now()).state;
  states.set(state.study.id, state);
  const first = (await call("session", context())).data;
  expect(first.task.caseId).toBe(data.cases[0].id);
  expect(first.progress.creationDone).toBe(1);
  const next = await call("respond", {
    ...context(),
    submission: creation(first.task.caseId),
  });
  expect(next.code).toBe(200);
  expect(next.data.task.caseId).toBe(data.cases[2].id);
  expect(
    states.get(state.study.id)!.answers[
      answerKey("create", oldSession.task!.caseId, role)
    ].payload,
  ).toEqual(submitted);
});

test("earlier comparison presentations retain their timing identity and expose old draft aliases only in the owner copy", async () => {
  let { data, state } = seedLegacyCreations();
  state = presentTask(state, data, "practice-c", Date.now() - 60000);
  state = presentTask(state, data, "practice-b", Date.now() - 30000);
  const earlierKey = sessionFor(state, data, "practice-c").reviewerKey;
  const otherKey = sessionFor(state, data, "practice-b").reviewerKey;
  states.set(state.study.id, state);
  const first = (await call("session", context())).data;
  expect(first.reviewerKey).toBe(earlierKey);
  expect(first.draftReviewerKeys).toEqual(
    expect.arrayContaining([earlierKey, otherKey]),
  );
  const input = { ...evaluation(first.task), activeTimeMs: 40000 };
  const saved = await call("respond", { ...context(), submission: input });
  expect(saved.code).toBe(200);
  const answer = states.get(state.study.id)!.answers[
    answerKey("evaluate", first.task.caseId, "practice-c")
  ];
  expect(answer.firstPresentedAt).toBe(state.presentations[answer.id]);
  expect(answer.elapsedTimeMs).toBeGreaterThanOrEqual(60000);
});
