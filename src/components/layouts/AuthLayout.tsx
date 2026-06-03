/* # AuthLayout.tsx

`AuthLayout.tsx` is a TypeScript file that defines the `AuthLayout` component, which serves as the layout for authentication-related pages in a web application. It utilizes the Material-UI library for UI components and Next.js for server-side rendering.

## Dependencies

- `@mui/material`: Material-UI library components for styling.
- `@mui/system`: Material-UI system components.
- `next/image`: Next.js component for optimizing and serving images.
- `next/link`: Next.js component for client-side navigation.
- `next/router`: Next.js utility for handling client-side routing.
- `react`: JavaScript library for building user interfaces.

## Context and State Management

The component uses React context (`createContext`) to manage the state and actions related to the authentication layout. It includes a `useAuth` hook to access authentication-related information.

## Background Images

The layout includes background images based on the selected theme (Dark or Light) using Material-UI's Box component. The images (`darkModeLibraryImage` and `lightModeLibraryImage`) are loaded from the `public` directory.

## Initialization and Redirection

The component checks for authentication initialization and email verification status. If authenticated and email verified, it redirects the user to the specified route using Next.js router.

## Conditional Rendering

The layout renders differently based on the screen size (`useMediaQuery`). The left panel with additional content is displayed only on screens equal to or larger than 600px (`isEqualOrBiggerThanMedium`).

## Left Panel (Large Screens)

- Displays a background image (`darkModeLibraryImage`) with a filter for brightness.
- Includes logos (MIT, Honor, Google Cloud) with external links.
- Displays a welcome message, description, and sign-in/sign-up buttons.

## Right Panel

- Displays the main content area, which includes sign-in/sign-up buttons for small screens.
- Renders children components within a container with a maximum width of 400px.

## Hooks and Providers

- `useAuthDispatch`: Custom hook to access the `AuthLayoutContext` and its actions.
- `useAuthLayout`: Custom hook for setting the background image using the `setBackground` action.

## Export

Exports the `AuthLayout` component as the default export.

For more details and usage, refer to the source code.
 */

import { Avatar, Typography, useMediaQuery } from "@mui/material";
import { Box } from "@mui/system";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  createContext,
  Dispatch,
  FC,
  ReactNode,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import darkModeLibraryImage from "/public/darkModeLibraryBackground.jpg";
import lightModeLibraryImage from "/public/lightModeLibraryBackground.png";
import logoMIT from "/public/MIT-Logo-Dark.png";
// import { use1AcademyTheme } from "../../context/ThemeContext";
import ROUTES from "../../lib/utils/routes";
import FullPageLogoLoading from "./FullPageLogoLoading";
import { AppBackground, AuthLayoutActions } from "@components/types/IAuth";
import { useAuth } from "../context/AuthContext";
import mitLogoDark from "../../../public/MIT-Logo-small-Dark.png";
const AuthLayoutContext = createContext<AuthLayoutActions | undefined>(
  undefined,
);

type Props = {
  children: ReactNode;
};

