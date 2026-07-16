import { NextApiRequest, NextApiResponse } from "next";

import fbAuth, { CustomNextApiRequest } from "../../../middlewares/fbAuth";
import {
  compileResponseValidator,
  getDataset,
  isIssueTypeEnabled,
} from "../../../lib/somReview/dataset";
import {
  ResponsePayload,
  reviewerReadyDependentRecords,
  reviseResponse,
} from "../../../lib/somReview/store";
import { reviewRequestData } from "../../../lib/somReview/request";
import { SomReviseResult } from "../../../types/ISomReview";
import { toLinkedFollowUps } from "../../../lib/somReview/followUps";

let validateResponse: ReturnType<typeof compileResponseValidator> | null = null;

const handler = async (request: NextApiRequest, res: NextApiResponse) => {
  const req = request as CustomNextApiRequest;
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  try {
    const dataset = getDataset();
    const data = reviewRequestData(req.body);
    const payload = data.response as ResponsePayload;
    if (!payload)
      return res.status(400).json({ error: "Missing response payload" });

    if (!validateResponse) validateResponse = compileResponseValidator();
    if (!validateResponse(payload)) {
      return res.status(400).json({
        error: "Response failed schema validation",
        details: validateResponse.errors,
      });
    }
    if (payload.reviewerId !== req.user.uid) {
      return res
        .status(403)
        .json({ error: "reviewerId does not match the signed-in user" });
    }
    if (payload.datasetVersion !== dataset.datasetVersion) {
      return res.status(400).json({ error: "Unexpected datasetVersion" });
    }
    const record = dataset.recordsById.get(payload.proposalId);
    if (!record) return res.status(400).json({ error: "Unknown proposalId" });
    if (!isIssueTypeEnabled(record.issueType)) {
      return res.status(403).json({ error: "This issue type is not enabled" });
    }
    if (
      payload.decision === "disagree" &&
      !(payload.disagreementReason || "").trim()
    ) {
      return res
        .status(400)
        .json({ error: "Disagree requires a non-whitespace reason" });
    }

    const { changed } = await reviseResponse(record.issueType, payload);
    const followUpRecords =
      payload.decision === "agree"
        ? await reviewerReadyDependentRecords(
            dataset,
            req.user.uid,
            payload.proposalId,
          )
        : [];
    const body: SomReviseResult = {
      ok: true,
      changed,
      followUps: toLinkedFollowUps(dataset, followUpRecords),
    };
    return res.status(200).json(body);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};

export default fbAuth(handler);
