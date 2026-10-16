import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import type {
  RelationshipDataset,
  RelationshipPresentation,
} from "../../types/IRelationshipReview";
import { selectedReviewCases } from "./selection";
import { relationshipPackage } from "./package";
export function getRelationshipPresentation(
  dataset: RelationshipDataset,
  datasetSha256: string,
) {
  const { dir, entry: manifest } = relationshipPackage(dataset.version);
  const bytes = fs.readFileSync(path.join(dir, "presentation.json"));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const presentation = JSON.parse(
    bytes.toString("utf8"),
  ) as RelationshipPresentation;
  if (
    manifest.presentationSha256 !== sha256 ||
    presentation.datasetSha256 !== datasetSha256 ||
    new Set(presentation.selectedCaseIds).size !==
      presentation.selectedCaseIds.length ||
    selectedReviewCases(dataset, presentation).length !==
      presentation.selectedCaseIds.length
  )
    throw Error("Invalid selected generalization changes");
  return { presentation, sha256 };
}
export function getPresentationTrace(version?: string) {
  const { dir, entry: manifest } = relationshipPackage(version);
  const bytes = fs.readFileSync(path.join(dir, "presentation-trace.json"));
  if (
    createHash("sha256").update(bytes).digest("hex") !==
    manifest.presentationTraceSha256
  )
    throw Error("Presentation trace integrity mismatch");
  return JSON.parse(bytes.toString("utf8"));
}
