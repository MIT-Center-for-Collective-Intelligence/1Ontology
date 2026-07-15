import { NextApiRequest, NextApiResponse } from "next";

import fbAuth, { CustomNextApiRequest } from "../../../middlewares/fbAuth";
import { getDataset, isIssueTypeEnabled } from "../../../lib/somReview/dataset";
import {
  activeSessionProgress,
  pendingCount,
} from "../../../lib/somReview/store";
import { SomIssueType, SomOverviewResponse } from "../../../types/ISomReview";

const handler = async (request: NextApiRequest, res: NextApiResponse) => {
  const req = request as CustomNextApiRequest;
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  try {
    const dataset = getDataset();
    const reviewerId = req.user.uid;

    const issueTypes = await Promise.all(
      (dataset.manifest.issueTypes || []).map(async (issue: any) => {
        const issueType = issue.id as SomIssueType;
        const enabled = isIssueTypeEnabled(issueType);
        const total = (dataset.orderedIdsByIssue.get(issueType) || []).length;
        const [pending, activeSession] = enabled
          ? await Promise.all([
              pendingCount(dataset, issueType, reviewerId),
              activeSessionProgress(
                dataset.datasetVersion,
                issueType,
                reviewerId,
              ),
            ])
          : [0, null];
        return {
          id: issueType,
          label: issue.label,
          enabled,
          total,
          pending,
          ...(activeSession ? { activeSession } : {}),
        };
      }),
    );

    const body: SomOverviewResponse = {
      datasetVersion: dataset.datasetVersion,
      issueTypes,
    };
    return res.status(200).json(body);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};

export default fbAuth(handler);
