import crypto from "crypto";
import { Timestamp } from "firebase-admin/firestore";

import { admin, app, db } from "../firestoreServer/admin";
import {
  SOM_REVIEW_DELIBERATION_COMMENTS,
  SOM_REVIEW_DELIBERATION_POSITIONS,
  SOM_REVIEW_DELIBERATION_POSITION_REVISIONS,
  SOM_REVIEW_RESOLUTION_REVISIONS,
  SOM_REVIEW_RESOLUTIONS,
  SOM_REVIEW_RESPONSES,
} from "../firestoreClient/collections";
import {
  SomDeliberationComment,
  SomDeliberationCommentStance,
  SomDeliberationParticipant,
  SomDeliberationProposalResponse,
  SomDeliberationProposalSummary,
  SomDeliberationResolution,
  SomDeliberationResolutionDecision,
  SomReviewDecision,
} from "../../types/ISomReview";
import { SomDataset } from "./dataset";
import {
  resolveReviewerRole,
  reviewerRoleLabel,
  reviewerRoleWeights,
} from "./access";
import { aggregateDeliberationVotes } from "./deliberation";
import { toReviewerCard } from "./sanitize";

interface UserProfile {
  userId: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  roleClaim?: unknown;
}

interface ResponseRecord {
  proposalId: string;
  reviewerId: string;
  response: {
    decision: SomReviewDecision;
    disagreementReason?: string;
    reviewedAt?: string;
  };
  updatedAt?: unknown;
}

interface PositionRecord {
  proposalId: string;
  reviewerId: string;
  decision: SomReviewDecision;
  rationale: string;
  updatedAt?: unknown;
  revisionCount?: number;
}

interface ResolutionRecord {
  proposalId: string;
  decision: SomDeliberationResolutionDecision;
  rationale: string;
  resolvedBy: string;
  updatedAt?: unknown;
  revisionCount?: number;
}

interface CommentRecord {
  id: string;
  proposalId: string;
  authorId: string;
  stance: SomDeliberationCommentStance;
  body: string;
  createdAt?: unknown;
}

interface DeliberationBundle {
  responses: ResponseRecord[];
  positions: PositionRecord[];
  resolutions: ResolutionRecord[];
  comments: CommentRecord[];
  profiles: Map<string, UserProfile>;
}

export class DeliberationStoreError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const toIso = (value: any, fallback = ""): string => {
  if (value?.toDate) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return fallback;
};

const toMillis = (value: any): number => {
  if (value?.toMillis) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") return Date.parse(value) || 0;
  return 0;
};

const latestBy = <T>(
  records: T[],
  keyFor: (record: T) => string,
  timeFor: (record: T) => unknown,
): T[] => {
  const latest = new Map<string, T>();
  for (const record of records) {
    const key = keyFor(record);
    const existing = latest.get(key);
    if (!existing || toMillis(timeFor(record)) >= toMillis(timeFor(existing))) {
      latest.set(key, record);
    }
  }
  return [...latest.values()];
};

const chunks = <T>(values: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
};

const loadUserProfiles = async (
  userIds: string[],
): Promise<Map<string, UserProfile>> => {
  const unique = [...new Set(userIds.filter(Boolean))];
  const [snapshots, authResults] = await Promise.all([
    Promise.all(
      chunks(unique, 30).map((ids) =>
        db.collection("users").where("userId", "in", ids).get(),
      ),
    ),
    Promise.all(
      chunks(unique, 100).map((ids) =>
        admin.auth(app).getUsers(ids.map((uid) => ({ uid }))),
      ),
    ),
  ]);
  const profiles = new Map<string, UserProfile>();
  for (const snapshot of snapshots) {
    for (const doc of snapshot.docs) {
      const user = doc.data();
      const userId = String(user.userId || "");
      if (!userId) continue;
      const fullName = [user.fName, user.lName]
        .filter(Boolean)
        .join(" ")
        .trim();
      profiles.set(userId, {
        userId,
        displayName: fullName || user.uname || doc.id || "Reviewer",
        email: "",
        emailVerified: false,
      });
    }
  }
  for (const result of authResults) {
    for (const user of result.users) {
      const existing = profiles.get(user.uid);
      profiles.set(user.uid, {
        userId: user.uid,
        displayName:
          existing?.displayName || user.displayName || user.email || "Reviewer",
        email: user.email || "",
        emailVerified: user.emailVerified,
        roleClaim: user.customClaims?.somReviewRole,
      });
    }
  }
  for (const userId of unique) {
    if (!profiles.has(userId)) {
      profiles.set(userId, {
        userId,
        displayName: "Reviewer",
        email: "",
        emailVerified: false,
      });
    }
  }
  return profiles;
};

