import { NextApiRequest, NextApiResponse } from "next";

import fbAuth, { CustomNextApiRequest } from "../../../middlewares/fbAuth";
import { getDataset, isIssueTypeEnabled } from "../../../lib/somReview/dataset";
import {
  getOrCreateSession,
  issueResponses,
} from "../../../lib/somReview/store";
import { toReviewerCard } from "../../../lib/somReview/sanitize";
import { reviewRequestData } from "../../../lib/somReview/request";
import { orderedReviewEntries } from "../../../lib/somReview/reviewHistory";
import { SomIssueType, SomSessionResponse } from "../../../types/ISomReview";

const handler = async (request: NextApiRequest, res: NextApiResponse) => {
  const req = request as CustomNextApiRequest;
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  try {
    const data = reviewRequestData(req.body);
    const issueType = data.issueType as SomIssueType;
    const preferredProposalId =
      typeof data.preferredProposalId === "string"
        ? data.preferredProposalId
        : undefined;
    const dataset = getDataset();
    if (!dataset.orderedIdsByIssue.has(issueType)) {
      return res.status(400).json({ error: "Unknown issue type" });
    }
    if (!isIssueTypeEnabled(issueType)) {
      return res
        .status(403)
        .json({ error: "This issue type is not enabled yet" });
    }
    if (preferredProposalId) {
      const preferredRecord = dataset.recordsById.get(preferredProposalId);
      if (
        !preferredRecord ||
        preferredRecord.issueType !== issueType ||
        !preferredRecord.workflow.dependsOnProposalIds.length
      ) {
        return res.status(400).json({
          error: "The requested linked follow-up is invalid",
        });
      }
    }

    const session = await getOrCreateSession(
      dataset,
      issueType,
      req.user.uid,
      preferredProposalId,
    );
    if (
      preferredProposalId &&
      (!session || session.proposalIds[session.cursor] !== preferredProposalId)
    ) {
      return res.status(409).json({
        error: "This related follow-up is no longer available for review",
      });
    }
    const orderedProposalIds = dataset.orderedIdsByIssue.get(issueType) || [];
    const proposalIndexes = new Map(
      orderedProposalIds.map((proposalId, index) => [proposalId, index]),
    );
    const responses = await issueResponses(
      dataset.datasetVersion,
      issueType,
      req.user.uid,
    );
    const history = orderedReviewEntries(orderedProposalIds, responses).flatMap(
      ({ proposalId, proposalIndex, response }) => {
        const record = dataset.recordsById.get(proposalId);
        if (!record) return [];
        const card = toReviewerCard(record);
        return [
          {
            proposalId,
            proposalIndex,
            question: card.reviewerView.question,
            decision: response.decision,
            disagreementReason: response.disagreementReason || "",
            suggestedCorrection: response.suggestedCorrection || "",
            reviewedAt: response.reviewedAt,
          },
        ];
      },
    );
    const historyCards = history.map((item) => {
      const record = dataset.recordsById.get(item.proposalId);
      if (!record) {
        throw new Error(
          `History references unknown proposal ${item.proposalId}`,
        );
      }
      return {
        ...toReviewerCard(record),
        proposalIndex: item.proposalIndex,
      };
    });

    if (!session) {
      const body: SomSessionResponse = { done: true, history, historyCards };
      return res.status(200).json(body);
    }

    const cards = session.proposalIds.map((id) => {
      const record = dataset.recordsById.get(id);
      if (!record) {
        throw new Error(`Session references unknown proposal ${id}`);
      }
      return {
        ...toReviewerCard(record),
        proposalIndex: proposalIndexes.get(id),
      };
    });
    const body: SomSessionResponse = {
      session: {
        id: session.id,
        issueType,
        datasetVersion: dataset.datasetVersion,
        cursor: session.cursor,
        total: session.proposalIds.length,
      },
      cards,
      history,
      historyCards,
      ...(preferredProposalId
        ? { focusedProposalId: preferredProposalId }
        : {}),
    };
    return res.status(200).json(body);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};

export default fbAuth(handler);
