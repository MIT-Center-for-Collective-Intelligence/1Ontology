import React, { useCallback, useEffect, useState } from "react";
import { Box, ThemeProvider, useTheme } from "@mui/material";
import Head from "next/head";
import withAuthUser from "@components/components/hoc/withAuthUser";
import Ontology from "./Ontology";
import { NavigateLandingSection } from "./landing/navigate";
import { useRouter } from "next/router";
import { ONTOLOGY_APPS } from "@components/lib/CONSTANTS";
import { createLandingTheme } from "@components/theme/landingTheme";

type Mode = "platform" | "navigate";

// Hash: `#<nodeId>` → platform, `#<nodeId>/navigate` → navigator.
const parseHash = (raw: string): { nodeId: string; mode: Mode } => {
  const h = raw.replace(/^#/, "");
  if (!h) return { nodeId: "", mode: "platform" };
  if (h.endsWith("/navigate")) {
    return { nodeId: h.slice(0, -"/navigate".length), mode: "navigate" };
  }
  return { nodeId: h, mode: "platform" };
};

const SkillsFuture = () => {
  const router = useRouter();
  const theme = useTheme();

  const [appName, setAppName] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("platform");
  const [navInitialNodeId, setNavInitialNodeId] = useState<string | null>(null);
  const [hasVisitedNavigator, setHasVisitedNavigator] = useState(false);
  const [platformTitle, setPlatformTitle] = useState<string | null>(null);
  const [navigatorTitle, setNavigatorTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady) return;
    const id = ((router.query?.id || "") as string).replaceAll("_", " ");
    const findId = ONTOLOGY_APPS.find((c) => c.id === id);
    if (!findId) {
      const DEFAULT_APP_ID = ONTOLOGY_APPS[0].id.replaceAll(" ", "_");
      router.replace(`/SkillsFuture/${DEFAULT_APP_ID}`);
    } else {
      setAppName(id);
    }
  }, [router.isReady, router.query]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => {
      const { nodeId, mode: newMode } = parseHash(window.location.hash);
      setMode(newMode);
      if (newMode === "navigate") {
        setHasVisitedNavigator(true);
        setNavInitialNodeId(nodeId || null);
      }
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const openInNavigator = useCallback((nodeId: string) => {
    if (typeof window === "undefined") return;
    const target = `#${nodeId}/navigate`;
    if (window.location.hash !== target) {
      window.history.pushState(
        null,
        "",
        `${window.location.pathname}${target}`,
      );
      // pushState doesn't fire hashchange natively.
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
  }, []);

  const backToPlatform = useCallback(() => {
    if (typeof window === "undefined") return;
    const { nodeId } = parseHash(window.location.hash);
    const target = nodeId ? `#${nodeId}` : "";
    window.history.pushState(
      null,
      "",
      `${window.location.pathname}${target}`,
    );
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }, []);

  if (!appName) return null;

  const tabTitle =
    (mode === "navigate"
      ? navigatorTitle ?? platformTitle
      : platformTitle ?? navigatorTitle) ?? "Ontology of Collective Intelligence";

  return (
    <>
      <Head>
        <title>{tabTitle}</title>
      </Head>
      <Box sx={{ display: mode === "platform" ? "block" : "none" }}>
        <Ontology
          appName={appName}
          onOpenInNavigator={openInNavigator}
          onFocusedTitleChange={setPlatformTitle}
        />
      </Box>
      {hasVisitedNavigator && (
        <Box sx={{ display: mode === "navigate" ? "block" : "none" }}>
          <ThemeProvider
            theme={createLandingTheme(theme.palette.mode === "dark")}
          >
            <NavigateLandingSection
              isDark={theme.palette.mode === "dark"}
              appName={appName}
              initialNodeId={navInitialNodeId}
              onBackToPlatform={backToPlatform}
              onFocusedTitleChange={setNavigatorTitle}
            />
          </ThemeProvider>
        </Box>
      )}
    </>
  );
};

export default withAuthUser({
  shouldRedirectToLogin: true,
  shouldRedirectToHomeIfAuthenticated: false,
})(SkillsFuture);
