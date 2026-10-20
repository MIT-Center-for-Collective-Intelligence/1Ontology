import { sourceReviewExport } from "../../../src/lib/titleValidation/sourceExport";
import { getQuickDataset } from "../../../src/lib/titleValidation/quickDataset";
import { getSourceDataset } from "../../../src/lib/titleValidation/sourceDataset";
import {
  sourceSession,
  saveSourceReview,
  type SourceState,
} from "../../../src/lib/titleValidation/sourceReview";
import { sourceReviewCsv } from "../../../src/lib/titleValidation/sourceCsv";
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
test("personal scope cannot impersonate another reviewer; unfinished participating coordinators cannot download team answers", () => {
  const s = fixture();
  expect(() =>
    sourceReviewExport(s, data, sources, "unknown", false, false, "self"),
  ).toThrow("not assigned");
  expect(() =>
    sourceReviewExport(s, data, sources, "own", false, false, "team"),
  ).toThrow("Only coordinators");
  expect(() =>
    sourceReviewExport(s, data, sources, "own", true, false, "team"),
  ).toThrow("Finish your regular");
  s.legacy.study.softwareQA = true;
  expect(
    sourceReviewExport(s, data, sources, "own", true, false, "team").answers,
  ).toHaveLength(2);
  expect(() =>
    sourceReviewExport(s, data, sources, "own", true, true, "team"),
  ).toThrow("Only coordinators");
});
