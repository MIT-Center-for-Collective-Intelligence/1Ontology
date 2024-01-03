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

import { Button, Typography, useMediaQuery } from "@mui/material";
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

import darkModeLibraryImage from "../../../public/darkModeLibraryBackground.jpg";
import lightModeLibraryImage from "../../../public/lightModeLibraryBackground.png";
import logoGoogleCloud from "../../../public/logo-google-cloud.svg";
import logoHonor from "../../../public/logo-honor.jpeg";
import logoMIT from "../../../public/MIT-Logo-Dark.png";
// import { use1AcademyTheme } from "../../context/ThemeContext";
import ROUTES from "../../lib/utils/routes";
import FullPageLogoLoading from "./FullPageLogoLoading";
import { AppBackground, AuthLayoutActions } from " @components/types/IAuth";
import { useAuth } from "../context/AuthContext";

const AuthLayoutContext = createContext<AuthLayoutActions | undefined>(
  undefined
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
        : ROUTES.ciontology;
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
    <Box>
      {settings.theme === "Dark" && (
        <Box
          data-testid="auth-layout"
          sx={{
            width: "100vw",
            height: "100vh",
            position: "fixed",
            filter: "brightness(1.95)",
            zIndex: -2,
          }}
        >
          <Image
            alt="Library"
            src={darkModeLibraryImage}
            layout="fill"
            objectFit="cover"
            priority
          />
        </Box>
      )}
      {settings.theme === "Light" && (
        <Box
          data-testid="auth-layout"
          sx={{
            width: "100vw",
            height: "100vh",
            position: "fixed",
            // filter: "brightness(1.4)",
            zIndex: -2,
          }}
        >
          <Image
            alt="Library"
            src={lightModeLibraryImage}
            layout="fill"
            objectFit="cover"
            priority
          />
        </Box>
      )}

      <Box
        sx={{
          width: "100vw",
          height: { xs: "auto", md: "100vh" },
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Box
          sx={{
            width: "1300px",
            height: { xs: "100vh", md: "95vh" },
            display: "flex",
            flexDirection: { sx: "column", md: "row" },
            color: (theme) => theme.palette.common.white,
            background: (theme) =>
              settings.theme === "Dark"
                ? theme.palette.common.darkGrayBackground
                : theme.palette.common.white,
            // backgroundImage: `url(${settings.theme === "Dark" ? darkModeLibraryImage.src : lightModeLibraryImage.src})`,
          }}
        >
          {/* left panel */}
          {isEqualOrBiggerThanMedium && (
            <Box
              sx={{
                width: "100%",
                height: "inherit",
                px: "16px",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {/* this this image has absolute position, by their configuration */}
              {settings.theme === "Dark" && (
                <Image
                  alt="Library"
                  src={darkModeLibraryImage}
                  layout="fill"
                  objectFit="cover"
                  priority
                  // style={{ filter: "blur(4px)" }}
                />
              )}
              <Box
                sx={{
                  width: "200px",
                  height: "40px",
                  position: "absolute",
                  bottom: "15px",
                  left: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <a
                  rel="noreferrer"
                  target="_blank"
                  href="https://www.mit.edu/"
                  aria-label="Go to School of information"
                >
                  <Image
                    src={logoMIT}
                    alt="School of Information"
                    height={100}
                    width={150}
                  />
                </a>
                {/* <a
                  rel="noreferrer"
                  target="_blank"
                  href="https://www.honor.education/"
                  aria-label="Go to Honor Education"
                >
                  <Image
                    src={logoHonor}
                    alt="Honor Education"
                    height={41}
                    width={41}
                  />
                </a>
                <a
                  rel="noreferrer"
                  target="_blank"
                  href="https://cloud.google.com/edu/researchers"
                  aria-label="Go to Google Cloud"
                >
                  <Image
                    src={logoGoogleCloud}
                    alt="Google Cloud"
                    height={41}
                    width={49}
                  />
                </a> */}
              </Box>
              <Box sx={{ zIndex: 1 }}>
                <Typography textAlign={"center"} variant="h1">
                  Welcome
                </Typography>
                <Typography textAlign={"center"} variant="caption">
                  We Visualize Learning Pathways from Books & Research Papers.
                </Typography>
                <Box
                  aria-label="sign in and sing up options"
                  sx={{
                    border: "solid 2px",
                    borderColor: (theme) =>
                      theme.palette.mode === "dark"
                        ? "common.white"
                        : "common.black",
                    mt: "16px",
                  }}
                >
                  <Link href={ROUTES.signIn}>
                    <Button
                      color="secondary"
                      variant={
                        router.pathname === ROUTES.signIn
                          ? "contained"
                          : "outlined"
                      }
                      sx={{
                        width: "50%",
                        p: "12px 16px",
                        textAlign: "center",
                        borderRadius: "0px",
                        border: "0px",
                      }}
                    >
                      LOG IN
                    </Button>
                  </Link>
                  <Link href={ROUTES.signUp}>
                    <Button
                      color="secondary"
                      variant={
                        router.pathname === ROUTES.signUp
                          ? "contained"
                          : "outlined"
                      }
                      sx={{
                        width: "50%",
                        p: "12px 16px",
                        textAlign: "center",
                        borderRadius: "0px",
                        border: "0px",
                      }}
                    >
                      SIGN UP
                    </Button>
                  </Link>
                </Box>
              </Box>
            </Box>
          )}
          {/* right panel */}
          <Box sx={{ width: "100%", height: "inherit" }}>
            <Box sx={{ height: "inherit", width: "100%", overflowY: "auto" }}>
              <Box sx={{ maxWidth: "400px", py: "40px", mx: "auto" }}>
                {!isEqualOrBiggerThanMedium && (
                  <Box
                    aria-label="sign in and sing up options"
                    sx={{
                      border: "solid 2px",
                      borderColor: (theme) =>
                        theme.palette.mode === "dark"
                          ? "common.white"
                          : "common.black",
                      mb: "16px",
                    }}
                  >
                    <Link href={ROUTES.signIn}>
                      <Button
                        color="secondary"
                        variant={
                          router.pathname === ROUTES.signIn
                            ? "contained"
                            : "outlined"
                        }
                        sx={{
                          width: "50%",
                          p: "12px 16px",
                          textAlign: "center",
                          borderRadius: "0px",
                          border: "0px",
                        }}
                      >
                        LOG IN
                      </Button>
                    </Link>
                    <Link href={ROUTES.signUp}>
                      <Button
                        color="secondary"
                        variant={
                          router.pathname === ROUTES.signUp
                            ? "contained"
                            : "outlined"
                        }
                        sx={{
                          width: "50%",
                          p: "12px 16px",
                          textAlign: "center",
                          borderRadius: "0px",
                          border: "0px",
                        }}
                      >
                        SIGN UP
                      </Button>
                    </Link>
                  </Box>
                )}
                {children}
              </Box>
            </Box>
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
  setBackground: Dispatch<SetStateAction<AppBackground>>
] => [useAuthDispatch().setBackground];

export default AuthLayout;
