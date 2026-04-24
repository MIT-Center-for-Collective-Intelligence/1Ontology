import type { LandingSectionId } from "./landingTypes";
import { landingSectionToHash } from "./landingTypes";

export const LANDING_ROUTES: { title: string; id: LandingSectionId }[] = [
  { title: "Home", id: "home" },
  { title: "Paper", id: "paper" },
  { title: "Contribute", id: "platform" },
  // { title: "AI Uses", id: "aiUses" },
  { title: "Team", id: "team" },
];

/** In-app link targets when Navigation is not using SPA callbacks (e.g. treemap). */
export const landingHrefForSection = (id: LandingSectionId): string => {
  const hash = landingSectionToHash(id);
  return `/landing${hash}`;
};

export const EXTERNAL_LINKS = {
  m3s: {
    title: "M3S - Mens Manus and Machina",
    href: "https://m3s.mit.edu/",
  },
  cci: {
    title: "MIT Center for Collective Intelligence",
    href: "https://cci.mit.edu/",
  },
  accessibility: {
    title: "Accessibility Info",
    href: "https://accessibility.mit.edu/",
  },
};
