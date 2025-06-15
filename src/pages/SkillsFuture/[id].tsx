import React from "react";

import withAuthUser from "@components/components/hoc/withAuthUser";
import Ontology from "../Ontology";
import { useRouter } from "next/router";
import { SKILLS_FUTURE_APP_NAMES } from "@components/lib/CONSTANTS";

const SkillsFuture = () => {
  const router = useRouter();
  const id = ((router.query?.id || "") as string).replaceAll("_", " ");
  if (!SKILLS_FUTURE_APP_NAMES.includes(id)) {
    const DEFAULT_APP_ID = SKILLS_FUTURE_APP_NAMES[2].replaceAll(" ", "_");
    router.replace(`/SkillsFuture/${DEFAULT_APP_ID}`);
  }

  return <Ontology skillsFuture={true} appName={id} />;
};

export default withAuthUser({
  shouldRedirectToLogin: true,
  shouldRedirectToHomeIfAuthenticated: false,
})(SkillsFuture);
