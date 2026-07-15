import { reviewRequestData } from "../../../src/lib/somReview/request";

describe("Society of Mind API request payloads", () => {
  it("accepts the direct body sent by the shared Post helper", () => {
    expect(reviewRequestData({ issueType: "placement" })).toEqual({
      issueType: "placement",
    });
  });

  it("also accepts the legacy wrapped body", () => {
    expect(reviewRequestData({ data: { issueType: "placement" } })).toEqual({
      issueType: "placement",
    });
  });

  it("rejects non-object bodies", () => {
    expect(reviewRequestData(null)).toEqual({});
    expect(reviewRequestData("placement")).toEqual({});
  });
});
