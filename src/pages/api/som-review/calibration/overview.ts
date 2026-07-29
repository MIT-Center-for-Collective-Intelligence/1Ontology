import { NextApiRequest, NextApiResponse } from "next";

import fbAuth, { CustomNextApiRequest } from "../../../../middlewares/fbAuth";
import { loadCalibrationOverview } from "../../../../lib/somReview/calibrationStore";
import { SomCalibrationOverviewResponse } from "../../../../types/ISomReview";

const handler = async (request: NextApiRequest, res: NextApiResponse) => {
  const req = request as CustomNextApiRequest;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const body: SomCalibrationOverviewResponse = await loadCalibrationOverview(
      req.user.uid,
    );
    return res.status(200).json(body);
  } catch (error: any) {
    console.error(error);
    const status = typeof error?.status === "number" ? error.status : 500;
    return res.status(status).json({
      error:
        status === 500
          ? "The calibration assignment could not be loaded"
          : error.message,
    });
  }
};

export default fbAuth(handler);
