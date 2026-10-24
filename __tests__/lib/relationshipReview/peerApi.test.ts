/** @jest-environment node */
import { createHash } from "crypto";
import { relationshipReviewHandler } from "../../../src/lib/relationshipReview/api";
import { targetFeedbackHash } from "../../../src/lib/relationshipReview/peerFeedback";
import type {
  PeerReviewer,
  RelationshipFeedback,
} from "../../../src/types/IRelationshipReview";

const mockVerifyIdToken = jest.fn(),
  mockGetUserByEmail = jest.fn();
const mockReadPeerFeedback = jest.fn(),
  mockSavePeerFeedback = jest.fn();
const mockReadFeedback = jest.fn(),
  mockSaveFeedback = jest.fn();
const mockLocalPreviewEnabled = jest.fn();

jest.mock("../../../src/lib/firestoreServer/admin", () => ({
  admin: {
    auth: () => ({
      verifyIdToken: mockVerifyIdToken,
      getUserByEmail: mockGetUserByEmail,
    }),
  },
}));
jest.mock("../../../src/lib/titleValidation/repository", () => ({
  localPreviewEnabled: (...args: any[]) => mockLocalPreviewEnabled(...args),
}));
jest.mock("../../../src/lib/relationshipReview/peerRepository", () => ({
  readPeerFeedback: (...args: any[]) => mockReadPeerFeedback(...args),
  savePeerFeedback: (...args: any[]) => mockSavePeerFeedback(...args),
}));
jest.mock("../../../src/lib/relationshipReview/repository", () => ({
  readFeedback: (...args: any[]) => mockReadFeedback(...args),
  saveFeedback: (...args: any[]) => mockSaveFeedback(...args),
}));
jest.mock("../../../src/lib/relationshipReview/package", () => ({
  relationshipPackages: () => [
    { version: "peer-v1", directory: "fixture-only" },
  ],
}));
jest.mock("../../../src/lib/relationshipReview/dataset", () => ({
  getRelationshipDataset: (version?: string) => ({
    dataset: { version: version || "peer-v1", cases: [{ id: "peer-case" }] },
    sha256: "a".repeat(64),
  }),
  getRelationshipTrace: jest.fn(),
}));
jest.mock("../../../src/lib/relationshipReview/presentation", () => ({
  getRelationshipPresentation: () => ({
    presentation: { version: "mock-p1", selectedCaseIds: [] },
    sha256: "c".repeat(64),
  }),
  getPresentationTrace: jest.fn(),
}));
jest.mock("../../../src/lib/relationshipReview/context", () => ({
  relationshipContext: jest.fn(),
}));
jest.mock("../../../src/lib/relationshipReview/evidence", () => ({
  relationshipSourceEvidence: jest.fn(),
}));
jest.mock("../../../src/lib/relationshipReview/trace", () => ({
  relationshipTraceDisclosure: jest.fn(),
}));

const VERSION = "peer-v1",
  DATASET_SHA = "a".repeat(64),
  CASE_ID = "peer-case";
const REQUEST_ID = "53f33252-9fdb-4d73-8d66-1308ea309b11";
const TOM = {
  uid: "mock-tom-uid",
  email: "malone@mit.edu",
  email_verified: true,
};
const ROB = { uid: "mock-rob-uid", email: "rjl@mit.edu", email_verified: true };
const UIDS = { tom: TOM.uid, rob: ROB.uid };
const PEERS = [
  { reviewer: "tom", target: "rob", user: TOM },
  { reviewer: "rob", target: "tom", user: ROB },
] as const;
const COORDINATORS = [
  {
    uid: "mock-coordinator-1",
    email: "oneweb@umich.edu",
    email_verified: true,
  },
  { uid: "mock-coordinator-2", email: "oneman@mit.edu", email_verified: true },
];
const READERS = [
  ...PEERS.map(({ reviewer, user }) => ({ reviewer, user })),
  ...COORDINATORS.map((user) => ({ reviewer: null, user })),
];
const PEER_ACTIONS = ["peer-feedback", "save-peer"] as const;
let accounts: Record<string, any>;

