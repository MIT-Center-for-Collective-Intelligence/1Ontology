// Existing production accounts, verified against the title-review roster.
// Navigation access is separate from coordinator/administrative permission.
const reviewNavigationUids = new Set([
  "vFCAkxKTwjcDKohmiWfiZWz2lZf1", // Rob
  "dPvaiA6EAwcIAwYbxAEap0WDcoK2", // Xinru
  "uQesveK6m5Mz76vO9C93UBKbWPA2", // Iman
]);

export const hasReviewNavigation = (uid: string) =>
  reviewNavigationUids.has(uid);
