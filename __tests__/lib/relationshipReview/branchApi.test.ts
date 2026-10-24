import { createHash } from "crypto";
import { relationshipReviewHandler } from "../../../src/lib/relationshipReview/api";
import { RelationshipError } from "../../../src/lib/relationshipReview/feedback";
import { GENERALIZATION_BRANCH_VERSION } from "../../../src/types/IBranchReview";
import type { BranchDataset, BranchSaveRequest } from "../../../src/types/IBranchReview";
import { relationshipFeedbackSnapshotJson } from "../../../src/types/IRelationshipReview";
import type { PeerReviewer, RelationshipFeedback, SavePeerFeedbackRequest } from "../../../src/types/IRelationshipReview";

const mockVerifyIdToken = jest.fn(),
  mockGetUserByEmail = jest.fn(),
  mockLocalPreviewEnabled = jest.fn(),
  mockReadFeedback = jest.fn(),
  mockSaveFeedback = jest.fn(),
  mockReadPeerFeedback = jest.fn(),
  mockSavePeerFeedback = jest.fn(),
  mockGetBranchDataset = jest.fn(),
  mockGetBranchTrace = jest.fn(),
  mockBranchContext = jest.fn(),
  mockLegacyDataset = jest.fn(),
  mockLegacyPackages = jest.fn();

jest.mock("../../../src/lib/firestoreServer/admin", () => ({
  admin: { auth: () => ({ verifyIdToken: mockVerifyIdToken, getUserByEmail: mockGetUserByEmail }) },
}));
jest.mock("../../../src/lib/titleValidation/repository", () => ({
  localPreviewEnabled: (...a: any[]) => mockLocalPreviewEnabled(...a),
}));
jest.mock("../../../src/lib/relationshipReview/branchDataset", () => ({
  getBranchDataset: (...a: any[]) => mockGetBranchDataset(...a),
  getBranchTrace: (...a: any[]) => mockGetBranchTrace(...a),
}));
jest.mock("../../../src/lib/relationshipReview/branchContext", () => ({
  branchContext: (...a: any[]) => mockBranchContext(...a),
}));
jest.mock("../../../src/lib/relationshipReview/repository", () => ({
  readFeedback: (...a: any[]) => mockReadFeedback(...a),
  saveFeedback: (...a: any[]) => mockSaveFeedback(...a),
}));
jest.mock("../../../src/lib/relationshipReview/peerRepository", () => ({
  readPeerFeedback: (...a: any[]) => mockReadPeerFeedback(...a),
  savePeerFeedback: (...a: any[]) => mockSavePeerFeedback(...a),
}));
jest.mock("../../../src/lib/relationshipReview/dataset", () => ({
  getRelationshipDataset: (...a: any[]) => mockLegacyDataset(...a),
  getRelationshipTrace: jest.fn(),
}));
jest.mock("../../../src/lib/relationshipReview/package", () => ({
  relationshipPackages: () => mockLegacyPackages(),
}));
jest.mock("../../../src/lib/relationshipReview/presentation", () => ({
  getRelationshipPresentation: jest.fn(), getPresentationTrace: jest.fn(),
}));
jest.mock("../../../src/lib/relationshipReview/context", () => ({ relationshipContext: jest.fn() }));
jest.mock("../../../src/lib/relationshipReview/trace", () => ({ relationshipTraceDisclosure: jest.fn() }));
jest.mock("../../../src/lib/relationshipReview/evidence", () => ({ relationshipSourceEvidence: jest.fn() }));

const VERSION = GENERALIZATION_BRANCH_VERSION,
  SHA = "a".repeat(64),
  LEGACY_VERSION = "synthetic-child-v1",
  LEGACY_SHA = "b".repeat(64),
  FAMILY_ID = "synthetic-family",
  CHILD_ID = "synthetic-child",
  GROUP_ID = "synthetic-group",
  PREVIEW_UID = "relationship-local-preview",
  STAMP = "2026-10-24T00:00:00.000Z";
const uids = { tom: "verified-tom", rob: "verified-rob" };
const users = {
  tom: { uid: uids.tom, email: "malone@mit.edu", email_verified: true, name: "Verified Tom" },
  rob: { uid: uids.rob, email: "rjl@mit.edu", email_verified: true, name: "Verified Rob" },
};
const actions = [
  "branch-session", "branch-save", "branch-trace", "branch-context",
  "branch-peer-feedback", "branch-save-peer",
];
const nonSessionActions = actions.filter((action) => action !== "branch-session");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

