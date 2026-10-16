import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import type { RelationshipDataset } from "../../types/IRelationshipReview";
import { relationshipPackage } from "./package";

export function getRelationshipDataset(version?: string) {
  const { entry: committed, dir } = relationshipPackage(version);
  const file = path.join(
    dir,
    committed.directory ? "dataset.json" : "top-level-v1.json",
  );
  const bytes = fs.readFileSync(file);
  const dataset = JSON.parse(bytes.toString("utf8")) as RelationshipDataset;
  const lock = JSON.parse(
    fs.readFileSync(path.join(path.dirname(file), "release-lock.json"), "utf8"),
  );
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (!(process.env.NODE_ENV === "development" && lock.previewOnly)) {
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
    dataset.version !== committed.version ||
    !dataset.cases.length ||
    new Set(dataset.cases.map((c) => c.id)).size !== dataset.cases.length ||
    lock.datasetSha256 !== sha256 ||
    lock.caseCount !== dataset.cases.length ||
    (lock.previewOnly && process.env.NODE_ENV !== "development")
  )
    throw Error("Invalid frozen relationship dataset");
  return { dataset, sha256 };
}
export function getRelationshipTrace(caseId: string, version?: string) {
  const { dataset } = getRelationshipDataset(version);
  if (
    !/^[A-Za-z0-9_-]+$/.test(caseId) ||
    !dataset.cases.some((c) => c.id === caseId)
  )
    throw Error("Unknown case");
  const { dir } = relationshipPackage(dataset.version);
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
