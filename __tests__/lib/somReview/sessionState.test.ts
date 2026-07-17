import {
  dropMissingProposalIds,
  isResumableSession,
  mergeReadyProposalIds,
  prioritizeProposalAtCursor,
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
  it("includes the complete ready queue and expands older capped sessions", () => {
    const completeQueue = Array.from(
      { length: 47 },
      (_, index) => `proposal-${index + 1}`,
    );
    expect(mergeReadyProposalIds([], completeQueue)).toEqual(completeQueue);
    expect(
      mergeReadyProposalIds(completeQueue.slice(0, 10), completeQueue),
    ).toEqual(completeQueue);
  });

  it("drops missing proposal ids and preserves the remaining cursor position", () => {
    expect(
      dropMissingProposalIds(
        ["gone", "current", "later", "also-gone"],
        2,
        new Set(["current", "later"]),
      ),
    ).toEqual({ proposalIds: ["current", "later"], cursor: 1 });
    expect(
      dropMissingProposalIds(["only-gone"], 0, new Set(["still-here"])),
    ).toEqual({ proposalIds: [], cursor: 0 });
  });

  it("focuses an exact follow-up without changing completed work", () => {
    expect(
      prioritizeProposalAtCursor(
        ["done", "next", "target", "later"],
        1,
        "target",
      ),
    ).toEqual(["done", "target", "next", "later"]);
  });

  it("leaves missing and already reviewed follow-ups unchanged", () => {
    const ids = ["done", "next", "later"];
    expect(prioritizeProposalAtCursor(ids, 1, "done")).toBe(ids);
    expect(prioritizeProposalAtCursor(ids, 1, "missing")).toBe(ids);
    expect(prioritizeProposalAtCursor(ids, 1)).toBe(ids);
  });

  it("rejects an invalid cursor before reordering a follow-up", () => {
    expect(() => prioritizeProposalAtCursor(["a"], 2, "a")).toThrow(
      "Session cursor is invalid",
    );
  });

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
