/* 1. The `withAuthUser` function takes an object as an argument with two optional properties: `shouldRedirectToHomeIfAuthenticated` and `shouldRedirectToLogin`. These properties determine the behavior of the HOC based on the user's authentication status.

2. The `withAuthUser` function returns another function that takes a child component as an argument. This returned function is the actual HOC.

3. Inside the HOC, the `useAuth` hook is used to get the user's authentication status and whether the authentication process has been initialized.

4. The `useRouter` hook from Next.js is used to get the router object, which is used to redirect the user.

5. Two `useCallback` hooks are used to create the `redirectToHome` and `redirectToLogin` functions. These functions are used to redirect the user to the home page and login page respectively.

6. Two `useEffect` hooks are used to handle the redirection. The first one redirects the user to the home page if they are authenticated and the `shouldRedirectToHomeIfAuthenticated` property is true. The second one redirects the user to the login page if they are not authenticated and the `shouldRedirectToLogin` property is true.

7. The HOC returns the child component if the user's authentication status does not require a redirection. Otherwise, it returns a loading component (commented out in this code).

8. The `displayName` property is set on the HOC for debugging purposes.

9. The `withAuthUser` function is exported as a default export. */

import { useRouter } from "next/router";
import { useCallback, useEffect } from "react";

// import FullPageLogoLoading from "@/components/FullPageLogoLoading";

import { useAuth } from "../context/AuthContext";
import ROUTES from "@components/lib/utils/routes";

type Props = {
  shouldRedirectToLogin?: boolean;
  shouldRedirectToHomeIfAuthenticated?: boolean;
};

const withAuthUser =
  ({
    shouldRedirectToHomeIfAuthenticated = true,
    shouldRedirectToLogin,
  }: Props) =>
  (ChildComponent: any) => {
    const WithAuthUserHOC = (): JSX.Element => {
      const [{ isAuthenticated, isAuthInitialized }] = useAuth();
      const router = useRouter();

      const redirectToHome = useCallback(() => {
        router.replace(ROUTES.home);
      }, [router]);

      const redirectToLogin = useCallback(() => {
        router.replace({
          pathname: ROUTES.signIn,
          query: { from: router.asPath },
        });
      }, [router]);

      useEffect(() => {
        if (
          shouldRedirectToHomeIfAuthenticated &&
          isAuthenticated &&
          isAuthInitialized
        ) {
          redirectToHome();
        }
      }, [isAuthInitialized, isAuthenticated, redirectToHome]);

      useEffect(() => {
        if (shouldRedirectToLogin && !isAuthenticated && isAuthInitialized) {
          redirectToLogin();
        }
      }, [isAuthInitialized, isAuthenticated, redirectToLogin]);

      let returnVal = <ChildComponent />;

      // if (
      //   !isAuthInitialized ||
      //   (shouldRedirectToLogin && !isAuthenticated) ||
      //   (shouldRedirectToHomeIfAuthenticated && isAuthenticated)
      // ) {
      //   returnVal = <FullPageLogoLoading />;
      // }

      return returnVal;
    };

    WithAuthUserHOC.displayName = "WithAuthUserHOC";

    return WithAuthUserHOC;
  };
export default withAuthUser;
