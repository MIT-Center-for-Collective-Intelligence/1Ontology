import { NextApiRequest, NextApiResponse } from "next";
import fbAuth from "@components/middlewares/fbAuth";
import { db } from "@components/lib/firestoreServer/admin";
import { getDoerCreate } from "@components/lib/utils/helpers";
import { LOGS } from "@components/lib/firestoreClient/collections";
import { searchChromaCore } from "./helpers";

const runMiddleware = (req: any, res: any, fn: any) => {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { query, skillsFuture, appName, user, nodeType, resultsNum } =
      req.body.data;
    const { uname } = user?.userData;

    /*     await runMiddleware(req, res, cors); */

    const topResults = await searchChromaCore({
      query,
      skillsFuture,
      appName,
      nodeType,
      resultsNum,
    });

    const logData = {
      at: "searchChroma",
      query,
      results: topResults,
      appName,
    };
    const logRef = db.collection(LOGS).doc();
    const doerCreate = getDoerCreate(uname || "");
    await logRef.set({
      type: "info",
      ...logData,
      createdAt: new Date(),
      doer: uname,
      doerCreate,
    });
    return res.status(200).json({ results: topResults });
  } catch (error) {
    console.error(error);
    return res.status(500).json({});
  }
}

export default fbAuth(handler);
