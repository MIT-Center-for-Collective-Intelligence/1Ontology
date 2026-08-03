import crypto from "crypto";
import { Query, Timestamp, Transaction } from "firebase-admin/firestore";

import { db } from "../firestoreServer/admin";
import {
  SOM_REVIEW_RESPONSES,
  SOM_REVIEW_RESPONSE_REVISIONS,
  SOM_REVIEW_SESSIONS,
  SOM_REVIEW_TRUSTED_PROPAGATIONS,
  SOM_REVIEW_TRUSTED_PROPAGATION_REVISIONS,
} from "../firestoreClient/collections";
import { SomIssuePrerequisite, SomIssueType } from "../../types/ISomReview";
import {
  getDatasetByVersion,
  isIssueTypeEnabled,
  SomDataset,
  proposalAvailability,
} from "./dataset";
import { issuePrerequisiteTypes } from "./reviewDependencies";
import {
  dropMissingProposalIds,
  isResumableSession,
  mergeReadyProposalIds,
  prioritizeProposalAtCursor,
  planResponseTransition,
  planUndoTransition,
} from "./sessionState";
import { readyDependentRecords } from "./followUps";
import {
  TrustedPropagationDirective,
  TrustedPropagationPlanState,
  trustedPropagationPlanTransition,
} from "./trustedPropagation";
import {
  carryForwardResponseRecords,
  responseCarryForwardSources,
} from "./responseCarryForward";

