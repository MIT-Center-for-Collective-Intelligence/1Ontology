/* This is a React component for a "Forgot Password" page. It uses Firebase for authentication, Formik for form handling, and Material UI for styling. Here's a breakdown of the code:

1. **Imports**: The code begins by importing necessary modules and components. These include Firebase authentication functions, Formik for form handling, Material UI components for UI, and other custom components and utilities.

2. **Interface**: An interface `ForgotPasswordFormValues` is defined to type-check the form values. It expects an `email` string.

3. **Component Definition**: The `ForgotPage` component is defined as a functional component. It uses Firebase's `getAuth` function to initialize an instance of Firebase Auth.

4. **Hooks**: Several hooks are used within the component:
   - `useAuth` is a custom hook that provides authentication-related functions and state.
   - `useSnackbar` is a hook from the `notistack` library that provides functions to display snackbars (temporary little messages) to the user.
   - `useState` is a React hook that's used to manage the loading state of the form.
   - `useFormik` is a hook from the Formik library that provides functions and state for form handling.

5. **Form Handling**: The `handleSignIn` function is defined to handle form submission. It sends a password reset email to the provided email address and handles any errors that occur.

6. **Formik Setup**: Formik is set up with initial form values, a validation schema (using Yup), and the `handleSignIn` function as the form submission handler.

7. **Rendering**: The component returns a form with a text field for the email address and a submit button. It uses Material UI components for styling. The form is wrapped in a `Box` component for layout and spacing.

8. **Layout**: The `getLayout` function is defined to wrap the page in an `AuthLayout` component. This is a common pattern for applying a consistent layout across multiple pages.

9. **Export**: Finally, the `ForgotPage` component is exported for use in other parts of the application.

This code assumes that you have set up Firebase authentication, Formik, Material UI, and the `notistack` library in your project. It also assumes that you have defined the `useAuth` hook, `AuthLayout` component, and other imported modules in your codebase.
 */
import { useAuth } from "@components/components/context/AuthContext";
import AuthLayout from "@components/components/layouts/AuthLayout";
import { getFirebaseFriendlyError } from "@components/lib/utils/firebaseErrors";
import ROUTES from "@components/lib/utils/routes";
import { NextPageWithLayout } from "@components/types/IAuth";
import { LoadingButton } from "@mui/lab";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  GlobalStyles,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { FirebaseError } from "firebase/app";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import { useFormik } from "formik";
import NextLink from "next/link";
import { useSnackbar } from "notistack";
import React, { ReactNode, useState } from "react";
import * as yup from "yup";

interface ForgotPasswordFormValues {
  email: string;
}

