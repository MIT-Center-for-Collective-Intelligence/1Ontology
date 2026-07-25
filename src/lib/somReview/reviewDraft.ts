export interface ReviewDraftIdentity {
  reviewerId: string;
  datasetVersion: string;
  proposalId: string;
  mode: "review" | "revise";
}

export const reviewDraftStorageKey = ({
  reviewerId,
  datasetVersion,
  proposalId,
  mode,
}: ReviewDraftIdentity): string =>
  [
    "som-review-draft",
    reviewerId,
    datasetVersion,
    proposalId,
    mode === "revise" ? "revise" : null,
  ]
    .filter(Boolean)
    .join("-");

export const clearReviewDraft = (identity: ReviewDraftIdentity): void => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(reviewDraftStorageKey(identity));
  } catch {
    // The saved server response remains authoritative if storage is unavailable.
  }
};
