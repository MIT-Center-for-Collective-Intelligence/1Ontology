import type { NextApiRequest, NextApiResponse } from "next";
import { randomBytes } from "crypto";
import { getTitleValidationDataset } from "./dataset";
import {
  allCreationsDone,
  dashboardFor,
  joinAsReviewer,
  presentTask,
  progressFor,
  sessionFor,
  submitAnswer,
  TitleValidationError,
  validateStudy,
  ValidationState,
} from "./engine";
import { localPreviewEnabled, withStudy } from "./repository";
import {
  newPracticeState,
  practiceRole,
  practiceSessionFor,
  practiceStudyId,
  PRACTICE_PREFIX,
  presentPracticeTask,
  submitPracticeAnswer,
  verifyPracticeOwner,
} from "./practice";

const defaultStudyId = () =>
  process.env.TITLE_VALIDATION_STUDY_ID ||
  "human-title-review-prepilot-20261015-v1";
const reviewerPreviewIds = ["preview-a", "preview-b", "preview-c"];
interface Actor {
  uid: string;
  label: string;
  canManage: boolean;
  preview: boolean;
}
async function actorFor(
  req: NextApiRequest,
  body: Record<string, unknown>,
): Promise<Actor> {
  if (localPreviewEnabled(req.headers.host, req.socket?.remoteAddress)) {
    if (req.headers.origin) {
      try {
        if (new URL(req.headers.origin).host !== req.headers.host)
          throw Error("origin_mismatch");
      } catch {
        throw new TitleValidationError(
          403,
          "Use the local preview from its own page.",
        );
      }
    }
    const uid = String(body.previewReviewer || "preview-a");
    if (!reviewerPreviewIds.includes(uid))
      throw new TitleValidationError(400, "Unknown preview reviewer.");
    return { uid, label: "Preview reviewer", canManage: true, preview: true };
  }
  const token = String(req.headers.authorization || "").replace(/^Bearer /, "");
  if (!token)
    throw new TitleValidationError(401, "Sign in to use this review.");
  const { admin } = await import("../firestoreServer/admin");
  let user;
  try {
    user = await admin.auth().verifyIdToken(token, true);
  } catch {
    throw new TitleValidationError(401, "Sign in again to continue.");
  }
  const emails = new Set(
    [
      "oneweb@umich.edu",
      "oneman@mit.edu",
      ...(process.env.TITLE_VALIDATION_COORDINATOR_EMAILS || "").split(","),
    ]
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  const uids = new Set(
    (process.env.TITLE_VALIDATION_COORDINATOR_UIDS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  return {
    uid: user.uid,
    label:
      String(user.name || user.email || "Reviewer")
        .trim()
        .slice(0, 80) || "Reviewer",
    preview: false,
    canManage:
      user.titleValidationCoordinator === true ||
      uids.has(user.uid) ||
      (user.email_verified === true &&
        emails.has(String(user.email || "").toLowerCase())),
  };
}
const noStudy = (canManage: boolean, preview: boolean) => ({
  studyId: "",
  datasetVersion: getTitleValidationDataset().version,
  studyStatus: "draft",
  reviewerLabel: "Unassigned reviewer",
  reviewerKey: "",
  phase: "unassigned",
  progress: {
    creationDone: 0,
    creationTotal: 0,
    evaluationDone: 0,
    evaluationTotal: 0,
  },
  canManage,
  preview,
  message: canManage
    ? "Set up the five-activity staff try-out below. No reviewers are enrolled automatically."
    : "The coordinator has not opened this pilot yet.",
});
const newPreviewState = (): ValidationState => {
  const data = getTitleValidationDataset();
  return {
    study: {
      id: "preview-title-validation-v1",
      datasetVersion: data.version,
      status: "active",
      seed: "local-preview-v1",
      roster: reviewerPreviewIds.map((reviewerId, i) => ({
        reviewerId,
        label: `Preview reviewer ${String.fromCharCode(65 + i)}`,
      })),
      caseIds: data.cases.map((c) => c.id),
      createdAt: Date.now(),
    },
    answers: {},
    presentations: {},
  };
};
export const canSeeComparisons = (
  state: ValidationState,
  uid: string,
): boolean => {
  if (state.study.status === "closed") return true;
  if (!state.study.roster.some((r) => r.reviewerId === uid)) return true;
  return (
    allCreationsDone(state) &&
    state.study.roster.every((r) => {
      const p = progressFor(state, r.reviewerId);
      return p.evaluationDone === p.evaluationTotal;
    })
  );
};
export async function titleValidationHandler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("Vary", "Authorization");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const body =
      req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : {};
    const actor = await actorFor(req, body);
    const practice = body.workspace === "practice";
    if (body.workspace !== undefined && !practice)
      throw new TitleValidationError(400, "Unknown review workspace.");
    if (practice && (actor.preview || !actor.canManage))
      throw new TitleValidationError(
        403,
        "Sign in as a coordinator to use your private practice copy.",
      );
    // Older open tabs may still send a synthetic role. It no longer selects tasks.
    if (practice && body.practiceReviewer !== undefined)
      practiceRole(body.practiceReviewer);
    const reviewerId = actor.uid;
    const eventActor = (storedReviewerId: string) => ({
      actorId: actor.uid,
      ...(practice
        ? { practice: true, practiceReviewer: storedReviewerId }
        : {}),
    });
    if (!actor.preview && process.env.TITLE_VALIDATION_RELEASED !== "1")
      throw new TitleValidationError(
        503,
        "This staff try-out has not been opened on this server yet.",
      );
    const action = String(req.query.action || "");
    if (practice && !["session", "respond"].includes(action))
      throw new TitleValidationError(
        403,
        "Your private copy supports reviewer tasks only.",
      );
    let resolvedReviewers: { reviewerId: string; label: string }[] | undefined;
    if (
      action === "manage" &&
      body.operation === "create" &&
      actor.canManage &&
      !actor.preview &&
      Array.isArray(body.reviewers)
    ) {
      const { admin } = await import("../firestoreServer/admin");
      if (body.reviewers.length < 3 || body.reviewers.length > 10)
        throw new TitleValidationError(400, "Provide 3–10 reviewer accounts.");
      resolvedReviewers = await Promise.all(
        body.reviewers.map(async (row) => {
          const identifier = String(row?.reviewerId || "").trim();
          try {
            const user = identifier.includes("@")
              ? await admin.auth().getUserByEmail(identifier)
              : await admin.auth().getUser(identifier);
            return {
              reviewerId: user.uid,
              label: String(row?.label || "").trim(),
            };
          } catch {
            throw new TitleValidationError(
              400,
              "One reviewer account could not be found. Use an existing ontology account.",
            );
          }
        }),
      );
    }
    const id = practice
      ? practiceStudyId(actor.uid)
      : actor.preview
        ? "preview-title-validation-v1"
        : String(body.studyId || defaultStudyId());
    if (!practice && id.startsWith(PRACTICE_PREFIX))
      throw new TitleValidationError(
        403,
        "Open your private copy through the practice link.",
      );
    if (
      !["session", "respond", "dashboard", "manage", "export"].includes(action)
    )
      throw new TitleValidationError(404, "Unknown review action.");
    const data = getTitleValidationDataset();
    const result = await withStudy<unknown>(id, actor.preview, (current) => {
      const practiceCreated = !current && practice && action === "session";
      let state =
        current ||
        (practiceCreated
          ? newPracticeState(actor.uid, data)
          : actor.preview
            ? newPreviewState()
            : null);
      if (state && practice) verifyPracticeOwner(state, actor.uid);
      if (state?.study.practice && !practice)
        throw new TitleValidationError(
          403,
          "Open your private copy through the practice link.",
        );
      if (action === "manage") {
        if (!actor.canManage)
          throw new TitleValidationError(
            403,
            "Only the coordinator can manage this pilot.",
          );
        const op = String(body.operation || "");
        if (op === "create") {
          if (state)
            throw new TitleValidationError(
              409,
              "This pilot already exists. Its saved answers cannot be replaced.",
            );
          if (!Array.isArray(body.reviewers))
            throw new TitleValidationError(
              400,
              "Provide at least three reviewers.",
            );
          state = {
            study: {
              id,
              datasetVersion: data.version,
              status: "draft",
              seed: randomBytes(24).toString("hex"),
              roster:
                resolvedReviewers ||
                body.reviewers.map((r) => ({
                  reviewerId: String(r?.reviewerId || ""),
                  label: String(r?.label || "").trim(),
                })),
              caseIds: data.cases.map((c) => c.id),
              createdAt: Date.now(),
            },
            answers: {},
            presentations: {},
          };
          validateStudy(state.study, data);
          return {
            state,
            result: { status: "draft" },
            event: {
              kind: "study-created",
              actorId: actor.uid,
              datasetVersion: data.version,
            },
          };
        }
        if (!state)
          throw new TitleValidationError(
            404,
            "This pilot has not been created.",
          );
        if (op === "join") {
          if (actor.preview || id !== defaultStudyId())
            throw new TitleValidationError(
              403,
              "Join through the current team review page.",
            );
          const change = joinAsReviewer(state, data, actor.uid, actor.label);
          return {
            state: change.state,
            result: {
              status: change.state.study.status,
              joined: change.joined,
            },
            ...(change.joined
              ? {
                  event: {
                    kind: "reviewer-joined",
                    actorId: actor.uid,
                    reviewerId: actor.uid,
                    creationCaseIds:
                      change.state.study.additionalCreations![actor.uid],
                    comparisonPolicy:
                      "Existing primary human comparators preserved; additional creations retained separately.",
                  },
                }
              : {}),
          };
        }
        const next =
          op === "start" && state.study.status === "draft"
            ? "active"
            : op === "pause" && state.study.status === "active"
              ? "paused"
              : op === "resume" && state.study.status === "paused"
                ? "active"
                : op === "close" && state.study.status !== "closed"
                  ? "closed"
                  : null;
        if (!next)
          throw new TitleValidationError(
            409,
            "This change is not available for the pilot's current status.",
          );
        const updated = {
          ...state,
          study: {
            ...state.study,
            status: next as "active" | "paused" | "closed",
          },
        };
        return {
          state: updated,
          result: { status: next },
          event: { kind: "study-" + op, actorId: actor.uid },
        };
      }
      if (!state) {
        if (action === "session")
          return {
            state: null,
            result: noStudy(actor.canManage, actor.preview),
          };
        throw new TitleValidationError(404, "This pilot has not been created.");
      }
      validateStudy(state.study, data);
      if (action === "session") {
        const presented = practice
          ? presentPracticeTask(state, data, Date.now())
          : {
              state: presentTask(state, data, reviewerId, Date.now()),
              reviewerId,
            };
        const next = presented.state;
        const session = practice
          ? practiceSessionFor(next, data)
          : sessionFor(next, data, reviewerId);
        return {
          state: next,
          result: {
            ...session,
            canManage: actor.canManage && !practice,
            preview: actor.preview,
            ...(practice ? { practice: true } : {}),
            ...(next.study.status === "closed" &&
            (actor.canManage ||
              next.study.roster.some((r) => r.reviewerId === actor.uid))
              ? {
                  disclosure: {
                    model: String(data.provenance.model || "Unknown"),
                    fundingRoute: String(
                      data.provenance.fundingRoute || "Unknown",
                    ),
                    prompt: data.scientificPrompt,
                    promptSha256: String(
                      data.provenance.scientificPromptSha256 || "",
                    ),
                    sourceSnapshotSha256: String(
                      data.provenance.originalSourceSnapshotSha256 || "",
                    ),
                    selection: String(data.provenance.selection || ""),
                  },
                }
              : {}),
          },
          ...(next !== state || practiceCreated
            ? {
                event: {
                  kind: practiceCreated ? "practice-created" : "task-presented",
                  ...eventActor(presented.reviewerId),
                  caseId: session.task?.caseId,
                },
              }
            : {}),
        };
      }
      if (action === "respond") {
        const change = practice
          ? submitPracticeAnswer(state, data, body.submission, Date.now())
          : submitAnswer(state, data, reviewerId, body.submission, Date.now());
        const next = practice
          ? presentPracticeTask(change.state, data, Date.now()).state
          : presentTask(change.state, data, reviewerId, Date.now());
        return {
          state: next,
          answer: change.duplicate ? undefined : change.answer,
          result: {
            ...(practice
              ? practiceSessionFor(next, data)
              : sessionFor(next, data, reviewerId)),
            canManage: actor.canManage && !practice,
            preview: actor.preview,
            ...(practice ? { practice: true } : {}),
          },
          ...(change.duplicate
            ? {}
            : {
                event: {
                  kind: "answer-submitted",
                  ...eventActor(change.answer.reviewerId),
                  caseId: change.answer.caseId,
                  stage: change.answer.kind,
                  answerId: change.answer.id,
                  payloadHash: change.answer.payloadHash,
                },
              }),
        };
      }
      if (!actor.canManage)
        throw new TitleValidationError(
          403,
          "Only the coordinator can view team results.",
        );
      const unrestricted = canSeeComparisons(state, actor.uid);
      if (action === "export") {
        if (!unrestricted)
          throw new TitleValidationError(
            403,
            "Participating reviewers can open team answers after all assigned reviews finish or the pilot closes.",
          );
        return {
          state,
          result: {
            formatVersion: "title-validation-export-v1",
            preview: actor.preview,
            exportedAt: new Date().toISOString(),
            study: state.study,
            answers: Object.values(state.answers),
            dashboard: dashboardFor(state, data),
            dataset: data,
            interpretation:
              "Human-created titles are comparators, not gold labels. Keep individual judgments separate from later discussion. No ontology changes are authorized by this export.",
          },
          event: {
            kind: "coordinator-export",
            actorId: actor.uid,
            answerCount: Object.keys(state.answers).length,
          },
        };
      }
      const dashboard = dashboardFor(state, data);
      if (!unrestricted) {
        dashboard.comparisons = [];
        dashboard.notes = [];
        dashboard.activityDetails = [];
        dashboard.byOutcome = [];
        dashboard.disagreementCases = 0;
        dashboard.caution =
          "Progress only: participating reviewers can see team answers, output types, and source comparisons after all assigned reviews finish or the pilot closes.";
      }
      return { state, result: dashboard };
    });
    return res.status(200).json(result);
  } catch (error) {
    const status = error instanceof TitleValidationError ? error.status : 500;
    if (status === 500)
      console.error(
        "Title-validation request failed",
        error instanceof Error ? error.name : "UnknownError",
      );
    return res.status(status).json({
      error:
        status === 500
          ? "The review could not be loaded or saved. Your existing answers have been preserved."
          : (error as Error).message,
    });
  }
}
