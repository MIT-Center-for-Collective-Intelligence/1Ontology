import React, { useState, useRef, useEffect, useCallback } from "react";
import { Box, Toolbar } from "@mui/material";

import { useThemeManager } from "../../lib/hooks/useThemeManager";
import type { LandingSectionId } from "../../constants/landingTypes";

const ONTOLOGY_PAPER_THEME_MSG = "ontology-paper-theme" as const;
const PREFERRED_THEME_KEY = "preferred-theme" as const;

function getIsDarkFromBrowserStorage(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const saved = window.localStorage.getItem(PREFERRED_THEME_KEY);
    return saved ? saved === "dark" : true;
  } catch {
    return true;
  }
}

export const PaperLandingSection = (_props: {
  onGoToSection?: (id: LandingSectionId) => void;
}) => {
  const { isDark } = useThemeManager();
  const [browserStorageRev, setBrowserStorageRev] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
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
    </>
  );
};
