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
  sourceStatus(state, data, sources, uid, false, canManage);
  if (scope === "team") {
    if (!canManage || preview)
      throw new TitleValidationError(
        403,
        "Only coordinators can export team reviews.",
      );
  }
  const answers = Object.values(state.answers)
      .filter((a) => scope === "team" || a.reviewerId === uid)
      .map((answer) => {
        const draft = state.drafts[answer.id];
        const cumulativeActiveTimeMs = Math.max(
          answer.activeTimeMs,
          draft?.payload.activeTimeMs ?? 0,
        );
        return {
          ...answer,
          cumulativeActiveTimeMs,
          revisitActiveTimeMs: cumulativeActiveTimeMs - answer.activeTimeMs,
          lastTimingUpdateAt: Math.max(
            answer.submittedAt,
            draft?.updatedAt ?? 0,
          ),
        };
      }),
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
      "Submitted reviews only in CSV. Active page time includes later visits, counted once per description page; original submission time is retained separately. Earlier activity-level records remain separate; associated activities are not independent samples. Missing proposals are not human rejections.",
  };
}
