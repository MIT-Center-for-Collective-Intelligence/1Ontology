import crypto from "crypto";
import { Timestamp } from "firebase-admin/firestore";

import { db } from "../firestoreServer/admin";
import {
  SOM_REVIEW_CALIBRATION_ASSIGNMENTS,
  SOM_REVIEW_CALIBRATION_RESPONSES,
  SOM_REVIEW_CALIBRATION_RESPONSE_REVISIONS,
} from "../firestoreClient/collections";
import {
  SomCalibrationAssignment,
  SomCalibrationAssignmentOption,
  SomCalibrationOverviewResponse,
  SomCalibrationRespondResult,
  SomReviewHistoryItem,
} from "../../types/ISomReview";
import {
  calibrationAssignmentConfig,
  releasedCalibrationAssignments,
  SomCalibrationAssignmentConfig,
} from "./calibrationAssignments";
import { getDataset } from "./dataset";
import { toReviewerCard } from "./sanitize";
import { ResponsePayload } from "./store";

interface CalibrationProgressRecord {
  assignmentId: string;
  reviewerId: string;
  datasetVersion: string;
  issueType: string;
  consensusSnapshotId: string;
  proposalIds: string[];
  cursor: number;
  status: "active" | "completed";
  createdAt?: unknown;
  updatedAt?: unknown;
  completedAt?: unknown;
}

interface CalibrationResponseRecord {
  assignmentId: string;
  consensusSnapshotId: string;
  datasetVersion: string;
  issueType: string;
  proposalId: string;
  reviewerId: string;
  status: "current";
  response: ResponsePayload;
  revisionCount: number;
  updatedAt?: unknown;
}

export class CalibrationStoreError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const stableDocId = (...parts: string[]): string =>
  crypto.createHash("sha256").update(parts.join("|")).digest("hex");

const progressRef = (assignmentId: string, reviewerId: string) =>
  db
    .collection(SOM_REVIEW_CALIBRATION_ASSIGNMENTS)
    .doc(stableDocId(assignmentId, reviewerId));

const responseRef = (
  assignmentId: string,
  proposalId: string,
  reviewerId: string,
) =>
  db
    .collection(SOM_REVIEW_CALIBRATION_RESPONSES)
    .doc(stableDocId(assignmentId, proposalId, reviewerId));

const assignmentProposalIds = (
  config: SomCalibrationAssignmentConfig,
): string[] => {
  const dataset = getDataset(config.datasetId);
  if (dataset.datasetVersion !== config.datasetVersion) {
    throw new Error(
      `Calibration assignment ${config.id} is not bound to its configured dataset`,
    );
  }
  return [...(dataset.orderedIdsByIssue.get(config.issueType) || [])];
};

const loadProgress = async (
  config: SomCalibrationAssignmentConfig,
  reviewerId: string,
): Promise<CalibrationProgressRecord | null> => {
  const snapshot = await progressRef(config.id, reviewerId).get();
  if (!snapshot.exists) return null;
  const progress = snapshot.data() as CalibrationProgressRecord;
  if (
    progress.datasetVersion !== config.datasetVersion ||
    progress.consensusSnapshotId !== config.consensusSnapshotId
  ) {
    throw new CalibrationStoreError(
      409,
      "This assignment was updated after the current review began",
    );
  }
  return progress;
};

const loadResponses = async (
  config: SomCalibrationAssignmentConfig,
  proposalIds: string[],
  reviewerId: string,
): Promise<Map<string, CalibrationResponseRecord>> => {
  const result = new Map<string, CalibrationResponseRecord>();
  for (let index = 0; index < proposalIds.length; index += 100) {
    const refs = proposalIds
      .slice(index, index + 100)
      .map((proposalId) => responseRef(config.id, proposalId, reviewerId));
    const snapshots = await db.getAll(...refs);
    for (const snapshot of snapshots) {
      if (!snapshot.exists) continue;
      const response = snapshot.data() as CalibrationResponseRecord;
      if (
        response.status === "current" &&
        response.consensusSnapshotId === config.consensusSnapshotId
      ) {
        result.set(response.proposalId, response);
      }
    }
  }
  return result;
};

const historyItem = (
  proposalId: string,
  proposalIndex: number,
  record: CalibrationResponseRecord,
  config: SomCalibrationAssignmentConfig,
): SomReviewHistoryItem => {
  const dataset = getDataset(config.datasetId);
  const proposal = dataset.recordsById.get(proposalId);
  if (!proposal) {
    throw new Error(`Calibration response references unknown ${proposalId}`);
  }
  const card = toReviewerCard(proposal);
  return {
    proposalId,
    proposalIndex,
    question: card.reviewerView.question,
    decision: record.response.decision,
    disagreementReason: record.response.disagreementReason || "",
    suggestedCorrection: record.response.suggestedCorrection || "",
    reviewedAt: record.response.reviewedAt,
  };
};

