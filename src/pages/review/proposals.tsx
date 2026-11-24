import { useEffect } from "react";
import { useRouter } from "next/router";
import { ONTOLOGY_APPS } from "@components/lib/CONSTANTS";
import { reviewHash } from "@components/components/Review/ReviewModeContext";

/**
 * /review/proposals[?app=test-ontology]#<nodeId>: the review's old address.
 * The review now opens on the app page itself, at `#<nodeId>/review`, so the
 * shell is not loaded again; this page only sends the browser there.
 */
const ProposalsReviewPage = () => {
  const router = useRouter();
  useEffect(() => {
    if (!router.isReady) return;
    const requested = (
      (router.query?.app || "test-ontology") as string
    ).replaceAll("_", " ");
    const found = ONTOLOGY_APPS.find((a: any) => a.id === requested);
    const app = (found ? requested : ONTOLOGY_APPS[0].id).replaceAll(" ", "_");
    const nodeId = window.location.hash.replace(/^#/, "");
    router.replace(`/${app}${nodeId ? reviewHash(nodeId) : ""}`);
  }, [router.isReady, router.query, router]);
  return null;
};

export default ProposalsReviewPage;
