import crypto from "crypto";
import { Timestamp } from "firebase-admin/firestore";

import { db } from "../firestoreServer/admin";
import {
  SOM_REVIEW_INSPECTION_EXCEPTIONS,
  SOM_REVIEW_INSPECTION_EXCEPTION_REVISIONS,
  SOM_REVIEW_RESPONSES,
} from "../firestoreClient/collections";
import {
  SomInspectionException,
  SomInspectionItem,
  SomInspectionOverviewResponse,
  SomInspectionReviewer,
  SomReviewDecision,
} from "../../types/ISomReview";
import { getDataset, getDatasetByVersion, SomDataset } from "./dataset";
import { loadUserProfiles } from "./deliberationStore";
import { applicableReviewResponses } from "./reviewWorkflow";
import { reviewDatasetConfig, reviewWorkspaceConfig } from "./reviewWorkspaces";
import { toReviewerCard } from "./sanitize";
import {
  inspectableReviewerCounts,
  inspectionIssueLabel,
  inspectionRecordSource,
  selectInspectionReviewer,
  inspectionIssueTypeFromTaskKey,
  inspectionTasks,
} from "./inspectionPolicy";

interface StoredResponseRecord {
  datasetVersion: string;
  issueType: string;
  proposalId: string;
  reviewerId: string;
  status: "current" | "retracted";
  response: {
    decision: SomReviewDecision;
    disagreementReason?: string;
    suggestedCorrection?: string;
    reviewedAt?: string;
  };
  updatedAt?: unknown;
}

interface StoredExceptionRecord {
  workspaceId: string;
  datasetVersion: string;
  proposalId: string;
  subjectReviewerId: string;
  inspectorId: string;
  status: "active" | "cleared";
  rationale: string;
  suggestedAlternative: string;
  revisionCount: number;
  updatedAt?: unknown;
}

export class InspectionStoreError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const stableDocId = (...parts: string[]): string =>
  crypto.createHash("sha256").update(parts.join("|")).digest("hex");

const toIso = (value: any, fallback = ""): string => {
  if (value?.toDate) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return fallback;
};

export const inspectionTargetForWorkspace = (workspaceId: string) => {
  const workspace = reviewWorkspaceConfig(workspaceId);
  const dataset = getDataset(workspace.activeDatasetId);
  return {
    workspace,
    dataset,
    datasetVersion: dataset.datasetVersion,
    sourceSnapshotSha256: dataset.manifest.sourceSnapshot.sha256,
  };
};

const exceptionRef = (
  workspaceId: string,
  datasetVersion: string,
  proposalId: string,
  subjectReviewerId: string,
  inspectorId: string,
) =>
  db
    .collection(SOM_REVIEW_INSPECTION_EXCEPTIONS)
    .doc(
      stableDocId(
        workspaceId,
        datasetVersion,
        proposalId,
        subjectReviewerId,
        inspectorId,
      ),
    );

const currentResponsesForDataset = async (
  datasetVersion: string,
  reviewerId?: string,
): Promise<StoredResponseRecord[]> => {
  let query: any = db
    .collection(SOM_REVIEW_RESPONSES)
    .where("datasetVersion", "==", datasetVersion)
    .where("status", "==", "current");
  if (reviewerId) {
    query = query.where("reviewerId", "==", reviewerId);
  }
  const snapshot = await query.get();
  return snapshot.docs
    .map((doc: any) => doc.data() as StoredResponseRecord)
    .filter((record: StoredResponseRecord) => Boolean(record.response));
};

const availableReviewers = async (
  workspaceId: string,
): Promise<SomInspectionReviewer[]> => {
  const workspace = reviewWorkspaceConfig(workspaceId);
  const rounds = await Promise.all(
    workspace.datasets.map(async (config) => ({
      proposalIds: new Set(getDataset(config.id).recordsById.keys()),
      responses: await currentResponsesForDataset(config.datasetVersion),
    })),
  );
  const counts = inspectableReviewerCounts(rounds);
  const profiles = await loadUserProfiles([...counts.keys()]);
  return [...counts.entries()]
    .map(([reviewerId, responseCount]) => ({
      reviewerId,
      displayName: profiles.get(reviewerId)?.displayName || "Ontology reviewer",
      responseCount,
    }))
    .sort(
      (left, right) =>
        right.responseCount - left.responseCount ||
        left.displayName.localeCompare(right.displayName, "en"),
    );
};

