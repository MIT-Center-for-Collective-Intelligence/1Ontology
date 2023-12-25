import {
  AuthState,
  DispatchAuthActions,
  UserTheme,
} from " @components/types/IAuth";

export const INITIAL_STATE: AuthState = {
  isAuthInitialized: false,
  isAuthenticated: false,
  user: null,
  settings: {
    theme: "Dark",
  },
  isLoading: false,
};

function authReducer(state: AuthState, action: DispatchAuthActions): AuthState {
  switch (action.type) {
    case "logoutSuccess":
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isAuthInitialized: true,
      };
    case "loginSuccess":
      toggleThemeHTML(action.payload.theme);
      return {
        ...state,
        ...action.payload,
        isAuthenticated: true,
        settings: {
          theme: action.payload.theme,
        },
        isAuthInitialized: true,
      };
    case "setTheme":
      toggleThemeHTML(action.payload);
      return {
        ...state,
        settings: { ...state.settings, theme: action.payload },
      };

    case "setAuthUser":
      return { ...state, user: action.payload };

    case "setIsLoading":
      return { ...state, isLoading: action.payload };
  }
  return { ...state };
}
const toggleThemeHTML = (theme: UserTheme) => {
  if (theme === "Dark") {
    document.body.classList.remove("LightMode");
  } else if (theme === "Light") {
    document.body.classList.add("LightMode");
  }
};

export default authReducer;
