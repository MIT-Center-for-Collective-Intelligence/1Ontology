import type { NextApiRequest, NextApiResponse } from "next";
import { randomBytes } from "crypto";
import { getTitleValidationDataset } from "./dataset";
import {
  allCreationsDone,
  dashboardFor,
  presentTask,
  progressFor,
  sessionFor,
  submitAnswer,
  TitleValidationError,
  validateStudy,
  ValidationState,
} from "./engine";
import { localPreviewEnabled, withStudy } from "./repository";

const defaultStudyId = () =>
  process.env.TITLE_VALIDATION_STUDY_ID ||
  "human-title-review-prepilot-20261015-v1";
const reviewerPreviewIds = ["preview-a", "preview-b", "preview-c"];
interface Actor {
  uid: string;
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
    return { uid, canManage: true, preview: true };
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
    if (!actor.preview && process.env.TITLE_VALIDATION_RELEASED !== "1")
      throw new TitleValidationError(
        503,
        "This staff try-out has not been opened on this server yet.",
      );
    const action = String(req.query.action || "");
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
    const id = actor.preview
      ? "preview-title-validation-v1"
      : String(body.studyId || defaultStudyId());
    if (
      !["session", "respond", "dashboard", "manage", "export"].includes(action)
    )
      throw new TitleValidationError(404, "Unknown review action.");
    const data = getTitleValidationDataset();
    const result = await withStudy<unknown>(id, actor.preview, (current) => {
      let state = current || (actor.preview ? newPreviewState() : null);
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
        const next = presentTask(state, data, actor.uid, Date.now());
        return {
          state: next,
          result: {
            ...sessionFor(next, data, actor.uid),
            canManage: actor.canManage,
            preview: actor.preview,
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
          ...(next !== state
            ? {
                event: {
                  kind: "task-presented",
                  actorId: actor.uid,
                  caseId: sessionFor(next, data, actor.uid).task?.caseId,
                },
              }
            : {}),
        };
      }
      if (action === "respond") {
        const change = submitAnswer(
          state,
          data,
          actor.uid,
          body.submission,
          Date.now(),
        );
        const next = presentTask(change.state, data, actor.uid, Date.now());
        return {
          state: next,
          answer: change.duplicate ? undefined : change.answer,
          result: {
            ...sessionFor(next, data, actor.uid),
            canManage: actor.canManage,
            preview: actor.preview,
          },
          ...(change.duplicate
            ? {}
            : {
                event: {
                  kind: "answer-submitted",
                  actorId: actor.uid,
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
