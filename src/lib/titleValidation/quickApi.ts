import type { NextApiRequest, NextApiResponse } from "next";
import { actorFor } from "./api";
import { TitleValidationError } from "./engine";
import { getQuickDataset } from "./quickDataset";
import {
  QUICK_QA_ID,
  QUICK_STUDY_ID,
  quickKey,
  quickSession,
  saveQuick,
  QuickState,
} from "./quick";
import { withQuickStudy } from "./quickRepository";
import { STUDY_COLLECTION } from "./repository";

export async function quickTitleHandler(
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
        ? req.body
        : {};
    const actor = await actorFor(req, body);
    if (!actor.preview && process.env.TITLE_VALIDATION_RELEASED !== "1")
      throw new TitleValidationError(503, "This review is not enabled yet.");
    if (body.qa && !actor.canManage)
      throw new TitleValidationError(
        403,
        "Software tests are coordinator-only.",
      );
    if (body.pool !== undefined && !["regular", "flagged"].includes(body.pool))
      throw new TitleValidationError(400, "Unknown review set.");
    const id = body.qa ? QUICK_QA_ID : QUICK_STUDY_ID,
      flagged = body.pool === "flagged",
      data = getQuickDataset(),
      action = String(req.query.action);
    const allowed = [
      "quick-session",
      "quick-checkpoint",
      "quick-respond",
      "quick-manage",
      "quick-export",
    ];
    if (!allowed.includes(action))
      throw new TitleValidationError(404, "Unknown review action.");
    let additions: { reviewerId: string; label: string }[] = [];
    if (action === "quick-manage") {
      if (!actor.canManage)
        throw new TitleValidationError(
          403,
          "Only coordinators can manage assignments.",
        );
      if (body.operation === "add") {
        if (
          !Array.isArray(body.reviewers) ||
          !body.reviewers.length ||
          body.reviewers.length > 10
        )
          throw new TitleValidationError(
            400,
            "Enter 1–10 existing account emails.",
          );
        const { admin } = await import("../firestoreServer/admin");
        additions = await Promise.all(
          body.reviewers.map(async (row: any) => {
            try {
              const user = await admin
                .auth()
                .getUserByEmail(String(row.email).trim());
              if (user.disabled) throw Error();
              return {
                reviewerId: user.uid,
                label: String(
                  user.displayName || row.label || user.email,
                ).slice(0, 80),
              };
            } catch {
              throw new TitleValidationError(
                400,
                "One account could not be found or is disabled. Use an existing ontology account.",
              );
            }
          }),
        );
      } else if (body.operation !== "expand")
        throw new TitleValidationError(400, "Unknown assignment change.");
    }
    if (action === "quick-export") {
      if (!actor.canManage)
        throw new TitleValidationError(
          403,
          "Only coordinators can export team reviews.",
        );
      const { db } = await import("../firestoreServer/admin");
      const ref = db.collection(STUDY_COLLECTION).doc(id),
        doc = await ref.get();
      if (!doc.exists)
        throw new TitleValidationError(
          404,
          "The review has not been prepared yet.",
        );
      const answers = await ref.collection("answers").get();
      const state: QuickState = {
        study: doc.data()!.study,
        answers: Object.fromEntries(
          answers.docs.map((d) => [d.id, d.data() as any]),
        ),
        drafts: {},
      };
      const own = quickSession(state, data, actor.uid, false, true, Date.now());
      if (
        state.study.roster.some((r) => r.reviewerId === actor.uid) &&
        own.completed !== own.total &&
        !body.qa
      )
        throw new TitleValidationError(
          403,
          "Finish your regular reviews before opening other reviewers’ answers.",
        );
      return res
        .status(200)
        .json({
          formatVersion: "quick-title-review-export-v1",
          study: state.study,
          answers: answers.docs.map((d) => d.data()),
          dataset: data,
          interpretation:
            "Individual human judgments, not ontology edits or population accuracy. Active page time and elapsed time differ; interruptions and software tests remain identified.",
        });
    }
    const result = await withQuickStudy<any>(
      id,
      actor.uid,
      actor.preview,
      (state) => {
        if (!state && (actor.preview || (body.qa && actor.canManage))) {
          state = {
            study: {
              id,
              protocol: "quick-title-verification-v1",
              datasetVersion: data.version,
              roster: actor.preview
                ? ["preview-a", "preview-b", "preview-c"].map((reviewerId) => ({
                    reviewerId,
                    label: reviewerId,
                  }))
                : [
                    {
                      reviewerId: actor.uid,
                      label: "SOFTWARE TEST — not human review evidence",
                    },
                  ],
              flaggedReviewerIds: [actor.uid],
              regularLimit: 25,
              createdAt: Date.now(),
              ...(body.qa ? { softwareQA: true } : {}),
            },
            answers: {},
            drafts: {},
          };
        }
        if (!state)
          throw new TitleValidationError(
            404,
            "The coordinator is preparing the new review. Earlier pilot answers remain available through the earlier-pilot link.",
          );
        if (action === "quick-manage") {
          if (body.operation === "expand") state.study.regularLimit = 100;
          else
            for (const row of additions)
              if (
                !state.study.roster.some((r) => r.reviewerId === row.reviewerId)
              )
                state.study.roster.push(row);
          return {
            state,
            result: { ok: true, regularLimit: state.study.regularLimit },
            event: {
              kind: "quick-assignments-updated",
              actorId: actor.uid,
              operation: body.operation,
              regularLimit: state.study.regularLimit,
            },
          };
        }
        let event: Record<string, unknown> | undefined;
        if (action === "quick-checkpoint" || action === "quick-respond") {
          const saved = saveQuick(
            state,
            data,
            actor.uid,
            flagged,
            actor.canManage,
            body.payload,
            body.revision,
            action === "quick-respond",
            Date.now(),
          );
          if (!saved.duplicate && action === "quick-respond")
            event = {
              kind: "quick-answer-submitted",
              actorId: actor.uid,
              caseId: body.payload.caseId,
              answerId: quickKey(actor.uid, body.payload.caseId),
              softwareQA: Boolean(state.study.softwareQA),
            };
        }
        const session = quickSession(
          state,
          data,
          actor.uid,
          flagged,
          actor.canManage,
          Date.now(),
        );
        return {
          state,
          result: { ...session, preview: actor.preview },
          ...(event ? { event } : {}),
        };
      },
    );
    return res.status(200).json(result);
  } catch (e) {
    const status = e instanceof TitleValidationError ? e.status : 500;
    if (status === 500)
      console.error(
        "Quick title review failed",
        e instanceof Error ? e.name : "UnknownError",
      );
    return res
      .status(status)
      .json({
        error:
          status === 500
            ? "Your review could not be loaded or saved. Existing answers are unchanged."
            : (e as Error).message,
      });
  }
}
