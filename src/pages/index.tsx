import { ONTOLOGY_APPS } from "@components/lib/CONSTANTS";
import { useAuth } from "@components/components/context/AuthContext";
import { useRouter } from "next/router";
import { useEffect } from "react";

const DEFAULT_APP_ID = ONTOLOGY_APPS[3].id.replaceAll(" ", "_");

const SkillsFutureDefault = () => {
  const router = useRouter();
  const [{ isAuthenticated, isAuthInitialized }] = useAuth();

  useEffect(() => {
    if (!router.isReady || !isAuthInitialized) return;

    // If user is authenticated, redirect to the app
    if (isAuthenticated) {
      router.replace(`/${DEFAULT_APP_ID}`);
    } else {
      // If user is not authenticated, redirect to landing page
      router.replace("/landing");
    }
  }, [router.isReady, isAuthenticated, isAuthInitialized]);

  return null;
};

export default SkillsFutureDefault;
