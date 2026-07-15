import { NextApiRequest, NextApiResponse } from "next";

import fbAuth, { CustomNextApiRequest } from "../../../../middlewares/fbAuth";
import { getDataset } from "../../../../lib/somReview/dataset";
import {
  DeliberationApiError,
  requireDeliberationAccess,
  requiredText,
  respondToDeliberationError,
  reviewDecision,
} from "../../../../lib/somReview/deliberationApi";
import { saveDeliberationPosition } from "../../../../lib/somReview/deliberationStore";
import { reviewRequestData } from "../../../../lib/somReview/request";
import { SomDeliberationMutationResult } from "../../../../types/ISomReview";

const handler = async (request: NextApiRequest, res: NextApiResponse) => {
  const req = request as CustomNextApiRequest;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    requireDeliberationAccess(req.user);
    const data = reviewRequestData(req.body);
    const dataset = getDataset();
    const proposalId =
      typeof data.proposalId === "string" ? data.proposalId : "";
    if (!dataset.recordsById.has(proposalId)) {
      throw new DeliberationApiError(400, "Unknown proposalId");
    }
    await saveDeliberationPosition({
      datasetVersion: dataset.datasetVersion,
      proposalId,
      reviewerId: req.user.uid,
      decision: reviewDecision(data.decision),
      rationale: requiredText(data.rationale, "Rationale"),
    });
    const body: SomDeliberationMutationResult = { ok: true };
    return res.status(200).json(body);
  } catch (error) {
    return respondToDeliberationError(error, res);
  }
};

export default fbAuth(handler);
