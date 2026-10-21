import { getQuickDataset } from "../../../src/lib/titleValidation/quickDataset";
import {
  getSourceDataset,
  sourceTitleReviewRelease,
} from "../../../src/lib/titleValidation/sourceDataset";
import {
  assignedSourcePages,
  sourceSession,
  sourceStatus,
  sourceQuestions,
  saveSourceReview,
  SourceState,
} from "../../../src/lib/titleValidation/sourceReview";
import {
  quickKey,
  quickSession,
  saveQuick,
} from "../../../src/lib/titleValidation/quick";
import { makeQuickSelection } from "../../../src/lib/titleValidation/quickSelection";
import { sourceReviewCsv } from "../../../src/lib/titleValidation/sourceCsv";
const data = getQuickDataset(),
  sources = getSourceDataset();
function state(): SourceState {
  const s: SourceState = {
    legacy: {
      study: {
        id: "quick-title-verification-test",
        protocol: "quick-title-verification-v1",
        datasetVersion: data.version,
        roster: [
          { reviewerId: "urop", label: "Reviewer" },
          { reviewerId: "rob", label: "Rob" },
        ],
        flaggedReviewerIds: ["rob"],
        regularLimit: 25,
        createdAt: 1000,
      },
      answers: {},
      drafts: {},
    },
    answers: {},
    drafts: {},
  };
  s.legacy.study.selection = makeQuickSelection(s.legacy, data, 1000);
  return s;
}
test("all source links are exact, complete and source-specific; the frozen 419-case package stays intact", () => {
  expect(sourceTitleReviewRelease()).toMatchObject({
    pages: 366,
    activities: 1370,
    missingProposals: 7,
  });
  expect(new Set(sources.pages.flatMap((p) => p.anchorCaseIds)).size).toBe(419);
  expect(sources.pages.filter((p) => p.activities.length > 1)).toHaveLength(
    311,
  );
  const elevator = sources.pages.find((p) => p.id === "oyhmLTcuwq8KOKnq5puv")!;
  expect(elevator.activities).toHaveLength(16);
  expect(elevator.activities.map((a) => a.currentTitle)).toEqual(
    expect.arrayContaining([
      "Assemble Elevator",
      "Install Elevator",
      "Maintain Elevator",
      "Repair Elevator",
    ]),
  );
  for (const page of sources.pages) {
    const questions = sourceQuestions(page);
    expect(new Set(questions.map((q) => q.id)).size).toBe(questions.length);
    expect(
      questions.every((q) => q.label === "Is the proposed title acceptable?"),
    ).toBe(true);
    expect(
      questions.every((q) => q.id !== "original" && q.id !== "split"),
    ).toBe(true);
  }
  const multi = sources.pages
    .flatMap((p) => p.activities)
    .filter((a) => a.supportingDescriptionCount > 1);
  expect(multi.length).toBeGreaterThan(0);
  expect(multi.every((a) => a.evidenceDescriptionNumber >= 1)).toBe(true);
  expect(data.cases).toHaveLength(419);
});
test("25 sampled activities become 25 description pages; all their linked tasks appear without expanding the anchor sample", () => {
  const s = state(),
    before = JSON.stringify(s.legacy);
  const pages = assignedSourcePages(s, data, sources, "urop", false, false);
  expect(pages).toHaveLength(25);
  expect(new Set(pages.map((p) => p.id)).size).toBe(25);
  const v = sourceSession(s, data, sources, "urop", false, false, 1000);
  expect(v.sampledActivities).toBe(25);
  expect(v.linkedActivities).toBeGreaterThan(25);
  expect(JSON.stringify(s.legacy)).toBe(before);
  expect(() =>
    sourceSession(s, data, sources, "unknown", false, false, 1000),
  ).toThrow("not assigned");
  expect(() =>
    sourceSession(s, data, sources, "urop", true, false, 1000),
  ).toThrow("Rob is reviewing");
  const first = pages.map((p) => p.id);
  s.legacy.study.regularLimit = 100;
  expect(
    assignedSourcePages(s, data, sources, "urop", false, false)
      .slice(0, 25)
      .map((p) => p.id),
  ).toEqual(first);
});
test("saved earlier proposed-title ratings are restored with references, without recopying original-title or split judgments or timing", () => {
  const s = state();
  const v = quickSession(s.legacy, data, "urop", false, false, 1000);
  for (const r of Object.values(v.draft!.payload.ratings)) {
    r.value = "acceptable";
    r.explanation = "Earlier human judgment";
  }
  v.draft!.payload.activeTimeMs = 9000;
  const legacy = saveQuick(
    s.legacy,
    data,
    "urop",
    false,
    false,
    v.draft!.payload,
    0,
    true,
    10000,
  ).answer!;
  const before = JSON.stringify(s.legacy);
  const page = sources.pages.find((p) => p.anchorCaseIds.includes(v.item!.id))!;
  // The source page can be opened in its stable place, independently of the old activity queue.
  const opened = sourceSession(s, data, sources, "urop", false, false, 20000);
  expect(opened.item!.id).toBe(page.id);
  expect(opened.draft!.payload.activeTimeMs).toBe(0);
  const refs = opened.draft!.legacyReferences.filter(
    (r) => r.recordId === legacy.id,
  );
  expect(refs.length).toBeGreaterThan(0);
  expect(refs.every((r) => r.originalQuestionId !== "split")).toBe(true);
  expect(JSON.stringify(s.legacy)).toBe(before);
  expect(opened.questions.some((q) => q.id === "original")).toBe(false);
  for (const ref of refs)
    expect(opened.draft!.payload.ratings[ref.questionId].value).toBe(
      "acceptable",
    );
});
test("every proposed title is required, uncertainty needs explanation, checkpoints and final page timing survive reload, and retries stay idempotent", () => {
  let s = state();
  const old = JSON.stringify(s.legacy);
  let v = sourceSession(s, data, sources, "urop", false, false, 1000);
  const page = assignedSourcePages(s, data, sources, "urop", false, false).find(
    (p) => sourceQuestions(p).length > 1,
  )!;
  const draft = {
    ...v.draft!,
    caseId: page.id,
    payload: {
      ...v.draft!.payload,
      caseId: page.id,
      ratings: Object.fromEntries(
        sourceQuestions(page).map((q) => [
          q.id,
          { value: "" as const, explanation: "" },
        ]),
      ),
    },
  };
  s.drafts = { [quickKey("urop", page.id)]: draft };
  v = sourceSession(s, data, sources, "urop", false, false, 1000);
  const p = JSON.parse(JSON.stringify(v.draft!.payload));
  expect(Object.keys(p.ratings).length).toBeGreaterThan(1);
  p.activeTimeMs = 5000;
  expect(() =>
    saveSourceReview(s, data, sources, "urop", false, false, p, 0, true, 6000),
  ).toThrow("Choose a rating");
  for (const r of Object.values(p.ratings) as any[]) r.value = "unsure";
  expect(() =>
    saveSourceReview(s, data, sources, "urop", false, false, p, 0, true, 6000),
  ).toThrow("explain");
  for (const r of Object.values(p.ratings) as any[])
    r.explanation = "Software test only";
  const [first, second] = Object.keys(p.ratings);
  p.ratings[first] = {
    value: "not_acceptable",
    explanation: "The first title needs a correction.",
    correction: "Correction for the first title",
  };
  p.ratings[second] = {
    value: "not_acceptable",
    explanation: "The second title needs a different correction.",
    correction: "Correction for the second title",
  };
  p.correction = "Saved correction";
  p.interruption = "Saved interruption";
  saveSourceReview(s, data, sources, "urop", false, false, p, 0, false, 6000);
  s = JSON.parse(JSON.stringify(s));
  v = sourceSession(s, data, sources, "urop", false, false, 9000);
  expect(v.draft!.payload).toEqual(p);
  expect(v.draft!.revision).toBe(1);
  expect(() =>
    saveSourceReview(s, data, sources, "urop", false, false, p, 0, false, 9000),
  ).toThrow("another tab");
  expect(() =>
    saveSourceReview(
      s,
      data,
      sources,
      "urop",
      false,
      false,
      { ...p, activeTimeMs: 99999 },
      1,
      true,
      9000,
    ),
  ).toThrow("timer");
  const a = saveSourceReview(
    s,
    data,
    sources,
    "urop",
    false,
    false,
    p,
    1,
    true,
    10000,
  ).answer!;
  expect(a).toMatchObject({ activeTimeMs: 5000, elapsedTimeMs: 9000 });
  expect(a.payload.ratings[first].correction).toBe(
    "Correction for the first title",
  );
  expect(a.payload.ratings[second].correction).toBe(
    "Correction for the second title",
  );
  const all = JSON.stringify(s.answers);
  expect(
    saveSourceReview(s, data, sources, "urop", false, false, p, 1, true, 12000)
      .duplicate,
  ).toBe(true);
  expect(JSON.stringify(s.answers)).toBe(all);
  expect(() =>
    saveSourceReview(
      s,
      data,
      sources,
      "urop",
      false,
      false,
      {
        ...p,
        ratings: {
          ...p.ratings,
          [first]: { ...p.ratings[first], correction: "Changed correction" },
        },
      },
      1,
      true,
      12000,
    ),
  ).toThrow("not been overwritten");
  expect(() =>
    saveSourceReview(
      s,
      data,
      sources,
      "urop",
      false,
      false,
      { ...p, correction: "overwrite" },
      1,
      true,
      12000,
    ),
  ).toThrow("not been overwritten");
  expect(sourceStatus(s, data, sources, "urop", false, false).completed).toBe(
    1,
  );
  expect(sourceStatus(s, data, sources, "rob", false, false).completed).toBe(0);
  expect(JSON.stringify(s.legacy)).toBe(old);
  const csv = sourceReviewCsv({
    study: s.legacy.study,
    answers: [a],
    legacyAnswers: [],
    dataset: sources,
    legacyDataset: data,
  });
  expect(csv).toContain('"5.0","9.0"');
  expect(csv.split("\r\n")).toHaveLength(3);
});
test.each([null, 42, {}, "x".repeat(5001)])(
  "invalid per-title correction is rejected without changing the draft (%#)",
  (correction) => {
    const s = state();
    const v = sourceSession(s, data, sources, "urop", false, false, 1000);
    const p = JSON.parse(JSON.stringify(v.draft!.payload));
    const first = Object.keys(p.ratings)[0];
    p.ratings[first].correction = correction;
    const before = JSON.stringify(s);
    expect(() =>
      saveSourceReview(
        s,
        data,
        sources,
        "urop",
        false,
        false,
        p,
        0,
        false,
        2000,
      ),
    ).toThrow("suggested correction");
    expect(JSON.stringify(s)).toBe(before);
  },
);
