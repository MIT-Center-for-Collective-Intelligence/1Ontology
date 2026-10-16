import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import type {
  RelationshipDataset,
  RelationshipPresentation,
} from "../../types/IRelationshipReview";
import { selectedReviewCases } from "./selection";
export function getRelationshipPresentation(
  dataset: RelationshipDataset,
  datasetSha256: string,
) {
  const dir = path.join(process.cwd(), "src/lib/relationshipReview/data");
  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(
        process.cwd(),
        "scripts/deployment/relationship-review-package.json",
      ),
      "utf8",
    ),
  );
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
export function getPresentationTrace() {
  const bytes = fs.readFileSync(
    path.join(
      process.cwd(),
      "src/lib/relationshipReview/data/presentation-trace.json",
    ),
  );
  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(
        process.cwd(),
        "scripts/deployment/relationship-review-package.json",
      ),
      "utf8",
    ),
  );
  if (
    createHash("sha256").update(bytes).digest("hex") !==
    manifest.presentationTraceSha256
  )
    throw Error("Presentation trace integrity mismatch");
  return JSON.parse(bytes.toString("utf8"));
}
