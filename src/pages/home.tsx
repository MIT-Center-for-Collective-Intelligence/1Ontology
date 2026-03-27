import React, { useState, useRef, useEffect, useCallback } from "react";
import Head from "next/head";
import { Box, CssBaseline, ThemeProvider, Toolbar } from "@mui/material";

import { useThemeManager } from "../lib/hooks/useThemeManager";
import { createLandingTheme } from "../theme/landingTheme";
import Navigation from "./landing/_components/Navigation";
import MobileDrawer from "./landing/_components/MobileDrawer";

const ONTOLOGY_PAPER_THEME_MSG = "ontology-paper-theme" as const;
const PREFERRED_THEME_KEY = "preferred-theme" as const;

/** Same key/semantics as OntologyPaper.html and useThemeManager (browser local storage). */
function getIsDarkFromBrowserStorage(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const saved = window.localStorage.getItem(PREFERRED_THEME_KEY);
    return saved ? saved === "dark" : true;
  } catch {
    return true;
  }
}

const Home = () => {
  const { isDark, handleThemeSwitch, isAuthenticated, isAuthLoading } =
    useThemeManager();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  /** Bumps when `preferred-theme` changes in another tab/window so we re-read storage. */
  const [browserStorageRev, setBrowserStorageRev] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const theme = createLandingTheme(isDark);
  const paperIsDark =
    typeof window !== "undefined" ? getIsDarkFromBrowserStorage() : isDark;

  const postThemeToPaperIframe = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win || typeof window === "undefined") return;
    const dark = getIsDarkFromBrowserStorage();
    win.postMessage(
      { type: ONTOLOGY_PAPER_THEME_MSG, mode: dark ? "dark" : "light" },
      window.location.origin,
    );
  }, []);

  useEffect(() => {
    postThemeToPaperIframe();
  }, [postThemeToPaperIframe, isDark, browserStorageRev]);

  useEffect(() => {
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === PREFERRED_THEME_KEY) {
        setBrowserStorageRev((n) => n + 1);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <>
      <Head>
        <title>Where Can AI Be Used? — Paper</title>
        <meta
          name="description"
          content="Research paper: Where Can Artificial Intelligence Be Useful? A Functional Ontology of Work"
        />
      </Head>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            bgcolor: "background.default",
          }}
        >
          <Navigation
            isDark={isDark}
            handleThemeSwitch={handleThemeSwitch}
            isAuthenticated={isAuthenticated}
            isAuthLoading={isAuthLoading}
            onMobileMenuOpen={() => setMobileNavOpen(true)}
            showNavBarButtons={false}
          />
          <MobileDrawer
            open={mobileNavOpen}
            onClose={() => setMobileNavOpen(false)}
          />
          <Toolbar />
          <Box
            component="main"
            sx={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <iframe
              ref={iframeRef}
              title="Where Can AI Be Used? — Paper announcement"
              src="/html/OntologyPaper.html"
              onLoad={postThemeToPaperIframe}
              style={{
                width: "100%",
                height: "92vh",
                border: "none",
                display: "block",
                backgroundColor: paperIsDark ? "#0a0a0f" : "#ffffff",
              }}
            />
          </Box>
        </Box>
      </ThemeProvider>
    </>
  );
};

export default Home;
