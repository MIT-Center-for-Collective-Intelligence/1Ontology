import type { QuickAnswer, QuickDataset, QuickStudy } from "./quick";
import type { QuickSelectionProvenance } from "./quickSelection";

const label: Record<string, string> = {
  acceptable: "Acceptable",
  not_acceptable: "Not acceptable",
  unsure: "I'm not sure",
};
// The audit API retains original strings. Protect spreadsheet cells when displaying free text.
const cell = (value: unknown) => {
  let s = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
};
export function quickReviewCsv(record: {
  study: QuickStudy;
  answers: QuickAnswer[];
  dataset: QuickDataset;
  selection?: {
    active: boolean;
    selectionVersion: string;
    selectionSha256: string;
    initialCaseIds: string[];
  };
  answerSelections?: Record<string, QuickSelectionProvenance>;
}) {
  const headers = [
    "Reviewer",
    "Original title",
    "O*NET description",
    "Proposed titles",
    "Model outcome",
    "Review set",
    "Original rating",
    "Original explanation",
    "Split rating",
    "Split explanation",
    "Proposed title ratings and explanations",
    "Suggested correction",
    "Interruptions or comments",
    "Active page seconds",
    "Elapsed seconds (includes interruptions)",
    "First shown (UTC)",
    "Submitted (UTC)",
    "Activity ID",
    "Dataset version",
    "Software test",
    "Effective current review set",
    "Current selection version",
    "Current selection SHA-256",
    "Answer selection version",
    "Answer selection SHA-256",
    "Answer selection review set",
    "Answer assignment access",
  ];
  const rows = record.answers.map((a) => {
    const c = record.dataset.cases.find((c) => c.id === a.caseId)!;
    const original = a.payload.ratings.original,
      split = a.payload.ratings.split;
    const current = record.selection?.active;
    const provenance = record.answerSelections?.[a.id] || a.selection;
    return [
      record.study.roster.find((r) => r.reviewerId === a.reviewerId)?.label ||
        a.reviewerId,
      c.currentTitle,
      c.description,
      c.modelTitles.join("\n"),
      c.outcome,
      c.batch,
      label[original.value],
      original.explanation,
      split ? label[split.value] : "Not applicable",
      split?.explanation || "",
      c.outcome === "Keep"
        ? "Same as original"
        : c.modelTitles
            .map((title, i) => {
              const r = a.payload.ratings["proposed-" + i];
              return `${i + 1}. ${title}: ${label[r.value]}${r.explanation ? " — " + r.explanation : ""}`;
            })
            .join("\n"),
      a.payload.correction,
      a.payload.interruption,
      (a.activeTimeMs / 1000).toFixed(1),
      (a.elapsedTimeMs / 1000).toFixed(1),
      new Date(a.firstPresentedAt).toISOString(),
      new Date(a.submittedAt).toISOString(),
      a.caseId,
      record.dataset.version,
      a.softwareQA ? "YES — exclude from human results" : "No",
      !current || c.batch === "flagged"
        ? c.batch
        : record.selection!.initialCaseIds.includes(c.id)
          ? "first25"
          : "next75",
      current
        ? record.selection!.selectionVersion
        : "quick-title-selection-original-v1",
      current ? record.selection!.selectionSha256 : "",
      provenance?.version || "quick-title-selection-original-v1",
      provenance?.sha256 || "",
      provenance?.batch || c.batch,
      provenance?.access || "assigned",
    ];
  });
  // One row per activity and reviewer: timing is never repeated for each proposed title.
  return (
    "\ufeff" +
    [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") +
    "\r\n"
  );
}
