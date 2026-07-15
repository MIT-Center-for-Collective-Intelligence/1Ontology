import { SomReviewerRole } from "../../types/ISomReview";

export interface ReviewIdentity {
  uid: string;
  email?: string | null;
  emailVerified?: boolean;
  roleClaim?: unknown;
  claims?: Record<string, unknown>;
}

export interface ReviewAccess {
  role: SomReviewerRole;
  canDeliberate: boolean;
  canFinalize: boolean;
}

const DEFAULT_STEWARD_EMAILS = ["malone@mit.edu", "rjl@mit.edu"];

const DEFAULT_STEWARD_UIDS = [
  "ScOrQGUXCNPSniAIFc8nz2epK4l1",
  "vFCAkxKTwjcDKohmiWfiZWz2lZf1",
];

const DEFAULT_RESEARCHER_EMAILS = [
  "oneweb@umich.edu",
  "oneman@mit.edu",
  "iman@honor.education",
  "caia@mit.edu",
  "acai@college.harvard.edu",
  "xinru.wang@smart.mit.edu",
  "becky97jn@gmail.com",
  "beckyxinruw@gmail.com",
  "shuo.sun@smart.mit.edu",
  "shuo.sun@u.nus.edu",
  "vcharissi@gmail.com",
  "alok.prakash@smart.mit.edu",
  "aimanim@mit.edu",
  "ethanasi@mit.edu",
];

const normalizedSet = (defaults: string[], configured?: string): Set<string> =>
  new Set(
    [...defaults, ...(configured || "").split(",")]
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );

const uidSet = (defaults: string[], configured?: string): Set<string> =>
  new Set(
    [...defaults, ...(configured || "").split(",")]
      .map((value) => value.trim())
      .filter(Boolean),
  );

const isReviewerRole = (value: unknown): value is SomReviewerRole =>
  value === "steward" || value === "researcher" || value === "contributor";

const positiveWeight = (
  value: string | undefined,
  fallback: number,
): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * Role weights are server configuration. They are returned only by admin APIs.
 * Enforce the requested ordering even if an environment variable is invalid.
 */
export const reviewerRoleWeights = (): Record<SomReviewerRole, number> => {
  const contributor = positiveWeight(
    process.env.SOM_REVIEW_CONTRIBUTOR_WEIGHT,
    1,
  );
  const researcher = Math.max(
    positiveWeight(process.env.SOM_REVIEW_RESEARCHER_WEIGHT, 2),
    contributor + 1,
  );
  const steward = Math.max(
    positiveWeight(process.env.SOM_REVIEW_STEWARD_WEIGHT, 4),
    researcher + 1,
  );
  return { steward, researcher, contributor };
};

export const reviewerRoleLabel = (role: SomReviewerRole): string => {
  switch (role) {
    case "steward":
      return "Senior steward";
    case "researcher":
      return "Research team";
    case "contributor":
      return "Contributing reviewer";
  }
};

export const resolveReviewerRole = (
  identity: ReviewIdentity,
): SomReviewerRole => {
  const claimedRole = identity.roleClaim ?? identity.claims?.somReviewRole;
  if (isReviewerRole(claimedRole)) return claimedRole;

  const email = (identity.email || "").trim().toLowerCase();
  const emailCanAssignRole = identity.emailVerified === true;
  const stewardEmails = normalizedSet(
    DEFAULT_STEWARD_EMAILS,
    process.env.SOM_REVIEW_STEWARD_EMAILS,
  );
  const stewardUids = uidSet(
    DEFAULT_STEWARD_UIDS,
    process.env.SOM_REVIEW_STEWARD_UIDS,
  );
  if (
    (emailCanAssignRole && stewardEmails.has(email)) ||
    stewardUids.has(identity.uid)
  ) {
    return "steward";
  }

  const researcherEmails = normalizedSet(
    DEFAULT_RESEARCHER_EMAILS,
    process.env.SOM_REVIEW_RESEARCHER_EMAILS,
  );
  const researcherUids = uidSet([], process.env.SOM_REVIEW_RESEARCHER_UIDS);
  if (
    (emailCanAssignRole && researcherEmails.has(email)) ||
    researcherUids.has(identity.uid)
  ) {
    return "researcher";
  }

  return "contributor";
};

export const reviewAccessForIdentity = (
  identity: ReviewIdentity,
): ReviewAccess => {
  const role = resolveReviewerRole(identity);
  const canDeliberate = role !== "contributor";
  const canFinalize =
    role === "steward" || identity.claims?.somReviewFinalizer === true;
  return { role, canDeliberate, canFinalize };
};

export const reviewAccessForToken = (
  token: Record<string, unknown>,
): ReviewAccess =>
  reviewAccessForIdentity({
    uid: String(token.uid || token.sub || ""),
    email: typeof token.email === "string" ? token.email : "",
    emailVerified: token.email_verified === true,
    claims: token,
  });
