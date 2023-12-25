// import "./global.css";

import { CacheProvider } from "@emotion/react";
import CssBaseline from "@mui/material/CssBaseline";
// import axios from "axios";
import Head from "next/head";
import { SnackbarProvider } from "notistack";
import { useEffect, useState } from "react";
import { Hydrate, QueryClient, QueryClientProvider } from "react-query";
import { ReactQueryDevtools } from "react-query/devtools";

import ErrorBoundary from " @components/components/ErrorBoundary";
import { AppPropsWithLayout } from " @components/types/IAuth";
import { AuthProvider } from " @components/components/context/AuthContext";
import { ThemeProvider } from " @components/components/context/ThemeContext";
// import { initFirebaseClientSDK } from " @components/lib/firestoreClient/firestoreClient.config";
import { createEmotionCache } from " @components/lib/theme/createEmotionCache";
import { initializeFirestore } from " @components/lib/firestoreClient/firestoreClient.config";

const clientSideEmotionCache = createEmotionCache();

// axios.defaults.baseURL = "/api";

initializeFirestore();

const App = (props: AppPropsWithLayout) => {
  const { Component, emotionCache = clientSideEmotionCache, pageProps } = props;
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
                <ThemeProvider>
                  <CssBaseline />
                  {getLayout(<Component {...pageProps} />)}
                  <div id="portal"></div>
                </ThemeProvider>
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
