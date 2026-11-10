export const MULTI_SOURCE_STUDY_ID = "multi-source-title-review-20261110-v1";
export const MULTI_SOURCE_COMMENT_LIMIT = 2000;

export type MultiSourceRating = "acceptable" | "not_acceptable" | "unsure";

export interface MultiSourceRatedItem {
  rating: MultiSourceRating;
  comment: string;
}

export interface MultiSourceCase {
  id: string;
  originalTitle: string;
  reason: string;
  descriptions: { number: number; sourceId: string; text: string }[];
  groups: { id: string; title: string; descriptionNumbers: number[]; reason: string }[];
}

export interface MultiSourceReview {
  titles: Record<string, MultiSourceRatedItem>;
  categorization: MultiSourceRatedItem;
  revision: number;
  updatedAt: string;
}

export interface MultiSourceSession {
  version: string;
  reviewerLabel: string;
  cases: MultiSourceCase[];
  reviews: Record<string, MultiSourceReview>;
}