const queryRecords = async (
  collectionName: string,
  datasetVersion: string,
  proposalId?: string,
) => {
  let query: any = db
    .collection(collectionName)
    .where("datasetVersion", "==", datasetVersion);
  if (proposalId) query = query.where("proposalId", "==", proposalId);
  return query.get();
};

const loadBundle = async (
  datasetVersion: string,
  proposalId?: string,
): Promise<DeliberationBundle> => {
  let responseQuery: any = db
    .collection(SOM_REVIEW_RESPONSES)
    .where("datasetVersion", "==", datasetVersion)
    .where("status", "==", "current");
  if (proposalId) {
    responseQuery = responseQuery.where("proposalId", "==", proposalId);
  }
  const [
    responseSnapshot,
    positionSnapshot,
    resolutionSnapshot,
    commentSnapshot,
  ] = await Promise.all([
    responseQuery.get(),
    queryRecords(SOM_REVIEW_DELIBERATION_POSITIONS, datasetVersion, proposalId),
    queryRecords(SOM_REVIEW_RESOLUTIONS, datasetVersion, proposalId),
    queryRecords(SOM_REVIEW_DELIBERATION_COMMENTS, datasetVersion, proposalId),
  ]);

  const responses = latestBy<ResponseRecord>(
    responseSnapshot.docs.map((doc: any) => doc.data() as ResponseRecord),
    (record) => `${record.proposalId}|${record.reviewerId}`,
    (record) => record.updatedAt || record.response.reviewedAt,
  );
  const positions = latestBy<PositionRecord>(
    positionSnapshot.docs.map((doc: any) => doc.data() as PositionRecord),
    (record) => `${record.proposalId}|${record.reviewerId}`,
    (record) => record.updatedAt,
  );
  const resolutions = latestBy<ResolutionRecord>(
    resolutionSnapshot.docs.map((doc: any) => doc.data() as ResolutionRecord),
    (record) => record.proposalId,
    (record) => record.updatedAt,
  );
  const comments: CommentRecord[] = commentSnapshot.docs.map(
    (doc: any) => ({ id: doc.id, ...doc.data() }) as CommentRecord,
  );
  const userIds = [
    ...responses.map((record) => record.reviewerId),
    ...comments.map((record) => record.authorId),
    ...resolutions.map((record) => record.resolvedBy),
  ];
  const profiles = await loadUserProfiles(userIds);
  return { responses, positions, resolutions, comments, profiles };
};

const positionKey = (proposalId: string, reviewerId: string): string =>
  `${proposalId}|${reviewerId}`;

const participantsFor = (
  proposalId: string,
  bundle: DeliberationBundle,
): SomDeliberationParticipant[] => {
  const weights = reviewerRoleWeights();
  const positions = new Map(
    bundle.positions.map((position) => [
      positionKey(position.proposalId, position.reviewerId),
      position,
    ]),
  );
  const roleOrder = { steward: 0, researcher: 1, contributor: 2 } as const;

  return bundle.responses
    .filter((record) => record.proposalId === proposalId)
    .map((record) => {
      const profile = bundle.profiles.get(record.reviewerId) || {
        userId: record.reviewerId,
        displayName: "Reviewer",
        email: "",
        emailVerified: false,
      };
      const role = resolveReviewerRole({
        uid: record.reviewerId,
        email: profile.email,
        emailVerified: profile.emailVerified,
        roleClaim: profile.roleClaim,
      });
      const position = positions.get(
        positionKey(proposalId, record.reviewerId),
      );
      const effectiveDecision = position?.decision || record.response.decision;
      return {
        reviewerId: record.reviewerId,
        displayName: profile.displayName,
        role,
        roleLabel: reviewerRoleLabel(role),
        weight: weights[role],
        originalDecision: record.response.decision,
        effectiveDecision,
        revised: Boolean(position),
        rationale:
          position?.rationale || record.response.disagreementReason || "",
        reviewedAt: position
          ? toIso(position.updatedAt)
          : record.response.reviewedAt || toIso(record.updatedAt),
      };
    })
    .sort(
      (first, second) =>
        roleOrder[first.role] - roleOrder[second.role] ||
        first.displayName.localeCompare(second.displayName),
    );
};

