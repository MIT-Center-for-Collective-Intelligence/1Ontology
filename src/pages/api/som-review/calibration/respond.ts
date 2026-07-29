import { NextApiRequest, NextApiResponse } from "next";

import fbAuth, { CustomNextApiRequest } from "../../../../middlewares/fbAuth";
import { saveCalibrationResponse } from "../../../../lib/somReview/calibrationStore";
import {
  compileResponseValidator,
  getDatasetByVersion,
} from "../../../../lib/somReview/dataset";
import { reviewRequestData } from "../../../../lib/somReview/request";
import { ResponsePayload } from "../../../../lib/somReview/store";
import { SomCalibrationRespondResult } from "../../../../types/ISomReview";

const responseValidators = new Map<
  string,
  ReturnType<typeof compileResponseValidator>
>();

const handler = async (request: NextApiRequest, res: NextApiResponse) => {
  const req = request as CustomNextApiRequest;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const data = reviewRequestData(req.body);
    const assignmentId =
      typeof data.assignmentId === "string" ? data.assignmentId : "";
    const payload = data.response as ResponsePayload;
    if (!assignmentId || !payload) {
      return res
        .status(400)
        .json({ error: "The calibration response is incomplete" });
    }
    const dataset = getDatasetByVersion(String(payload.datasetVersion || ""));
    let validateResponse = responseValidators.get(dataset.datasetVersion);
    if (!validateResponse) {
      validateResponse = compileResponseValidator(dataset.rootDir);
      responseValidators.set(dataset.datasetVersion, validateResponse);
    }
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
    if (!dataset.recordsById.has(payload.proposalId)) {
      return res.status(400).json({ error: "Unknown proposalId" });
    }
    if (
      payload.decision === "disagree" &&
      !(payload.disagreementReason || "").trim()
    ) {
      return res
        .status(400)
        .json({ error: "Disagree requires an explanation" });
    }
    const body: SomCalibrationRespondResult = await saveCalibrationResponse({
      assignmentId,
      reviewerId: req.user.uid,
      payload,
    });
    return res.status(200).json(body);
  } catch (error: any) {
    console.error(error);
    const status = typeof error?.status === "number" ? error.status : 500;
    return res.status(status).json({
      error:
        status === 500
          ? "The calibration response could not be saved"
          : error.message,
    });
  }
};

export default fbAuth(handler);
