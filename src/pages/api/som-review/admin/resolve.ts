import { NextApiRequest, NextApiResponse } from "next";

import fbAuth, { CustomNextApiRequest } from "../../../../middlewares/fbAuth";
import { getDataset } from "../../../../lib/somReview/dataset";
import {
  DeliberationApiError,
  requireDeliberationAccess,
  requiredText,
  resolutionDecision,
  respondToDeliberationError,
} from "../../../../lib/somReview/deliberationApi";
import {
  loadDeliberationProposal,
  saveDeliberationResolution,
} from "../../../../lib/somReview/deliberationStore";
import { reviewRequestData } from "../../../../lib/somReview/request";
import { SomDeliberationMutationResult } from "../../../../types/ISomReview";

const handler = async (request: NextApiRequest, res: NextApiResponse) => {
  const req = request as CustomNextApiRequest;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const { access, response: accessResponse } = requireDeliberationAccess(
      req.user,
    );
    if (!access.canFinalize) {
      throw new DeliberationApiError(
        403,
        "Only a senior steward or designated finalizer can resolve a proposal",
      );
    }
    const data = reviewRequestData(req.body);
    const dataset = getDataset();
    const proposalId =
      typeof data.proposalId === "string" ? data.proposalId : "";
    if (!dataset.recordsById.has(proposalId)) {
      throw new DeliberationApiError(400, "Unknown proposalId");
    }
    const decision = resolutionDecision(data.decision);
    const detail = await loadDeliberationProposal(
      dataset,
      proposalId,
      req.user.uid,
      accessResponse,
    );
    if (decision !== "defer" && !detail.aggregate.quorumMet) {
      throw new DeliberationApiError(
        409,
        "At least two core-team judgments are required before acceptance or rejection",
      );
    }
    await saveDeliberationResolution({
      datasetVersion: dataset.datasetVersion,
      proposalId,
      resolverId: req.user.uid,
      decision,
      rationale: requiredText(data.rationale, "Resolution rationale"),
    });
    const body: SomDeliberationMutationResult = { ok: true };
    return res.status(200).json(body);
  } catch (error) {
    return respondToDeliberationError(error, res);
  }
};

export default fbAuth(handler);
