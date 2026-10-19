import { titleValidationHandler } from "../../../../lib/titleValidation/api";
import { quickTitleHandler } from "../../../../lib/titleValidation/quickApi";
import type { NextApiRequest, NextApiResponse } from "next";
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return String(req.query.action).startsWith("quick-")
    ? quickTitleHandler(req, res)
    : titleValidationHandler(req, res);
}
export const config = { api: { bodyParser: { sizeLimit: "96kb" } } };
