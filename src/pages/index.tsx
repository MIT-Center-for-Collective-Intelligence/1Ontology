//The `Ontology` component serves as the main interface for managing and visualizing ontologies within a collaborative platform.
import withAuthUser from " @components/components/hoc/withAuthUser";
import Ontology from "./Ontology";
export default withAuthUser({
  shouldRedirectToLogin: true,
  shouldRedirectToHomeIfAuthenticated: false,
})(Ontology);
