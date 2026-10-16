import crypto from "crypto";
import type {
  TitleValidationDashboard,
  TitleValidationSession,
  TitleValidationSubmission,
  TitleValidationTask,
} from "../../types/ITitleValidation";

export interface ValidationCase {
  id: string;
  nodeId: string;
  currentTitle: string;
  description: string;
  sourceId: string;
  outcome: "Keep" | "Clarify" | "Split";
  modelTitles: string[];
  modelReason: string;
}
export interface ValidationDataset {
  version: string;
  cases: ValidationCase[];
  provenance: Record<string, unknown>;
  scientificPrompt: string;
}
export interface ValidationStudy {
  id: string;
  datasetVersion: string;
  seed: string;
  status: "draft" | "active" | "paused" | "closed";
  roster: { reviewerId: string; label: string }[];
  caseIds: string[];
  createdAt: number;
  practice?: { ownerUid: string; purpose: "interface-practice" };
}
export interface ValidationAnswer {
  id: string;
  caseId: string;
  reviewerId: string;
  kind: "create" | "evaluate";
  submittedAt: number;
  firstPresentedAt: number;
  elapsedTimeMs: number;
  payload: TitleValidationSubmission;
  payloadHash: string;
}
export interface ValidationState {
  study: ValidationStudy;
  answers: Record<string, ValidationAnswer>;
  presentations: Record<string, number>;
}
export class TitleValidationError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const fail = (status: number, message: string): never => {
  throw new TitleValidationError(status, message);
};
const digest = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");
export const answerKey = (kind: string, caseId: string, reviewerId: string) =>
  digest(JSON.stringify([kind, caseId, reviewerId]));
export const sourceCase = (data: ValidationDataset, id: string) =>
  data.cases.find((item) => item.id === id) || fail(400, "Unknown activity.");
export const creatorFor = (study: ValidationStudy, caseId: string): string => {
  const index = study.caseIds.indexOf(caseId);
  if (index < 0) return fail(400, "Activity is not in this pilot.");
  return study.roster[index % study.roster.length].reviewerId;
};
export function validateStudy(
  study: ValidationStudy,
  data: ValidationDataset,
): void {
  if (
    study.datasetVersion !== data.version ||
    study.roster.length < 3 ||
    study.roster.length > 10 ||
    new Set(study.roster.map((r) => r.reviewerId)).size !==
      study.roster.length ||
    study.roster.some(
      (r) =>
        !/^[A-Za-z0-9_-]{1,128}$/.test(r.reviewerId) ||
        !r.label.trim() ||
        r.label.length > 80,
    ) ||
    !study.caseIds.length ||
    study.caseIds.length > 200 ||
    new Set(study.caseIds).size !== study.caseIds.length ||
    !study.seed ||
    study.seed.length > 200
  )
    fail(400, "The pilot configuration is invalid.");
  study.caseIds.forEach((id) => sourceCase(data, id));
}
function ensureReviewer(state: ValidationState, reviewerId: string) {
  return (
    state.study.roster.find((r) => r.reviewerId === reviewerId) ||
    fail(403, "You are not assigned to this pilot.")
  );
}
export function progressFor(state: ValidationState, reviewerId: string) {
  const creationIds = state.study.caseIds.filter(
    (id) => creatorFor(state.study, id) === reviewerId,
  );
  const evaluationIds = state.study.caseIds.filter(
    (id) => creatorFor(state.study, id) !== reviewerId,
  );
  return {
    creationDone: creationIds.filter(
      (id) => state.answers[answerKey("create", id, reviewerId)],
    ).length,
    creationTotal: creationIds.length,
    evaluationDone: evaluationIds.filter(
      (id) => state.answers[answerKey("evaluate", id, reviewerId)],
    ).length,
    evaluationTotal: evaluationIds.length,
  };
}
export function allCreationsDone(state: ValidationState): boolean {
  return state.study.caseIds.every(
    (id) => state.answers[answerKey("create", id, creatorFor(state.study, id))],
  );
}
interface PrivateOption {
  id: string;
  titles: string[];
  sources: ("original" | "model" | "human")[];
}
const displayKey = (titles: string[]) =>
  JSON.stringify(titles.map((t) => t.normalize("NFC").trim()).sort());
