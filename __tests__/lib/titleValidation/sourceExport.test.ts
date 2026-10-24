import { sourceReviewExport } from "../../../src/lib/titleValidation/sourceExport";
import { getQuickDataset } from "../../../src/lib/titleValidation/quickDataset";
import { getSourceDataset } from "../../../src/lib/titleValidation/sourceDataset";
import {
  sourceSession,
  saveSourceReview,
  sourceStatus,
  sourceQuestions,
  assignedSourcePages,
  type SourceState,
} from "../../../src/lib/titleValidation/sourceReview";
import { sourceReviewCsv } from "../../../src/lib/titleValidation/sourceCsv";
import { parse } from "csv-parse/sync";
const data = getQuickDataset(),
  sources = getSourceDataset();
function fixture() {
  const s: SourceState = {
    legacy: {
      study: {
        id: "quick-title-verification-test",
        protocol: "quick-title-verification-v1",
        datasetVersion: data.version,
        roster: [
          { reviewerId: "own", label: "Own" },
          { reviewerId: "other", label: "Other" },
        ],
        flaggedReviewerIds: [],
        regularLimit: 25,
        createdAt: 1,
      },
      answers: {},
      drafts: {},
    },
    answers: {},
    drafts: {},
  };
  for (const uid of ["own", "other"]) {
    const v = sourceSession(s, data, sources, uid, false, false, 1000);
    const p = JSON.parse(JSON.stringify(v.draft!.payload));
    for (const q of v.questions) p.ratings[q.id].value = "acceptable";
    p.activeTimeMs = 1000;
    saveSourceReview(s, data, sources, uid, false, false, p, 0, true, 2000);
  }
  return s;
}
test("personal download works before completion and contains only that person's submitted records and necessary source pages", () => {
  const s = fixture(),
    before = JSON.stringify(s);
  const record = sourceReviewExport(
    s,
    data,
    sources,
    "own",
    false,
    false,
    "self",
  );
  expect(record.answers).toHaveLength(1);
  expect(record.answers.every((a) => a.reviewerId === "own")).toBe(true);
  expect(record.study.roster.map((r) => r.reviewerId)).toEqual(["own"]);
  expect(record.dataset.pages).toHaveLength(1);
  expect(record.drafts).toEqual([]);
  const csv = sourceReviewCsv(record);
  expect(csv).toContain("description-page-v2");
  expect(csv).toContain('"1.0"');
  expect(csv).not.toContain('"Other"');
  expect(JSON.stringify(s)).toBe(before);
});
test("CSV keeps each correction with its proposed title and preserves earlier page-level comments", () => {
  const s = fixture();
  const record = sourceReviewExport(
    s,
    data,
    sources,
    "own",
    false,
    false,
    "self",
  );
  const answer = record.answers[0];
  const page = sources.pages.find((p) => p.id === answer.caseId)!;
  const activity = page.activities.find(
    (a) => a.supportingDescriptionCount === 1,
  )!;
  const proposal = activity.proposals[0];
  answer.payload.ratings[proposal.id].correction =
    'Correction with a comma, a "quote", and\na new line';
  answer.payload.correction = "Earlier correction for the whole page";
  answer.payload.interruption = "Earlier interruption note";
  const rows = parse(sourceReviewCsv(record), { columns: true, bom: true });
  expect(rows).toHaveLength(1);
  expect(JSON.parse(rows[0]["Per-title suggested corrections"])).toEqual([
    {
      activityId: activity.id,
      proposedTitle: proposal.title,
      correction: answer.payload.ratings[proposal.id].correction,
    },
  ]);
  expect(rows[0]["Suggested correction"]).toBe(
    "Earlier correction for the whole page",
  );
  expect(rows[0]["Interruptions or comments"]).toBe(
    "Earlier interruption note",
  );
  expect(JSON.parse(rows[0]["Proposed titles and ratings"])[0].correction).toBe(
    answer.payload.ratings[proposal.id].correction,
  );
  expect(rows[0]["Active page seconds"]).toBe("1.0");
});

test("CSV separates earlier excluded ratings and labels broader timing without rewriting the saved answer", () => {
  const s = fixture();
  const assigned = assignedSourcePages(s, data, sources, "own", false, false);
  const page = sources.pages.find(
    (p) =>
      assigned.some((a) => a.id === p.id) &&
      p.activities.some((a) => a.supportingDescriptionCount > 1),
  )!;
  const record = sourceReviewExport(
    s,
    data,
    sources,
    "own",
    false,
    false,
    "self",
  );
  const historical = {
    ...record.answers[0],
    caseId: page.id,
    reviewScope: undefined,
    timingScope: undefined,
    activityIds: page.activities.map((a) => a.id),
    payload: {
      ...record.answers[0].payload,
      caseId: page.id,
      ratings: Object.fromEntries(
        sourceQuestions(page).map((q) => [
          q.id,
          { value: "acceptable" as const, explanation: "Historical judgment" },
        ]),
      ),
    },
  };
  record.answers = [historical];
  record.dataset = sources;
  const before = JSON.stringify(record.answers);
  const rows = parse(sourceReviewCsv(record), { columns: true, bom: true });
  const current = JSON.parse(rows[0]["Proposed titles and ratings"]);
  const excluded = JSON.parse(
    rows[0]["Excluded historical or draft ratings (not current review)"],
  );
  const eligible = new Set(
    page.activities
      .filter((a) => a.supportingDescriptionCount === 1)
      .map((a) => a.id),
  );
  expect(current.every((r: any) => eligible.has(r.activityId))).toBe(true);
  expect(excluded.length).toBeGreaterThan(0);
  expect(
    excluded.every(
      (r: any) => !eligible.has(r.activityId) && r.value === "acceptable",
    ),
  ).toBe(true);
  expect(rows[0]["Timing scope"]).toContain("includes time on now-excluded");
  expect(JSON.stringify(record.answers)).toBe(before);
});
test("personal scope cannot impersonate another reviewer and team exports remain coordinator-only", () => {
  const s = fixture();
  expect(() =>
    sourceReviewExport(s, data, sources, "unknown", false, false, "self"),
  ).toThrow("not assigned");
  expect(() =>
    sourceReviewExport(s, data, sources, "own", false, false, "team"),
  ).toThrow("Only coordinators");
  expect(() =>
    sourceReviewExport(s, data, sources, "own", true, true, "team"),
  ).toThrow("Only coordinators");
});
test("an unfinished participating coordinator can download every submitted team answer and timing without changing reviews", () => {
  const s = fixture(),
    before = JSON.stringify(s);
  const view = sourceStatus(s, data, sources, "own", false, true);
  expect(view.completed).toBeLessThan(view.total);
  expect(view.exports.teamAllowed).toBe(true);
  expect(
    sourceStatus(s, data, sources, "own", false, false).exports.teamAllowed,
  ).toBe(false);
  const record = sourceReviewExport(
    s,
    data,
    sources,
    "own",
    true,
    false,
    "team",
  );
  expect(record.answers.map((a) => a.reviewerId).sort()).toEqual([
    "other",
    "own",
  ]);
  const csv = sourceReviewCsv(record);
  expect(csv).toContain('"Own"');
  expect(csv).toContain('"Other"');
  expect(csv).toContain('"1.0"');
  expect(JSON.stringify(s)).toBe(before);
});