const dataset: BranchDataset = {
  schemaVersion: "generalization-branch-review-v1",
  version: VERSION, title: "Synthetic family review", createdAt: STAMP,
  model: "synthetic", modelVersion: "synthetic-v1", reasoning: "Synthetic fixture",
  fundingRoute: "ACCESS", sourceApp: "synthetic",
  sourceCapturedAt: STAMP, sourceRecheckedAt: STAMP, sourceSha256: "c".repeat(64),
  priorDatasetVersion: LEGACY_VERSION, priorDatasetSha256: LEGACY_SHA,
  scopeNote: "Synthetic families only", titleStatusNote: "Synthetic title status",
  nounNote: "Synthetic noun evidence", prompt: "Synthetic prompt",
  criticPrompts: ["Synthetic critic one", "Synthetic critic two"],
  families: [{
    id: FAMILY_ID, title: "Synthetic family", description: "Synthetic description",
    generalizations: [], currentSpecializations: [{ id: CHILD_ID, title: "Synthetic child" }],
    currentSourceRecords: [], summary: "Synthetic arrangement", scopeNote: "Synthetic scope",
    groups: [{
      id: GROUP_ID, node: { id: GROUP_ID, title: "Synthetic group" },
      summary: "Synthetic grouping", coherence: "Synthetic coherence", eligible: true,
      members: [{
        node: { id: CHILD_ID, title: "Synthetic child" }, decision: "include",
        reason: "Synthetic kind-of example", titleDependency: "none-observed",
        currentGeneralizations: [{ id: FAMILY_ID, title: "Synthetic family" }],
        nounEvidenceNote: "Synthetic evidence", sourceRecords: [],
      }],
      remainingQuestions: [],
    }],
    sourceCaseIds: [CHILD_ID], remainingQuestions: [],
  }],
};
const vote: RelationshipFeedback = {
  caseId: FAMILY_ID, datasetVersion: VERSION, decision: "discuss", revisitLater: false,
  note: "Synthetic family note", correction: "", revision: 2, savedAt: STAMP,
};
const targetHash = hash(relationshipFeedbackSnapshotJson(vote));
const savedAnswer = { ...vote, revision: vote.revision + 1 };
const savedPeerAnswer = { revision: 1 };
const query = { datasetVersion: VERSION, datasetSha256: SHA, caseId: FAMILY_ID };
const peerResponse = { ...query, reviewers: [] };

function saveBody(uid = uids.tom): BranchSaveRequest {
  return {
    ...query, reviewerKey: hash(uid), decision: "discuss", revisitLater: false,
    note: vote.note, correction: "", revision: vote.revision,
    requestId: "0123456789abcdef",
  };
}
function peerBody(author: PeerReviewer = "tom"): SavePeerFeedbackRequest {
  return {
    ...query, reviewerKey: hash(uids[author]),
    targetReviewer: author === "tom" ? "rob" : "tom",
    targetRevision: vote.revision, targetFeedbackSha256: targetHash,
    decision: "agree", note: "Synthetic peer response", revision: 0,
    requestId: "fedcba9876543210",
  };
}
function bodyFor(action: string) {
  return action === "branch-save" ? saveBody()
    : action === "branch-save-peer" ? peerBody() : { ...query };
}

async function call(
  action = "branch-session",
  body: any = {},
  options: { user?: any; headers?: Record<string, string>; method?: string; remoteAddress?: string } = {},
) {
  if (options.user !== undefined) mockVerifyIdToken.mockResolvedValue(options.user);
  let code = 200, data: any;
  const res: any = {
    setHeader: jest.fn(),
    status(n: number) { code = n; return this; },
    json(value: any) { data = value; return this; },
  };
  await relationshipReviewHandler({
    method: options.method ?? "POST", query: { action }, body,
    headers: options.headers ?? {
      authorization: "Bearer test-token", host: "review-service.a.run.app",
      origin: "https://ontology.mit.edu",
    },
    socket: { remoteAddress: options.remoteAddress ?? "203.0.113.10" },
  } as any, res);
  expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
  expect(res.setHeader).toHaveBeenCalledWith("Vary", "Authorization");
  expect(mockLegacyPackages).not.toHaveBeenCalled();
  expect(mockLegacyDataset).not.toHaveBeenCalled();
  return { code, data, headers: res.setHeader };
}
function expectNoWrites() {
  expect(mockSaveFeedback).not.toHaveBeenCalled();
  expect(mockSavePeerFeedback).not.toHaveBeenCalled();
}
function expectNoRepositoryAccess() {
  expect(mockReadFeedback).not.toHaveBeenCalled();
  expect(mockReadPeerFeedback).not.toHaveBeenCalled();
  expectNoWrites();
}
function expectBlockedBeforeDataset() {
  expect(mockGetBranchDataset).not.toHaveBeenCalled();
  expect(mockGetUserByEmail).not.toHaveBeenCalled();
  expectNoRepositoryAccess();
}

