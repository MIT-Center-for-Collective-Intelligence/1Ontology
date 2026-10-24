import { relationshipReviewHandler } from "../../../src/lib/relationshipReview/api";
import { RelationshipError } from "../../../src/lib/relationshipReview/feedback";

const mockVerifyIdToken = jest.fn();
const mockReadFeedback = jest.fn(async (..._args: unknown[]) => ({}));
const mockSaveFeedback = jest.fn(async (..._args: unknown[]) => ({
  revision: 1,
}));
const mockContext = jest.fn();
const mockDataset = jest.fn((version?: string) => ({
  dataset: { version: version || "v3", cases: [{ id: "reason" }] },
  sha256: "sha",
}));
const mockTrace = jest.fn();
const mockPresentation = jest.fn((..._args: unknown[]) => ({
  presentation: { version: "p1", selectedCaseIds: [] },
  sha256: "presentation-sha",
}));
jest.mock("../../../src/lib/firestoreServer/admin", () => ({
  admin: { auth: () => ({ verifyIdToken: mockVerifyIdToken }) },
}));
jest.mock("../../../src/lib/titleValidation/repository", () => ({
  localPreviewEnabled: () => false,
}));
jest.mock("../../../src/lib/relationshipReview/repository", () => ({
  readFeedback: (...args: any[]) => mockReadFeedback(...args),
  saveFeedback: (...args: any[]) => mockSaveFeedback(...args),
}));
jest.mock("../../../src/lib/relationshipReview/package", () => ({
  relationshipPackages: () => [
    { version: "v3", directory: "atomic-v3" },
    { version: "v1", directory: "atomic-v1" },
    { version: "legacy" },
  ],
}));
jest.mock("../../../src/lib/relationshipReview/dataset", () => ({
  getRelationshipDataset: (version?: string) => mockDataset(version),
  getRelationshipTrace: (...args: any[]) => mockTrace(...args),
}));
jest.mock("../../../src/lib/relationshipReview/presentation", () => ({
  getRelationshipPresentation: (...args: any[]) => mockPresentation(...args),
  getPresentationTrace: jest.fn(),
}));
jest.mock("../../../src/lib/relationshipReview/context", () => ({
  relationshipContext: (...args: any[]) => mockContext(...args),
}));

const body = { datasetVersion: "v3", datasetSha256: "sha", caseId: "reason" };
const invited = { uid: "tom", email: "malone@mit.edu", email_verified: true };
async function call(
  requestBody: any = body,
  user: any = invited,
  headers: any = { authorization: "Bearer test", host: "ontology.mit.edu" },
  method = "POST",
) {
  mockVerifyIdToken.mockResolvedValue(user);
  let code = 200;
  let data: any;
  const res: any = {
    setHeader: jest.fn(),
    status(value: number) {
      code = value;
      return this;
    },
    json(value: any) {
      data = value;
      return this;
    },
  };
  await relationshipReviewHandler(
    {
      method,
      query: { action: "context" },
      body: requestBody,
      headers,
      socket: {},
    } as any,
    res,
  );
  return { code, data, headers: res.setHeader };
}
beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyIdToken.mockReset();
  mockContext.mockReset();
  mockContext.mockImplementation((dataset, sha256, caseId) => ({
    available: dataset.version !== "legacy",
    caseId,
    datasetVersion: dataset.version,
    datasetSha256: sha256,
  }));
});

