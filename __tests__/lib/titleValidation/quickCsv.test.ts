import { quickReviewCsv } from "../../../src/lib/titleValidation/quickCsv";
import { getQuickDataset } from "../../../src/lib/titleValidation/quickDataset";
import {
  quickSession,
  saveQuick,
  QuickState,
} from "../../../src/lib/titleValidation/quick";
test("spreadsheet export uses one row per answer, retains uncertainty and timing, and escapes formula-like text", () => {
  const data = getQuickDataset(),
    s: QuickState = {
      study: {
        id: "quick-title-verification-test",
        protocol: "quick-title-verification-v1",
        datasetVersion: data.version,
        roster: [{ reviewerId: "a", label: "A" }],
        flaggedReviewerIds: [],
        regularLimit: 25,
        createdAt: 0,
        softwareQA: true,
      },
      answers: {},
      drafts: {},
    };
  const view = quickSession(s, data, "a", false, false, 1000),
    p = view.draft!.payload;
  for (const q of view.questions)
    p.ratings[q.id] = { value: "unsure", explanation: "Needs an explanation" };
  p.activeTimeMs = 5000;
  p.correction = "=1+1";
  saveQuick(s, data, "a", false, false, p, 0, true, 8000);
  const csv = quickReviewCsv({
    study: s.study,
    answers: Object.values(s.answers),
    dataset: data,
  });
  expect(csv.match(/"5000"/)).toBeNull();
  expect(csv).toContain('"5.0","7.0"');
  expect(csv).toContain('"\'=1+1"');
  expect(csv).toContain("I'm not sure");
  expect(csv).toContain("YES — exclude from human results");
  expect(csv.match(/"5\.0","7\.0"/g)).toHaveLength(1);
});
