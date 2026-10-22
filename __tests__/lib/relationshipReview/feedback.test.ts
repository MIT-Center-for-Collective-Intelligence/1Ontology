import { createHash } from "crypto";
import {
  parseFeedback,
  nextFeedback,
  feedbackHash,
  RelationshipError,
} from "../../../src/lib/relationshipReview/feedback";
const body = {
  caseId: "reason",
  datasetVersion: "v1",
  datasetSha256: "sha",
  decision: "agree",
  note: " note ",
  correction: "",
  revision: 0,
  requestId: "0123456789abcdef",
};
test("binds feedback to exact frozen proposals and preserves old revisions", () => {
  const r = parseFeedback(body, "v1", "sha", ["reason"]);
  const first = nextFeedback(r, null, "now");
  expect(first).toMatchObject({ revision: 1, note: "note", decision: "agree" });
  expect(() => nextFeedback(r, first, "later")).toThrow(RelationshipError);
  const second = nextFeedback(
    { ...r, revision: 1, decision: "discuss" },
    first,
    "later",
  );
  expect(second.revision).toBe(2);
  expect(first.decision).toBe("agree");
});
test.each([
  { datasetSha256: "changed" },
  { datasetVersion: "changed" },
  { caseId: "../../nodes" },
  { decision: "apply" },
  { revision: -1 },
  { revision: 1.2 },
  { requestId: "x" },
  { note: null },
  { note: "x".repeat(8001) },
  { revisitLater: undefined },
  { revisitLater: null },
  { revisitLater: "true" },
  { revisitLater: "false" },
  { revisitLater: 0 },
  { revisitLater: 1 },
  { revisitLater: {} },
  { revisitLater: [] },
])("rejects invalid or stale request %s", (patch) => {
  expect(() =>
    parseFeedback({ ...body, ...patch }, "v1", "sha", ["reason"]),
  ).toThrow(RelationshipError);
});
test("idempotency fingerprints distinguish changed content", () => {
  const r = parseFeedback(body, "v1", "sha", ["reason"]);
  expect(feedbackHash(r)).not.toBe(
    feedbackHash({ ...r, decision: "disagree" }),
  );
});
test("evidence presentation is retained on new feedback without rewriting historical feedback", () => {
  const r = parseFeedback(body, "v1", "sha", ["reason"]);
  const old = nextFeedback(r, null, "before");
  expect(old).not.toHaveProperty("presentationVersion");
  const updated = nextFeedback(
    {
      ...r,
      revision: 1,
      presentationSha256: "p-sha",
      presentationVersion: "p1",
    },
    old,
    "after",
  );
  expect(updated).toMatchObject({
    presentationSha256: "p-sha",
    presentationVersion: "p1",
  });
  expect(old).not.toHaveProperty("presentationVersion");
  expect(feedbackHash(r)).not.toBe(
    feedbackHash({ ...r, presentationSha256: "p-sha" }),
  );
});

test("legacy requests keep their original shape and hash", () => {
  const r = parseFeedback(body, "v1", "sha", ["reason"]);
  const legacy = { ...body, note: "note" };
  expect(r).toStrictEqual(legacy);
  expect(r).not.toHaveProperty("revisitLater");
  expect(feedbackHash(r)).toBe(
    createHash("sha256").update(JSON.stringify(legacy)).digest("hex"),
  );
  const first = nextFeedback(r, null, "before");
  const second = nextFeedback({ ...r, revision: 1 }, first, "after");
  expect(first).not.toHaveProperty("revisitLater");
  expect(second).not.toHaveProperty("revisitLater");
});

test.each([true, false])(
  "revisitLater %s is independent of agreement and survives omission",
  (revisitLater) => {
    const legacy = parseFeedback(body, "v1", "sha", ["reason"]);
    const r = parseFeedback({ ...body, revisitLater }, "v1", "sha", ["reason"]);
    expect(r.revisitLater).toBe(revisitLater);
    expect(feedbackHash(r)).not.toBe(feedbackHash(legacy));
    expect(feedbackHash(r)).not.toBe(
      feedbackHash({ ...r, revisitLater: !revisitLater }),
    );
    const first = nextFeedback(r, null, "before");
    const second = nextFeedback({ ...legacy, revision: 1 }, first, "after");
    expect(first).toMatchObject({
      revision: 1,
      decision: "agree",
      revisitLater,
    });
    expect(second).toMatchObject({
      revision: 2,
      decision: "agree",
      revisitLater,
    });
  },
);
