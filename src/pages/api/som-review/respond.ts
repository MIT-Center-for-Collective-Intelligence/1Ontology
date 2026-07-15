import { NextApiRequest, NextApiResponse } from "next";

import fbAuth, { CustomNextApiRequest } from "../../../middlewares/fbAuth";
import {
  compileResponseValidator,
  getDataset,
} from "../../../lib/somReview/dataset";
import { ResponsePayload, saveResponse } from "../../../lib/somReview/store";
import { SomRespondResult } from "../../../types/ISomReview";

let validateResponse: ReturnType<typeof compileResponseValidator> | null = null;

const handler = async (request: NextApiRequest, res: NextApiResponse) => {
  const req = request as CustomNextApiRequest;
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  try {
    const dataset = getDataset();
    const payload = req.body?.data?.response as ResponsePayload;
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
    if (
      payload.decision === "disagree" &&
      !(payload.disagreementReason || "").trim()
    ) {
      return res
        .status(400)
        .json({ error: "Disagree requires a non-whitespace reason" });
    }

    const { cursor, completed } = await saveResponse(record.issueType, payload);
    const body: SomRespondResult = { ok: true, cursor, completed };
    return res.status(200).json(body);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};

export default fbAuth(handler);
