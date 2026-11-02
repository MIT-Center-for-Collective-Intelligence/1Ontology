import { createContext, useContext } from "react";

/** True under /review/proposals: the node content area shows the proposal
 * review workspace instead of the node's properties. */
export const ReviewModeContext = createContext<boolean>(false);

export const useReviewMode = () => useContext(ReviewModeContext);
