import React, { useEffect, useState } from "react";
import withAuthUser from "@components/components/hoc/withAuthUser";
import Ontology from "./Ontology";
import { useRouter } from "next/router";
import { SKILLS_FUTURE_APP_NAMES } from "@components/lib/CONSTANTS";

const SkillsFuture = () => {
  const router = useRouter();
  const [appName, setAppName] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady) return;

    const id = ((router.query?.id || "") as string).replaceAll("_", " ");
    const findId = SKILLS_FUTURE_APP_NAMES.find((c) => c.id === id);
    if (!findId) {
      const DEFAULT_APP_ID = SKILLS_FUTURE_APP_NAMES[3].id.replaceAll(" ", "_");
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
