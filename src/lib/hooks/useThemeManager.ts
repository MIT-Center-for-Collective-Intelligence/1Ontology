import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@components/components/context/AuthContext';
import {
  collection,
  doc,
  getFirestore,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { LOGS, USERS } from '../firestoreClient/collections';

export const useThemeManager = () => {
  const [authState, { dispatch }] = useAuth();
  // Initialize from localStorage immediately to avoid flash
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('preferred-theme');
      return savedTheme ? savedTheme === 'dark' : true;
    }
    return true;
  });
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const db = getFirestore();

  // Initialize theme on mount and listen for changes
  useEffect(() => {
    // Set loading to false once we have the initial auth state
    setIsAuthLoading(false);

    if (authState.isAuthenticated && authState.settings?.theme) {
      // User is logged in, use their preferred theme from AuthContext
      const newIsDark = authState.settings.theme === 'Dark';
      setIsDark(newIsDark);
      // Sync to localStorage for consistency
      localStorage.setItem('preferred-theme', newIsDark ? 'dark' : 'light');
    } else {
      // User is not logged in, check localStorage (already initialized in state)
      const savedTheme = localStorage.getItem('preferred-theme');
      if (savedTheme) {
        const newIsDark = savedTheme === 'dark';
        setIsDark(newIsDark);
      }
    }
  }, [authState.isAuthenticated, authState.settings?.theme]);

  const handleThemeSwitch = useCallback(async () => {
    const newTheme = !isDark;
    const themeString = newTheme ? 'Dark' : 'Light';
    
    setIsDark(newTheme);

    if (authState.isAuthenticated && authState.user) {
      try {
        // User is logged in, save to Firebase
        const userRef = doc(db, USERS, authState.user.uname);
        await updateDoc(userRef, { theme: themeString });

        // Log the theme change
        const logRef = doc(collection(db, LOGS));
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');

        const doerCreate = `${authState.user.uname}-${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
        await setDoc(logRef, {
          doer: authState.user.uname,
          doerCreate,
          action: 'theme change',
          theme: themeString,
          createdAt: Timestamp.fromDate(new Date()),
        });

        // Update the local auth context
        dispatch({ type: 'setTheme', payload: themeString });
      } catch (error) {
        console.error('useThemeManager: Error saving theme to Firebase:', error);
      }
    } else {
      // User is not logged in, save to localStorage
      localStorage.setItem('preferred-theme', newTheme ? 'dark' : 'light');
    }
  }, [isDark, authState.isAuthenticated, authState.user, db, dispatch]);

  return {
    isDark,
    handleThemeSwitch,
    isAuthenticated: authState.isAuthenticated,
    isAuthLoading
  };
};
