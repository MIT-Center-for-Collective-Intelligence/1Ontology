import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import type { RelationshipDataset } from "../../types/IRelationshipReview";

export function getRelationshipDataset() {
  const file = path.join(
    process.cwd(),
    "src/lib/relationshipReview/data/top-level-v1.json",
  );
  const bytes = fs.readFileSync(file);
  const dataset = JSON.parse(bytes.toString("utf8")) as RelationshipDataset;
  const lock = JSON.parse(
    fs.readFileSync(path.join(path.dirname(file), "release-lock.json"), "utf8"),
  );
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (!(process.env.NODE_ENV === "development" && lock.previewOnly)) {
    const committed = JSON.parse(
      fs.readFileSync(
        path.join(
          process.cwd(),
          "scripts/deployment/relationship-review-package.json",
        ),
        "utf8",
      ),
    );
    if (
      committed.bundleSha256 !== sha256 ||
      committed.version !== dataset.version ||
      committed.cases !== dataset.cases.length ||
      committed.releaseLockSha256 !==
        createHash("sha256")
          .update(
            fs.readFileSync(path.join(path.dirname(file), "release-lock.json")),
          )
          .digest("hex")
    )
      throw Error("Relationship package differs from committed source");
  }
  if (
    dataset.version !== "top-level-relationships-20261016-v1" ||
    !dataset.cases.length ||
    new Set(dataset.cases.map((c) => c.id)).size !== dataset.cases.length ||
    lock.datasetSha256 !== sha256 ||
    lock.caseCount !== dataset.cases.length ||
    (lock.previewOnly && process.env.NODE_ENV !== "development")
  )
    throw Error("Invalid frozen relationship dataset");
  return { dataset, sha256 };
}
export function getRelationshipTrace(caseId: string) {
  const { dataset } = getRelationshipDataset();
  if (
    !/^[A-Za-z0-9_-]+$/.test(caseId) ||
    !dataset.cases.some((c) => c.id === caseId)
  )
    throw Error("Unknown case");
  const dir = path.join(process.cwd(), "src/lib/relationshipReview/data");
  const lock = JSON.parse(
    fs.readFileSync(path.join(dir, "release-lock.json"), "utf8"),
  );
  const bytes = fs.readFileSync(path.join(dir, "traces", caseId + ".json"));
  if (
    createHash("sha256").update(bytes).digest("hex") !==
    lock.traceHashes[caseId]
  )
    throw Error("Trace integrity mismatch");
  return JSON.parse(bytes.toString("utf8"));
}