const loadExceptionDocuments = async (
  refs: FirebaseFirestore.DocumentReference[],
): Promise<Map<string, StoredExceptionRecord>> => {
  const result = new Map<string, StoredExceptionRecord>();
  for (let index = 0; index < refs.length; index += 100) {
    const snapshots = await db.getAll(...refs.slice(index, index + 100));
    for (const snapshot of snapshots) {
      if (snapshot.exists) {
        result.set(snapshot.id, snapshot.data() as StoredExceptionRecord);
      }
    }
  }
  return result;
};

const orderedItemsForDataset = (
  dataset: SomDataset,
  datasetLabel: string,
  currentRound: boolean,
  responses: StoredResponseRecord[],
): Omit<SomInspectionItem, "exception">[] => {
  const responseByProposalId = new Map(
    responses.map((response) => [response.proposalId, response]),
  );
  const applicable = new Set(
    applicableReviewResponses(dataset, responses).map(
      (response) => response.proposalId,
    ),
  );
  const items: Omit<SomInspectionItem, "exception">[] = [];
  for (const [issueType, proposalIds] of dataset.orderedIdsByIssue.entries()) {
    for (
      let proposalIndex = 0;
      proposalIndex < proposalIds.length;
      proposalIndex += 1
    ) {
      const proposalId = proposalIds[proposalIndex];
      const response = responseByProposalId.get(proposalId);
      const record = dataset.recordsById.get(proposalId);
      if (!response || !record) continue;
      items.push({
        datasetId: dataset.datasetId,
        datasetLabel,
        currentRound,
        issueLabel: inspectionIssueLabel(issueType),
        proposalIndex,
        recordSource: inspectionRecordSource(record),
        currentlyApplicable: applicable.has(proposalId),
        card: { ...toReviewerCard(record), proposalIndex },
        subjectResponse: {
          decision: response.response.decision,
          disagreementReason: response.response.disagreementReason || "",
          suggestedCorrection: response.response.suggestedCorrection || "",
          reviewedAt: response.response.reviewedAt || toIso(response.updatedAt),
        },
      });
    }
  }
  return items;
};

const reviewItems = async ({
  workspaceId,
  subjectReviewerId,
  inspectorId,
}: {
  workspaceId: string;
  subjectReviewerId: string;
  inspectorId: string;
}): Promise<SomInspectionItem[]> => {
  const workspace = reviewWorkspaceConfig(workspaceId);
  const rounds = [...workspace.datasets].reverse();
  const roundItems = await Promise.all(
    rounds.map(async (config) => {
      const dataset = getDataset(config.id);
      const responses = await currentResponsesForDataset(
        config.datasetVersion,
        subjectReviewerId,
      );
      return orderedItemsForDataset(
        dataset,
        config.label,
        config.current,
        responses,
      );
    }),
  );
  const items = roundItems.flat();
  const refs = items.map((item) =>
    exceptionRef(
      workspaceId,
      item.card.datasetVersion,
      item.card.proposalId,
      subjectReviewerId,
      inspectorId,
    ),
  );
  const exceptionDocuments = await loadExceptionDocuments(refs);
  return items.map((item, index) => {
    const exception = exceptionDocuments.get(refs[index].id);
    if (!exception || exception.status !== "active") return item;
    return {
      ...item,
      exception: {
        datasetVersion: exception.datasetVersion,
        proposalId: exception.proposalId,
        subjectReviewerId: exception.subjectReviewerId,
        inspectorId: exception.inspectorId,
        rationale: exception.rationale,
        suggestedAlternative: exception.suggestedAlternative || "",
        updatedAt: toIso(exception.updatedAt),
      },
    };
  });
};

