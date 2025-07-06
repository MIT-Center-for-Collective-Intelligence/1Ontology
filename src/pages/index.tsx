import { SKILLS_FUTURE_APP_NAMES } from "@components/lib/CONSTANTS";
import { useRouter } from "next/router";
import { useEffect } from "react";

const DEFAULT_APP_ID = SKILLS_FUTURE_APP_NAMES[3].id.replaceAll(" ", "_");

const SkillsFutureDefault = () => {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;
    router.replace(`/${DEFAULT_APP_ID}`);
  }, [router.isReady]);

  return null;
};

export default SkillsFutureDefault;