const resolutionFor = (
  proposalId: string,
  bundle: DeliberationBundle,
): SomDeliberationResolution | undefined => {
  const resolution = bundle.resolutions.find(
    (record) => record.proposalId === proposalId,
  );
  if (!resolution) return undefined;
  return {
    decision: resolution.decision,
    rationale: resolution.rationale,
    resolvedBy: resolution.resolvedBy,
    resolvedByName:
      bundle.profiles.get(resolution.resolvedBy)?.displayName || "Reviewer",
    resolvedAt: toIso(resolution.updatedAt),
  };
};

const commentsFor = (
  proposalId: string,
  bundle: DeliberationBundle,
): SomDeliberationComment[] =>
  bundle.comments
    .filter((record) => record.proposalId === proposalId)
    .map((record) => ({
      id: record.id,
      authorId: record.authorId,
      authorName:
        bundle.profiles.get(record.authorId)?.displayName || "Reviewer",
      stance: record.stance,
      body: record.body,
      createdAt: toIso(record.createdAt),
    }))
    .sort((first, second) => first.createdAt.localeCompare(second.createdAt));

const aggregateFor = (participants: SomDeliberationParticipant[]) =>
  aggregateDeliberationVotes(
    participants.map((participant) => ({
      reviewerId: participant.reviewerId,
      role: participant.role,
      weight: participant.weight,
      decision: participant.effectiveDecision,
    })),
  );

export const loadDeliberationOverview = async (
  dataset: SomDataset,
  requesterId: string,
): Promise<{
  proposals: SomDeliberationProposalSummary[];
  remainingIndependentReviews: number;
}> => {
  const bundle = await loadBundle(dataset.datasetVersion);
  const independentlyReviewed = new Set(
    bundle.responses
      .filter((response) => response.reviewerId === requesterId)
      .map((response) => response.proposalId),
  );
  const allRecords = [...dataset.recordsById.values()];
  const proposals = allRecords
    .filter((record) => independentlyReviewed.has(record.proposalId))
    .map((record) => {
      const card = toReviewerCard(record);
      const participants = participantsFor(card.proposalId, bundle);
      return {
        proposalId: card.proposalId,
        issueType: card.issueType,
        question: card.reviewerView.question,
        currentState: card.reviewerView.currentState,
        proposedState: card.reviewerView.proposedState,
        aggregate: aggregateFor(participants),
        commentCount: bundle.comments.filter(
          (comment) => comment.proposalId === card.proposalId,
        ).length,
        resolution: resolutionFor(card.proposalId, bundle),
      };
    });
  return {
    proposals,
    remainingIndependentReviews: Math.max(
      0,
      allRecords.length - proposals.length,
    ),
  };
};

export const assertIndependentReview = async (
  datasetVersion: string,
  proposalId: string,
  reviewerId: string,
): Promise<void> => {
  const snapshot = await db
    .collection(SOM_REVIEW_RESPONSES)
    .where("datasetVersion", "==", datasetVersion)
    .where("proposalId", "==", proposalId)
    .where("reviewerId", "==", reviewerId)
    .where("status", "==", "current")
    .limit(1)
    .get();
  if (snapshot.empty) {
    throw new DeliberationStoreError(
      409,
      "Complete the independent review before opening group deliberation",
    );
  }
};

export const loadDeliberationProposal = async (
  dataset: SomDataset,
  proposalId: string,
  requesterId: string,
  access: SomDeliberationProposalResponse["access"],
): Promise<SomDeliberationProposalResponse> => {
  const record = dataset.recordsById.get(proposalId);
  if (!record) throw new Error("Unknown proposalId");
  const bundle = await loadBundle(dataset.datasetVersion, proposalId);
  const participants = participantsFor(proposalId, bundle);
  const mine = participants.find(
    (participant) => participant.reviewerId === requesterId,
  );
  if (!mine) {
    throw new DeliberationStoreError(
      409,
      "Complete the independent review before opening group deliberation",
    );
  }
  return {
    datasetVersion: dataset.datasetVersion,
    access,
    card: toReviewerCard(record),
    aggregate: aggregateFor(participants),
    participants,
    comments: commentsFor(proposalId, bundle),
    resolution: resolutionFor(proposalId, bundle),
    myOriginalDecision: mine.originalDecision,
    myEffectiveDecision: mine.effectiveDecision,
  };
};

