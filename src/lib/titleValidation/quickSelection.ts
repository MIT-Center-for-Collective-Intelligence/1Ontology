import crypto from "crypto";
import manifest from "./data/quick-selection-v1.json";
import type { QuickAnswer, QuickCase, QuickDataset, QuickState } from "./quick";

export interface QuickSelection {
  version: string;
  sha256: string;
  activatedAt: number;
  legacyDrafts: Record<
    string,
    {
      reviewerId: string;
      caseId: string;
      firstPresentedAt: number;
      submissionId: string;
      snapshotSha256: string;
    }
  >;
}
export interface QuickSelectionProvenance {
  version: string;
  sha256: string | null;
  batch: QuickCase["batch"];
  access: "assigned" | "pre-cutover-draft";
}
export const LEGACY_QUICK_SELECTION = "quick-title-selection-original-v1";
export const selectionHash = (value: unknown) =>
  crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const QUICK_SELECTION_SHA256 = selectionHash(manifest);
const initial = new Set(manifest.initialCaseIds);
export const effectiveQuickBatch = (item: QuickCase): QuickCase["batch"] =>
  item.batch === "flagged"
    ? "flagged"
    : initial.has(item.id)
      ? "first25"
      : "next75";
const outcomes = (cases: QuickCase[]) =>
  Object.fromEntries(
    ["Keep", "Clarify", "Split"].map((outcome) => [
      outcome,
      cases.filter((c) => c.outcome === outcome).length,
    ]),
  );
export function quickSelectionRelease(data: QuickDataset) {
  const regular = data.cases.filter((c) => c.batch !== "flagged");
  const selected = regular.filter((c) => initial.has(c.id));
  const reserve = regular.filter((c) => !initial.has(c.id));
  const flagged = data.cases.filter((c) => c.batch === "flagged");
  if (
    data.version !== manifest.datasetVersion ||
    data.cases.length !== 419 ||
    new Set(data.cases.map((c) => c.id)).size !== 419 ||
    initial.size !== 25 ||
    selected.length !== 25 ||
    reserve.length !== 75 ||
    regular.length !== 100 ||
    flagged.length !== 319 ||
    manifest.protectedCaseIds.some((id) => !initial.has(id)) ||
    JSON.stringify(outcomes(selected)) !==
      JSON.stringify({ Keep: 5, Clarify: 15, Split: 5 }) ||
    JSON.stringify(outcomes(reserve)) !==
      JSON.stringify({ Keep: 1, Clarify: 74, Split: 0 }) ||
    JSON.stringify(outcomes(regular.filter((c) => c.batch === "first25"))) !==
      JSON.stringify({ Keep: 2, Clarify: 22, Split: 1 }) ||
    JSON.stringify(outcomes(regular.filter((c) => c.batch === "next75"))) !==
      JSON.stringify({ Keep: 4, Clarify: 67, Split: 4 })
  )
    throw Error("Quick title-selection coverage changed");
  return {
    selectionVersion: manifest.version,
    selectionSha256: QUICK_SELECTION_SHA256,
    initialOutcomes: outcomes(selected),
    reservedOutcomes: outcomes(reserve),
    selectionCoverage: {
      initial: 25,
      reserve: 75,
      regular: 100,
      flagged: 319,
      cases: 419,
    },
  };
}
export function assertQuickSelection(state: QuickState) {
  const saved = state.study.selection;
  if (
    saved &&
    (saved.version !== manifest.version ||
      saved.sha256 !== QUICK_SELECTION_SHA256)
  )
    throw Error("Unsupported saved quick title-selection");
}
export function makeQuickSelection(
  state: QuickState,
  data: QuickDataset,
  now: number,
): QuickSelection {
  quickSelectionRelease(data);
  return {
    version: manifest.version,
    sha256: QUICK_SELECTION_SHA256,
    activatedAt: now,
    legacyDrafts: Object.fromEntries(
      Object.entries(state.drafts)
        .filter(
          ([key, d]) =>
            !state.answers[key] &&
            data.cases.some((c) => c.id === d.caseId && c.batch !== "flagged"),
        )
        .map(([key, d]) => [
          key,
          {
            reviewerId: d.reviewerId,
            caseId: d.caseId,
            firstPresentedAt: d.firstPresentedAt,
            submissionId: d.payload.submissionId,
            snapshotSha256: selectionHash(d),
          },
        ]),
    ),
  };
}
export function isLegacyQuickDraft(
  state: QuickState,
  key: string,
  uid: string,
) {
  const saved = state.study.selection?.legacyDrafts[key],
    draft = state.drafts[key];
  return Boolean(
    saved &&
    draft &&
    !state.answers[key] &&
    saved.reviewerId === uid &&
    draft.reviewerId === uid &&
    saved.caseId === draft.caseId &&
    saved.firstPresentedAt === draft.firstPresentedAt &&
    saved.submissionId === draft.payload.submissionId,
  );
}
export function quickAnswerSelection(
  state: QuickState,
  item: QuickCase,
  answer?: QuickAnswer,
): QuickSelectionProvenance {
  if (answer?.selection) return answer.selection;
  if (answer || !state.study.selection)
    return {
      version: LEGACY_QUICK_SELECTION,
      sha256: null,
      batch: item.batch,
      access: "assigned",
    };
  return {
    version: manifest.version,
    sha256: QUICK_SELECTION_SHA256,
    batch: effectiveQuickBatch(item),
    access: "assigned",
  };
}
export const quickSelectionManifest = manifest;
