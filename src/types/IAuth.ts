import { AppProps } from "next/app";
import { NextPage } from "next/types";
import { Dispatch, ReactElement, ReactNode, SetStateAction } from "react";

export type FilterValue = {
  id: string;
  name: string;
  imageUrl?: string | undefined;
};

export type FilterProcessedReferences = {
  id: string;
  title: string;
  data: { label: string; node: string }[];
};

export type TypesenseProcessedReferences = {
  title: string;
  data: { label: string; node: string }[];
};

export type StatsSchema = {
  institutions: string;
  users: string;
  proposals: string;
  nodes: string;
  links: string;
  communities?: string;
};

export type SearchNodesParams = {
  q?: string | string[];
  upvotes?: boolean;
  mostRecent?: boolean;
  timeWindow?: string | string[];
  tags?: string | string[];
  institutions?: string | string[];
  contributors?: string | string[];
  reference?: string | string[];
  label?: string | string[];
  nodeTypes?: string | string[];
  page?: number;
};

export type FeedbackInput = {
  name: string;
  email: string;
  feedback: string;
  pageURL: string;
};

export type Feedback = FeedbackInput & {
  createdAt: string;
};

export type UserTheme = "Dark" | "Light";

export type UserBackground = "Color" | "Image";

export type UserRole = "INSTRUCTOR" | "STUDENT" | null;

export type User = {
  userId: string;
  imageUrl: string;
  fName: string;
  lName: string;
  uname: string;
  email: string;
  claims: any;
  rightPanel: boolean;
  currentNode: string;
  manageLock: boolean;
  copilot: boolean;
};

export type UserSettings = {
  theme: UserTheme;
};
export interface AuthState {
  readonly isAuthenticated: boolean;
  readonly isAuthInitialized: boolean;
  readonly user: User | null;
  readonly settings: UserSettings;
  readonly isLoading: boolean;
  readonly emailVerified: boolean;
}

export type AuthActions = {
  dispatch: Dispatch<DispatchAuthActions>;
  handleError: (options: ErrorOptions) => void;
};

export type ErrorOptions = {
  error: unknown;
  showErrorToast?: boolean;
  errorMessage?: string;
};

export type AuthLogoutSuccessAction = {
  type: "logoutSuccess";
};

export type AuthLoginSuccessAction = {
  type: "loginSuccess";
  payload: {
    user: User;
    theme: UserTheme;
    emailVerified: boolean;
  };
};

export type SetThemeAction = {
  type: "setTheme";
  payload: UserTheme;
};

export type SetBackgroundAction = {
  type: "setBackground";
  payload: UserBackground;
};
export type SetShowClusterOptionsAction = {
  type: "setShowClusterOptions";
  payload: boolean;
};
export type SetShowClustersAction = {
  type: "setShowClusters";
  payload: boolean;
};
export type SetAuthUserAction = {
  type: "setAuthUser";
  payload: User;
};

export type SetIsLoadingAction = {
  type: "setIsLoading";
  payload: boolean;
};
export type DispatchAuthActions =
  | AuthLogoutSuccessAction
  | AuthLoginSuccessAction
  | SetThemeAction
  | SetBackgroundAction
  | SetAuthUserAction
  | SetIsLoadingAction;
export type SignUpValidation = {
  uname?: string;
  email?: string;
  institutionName?: String;
};

export type ResponseAPI<T> = {
  results?: T;
  errorMessage?: string;
};

export interface SignUpFormValues {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  password: string;
  theme: "Light" | "Dark";
  passwordConfirmation: string;
}

export interface SignUpData extends Omit<User, "userId" | "role"> {
  password: string;
  background: UserBackground;
  theme: UserTheme;
  course?: string | null;
  courseInstructor?: string | null;
}

export type ThemeActions = {
  setThemeMode: Dispatch<SetStateAction<AppTheme>>;
  themeMode: AppTheme;
};

export type AppTheme = "light" | "dark";

export type AppBackground = "Color" | "Image";

export type AuthLayoutActions = {
  setBackground: Dispatch<SetStateAction<AppBackground>>;
};

export type AppPropsWithLayout = AppProps & {
  Component: any;
  emotionCache?: any;
};

export type NextPageWithLayout<P = {}> = NextPage<P> & {
  getLayout?: (page: ReactElement) => ReactNode;
};
