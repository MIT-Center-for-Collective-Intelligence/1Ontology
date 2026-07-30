import { NextApiRequest, NextApiResponse } from "next";

import fbAuth, { CustomNextApiRequest } from "../../../../middlewares/fbAuth";
import {
  requireDeliberationAccess,
  respondToDeliberationError,
} from "../../../../lib/somReview/deliberationApi";
import { loadInspectionOverview } from "../../../../lib/somReview/inspectionStore";
import { reviewRequestData } from "../../../../lib/somReview/request";
import { SomInspectionOverviewResponse } from "../../../../types/ISomReview";

const handler = async (request: NextApiRequest, res: NextApiResponse) => {
  const req = request as CustomNextApiRequest;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    requireDeliberationAccess(req.user);
    const data = reviewRequestData(req.body);
    const body: SomInspectionOverviewResponse = await loadInspectionOverview({
      workspaceId:
        typeof data.workspaceId === "string" ? data.workspaceId : "sell",
      inspectorId: req.user.uid,
      requestedReviewerId:
        typeof data.reviewerId === "string" ? data.reviewerId : undefined,
      requestedTaskKey:
        typeof data.taskKey === "string" ? data.taskKey : undefined,
    });
    return res.status(200).json(body);
  } catch (error) {
    return respondToDeliberationError(error, res);
  }
};

export default fbAuth(handler);
