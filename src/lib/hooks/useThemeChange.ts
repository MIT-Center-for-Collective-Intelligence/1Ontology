/* Custom React hook for handling user theme changes and updating Firestore database with theme preferences and change logs.
 Utilizes Firebase's Firestore for data storage and the AuthContext for user authentication. 
 The hook provides a function, handleThemeSwitch, which toggles between "Dark" and "Light" themes, updates the user document, 
 and logs the change in a separate collection. */

// Import necessary modules and components

import { useAuth } from " @components/components/context/AuthContext";
import {
  collection,
  doc,
  getFirestore,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { useCallback } from "react";
import { LOGS, USERS } from "../firestoreClient/collections";

// Custom hook for handling theme changes
const useThemeChange = () => {
  // Initialize Firestore database instance
  const db = getFirestore();

  // Destructure user and settings from authentication context
  const [{ user, settings }, { dispatch }] = useAuth();

  // Callback function for changing a user attribute (e.g., theme)
  const changeAttr = useCallback(
    () => async (newValue: any) => {
      // Check if user is logged in
      if (!user) return;
      // Reference to the user document in Firestore
      const userRef = doc(db, USERS, user.uname);

      // Update the theme attribute in the user document
      await updateDoc(userRef, { ["theme"]: newValue });

      // Reference to a new document in the user theme change log collection
      const logRef = doc(collection(db, LOGS));

      // Set document with user theme change details
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");

      const doerCreate = `${user?.uname}-${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
      await setDoc(logRef, {
        doer: user.uname,
        doerCreate,
        action: "theme change",
        ["theme"]: newValue,
        createdAt: Timestamp.fromDate(new Date()),
      });
    },
    [db, user]
  );

  // Callback function for handling theme switch event
  const handleThemeSwitch = useCallback(
    (event: any) => {
      event.preventDefault();

      // Determine the new theme based on the current theme
      const newTheme = settings.theme === "Dark" ? "Light" : "Dark";

      // Call the changeAttr callback to update the theme
      changeAttr()(newTheme);

      // Dispatch an action to update the theme in the local state
      dispatch({ type: "setTheme", payload: newTheme });
    },
    [changeAttr, dispatch, settings.theme]
  );

  // Return the handleThemeSwitch function for use in components
  return [handleThemeSwitch];
};

// Export the useThemeChange hook
export default useThemeChange;
