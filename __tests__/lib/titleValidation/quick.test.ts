import {
  emptyQuickPayload,
  quickCases,
  quickKey,
  quickSession,
  saveQuick,
  QuickState,
} from "../../../src/lib/titleValidation/quick";
import {
  getQuickDataset,
  quickTitleReviewRelease,
} from "../../../src/lib/titleValidation/quickDataset";
const data = getQuickDataset();
const state = (): QuickState => ({
  study: {
    id: "quick-title-verification-test",
    protocol: "quick-title-verification-v1",
    datasetVersion: data.version,
    roster: [
      { reviewerId: "rob", label: "Rob" },
      { reviewerId: "urop", label: "UROP" },
    ],
    flaggedReviewerIds: ["rob"],
    regularLimit: 25,
    createdAt: 1000,
  },
  answers: {},
  drafts: {},
});
test("pinned package has proportional batches, all flags and no duplicate activities", () => {
  expect(data.cases).toHaveLength(419);
  expect(new Set(data.cases.map((c) => c.id)).size).toBe(419);
  for (const [batch, counts] of [
    ["first25", [2, 22, 1]],
    ["next75", [4, 67, 4]],
    ["flagged", [22, 274, 23]],
  ] as const)
    expect(
      ["Keep", "Clarify", "Split"].map(
        (o) =>
          data.cases.filter((c) => c.batch === batch && c.outcome === o).length,
      ),
    ).toEqual(counts);
  expect(
    data.cases.every(
      (c) =>
        (c.batch === "flagged") ===
        /human review|tentative/i.test(c.modelReason),
    ),
  ).toBe(true);
  expect(quickTitleReviewRelease()).toEqual(
    expect.objectContaining({
      initialRegular: 25,
      reservedRegular: 75,
      flagged: 319,
    }),
  );
});
test("flagged cases are withheld from UROPs and reviewer orders remain stable when expanding", () => {
  const s = state(),
    first = quickCases(s, data, "urop", false, false).map((c) => c.id);
  expect(() => quickCases(s, data, "urop", true, false)).toThrow(
    "Rob is reviewing",
  );
  expect(() => quickCases(s, data, "unknown", false, false)).toThrow(
    "not assigned",
  );
  expect(quickCases(s, data, "rob", true, false)).toHaveLength(319);
  s.study.regularLimit = 100;
  expect(
    quickCases(s, data, "urop", false, false)
      .slice(0, 25)
      .map((c) => c.id),
  ).toEqual(first);
});
test("Xinru's named flagged-review link works without granting coordinator privileges or editing assignments", () => {
  const s = state();
  const uid = "dPvaiA6EAwcIAwYbxAEap0WDcoK2";
  s.study.roster.push({ reviewerId: uid, label: "Xinru" });
  const originalStudy = JSON.stringify(s.study);
  const session = quickSession(s, data, uid, true, false, 1000);
  expect(session.total).toBe(319);
  expect(session.canReviewFlagged).toBe(true);
  expect(session.canManage).toBe(false);
  expect(JSON.stringify(s.study)).toBe(originalStudy);
});
test("uncertain/rejected ratings require explanations; saves are immutable and delivery retries deduplicate", () => {
  const s = state(),
    v = quickSession(s, data, "urop", false, false, 1000),
    p = JSON.parse(JSON.stringify(v.draft!.payload));
  for (const q of v.questions)
    p.ratings[q.id] = { value: "unsure", explanation: "" };
  p.activeTimeMs = 10000;
  expect(() =>
    saveQuick(s, data, "urop", false, false, p, 0, true, 11000),
  ).toThrow("explain");
  for (const q of v.questions)
    p.ratings[q.id].explanation = "Software test: uncertainty recorded.";
  const saved = saveQuick(s, data, "urop", false, false, p, 0, true, 11000);
  expect(saved.answer).toEqual(
    expect.objectContaining({
      activeTimeMs: 10000,
      elapsedTimeMs: 10000,
      firstPresentedAt: 1000,
      submittedAt: 11000,
    }),
  );
  const before = JSON.stringify(s.answers);
  expect(
    saveQuick(s, data, "urop", false, false, p, 0, true, 22000).duplicate,
  ).toBe(true);
  expect(() =>
    saveQuick(
      s,
      data,
      "urop",
      false,
      false,
      { ...p, correction: "Changed after saving" },
      0,
      true,
      22000,
    ),
  ).toThrow("already been saved");
  expect(JSON.stringify(s.answers)).toBe(before);
  expect(quickSession(s, data, "urop", false, false, 22000).completed).toBe(1);
});
test("drafts retain explanations and timing across readback; stale tabs and impossible timers fail closed", () => {
  let s = state();
  const v = quickSession(s, data, "urop", false, false, 1000),
    p = v.draft!.payload;
  p.activeTimeMs = 5000;
  p.correction = "Draft text";
  p.ratings[Object.keys(p.ratings)[0]].correction = "Per-title draft text";
  saveQuick(s, data, "urop", false, false, p, 0, false, 6000);
  s = JSON.parse(JSON.stringify(s));
  const restored = quickSession(s, data, "urop", false, false, 30000);
  expect(restored.draft!.payload).toEqual(p);
  expect(restored.draft!.firstPresentedAt).toBe(1000);
  expect(() =>
    saveQuick(s, data, "urop", false, false, p, 0, false, 30000),
  ).toThrow("another tab");
  expect(() =>
    saveQuick(
      s,
      data,
      "urop",
      false,
      false,
      { ...p, activeTimeMs: 0 },
      1,
      false,
      30000,
    ),
  ).toThrow("timer");
  expect(() =>
    saveQuick(
      s,
      data,
      "urop",
      false,
      false,
      { ...p, activeTimeMs: 999999 },
      1,
      false,
      30000,
    ),
  ).toThrow("timer");
});
test("same-case answers from different reviewers stay separate and reserved activities are unavailable", () => {
  const s = state(),
    v = quickSession(s, data, "urop", false, false, 1000),
    reserved = data.cases.find((c) => c.batch === "next75")!;
  expect(() =>
    saveQuick(
      s,
      data,
      "urop",
      false,
      false,
      emptyQuickPayload(reserved),
      0,
      false,
      2000,
    ),
  ).toThrow("not in your assigned");
  expect(quickKey("rob", v.item!.id)).not.toBe(quickKey("urop", v.item!.id));
});
