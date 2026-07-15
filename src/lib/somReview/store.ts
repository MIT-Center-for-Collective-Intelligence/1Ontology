import { Query, Timestamp } from "firebase-admin/firestore";

import { db } from "../firestoreServer/admin";
import {
  SOM_REVIEW_RESPONSES,
  SOM_REVIEW_RESPONSE_REVISIONS,
  SOM_REVIEW_SESSIONS,
} from "../firestoreClient/collections";
import { SomIssueType } from "../../types/ISomReview";
import { DEFAULT_SESSION_SIZE, MAX_SESSION_SIZE, SomDataset } from "./dataset";

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

export const pendingCount = async (
  dataset: SomDataset,
  issueType: SomIssueType,
  reviewerId: string,
): Promise<number> => {
  const all = dataset.orderedIdsByIssue.get(issueType) || [];
  const answered = await answeredProposalIds(
    dataset.datasetVersion,
    issueType,
    reviewerId,
  );
  return all.filter((id) => !answered.has(id)).length;
};

/**
 * Returns the reviewer's unfinished session for this issue type, or builds a
 * new one of up to DEFAULT_SESSION_SIZE unanswered records (hard cap 15,
 * single issue type, deterministic order from the dataset). Completed
 * sessions are kept as history; only "active" sessions are resumed.
 */
export const getOrCreateSession = async (
  dataset: SomDataset,
  issueType: SomIssueType,
  reviewerId: string,
): Promise<SessionDoc | null> => {
  const existing = await activeSessionQuery(
    dataset.datasetVersion,
    issueType,
    reviewerId,
  ).get();
  if (!existing.empty) {
    const session = existing.docs[0].data() as SessionDoc;
    if (session.cursor < session.proposalIds.length) return session;
  }

  const all = dataset.orderedIdsByIssue.get(issueType) || [];
  const answered = await answeredProposalIds(
    dataset.datasetVersion,
    issueType,
    reviewerId,
  );
  const remaining = all.filter((id) => !answered.has(id));
  if (remaining.length === 0) return null;

  const size = Math.min(
    DEFAULT_SESSION_SIZE,
    MAX_SESSION_SIZE,
    remaining.length,
  );
  const now = Timestamp.now();
  const session: SessionDoc = {
    datasetVersion: dataset.datasetVersion,
    issueType,
    reviewerId,
    proposalIds: remaining.slice(0, size),
    cursor: 0,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(SOM_REVIEW_SESSIONS).add(session);
  return session;
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
  issueType: SomIssueType,
  payload: ResponsePayload,
): Promise<{ cursor: number; completed: boolean }> => {
  return db.runTransaction(async (transaction) => {
    const [responseSnap, sessionSnap] = await Promise.all([
      transaction.get(
        currentResponseQuery(
          payload.datasetVersion,
          payload.proposalId,
          payload.reviewerId,
        ),
      ),
      transaction.get(
        activeSessionQuery(
          payload.datasetVersion,
          issueType,
          payload.reviewerId,
        ),
      ),
    ]);
    if (sessionSnap.empty)
      throw new Error("No active session for this issue type");
    const sessionRef = sessionSnap.docs[0].ref;
    const session = sessionSnap.docs[0].data() as SessionDoc;
    if (!session.proposalIds.includes(payload.proposalId)) {
      throw new Error("Proposal is not part of the current session");
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

    if (!identicalRetry) {
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

    let cursor = session.cursor;
    if (session.proposalIds[cursor] === payload.proposalId) cursor += 1;
    const completed = cursor >= session.proposalIds.length;
    transaction.update(sessionRef, {
      cursor,
      status: completed ? "completed" : "active",
      updatedAt: now,
    });
    return { cursor, completed };
  });
};

/**
 * Undoes the immediately previous response: retracts the current response,
 * appends an audited "undo" revision, and steps the session cursor back.
 */
export const undoPrevious = async (
  datasetVersion: string,
  issueType: SomIssueType,
  reviewerId: string,
): Promise<{ cursor: number }> => {
  return db.runTransaction(async (transaction) => {
    const sessionSnap = await transaction.get(
      activeSessionQuery(datasetVersion, issueType, reviewerId),
    );
    if (sessionSnap.empty) throw new Error("No session to undo in");
    const sessionRef = sessionSnap.docs[0].ref;
    const session = sessionSnap.docs[0].data() as SessionDoc;
    if (session.cursor === 0) throw new Error("Nothing to undo");

    const previousId = session.proposalIds[session.cursor - 1];
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
      cursor: session.cursor - 1,
      updatedAt: now,
    });
    return { cursor: session.cursor - 1 };
  });
};
