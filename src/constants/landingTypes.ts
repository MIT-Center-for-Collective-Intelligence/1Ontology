export type LandingSectionId =
  | "home"
  | "paper"
  | "platform"
  | "aiUses"
  | "team";

/** Hash fragment for `/landing#…` (home has no hash). */
export const LANDING_SECTION_HASH: Record<LandingSectionId, string> = {
  home: "",
  paper: "paper",
  platform: "platform",
  aiUses: "ai-uses",
  team: "team",
};

export const landingHashToSection = (
  hash: string,
): LandingSectionId => {
  const key = hash.replace(/^#/, "");
  if (!key) return "home";
  const map: Record<string, LandingSectionId> = {
    paper: "paper",
    platform: "platform",
    "ai-uses": "aiUses",
    team: "team",
  };
  return map[key] ?? "home";
};

export const landingSectionToHash = (id: LandingSectionId): string => {
  const h = LANDING_SECTION_HASH[id];
  return h ? `#${h}` : "";
};

export const LANDING_SECTION_TITLES: Record<LandingSectionId, string> = {
  home: "AI and the Future of Work - An Ontology Approach",
  paper: "Where Can AI Be Used? — Paper",
  platform: "Contribute to the Ontology of Activities",
  aiUses: "Where AI Can Be Useful",
  team: "Our Team - AI and the Future of Work",
};