const ForgotPage: NextPageWithLayout = () => {
  const auth = getAuth();
  const [, { handleError }] = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const initialValues: ForgotPasswordFormValues = {
    email: "",
  };

  const validationSchema = yup.object({
    email: yup.string().email("Invalid email address!"),
  });
  const handleSignIn = async ({ email }: ForgotPasswordFormValues) => {
    try {
      setIsLoading(true);
      setStatusMessage(null);

      await sendPasswordResetEmail(auth, email);
      const msg =
        "We have sent an email for reset the password to your email address.";
      setStatusMessage(msg);
    /*   enqueueSnackbar(msg, {
        variant: "success",
        autoHideDuration: 10000,
      }); */
    } catch (error) {
      const err = error as FirebaseError;
      const errorStrig = getFirebaseFriendlyError(err);
      handleError({
        error,
        errorMessage: `${errorStrig} Check if your email address is correct. `,
      });
    }
    setIsLoading(false);
  };

  const formik = useFormik({
    initialValues,
    validationSchema,
    onSubmit: handleSignIn,
  });

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        px: { xs: 2, sm: 3 },
        py: { xs: 4, sm: 6 },
      }}
    >
      <Paper
        elevation={6}
        sx={{
          p: { xs: 3, sm: 5 },
          borderRadius: "28px",
          maxWidth: 420,
          width: "100%",
          mx: "auto",
          textAlign: "center",
          border: "1px solid rgba(255,255,255,0.12)",
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)) !important",
          boxShadow:
            "0 22px 70px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        <Typography
          sx={{
            mb: 0.75,
            fontWeight: 900,
            letterSpacing: "-0.02em",
            background:
              "linear-gradient(90deg, rgba(255, 184, 77, 0.98) 0%, rgba(255,255,255,0.92) 38%, rgba(255, 140, 0, 0.98) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            fontSize: { xs: "30px", sm: "44px" },
          }}
        >
          Reset password
        </Typography>
        <Typography
          sx={{
            mb: 3.25,
            color: "rgba(255,255,255,0.70)",
            fontSize: { xs: "0.98rem", sm: "1.05rem" },
            lineHeight: 1.4,
          }}
        >
          Enter your email and we’ll send a reset link.
        </Typography>
        <GlobalStyles
          styles={{
            "& input:-webkit-autofill": {
              boxShadow: `0px 0px 0px 100px #313131 inset !important`,
              WebkitTextFillColor: `${"#fff"} !important`,
              caretColor: "#fff !important",
            },
          }}
        />
      <form data-testid="signin-form" onSubmit={formik.handleSubmit}>
        {statusMessage ? (
          <Alert
            severity="success"
            onClose={() => setStatusMessage(null)}
            icon={false}
            sx={{
              mb: 3,
              textAlign: "left",
              borderRadius: "18px",
              border: "1px solid rgba(255, 184, 77, 0.35)",
              background:
                "linear-gradient(135deg, rgba(255, 140, 0, 0.14), rgba(255, 255, 255, 0.05))",
              backdropFilter: "blur(10px)",
              boxShadow:
                "0 18px 45px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)",
              "& .MuiAlert-message": { width: "100%" },
              "& .MuiAlert-action": { pt: 0.75 },
            }}
          >
            <AlertTitle
              sx={{
                mb: 0.5,
                fontWeight: 800,
                letterSpacing: "0.2px",
                color: "rgba(255,255,255,0.95)",
              }}
            >
              Email sent
            </AlertTitle>
            <Typography
              variant="body2"
              sx={{
                color: "rgba(255,255,255,0.85)",
                lineHeight: 1.5,
                fontSize: "0.95rem",
              }}
            >
              {statusMessage}
            </Typography>
          </Alert>
        ) : null}
        <TextField
          id="email"
          name="email"
          label="Email"
          type="email"
          value={formik.values.email}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          variant="outlined"
          error={Boolean(formik.errors.email) && Boolean(formik.touched.email)}
          helperText={formik.errors.email}
          fullWidth
          sx={{
            mb: 3,
            "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.70)" },
            "& .MuiInputLabel-root.Mui-focused": {
              color: "rgba(255,255,255,0.88)",
            },
            "& .MuiFormHelperText-root": {
              color: "rgba(255, 160, 160, 0.95)",
            },
          }}
          InputProps={{
            sx: {
              fontSize: "17px",
              borderRadius: "18px",
              color: "rgba(255,255,255,0.92)",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))",
              "& .MuiOutlinedInput-notchedOutline": {
                borderRadius: "18px",
                borderColor: "rgba(255,255,255,0.18)",
              },
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: "rgba(255,255,255,0.28)",
              },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                borderColor: "rgba(255, 140, 0, 0.65)",
                boxShadow: "0 0 0 4px rgba(255, 140, 0, 0.18)",
              },
            },
          }}
        />
        <Box
          sx={{
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            mt: 1,
          }}
        >
          <LoadingButton
            aria-label="submit"
            loading={isLoading}
            disabled={formik.isSubmitting}
            type="submit"
            variant="contained"
            fullWidth
            sx={{
              borderRadius: "999px",
              py: 1.25,
              fontWeight: 800,
              fontSize: "14px",
              letterSpacing: "0.6px",
              textTransform: "none",
              width: "100%",
              maxWidth: 240,
              color: "rgba(20, 20, 20, 0.92)",
              textShadow: "0 1px 0 rgba(255,255,255,0.35)",
              background:
                "linear-gradient(90deg, rgba(255, 140, 0, 1) 0%, rgba(255, 184, 77, 0.98) 55%, rgba(255, 99, 71, 0.95) 100%)",
              boxShadow: "0 18px 40px rgba(255, 140, 0, 0.22)",
              transition: "transform 120ms ease, box-shadow 120ms ease",
              "&:hover": {
                background:
                  "linear-gradient(90deg, rgba(255, 155, 40, 1) 0%, rgba(255, 200, 120, 1) 55%, rgba(255, 120, 90, 1) 100%)",
                boxShadow: "0 22px 55px rgba(255, 140, 0, 0.30)",
                transform: "translateY(-1px)",
              },
              "&:active": { transform: "translateY(0px)" },
            }}
          >
            Send Email
          </LoadingButton>
          <NextLink href={ROUTES.signIn} passHref>
            <Button
              sx={{
                mt: 2.5,
                textTransform: "none",
                fontSize: "14px",
                fontWeight: 650,
                borderRadius: "999px",
                color: "rgba(255,255,255,0.75)",
                px: 1.25,
                "&:hover": {
                  color: "rgba(255,255,255,0.92)",
                  backgroundColor: "rgba(255,255,255,0.06)",
                },
              }}
            >
              Back to sign in
            </Button>
          </NextLink>
        </Box>
      </form>
      </Paper>
    </Box>
  );
};

ForgotPage.getLayout = (page: ReactNode) => {
  return <AuthLayout>{page}</AuthLayout>;
};

export default ForgotPage;
