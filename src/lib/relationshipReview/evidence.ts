import type {
  RelationshipDataset,
  RelationshipSourceEvidence,
} from "../../types/IRelationshipReview";

// Only records linked to this activity in the frozen request are evidence.
// Definitions of candidate parents must never be presented as O*NET records.
export function relationshipSourceEvidence(
  dataset: RelationshipDataset,
  caseId: string,
  trace: unknown,
): RelationshipSourceEvidence {
  const item = dataset.cases.find((c) => c.id === caseId);
  if (!item) throw Error("Unknown activity");
  const context = (trace as any)?.sourceContext;
  const coverage = context?.descendantCoverage;
  const descendants: any[] = Array.isArray(coverage?.fullDescendantRecords)
    ? coverage.fullDescendantRecords
    : [];
  const candidates = new Map((dataset.candidates || []).map((n) => [n.id, n]));
  const records = new Map<
    string,
    RelationshipSourceEvidence["records"][number]
  >();
  const issues = new Set<string>();
  for (const record of [
    ...(item.children || []),
    ...descendants,
    ...(item.oNetTask === true ? [item] : []),
  ]) {
    if (!record || typeof record.id !== "string") continue;
    const frozen = candidates.get(record.id);
    // Older requests omitted this flag; the same version's candidate inventory
    // supplies it. A title prefix alone is not proof of O*NET provenance.
    if (
      typeof frozen?.oNetTask === "boolean" &&
      typeof record.oNetTask === "boolean" &&
      frozen.oNetTask !== record.oNetTask
    )
      issues.add(
        `The O*NET source flag differs between frozen records for ${record.id}.`,
      );
    if (frozen?.oNetTask !== true && record.oNetTask !== true) {
      if (frozen?.oNetTask == null && record.oNetTask == null)
        issues.add(`The source type is not recorded for ${record.id}.`);
      continue;
    }
    const title = record.title || frozen?.title;
    if (typeof title !== "string" || !title.trim()) continue;
    const titleConflict =
      !!frozen?.title && !!record.title && frozen.title !== record.title;
    const descriptionConflict =
      !!frozen?.description &&
      !!record.description &&
      frozen.description !== record.description;
    if (titleConflict || descriptionConflict)
      issues.add(
        `The frozen source wording differs for ${record.id}; both versions are shown.`,
      );
    records.set(record.id, {
      id: record.id,
      title,
      description: record.description || frozen?.description || "",
      descriptionSource:
        record.descriptionSource ||
        frozen?.descriptionSource ||
        "Source-field provenance not recorded",
      ...(titleConflict ? { alternateTitle: frozen!.title } : {}),
      ...(descriptionConflict
        ? { alternateDescription: frozen!.description }
        : {}),
    });
  }
  const complete =
    coverage?.complete === true &&
    Number.isSafeInteger(coverage.total) &&
    coverage.total === new Set(descendants.map((n) => n.id)).size &&
    issues.size === 0;
  return {
    caseId,
    datasetVersion: dataset.version,
    records: [...records.values()],
    complete,
    issues: [...issues],
    limitation: complete
      ? "These are the O*NET records in the complete frozen descendant evidence."
      : "Complete source coverage has not been established for this proposal. These are the available O*NET records, not a complete evidence set.",
  };
}
