import type { NextApiResponse } from "next";
import fbAuth, { CustomNextApiRequest } from "@components/middlewares/fbAuth";
import { db } from "@components/lib/firestoreServer/admin";
import { updateDerivedPaths } from "@components/lib/server/updateDerivedPaths";

async function handler(req: CustomNextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const body = (req.body?.data || req.body || {}) as {
    changedNodeId?: string;
    changedNodeIds?: string[];
  };
  const fromArray = body.changedNodeIds?.length
    ? body.changedNodeIds
    : body.changedNodeId
      ? [body.changedNodeId]
      : [];
  if (!fromArray.length) {
    return res.status(400).json({ error: "changedNodeId or changedNodeIds is required" });
  }

  const result = await updateDerivedPaths({ db, changedNodeIds: fromArray });

  if (result.error === "cycle") {
    return res.status(409).json({
      ...result,
      message:
        "This change would make a node an ancestor of itself in the specialization graph.",
    });
  }
  if (result.error === "cap_exceeded") {
    return res
      .status(413)
      .json({ ...result, message: "Affected subgraph too large" });
  }
  if (result.error === "seed_not_found") {
    return res.status(404).json(result);
  }
  if (result.error === "primary_order_stuck") {
    return res.status(500).json({
      ...result,
      message: "Could not order nodes by primary parent",
    });
  }
  if (!result.ok) {
    return res.status(500).json(result);
  }

  return res.status(200).json(result);
}

export default fbAuth(handler);
