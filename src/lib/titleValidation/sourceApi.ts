import { withSourceStudy } from "./sourceRepository";
import { getSourceDataset } from "./sourceDataset";
import {
  sourceSession,
  sourceStatus,
  saveSourceReview,
  SourceState,
  SOURCE_SCOPE,
  SourceDataset,
} from "./sourceReview";
import { QuickDataset, QuickState, quickKey } from "./quick";
import { TitleValidationError } from "./engine";
import { STUDY_COLLECTION } from "./repository";
import { hasReviewNavigation } from "./reviewNavigation";
import type { Actor } from "./api";
import { makeQuickSelection } from "./quickSelection";
import { sourceReviewExport } from "./sourceExport";

export async function sourceReviewAction(
  action: string,
  body: any,
  actor: Actor,
  id: string,
  data: QuickDataset,
  flagged: boolean,
  followup?: { sources: SourceDataset; number: number; postProcessing: { explanation: string; exactPrompt: string; model: string } },
) {
  if (
    ![
      "quick-source-session",
      "quick-source-status",
      "quick-source-checkpoint",
      "quick-source-respond",
      "quick-source-export",
    ].includes(action)
  )
    throw new TitleValidationError(404, "Unknown description review action.");
  const sources = followup?.sources || getSourceDataset();
  if (body.pageId !== undefined && typeof body.pageId !== "string")
    throw new TitleValidationError(400, "Unknown description.");
  if (
    action === "quick-source-export" &&
    body.scope !== undefined &&
    !["self", "team"].includes(body.scope)
  )
    throw new TitleValidationError(400, "Unknown download scope.");
  if (action === "quick-source-export" && body.scope !== "self") {
    if (!actor.canManage || actor.preview)
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
        "This review has not been prepared yet.",
      );
    const records = await Promise.all(
      ["answers", "drafts", "sourceAnswersV2", "sourceDraftsV2"].map((n) =>
        ref.collection(n).get(),
      ),
    );
    const rows = records.map((s) =>
      Object.fromEntries(s.docs.map((d) => [d.id, d.data()])),
    );
    const state: SourceState = {
      legacy: {
        study: doc.data()!.study,
        answers: rows[0] as any,
        drafts: rows[1] as any,
      },
      answers: rows[2] as any,
      drafts: rows[3] as any,
    };
    return sourceReviewExport(
      state,
      data,
      sources,
      actor.uid,
      actor.canManage,
      actor.preview,
      "team",
    );
  }
  const seed = (): QuickState => {
    const legacy: QuickState = {
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
    if (!followup)
      legacy.study.selection = makeQuickSelection(legacy, data, Date.now());
    return legacy;
  };
  return withSourceStudy<any>(id, actor.uid, actor.preview, seed, (state) => {
    if (action === "quick-source-export")
      return {
        result: sourceReviewExport(
          state,
          data,
          sources,
          actor.uid,
          actor.canManage,
          actor.preview,
          "self",
        ),
      };
    let event: Record<string, unknown> | undefined;
    if (
      action === "quick-source-checkpoint" ||
      action === "quick-source-respond"
    ) {
      if (body.packageVersion !== sources.version)
        throw new TitleValidationError(
          409,
          "This form version has changed. Reload to recover your saved review.",
        );
      if (body.reviewScope !== SOURCE_SCOPE)
        throw new TitleValidationError(
          409,
          "The review now includes only activities linked to one O*NET description. Refresh this page in your browser to continue; your saved answers and timing are preserved.",
        );
      const saved = saveSourceReview(
        state,
        data,
        sources,
        actor.uid,
        flagged,
        actor.canManage,
        body.payload,
        body.revision,
        action === "quick-source-respond",
        Date.now(),
      );
      if (!saved.duplicate && action === "quick-source-respond")
        event = {
          kind: "source-title-answer-submitted-v2",
          reviewScope: SOURCE_SCOPE,
          actorId: actor.uid,
          sourcePageId: body.payload.caseId,
          answerId: quickKey(actor.uid, body.payload.caseId),
          softwareQA: Boolean(state.legacy.study.softwareQA),
          packageVersion: sources.version,
        };
      else if (
        !saved.duplicate &&
        action === "quick-source-checkpoint" &&
        state.answers[quickKey(actor.uid, body.payload.caseId)]
      )
        event = {
          kind: "source-title-revisit-timing-checkpoint",
          reviewScope: SOURCE_SCOPE,
          actorId: actor.uid,
          sourcePageId: body.payload.caseId,
          activeTimeMs: body.payload.activeTimeMs,
          revision: saved.draft!.revision,
          softwareQA: Boolean(state.legacy.study.softwareQA),
          packageVersion: sources.version,
        };
    }
    const view =
      action === "quick-source-status"
        ? sourceStatus(
            state,
            data,
            sources,
            actor.uid,
            flagged,
            actor.canManage,
            body.pageId,
          )
        : sourceSession(
            state,
            data,
            sources,
            actor.uid,
            flagged,
            actor.canManage,
            Date.now(),
            action === "quick-source-respond"
              ? undefined
              : action === "quick-source-checkpoint"
                ? body.payload?.caseId
                : body.pageId,
          );
    return {
      result: {
        ...view,
        ...(followup ? {
          reviewBatch: followup.number,
          postProcessing: followup.postProcessing,
        } : {}),
        canReviewFlagged:
          view.canReviewFlagged || hasReviewNavigation(actor.uid),
        preview: actor.preview,
        canUseReviewLinks: actor.canUseReviewLinks === true,
        exports: {
          ...view.exports,
          teamAllowed: view.exports.teamAllowed && !actor.preview,
        },
      },
      ...(event ? { event } : {}),
    };
  });
}
