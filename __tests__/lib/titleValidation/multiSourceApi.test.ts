import handler from "../../../src/pages/api/som-review/multi-source-title-review";
import { db } from "../../../src/lib/firestoreServer/admin";
import { actorFor } from "../../../src/lib/titleValidation/api";
import { TitleValidationError } from "../../../src/lib/titleValidation/engine";
import {
  MULTI_SOURCE_COMMENT_LIMIT,
  MULTI_SOURCE_STUDY_ID,
  MultiSourceReview,
} from "../../../src/lib/titleValidation/multiSourceContract";

jest.mock("../../../src/lib/firestoreServer/admin", () => ({
  db: { collection: jest.fn(), runTransaction: jest.fn() },
}));
jest.mock("../../../src/lib/titleValidation/api", () => ({ actorFor: jest.fn() }));

const roster = [
  { reviewerId: "rob", label: "Rob" },
  { reviewerId: "vivian", label: "Vivian" },
  { reviewerId: "sophia", label: "Sophia" },
];
const cases = Array.from({ length: 25 }, (_, index) => ({
  id: `activity-${index + 1}`,
  originalTitle: "Original title",
  reason: "Proposed grouping rationale",
  descriptions: [
    { number: 1, sourceId: "123", text: "First description" },
    { number: 2, sourceId: "456", text: "Second description" },
  ],
  groups: [
    { id: "group-1", title: "First title", descriptionNumbers: [1, 2], reason: "First reason" },
    { id: "group-2", title: "Second title", descriptionNumbers: [2], reason: "Second reason" },
  ],
}));
const payload = {
  version: MULTI_SOURCE_STUDY_ID,
  caseId: cases[0].id,
  titles: {
    "group-1": { rating: "acceptable", comment: "" },
    "group-2": { rating: "unsure", comment: "Needs the source qualifier." },
  },
  categorization: { rating: "not_acceptable", comment: "Move source 2." },
  expectedRevision: 0,
};

let records: Map<string, MultiSourceReview>;
let getOwnReviews: jest.Mock;
let setReview: jest.Mock;
const priorRelease = process.env.TITLE_VALIDATION_RELEASED;

function signIn(uid: string, canManage = false) {
  jest.mocked(actorFor).mockResolvedValue({ uid, label: uid, canManage, preview: false });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TITLE_VALIDATION_RELEASED = "1";
  signIn("rob");
  records = new Map();
  getOwnReviews = jest.fn((uid: string) => ({
    docs: [...records].filter(([key]) => key.startsWith(`${uid}/`)).map(([key, value]) => ({
      id: key.split("/")[1], data: () => value,
    })),
  }));
  const studyRef = {
    get: async () => ({ data: () => ({ version: MULTI_SOURCE_STUDY_ID, roster, cases }) }),
    collection: (collection: string) => {
      expect(collection).toBe("reviews");
      return { doc: (uid: string) => ({ collection: (nestedCollection: string) => {
        expect(nestedCollection).toBe("cases");
        return {
          get: async () => getOwnReviews(uid),
          doc: (caseId: string) => ({
            key: `${uid}/${caseId}`,
            get: async () => ({ data: () => records.get(`${uid}/${caseId}`) }),
          }),
        };
      } }) };
    },
  };
  (db.collection as jest.Mock).mockImplementation((collection: string) => {
    expect(collection).toBe("titleValidationStudiesV1");
    return { doc: (studyId: string) => {
      expect(studyId).toBe(MULTI_SOURCE_STUDY_ID);
      return studyRef;
    } };
  });
  setReview = jest.fn((ref: { key: string }, value: MultiSourceReview) => records.set(ref.key, value));
  (db.runTransaction as jest.Mock).mockImplementation((callback) => callback({
    get: (ref: { get: () => unknown }) => ref.get(),
    set: setReview,
  }));
});

afterAll(() => {
  if (priorRelease === undefined) delete process.env.TITLE_VALIDATION_RELEASED;
  else process.env.TITLE_VALIDATION_RELEASED = priorRelease;
});

