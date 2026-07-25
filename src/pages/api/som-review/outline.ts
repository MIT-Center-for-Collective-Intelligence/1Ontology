import { NextApiRequest, NextApiResponse } from "next";

import fbAuth, { CustomNextApiRequest } from "../../../middlewares/fbAuth";
import { getDataset } from "../../../lib/somReview/dataset";
import { reviewRequestData } from "../../../lib/somReview/request";
import {
  reviewDatasetConfig,
  reviewWorkspaceConfig,
} from "../../../lib/somReview/reviewWorkspaces";
import { toOutlineSnapshot } from "../../../lib/somReview/outline";
import { SomOntologyOutlineResponse } from "../../../types/ISomReview";

const handler = async (request: NextApiRequest, res: NextApiResponse) => {
  const req = request as CustomNextApiRequest;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const data = reviewRequestData(req.body);
    const dataset = getDataset(
      typeof data.datasetId === "string" ? data.datasetId : undefined,
    );
    const datasetConfig = reviewDatasetConfig(dataset.datasetId);
    const workspace = reviewWorkspaceConfig(datasetConfig.workspaceId);
    const originalDataset = getDataset(workspace.originalDatasetId);

    const body: SomOntologyOutlineResponse = {
      datasetId: dataset.datasetId,
      workspaceId: workspace.id,
      branch: workspace.label,
      currentRound: datasetConfig.current,
      selected: toOutlineSnapshot(dataset),
      original: toOutlineSnapshot(originalDataset),
    };
    return res.status(200).json(body);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};

export default fbAuth(handler);
