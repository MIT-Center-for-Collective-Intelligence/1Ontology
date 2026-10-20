import { withSourceStudy } from "./sourceRepository";
import { getSourceDataset } from "./sourceDataset";
import {
  sourceSession,
  sourceStatus,
  saveSourceReview,
  SourceState,
} from "./sourceReview";
import { QuickDataset, QuickState, quickKey } from "./quick";
import { TitleValidationError } from "./engine";
import { STUDY_COLLECTION } from "./repository";
import { hasReviewNavigation } from "./reviewNavigation";
import type { Actor } from "./api";
import { makeQuickSelection } from "./quickSelection";

export async function sourceReviewAction(
  action: string,
  body: any,
  actor: Actor,
  id: string,
  data: QuickDataset,
  flagged: boolean,
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
  const sources = getSourceDataset();
  if (action === "quick-source-export") {
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
    const own = sourceStatus(state, data, sources, actor.uid, false, true);
    if (
      state.legacy.study.roster.some((r) => r.reviewerId === actor.uid) &&
      own.completed !== own.total &&
      !body.qa
    )
      throw new TitleValidationError(
        403,
        "Finish your regular reviews before opening other reviewers’ answers.",
      );
    return {
      formatVersion: "source-title-review-export-v2",
      study: state.legacy.study,
      answers: Object.values(state.answers),
      drafts: Object.values(state.drafts),
      legacyAnswers: Object.values(state.legacy.answers),
      legacyDrafts: Object.values(state.legacy.drafts),
      dataset: sources,
      legacyDataset: data,
      interpretation:
        "One new timing record per O*NET description page. Previous activity-level answers/timing are separate historical records, never overwritten or added to page time. Associated activities supplement the original sample; do not treat them as independently sampled cases. Missing model proposals are not human rejections.",
    };
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
    legacy.study.selection = makeQuickSelection(legacy, data, Date.now());
    return legacy;
  };
  return withSourceStudy(id, actor.uid, actor.preview, seed, (state) => {
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
          actorId: actor.uid,
          sourcePageId: body.payload.caseId,
          answerId: quickKey(actor.uid, body.payload.caseId),
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
          )
        : sourceSession(
            state,
            data,
            sources,
            actor.uid,
            flagged,
            actor.canManage,
            Date.now(),
          );
    return {
      result: {
        ...view,
        canReviewFlagged:
          view.canReviewFlagged || hasReviewNavigation(actor.uid),
        preview: actor.preview,
        canUseReviewLinks: actor.canUseReviewLinks === true,
      },
      ...(event ? { event } : {}),
    };
  });
}
