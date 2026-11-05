import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Box, CircularProgress, Typography } from "@mui/material";
import { getAuth, signInWithCustomToken } from "firebase/auth";

import { PUBLIC_ONTOLOGY_APP_ID } from "@components/lib/CONSTANTS";
import { PublicModeContext } from "@components/components/context/PublicModeContext";
import Ontology from "../Ontology";

type Status = "loading" | "ready" | "denied";

/**
 * Read-only public view of the platform, reachable only through the secret
 * link /explore/<PUBLIC_VIEW_TOKEN>. Visitors get a `publicViewer`
 * Firebase session and the regular Ontology page with all editing,
 * commenting and sidebar tools removed.
 */
const PublicOntology = () => {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [title, setTitle] = useState<string | null>(null);

  const appName = PUBLIC_ONTOLOGY_APP_ID;

  useEffect(() => {
    if (!router.isReady) return;
    const token = router.query.token;
    if (typeof token !== "string" || !appName) {
      setStatus("denied");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/public/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) throw new Error("denied");
        const { customToken } = await res.json();
        await signInWithCustomToken(getAuth(), customToken);
        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) setStatus("denied");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router.isReady, router.query.token, appName]);

  return (
    <>
      <Head>
        <title>{title ?? "Ontology of Collective Intelligence"}</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Head>
      {status === "ready" && appName ? (
        <PublicModeContext.Provider value>
          <Ontology
            publicMode
            appName={appName}
            onFocusedTitleChange={setTitle}
          />
        </PublicModeContext.Provider>
      ) : (
        <Box
          sx={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {status === "loading" ? (
            <CircularProgress />
          ) : (
            <Typography>This link is not valid.</Typography>
          )}
        </Box>
      )}
    </>
  );
};

export default PublicOntology;