export function privateOptions(
  state: ValidationState,
  data: ValidationDataset,
  caseId: string,
  reviewerId: string,
): PrivateOption[] {
  ensureReviewer(state, reviewerId);
  if (creatorFor(state.study, caseId) === reviewerId)
    fail(403, "You cannot evaluate an activity you created.");
  if (!allCreationsDone(state))
    fail(
      409,
      "Independent title creation must finish before alternatives can be shown.",
    );
  const item = sourceCase(data, caseId);
  const human =
    state.answers[answerKey("create", caseId, creatorFor(state.study, caseId))];
  if (human.payload.kind !== "create")
    return fail(409, "Independent titles are unavailable.");
  const sources: {
    source: "original" | "model" | "human";
    titles: string[];
  }[] = [
    { source: "original", titles: [item.currentTitle] },
    { source: "model", titles: item.modelTitles },
    {
      source: "human",
      titles:
        human.payload.decision === "keep"
          ? [item.currentTitle]
          : human.payload.titles,
    },
  ];
  const groups = new Map<string, PrivateOption>();
  for (const candidate of sources) {
    const key = displayKey(candidate.titles);
    const existing = groups.get(key);
    if (existing) existing.sources.push(candidate.source);
    else
      groups.set(key, {
        id: digest(JSON.stringify([state.study.seed, caseId, key])).slice(
          0,
          24,
        ),
        titles: [...candidate.titles],
        sources: [candidate.source],
      });
  }
  const options = Array.from(groups.values()).sort((a, b) =>
    digest(state.study.seed + caseId + a.id).localeCompare(
      digest(state.study.seed + caseId + b.id),
    ),
  );
  const offset =
    state.study.roster.findIndex((r) => r.reviewerId === reviewerId) %
    options.length;
  return [...options.slice(offset), ...options.slice(0, offset)];
}
export function sessionFor(
  state: ValidationState,
  data: ValidationDataset,
  reviewerId: string,
): Omit<TitleValidationSession, "preview" | "canManage"> {
  validateStudy(state.study, data);
  const reviewer = state.study.roster.find((r) => r.reviewerId === reviewerId);
  const base = {
    studyId: state.study.id,
    datasetVersion: data.version,
    studyStatus: state.study.status,
    reviewerLabel: reviewer?.label || "Unassigned reviewer",
    reviewerKey: digest(state.study.seed + ":" + reviewerId).slice(0, 24),
    progress: reviewer
      ? progressFor(state, reviewerId)
      : {
          creationDone: 0,
          creationTotal: 0,
          evaluationDone: 0,
          evaluationTotal: 0,
        },
  };
  if (!reviewer)
    return {
      ...base,
      phase: "unassigned",
      message: "The coordinator has not assigned you to this pilot.",
    };
  if (state.study.status !== "active")
    return {
      ...base,
      phase: state.study.status === "closed" ? "complete" : "waiting",
      message:
        state.study.status === "draft"
          ? "The coordinator has not opened this pilot yet."
          : state.study.status === "paused"
            ? "The coordinator has paused this pilot."
            : "This pilot is closed. Your saved answers remain available to the team.",
    };
  const createId = state.study.caseIds.find(
    (id) =>
      creatorFor(state.study, id) === reviewerId &&
      !state.answers[answerKey("create", id, reviewerId)],
  );
  if (createId) {
    const item = sourceCase(data, createId);
    return {
      ...base,
      phase: "create",
      task: {
        caseId: item.id,
        currentTitle: item.currentTitle,
        description: item.description,
        stage: "create",
      },
    };
  }
  if (!allCreationsDone(state))
    return {
      ...base,
      phase: "waiting",
      message:
        "Your independent titles are saved. Evaluation will open when the other reviewers finish theirs.",
    };
  const evalId = state.study.caseIds.find(
    (id) =>
      creatorFor(state.study, id) !== reviewerId &&
      !state.answers[answerKey("evaluate", id, reviewerId)],
  );
  if (evalId) {
    const item = sourceCase(data, evalId);
    return {
      ...base,
      phase: "evaluate",
      task: {
        caseId: item.id,
        currentTitle: item.currentTitle,
        description: item.description,
        stage: "evaluate",
        options: privateOptions(state, data, item.id, reviewerId).map(
          ({ id, titles }) => ({ id, titles }),
        ),
      },
    };
  }
  return {
    ...base,
    phase: "complete",
    message: "Thank you. All your pilot answers are saved.",
  };
}
export function presentTask(
  state: ValidationState,
  data: ValidationDataset,
  reviewerId: string,
  now: number,
): ValidationState {
  const task = sessionFor(state, data, reviewerId).task;
  if (!task) return state;
  const key = answerKey(task.stage, task.caseId, reviewerId);
  return state.presentations[key] !== undefined
    ? state
    : { ...state, presentations: { ...state.presentations, [key]: now } };
}
function text(value: unknown, limit: number, name: string): string {
  if (typeof value !== "string" || value.length > limit)
    return fail(400, `${name} is invalid.`);
  return value.trim();
}
function normalizeSubmission(input: unknown): TitleValidationSubmission {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return fail(400, "The answer is incomplete.");
  const x = input as Record<string, unknown>;
  const common = {
    caseId: text(x.caseId, 128, "Activity"),
    confidence: x.confidence as number,
    notes: text(x.notes, 6000, "Comment"),
    activeTimeMs: x.activeTimeMs as number,
    submissionId: text(x.submissionId, 100, "Submission identifier"),
  };
  if (
    !/^[A-Za-z0-9_-]{8,100}$/.test(common.submissionId) ||
    !Number.isInteger(common.confidence) ||
    common.confidence < 1 ||
    common.confidence > 5 ||
    !Number.isSafeInteger(common.activeTimeMs) ||
    common.activeTimeMs < 0 ||
    common.activeTimeMs > 86400000
  )
    fail(400, "Choose a confidence rating and provide valid timing.");
  if (x.kind === "create") {
    if (
      !["keep", "clarify", "split"].includes(String(x.decision)) ||
      !Array.isArray(x.titles) ||
      x.titles.length > 20
    )
      fail(400, "Choose whether to keep, clarify, or split the title.");
    const titles = (x.titles as unknown[]).map((t) =>
      text(t, 400, "Proposed title"),
    );
    if (
      titles.some((t) => !t) ||
      new Set(titles).size !== titles.length ||
      (x.decision === "clarify" && titles.length !== 1) ||
      (x.decision === "split" && titles.length < 2)
    )
      fail(400, "Provide distinct titles for the proposed activities.");
    return {
      ...common,
      kind: "create",
      decision: x.decision as "keep" | "clarify" | "split",
      titles: x.decision === "keep" ? [] : titles,
    };
  }
  if (x.kind === "evaluate") {
    if (
      typeof x.cannotRank !== "boolean" ||
      !Array.isArray(x.ratings) ||
      x.ratings.length < 1 ||
      x.ratings.length > 3
    )
      return fail(400, "Assess every alternative.");
    const ratings = (x.ratings as Record<string, unknown>[]).map((r) => {
      if (
        !r ||
        typeof r !== "object" ||
        !["adequate", "needs_work", "unsure"].includes(String(r.adequacy)) ||
        (r.rank !== null &&
          (!Number.isInteger(r.rank) ||
            Number(r.rank) < 1 ||
            Number(r.rank) > 3))
      )
        return fail(400, "Each alternative needs a valid assessment and rank.");
      return {
        optionId: text(r.optionId, 100, "Alternative"),
        adequacy: r.adequacy as "adequate" | "needs_work" | "unsure",
        rank: r.rank as number | null,
      };
    });
    if (
      new Set(ratings.map((r) => r.optionId)).size !== ratings.length ||
      (x.cannotRank
        ? ratings.some((r) => r.rank !== null)
        : ratings.some((r) => r.rank === null) ||
          !ratings.some((r) => r.rank === 1))
    )
      fail(
        400,
        "Rank all alternatives, allowing ties, or choose that you cannot rank them.",
      );
    if (
      (x.cannotRank || ratings.some((r) => r.adequacy !== "adequate")) &&
      !common.notes
    )
      fail(400, "Briefly explain what needs work or why you are unsure.");
    return { ...common, kind: "evaluate", ratings, cannotRank: x.cannotRank };
  }
  return fail(400, "Unknown task type.");
}
export function submitAnswer(
  state: ValidationState,
  data: ValidationDataset,
  reviewerId: string,
  raw: unknown,
  now: number,
): { state: ValidationState; answer: ValidationAnswer; duplicate: boolean } {
  return submitAnswerForTask(
    state,
    data,
    reviewerId,
    raw,
    now,
    () => sessionFor(state, data, reviewerId).task,
  );
}

