export interface IndexedReviewEntry<T> {
  proposalId: string;
  proposalIndex: number;
  response: T;
}

/** Returns all saved responses in the issue type's stable proposal order. */
export const orderedReviewEntries = <T>(
  orderedProposalIds: string[],
  responses: Map<string, T>,
): IndexedReviewEntry<T>[] =>
  orderedProposalIds.flatMap((proposalId, proposalIndex) => {
    const response = responses.get(proposalId);
    return response === undefined
      ? []
      : [{ proposalId, proposalIndex, response }];
  });
