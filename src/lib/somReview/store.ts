import { Query, Timestamp } from "firebase-admin/firestore";

import { db } from "../firestoreServer/admin";
import {
  SOM_REVIEW_RESPONSES,
  SOM_REVIEW_RESPONSE_REVISIONS,
  SOM_REVIEW_SESSIONS,
} from "../firestoreClient/collections";
import { SomIssueType } from "../../types/ISomReview";
import { SomDataset, proposalAvailability } from "./dataset";
import {
  isResumableSession,
  mergeReadyProposalIds,
  planResponseTransition,
  planUndoTransition,
  reviewedProposalIndex,
} from "./sessionState";

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
    .where("issueType", "==", issueType)
    .where("reviewerId", "==", reviewerId)
    .where("status", "==", "current")
    .get();
  return new Set(snapshot.docs.map((doc) => doc.data().proposalId));
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
  return new Map(
    snapshot.docs.map((doc) => {
      const data = doc.data() as StoredResponseDoc;
      return [data.proposalId, data.response.decision];
    }),
  );
};

export interface PendingSummary {
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
    pending: 0,
    waiting: 0,
    notApplicable: 0,
  };
  for (const id of all) {
    if (answered.has(id)) continue;
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
    const remainingReady = session.proposalIds
      .slice(session.cursor)
      .every(
        (proposalId) =>
          proposalAvailability(
            dataset.recordsById.get(proposalId),
            decisions,
          ) === "ready",
      );
    if (isResumableSession(session) && remainingReady) {
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
      const proposalIds = mergeReadyProposalIds(session.proposalIds, ready);
      if (proposalIds.length !== session.proposalIds.length) {
        await existingDoc.ref.update({
          proposalIds,
          updatedAt: Timestamp.now(),
        });
      }
      return { ...session, proposalIds, id: existingDoc.id };
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
    proposalIds: mergeReadyProposalIds([], ready),
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
): Promise<{ cursor: number; completed: boolean }> => {
  return db.runTransaction(async (transaction) => {
    const sessionRef = db.collection(SOM_REVIEW_SESSIONS).doc(sessionId);
    const [responseSnap, sessionSnap] = await Promise.all([
      transaction.get(
        currentResponseQuery(
          payload.datasetVersion,
          payload.proposalId,
          payload.reviewerId,
        ),
      ),
      transaction.get(sessionRef),
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

    if (transition.shouldPersist) {
      const responseRef = existingDoc
        ? existingDoc.ref
        : db.collection(SOM_REVIEW_RESPONSES).doc();
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

    transaction.update(sessionRef, {
      cursor: transition.cursor,
      status: transition.completed ? "completed" : "active",
      updatedAt: now,
    });
    return {
      cursor: transition.cursor,
      completed: transition.completed,
    };
  });
};

/** Returns current responses for proposals in this session, keyed by ID. */
export const sessionResponses = async (
  session: StoredSession,
): Promise<Map<string, ResponsePayload>> => {
  const proposalIds = new Set(session.proposalIds);
  const snapshot = await db
    .collection(SOM_REVIEW_RESPONSES)
    .where("datasetVersion", "==", session.datasetVersion)
    .where("issueType", "==", session.issueType)
    .where("reviewerId", "==", session.reviewerId)
    .where("status", "==", "current")
    .get();
  return new Map(
    snapshot.docs
      .map((doc) => doc.data() as StoredResponseDoc)
      .filter(
        (record) =>
          proposalIds.has(record.proposalId) && Boolean(record.response),
      )
      .map((record) => [record.proposalId, record.response]),
  );
};

/**
 * Replaces one prior answer in place, appends an audit revision, and leaves
 * the reviewer's current queue position unchanged.
 */
export const reviseResponse = async (
  sessionId: string,
  issueType: SomIssueType,
  payload: ResponsePayload,
): Promise<{ changed: boolean }> => {
  return db.runTransaction(async (transaction) => {
    const sessionRef = db.collection(SOM_REVIEW_SESSIONS).doc(sessionId);
    const [responseSnap, sessionSnap] = await Promise.all([
      transaction.get(
        currentResponseQuery(
          payload.datasetVersion,
          payload.proposalId,
          payload.reviewerId,
        ),
      ),
      transaction.get(sessionRef),
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
    reviewedProposalIndex(session, payload.proposalId);
    if (responseSnap.empty) {
      throw new Error("The prior response could not be found");
    }

    const responseDoc = responseSnap.docs[0];
    const existing = responseDoc.data() as StoredResponseDoc;
    const identical =
      existing.response.decision === payload.decision &&
      (existing.response.disagreementReason || "") ===
        (payload.disagreementReason || "") &&
      (existing.response.suggestedCorrection || "") ===
        (payload.suggestedCorrection || "");
    if (identical) return { changed: false };

    const now = Timestamp.now();
    const revisionIndex = (existing.revisionCount || 0) + 1;
    transaction.update(responseDoc.ref, {
      response: payload,
      revisionCount: revisionIndex,
      updatedAt: now,
    });
    transaction.set(db.collection(SOM_REVIEW_RESPONSE_REVISIONS).doc(), {
      ...revisionIdentity(payload),
      issueType,
      responseDocId: responseDoc.id,
      revisionIndex,
      action: "edit",
      response: payload,
      createdAt: now,
    });
    transaction.update(sessionRef, { updatedAt: now });
    return { changed: true };
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
    const responseSnap = await transaction.get(
      currentResponseQuery(datasetVersion, previousId, reviewerId),
    );
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
    transaction.update(sessionRef, {
      cursor: transition.cursor,
      status: transition.status,
      updatedAt: now,
    });
    return { cursor: transition.cursor };
  });
};
