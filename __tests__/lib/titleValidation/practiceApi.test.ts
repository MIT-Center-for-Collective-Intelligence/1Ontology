import { randomUUID } from "crypto";
import { titleValidationHandler } from "../../../src/lib/titleValidation/api";
import {
  newPracticeState,
  practiceStudyId,
} from "../../../src/lib/titleValidation/practice";
import {
  creatorFor,
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
const context = (role = "practice-a") => ({
  workspace: "practice",
  practiceReviewer: role,
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

test("all three roles can complete the workflow without changing real pilot state or progress", async () => {
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
  for (const role of ["practice-a", "practice-b", "practice-c"]) {
    let session = (await call("session", context(role))).data;
    while (session.phase === "create") {
      session = (
        await call("respond", {
          ...context(role),
          studyId: real.study.id,
          submission: {
            kind: "create",
            caseId: session.task.caseId,
            decision: "keep",
            titles: [],
            confidence: 3,
            notes: "Software test",
            activeTimeMs: 0,
            submissionId: randomUUID(),
          },
        })
      ).data;
    }
    if (role !== "practice-c") expect(session.phase).toBe("waiting");
  }
  const id = practiceStudyId("owner");
  expect(Object.keys(states.get(id)!.answers)).toHaveLength(5);
  for (const role of ["practice-a", "practice-b", "practice-c"]) {
    let session = (await call("session", context(role))).data;
    while (session.phase === "evaluate") {
      expect(creatorFor(states.get(id)!.study, session.task.caseId)).not.toBe(
        role,
      );
      expect(session.task.options.every((option: any) => !option.sources)).toBe(
        true,
      );
      const submission = {
        kind: "evaluate",
        caseId: session.task.caseId,
        ratings: session.task.options.map((option: any) => ({
          optionId: option.id,
          adequacy: "unsure",
          rank: null,
        })),
        cannotRank: true,
        confidence: 3,
        notes: "Software test",
        activeTimeMs: 0,
        submissionId: randomUUID(),
      };
      const body = { ...context(role), studyId: real.study.id, submission };
      const next = await call("respond", body);
      expect(next.code).toBe(200);
      const count = Object.keys(states.get(id)!.answers).length;
      expect((await call("respond", body)).code).toBe(200);
      expect(Object.keys(states.get(id)!.answers)).toHaveLength(count);
      session = next.data;
    }
    expect(session.phase).toBe("complete");
  }
  expect(Object.keys(states.get(id)!.answers)).toHaveLength(15);
  expect(
    JSON.stringify({
      state: states.get(real.study.id),
      events: journals.get(real.study.id),
    }),
  ).toBe(before);
});