function key(uid: string) {
  return createHash("sha256").update(uid).digest("hex");
}
function scope() {
  return {
    datasetVersion: VERSION,
    datasetSha256: DATASET_SHA,
    caseId: CASE_ID,
  };
}
function original(reviewer: PeerReviewer): RelationshipFeedback {
  return {
    caseId: CASE_ID,
    datasetVersion: VERSION,
    decision: "discuss",
    note: `Mock ${reviewer} original`,
    correction: "Mock correction",
    revision: 3,
    savedAt: "2026-06-01T00:00:00.000Z",
    revisitLater: false,
    presentationSha256: "c".repeat(64),
    presentationVersion: "mock-p1",
  };
}
function peerResponse() {
  return {
    ...scope(),
    reviewers: (["tom", "rob"] as const).map((reviewer) => {
      const feedback = original(reviewer);
      return {
        reviewer,
        label: reviewer === "tom" ? "Tom" : "Rob",
        feedback,
        feedbackSha256: targetFeedbackHash(feedback),
        response: null,
      };
    }),
  };
}
function writeFields(
  user: { uid: string } = TOM,
  target: PeerReviewer = "rob",
) {
  return {
    reviewerKey: key(user.uid),
    targetReviewer: target,
    targetRevision: 3,
    targetFeedbackSha256: targetFeedbackHash(original(target)),
    decision: "agree",
    note: "  peer note\r\n  ",
    revision: 0,
    requestId: REQUEST_ID,
  };
}
function saveBody(user: { uid: string } = TOM, target: PeerReviewer = "rob") {
  return { ...scope(), ...writeFields(user, target) };
}
async function call(
  action: string,
  body: unknown = scope(),
  user: any = TOM,
  options: {
    authorization?: string | null;
    method?: string;
    origin?: string;
  } = {},
) {
  if (user instanceof Error) mockVerifyIdToken.mockRejectedValue(user);
  else mockVerifyIdToken.mockResolvedValue(user);
  const headers: Record<string, string> = { host: "review.test" };
  if (options.authorization !== null)
    headers.authorization = options.authorization ?? "Bearer unit-test-token";
  if (options.origin) headers.origin = options.origin;
  let status = 200,
    data: any;
  const res = {
    setHeader: jest.fn(),
    status(value: number) {
      status = value;
      return this;
    },
    json(value: unknown) {
      data = value;
      return this;
    },
  };
  await relationshipReviewHandler(
    {
      method: options.method ?? "POST",
      query: { action },
      body,
      headers,
      socket: {},
    } as any,
    res as any,
  );
  return { status, data, headers: res.setHeader };
}
function noRepositoryAccess() {
  expect(mockReadPeerFeedback).not.toHaveBeenCalled();
  expect(mockSavePeerFeedback).not.toHaveBeenCalled();
  expect(mockReadFeedback).not.toHaveBeenCalled();
  expect(mockSaveFeedback).not.toHaveBeenCalled();
}

beforeEach(() => {
  jest.resetAllMocks();
  mockLocalPreviewEnabled.mockReturnValue(false);
  accounts = {
    [TOM.email]: {
      uid: TOM.uid,
      email: TOM.email,
      emailVerified: true,
      disabled: false,
    },
    [ROB.email]: {
      uid: ROB.uid,
      email: ROB.email,
      emailVerified: true,
      disabled: false,
    },
  };
  mockGetUserByEmail.mockImplementation(async (email: string) => {
    const account = accounts[email];
    if (!account)
      throw Object.assign(new Error("No fixture account"), {
        code: "auth/user-not-found",
      });
    return { ...account };
  });
  mockReadFeedback.mockResolvedValue({});
  mockReadPeerFeedback.mockResolvedValue(peerResponse());
  mockSavePeerFeedback.mockResolvedValue({ revision: 1 });
});
afterEach(() => {
  expect(mockSaveFeedback).not.toHaveBeenCalled();
});

