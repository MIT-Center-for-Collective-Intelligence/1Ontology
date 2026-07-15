import { NextApiResponse } from "next";

import {
  SomDeliberationAccess,
  SomDeliberationCommentStance,
  SomDeliberationResolutionDecision,
  SomReviewDecision,
} from "../../types/ISomReview";
import {
  ReviewAccess,
  reviewAccessForToken,
  reviewerRoleLabel,
} from "./access";

export class DeliberationApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const requireDeliberationAccess = (
  token: Record<string, unknown>,
): { access: ReviewAccess; response: SomDeliberationAccess } => {
  const access = reviewAccessForToken(token);
  if (!access.canDeliberate) {
    throw new DeliberationApiError(403, "Deliberation access is restricted");
  }
  return {
    access,
    response: {
      role: access.role,
      roleLabel: reviewerRoleLabel(access.role),
      canFinalize: access.canFinalize,
    },
  };
};

export const requiredText = (
  value: unknown,
  label: string,
  maximum = 2000,
): string => {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length < 3) {
    throw new DeliberationApiError(
      400,
      `${label} must be at least 3 characters`,
    );
  }
  if (text.length > maximum) {
    throw new DeliberationApiError(
      400,
      `${label} must be ${maximum} characters or fewer`,
    );
  }
  return text;
};

export const reviewDecision = (value: unknown): SomReviewDecision => {
  if (value !== "agree" && value !== "disagree") {
    throw new DeliberationApiError(400, "Invalid review decision");
  }
  return value;
};

export const commentStance = (value: unknown): SomDeliberationCommentStance => {
  if (
    value !== "support" &&
    value !== "oppose" &&
    value !== "question" &&
    value !== "synthesis"
  ) {
    throw new DeliberationApiError(400, "Invalid comment type");
  }
  return value;
};

export const resolutionDecision = (
  value: unknown,
): SomDeliberationResolutionDecision => {
  if (value !== "accept" && value !== "reject" && value !== "defer") {
    throw new DeliberationApiError(400, "Invalid resolution decision");
  }
  return value;
};

export const respondToDeliberationError = (
  error: unknown,
  res: NextApiResponse,
) => {
  if (error instanceof DeliberationApiError) {
    return res.status(error.status).json({ error: error.message });
  }
  if (
    error instanceof Error &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error(error);
  return res
    .status(500)
    .json({ error: "The deliberation request could not be completed" });
};
