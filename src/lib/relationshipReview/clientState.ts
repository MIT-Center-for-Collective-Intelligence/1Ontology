import type { RelationshipSession } from "../../types/IRelationshipReview";

/** A delayed read may refresh metadata, but cannot erase a newer save receipt. */
export function reconcileSession(
  current: RelationshipSession | null,
  incoming: RelationshipSession,
): RelationshipSession {
  if (
    !current ||
    current.reviewerKey !== incoming.reviewerKey ||
    current.dataset.version !== incoming.dataset.version ||
    current.datasetSha256 !== incoming.datasetSha256
  )
    return incoming;
  const feedback = { ...incoming.feedback };
  for (const [id, answer] of Object.entries(current.feedback))
    if (!feedback[id] || feedback[id].revision < answer.revision)
      feedback[id] = answer;
  return { ...incoming, feedback };
}
