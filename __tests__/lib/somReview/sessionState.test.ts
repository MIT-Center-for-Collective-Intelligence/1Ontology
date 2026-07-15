import {
  isResumableSession,
  planResponseTransition,
  planUndoTransition,
  reviewedProposalIndex,
} from "../../../src/lib/somReview/sessionState";

const session = {
  proposalIds: ["a", "b"],
  cursor: 0,
  status: "active" as const,
};

describe("Society of Mind session transitions", () => {
  it("advances the current item and completes the final item", () => {
    expect(planResponseTransition(session, "a", false)).toEqual({
      cursor: 1,
      completed: false,
      shouldPersist: true,
    });
    expect(
      planResponseTransition({ ...session, cursor: 1 }, "b", false),
    ).toEqual({ cursor: 2, completed: true, shouldPersist: true });
  });

  it("accepts an identical retry after the session has completed", () => {
    expect(
      planResponseTransition(
        { ...session, cursor: 2, status: "completed" },
        "b",
        true,
      ),
    ).toEqual({ cursor: 2, completed: true, shouldPersist: false });
  });

  it("rejects stale changed answers and future-card answers", () => {
    expect(() =>
      planResponseTransition({ ...session, cursor: 1 }, "a", false),
    ).toThrow("stale response");
    expect(() => planResponseTransition(session, "b", false)).toThrow(
      "not the current review item",
    );
  });

  it("resumes only unfinished active sessions", () => {
    expect(isResumableSession(session)).toBe(true);
    expect(isResumableSession({ ...session, cursor: 2 })).toBe(false);
    expect(isResumableSession({ ...session, status: "completed" })).toBe(false);
  });

  it("undoes the final answer and reopens a completed session", () => {
    expect(
      planUndoTransition({ ...session, cursor: 2, status: "completed" }),
    ).toEqual({ cursor: 1, status: "active" });
  });

  it("allows revising any previously reviewed proposal", () => {
    expect(reviewedProposalIndex({ ...session, cursor: 2 }, "a")).toBe(0);
    expect(
      reviewedProposalIndex(
        { ...session, cursor: 2, status: "completed" },
        "b",
      ),
    ).toBe(1);
  });

  it("rejects revision of the current, future, or unrelated proposal", () => {
    expect(() => reviewedProposalIndex({ ...session, cursor: 1 }, "b")).toThrow(
      "previously reviewed",
    );
    expect(() =>
      reviewedProposalIndex({ ...session, cursor: 1 }, "missing"),
    ).toThrow("not part of this session");
  });
});
