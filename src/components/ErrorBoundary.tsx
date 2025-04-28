/* 
# ErrorBoundary Component

The `ErrorBoundary` component is a React class component designed to catch JavaScript errors anywhere in the child component tree, log those errors, and display a fallback UI instead of the component tree that crashed. This component enhances the user experience by handling unexpected runtime errors and providing a way for users to reload the application.

## Usage

Wrap any part of your component tree with the `ErrorBoundary` component to handle errors gracefully within that section of your app.

``` */

import { Button, Stack, Typography } from "@mui/material";
import { getFirestore } from "firebase/firestore";
import React, { ReactNode } from "react";

import { addClientErrorLog } from "@components/lib/firestoreClient/errors.firestore";
import { DESIGN_SYSTEM_COLORS } from "@components/lib/theme/colors";
import { CustomError } from "@components/lib/utils/customError";
import { getAuth, onAuthStateChanged } from "firebase/auth";

type ErrorBoundaryProps = { children: ReactNode };
type ErrorBoundaryState = { hasError: boolean };

class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  db = getFirestore();
  constructor(props: ErrorBoundaryProps) {
    super(props);

    // Define a state variable to track whether is an error or not
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(/* error: Error */) {
    // Update state so the next render will show the fallback UI

    return { hasError: true };
  }
  componentDidCatch(error: CustomError, errorInfo: React.ErrorInfo) {
    // You can use your own error logging service here
    console.error("|>", { error, errorInfo });
    addClientErrorLog(this.db, {
      ...error.options,
      ...errorInfo,
    });
  }

  render() {
    // Check if the error is thrown
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <Stack
          alignItems={"center"}
          justifyContent={"center"}
          spacing={"20px"}
          sx={{
            p: "20px",
            minHeight: "100vh",
          }}
        >
          <Typography
            variant="h2"
            sx={{
              fontSize: { xs: "40px", md: "60px" },
              fontWeight: 500,
              textAlign: "center",
            }}
          >
            Oops, there is an error!
          </Typography>
          <Typography sx={{ fontSize: "20px", textAlign: "center" }}>
            Our team is actively working to fix the issue. Please try again
            later. Thank you for your patience.
          </Typography>
          <Button
            onClick={() => location.reload()}
            variant="contained"
            sx={{
              background: DESIGN_SYSTEM_COLORS.primary800,
              fontSize: 16,
              borderRadius: 40,
              textTransform: "capitalize",
              ":hover": {
                background: DESIGN_SYSTEM_COLORS.primary900,
              },
            }}
          >
            Try again?
          </Button>
        </Stack>
      );
    }

    // Return children components in case of no error

    return this.props.children;
  }
}

export default ErrorBoundary;
