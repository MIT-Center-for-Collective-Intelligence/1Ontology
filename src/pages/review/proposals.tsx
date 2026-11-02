import React, { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import withAuthUser from "@components/components/hoc/withAuthUser";
import Ontology from "../Ontology";
import { ONTOLOGY_APPS } from "@components/lib/CONSTANTS";
import { ReviewModeContext } from "@components/components/Review/ReviewModeContext";
import { ProposalIndexProvider } from "@components/components/Review/ProposalIndexContext";

/**
 * /review/proposals[?app=test-ontology]#<nodeId>
 * The normal platform shell (outline on the left, toolbar on the right) with
 * the content area replaced by the proposal review workspace.
 */
const ProposalsReviewPage = () => {
  const router = useRouter();
  const [appName, setAppName] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady) return;
    const requested = (
      (router.query?.app || "test-ontology") as string
    ).replaceAll("_", " ");
    const found = ONTOLOGY_APPS.find((a: any) => a.id === requested);
    setAppName(found ? requested : ONTOLOGY_APPS[0].id);
  }, [router.isReady, router.query]);

  if (!appName) return null;
  return (
    <ReviewModeContext.Provider value={true}>
      <ProposalIndexProvider appName={appName}>
        <Head>
          <title>{title ? `Review · ${title}` : "Proposal review"}</title>
        </Head>
        <Ontology appName={appName} onFocusedTitleChange={setTitle} />
      </ProposalIndexProvider>
    </ReviewModeContext.Provider>
  );
};

export default withAuthUser({
  shouldRedirectToLogin: true,
  shouldRedirectToHomeIfAuthenticated: false,
})(ProposalsReviewPage);
