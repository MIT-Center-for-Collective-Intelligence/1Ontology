import withAuthUser from "@components/components/hoc/withAuthUser";
import Consultant from "../ConsultantPage";
export default withAuthUser({
  shouldRedirectToLogin: true,
  shouldRedirectToHomeIfAuthenticated: false,
})(Consultant);
