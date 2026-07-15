import { NextApiHandler } from "next";

const mockVerifyIdToken = jest.fn();

jest.mock("../../src/lib/firestoreServer/admin", () => ({
  admin: {
    auth: () => ({ verifyIdToken: mockVerifyIdToken }),
  },
  db: {},
}));

import fbAuth from "../../src/middlewares/fbAuth";

const response = () => {
  const json = jest.fn();
  const send = jest.fn();
  const status = jest.fn(() => ({ json, send }));
  return { status, json, send };
};

describe("fbAuth authentication failures", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 without exposing Firebase details for an invalid token", async () => {
    mockVerifyIdToken.mockRejectedValue({
      code: "auth/argument-error",
      message: "Detailed Firebase verification failure",
    });
    const handler: NextApiHandler = jest.fn();
    const res = response();

    await fbAuth(handler)(
      { headers: {}, method: "POST", body: {} } as any,
      res as any,
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("keeps non-authentication failures as internal server errors", async () => {
    mockVerifyIdToken.mockRejectedValue(new Error("Network unavailable"));
    const handler: NextApiHandler = jest.fn();
    const res = response();
    const consoleError = jest.spyOn(console, "error").mockImplementation();

    await fbAuth(handler)(
      { headers: {}, method: "POST", body: {} } as any,
      res as any,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
    expect(handler).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
