/* This code defines an authentication reducer and associated actions for managing user authentication state.
 It includes initial state, handles login/logout actions, sets user theme, and toggles HTML classes based on the selected theme. 
 The reducer follows a switch-case structure to handle different action types.
  The toggleThemeHTML function updates the HTML body class based on the selected theme. */

// Importing necessary types from the specified path
import {
  AuthState,
  DispatchAuthActions,
  UserTheme,
} from "@components/types/IAuth";

// Initial state for the authentication reducer
export const INITIAL_STATE: AuthState = {
  isAuthInitialized: false,
  isAuthenticated: false,
  user: null,
  settings: {
    theme: "Dark", // Default theme is set to "Dark"
  },
  isLoading: false,
  emailVerified: false
};

// Authentication reducer function
function authReducer(state: AuthState, action: DispatchAuthActions): AuthState {
  // Switch case for different action types
  switch (action.type) {
    // Handling logout success action
    case "logoutSuccess":
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isAuthInitialized: true,
      };

    // Handling login success action
    case "loginSuccess":
      toggleThemeHTML(action.payload.theme); // Toggle HTML theme based on the payload
      return {
        ...state,
        ...action.payload,
        isAuthenticated: true,
        settings: {
          theme: action.payload.theme || "Dark", // Default to "Dark" if theme is not provided
        },
        isAuthInitialized: true,
      };

    // Handling set theme action
    case "setTheme":
      toggleThemeHTML(action.payload); // Toggle HTML theme based on the payload
      return {
        ...state,
        settings: { ...state.settings, theme: action.payload },
      };

    // Handling set auth user action
    case "setAuthUser":
      return { ...state, user: action.payload };

    // Handling set loading state action
    case "setIsLoading":
      return { ...state, isLoading: action.payload };
  }

  // Default case, return the current state
  return { ...state };
}

// Function to toggle HTML theme class based on the selected theme
const toggleThemeHTML = (theme: UserTheme) => {
  if (theme === "Dark") {
    document.body.classList.remove("LightMode"); // Remove "LightMode" class for Dark theme
  } else if (theme === "Light") {
    document.body.classList.add("LightMode"); // Add "LightMode" class for Light theme
  }
};

// Exporting the authentication reducer function
export default authReducer;
