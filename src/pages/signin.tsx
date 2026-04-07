/* 
This is a React component for a sign-in page. It uses Formik for form handling, Yup for form validation, and Firebase for authentication. 

1. The `SignInFormValues` interface is defined to specify the shape of the form values.

2. The `SignInPage` component is defined. It uses the `useAuth` hook to get the `handleError` function, and the `useSnackbar` hook to display notifications to the user.

3. The `initialValues` object is defined to set the initial values of the form fields.

4. The `validationSchema` object is defined using Yup to specify the validation rules for the form fields.

5. The `handleSignIn` function is defined to handle the form submission. It calls the `signIn` function with the form values, checks if the user's email is verified, and handles any errors that occur.

6. The `formik` object is created using the `useFormik` hook with the `initialValues`, `validationSchema`, and `onSubmit` function.

7. The component returns a form with two text fields for the email and password, and a submit button. The form uses the `formik` object for handling the form state and events.

8. The `getLayout` function is defined on the component to specify the layout to be used for this page. It wraps the page in the `AuthLayout` component.

9. The `SignInPage` component is exported as the default export of the module.*/
import { useAuth } from "@components/components/context/AuthContext";
import AuthLayout from "@components/components/layouts/AuthLayout";
import { signIn } from "@components/lib/firestoreClient/auth";
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
import { useFormik } from "formik";
import NextLink from "next/link";
import { useSnackbar } from "notistack";
import React, { ReactNode, useState } from "react";

import * as yup from "yup";
import { getAuth, signOut } from "firebase/auth";

interface SignInFormValues {
  email: string;
  password: string;
}

const SignInPage: NextPageWithLayout = () => {
  const [, { handleError }] = useAuth();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const [isLoading, setIsLoading] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  const initialValues: SignInFormValues = {
    email: "",
    password: "",
  };

  const validationSchema = yup.object({
    email: yup.string().email("Invalid email address!"),
    password: yup.string().required("A secure password is required!"),
  });
  const handleSignIn = async ({ email, password }: SignInFormValues) => {
    try {
      setIsLoading(true);
      setSignInError(null);
      const returnR = await signIn(email, password);
      if (!returnR.emailVerified) {
        const msg = "Please verify your email first.";
        setSignInError(msg);
        enqueueSnackbar(msg, {
          variant: "error",
          autoHideDuration: 10000,
        });
        setIsLoading(false);
        await signOut(getAuth());
        return;
      }
      closeSnackbar();
    } catch (error) {
      const errorMessage = getFirebaseFriendlyError(error as FirebaseError);
      setIsLoading(false);
      console.log("errorMessage", errorMessage);
      setSignInError(
        errorMessage ===
          "There is no user record corresponding to this identifier." ||
          errorMessage === "The password is invalid."
          ? "The login information you entered is incorrect."
          : errorMessage,
      );
      handleError({ error, errorMessage });
    }
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
          variant="h4"
          sx={{
            mb: 0.75,
            fontWeight: 900,
            letterSpacing: "-0.02em",
            background:
              "linear-gradient(90deg, rgba(255, 184, 77, 0.98) 0%, rgba(255,255,255,0.92) 38%, rgba(255, 140, 0, 0.98) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            fontSize: { xs: "34px", sm: "52px" },
          }}
        >
          Sign In
        </Typography>
        <Typography
          sx={{
            mb: 3.25,
            color: "rgba(255,255,255,0.70)",
            fontSize: { xs: "0.98rem", sm: "1.05rem" },
            lineHeight: 1.4,
          }}
        >
          Welcome back. Sign in to continue.
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
          {signInError ? (
            <Alert
              severity="error"
              onClose={() => setSignInError(null)}
              icon={false}
              sx={{
                mb: 3,
                textAlign: "left",
                borderRadius: "18px",
                border: "1px solid rgba(255, 99, 99, 0.35)",
                background:
                  "linear-gradient(135deg, rgba(255, 78, 78, 0.18), rgba(255, 255, 255, 0.06))",
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
                Sign-in failed
              </AlertTitle>
              <Typography
                variant="body2"
                sx={{
                  color: "rgba(255,255,255,0.85)",
                  lineHeight: 1.5,
                  fontSize: "0.95rem",
                }}
              >
                {signInError}
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
            error={Boolean(formik.errors.email && formik.touched.email)}
            helperText={formik.touched.email && formik.errors.email}
            fullWidth
            sx={{
              mb: 2.25,
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

          <TextField
            id="password"
            name="password"
            label="Password"
            type="password"
            value={formik.values.password}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            variant="outlined"
            error={Boolean(formik.errors.password && formik.touched.password)}
            helperText={formik.touched.password && formik.errors.password}
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

          <LoadingButton
            aria-label="submit"
            loading={isLoading}
            disabled={formik.isSubmitting}
            type="submit"
            variant="contained"
            fullWidth
            sx={{
              borderRadius: "999px",
              py: 1.45,
              fontWeight: 800,
              fontSize: "15px",
              letterSpacing: "0.6px",
              textTransform: "none",
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
            Sign In
          </LoadingButton>

          <NextLink href={ROUTES.forgotPassword} passHref>
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
              Forgot Password?
            </Button>
          </NextLink>
        </form>
      </Paper>
    </Box>
  );
};

SignInPage.getLayout = (page: ReactNode) => {
  return <AuthLayout>{page}</AuthLayout>;
};

export default SignInPage;