test.each(["malone@mit.edu", "oneweb@umich.edu", "oneman@mit.edu"])(
  "context keeps the existing verified-account access for %s and is read-only",
  async (email) => {
    const result = await call(
      {
        ...body,
        focusId: "proposed",
        activityOffset: 20,
        sourceOffset: 0,
        limit: 20,
      },
      { ...invited, email },
    );
    expect(result.code).toBe(200);
    expect(result.data).toEqual({ context: mockContext.mock.results[0].value });
    expect(mockVerifyIdToken).toHaveBeenCalledWith("test", true);
    expect(mockDataset).toHaveBeenCalledWith("v3");
    expect(mockContext).toHaveBeenCalledWith(
      expect.objectContaining({ version: "v3" }),
      "sha",
      "reason",
      { focusId: "proposed", activityOffset: 20, sourceOffset: 0, limit: 20 },
    );
    expect(mockSaveFeedback).not.toHaveBeenCalled();
    expect(mockReadFeedback).not.toHaveBeenCalled();
    expect(mockPresentation).not.toHaveBeenCalled();
    expect(mockTrace).not.toHaveBeenCalled();
    expect(result.headers).toHaveBeenCalledWith(
      "Cache-Control",
      "private, no-store",
    );
    expect(result.headers).toHaveBeenCalledWith("Vary", "Authorization");
  },
);
test("context requires sign-in before loading a dataset", async () => {
  expect((await call(body, {}, { host: "ontology.mit.edu" })).code).toBe(401);
  expect(mockDataset).not.toHaveBeenCalled();
  expect(mockContext).not.toHaveBeenCalled();
});
test.each([
  { ...invited, email_verified: false },
  { ...invited, email: "uninvited@mit.edu" },
])("context rejects an unverified or uninvited account", async (user) => {
  expect((await call(body, user)).code).toBe(403);
  expect(mockDataset).not.toHaveBeenCalled();
  expect(mockContext).not.toHaveBeenCalled();
});
test("context rejects a revoked token", async () => {
  mockVerifyIdToken.mockRejectedValueOnce(Error("revoked"));
  expect((await call()).code).toBe(401);
  expect(mockContext).not.toHaveBeenCalled();
});
test("context retains the existing origin check and public proxy origin", async () => {
  const headers = {
    authorization: "Bearer test",
    host: "ontology-r5kaknwqbq-uc.a.run.app",
  };
  expect(
    (await call(body, invited, { ...headers, origin: "https://other.example" }))
      .code,
  ).toBe(403);
  expect(mockVerifyIdToken).not.toHaveBeenCalled();
  expect(mockContext).not.toHaveBeenCalled();
  expect(
    (
      await call(body, invited, {
        ...headers,
        origin: "https://ontology.mit.edu",
      })
    ).code,
  ).toBe(200);
  expect(mockSaveFeedback).not.toHaveBeenCalled();
});
test("context remains POST-only", async () => {
  const result = await call(body, invited, undefined, "GET");
  expect(result.code).toBe(405);
  expect(result.headers).toHaveBeenCalledWith("Allow", "POST");
  expect(mockContext).not.toHaveBeenCalled();
});
test.each([undefined, null])(
  "context requires an explicit version (%s)",
  async (datasetVersion) => {
    expect((await call({ caseId: "reason", datasetVersion })).code).toBe(400);
    expect(mockDataset).not.toHaveBeenCalled();
    expect(mockContext).not.toHaveBeenCalled();
  },
);
test.each(["../../escape", "", 3, {}])(
  "context retains version rejection for %p",
  async (datasetVersion) => {
    expect((await call({ ...body, datasetVersion })).code).toBe(409);
    expect(mockDataset).not.toHaveBeenCalled();
    expect(mockContext).not.toHaveBeenCalled();
  },
);
test.each(["v1", "v3", "legacy"])(
  "an explicit allowed version %s is passed to the context module",
  async (datasetVersion) => {
    const result = await call({ ...body, datasetVersion });
    expect(result.code).toBe(200);
    expect(result.data.context).toMatchObject({
      datasetVersion,
      available: datasetVersion !== "legacy",
    });
    expect(mockDataset).toHaveBeenCalledWith(datasetVersion);
    expect(mockSaveFeedback).not.toHaveBeenCalled();
  },
);
test.each(["other-sha", null, 4])(
  "a supplied mismatching dataset hash %p is rejected",
  async (datasetSha256) => {
    expect((await call({ ...body, datasetSha256 })).code).toBe(409);
    expect(mockContext).not.toHaveBeenCalled();
    expect(mockSaveFeedback).not.toHaveBeenCalled();
  },
);
test("an omitted hash is allowed, but the computed dataset hash is passed to context", async () => {
  expect((await call({ datasetVersion: "v3", caseId: "reason" })).code).toBe(
    200,
  );
  expect(mockContext).toHaveBeenCalledWith(
    expect.any(Object),
    "sha",
    "reason",
    {
      focusId: undefined,
      activityOffset: undefined,
      sourceOffset: undefined,
      limit: undefined,
    },
  );
});
test("context preserves the existing case check", async () => {
  expect((await call({ ...body, caseId: "../other" })).code).toBe(404);
  expect(mockContext).not.toHaveBeenCalled();
});
test("raw focus and page inputs reach strict context validation without coercion", async () => {
  const options = {
    focusId: ["proposed"],
    activityOffset: "20",
    sourceOffset: null,
    limit: "5",
  };
  mockContext.mockImplementation(() => {
    throw new RelationshipError(400, "Use valid context page inputs.");
  });
  const result = await call({ ...body, ...options });
  expect(result.code).toBe(400);
  expect(result.data).toEqual({ error: "Use valid context page inputs." });
  expect(mockContext).toHaveBeenCalledWith(
    expect.any(Object),
    "sha",
    "reason",
    options,
  );
  expect(mockSaveFeedback).not.toHaveBeenCalled();
});
test("an unknown focus error from context remains a 404", async () => {
  mockContext.mockImplementation(() => {
    throw new RelationshipError(404, "Unknown neighboring activity.");
  });
  const result = await call({ ...body, focusId: "missing" });
  expect(result.code).toBe(404);
  expect(result.data).toEqual({ error: "Unknown neighboring activity." });
});
test("a verified source-pin failure fails closed instead of returning unavailable context", async () => {
  mockContext.mockImplementation(() => {
    throw Error("Verified source-pin mismatch");
  });
  const result = await call();
  expect(result.code).toBe(500);
  expect(result.data.context).toBeUndefined();
  expect(result.data.error).not.toContain("source-pin mismatch");
  expect(mockSaveFeedback).not.toHaveBeenCalled();
  expect(mockReadFeedback).not.toHaveBeenCalled();
});
