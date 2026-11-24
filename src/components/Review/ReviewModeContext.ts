import { createContext, useContext } from "react";

/** True while a node's review is open (`#<nodeId>/review`): the node content
 * area shows the proposal review workspace instead of the node's properties.
 * The shell stays mounted; only the hash changes. */
export const ReviewModeContext = createContext<boolean>(false);

export const useReviewMode = () => useContext(ReviewModeContext);

/** The hash that opens a node's review, as the app page reads it. */
export const REVIEW_SUFFIX = "/review";
export const reviewHash = (nodeId: string) => `#${nodeId}${REVIEW_SUFFIX}`;

/** Opens a node's review in place: pushState does not fire hashchange, so
 * it is sent by hand, as the navigator does. */
export const openReview = (nodeId: string) => {
  if (typeof window === "undefined") return;
  const target = reviewHash(nodeId);
  if (window.location.hash === target) return;
  window.history.pushState(null, "", `${window.location.pathname}${target}`);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
};