export const loadInspectionOverview = async ({
  workspaceId,
  inspectorId,
  requestedReviewerId,
  requestedTaskKey,
}: {
  workspaceId: string;
  inspectorId: string;
  requestedReviewerId?: string;
  requestedTaskKey?: string;
}): Promise<SomInspectionOverviewResponse> => {
  const { workspace } = inspectionTargetForWorkspace(workspaceId);
  const reviewers = await availableReviewers(workspaceId);
  const selectedReviewerId = selectInspectionReviewer(
    reviewers,
    requestedReviewerId,
    inspectorId,
  );
  const allItems = selectedReviewerId
    ? await reviewItems({
        workspaceId,
        subjectReviewerId: selectedReviewerId,
        inspectorId,
      })
    : [];
  const tasks = inspectionTasks(allItems);
  const requestedIssueType = inspectionIssueTypeFromTaskKey(requestedTaskKey);
  const selectedTask = tasks.find(
    (task) => task.issueType === requestedIssueType,
  );
  const selectedTaskKey = selectedTask?.key;
  const items = selectedTask
    ? allItems.filter((item) => item.card.issueType === selectedTask.issueType)
    : [];

  return {
    workspaceId,
    workspaceLabel: workspace.label,
    activeDatasetId: workspace.activeDatasetId,
    reviewers,
    selectedReviewerId,
    tasks,
    selectedTaskKey,
    items,
  };
};

const assertInspectableResponse = async ({
  workspaceId,
  datasetVersion,
  proposalId,
  subjectReviewerId,
  inspectorId,
}: {
  workspaceId: string;
  datasetVersion: string;
  proposalId: string;
  subjectReviewerId: string;
  inspectorId: string;
}) => {
  if (subjectReviewerId === inspectorId) {
    throw new InspectionStoreError(
      400,
      "A reviewer cannot annotate their own prior response",
    );
  }
  inspectionTargetForWorkspace(workspaceId);
  const dataset = getDatasetByVersion(datasetVersion);
  if (reviewDatasetConfig(dataset.datasetId).workspaceId !== workspaceId) {
    throw new InspectionStoreError(
      400,
      "The proposal does not belong to this workspace",
    );
  }
  if (!dataset.recordsById.has(proposalId)) {
    throw new InspectionStoreError(400, "Unknown proposal");
  }
  const responseSnapshot = await db
    .collection(SOM_REVIEW_RESPONSES)
    .where("datasetVersion", "==", datasetVersion)
    .where("proposalId", "==", proposalId)
    .where("reviewerId", "==", subjectReviewerId)
    .where("status", "==", "current")
    .limit(1)
    .get();
  if (responseSnapshot.empty) {
    throw new InspectionStoreError(
      409,
      "The prior reviewer response is no longer available",
    );
  }
};

export const saveInspectionException = async ({
  workspaceId,
  datasetVersion,
  proposalId,
  subjectReviewerId,
  inspectorId,
  rationale,
  suggestedAlternative,
  clear = false,
}: {
  workspaceId: string;
  datasetVersion: string;
  proposalId: string;
  subjectReviewerId: string;
  inspectorId: string;
  rationale: string;
  suggestedAlternative: string;
  clear?: boolean;
}): Promise<{ changed: boolean }> => {
  await assertInspectableResponse({
    workspaceId,
    datasetVersion,
    proposalId,
    subjectReviewerId,
    inspectorId,
  });
  const ref = exceptionRef(
    workspaceId,
    datasetVersion,
    proposalId,
    subjectReviewerId,
    inspectorId,
  );
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const previous = snapshot.exists
      ? (snapshot.data() as StoredExceptionRecord)
      : null;
    const status = clear ? "cleared" : "active";
    const nextRationale = clear ? "" : rationale;
    const nextAlternative = clear ? "" : suggestedAlternative;
    const identical =
      previous?.status === status &&
      previous.rationale === nextRationale &&
      previous.suggestedAlternative === nextAlternative;
    if (identical) return { changed: false };

    const now = Timestamp.now();
    const revisionCount = (previous?.revisionCount || 0) + 1;
    const record = {
      workspaceId,
      datasetVersion,
      proposalId,
      subjectReviewerId,
      inspectorId,
      status,
      rationale: nextRationale,
      suggestedAlternative: nextAlternative,
      revisionCount,
      createdAt: previous ? (previous as any).createdAt || now : now,
      updatedAt: now,
    };
    transaction.set(ref, record);
    transaction.set(
      db.collection(SOM_REVIEW_INSPECTION_EXCEPTION_REVISIONS).doc(),
      {
        ...record,
        action: clear ? "clear" : previous ? "edit" : "save",
        createdAt: now,
      },
    );
    return { changed: true };
  });
};
