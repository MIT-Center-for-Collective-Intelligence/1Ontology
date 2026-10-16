import { relationshipReviewHandler } from "../../../src/lib/relationshipReview/api";
import { createHash } from "crypto";
const verifyIdToken = jest.fn(),
  getUserByEmail = jest.fn(async () => ({ uid: "verified-tom" })),
  readFeedback = jest.fn(async (..._args: any[]) => ({})),
  saveFeedback = jest.fn(async (..._args: any[]) => ({ revision: 1 }));
jest.mock("../../../src/lib/firestoreServer/admin", () => ({
  admin: { auth: () => ({ verifyIdToken, getUserByEmail }) },
}));
jest.mock("../../../src/lib/titleValidation/repository", () => ({
  localPreviewEnabled: () => false,
}));
jest.mock("../../../src/lib/relationshipReview/repository", () => ({
  readFeedback: (...a: any[]) => readFeedback(...a),
  saveFeedback: (...a: any[]) => saveFeedback(...a),
}));
jest.mock("../../../src/lib/relationshipReview/dataset", () => ({
  getRelationshipDataset: () => ({
    dataset: { version: "v1", cases: [{ id: "reason" }] },
    sha256: "sha",
  }),
  getRelationshipTrace: (id: string) => ({ caseId: id, exactPrompt: "audit" }),
}));
async function call(
  action = "session",
  body: any = {},
  user: any = { uid: "tom", email: "malone@mit.edu", email_verified: true },
  headers: any = { authorization: "Bearer test", host: "ontology.mit.edu" },
) {
  verifyIdToken.mockResolvedValue(user);
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
  await relationshipReviewHandler(
    { method: "POST", query: { action }, body, headers, socket: {} } as any,
    res,
  );
  return { code, data, headers: res.setHeader };
}
beforeEach(() => jest.clearAllMocks());
test("verified Tom reads without creating answers", async () => {
  const r = await call();
  expect(r.code).toBe(200);
  expect(readFeedback).toHaveBeenCalledWith("tom", "v1", false, "sha");
  expect(saveFeedback).not.toHaveBeenCalled();
  expect(r.headers).toHaveBeenCalledWith("Cache-Control", "private, no-store");
});
test("the pinned public HTTPS origin works through the Cloud Run proxy", async () => {
  const r = await call("session", {}, undefined, {
    authorization: "Bearer test",
    host: "ontology-r5kaknwqbq-uc.a.run.app",
    origin: "https://ontology.mit.edu",
  });
  expect(r.code).toBe(200);
  expect(saveFeedback).not.toHaveBeenCalled();
  expect((await call("session", {}, {}, {
    host: "ontology-r5kaknwqbq-uc.a.run.app",
    origin: "https://ontology.mit.edu",
  })).code).toBe(401);
});
test.each([
  "http://ontology.mit.edu",
  "https://ontology.mit.edu.evil.example",
  "https://ontology.mit.edu@evil.example",
  "https://ontology.mit.edu/extra",
])("invalid or downgraded public origins stay rejected: %s", async (origin) => {
  const r = await call("session", {}, undefined, {
    authorization: "Bearer test",
    host: "ontology-r5kaknwqbq-uc.a.run.app",
    origin,
    "x-forwarded-host": "ontology.mit.edu",
  });
  expect(r.code).toBe(403);
  expect(readFeedback).not.toHaveBeenCalled();
});
test("anonymous access cannot obtain proposals or impersonate preview", async () => {
  expect(
    (
      await call(
        "session",
        { previewReviewer: "tom" },
        {},
        { host: "ontology.mit.edu" },
      )
    ).code,
  ).toBe(401);
  expect(readFeedback).not.toHaveBeenCalled();
});
test.each([
  { email: "malone@mit.edu", email_verified: false },
  { email: "other@mit.edu", email_verified: true },
])("uninvited or unverified identity is denied", async (user) => {
  expect((await call("session", { uid: "tom" }, user)).code).toBe(403);
  expect(readFeedback).not.toHaveBeenCalled();
});
test("save uses authenticated identity and requires exact dataset hash", async () => {
  const body = {
    caseId: "reason",
    datasetVersion: "v1",
    datasetSha256: "sha",
    decision: "discuss",
    revision: 0,
    requestId: "0123456789abcdef",
    note: "",
    correction: "",
    uid: "someone-else",
    reviewerKey: createHash("sha256").update("tom").digest("hex"),
  };
  expect((await call("save", body)).code).toBe(200);
  expect(saveFeedback.mock.calls[0][0]).toBe("tom");
  expect(
    (await call("save", { ...body, datasetSha256: "different" })).code,
  ).toBe(409);
});
test("an account switch cannot save a draft under a different reviewer's identity", async () => {
  const r = await call("save", { reviewerKey: "old-reviewer" });
  expect(r.code).toBe(409);
  expect(r.data.code).toBe("account_changed");
  expect(saveFeedback).not.toHaveBeenCalled();
});
test("cross-origin saves and ontology mutation actions fail before repository access", async () => {
  expect(
    (
      await call("save", {}, undefined, {
        authorization: "Bearer test",
        host: "ontology.mit.edu",
        origin: "https://other.example",
      })
    ).code,
  ).toBe(403);
  expect((await call("apply")).code).toBe(404);
  expect(saveFeedback).not.toHaveBeenCalled();
});
test("exact traces have the same authorization boundary and reject unknown case IDs", async () => {
  expect((await call("trace", { caseId: "reason" })).data).toEqual({
    trace: { caseId: "reason", exactPrompt: "audit" },
  });
  expect((await call("trace", { caseId: "../../nodes" })).code).toBe(404);
  expect(
    (
      await call(
        "trace",
        { caseId: "reason" },
        {},
        { host: "ontology.mit.edu" },
      )
    ).code,
  ).toBe(401);
});
test("Tom's feedback overview is read-only and restricted to the project owner", async () => {
  expect((await call("tom-feedback", { canViewTomFeedback: true })).code).toBe(
    403,
  );
  expect(
    (
      await call(
        "tom-feedback",
        {},
        { uid: "iman", email: "oneweb@umich.edu", email_verified: true },
      )
    ).code,
  ).toBe(200);
  expect(getUserByEmail).toHaveBeenCalledWith("malone@mit.edu");
  expect(readFeedback).toHaveBeenCalledWith("verified-tom", "v1", false, "sha");
  expect(saveFeedback).not.toHaveBeenCalled();
});
