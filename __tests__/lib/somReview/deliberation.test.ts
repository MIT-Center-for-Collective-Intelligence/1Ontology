import {
  aggregateDeliberationVotes,
  DeliberationVote,
} from "../../../src/lib/somReview/deliberation";

const vote = (
  reviewerId: string,
  role: DeliberationVote["role"],
  weight: number,
  decision: DeliberationVote["decision"],
): DeliberationVote => ({ reviewerId, role, weight, decision });

describe("Society of Mind weighted deliberation", () => {
  it("waits for at least two core-team judgments", () => {
    expect(
      aggregateDeliberationVotes([
        vote("researcher-1", "researcher", 2, "agree"),
        vote("outside-1", "contributor", 1, "agree"),
      ]).recommendation,
    ).toBe("awaiting-core-review");
  });

  it("gives a senior steward more influence than one researcher", () => {
    const result = aggregateDeliberationVotes([
      vote("steward-1", "steward", 4, "agree"),
      vote("researcher-1", "researcher", 2, "disagree"),
    ]);
    expect(result.coreWeightedSupport).toBeCloseTo(2 / 3);
    expect(result.recommendation).toBe("ready-to-accept");
  });

  it("does not let a large outside cohort override the core team", () => {
    const contributors = Array.from({ length: 20 }, (_, index) =>
      vote(`outside-${index}`, "contributor", 1, "agree"),
    );
    const result = aggregateDeliberationVotes([
      vote("researcher-1", "researcher", 2, "disagree"),
      vote("researcher-2", "researcher", 2, "disagree"),
      ...contributors,
    ]);
    expect(result.allWeightedSupport).toBeGreaterThan(0.8);
    expect(result.coreWeightedSupport).toBe(0);
    expect(result.recommendation).toBe("needs-deliberation");
  });

  it("forces discussion when senior stewards split", () => {
    const result = aggregateDeliberationVotes([
      vote("tom", "steward", 4, "agree"),
      vote("rob", "steward", 4, "disagree"),
      vote("researcher-1", "researcher", 2, "agree"),
    ]);
    expect(result.stewardSplit).toBe(true);
    expect(result.recommendation).toBe("needs-deliberation");
  });

  it("surfaces a senior-steward objection to an emerging majority", () => {
    const result = aggregateDeliberationVotes([
      vote("steward-1", "steward", 4, "disagree"),
      vote("researcher-1", "researcher", 2, "agree"),
      vote("researcher-2", "researcher", 2, "agree"),
      vote("researcher-3", "researcher", 2, "agree"),
      vote("researcher-4", "researcher", 2, "agree"),
    ]);
    expect(result.coreWeightedSupport).toBeCloseTo(2 / 3);
    expect(result.stewardDissent).toBe(true);
    expect(result.recommendation).toBe("needs-deliberation");
  });

  it("produces a ready rejection only when core and all reviewers align", () => {
    const result = aggregateDeliberationVotes([
      vote("researcher-1", "researcher", 2, "disagree"),
      vote("researcher-2", "researcher", 2, "disagree"),
      vote("outside-1", "contributor", 1, "disagree"),
    ]);
    expect(result.recommendation).toBe("ready-to-reject");
  });
});
