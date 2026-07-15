import { NextApiRequest, NextApiResponse } from "next";

import fbAuth, { CustomNextApiRequest } from "../../../../middlewares/fbAuth";
import { getDataset } from "../../../../lib/somReview/dataset";
import {
  commentStance,
  DeliberationApiError,
  requireDeliberationAccess,
  requiredText,
  respondToDeliberationError,
} from "../../../../lib/somReview/deliberationApi";
import {
  addDeliberationComment,
  assertIndependentReview,
} from "../../../../lib/somReview/deliberationStore";
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
    await assertIndependentReview(
      dataset.datasetVersion,
      proposalId,
      req.user.uid,
    );
    await addDeliberationComment({
      datasetVersion: dataset.datasetVersion,
      proposalId,
      authorId: req.user.uid,
      stance: commentStance(data.stance),
      body: requiredText(data.body, "Comment"),
    });
    const body: SomDeliberationMutationResult = { ok: true };
    return res.status(200).json(body);
  } catch (error) {
    return respondToDeliberationError(error, res);
  }
};

export default fbAuth(handler);