const AuthLayout: FC<Props> = ({ children }) => {
  const [{ emailVerified, isAuthenticated, isAuthInitialized, settings }] =
    useAuth();
  const router = useRouter();
  const isEqualOrBiggerThanMedium = useMediaQuery("(min-width:600px)");

  const redirectToApp = useCallback(() => {
    let redirectTo =
      router.query.from && router.query.from.length > 0
        ? (router.query.from as string)
        : ROUTES.home;
    router.replace(redirectTo);
  }, [router]);

  useEffect(() => {
    if (isAuthenticated && isAuthInitialized) {
      if (emailVerified) {
        redirectToApp();
      }
    }
  }, [isAuthenticated, isAuthInitialized, redirectToApp, emailVerified]);

  if (!isAuthInitialized || (isAuthenticated && emailVerified)) {
    return <FullPageLogoLoading />;
  }

  return (
    <Box sx={{ position: "relative", width: "100vw", height: "100vh" }}>
      {/* Background Image */}
      <Box
        data-testid="auth-layout"
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: -2,
          backgroundImage: `url(${
            settings.theme === "Dark"
              ? darkModeLibraryImage.src
              : lightModeLibraryImage.src
          })`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          filter:
            settings.theme === "Dark"
              ? "brightness(0.95) saturate(1.1)"
              : "brightness(1.05) saturate(1.05)",
        }}
      />
      {/* Background overlay for contrast + depth */}
      <Box
        aria-hidden
        sx={{
          position: "fixed",
          inset: 0,
          zIndex: -1,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.70) 70%, rgba(0,0,0,0.78) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Main Container */}
      <Box
        sx={{
          width: "100vw",
          height: { xs: "auto", md: "100vh" },
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          px: { xs: 2, md: 3 },
          py: { xs: 2, md: 3 },
        }}
      >
        <Box
          sx={{
            width: "min(1300px, 100%)",
            height: { xs: "100vh", md: "95vh" },
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            color: "white",
            borderRadius: "28px",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(18, 18, 22, 0.55)",
            backdropFilter: "blur(14px)",
            boxShadow:
              "0 40px 120px rgba(0,0,0,0.60), inset 0 1px 0 rgba(255,255,255,0.06)",
            overflow: "hidden",
          }}
        >
          {isEqualOrBiggerThanMedium && (
            <Box
              sx={{
                width: "100%",
                height: "inherit",
                px: { xs: 2, md: 3 },
                position: "relative",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                overflow: "hidden",
              }}
            >
              <Box
                aria-hidden
                sx={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: `url(${
                    settings.theme === "Dark"
                      ? darkModeLibraryImage.src
                      : lightModeLibraryImage.src
                  })`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  filter: "blur(6px) saturate(1.1)",
                  transform: "scale(1.06)",
                  zIndex: 0,
                }}
              />
              <Box
                aria-hidden
                sx={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.70) 60%, rgba(0,0,0,0.78) 100%)",
                  zIndex: 0,
                }}
              />
              <Box
                aria-hidden
                sx={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "radial-gradient(700px 520px at 50% 35%, rgba(255,255,255,0.06), transparent 60%)",
                  zIndex: 0,
                  pointerEvents: "none",
                }}
              />
              <Box sx={{ zIndex: 1, textAlign: "center" }}>
                <a
                  rel="noreferrer"
                  target="_blank"
                  href="https://www.mit.edu/"
                  aria-label="Go to School of Information"
                >
                  <Avatar
                    src={mitLogoDark.src}
                    alt="MIT logo"
                    sx={{
                      cursor: "pointer",
                      width: "144px",
                      height: "auto",
                      borderRadius: 0,
                      mx: "auto",
                      filter: "drop-shadow(0 18px 35px rgba(0,0,0,0.55))",
                    }}
                  />
                </a>

                <Typography
                  textAlign="center"
                  variant="caption"
                  mt={1}
                  sx={{
                    fontWeight: 900,
                    fontSize: "28px",
                    letterSpacing: "-0.02em",
                    color: "rgba(255,255,255,0.92)",
                    textShadow: "0 18px 45px rgba(0,0,0,0.55)",
                  }}
                >
                  The Ontology of Collective Intelligence
                </Typography>
                <Typography
                  sx={{
                    mt: 1.25,
                    maxWidth: 520,
                    mx: "auto",
                    color: "rgba(255,255,255,0.72)",
                    fontSize: "1.05rem",
                    lineHeight: 1.55,
                  }}
                >
                  Build, explore, and connect ideas with a calm, focused
                  workspace.
                </Typography>
              </Box>
              {/*      <Box
                aria-label="sign in and sign up options"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  width: "70%",
                  py: "4px",
                  pl: "4px",
                  pr: "10px",
                  gap: "6px",
                  mb: "16px",
                  mt: "16px",
                  borderRadius: "999px",
                  position: "relative",
                  overflow: "hidden",
                  bgcolor: "transparent",
                  background: (theme) =>
                    theme.palette.mode === "dark"
                      ? "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))"
                      : "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.74))",
                  border: "1px solid",
                  borderColor: (theme) =>
                    theme.palette.mode === "dark"
                      ? "rgba(255,255,255,0.20)"
                      : "rgba(17,17,17,0.10)",
                  backdropFilter: "blur(18px) saturate(140%)",
                  boxShadow: (theme) =>
                    theme.palette.mode === "dark"
                      ? "inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -1px 0 rgba(0,0,0,0.30), 0 14px 40px rgba(0,0,0,0.42)"
                      : "inset 0 1px 0 rgba(255,255,255,0.65), 0 12px 28px rgba(15, 23, 42, 0.10)",
                  "&::before": {
                    content: '""',
                    position: "absolute",
                    inset: 0,
                    background:
                      "radial-gradient(180px 120px at 20% 0%, rgba(255,255,255,0.20), transparent 60%), radial-gradient(220px 140px at 85% 100%, rgba(255,255,255,0.10), transparent 58%)",
                    pointerEvents: "none",
                  },
                }}
              >
                {(() => {
                  const active =
                    router.pathname === ROUTES.signUp ? "signup" : "login";

                  const pillSx = {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: 1,
                    minWidth: 0,
                    height: 60,
                    borderRadius: "999px",
                    textDecoration: "none",
                    textDecorationColor: "transparent",
                    WebkitTextDecorationColor: "transparent",
                    fontWeight: 800,
                    fontSize: "1.32rem",
                    letterSpacing: "-0.01em",
                    transition:
                      "color 180ms ease, transform 180ms ease, background-color 180ms ease",
                    "&:active": { transform: "translateY(0.5px)" },
                    "&:hover": {
                      textDecoration: "none",
                      textDecorationColor: "transparent",
                      WebkitTextDecorationColor: "transparent",
                    },
                  } as const;

                  return (
                    <Box
                      sx={{
                        position: "relative",
                        display: "flex",
                        width: "100%",
                        gap: "6px",
                      }}
                    >
                      <Box
                        aria-hidden
                        sx={{
                          position: "absolute",
                          top: 4,
                          bottom: 4,
                          left: 4,
                          width: "calc(50% - 3px)",
                          borderRadius: "999px",
                          transform:
                            active === "login"
                              ? "translateX(0)"
                              : "translateX(calc(100% + 6px))",
                          transition: "transform 220ms ease",
                          background: (theme) =>
                            theme.palette.mode === "dark"
                              ? "linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.10))"
                              : "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.82))",
                          border: (theme) =>
                            theme.palette.mode === "dark"
                              ? "1px solid rgba(255,255,255,0.20)"
                              : "1px solid rgba(17,17,17,0.08)",
                          boxShadow: (theme) =>
                            theme.palette.mode === "dark"
                              ? "inset 0 1px 0 rgba(255,255,255,0.26), inset 0 -1px 0 rgba(0,0,0,0.32), 0 10px 26px rgba(0,0,0,0.32)"
                              : "0 12px 24px rgba(15, 23, 42, 0.10)",
                          backdropFilter: "blur(16px) saturate(140%)",
                          WebkitBackdropFilter: "blur(16px) saturate(140%)",
                        }}
                      />
                      <Link href={ROUTES.signIn} legacyBehavior passHref>
                        <Box
                          component="a"
                          sx={{
                            ...pillSx,
                            width: "100%",
                            position: "relative",
                            zIndex: 1,
                            color: (theme) =>
                              active === "login"
                                ? theme.palette.mode === "dark"
                                  ? "#ffffff"
                                  : "#111827"
                                : theme.palette.mode === "dark"
                                  ? "rgba(255,255,255,0.78)"
                                  : "rgba(17,24,39,0.75)",
                          }}
                        >
                          Sign In
                        </Box>
                      </Link>
                      <Link href={ROUTES.signUp} legacyBehavior passHref>
                        <Box
                          component="a"
                          sx={{
                            ...pillSx,
                            width: "100%",
                            position: "relative",
                            zIndex: 1,
                            color: (theme) =>
                              active === "signup"
                                ? theme.palette.mode === "dark"
                                  ? "#ffffff"
                                  : "#111827"
                                : theme.palette.mode === "dark"
                                  ? "rgba(255,255,255,0.78)"
                                  : "rgba(17,24,39,0.75)",
                          }}
                        >
                          Sign Up
                        </Box>
                      </Link>
                    </Box>
                  );
                })()}
              </Box> */}
            </Box>
          )}

          <Box
            sx={{
              width: "100%",
              height: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              background:
                "linear-gradient(135deg, rgba(40, 40, 44, 0.92), rgba(20, 20, 24, 0.82))",
            }}
          >
            <Box
              aria-hidden
              sx={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(700px 520px at 70% 20%, rgba(255, 255, 255, 0.05), transparent 60%), radial-gradient(700px 520px at 25% 85%, rgba(0, 0, 0, 0.12), transparent 62%)",
                pointerEvents: "none",
              }}
            />
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

const useAuthDispatch = () => {
  const context = useContext(AuthLayoutContext);
  if (context) return context;
  throw new Error("AuthLayoutContext must be used within a AuthLayoutProvider");
};

export const useAuthLayout = (): [
  setBackground: Dispatch<SetStateAction<AppBackground>>,
] => [useAuthDispatch().setBackground];

export default AuthLayout;

{
  /* Login / Signup Buttons (mobile only) */
}
{
}
