import { test } from "node:test";
import assert from "node:assert/strict";
import { completeDiscoveryPrefix } from "./relationship-discovery-lib.mjs";
test("retains complete emitted candidates and discards a partial numeric field", () => {
  const text =
    '{"familyAssessments":[{"parentId":"p"}],"seedAssessments":[],"proposals":[{"subjectId":"a","reason":"a {quoted} example","priority":1},{"subjectId":"b","priority":     ';
  assert.deepEqual(completeDiscoveryPrefix(text), {
    familyAssessments: [{ parentId: "p" }],
    seedAssessments: [],
    proposals: [{ subjectId: "a", reason: "a {quoted} example", priority: 1 }],
  });
});
test("does not invent a header or accept a wholly partial candidate", () => {
  assert.throws(() => completeDiscoveryPrefix('{"familyAssessments":['));
  assert.throws(() =>
    completeDiscoveryPrefix(
      '{"familyAssessments":[],"proposals":[{"subjectId":"partial"',
    ),
  );
});