// Both flows share validation and storage; only the server selects task order.
export function submitAnswerForTask(
  state: ValidationState,
  data: ValidationDataset,
  reviewerId: string,
  raw: unknown,
  now: number,
  expectedTask: () => TitleValidationTask | undefined,
): { state: ValidationState; answer: ValidationAnswer; duplicate: boolean } {
  ensureReviewer(state, reviewerId);
  validateStudy(state.study, data);
  const payload = normalizeSubmission(raw);
  sourceCase(data, payload.caseId);
  const key = answerKey(payload.kind, payload.caseId, reviewerId),
    payloadHash = digest(JSON.stringify(payload));
  const existing = state.answers[key];
  if (existing) {
    if (existing.payloadHash === payloadHash)
      return { state, answer: existing, duplicate: true };
    return fail(
      409,
      "This answer is already submitted. Submitted independent titles cannot be changed after saving.",
    );
  }
  if (state.study.status !== "active")
    fail(409, "This pilot is not open for answers.");
  const creator = creatorFor(state.study, payload.caseId);
  if ((payload.kind === "create") !== (creator === reviewerId))
    fail(403, "This task is not assigned to you.");
  const current = expectedTask();
  if (
    !current ||
    current.caseId !== payload.caseId ||
    current.stage !== payload.kind
  )
    fail(409, "Reload to continue with your current assigned task.");
  if (payload.kind === "evaluate") {
    const options = privateOptions(state, data, payload.caseId, reviewerId);
    if (
      options.length !== payload.ratings.length ||
      payload.ratings.some((r) => !options.some((o) => o.id === r.optionId))
    )
      fail(400, "The alternatives do not match this task.");
    if (payload.ratings.some((r) => r.rank !== null && r.rank > options.length))
      fail(400, "A rank exceeds the number of alternatives.");
  }
  const firstPresentedAt = state.presentations[key];
  if (firstPresentedAt === undefined)
    return fail(409, "Open the assigned activity before submitting it.");
  const elapsedTimeMs = Math.max(0, now - firstPresentedAt);
  if (payload.activeTimeMs > elapsedTimeMs + 10000)
    fail(400, "The timing is inconsistent. Reload this activity.");
  const answer: ValidationAnswer = {
    id: key,
    caseId: payload.caseId,
    reviewerId,
    kind: payload.kind,
    submittedAt: now,
    firstPresentedAt,
    elapsedTimeMs,
    payload,
    payloadHash,
  };
  return {
    state: { ...state, answers: { ...state.answers, [key]: answer } },
    answer,
    duplicate: false,
  };
}
const median = (values: number[]) => {
  if (!values.length) return null;
  const xs = [...values].sort((a, b) => a - b),
    m = Math.floor(xs.length / 2);
  return (
    Math.round((xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2) / 100) / 10
  );
};
export function dashboardFor(
  state: ValidationState,
  data: ValidationDataset,
): TitleValidationDashboard {
  const answers = Object.values(state.answers),
    creations = answers.filter((a) => a.kind === "create"),
    evaluations = answers.filter((a) => a.kind === "evaluate");
  const comparisons = ["original", "model", "human"].map((source) => ({
    source,
    judgments: 0,
    adequate: 0,
    needsWork: 0,
    unsure: 0,
    preferredOrTied: 0,
  }));
  for (const answer of evaluations) {
    if (answer.payload.kind !== "evaluate") continue;
    const options = privateOptions(
      state,
      data,
      answer.caseId,
      answer.reviewerId,
    );
    for (const rating of answer.payload.ratings) {
      const option = options.find((o) => o.id === rating.optionId)!;
      for (const source of option.sources) {
        const row = comparisons.find((c) => c.source === source)!;
        row.judgments++;
        row.adequate += Number(rating.adequacy === "adequate");
        row.needsWork += Number(rating.adequacy === "needs_work");
        row.unsure += Number(rating.adequacy === "unsure");
        row.preferredOrTied += Number(
          !answer.payload.cannotRank && rating.rank === 1,
        );
      }
    }
  }
  let disagreementCases = 0;
  for (const id of state.study.caseIds) {
    const rows = evaluations.filter((a) => a.caseId === id);
    if (rows.length > 1) {
      const signatures = rows.map((a) =>
        a.payload.kind === "evaluate"
          ? JSON.stringify(
              a.payload.ratings
                .map((r) => [r.optionId, r.adequacy, r.rank])
                .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
            )
          : "",
      );
      if (new Set(signatures).size > 1) disagreementCases++;
    }
  }
  return {
    studyId: state.study.id,
    status: state.study.status,
    caseCount: state.study.caseIds.length,
    reviewerCount: state.study.roster.length,
    completedCreations: creations.length,
    completedEvaluations: evaluations.length,
    expectedEvaluations:
      state.study.caseIds.length * (state.study.roster.length - 1),
    byReviewer: state.study.roster.map((r) => ({
      label: r.label,
      ...progressFor(state, r.reviewerId),
    })),
    byOutcome: ["Keep", "Clarify", "Split"].map((outcome) => {
      const ids = state.study.caseIds.filter(
        (id) => sourceCase(data, id).outcome === outcome,
      );
      return {
        outcome,
        cases: ids.length,
        completedEvaluations: evaluations.filter((a) => ids.includes(a.caseId))
          .length,
      };
    }),
    comparisons,
    medianCreationActiveSeconds: median(
      creations.map((a) => a.payload.activeTimeMs),
    ),
    medianEvaluationActiveSeconds: median(
      evaluations.map((a) => a.payload.activeTimeMs),
    ),
    disagreementCases,
    activityDetails: state.study.caseIds.map((caseId) => {
      const item = sourceCase(data, caseId);
      const creator = creatorFor(state.study, caseId);
      const human = state.answers[answerKey("create", caseId, creator)];
      return {
        caseId,
        currentTitle: item.currentTitle,
        description: item.description,
        modelTitles: item.modelTitles,
        human:
          human?.payload.kind === "create"
            ? {
                reviewerLabel: ensureReviewer(state, creator).label,
                titles:
                  human.payload.decision === "keep"
                    ? [item.currentTitle]
                    : human.payload.titles,
                confidence: human.payload.confidence,
              }
            : null,
        evaluations: evaluations
          .filter((a) => a.caseId === caseId)
          .map((a) => {
            if (a.payload.kind !== "evaluate")
              throw Error("Invalid evaluation");
            const options = privateOptions(state, data, caseId, a.reviewerId);
            return {
              reviewerLabel: ensureReviewer(state, a.reviewerId).label,
              confidence: a.payload.confidence,
              activeSeconds: Math.round(a.payload.activeTimeMs / 1000),
              alternatives: a.payload.ratings.map((rating) => {
                const option = options.find((o) => o.id === rating.optionId)!;
                return {
                  titles: option.titles,
                  sources: option.sources,
                  adequacy: rating.adequacy,
                  rank: rating.rank,
                };
              }),
            };
          }),
      };
    }),
    notes: answers
      .filter((a) => a.payload.notes)
      .map((a) => ({
        caseId: a.caseId,
        currentTitle: data.cases.find((c) => c.id === a.caseId)!.currentTitle,
        reviewerLabel: state.study.roster.find(
          (r) => r.reviewerId === a.reviewerId,
        )!.label,
        stage: a.kind,
        text: a.payload.notes,
      })),
    caution:
      "Exploratory pilot counts, not accuracy or population estimates. Human proposals are comparators, not ground truth. Identical alternatives share one judgment, attributed to each matching source; source columns are not independent and must not be added together. Ties are not abstentions. Active time is reported by the browser. No significance test, automatic stopping rule, or ontology change is performed.",
  };
}
