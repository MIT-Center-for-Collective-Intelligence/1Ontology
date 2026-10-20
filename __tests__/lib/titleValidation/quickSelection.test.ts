import crypto from "crypto";
import fs from "fs";
import {
  emptyQuickPayload,
  quickCases,
  quickKey,
  quickSession,
  quickStatus,
  saveQuick,
  QuickCase,
  QuickState,
} from "../../../src/lib/titleValidation/quick";
import {
  getQuickDataset,
  QUICK_PACKAGE,
  QUICK_PACKAGE_SHA256,
} from "../../../src/lib/titleValidation/quickDataset";
import {
  effectiveQuickBatch,
  LEGACY_QUICK_SELECTION,
  makeQuickSelection,
  quickSelectionManifest,
  quickSelectionRelease,
} from "../../../src/lib/titleValidation/quickSelection";
import { TitleValidationError } from "../../../src/lib/titleValidation/engine";

const data = getQuickDataset();
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const state = (): QuickState => ({
  study: {
    id: "selection-test",
    protocol: "quick-title-verification-v1",
    datasetVersion: data.version,
    roster: [
      { reviewerId: "urop", label: "UROP" },
      { reviewerId: "rob", label: "Rob" },
    ],
    flaggedReviewerIds: ["rob"],
    regularLimit: 25,
    createdAt: 0,
  },
  answers: {},
  drafts: {},
});
const demoted = data.cases.find(
  (c) => c.batch === "first25" && effectiveQuickBatch(c) === "next75",
)!;
function draft(s: QuickState, item: QuickCase) {
  const payload = emptyQuickPayload(item);
  payload.correction = "Existing private draft text";
  payload.interruption = "Saved interruption";
  payload.activeTimeMs = 3000;
  return (s.drafts[quickKey("urop", item.id)] = {
    reviewerId: "urop",
    caseId: item.id,
    revision: 2,
    firstPresentedAt: 1000,
    updatedAt: 6000,
    payload,
  });
}
function rejects(status: number, action: () => unknown) {
  try {
    action();
    throw new Error("Expected rejection");
  } catch (e) {
    expect(e).toBeInstanceOf(TitleValidationError);
    expect((e as TitleValidationError).status).toBe(status);
  }
}
const counts = (cases: QuickCase[]) =>
  ["Keep", "Clarify", "Split"].map(
    (o) => cases.filter((c) => c.outcome === o).length,
  );

test("the active 5/15/5 overlay leaves frozen evidence and batch labels untouched; expansion preserves each prefix", () => {
  const raw = fs.readFileSync(QUICK_PACKAGE),
    before = JSON.stringify(data),
    s = state();
  expect(crypto.createHash("sha256").update(raw).digest("hex")).toBe(
    QUICK_PACKAGE_SHA256,
  );
  expect(counts(quickCases(s, data, "urop", false, false))).toEqual([2, 22, 1]);
  s.study.selection = makeQuickSelection(s, data, 10000);
  for (const uid of ["urop", "rob"]) {
    s.study.regularLimit = 25;
    const first = quickCases(s, data, uid, false, false);
    expect(counts(first)).toEqual([5, 15, 5]);
    expect(first.map((c) => c.id).sort()).toEqual(
      [...quickSelectionManifest.initialCaseIds].sort(),
    );
    s.study.regularLimit = 100;
    const expanded = quickCases(s, data, uid, false, false);
    expect(expanded.slice(0, 25)).toEqual(first);
    expect(expanded).toHaveLength(100);
    expect(counts(expanded.slice(25))).toEqual([1, 74, 0]);
  }
  expect(JSON.stringify(data)).toBe(before);
  expect(fs.readFileSync(QUICK_PACKAGE)).toEqual(raw);
  expect(counts(data.cases.filter((c) => c.batch === "first25"))).toEqual([
    2, 22, 1,
  ]);
  expect(counts(data.cases.filter((c) => c.batch === "next75"))).toEqual([
    4, 67, 4,
  ]);
});

test("the protected existing draft stays current with its text, revision, active time and original presentation time", () => {
  const s = state(),
    item = data.cases.find(
      (c) => c.id === quickSelectionManifest.protectedCaseIds[0],
    )!;
  const existing = clone(draft(s, item)),
    before = JSON.stringify(s.drafts);
  s.study.selection = makeQuickSelection(s, data, 10000);
  const view = quickSession(s, data, "urop", false, false, 20000);
  expect(view.item!.id).toBe(item.id);
  expect(view.draft).toEqual(existing);
  expect(JSON.stringify(s.drafts)).toBe(before);
  const payload = {
    ...clone(view.draft!.payload),
    correction: "Continued text",
    activeTimeMs: 4000,
  };
  const saved = saveQuick(
    s,
    data,
    "urop",
    false,
    false,
    payload,
    2,
    false,
    20000,
  ).draft!;
  expect(saved).toMatchObject({ revision: 3, firstPresentedAt: 1000 });
  expect(saved.payload).toMatchObject({
    correction: "Continued text",
    interruption: "Saved interruption",
    activeTimeMs: 4000,
  });
});

