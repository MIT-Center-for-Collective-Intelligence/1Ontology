/* 
# AuthContext.tsx

`AuthContext.tsx` is a TypeScript file that serves as a critical component in managing authentication state within a React application. The file contains the implementation of an `AuthProvider` component, along with associated hooks (`useAuthState`, `useAuthDispatch`, and `useAuth`) to facilitate state management and interaction with Firebase authentication services.

## Components and Hooks

### AuthProvider Component

The `AuthProvider` component is a Functional Component (FC) that takes in children and an optional `store` prop, providing a context for managing authentication state throughout the application. It initializes a context for the authentication state (`AuthStateContext`) and authentication actions (`AuthDispatchContext`). The component utilizes the `useReducer` hook to manage state transitions based on dispatched actions.

#### Props:

- `children`: ReactNode - Child components within the AuthProvider.
- `store`: AuthState - Optional initial state for the authentication context.

#### Error Handling

The component defines a `handleError` function using the `useCallback` hook, allowing for consistent error handling. It displays error messages using the `notistack` library and has the capability to report errors to Google Cloud (TODO).

#### User Loading

The `loadUser` function asynchronously loads user details, including user data and theme, and updates the state accordingly. It handles scenarios where the user is not found and triggers a logout if necessary.

### useEffect

The `useEffect` hook within `AuthProvider` sets up listeners for authentication state changes using Firebase's `onAuthStateChanged`. It performs actions based on whether a user is authenticated or not, including loading user details and updating the state accordingly.

### useContext Hooks

The file provides three custom hooks for interacting with the authentication context:

- `useAuthState`: Retrieves the current authentication state.
- `useAuthDispatch`: Retrieves the authentication dispatch actions.
- `useAuth`: Combines `useAuthState` and `useAuthDispatch` for a convenient tuple result.

## Usage

To use the authentication context in a component, wrap it with the `AuthProvider`:


import { AuthProvider } from './path/to/AppHeader';
*/

import { getAuth, onAuthStateChanged } from "firebase/auth";
import { useSnackbar } from "notistack";
import {
  createContext,
  FC,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from "react";

import { retrieveAuthenticatedUser } from " @components/lib/firestoreClient/auth";
import authReducer, { INITIAL_STATE } from " @components/lib/reducers/auth";
import {
  AuthActions,
  AuthState,
  ErrorOptions,
  UserRole,
} from " @components/types/IAuth";
import { getFirestore } from "firebase/firestore";

const AuthStateContext = createContext<AuthState | undefined>(undefined);
const AuthDispatchContext = createContext<AuthActions | undefined>(undefined);

type Props = {
  children: ReactNode;
  store?: AuthState;
};

const AuthProvider: FC<Props> = ({ children, store }) => {
  const [state, dispatch] = useReducer(authReducer, store || INITIAL_STATE);
  const { enqueueSnackbar } = useSnackbar();

  const handleError = useCallback(
    ({ error, errorMessage, showErrorToast = true }: ErrorOptions) => {
      //TODO: setup error reporting in google cloud
      if (showErrorToast) {
        const errorString = typeof error === "string" ? error : "";
        enqueueSnackbar(
          errorMessage && errorMessage.length > 0 ? errorMessage : errorString,
          {
            variant: "error",
            autoHideDuration: 10000,
          }
        );
      }
    },
    [enqueueSnackbar]
  );

  const loadUser = useCallback(
    async (
      userId: string,
      claims: { [key: string]: boolean },
      emailVerified: boolean
    ) => {
      try {
        const { user, theme } = await retrieveAuthenticatedUser(userId, claims);
        if (!user) {
          handleError({ error: "Cant find user" });
          return;
        }
        if (user) {
          dispatch({
            type: "loginSuccess",
            payload: {
              user,
              theme,
              emailVerified,
            },
          });
        } else {
          dispatch({ type: "logoutSuccess" });
        }
      } catch (error) {
        dispatch({ type: "logoutSuccess" });
      }
    },
    [handleError]
  );

  useEffect(() => {
    const db = getFirestore();
    const auth = getAuth();
    const unsubscriber = onAuthStateChanged(auth, async (user) => {
      dispatch({ type: "setIsLoading", payload: false });
      if (user) {
        const res: any = await user.getIdTokenResult(true);
        const role: UserRole = res.claims["instructor"]
          ? "INSTRUCTOR"
          : res.claims["student"]
          ? "STUDENT"
          : null;
        //sign in
        loadUser(user.uid, res.claims, user.emailVerified);
      } else {
        //sign out
        dispatch({ type: "logoutSuccess" });
      }
    });
    return () => unsubscriber();
  }, [loadUser]);

  const dispatchActions = { dispatch, handleError };

  return (
    <AuthStateContext.Provider value={state}>
      <AuthDispatchContext.Provider value={dispatchActions}>
        {children}
      </AuthDispatchContext.Provider>
    </AuthStateContext.Provider>
  );
};

function useAuthState() {
  const context = useContext(AuthStateContext);
  if (context === undefined) {
    throw new Error("AuthStateContext must be used within a AuthProvider");
  }
  return context;
}

function useAuthDispatch() {
  const context = useContext(AuthDispatchContext);
  if (context === undefined) {
    throw new Error("AuthDispatch must be used with a AuthProvider");
  }
  return context;
}

function useAuth() {
  const res: [AuthState, AuthActions] = [useAuthState(), useAuthDispatch()];
  return res;
}

export { AuthProvider, useAuth };
