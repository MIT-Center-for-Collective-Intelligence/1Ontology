import { NextApiRequest, NextApiResponse } from "next";

import fbAuth, { CustomNextApiRequest } from "../../../middlewares/fbAuth";
import { getDataset } from "../../../lib/somReview/dataset";
import { undoPrevious } from "../../../lib/somReview/store";
import { reviewRequestData } from "../../../lib/somReview/request";
import { SomIssueType, SomUndoResult } from "../../../types/ISomReview";

const handler = async (request: NextApiRequest, res: NextApiResponse) => {
  const req = request as CustomNextApiRequest;
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  try {
    const data = reviewRequestData(req.body);
    const issueType = data.issueType as SomIssueType;
    const sessionId = typeof data.sessionId === "string" ? data.sessionId : "";
    if (!sessionId)
      return res.status(400).json({ error: "Missing sessionId" });
    const dataset = getDataset();
    if (!dataset.orderedIdsByIssue.has(issueType)) {
      return res.status(400).json({ error: "Unknown issue type" });
    }
    const { cursor } = await undoPrevious(
      sessionId,
      dataset.datasetVersion,
      issueType,
      req.user.uid,
    );
    const body: SomUndoResult = { ok: true, cursor };
    return res.status(200).json(body);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};

export default fbAuth(handler);
