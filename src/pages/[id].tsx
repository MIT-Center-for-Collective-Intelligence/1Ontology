import React, { useEffect, useState } from "react";
import withAuthUser from "@components/components/hoc/withAuthUser";
import Ontology from "./Ontology";
import { useRouter } from "next/router";
import { ONTOLOGY_APPS } from "@components/lib/CONSTANTS";

const SkillsFuture = () => {
  const router = useRouter();
  const [appName, setAppName] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady) return;

    const id = ((router.query?.id || "") as string).replaceAll("_", " ");
    const findId = ONTOLOGY_APPS.find((c) => c.id === id);
    if (!findId) {
      const DEFAULT_APP_ID = ONTOLOGY_APPS[3].id.replaceAll(" ", "_");
      router.replace(`/SkillsFuture/${DEFAULT_APP_ID}`);
    } else {
      setAppName(id);
    }
  }, [router.isReady, router.query]);

  if (!appName) {
    return null;
  }

  return <Ontology skillsFuture={true} appName={appName} />;
};

export default withAuthUser({
  shouldRedirectToLogin: true,
  shouldRedirectToHomeIfAuthenticated: false,
})(SkillsFuture);
