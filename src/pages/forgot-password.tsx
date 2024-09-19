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
import { useAuth } from " @components/components/context/AuthContext";
import AuthLayout from " @components/components/layouts/AuthLayout";
import { getFirebaseFriendlyError } from " @components/lib/utils/firebaseErrors";
import ROUTES from " @components/lib/utils/routes";
import { NextPageWithLayout } from " @components/types/IAuth";
import { LoadingButton } from "@mui/lab";
import { Box, Button, TextField, Typography } from "@mui/material";
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

  const initialValues: ForgotPasswordFormValues = {
    email: "",
  };

  const validationSchema = yup.object({
    email: yup.string().email("Invalid email address!"),
  });
  const handleSignIn = async ({ email }: ForgotPasswordFormValues) => {
    try {
      setIsLoading(true);

      await sendPasswordResetEmail(auth, email);
      enqueueSnackbar(
        "We have sent an email for reset the password to your email address.",
        {
          variant: "success",
          autoHideDuration: 10000,
        }
      );
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
    <Box sx={{ p: { xs: "8px", md: "24px", width: "100%" }, my: "92px" }}>
      <Typography variant="h1" sx={{ mb: "8px" }}>
        Reset Password
      </Typography>
      <Typography variant="body1" sx={{ mb: "32px" }}>
        You can reset password here!
      </Typography>
      <form data-testid="signin-form" onSubmit={formik.handleSubmit}>
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
          sx={{ mb: "24px" }}
        />
        <Box
          sx={{
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            mt: "10px",
          }}
        >
          <LoadingButton
            aria-label="submit"
            loading={isLoading}
            disabled={formik.isSubmitting}
            type="submit"
            variant="contained"
            fullWidth
            sx={{ borderRadius: "26px", width: "150px" }}
          >
            Send Email
          </LoadingButton>
          <NextLink href={ROUTES.signIn} passHref>
            <Button sx={{ my: "20px" }}>Sign In</Button>
          </NextLink>
        </Box>
      </form>
    </Box>
  );
};

ForgotPage.getLayout = (page: ReactNode) => {
  return <AuthLayout>{page}</AuthLayout>;
};

export default ForgotPage;
