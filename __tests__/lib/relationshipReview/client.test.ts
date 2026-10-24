/** @jest-environment jsdom */
import { relationshipRequest } from "../../../src/lib/relationshipReview/client";
jest.mock("../../../src/lib/firestoreClient/auth", () => ({
  getIdToken: async () => "test-token",
}));
const response = (status: number, data: unknown, plain = false) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => {
    if (plain) throw new SyntaxError("Unexpected token 'I', Internal Error");
    return data;
  },
});
beforeEach(() => {
  jest.useFakeTimers();
  global.fetch = jest.fn();
});
afterEach(() => jest.useRealTimers());

test("context uses one read retry with the original snapshot, focus and pages", async () => {
  (fetch as jest.Mock)
    .mockResolvedValueOnce(response(500, null, true))
    .mockResolvedValueOnce(response(200, { context: { caseId: "original" } }));
  const body = {
    caseId: "original", datasetVersion: "v3", datasetSha256: "sha",
    focusId: "proposed", activityOffset: 20, sourceOffset: 40, limit: 20,
  };
  const original = JSON.stringify(body);
  const pending = relationshipRequest("context", body);
  body.caseId = "different";
  body.datasetVersion = "v1";
  body.datasetSha256 = "other-sha";
  body.focusId = "current";
  body.activityOffset = 0;
  body.sourceOffset = 0;
  body.limit = 10;
  await jest.advanceTimersByTimeAsync(500);
  await expect(pending).resolves.toEqual({ context: { caseId: "original" } });
  expect(fetch).toHaveBeenCalledTimes(2);
  for (const [url, options] of (fetch as jest.Mock).mock.calls) {
    expect(url).toBe("/api/som-review/relationships/context");
    expect(options.body).toBe(original);
    expect(options.headers.Authorization).toBe("Bearer test-token");
    expect(options.credentials).toBe("same-origin");
  }
});

test("persistent context failures stop after one automatic retry", async () => {
  (fetch as jest.Mock).mockResolvedValue(response(503, null, true));
  const pending = expect(relationshipRequest("context", { caseId: "a", datasetVersion: "v3" }))
    .rejects.toMatchObject({ status: 503, message: expect.stringContaining("Keep this tab open") });
  await jest.advanceTimersByTimeAsync(500);
  await pending;
  expect(fetch).toHaveBeenCalledTimes(2);
});

test.each([400, 404, 409])("context status %s is not automatically retried", async (status) => {
  (fetch as jest.Mock).mockResolvedValue(response(status, { error: "Context input changed" }));
  await expect(relationshipRequest("context", { caseId: "a", datasetVersion: "v3" }))
    .rejects.toMatchObject({ status, message: "Context input changed" });
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("a read retry keeps the original case and version when the caller changes its object", async () => {
  (fetch as jest.Mock).mockResolvedValueOnce(response(500, null, true)).mockResolvedValueOnce(response(200, {evidence:{}}));
  const body = {caseId:"original",datasetVersion:"v1"};
  const pending = relationshipRequest("evidence", body);
  body.caseId="different"; body.datasetVersion="v2";
  await jest.advanceTimersByTimeAsync(500); await pending;
  const calls=(fetch as jest.Mock).mock.calls;
  expect(calls[0][1].body).toBe(JSON.stringify({caseId:"original",datasetVersion:"v1"}));
  expect(calls[1][1].body).toBe(calls[0][1].body);
});

test("a plain-text hosting failure on load is retried once and recovers", async () => {
  (fetch as jest.Mock)
    .mockResolvedValueOnce(response(500, null, true))
    .mockResolvedValueOnce(response(200, { dataset: { version: "v2" } }));
  const pending = relationshipRequest("session");
  await jest.advanceTimersByTimeAsync(500);
  await expect(pending).resolves.toEqual({ dataset: { version: "v2" } });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect((fetch as jest.Mock).mock.calls[1][1].body).toBe("{}");
});

test("persistent non-JSON failure gives a readable error after a bounded retry", async () => {
  (fetch as jest.Mock).mockResolvedValue(response(502, null, true));
  const pending = expect(
    relationshipRequest("evidence", { caseId: "a" }),
  ).rejects.toMatchObject({
    status: 502,
    message: expect.stringContaining("Keep this tab open"),
  });
  await jest.advanceTimersByTimeAsync(500);
  await pending;
  expect(fetch).toHaveBeenCalledTimes(2);
});

test("a save with a lost plain-text receipt is not automatically repeated", async () => {
  (fetch as jest.Mock).mockResolvedValue(response(500, null, true));
  await expect(
    relationshipRequest("save", { requestId: "same-id" }),
  ).rejects.toMatchObject({
    status: 500,
    message: expect.not.stringContaining("Unexpected token"),
  });
  expect(fetch).toHaveBeenCalledTimes(1);
});

test.each([401, 403, 409, 413])(
  "status %s keeps API semantics and is not retried",
  async (status) => {
    (fetch as jest.Mock).mockResolvedValue(
      response(status, {
        error: "Review version changed",
        code: "revision_conflict",
      }),
    );
    await expect(relationshipRequest("session")).rejects.toMatchObject({
      status,
      code: "revision_conflict",
      message: "Review version changed",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  },
);

test("the timeout covers reading the response body and terminates after one read retry", async () => {
  (fetch as jest.Mock).mockImplementation((_url, { signal }) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        new Promise((_resolve, reject) =>
          signal.addEventListener("abort", () =>
            reject(Object.assign(Error("aborted"), { name: "AbortError" })),
          ),
        ),
    }),
  );
  const pending = expect(relationshipRequest("trace")).rejects.toMatchObject({
    message: expect.stringContaining("retry"),
  });
  await jest.advanceTimersByTimeAsync(61_000);
  await pending;
  expect(fetch).toHaveBeenCalledTimes(2);
});
