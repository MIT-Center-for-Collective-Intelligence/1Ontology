import crypto from "crypto";
import { TitleValidationError } from "./engine";
import {
  assertQuickSelection,
  effectiveQuickBatch,
  isLegacyQuickDraft,
  quickAnswerSelection,
  QuickSelection,
  QuickSelectionProvenance,
} from "./quickSelection";

export type QuickRating = "acceptable" | "not_acceptable" | "unsure";
export interface QuickCase {
  id: string;
  currentTitle: string;
  description: string;
  modelTitles: string[];
  modelReason: string;
  sourceId: string;
  outcome: "Keep" | "Clarify" | "Split";
  batch: "first25" | "next75" | "flagged";
}
export interface QuickDataset {
  version: string;
  cases: QuickCase[];
  provenance: Record<string, unknown>;
  scientificPrompt: string;
}
export interface QuickPayload {
  caseId: string;
  ratings: Record<string, { value: QuickRating | ""; explanation: string }>;
  correction: string;
  interruption: string;
  activeTimeMs: number;
  submissionId: string;
}
export interface QuickDraft {
  reviewerId: string;
  caseId: string;
  revision: number;
  firstPresentedAt: number;
  updatedAt: number;
  payload: QuickPayload;
}
export interface QuickAnswer {
  id: string;
  reviewerId: string;
  caseId: string;
  payload: QuickPayload;
  payloadHash: string;
  firstPresentedAt: number;
  submittedAt: number;
  elapsedTimeMs: number;
  activeTimeMs: number;
  softwareQA: boolean;
  selection?: QuickSelectionProvenance;
}
export interface QuickStudy {
  id: string;
  protocol: "quick-title-verification-v1";
  datasetVersion: string;
  roster: { reviewerId: string; label: string }[];
  flaggedReviewerIds: string[];
  regularLimit: 25 | 100;
  createdAt: number;
  softwareQA?: boolean;
  selection?: QuickSelection;
}
export interface QuickState {
  study: QuickStudy;
  answers: Record<string, QuickAnswer>;
  drafts: Record<string, QuickDraft>;
}
export const QUICK_STUDY_ID = "quick-title-verification-20261019-v1";
export const QUICK_QA_ID = "software-qa-quick-title-20261019-v1";
export const QUICK_SELECTION_QA_ID =
  "software-qa-quick-title-selection-5-15-5-v1";
export const quickHash = (value: unknown) =>
  crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const quickKey = (uid: string, id: string) => quickHash([uid, id]);
