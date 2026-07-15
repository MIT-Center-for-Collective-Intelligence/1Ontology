import { NextApiRequest, NextApiResponse } from "next";

import fbAuth, { CustomNextApiRequest } from "../../../../middlewares/fbAuth";
import { getDataset } from "../../../../lib/somReview/dataset";
import {
  DeliberationApiError,
  requireDeliberationAccess,
  respondToDeliberationError,
} from "../../../../lib/somReview/deliberationApi";
import { loadDeliberationProposal } from "../../../../lib/somReview/deliberationStore";
import { reviewRequestData } from "../../../../lib/somReview/request";

const handler = async (request: NextApiRequest, res: NextApiResponse) => {
  const req = request as CustomNextApiRequest;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const { response: access } = requireDeliberationAccess(req.user);
    const data = reviewRequestData(req.body);
    const dataset = getDataset();
    const proposalId =
      typeof data.proposalId === "string" ? data.proposalId : "";
    if (!proposalId) {
      throw new DeliberationApiError(400, "Missing proposalId");
    }
    if (!dataset.recordsById.has(proposalId)) {
      throw new DeliberationApiError(400, "Unknown proposalId");
    }
    const body = await loadDeliberationProposal(
      dataset,
      proposalId,
      req.user.uid,
      access,
    );
    return res.status(200).json(body);
  } catch (error) {
    return respondToDeliberationError(error, res);
  }
};

export default fbAuth(handler);