test("an exact old answer retry still deduplicates after demotion, while a changed answer remains a 409", () => {
  const s = state(),
    payload = clone(draft(s, demoted).payload);
  for (const rating of Object.values(payload.ratings))
    rating.value = "acceptable";
  const answer = saveQuick(
    s,
    data,
    "urop",
    false,
    false,
    payload,
    2,
    true,
    6000,
  ).answer!;
  expect(answer.selection!.version).toBe(LEGACY_QUICK_SELECTION);
  const before = JSON.stringify(s.answers);
  s.study.selection = makeQuickSelection(s, data, 10000);
  expect(
    saveQuick(s, data, "urop", false, false, clone(payload), 2, true, 20000)
      .duplicate,
  ).toBe(true);
  rejects(409, () =>
    saveQuick(
      s,
      data,
      "urop",
      false,
      false,
      { ...payload, correction: "Changed" },
      2,
      true,
      20000,
    ),
  );
  expect(JSON.stringify(s.answers)).toBe(before);
  expect(quickStatus(s, data, "urop", false, false, 20000)).toMatchObject({
    completed: 0,
    historicalCompleted: 1,
    historicalOutsideCurrentSelection: 1,
  });
});

test("only the roster-authenticated owner of a registered pre-cutover draft can continue a demoted case", () => {
  const s = state(),
    payload = clone(draft(s, demoted).payload),
    key = quickKey("urop", demoted.id);
  s.study.selection = makeQuickSelection(s, data, 10000);
  expect(quickSession(s, data, "urop", false, false, 12000).item!.id).toBe(
    demoted.id,
  );
  rejects(403, () =>
    saveQuick(s, data, "rob", false, false, payload, 2, false, 12000),
  );
  rejects(403, () =>
    saveQuick(s, data, "unknown", false, false, payload, 2, false, 12000),
  );
  rejects(409, () =>
    saveQuick(
      s,
      data,
      "urop",
      false,
      false,
      { ...payload, submissionId: "different-identity" },
      2,
      false,
      12000,
    ),
  );
  const registry = s.study.selection.legacyDrafts[key];
  delete s.study.selection.legacyDrafts[key];
  rejects(403, () =>
    saveQuick(s, data, "urop", false, false, payload, 2, false, 12000),
  );
  s.study.selection.legacyDrafts[key] = registry;
  const ordinary = data.cases.find(
    (c) => c.batch === "next75" && effectiveQuickBatch(c) === "next75",
  )!;
  const unregistered = clone(draft(s, ordinary).payload);
  rejects(403, () =>
    saveQuick(s, data, "urop", false, false, unregistered, 2, false, 12000),
  );
  payload.correction = "Continued after cutover";
  payload.activeTimeMs = 4000;
  const continued = saveQuick(
    s,
    data,
    "urop",
    false,
    false,
    payload,
    2,
    false,
    12000,
  ).draft!;
  expect(continued).toMatchObject({ revision: 3, firstPresentedAt: 1000 });
  for (const rating of Object.values(payload.ratings))
    rating.value = "acceptable";
  expect(
    saveQuick(s, data, "urop", false, false, payload, 3, true, 13000).answer!
      .selection,
  ).toMatchObject({
    version: quickSelectionManifest.version,
    batch: "next75",
    access: "pre-cutover-draft",
  });
});

test("selection does not relax the flagged roster or accept mismatched saved metadata or outcome coverage", () => {
  const s = state();
  s.study.selection = makeQuickSelection(s, data, 10000);
  s.study.flaggedReviewerIds.push("unknown");
  rejects(403, () => quickCases(s, data, "unknown", true, false));
  rejects(403, () => quickCases(s, data, "urop", true, false));
  expect(quickCases(s, data, "rob", true, false)).toHaveLength(319);
  for (const field of ["version", "sha256"] as const) {
    const bad = clone(s);
    bad.study.selection![field] = "wrong";
    expect(() => quickCases(bad, data, "urop", false, false)).toThrow(
      "Unsupported saved",
    );
  }
  const badData = clone(data);
  badData.cases.find(
    (c) => effectiveQuickBatch(c) === "first25" && c.outcome === "Keep",
  )!.outcome = "Clarify";
  expect(() => quickSelectionRelease(badData)).toThrow("coverage changed");
});
