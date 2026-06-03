import withAuthUser from "@components/components/hoc/withAuthUser";
import ConsultantChat from "../ConsultantChat";
export default withAuthUser({
  shouldRedirectToLogin: true,
  shouldRedirectToHomeIfAuthenticated: false,
})(ConsultantChat);