async function request(method: string, body?: unknown) {
  const res = { setHeader: jest.fn(), status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  await handler({ method, body } as any, res as any);
  expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store, private");
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
}

test.each(roster)("returns the same 25 cases to $label, with only their saved review", async ({ reviewerId, label }) => {
  signIn(reviewerId);
  const own: MultiSourceReview = {
    titles: { "group-1": { rating: "acceptable", comment: "" } },
    categorization: { rating: "unsure", comment: "Needs more context." },
    updatedAt: "2026-11-10T20:00:00Z",
    revision: 1,
  };
  const otherReviewer = reviewerId === "rob" ? "vivian" : "rob";
  records.set(`${reviewerId}/activity-1`, own);
  records.set(`${otherReviewer}/activity-2`, { ...own, revision: 5 });
  expect(await request("GET")).toEqual({ status: 200, body: {
    version: MULTI_SOURCE_STUDY_ID,
    reviewerLabel: label,
    cases,
    reviews: { "activity-1": own },
  } });
  expect(getOwnReviews).toHaveBeenCalledTimes(1);
  expect(getOwnReviews).toHaveBeenCalledWith(reviewerId);
  expect(setReview).not.toHaveBeenCalled();
});

test("denies unsigned, local preview, and unassigned accounts without reading review records", async () => {
  jest.mocked(actorFor).mockRejectedValueOnce(new TitleValidationError(401, "Sign in to use this review."));
  expect((await request("GET")).status).toBe(401);
  jest.mocked(actorFor).mockResolvedValueOnce({ uid: "rob", label: "Preview", canManage: true, preview: true });
  expect((await request("GET")).status).toBe(403);
  expect(db.collection).not.toHaveBeenCalled();
  signIn("other", true);
  expect((await request("GET")).status).toBe(403);
  expect((await request("POST", payload)).status).toBe(403);
  expect(getOwnReviews).not.toHaveBeenCalled();
  expect(setReview).not.toHaveBeenCalled();
});

test("requires a complete title-and-categorization review and rejects client reviewer IDs", async () => {
  expect((await request("POST", { ...payload, reviewerId: "vivian" })).status).toBe(400);
  expect((await request("POST", { ...payload, categorization: undefined })).status).toBe(400);
  expect((await request("POST", { ...payload, titles: { "group-1": payload.titles["group-1"] } })).status).toBe(400);
  expect((await request("POST", { ...payload, titles: {
    "group-1": payload.titles["group-1"], "wrong-group": payload.titles["group-2"],
  } })).status).toBe(400);
  expect((await request("POST", { ...payload, categorization: {
    rating: "acceptable", comment: "x".repeat(MULTI_SOURCE_COMMENT_LIMIT + 1),
  } })).status).toBe(400);
  expect((await request("POST", { ...payload, version: "old" })).status).toBe(409);
  expect((await request("POST", { ...payload, caseId: "absent-activity" })).status).toBe(404);
  expect(setReview).not.toHaveBeenCalled();
});

test("saves both rating types atomically, retries idempotently, and rejects a stale edit", async () => {
  const first = await request("POST", payload);
  expect(first).toEqual({ status: 200, body: {
    titles: payload.titles, categorization: payload.categorization,
    revision: 1, updatedAt: expect.any(String),
  } });
  expect(await request("POST", payload)).toEqual(first);
  expect(setReview).toHaveBeenCalledTimes(1);

  const edited = { ...payload, categorization: { rating: "acceptable", comment: "" } };
  expect((await request("POST", edited)).status).toBe(409);
  expect(records.get("rob/activity-1")).toEqual(first.body);
  expect((await request("POST", { ...edited, expectedRevision: 1 })).body).toMatchObject({
    revision: 2, titles: payload.titles, categorization: edited.categorization,
  });
  expect([...records.keys()]).toEqual(["rob/activity-1"]);
});
