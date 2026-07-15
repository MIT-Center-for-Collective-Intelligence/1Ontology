import { NextApiRequest, NextApiResponse } from "next";

import fbAuth, { CustomNextApiRequest } from "../../../../middlewares/fbAuth";
import { getDataset } from "../../../../lib/somReview/dataset";
import {
  requireDeliberationAccess,
  respondToDeliberationError,
} from "../../../../lib/somReview/deliberationApi";
import { loadDeliberationOverview } from "../../../../lib/somReview/deliberationStore";
import {
  reviewerRoleLabel,
  reviewerRoleWeights,
} from "../../../../lib/somReview/access";
import {
  SomDeliberationOverviewResponse,
  SomReviewerRole,
} from "../../../../types/ISomReview";

const handler = async (request: NextApiRequest, res: NextApiResponse) => {
  const req = request as CustomNextApiRequest;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const { response: access } = requireDeliberationAccess(req.user);
    const dataset = getDataset();
    const weights = reviewerRoleWeights();
    const roles: SomReviewerRole[] = ["steward", "researcher", "contributor"];
    const deliberation = await loadDeliberationOverview(dataset, req.user.uid);
    const body: SomDeliberationOverviewResponse = {
      datasetVersion: dataset.datasetVersion,
      access,
      remainingIndependentReviews: deliberation.remainingIndependentReviews,
      roleWeights: roles.map((role) => ({
        role,
        label: reviewerRoleLabel(role),
        weight: weights[role],
      })),
      proposals: deliberation.proposals,
    };
    return res.status(200).json(body);
  } catch (error) {
    return respondToDeliberationError(error, res);
  }
};

export default fbAuth(handler);