test.each(READERS)(
  "$user.email can read, with server-derived peer role and no writes",
  async ({ user, reviewer }) => {
    const session = await call("session", {}, user);
    expect(session.status).toBe(200);
    expect(session.data).toMatchObject({
      peerReviewer: reviewer,
      canViewPeerFeedback: true,
      preview: false,
      reviewerKey: key(user.uid),
    });
    expect(mockReadFeedback).toHaveBeenCalledWith(
      user.uid,
      VERSION,
      false,
      DATASET_SHA,
    );
    expect(mockGetUserByEmail).not.toHaveBeenCalled();
    const result = await call("peer-feedback", Object.freeze(scope()), user);
    expect(result.status).toBe(200);
    expect(result.data).toEqual(peerResponse());
    expect(mockReadPeerFeedback).toHaveBeenCalledTimes(1);
    expect(mockReadPeerFeedback).toHaveBeenCalledWith(UIDS, scope());
    expect(
      mockGetUserByEmail.mock.calls.map(([email]) => email).sort(),
    ).toEqual([TOM.email, ROB.email].sort());
    expect(mockVerifyIdToken).toHaveBeenCalledWith("unit-test-token", true);
    expect(mockSavePeerFeedback).not.toHaveBeenCalled();
    expect(result.headers).toHaveBeenCalledWith(
      "Cache-Control",
      "private, no-store",
    );
    expect(result.headers).toHaveBeenCalledWith("Vary", "Authorization");
  },
);

test.each(PEERS)(
  "$reviewer can save a fresh response only as the authenticated actor and to the resolved other UID",
  async ({ reviewer, target, user }) => {
    const signedIn = {
      ...user,
      email: user.email.toUpperCase(),
      name: "Mock active reviewer",
    };
    accounts[user.email].email = signedIn.email;
    const session = await call("session", {}, signedIn);
    const overview = await call("peer-feedback", scope(), signedIn);
    expect(session.status).toBe(200);
    expect(overview.status).toBe(200);
    const row = overview.data.reviewers.find(
      (entry: any) => entry.reviewer === target,
    );
    const body = Object.freeze({
      ...saveBody(signedIn, target),
      reviewerKey: session.data.reviewerKey,
      targetRevision: row.feedback.revision,
      targetFeedbackSha256: row.feedbackSha256,
    });
    const result = await call("save-peer", body, signedIn);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ answer: { revision: 1 } });
    expect(mockSavePeerFeedback).toHaveBeenCalledTimes(1);
    expect(mockSavePeerFeedback).toHaveBeenCalledWith(
      user.uid,
      reviewer,
      UIDS[target],
      { ...body },
    );
    expect(mockSavePeerFeedback.mock.calls[0][3]).not.toBe(body);
    expect(mockSavePeerFeedback.mock.calls[0][3].note).toBe(
      "  peer note\r\n  ",
    );
    expect(mockReadPeerFeedback).toHaveBeenCalledTimes(1);
    expect(
      mockGetUserByEmail.mock.calls.map(([email]) => email).sort(),
    ).toEqual([TOM.email, ROB.email, TOM.email, ROB.email].sort());
  },
);

test.each(COORDINATORS)(
  "$email is read-only even with a valid peer save payload",
  async (user) => {
    expect((await call("save-peer", saveBody(user, "tom"), user)).status).toBe(
      403,
    );
    expect(mockGetUserByEmail).not.toHaveBeenCalled();
    noRepositoryAccess();
  },
);

test.each(PEERS)(
  "$reviewer cannot self-respond through HTTP",
  async ({ reviewer, user }) => {
    const result = await call("save-peer", saveBody(user, reviewer), user);
    expect(result.status).toBe(400);
    expect(result.data.error).toMatch(/own original feedback/);
    expect(mockGetUserByEmail).not.toHaveBeenCalled();
    noRepositoryAccess();
  },
);