export interface SessionDoc {
  datasetVersion: string;
  issueType: SomIssueType;
  reviewerId: string;
  proposalIds: string[];
  cursor: number;
  status: "active" | "completed";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface StoredSession extends SessionDoc {
  id: string;
}

/** The reviewer's current (non-retracted) response for one proposal. */
const currentResponseQuery = (
  datasetVersion: string,
  proposalId: string,
  reviewerId: string,
): Query =>
  db
    .collection(SOM_REVIEW_RESPONSES)
    .where("datasetVersion", "==", datasetVersion)
    .where("proposalId", "==", proposalId)
    .where("reviewerId", "==", reviewerId)
    .where("status", "==", "current")
    .limit(1);

const activeSessionQuery = (
  datasetVersion: string,
  issueType: SomIssueType,
  reviewerId: string,
): Query =>
  db
    .collection(SOM_REVIEW_SESSIONS)
    .where("datasetVersion", "==", datasetVersion)
    .where("issueType", "==", issueType)
    .where("reviewerId", "==", reviewerId)
    .where("status", "==", "active")
    .limit(1);

const answeredProposalIds = async (
  datasetVersion: string,
  issueType: SomIssueType,
  reviewerId: string,
): Promise<Set<string>> => {
  const snapshot = await db
    .collection(SOM_REVIEW_RESPONSES)
    .where("datasetVersion", "==", datasetVersion)
    .where("reviewerId", "==", reviewerId)
    .where("status", "==", "current")
    .get();
  const records = carryForwardResponseRecords(
    getDatasetByVersion(datasetVersion),
    snapshot.docs.map((doc) => doc.data() as StoredResponseDoc),
  );
  return new Set(
    records
      .filter((record) => record.issueType === issueType)
      .map((record) => record.proposalId),
  );
};

const reviewerDecisions = async (
  datasetVersion: string,
  reviewerId: string,
): Promise<Map<string, "agree" | "disagree">> => {
  const snapshot = await db
    .collection(SOM_REVIEW_RESPONSES)
    .where("datasetVersion", "==", datasetVersion)
    .where("reviewerId", "==", reviewerId)
    .where("status", "==", "current")
    .get();
  const records = carryForwardResponseRecords(
    getDatasetByVersion(datasetVersion),
    snapshot.docs.map((doc) => doc.data() as StoredResponseDoc),
  );
  return new Map(
    records.map((record) => [record.proposalId, record.response.decision]),
  );
};

export interface PendingSummary {
  reviewed: number;
  pending: number;
  waiting: number;
  notApplicable: number;
}

export const pendingSummary = async (
  dataset: SomDataset,
  issueType: SomIssueType,
  reviewerId: string,
): Promise<PendingSummary> => {
  const all = dataset.orderedIdsByIssue.get(issueType) || [];
  const [answered, decisions] = await Promise.all([
    answeredProposalIds(dataset.datasetVersion, issueType, reviewerId),
    reviewerDecisions(dataset.datasetVersion, reviewerId),
  ]);
  const summary: PendingSummary = {
    reviewed: 0,
    pending: 0,
    waiting: 0,
    notApplicable: 0,
  };
  for (const id of all) {
    if (answered.has(id)) {
      summary.reviewed += 1;
      continue;
    }
    const availability = proposalAvailability(
      dataset.recordsById.get(id),
      decisions,
    );
    if (availability === "ready") summary.pending += 1;
    if (availability === "waiting") summary.waiting += 1;
    if (availability === "not-applicable") summary.notApplicable += 1;
  }
  return summary;
};

export const pendingCount = async (
  dataset: SomDataset,
  issueType: SomIssueType,
  reviewerId: string,
): Promise<number> => {
  return (await pendingSummary(dataset, issueType, reviewerId)).pending;
};

export const reviewerBlockingPrerequisites = async (
  dataset: SomDataset,
  issueType: SomIssueType,
  reviewerId: string,
): Promise<SomIssuePrerequisite[]> => {
  const prerequisiteTypes =
    issuePrerequisiteTypes(issueType).filter(isIssueTypeEnabled);
  const summaries = await Promise.all(
    prerequisiteTypes.map(async (prerequisiteType) => ({
      prerequisiteType,
      summary: await pendingSummary(dataset, prerequisiteType, reviewerId),
    })),
  );
  return summaries.flatMap(({ prerequisiteType, summary }) => {
    const remaining = summary.pending + summary.waiting;
    if (remaining === 0) return [];
    return [
      {
        id: prerequisiteType,
        label: dataset.issueLabels.get(prerequisiteType) || prerequisiteType,
        remaining,
      },
    ];
  });
};

export const reviewerReadyDependentRecords = async (
  dataset: SomDataset,
  reviewerId: string,
  sourceProposalId?: string,
): Promise<any[]> => {
  const decisions = await reviewerDecisions(dataset.datasetVersion, reviewerId);
  return readyDependentRecords(dataset, decisions, sourceProposalId);
};

export const activeSessionProgress = async (
  dataset: SomDataset,
  issueType: SomIssueType,
  reviewerId: string,
): Promise<{ cursor: number; total: number } | null> => {
  const snapshot = await activeSessionQuery(
    dataset.datasetVersion,
    issueType,
    reviewerId,
  ).get();
  if (snapshot.empty) return null;
  const session = snapshot.docs[0].data() as SessionDoc;
  if (!isResumableSession(session)) return null;

  const [answered, decisions] = await Promise.all([
    answeredProposalIds(dataset.datasetVersion, issueType, reviewerId),
    reviewerDecisions(dataset.datasetVersion, reviewerId),
  ]);
  const ready = (dataset.orderedIdsByIssue.get(issueType) || []).filter(
    (proposalId) =>
      !answered.has(proposalId) &&
      proposalAvailability(dataset.recordsById.get(proposalId), decisions) ===
        "ready",
  );
  const proposalIds = mergeReadyProposalIds(session.proposalIds, ready);
  return { cursor: session.cursor, total: proposalIds.length };
};

/**
 * Returns the reviewer's unfinished session for this issue type, or builds a
 * new one containing every currently ready unanswered record for that issue
 * type, in deterministic dataset order. Completed sessions are kept as
 * history; only "active" sessions are resumed.
 */
export const getOrCreateSession = async (
  dataset: SomDataset,
  issueType: SomIssueType,
  reviewerId: string,
  preferredProposalId?: string,
): Promise<StoredSession | null> => {
  const decisions = await reviewerDecisions(dataset.datasetVersion, reviewerId);
  const existing = await activeSessionQuery(
    dataset.datasetVersion,
    issueType,
    reviewerId,
  ).get();
  if (!existing.empty) {
    const existingDoc = existing.docs[0];
    const session = existingDoc.data() as SessionDoc;
    const sanitized = dropMissingProposalIds(
      session.proposalIds,
      session.cursor,
      dataset.recordsById,
    );
    const remainingReady = sanitized.proposalIds
      .slice(sanitized.cursor)
      .every(
        (proposalId) =>
          proposalAvailability(
            dataset.recordsById.get(proposalId),
            decisions,
          ) === "ready",
      );
    if (
      isResumableSession({
        ...session,
        proposalIds: sanitized.proposalIds,
        cursor: sanitized.cursor,
      }) &&
      remainingReady
    ) {
      const all = dataset.orderedIdsByIssue.get(issueType) || [];
      const answered = await answeredProposalIds(
        dataset.datasetVersion,
        issueType,
        reviewerId,
      );
      const ready = all.filter(
        (proposalId) =>
          !answered.has(proposalId) &&
          proposalAvailability(
            dataset.recordsById.get(proposalId),
            decisions,
          ) === "ready",
      );
      const proposalIds = prioritizeProposalAtCursor(
        mergeReadyProposalIds(sanitized.proposalIds, ready),
        sanitized.cursor,
        preferredProposalId,
      );
      if (
        proposalIds.length !== session.proposalIds.length ||
        sanitized.cursor !== session.cursor ||
        proposalIds.some(
          (proposalId, index) => proposalId !== session.proposalIds[index],
        )
      ) {
        await existingDoc.ref.update({
          proposalIds,
          cursor: sanitized.cursor,
          updatedAt: Timestamp.now(),
        });
      }
      return {
        ...session,
        proposalIds,
        cursor: sanitized.cursor,
        id: existingDoc.id,
      };
    }
    if (session.status === "active") {
      await existingDoc.ref.update({
        status: "completed",
        updatedAt: Timestamp.now(),
      });
    }
  }

  const all = dataset.orderedIdsByIssue.get(issueType) || [];
  const answered = await answeredProposalIds(
    dataset.datasetVersion,
    issueType,
    reviewerId,
  );
  const remaining = all.filter((id) => !answered.has(id));
  const ready = remaining.filter(
    (id) =>
      proposalAvailability(dataset.recordsById.get(id), decisions) === "ready",
  );
  if (ready.length === 0) return null;

  const now = Timestamp.now();
  const session: SessionDoc = {
    datasetVersion: dataset.datasetVersion,
    issueType,
    reviewerId,
    proposalIds: prioritizeProposalAtCursor(
      mergeReadyProposalIds([], ready),
      0,
      preferredProposalId,
    ),
    cursor: 0,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  const sessionRef = db.collection(SOM_REVIEW_SESSIONS).doc();
  await sessionRef.set(session);
  return { ...session, id: sessionRef.id };
};

export interface ResponsePayload {
  schemaVersion: string;
  datasetVersion: string;
  proposalId: string;
  reviewerId: string;
  decision: "agree" | "disagree";
  disagreementReason?: string;
  suggestedCorrection?: string;
  reviewedAt: string;
  elapsedMs?: number;
}

interface StoredResponseDoc {
  datasetVersion: string;
  issueType: SomIssueType;
  proposalId: string;
  reviewerId: string;
  status: "current" | "retracted";
  response: ResponsePayload;
  revisionCount: number;
  updatedAt: Timestamp;
}

interface TrustedPropagationDoc extends TrustedPropagationPlanState {
  schemaVersion: "som-trusted-propagation-v1";
  datasetVersion: string;
  proposalId: string;
  issueType: SomIssueType;
  reviewerId: string;
  responseDocId: string;
  responseRevisionIndex: number;
  disagreementReason: string;
  suggestedCorrection: string;
  applicationMode: "separate-snapshot-bound-batch";
  ontologyMutated: false;
  revisionCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface StoredReviewerResponse extends ResponsePayload {
  fastTracked: boolean;
}

export interface ResponseWriteResult {
  fastTracked: boolean;
  propagationStatus: TrustedPropagationDirective["status"];
}

const trustedPropagationDocId = (
  datasetVersion: string,
  proposalId: string,
  reviewerId: string,
): string =>
  crypto
    .createHash("sha256")
    .update(`${datasetVersion}|${proposalId}|${reviewerId}`)
    .digest("hex");

const trustedPropagationRef = (
  datasetVersion: string,
  proposalId: string,
  reviewerId: string,
) =>
  db
    .collection(SOM_REVIEW_TRUSTED_PROPAGATIONS)
    .doc(trustedPropagationDocId(datasetVersion, proposalId, reviewerId));

const syncTrustedPropagation = ({
  transaction,
  existing,
  propagationRef,
  responseRefId,
  responseRevisionIndex,
  issueType,
  payload,
  directive,
  now,
}: {
  transaction: Transaction;
  existing: TrustedPropagationDoc | null;
  propagationRef: ReturnType<typeof trustedPropagationRef>;
  responseRefId: string;
  responseRevisionIndex: number;
  issueType: SomIssueType;
  payload: ResponsePayload;
  directive: TrustedPropagationDirective;
  now: Timestamp;
}): boolean => {
  let transition = trustedPropagationPlanTransition({
    existing,
    directive,
    decision: payload.decision,
  });
  if (
    !transition &&
    directive.status === "ready" &&
    existing?.status === "ready" &&
    (existing.responseDocId !== responseRefId ||
      existing.responseRevisionIndex !== responseRevisionIndex ||
      existing.disagreementReason !== (payload.disagreementReason || "") ||
      existing.suggestedCorrection !== (payload.suggestedCorrection || ""))
  ) {
    transition = { action: "update", status: "ready" };
  }
  if (!transition) return existing?.status === "ready";

  const revisionCount = (existing?.revisionCount || 0) + 1;
  if (transition.status === "retracted") {
    if (!existing) return false;
    const retracted: TrustedPropagationDoc = {
      ...existing,
      status: "retracted",
      revisionCount,
      updatedAt: now,
    };
    transaction.set(propagationRef, retracted);
    transaction.set(
      db.collection(SOM_REVIEW_TRUSTED_PROPAGATION_REVISIONS).doc(),
      {
        ...retracted,
        action: transition.action,
        recordedAt: now,
      },
    );
    return false;
  }

  const authorized: TrustedPropagationDoc = {
    schemaVersion: "som-trusted-propagation-v1",
    datasetVersion: payload.datasetVersion,
    proposalId: payload.proposalId,
    issueType,
    reviewerId: payload.reviewerId,
    responseDocId: responseRefId,
    responseRevisionIndex,
    decision: payload.decision,
    disagreementReason: payload.disagreementReason || "",
    suggestedCorrection: payload.suggestedCorrection || "",
    policyVersion: directive.policyVersion,
    sourceSnapshotSha256: directive.sourceSnapshotSha256,
    status: "ready",
    applicationMode: "separate-snapshot-bound-batch",
    ontologyMutated: false,
    revisionCount,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  transaction.set(propagationRef, authorized);
  transaction.set(
    db.collection(SOM_REVIEW_TRUSTED_PROPAGATION_REVISIONS).doc(),
    {
      ...authorized,
      action: transition.action,
      recordedAt: now,
    },
  );
  return true;
};

/** Common fields identifying a response revision's logical subject. */
const revisionIdentity = (payload: {
  datasetVersion: string;
  proposalId: string;
  reviewerId: string;
}) => ({
  datasetVersion: payload.datasetVersion,
  proposalId: payload.proposalId,
  reviewerId: payload.reviewerId,
});

/**
 * Persists a response idempotently and advances the session cursor.
 * - Retrying an identical payload is a no-op that still reports success.
 * - Editing an existing response appends an audited revision.
 */
export const saveResponse = async (
  sessionId: string,
  issueType: SomIssueType,
  payload: ResponsePayload,
  propagation: TrustedPropagationDirective,
): Promise<{ cursor: number; completed: boolean } & ResponseWriteResult> => {
  return db.runTransaction(async (transaction) => {
    const sessionRef = db.collection(SOM_REVIEW_SESSIONS).doc(sessionId);
    const propagationRef = trustedPropagationRef(
      payload.datasetVersion,
      payload.proposalId,
      payload.reviewerId,
    );
    const [responseSnap, sessionSnap, propagationSnap] = await Promise.all([
      transaction.get(
        currentResponseQuery(
          payload.datasetVersion,
          payload.proposalId,
          payload.reviewerId,
        ),
      ),
      transaction.get(sessionRef),
      transaction.get(propagationRef),
    ]);
    if (!sessionSnap.exists) throw new Error("Review session was not found");
    const session = sessionSnap.data() as SessionDoc;
    if (
      session.datasetVersion !== payload.datasetVersion ||
      session.issueType !== issueType ||
      session.reviewerId !== payload.reviewerId
    ) {
      throw new Error("Review session does not match this response");
    }

    const now = Timestamp.now();
    const existingDoc = responseSnap.empty ? null : responseSnap.docs[0];
    const existing = existingDoc?.data() || null;
    const identicalRetry =
      existing &&
      existing.response.decision === payload.decision &&
      (existing.response.disagreementReason || "") ===
        (payload.disagreementReason || "") &&
      (existing.response.suggestedCorrection || "") ===
        (payload.suggestedCorrection || "");
    const transition = planResponseTransition(
      session,
      payload.proposalId,
      Boolean(identicalRetry),
    );
    const responseRef = existingDoc
      ? existingDoc.ref
      : db.collection(SOM_REVIEW_RESPONSES).doc();

    if (transition.shouldPersist) {
      const revisionIndex = (existing?.revisionCount || 0) + 1;
      transaction.set(responseRef, {
        ...revisionIdentity(payload),
        issueType,
        status: "current",
        response: payload,
        revisionCount: revisionIndex,
        updatedAt: now,
      });
      transaction.set(db.collection(SOM_REVIEW_RESPONSE_REVISIONS).doc(), {
        ...revisionIdentity(payload),
        issueType,
        responseDocId: responseRef.id,
        revisionIndex,
        action: existing ? "edit" : "save",
        response: payload,
        createdAt: now,
      });
    }

    const responseRevisionIndex = transition.shouldPersist
      ? (existing?.revisionCount || 0) + 1
      : existing?.revisionCount || 1;
    const fastTracked = syncTrustedPropagation({
      transaction,
      existing: propagationSnap.exists
        ? (propagationSnap.data() as TrustedPropagationDoc)
        : null,
      propagationRef,
      responseRefId: responseRef.id,
      responseRevisionIndex,
      issueType,
      payload,
      directive: propagation,
      now,
    });

    transaction.update(sessionRef, {
      cursor: transition.cursor,
      status: transition.completed ? "completed" : "active",
      updatedAt: now,
    });
    return {
      cursor: transition.cursor,
      completed: transition.completed,
      fastTracked,
      propagationStatus: propagation.status,
    };
  });
};

/** Returns every current response for one reviewer and issue type, keyed by ID. */
export const issueResponses = async (
  datasetVersion: string,
  issueType: SomIssueType,
  reviewerId: string,
): Promise<Map<string, StoredReviewerResponse>> => {
  const snapshot = await db
    .collection(SOM_REVIEW_RESPONSES)
    .where("datasetVersion", "==", datasetVersion)
    .where("reviewerId", "==", reviewerId)
    .where("status", "==", "current")
    .get();
  const records = carryForwardResponseRecords(
    getDatasetByVersion(datasetVersion),
    snapshot.docs.map((doc) => doc.data() as StoredResponseDoc),
  )
    .filter((record) => record.issueType === issueType)
    .filter((record) => Boolean(record.response));
  const propagationSnapshots = records.length
    ? await db.getAll(
        ...records.map((record) =>
          trustedPropagationRef(
            record.datasetVersion,
            record.proposalId,
            record.reviewerId,
          ),
        ),
      )
    : [];
  return new Map(
    records.map((record, index) => [
      record.proposalId,
      {
        ...record.response,
        fastTracked:
          propagationSnapshots[index]?.exists &&
          propagationSnapshots[index]?.data()?.status === "ready",
      },
    ]),
  );
};

/**
 * Replaces any prior answer for this reviewer and issue type and appends an
 * audit revision. Revisions are intentionally independent of review sessions
 * so judgments from completed sessions remain editable.
 */
export const reviseResponse = async (
  issueType: SomIssueType,
  payload: ResponsePayload,
  propagation: TrustedPropagationDirective,
): Promise<{ changed: boolean } & ResponseWriteResult> => {
  return db.runTransaction(async (transaction) => {
    const dataset = getDatasetByVersion(payload.datasetVersion);
    const inheritedProposalIds = responseCarryForwardSources(
      dataset,
      payload.proposalId,
    );
    const propagationRef = trustedPropagationRef(
      payload.datasetVersion,
      payload.proposalId,
      payload.reviewerId,
    );
    const responseQueries = [
      currentResponseQuery(
        payload.datasetVersion,
        payload.proposalId,
        payload.reviewerId,
      ),
      ...(inheritedProposalIds.length
        ? [
            db
              .collection(SOM_REVIEW_RESPONSES)
              .where("datasetVersion", "==", payload.datasetVersion)
              .where("proposalId", "in", inheritedProposalIds)
              .where("reviewerId", "==", payload.reviewerId)
              .where("status", "==", "current")
              .limit(inheritedProposalIds.length),
          ]
        : []),
    ];
    const [responseSnapshots, propagationSnap] = await Promise.all([
      Promise.all(responseQueries.map((query) => transaction.get(query))),
      transaction.get(propagationRef),
    ]);
    const directResponseDoc = responseSnapshots[0].docs[0];
    const inheritedResponseDoc = responseSnapshots[1]?.docs[0];
    const responseDoc = directResponseDoc || inheritedResponseDoc;
    const inherited = !directResponseDoc && Boolean(inheritedResponseDoc);
    if (!responseDoc) {
      throw new Error("The prior response could not be found");
    }

    const existing = responseDoc.data() as StoredResponseDoc;
    if (!inherited && existing.issueType !== issueType) {
      throw new Error("The prior response belongs to another issue type");
    }
    const identical =
      existing.response.decision === payload.decision &&
      (existing.response.disagreementReason || "") ===
        (payload.disagreementReason || "") &&
      (existing.response.suggestedCorrection || "") ===
        (payload.suggestedCorrection || "");
    const now = Timestamp.now();
    const revisionIndex = identical
      ? existing.revisionCount || 1
      : inherited
        ? 1
        : (existing.revisionCount || 0) + 1;
    const persistedResponseRef =
      inherited && !identical
        ? db.collection(SOM_REVIEW_RESPONSES).doc()
        : responseDoc.ref;
    if (!identical) {
      if (inherited) {
        transaction.set(persistedResponseRef, {
          ...revisionIdentity(payload),
          issueType,
          status: "current",
          response: payload,
          revisionCount: revisionIndex,
          carriedForwardFromProposalId: existing.proposalId,
          updatedAt: now,
        });
      } else {
        transaction.update(persistedResponseRef, {
          response: payload,
          revisionCount: revisionIndex,
          updatedAt: now,
        });
      }
      transaction.set(db.collection(SOM_REVIEW_RESPONSE_REVISIONS).doc(), {
        ...revisionIdentity(payload),
        issueType,
        responseDocId: persistedResponseRef.id,
        revisionIndex,
        action: "edit",
        response: payload,
        ...(inherited
          ? { carriedForwardFromProposalId: existing.proposalId }
          : {}),
        createdAt: now,
      });
    }
    const fastTracked = syncTrustedPropagation({
      transaction,
      existing: propagationSnap.exists
        ? (propagationSnap.data() as TrustedPropagationDoc)
        : null,
      propagationRef,
      responseRefId: persistedResponseRef.id,
      responseRevisionIndex: revisionIndex,
      issueType,
      payload,
      directive: propagation,
      now,
    });
    return {
      changed: !identical,
      fastTracked,
      propagationStatus: propagation.status,
    };
  });
};

/**
 * Undoes the immediately previous response: retracts the current response,
 * appends an audited "undo" revision, and steps the session cursor back.
 */
export const undoPrevious = async (
  sessionId: string,
  datasetVersion: string,
  issueType: SomIssueType,
  reviewerId: string,
): Promise<{ cursor: number }> => {
  return db.runTransaction(async (transaction) => {
    const sessionRef = db.collection(SOM_REVIEW_SESSIONS).doc(sessionId);
    const sessionSnap = await transaction.get(sessionRef);
    if (!sessionSnap.exists) throw new Error("Review session was not found");
    const session = sessionSnap.data() as SessionDoc;
    if (
      session.datasetVersion !== datasetVersion ||
      session.issueType !== issueType ||
      session.reviewerId !== reviewerId
    ) {
      throw new Error("Review session does not match this reviewer");
    }
    const transition = planUndoTransition(session);

    const previousId = session.proposalIds[transition.cursor];
    const propagationRef = trustedPropagationRef(
      datasetVersion,
      previousId,
      reviewerId,
    );
    const [responseSnap, propagationSnap] = await Promise.all([
      transaction.get(
        currentResponseQuery(datasetVersion, previousId, reviewerId),
      ),
      transaction.get(propagationRef),
    ]);
    if (responseSnap.empty) throw new Error("Previous response not found");
    const responseDoc = responseSnap.docs[0];

    const now = Timestamp.now();
    const revisionIndex = (responseDoc.data().revisionCount || 0) + 1;
    transaction.update(responseDoc.ref, {
      status: "retracted",
      revisionCount: revisionIndex,
      updatedAt: now,
    });
    transaction.set(db.collection(SOM_REVIEW_RESPONSE_REVISIONS).doc(), {
      datasetVersion,
      proposalId: previousId,
      reviewerId,
      issueType,
      responseDocId: responseDoc.ref.id,
      revisionIndex,
      action: "undo",
      response: null,
      createdAt: now,
    });
    const existingPropagation = propagationSnap.exists
      ? (propagationSnap.data() as TrustedPropagationDoc)
      : null;
    if (existingPropagation?.status === "ready") {
      const propagationRevisionCount =
        (existingPropagation.revisionCount || 0) + 1;
      const retracted: TrustedPropagationDoc = {
        ...existingPropagation,
        status: "retracted",
        revisionCount: propagationRevisionCount,
        updatedAt: now,
      };
      transaction.set(propagationRef, retracted);
      transaction.set(
        db.collection(SOM_REVIEW_TRUSTED_PROPAGATION_REVISIONS).doc(),
        {
          ...retracted,
          action: "retract",
          recordedAt: now,
        },
      );
    }
    transaction.update(sessionRef, {
      cursor: transition.cursor,
      status: transition.status,
      updatedAt: now,
    });
    return { cursor: transition.cursor };
  });
};
