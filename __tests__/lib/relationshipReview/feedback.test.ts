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
