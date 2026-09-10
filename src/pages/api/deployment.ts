import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { reviewDatasetConfig, reviewDatasetDir } from "../../lib/somReview/reviewWorkspaces";

// Public, read-only release identity. Never include runtime configuration or user data.
export default function deployment(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const lock = fs.readFileSync(path.join(process.cwd(), "scripts/deployment/review-package-lock.json"));
    for (const file of JSON.parse(lock.toString("utf8"))) {
      const bytes = fs.readFileSync(path.join(process.cwd(), file.path));
      if (crypto.createHash("sha256").update(bytes).digest("hex") !== file.sha256) {
        throw new Error("Review package integrity mismatch");
      }
    }
    const datasets = ["ontology-title-testbed", "ontology-title-testbed-v7"].map((id) => {
      const config = reviewDatasetConfig(id);
      const raw = fs.readFileSync(path.join(reviewDatasetDir(config), "manifest.json"));
      const manifest = JSON.parse(raw.toString("utf8"));
      if (manifest.datasetVersion !== config.datasetVersion) throw new Error("Dataset mismatch");
      return { id, version: manifest.datasetVersion, current: config.current,
        cards: manifest.counts.proposals + manifest.counts.controls + manifest.counts.manualChecks,
        manifestSha256: crypto.createHash("sha256").update(raw).digest("hex") };
    });
    return res.status(200).json({
      commit: /^[a-f0-9]{40}$/.test(process.env.SOURCE_COMMIT || "") ? process.env.SOURCE_COMMIT : null,
      buildId: process.env.SOURCE_BUILD_ID || null,
      revision: process.env.K_REVISION || null,
      packageSha256: crypto.createHash("sha256").update(lock).digest("hex"),
      datasets,
    });
  } catch {
    return res.status(503).json({ error: "Release dataset verification failed" });
  }
}
