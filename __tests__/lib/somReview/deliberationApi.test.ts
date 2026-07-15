import {
  DeliberationApiError,
  commentStance,
  requireDeliberationAccess,
  requiredText,
  resolutionDecision,
  reviewDecision,
} from "../../../src/lib/somReview/deliberationApi";

describe("Society of Mind deliberation API validation", () => {
  it("rejects non-team users before returning admin data", () => {
    expect(() =>
      requireDeliberationAccess({
        uid: "outside",
        email: "reviewer@example.org",
      }),
    ).toThrow(DeliberationApiError);
  });

  it("accepts research-team access without finalizer rights", () => {
    expect(
      requireDeliberationAccess({
        uid: "xinru",
        email: "xinru.wang@smart.mit.edu",
        email_verified: true,
      }).response,
    ).toEqual({
      role: "researcher",
      roleLabel: "Research team",
      canFinalize: false,
    });
  });

  it("validates all structured mutation fields", () => {
    expect(reviewDecision("agree")).toBe("agree");
    expect(commentStance("synthesis")).toBe("synthesis");
    expect(resolutionDecision("defer")).toBe("defer");
    expect(requiredText("  useful rationale  ", "Rationale")).toBe(
      "useful rationale",
    );
    expect(() => reviewDecision("accept")).toThrow("Invalid review decision");
    expect(() => requiredText(" ", "Comment")).toThrow("at least 3");
  });
});
