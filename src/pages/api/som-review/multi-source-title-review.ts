import type { NextApiRequest, NextApiResponse } from "next";
import { handleMultiSourceReview } from "../../../lib/titleValidation/multiSourceApi";
import { MULTI_SOURCE_STUDY_ID } from "../../../lib/titleValidation/multiSourceContract";

export const config = { api: { bodyParser: { sizeLimit: "128kb" } } };

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return handleMultiSourceReview(req, res, MULTI_SOURCE_STUDY_ID);
}
