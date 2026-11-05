import { createContext, useContext } from "react";

/** True inside the secret public-link view, where contributor identities stay hidden. */
export const PublicModeContext = createContext(false);

export const usePublicMode = () => useContext(PublicModeContext);