const fail = (status: number, message: string): never => {
  throw new TitleValidationError(status, message);
};
export function quickQuestions(item: QuickCase) {
  return [
    {
      id: "original",
      label:
        item.outcome === "Keep"
          ? "Is this title acceptable?"
          : "Is the original title acceptable?",
      title: item.currentTitle,
    },
    ...(item.outcome === "Split"
      ? [
          {
            id: "split",
            label:
              "Is dividing this activity into these proposed activities acceptable?",
            title: "",
          },
        ]
      : []),
    ...(item.outcome === "Keep"
      ? []
      : item.modelTitles.map((title, i) => ({
          id: "proposed-" + i,
          label:
            item.modelTitles.length > 1
              ? "Is proposed title " + (i + 1) + " acceptable?"
              : "Is the proposed title acceptable?",
          title,
        }))),
  ];
}
export function quickCases(
  state: QuickState,
  data: QuickDataset,
  uid: string,
  flagged: boolean,
  canManage: boolean,
) {
  assertQuickSelection(state);
  if (
    state.study.protocol !== "quick-title-verification-v1" ||
    state.study.datasetVersion !== data.version
  )
    fail(
      409,
      "This review version does not match its saved study. Existing answers are unchanged.",
    );
  if (!state.study.roster.some((r) => r.reviewerId === uid) && !canManage)
    fail(
      403,
      "You are not assigned yet. Ask Iman or Rob to add your ontology account.",
    );
  if (flagged && !canManage && !state.study.flaggedReviewerIds.includes(uid))
    fail(
      403,
      "Rob is reviewing the flagged items first. Please use your regular review.",
    );
  const batch = (c: QuickCase) =>
    state.study.selection ? effectiveQuickBatch(c) : c.batch;
  return data.cases
    .filter((c) =>
      flagged
        ? c.batch === "flagged"
        : batch(c) === "first25" ||
          (state.study.regularLimit === 100 && batch(c) === "next75"),
    )
    .sort(
      (a, b) =>
        (batch(a) === "first25" ? 0 : 1) - (batch(b) === "first25" ? 0 : 1) ||
        quickHash([data.version, uid, a.id]).localeCompare(
          quickHash([data.version, uid, b.id]),
        ),
    );
}
export function emptyQuickPayload(item: QuickCase): QuickPayload {
  return {
    caseId: item.id,
    ratings: Object.fromEntries(
      quickQuestions(item).map((q) => [q.id, { value: "", explanation: "" }]),
    ),
    correction: "",
    interruption: "",
    activeTimeMs: 0,
    submissionId: crypto.randomUUID(),
  };
}
export function validateQuickPayload(
  value: unknown,
  item: QuickCase,
  final: boolean,
): QuickPayload {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(400, "The answer is missing.");
  const p = value as QuickPayload;
  const ids = quickQuestions(item).map((q) => q.id);
  if (
    p.caseId !== item.id ||
    !p.ratings ||
    typeof p.ratings !== "object" ||
    Array.isArray(p.ratings) ||
    Object.keys(p.ratings).sort().join() !== ids.sort().join()
  )
    fail(400, "Please answer the questions shown for this activity.");
  if (
    typeof p.submissionId !== "string" ||
    !/^[A-Za-z0-9_-]{8,100}$/.test(p.submissionId) ||
    !Number.isSafeInteger(p.activeTimeMs) ||
    p.activeTimeMs < 0 ||
    p.activeTimeMs > 7 * 86400000
  )
    fail(400, "The answer or timer is invalid. Reload this activity.");
  for (const id of ids) {
    const r = p.ratings[id];
    if (
      !r ||
      !["", "acceptable", "not_acceptable", "unsure"].includes(r.value) ||
      (final && !r.value)
    )
      fail(400, "Choose a rating for every question.");
    if (typeof r.explanation !== "string" || r.explanation.length > 5000)
      fail(400, "Keep each explanation under 5,000 characters.");
    if (
      final &&
      ["not_acceptable", "unsure"].includes(r.value) &&
      !r.explanation.trim()
    )
      fail(
        400,
        "Please explain each “Not acceptable” or “I’m not sure” answer.",
      );
  }
  if (
    [p.correction, p.interruption].some(
      (s) => typeof s !== "string" || s.length > 5000,
    )
  )
    fail(400, "Keep each comment under 5,000 characters.");
  // Canonical field order makes retry identity independent of JSON key ordering.
  return {
    caseId: p.caseId,
    ratings: Object.fromEntries(
      quickQuestions(item).map((q) => [
        q.id,
        {
          value: p.ratings[q.id].value,
          explanation: p.ratings[q.id].explanation,
        },
      ]),
    ),
    correction: p.correction,
    interruption: p.interruption,
    activeTimeMs: p.activeTimeMs,
    submissionId: p.submissionId,
  };
}
function currentQuickCase(
  state: QuickState,
  data: QuickDataset,
  uid: string,
  flagged: boolean,
  cases: QuickCase[],
) {
  const eligible = data.cases.filter(
    (c) =>
      (flagged ? c.batch === "flagged" : c.batch !== "flagged") &&
      (cases.some((assigned) => assigned.id === c.id) ||
        isLegacyQuickDraft(state, quickKey(uid, c.id), uid)),
  );
  const drafts = eligible
    .filter((c) => {
      const key = quickKey(uid, c.id),
        draft = state.drafts[key];
      return (
        !state.answers[key] &&
        draft?.reviewerId === uid &&
        draft.caseId === c.id
      );
    })
    .sort(
      (a, b) =>
        state.drafts[quickKey(uid, a.id)].firstPresentedAt -
          state.drafts[quickKey(uid, b.id)].firstPresentedAt ||
        a.id.localeCompare(b.id),
    );
  return drafts[0] || cases.find((c) => !state.answers[quickKey(uid, c.id)]);
}
export function quickStatus(
  state: QuickState,
  data: QuickDataset,
  uid: string,
  flagged: boolean,
  canManage: boolean,
  now: number,
) {
  const cases = quickCases(state, data, uid, flagged, canManage);
  const done = cases.filter((c) => state.answers[quickKey(uid, c.id)]);
  const item = currentQuickCase(state, data, uid, flagged, cases);
  const draft = item ? state.drafts[quickKey(uid, item.id)] : undefined;
  const answers = Object.values(state.answers).filter(
    (a) =>
      a.reviewerId === uid &&
      data.cases.some(
        (c) =>
          c.id === a.caseId &&
          (flagged ? c.batch === "flagged" : c.batch !== "flagged"),
      ),
  );
  return {
    studyId: state.study.id,
    datasetVersion: data.version,
    reviewerKey: quickHash([state.study.id, uid]),
    reviewerLabel:
      state.study.roster.find((r) => r.reviewerId === uid)?.label ||
      "Coordinator",
    completed: done.length,
    total: cases.length,
    item,
    draft,
    questions: item ? quickQuestions(item) : [],
    flagged,
    canManage,
    canReviewFlagged: canManage || state.study.flaggedReviewerIds.includes(uid),
    regularLimit: state.study.regularLimit,
    softwareQA: Boolean(state.study.softwareQA),
    selectionVersion:
      state.study.selection?.version || "quick-title-selection-original-v1",
    selectionSha256: state.study.selection?.sha256 || null,
    historicalCompleted: answers.length,
    historicalOutsideCurrentSelection: answers.length - done.length,
    savedActiveTimeMs: answers.reduce((n, a) => n + a.activeTimeMs, 0),
    savedElapsedTimeMs: answers.reduce((n, a) => n + a.elapsedTimeMs, 0),
    disclosure: { prompt: data.scientificPrompt, provenance: data.provenance },
  };
}
export function quickSession(
  state: QuickState,
  data: QuickDataset,
  uid: string,
  flagged: boolean,
  canManage: boolean,
  now: number,
) {
  const session = quickStatus(state, data, uid, flagged, canManage, now);
  if (session.item && !session.draft) {
    session.draft = {
      reviewerId: uid,
      caseId: session.item.id,
      revision: 0,
      firstPresentedAt: now,
      updatedAt: now,
      payload: emptyQuickPayload(session.item),
    };
    state.drafts[quickKey(uid, session.item.id)] = session.draft;
  }
  return session;
}
export function saveQuick(
  state: QuickState,
  data: QuickDataset,
  uid: string,
  flagged: boolean,
  canManage: boolean,
  raw: unknown,
  revision: unknown,
  final: boolean,
  now: number,
) {
  const cases = quickCases(state, data, uid, flagged, canManage);
  const item =
    data.cases.find(
      (c) =>
        c.id === (raw as QuickPayload)?.caseId &&
        (flagged ? c.batch === "flagged" : c.batch !== "flagged"),
    ) || fail(403, "This activity is not in your assigned review.");
  const p = validateQuickPayload(raw, item, final),
    key = quickKey(uid, item.id);
  const answer = state.answers[key];
  if (answer) {
    if (final && answer.payloadHash === quickHash(p))
      return { duplicate: true, answer };
    fail(
      409,
      "This answer has already been saved. It has not been overwritten.",
    );
  }
  if (
    !cases.some((c) => c.id === item.id) &&
    !isLegacyQuickDraft(state, key, uid)
  )
    fail(403, "This activity is not in your assigned review.");
  const current = currentQuickCase(state, data, uid, flagged, cases);
  if (current?.id !== item.id)
    fail(409, "Save your current activity before continuing.");
  const draft =
    state.drafts[key] || fail(409, "Open this activity before saving it.");
  if (
    draft.reviewerId !== uid ||
    draft.caseId !== item.id ||
    p.submissionId !== draft.payload.submissionId
  )
    fail(409, "Reload to recover the original saved draft.");
  if (revision !== draft.revision)
    fail(
      409,
      "This activity changed in another tab. Reload to recover the latest saved draft.",
    );
  if (
    p.activeTimeMs < draft.payload.activeTimeMs ||
    p.activeTimeMs > Math.max(0, now - draft.firstPresentedAt) + 2000
  )
    fail(
      400,
      "The timer does not match this activity. Reload to recover your draft.",
    );
  const next = {
    ...draft,
    revision: draft.revision + 1,
    updatedAt: now,
    payload: p,
  };
  state.drafts[key] = next;
  if (!final) return { duplicate: false, draft: next };
  const saved: QuickAnswer = {
    id: key,
    reviewerId: uid,
    caseId: item.id,
    payload: p,
    payloadHash: quickHash(p),
    firstPresentedAt: draft.firstPresentedAt,
    submittedAt: now,
    elapsedTimeMs: Math.max(0, now - draft.firstPresentedAt),
    activeTimeMs: p.activeTimeMs,
    softwareQA: Boolean(state.study.softwareQA),
    selection: {
      ...quickAnswerSelection(state, item),
      access: cases.some((c) => c.id === item.id)
        ? "assigned"
        : "pre-cutover-draft",
    },
  };
  state.answers[key] = saved;
  return { duplicate: false, answer: saved };
}
