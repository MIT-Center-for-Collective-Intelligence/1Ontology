// Browser-safe: assignment copy must not import the server's crypto-backed manifest.
export function quickCoordinatorCopy(selectionVersion?: string) {
  const mix =
    selectionVersion === "quick-title-selection-5-15-5-v1"
      ? "5 kept titles, 15 single replacements, 5 splits"
      : "2 kept titles, 22 single replacements, 1 split";
  return `The initial batch contains 25 unflagged activities (${mix}). Another 75 are reserved. All 319 flagged cases remain in Rob’s separate review.`;
}
