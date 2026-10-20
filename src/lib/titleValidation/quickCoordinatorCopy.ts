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
    return `The starting sample still contains 25 activities (${mix}); another 75 are reserved. Each O*NET description now shows all its linked activities together, including associated activities outside that sample. Rob’s flagged-review queue remains separate, but a flagged activity may also appear alongside the other activities linked to the same description. The export distinguishes sampled activities from their associated activities.`;
  return `The initial batch contains 25 unflagged activities (${mix}). Another 75 are reserved. All 319 flagged cases remain in Rob’s separate review.`;
}