test.each(PEERS)(
  "$reviewer cannot use the other actor's valid SHA reviewerKey",
  async ({ target, user }) => {
    const result = await call(
      "save-peer",
      { ...saveBody(user, target), reviewerKey: key(UIDS[target]) },
      user,
    );
    expect(result.status).toBe(409);
    expect(result.data.code).toBe("account_changed");
    expect(mockGetUserByEmail).not.toHaveBeenCalled();
    noRepositoryAccess();
  },
);

test.each(
  PEERS.flatMap((peer) => PEER_ACTIONS.map((action) => ({ ...peer, action }))),
)(
  "$reviewer $action rejects a signed-in UID not owned by its approved email",
  async ({ reviewer, target, user, action }) => {
    const changed = { ...user, uid: `mock-retired-${reviewer}` };
    const body = action === "save-peer" ? saveBody(changed, target) : scope();
    const result = await call(action, body, changed);
    expect(result.status).toBe(409);
    expect(result.data.code).toBe("account_changed");
    expect(mockGetUserByEmail).toHaveBeenCalledWith(TOM.email);
    expect(mockGetUserByEmail).toHaveBeenCalledWith(ROB.email);
    noRepositoryAccess();
  },
);

test.each([
  ["disabled target", ROB.email, { disabled: true }],
  ["unverified target", ROB.email, { emailVerified: false }],
  ["missing target verification", ROB.email, { emailVerified: undefined }],
  ["wrong target email mapping", ROB.email, { email: "not-rob@example.test" }],
  ["missing target UID", ROB.email, { uid: "" }],
  ["QA target UID", ROB.email, { uid: "software-qa:rob" }],
  ["shared reviewer UID", ROB.email, { uid: TOM.uid }],
  ["disabled actor account", TOM.email, { disabled: true }],
  ["unverified actor account", TOM.email, { emailVerified: false }],
] as Array<[string, string, Record<string, unknown>]>)(
  "%s is unavailable for both peer actions",
  async (_label, email, patch) => {
    accounts[email] = { ...accounts[email], ...patch };
    for (const action of PEER_ACTIONS) {
      expect(
        (await call(action, action === "save-peer" ? saveBody() : scope()))
          .status,
      ).toBe(403);
    }
    noRepositoryAccess();
  },
);

test("a missing approved target account is denied, not replaced by a body-provided account", async () => {
  accounts[ROB.email] = null;
  for (const action of PEER_ACTIONS) {
    expect(
      (await call(action, action === "save-peer" ? saveBody() : scope()))
        .status,
    ).toBe(403);
  }
  noRepositoryAccess();
});

test.each([
  { label: "unverified Tom", user: { ...TOM, email_verified: false } },
  {
    label: "Rob without verification claim",
    user: { uid: ROB.uid, email: ROB.email },
  },
  {
    label: "truthy nonboolean verification",
    user: { ...TOM, email_verified: "true" },
  },
  {
    label: "unverified coordinator",
    user: { ...COORDINATORS[0], email_verified: false },
  },
  {
    label: "uninvited account",
    user: { ...TOM, email: "uninvited@example.test" },
  },
  {
    label: "lookalike email domain",
    user: { ...TOM, email: "malone@mit.edu.evil.test" },
  },
  { label: "whitespace email alias", user: { ...ROB, email: "rjl@mit.edu " } },
])("$label cannot read or write peer feedback", async ({ user }) => {
  for (const action of PEER_ACTIONS) {
    expect(
      (
        await call(
          action,
          action === "save-peer" ? saveBody(user) : scope(),
          user,
        )
      ).status,
    ).toBe(403);
  }
  expect(mockGetUserByEmail).not.toHaveBeenCalled();
  noRepositoryAccess();
});

test("anonymous requests cannot read or write peer feedback", async () => {
  for (const action of PEER_ACTIONS) {
    expect(
      (
        await call(action, action === "save-peer" ? saveBody() : scope(), TOM, {
          authorization: null,
        })
      ).status,
    ).toBe(401);
  }
  expect(mockVerifyIdToken).not.toHaveBeenCalled();
  expect(mockGetUserByEmail).not.toHaveBeenCalled();
  noRepositoryAccess();
});