const toAssignment = async (
  config: SomCalibrationAssignmentConfig,
  reviewerId: string,
): Promise<SomCalibrationAssignment> => {
  const dataset = getDataset(config.datasetId);
  const proposalIds = assignmentProposalIds(config);
  const progress = await loadProgress(config, reviewerId);
  const cursor = Math.min(progress?.cursor || 0, proposalIds.length);
  const responses = await loadResponses(config, proposalIds, reviewerId);
  const currentProposalId = proposalIds[cursor];
  const currentRecord = currentProposalId
    ? dataset.recordsById.get(currentProposalId)
    : undefined;
  return {
    id: config.id,
    title: config.title,
    branch: config.branch,
    taskLabel: config.taskLabel,
    introduction: config.introduction,
    datasetId: config.datasetId,
    datasetVersion: config.datasetVersion,
    issueType: config.issueType,
    consensusSnapshotId: config.consensusSnapshotId,
    releasedAt: config.releasedAt,
    cards: currentRecord
      ? [{ ...toReviewerCard(currentRecord), proposalIndex: cursor }]
      : [],
    cursor,
    total: proposalIds.length,
    responses: proposalIds.flatMap((proposalId, proposalIndex) => {
      const response = responses.get(proposalId);
      return response
        ? [historyItem(proposalId, proposalIndex, response, config)]
        : [];
    }),
  };
};

export const loadCalibrationOverview = async (
  reviewerId: string,
): Promise<SomCalibrationOverviewResponse> => {
  const released = releasedCalibrationAssignments();
  const progresses = await Promise.all(
    released.map((config) => loadProgress(config, reviewerId)),
  );
  const activeIndex = progresses.findIndex(
    (progress) => progress?.status !== "completed",
  );
  const selectedIndex =
    activeIndex >= 0 ? activeIndex : Math.max(0, released.length - 1);
  const selected = released[selectedIndex];
  const assignments: SomCalibrationAssignmentOption[] = released.map(
    (config, index) => ({
      id: config.id,
      title: config.title,
      branch: config.branch,
      taskLabel: config.taskLabel,
      status:
        progresses[index]?.status === "completed" ? "completed" : "available",
    }),
  );
  return {
    assignments,
    active: selected ? await toAssignment(selected, reviewerId) : undefined,
  };
};

export const saveCalibrationResponse = async ({
  assignmentId,
  reviewerId,
  payload,
}: {
  assignmentId: string;
  reviewerId: string;
  payload: ResponsePayload;
}): Promise<SomCalibrationRespondResult> => {
  const config = calibrationAssignmentConfig(assignmentId);
  if (payload.reviewerId !== reviewerId) {
    throw new CalibrationStoreError(
      403,
      "A calibration response can only be saved for the signed-in reviewer",
    );
  }
  if (payload.datasetVersion !== config.datasetVersion) {
    throw new CalibrationStoreError(
      400,
      "The response belongs to another dataset",
    );
  }
  const proposalIds = assignmentProposalIds(config);
  const progressDocument = progressRef(config.id, reviewerId);
  const responseDocument = responseRef(
    config.id,
    payload.proposalId,
    reviewerId,
  );
  return db.runTransaction(async (transaction) => {
    const [progressSnapshot, responseSnapshot] = await Promise.all([
      transaction.get(progressDocument),
      transaction.get(responseDocument),
    ]);
    const progress = progressSnapshot.exists
      ? (progressSnapshot.data() as CalibrationProgressRecord)
      : null;
    if (
      progress &&
      (progress.datasetVersion !== config.datasetVersion ||
        progress.consensusSnapshotId !== config.consensusSnapshotId)
    ) {
      throw new CalibrationStoreError(
        409,
        "This assignment changed after the current review began",
      );
    }
    const cursor = progress?.cursor || 0;
    const existing = responseSnapshot.exists
      ? (responseSnapshot.data() as CalibrationResponseRecord)
      : null;
    const identicalRetry =
      existing?.response.decision === payload.decision &&
      (existing?.response.disagreementReason || "") ===
        (payload.disagreementReason || "") &&
      (existing?.response.suggestedCorrection || "") ===
        (payload.suggestedCorrection || "");
    if (proposalIds[cursor] !== payload.proposalId) {
      if (identicalRetry && proposalIds.indexOf(payload.proposalId) < cursor) {
        return {
          ok: true,
          cursor,
          completed: cursor >= proposalIds.length,
        };
      }
      throw new CalibrationStoreError(
        409,
        "This item is no longer the active calibration question",
      );
    }

    const now = Timestamp.now();
    const nextCursor = cursor + 1;
    const completed = nextCursor >= proposalIds.length;
    if (!identicalRetry) {
      const revisionCount = (existing?.revisionCount || 0) + 1;
      const record = {
        assignmentId: config.id,
        consensusSnapshotId: config.consensusSnapshotId,
        propagationPolicy: config.propagationPolicy,
        datasetVersion: config.datasetVersion,
        issueType: config.issueType,
        proposalId: payload.proposalId,
        reviewerId,
        status: "current",
        response: payload,
        revisionCount,
        createdAt: existing ? (existing as any).createdAt || now : now,
        updatedAt: now,
      };
      transaction.set(responseDocument, record);
      transaction.set(
        db.collection(SOM_REVIEW_CALIBRATION_RESPONSE_REVISIONS).doc(),
        {
          ...record,
          action: existing ? "edit" : "save",
          createdAt: now,
        },
      );
    }
    transaction.set(
      progressDocument,
      {
        assignmentId: config.id,
        reviewerId,
        datasetVersion: config.datasetVersion,
        issueType: config.issueType,
        consensusSnapshotId: config.consensusSnapshotId,
        propagationPolicy: config.propagationPolicy,
        proposalIds,
        cursor: nextCursor,
        status: completed ? "completed" : "active",
        createdAt: progress ? progress.createdAt || now : now,
        updatedAt: now,
        ...(completed ? { completedAt: now } : {}),
      },
      { merge: true },
    );
    return { ok: true, cursor: nextCursor, completed };
  });
};
