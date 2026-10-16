import type { GetServerSideProps } from "next";
import HumanTitleValidation from "@components/components/SomReview/HumanTitleValidation";
import withAuthUser from "@components/components/hoc/withAuthUser";
import { localPreviewEnabled } from "@components/lib/titleValidation/repository";

const SignedInReview = withAuthUser({
  shouldRedirectToHomeIfAuthenticated: false,
  shouldRedirectToLogin: true,
})(() => <HumanTitleValidation preview={false} />);
export default function TitleValidationPage({ preview }: { preview: boolean }) {
  return preview ? <HumanTitleValidation preview /> : <SignedInReview />;
}
export const getServerSideProps: GetServerSideProps = async (context) => ({
  props: {
    preview: localPreviewEnabled(
      context.req.headers.host,
      context.req.socket.remoteAddress,
    ),
  },
});
