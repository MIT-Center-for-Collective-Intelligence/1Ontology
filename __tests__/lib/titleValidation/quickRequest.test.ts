import { postQuickReview } from "../../../src/lib/titleValidation/quickRequest";
import { getIdToken } from "../../../src/lib/firestoreClient/auth";

jest.mock("../../../src/lib/firestoreClient/auth", () => ({
  getIdToken: jest.fn(),
}));
const originalFetch = global.fetch;
const path = "/som-review/title-validation/quick-respond";
beforeEach(() => {
  global.fetch = jest.fn();
  jest.mocked(getIdToken).mockReset().mockResolvedValue("fake-test-token");
});
afterEach(() => {
  global.fetch = originalFetch;
});
test.each([400, 409, 503])(
  "retains HTTP %i and the server explanation",
  async (status) => {
    jest.mocked(fetch).mockResolvedValue({
      ok: false,
      status,
      json: async () => ({ error: "Specific server explanation" }),
    } as Response);
    await expect(postQuickReview(path, { payload: {} })).rejects.toMatchObject({
      status,
      message: "Specific server explanation",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "/api" + path,
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer fake-test-token",
        },
      }),
    );
  },
);
test("an unreadable success remains an uncertain delivery", async () => {
  jest.mocked(fetch).mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError();
    },
  } as unknown as Response);
  await expect(postQuickReview(path, {})).rejects.toMatchObject({
    status: 502,
  });
});
test("a network failure is not converted to a validation rejection", async () => {
  const error = new TypeError("Connection lost");
  jest.mocked(fetch).mockRejectedValue(error);
  await expect(postQuickReview(path, {})).rejects.toBe(error);
});
test("signed-out requests fail before transmission", async () => {
  jest.mocked(getIdToken).mockResolvedValue(undefined);
  await expect(postQuickReview(path, {})).rejects.toMatchObject({
    status: 401,
  });
  expect(fetch).not.toHaveBeenCalled();
});
test("preview requests do not obtain or send an authentication token", async () => {
  jest.mocked(fetch).mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ saved: true }),
  } as Response);
  await expect(postQuickReview(path, {}, true)).resolves.toEqual({
    saved: true,
  });
  expect(getIdToken).not.toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledWith(
    "/api" + path,
    expect.objectContaining({
      headers: { "Content-Type": "application/json" },
    }),
  );
});
test("a stalled request has a bounded deadline and remains an uncertain delivery", async () => {
  jest.useFakeTimers();
  jest.mocked(fetch).mockImplementation(
    async (_url, options: any) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () =>
          reject(new Error("Aborted")),
        );
      }),
  );
  const request = postQuickReview(path, {});
  const result = expect(request).rejects.toMatchObject({ status: 504 });
  await Promise.resolve();
  jest.advanceTimersByTime(30000);
  await result;
  expect(fetch).toHaveBeenCalledTimes(1);
  jest.useRealTimers();
});
