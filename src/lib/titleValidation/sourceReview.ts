import {
  QuickAnswer,
  QuickDataset,
  QuickDraft,
  QuickPayload,
  QuickState,
  quickCases,
  quickHash,
  quickKey,
} from "./quick";
import { TitleValidationError } from "./engine";
import { hasReviewNavigation } from "./reviewNavigation";

export const SOURCE_FORM = "proposed-titles-by-source-v2";
export interface SourceActivity {
  id: string;
  currentTitle: string;
  proposals: {
    id: string;
    title: string;
    reason: string;
    groupNumber: number;
  }[];
  modelReason: string;
  flagged: boolean;
  evidenceDescriptionNumber: number;
  supportingDescriptionCount: number;
}
export interface SourcePage {
  id: string;
  sourceId: string;
  description: string;
  activities: SourceActivity[];
  anchorCaseIds: string[];
}
export interface SourceDataset {
  version: string;
  bundleSha256?: string;
  pages: SourcePage[];
  provenance: Record<string, unknown>;
}
export interface LegacyReference {
  questionId: string;
  recordId: string;
  kind: "answer" | "draft";
  originalQuestionId: string;
}
export interface SourceDraft extends QuickDraft {
  legacyReferences: LegacyReference[];
}
export interface SourceAnswer extends QuickAnswer {
  formVersion: typeof SOURCE_FORM;
  packageVersion: string;
  packageSha256: string;
  sampledAnchorIds: string[];
  reviewPool: "regular" | "flagged";
  legacyReferences: LegacyReference[];
  activityIds: string[];
  missingProposalActivityIds: string[];
  // Derived only for exports; the immutable submission stays unchanged.
  cumulativeActiveTimeMs?: number;
  revisitActiveTimeMs?: number;
  lastTimingUpdateAt?: number;
}
export interface SourceState {
  legacy: QuickState;
  answers: Record<string, SourceAnswer>;
  drafts: Record<string, SourceDraft>;
}
const fail = (status: number, message: string): never => {
  throw new TitleValidationError(status, message);
};
export function sourceQuestions(page: SourcePage) {
  return page.activities.flatMap((activity) =>
    activity.proposals.map((p) => ({
      id: p.id,
      title: p.title,
      label: "Is the proposed title acceptable?",
      originalTitle: activity.currentTitle,
      activityId: activity.id,
      reason: [activity.modelReason, p.reason].filter(Boolean).join("\n"),
    })),
  );
}
export function assignedSourcePages(
  state: SourceState,
  data: QuickDataset,
  sources: SourceDataset,
  uid: string,
  flagged: boolean,
  canManage: boolean,
) {
  const anchors = quickCases(state.legacy, data, uid, flagged, canManage);
  const rank = new Map(anchors.map((c, i) => [c.id, i]));
  return sources.pages
    .filter((p) => p.anchorCaseIds.some((id) => rank.has(id)))
    .sort(
      (a, b) =>
        Math.min(...a.anchorCaseIds.map((id) => rank.get(id) ?? Infinity)) -
        Math.min(...b.anchorCaseIds.map((id) => rank.get(id) ?? Infinity)),
    );
}
function initialDraft(
  state: SourceState,
  page: SourcePage,
  data: QuickDataset,
  uid: string,
  now: number,
): SourceDraft {
  const references: LegacyReference[] = [];
  const ratings = Object.fromEntries(
    sourceQuestions(page).map((q) => {
      const key = quickKey(uid, q.activityId),
        answer = state.legacy.answers[key],
        draft = state.legacy.drafts[key];
      const old = answer || draft;
      const c = data.cases.find((c) => c.id === q.activityId);
      let oldQuestion = "";
      if (c && c.outcome === "Keep" && c.currentTitle === q.title)
        oldQuestion = "original";
      else if (c) {
        const index = c.modelTitles.indexOf(q.title);
        if (index >= 0) oldQuestion = "proposed-" + index;
      }
      const r = old?.payload.ratings[oldQuestion];
      if (r?.value)
        references.push({
          questionId: q.id,
          recordId: key,
          kind: answer ? "answer" : "draft",
          originalQuestionId: oldQuestion,
        });
      return [q.id, r ? { ...r } : { value: "" as const, explanation: "" }];
    }),
  );
  return {
    reviewerId: uid,
    caseId: page.id,
    revision: 0,
    firstPresentedAt: now,
    updatedAt: now,
    payload: {
      caseId: page.id,
      ratings,
      correction: "",
      interruption: "",
      activeTimeMs: 0,
      submissionId: crypto.randomUUID(),
    },
    legacyReferences: references,
  };
}
import crypto from "crypto";
export function sourceStatus(
  state: SourceState,
  data: QuickDataset,
  sources: SourceDataset,
  uid: string,
  flagged: boolean,
  canManage: boolean,
  pageId?: string,
) {
  const pages = assignedSourcePages(
    state,
    data,
    sources,
    uid,
    flagged,
    canManage,
  );
  const done = pages.filter((p) => state.answers[quickKey(uid, p.id)]);
  const unfinished = pages.filter((p) => !state.answers[quickKey(uid, p.id)]);
  const defaultItem =
    unfinished
      .filter((p) => state.drafts[quickKey(uid, p.id)])
      .sort(
        (a, b) =>
          state.drafts[quickKey(uid, a.id)].firstPresentedAt -
          state.drafts[quickKey(uid, b.id)].firstPresentedAt,
      )[0] || unfinished[0];
  const item =
    pageId === undefined
      ? defaultItem
      : pages.find((p) => p.id === pageId) ||
        fail(403, "This description is not in your assigned review.");
  const draft = item ? state.drafts[quickKey(uid, item.id)] : undefined;
  const submitted = item ? state.answers[quickKey(uid, item.id)] : undefined;
  const regular = flagged
    ? assignedSourcePages(state, data, sources, uid, false, canManage)
    : pages;
  const regularRemaining = regular.filter(
    (p) => !state.answers[quickKey(uid, p.id)],
  ).length;
  return {
    studyId: state.legacy.study.id,
    datasetVersion: sources.version,
    formVersion: SOURCE_FORM,
    reviewerKey: quickHash([state.legacy.study.id, uid]),
    reviewerLabel:
      state.legacy.study.roster.find((r) => r.reviewerId === uid)?.label ||
      "Coordinator",
    completed: done.length,
    total: pages.length,
    item,
    draft,
    submitted: Boolean(submitted),
    navigation: pages.map((page, index) => ({
      id: page.id,
      number: index + 1,
      submitted: Boolean(state.answers[quickKey(uid, page.id)]),
      multipleDescriptionActivities: page.activities
        .filter((a) => a.supportingDescriptionCount > 1)
        .map((a) => ({
          id: a.id,
          title: a.currentTitle,
          descriptions: a.supportingDescriptionCount,
        })),
    })),
    questions: item ? sourceQuestions(item) : [],
    flagged,
    canManage,
    exports: {
      ownSubmitted:
        Object.values(state.answers).filter((a) => a.reviewerId === uid)
          .length +
        Object.values(state.legacy.answers).filter((a) => a.reviewerId === uid)
          .length,
      teamAllowed: canManage,
      regularRemaining,
    },
    canReviewFlagged:
      canManage ||
      state.legacy.study.flaggedReviewerIds.includes(uid) ||
      hasReviewNavigation(uid),
    regularLimit: state.legacy.study.regularLimit,
    softwareQA: Boolean(state.legacy.study.softwareQA),
    selectionVersion:
      state.legacy.study.selection?.version ||
      "quick-title-selection-original-v1",
    historicalCompleted: Object.values(state.legacy.answers).filter(
      (a) => a.reviewerId === uid,
    ).length,
    sampledActivities: quickCases(state.legacy, data, uid, flagged, canManage)
      .length,
    linkedActivities: pages.reduce((n, p) => n + p.activities.length, 0),
    disclosure: {
      prompt: data.scientificPrompt,
      provenance: {
        ...data.provenance,
        sourcePagePackageVersion: sources.version,
        sourcePageProvenance: sources.provenance,
      } as Record<string, unknown>,
    },
  };
}
export function sourceSession(
  state: SourceState,
  data: QuickDataset,
  sources: SourceDataset,
  uid: string,
  flagged: boolean,
  canManage: boolean,
  now: number,
  pageId?: string,
) {
  let view = sourceStatus(
    state,
    data,
    sources,
    uid,
    flagged,
    canManage,
    pageId,
  );
  if (view.item && !view.draft) {
    const key = quickKey(uid, view.item.id);
    const answer = state.answers[key];
    state.drafts[key] = answer
      ? {
          reviewerId: uid,
          caseId: answer.caseId,
          revision: 0,
          firstPresentedAt: answer.firstPresentedAt,
          updatedAt: answer.submittedAt,
          payload: structuredClone(answer.payload),
          legacyReferences: answer.legacyReferences,
        }
      : initialDraft(state, view.item, data, uid, now);
    view = sourceStatus(state, data, sources, uid, flagged, canManage, pageId);
  }
  return view;
}
export function saveSourceReview(
  state: SourceState,
  data: QuickDataset,
  sources: SourceDataset,
  uid: string,
  flagged: boolean,
  canManage: boolean,
  raw: unknown,
  revision: unknown,
  final: boolean,
  now: number,
) {
  const pages = assignedSourcePages(
    state,
    data,
    sources,
    uid,
    flagged,
    canManage,
  );
  const p = raw as QuickPayload;
  const page =
    pages.find((page) => page.id === p?.caseId) ||
    fail(403, "This description is not in your assigned review.");
  const questions = sourceQuestions(page),
    ids = questions.map((q) => q.id);
  if (
    !p ||
    !p.ratings ||
    Array.isArray(p.ratings) ||
    Object.keys(p.ratings).sort().join() !== [...ids].sort().join()
  )
    fail(400, "Please rate every proposed title shown for this description.");
  if (
    typeof p.submissionId !== "string" ||
    !/^[A-Za-z0-9_-]{8,100}$/.test(p.submissionId) ||
    !Number.isSafeInteger(p.activeTimeMs) ||
    p.activeTimeMs < 0 ||
    p.activeTimeMs > 7 * 86400000
  )
    fail(400, "The answer or timer is invalid. Reload this description.");
  for (const id of ids) {
    const r = p.ratings[id];
    if (
      !r ||
      !["", "acceptable", "not_acceptable", "unsure"].includes(r.value) ||
      (final && !r.value)
    )
      fail(400, "Choose a rating for every proposed title.");
    if (typeof r.explanation !== "string" || r.explanation.length > 5000)
      fail(400, "Keep each explanation under 5,000 characters.");
    if (
      r.correction !== undefined &&
      (typeof r.correction !== "string" || r.correction.length > 5000)
    )
      fail(400, "Keep each suggested correction under 5,000 characters.");
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
      (v) => typeof v !== "string" || v.length > 5000,
    )
  )
    fail(400, "Keep each comment under 5,000 characters.");
  const payload: QuickPayload = {
    caseId: p.caseId,
    ratings: Object.fromEntries(
      ids.map((id) => [
        id,
        {
          value: p.ratings[id].value,
          explanation: p.ratings[id].explanation,
          // Omit absent fields so historical retry hashes remain unchanged.
          ...(p.ratings[id].correction !== undefined
            ? { correction: p.ratings[id].correction }
            : {}),
        },
      ]),
    ),
    correction: p.correction,
    interruption: p.interruption,
    activeTimeMs: p.activeTimeMs,
    submissionId: p.submissionId,
  };
  const key = quickKey(uid, page.id),
    answer = state.answers[key];
  if (answer) {
    if (final && answer.payloadHash === quickHash(payload))
      return { duplicate: true, answer };
    if (
      final ||
      quickHash({ ...payload, activeTimeMs: 0 }) !==
        quickHash({ ...answer.payload, activeTimeMs: 0 })
    )
      fail(
        409,
        "This description has already been saved. Its answers have not been overwritten.",
      );
  }
  const draft =
    state.drafts[key] || fail(409, "Open this description before saving it.");
  if (
    draft.reviewerId !== uid ||
    draft.payload.submissionId !== p.submissionId ||
    draft.revision !== revision
  )
    fail(
      409,
      "This description changed in another tab. Reload to recover your saved draft.",
    );
  if (
    p.activeTimeMs < draft.payload.activeTimeMs ||
    p.activeTimeMs > Math.max(0, now - draft.firstPresentedAt) + 2000
  )
    fail(
      400,
      "The timer does not match this description. Reload to recover your draft.",
    );
  state.drafts[key] = {
    ...draft,
    revision: draft.revision + 1,
    updatedAt: now,
    payload,
  };
  if (!final) return { duplicate: false, draft: state.drafts[key] };
  const saved: SourceAnswer = {
    id: key,
    reviewerId: uid,
    caseId: page.id,
    payload,
    payloadHash: quickHash(payload),
    firstPresentedAt: draft.firstPresentedAt,
    submittedAt: now,
    elapsedTimeMs: Math.max(0, now - draft.firstPresentedAt),
    activeTimeMs: p.activeTimeMs,
    softwareQA: Boolean(state.legacy.study.softwareQA),
    formVersion: SOURCE_FORM,
    packageVersion: sources.version,
    packageSha256:
      sources.bundleSha256 || fail(409, "The source package is not verified."),
    sampledAnchorIds: page.anchorCaseIds.filter((id) =>
      quickCases(state.legacy, data, uid, flagged, canManage).some(
        (c) => c.id === id,
      ),
    ),
    reviewPool: flagged ? "flagged" : "regular",
    legacyReferences: draft.legacyReferences,
    activityIds: page.activities.map((a) => a.id),
    missingProposalActivityIds: page.activities
      .filter((a) => !a.proposals.length)
      .map((a) => a.id),
  };
  state.answers[key] = saved;
  return { duplicate: false, answer: saved };
}
