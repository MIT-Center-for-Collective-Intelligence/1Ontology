import { NextApiRequest, NextApiResponse } from "next";

import fbAuth, { CustomNextApiRequest } from "../../../../middlewares/fbAuth";
import {
  DeliberationApiError,
  requireDeliberationAccess,
  respondToDeliberationError,
} from "../../../../lib/somReview/deliberationApi";
import { lockInspectionScan } from "../../../../lib/somReview/inspectionStore";
import { reviewRequestData } from "../../../../lib/somReview/request";
import { SomInspectionMutationResult } from "../../../../types/ISomReview";

const handler = async (request: NextApiRequest, res: NextApiResponse) => {
  const req = request as CustomNextApiRequest;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    requireDeliberationAccess(req.user);
    const data = reviewRequestData(req.body);
    const workspaceId =
      typeof data.workspaceId === "string" ? data.workspaceId : "sell";
    const noIssuesFound = data.noIssuesFound === true;
    const observations =
      typeof data.observations === "string" ? data.observations.trim() : "";
    if (!noIssuesFound && observations.length < 3) {
      throw new DeliberationApiError(
        400,
        "Record at least one observation or select no issues found",
      );
    }
    if (observations.length > 5000) {
      throw new DeliberationApiError(
        400,
        "Observations must be 5000 characters or fewer",
      );
    }
    const result = await lockInspectionScan({
      workspaceId,
      inspectorId: req.user.uid,
      observations,
      noIssuesFound,
    });
    const body: SomInspectionMutationResult = { ok: true, ...result };
    return res.status(200).json(body);
  } catch (error) {
    return respondToDeliberationError(error, res);
  }
};

export default fbAuth(handler);
