import type { GetServerSideProps } from "next";
import HumanTitleValidation from "@components/components/SomReview/HumanTitleValidation";
import withAuthUser from "@components/components/hoc/withAuthUser";
import { useAuth } from "@components/components/context/AuthContext";
import { localPreviewEnabled } from "@components/lib/titleValidation/repository";

function AuthReadyReview({ practice = false }: { practice?: boolean }) {
  const [{ isAuthInitialized, isAuthenticated }] = useAuth();
  // The shared redirect wrapper renders its child during Firebase startup.
  // Mount this review only once its first request can carry the user's token.
  if (!isAuthInitialized || !isAuthenticated)
    return (
      <main aria-busy="true">
        <h1>Human title review</h1>
        <p role="status">Loading your account…</p>
      </main>
    );
  return (
    <HumanTitleValidation
      key={practice ? "practice" : "pilot"}
      preview={false}
      practice={practice}
    />
  );
}

const SignedInReview = withAuthUser({
  shouldRedirectToHomeIfAuthenticated: false,
  shouldRedirectToLogin: true,
})(AuthReadyReview);
export default function TitleValidationPage({
  preview,
  practice = false,
}: {
  preview: boolean;
  practice?: boolean;
}) {
  return preview ? (
    <HumanTitleValidation preview />
  ) : (
    <SignedInReview practice={practice} />
  );
}
export const getServerSideProps: GetServerSideProps = async (context) => ({
  props: {
    preview: localPreviewEnabled(
      context.req.headers.host,
      context.req.socket.remoteAddress,
    ),
    practice: context.query.workspace === "practice",
  },
});
