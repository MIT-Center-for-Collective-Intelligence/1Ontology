import type { GetServerSideProps } from 'next';
import BranchReview from '../../../components/SomReview/BranchReview';
import withAuthUser from '../../../components/hoc/withAuthUser';
import { useAuth } from '../../../components/context/AuthContext';
import { localPreviewEnabled } from '../../../lib/titleValidation/repository';

function Ready() {
  const [{ isAuthInitialized, isAuthenticated }] = useAuth();
  if (!isAuthInitialized || !isAuthenticated)
    return (
      <main aria-busy='true'>
        <h1>Generalization family review</h1>
        <p role='status'>Loading your account…</p>
      </main>
    );
  return <BranchReview />;
}

const SignedIn = withAuthUser({
  shouldRedirectToHomeIfAuthenticated: false,
  shouldRedirectToLogin: true,
})(Ready);

export default function Page({ preview }: { preview: boolean }) {
  return preview ? <BranchReview preview /> : <SignedIn />;
}

export const getServerSideProps: GetServerSideProps = async (context) => ({
  props: {
    preview: localPreviewEnabled(
      context.req.headers.host,
      context.req.socket.remoteAddress,
    ),
  },
});
