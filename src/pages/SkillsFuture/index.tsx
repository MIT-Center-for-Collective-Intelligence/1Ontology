import { SKILLS_FUTURE_APP_NAMES } from "@components/lib/CONSTANTS";
import { useRouter } from "next/router";
import { useEffect } from "react";

const DEFAULT_APP_ID = SKILLS_FUTURE_APP_NAMES[2].replaceAll(" ", "_");

const SkillsFutureDefault = () => {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/SkillsFuture/${DEFAULT_APP_ID}`);
  }, [router]);

  return null;
};

export default SkillsFutureDefault;
