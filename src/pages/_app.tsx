/* This is a Next.js application that uses several libraries and tools to provide a robust and feature-rich environment. Here's a breakdown of the code:

1. **Imports**: The code begins by importing several libraries and components. These include Next.js, React, React Query, Emotion (for CSS-in-JS styling), Material UI, and several custom components and utilities.

2. **Emotion Cache**: The `createEmotionCache` function is used to create a new instance of Emotion's cache. This cache is used to improve the performance of Emotion's CSS-in-JS styling.

3. **Firestore Initialization**: The `initializeFirestore` function is called to initialize Firebase's Firestore database.

4. **App Component**: This is the main component of the application. It receives `AppPropsWithLayout` as props, which includes the `Component` to be rendered and the `pageProps` to be passed to that component.

5. **Query Client**: A new instance of React Query's `QueryClient` is created. This client is used to fetch, cache, and update data in your React applications.

6. **Layout**: The `getLayout` function is used to get the layout for the current page. If the `Component` has a `getLayout` function, it is used; otherwise, a default function is used that simply renders the page.

7. **ErrorBoundary**: The entire application is wrapped in an `ErrorBoundary` component. This component catches JavaScript errors anywhere in the child component tree, logs those errors, and displays a fallback UI.

8. **QueryClientProvider**: The `QueryClientProvider` component is used to provide the `QueryClient` instance to the rest of the application.

9. **Hydrate**: The `Hydrate` component is used to hydrate the dehydrated state from `pageProps`.

10. **CacheProvider**: The `CacheProvider` component is used to provide the Emotion cache to the rest of the application.

11. **SnackbarProvider**: The `SnackbarProvider` component is used to provide a way to display snackbars (small notifications) to the user.

12. **AuthProvider**: The `AuthProvider` component is used to provide authentication-related data and functions to the rest of the application.

13. **ThemeProvider**: The `ThemeProvider` component is used to provide theme-related data and functions to the rest of the application.

14. **CssBaseline**: The `CssBaseline` component is used to apply a consistent baseline to CSS across all browsers.

15. **ReactQueryDevtools**: The `ReactQueryDevtools` component is used to enable the React Query Devtools, which is a set of tools for debugging React Query.

16. **Export**: Finally, the `App` component is exported as the default export of the module. */

// import "./global.css";
// import "./custom-tree.css";

import { CacheProvider } from "@emotion/react";
import CssBaseline from "@mui/material/CssBaseline";
import Head from "next/head";
import { SnackbarProvider } from "notistack";
import { useEffect, useState } from "react";
import { Hydrate, QueryClient, QueryClientProvider } from "react-query";
import { ReactQueryDevtools } from "react-query/devtools";

import ErrorBoundary from " @components/components/ErrorBoundary";
import { AppPropsWithLayout } from " @components/types/IAuth";
import { AuthProvider } from " @components/components/context/AuthContext";
import { ThemeProvider } from " @components/components/context/ThemeContext";
import { createEmotionCache } from " @components/lib/theme/createEmotionCache";
import { initializeFirestore } from " @components/lib/firestoreClient/firestoreClient.config";
import { LastDeploymentProvider } from " @components/components/context/LastDeploymentContext";
import {
  collection,
  getFirestore,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { LOGS } from " @components/lib/firestoreClient/collections";

const clientSideEmotionCache = createEmotionCache();

initializeFirestore();

const App = (props: AppPropsWithLayout) => {
  const { Component, emotionCache = clientSideEmotionCache, pageProps } = props;
  const db = getFirestore();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: false,
          },
        },
      })
  );
  useEffect(() => {
    const userQuery = query(
      collection(db, LOGS),
      where("__name__", "==", "00EWFECw1PnBRPy4wZVt")
    );

    const unsubscribeUser = onSnapshot(userQuery, (snapshot) => {
      if (
        snapshot.docChanges().length > 0 &&
        snapshot.docChanges()[0].type !== "added"
      ) {
        window.location.reload();
      }
    });

    return () => unsubscribeUser();
  }, [db]);

  const getLayout = Component.getLayout ?? ((page: any) => page);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Hydrate state={pageProps.dehydratedState}>
          <CacheProvider value={emotionCache}>
            <Head>
              <link rel="shortcut icon" href="/favicon.ico" />
              <meta
                name="viewport"
                content="initial-scale=1, width=device-width"
              />
            </Head>
            <SnackbarProvider
              anchorOrigin={{
                vertical: "top",
                horizontal: "center",
              }}
              maxSnack={3}
            >
              <AuthProvider>
                <LastDeploymentProvider>
                  <ThemeProvider>
                    <CssBaseline />
                    {getLayout(<Component {...pageProps} />)}
                    <div id="portal"></div>
                  </ThemeProvider>
                </LastDeploymentProvider>
              </AuthProvider>
            </SnackbarProvider>
          </CacheProvider>
        </Hydrate>
        <ReactQueryDevtools />
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
