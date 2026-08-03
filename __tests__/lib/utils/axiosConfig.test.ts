import { getErrorMessage } from "../../../src/lib/utils/axiosConfig";

describe("API response error normalization", () => {
  it("preserves an API error message instead of returning an empty string", () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    expect(
      getErrorMessage({
        response: {
          status: 403,
          data: { error: "Deliberation access is restricted" },
        },
      }),
    ).toBe("Deliberation access is restricted");
    expect(consoleError).toHaveBeenCalledWith(
      "Deliberation access is restricted",
    );

    consoleError.mockRestore();
  });

  it("returns the original error when the response has no useful message", () => {
    const error = { response: { status: 500, data: {} } };

    expect(getErrorMessage(error)).toBe(error);
  });
});
