import { sourceReviewExport } from "../../../src/lib/titleValidation/sourceExport";
import { getQuickDataset } from "../../../src/lib/titleValidation/quickDataset";
import { getSourceDataset } from "../../../src/lib/titleValidation/sourceDataset";
import {
  sourceSession,
  saveSourceReview,
  sourceStatus,
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
    for (const r of Object.values(p.ratings) as any[]) r.value = "acceptable";
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
  const proposal = page.activities[0].proposals[0];
  answer.payload.ratings[proposal.id].correction =
    'Correction with a comma, a "quote", and\na new line';
  answer.payload.correction = "Earlier correction for the whole page";
  answer.payload.interruption = "Earlier interruption note";
  const rows = parse(sourceReviewCsv(record), { columns: true, bom: true });
  expect(rows).toHaveLength(1);
  expect(JSON.parse(rows[0]["Per-title suggested corrections"])).toEqual([
    {
      activityId: page.activities[0].id,
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
