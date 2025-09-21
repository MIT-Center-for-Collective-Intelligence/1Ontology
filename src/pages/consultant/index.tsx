import withAuthUser from "@components/components/hoc/withAuthUser";
import Consultant from "../Consultant";
export default withAuthUser({
  shouldRedirectToLogin: true,
  shouldRedirectToHomeIfAuthenticated: false,
})(Consultant);
