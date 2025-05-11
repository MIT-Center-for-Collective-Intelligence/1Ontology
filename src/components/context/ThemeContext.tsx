/* # ThemeContext.tsx

## Overview
`ThemeContext.tsx` is a TypeScript file that provides a theme management context for a React application. It utilizes Firebase for real-time user status tracking and integrates with Material-UI (MUI) for theming.

## Dependencies
- **Firebase**: The Firebase SDK is used for user authentication and real-time database functionality.
- **Material-UI (MUI)**: The Material-UI library is used for creating and managing the application's theme.

## Components

### ThemeProvider Component
The `ThemeProvider` component is a functional component that wraps the entire application, providing a context for theme-related functionality.

#### Props
- `children`: ReactNode - The child components to be wrapped by the theme provider.



*/

import { uuidv4 } from "@firebase/util";
import { createTheme } from "@mui/material/styles";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { deepmerge } from "@mui/utils";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  getDatabase,
  goOffline,
  goOnline,
  onDisconnect,
  onValue,
  ref,
  serverTimestamp,
  set,
} from "firebase/database";
import React, { FC, ReactNode, useEffect, useMemo } from "react";

import { useAuth } from "./AuthContext";
import { UserTheme } from "@components/types/IAuth";
import {
  getDesignTokens,
  getThemedComponents,
} from "@components/lib/theme/brandingTheme";

// const ThemeActionsContext = createContext<ThemeActions | undefined>(undefined);

type Props = {
  children: ReactNode;
};
const ThemeProvider: FC<Props> = ({ children }) => {
  const [{ user, settings }] = useAuth();
  const auth = getAuth();
  const db = getDatabase();
  // useEffect(() => {
  //   const unsubscribeRefs: {
  //     auth: () => void;
  //     activityTimer: NodeJS.Timer | null;
  //   } = {
  //     auth: () => {},
  //     activityTimer: null,
  //   };
  //   // Fetch the current user's ID from Firebase Authentication.
  //   if (user) {
  //     goOnline(db);
  //     const sessionId = uuidv4();
  //     var uname = user?.uname;
  //     // Create a reference to this user's specific status node.
  //     // This is where we will store data about being online/offline.
  //     const userStatusDatabaseRef = ref(db, "/status/" + uname);
  //     //var userStatusFirestoreRef = doc(firestoreDb, "/status/" + uname);
  //     // We'll create two constants which we will write to
  //     // the Realtime database when this device is offline
  //     // or online.
  //     let isOfflineForDatabase = {
  //       sessionId,
  //       state: "offline",
  //       last_changed: serverTimestamp(),
  //     };
  //     let isOnlineForDatabase = {
  //       sessionId,
  //       state: "online",
  //       last_changed: serverTimestamp(),
  //     };
  //     // Create a reference to the special '.info/connected' path in
  //     // Realtime Database. This path returns `true` when connected
  //     // and `false` when disconnected.
  //     const infRef = ref(db, ".info/connected");
  //     onValue(infRef, (snapshot) => {
  //       if (snapshot.val() == false) {
  //         set(userStatusDatabaseRef, isOfflineForDatabase);
  //         return;
  //       }
  //       onDisconnect(userStatusDatabaseRef)
  //         .set(isOfflineForDatabase)
  //         .then(() => {
  //           set(userStatusDatabaseRef, isOnlineForDatabase);
  //         });
  //     });

  //     unsubscribeRefs.auth = onAuthStateChanged(auth, (user) => {
  //       if (!user) {
  //         goOffline(db);
  //       }
  //     });

  //     unsubscribeRefs.activityTimer = setInterval(async () => {
  //       set(userStatusDatabaseRef, isOnlineForDatabase);
  //     }, 120 * 1000);
  //   }

  //   return () => {
  //     unsubscribeRefs.auth();
  //     // unsubscribeRefs.activityTimer && clearInterval(unsubscribeRefs.activityTimer);
  //   };
  // }, [user]);

  const getMUIModeTheme = (theme?: UserTheme) => {
    if (theme === "Dark") return "dark";
    if (theme === "Light") return "light";
    return "dark";
  };
  const theme = useMemo(() => {
    const currentTheme = getMUIModeTheme(settings.theme);
    const brandingDesignTokens = getDesignTokens(currentTheme);
    let nextTheme = createTheme({
      ...brandingDesignTokens,
      palette: {
        ...brandingDesignTokens.palette,
        mode: currentTheme,
      },
    });

    nextTheme = deepmerge(nextTheme, getThemedComponents(nextTheme));
    return nextTheme;
  }, [settings.theme]);

  return <MuiThemeProvider theme={theme}>{children}</MuiThemeProvider>;
};

// function useThemeDispatch() {
//   const context = useContext(ThemeActionsContext);
//   if (context === undefined) {
//     throw new Error("ThemeActionsContext must be used within a ThemeProvides");
//   }
//   return context;
// }

// const use1AcademyTheme = (): [ThemeActions] => [useThemeDispatch()];

export { ThemeProvider /*, use1AcademyTheme*/ };
