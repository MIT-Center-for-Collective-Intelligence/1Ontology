import {
  actorFor,
  titleValidationHandler,
} from "../../../src/lib/titleValidation/api";
import type { ValidationState } from "../../../src/lib/titleValidation/engine";

let state: ValidationState | null = null;
let events: any[] = [];
const verifyIdToken = jest.fn();
const getUser = jest.fn(async (uid: string) => ({ uid }));
const getUserByEmail = jest.fn(async (email: string) => ({
  uid: email.split("@")[0],
}));
jest.mock("../../../src/lib/firestoreServer/admin", () => ({
  admin: { auth: () => ({ verifyIdToken, getUser, getUserByEmail }) },
}));
jest.mock("../../../src/lib/titleValidation/repository", () => ({
  localPreviewEnabled: () => false,
  withStudy: async (_id: string, _preview: boolean, fn: any) => {
    const change = fn(state);
    state = change.state;
    if (change.event) events.push(change.event);
    return change.result;
  },
}));
async function call(
  action: string,
  body: Record<string, unknown> = {},
  user: Record<string, unknown> = {
    uid: "owner",
    email: "oneweb@umich.edu",
    email_verified: true,
  },
  authorization = "Bearer test",
) {
  verifyIdToken.mockResolvedValue(user);
  const req: any = {
    method: "POST",
    query: { action },
    body,
    headers: { host: "ontology.mit.edu", authorization },
  };
  let code = 200,
    data: any;
  const res: any = {
    setHeader: jest.fn(),
    status(n: number) {
      code = n;
      return this;
    },
    json(x: any) {
      data = x;
      return this;
    },
  };
  await titleValidationHandler(req, res);
  return { code, data, headers: res.setHeader };
}
beforeEach(() => {
  state = null;
  events = [];
  process.env.TITLE_VALIDATION_RELEASED = "1";
  verifyIdToken.mockClear();
});
afterAll(() => {
  delete process.env.TITLE_VALIDATION_RELEASED;
});
test("a coordinator can inspect setup without creating or changing a study", async () => {
  const r = await call("session");
  expect(r.code).toBe(200);
  expect(r.data.canManage).toBe(true);
  expect(r.data.studyId).toBe("");
  expect(state).toBeNull();
});
test.each([
  ["Rob", "vFCAkxKTwjcDKohmiWfiZWz2lZf1"],
  ["Xinru", "dPvaiA6EAwcIAwYbxAEap0WDcoK2"],
  ["Iman", "uQesveK6m5Mz76vO9C93UBKbWPA2"],
])(
  "navigation access for %s follows verified account identity and does not grant administration",
  async (_name, uid) => {
    verifyIdToken.mockResolvedValue({ uid });
    const actor = await actorFor(
      {
        headers: { host: "ontology.mit.edu", authorization: "Bearer test" },
      } as any,
      {},
    );
    expect(actor.canUseReviewLinks).toBe(true);
    expect(actor.canManage).toBe(false);
  },
);
test("a different coordinator or a forged display name cannot gain the named review links", async () => {
  verifyIdToken.mockResolvedValue({
    uid: "other",
    name: "Xinru Wang",
    titleValidationCoordinator: true,
  });
  const actor = await actorFor(
    {
      headers: { host: "ontology.mit.edu", authorization: "Bearer test" },
    } as any,
    { canUseReviewLinks: true },
  );
  expect(actor.canUseReviewLinks).toBe(false);
  expect(actor.canManage).toBe(true);
});
test("production API requires authentication even with forged preview fields", async () => {
  const r = await call("session", { previewReviewer: "preview-a" }, {}, "");
  expect(r.code).toBe(401);
  expect(verifyIdToken).not.toHaveBeenCalled();
});
test("production stays unreleased until explicitly enabled", async () => {
  delete process.env.TITLE_VALIDATION_RELEASED;
  const r = await call("session");
  expect(r.code).toBe(503);
  expect(state).toBeNull();
});
test("non-coordinators cannot create a pilot", async () => {
  expect(
    (
      await call(
        "manage",
        { operation: "create", reviewers: [] },
        { uid: "other", email: "other@example.org", email_verified: true },
      )
    ).code,
  ).toBe(403);
});
test("an unverified email alone cannot grant coordinator permissions", async () => {
  const r = await call(
    "session",
    {},
    { uid: "other", email: "oneweb@umich.edu", email_verified: false },
  );
  expect(r.data.canManage).toBe(false);
});
test("study creation is draft, does not expose proposals and cannot replace existing answers", async () => {
  const reviewers = [
    { reviewerId: "owner", label: "Owner" },
    { reviewerId: "b", label: "B" },
    { reviewerId: "c", label: "C" },
  ];
  expect((await call("manage", { operation: "create", reviewers })).code).toBe(
    200,
  );
  expect(state!.study.status).toBe("draft");
  expect(Object.keys(state!.answers)).toHaveLength(0);
  expect((await call("manage", { operation: "create", reviewers })).code).toBe(
    409,
  );
  expect((await call("session")).data.task).toBeUndefined();
  await call("manage", { operation: "start" });
  const session = (await call("session")).data;
  expect(session.phase).toBe("create");
  for (const key of ["modelTitles", "modelReason", "outcome", "provenance"])
    expect(JSON.stringify(session)).not.toContain(key);
});
test("owner assignment does not grant permission to inspect source comparisons while reviewing", async () => {
  await call("manage", {
    operation: "create",
    reviewers: [
      { reviewerId: "owner", label: "Owner" },
      { reviewerId: "b", label: "B" },
      { reviewerId: "c", label: "C" },
    ],
  });
  await call("manage", { operation: "start" });
  const dashboard = await call("dashboard");
  expect(dashboard.data.comparisons).toEqual([]);
  expect(dashboard.data.notes).toEqual([]);
  expect(dashboard.data.activityDetails).toEqual([]);
  expect((await call("export")).code).toBe(403);
});
test("a coordinator joins only their verified identity without changing colleagues or duplicating history", async () => {
  await call("manage", {
    operation: "create",
    reviewers: ["a", "b", "c"].map((reviewerId) => ({
      reviewerId,
      label: reviewerId,
    })),
  });
  await call("manage", { operation: "start" });
  const before = JSON.parse(JSON.stringify(state));
  const user = {
    uid: "owner",
    name: "Iman",
    email: "oneweb@umich.edu",
    email_verified: true,
  };
  const r = await call(
    "manage",
    { operation: "join", reviewerId: "forged", label: "Forged" },
    user,
  );
  expect(r).toMatchObject({ code: 200, data: { joined: true } });
  expect(state!.study.roster).toEqual([
    ...before.study.roster,
    { reviewerId: "owner", label: "Iman" },
  ]);
  expect(state!.answers).toEqual(before.answers);
  expect(state!.presentations).toEqual(before.presentations);
  expect(state!.study.seed).toBe(before.study.seed);
  expect(events.filter((e) => e.kind === "reviewer-joined")).toHaveLength(1);
  expect(
    (
      await call(
        "manage",
        { operation: "join" },
        {
          uid: "other-owner",
          name: "Other",
          email: "oneman@mit.edu",
          email_verified: true,
        },
      )
    ).code,
  ).toBe(409);
  expect(state!.study.roster).toHaveLength(4);
  const saved = JSON.stringify(state);
  expect((await call("manage", { operation: "join" }, user)).data.joined).toBe(
    false,
  );
  expect(JSON.stringify(state)).toBe(saved);
  expect(events.filter((e) => e.kind === "reviewer-joined")).toHaveLength(1);
  const s = await call("session", {}, user);
  expect(s.data.progress).toMatchObject({
    creationTotal: 2,
    evaluationTotal: 3,
  });
  expect(JSON.stringify(s.data)).not.toContain("modelTitles");
  expect((await call("dashboard", {}, user)).data.activityDetails).toEqual([]);
  expect((await call("export", {}, user)).code).toBe(403);
});
test("join rejects unverified or non-coordinator identities, unrelated studies and practice routes", async () => {
  await call("manage", {
    operation: "create",
    reviewers: ["a", "b", "c"].map((reviewerId) => ({
      reviewerId,
      label: reviewerId,
    })),
  });
  await call("manage", { operation: "start" });
  const before = JSON.stringify(state);
  for (const user of [
    { uid: "owner", email: "oneweb@umich.edu", email_verified: false },
    { uid: "a", email: "a@example.org", email_verified: true },
  ])
    expect((await call("manage", { operation: "join" }, user)).code).toBe(403);
  expect(
    (await call("manage", { operation: "join", studyId: "unrelated-study" }))
      .code,
  ).toBe(403);
  expect(
    (await call("manage", { operation: "join", workspace: "practice" })).code,
  ).toBe(403);
  expect(JSON.stringify(state)).toBe(before);
  await call("manage", { operation: "close" });
  expect((await call("manage", { operation: "join" })).code).toBe(409);
});
test("clients cannot impersonate a different reviewer using body fields", async () => {
  await call("manage", {
    operation: "create",
    reviewers: [
      { reviewerId: "owner", label: "Owner" },
      { reviewerId: "b", label: "B" },
      { reviewerId: "c", label: "C" },
    ],
  });
  await call("manage", { operation: "start" });
  const r = await call("session", { previewReviewer: "b", reviewerId: "b" });
  expect(r.data.reviewerLabel).toBe("Owner");
});
test("closed studies cannot resume and retain their answers", async () => {
  await call("manage", {
    operation: "create",
    reviewers: [
      { reviewerId: "owner", label: "Owner" },
      { reviewerId: "b", label: "B" },
      { reviewerId: "c", label: "C" },
    ],
  });
  await call("manage", { operation: "close" });
  expect((await call("manage", { operation: "resume" })).code).toBe(409);
  const result = await call("export");
  expect(result.code).toBe(200);
  expect(result.data.preview).toBe(false);
  expect(result.data.dataset.scientificPrompt).toContain(
    "OUTPUT FORMAT FOR THE SOFTWARE",
  );
});
test("responses are not cached", async () => {
  const r = await call("session");
  expect(r.headers).toHaveBeenCalledWith("Cache-Control", "no-store, private");
});