beforeEach(() => {
  jest.resetAllMocks();
  mockLocalPreviewEnabled.mockReturnValue(false);
  mockVerifyIdToken.mockResolvedValue(users.tom);
  mockGetUserByEmail.mockImplementation(async (email: string) => {
    if (email !== "malone@mit.edu" && email !== "rjl@mit.edu")
      throw new Error("Unexpected peer lookup.");
    const reviewer: PeerReviewer = email === "malone@mit.edu" ? "tom" : "rob";
    return { uid: uids[reviewer], email, emailVerified: true, disabled: false };
  });
  mockGetBranchDataset.mockReturnValue({ dataset, sha256: SHA });
  mockReadFeedback.mockResolvedValue({ [FAMILY_ID]: vote });
  mockSaveFeedback.mockResolvedValue(savedAnswer);
  mockReadPeerFeedback.mockResolvedValue(peerResponse);
  mockSavePeerFeedback.mockResolvedValue(savedPeerAnswer);
  mockLegacyPackages.mockReturnValue([{ version: LEGACY_VERSION }]);
  mockLegacyDataset.mockReturnValue({
    dataset: { version: LEGACY_VERSION, cases: [{ id: CHILD_ID }] }, sha256: LEGACY_SHA,
  });
});

test("branch-context leaves omitted pagination options absent", async () => {
  const result = await call("branch-context", bodyFor("branch-context"));
  expect(result.code).toBe(200);
  expect(mockBranchContext).toHaveBeenCalledWith(dataset, SHA, FAMILY_ID, {});
  expectNoWrites();
});

test("branch-context forwards explicit invalid values for context validation", async () => {
  mockBranchContext.mockImplementation(() => {
    throw new RelationshipError(400, "Invalid context limit.");
  });
  const result = await call("branch-context", { ...query, limit: null });
  expect(result.code).toBe(400);
  expect(mockBranchContext).toHaveBeenCalledWith(dataset, SHA, FAMILY_ID, { limit: null });
  expectNoWrites();
});

test("branch-session defaults to the pinned family snapshot and only reads", async () => {
  const result = await call("branch-session", {
    uid: "forged", reviewerLabel: "Forged", preview: true, peerReviewer: "rob",
  });
  expect(result.code).toBe(200);
  expect(result.data).toEqual({
    dataset, datasetSha256: SHA, reviewerKey: hash(uids.tom), reviewerLabel: users.tom.name,
    feedback: { [FAMILY_ID]: vote }, preview: false, peerReviewer: "tom",
    canViewPeerFeedback: true, legacy: { version: LEGACY_VERSION, sha256: LEGACY_SHA },
  });
  expect(mockGetBranchDataset).toHaveBeenCalledWith(undefined);
  expect(mockReadFeedback).toHaveBeenCalledWith(uids.tom, VERSION, false, SHA);
  expect((await call("branch-session", { datasetVersion: VERSION, datasetSha256: SHA })).code).toBe(200);
  expect(mockGetBranchDataset).toHaveBeenLastCalledWith(VERSION);
  expect(mockVerifyIdToken).toHaveBeenCalledWith("test-token", true);
  expect(mockVerifyIdToken).toHaveBeenCalledTimes(2);
  expectNoWrites();
});

test.each(actions)("%s keeps outer auth and origin gates ahead of branch loading", async (action) => {
  const body = {
    ...bodyFor(action), uid: uids.tom, previewReviewer: "tom", preview: true,
    peerReviewer: "tom", canViewPeerFeedback: true,
  };
  expect((await call(action, body, { headers: { host: "review-service.a.run.app" } })).code).toBe(401);
  mockLocalPreviewEnabled.mockReturnValue(true);
  expect((await call(action, body, { headers: {
    authorization: "Bearer test-token", host: "review-service.a.run.app",
    origin: "https://attacker.example", "x-forwarded-host": "ontology.mit.edu",
  } })).code).toBe(403);
  expect(mockVerifyIdToken).not.toHaveBeenCalled();
  expectBlockedBeforeDataset();
});

