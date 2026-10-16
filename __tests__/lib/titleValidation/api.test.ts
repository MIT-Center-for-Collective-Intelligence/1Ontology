import { titleValidationHandler } from "../../../src/lib/titleValidation/api";
import type { ValidationState } from "../../../src/lib/titleValidation/engine";

let state: ValidationState | null = null;
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
