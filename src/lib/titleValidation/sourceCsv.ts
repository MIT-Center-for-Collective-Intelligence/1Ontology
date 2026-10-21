import type { SourceAnswer, SourceDataset } from "./sourceReview";
import type { QuickAnswer, QuickDataset, QuickStudy } from "./quick";
const cell = (v: unknown) => {
  let s = String(v ?? "");
  if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
};
export function sourceReviewCsv(record: {
  study: QuickStudy;
  answers: SourceAnswer[];
  legacyAnswers: QuickAnswer[];
  dataset: SourceDataset;
  legacyDataset: QuickDataset;
}) {
  const headers = [
    "Record type",
    "Reviewer",
    "O*NET description",
    "Activity IDs",
    "Proposed titles and ratings",
    "Suggested correction",
    "Interruptions or comments",
    "Active page seconds",
    "Elapsed seconds",
    "Submitted (UTC)",
    "Record ID",
    "Package version",
    "Earlier rating references",
    "Missing-proposal activity IDs",
    "Software test",
    "Sampled anchor IDs",
    "Review pool",
    "Package SHA256",
    "Per-title suggested corrections",
    "Active seconds at original submission",
    "Active seconds on later visits",
    "Last timing update (UTC)",
    "Submitted review scope",
    "Timing scope",
    "Excluded historical or draft ratings (not current review)",
  ];
  const reviewer = (id: string) =>
    record.study.roster.find((r) => r.reviewerId === id)?.label || id;
  const rows = record.answers.map((a) => {
    const page = record.dataset.pages.find((p) => p.id === a.caseId)!;
    const ratingsFor = (activities: typeof page.activities) =>
      activities.flatMap((activity) =>
        activity.proposals.map((p) => ({
          activityId: activity.id,
          originalTitle: activity.currentTitle,
          proposedTitle: p.title,
          ...a.payload.ratings[p.id],
        })),
      );
    const eligible = page.activities.filter(
      (activity) =>
        activity.supportingDescriptionCount === 1 &&
        a.activityIds.includes(activity.id),
    );
    const ratings = ratingsFor(eligible);
    const excluded = ratingsFor(
      page.activities.filter(
        (activity) => activity.supportingDescriptionCount !== 1,
      ),
    ).filter((rating) => rating.value);
    return [
      "description-page-v2",
      reviewer(a.reviewerId),
      page.description,
      eligible.map((activity) => activity.id).join("\n"),
      JSON.stringify(ratings),
      a.payload.correction,
      a.payload.interruption,
      ((a.cumulativeActiveTimeMs ?? a.activeTimeMs) / 1000).toFixed(1),
      (a.elapsedTimeMs / 1000).toFixed(1),
      new Date(a.submittedAt).toISOString(),
      a.id,
      a.packageVersion,
      JSON.stringify(a.legacyReferences),
      a.missingProposalActivityIds.join("\n"),
      a.softwareQA ? "YES — exclude from human results" : "No",
      a.sampledAnchorIds.join("\n"),
      a.reviewPool,
      a.packageSha256,
      JSON.stringify(
        ratings
          .filter((r) => r.correction?.trim())
          .map((r) => ({
            activityId: r.activityId,
            proposedTitle: r.proposedTitle,
            correction: r.correction,
          })),
      ),
      (a.activeTimeMs / 1000).toFixed(1),
      ((a.revisitActiveTimeMs ?? 0) / 1000).toFixed(1),
      new Date(a.lastTimingUpdateAt ?? a.submittedAt).toISOString(),
      a.reviewScope || "all-linked-v2 (historical)",
      a.timingScope ||
        "all-linked-v2 (includes time on now-excluded activities)",
      JSON.stringify(excluded),
    ];
  });
  for (const a of record.legacyAnswers) {
    const c = record.legacyDataset.cases.find((c) => c.id === a.caseId)!;
    rows.push([
      "historical-activity-v1",
      reviewer(a.reviewerId),
      c.description,
      c.id,
      JSON.stringify({ titles: c.modelTitles, ratings: a.payload.ratings }),
      a.payload.correction,
      a.payload.interruption,
      (a.activeTimeMs / 1000).toFixed(1),
      (a.elapsedTimeMs / 1000).toFixed(1),
      new Date(a.submittedAt).toISOString(),
      a.id,
      record.legacyDataset.version,
      "",
      "",
      a.softwareQA ? "YES — exclude from human results" : "No",
      c.id,
      c.batch,
      "",
      "",
      (a.activeTimeMs / 1000).toFixed(1),
      "0.0",
      new Date(a.submittedAt).toISOString(),
      "historical-activity-v1",
      "historical-activity-v1",
      "[]",
    ]);
  }
  return (
    "\ufeff" +
    [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") +
    "\r\n"
  );
}
