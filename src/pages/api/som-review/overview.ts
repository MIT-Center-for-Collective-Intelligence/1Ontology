import { NextApiRequest, NextApiResponse } from "next";

import fbAuth, { CustomNextApiRequest } from "../../../middlewares/fbAuth";
import { getDataset, isIssueTypeEnabled } from "../../../lib/somReview/dataset";
import { pendingCount } from "../../../lib/somReview/store";
import { SomIssueType, SomOverviewResponse } from "../../../types/ISomReview";

const handler = async (request: NextApiRequest, res: NextApiResponse) => {
  const req = request as CustomNextApiRequest;
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  try {
    const dataset = getDataset();
    const reviewerId = req.user.uid;

    const issueTypes = await Promise.all(
      (dataset.manifest.issueTypes || []).map(async (issue: any) => ({
        id: issue.id as SomIssueType,
        label: issue.label,
        enabled: isIssueTypeEnabled(issue.id),
        pending: isIssueTypeEnabled(issue.id)
          ? await pendingCount(dataset, issue.id, reviewerId)
          : 0,
      })),
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
