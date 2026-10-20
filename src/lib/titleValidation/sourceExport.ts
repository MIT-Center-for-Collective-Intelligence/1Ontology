import { TitleValidationError } from "./engine";
import type { QuickDataset } from "./quick";
import {
  sourceStatus,
  type SourceDataset,
  type SourceState,
} from "./sourceReview";

export function sourceReviewExport(
  state: SourceState,
  data: QuickDataset,
  sources: SourceDataset,
  uid: string,
  canManage: boolean,
  preview: boolean,
  scope: "self" | "team",
) {
  const own = sourceStatus(state, data, sources, uid, false, canManage);
  if (scope === "team") {
    if (!canManage || preview)
      throw new TitleValidationError(
        403,
        "Only coordinators can export team reviews.",
      );
    if (!own.exports.teamAllowed)
      throw new TitleValidationError(
        403,
        "Finish your regular reviews before opening other reviewers’ answers. You can download your own submitted reviews now.",
      );
  }
  const answers = Object.values(state.answers).filter(
      (a) => scope === "team" || a.reviewerId === uid,
    ),
    legacyAnswers = Object.values(state.legacy.answers).filter(
      (a) => scope === "team" || a.reviewerId === uid,
    );
  const ownStudy = {
    id: state.legacy.study.id,
    protocol: state.legacy.study.protocol,
    datasetVersion: state.legacy.study.datasetVersion,
    roster: state.legacy.study.roster.filter((r) => r.reviewerId === uid),
    flaggedReviewerIds: state.legacy.study.flaggedReviewerIds.filter(
      (id) => id === uid,
    ),
    regularLimit: state.legacy.study.regularLimit,
    createdAt: state.legacy.study.createdAt,
    ...(state.legacy.study.softwareQA ? { softwareQA: true } : {}),
  };
  return {
    formatVersion: "source-title-review-export-v2",
    scope,
    study: scope === "team" ? state.legacy.study : ownStudy,
    answers,
    legacyAnswers,
    drafts: scope === "team" ? Object.values(state.drafts) : [],
    legacyDrafts: scope === "team" ? Object.values(state.legacy.drafts) : [],
    dataset:
      scope === "team"
        ? sources
        : {
            ...sources,
            pages: sources.pages.filter((p) =>
              answers.some((a) => a.caseId === p.id),
            ),
          },
    legacyDataset:
      scope === "team"
        ? data
        : {
            ...data,
            cases: data.cases.filter((c) =>
              legacyAnswers.some((a) => a.caseId === c.id),
            ),
          },
    interpretation:
      "Submitted reviews only in CSV. One timing record per O*NET description page. Earlier activity-level answers/timing remain separate historical records; do not add their time to the new page time or count associated activities as independent samples. Missing proposals are not human rejections.",
  };
}
