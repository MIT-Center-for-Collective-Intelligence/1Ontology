export interface ReviewSessionCursorState {
  proposalIds: string[];
  cursor: number;
  status: "active" | "completed";
}

export interface ResponseTransition {
  cursor: number;
  completed: boolean;
  shouldPersist: boolean;
}

export const isResumableSession = (
  session: ReviewSessionCursorState,
): boolean =>
  session.status === "active" &&
  session.cursor >= 0 &&
  session.cursor < session.proposalIds.length;

/**
 * Keeps the existing session order while adding every newly available proposal.
 * This lets an older, previously capped session grow into the complete queue.
 */
export const mergeReadyProposalIds = (
  existingProposalIds: string[],
  readyProposalIds: string[],
): string[] => {
  const included = new Set(existingProposalIds);
  const merged = [...existingProposalIds];
  for (const proposalId of readyProposalIds) {
    if (included.has(proposalId)) continue;
    included.add(proposalId);
    merged.push(proposalId);
  }
  return merged;
};

/**
 * Moves an exact linked proposal to the current cursor without changing the
 * completed prefix or dropping any other proposal from the session.
 */
export const prioritizeProposalAtCursor = (
  proposalIds: string[],
  cursor: number,
  preferredProposalId?: string,
): string[] => {
  if (cursor < 0 || cursor > proposalIds.length) {
    throw new Error("Session cursor is invalid");
  }
  if (!preferredProposalId) return proposalIds;

  const preferredIndex = proposalIds.indexOf(preferredProposalId);
  if (preferredIndex < cursor || preferredIndex < 0) return proposalIds;
  if (preferredIndex === cursor) return proposalIds;

  return [
    ...proposalIds.slice(0, cursor),
    preferredProposalId,
    ...proposalIds.slice(cursor, preferredIndex),
    ...proposalIds.slice(preferredIndex + 1),
  ];
};

/**
 * Plans a response write while allowing a lost-network-response retry to be a
 * no-op. Stale changed responses and future-card responses are rejected.
 */
export const planResponseTransition = (
  session: ReviewSessionCursorState,
  proposalId: string,
  identicalRetry: boolean,
): ResponseTransition => {
  const proposalIndex = session.proposalIds.indexOf(proposalId);
  if (proposalIndex < 0) {
    throw new Error("Proposal is not part of this session");
  }
  if (proposalIndex > session.cursor) {
    throw new Error("Proposal is not the current review item");
  }
  if (proposalIndex < session.cursor) {
    if (!identicalRetry) {
      throw new Error("A stale response cannot replace an earlier answer");
    }
    return {
      cursor: session.cursor,
      completed: session.cursor >= session.proposalIds.length,
      shouldPersist: false,
    };
  }

  const cursor = session.cursor + 1;
  return {
    cursor,
    completed: cursor >= session.proposalIds.length,
    shouldPersist: !identicalRetry,
  };
};

export const planUndoTransition = (
  session: ReviewSessionCursorState,
): { cursor: number; status: "active" } => {
  if (session.cursor <= 0) throw new Error("Nothing to undo");
  if (session.cursor > session.proposalIds.length) {
    throw new Error("Session cursor is invalid");
  }
  return { cursor: session.cursor - 1, status: "active" };
};

/**
 * Validates an in-place revision without moving the session cursor. Only an
 * item the reviewer has already completed in this session may be revised.
 */
export const reviewedProposalIndex = (
  session: ReviewSessionCursorState,
  proposalId: string,
): number => {
  if (session.cursor < 0 || session.cursor > session.proposalIds.length) {
    throw new Error("Session cursor is invalid");
  }
  const proposalIndex = session.proposalIds.indexOf(proposalId);
  if (proposalIndex < 0) {
    throw new Error("Proposal is not part of this session");
  }
  if (proposalIndex >= session.cursor) {
    throw new Error("Only a previously reviewed proposal may be revised");
  }
  return proposalIndex;
};
