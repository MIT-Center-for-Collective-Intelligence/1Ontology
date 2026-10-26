// Browser-safe: assignment copy must not import the server's crypto-backed manifest.
export function quickCoordinatorCopy(
  selectionVersion?: string,
  sourcePages = false,
) {
  const mix =
    selectionVersion === "quick-title-selection-5-15-5-v1"
      ? "5 kept titles, 15 single replacements, 5 splits"
      : "2 kept titles, 22 single replacements, 1 split";
  if (sourcePages)
    return `The first sample contains 25 activities (${mix}). Each O*NET description shows its linked single-description activities together. Use the batch links above for the three additional sets of 25 descriptions, which have separate answers and timing. Flagged activities remain in Rob’s separate queue for those follow-up batches. The export distinguishes sampled activities from associated activities.`;
  return `The initial batch contains 25 unflagged activities (${mix}). Another 75 are reserved. All 319 flagged cases remain in Rob’s separate review.`;
}
