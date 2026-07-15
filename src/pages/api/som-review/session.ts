import { NextApiRequest, NextApiResponse } from "next";

import fbAuth, { CustomNextApiRequest } from "../../../middlewares/fbAuth";
import { getDataset, isIssueTypeEnabled } from "../../../lib/somReview/dataset";
import { getOrCreateSession } from "../../../lib/somReview/store";
import { toReviewerCard } from "../../../lib/somReview/sanitize";
import { reviewRequestData } from "../../../lib/somReview/request";
import { SomIssueType, SomSessionResponse } from "../../../types/ISomReview";

const handler = async (request: NextApiRequest, res: NextApiResponse) => {
  const req = request as CustomNextApiRequest;
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  try {
    const data = reviewRequestData(req.body);
    const issueType = data.issueType as SomIssueType;
    const dataset = getDataset();
    if (!dataset.orderedIdsByIssue.has(issueType)) {
      return res.status(400).json({ error: "Unknown issue type" });
    }
    if (!isIssueTypeEnabled(issueType)) {
      return res
        .status(403)
        .json({ error: "This issue type is not enabled yet" });
    }

    const session = await getOrCreateSession(dataset, issueType, req.user.uid);
    if (!session) {
      const body: SomSessionResponse = { done: true };
      return res.status(200).json(body);
    }

    const body: SomSessionResponse = {
      session: {
        id: session.id,
        issueType,
        datasetVersion: dataset.datasetVersion,
        cursor: session.cursor,
        total: session.proposalIds.length,
      },

      cards: session.proposalIds.map((id) =>
        toReviewerCard(dataset.recordsById.get(id)),
      ),
    };
    return res.status(200).json(body);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};

export default fbAuth(handler);
