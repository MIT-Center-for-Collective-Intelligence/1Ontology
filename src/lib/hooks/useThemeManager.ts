import { useEffect, useCallback, useRef, useState } from "react";
import { useAuth } from "@components/components/context/AuthContext";
import {
  collection,
  doc,
  getFirestore,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { LOGS, USERS } from "../firestoreClient/collections";

/** Fired on the window when `preferred-theme` is updated in this tab (storage events only fire cross-tab). */
export const PREFERRED_THEME_CHANGE_EVENT = "preferred-theme-change";

function notifyPreferredThemeChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PREFERRED_THEME_CHANGE_EVENT));
}

function cacheTheme(theme: "Dark" | "Light") {
  try {
    localStorage.setItem(
      "preferred-theme",
      theme === "Dark" ? "dark" : "light",
    );
    notifyPreferredThemeChanged();
  } catch {
    // The signed-in profile remains authoritative when browser storage is unavailable.
  }
}

export const useThemeManager = () => {
  const [authState, { dispatch }] = useAuth();
  const db = getFirestore();
  const isAuthLoading = !authState.isAuthInitialized;
  const isDark = authState.settings.theme === "Dark";
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const saving = useRef(false);
  const currentUser = useRef(authState.user?.userId);
  currentUser.current = authState.user?.userId;

  // Initialize theme on mount and listen for changes
  useEffect(() => {
    if (!authState.isAuthInitialized) return;
    if (authState.isAuthenticated && authState.settings?.theme) {
      cacheTheme(authState.settings.theme);
    } else {
      // User is not logged in, check localStorage (already initialized in state)
      let savedTheme: string | null = null;
      try {
        savedTheme = localStorage.getItem("preferred-theme");
      } catch {
        /* optional cache */
      }
      if (savedTheme) {
        const newIsDark = savedTheme === "dark";
        const savedThemeName = newIsDark ? "Dark" : "Light";
        if (authState.settings.theme !== savedThemeName) {
          dispatch({ type: "setTheme", payload: savedThemeName });
        }
      }
    }
  }, [
    authState.isAuthInitialized,
    authState.isAuthenticated,
    authState.settings.theme,
    dispatch,
  ]);

  const handleThemeSwitch = useCallback(async () => {
    if (saving.current || isAuthLoading) return;
    const newTheme = !isDark;
    const themeString = newTheme ? "Dark" : "Light";
    const previousTheme = isDark ? "Dark" : "Light";
    const actorId = authState.user?.userId;

    saving.current = true;
    setIsSaving(true);
    setSaveError("");
    dispatch({ type: "setTheme", payload: themeString });
    cacheTheme(themeString);

    try {
      if (authState.isAuthenticated && authState.user) {
        // User is logged in, save to Firebase
        const userRef = doc(db, USERS, authState.user.uname);
        await updateDoc(userRef, { theme: themeString });
      }
    } catch {
      if (currentUser.current === actorId) {
        dispatch({ type: "setTheme", payload: previousTheme });
        cacheTheme(previousTheme);
        setSaveError(
          "Your appearance could not be saved. Your previous mode has been restored. Please try again.",
        );
      }
      return;
    } finally {
      saving.current = false;
      setIsSaving(false);
    }

    if (authState.isAuthenticated && authState.user) {
      // Logging is best effort: a logging failure must not undo a saved preference.
      try {
        const logRef = doc(collection(db, LOGS));
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const hours = String(now.getHours()).padStart(2, "0");
        const minutes = String(now.getMinutes()).padStart(2, "0");
        const seconds = String(now.getSeconds()).padStart(2, "0");

        const doerCreate = `${authState.user.uname}-${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
        void setDoc(logRef, {
          doer: authState.user.uname,
          doerCreate,
          action: "theme change",
          theme: themeString,
          createdAt: Timestamp.fromDate(new Date()),
        }).catch(() => {
          /* profile preference already saved */
        });
      } catch {
        /* profile preference already saved */
      }
    }
  }, [
    isDark,
    isAuthLoading,
    authState.isAuthenticated,
    authState.user,
    db,
    dispatch,
  ]);

  return {
    isDark,
    handleThemeSwitch,
    isAuthenticated: authState.isAuthenticated,
    isAuthLoading,
    isSaving,
    saveError,
  };
};
