import {
  resolveReviewerRole,
  reviewAccessForIdentity,
  reviewerRoleWeights,
} from "../../../src/lib/somReview/access";

describe("Society of Mind reviewer access", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("assigns Tom and Rob to the senior-steward tier", () => {
    expect(
      resolveReviewerRole({
        uid: "tom",
        email: "malone@mit.edu",
        emailVerified: true,
      }),
    ).toBe("steward");
    expect(
      resolveReviewerRole({
        uid: "rob",
        email: "rjl@mit.edu",
        emailVerified: true,
      }),
    ).toBe("steward");
  });

  it("assigns the named research team without elevating other reviewers", () => {
    expect(
      resolveReviewerRole({
        uid: "xinru",
        email: "xinru.wang@smart.mit.edu",
        emailVerified: true,
      }),
    ).toBe("researcher");
    expect(
      resolveReviewerRole({ uid: "outside", email: "reviewer@example.org" }),
    ).toBe("contributor");
  });

  it("keeps contributor deliberation data inaccessible", () => {
    expect(
      reviewAccessForIdentity({
        uid: "outside",
        email: "reviewer@example.org",
      }),
    ).toEqual({
      role: "contributor",
      canDeliberate: false,
      canFinalize: false,
    });
  });

  it("allows explicit Society-of-Mind claims and reserves finalization", () => {
    expect(
      reviewAccessForIdentity({
        uid: "researcher",
        roleClaim: "researcher",
      }),
    ).toEqual({
      role: "researcher",
      canDeliberate: true,
      canFinalize: false,
    });
    expect(
      reviewAccessForIdentity({
        uid: "operator",
        roleClaim: "researcher",
        claims: { somReviewFinalizer: true },
      }),
    ).toEqual({
      role: "researcher",
      canDeliberate: true,
      canFinalize: true,
    });
  });

  it("does not trust an unverified allowlisted email or a global admin claim", () => {
    expect(
      reviewAccessForIdentity({
        uid: "unverified",
        email: "malone@mit.edu",
        emailVerified: false,
        claims: { admin: true },
      }),
    ).toEqual({
      role: "contributor",
      canDeliberate: false,
      canFinalize: false,
    });
  });

  it("matches configured Firebase UIDs case-sensitively", () => {
    process.env.SOM_REVIEW_RESEARCHER_UIDS = "CaseSensitiveUid";
    expect(resolveReviewerRole({ uid: "CaseSensitiveUid" })).toBe("researcher");
    expect(resolveReviewerRole({ uid: "casesensitiveuid" })).toBe(
      "contributor",
    );
  });

  it("enforces steward > researcher > contributor weights", () => {
    process.env.SOM_REVIEW_CONTRIBUTOR_WEIGHT = "8";
    process.env.SOM_REVIEW_RESEARCHER_WEIGHT = "2";
    process.env.SOM_REVIEW_STEWARD_WEIGHT = "1";
    const weights = reviewerRoleWeights();
    expect(weights.researcher).toBeGreaterThan(weights.contributor);
    expect(weights.steward).toBeGreaterThan(weights.researcher);
  });
});
