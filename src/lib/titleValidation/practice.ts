import { createHash, randomBytes } from "crypto";
import {
  answerKey,
  creatorFor,
  privateOptions,
  sessionFor,
  sourceCase,
  submitAnswerForTask,
  TitleValidationError,
  validateStudy,
  ValidationDataset,
  ValidationState,
} from "./engine";
import type { TitleValidationSession } from "../../types/ITitleValidation";

export const PRACTICE_PREFIX = "human-title-practice-";
export const PRACTICE_ROLES = [
  "practice-a",
  "practice-b",
  "practice-c",
] as const;
export const practiceStudyId = (ownerUid: string): string =>
  PRACTICE_PREFIX + createHash("sha256").update(ownerUid).digest("hex");

export function practiceRole(value: unknown): string {
  const role = value === undefined ? PRACTICE_ROLES[0] : value;
  if (!PRACTICE_ROLES.includes(role as (typeof PRACTICE_ROLES)[number]))
    throw new TitleValidationError(
      400,
      "Reload to continue in your review copy.",
    );
  return role as string;
}

export function newPracticeState(
  ownerUid: string,
  data: ValidationDataset,
): ValidationState {
  return {
    study: {
      id: practiceStudyId(ownerUid),
      datasetVersion: data.version,
      status: "active",
      seed: randomBytes(24).toString("hex"),
      practice: { ownerUid, purpose: "interface-practice" },
      roster: PRACTICE_ROLES.map((reviewerId, i) => ({
        reviewerId,
        label: `Practice role ${String.fromCharCode(65 + i)}`,
      })),
      caseIds: data.cases.map((item) => item.id),
      createdAt: Date.now(),
    },
    answers: {},
    presentations: {},
  };
}

export function verifyPracticeOwner(
  state: ValidationState,
  ownerUid: string,
): void {
  if (
    state.study.id !== practiceStudyId(ownerUid) ||
    state.study.practice?.ownerUid !== ownerUid ||
    state.study.practice?.purpose !== "interface-practice" ||
    state.study.roster.length !== PRACTICE_ROLES.length ||
    !state.study.roster.every((row) =>
      PRACTICE_ROLES.includes(
        row.reviewerId as (typeof PRACTICE_ROLES)[number],
      ),
    )
  )
    throw new TitleValidationError(
      403,
      "This practice copy does not belong to your account.",
    );
}

function evaluationReviewer(state: ValidationState, caseId: string) {
  return state.study.roster
    .filter((row) => row.reviewerId !== creatorFor(state.study, caseId))
    .sort(
      (a, b) =>
        (state.presentations[answerKey("evaluate", caseId, a.reviewerId)] ??
          Number.MAX_SAFE_INTEGER) -
        (state.presentations[answerKey("evaluate", caseId, b.reviewerId)] ??
          Number.MAX_SAFE_INTEGER),
    )[0].reviewerId;
}

function practiceSelection(state: ValidationState) {
  verifyPracticeOwner(state, state.study.practice?.ownerUid || "");
  const creationIds = state.study.caseIds.filter(
    (id) => state.answers[answerKey("create", id, creatorFor(state.study, id))],
  );
  const evaluationIds = state.study.caseIds.filter((id) =>
    state.study.roster.some(
      (row) =>
        row.reviewerId !== creatorFor(state.study, id) &&
        state.answers[answerKey("evaluate", id, row.reviewerId)],
    ),
  );
  const createId = state.study.caseIds.find((id) => !creationIds.includes(id));
  const evaluateId = !createId
    ? state.study.caseIds.find((id) => !evaluationIds.includes(id))
    : undefined;
  const caseId = createId || evaluateId;
  return {
    caseId,
    stage: createId ? ("create" as const) : ("evaluate" as const),
    reviewerId: caseId
      ? createId
        ? creatorFor(state.study, caseId)
        : evaluationReviewer(state, caseId)
      : PRACTICE_ROLES[0],
    progress: {
      creationDone: creationIds.length,
      creationTotal: state.study.caseIds.length,
      evaluationDone: evaluationIds.length,
      evaluationTotal: state.study.caseIds.length,
    },
  };
}

export function practiceSessionFor(
  state: ValidationState,
  data: ValidationDataset,
): Omit<TitleValidationSession, "preview" | "canManage"> {
  validateStudy(state.study, data);
  const selected = practiceSelection(state);
  const base = {
    ...sessionFor(state, data, selected.reviewerId),
    reviewerLabel: "Your review",
    progress: selected.progress,
    task: undefined,
  };
  if (state.study.status !== "active") return base;
  if (!selected.caseId)
    return {
      ...base,
      phase: "complete",
      message:
        "All five activities are finished. Your answers are saved in your own copy.",
    };
  const item = sourceCase(data, selected.caseId);
  return {
    ...base,
    phase: selected.stage,
    message: undefined,
    draftReviewerKeys: state.study.roster
      .filter((row) =>
        selected.stage === "create"
          ? row.reviewerId === selected.reviewerId
          : row.reviewerId !== creatorFor(state.study, item.id),
      )
      .map((row) => sessionFor(state, data, row.reviewerId).reviewerKey),
    task: {
      caseId: item.id,
      currentTitle: item.currentTitle,
      description: item.description,
      stage: selected.stage,
      ...(selected.stage === "evaluate"
        ? {
            options: privateOptions(
              state,
              data,
              item.id,
              selected.reviewerId,
            ).map(({ id, titles }) => ({ id, titles })),
          }
        : {}),
    },
  };
}

export function presentPracticeTask(
  state: ValidationState,
  data: ValidationDataset,
  now: number,
): { state: ValidationState; reviewerId: string } {
  const session = practiceSessionFor(state, data);
  const reviewerId = practiceSelection(state).reviewerId;
  if (!session.task) return { state, reviewerId };
  const key = answerKey(session.task.stage, session.task.caseId, reviewerId);
  return {
    state:
      state.presentations[key] === undefined
        ? { ...state, presentations: { ...state.presentations, [key]: now } }
        : state,
    reviewerId,
  };
}

export function submitPracticeAnswer(
  state: ValidationState,
  data: ValidationDataset,
  raw: unknown,
  now: number,
) {
  verifyPracticeOwner(state, state.study.practice?.ownerUid || "");
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new TitleValidationError(400, "The answer is incomplete.");
  const input = raw as Record<string, unknown>;
  if (
    typeof input.caseId !== "string" ||
    !["create", "evaluate"].includes(String(input.kind))
  )
    throw new TitleValidationError(400, "The answer is incomplete.");
  const caseId = input.caseId.trim();
  const creator = creatorFor(state.study, caseId);
  // Old role-switching responses remain immutable, including exact retry identity.
  const existing = state.study.roster
    .map(
      (row) =>
        state.answers[answerKey(String(input.kind), caseId, row.reviewerId)],
    )
    .find(
      (answer) =>
        answer?.payload.submissionId ===
        (typeof input.submissionId === "string"
          ? input.submissionId.trim()
          : undefined),
    );
  const reviewerId =
    existing?.reviewerId ||
    (input.kind === "create" ? creator : evaluationReviewer(state, caseId));
  return submitAnswerForTask(
    state,
    data,
    reviewerId,
    raw,
    now,
    () => practiceSessionFor(state, data).task,
  );
}
