import React from "react";
import Ontology from "./Ontology";
import withAuthUser from " @components/components/hoc/withAuthUser";

const SkillsFuture = () => {
  return <Ontology skillsFuture={true} />;
};

export default withAuthUser({
  shouldRedirectToLogin: true,
  shouldRedirectToHomeIfAuthenticated: false,
})(SkillsFuture);
