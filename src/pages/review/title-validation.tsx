import type { GetServerSideProps } from "next";
import HumanTitleValidation from "@components/components/SomReview/HumanTitleValidation";
import QuickTitleVerification from "@components/components/SomReview/QuickTitleVerification";
import withAuthUser from "@components/components/hoc/withAuthUser";
import { useAuth } from "@components/components/context/AuthContext";
import { localPreviewEnabled } from "@components/lib/titleValidation/repository";

function AuthReadyReview({
  practice = false,
  earlier = false,
  flagged = false,
  qa = false,
  reviewBatch,
}: {
  practice?: boolean;
  earlier?: boolean;
  flagged?: boolean;
  qa?: boolean;
  reviewBatch?: 2 | 3 | 4;
}) {
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
  return earlier ? (
    <HumanTitleValidation
      key={practice ? "practice" : "pilot"}
      preview={false}
      practice={practice}
    />
  ) : (
    <QuickTitleVerification key={reviewBatch || "initial"} flagged={flagged} qa={qa} reviewBatch={reviewBatch} />
  );
}

const SignedInReview = withAuthUser({
  shouldRedirectToHomeIfAuthenticated: false,
  shouldRedirectToLogin: true,
})(AuthReadyReview);
export default function TitleValidationPage({
  preview,
  practice = false,
  earlier = false,
  flagged = false,
  qa = false,
  reviewBatch,
}: {
  preview: boolean;
  practice?: boolean;
  earlier?: boolean;
  flagged?: boolean;
  qa?: boolean;
  reviewBatch?: 2 | 3 | 4;
}) {
  return preview ? (
    earlier ? (
      <HumanTitleValidation preview />
    ) : (
      <QuickTitleVerification key={reviewBatch || "initial"} preview flagged={flagged} qa={qa} reviewBatch={reviewBatch} />
    )
  ) : (
    <SignedInReview
      practice={practice}
      earlier={earlier}
      flagged={flagged}
      qa={qa}
      reviewBatch={reviewBatch}
    />
  );
}
export const getServerSideProps: GetServerSideProps = async (context) => {
  const batch = context.query.batch;
  if (batch !== undefined && !["2", "3", "4"].includes(String(batch)))
    return { notFound: true };
  if (batch && (context.query.workflow || context.query.set || context.query.workspace))
    return { notFound: true };
  if (context.query.workspace === "practice")
    return {
      redirect: { destination: "/review/title-validation", permanent: false },
    };
  return {
    props: {
      preview: localPreviewEnabled(
        context.req.headers.host,
        context.req.socket.remoteAddress,
      ),
      practice: false,
      earlier: context.query.workflow === "earlier",
      flagged: context.query.set === "flagged",
      qa: context.query.qa === "1",
      ...(batch ? { reviewBatch: Number(batch) } : {}),
    },
  };
};