const stableDocId = (...parts: string[]): string =>
  crypto.createHash("sha256").update(parts.join("|")).digest("hex");

export const addDeliberationComment = async ({
  datasetVersion,
  proposalId,
  authorId,
  stance,
  body,
}: {
  datasetVersion: string;
  proposalId: string;
  authorId: string;
  stance: SomDeliberationCommentStance;
  body: string;
}) => {
  const commentRef = db
    .collection(SOM_REVIEW_DELIBERATION_COMMENTS)
    .doc(stableDocId(datasetVersion, proposalId, authorId, stance, body));
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(commentRef);
    if (existing.exists) return;
    transaction.set(commentRef, {
      datasetVersion,
      proposalId,
      authorId,
      stance,
      body,
      createdAt: Timestamp.now(),
    });
  });
};

export const saveDeliberationPosition = async ({
  datasetVersion,
  proposalId,
  reviewerId,
  decision,
  rationale,
}: {
  datasetVersion: string;
  proposalId: string;
  reviewerId: string;
  decision: SomReviewDecision;
  rationale: string;
}) => {
  await db.runTransaction(async (transaction) => {
    const originalQuery = db
      .collection(SOM_REVIEW_RESPONSES)
      .where("datasetVersion", "==", datasetVersion)
      .where("proposalId", "==", proposalId)
      .where("reviewerId", "==", reviewerId)
      .where("status", "==", "current")
      .limit(1);
    const positionRef = db
      .collection(SOM_REVIEW_DELIBERATION_POSITIONS)
      .doc(stableDocId(datasetVersion, proposalId, reviewerId));
    const [originalSnapshot, positionSnapshot] = await Promise.all([
      transaction.get(originalQuery),
      transaction.get(positionRef),
    ]);
    if (originalSnapshot.empty) {
      throw new DeliberationStoreError(
        409,
        "Complete the independent review before revising your judgment",
      );
    }
    const now = Timestamp.now();
    const previous = positionSnapshot.exists ? positionSnapshot.data() : null;
    if (previous?.decision === decision && previous?.rationale === rationale) {
      return;
    }
    const revisionIndex = (previous?.revisionCount || 0) + 1;
    const position = {
      datasetVersion,
      proposalId,
      reviewerId,
      decision,
      rationale,
      revisionCount: revisionIndex,
      createdAt: previous?.createdAt || now,
      updatedAt: now,
    };
    transaction.set(positionRef, position);
    transaction.set(
      db.collection(SOM_REVIEW_DELIBERATION_POSITION_REVISIONS).doc(),
      { ...position, createdAt: now },
    );
  });
};

export const saveDeliberationResolution = async ({
  datasetVersion,
  proposalId,
  resolverId,
  decision,
  rationale,
}: {
  datasetVersion: string;
  proposalId: string;
  resolverId: string;
  decision: SomDeliberationResolutionDecision;
  rationale: string;
}) => {
  await db.runTransaction(async (transaction) => {
    const resolutionRef = db
      .collection(SOM_REVIEW_RESOLUTIONS)
      .doc(stableDocId(datasetVersion, proposalId));
    const snapshot = await transaction.get(resolutionRef);
    const previous = snapshot.exists ? snapshot.data() : null;
    if (previous?.decision === decision && previous?.rationale === rationale) {
      return;
    }
    const now = Timestamp.now();
    const revisionIndex = (previous?.revisionCount || 0) + 1;
    const resolution = {
      datasetVersion,
      proposalId,
      decision,
      rationale,
      resolvedBy: resolverId,
      revisionCount: revisionIndex,
      createdAt: previous?.createdAt || now,
      updatedAt: now,
    };
    transaction.set(resolutionRef, resolution);
    transaction.set(db.collection(SOM_REVIEW_RESOLUTION_REVISIONS).doc(), {
      ...resolution,
      createdAt: now,
    });
  });
};
