import type { GetServerSideProps } from "next";
import RelationshipReview from "../../components/SomReview/RelationshipReview";
import withAuthUser from "../../components/hoc/withAuthUser";
import { useAuth } from "../../components/context/AuthContext";
import { localPreviewEnabled } from "../../lib/titleValidation/repository";
function Ready() {
  const [{ isAuthInitialized, isAuthenticated }] = useAuth();
  if (!isAuthInitialized || !isAuthenticated)
    return (
      <main aria-busy="true">
        <h1>Activity relationship review</h1>
        <p role="status">Loading your account…</p>
      </main>
    );
  return <RelationshipReview />;
}
const SignedIn = withAuthUser({
  shouldRedirectToHomeIfAuthenticated: false,
  shouldRedirectToLogin: true,
})(Ready);
export default function Page({ preview }: { preview: boolean }) {
  return preview ? <RelationshipReview preview /> : <SignedIn />;
}
export const getServerSideProps: GetServerSideProps = async (context) => ({
  props: {
    preview: localPreviewEnabled(
      context.req.headers.host,
      context.req.socket.remoteAddress,
    ),
  },
});
