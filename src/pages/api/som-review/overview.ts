import { NextApiRequest, NextApiResponse } from "next";

import fbAuth, { CustomNextApiRequest } from "../../../middlewares/fbAuth";
import { getDataset, isIssueTypeEnabled } from "../../../lib/somReview/dataset";
import {
  activeSessionProgress,
  pendingSummary,
  reviewerReadyDependentRecords,
} from "../../../lib/somReview/store";
import { SomIssueType, SomOverviewResponse } from "../../../types/ISomReview";
import { reviewAccessForToken } from "../../../lib/somReview/access";
import { toLinkedFollowUps } from "../../../lib/somReview/followUps";

const handler = async (request: NextApiRequest, res: NextApiResponse) => {
  const req = request as CustomNextApiRequest;
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  try {
    const dataset = getDataset();
    const reviewerId = req.user.uid;

    const [issueTypes, readyFollowUpRecords] = await Promise.all([
      Promise.all(
        (dataset.manifest.issueTypes || []).map(async (issue: any) => {
          const issueType = issue.id as SomIssueType;
          const enabled = isIssueTypeEnabled(issueType);
          const total = (dataset.orderedIdsByIssue.get(issueType) || []).length;
          const [summary, activeSession] = enabled
            ? await Promise.all([
                pendingSummary(dataset, issueType, reviewerId),
                activeSessionProgress(dataset, issueType, reviewerId),
              ])
            : [{ reviewed: 0, pending: 0, waiting: 0, notApplicable: 0 }, null];
          return {
            id: issueType,
            label: issue.label,
            stage: issue.stage,
            robTaskIds: issue.robTaskIds || [],
            enabled,
            total,
            ...summary,
            ...(activeSession ? { activeSession } : {}),
          };
        }),
      ),
      reviewerReadyDependentRecords(dataset, reviewerId),
    ]);

    const body: SomOverviewResponse = {
      datasetVersion: dataset.datasetVersion,
      issueTypes,
      readyFollowUps: toLinkedFollowUps(dataset, readyFollowUpRecords),
      canDeliberate:
        process.env.SOM_REVIEW_DELIBERATION_ENABLED === "true" &&
        reviewAccessForToken(req.user).canDeliberate,
    };
    return res.status(200).json(body);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};

export default fbAuth(handler);
