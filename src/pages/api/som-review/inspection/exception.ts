import { NextApiRequest, NextApiResponse } from "next";

import fbAuth, { CustomNextApiRequest } from "../../../../middlewares/fbAuth";
import {
  DeliberationApiError,
  requireDeliberationAccess,
  respondToDeliberationError,
} from "../../../../lib/somReview/deliberationApi";
import { saveInspectionException } from "../../../../lib/somReview/inspectionStore";
import { reviewRequestData } from "../../../../lib/somReview/request";
import { SomInspectionMutationResult } from "../../../../types/ISomReview";

const optionalText = (
  value: unknown,
  label: string,
  maximum: number,
): string => {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length > maximum) {
    throw new DeliberationApiError(
      400,
      `${label} must be ${maximum} characters or fewer`,
    );
  }
  return text;
};

const handler = async (request: NextApiRequest, res: NextApiResponse) => {
  const req = request as CustomNextApiRequest;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    requireDeliberationAccess(req.user);
    const data = reviewRequestData(req.body);
    const clear = data.clear === true;
    const workspaceId =
      typeof data.workspaceId === "string" ? data.workspaceId : "";
    const datasetVersion =
      typeof data.datasetVersion === "string" ? data.datasetVersion : "";
    const proposalId =
      typeof data.proposalId === "string" ? data.proposalId : "";
    const subjectReviewerId =
      typeof data.subjectReviewerId === "string" ? data.subjectReviewerId : "";
    if (!workspaceId || !datasetVersion || !proposalId || !subjectReviewerId) {
      throw new DeliberationApiError(
        400,
        "The inspection subject is incomplete",
      );
    }
    const rationale = optionalText(data.rationale, "Rationale", 3000);
    const suggestedAlternative = optionalText(
      data.suggestedAlternative,
      "Suggested alternative",
      3000,
    );
    if (!clear && rationale.length < 3) {
      throw new DeliberationApiError(400, "Explain why you are not aligned");
    }
    const result = await saveInspectionException({
      workspaceId,
      datasetVersion,
      proposalId,
      subjectReviewerId,
      inspectorId: req.user.uid,
      rationale,
      suggestedAlternative,
      clear,
    });
    const body: SomInspectionMutationResult = { ok: true, ...result };
    return res.status(200).json(body);
  } catch (error) {
    return respondToDeliberationError(error, res);
  }
};

export default fbAuth(handler);