test.each([
  { uid: uids.tom, email: "malone@mit.edu", email_verified: false },
  { uid: "uninvited", email: "outsider@example.test", email_verified: true },
])("unverified or uninvited accounts cannot load a family session: %s", async (user) => {
  expect((await call("branch-session", { uid: uids.tom }, { user })).code).toBe(403);
  expect(mockVerifyIdToken).toHaveBeenCalledWith("test-token", true);
  expectBlockedBeforeDataset();
});

test("method and invalid-token failures retain the outer response wrapper", async () => {
  const method = await call("branch-session", {}, { method: "GET" });
  expect(method.code).toBe(405);
  expect(method.headers).toHaveBeenCalledWith("Allow", "POST");
  expect(mockVerifyIdToken).not.toHaveBeenCalled();
  mockVerifyIdToken.mockRejectedValueOnce(new Error("Invalid token"));
  expect((await call()).code).toBe(401);
  expectBlockedBeforeDataset();
});

test("local preview reads and saves under its server-selected identity", async () => {
  mockLocalPreviewEnabled.mockReturnValue(true);
  const options = { headers: { host: "localhost:3000" }, remoteAddress: "127.0.0.1" };
  const session = await call("branch-session", {
    uid: uids.rob, previewReviewer: "rob", peerReviewer: "rob", preview: false,
  }, options);
  expect(session.code).toBe(200);
  expect(session.data).toMatchObject({
    reviewerKey: hash(PREVIEW_UID), reviewerLabel: "Local preview", preview: true,
    peerReviewer: null, canViewPeerFeedback: false,
  });
  expect(mockLocalPreviewEnabled).toHaveBeenCalledWith("localhost:3000", "127.0.0.1");
  expect(mockReadFeedback).toHaveBeenCalledWith(PREVIEW_UID, VERSION, true, SHA);
  const body = { ...saveBody(PREVIEW_UID), uid: uids.tom, preview: false };
  expect((await call("branch-save", body, options)).code).toBe(200);
  expect(mockSaveFeedback).toHaveBeenCalledWith(PREVIEW_UID, expect.objectContaining({
    ...query, revision: body.revision, requestId: body.requestId,
  }), true);
  expect(mockVerifyIdToken).not.toHaveBeenCalled();
  expect(mockGetUserByEmail).not.toHaveBeenCalled();
  expect(mockSavePeerFeedback).not.toHaveBeenCalled();
});

test.each(["branch-peer-feedback", "branch-save-peer"])("%s is unavailable in preview despite claimed privileges", async (action) => {
  mockLocalPreviewEnabled.mockReturnValue(true);
  const result = await call(action, {
    ...bodyFor(action), uid: uids.tom, peerReviewer: "tom", canViewPeerFeedback: true,
  }, { headers: { host: "localhost:3000" }, remoteAddress: "127.0.0.1" });
  expect(result.code).toBe(403);
  expect(mockVerifyIdToken).not.toHaveBeenCalled();
  expectBlockedBeforeDataset();
});

test.each([
  ["old child version", { datasetVersion: LEGACY_VERSION }, 409],
  ["non-string version", { datasetVersion: 1 }, 400],
  ["malformed hash", { datasetSha256: "bad" }, 400],
  ["uppercase hash", { datasetSha256: SHA.toUpperCase() }, 400],
  ["stale snapshot", { datasetSha256: "f".repeat(64) }, 409],
  ["non-object body", null, 400],
] as [string, unknown, number][])("branch-session rejects %s without repository access", async (_label, body, status) => {
  expect((await call("branch-session", body)).code).toBe(status);
  expectNoRepositoryAccess();
});

test.each(nonSessionActions)("%s requires both version and snapshot hash", async (action) => {
  const withoutVersion: any = { ...bodyFor(action) };
  delete withoutVersion.datasetVersion;
  const withoutHash: any = { ...bodyFor(action) };
  delete withoutHash.datasetSha256;
  expect((await call(action, withoutVersion)).code).toBe(400);
  expect((await call(action, withoutHash)).code).toBe(400);
  expectBlockedBeforeDataset();
});

test.each(nonSessionActions)("%s rejects child, group, and differently cased family IDs", async (action) => {
  for (const caseId of [CHILD_ID, GROUP_ID, FAMILY_ID.toUpperCase()])
    expect((await call(action, { ...bodyFor(action), caseId })).code).toBe(400);
 });