test("invalid or revoked tokens are rejected with revocation checking enabled", async () => {
  for (const action of PEER_ACTIONS) {
    expect(
      (
        await call(
          action,
          action === "save-peer" ? saveBody() : scope(),
          new Error("revoked fixture token"),
        )
      ).status,
    ).toBe(401);
  }
  expect(mockVerifyIdToken).toHaveBeenCalledWith("unit-test-token", true);
  expect(mockGetUserByEmail).not.toHaveBeenCalled();
  noRepositoryAccess();
});

test("local preview cannot impersonate either peer or access their feedback", async () => {
  mockLocalPreviewEnabled.mockReturnValue(true);
  for (const action of PEER_ACTIONS) {
    expect(
      (
        await call(action, action === "save-peer" ? saveBody() : scope(), TOM, {
          authorization: null,
        })
      ).status,
    ).toBe(403);
  }
  expect(mockVerifyIdToken).not.toHaveBeenCalled();
  expect(mockGetUserByEmail).not.toHaveBeenCalled();
  noRepositoryAccess();
});

test.each([
  ["null body", null, 400],
  ["array body", [], 400],
  ["missing version", { datasetSha256: DATASET_SHA, caseId: CASE_ID }, 400],
  ["missing SHA", { datasetVersion: VERSION, caseId: CASE_ID }, 400],
  ["unknown version", { ...scope(), datasetVersion: "peer-v2" }, 409],
  ["wrong snapshot SHA", { ...scope(), datasetSha256: "d".repeat(64) }, 409],
  ["short SHA", { ...scope(), datasetSha256: "sha" }, 400],
  ["uppercase SHA", { ...scope(), datasetSha256: "A".repeat(64) }, 400],
  ["unknown case", { ...scope(), caseId: "missing" }, 400],
  ["path case", { ...scope(), caseId: "../outside" }, 400],
] as Array<[string, unknown, number]>)(
  "%s is rejected before account lookup or repository access",
  async (_label, body, status) => {
    for (const action of PEER_ACTIONS) {
      const input =
        action === "save-peer" &&
        body !== null &&
        typeof body === "object" &&
        !Array.isArray(body)
          ? { ...(body as Record<string, unknown>), ...writeFields() }
          : body;
      expect((await call(action, input)).status).toBe(status);
    }
    expect(mockGetUserByEmail).not.toHaveBeenCalled();
    noRepositoryAccess();
  },
);

test.each([
  "uid",
  "email",
  "authorReviewer",
  "targetUid",
  "targetEmail",
  "targetFeedback",
  "savedAt",
  "presentationSha256",
  "__proto__",
])("injected %s is rejected by both HTTP peer actions", async (field) => {
  for (const action of PEER_ACTIONS) {
    const body = action === "save-peer" ? saveBody() : scope();
    expect((await call(action, { ...body, [field]: "injected" })).status).toBe(
      400,
    );
  }
  expect(mockGetUserByEmail).not.toHaveBeenCalled();
  noRepositoryAccess();
});

test("a peer read containing save fields is rejected rather than creating a response", async () => {
  expect((await call("peer-feedback", saveBody())).status).toBe(400);
  expect(mockGetUserByEmail).not.toHaveBeenCalled();
  noRepositoryAccess();
});

test.each(PEER_ACTIONS)(
  "%s remains POST-only and rejects cross-origin access before authentication",
  async (action) => {
    const body = action === "save-peer" ? saveBody() : scope();
    const get = await call(action, body, TOM, { method: "GET" });
    expect(get.status).toBe(405);
    expect(get.headers).toHaveBeenCalledWith("Allow", "POST");
    expect(
      (await call(action, body, TOM, { origin: "https://evil.example.test" }))
        .status,
    ).toBe(403);
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
    expect(mockGetUserByEmail).not.toHaveBeenCalled();
    noRepositoryAccess();
  },
);
