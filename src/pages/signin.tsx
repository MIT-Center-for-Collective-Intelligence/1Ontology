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
      const returnR = await signIn(email, password);
      if (!returnR.emailVerified) {
        enqueueSnackbar("Please verify your email first.", {
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
        justifyContent: "flex-start",
      }}
    >
      <Paper
        elevation={6}
        sx={{
          p: { xs: 3, sm: 5 },
          borderRadius: "25px",
          maxWidth: 420,
          width: "100%",
          mx: "auto",
          textAlign: "center",
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02)) !important",
        }}
      >
        <Typography
          variant="h4"
          sx={{
            mb: 3,
            fontWeight: 700,
            color: "primary.main",
            fontSize: { xs: "32px", sm: "50px" },
          }}
        >
          Sign In
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
            sx={{ mb: 3 }}
            InputProps={{
              sx: {
                fontSize: "19px",
                borderRadius: "20px",
                "& .MuiOutlinedInput-notchedOutline": {
                  borderRadius: "20px",
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
            sx={{ mb: 4 }}
            InputProps={{
              sx: {
                fontSize: "19px",
                borderRadius: "20px",
                "& .MuiOutlinedInput-notchedOutline": {
                  borderRadius: "20px",
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
              borderRadius: "30px",
              py: 1.5,
              fontWeight: 600,
              fontSize: "16px",
              letterSpacing: "0.5px",
            }}
          >
            Sign In
          </LoadingButton>

          <NextLink href={ROUTES.forgotPassword} passHref>
            <Button
              sx={{
                mt: 4,
                textTransform: "none",
                fontSize: "14px",
                borderRadius: "25px",
                ":hover": {
                  border: "1px solid gray",
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
